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

  function show() {
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
  }

  function go(name, params) { stack.push({ view: name, params }); show(); }
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

  // What someone who isn't a DEUS student sees where the free part ends (the bot decides, not the app).
  function lockPanel(text) {
    return `<div class="lock">
      <div class="lock-icon">🔒</div>
      <p><b>${esc(text)}</b></p>
      <p>${esc(t("lock_how"))}</p>
      <button class="btn" data-act="lock-trial">${esc(t("trial"))}</button>
      <button class="btn ghost" data-act="lock-write">${esc(t("lock_write"))}</button>
    </div>`;
  }
  const lockHandlers = { "lock-trial": () => openChat("trial"), "lock-write": () => openChat() };

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
    const tile = (act, icon, name, sub, done, total) => `<button class="tile" type="button" data-act="${act}">
        <span class="tile-icon">${icon}</span>
        <b>${esc(name)}</b>
        <small>${esc(sub)}</small>
        ${total ? `<span class="tile-meter">${bar(done, total)}<em>${done}/${total}</em></span>` : ""}
      </button>`;
    view.innerHTML = `
      <section class="hello">
        <p class="kicker">${esc(t(me.progress.practised_today ? "today_done" : "today_todo"))}</p>
        <h1>${esc(me.name ? t("hello_name", { name: me.name }) : t("hello"))}</h1>
      </section>
      <section class="tiles">
        ${tile("verbs", "🔤", t("verbs"), t("verbs_sub"), me.verbs.learned.length, me.verbs.parts.length)}
        ${tile("grammar", "📘", t("grammar"), t("grammar_sub"), grammarDone, me.grammar.topics.length)}
        ${tile("vocab", "🧠", t("vocab"), t("vocab_sub"), vocabStarted, me.vocab.topics.length)}
        ${tile("wk", "📦", "Wortkiste", t("wk_sub"), wkPassed, wkLessons)}
        ${tile("articles", "🎯", t("articles"), "der · die · das")}
        ${tile("prepositions", "🧭", t("prepositions"), "Akkusativ · Dativ · Genitiv")}
        ${tile("sophie", "💬", t("sophie"), t("sophie_sub"))}
      </section>`;
    handlers = {
      verbs: () => go("verbs"),
      grammar: () => go("grammar"),
      vocab: () => go("vocab"),
      wk: () => go("wk"),
      articles: () => go("quiz", { kind: "articles" }),
      prepositions: () => go("quiz", { kind: "prepositions" }),
      sophie: () => openChat(),
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
      view.innerHTML = `
        <div class="actions two">
          <button class="btn" data-act="cards">${esc(t("mode_cards"))}</button>
          <button class="btn ghost" data-act="typing">${esc(t("mode_typing"))}</button>
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
            <button class="btn ghost" data-act="next" ${answered && picked !== item.answer ? "" : "hidden"}>${esc(t("next"))}</button>
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
          const right = picked === queue[0].answer;
          haptic(right ? "success" : "error");
          draw();
          if (right) setTimeout(() => { if (current() === entry && picked !== null) advance(); }, 650);
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
    if (!entry.level) entry.level = grammar.levels.includes(known) ? known : grammar.levels[0];
    const draw = () => {
      const topics = grammar.topics.filter((topic) => topic.level === entry.level);
      view.innerHTML = `
        <div class="chips">${grammar.levels.map((level) => `<button class="chip ${level === entry.level ? "on" : ""}" data-act="level" data-level="${level}">${level}</button>`).join("")}</div>
        <div class="list">
          ${topics.map((topic) => {
            const done = grammar.done[topic.id];
            return row("topic", { id: topic.id }, topic.title, "", done ? `<span class="pill ${done.best >= 80 ? "ok" : ""}">${done.best}%</span>` : "");
          }).join("")}
        </div>`;
    };
    handlers = {
      level: (data) => { entry.level = data.level; haptic("tap"); draw(); },
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
            ${answered && !correct ? `<p class="note">💡 ${esc(task.hint)}</p>` : ""}
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
    view.innerHTML = `
      <p class="lead">${esc(t("vocab_intro"))}</p>
      ${state.me.student ? "" : `<p class="fine">🔒 ${esc(t("lock_vocab", { n: vocab.free }))}</p>`}
      <form class="search" data-form><input type="search" placeholder="${esc(t("vocab_search"))}" value="${esc(entry.query || "")}" autocapitalize="off" autocorrect="off" enterkeyhint="search"></form>
      <div class="list" id="topics"></div>`;
    const input = view.querySelector("input");
    const list = $("topics");
    const draw = (ids) => {
      const query = fold(input.value.trim());
      const topics = ids ? ids.map((id) => vocab.topics.find((topic) => topic.id === id)).filter(Boolean)
        : vocab.topics.filter((topic) => !query || fold(topic.name).includes(query));
      list.innerHTML = topics.length
        ? topics.map((topic) => row("topic", { id: topic.id }, topic.name, "",
            !state.me.student && topic.pos >= vocab.free ? `<span class="pill">🔒</span>` : topic.pos ? `<span class="count">${topic.pos}/${topic.total}</span>` : "")).join("")
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
      if (topic) { topic.pos = result.pos; topic.total = result.total; }
      const finished = result.pos >= result.total;
      if (result.locked || result.more_locked) {
        view.innerHTML = `
          <div class="words">
            ${result.entries.map((word) => `<div class="word k-${esc(word.kind)}">
              <span class="tag">${esc(KIND[word.kind] || "")}</span>
              <b>${esc(word.head)}</b>
              <p>${esc(word.example)}</p>
            </div>`).join("")}
          </div>
          ${lockPanel(t("lock_vocab", { n: state.me.vocab.free }))}`;
        handlers = { ...lockHandlers };
        return;
      }
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
  const WK_STEPS = ["cards", "articles", "links", "typing", "blitz", "test"];
  const WK_ICON = { cards: "🃏", articles: "🎯", links: "🔗", typing: "✍️", blitz: "⚡", test: "🏁" };
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
      view.innerHTML = `<p class="lead">${esc(t("wk_intro"))}</p>${lockPanel(t("wk_lock"))}`;
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
        ${info.lessons.map((lesson) => row(lesson.open ? "lesson" : "locked", { n: lesson.n }, `${info.label} · Lektion ${lesson.n}`, t("wk_words", { n: lesson.words }),
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
      <div class="chips wide">${info.lessons.map((lesson) => `<button class="chip ${lesson.open ? "on" : ""}" data-act="pick" data-n="${lesson.n}">Lektion ${lesson.n}</button>`).join("")}</div>
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
    title(`${info.label} · Lektion ${lesson}`);
    view.innerHTML = `
      <p class="lead">${esc(t(mine.passed ? "wk_lesson_passed" : "wk_rule", { n: pass }))}</p>
      <div class="list">
        ${WK_STEPS.map((step) => {
          const best = mine.best[step];
          const pill = best == null ? "" : `<span class="pill ${step !== "cards" && best >= pass ? "ok" : ""}">${step === "cards" ? "✓" : `${best}%`}</span>`;
          return row("step", { step }, t(`wk_s_${step}`), t(`wk_d_${step}`), pill, { text: WK_ICON[step] });
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
              <span class="card-word">${esc(item.prompt)}</span>
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
              ${answered && (!answered.ok || item.typed) ? `<button class="btn ${item.typed ? "" : "ghost"}" data-act="next">${esc(t("next"))}</button>` : ""}
            </div>`;
          const form = view.querySelector("form");
          if (form) {
            form.answer.focus({ preventScroll: true });
            form.addEventListener("submit", (event) => { event.preventDefault(); settle({ ...wkCheckTyped(item, form.answer.value), given: form.answer.value.trim() }); });
          } else if (answered && item.typed) {
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
          draw();
          if (result.ok && !item.typed) setTimeout(() => { if (current() === entry && answered === result) advance(); }, 700);
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
            <div class="card static wk"><span class="card-hint">${esc(item.sub)}</span><span class="card-word">${esc(item.prompt)}</span></div>
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
      else if (step === "blitz") blitz();
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
        ${stat(p.decks, t("st_decks"))}
        ${stat(`${me.verbs.learned.length}/${me.verbs.parts.length}`, t("st_levels"))}
        ${stat(Object.keys(me.grammar.done).length, t("st_grammar"))}
        ${stat(words, t("st_words"))}
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
        <div class="stack"><a class="btn" href="https://t.me/${esc(CFG.bot)}">${esc(t("gate_open"))}</a></div></div>`;
      return;
    }
    view.innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    try {
      state.me = await api("start");
    } catch (error) {
      view.innerHTML = `<div class="empty"><p>${esc(error.status === 401 ? t("err_auth") : t("err_net"))}</p><button class="btn" id="again">${esc(t("retry"))}</button></div>`;
      $("again").addEventListener("click", start);
      return;
    }
    setLanguage(state.me.language);
    tab("home");
    loadContent().catch(() => {}); // warm up the cards while the student looks at the home screen
  }

  start();
})();
