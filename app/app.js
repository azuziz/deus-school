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
  const SECTIONS = ["verbs", "grammar", "vocab", "wk", "fa"];
  const KEPT_VIEWS = ["verbs", "part", "grammar", "topic", "vocab", "wk", "wkLevel", "wkLesson", "fa", "faUnit"];
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
      case "wkLevel": return Boolean(lesson());
      case "wkLesson": return Boolean(lesson() && lesson().lessons.some((item) => item.n === p.lesson && item.open));
      case "fa": return Boolean(me.farsi);
      case "faUnit": return Boolean(me.farsi && me.farsi.units.some((unit) => unit.n === p.n));
      default: return false;
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

  function show() { render(false); }

  function render(forward) {
    const entry = current();
    handlers = {};
    view.className = "";
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

  const bar = (done, total) => `<span class="meter"><i style="width:${total ? Math.round((100 * done) / total) : 0}%"></i></span>`;

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

  async function deckDone(kind, part) {
    try {
      const result = await api("deck_done", part ? { kind, part } : { kind });
      state.me.progress = result.progress;
      if (result.learned) state.me.verbs.learned = result.learned;
      drawStreak();
    } catch (error) {
      toast(t("err_save"));
    }
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

  function doneScreen({ emoji, headline, lines, buttons }) {
    view.className = "center";
    view.innerHTML = `<div class="done">
      <div class="done-emoji">${emoji}</div>
      <h2>${esc(headline)}</h2>
      ${lines.map((line) => `<p>${esc(line)}</p>`).join("")}
      <div class="stack">${buttons.map((b, i) => `<button class="btn ${i ? "ghost" : ""}" data-act="${b.act}">${esc(b.label)}</button>`).join("")}</div>
    </div>`;
  }

  // ------------------------------------------------------------------ views
  const VIEWS = {};

  VIEWS.home = () => {
    const me = state.me;
    title("DEUS Lernen");
    const grammarDone = Object.keys(me.grammar.done).length;
    const vocabStarted = me.vocab.topics.filter((topic) => topic.pos > 0).length;
    const wkAll = me.wortkiste.levels.flatMap((level) => level.lessons);
    const wkPassed = wkAll.filter((lesson) => lesson.passed).length, wkLessons = me.student ? wkAll.length : 0;
    const tile = (act, icon, name, sub, done, total, locked) => `<button class="tile ${locked ? "locked" : ""}" type="button" data-act="${act}">
        ${locked ? `<span class="tile-lock" aria-hidden="true">🔒</span>` : ""}
        <span class="tile-icon">${icon}</span>
        <b>${esc(name)}</b>
        <small>${esc(sub)}</small>
        ${total ? `<span class="tile-meter">${bar(done, total)}<em>${done}/${total}</em></span>` : ""}
      </button>`;
    // DEUS students get the course tools (Booster, Wortkiste) and no loose extras; everyone else
    // gets the open exercises, and sees the two student sections with a lock.
    const forStudents = (locked) => `
        ${tile("vocab", "🧠", t("vocab"), t("vocab_sub"), vocabStarted, locked ? 0 : me.vocab.topics.length, locked)}
        ${tile("wk", "📦", "Wortkiste", t("wk_sub"), wkPassed, wkLessons, locked)}`;
    view.innerHTML = `
      <section class="hello">
        <p class="kicker">${esc(t(me.progress.practised_today ? "today_done" : "today_todo"))}</p>
        <h1>${esc(me.name ? t("hello_name", { name: me.name }) : t("hello"))}</h1>
      </section>
      <section class="tiles">
        ${tile("verbs", "🔤", t("verbs"), t("verbs_sub"), me.verbs.learned.length, me.verbs.parts.length)}
        ${tile("grammar", "📘", t("grammar"), t("grammar_sub"), grammarDone, me.grammar.topics.length)}
        ${me.student ? forStudents(false) : `
        ${tile("articles", "🎯", t("articles"), "der · die · das")}
        ${tile("prepositions", "🧭", t("prepositions"), "Akkusativ · Dativ · Genitiv")}
        ${tile("sophie", "💬", t("sophie"), t("sophie_sub"))}
        ${forStudents(true)}`}
        ${me.farsi ? tile("fa", "🇮🇷", "Farsi", "فارسی · unit by unit", me.farsi.units.filter((unit) => unit.passed).length, me.farsi.units.length) : ""}
      </section>`;
    handlers = {
      verbs: () => enter("verbs"),
      grammar: () => enter("grammar"),
      vocab: () => enter("vocab"),
      wk: () => enter("wk"),
      articles: () => go("quiz", { kind: "articles" }),
      prepositions: () => go("quiz", { kind: "prepositions" }),
      sophie: () => openChat(),
      fa: () => enter("fa"),
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
          <div class="session-top">${bar(learned, total)}<em>${learned}/${total}</em></div>
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
          <div class="session-top">${bar(index, verbs.length)}<em>${index + 1}/${verbs.length}</em></div>
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
          <div class="session-top">${bar(index + 1, verbs.length)}<em>${index + 1}/${verbs.length}</em></div>
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
        deckDone("typing");
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
          <div class="session-top">${bar(learned, total)}<em>${learned}/${total}</em></div>
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
          <div class="session-top">${bar(index + (answered ? 1 : 0), tasks.length)}<em>${index + 1}/${tasks.length}</em></div>
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
        try {
          const result = await api("grammar_result", { id, right, total });
          state.me.grammar.done = result.done;
        } catch (error) {
          toast(t("err_save"));
        }
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
  const WK_STEPS = ["cards", "kol", "prep", "gaps", "links", "articles", "typing", "blitz", "test"];
  const WK_ICON = { cards: "🃏", articles: "🎯", links: "🔗", kol: "🤝", prep: "🧩", gaps: "✏️", typing: "✍️", blitz: "⚡", test: "🏁" };
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

  const wkFlag = (word) => `<button class="flag" type="button" data-act="flag" data-entry="${esc(word.entry)}" title="${esc(t("wk_flag"))}" aria-label="${esc(t("wk_flag"))}">⚑</button>`;
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
          const pill = best == null ? "" : `<span class="pill ${step !== "cards" && best >= pass ? "ok" : ""}">${step === "cards" ? "✓" : `${best}%`}</span>`;
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

      const finish = async (right, total) => {
        const pass = state.me.wortkiste.pass;
        const percent = Math.round((100 * right) / total);
        const passed = step !== "cards" && percent >= pass;
        const numbers = info.lessons.map((item) => item.n);
        const next = numbers[numbers.indexOf(lesson) + 1];
        haptic(passed || step === "cards" ? "success" : "error");
        doneScreen({
          emoji: step === "cards" ? "🎉" : passed ? "🏆" : "💪",
          headline: step === "cards" ? t("wk_cards_done") : `${percent}%`,
          lines: step === "cards" ? [t("wk_cards_next")] : [t("wk_right_of", { right, total }), t(passed ? "wk_passed" : "wk_not_yet", { n: pass })],
          buttons: [
            ...(passed && next ? [{ act: "next", label: t("wk_next_lesson") }] : []),
            { act: "again", label: t("again") },
            { act: "back", label: t("wk_to_lesson") },
          ],
        });
        handlers = { again: show, back, next: () => { stack.pop(); swap("wkLesson", { level, lesson: next }); } };
        try {
          const result = await api("wk_result", { level, lesson, step, right, total });
          state.me.wortkiste.levels = result.levels;
          state.me.progress = result.progress;
          drawStreak();
        } catch (error) {
          toast(t("err_save"));
        }
      };

      // 1. Cards: meet the word, turn it over, say how well you knew it. A missed card comes back.
      const cards = () => {
        const queue = words.slice();
        const total = queue.length;
        let learned = 0, revealed = false;
        const links = (word) => [["fam", "wk_fam"], ["syn", "wk_syn"], ["ant", "wk_ant"]].filter(([key]) => word[key].length)
          .map(([key, label]) => `<div class="link"><span class="tag ${key}">${esc(t(label))}</span>${esc(word[key].join(", "))}</div>`).join("");
        const draw = () => {
          if (!queue.length) return finish(total, total);
          const word = queue[0];
          view.className = "session";
          view.innerHTML = `
            <div class="session-top">${bar(learned, total)}<em>${learned}/${total}</em>${revealed ? wkFlag(word) : ""}</div>
            <div class="card wk ${revealed ? "open" : ""}" data-act="reveal">
              <span class="card-word">${esc(word.head)}</span>
              ${revealed ? `
                ${word.entry !== word.head ? `<span class="card-grammar">${esc(word.entry)}</span>` : ""}
                <span class="card-tr">${esc(word.tr)}</span>
                <span class="card-ex">${esc(word.ex)}</span>
                ${word.kol ? `<div class="link"><span class="tag kol">${esc(t("wk_kol"))}</span>${esc(word.kol.full)}</div>` : ""}
                ${word.prep ? `<div class="link"><span class="tag kol">${esc(t("wk_s_prep"))}</span>${esc(word.prep.text.replace("___", word.prep.answer))}</div>` : ""}
                ${links(word)}
                ${word.phr ? `<div class="link phr"><b>${esc(word.phr.de)}</b><small>${esc(word.phr.tr)}</small></div>` : ""}`
                : `<span class="card-hint">${esc(t("wk_card_hint"))}</span>`}
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
          rate: (data) => {
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

        const draw = () => {
          if (!queue.length) return finish(right, total);
          const item = queue[0];
          const state2 = answered ? (answered.ok ? "right" : "wrong") : "";
          view.className = "session";
          view.innerHTML = `
            <div class="session-top">${bar(done, total)}<em>${Math.min(done + 1, total)}/${total}</em>${answered ? wkFlag(item.word) : ""}</div>
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

      if (step === "cards") cards();
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

  // ---- Farsi: the teacher's own Persian course (only the teacher's chat gets `me.farsi`)
  const FA_STEPS = {
    notes: ["📖", "Grammar", "Read the unit's rules"], letters: ["🔡", "Letters", "The new letters"],
    sounds: ["🔊", "Sounds", "Letter ↔ sound"], cards: ["🃏", "Words", "Vocabulary cards"],
    bridge: ["🇺🇿", "Uzbek bridge", "The Uzbek word → its Persian relative"],
    read: ["👁", "Reading", "How is it read?"], spell: ["🧩", "Spelling", "Put the letters in order"],
    meaning: ["💡", "Meaning", "Persian → English"], reverse: ["🇮🇷", "Recall", "English → Persian"],
    numbers: ["🔢", "Numbers", "Digits ↔ words"], stems: ["🌱", "Present stems", "Infinitive → stem"],
    conj: ["⚙️", "Verb forms", "Pick the right form"], spoken: ["🗣", "Spoken → written", "Colloquial forms"],
    compound: ["🔗", "Compound verbs", "Light verb and preposition"], build: ["🧱", "Sentences", "Put the words in order"],
    book: ["📚", "Book exercises", "Think, turn over, compare"], test: ["🏁", "Unit test", "A mix of everything"],
  };
  const faUnit = (n) => state.me.farsi.units.find((item) => item.n === n);
  const fa = (text, on) => (on ? `<span class="fa" dir="rtl">${esc(text)}</span>` : esc(text));

  VIEWS.fa = () => {
    title("Farsi");
    view.innerHTML = `<div class="list">${state.me.farsi.units.map((unit) => {
      const done = unit.steps.filter((step) => step.best != null).length;
      return row("unit", { n: unit.n }, `${unit.n} · ${unit.en}`, unit.title, `<span class="count">${done}/${unit.steps.length}</span>`,
        unit.passed ? { text: "✓", cls: "ok" } : { text: String(unit.n) });
    }).join("")}</div>`;
    handlers = { unit: (data) => go("faUnit", { n: Number(data.n) }) };
  };

  VIEWS.faUnit = ({ n }) => {
    const unit = faUnit(n);
    title(`${n} · ${unit.en}`);
    view.innerHTML = `<div class="list">${unit.steps.map((step) => {
      const [icon, name, sub] = FA_STEPS[step.id];
      const right = step.best == null ? "" : `<span class="pill ${step.id === "test" && step.best < state.me.farsi.pass ? "red" : "ok"}">${["notes", "letters", "cards"].includes(step.id) ? "✓" : `${step.best}%`}</span>`;
      return row("step", { step: step.id }, name, sub, right, { text: icon });
    }).join("")}</div>`;
    handlers = { step: (data) => go("faStep", { n, step: data.step }) };
  };

  VIEWS.faStep = ({ n, step }, entry) => {
    title(`${FA_STEPS[step][1]} · ${n}`);
    const save = async (right, total) => {
      try { state.me.farsi.units = (await api("fa_result", { unit: n, step, right, total })).units; } catch (error) { toast(t("err_save")); }
    };
    // The next step of this unit that has not been done yet: first those after this one, then earlier ones.
    const nextStep = () => {
      const steps = faUnit(n).steps, at = steps.findIndex((item) => item.id === step);
      const open = [...steps.slice(at + 1), ...steps.slice(0, at)].find((item) => item.best == null);
      return open && open.id;
    };
    loading(entry, () => api("fa_step", { unit: n, step }), (payload) => {
      if (payload.notes) {
        view.innerHTML = payload.notes.map((note) => `<div class="panel fa-note">
            <h3>${esc(note.point)}${note.fa ? ` <span class="fa" dir="rtl">${esc(note.fa)}</span>` : ""}</h3>
            <p>${esc(note.rule)}</p>
            ${note.forms ? `<pre dir="auto">${esc(note.forms)}</pre>` : ""}
            ${note.examples.map(([text, tr, de]) => `<p class="fa-ex"><span class="fa" dir="rtl">${esc(text)}</span><small>/${esc(tr)}/ — ${esc(de)}</small></p>`).join("")}
            ${note.pitfalls.length ? `<ul>${note.pitfalls.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}
          </div>`).join("") + `<div class="sticky"><button class="btn" data-act="done">${esc(t("next"))}</button></div>`;
        handlers = { done: () => { save(1, 1); const next = nextStep(); if (next) swap("faStep", { n, step: next }); else back(); } };
        return;
      }
      const queue = payload.items.slice();
      const total = queue.length;
      const seen = new Set();
      let done = 0, right = 0, answered = null, open = false, placed = [];

      const finish = () => {
        const percent = payload.scored ? Math.round((100 * right) / total) : 100;
        const passed = percent >= state.me.farsi.pass;
        const next = nextStep();
        haptic(passed ? "success" : "error");
        doneScreen({
          emoji: !payload.scored ? "🎉" : passed ? "🏆" : "💪",
          headline: payload.scored ? `${percent}%` : "Done",
          lines: payload.scored ? [`${right} / ${total}`] : [],
          buttons: [...(next ? [{ act: "next", label: `Next: ${FA_STEPS[next][1]}` }] : []), { act: "again", label: t("again") }, { act: "back", label: "Back to the unit" }],
        });
        handlers = { again: show, back, next: () => swap("faStep", { n, step: next }) };
        save(payload.scored ? right : 1, payload.scored ? total : 1);
      };

      const settle = (ok, given) => {
        if (answered) return;
        const item = queue[0];
        answered = { ok, given };
        if (ok && !seen.has(item)) right += 1;
        seen.add(item);
        haptic(ok ? "success" : "error");
        draw();
      };

      const advance = () => {
        const item = queue.shift();
        if (answered.ok || !payload.repeat) done += 1;
        else queue.splice(Math.min(ROUND_GAP_BAD, queue.length), 0, item);
        answered = null; open = false; placed = [];
        draw();
      };

      const draw = () => {
        if (!queue.length) return finish();
        const item = queue[0];
        const mood = answered ? (answered.ok ? "right" : "wrong") : "";
        const top = `<div class="session-top">${bar(done, total)}<em>${Math.min(done + 1, total)}/${total}</em></div>`;
        const next = `<button class="btn" data-act="next">${esc(t("next"))}</button>`;
        view.className = "session";
        if (item.t === "flip") {
          view.innerHTML = `${top}
            <div class="card wk ${open ? "open static" : ""}" data-act="reveal">
              ${item.sub ? `<span class="card-hint">${esc(item.sub)}</span>` : ""}
              <span class="card-word ${item.big ? "fa-big" : item.q.length > 40 ? "long" : ""}">${fa(item.q, item.qfa)}</span>
              ${open ? item.back.filter(([text]) => text).map(([text, on]) => `<span class="${on ? "card-tr" : "card-ex"}" dir="auto">${fa(text, on)}</span>`).join("")
                : `<span class="card-hint">Tap to turn over</span>`}
            </div>
            <div class="session-bottom">${open ? `<div class="rate two">
                <button class="btn bad" data-act="rate" data-r="bad">${esc(t("rate_bad"))}</button>
                <button class="btn good" data-act="rate" data-r="good">${esc(t("rate_good"))}</button>
              </div>` : `<button class="btn" data-act="reveal">${esc(t("show"))}</button>`}</div>`;
        } else if (item.t === "choice") {
          view.innerHTML = `${top}
            <div class="card static wk ${mood}">
              <span class="card-hint">${esc(item.sub)}</span>
              <span class="card-word ${item.q.length > 30 ? "long" : ""}">${fa(item.q, item.qfa)}</span>
              ${answered && item.after ? `<span class="card-ex" dir="auto">${esc(item.after)}</span>` : ""}
            </div>
            <div class="session-bottom">
              <div class="choices ${item.opts.length === 2 || item.opts.some((o) => o.length > 14) ? "col" : "n4"}">
                ${item.opts.map((option) => `<button class="btn choice ${item.ofa ? "fa" : ""} ${answered && option === item.a ? "is-right" : ""} ${answered && option === answered.given && !answered.ok ? "is-wrong" : ""}"
                  ${item.ofa ? 'dir="rtl"' : ""} data-act="pick" data-v="${esc(option)}" ${answered ? "disabled" : ""}>${esc(option)}</button>`).join("")}
              </div>
              ${answered ? next : ""}
            </div>`;
        } else {
          const built = placed.map((i) => item.tiles[i]).join(item.sep);
          view.innerHTML = `${top}
            <div class="card static wk ${mood}">
              <span class="card-hint">${esc(item.sub)}</span>
              ${item.q ? `<span class="card-ex">${esc(item.q)}</span>` : ""}
              <span class="card-word fa-built ${item.sep ? "long" : ""}" dir="rtl">${esc(built) || "…"}</span>
              ${answered && !answered.ok ? `<span class="card-tr fa" dir="rtl">${esc(item.a)}</span>` : ""}
            </div>
            <div class="session-bottom">
              <div class="fa-tiles" dir="rtl">${item.tiles.map((tile, i) => `<button class="btn choice fa" data-act="tile" data-i="${i}" ${placed.includes(i) || answered ? "disabled" : ""}>${esc(tile)}</button>`).join("")}</div>
              ${answered ? next : `<div class="rate two">
                <button class="btn ghost" data-act="undo" ${placed.length ? "" : "disabled"}>⌫</button>
                <button class="btn" data-act="check" ${placed.length === item.tiles.length ? "" : "disabled"}>${esc(t("check"))}</button>
              </div>`}
            </div>`;
        }
      };

      handlers = {
        next: advance,
        reveal: () => { if (!open) { open = true; haptic("tap"); draw(); } },
        rate: (data) => { answered = { ok: data.r === "good" }; if (answered.ok && !seen.has(queue[0])) right += 1; seen.add(queue[0]); haptic("tap"); advance(); },
        pick: (data) => settle(data.v === queue[0].a, data.v),
        tile: (data) => { placed.push(Number(data.i)); haptic("tap"); draw(); },
        undo: () => { placed.pop(); draw(); },
        check: () => settle(placed.map((i) => queue[0].tiles[i]).join(queue[0].sep) === queue[0].a, ""),
      };
      draw();
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

  // ---- school
  VIEWS.school = () => {
    title("DEUS");
    view.innerHTML = `
      <section class="promo">
        <p class="kicker">DEUS digital school</p>
        <h2>${esc(t("promo_title"))}</h2>
        <p>${esc(t("promo_text"))}</p>
        <button class="btn" data-act="trial">${esc(t("trial"))}</button>
      </section>
      <div class="list">
        ${row("site", { path: "/kurse/" }, t("courses"), t("courses_sub"))}
        ${row("site", { path: "/speaking-club/" }, t("club"), t("club_sub"))}
        ${row("site", { path: "/results/" }, t("results"), t("results_sub"))}
        ${row("channel", {}, t("channel"), `@${CFG.channel}`)}
        ${row("chat", {}, t("ask"), t("ask_sub"))}
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
    place = (await saved) || place;
    // Straight back to the screen the app was closed on; Back leads up to the home screen from there.
    stack.length = 0;
    stack.push({ view: "home", params: {} }, ...keptPath(place.open));
    show();
    loadContent().catch(() => {}); // warm up the cards while the student looks at the home screen
  }

  start();
})();
