/* DEUS Lernen - Telegram Mini App. Plain JS, no build step.
   All course material and progress come from the bot's API (src/miniapp.py in the bot repo);
   this file only draws screens. Texts: i18n.js. Addresses: config.js. */
(() => {
  "use strict";

  const CFG = window.DEUS_APP || {};
  const tg = window.Telegram && window.Telegram.WebApp;
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
  const IN_TELEGRAM = Boolean(tg && tg.initData);
  const API = LOCAL ? "/api/" : CFG.api;
  const ROUND_GAP_BAD = 3;    // a card rated "didn't know" comes back after this many others
  const ROUND_GAP_UNSURE = 6; // "not sure" a little later (same numbers as the chat's decks)
  const TYPING_VERBS = 10;

  const $ = (id) => document.getElementById(id);
  const view = $("view");
  const state = { lang: "en", me: null, content: null };
  const stack = [];
  let handlers = {};
  let keys = null;   // a keyboard handler for the current view (laptop), cleared on every render

  // ------------------------------------------------------------------ helpers
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LANGS = ["en", "de", "ru", "uz"];

  function t(key, vars) {
    const row = window.DEUS_I18N[key];
    let text = row ? row[LANGS.indexOf(state.lang)] || row[0] : key;
    if (vars) for (const name in vars) text = text.split(`{${name}}`).join(vars[name]);
    return text;
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function haptic(kind) {
    if (!IN_TELEGRAM || !tg.HapticFeedback) return;
    try {
      if (kind === "tap") tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.notificationOccurred(kind);
    } catch (e) { /* older clients */ }
  }

  let toastTimer = 0;
  function toast(text) {
    const node = $("toast");
    node.textContent = text;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3200);
  }

  async function api(action, body) {
    const response = await fetch(API + action, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // a "simple" request: no CORS preflight round trip
      body: JSON.stringify({ initData: IN_TELEGRAM ? tg.initData : "", ...(body || {}) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  // ------------------------------------------------------------------ saving results
  // A finished exercise must never get lost. It goes into an outbox on this phone first and leaves
  // it only once the bot has stored it (or refused it for good, e.g. a locked lesson). Without a
  // connection it stays there and is sent on the next start. Every result has its own id ("rid")
  // and the time it was done ("at"): the bot never counts the same id twice (session/receipts.py)
  // and counts a late one for the day it was done (miniapp._done_at), so the streak survives too.
  const OUTBOX_KEY = "deus.outbox";
  const OUTBOX_MAX_DAYS = 30;   // the bot remembers ids for 45 days (receipts.TTL_SECONDS)
  let outboxMemory = [];

  function outboxRead() {
    try {
      const list = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) { return outboxMemory; }
  }

  function outboxWrite(list) {
    outboxMemory = list;
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); } catch (e) { /* private mode: kept in memory */ }
  }

  const outboxDrop = (rid) => outboxWrite(outboxRead().filter((item) => !item.body || item.body.rid !== rid));
  const newRid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  // Worth sending again: no connection, a server error, or an expired Telegram signature (the app
  // was left open for a day) - not a refusal like "lesson locked".
  const retryable = (error) => !error.status || error.status >= 500 || error.status === 401;

  /** {result} when the bot answered, {error, keep} when not. */
  async function sendResult(item) {
    try { return { result: await api(item.action, item.body) }; }
    catch (error) { return { error, keep: retryable(error) }; }
  }

  /** Store a finished exercise. The bot's answer, or null when there is nothing new to show
   *  (kept for later, refused, or already stored before - then the app re-reads its progress). */
  async function saveResult(action, body) {
    const item = { action, body: { ...body, rid: newRid(), at: Math.floor(Date.now() / 1000) } };
    outboxWrite([...outboxRead(), item]);
    const sent = await sendResult(item);
    if (!sent.keep) outboxDrop(item.body.rid);
    if (sent.result && !sent.result.duplicate) {
      if (outboxRead().length) flushOutbox().then((n) => { if (n) refreshMe(); });
      return sent.result;
    }
    if (sent.result) refreshMe();
    else toast(t(sent.keep ? "saved_later" : "err_save"));
    return null;
  }

  let flushing = false;
  /** Send what is still waiting, oldest first; stops at the first one that can't go yet. */
  async function flushOutbox() {
    if (flushing) return 0;
    flushing = true;
    let stored = 0;
    try {
      const oldest = Date.now() / 1000 - OUTBOX_MAX_DAYS * 86400;
      for (const item of outboxRead()) {
        if (!item.body || !(item.body.at > oldest)) { outboxDrop(item.body && item.body.rid); continue; }
        const sent = await sendResult(item);
        if (sent.keep) break;
        outboxDrop(item.body.rid);
        if (sent.result && !sent.result.duplicate) stored += 1;
      }
    } finally {
      flushing = false;
    }
    return stored;
  }

  /** Progress changed behind the app's back (a late result went through): read it again. */
  async function refreshMe() {
    try {
      const fresh = await api("start");
      Object.assign(state.me, fresh);
      drawStreak();
      if (["home", "progress"].includes(current().view)) show();
    } catch (e) { /* the next start reads it */ }
  }

  async function loadContent() {
    if (!state.content) state.content = await api("content");
    return state.content;
  }

  // ------------------------------------------------------------------ navigation
  const TABS = ["home", "progress", "school"];

  function current() { return stack[stack.length - 1]; }

  // ---- where the student stopped: the app reopens there, and each tile reopens its section there.
  // `open` is the screen the app was closed on (the screens below the home screen; empty on it);
  // `paths` keeps, per section, the deepest screen last gone *into* - walking back out with Back
  // doesn't erase it. Exercises in progress aren't kept: one reopens on the screen it was started from.
  const PLACE_KEY = "deus.place";
  const SECTIONS = ["verbs", "grammar", "vocab", "wk", "rm"];   // separate courses add theirs (DEUS.course)
  const KEPT_VIEWS = ["verbs", "part", "grammar", "topic", "vocab", "wk", "wkLevel", "wkLesson", "rm", "rmLevel", "rmExam", "rmList"];
  const cloud = IN_TELEGRAM && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
  let place = { open: [], paths: {}, topic: null };
  let placeTimer = 0;

  function parsePlace(text) {
    try {
      const saved = JSON.parse(text);
      if (saved && typeof saved === "object") return { open: Array.isArray(saved.open) ? saved.open : [], paths: saved.paths || {}, topic: saved.topic || null };
    } catch (e) { /* not ours */ }
    return null;
  }

  /** This phone's copy first; on a new phone, the copy Telegram keeps for the account. */
  function readPlace() {
    let local = null;
    try {
      local = parsePlace(localStorage.getItem(PLACE_KEY));
      const level = !local && localStorage.getItem("deus.wk.level"); // the older, Wortkiste-only memory
      if (level) local = { open: [], paths: { wk: [{ view: "wk", params: {} }, { view: "wkLevel", params: { level } }] }, topic: null };
    } catch (e) { /* private mode */ }
    if (local || !cloud) return Promise.resolve(local);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 800);
      try {
        cloud.getItem(PLACE_KEY, (error, value) => { clearTimeout(timer); resolve(error ? null : parsePlace(value)); });
      } catch (e) { clearTimeout(timer); resolve(null); }
    });
  }

  function writePlace() {
    const text = JSON.stringify(place);
    try { localStorage.setItem(PLACE_KEY, text); } catch (e) { /* private mode */ }
    clearTimeout(placeTimer);
    if (cloud) placeTimer = setTimeout(() => { try { cloud.setItem(PLACE_KEY, text, () => {}); } catch (e) { /* older clients */ } }, 1500);
  }

  function notePlace(forward) {
    if (!stack.length || stack[0].view !== "home") return; // the other tabs don't move the place
    const below = [];
    for (const entry of stack.slice(1)) {
      if (!KEPT_VIEWS.includes(entry.view)) break;
      below.push({ view: entry.view, params: entry.params });
    }
    place.open = below;
    if (forward && below.length) place.paths[below[0].view] = below;
    writePlace();
  }

  /** Is this saved screen still there for this person (access, lessons and topics can change)? */
  function placeOk(entry) {
    const me = state.me, p = (entry && entry.params) || {};
    const lesson = () => { const level = wkLevel(p.level); return me.student && level && level.ready ? level : null; };
    switch (entry && entry.view) {
      case "verbs": case "grammar": return true;
      case "part": return me.verbs.parts.some((part) => part.part === p.part);
      case "topic": return me.grammar.topics.some((topic) => topic.id === p.id);
      case "vocab": case "wk": return Boolean(me.student);
      case "rm": case "rmLevel": case "rmExam": case "rmList": return true;   // the exam phrases are open to everyone
      case "wkLevel": return Boolean(lesson());
      case "wkLesson": return Boolean(lesson() && lesson().lessons.some((item) => item.n === p.lesson && item.open));
      default: {
        const course = COURSES.find((item) => item.kept.includes(entry && entry.view));
        return Boolean(course && course.placeOk(entry));
      }
    }
  }

  function keptPath(entries) {
    const path = [];
    if (!Array.isArray(entries) || !entries.length || !SECTIONS.includes(entries[0] && entries[0].view)) return path;
    for (const entry of entries) {
      if (!placeOk(entry)) break;
      path.push({ view: entry.view, params: { ...entry.params } });
    }
    return path;
  }

  /** Open a section from its tile: straight to where it was left, with Back leading up from there. */
  function enter(section) {
    const path = keptPath(place.paths[section]);
    if (!path.length) return go(section);
    stack.push(...path);
    render(true);
  }

  // ------------------------------------------------------------------ usage statistics
  // For the teacher's statistics (src/usage.py): how often each section is opened and how long it
  // is really used. Time only counts while the app is on screen and was touched in the last
  // USAGE_IDLE_MS. Sent about once a minute and when the app goes to the background.
  const USAGE_IDLE_MS = 2 * 60 * 1000;
  const USAGE_SEND_MS = 60 * 1000;
  const usage = { section: null, since: Date.now(), touched: Date.now(), pending: {} };

  /** The section on screen, as usage.APP_SECTIONS names it. */
  function sectionNow() {
    if (!stack.length) return null;
    const views = stack.map((entry) => entry.view);
    if (views.includes("stats")) return "stats";
    if (views.includes("about")) return "profile";
    if (views.includes("typing")) return "typing";
    if (stack.some((entry) => entry.view === "deck" && entry.params.kind === "supertest")) return "supertest";
    const first = stack[1];
    if (!first) return views[0];   // home, progress, school
    if (first.view === "deck") return "verbs";
    if (first.view === "quiz") return first.params.kind;   // articles, prepositions
    if (["verbs", "part"].includes(first.view)) return "verbs";
    if (["grammar", "topic", "round"].includes(first.view)) return "grammar";
    if (["vocab", "words"].includes(first.view)) return "vocab";
    if (first.view.startsWith("wk")) return "wk";
    if (first.view.startsWith("rm")) return "rm";
    const course = COURSES.find((item) => first.view in item.views);
    return course ? course.id : views[0];
  }

  function usageAdd(section, uses, ms) {
    const item = usage.pending[section] || (usage.pending[section] = [0, 0]);
    item[0] += uses;
    item[1] += ms;
  }

  /** Book the time since the last tick to the section that was on screen. */
  function usageTick() {
    const now = Date.now();
    if (usage.section) usageAdd(usage.section, 0, Math.max(0, Math.min(now, usage.touched + USAGE_IDLE_MS) - usage.since));
    usage.since = now;
  }

  function usageNote() {
    const section = sectionNow();
    if (section === usage.section) return;
    usageTick();
    usage.section = section;
    if (section) usageAdd(section, 1, 0);
  }

  function usageSend(leaving) {
    if (!state.me) return;
    usageTick();
    const sections = {};
    for (const [key, [uses, ms]] of Object.entries(usage.pending)) {
      const seconds = Math.round(ms / 1000);
      if (uses || seconds) sections[key] = [uses, seconds];
    }
    usage.pending = {};
    if (!Object.keys(sections).length) return;
    if (leaving && navigator.sendBeacon) {
      const body = JSON.stringify({ initData: IN_TELEGRAM ? tg.initData : "", sections });
      if (navigator.sendBeacon(API + "usage", new Blob([body], { type: "text/plain" }))) return;
    }
    api("usage", { sections }).catch(() => {});
  }

  for (const name of ["pointerdown", "keydown", "scroll"]) {
    document.addEventListener(name, () => { usage.touched = Date.now(); }, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) usageSend(true);
    else usage.since = usage.touched = Date.now();
  });
  window.addEventListener("pagehide", () => usageSend(true));
  setInterval(() => { if (!document.hidden) usageSend(false); }, USAGE_SEND_MS);

  function show() { render(false); }

  function render(forward) {
    const entry = current();
    handlers = {};
    keys = null;
    view.className = "";
    if (flagWord) wkFlag(null);
    VIEWS[entry.view](entry.params || {}, entry);
    window.scrollTo(0, 0);
    const root = stack.length === 1 && TABS.includes(entry.view);
    $("tabs").hidden = !root;
    document.body.classList.toggle("has-tabs", root);
    for (const button of $("tabs").querySelectorAll("button")) button.classList.toggle("on", button.dataset.tab === entry.view);
    if (IN_TELEGRAM && tg.BackButton) {
      if (stack.length > 1) tg.BackButton.show(); else tg.BackButton.hide();
      $("back").hidden = true;
    } else {
      $("back").hidden = stack.length <= 1;
    }
    drawStreak();
    notePlace(forward);
    usageNote();
  }

  function go(name, params) { stack.push({ view: name, params: params || {} }); render(true); }
  function back() { if (stack.length > 1) { stack.pop(); show(); } }
  function tab(name) { stack.length = 0; go(name); }
  function swap(name, params) { stack.pop(); go(name, params); }
  function title(text) { $("title").textContent = text; }

  function drawStreak() {
    const node = $("streak");
    const progress = state.me && state.me.progress;
    node.hidden = !progress || !progress.streak;
    if (progress) {
      node.textContent = `🔥 ${progress.streak}`;
      node.classList.toggle("today", Boolean(progress.practised_today));
    }
  }

  /** Draw `html` now; run `load()`, then `draw(result)` if the student is still on this screen. */
  async function loading(entry, load, draw) {
    view.innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    try {
      const result = await load();
      if (current() === entry) draw(result);
    } catch (error) {
      if (current() !== entry) return;
      view.innerHTML = `<div class="empty"><p>${esc(error.status === 401 ? t("err_auth") : t("err_net"))}</p><button class="btn" data-act="retry">${esc(t("retry"))}</button></div>`;
      handlers = { retry: show };
    }
  }

  /** For exercise screens on a laptop: 1-9 press the n-th answer (or card rating), Enter or Space the main button. */
  function choiceKeys(event) {
    const press = (node) => { if (node) { event.preventDefault(); node.click(); } };
    if (/^[1-9]$/.test(event.key)) {
      press(view.querySelectorAll('[data-act="pick"]:not(:disabled), [data-act="rate"]')[Number(event.key) - 1]);
    } else if (event.key === "Enter" || event.key === " ") {
      press(view.querySelector('[data-act="next"], button[data-act="reveal"], [data-act="check"]:not(:disabled), [data-act="done"]'));
    }
  }

  document.addEventListener("keydown", (event) => {
    if (keys && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) keys(event);
  });
  view.addEventListener("click", (event) => {
    const node = event.target.closest("[data-act]");
    if (!node || node.disabled) return;
    const handler = handlers[node.dataset.act];
    if (handler) handler(node.dataset, node);
  });
  $("back").addEventListener("click", back);
  $("tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (button) { haptic("tap"); tab(button.dataset.tab); }
  });

  // ------------------------------------------------------------------ small pieces
  const levelLabel = (code) => (code === "never" ? t("lvl_never") : String(code || "").toUpperCase());

  function row(act, data, main, sub, right, mark) {
    const attrs = Object.entries(data || {}).map(([key, value]) => ` data-${key}="${esc(value)}"`).join("");
    return `<button class="row" type="button" data-act="${act}"${attrs}>
      ${mark ? `<span class="mark ${mark.cls || ""}">${esc(mark.text)}</span>` : ""}
      <span class="row-text"><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>
      ${right ? `<span class="row-right">${right}</span>` : ""}
      <svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  }

  // A progress line fills faster at the start and slower near the end: half the way fills three
  // quarters of the line (1 - (1 - p)²), so the goal always feels close. The numbers next to it
  // stay exact. `linear` for a line that has its percentage written next to it.
  const eased = (done, total) => (total ? 100 * (1 - Math.pow(1 - Math.min(Math.max(done, 0), total) / total, 2)) : 0);
  const bar = (done, total, linear) => `<span class="meter"><i style="width:${total ? (linear ? Math.round((100 * done) / total) : eased(done, total).toFixed(1)) : 0}%"></i></span>`;

  function openChat(start) {
    const link = `https://t.me/${CFG.bot}${start ? `?start=${start}` : ""}`;
    if (IN_TELEGRAM) {
      if (start) tg.openTelegramLink(link); else tg.close();
    } else {
      window.open(link, "_blank");
    }
  }

  function openSite(path) {
    const url = CFG.site + path;
    if (IN_TELEGRAM) tg.openLink(url); else window.open(url, "_blank");
  }

  async function deckDone(kind, part, score) {
    const before = levelShares();
    const result = await saveResult("deck_done", { kind, ...(part ? { part } : {}), ...(score || {}) });
    if (!result) return;
    state.me.progress = result.progress;
    if (result.learned) state.me.verbs.learned = result.learned;
    drawStreak();
    showReward(result.reward, before, ["verbs", "typing", "supertest", "mistakes"].includes(kind) ? "verbs:" : null);
  }

  // ---- rewards: what a finished exercise brought (gamify.py in the bot decides the numbers).
  // The order of the hooks: the daily goal (streak) first, then "one more" with the standing
  // against the other learners, then the 50 % / 100 % milestones of a course level.
  /** done/total of every course level the student can work through, keyed "section:level". */
  function levelShares() {
    const me = state.me, shares = {};
    shares["verbs:"] = { name: t("verbs"), done: me.verbs.learned.length, total: me.verbs.parts.length };
    for (const level of me.grammar.levels) {
      const topics = me.grammar.topics.filter((topic) => topic.level === level);
      shares[`grammar:${level}`] = { name: `${t("grammar")} ${level}`, done: topics.filter((topic) => me.grammar.done[topic.id]).length, total: topics.length };
    }
    if (me.student) for (const level of me.wortkiste.levels) {
      if (level.ready) shares[`wk:${level.id}`] = { name: `Wortkiste ${level.label}`, done: level.lessons.filter((lesson) => lesson.passed).length, total: level.lessons.length };
    }
    return shares;
  }

  /** The milestone just crossed between two levelShares(), if any: 100 % beats 50 %. */
  function milestone(before) {
    const after = levelShares();
    let best = null;
    for (const key in after) {
      const now = after[key], then = before[key];
      if (!then || !now.total || now.done <= then.done) continue;
      if (now.done === now.total) return { full: true, ...now };
      if (2 * now.done >= now.total && 2 * then.done < now.total) best = { full: false, ...now };
    }
    return best;
  }

  /** Fill the reward box of the done screen that is showing now (if the student is still on it). */
  function showReward(reward, before, key) {
    const box = $("reward");
    if (!box || !reward) return;
    const after = key ? levelShares()[key] : null;
    const from = before && key && before[key] ? before[key].done : after && after.done;
    const game = state.me.progress.game;
    if (game) Object.assign(game, { today: reward.today, xp_week: reward.xp_week, xp_total: reward.xp_total, shields: reward.shields, ahead: reward.ahead });
    const lines = [];
    if (reward.shield_used) lines.push(t("rw_shield_used"));
    if (reward.goal_reached_now) lines.push(`<b>${esc(reward.streak > 1 ? t("rw_goal", { n: reward.streak }) : t("rw_goal_first"))}</b>`);
    else if (reward.today === 2) lines.push(esc(t("rw_two")));
    else if (reward.today >= 5) lines.push(`<b>${esc(t("rw_many", { n: reward.today }))}</b>`);
    else if (reward.today > 2) lines.push(esc(t("rw_more", { n: reward.today })));
    if (reward.shield_won) lines.push(esc(t("rw_shield_won")));
    lines.push(esc(reward.ahead != null && reward.ahead >= 50 ? t("rw_ahead", { p: reward.ahead }) : t("rw_climb")));
    const stone = before ? milestone(before) : null;
    box.innerHTML = `
      <span class="xp">+${reward.xp} XP</span>
      ${stone ? `<p class="milestone ${stone.full ? "full" : ""}">${esc(stone.full ? `🏆 ${t("ms_full", stone)}` : t("ms_half", stone))}</p>` : ""}
      ${after && after.total ? `<div class="level-line">
        <div><b>${esc(after.name)}</b></div>
        <span class="meter grow"><i style="width:${eased(from, after.total).toFixed(1)}%"></i></span>
        <small>${esc(after.done >= after.total ? t("ll_done") : t("ll_left", { n: after.total - after.done }))}</small>
      </div>` : ""}
      ${lines.map((line) => `<p>${line}</p>`).join("")}`;
    box.hidden = false;
    const grow = box.querySelector(".meter.grow i");   // the line grows from before to now
    if (grow && after) requestAnimationFrame(() => requestAnimationFrame(() => { grow.style.width = `${eased(after.done, after.total).toFixed(1)}%`; }));
    if (stone && stone.full) {
      const emoji = view.querySelector(".done-emoji");
      if (emoji) emoji.textContent = "🏆";
    }
    haptic(reward.goal_reached_now || stone ? "success" : "tap");
  }

  // What someone who isn't a DEUS student sees on a student section (the bot decides, not the app):
  // one line and two equal buttons - neither is pushed.
  function lockPanel() {
    return `<div class="lock">
      <div class="lock-icon">🔒</div>
      <p><b>${esc(t("lock_students"))}</b></p>
      <button class="btn" data-act="lock-write">${esc(t("lock_write"))}</button>
      <button class="btn" data-act="lock-trial">${esc(t("lock_trial"))}</button>
    </div>`;
  }
  // "I'm a student": a chat with the teacher, with the request already typed in.
  function askForAccess() {
    const link = `https://t.me/${CFG.teacher}?text=${encodeURIComponent(t("lock_msg"))}`;
    if (IN_TELEGRAM) tg.openTelegramLink(link); else window.open(link, "_blank");
  }
  const lockHandlers = { "lock-trial": () => openChat("trial"), "lock-write": askForAccess };

  function doneScreen({ emoji, headline, lines, buttons, review }) {
    view.className = review ? "" : "center";   // a long review must scroll from the top
    view.innerHTML = `<div class="done">
      <div class="done-emoji">${emoji}</div>
      <h2>${esc(headline)}</h2>
      ${lines.map((line) => `<p>${esc(line)}</p>`).join("")}
      <div class="reward" id="reward" hidden></div>
      ${review || ""}
      <div class="stack">${buttons.map((b, i) => `<button class="btn ${i ? "ghost" : ""}" data-act="${b.act}">${esc(b.label)}</button>`).join("")}</div>
    </div>`;
  }

  /** After a test: every question missed at the first try, with the answer given and the right one. */
  function mistakeReview(mistakes) {
    if (!mistakes.length) return `<p class="review-none">${esc(t("review_none"))}</p>`;
    return `<section class="review">
      <h3>${esc(t("review_title", { n: mistakes.length }))}</h3>
      ${mistakes.map((m) => `<div class="review-item">
        ${m.sub ? `<small>${esc(m.sub)}</small>` : ""}
        <b>${esc(m.prompt)}</b>
        <span class="review-wrong">✗ ${esc(m.given || "—")}</span>
        <span class="review-right">✓ ${esc(m.answer)}</span>
      </div>`).join("")}
    </section>`;
  }

  // The first thing on the home screen: today's goal (one exercise keeps the streak), then the
  // week's points and how they compare with the other learners.
  function goalCard(me) {
    const game = me.progress.game || { today: 0, goal: 1, xp_week: 0, shields: 0 };
    const reached = game.today >= game.goal;
    const streak = me.progress.streak;
    return `<section class="goal ${reached ? "done" : ""}">
        <div class="goal-flame">${reached ? "🔥" : "⏳"}<b>${streak}</b></div>
        <div class="goal-text">
          <b>${esc(reached ? t("goal_done", { n: game.today }) : streak ? t("goal_todo", { n: streak }) : t("goal_new"))}</b>
          <small>${esc(t("goal_week", { xp: game.xp_week }))}${game.ahead != null && game.ahead >= 50 ? ` · ${esc(t("goal_ahead", { p: game.ahead }))}` : ""}${game.shields ? ` · 🛡 ${game.shields}` : ""}</small>
          ${reached ? `<small class="goal-more">${esc(t("goal_more"))}</small>` : ""}
        </div>
      </section>`;
  }

  // ------------------------------------------------------------------ views
  const VIEWS = {};

  const tile = (act, icon, name, sub, done, total, locked) => `<button class="tile ${locked ? "locked" : ""}" type="button" data-act="${act}">
      ${locked ? `<span class="tile-lock" aria-hidden="true">🔒</span>` : ""}
      <span class="tile-icon">${icon}</span>
      <b>${esc(name)}</b>
      <small>${esc(sub)}</small>
      ${total ? `<span class="tile-meter">${bar(done, total)}<em>${done}/${total}</em></span>` : ""}
    </button>`;

  VIEWS.home = () => {
    const me = state.me;
    title("DEUS Lernen");
    const grammarDone = Object.keys(me.grammar.done).length;
    const vocabStarted = me.vocab.topics.filter((topic) => topic.pos > 0).length;
    const wkAll = me.wortkiste.levels.flatMap((level) => level.lessons);
    const wkPassed = wkAll.filter((lesson) => lesson.passed).length, wkLessons = me.student ? wkAll.length : 0;
    // DEUS students get the course tools (Booster, Wortkiste, PrüfungsPhrasen) and no loose extras;
    // everyone else gets the open exercises and the same exam phrases as "Redemittel", and sees the
    // student sections with a lock - PrüfungsPhrasen as a teaser that doesn't say what's inside.
    const forStudents = (locked) => `
        ${tile("vocab", "🧠", t("vocab"), t("vocab_sub"), vocabStarted, locked ? 0 : me.vocab.topics.length, locked)}
        ${tile("wk", "📦", "Wortkiste", t("wk_sub"), wkPassed, wkLessons, locked)}
        ${locked ? tile("rmTease", "📝", t("rm"), t("rm_tease_sub"), 0, 0, true) : tile("rm", "📝", t("rm"), t("rm_sub"))}`;
    view.innerHTML = `
      <section class="hello">
        <h1>${esc(me.name ? t("hello_name", { name: me.name }) : t("hello"))}</h1>
      </section>
      ${goalCard(me)}
      ${pathCard(me)}
      <section class="tiles">
        ${tile("verbs", "🔤", t("verbs"), t("verbs_sub"), me.verbs.learned.length, me.verbs.parts.length)}
        ${tile("grammar", "📘", t("grammar"), t("grammar_sub"), grammarDone, me.grammar.topics.length)}
        ${me.student ? forStudents(false) : `
        ${tile("articles", "🎯", t("articles"), "der · die · das")}
        ${tile("prepositions", "🧭", t("prepositions"), "Akkusativ · Dativ · Genitiv")}
        ${tile("sophie", "💬", t("sophie"), t("sophie_sub"))}
        ${tile("rm", "🗣", "Redemittel", t("rm_sub"))}
        ${forStudents(true)}`}
        ${COURSES.map((course) => course.tile(me, tile)).join("")}
      </section>`;
    handlers = {
      verbs: () => enter("verbs"),
      grammar: () => enter("grammar"),
      vocab: () => enter("vocab"),
      wk: () => enter("wk"),
      rm: () => enter("rm"),
      rmTease: () => go("rmTease"),
      articles: () => go("quiz", { kind: "articles" }),
      prepositions: () => go("quiz", { kind: "prepositions" }),
      sophie: () => openChat(),
      ...Object.fromEntries(COURSES.map((course) => [course.id, () => enter(course.id)])),
    };
  };

  // ---- verbs
  VIEWS.verbs = () => {
    const verbs = state.me.verbs;
    title(t("verbs"));
    const total = verbs.parts.reduce((sum, part) => sum + part.count, 0);
    view.innerHTML = `
      <p class="lead">${esc(t("verbs_intro", { n: total }))}</p>
      <div class="list">
        ${verbs.mistakes.length ? row("mistakes", {}, t("mistakes"), t("mistakes_sub"), `<span class="pill red">${verbs.mistakes.length}</span>`, { text: "!", cls: "red" }) : ""}
        ${row("supertest", {}, "Supertest", t("supertest_sub", { n: verbs.supertest }), "", { text: "★", cls: "gold" })}
      </div>
      <h3 class="section">${esc(t("levels"))}</h3>
      <div class="list">
        ${verbs.parts.map((part) => row("part", { part: part.part }, `${t("level")} ${part.part}`, `${part.first} – ${part.last}`,
          `<span class="count">${part.count}</span>`, verbs.learned.includes(part.part) ? { text: "✓", cls: "ok" } : { text: String(part.part) })).join("")}
      </div>`;
    handlers = {
      part: (data) => go("part", { part: Number(data.part) }),
      supertest: () => go("deck", { kind: "supertest" }),
      mistakes: () => go("deck", { kind: "mistakes" }),
    };
  };

  VIEWS.part = ({ part }, entry) => {
    title(`${t("level")} ${part}`);
    loading(entry, loadContent, (content) => {
      const verbs = content.verbs.filter((verb) => verb.part === part);
      // Two exercises of equal weight, drawn the same way (like the steps of a Wortkiste lesson).
      view.innerHTML = `
        <h3 class="section">${esc(t("exercises"))}</h3>
        <div class="list">
          ${row("cards", {}, t("mode_cards"), t("mode_cards_sub"), state.me.verbs.learned.includes(part) ? `<span class="pill ok">✓</span>` : "", { text: "🃏" })}
          ${row("typing", {}, t("mode_typing"), t("mode_typing_sub"), "", { text: "✍️" })}
        </div>
        <h3 class="section">${esc(t("verbs_count", { n: verbs.length }))}</h3>
        <div class="verbs">
          ${verbs.map((verb) => `<div class="verb"><b>${esc(verb.inf)}</b><span>${esc(verb.praet)} · ${esc(verb.perf)}</span><small>${esc(state.lang === "ru" || state.lang === "uz" ? verb.ru : verb.en)}</small></div>`).join("")}
        </div>`;
      handlers = {
        cards: () => go("deck", { kind: "verbs", part }),
        typing: () => go("typing", { part }),
      };
    });
  };

  function verbsFor(content, kind, part) {
    if (kind === "verbs") return content.verbs.filter((verb) => verb.part === part);
    if (kind === "mistakes") return state.me.verbs.mistakes.map((inf) => content.verbs.find((verb) => verb.inf === inf)).filter(Boolean);
    return shuffle(content.verbs).slice(0, state.me.verbs.supertest);
  }

  // Flashcards: recall, reveal, rate. A card leaves the deck only when rated "knew it".
  VIEWS.deck = ({ kind, part }, entry) => {
    const name = kind === "verbs" ? `${t("level")} ${part}` : kind === "mistakes" ? t("mistakes") : "Supertest";
    title(name);
    loading(entry, loadContent, (content) => {
      const queue = verbsFor(content, kind, part);
      const total = queue.length;
      let learned = 0, repeats = 0, revealed = false;

      const draw = () => {
        if (!queue.length) return finish();
        const verb = queue[0];
        view.className = "session";
        view.innerHTML = `
          <div class="session-top">${bar(learned, total)}</div>
          <button class="card ${revealed ? "open" : ""}" type="button" data-act="reveal">
            <span class="card-word">${esc(verb.inf)}</span>
            ${revealed ? `<span class="card-forms"><b>${esc(verb.praet)}</b><b>${esc(verb.perf)}</b></span>
              <span class="card-meaning">${esc(verb.ru)}<br>${esc(verb.en)}</span>`
              : `<span class="card-hint">${esc(t("card_hint"))}</span>`}
          </button>
          <div class="session-bottom">
            ${revealed ? `<div class="rate">
                <button class="btn bad" data-act="rate" data-r="bad">${esc(t("rate_bad"))}</button>
                <button class="btn unsure" data-act="rate" data-r="unsure">${esc(t("rate_unsure"))}</button>
                <button class="btn good" data-act="rate" data-r="good">${esc(t("rate_good"))}</button>
              </div>` : `<button class="btn" data-act="reveal">${esc(t("show"))}</button>`}
          </div>`;
      };

      const finish = () => {
        haptic("success");
        deckDone(kind, part);
        const next = kind === "verbs" && part < state.me.verbs.parts.length;
        doneScreen({
          emoji: "🎉",
          headline: t("deck_done", { name }),
          lines: [t("deck_stats", { total, repeats })],
          buttons: [
            ...(kind === "verbs" ? [{ act: "typing", label: t("mode_typing") }] : []),
            ...(next ? [{ act: "next", label: t("next_level") }] : []),
            { act: "again", label: t("again") },
            { act: "back", label: t("done_back") },
          ],
        });
        handlers = {
          typing: () => swap("typing", { part }),
          next: () => { stack.pop(); swap("part", { part: part + 1 }); },
          again: show,
          back,
        };
      };

      handlers = {
        reveal: () => { if (!revealed) { revealed = true; haptic("tap"); draw(); } },
        rate: (data) => {
          const card = queue.shift();
          if (data.r === "good") learned += 1;
          else {
            queue.splice(Math.min(data.r === "bad" ? ROUND_GAP_BAD : ROUND_GAP_UNSURE, queue.length), 0, card);
            repeats += 1;
          }
          revealed = false;
          haptic("tap");
          draw();
        },
      };
      if (!total) {
        view.innerHTML = `<div class="empty"><p>${esc(t("mistakes_none"))}</p></div>`;
        return;
      }
      draw();
    });
  };

  // Typing: the three things the real test asks for, graded by the same code as the chat's test.
  VIEWS.typing = ({ part }, entry) => {
    title(`${t("level")} ${part} · ${t("mode_typing")}`);
    loading(entry, loadContent, (content) => {
      const verbs = shuffle(content.verbs.filter((verb) => verb.part === part)).slice(0, TYPING_VERBS);
      let index = 0, points = 0, full = 0;

      const ask = () => {
        const verb = verbs[index];
        view.className = "session";
        view.innerHTML = `
          <div class="session-top">${bar(index, verbs.length)}</div>
          <form class="typing" data-form autocomplete="off">
            <div class="typing-word">${esc(verb.inf)}</div>
            <label><span>Präteritum</span><input name="praeteritum" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"></label>
            <label><span>Perfekt</span><input name="perfekt" placeholder="hat / ist …" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"></label>
            <label><span>${esc(t("translation"))}</span><input name="translation" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"></label>
            <button class="btn" type="submit">${esc(t("check"))}</button>
          </form>`;
        const form = view.querySelector("form");
        const inputs = [...form.querySelectorAll("input")];
        inputs[0].focus({ preventScroll: true });
        inputs.forEach((input, i) => input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && i < inputs.length - 1) { event.preventDefault(); inputs[i + 1].focus(); }
        }));
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const button = form.querySelector("button");
          if (button.disabled) return;
          button.disabled = true;
          const given = Object.fromEntries(inputs.map((input) => [input.name, input.value.trim()]));
          try {
            const result = await api("verb_check", { inf: verb.inf, ...given });
            if (current() === entry) answer(verb, given, result);
          } catch (error) {
            button.disabled = false;
            toast(t("err_net"));
          }
        });
      };

      const answer = (verb, given, result) => {
        const right = Object.values(result.correct).filter(Boolean).length;
        points += right;
        if (right === 3) full += 1;
        haptic(right === 3 ? "success" : "error");
        const line = (label, field, typed, solution) => `<div class="check ${result.correct[field] ? "ok" : "no"}">
            <span>${esc(label)}</span>
            <b>${esc(solution)}</b>
            ${result.correct[field] ? "" : `<s>${esc(typed || "—")}</s>`}
          </div>`;
        view.innerHTML = `
          <div class="session-top">${bar(index + 1, verbs.length)}</div>
          <div class="typing">
            <div class="typing-word">${esc(verb.inf)}</div>
            ${line("Präteritum", "praeteritum", given.praeteritum, result.solution.praet)}
            ${line("Perfekt", "perfekt", given.perfekt, result.solution.perf)}
            ${line(t("translation"), "translation", given.translation, `${result.solution.ru} · ${result.solution.en}`)}
            ${result.typo ? `<p class="note">✏️ ${esc(t("typo", { typed: result.typo[0], correct: result.typo[1] }))}</p>` : ""}
            <button class="btn" data-act="next">${esc(t(index + 1 < verbs.length ? "next" : "finish"))}</button>
          </div>`;
        handlers = { next: () => { index += 1; if (index < verbs.length) ask(); else finish(); } };
        view.querySelector("[data-act=next]").focus({ preventScroll: true });
      };

      const finish = () => {
        const percent = Math.round((100 * points) / (3 * verbs.length));
        deckDone("typing", null, { right: points, total: 3 * verbs.length });
        doneScreen({
          emoji: percent >= 80 ? "🏆" : "💪",
          headline: `${percent}%`,
          lines: [t("typing_stats", { full, total: verbs.length }), t(percent >= 80 ? "typing_good" : "typing_low")],
          buttons: [{ act: "again", label: t("again") }, { act: "cards", label: t("mode_cards") }, { act: "back", label: t("done_back") }],
        });
        handlers = { again: show, cards: () => swap("deck", { kind: "verbs", part }), back };
      };

      ask();
    });
  };

  // ---- articles and prepositions: tap the right answer; a missed one comes back.
  const QUIZ = {
    articles: {
      title: () => t("articles"),
      items: (content) => content.articles.map((card) => ({ prompt: card.noun, sub: card.en, answer: card.article, after: `${card.article} ${card.noun}` })),
      options: () => [{ value: "der", cls: "der" }, { value: "die", cls: "die" }, { value: "das", cls: "das" }],
    },
    prepositions: {
      title: () => t("prepositions"),
      items: (content) => content.prepositions.map((card) => ({ prompt: card.word, sub: t("prep_question"), answer: card.case, after: card.example })),
      options: (content) => [...new Set(content.prepositions.map((card) => card.case))].map((value) => ({ value, label: value.replace(/\s*\(.*\)/, "").replace("Wechselp", "Wechsel\u00adp") })),
    },
  };

  VIEWS.quiz = ({ kind }, entry) => {
    const spec = QUIZ[kind];
    title(spec.title());
    loading(entry, loadContent, (content) => {
      const queue = shuffle(spec.items(content));
      const options = spec.options(content);
      const total = queue.length;
      let learned = 0, repeats = 0, picked = null;

      const draw = () => {
        if (!queue.length) return finish();
        const item = queue[0];
        const answered = picked !== null;
        view.className = "session";
        view.innerHTML = `
          <div class="session-top">${bar(learned, total)}</div>
          <div class="card static ${answered ? (picked === item.answer ? "right" : "wrong") : ""}">
            <span class="card-word">${esc(item.prompt)}</span>
            <span class="card-hint">${esc(answered ? item.after : item.sub)}</span>
          </div>
          <div class="session-bottom">
            <div class="choices n${options.length}">
              ${options.map((option) => `<button class="btn choice ${option.cls || ""} ${answered && option.value === item.answer ? "is-right" : ""} ${answered && option.value === picked && picked !== item.answer ? "is-wrong" : ""}"
                data-act="pick" data-v="${esc(option.value)}" ${answered ? "disabled" : ""}>${esc(option.label || option.value)}</button>`).join("")}
            </div>
            <button class="btn" data-act="next" ${answered ? "" : "hidden"}>${esc(t("next"))}</button>
          </div>`;
      };

      const advance = () => {
        const item = queue.shift();
        if (picked === item.answer) learned += 1;
        else { queue.splice(Math.min(ROUND_GAP_BAD, queue.length), 0, item); repeats += 1; }
        picked = null;
        draw();
      };

      const finish = () => {
        haptic("success");
        deckDone(kind);
        doneScreen({
          emoji: "🎉",
          headline: t("deck_done", { name: spec.title() }),
          lines: [t("deck_stats", { total, repeats })],
          buttons: [{ act: "again", label: t("again") }, { act: "back", label: t("done_back") }],
        });
        handlers = { again: show, back };
      };

      handlers = {
        pick: (data) => {
          if (picked !== null) return;
          picked = data.v;
          haptic(picked === queue[0].answer ? "success" : "error");
          draw(); // right or wrong, the answer stays up until "Next"
        },
        next: advance,
      };
      draw();
    });
  };

  // ---- grammar
  VIEWS.grammar = (params, entry) => {
    const grammar = state.me.grammar;
    title(t("grammar"));
    const known = (state.me.progress.level_check || state.me.progress.level || "").toUpperCase();
    // The level last looked at is part of the place the app remembers; the first time it's the student's own.
    if (!grammar.levels.includes(params.level)) params.level = grammar.levels.includes(known) ? known : grammar.levels[0];
    const draw = () => {
      const topics = grammar.topics.filter((topic) => topic.level === params.level);
      view.innerHTML = `
        <div class="chips">${grammar.levels.map((level) => `<button class="chip ${level === params.level ? "on" : ""}" data-act="level" data-level="${level}">${level}</button>`).join("")}</div>
        <div class="list">
          ${topics.map((topic) => {
            const done = grammar.done[topic.id];
            return row("topic", { id: topic.id }, topic.title, "", done ? `<span class="pill ${done.best >= 80 ? "ok" : ""}">${done.best}%</span>` : "");
          }).join("")}
        </div>`;
    };
    handlers = {
      level: (data) => { params.level = data.level; haptic("tap"); draw(); notePlace(true); },
      topic: (data) => go("topic", { id: data.id }),
    };
    draw();
  };

  const emphasise = (text) => esc(text).replace(/\*(.+?)\*/g, "<b>$1</b>");

  VIEWS.topic = ({ id }, entry) => {
    const listed = state.me.grammar.topics.find((topic) => topic.id === id);
    title(listed ? listed.title : t("grammar"));
    loading(entry, () => api("grammar_topic", { id }), (topic) => {
      view.innerHTML = `
        <article class="rule">
          <p class="kicker">${esc(topic.level)}</p>
          <h2>${esc(topic.title_de)}</h2>
          ${topic.title !== topic.title_de ? `<p class="sub">${esc(topic.title)}</p>` : ""}
          <p>${esc(topic.rule)}</p>
          <pre>${esc(topic.table)}</pre>
          <h3 class="section">${esc(t("examples"))}</h3>
          <ul class="examples">${topic.examples.map((example) => `<li>${emphasise(example)}</li>`).join("")}</ul>
          ${topic.related.length ? `<div class="list">${topic.related.map((other) => row("related", { id: other.id }, other.title)).join("")}</div>` : ""}
        </article>
        <div class="sticky"><button class="btn" data-act="practise">${esc(t("practise"))}</button></div>`;
      handlers = {
        practise: () => go("round", { id, name: topic.title_de }),
        related: (data) => go("topic", { id: data.id }),
      };
    });
  };

  VIEWS.round = ({ id, name }, entry) => {
    title(name);
    loading(entry, () => api("grammar_round", { id }), ({ tasks }) => {
      let index = 0, right = 0, picked = null;

      const draw = () => {
        const task = tasks[index];
        const answered = picked !== null;
        const correct = picked === task.answer;
        view.className = "session";
        view.innerHTML = `
          <div class="session-top">${bar(index + (answered ? 1 : 0), tasks.length)}</div>
          <div class="task ${answered ? (correct ? "right" : "wrong") : ""}">
            <p class="task-q">${esc(answered ? task.solution : task.q)}</p>
            ${answered && task.hint ? `<p class="note">💡 ${esc(task.hint)}</p>` : ""}
          </div>
          <div class="session-bottom">
            <div class="choices col">
              ${task.options.map((option, i) => `<button class="btn choice ${answered && i === task.answer ? "is-right" : ""} ${answered && i === picked && !correct ? "is-wrong" : ""}"
                data-act="pick" data-i="${i}" ${answered ? "disabled" : ""}>${esc(option)}</button>`).join("")}
            </div>
            <button class="btn" data-act="next" ${answered ? "" : "hidden"}>${esc(t(index + 1 < tasks.length ? "next" : "finish"))}</button>
          </div>`;
      };

      const finish = async () => {
        const total = tasks.length;
        const verdict = right === total ? "round_top" : right >= total - 2 ? "round_good" : "round_low";
        doneScreen({
          emoji: right === total ? "🏆" : right >= total - 2 ? "👍" : "💪",
          headline: `${right}/${total}`,
          lines: [t(verdict)],
          buttons: [{ act: "again", label: t("round_more") }, { act: "back", label: t("round_rule") }],
        });
        handlers = { again: show, back };
        const before = levelShares();
        const result = await saveResult("grammar_result", { id, right, total });
        if (!result) return;
        state.me.grammar.done = result.done;
        if (result.progress) { state.me.progress = result.progress; drawStreak(); }
        const topic = state.me.grammar.topics.find((item) => item.id === id);
        showReward(result.reward, before, topic ? `grammar:${topic.level}` : null);
      };

      handlers = {
        pick: (data) => {
          if (picked !== null) return;
          picked = Number(data.i);
          const correct = picked === tasks[index].answer;
          if (correct) right += 1;
          haptic(correct ? "success" : "error");
          draw();
        },
        next: () => { index += 1; picked = null; if (index < tasks.length) draw(); else finish(); },
      };
      if (!tasks.length) { back(); return; }
      draw();
    });
  };

  // ---- vocabulary booster
  const fold = (text) => text.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");

  VIEWS.vocab = (params, entry) => {
    const vocab = state.me.vocab;
    title(t("vocab"));
    if (!state.me.student) {
      view.innerHTML = `<p class="lead">${esc(t("vocab_intro"))}</p>${lockPanel()}`;
      handlers = { ...lockHandlers };
      return;
    }
    const last = vocab.topics.find((topic) => topic.id === place.topic && topic.pos < topic.total);
    view.innerHTML = `
      <p class="lead">${esc(t("vocab_intro"))}</p>
      ${last ? `<div class="list">${row("topic", { id: last.id }, last.name, t("vocab_continue"), `<span class="count">${last.pos}/${last.total}</span>`, { text: "▶", cls: "gold" })}</div>` : ""}
      <form class="search" data-form><input type="search" placeholder="${esc(t("vocab_search"))}" value="${esc(entry.query || "")}" autocapitalize="off" autocorrect="off" enterkeyhint="search"></form>
      <div class="list" id="topics"></div>`;
    const input = view.querySelector("input");
    const list = $("topics");
    const draw = (ids) => {
      const query = fold(input.value.trim());
      const topics = ids ? ids.map((id) => vocab.topics.find((topic) => topic.id === id)).filter(Boolean)
        : vocab.topics.filter((topic) => !query || fold(topic.name).includes(query));
      list.innerHTML = topics.length
        ? topics.map((topic) => row("topic", { id: topic.id }, topic.name, "", topic.pos ? `<span class="count">${topic.pos}/${topic.total}</span>` : "")).join("")
        : `<div class="empty"><p>${esc(t("vocab_none"))}</p></div>`;
    };
    const search = async () => {
      const text = input.value.trim();
      if (!text) return draw();
      try {
        const result = await api("vocab_search", { text });
        if (current() === entry && input.value.trim() === text && result.ids.length) draw(result.ids);
      } catch (error) { /* the name filter still works */ }
    };
    let timer = 0;
    input.addEventListener("input", () => {
      entry.query = input.value;
      draw();
      clearTimeout(timer);
      // Nothing by name: ask the bot's own topic search (keywords, compounds, typos).
      if (!list.querySelector(".row")) timer = setTimeout(search, 450);
    });
    view.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); input.blur(); search(); });
    handlers = { topic: (data) => go("words", { id: data.id }) };
    draw();
    if (entry.query && !list.querySelector(".row")) search();
  };

  const KIND = { n: "Nomen", v: "Verb", a: "Adjektiv", r: "Redewendung" };

  VIEWS.words = ({ id }, entry) => {
    const topic = state.me.vocab.topics.find((item) => item.id === id);
    title(topic ? topic.name : t("vocab"));
    loading(entry, () => api("vocab_set", { id }), (result) => {
      if (result.locked) { // not a DEUS student (any more)
        view.innerHTML = lockPanel();
        handlers = { ...lockHandlers };
        return;
      }
      if (topic) { topic.pos = result.pos; topic.total = result.total; }
      place.topic = id; // the topic list offers it first next time
      writePlace();
      const finished = result.pos >= result.total;
      view.innerHTML = `
        <div class="session-top">${bar(result.pos, result.total)}<em>${result.pos}/${result.total}</em></div>
        <div class="words">
          ${result.entries.map((word) => `<div class="word k-${esc(word.kind)}">
            <span class="tag">${esc(KIND[word.kind] || "")}</span>
            <b>${esc(word.head)}</b>
            <p>${esc(word.example)}</p>
          </div>`).join("")}
        </div>
        ${finished ? `<p class="note center-text">${esc(t("vocab_done", { n: result.total }))}</p>` : ""}
        <div class="sticky"><button class="btn" data-act="more">${esc(t(finished ? "vocab_again" : "vocab_more", { n: state.me.vocab.set }))}</button></div>`;
      handlers = { more: () => { haptic("tap"); show(); } };
    });
  };

  // ---- Wortkiste: the course vocabulary, lesson by lesson (students only; the bot decides)
  const WK_STEPS = ["cards", "rev", "kol", "prep", "gaps", "links", "articles", "typing", "blitz", "test"];
  const WK_LEARN = ["cards", "rev"];   // for learning, not a check (wortkiste.LEARNING_STEPS): no score
  const WK_ICON = { cards: "🃏", rev: "🔄", articles: "🎯", links: "🔗", kol: "🤝", prep: "🧩", gaps: "✏️", typing: "✍️", blitz: "⚡", test: "🏁" };
  const WK_ROUND = 12;      // questions in the links and typing rounds
  const WK_BLITZ_SECONDS = 60;
  const WK_BLITZ_MIN = 10;  // answering fewer than this in a Blitz can't count as passed
  const wkCache = {};
  const wkLevel = (id) => state.me.wortkiste.levels.find((level) => level.id === id);
  const wkLessonInfo = (id, n) => wkLevel(id).lessons.find((lesson) => lesson.n === n);

  async function wkWords(level, lesson) {
    const key = `${level}:${lesson}:${state.lang}`;
    if (!wkCache[key]) wkCache[key] = (await api("wk_lesson", { level, lesson })).words;
    return wkCache[key];
  }

  // The "something is wrong with this word" flag sits in the header next to the streak, so the
  // progress row never changes width when a card is turned. wkFlag(word) shows it for that word,
  // wkFlag(null) hides it; every new screen hides it (render).
  let flagWord = null;
  function wkFlag(word) {
    flagWord = word;
    const node = $("flag");
    node.hidden = !word;
    node.disabled = false;
    node.title = node.ariaLabel = t("wk_flag");
    return "";
  }
  $("flag").addEventListener("click", () => {
    if (flagWord && handlers.flag) handlers.flag({ entry: flagWord.entry }, $("flag"));
  });
  const wkFlagHandler = (level, lesson) => async (data, node) => {
    node.disabled = true;
    try {
      const result = await api("wk_flag", { level, lesson, entry: data.entry });
      toast(t(result.sent ? "wk_flag_sent" : "wk_flag_limit"));
    } catch (error) {
      node.disabled = false;
      toast(t("err_net"));
    }
  };

  VIEWS.wk = () => {
    title("Wortkiste");
    if (!state.me.student) {
      view.innerHTML = `<p class="lead">${esc(t("wk_intro"))}</p>${lockPanel()}`;
      handlers = { ...lockHandlers };
      return;
    }
    view.innerHTML = `
      <p class="lead">${esc(t("wk_intro"))}</p>
      <div class="list">
        ${state.me.wortkiste.levels.map((level) => {
          const done = level.lessons.filter((lesson) => lesson.passed).length;
          return level.ready
            ? row("level", { id: level.id }, level.label, t("wk_lessons", { n: level.lessons.length }), `<span class="count">${done}/${level.lessons.length}</span>`, { text: level.label.slice(0, 2), cls: done === level.lessons.length ? "ok" : "gold" })
            : row("soon", {}, level.label, t("wk_soon"), "", { text: level.label.slice(0, 2) });
        }).join("")}
      </div>`;
    handlers = { level: (data) => go("wkLevel", { level: data.id }), soon: () => toast(t("wk_soon")) };
  };

  VIEWS.wkLevel = ({ level }) => {
    const info = wkLevel(level);
    title(`Wortkiste · ${info.label}`);
    view.innerHTML = `
      <p class="lead">${esc(t("wk_rule", { n: state.me.wortkiste.pass }))}</p>
      <div class="list">
        ${info.lessons.map((lesson) => row(lesson.open ? "lesson" : "locked", { n: lesson.n }, `${info.label} · ${lesson.label}`, t("wk_words", { n: lesson.words }),
          lesson.open ? "" : `<span class="pill">🔒</span>`, lesson.passed ? { text: "✓", cls: "ok" } : { text: String(lesson.n), cls: lesson.open ? "gold" : "" })).join("")}
      </div>
      ${info.lessons.some((lesson) => !lesson.open) ? `<button class="btn ghost" data-act="place">${esc(t("wk_further"))}</button>` : ""}`;
    handlers = {
      lesson: (data) => go("wkLesson", { level, lesson: Number(data.n) }),
      locked: () => toast(t("wk_locked")),
      place: () => go("wkPlace", { level }),
    };
  };

  VIEWS.wkPlace = ({ level }, entry) => {
    const info = wkLevel(level);
    title(info.label);
    view.innerHTML = `
      <p class="lead">${esc(t("wk_place_q"))}</p>
      <div class="chips wide">${info.lessons.map((lesson) => `<button class="chip ${lesson.open ? "on" : ""}" data-act="pick" data-n="${lesson.n}">${esc(lesson.label)}</button>`).join("")}</div>
      <p class="fine">${esc(t("wk_place_note"))}</p>`;
    handlers = {
      pick: async (data) => {
        try {
          const result = await api("wk_place", { level, lesson: Number(data.n) });
          state.me.wortkiste.levels = result.levels;
          if (current() === entry) back();
        } catch (error) {
          toast(t("err_net"));
        }
      },
    };
  };

  VIEWS.wkLesson = ({ level, lesson }) => {
    const info = wkLevel(level), mine = wkLessonInfo(level, lesson), pass = state.me.wortkiste.pass;
    title(`${info.label} · ${mine.label}`);
    view.innerHTML = `
      <p class="lead">${esc(t(mine.passed ? "wk_lesson_passed" : "wk_rule", { n: pass }))}</p>
      <div class="list">
        ${WK_STEPS.filter((step) => mine.steps.includes(step)).map((step) => {
          const best = mine.best[step];
          const learn = WK_LEARN.includes(step);
          const pill = best == null ? "" : `<span class="pill ${!learn && best >= pass ? "ok" : ""}">${learn ? "✓" : `${best}%`}</span>`;
          return row("step", { step }, t(`wk_s_${step}`), t(info.german && step === "typing" ? "wk_d_typing_de" : `wk_d_${step}`), pill, { text: WK_ICON[step] });
        }).join("")}
      </div>`;
    handlers = { step: (data) => go("wkStep", { level, lesson, step: data.step }) };
  };

  // ---- Wortkiste: what the questions are made of
  const wkPick = (list, n) => shuffle(list).slice(0, n);
  const wkOptions = (answer, pool, n) => shuffle([answer, ...wkPick([...new Set(pool)].filter((value) => value !== answer), n - 1)]).map((value) => ({ value }));

  function wkArticleItems(words) {
    return words.filter((word) => word.noun).map((word) => ({
      prompt: word.noun, sub: word.tr, answer: word.article, after: word.head, word,
      options: [{ value: "der", cls: "der" }, { value: "die", cls: "die" }, { value: "das", cls: "das" }], cols: true,
    }));
  }

  function wkLinkItems(words) {
    const heads = words.map((word) => word.head);
    const families = words.flatMap((word) => word.fam);
    const strong = [], family = [];
    for (const word of words) {
      const related = [word.head, ...word.syn, ...word.ant];
      for (const [key, question] of [["ant", "wk_q_ant"], ["syn", "wk_q_syn"]]) {
        if (!word[key].length) continue;
        strong.push({ prompt: word.head, sub: t(question), answer: word[key][0], after: word.tr, word, options: wkOptions(word[key][0], heads.filter((head) => !related.includes(head)), 4) });
      }
      if (word.fam.length) {
        const pool = families.filter((other) => !word.fam.includes(other) && other !== word.head);
        family.push({ prompt: word.head, sub: t("wk_q_fam"), answer: word.fam[0], after: word.tr, word, options: wkOptions(word.fam[0], pool, 4) });
      }
    }
    return [...wkPick(strong, WK_ROUND), ...wkPick(family, WK_ROUND)].slice(0, WK_ROUND);
  }

  // From B2 on (German-only cards): word partners, fixed prepositions, gap sentences.
  const WK_PREPOSITIONS = ["an", "auf", "aus", "bei", "für", "gegen", "in", "mit", "nach", "über", "um", "von", "vor", "zu"];
  function wkKolItems(words) {
    return words.filter((word) => word.kol).map((word) => ({
      prompt: word.kol.text, sub: t("wk_d_kol"), answer: word.kol.answer, after: word.kol.full, word, options: shuffle([word.kol.answer, ...word.kol.wrong]).map((value) => ({ value })),
    }));
  }
  function wkPrepItems(words) {
    return words.filter((word) => word.prep).map((word) => ({
      prompt: word.prep.text, sub: t("wk_d_prep"), answer: word.prep.answer, after: word.ex, word, options: wkOptions(word.prep.answer, WK_PREPOSITIONS, 4),
    }));
  }
  function wkGapItems(words) {
    return words.filter((word) => word.gap).map((word) => {
      const same = words.filter((other) => other.gap && other.kind === word.kind).map((other) => other.gap.answer);
      const pool = same.length >= 4 ? same : words.filter((other) => other.gap).map((other) => other.gap.answer);
      return { prompt: word.gap.text, sub: t("wk_d_gaps"), answer: word.gap.answer, after: word.tr, word, options: wkOptions(word.gap.answer, pool, 4) };
    });
  }

  function wkTypeItems(words) {
    return words.filter((word) => word.type).map((word) => ({
      typed: true, prompt: word.tr, sub: t(word.noun ? "wk_type_noun" : "wk_type"), answer: word.type, after: word.ex, word,
    }));
  }

  function wkMeaningItems(words) {
    const meanings = words.map((word) => word.tr);
    return words.map((word) => ({ prompt: word.head, sub: t("wk_q_meaning"), answer: word.tr, after: word.ex, word, options: wkOptions(word.tr, meanings, 4) }));
  }

  function wkWordItems(words) {
    const heads = words.map((word) => word.head);
    return words.map((word) => ({ prompt: word.tr, sub: t("wk_q_word"), answer: word.head, after: word.ex, word, options: wkOptions(word.head, heads, 4) }));
  }

  // Typed answers: case and ä/ae don't matter; one slip in a longer word is forgiven and shown.
  const wkNorm = (text) => text.trim().toLowerCase().replace(/\s+/g, " ").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  function wkDistance(a, b) {
    const rows = [Array.from({ length: b.length + 1 }, (_, i) => i)];
    for (let i = 1; i <= a.length; i++) {
      rows.push([i]);
      for (let j = 1; j <= b.length; j++) {
        let cost = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cost = Math.min(cost, rows[i - 2][j - 2] + 1);
        rows[i].push(cost);
      }
    }
    return rows[a.length][b.length];
  }
  function wkCheckTyped(item, given) {
    const typed = wkNorm(given), right = wkNorm(item.answer);
    if (typed === right) return { ok: true };
    if (item.word.noun) {
      const [article, ...rest] = typed.split(" ");
      if (article !== item.word.article) return { ok: false };
      const noun = wkNorm(item.word.noun);
      return { ok: noun.length >= 6 && wkDistance(rest.join(" "), noun) === 1, typo: true };
    }
    return { ok: right.length >= 6 && wkDistance(typed, right) === 1, typo: true };
  }

  VIEWS.wkStep = ({ level, lesson, step }, entry) => {
    const info = wkLevel(level);
    title(`${t(`wk_s_${step}`)} · L${lesson}`);
    loading(entry, () => wkWords(level, lesson), (words) => {
      const flag = wkFlagHandler(level, lesson);

      const finish = async (right, total, mistakes) => {
        const pass = state.me.wortkiste.pass;
        const percent = Math.round((100 * right) / total);
        const learn = WK_LEARN.includes(step);
        const passed = !learn && percent >= pass;
        const numbers = info.lessons.map((item) => item.n);
        const next = numbers[numbers.indexOf(lesson) + 1];
        haptic(passed || learn ? "success" : "error");
        doneScreen({
          emoji: learn ? "🎉" : passed ? "🏆" : "💪",
          headline: learn ? t("wk_cards_done") : `${percent}%`,
          lines: learn ? [t(step === "rev" ? "wk_rev_next" : "wk_cards_next")] : [t("wk_right_of", { right, total }), t(passed ? "wk_passed" : "wk_not_yet", { n: pass })],
          review: mistakes ? mistakeReview(mistakes) : "",
          buttons: [
            ...(passed && next ? [{ act: "next", label: t("wk_next_lesson") }] : []),
            { act: "again", label: t("again") },
            { act: "back", label: t("wk_to_lesson") },
          ],
        });
        handlers = { again: show, back, next: () => { stack.pop(); swap("wkLesson", { level, lesson: next }); } };
        const before = levelShares();
        const result = await saveResult("wk_result", { level, lesson, step, right, total });
        if (!result) return;
        state.me.wortkiste.levels = result.levels;
        state.me.progress = result.progress;
        drawStreak();
        showReward(result.reward, before, `wk:${level}`);
      };

      // 1. Cards: meet the word, turn it over, say how well you knew it. A missed card comes back.
      // `reverse` (every level with a translation, wortkiste "rev"): the translation first, the German
      // word on the back - for recalling the word yourself, as in speaking and writing.
      // "↩" brings back the card before, turned over, to look at it again or rate it again.
      const cards = (reverse) => {
        const queue = words.slice();
        const total = queue.length;
        const history = [];   // the deck before each rating, newest last
        let learned = 0, revealed = false;
        const links = (word) => [["fam", "wk_fam"], ["syn", "wk_syn"], ["ant", "wk_ant"]].filter(([key]) => word[key].length)
          .map(([key, label]) => `<div class="link"><span class="tag ${key}">${esc(t(label))}</span>${esc(word[key].join(", "))}</div>`).join("");
        const draw = () => {
          if (!queue.length) return finish(total, total);
          const word = queue[0];
          view.className = "session";
          view.innerHTML = `
            <div class="session-top"><button class="undo" type="button" data-act="undo" ${history.length ? "" : "disabled"}>↩ ${esc(t("card_back"))}</button>${bar(learned, total)}${wkFlag(revealed ? word : null)}</div>
            <div class="card wk ${revealed ? "open" : ""}" data-act="reveal">
              <span class="card-word ${reverse ? "rev" : ""}">${esc(reverse ? word.tr : word.head)}</span>
              ${revealed ? `
                ${reverse ? `<span class="card-de">${esc(word.entry)}</span>`
                  : `${word.entry !== word.head ? `<span class="card-grammar">${esc(word.entry)}</span>` : ""}
                <span class="card-tr">${esc(word.tr)}</span>`}
                <span class="card-ex">${esc(word.ex)}</span>
                ${word.kol ? `<div class="link"><span class="tag kol">${esc(t("wk_kol"))}</span>${esc(word.kol.full)}</div>` : ""}
                ${word.prep ? `<div class="link"><span class="tag kol">${esc(t("wk_s_prep"))}</span>${esc(word.prep.text.replace("___", word.prep.answer))}</div>` : ""}
                ${links(word)}
                ${word.phr ? `<div class="link phr"><b>${esc(word.phr.de)}</b><small>${esc(word.phr.tr)}</small></div>` : ""}`
                : `<span class="card-hint">${esc(t(reverse ? "wk_rev_hint" : "wk_card_hint"))}</span>`}
            </div>
            <div class="session-bottom">
              ${revealed ? `<div class="rate">
                  <button class="btn bad" data-act="rate" data-r="bad">${esc(t("rate_bad"))}</button>
                  <button class="btn unsure" data-act="rate" data-r="unsure">${esc(t("rate_unsure"))}</button>
                  <button class="btn good" data-act="rate" data-r="good">${esc(t("rate_good"))}</button>
                </div>` : `<button class="btn" data-act="reveal">${esc(t("show"))}</button>`}
            </div>`;
        };
        handlers = {
          flag,
          reveal: () => { if (!revealed) { revealed = true; haptic("tap"); draw(); } },
          undo: () => {
            const before = history.pop();
            if (!before) return;
            queue.splice(0, queue.length, ...before.queue);
            learned = before.learned;
            revealed = true;
            haptic("tap");
            draw();
          },
          rate: (data) => {
            history.push({ queue: queue.slice(), learned });
            if (history.length > 100) history.shift();
            const word = queue.shift();
            if (data.r === "good") learned += 1;
            else queue.splice(Math.min(data.r === "bad" ? ROUND_GAP_BAD : ROUND_GAP_UNSURE, queue.length), 0, word);
            revealed = false;
            haptic("tap");
            draw();
          },
        };
        draw();
      };

      // 2-4 and the test: one question at a time. With `repeat`, a missed one comes back later;
      // the score is what was right at the first try.
      const questions = (items, repeat) => {
        const queue = items.slice();
        const total = queue.length;
        let done = 0, right = 0, answered = null;
        const seen = new Set();
        const mistakes = [];   // first-try misses, for the review after the test

        const draw = () => {
          if (!queue.length) return finish(right, total, step === "test" ? mistakes : null);
          const item = queue[0];
          const state2 = answered ? (answered.ok ? "right" : "wrong") : "";
          view.className = "session";
          view.innerHTML = `
            <div class="session-top">${bar(done, total)}${wkFlag(answered ? item.word : null)}</div>
            <div class="card static wk ${state2}">
              <span class="card-hint">${esc(item.sub)}</span>
              <span class="card-word ${item.prompt.length > 30 ? "long" : ""}">${esc(item.prompt)}</span>
              ${answered ? `<span class="card-tr">${esc(item.answer)}</span>
                ${answered.typo && answered.ok ? `<span class="card-ex">✏️ ${esc(t("wk_typo"))}</span>` : ""}
                ${answered.given != null && !answered.ok ? `<s>${esc(answered.given || "—")}</s>` : ""}
                <span class="card-ex">${esc(item.after)}</span>` : ""}
            </div>
            <div class="session-bottom">
              ${item.typed
                ? (answered ? "" : `<form class="typing" data-form autocomplete="off">
                    <input name="answer" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Deutsch">
                    <button class="btn" type="submit">${esc(t("check"))}</button>
                  </form>`)
                : `<div class="choices ${item.cols ? "" : "col"}">
                    ${item.options.map((option) => `<button class="btn choice ${option.cls || ""} ${answered && option.value === item.answer ? "is-right" : ""} ${answered && option.value === answered.given && !answered.ok ? "is-wrong" : ""}"
                      data-act="pick" data-v="${esc(option.value)}" ${answered ? "disabled" : ""}>${esc(option.value)}</button>`).join("")}
                  </div>`}
              ${answered ? `<button class="btn" data-act="next">${esc(t("next"))}</button>` : ""}
            </div>`;
          const form = view.querySelector("form");
          if (form) {
            form.answer.focus({ preventScroll: true });
            form.addEventListener("submit", (event) => { event.preventDefault(); settle({ ...wkCheckTyped(item, form.answer.value), given: form.answer.value.trim() }); });
          } else if (answered) {
            view.querySelector("[data-act=next]").focus({ preventScroll: true });
          }
        };

        const settle = (result) => {
          if (answered) return;
          answered = result;
          const item = queue[0];
          if (!seen.has(item) && result.ok) right += 1;
          if (!seen.has(item) && !result.ok) mistakes.push({ sub: item.sub, prompt: item.prompt, given: result.given, answer: item.answer });
          seen.add(item);
          haptic(result.ok ? "success" : "error");
          draw(); // right or wrong, the answer and its example stay up until "Next"
        };

        const advance = () => {
          const item = queue.shift();
          if (answered.ok || !repeat) done += 1;
          else queue.splice(Math.min(ROUND_GAP_BAD, queue.length), 0, item);
          answered = null;
          draw();
        };

        handlers = { flag, next: advance, pick: (data) => settle({ ok: data.v === queue[0].answer, given: data.v }) };
        draw();
      };

      // 5. Blitz: as many words as possible in a minute.
      const blitz = () => {
        let pool = shuffle(wkWordItems(words)), index = 0, right = 0, count = 0, left = WK_BLITZ_SECONDS, locked = false;
        const draw = (picked) => {
          const item = pool[index];
          view.className = "session";
          view.innerHTML = `
            <div class="session-top"><span class="meter"><i style="width:${Math.round((100 * left) / WK_BLITZ_SECONDS)}%"></i></span><em id="clock">${left}s · ✓ ${right}</em></div>
            <div class="card static wk"><span class="card-hint">${esc(item.sub)}</span><span class="card-word ${item.prompt.length > 30 ? "long" : ""}">${esc(item.prompt)}</span></div>
            <div class="session-bottom"><div class="choices col">
              ${item.options.map((option) => `<button class="btn choice ${picked && option.value === item.answer ? "is-right" : ""} ${picked === option.value && picked !== item.answer ? "is-wrong" : ""}" data-act="pick" data-v="${esc(option.value)}">${esc(option.value)}</button>`).join("")}
            </div></div>`;
        };
        const timer = setInterval(() => {
          if (current() !== entry) return clearInterval(timer);
          left -= 1;
          if (left <= 0) {
            clearInterval(timer);
            return finish(right, Math.max(count, WK_BLITZ_MIN));
          }
          const clock = $("clock");
          if (clock) clock.textContent = `${left}s · ✓ ${right}`;
          const meter = view.querySelector(".meter i");
          if (meter) meter.style.width = `${Math.round((100 * left) / WK_BLITZ_SECONDS)}%`;
        }, 1000);
        handlers = {
          pick: (data) => {
            if (locked || left <= 0) return;
            locked = true;
            count += 1;
            const ok = data.v === pool[index].answer;
            if (ok) right += 1;
            haptic(ok ? "tap" : "error");
            draw(data.v);
            setTimeout(() => {
              if (current() !== entry || left <= 0) return;
              index += 1;
              if (index >= pool.length) { pool = shuffle(wkWordItems(words)); index = 0; }
              locked = false;
              draw();
            }, ok ? 180 : 650);
          },
        };
        draw();
      };

      if (step === "cards") cards(false);
      else if (step === "rev") cards(true);
      else if (step === "articles") questions(shuffle(wkArticleItems(words)), true);
      else if (step === "links") questions(wkLinkItems(words), true);
      else if (step === "typing") questions(wkPick(wkTypeItems(words), WK_ROUND), true);
      else if (step === "kol") questions(wkPick(wkKolItems(words), WK_ROUND), true);
      else if (step === "prep") questions(wkPick(wkPrepItems(words), WK_ROUND), true);
      else if (step === "gaps") questions(wkPick(wkGapItems(words), WK_ROUND), true);
      else if (step === "blitz") blitz();
      else if (info.german) questions(shuffle([...wkPick(wkKolItems(words), 3), ...wkPick(wkPrepItems(words), 3), ...wkPick(wkGapItems(words), 4), ...wkPick(wkLinkItems(words), 2), ...wkPick(wkArticleItems(words), 2), ...wkPick(wkTypeItems(words), 3), ...wkPick(wkMeaningItems(words), 6)].slice(0, 15)), false);
      else questions(shuffle([...wkPick(wkMeaningItems(words), 4), ...wkPick(wkArticleItems(words), 4), ...wkPick(wkLinkItems(words), 3), ...wkPick(wkTypeItems(words), 4)]), false);
    });
  };

  // ---- progress
  VIEWS.progress = () => {
    const me = state.me, p = me.progress;
    title(t("tab_progress"));
    const words = me.vocab.topics.reduce((sum, topic) => sum + topic.pos, 0);
    const stat = (value, label, cls) => `<div class="stat ${cls || ""}"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
    const level = p.level_check || p.level;
    view.innerHTML = `
      <section class="stats">
        ${stat(p.streak, t("st_streak"), "gold")}
        ${stat(p.game ? p.game.xp_week : 0, t("st_xp_week"), "gold")}
        ${p.game && p.game.ahead != null ? stat(`${p.game.ahead}%`, t("st_ahead")) : ""}
        ${stat(p.game ? p.game.xp_total : 0, t("st_xp_total"))}
        ${stat(p.decks, t("st_decks"))}
        ${stat(`${me.verbs.learned.length}/${me.verbs.parts.length}`, t("st_levels"))}
        ${stat(Object.keys(me.grammar.done).length, t("st_grammar"))}
        ${me.student ? stat(words, t("st_words")) : ""}
        ${me.student ? stat(me.wortkiste.levels.flatMap((item) => item.lessons).filter((lesson) => lesson.passed).length, t("st_wk")) : ""}
        ${stat(level ? levelLabel(level) : "—", t(p.level_check ? "st_level_check" : "st_level"))}
      </section>
      <h3 class="section">${esc(t("tests"))}</h3>
      <div class="panel">
        <p>${esc(p.tests ? t("tests_recent", { n: p.tests, best: p.tests_best }) : t("tests_none"))}</p>
        ${me.verbs.mistakes.length ? `<p>${esc(t("tests_mistakes", { n: me.verbs.mistakes.length }))}</p>` : ""}
        ${p.certificate ? `<p>${esc(t("cert_yes"))}</p>` : ""}
        ${me.verbs.mistakes.length ? `<button class="btn" data-act="mistakes">${esc(t("mistakes"))}</button>` : ""}
        <button class="btn ghost" data-act="chat">${esc(t("open_chat"))}</button>
      </div>`;
    handlers = { mistakes: () => go("deck", { kind: "mistakes" }), chat: () => openChat() };
  };

  // ---- Redemittel (src/redemittel.py): exam phrases for Sprechen and Schreiben, DEUS students only.
  // Level -> exam -> Sprechen or Schreiben -> the parts of that exam with their phrases.
  // A tap on a phrase copies it.
  let rmCache = null;
  const rmLoad = async () => rmCache || (rmCache = await api("redemittel"));
  const rmLevel = (data, id) => data.levels.find((level) => level.id === id);
  const rmExam = (data, level, exam) => { const found = rmLevel(data, level); return found && found.exams.find((item) => item.id === exam); };

  // Students open it as "PrüfungsPhrasen", everyone else as "Redemittel" - the same phrases.
  // For guests the PrüfungsPhrasen tile is only a teaser (rmTease) and says nothing about them.
  VIEWS.rmTease = () => {
    title(t("rm"));
    view.innerHTML = `<p class="lead">🤫 ${esc(t("rm_tease"))}</p>${lockPanel()}`;
    handlers = { ...lockHandlers };
  };

  VIEWS.rm = (params, entry) => {
    title(state.me.student ? t("rm") : "Redemittel");
    loading(entry, rmLoad, (data) => {
      view.innerHTML = `<p class="lead">${esc(t("rm_intro"))}</p>
        <div class="list">${data.levels.map((level) => row("level", { id: level.id }, level.id.toUpperCase(), level.exams.map((exam) => exam.name.split(":")[0]).join(" · "), "", { text: level.id.toUpperCase(), cls: "gold" })).join("")}</div>`;
      handlers = { level: (d) => go("rmLevel", { level: d.id }) };
    });
  };

  VIEWS.rmLevel = ({ level }, entry) => {
    title(`${t("rm")} · ${String(level).toUpperCase()}`);
    loading(entry, rmLoad, (data) => {
      const found = rmLevel(data, level);
      if (!found) { back(); return; }
      view.innerHTML = `<p class="lead">${esc(t("rm_exam_q"))}</p>
        <div class="list">${found.exams.map((exam) => row("exam", { id: exam.id }, exam.name, "", "", { text: exam.id === "goethe" ? "GZ" : exam.id === "telc" ? "telc" : "TD" })).join("")}</div>`;
      handlers = { exam: (d) => go("rmExam", { level, exam: d.id }) };
    });
  };

  VIEWS.rmExam = ({ level, exam }, entry) => {
    title(`${t("rm")} · ${String(level).toUpperCase()}`);
    loading(entry, rmLoad, (data) => {
      const found = rmExam(data, level, exam);
      if (!found) { back(); return; }
      view.innerHTML = `<p class="lead"><b>${esc(found.name)}</b></p>
        <div class="list">
          ${row("skill", { skill: "sprechen" }, "Sprechen", found.sprechen.map((part) => part.title.split(" · ")[0]).join(" · "), "", { text: "🗣" })}
          ${row("skill", { skill: "schreiben" }, "Schreiben", found.schreiben.map((part) => part.title.split(" · ")[0]).join(" · "), "", { text: "✍️" })}
        </div>`;
      handlers = { skill: (d) => go("rmList", { level, exam, skill: d.skill }) };
    });
  };

  VIEWS.rmList = ({ level, exam, skill }, entry) => {
    title(skill === "sprechen" ? "Sprechen" : "Schreiben");
    loading(entry, rmLoad, (data) => {
      const found = rmExam(data, level, exam);
      const parts = found && found[skill];
      if (!parts) { back(); return; }
      view.innerHTML = `<p class="fine">${esc(found.name)} · ${esc(t("rm_copy_hint"))}</p>
        ${parts.map((part) => `<section class="rm-part">
          <h3>${esc(part.title)}</h3>
          <p class="fine">${esc(part.note)}</p>
          ${part.blocks.map((block) => `<div class="rm-block"><p class="kicker">${esc(block.title)}</p>
            <ul>${block.items.map((item) => `<li><button type="button" data-act="copy" data-text="${esc(item)}">${esc(item)}</button></li>`).join("")}</ul></div>`).join("")}
        </section>`).join("")}`;
      handlers = {
        copy: async (d) => {
          try { await navigator.clipboard.writeText(d.text); toast(t("rm_copied")); haptic("tap"); } catch (e) { /* no clipboard here */ }
        },
      };
    });
  };

  // ---- about me: name, level and goal, asked once on the first start (miniapp._about_set) and
  // changeable in the School tab. The goal drives the path card on the home screen; a student's
  // level opens the Wortkiste levels below it.
  const CEFR = ["a1", "a2", "b1", "b2", "c1"];

  /** How far along the way from the student's level to their goal: grammar topics and (students)
   *  Wortkiste lessons of those levels, done of all. */
  function goalPath(me) {
    const about = me.about || {};
    const to = CEFR.indexOf(about.target);
    if (to < 0) return null;
    const from = Math.min(to, Math.max(0, CEFR.indexOf(about.level)));
    const inRange = (code) => { const i = CEFR.indexOf(String(code || "").slice(0, 2).toLowerCase()); return i >= from && i <= to; };
    let done = 0, total = 0;
    for (const topic of me.grammar.topics) if (inRange(topic.level)) { total += 1; if (me.grammar.done[topic.id]) done += 1; }
    if (me.student) for (const level of me.wortkiste.levels) {
      if (level.ready && inRange(level.id)) for (const lesson of level.lessons) { total += 1; if (lesson.passed) done += 1; }
    }
    return total ? { done, total, target: about.target } : null;
  }

  function pathCard(me) {
    const path = goalPath(me);
    if (!path) return "";
    const percent = Math.floor((100 * path.done) / path.total);
    return `<section class="path">
        <div class="path-top"><b>🎯 ${esc(t("path_title", { target: levelLabel(path.target) }))}</b><em>${percent}%</em></div>
        ${bar(path.done, path.total, true)}
        <small>${esc(t(path.done >= path.total ? "path_done" : percent >= 75 ? "path_s75" : percent >= 50 ? "path_s50" : percent >= 25 ? "path_s25" : "path_s0"))}</small>
      </section>`;
  }

  VIEWS.about = (params, entry) => {
    const me = state.me;
    const answers = entry.answers || (entry.answers = { name: (me.about && me.about.name) || me.name || "", level: me.about && me.about.level, target: me.about && me.about.target, step: 0 });
    title(t("about_title"));
    const prevButton = answers.step ? `<button class="btn ghost" data-act="prev">${esc(t("about_back"))}</button>` : "";
    const chips = (codes, picked, act) => `<div class="chips wide">${codes.map((code) => `<button class="chip ${code === picked ? "on" : ""}" data-act="${act}" data-code="${code}">${esc(levelLabel(code))}</button>`).join("")}</div>`;
    const head = (n, question) => `<p class="kicker">${esc(t("about_step", { n }))}</p><h2>${esc(question)}</h2>`;
    handlers = { prev: () => { answers.step -= 1; show(); } };
    if (answers.step === 0) {
      view.innerHTML = `<section class="about">${head(1, t("about_hi"))}<p>${esc(t("about_name_q"))}</p>
        <form class="about-form" data-form><input maxlength="40" value="${esc(answers.name)}" autocomplete="given-name" enterkeyhint="next">
        <button class="btn" type="submit">${esc(t("about_next"))}</button></form></section>`;
      const input = view.querySelector("input");
      view.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        answers.name = name;
        answers.step = 1;
        show();
      });
      return;
    }
    // Steps 2 and 3: a tap picks (an answer from the chat's sign-up may already be picked), and the
    // big button goes on - so a pre-picked answer never looks like a dead end.
    if (answers.step === 1) {
      view.innerHTML = `<section class="about">${head(2, t("about_level_q", { name: answers.name }))}${chips(["never", ...CEFR], answers.level, "level")}
        <button class="btn" data-act="next" ${answers.level ? "" : "disabled"}>${esc(t("about_next"))}</button>${prevButton}</section>`;
      handlers.level = (data) => {
        answers.level = data.code;
        if (CEFR.indexOf(answers.target) < CEFR.indexOf(data.code)) answers.target = null;
        haptic("tap");
        show();
      };
      handlers.next = () => { if (answers.level) { answers.step = 2; show(); } };
      return;
    }
    view.innerHTML = `<section class="about">${head(3, t("about_goal_q"))}${chips(CEFR.slice(Math.max(0, CEFR.indexOf(answers.level))), answers.target, "target")}
      <p class="fine">${esc(t("about_goal_note"))}</p>
      <button class="btn" data-act="save" ${answers.target ? "" : "disabled"}>${esc(t("about_done"))}</button>${prevButton}</section>`;
    let saving = false;
    handlers.target = (data) => { answers.target = data.code; haptic("tap"); show(); };
    handlers.save = async (data, node) => {
      if (saving || !answers.target) return;
      saving = true;
      node.disabled = true;
      try {
        const result = await api("about_set", { name: answers.name, level: answers.level, target: answers.target });
        Object.assign(state.me, { about: result.about, name: result.name, progress: result.progress, wortkiste: result.wortkiste });
      } catch (error) {
        saving = false;
        node.disabled = false;
        toast(t("err_save"));
        return;
      }
      haptic("success");
      toast(t("about_saved"));
      if (params.first) { stack.length = 0; stack.push({ view: "home", params: {} }); show(); } else back();
    };
  };

  // ---- statistics, for the teacher (src/usage.py report)
  const OWN_LABEL = { rm: "rm", verbs: "verbs", grammar: "grammar", vocab: "vocab", booster: "vocab", articles: "articles", prepositions: "prepositions", stats: "stats" };

  function featureName(key) {
    const [source, name] = key.split(":");
    const label = OWN_LABEL[name] ? t(OWN_LABEL[name]) : name === "wk" ? "Wortkiste" : name === "fa" ? "Farsi" : t(`uf_${name}`);
    return `${source === "chat" ? "💬" : "📱"} ${label}`;
  }

  VIEWS.stats = (params, entry) => {
    const days = params.days || 7;
    title(t("stats"));
    loading(entry, () => api("stats", { days }), (data) => {
      const minutes = (seconds) => Math.round(seconds / 60);
      const amount = (uses, seconds) => `×${uses}${seconds ? ` · ${t("stats_min", { n: minutes(seconds) })}` : ""}`;
      const features = Object.entries(data.features).sort((a, b) => b[1].seconds - a[1].seconds || b[1].uses - a[1].uses);
      const person = (p) => {
        const lines = Object.entries(p.totals).sort((a, b) => b[1][1] - a[1][1] || b[1][0] - a[1][0])
          .map(([key, [uses, seconds]]) => `<li><span>${esc(featureName(key))}</span><em>${esc(amount(uses, seconds))}</em></li>`).join("");
        const facts = [
          p.username ? `@${p.username}` : "",
          p.target ? `${levelLabel(p.level || "never")} → ${levelLabel(p.target)}` : "",
          `🔥 ${p.streak}`, `${p.xp_total} XP`,
          p.last_seen ? t("stats_seen", { d: new Date(p.last_seen * 1000).toLocaleDateString() }) : "",
        ].filter(Boolean).join(" · ");
        return `<details class="person"><summary><b>${esc(p.name || p.id)}${p.student ? " 🎓" : ""}</b><small>${esc(t("stats_person", { d: p.days.length, m: minutes(p.seconds), n: p.uses }))}</small></summary>
          <p class="fine">${esc(facts)}</p><ul class="usage">${lines}</ul></details>`;
      };
      const box = (value, label) => `<div class="stat"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
      view.innerHTML = `
        <div class="chips wide">${[1, 7, 30, 90].map((n) => `<button class="chip ${n === days ? "on" : ""}" data-act="days" data-n="${n}">${esc(n === 1 ? t("stats_today") : t("stats_days", { n }))}</button>`).join("")}</div>
        <section class="stats">${box(data.people.length, t("stats_people"))}${box(minutes(data.people.reduce((sum, p) => sum + p.seconds, 0)), t("stats_minutes"))}</section>
        <h3 class="section">${esc(t("stats_features"))}</h3>
        <ul class="usage panel">${features.map(([key, f]) => `<li><span>${esc(featureName(key))}</span><em>${esc(t("stats_feature", { p: f.people }))} · ${esc(amount(f.uses, f.seconds))}</em></li>`).join("") || `<li>${esc(t("stats_none"))}</li>`}</ul>
        <h3 class="section">${esc(t("stats_people_list"))}</h3>
        <div class="people">${data.people.map(person).join("") || `<p class="fine">${esc(t("stats_none"))}</p>`}</div>
        <p class="fine">${esc(t("stats_note"))}</p>`;
      handlers = { days: (data) => swap("stats", { days: Number(data.n) }) };
    });
  };

  // ---- school
  VIEWS.school = () => {
    title("DEUS");
    // The motto for everyone - big for students, who have no trial-lesson offer under it.
    view.innerHTML = `
      <section class="motto ${state.me.student ? "big" : ""}">
        <p class="kicker">DEUS</p>
        <h2>${esc(t("motto_title"))}</h2>
      </section>
      ${state.me.student ? "" : `<section class="promo">
        <p class="kicker">DEUS digital school</p>
        <h2>${esc(t("promo_title"))}</h2>
        <p>${esc(t("promo_text"))}</p>
        <button class="btn" data-act="trial">${esc(t("trial"))}</button>
      </section>`}
      <div class="list">
        ${row("site", { path: "/kurse/" }, t("courses"), t("courses_sub"))}
        ${row("site", { path: "/speaking-club/" }, t("club"), t("club_sub"))}
        ${row("site", { path: "/results/" }, t("results"), t("results_sub"))}
        ${row("channel", {}, t("channel"), `@${CFG.channel}`)}
        ${row("chat", {}, t("ask"), t("ask_sub"))}
        ${state.me.teacher ? "" : row("about", {}, t("about_title"), [state.me.name, state.me.about && state.me.about.target ? `${levelLabel(state.me.about.level || "never")} → ${levelLabel(state.me.about.target)}` : ""].filter(Boolean).join(" · "))}
        ${state.me.teacher ? row("stats", {}, `📊 ${t("stats")}`, t("stats_sub")) : ""}
      </div>
      ${state.me.student ? `<p class="badge">🎓 ${esc(t("student_badge"))}</p>` : ""}
      <h3 class="section">${esc(t("language"))}</h3>
      <div class="chips wide">${state.me.languages.map((code) => `<button class="chip ${code === state.lang ? "on" : ""}" data-act="lang" data-code="${code}">${esc(t(`lang_${code}`))}</button>`).join("")}</div>
      <p class="fine">${esc(t("language_note"))}</p>`;
    handlers = {
      trial: () => openChat("trial"),
      site: (data) => openSite(data.path),
      channel: () => { const link = `https://t.me/${CFG.channel}`; if (IN_TELEGRAM) tg.openTelegramLink(link); else window.open(link, "_blank"); },
      chat: () => openChat(),
      about: () => go("about"),
      stats: () => go("stats"),
      lang: async (data) => {
        if (data.code === state.lang) return;
        const before = state.lang;
        setLanguage(data.code);
        show();
        try {
          const result = await api("set_language", { language: data.code });
          state.me.grammar.topics = result.grammar_topics;
        } catch (error) {
          setLanguage(before);
          show();
          toast(t("err_save"));
        }
      },
    };
  };

  // ------------------------------------------------------------------ start
  function setLanguage(code) {
    state.lang = LANGS.includes(code) ? code : "en";
    document.documentElement.lang = state.lang;
    for (const node of document.querySelectorAll("[data-t]")) node.textContent = t(node.dataset.t);
  }

  function applyTheme() {
    const dark = IN_TELEGRAM ? tg.colorScheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (IN_TELEGRAM) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch (e) { /* older clients */ }
    }
  }

  async function start() {
    const guess = ((IN_TELEGRAM && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || "en").slice(0, 2);
    setLanguage(guess);
    applyTheme();
    if (IN_TELEGRAM) {
      tg.ready();
      tg.expand();
      tg.onEvent("themeChanged", applyTheme);
      if (tg.BackButton) tg.BackButton.onClick(back);
    }
    title("DEUS Lernen");
    if (!IN_TELEGRAM && !LOCAL) {
      view.className = "center";
      view.innerHTML = `<div class="done"><div class="done-emoji">📱</div><h2>DEUS Lernen</h2><p>${esc(t("gate"))}</p>
        <div class="stack"><a class="btn" href="https://t.me/${esc(CFG.bot)}?startapp">${esc(t("gate_open"))}</a></div></div>`;
      // Opened in a normal browser: go straight to the app inside Telegram.
      setTimeout(() => { location.href = `https://t.me/${CFG.bot}?startapp`; }, 600);
      return;
    }
    view.innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    const saved = readPlace(); // read while the bot answers
    try {
      state.me = await api("start");
    } catch (error) {
      view.innerHTML = `<div class="empty"><p>${esc(error.status === 401 ? t("err_auth") : t("err_net"))}</p><button class="btn" id="again">${esc(t("retry"))}</button></div>`;
      $("again").addEventListener("click", start);
      return;
    }
    setLanguage(state.me.language);
    await loadCourses(state.me);
    place = (await saved) || place;
    // Straight back to the screen the app was closed on; Back leads up to the home screen from there.
    stack.length = 0;
    // The first start: three short questions (name, level, goal) before anything else.
    if (state.me.about && !state.me.about.done && !state.me.teacher) stack.push({ view: "about", params: { first: true } });
    else stack.push({ view: "home", params: {} }, ...keptPath(place.open));
    show();
    // Results that couldn't be sent last time (no connection) go now; the screens catch up after.
    if (outboxRead().length) flushOutbox().then((n) => { if (n) refreshMe(); });
    loadContent().catch(() => {}); // warm up the cards while the student looks at the home screen
  }

  // ---------------------------------------------------------- separate courses
  // A course kept in its own folder (farsi/) is loaded only for those whose start answer has its key,
  // and plugs in with DEUS.course({ id, views, kept, placeOk, tile }). It gets the shared helpers
  // in DEUS.core and nothing else; app.js knows only the file name.
  const COURSE_FILES = { farsi: "farsi/farsi" };
  const COURSE_VERSION = 2;
  const COURSES = [];
  window.DEUS = {
    course(spec) {
      COURSES.push(spec);
      Object.assign(VIEWS, spec.views);
      SECTIONS.push(spec.id);
      KEPT_VIEWS.push(...spec.kept);
    },
    core: {
      state, view, esc, t, shuffle, haptic, toast, api, loading, go, back, swap, title, row, bar,
      show, doneScreen, showReward, drawStreak, choiceKeys, ROUND_GAP_BAD, saveResult,
      on: (map) => { handlers = map; },        // the current screen's buttons (data-act)
      onKeys: (handler) => { keys = handler; }, // the current screen's keyboard, cleared on every render
    },
  };

  function loadCourses(me) {
    return Promise.all(Object.entries(COURSE_FILES).filter(([key]) => me[key]).map(([key, file]) => new Promise((resolve) => {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = `${file}.css?v=${COURSE_VERSION}`;
      document.head.appendChild(style);
      const script = document.createElement("script");
      script.src = `${file}.js?v=${COURSE_VERSION}`;
      script.onload = resolve;
      script.onerror = () => { me[key] = null; resolve(); };   // without its file the course just isn't shown
      document.body.appendChild(script);
    })));
  }

  start();
})();
