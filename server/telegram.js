// ============================================================
// server/telegram.js — Telegram Bot API (Node.js)
// Port of gsheetscode/Telegram.gs using node-fetch
// ============================================================

'use strict';

let _fetch;
try { _fetch = require('node-fetch'); } catch (e) { _fetch = global.fetch; }

let FormData;
try { FormData = require('form-data'); } catch (e) { FormData = null; }

function getConfig() {
  try { return require('../config'); } catch (e) {
    try { return require('./config'); } catch (e2) { return {}; }
  }
}

async function tgSendMessage(chatId, text, parseMode, replyMarkup) {
  const config = getConfig();
  const url = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendMessage';
  const payload = { chat_id: String(chatId || ''), text: String(text || '') };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    const res = await _fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (err) { console.error('[tgSendMessage]', err.message); return { ok: false, description: err.message }; }
}

async function sendNotifyToDirectors(msg) {
  const config = getConfig(); const sentTracks = [];
  try {
    const db = require('./db');
    if (db.getSetting('NOTIFY_DIRECTOR') !== '1') return sentTracks;
    const employees = db.getAllEmployees();
    for (const emp of employees) {
      const tgId = String(emp.tg_id || '').trim();
      if ((emp.is_direktor == 1) && tgId && tgId !== String(config.SUPER_ADMIN_ID || '')) {
        const res = await tgSendMessage(tgId, msg, 'HTML');
        if (res && res.result && res.result.message_id)
          sentTracks.push({ chatId: String(tgId), messageId: res.result.message_id, baseText: msg });
      }
    }
  } catch (e) { console.error('[sendNotifyToDirectors]', e.message); }
  return sentTracks;
}

function appendTrackedMessages(db, rowId, newTracks) {
  if (!rowId || !newTracks || !newTracks.length) return;
  try {
    const key = 'trk_sal_' + rowId;
    const existingJson = db.getCacheValue ? db.getCacheValue(key) : null;
    let list = [];
    if (existingJson) { try { list = JSON.parse(existingJson); } catch (e) {} }
    for (const item of newTracks) {
      const exists = list.some(l => String(l.chatId) === String(item.chatId) && l.messageId === item.messageId);
      if (!exists) list.push(item);
    }
    if (db.setCacheValue) db.setCacheValue(key, JSON.stringify(list), 21600);
  } catch (err) { console.error('[appendTrackedMessages]', err.message); }
}

async function sendTelegramNotification(data) {
  const config = getConfig(); const db = require('./db');
  const uzsText = Number(data.amountUZS) > 0 ? '\n\u{1F4B0} ' + Number(data.amountUZS).toLocaleString() + ' UZS' : '';
  const usdText = Number(data.amountUSD) > 0 ? '\n\u{1F4B5} $' + Number(data.amountUSD).toLocaleString() : '';
  const rateText = Number(data.amountUSD) > 0 && Number(data.rate) > 0 ? '\n\u{1F4C8} Kurs: ' + Number(data.rate).toLocaleString() + ' UZS' : '';
  const statusBadge = data.initialStatus === 'Kutilmoqda' ? '\n\u23F3 <i>Holati: Kutilmoqda...</i>' : '';
  const actorLine = (data.actorTgId && String(data.actorTgId) !== String(data.tgId) && data.actorName) ? '\n\u270D\uFE0F Kiritdi: ' + data.actorName + ' (Bugalter)' : '';
  const msg = '\u26A0\uFE0F <b>Yangi amal qo\u2019shildi</b>\n\u{1F464} Xodim: ' + (data.employeeName || '\u2014') + actorLine + uzsText + usdText + rateText + (data.actionPeriod ? '\n\u{1F4C5} Davr: ' + data.actionPeriod : '') + '\n\u{1F4DD} ' + (data.comment || '\u2014') + '\n\u{1F4C5} ' + (data.date || '\u2014') + statusBadge;
  const sentTrack = []; const rowId = data.rowId;
  const isSuperAdminGettingButton = (data.notifyTarget === 'bugalter') || (data.notifyTarget === 'employee' && String(config.CHAT_ID) === String(data.tgId));
  if (config.CHAT_ID && !isSuperAdminGettingButton) {
    const resAdmin = await tgSendMessage(config.CHAT_ID, msg, 'HTML');
    if (resAdmin && resAdmin.result && resAdmin.result.message_id)
      sentTrack.push({ chatId: String(config.CHAT_ID), messageId: resAdmin.result.message_id, baseText: msg });
  }
  const dirTracks = await sendNotifyToDirectors(msg);
  if (dirTracks.length > 0) sentTrack.push(...dirTracks);
  if (rowId && sentTrack.length > 0) appendTrackedMessages(db, rowId, sentTrack);
}

async function sendApprovalRequest(data) {
  const db = require('./db');
  const { tgId, rowId, employeeName, amountUZS, amountUSD, rate, comment, dateStr, actionPeriod, actorName } = data;
  const uzsText = Number(amountUZS) > 0 ? '\n\u{1F4B0} ' + Number(amountUZS).toLocaleString() + ' UZS' : '';
  const usdText = Number(amountUSD) > 0 ? '\n\u{1F4B5} $' + Number(amountUSD).toLocaleString() : '';
  const rateText = Number(amountUSD) > 0 && Number(rate) > 0 ? '\n\u{1F4C8} Kurs: ' + Number(rate).toLocaleString() + ' UZS' : '';
  const periodText = actionPeriod ? '\n\u{1F4C5} Davr: ' + actionPeriod : '';
  const whoEntered = actorName ? 'Bugalter (' + actorName + ')' : 'Bugalter';
  const msg = '\u26A0\uFE0F <b>Sizning hisobingizga ' + whoEntered + ' quyidagi amalni kiritdi. Iltimos, tasdiqlang yoki rad eting:</b>\n\u{1F464} Xodim: ' + (employeeName || '\u2014') + uzsText + usdText + rateText + periodText + '\n\u{1F4DD} ' + (comment || '\u2014') + '\n\u{1F4C5} ' + (dateStr || '\u2014');
  const replyMarkup = { inline_keyboard: [[{ text: '\u2705 Tasdiqlash', callback_data: 'conf_sal_' + rowId }, { text: '\u274C Rad etish', callback_data: 'rej_sal_' + rowId }]] };
  const res = await tgSendMessage(tgId, msg, 'HTML', replyMarkup);
  if (res && res.result && res.result.message_id)
    appendTrackedMessages(db, rowId, [{ chatId: String(tgId), messageId: res.result.message_id, baseText: msg }]);
  return res;
}

async function sendApprovalToBugalters(data) {
  const config = getConfig(); const db = require('./db');
  const { rowId, empName, uzs, usd, rate, comment, dateStr, actionPeriod } = data;
  const uzsText = Number(uzs) > 0 ? '\n\u{1F4B0} ' + Number(uzs).toLocaleString() + ' UZS' : '';
  const usdText = Number(usd) > 0 ? '\n\u{1F4B5} $' + Number(usd).toLocaleString() : '';
  const rateText = Number(usd) > 0 && Number(rate) > 0 ? '\n\u{1F4C8} Kurs: ' + Number(rate).toLocaleString() + ' UZS' : '';
  const periodText = actionPeriod ? '\n\u{1F4C5} Davr: ' + actionPeriod : '';
  const msg = '\u26A0\uFE0F <b>Xodim tomonidan kiritilgan amal tasdiqlash uchun</b>\nQuyidagi amal kiritildi. Iltimos, tasdiqlang yoki rad eting:\n\u{1F464} ' + (empName || '\u2014') + uzsText + usdText + rateText + periodText + '\n\u{1F4DD} ' + (comment || '\u2014') + '\n\u{1F4C5} ' + (dateStr || '\u2014');
  const replyMarkup = { inline_keyboard: [[{ text: '\u2705 Tasdiqlash', callback_data: 'conf_sal_' + rowId }, { text: '\u274C Rad etish', callback_data: 'rej_sal_' + rowId }]] };
  const sentTrack = [];
  const employees = db.getAllEmployees ? db.getAllEmployees() : [];
  for (const emp of employees) {
    const isBugalter = (emp.role || '').toUpperCase() === 'BUGALTER' || emp.is_bugalter == 1;
    const tgId = String(emp.tg_id || '').trim();
    if (isBugalter && tgId && tgId !== String(config.SUPER_ADMIN_ID || '')) {
      const res = await tgSendMessage(tgId, msg, 'HTML', replyMarkup);
      if (res && res.result && res.result.message_id)
        sentTrack.push({ chatId: String(tgId), messageId: res.result.message_id, baseText: msg });
    }
  }
  if (config.SUPER_ADMIN_ID) {
    const resAdmin = await tgSendMessage(config.SUPER_ADMIN_ID, msg, 'HTML', replyMarkup);
    if (resAdmin && resAdmin.result && resAdmin.result.message_id)
      sentTrack.push({ chatId: String(config.SUPER_ADMIN_ID), messageId: resAdmin.result.message_id, baseText: msg });
  }
  if (sentTrack.length > 0) appendTrackedMessages(db, rowId, sentTrack);
}

async function sendExcelToUser(tgId, buffer, fileName) {
  const config = getConfig();
  const url = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendDocument';
  try {
    if (FormData) {
      const form = new FormData();
      form.append('chat_id', String(tgId));
      form.append('caption', '\u{1F4CA} ' + fileName);
      form.append('document', buffer, { filename: fileName, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const res = await _fetch(url, { method: 'POST', body: form, headers: form.getHeaders ? form.getHeaders() : {} });
      return await res.json();
    }
    return { ok: false, description: 'form-data module not available' };
  } catch (err) { console.error('[sendExcelToUser]', err.message); return { ok: false, description: err.message }; }
}

async function answerCallbackQuery(callbackQueryId, text, showAlert) {
  const config = getConfig();
  const url = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/answerCallbackQuery';
  const payload = { callback_query_id: String(callbackQueryId), text: String(text || ''), show_alert: !!showAlert };
  try {
    const res = await _fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (err) { return { ok: false, description: err.message }; }
}

async function editMessageText(chatId, messageId, text, parseMode, replyMarkup) {
  const config = getConfig();
  const url = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/editMessageText';
  const payload = { chat_id: String(chatId), message_id: messageId, text: String(text) };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    const res = await _fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let body = await res.json();
    if (!body.ok && parseMode) {
      delete payload.parse_mode; payload.text = String(text).replace(/<[^>]*>/g, '');
      const res2 = await _fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      body = await res2.json();
    }
    return body;
  } catch (err) { return { ok: false, description: err.message }; }
}

async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  const config = getConfig();
  const url = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/editMessageReplyMarkup';
  const payload = { chat_id: String(chatId), message_id: messageId, reply_markup: replyMarkup || { inline_keyboard: [] } };
  try {
    const res = await _fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (err) { return { ok: false, description: err.message }; }
}

async function sendSystemAlert(message) {
  const config = getConfig();
  if (!config || !config.CHAT_ID) return { ok: false, description: 'CHAT_ID topilmadi' };
  return tgSendMessage(config.CHAT_ID, String(message || ''), null);
}

async function sendSalaryReminderToUser(tgId, username, customText) {
  if (!tgId) return { ok: false, description: 'tgId topilmadi' };
  const db = require('./db');
  const base = customText || db.getSetting('REMINDER_TEXT') || "⚠️ Eslatma!\nKompaniya kelajagi uchun olgan avans va oyliklaringizni botga o'z vaqtida yozib qo'ying. Rahmat.";
  const who = username ? '👤 ' + username + '\n' : '';
  return tgSendMessage(tgId, who + base, null);
}

async function sendAvansRequestNotification(username, amount, reason) {
  const config = getConfig(); const db = require('./db');
  const msg = '💸 <b>Yangi avans so\'rovi!</b>\n👤 Xodim: ' + (username || '—') + '\n💰 Summa: ' + Number(amount).toLocaleString() + ' UZS\n📝 Sabab: ' + (reason || 'Kiritilmagan');
  if (config.CHAT_ID) await tgSendMessage(config.CHAT_ID, msg, 'HTML');
  try {
    const employees = db.getAllEmployees ? db.getAllEmployees() : [];
    for (const emp of employees) {
      const tgId = String(emp.tg_id || '').trim();
      if ((emp.role || '').toUpperCase() === 'BUGALTER' && tgId && tgId !== String(config.SUPER_ADMIN_ID || ''))
        await tgSendMessage(tgId, msg, 'HTML');
    }
  } catch (e) { console.error('[sendAvansRequestNotification]', e.message); }
}

module.exports = { tgSendMessage, sendTelegramNotification, sendApprovalRequest, sendApprovalToBugalters, sendExcelToUser, answerCallbackQuery, editMessageText, editMessageReplyMarkup, sendSystemAlert, sendSalaryReminderToUser, sendAvansRequestNotification, appendTrackedMessages };
