// ============================================================
// CONFIG.GS
// ============================================================
var CONFIG = {
  BOT_TOKEN:        "YOUR_BOT_TOKEN",      // @BotFather dan
  CHAT_ID:          "YOUR_TG_CHAT_ID",            // Xabarnomalar uchun
  SUPER_ADMIN_ID:   "YOUR_TG_ADMIN_CHAT_ID",             // Sizning Telegram ID
  SUPER_ADMIN_NAME: "SuperAdmin",            // Ko'rsatiladigan ism
  WEB_APP_URL:      "https://YOUR.github.io/ishhaqibottest/",
  REQUIRE_TELEGRAM_AUTH: true,  // Prod uchun true qiling
  AUTH_MAX_AGE_SEC: 86400,
  RATE_LIMIT_ENABLED: true,
  DEFAULT_INACTIVE_DAYS: 14, // Faol bo'lmagan userlar uchun kun
  REMINDER_TEXT: "⚠️ Eslatma!\nKompaniya kelajagi uchun olgan avans va oyliklaringizni botga o'z vaqtida yozib qo'yishingizni so'raymiz! Yordamingiz uchun rahmat! )",
  ERROR_ALERT_ENABLED: true,
  ERROR_ALERT_THRESHOLD: 3,
  ERROR_ALERT_WINDOW_SEC: 300
};

function sendJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}
