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
    { id: "privatgruppe", eur: 150, minutes: 90, perWeek: 3, lessons: 12, size: [3, 6] },
    { id: "privat", eur: 250, minutes: 60, perWeek: 3, lessons: 12, size: [1, 1] },
  ],

  // Student results - add only with the student's permission.
  // A score can have a 4th value: the text to show instead of "got/max" (used for TestDaF levels).
  results: [
    {
      name: "Dinara A.",
      exam: "TestDaF",
      level: "C1",
      months: null,
      scores: [["Lesen", 4, 5, "TDN 4"], ["Hören", 4, 5, "TDN 4"], ["Schreiben", 4, 5, "TDN 4"], ["Sprechen", 4, 5, "TDN 4"]],
    },
    {
      name: "Parisa M.",
      exam: "Goethe-Zertifikat",
      level: "B2",
      months: null,
      scores: [["Lesen", 83, 100], ["Hören", 70, 100], ["Schreiben", 63, 100], ["Sprechen", 87, 100]],
      extra: "+ TestDaF: Sprechen TDN 5",
    },
    {
      name: "Narmina Y.",
      exam: "telc Deutsch",
      level: "B2",
      months: 4.5,
      grade: "Gut",
      scores: [["Schriftlich", 179, 225], ["Mündlich", 64, 75], ["Summe", 243, 300]],
    },
    {
      name: "Saidabrorkhon S.",
      exam: "Goethe-Zertifikat",
      level: "B1",
      months: 3,
      scores: [["Lesen", 70, 100], ["Hören", 80, 100], ["Schreiben", 85, 100], ["Sprechen", 83, 100]],
    },
    {
      name: "Kholniso K.",
      exam: "Goethe-Zertifikat",
      level: "A1",
      months: null,
      grade: "Gut",
      scores: [["Hören", 14.94, 25], ["Lesen", 24.9, 25], ["Schreiben", 24.9, 25], ["Sprechen", 21.58, 25], ["Gesamt", 86, 100]],
    },
  ],

  // Countries our students come from (names are in i18n/common.js as country.<code>).
  countries: ["uz", "ua", "kz", "tr", "ps", "lb", "ru", "ng"],

  // Results of students from outside Uzbekistan (same format as results). Shown on /international/.
  intlResults: [
    {
      name: "Maksym R.",
      exam: "DTZ (Deutsch-Test für Zuwanderer)",
      level: "B1",
      months: null,
      scores: [["Hören und Lesen", 35, 45], ["Schreiben", 16, 20], ["Sprechen", 95, 100]],
    },
  ],

  // Student reviews. level + months show as "C1 in 8 months" (months can be left out);
  // country (a code from the list above) is shown after it.
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
    {
      name: "Omar A.",
      level: "B2",
      months: 3,
      country: "lb",
      original: "de",
      text: {
        de: "Seit vielen Jahren lerne ich Deutsch, um meine Träume zu verwirklichen: das B2-Zertifikat zu bestehen und in Deutschland zu arbeiten. Zuvor hatte ich die Prüfung bereits dreimal abgelegt und war leider jedes Mal durchgefallen. Beim letzten Mal war ich so demotiviert, dass ich sogar ans Aufgeben dachte. Es ist wirklich ein Wunder, dass ich Sie gefunden habe! Durch Ihre Motivation habe ich neue Hoffnung geschöpft. Nach drei Monaten intensiven und anspruchsvollen Lernens habe ich die telc-B2-Prüfung schließlich bestanden. Jetzt kann ich endlich sagen: Meinen Traumlehrer habe ich bereits gefunden – jetzt muss ich nur noch meinen Traumjob finden!",
        ru: "Уже много лет я учу немецкий, чтобы осуществить свои мечты: сдать экзамен B2 и работать в Германии. До этого я уже три раза сдавал экзамен и, к сожалению, каждый раз проваливался. В последний раз я был настолько демотивирован, что даже думал всё бросить. Это настоящее чудо, что я нашёл вас! Благодаря вашей мотивации у меня появилась новая надежда. После трёх месяцев интенсивной и непростой учёбы я наконец сдал экзамен telc B2. Теперь я наконец могу сказать: учителя своей мечты я уже нашёл — осталось только найти работу мечты!",
        uz: "Ko'p yillardan beri orzularimni ro'yobga chiqarish uchun nemis tilini o'rganib kelaman: B2 sertifikatini olish va Germaniyada ishlash. Bundan oldin imtihonni uch marta topshirgan edim, ammo afsuski, har safar o'ta olmadim. Oxirgi safar ruhim shunchalik tushib ketgan ediki, hatto taslim bo'lishni ham o'yladim. Sizni topganim haqiqatan ham mo'jiza! Sizning motivatsiyangiz menga yangi umid bag'ishladi. Uch oylik jadal va mashaqqatli o'qishdan so'ng nihoyat telc B2 imtihonidan o'tdim. Endi nihoyat ayta olaman: orzuimdagi o'qituvchini allaqachon topdim – endi faqat orzuimdagi ishni topishim qoldi!",
        en: "For many years I have been learning German to make my dreams come true: to pass the B2 exam and to work in Germany. Before that, I had already taken the exam three times and, unfortunately, failed every time. The last time I was so demotivated that I even thought about giving up. It really is a miracle that I found you! Your motivation gave me new hope. After three months of intensive and demanding study, I finally passed the telc B2 exam. Now I can finally say: I have already found my dream teacher – now I only need to find my dream job!",
      },
    },
    {
      name: "Maksym R.",
      level: "B1",
      country: "ua",
      original: "ru",
      text: {
        ru: "Благодарю Вас от всей души за Ваш труд, терпение и поддержку! Благодаря Вашим занятиям я сдал экзамен на уровень B1 и стал гораздо увереннее чувствовать себя в немецком языке. Очень ценю Ваш профессионализм и ту доброжелательную атмосферу, которую Вы создавали на каждом уроке.",
        de: "Ich danke Ihnen von ganzem Herzen für Ihre Arbeit, Ihre Geduld und Ihre Unterstützung! Dank Ihres Unterrichts habe ich die B1-Prüfung bestanden und fühle mich im Deutschen viel sicherer. Ich schätze Ihre Professionalität und die freundliche Atmosphäre, die Sie in jeder Stunde geschaffen haben, sehr.",
        uz: "Mehnatingiz, sabr-toqatingiz va qo'llab-quvvatlaganingiz uchun sizga chin yurakdan minnatdorman! Darslaringiz tufayli B1 imtihonini topshirdim va nemis tilida o'zimni ancha ishonchli his qila boshladim. Professionalligingizni va har bir darsda yaratgan samimiy muhitingizni juda qadrlayman.",
        en: "Thank you from the bottom of my heart for your work, patience and support! Thanks to your lessons I passed the B1 exam and now feel much more confident in German. I really appreciate your professionalism and the friendly atmosphere you created in every lesson.",
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
    { topic: "ausbildung", guest: "Fabian", guestNote: "C2" },
    { topic: "aupair", guest: "Dinara", guestNote: "C1" },
    { topic: "ferienjob", guest: "Kamol" },
    { topic: "studentlife", guest: "Fabian" },
  ],
};
