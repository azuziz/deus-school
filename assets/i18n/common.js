// Texts used on several pages. One entry per text, all four languages side by side.
// {name} placeholders are filled in by app.js.
window.T = window.T || {};
Object.assign(window.T, {
  // navigation
  "nav.kurse": { en: "Courses", ru: "Курсы", uz: "Kurslar", de: "Kurse" },
  "nav.visum": { en: "Visa", ru: "Виза", uz: "Viza", de: "Visum" },
  "nav.results": { en: "Results", ru: "Результаты", uz: "Natijalar", de: "Ergebnisse" },
  "nav.sophie": { en: "Sophie AI", ru: "Sophie AI", uz: "Sophie AI", de: "Sophie KI" },
  "nav.international": { en: "International", ru: "Иностранцам", uz: "Xorijliklar uchun", de: "International" },
  "nav.club": { en: "Speaking club", ru: "Разговорный клуб", uz: "Suhbat klubi", de: "Sprachclub" },

  "cta.trial": { en: "Free trial lesson", ru: "Бесплатный пробный урок", uz: "Bepul sinov darsi", de: "Kostenlose Probestunde" },
  "cta.courses": { en: "See the courses", ru: "Смотреть курсы", uz: "Kurslarni ko'rish", de: "Kurse ansehen" },
  "cta.more": { en: "Learn more", ru: "Подробнее", uz: "Batafsil", de: "Mehr erfahren" },
  "cta.allResults": { en: "All results", ru: "Все результаты", uz: "Barcha natijalar", de: "Alle Ergebnisse" },

  "cur.som": { en: "UZS", ru: "сум", uz: "so'm", de: "UZS" },
  "lang.de": { en: "German", ru: "немецкого", uz: "Nemis", de: "Deutschen" },

  "stat.teach": { en: "years of teaching", ru: "лет преподавания", uz: "yillik o'qituvchilik tajribasi", de: "Jahre Unterrichtserfahrung" },
  "stat.de": { en: "years of experience in Germany", ru: "лет опыта в Германии", uz: "yil Germaniyadagi tajriba", de: "Jahre Erfahrung in Deutschland" },

  // the three course formats
  "course.klasse.name": { en: "Klasse", ru: "Klasse", uz: "Klasse", de: "Klasse" },
  "course.klasse.kind": { en: "Group class", ru: "Группа", uz: "Guruh", de: "Gruppenkurs" },
  "course.klasse.sub": { en: "Learn with a full class", ru: "Учитесь в полноценной группе", uz: "To'liq guruhda o'qing", de: "Lernen in der ganzen Klasse" },
  "course.klasse.text": {
    en: "A steady pace and plenty of partners to speak with. The best value if you want structure and regular practice.",
    ru: "Ровный темп и много собеседников для практики. Самый выгодный вариант, если нужны система и регулярность.",
    uz: "Barqaror sur'at va mashq uchun ko'plab suhbatdoshlar. Tizim va muntazamlik kerak bo'lsa, eng qulay variant.",
    de: "Ein gleichmäßiges Tempo und viele Gesprächspartner. Das beste Preis-Leistungs-Verhältnis, wenn du Struktur und regelmäßige Übung willst.",
  },
  "course.kreis.name": { en: "Kreis", ru: "Kreis", uz: "Kreis", de: "Kreis" },
  "course.kreis.kind": { en: "Private group", ru: "Мини-группа", uz: "Mini-guruh", de: "Kleingruppe" },
  "course.kreis.sub": { en: "A small circle of 3–6 people", ru: "Небольшой круг из 3–6 человек", uz: "3–6 kishilik kichik davra", de: "Ein kleiner Kreis von 3–6 Personen" },
  "course.kreis.text": {
    en: "Small enough for the teacher to hear everyone in every lesson, big enough to practise real conversations.",
    ru: "Достаточно мало, чтобы преподаватель слышал каждого на каждом уроке, и достаточно много для живых диалогов.",
    uz: "O'qituvchi har darsda har bir talabani eshitishi uchun yetarlicha kichik, jonli suhbatlar uchun esa yetarlicha katta.",
    de: "Klein genug, damit die Lehrkraft in jeder Stunde alle hört, groß genug für echte Gespräche.",
  },
  "course.privat.name": { en: "Privat", ru: "Privat", uz: "Privat", de: "Privat" },
  "course.privat.kind": { en: "One-to-one", ru: "Индивидуально", uz: "Individual", de: "Einzelunterricht" },
  "course.privat.sub": { en: "Just you and your teacher", ru: "Только вы и преподаватель", uz: "Faqat siz va o'qituvchi", de: "Nur du und deine Lehrkraft" },
  "course.privat.text": {
    en: "Every minute is built around your goal: an exam date, the Studienkolleg, a job interview. The fastest way forward.",
    ru: "Каждая минута подстроена под вашу цель: дату экзамена, Studienkolleg, собеседование. Самый быстрый путь.",
    uz: "Har bir daqiqa maqsadingizga moslashtiriladi: imtihon sanasi, Studienkolleg, ish suhbati. Eng tez yo'l.",
    de: "Jede Minute dreht sich um dein Ziel: Prüfungstermin, Studienkolleg, Vorstellungsgespräch. Der schnellste Weg.",
  },
  "course.perMonth": { en: "per month", ru: "в месяц", uz: "oyiga", de: "pro Monat" },
  "course.perPersonMonth": { en: "per person / month", ru: "с человека в месяц", uz: "bir kishi uchun oyiga", de: "pro Person / Monat" },
  "course.perLesson": { en: "≈ {p} per lesson", ru: "≈ {p} за урок", uz: "darsiga ≈ {p}", de: "≈ {p} pro Stunde" },
  "course.size": { en: "{lo}–{hi} students", ru: "{lo}–{hi} человек в группе", uz: "Guruhda {lo}–{hi} kishi", de: "{lo}–{hi} Teilnehmende" },
  "course.one": { en: "1 student", ru: "1 ученик", uz: "1 talaba", de: "1 Person" },
  "course.schedule": { en: "{n}× a week, {m} min", ru: "{n} раза в неделю по {m} мин", uz: "Haftasiga {n} marta, {m} daqiqadan", de: "{n}× pro Woche, je {m} Min." },
  "course.lessons": { en: "{n} lessons a month", ru: "{n} уроков в месяц", uz: "Oyiga {n} ta dars", de: "{n} Stunden im Monat" },
  "course.attention": { en: "Teacher time per student, per lesson", ru: "Время преподавателя на ученика за урок", uz: "Bir darsda o'qituvchining har bir talabaga vaqti", de: "Zeit der Lehrkraft pro Person und Stunde" },
  "course.min": { en: "{n} min", ru: "{n} мин", uz: "{n} daqiqa", de: "{n} Min." },
  "course.minRange": { en: "{lo}–{hi} min", ru: "{lo}–{hi} мин", uz: "{lo}–{hi} daqiqa", de: "{lo}–{hi} Min." },
  "course.rateNote": {
    en: "So'm prices use the average Central Bank of Uzbekistan rate of the last 6 months (≈ {rate} so'm per euro), rounded up.",
    ru: "Цены в сумах посчитаны по среднему курсу ЦБ Узбекистана за последние 6 месяцев (≈ {rate} сум за евро) и округлены вверх.",
    uz: "So'mdagi narxlar O'zbekiston Markaziy bankining so'nggi 6 oylik o'rtacha kursi (1 yevro ≈ {rate} so'm) bo'yicha hisoblanib, yuqoriga yaxlitlangan.",
    de: "Die So'm-Preise beruhen auf dem Durchschnittskurs der Zentralbank Usbekistans der letzten 6 Monate (≈ {rate} So'm pro Euro), aufgerundet.",
  },

  // results and reviews
  "results.months": { en: "Preparation: {n} months", ru: "Подготовка: {n} мес.", uz: "Tayyorgarlik: {n} oy", de: "Vorbereitung: {n} Monate" },
  "reviews.title": { en: "What students say", ru: "Что говорят студенты", uz: "Talabalar fikri", de: "Das sagen unsere Lernenden" },
  "reviews.meta": { en: "{level} in {n} months", ru: "{level} за {n} мес.", uz: "{n} oyda {level}", de: "{level} in {n} Monaten" },
  "reviews.translated": { en: "Translated from {from}", ru: "Перевод с {from}", uz: "{from} tilidan tarjima", de: "Übersetzt aus dem {from}" },

  // Telegram block
  "tg.title": { en: "Find us on Telegram", ru: "Мы в Telegram", uz: "Biz Telegramda", de: "Wir auf Telegram" },
  "tg.channel.title": { en: "DEUS channel", ru: "Канал DEUS", uz: "DEUS kanali", de: "DEUS-Kanal" },
  "tg.channel.text": { en: "Materials, exam tips, speaking clubs and new student results.", ru: "Материалы, советы к экзаменам, разговорные клубы и новые результаты студентов.", uz: "Materiallar, imtihon maslahatlari, suhbat klublari va talabalarning yangi natijalari.", de: "Materialien, Prüfungstipps, Sprachclubs und neue Ergebnisse unserer Lernenden." },
  "tg.channel.btn": { en: "Subscribe", ru: "Подписаться", uz: "Obuna bo'lish", de: "Abonnieren" },
  "tg.bot.title": { en: "Sophie — your AI teacher", ru: "Sophie — ваш AI-преподаватель", uz: "Sophie — sizning AI-o'qituvchingiz", de: "Sophie — deine KI-Lehrerin" },
  "tg.bot.text": { en: "Trial booking, a level check, flashcards, practice chat and homework help — any time.", ru: "Запись на пробный урок, тест уровня, карточки, практика и помощь с домашкой — в любое время.", uz: "Sinov darsiga yozilish, daraja testi, kartochkalar, mashq va uy vazifasiga yordam — istalgan vaqtda.", de: "Probestunde buchen, Einstufungstest, Karteikarten, Übungschat und Hausaufgabenhilfe — jederzeit." },
  "tg.bot.btn": { en: "Open Sophie", ru: "Открыть Sophie", uz: "Sophie'ni ochish", de: "Sophie öffnen" },

  "final.title": { en: "Start with a free lesson", ru: "Начните с бесплатного урока", uz: "Bepul darsdan boshlang", de: "Starte mit einer kostenlosen Stunde" },
  "final.text": { en: "Find out your level and get a plan to the exam you need.", ru: "Узнайте свой уровень и получите план до нужного экзамена.", uz: "Darajangizni bilib oling va kerakli imtihongacha reja oling.", de: "Finde dein Niveau heraus und bekomme einen Plan bis zu deiner Prüfung." },

  // footer
  "foot.tag": { en: "German from A1 to C1 — and everything that comes after: exams, documents, visa, arrival.", ru: "Немецкий от A1 до C1 — и всё, что дальше: экзамены, документы, виза, переезд.", uz: "A1 dan C1 gacha nemis tili — va undan keyingi hamma narsa: imtihonlar, hujjatlar, viza, ko'chib o'tish.", de: "Deutsch von A1 bis C1 — und alles, was danach kommt: Prüfungen, Unterlagen, Visum, Ankunft." },
  "foot.channel": { en: "Telegram channel", ru: "Telegram-канал", uz: "Telegram kanal", de: "Telegram-Kanal" },
  "footer.teacher": { en: "Message the teacher", ru: "Написать преподавателю", uz: "O'qituvchiga yozish", de: "Lehrkraft anschreiben" },
});
