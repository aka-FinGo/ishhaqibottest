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

  var initialStatus = data.initialStatus || '';
  var statusBadge = initialStatus === 'Kutilmoqda' ? "\n⏳ <i>Holati: Kutilmoqda...</i>" : "";
  var actorLine = (data.actorTgId && String(data.actorTgId) !== String(data.tgId) && data.actorName)
                ? ("\n✍️ Kiritdi: " + data.actorName + " (Bugalter)")
                : "";

  var msg = "⚠️ <b>Yangi amal qo'shildi</b>\n" +
            "👤 Xodim: " + (data.employeeName || "—") +
            actorLine +
            uzsText + usdText + rateText +
            (data.actionPeriod ? "\n📅 Davr: " + data.actionPeriod : "") +
            "\n📝 " + (data.comment || "—") +
            "\n📅 " + (data.date    || "—") +
            statusBadge;

  var sentTrack = [];
  var rowId = data.rowId;

  // SuperAdmin ga informativ xabar yuborish:
  // Agar SuperAdmin o'zi tasdiqlash xabari (tugmali xabar) olayotgan bo'lsa,
  // ikkilamchi informativ xabar yuborilmaydi (faqat 1 ta tugmali xabar boradi):
  var isSuperAdminGettingButton = (data.notifyTarget === 'bugalter') || 
                                  (data.notifyTarget === 'employee' && String(CONFIG.CHAT_ID) === String(data.tgId));

  if (CONFIG.CHAT_ID && !isSuperAdminGettingButton) {
    var resAdmin = tgSendMessage_(CONFIG.CHAT_ID, msg, "HTML");
    if (resAdmin && resAdmin.result && resAdmin.result.message_id) {
      sentTrack.push({ chatId: String(CONFIG.CHAT_ID), messageId: resAdmin.result.message_id, baseText: msg });
    }
  }

  // Direktorlarga yuborish (agar yoqilgan bo'lsa)
  var dirTracks = sendNotifyToDirectors_(msg);
  if (dirTracks && dirTracks.length > 0) {
    sentTrack = sentTrack.concat(dirTracks);
  }

  if (rowId && sentTrack.length > 0) {
    appendTrackedMessages_(rowId, sentTrack);
  }
}

/**
 * Barcha Direktor rollidagi hodimlarni topib xabar yuboradi.
 * PropertiesService da 'NOTIFY_DIRECTOR' = '1' bo'lsa ishlaydi.
 */
function sendNotifyToDirectors_(msg) {
  var sentTracks = [];
  try {
    var props = PropertiesService.getScriptProperties();
    var enabled = props.getProperty('NOTIFY_DIRECTOR');
    if (enabled !== '1') return sentTracks; // O'chirilgan — chiqib ketamiz

    var empRows = getEmployeeRows_();
    if (!empRows || empRows.length < 2) return sentTracks;

    var headers = empRows[0];
    var direktorIdx = headers.indexOf('Direktor');
    var tgIdIdx     = headers.indexOf('TelegramId');
    if (direktorIdx < 0 || tgIdIdx < 0) return sentTracks;

    empRows.slice(1).forEach(function(row) {
      var isDirektor = toBool01_(row[direktorIdx]);
      var tgId       = String(row[tgIdIdx] || '').trim();
      if (isDirektor && tgId && tgId !== String(CONFIG.SUPER_ADMIN_ID)) {
        var res = tgSendMessage_(tgId, msg, "HTML");
        if (res && res.result && res.result.message_id) {
          sentTracks.push({ chatId: String(tgId), messageId: res.result.message_id, baseText: msg });
        }
      }
    });
  } catch(e) {
    Logger.log('[sendNotifyToDirectors_] ' + e.message);
  }
  return sentTracks;
}

function appendTrackedMessages_(rowId, newTracks) {
  if (!rowId || !newTracks || newTracks.length === 0) return;
  try {
    var cache = CacheService.getScriptCache();
    if (!cache) return;
    var existingJson = cache.get('trk_sal_' + rowId);
    var list = [];
    if (existingJson) {
      try { list = JSON.parse(existingJson); } catch (e) {}
    }
    for (var i = 0; i < newTracks.length; i++) {
      var item = newTracks[i];
      var exists = false;
      for (var j = 0; j < list.length; j++) {
        if (String(list[j].chatId) === String(item.chatId) && list[j].messageId === item.messageId) {
          exists = true;
          break;
        }
      }
      if (!exists) list.push(item);
    }
    cache.put('trk_sal_' + rowId, JSON.stringify(list), 21600);
  } catch (err) {}
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

// Avans so'rash xabarnomasi (Bugalter va SuperAdminga)
function sendAvansRequestNotification(username, amount, reason) {
  var msg = "💸 <b>Yangi avans so'rovi!</b>\n" +
            "👤 Xodim: " + (username || "—") + "\n" +
            "💰 Summa: " + Number(amount).toLocaleString() + " UZS\n" +
            "📝 Sabab: " + (reason || "Kiritilmagan");

  // SuperAdmin ga doim yuborish
  if (CONFIG.CHAT_ID) {
    tgSendMessage_(CONFIG.CHAT_ID, msg, "HTML");
  }

  // Bugalter rollarini topib yuborish
  try {
    var empRows = getEmployeeRows_();
    if (!empRows || empRows.length < 2) return;
    
    var headers = empRows[0];
    var roleIdx = COL.ROLE; // GS_Auth.gs da aniqlangan COL.ROLE
    var tgIdIdx = COL.TG_ID;

    // Database orqali getEmployeeRows chaqirilgan bo'lsa COL larni ishlatsak bo'ladi.
    // Agar COL topilmasa, header orqali topamiz:
    if (typeof COL === 'undefined') {
       roleIdx = headers.indexOf('Role');
       tgIdIdx = headers.indexOf('TelegramId');
    }

    if (roleIdx < 0 || tgIdIdx < 0) return;

    empRows.slice(1).forEach(function(row) {
      var role = String(row[roleIdx] || '').trim().toUpperCase();
      var tgId = String(row[tgIdIdx] || '').trim();
      
      if (role === 'BUGALTER' && tgId && tgId !== String(CONFIG.SUPER_ADMIN_ID)) {
        tgSendMessage_(tgId, msg, "HTML");
      }
    });
  } catch(e) {
    Logger.log('[sendAvansRequestNotification] ' + e.message);
  }
}

function sendSalaryConfirmationToEmployee_(tgId, rowId, employeeName, amountUZS, amountUSD, rate, comment, dateStr, actionPeriod, actorName) {
  var uzsText = Number(amountUZS) > 0 ? "\n💰 " + Number(amountUZS).toLocaleString() + " UZS" : "";
  var usdText = Number(amountUSD) > 0 ? "\n💵 $" + Number(amountUSD).toLocaleString() : "";
  var rateText = Number(amountUSD) > 0 && Number(rate) > 0 ? "\n📈 Kurs: " + Number(rate).toLocaleString() + " UZS" : "";
  var periodText = actionPeriod ? "\n📅 Davr: " + actionPeriod : "";
  
  var whoEntered = actorName ? ("Bugalter (" + actorName + ")") : "Bugalter";
  
  var msg = "⚠️ <b>Sizning hisobingizga " + whoEntered + " quyidagi amalni kiritdi. Iltimos, tasdiqlang yoki rad eting:</b>\n" +
            "👤 Xodim: " + (employeeName || "—") +
            uzsText + usdText + rateText + periodText +
            "\n📝 " + (comment || "—") +
            "\n📅 " + (dateStr || "—");
            
  var replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Tasdiqlash", callback_data: "conf_sal_" + rowId },
        { text: "❌ Rad etish", callback_data: "rej_sal_" + rowId }
      ]
    ]
  };
  
  var res = tgSendMessage_(tgId, msg, "HTML", replyMarkup);
  if (res && res.result && res.result.message_id) {
    appendTrackedMessages_(rowId, [{ chatId: String(tgId), messageId: res.result.message_id, baseText: msg }]);
  }
  return res;
}

function sendSalaryConfirmationToBugalters_(actorTgId, rowId, empName, uzs, usd, rate, comment, dateStr, actionPeriod) {
  var uzsText = Number(uzs) > 0 ? "\n💰 " + Number(uzs).toLocaleString() + " UZS" : "";
  var usdText = Number(usd) > 0 ? "\n💵 $" + Number(usd).toLocaleString() : "";
  var rateText = Number(usd) > 0 && Number(rate) > 0 ? "\n📈 Kurs: " + Number(rate).toLocaleString() + " UZS" : "";
  var periodText = actionPeriod ? "\n📅 Davr: " + actionPeriod : "";
  
  var msg = "⚠️ <b>Xodim tomonidan kiritilgan amal tasdiqlash uchun</b>\n" +
            "Quyidagi amal kiritildi. Iltimos, tasdiqlang yoki rad eting:\n" +
            "👤 " + (empName || "—") +
            uzsText + usdText + rateText + periodText +
            "\n📝 " + (comment || "—") +
            "\n📅 " + (dateStr || "—");
            
  var replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Tasdiqlash", callback_data: "conf_sal_" + rowId },
        { text: "❌ Rad etish", callback_data: "rej_sal_" + rowId }
      ]
    ]
  };
  
  var sentTrack = [];
  // Bugalterlar va SuperAdminga yuborish
  var empRes = getHodimlar();
  var employees = (empRes && empRes.data) ? empRes.data : [];
  for (var i = 0; i < employees.length; i++) {
    var e = employees[i];
    if ((e.role === 'BUGALTER' || e.isBugalter) && e.tgId && String(e.tgId) !== String(CONFIG.SUPER_ADMIN_ID)) {
      var res = tgSendMessage_(e.tgId, msg, "HTML", replyMarkup);
      if (res && res.result && res.result.message_id) {
        sentTrack.push({ chatId: String(e.tgId), messageId: res.result.message_id, baseText: msg });
      }
    }
  }
  if (CONFIG.SUPER_ADMIN_ID) {
    var resAdmin = tgSendMessage_(CONFIG.SUPER_ADMIN_ID, msg, "HTML", replyMarkup);
    if (resAdmin && resAdmin.result && resAdmin.result.message_id) {
      sentTrack.push({ chatId: String(CONFIG.SUPER_ADMIN_ID), messageId: resAdmin.result.message_id, baseText: msg });
    }
  }
  
  if (sentTrack.length > 0) {
    appendTrackedMessages_(rowId, sentTrack);
  }
}

function tgAnswerCallbackQuery_(callbackQueryId, text, showAlert) {
  var url = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/answerCallbackQuery";
  var payload = {
    callback_query_id: String(callbackQueryId),
    text: String(text || ''),
    show_alert: !!showAlert
  };

  var options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  var resp = UrlFetchApp.fetch(url, options);
  try { return JSON.parse(resp.getContentText()); } catch (e) { return {}; }
}

function tgEditMessageText_(chatId, messageId, text, parseMode, replyMarkup) {
  var url = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/editMessageText";
  var payload = {
    chat_id: String(chatId),
    message_id: messageId,
    text: String(text)
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

  // Agar HTML format parse xatosi bersa, oddiy matn sifatida qayta tahrirlaymiz
  if (!body.ok && parseMode) {
    delete payload.parse_mode;
    payload.text = String(text).replace(/<[^>]*>/g, '');
    options.payload = JSON.stringify(payload);
    var resp2 = UrlFetchApp.fetch(url, options);
    try { body = JSON.parse(resp2.getContentText()); } catch (e2) {}
  }
  return body;
}

function tgEditMessageReplyMarkup_(chatId, messageId, replyMarkup) {
  var url = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/editMessageReplyMarkup";
  var payload = {
    chat_id: String(chatId),
    message_id: messageId,
    reply_markup: replyMarkup || { inline_keyboard: [] }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  var resp = UrlFetchApp.fetch(url, options);
  try { return JSON.parse(resp.getContentText()); } catch (e) { return {}; }
}