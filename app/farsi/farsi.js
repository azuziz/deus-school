/* Farsi - the Persian course for the teacher and the learners in FarsiChatIds (only they get `me.farsi`).
   Kept apart from the German courses: app.js loads this file only for them, and it plugs in
   through window.DEUS.course(), using only the shared helpers app.js hands out in window.DEUS.core.
   Its material and progress come from the bot's farsi package (src/farsi/api.py). */
(() => {
  "use strict";

  const {
    state, view, esc, t, haptic, toast, api, loading, go, back, swap, title, row, bar,
    show, doneScreen, showReward, drawStreak, on, onKeys, choiceKeys, ROUND_GAP_BAD, saveResult,
  } = window.DEUS.core;
  const VIEWS = {};

  const FA_STEPS = {
    notes: ["📖", "Grammar", "Read the unit's rules"], letters: ["🔡", "Letters", "The new letters"],
    sounds: ["🔊", "Sounds", "Letter ↔ sound"], cards: ["🃏", "Words", "Vocabulary cards"],
    bridge: ["🇺🇿", "Uzbek bridge", "The Uzbek word → its Persian relative"],
    read: ["👁", "Reading", "How is it read?"], spell: ["🧩", "Spelling", "Put the letters in order"],
    meaning: ["💡", "Meaning", "Persian → English"], reverse: ["🇮🇷", "Recall", "English → Persian"],
    numbers: ["🔢", "Numbers", "Digits ↔ words"], stems: ["🌱", "Present stems", "Infinitive → stem"],
    conj: ["⚙️", "Verb forms", "Pick the right form"], spoken: ["🗣", "Spoken → written", "Colloquial forms"],
    compound: ["🔗", "Compound verbs", "Light verb and preposition"], build: ["🧱", "Sentences", "Put the words in order"],
    affix: ["🧬", "Word building", "Stem + suffix → new word"], fill: ["✏️", "Fill the verb", "The book's gap sentences"],
    rewrite: ["📝", "Rewrite", "Join, transform, report: write it"], text: ["📰", "Reading", "Questions on the text"],
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
    on({ unit: (data) => go("faUnit", { n: Number(data.n) }) });
  };

  VIEWS.faUnit = ({ n }) => {
    const unit = faUnit(n);
    title(`${n} · ${unit.en}`);
    view.innerHTML = `<div class="list">${unit.steps.map((step) => {
      const [icon, name, sub] = FA_STEPS[step.id];
      const right = step.best == null ? "" : `<span class="pill ${step.id === "test" && step.best < state.me.farsi.pass ? "red" : "ok"}">${["notes", "letters", "cards"].includes(step.id) ? "✓" : `${step.best}%`}</span>`;
      return row("step", { step: step.id }, name, sub, right, { text: icon });
    }).join("")}</div>`;
    on({ step: (data) => go("faStep", { n, step: data.step }) });
  };

  VIEWS.faStep = ({ n, step }, entry) => {
    title(`${FA_STEPS[step][1]} · ${n}`);
    const save = async (right, total) => {
      const result = await saveResult("fa_result", { unit: n, step, right, total });
      if (!result) return;
      state.me.farsi.units = result.units;
      if (result.progress) { state.me.progress = result.progress; drawStreak(); }
      showReward(result.reward);
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
        on({ done: () => { save(1, 1); const next = nextStep(); if (next) swap("faStep", { n, step: next }); else back(); } });
        return;
      }
      const queue = payload.items.slice();
      const total = queue.length;
      let seen = new Set();
      let done = 0, right = 0, answered = null, open = false, placed = [];
      // "↩ Back" (or ←) steps back through the items already answered, newest first: an answered
      // item comes back as it was left (your pick and the right one marked), a card comes back
      // turned over to rate again. The items after it are asked again, so the score stays honest.
      const history = [];
      const missed = [];   // { item, given } for every wrong answer, listed on the done screen
      const snapshot = () => ({ queue: queue.slice(), done, right, seen: new Set(seen), answered, open, placed: placed.slice(), missed: missed.length });

      // The right answer of an item in plain words, and how to show a given answer.
      const answerOf = (item) => (item.t === "flip" ? item.back.filter(([text]) => text).map(([text, on]) => fa(text, on)).join(" · ")
        : fa(item.a, item.t !== "choice" || item.ofa));
      const givenOf = (item, given) => fa(given, item.t !== "choice" || item.ofa);

      const missedList = () => {
        const shown = new Set();
        const rows = missed.filter(({ item }) => !shown.has(item) && shown.add(item)).map(({ item, given }) => `<li>
            <span class="fa-missed-q" dir="auto">${item.sub ? `<small>${esc(item.sub)}</small>` : ""}${fa(item.q, item.qfa)}</span>
            ${given ? `<span class="fa-missed-no" dir="auto">✗ ${givenOf(item, given)}</span>` : ""}
            <span class="fa-missed-ok" dir="auto">✓ ${answerOf(item)}</span>
            ${item.after ? `<small dir="auto">${esc(item.after)}</small>` : ""}
          </li>`);
        const heading = !payload.scored ? `To look at again (${rows.length})` : rows.length === 1 ? "Your mistake" : `Your ${rows.length} mistakes`;
        return rows.length ? `<div class="fa-missed"><h3>${heading}</h3><ol>${rows.join("")}</ol></div>` : "";
      };

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
        view.querySelector("#reward").insertAdjacentHTML("beforebegin", missedList());
        on({ again: show, back, next: () => swap("faStep", { n, step: next }) });
        save(payload.scored ? right : 1, payload.scored ? total : 1);
      };

      const settle = (ok, given) => {
        if (answered) return;
        const item = queue[0];
        answered = { ok, given };
        if (ok && !seen.has(item)) right += 1;
        if (!ok) missed.push({ item, given });
        seen.add(item);
        haptic(ok ? "success" : "error");
        draw();
      };

      const move = () => {
        const item = queue.shift();
        if (answered.ok || !payload.repeat) done += 1;
        else queue.splice(Math.min(ROUND_GAP_BAD, queue.length), 0, item);
        answered = null; open = false; placed = [];
        draw();
      };
      const remember = () => { history.push(snapshot()); if (history.length > 100) history.shift(); };
      const advance = () => { remember(); move(); };
      const stepBack = () => {
        const before = history.pop();
        if (!before) return;
        queue.splice(0, queue.length, ...before.queue);
        ({ done, right, seen, answered, open, placed } = before);
        missed.length = before.missed;
        haptic("tap");
        draw();
      };

      const draw = () => {
        if (!queue.length) return finish();
        const item = queue[0];
        const mood = answered ? (answered.ok ? "right" : "wrong") : "";
        const top = `<div class="session-top"><button class="undo" type="button" data-act="prev" ${history.length ? "" : "disabled"}>↩ ${esc(t("card_back"))}</button>${bar(done, total)}<em>${Math.min(done + 1, total)}/${total}</em></div>`;
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
              ${item.q ? `<span class="card-ex" dir="auto">${fa(item.q, item.qfa)}</span>` : ""}
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

      // 1-4 pick, Enter or Space presses the main button, ← goes back one item.
      onKeys((event) => {
        if (event.key === "ArrowLeft" && view.querySelector('[data-act="prev"]:not(:disabled)')) { event.preventDefault(); stepBack(); } else choiceKeys(event);
      });
      on({
        next: advance,
        prev: stepBack,
        reveal: () => { if (!open) { open = true; haptic("tap"); draw(); } },
        rate: (data) => {
          remember();   // a card comes back turned over, before it was rated
          answered = { ok: data.r === "good" };
          if (answered.ok && !seen.has(queue[0])) right += 1;
          if (!answered.ok) missed.push({ item: queue[0], given: "" });
          seen.add(queue[0]);
          haptic("tap");
          move();
        },
        pick: (data) => settle(data.v === queue[0].a, data.v),
        tile: (data) => { placed.push(Number(data.i)); haptic("tap"); draw(); },
        undo: () => { placed.pop(); draw(); },
        check: () => { const built = placed.map((i) => queue[0].tiles[i]).join(queue[0].sep); settle(built === queue[0].a, built); },
      });
      draw();
    });
  };

  window.DEUS.course({
    id: "fa",
    views: VIEWS,
    kept: ["fa", "faUnit"],   // screens the app reopens on
    placeOk: (entry) => (entry.view === "fa" ? true : state.me.farsi.units.some((unit) => unit.n === entry.params.n)),
    tile: (me, tile) => tile("fa", "🇮🇷", "Farsi", "فارسی · unit by unit", me.farsi.units.filter((unit) => unit.passed).length, me.farsi.units.length),
  });
})();
