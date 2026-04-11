// ============================================================
// TELEGRAM.GS — Telegram Bot API
// ============================================================

function tgSendMessage_(chatId, text, parseMode, replyMarkup) {
  var url = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/sendMessage";
  var payload = {
    chat_id: String(chatId || ''),
    text: String(text || '')
  };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  var options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  var resp = UrlFetchApp.fetch(url, options);
  var body = {};
  try { body = JSON.parse(resp.getContentText()); } catch (e) {}
  return body;
}

// Yangi amal qo'shilganda xabarnoma yuborish
function sendTelegramNotification(data) {
  var uzsText = Number(data.amountUZS) > 0 ? "\n💰 " + Number(data.amountUZS).toLocaleString() + " UZS" : "";
  var usdText = Number(data.amountUSD) > 0 ? "\n💵 $" + Number(data.amountUSD).toLocaleString() : "";
  var rateText= Number(data.amountUSD) > 0 && Number(data.rate) > 0
                ? "\n📈 Kurs: " + Number(data.rate).toLocaleString() + " UZS" : "";

  var msg = "✅ <b>Yangi amal qo'shildi</b>\n" +
            "👤 " + (data.employeeName || "—") +
            uzsText + usdText + rateText +
            "\n📝 " + (data.comment || "—") +
            "\n📅 " + (data.date    || "—");

  tgSendMessage_(CONFIG.CHAT_ID, msg, "HTML");
}

function getDefaultReminderTemplate_() {
  var base = String((CONFIG && CONFIG.REMINDER_TEXT) || '').trim();
  if (base) return base;
  return "⚠️ Eslatma!\nKompaniya kelajagi uchun olgan avans va oyliklaringizni botga o'z vaqtida yozib qo'ying. Rahmat.";
}

function getReminderTemplate_() {
  var props = PropertiesService.getScriptProperties();
  var saved = props ? String(props.getProperty('REMINDER_TEXT') || '').trim() : '';
  return saved || getDefaultReminderTemplate_();
}

function setReminderTemplate_(text) {
  var normalized = String(text || '').trim() || getDefaultReminderTemplate_();
  var props = PropertiesService.getScriptProperties();
  if (props) props.setProperty('REMINDER_TEXT', normalized);
  return normalized;
}

function getReminderMessage_(username, customText) {
  var base = String(customText || '').trim();
  if (!base) base = getReminderTemplate_();
  var who = username ? ("👤 " + String(username) + "\n") : "";
  return who + base;
}

function sendSalaryReminderToUser(tgId, username, customText) {
  if (!tgId) return { ok:false, description:'tgId topilmadi' };
  return tgSendMessage_(tgId, getReminderMessage_(username, customText), null);
}

function sendSystemAlert(message) {
  if (!CONFIG || !CONFIG.CHAT_ID) return { ok:false, description:'CHAT_ID topilmadi' };
  return tgSendMessage_(CONFIG.CHAT_ID, String(message || ''), null);
}

// Excel faylni foydalanuvchiga yuborish
function sendExcelToUser(tgId, base64Data, fileName) {
  var url     = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/sendDocument";
  var decoded = Utilities.base64Decode(base64Data);
  var blob    = Utilities.newBlob(
    decoded,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName
  );

  var options = {
    method:             "post",
    payload:            { chat_id: String(tgId), document: blob, caption: "📊 " + fileName },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}
