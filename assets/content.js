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
  // months = preparation time; country (a code from the list below) is shown after the name;
  // next = a later exam/level, shown as "+ exam: level after n months" (months counted from the start).
  results: [
    {
      name: "Dinara A.",
      exam: "TestDaF",
      level: "C1",
      months: 6,
      scores: [["Lesen", 4, 5, "TDN 4"], ["Hören", 4, 5, "TDN 4"], ["Schreiben", 4, 5, "TDN 4"], ["Sprechen", 4, 5, "TDN 4"]],
    },
    {
      name: "Parisa M.",
      exam: "Goethe-Zertifikat",
      level: "B2",
      months: 4,
      scores: [["Lesen", 83, 100], ["Hören", 70, 100], ["Schreiben", 63, 100], ["Sprechen", 87, 100]],
      next: { exam: "TestDaF Sprechen TDN 5", level: "C1", months: 7 },
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
      months: 2,
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
      months: 4,
      country: "ua",
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
      name: "Dariya K.",
      level: "C1",
      months: 5,
      original: "ru",
      text: {
        ru: "Меня зовут Дария, мне 18 лет. Сейчас я учусь в Studienkolleg Sachsen в Лейпциге, на первом семестре M-Kurs.\nЯ занималась в школе DEUS всего пять месяцев. Казалось бы, это совсем небольшой срок, но даже сейчас я понимаю, насколько большая работа была проделана за это время.\nЗа эти пять месяцев я стала гораздо увереннее в своём немецком, хотя изучала его уже довольно давно. Вместе с преподавателем мы также смогли значительно улучшить мои навыки в разных модулях экзамена Goethe-Zertifikat. В итоге я сдала все модули на оценки gut и sehr gut. Для меня это стало настоящим достижением! Например, сдать модуль говорения на 94 балла раньше казалось мне чем-то недосягаемым!\nНемецкий язык никогда не был моим любимым предметом, и долгое время он давался мне нелегко. Однако благодаря занятиям я наконец-то получила необходимую мотивацию, смогла улучшить свои знания и обрести уверенность в собственных силах.\nНаверное, это был первый раз, когда я по-настоящему почувствовала себя погружённой в немецкий язык. На занятиях всегда было много заданий, связанных с говорением. Я считаю, что умение выражать свои мысли и обсуждать самые разные темы — одна из важнейших составляющих изучения языка. Ведь недостаточно просто знать грамматику и слова — нужно ещё уметь свободно ими пользоваться.\nОсобенно мне нравилось, что занятия были очень насыщенными и разнообразными, поэтому время пролетало незаметно. Мы работали с разными текстами, изучали новую лексику и выполняли домашние задания, которые помогали расширять словарный запас и делать мою речь более живой и естественной.\nКроме того, бывали моменты, когда у меня пропадала мотивация и хотелось всё бросить. В такие периоды поддержка преподавателя играла огромную роль. Я считаю, что особенно ценно, когда человек способен не только обучать, но и поддерживать, помогать преодолевать трудности и верить в себя даже тогда, когда самому этого делать уже не хочется.\nБлагодаря школе DEUS я также познакомилась с другой девушкой, с которой у нас, как оказалось, много общих интересов. Такие знакомства — ещё один приятный бонус в изучении языка, ведь всегда здорово встретить человека, с которым можно не только найти общий язык в прямом смысле, но и практиковать немецкий вне занятий.\nПоначалу я очень сомневалась, стоит ли начинать обучение, поскольку стоимость занятий казалась мне довольно высокой. Но теперь, оглядываясь назад, я могу уверенно сказать: если бы мне пришлось пройти этот путь заново, я бы снова выбрала школу DEUS!\nДля меня это был не просто опыт изучения немецкого языка. Это была возможность преодолеть собственные страхи, стать увереннее в своей речи и увидеть реальные результаты своего труда. За пять месяцев я почувствовала не только то, как быстро пролетело время, но и то, насколько сильно я смогла продвинуться вперёд.\nЯ искренне благодарна за этот опыт и за то, что за такой короткий срок смогла добиться результатов, которые раньше казались мне недостижимыми.",
        en: "My name is Dariya and I'm 18. I'm now studying at the Studienkolleg Sachsen in Leipzig, in the first semester of the M-Kurs.\nI studied at DEUS for only five months. That may seem like a very short time, but even now I realise how much work was done in those months.\nIn these five months I became much more confident in my German, even though I had been learning it for quite a while. Together with my teacher, I also improved my skills in the different modules of the Goethe-Zertifikat a lot. In the end I passed every module with \"gut\" or \"sehr gut\". For me that was a real achievement! Scoring 94 points in the speaking module, for example, used to seem completely out of reach.\nGerman was never my favourite subject, and for a long time it didn't come easily to me. But thanks to the lessons I finally found the motivation I needed, improved my knowledge and gained confidence in my own abilities.\nIt was probably the first time I truly felt immersed in German. There were always lots of speaking tasks in class. I believe that being able to express your thoughts and discuss all kinds of topics is one of the most important parts of learning a language. After all, it's not enough to know the grammar and the words — you also have to be able to use them freely.\nI especially liked that the lessons were so full and varied that time just flew by. We worked with different texts, learned new vocabulary and did homework that helped me expand my vocabulary and make my speech livelier and more natural.\nThere were also moments when I lost my motivation and wanted to give up. At those times my teacher's support made a huge difference. I think it is especially valuable when someone can not only teach, but also support you, help you get through difficulties and believe in yourself even when you no longer feel like it.\nThrough DEUS I also met another girl who, as it turned out, shares many of my interests. Friendships like this are another nice bonus of learning a language: it's always great to meet someone you literally share a language with and can practise German with outside class.\nAt first I had serious doubts about starting, because the lessons seemed quite expensive to me. But looking back now, I can say with confidence: if I had to go this way again, I would choose DEUS again!\nFor me it was more than just learning German. It was a chance to overcome my own fears, become more confident when I speak and see real results of my work. In five months I felt not only how quickly the time flew, but also how far I had come.\nI am sincerely grateful for this experience and for being able to achieve, in such a short time, results that once seemed out of reach.",
        de: "Ich heiße Dariya und bin 18 Jahre alt. Zurzeit besuche ich das Studienkolleg Sachsen in Leipzig, im ersten Semester des M-Kurses.\nIch habe nur fünf Monate bei DEUS gelernt. Das scheint eine sehr kurze Zeit zu sein, aber schon jetzt merke ich, wie viel Arbeit in diesen Monaten geleistet wurde.\nIn diesen fünf Monaten bin ich in meinem Deutsch viel sicherer geworden, obwohl ich es schon ziemlich lange gelernt hatte. Zusammen mit meinem Lehrer konnte ich außerdem meine Fähigkeiten in den verschiedenen Modulen des Goethe-Zertifikats deutlich verbessern. Am Ende habe ich alle Module mit „gut“ und „sehr gut“ bestanden. Für mich war das ein echter Erfolg! 94 Punkte im Modul Sprechen zum Beispiel schienen mir früher unerreichbar.\nDeutsch war nie mein Lieblingsfach, und lange fiel es mir nicht leicht. Doch dank des Unterrichts habe ich endlich die nötige Motivation gefunden, mein Wissen verbessert und Vertrauen in meine eigenen Fähigkeiten gewonnen.\nWahrscheinlich war es das erste Mal, dass ich wirklich in die deutsche Sprache eingetaucht bin. Im Unterricht gab es immer viele Sprechaufgaben. Ich finde, die Fähigkeit, seine Gedanken auszudrücken und über die unterschiedlichsten Themen zu diskutieren, gehört zu den wichtigsten Bestandteilen des Sprachenlernens. Denn es reicht nicht, nur Grammatik und Wörter zu kennen – man muss sie auch frei anwenden können.\nBesonders gefiel mir, dass der Unterricht sehr intensiv und abwechslungsreich war, sodass die Zeit wie im Flug verging. Wir haben mit verschiedenen Texten gearbeitet, neuen Wortschatz gelernt und Hausaufgaben gemacht, die mir halfen, meinen Wortschatz zu erweitern und lebendiger und natürlicher zu sprechen.\nAußerdem gab es Momente, in denen mir die Motivation fehlte und ich am liebsten alles hingeworfen hätte. In solchen Phasen spielte die Unterstützung meines Lehrers eine riesige Rolle. Ich finde es besonders wertvoll, wenn jemand nicht nur unterrichten, sondern auch unterstützen kann, einem hilft, Schwierigkeiten zu überwinden, und an sich selbst zu glauben, auch wenn man selbst keine Lust mehr dazu hat.\nDurch DEUS habe ich außerdem ein anderes Mädchen kennengelernt, mit dem ich, wie sich herausstellte, viele gemeinsame Interessen habe. Solche Bekanntschaften sind ein weiterer schöner Bonus beim Sprachenlernen, denn es ist immer toll, jemanden zu treffen, mit dem man im wahrsten Sinne des Wortes eine gemeinsame Sprache findet und auch außerhalb des Unterrichts Deutsch üben kann.\nAnfangs hatte ich große Zweifel, ob ich anfangen sollte, weil mir der Unterricht ziemlich teuer vorkam. Aber wenn ich jetzt zurückblicke, kann ich mit Sicherheit sagen: Wenn ich diesen Weg noch einmal gehen müsste, würde ich wieder DEUS wählen!\nFür mich war das nicht einfach nur Deutschlernen. Es war die Chance, meine eigenen Ängste zu überwinden, sicherer zu sprechen und echte Ergebnisse meiner Arbeit zu sehen. In fünf Monaten habe ich nicht nur gespürt, wie schnell die Zeit vergangen ist, sondern auch, wie weit ich vorangekommen bin.\nIch bin aufrichtig dankbar für diese Erfahrung und dafür, dass ich in so kurzer Zeit Ergebnisse erreichen konnte, die mir früher unerreichbar schienen.",
        uz: "Mening ismim Dariya, 18 yoshdaman. Hozir Leyptsigdagi Studienkolleg Sachsen'da, M-Kursning birinchi semestrida o'qiyman.\nDEUS maktabida atigi besh oy o'qidim. Bu juda qisqa muddatdek tuyuladi, lekin hozirning o'zidayoq shu vaqt ichida qanchalik katta ish qilinganini tushunaman.\nShu besh oy ichida nemis tilida o'zimni ancha ishonchli his qila boshladim, garchi uni ancha vaqtdan beri o'rganib kelgan bo'lsam ham. O'qituvchim bilan birga Goethe-Zertifikat imtihonining turli modullaridagi ko'nikmalarimni ham sezilarli darajada yaxshiladik. Natijada barcha modullarni «gut» va «sehr gut» baholari bilan topshirdim. Men uchun bu haqiqiy yutuq bo'ldi! Masalan, gapirish modulidan 94 ball olish ilgari menga erishib bo'lmaydigandek tuyulardi.\nNemis tili hech qachon sevimli fanim bo'lmagan va uzoq vaqt menga oson berilmagan. Ammo darslar tufayli nihoyat kerakli motivatsiyani topdim, bilimlarimni oshirdim va o'z kuchimga ishonch hosil qildim.\nEhtimol, nemis tiliga chinakamiga sho'ng'iganimni birinchi marta aynan shunda his qildim. Darslarda doim gapirishga oid ko'plab topshiriqlar bo'lardi. Menimcha, o'z fikrini ifoda eta olish va turli mavzularni muhokama qilish til o'rganishning eng muhim qismlaridan biri. Axir faqat grammatika va so'zlarni bilish yetarli emas — ulardan erkin foydalana olish ham kerak.\nAyniqsa, darslarning juda boy va xilma-xil bo'lgani menga yoqardi, shuning uchun vaqt bilinmay o'tib ketardi. Turli matnlar ustida ishladik, yangi so'zlarni o'rgandik va lug'at boyligimni oshirishga, nutqimni yanada jonli va tabiiy qilishga yordam bergan uy vazifalarini bajardik.\nBundan tashqari, motivatsiyam yo'qolib, hammasini tashlab ketgim kelgan paytlar ham bo'ldi. Bunday paytlarda o'qituvchimning qo'llab-quvvatlashi juda katta rol o'ynadi. Menimcha, inson nafaqat o'qita olsa, balki qo'llab-quvvatlay olsa, qiyinchiliklarni yengishga va hatto o'zingda xohish qolmagan paytda ham o'zingga ishonishga yordam bera olsa, bu ayniqsa qadrli.\nDEUS maktabi orqali yana bir qiz bilan tanishdim, ma'lum bo'lishicha, qiziqishlarimiz ko'p jihatdan mos ekan. Bunday tanishuvlar til o'rganishdagi yana bir yoqimli bonus, chunki so'zning to'g'ri ma'nosida umumiy til topa oladigan va darsdan tashqarida ham nemis tilini mashq qilish mumkin bo'lgan inson bilan tanishish doim ajoyib.\nAvvaliga o'qishni boshlash kerakmi-yo'qmi, deb juda ikkilandim, chunki darslar narxi menga ancha qimmatdek tuyulgandi. Ammo hozir ortga qarab, ishonch bilan ayta olaman: agar bu yo'lni qaytadan bosib o'tishim kerak bo'lsa, yana DEUS maktabini tanlagan bo'lardim!\nMen uchun bu shunchaki nemis tilini o'rganish tajribasi emas edi. Bu o'z qo'rquvlarimni yengish, nutqimda ishonchliroq bo'lish va mehnatimning haqiqiy natijalarini ko'rish imkoniyati bo'ldi. Besh oy ichida nafaqat vaqt qanchalik tez o'tganini, balki qanchalik oldinga siljiganimni ham his qildim.\nBu tajriba uchun va shunday qisqa vaqt ichida ilgari erishib bo'lmasdek tuyulgan natijalarga erisha olganim uchun chin dildan minnatdorman.",
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
      months: 4,
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
