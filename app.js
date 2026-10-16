(function () {
  const D = window.DEUS;
  const LANGS = ["uz", "ru", "en", "de"];
  const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pickLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem("deus-lang");
      if (LANGS.includes(saved)) return saved;
    } catch (e) {}
    const nav = (navigator.language || "").slice(0, 2);
    return LANGS.includes(nav) ? nav : "ru";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function resultCard(r, t) {
    const rows = r.scores
      .map(([label, got, max, shown]) => {
        const pct = Math.round((got / max) * 100);
        return `<div class="row"><span>${esc(label)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${esc(shown || `${got}/${max}`)}</b></div>`;
      })
      .join("");
    const extra = r.extra ? `<div class="extra">${esc(r.extra)}</div>` : "";
    const months = r.months ? `<span class="months">${esc(t["results.months"].replace("{n}", r.months))}</span>` : "";
    const grade = r.grade ? `<span class="grade">${esc(r.grade)}</span>` : "";
    return `<article class="res">
      <div class="res-top"><span class="lvl">${esc(r.level)}</span><div><div class="exam">${esc(r.exam)}</div><div class="who">${esc(r.name)} · ${esc(r.date)}</div></div>${grade}</div>
      <div class="scores">${rows}</div>${extra}${months}
    </article>`;
  }

  function reviewCard(r, lang, t) {
    const badge = r.sample ? `<span class="sample">${esc(t["reviews.sample"])}</span>` : "";
    const shownLang = r.text[lang] ? lang : r.text.ru ? "ru" : Object.keys(r.text)[0];
    const meta = r.months ? t["reviews.meta"].replace("{level}", r.level).replace("{n}", r.months) : r.level || "";
    const note = r.original && shownLang !== r.original && t["lang." + r.original]
      ? `<small class="tr">${esc(t["reviews.translated"].replace("{from}", t["lang." + r.original]))}</small>`
      : "";
    return `<figure class="rev${r.sample ? " is-sample" : ""}">${badge}
      <blockquote>${esc(r.text[shownLang] || "")}</blockquote>
      <figcaption><b>${esc(r.name)}</b><span>${esc(meta)}</span>${note}</figcaption>
    </figure>`;
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function priceCard(kind, p, t) {
    const fill = (s) => s.replace("{m}", p.minutes).replace("{n}", p.perWeek).replace("{s}", p.size);
    const points = [fill(t["p.lessons"]), fill(t["p.week"]), kind === "group" ? fill(t["p.size"]) : t["p.solo"]];
    return `<article class="price${kind === "individual" ? " featured" : ""}">
      <h3>${esc(t["p." + kind])}</h3>
      <div class="amount"><b>${money(p.uzs)}</b> <span>${esc(t["p.currency"])}</span></div>
      <div class="eur">${money(p.eur)}&nbsp;€ · ${esc(t["p.per"])}</div>
      <ul>${points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <a class="btn ${kind === "individual" ? "primary" : "ghost"}" href="${esc(D.links.bot)}" target="_blank" rel="noopener">${esc(t["cta.trial"])}</a>
    </article>`;
  }

  function render(lang) {
    const t = window.I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));

    document.querySelectorAll("[data-val]").forEach((el) => (el.textContent = D.experience[el.dataset.val]));
    document.getElementById("pricesGrid").innerHTML = Object.entries(D.prices).map(([k, p]) => priceCard(k, p, t)).join("");

    const results = D.results || [];
    const reviews = D.reviews || [];
    document.getElementById("resultsGrid").innerHTML = results.map((r) => resultCard(r, t)).join("");
    document.getElementById("reviewsGrid").innerHTML = reviews.map((r) => reviewCard(r, lang, t)).join("");
    const has = { results: results.length > 0, reviews: reviews.length > 0 };
    document.getElementById("results").hidden = !has.results;
    document.getElementById("reviews").hidden = !has.reviews;
    document.querySelectorAll("[data-needs]").forEach((el) => (el.hidden = !has[el.dataset.needs]));
    motion.mark();
  }

  // --- Motion: everything here is optional decoration; without JS or with reduced motion the page is static.
  const motion = (function () {
    let first = true;
    const io = "IntersectionObserver" in window && !calm
      ? new IntersectionObserver((entries) => entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
          if (e.target.dataset.count != null) countUp(e.target);
        }), { threshold: 0.15, rootMargin: "0px 0px -40px 0px" })
      : null;

    const SELECTOR = ".sec h2, .sec-lead, .card, .steps li, .price, .res, .rev, .tg-card, .final-in > *";

    function mark() {
      const els = document.querySelectorAll(SELECTOR);
      els.forEach((el) => {
        if (el.classList.contains("reveal")) return;
        el.classList.add("reveal");
        // stagger cards that sit next to each other in a grid
        const i = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = el.parentNode.classList.contains("grid") || el.parentNode.classList.contains("steps") ? `${(i % 3) * 90}ms` : "";
        if (io && first) io.observe(el);
        else el.classList.add("in");
      });
      first = false;
    }

    function countUp(el) {
      const end = Number(el.dataset.count);
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1200);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function stats() {
      document.querySelectorAll("[data-val]").forEach((el) => {
        if (!io) return;
        el.dataset.count = el.textContent;
        el.textContent = "0";
        io.observe(el);
      });
    }

    function hero() {
      const levels = document.querySelectorAll(".levels span");
      const chat = document.querySelector(".chat");
      if (calm || !chat) return;
      chat.classList.add("typing");
      levels.forEach((l) => l.classList.remove("on"));
      levels.forEach((l, i) => setTimeout(() => {
        levels.forEach((x) => x.classList.remove("on"));
        l.classList.add("on");
      }, 250 + i * 350));
      setTimeout(() => levels[3] && (levels.forEach((x) => x.classList.remove("on")), levels[3].classList.add("on")), 250 + levels.length * 350);
      setTimeout(() => chat.classList.remove("typing"), 1400);
    }

    return { mark, stats, hero };
  })();

  document.querySelectorAll("[data-link]").forEach((a) => (a.href = D.links[a.dataset.link]));
  document.getElementById("year").textContent = new Date().getFullYear();
  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      try { localStorage.setItem("deus-lang", b.dataset.lang); } catch (e) {}
      render(b.dataset.lang);
    })
  );

  render(pickLang());
  motion.stats();
  motion.hero();
})();
