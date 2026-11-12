// DEUS Lernen - where the app finds its API and the bot.
// `api` is the stack's WebsiteApiUrl output + "app/" (see the bot repo's README, "Mini App").
// On localhost the app talks to scripts/miniapp_dev.py instead and ignores `api`.
window.DEUS_APP = {
  api: "https://mw2c5sew2c.execute-api.ap-south-1.amazonaws.com/Prod/app/",
  bot: "attemptobot",
  channel: "deutschesbuch",
  teacher: "azuziz",  // "I'm already a student" opens a chat with this account
  site: "https://deus-school.com",
};
