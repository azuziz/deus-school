// Everything you might want to edit lives here: links, student results, reviews.
// Texts for the rest of the page are in i18n.js.
// A section with an empty list is hidden (together with its menu link).

window.DEUS = {
  links: {
    bot: "https://t.me/attemptobot?start=site",
    channel: "https://t.me/deutschesbuch",
    teacher: "https://t.me/azuziz",
  },

  // Numbers shown under the headline.
  experience: { teachingYears: 10, germanyYears: 5 },

  // Prices for a package of 12 lessons. Change the numbers here; the page updates by itself.
  // uzs = so'm, eur = euro, minutes = length of one lesson, perWeek = lessons per week.
  prices: {
    individual: { uzs: 3000000, eur: 220, minutes: 60, perWeek: 3 },
    group: { uzs: 2000000, eur: 160, minutes: 90, perWeek: 3, size: "3–5" },
  },

  // Student results - add only with the student's permission. Example:
  // {
  //   name: "Maksim K.",               // first name + surname initial
  //   exam: "Goethe-Zertifikat",
  //   level: "B2",
  //   date: "09.2026",
  //   months: 8,                       // preparation time, or null to hide
  //   grade: "Gut",                    // optional
  //   scores: [["Lesen", 73, 100], ["Hören", 67, 100], ["Schreiben", 66, 100], ["Sprechen", 62, 100]],
  // },
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

  // Student reviews. level + months show as "C1 in 8 months" (months can be left out).
  // original: the language the student wrote in - the other languages get a "translated from" note.
  // If a language is missing, the Russian text (or the first one given) is shown.
  reviews: [
    {
      name: "Nastya K.",
      level: "C1",
      months: 8,
      original: "de",
      text: {
        de: "Ich wollte auch Ihnen für alles danken! Sie haben sehr viel Zeit und Mühe für mein Lernen ausgegeben, und eigentlich bin ich noch überrascht, dass ich nur 8 Monate gebraucht habe, um C1 zu bekommen. Ohne Ihre Arbeit wäre es ganz anders und deutlich schwieriger. Ich würde Ihnen immer wieder als den besten Deutschlehrer empfehlen.",
        ru: "Хочу поблагодарить вас за всё! Вы потратили очень много времени и сил на моё обучение, и я до сих пор удивляюсь, что мне понадобилось всего 8 месяцев, чтобы получить C1. Без вашей работы всё было бы совсем по-другому и намного сложнее. Я всегда буду рекомендовать вас как лучшего преподавателя немецкого.",
        uz: "Sizga hamma narsa uchun rahmat aytmoqchiman! O'qishim uchun juda ko'p vaqt va kuch sarfladingiz. Haligacha hayronman: C1 olishim uchun atigi 8 oy kerak bo'ldi. Sizning mehnatingizsiz hammasi butunlay boshqacha va ancha qiyin bo'lardi. Sizni har doim eng yaxshi nemis tili o'qituvchisi sifatida tavsiya qilaman.",
        en: "I also wanted to thank you for everything! You put so much time and effort into my learning, and honestly I'm still surprised it only took me 8 months to get C1. Without your work it would have been completely different and much harder. I would recommend you again and again as the best German teacher.",
      },
    },
  ],
};
