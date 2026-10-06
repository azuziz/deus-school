// Everything you might want to edit lives here: links, student results, reviews.
// Texts for the rest of the page are in i18n.js.
// A section with an empty list is hidden (together with its menu link).

window.DEUS = {
  links: {
    bot: "https://t.me/attemptobot?start=site",
    channel: "https://t.me/deutschesbuch",
    teacher: "https://t.me/azuziz",
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
  results: [],

  // Student reviews. Example:
  // { name: "Narmina Y.", level: "A2 → B2", text: { ru: "...", uz: "...", en: "..." } },
  // If a review exists in one language only, the other languages show the Russian text (or the first one given).
  reviews: [],
};
