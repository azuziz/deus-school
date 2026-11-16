/* Farsi - the teacher's own Persian course (only the teacher's chat gets `me.farsi`).
   Kept apart from the German courses: app.js loads this file only for the teacher, and it plugs in
   through window.DEUS.course(), using only the shared helpers app.js hands out in window.DEUS.core.
   Its material and progress come from the bot's farsi package (src/farsi/api.py). */
(() => {
  "use strict";

  const {
    state, view, esc, t, haptic, toast, api, loading, go, back, swap, title, row, bar,
    show, doneScreen, showReward, drawStreak, on, onKeys, choiceKeys, ROUND_GAP_BAD,
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
      try {
        const result = await api("fa_result", { unit: n, step, right, total });
        state.me.farsi.units = result.units;
        if (result.progress) { state.me.progress = result.progress; drawStreak(); }
        showReward(result.reward);
      } catch (error) { toast(t("err_save")); }
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
        on({ again: show, back, next: () => swap("faStep", { n, step: next }) });
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

      onKeys(choiceKeys);   // 1-4 pick, Enter or Space presses the main button
      on({
        next: advance,
        reveal: () => { if (!open) { open = true; haptic("tap"); draw(); } },
        rate: (data) => { answered = { ok: data.r === "good" }; if (answered.ok && !seen.has(queue[0])) right += 1; seen.add(queue[0]); haptic("tap"); advance(); },
        pick: (data) => settle(data.v === queue[0].a, data.v),
        tile: (data) => { placed.push(Number(data.i)); haptic("tap"); draw(); },
        undo: () => { placed.pop(); draw(); },
        check: () => settle(placed.map((i) => queue[0].tiles[i]).join(queue[0].sep) === queue[0].a, ""),
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
