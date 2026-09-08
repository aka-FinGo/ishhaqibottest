// ============================================================
// CONFIG.JS — Server-side configuration
// Reads from .env via dotenv
// ============================================================
require('dotenv').config();

module.exports = {
  BOT_TOKEN:            process.env.BOT_TOKEN            || '',
  CHAT_ID:              process.env.CHAT_ID              || '',
  SUPER_ADMIN_ID:       process.env.SUPER_ADMIN_ID       || '',
  SUPER_ADMIN_NAME:     process.env.SUPER_ADMIN_NAME     || 'SuperAdmin',
  WEB_APP_URL:          process.env.WEB_APP_URL          || '',
  REQUIRE_TELEGRAM_AUTH: process.env.REQUIRE_TELEGRAM_AUTH !== 'false',
  AUTH_MAX_AGE_SEC:     parseInt(process.env.AUTH_MAX_AGE_SEC  || '86400',  10),
  RATE_LIMIT_ENABLED:   process.env.RATE_LIMIT_ENABLED   !== 'false',
  RATE_LIMIT_MAX:       parseInt(process.env.RATE_LIMIT_MAX    || '60',     10),
  RATE_LIMIT_WINDOW_SEC: parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '60', 10),
  ERROR_ALERT_ENABLED:  process.env.ERROR_ALERT_ENABLED  !== 'false',
  ERROR_ALERT_THRESHOLD: parseInt(process.env.ERROR_ALERT_THRESHOLD || '3', 10),
  ERROR_ALERT_WINDOW_SEC: parseInt(process.env.ERROR_ALERT_WINDOW_SEC || '300', 10),
  PORT:                 parseInt(process.env.PORT         || '3010',  10)
};
