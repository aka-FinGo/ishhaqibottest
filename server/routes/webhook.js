// ============================================================
// ROUTES/WEBHOOK.JS — Telegram Bot Webhook Handler
// Mirrors handleTelegramUpdate_() and handleCallbackQuery_()
// from Code.gs
// ============================================================
'use strict';

const router = require('express').Router();
const cfg    = require('../config');
const { checkUserRoles }        = require('../auth');
const { db, addErrorLog, getEmployee } = require('../db');

// ── Telegram API helper ───────────────────────────────────────
async function tgCall(method, params) {
  if (!cfg.BOT_TOKEN) return { ok: false, description: 'BOT_TOKEN yo\'q' };
  try {
    const fetch = require('node-fetch');
    const url   = `https://api.telegram.org/bot${cfg.BOT_TOKEN}/${method}`;
    const res   = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params)
    });
    return res.json();
  } catch (e) {
    console.error(`[tgCall ${method}]`, e.message);
    return { ok: false, description: String(e.message) };
  }
}

// ── Main webhook route ────────────────────────────────────────
router.post('/', async (req, res) => {
  // Always respond 200 immediately so Telegram doesn't retry
  res.json({ ok: true });

  const update = req.body;
  if (!update) return;

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    const msg = update.message;
    if (!msg || !msg.from) return;

    const text = String(msg.text || '').trim();
    if (text.startsWith('/start')) {
      await handleStartCommand(msg);
    }
  } catch (err) {
    addErrorLog('webhook', '', JSON.stringify(update), err);
    console.error('[Webhook xatosi]', err);
  }
});

// ─────────────────────────────────────────────────────────────
// handleStartCommand
// Mirrors handleStartCommand_() from Code.gs
// ─────────────────────────────────────────────────────────────
async function handleStartCommand(message) {
  const from  = message.from || {};
  const tgId  = String(from.id || '').trim();
  if (!tgId) return;

  const auth = checkUserRoles(tgId);

  // If user is already registered / SuperAdmin, send greeting with WebApp button
  if (auth.isSuperAdmin || auth.inList) {
    const webApp = String(cfg.WEB_APP_URL || 'https://ish.cabix.website').trim();
    const buttons = [
      [{ text: '🚀 Aristokrat Ish Haqi & Kvadratlar', web_app: { url: webApp } }]
    ];
    await tgCall('sendMessage', {
      chat_id: tgId,
      text: `👋 Assalomu alaykum, <b>${auth.username || 'iRealBy_3D'}</b>!\n\n🏢 <b>Aristokrat Ish Haqi & Kvadratlar Boshqaruv Tizimiga xush kelibsiz!</b>\n\nIlovadan foydalanish uchun quyidagi tugmani bosing 👇`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  // Auto-register as PENDING if missing
  const firstName   = String(from.first_name || '');
  const lastName    = String(from.last_name  || '');
  const tgUsername  = String(from.username   || '');
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || tgUsername || `ID:${tgId}`;

  let created = false;
  try {
    const info = db.prepare(`
      INSERT OR IGNORE INTO employees
        (telegram_id, username, can_add, role)
      VALUES (?, ?, 0, 'PENDING')
    `).run(tgId, displayName);
    created = info.changes > 0;
  } catch (e) { /* ignore */ }

  const text = created
    ? "Assalomu alaykum!\nSiz yangi foydalanuvchi sifatida ro'yxatga qo'shildingiz.\nRuxsat olish uchun admin bilan bog'laning."
    : "Assalomu alaykum!\nSizning hisobingiz tasdiqlash jarayonida.\nRuxsat olish uchun admin bilan bog'laning.";

  const buttons = [];
  const webApp  = String(cfg.WEB_APP_URL || '').trim();
  if (webApp && !webApp.includes('YOUR.github.io')) {
    buttons.push([{ text: '📱 Web Appni ochish', web_app: { url: webApp } }]);
  }

  const adminId = String(cfg.SUPER_ADMIN_ID || '').trim();
  if (adminId && adminId !== 'YOUR_TG_ADMIN_CHAT_ID') {
    buttons.push([{ text: "📩 Admin bilan bog'lanish", url: `tg://user?id=${adminId}` }]);
  }

  const replyMarkup = buttons.length ? { inline_keyboard: buttons } : undefined;

  await tgCall('sendMessage', {
    chat_id:      tgId,
    text,
    reply_markup: replyMarkup
  });
}

// ─────────────────────────────────────────────────────────────
// handleCallbackQuery
// Mirrors handleCallbackQuery_() from Code.gs
// Handles conf_sal_<rowId> / rej_sal_<rowId> salary confirmation
// ─────────────────────────────────────────────────────────────
async function handleCallbackQuery(query) {
  const data      = query.data || '';
  const chatId    = query.message ? query.message.chat.id : query.from.id;
  const messageId = query.message ? query.message.message_id : null;
  const actorTgId = String(query.from.id);

  if (!data.startsWith('conf_sal_') && !data.startsWith('rej_sal_')) return;

  const isConfirm = data.startsWith('conf_sal_');
  const rowId     = parseInt(data.replace('conf_sal_', '').replace('rej_sal_', ''), 10);

  // Immediately clear buttons and answer
  await tgCall('answerCallbackQuery', {
    callback_query_id: query.id,
    text: isConfirm ? '✅ Tasdiqlandi!' : '❌ Rad etildi!',
    show_alert: false
  });
  if (chatId && messageId) {
    await tgCall('editMessageReplyMarkup', {
      chat_id:      chatId,
      message_id:   messageId,
      reply_markup: { inline_keyboard: [] }
    });
  }

  // Resolve actor
  const auth      = checkUserRoles(actorTgId);
  const actorName = auth.username
    || (query.from.first_name || query.from.username || `ID:${actorTgId}`);

  // Process record
  const rec = db.prepare('SELECT * FROM records WHERE id = ? AND is_deleted = 0').get(rowId);
  if (!rec) {
    await tgCall('answerCallbackQuery', {
      callback_query_id: query.id,
      text: '⚠️ Amal topilmadi!',
      show_alert: true
    });
    return;
  }

  const canAct = String(actorTgId) === String(rec.telegram_id)
    || auth.isBugalter
    || auth.isSuperAdmin;

  if (!canAct) {
    await tgCall('answerCallbackQuery', {
      callback_query_id: query.id,
      text: "⚠️ Sizda buni tasdiqlash uchun ruxsat yo'q!",
      show_alert: true
    });
    return;
  }

  // Already processed?
  if (rec.status === 'Tasdiqlandi' || rec.status === 'Rad etildi') {
    // Just edit message text to reflect final status
    await _editConfirmMessage(chatId, messageId, query.message, rec.status === 'Tasdiqlandi', actorName);
    return;
  }

  const newStatus = isConfirm ? 'Tasdiqlandi' : 'Rad etildi';
  db.prepare(`
    UPDATE records
    SET status = ?, actor_tg_id = ?, actor_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, actorTgId, actorName, rowId);

  await _editConfirmMessage(chatId, messageId, query.message, isConfirm, actorName);
}

async function _editConfirmMessage(chatId, messageId, originalMsg, isConfirm, actorName) {
  if (!chatId || !messageId) return;
  const statusLine = isConfirm
    ? `\n\n✅ <b>${actorName} tomonidan tasdiqlandi</b>`
    : `\n\n❌ <b>${actorName} tomonidan rad etildi</b>`;

  const baseText = (originalMsg && originalMsg.text)
    ? String(originalMsg.text)
        .replace(/\n⏳\s*<i>Holati:\s*Kutilmoqda\.\.\.<\/i>/gi, '')
        .replace(/\n⏳\s*Holati:\s*Kutilmoqda\.\.\./gi, '')
        .replace(/\n\n✅\s*<b>.*?<\/b>/gi, '')
        .replace(/\n\n❌\s*<b>.*?<\/b>/gi, '')
    : '';

  await tgCall('editMessageText', {
    chat_id:      chatId,
    message_id:   messageId,
    text:         (baseText + statusLine).trim(),
    parse_mode:   'HTML',
    reply_markup: { inline_keyboard: [] }
  });
}

module.exports = router;
