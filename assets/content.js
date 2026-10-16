// Everything you might want to edit lives here: links, prices, results, reviews, visa packages.
// Page texts are in assets/i18n/*.js (one entry per text, all four languages side by side).
// A list that is empty hides its section.

window.DEUS = {
  links: {
    bot: "https://t.me/attemptobot?start=site",
    channel: "https://t.me/deutschesbuch",
    teacher: "https://t.me/azuziz",
  },

  // Numbers shown under the headline.
  experience: { teachingYears: 10, germanyYears: 5 },

  // So'm prices are worked out from euro: eur x eurRate, rounded UP to the next 100 000.
  // eurRate = average Central Bank of Uzbekistan rate, 16.04-15.10.2026 (weekly values, 13 206 - 14 363).
  eurRate: 13790,

  // The three course formats, from the biggest group to one-on-one.
  // eur = price per person for one month (12 lessons). Names are in i18n/common.js (course.<id>.*).
  courses: [
    { id: "klasse", eur: 100, minutes: 100, perWeek: 3, lessons: 12, size: [7, 10] },
    { id: "kreis", eur: 150, minutes: 90, perWeek: 3, lessons: 12, size: [3, 6] },
    { id: "privat", eur: 250, minutes: 60, perWeek: 3, lessons: 12, size: [1, 1] },
  ],

  // Student results - add only with the student's permission.
  // A score can have a 4th value: the text to show instead of "got/max" (used for TestDaF levels).
  results: [
    {
      name: "Dinara A.",
      exam: "TestDaF",
      level: "C1",
      date: "06.2021",
      months: null,
      scores: [["Lesen", 4, 5, "TDN 4"], ["Hören", 4, 5, "TDN 4"], ["Schreiben", 4, 5, "TDN 4"], ["Sprechen", 4, 5, "TDN 4"]],
    },
    {
      name: "Parisa M.",
      exam: "Goethe-Zertifikat",
      level: "B2",
      date: "03.2022",
      months: null,
      scores: [["Lesen", 83, 100], ["Hören", 70, 100], ["Schreiben", 63, 100], ["Sprechen", 87, 100]],
      extra: "+ TestDaF 05.2022: Sprechen TDN 5",
    },
    {
      name: "Narmina Y.",
      exam: "telc Deutsch",
      level: "B2",
      date: "08.2026",
      months: null,
      grade: "Gut",
      scores: [["Schriftlich", 179, 225], ["Mündlich", 64, 75], ["Summe", 243, 300]],
    },
    {
      name: "Saidabrorkhon S.",
      exam: "Goethe-Zertifikat",
      level: "B1",
      date: "11.2022",
      months: null,
      scores: [["Lesen", 70, 100], ["Hören", 80, 100], ["Schreiben", 85, 100], ["Sprechen", 83, 100]],
    },
    {
      name: "Kholniso K.",
      exam: "Goethe-Zertifikat",
      level: "A1",
      date: "08.2021",
      months: null,
      grade: "Gut",
      scores: [["Hören", 14.94, 25], ["Lesen", 24.9, 25], ["Schreiben", 24.9, 25], ["Sprechen", 21.58, 25], ["Gesamt", 86, 100]],
    },
  ],

  // Results of students from outside Uzbekistan (same format as results). Shown on /international/.
  intlResults: [],

  // Student reviews. level + months show as "C1 in 8 months" (months can be left out).
  // original: the language the student wrote in - the other languages get a "translated from" note.
  reviews: [
    {
      name: "Nastya K.",
      level: "C1",
      months: 8,
      original: "de",
      text: {
        de: "Ich wollte Ihnen auch für alles danken! Sie haben sehr viel Zeit und Mühe in mein Lernen investiert, und ehrlich gesagt bin ich immer noch überrascht, dass ich nur 8 Monate gebraucht habe, um C1 zu erreichen. Ohne Ihre Arbeit wäre es ganz anders und deutlich schwieriger gewesen. Ich würde Sie immer wieder als den besten Deutschlehrer empfehlen.",
        ru: "Хочу поблагодарить вас за всё! Вы вложили очень много времени и сил в моё обучение, и, честно говоря, я до сих пор удивляюсь, что мне понадобилось всего 8 месяцев, чтобы выйти на уровень C1. Без вашей работы всё было бы совсем по-другому и намного сложнее. Я всегда буду рекомендовать вас как лучшего преподавателя немецкого.",
        uz: "Sizga hamma narsa uchun rahmat aytmoqchiman! O'qishimga juda ko'p vaqt va kuch sarfladingiz. Rostini aytsam, C1 darajasiga atigi 8 oyda chiqqanimdan haligacha hayronman. Sizning mehnatingizsiz hammasi butunlay boshqacha va ancha qiyin bo'lardi. Sizni har doim eng yaxshi nemis tili o'qituvchisi sifatida tavsiya qilaman.",
        en: "I also wanted to thank you for everything! You put so much time and effort into my learning, and honestly, I'm still surprised it took me only 8 months to reach C1. Without your work it would have been completely different and much harder. I would recommend you again and again as the best German teacher.",
      },
    },
  ],

  // Visa support (from "DEUS — Визовое сопровождение"). Prices in so'm; euro is worked out with eurRate.
  visa: {
    seats: 10, // places left in the first intake at the founder price
    packages: [
      { id: "start", regular: 3000000, founder: 2400000, items: 4 },
      { id: "standard", regular: 4500000, founder: 3600000, items: 6, popular: true },
      { id: "premium", regular: 9500000, founder: 8100000, items: 7 },
    ],
    // add-on services: [id, price in so'm or [from, to]]
    extras: [
      ["consult", 300000],
      ["form", 1000000],
      ["doclist", 1500000],
      ["appointment", 1000000],
      ["insurance", 500000],
      ["booking", 700000],
      ["blocked", 1000000],
      ["interview", 2000000],
      ["sop", 1500000],
      ["translation", [500000, 800000]],
      ["housing", 1500000],
      ["urgent", 2000000],
      ["resubmit", 2000000],
      ["airport", 3200000],
    ],
  },

  // Speaking club sessions that already took place (from the DEUS channel).
  clubSessions: [
    { date: "29.01.2022", topic: "ausbildung", guest: "Fabian", guestNote: "C2" },
    { date: "08.01.2022", topic: "aupair", guest: "Dinara", guestNote: "C1" },
    { date: "25.12.2021", topic: "ferienjob", guest: "Kamol" },
    { date: "04.12.2021", topic: "studentlife", guest: "Fabian" },
  ],
};
