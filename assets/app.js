(function () {
  const D = window.DEUS;
  const T = window.T;
  const LANGS = ["en", "ru", "uz", "de"];
  const PAGE = document.body.dataset.page || "home";
  const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NAV = [
    ["kurse", "/kurse/"],
    ["visum", "/visum/"],
    ["results", "/results/"],
    ["sophie", "/sophie/"],
    ["international", "/international/"],
    ["club", "/speaking-club/"],
  ];

  let lang = "en";

  function pickLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem("deus-lang");
      if (LANGS.includes(saved)) return saved;
    } catch (e) {}
    return "en";
  }

  function t(key, vars) {
    const e = T[key];
    let s = e ? (e[lang] != null ? e[lang] : e.en) : key;
    if (vars) Object.keys(vars).forEach((k) => (s = s.split("{" + k + "}").join(vars[k])));
    return s;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function num(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  const dec = (n) => (lang === "en" ? String(n) : String(n).replace(".", ","));
  const som = (n) => `${num(n)} ${t("cur.som")}`;
  const eur = (n) => (lang === "en" ? `€${num(n)}` : `${num(n)} €`);
  const toSom = (e) => Math.ceil((e * D.eurRate) / 100000) * 100000;
  const toEur = (s) => Math.round(s / D.eurRate / 5) * 5;

  // ---------- shared header and footer ----------
  function shell() {
    const top = document.createElement("header");
    top.className = "top";
    top.innerHTML = `<div class="wrap top-in">
      <a class="logo" href="/"><span class="flag"><i></i><i></i><i></i></span><span>DEUS <small>digital school</small></span></a>
      <nav class="nav" id="nav">${NAV.map(([k, href]) => `<a href="${href}"${k === PAGE ? ' aria-current="page"' : ""} data-i18n="nav.${k}"></a>`).join("")}
        <a class="btn primary nav-cta" data-link="bot" target="_blank" rel="noopener" data-i18n="cta.trial"></a>
      </nav>
      <div class="langs" role="group" aria-label="Language">${LANGS.map((l) => `<button data-lang="${l}">${l.toUpperCase()}</button>`).join("")}</div>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="nav"><i></i><i></i><i></i></button>
    </div>`;
    document.body.prepend(top);

    const foot = document.createElement("footer");
    foot.className = "foot";
    foot.innerHTML = `<div class="wrap">
      <div class="foot-grid">
        <div><a class="logo" href="/"><span class="flag"><i></i><i></i><i></i></span><span>DEUS <small>digital school</small></span></a>
          <p class="foot-tag" data-i18n="foot.tag"></p></div>
        <div class="foot-links">${NAV.map(([k, href]) => `<a href="${href}" data-i18n="nav.${k}"></a>`).join("")}</div>
        <div class="foot-links">
          <a data-link="bot" target="_blank" rel="noopener">Sophie · @attemptobot</a>
          <a data-link="channel" target="_blank" rel="noopener" data-i18n="foot.channel"></a>
          <a data-link="teacher" target="_blank" rel="noopener" data-i18n="footer.teacher"></a>
        </div>
      </div>
      <div class="foot-bottom">© ${new Date().getFullYear()} DEUS digital school · deus-school.com</div>
    </div>`;
    document.body.append(foot);

    const burger = top.querySelector(".burger");
    burger.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open);
    });
    top.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
  }

  // ---------- cards ----------
  function courseCard(c, i) {
    const [lo, hi] = c.size;
    const size = hi === 1 ? t("course.one") : t("course.size", { lo, hi });
    const att = [Math.round(c.minutes / hi), Math.round(c.minutes / lo)];
    const attText = att[0] === att[1] ? t("course.min", { n: att[0] }) : t("course.minRange", { lo: att[0], hi: att[1] });
    const somMonth = toSom(c.eur);
    return `<article class="tier tier-${c.id}">
      <div class="tier-head"><span class="tier-step">${i + 1}</span><span class="tier-kind">${esc(t(`course.${c.id}.kind`))}</span></div>
      <h3 class="tier-name">${esc(t(`course.${c.id}.name`))}</h3>
      <p class="tier-sub">${esc(t(`course.${c.id}.sub`))}</p>
      <div class="amount"><b>${eur(c.eur)}</b> <span>${esc(t(c.id === "privat" ? "course.perMonth" : "course.perPersonMonth"))}</span></div>
      <div class="uzs">≈ ${som(somMonth)} · ${esc(t("course.perLesson", { p: som(Math.round(somMonth / c.lessons / 1000) * 1000) }))}</div>
      <ul>
        <li>${esc(size)}</li>
        <li>${esc(t("course.schedule", { n: c.perWeek, m: c.minutes }))}</li>
        <li>${esc(t("course.lessons", { n: c.lessons }))}</li>
      </ul>
      <div class="attention"><span>${esc(t("course.attention"))}</span><span class="bar"><i style="width:${Math.round((att[1] / 60) * 100)}%"></i></span><b>${esc(attText)}</b></div>
      <p class="tier-text">${esc(t(`course.${c.id}.text`))}</p>
      <a class="btn ${c.id === "kreis" ? "primary" : "ghost"}" href="${esc(D.links.bot)}" target="_blank" rel="noopener">${esc(t("cta.trial"))}</a>
    </article>`;
  }

  function resultCard(r) {
    const rows = r.scores
      .map(([label, got, max, shown]) => {
        const pct = Math.round((got / max) * 100);
        return `<div class="row"><span>${esc(label)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${esc(shown || `${got}/${max}`)}</b></div>`;
      })
      .join("");
    const extra = r.extra ? `<div class="extra">${esc(r.extra)}</div>` : "";
    const months = r.months ? `<span class="months">${esc(t("results.months", { n: dec(r.months) }))}</span>` : "";
    const grade = r.grade ? `<span class="grade">${esc(r.grade)}</span>` : "";
    return `<article class="res">
      <div class="res-top"><span class="lvl">${esc(r.level)}</span><div><div class="exam">${esc(r.exam)}</div><div class="who">${esc(r.name)}${r.date ? ` · ${esc(r.date)}` : ""}</div></div>${grade}</div>
      <div class="scores">${rows}</div>${extra}${months}
    </article>`;
  }

  function reviewCard(r) {
    const shown = r.text[lang] ? lang : r.text.en ? "en" : Object.keys(r.text)[0];
    const meta = r.months ? t("reviews.meta", { level: r.level, n: dec(r.months) }) : r.level || "";
    const note = r.original && shown !== r.original ? `<small class="tr">${esc(t("reviews.translated", { from: t("lang." + r.original) }))}</small>` : "";
    return `<figure class="rev">
      <blockquote>${esc(r.text[shown] || "")}</blockquote>
      <figcaption><b>${esc(r.name)}</b><span>${esc(meta)}</span>${note}</figcaption>
    </figure>`;
  }

  function visaCard(p) {
    const items = Array.from({ length: p.items }, (_, i) => `<li>${esc(t(`visa.${p.id}.i${i + 1}`))}</li>`).join("");
    return `<article class="tier visa-${p.id}${p.popular ? " featured" : ""}">
      ${p.popular ? `<span class="badge">${esc(t("visa.popular"))}</span>` : ""}
      <h3 class="tier-name">${esc(t(`visa.${p.id}.name`))}</h3>
      <p class="tier-sub">${esc(t(`visa.${p.id}.for`))}</p>
      <div class="old">${som(p.regular)}</div>
      <div class="amount"><b>${num(p.founder)}</b> <span>${esc(t("cur.som"))}</span></div>
      <div class="uzs">≈ ${eur(toEur(p.founder))}</div>
      <ul>${items}</ul>
      <a class="btn ${p.popular ? "primary" : "ghost"}" href="${esc(D.links.teacher)}" target="_blank" rel="noopener">${esc(t("visa.cta"))}</a>
    </article>`;
  }

  function visaExtras() {
    return `<table class="extras"><thead><tr><th>${esc(t("visa.x.service"))}</th><th>${esc(t("visa.x.what"))}</th><th>${esc(t("visa.x.price"))}</th></tr></thead><tbody>${D.visa.extras
      .map(([id, price]) => {
        const p = Array.isArray(price) ? `${num(price[0])}–${num(price[1])}` : num(price);
        const note = T[`visa.x.${id}.note`] ? `<small>${esc(t(`visa.x.${id}.note`))}</small>` : "";
        return `<tr><td>${esc(t(`visa.x.${id}`))}</td><td>${esc(t(`visa.x.${id}.d`))}${note}</td><td class="num">${p}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  }

  function clubSession(s) {
    const note = s.guestNote ? ` (${esc(s.guestNote)})` : "";
    return `<li><time>${esc(s.date)}</time><div><b>${esc(t(`club.topic.${s.topic}`))}</b><span>${esc(t("club.guest"))}: ${esc(s.guest)}${note}</span></div></li>`;
  }

  const RENDER = {
    courses: () => D.courses.map(courseCard).join(""),
    results: () => D.results.map(resultCard).join(""),
    resultsTeaser: () => D.results.slice(0, 3).map(resultCard).join(""),
    intlResults: () => D.intlResults.map(resultCard).join(""),
    reviews: () => D.reviews.map(reviewCard).join(""),
    visaPackages: () => D.visa.packages.map(visaCard).join(""),
    visaExtras,
    clubSessions: () => D.clubSessions.map(clubSession).join(""),
    countries: () => D.countries.map((c) => `<li>${esc(t("country." + c))}</li>`).join(""),
  };
  D.experience.countries = D.countries.length;
  const SIZE = { results: D.results.length, resultsTeaser: D.results.length, intlResults: D.intlResults.length, reviews: D.reviews.length };

  // ---------- render everything for one language ----------
  function render(l) {
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n, { rate: num(D.eurRate), seats: D.visa.seats })));
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === l));
    document.querySelectorAll("[data-link]").forEach((a) => (a.href = D.links[a.dataset.link]));
    document.querySelectorAll("[data-val]").forEach((el) => (el.textContent = D.experience[el.dataset.val]));
    document.querySelectorAll("[data-render]").forEach((el) => {
      const k = el.dataset.render;
      el.innerHTML = RENDER[k]();
      const hideId = el.dataset.hideEmpty;
      if (hideId && SIZE[k] != null) document.getElementById(hideId).hidden = SIZE[k] === 0;
      const showId = el.dataset.showEmpty;
      if (showId && SIZE[k] != null) document.getElementById(showId).hidden = SIZE[k] !== 0;
    });
    const title = document.body.dataset.title;
    document.title = title ? `${t(title)} · DEUS digital school` : "DEUS digital school";
    motion.mark();
  }

  // ---------- motion: optional decoration; without JS or with reduced motion the page is static ----------
  const motion = (function () {
    let first = true;
    const io = "IntersectionObserver" in window && !calm
      ? new IntersectionObserver((entries) => entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
          if (e.target.dataset.count != null) countUp(e.target);
        }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
      : null;

    const SELECTOR = ".sec h2, .sec-lead, .card, .steps li, .tier, .res, .rev, .tg-card, .path li, .feat, .sessions li, .final-in > *, .extras, .note";

    function mark() {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (el.classList.contains("reveal")) return;
        el.classList.add("reveal");
        const p = el.parentNode;
        const i = Array.prototype.indexOf.call(p.children, el);
        const grid = /\b(grid|steps|path|sessions)\b/.test(p.className);
        el.style.transitionDelay = grid ? `${(i % 3) * 90}ms` : "";
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
      if (!io) return;
      document.querySelectorAll("[data-val]").forEach((el) => {
        el.dataset.count = el.textContent;
        el.textContent = "0";
        io.observe(el);
      });
    }

    function hero() {
      const chat = document.querySelector(".chat");
      if (calm || !chat) return;
      const levels = document.querySelectorAll(".levels span");
      chat.classList.add("typing");
      levels.forEach((l, i) => setTimeout(() => {
        levels.forEach((x) => x.classList.remove("on"));
        l.classList.add("on");
      }, 250 + i * 350));
      setTimeout(() => levels[3] && (levels.forEach((x) => x.classList.remove("on")), levels[3].classList.add("on")), 250 + levels.length * 350);
      setTimeout(() => chat.classList.remove("typing"), 1400);
    }

    return { mark, stats, hero };
  })();

  shell();
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
