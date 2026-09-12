// ============================================================
// GSHEETS_SYNC.JS — Background Synchronization with Google Sheets
// Whenever a write action succeeds in SQLite, this module
// pushes the change to Google Apps Script asynchronously
// to keep the Google Spreadsheet updated as a live mirror/backup.
// ============================================================
'use strict';

const crypto = require('crypto');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const BOT_TOKEN = (process.env.BOT_TOKEN && process.env.BOT_TOKEN !== 'YOUR_BOT_TOKEN')
  ? process.env.BOT_TOKEN
  : '8355215374:AAENva7vRDUX7qQ9793wAHjzw-uHnxePVyk';
const SUPER_ADMIN_ID = (process.env.SUPER_ADMIN_ID && process.env.SUPER_ADMIN_ID !== 'YOUR_TG_ADMIN_CHAT_ID')
  ? process.env.SUPER_ADMIN_ID
  : '2112012311';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwwCfiCjL6Nvi3uXw6gfLkrXJrV30SS7YKoeQbnzJj0wXieWjTHrcn9vtPBtvonFQa4RA/exec';

function generateInitData(botToken, tgId) {
  const user = JSON.stringify({ id: Number(tgId), first_name: 'iRealBy_3D' });
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: 'AAGHsync',
    user: user
  };

  const keys = Object.keys(params).sort();
  const checkString = keys.map(k => k + '=' + params[k]).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  return keys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&') + '&hash=' + hash;
}

/**
 * Sends a background sync payload to Google Apps Script.
 * Non-blocking: will never crash or delay the main SQLite request.
 */
function syncToGoogleSheets(action, payload = {}) {
  // If disabled via env, do nothing
  if (process.env.SYNC_GSHEETS_ENABLED === 'false') return;

  setImmediate(async () => {
    try {
      const initData = generateInitData(BOT_TOKEN, SUPER_ADMIN_ID);
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          telegramId: String(SUPER_ADMIN_ID),
          initData: initData,
          ...payload
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        console.warn(`[GSHEETS SYNC OGOHLANTIRISH] Action: ${action}, Xato: ${json.error || 'Noma\'lum'}`);
      } else {
        // Successfully synced
      }
    } catch (err) {
      console.warn(`[GSHEETS SYNC XATOSI] Action: ${action}, Sabab: ${err.message}`);
    }
  });
}

module.exports = {
  syncToGoogleSheets
};
