// ============================================================
// CODE.GS
// ============================================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "API ishlayapti ✅" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var rawBody = '';
  var body = {};
  var action = '';
  var tgId = '';

  try {
    rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : '{}';
    body = JSON.parse(rawBody || '{}');

    // Telegram webhook update
    if (body.update_id) {
      handleTelegramUpdate_(body);
      return sendJSON({ ok: true });
    }

    // Web App so'rovi
    var data   = body;
    action = String(data.action || '');
    tgId   = String(data.telegramId || '');
    if (!action) {
      return sendJSON({ success:false, error:"Action yuborilmadi" });
    }
    var authValidation = validateTelegramAuth(data, tgId);
    if (!authValidation.success) {
      return sendJSON({ success:false, error: authValidation.error });
    }
    var rateLimit = checkRateLimit_(tgId, action);
    if (!rateLimit.success) {
      return sendJSON(rateLimit);
    }
    var auth   = checkUserRoles(tgId);
    var result;

    // Yozish amallari uchun LockService
    var writeActions = ['add', 'admin_edit', 'admin_delete', 'self_edit', 'self_delete', 'add_hodim', 'update_hodim', 'delete_hodim', 'kvadrat_add', 'kvadrat_edit', 'kvadrat_delete', 'kvadrat_claim', 'kvadrat_revert', 'force_reassign_step', 'workflow_save_config', 'positions_save_all', 'ai_save_config', 'ai_run_report', 'set_global_setting'];
    var lock = null;
    if (writeActions.indexOf(action) !== -1) {
      lock = LockService.getScriptLock();
      lock.waitLock(15000);
    }

    switch (action) {

      case "init":
        result = initUser(tgId, auth, data);
        break;

      case "admin_init":
        result = getAdminInitData(tgId);
        break;

      case "add":
        result = addRecord(data, auth, tgId);
        break;

      case "admin_get_all":
        var canView = auth.isSuperAdmin || auth.permissions.canViewAll;
        if (!canView) return sendJSON({ success:false, error:"Ko'rish ruxsati yo'q!" });
        result = adminGetAll(data);
        break;

      case "admin_edit":
        var canEdit = auth.isSuperAdmin || auth.permissions.canEdit;
        if (!canEdit) return sendJSON({ success:false, error:"Tahrirlash ruxsati yo'q!" });
        result = adminEditRecord(data, tgId);
        break;

      case "admin_delete":
        var canDel = auth.isSuperAdmin || auth.permissions.canDelete;
        if (!canDel) return sendJSON({ success:false, error:"O'chirish ruxsati yo'q!" });
        result = adminDeleteRecord(data.rowId, tgId, data.reason);
        break;

      case "self_edit":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error:"Ro'yxatda topilmadingiz" });
        result = selfEditRecord(data, tgId);
        break;

      case "self_delete":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error:"Ro'yxatda topilmadingiz" });
        result = selfDeleteRecord(data.rowId, tgId, data.reason);
        break;

      // ---- Hodimlar boshqaruvi (SuperAdmin) ----
      case "get_hodimlar":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error:"Faqat SuperAdmin!" });
        result = getHodimlar();
        break;

      case "add_hodim":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error:"Faqat SuperAdmin!" });
        result = addHodim(data);
        break;

      case "update_hodim":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error:"Faqat SuperAdmin!" });
        result = updateHodim(data);
        break;

      case "delete_hodim":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error:"Faqat SuperAdmin!" });
        result = deleteHodim(data.tgId);
        break;

      case "migrate_hodimlar_v2":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error:"Faqat SuperAdmin!" });
        result = migrateHodimlarToV2(data.hideLegacyColumns !== false);
        break;

      case "list_notify_users":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = listNotifyUsers();
        break;

      case "get_inactive_users":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = getInactiveUsers(data.days);
        break;

      case "send_user_reminder":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = sendUserReminder(data.targetTgId, tgId, data.messageText);
        break;

      case "send_inactive_reminders":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = sendInactiveReminders(data.days, tgId, data.messageText);
        break;

      case "get_reminder_text":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = getReminderTextSetting(tgId);
        break;

      case "set_reminder_text":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = setReminderTextSetting(data.text, tgId);
        break;

      case "get_director_notify":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        var dnVal = PropertiesService.getScriptProperties().getProperty('NOTIFY_DIRECTOR');
        result = { success: true, enabled: dnVal === '1' };
        break;

      case "set_director_notify":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        PropertiesService.getScriptProperties().setProperty('NOTIFY_DIRECTOR', data.enabled ? '1' : '0');
        result = { success: true, enabled: !!data.enabled };
        break;

      case "self_check":
        if (!(auth.isSuperAdmin || auth.isAdmin)) return sendJSON({ success:false, error:"Ruxsat yo'q!" });
        result = runSystemSelfCheck_();
        break;

      case "export_to_bot":
        var exportScope = String(data.scope || 'self').toLowerCase();
        var canExport = false;
        if (exportScope === 'all') {
          canExport = auth.isSuperAdmin || (auth.permissions.canViewAll && auth.permissions.canExport);
        } else {
          canExport = auth.isSuperAdmin || auth.inList;
        }
        if (!canExport) return sendJSON({ success:false, error:"Excel ruxsati yo'q!" });
        var res = sendExcelToUser(tgId, data.base64, data.fileName);
        result  = { success: res.ok, error: res.description };
        break;

      // ---- KVADRATLAR (Measurements) ----
      case "kvadrat_add":
        if (!auth.isSuperAdmin && (!auth.positions || auth.positions.indexOf('Loyihachi') === -1)) {
          return sendJSON({ success:false, error: "Faqat 'Loyihachi' buyurtma qo'sha oladi" });
        }
        result = kvadratAdd(data, auth, tgId);
        break;

      case "kvadrat_get_all":
        result = kvadratGetAll(data);
        break;

      case "kvadrat_edit":
        if (!auth.isSuperAdmin && (!auth.positions || auth.positions.indexOf('Loyihachi') === -1)) {
          return sendJSON({ success:false, error: "Faqat 'Loyihachi' tahrirlay oladi" });
        }
        result = kvadratEdit(data, auth, tgId);
        break;

      case "request_avans":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error: "Ruxsat yo'q" });
        var amount = Number(data.amount) || 0;
        if (amount <= 0) return sendJSON({ success:false, error: "Noto'g'ri summa" });
        var reason = String(data.reason || '').trim();
        if (!reason) return sendJSON({ success:false, error: "Izoh kiritilmagan" });
        // Hodim nomini aniqlash
        var username = auth.username || auth.name || 'Xodim';
        sendAvansRequestNotification(username, amount, reason);
        result = { success:true, message: "Avans so'rovi yuborildi" };
        break;

      case "kvadrat_delete":
        if (!auth.isSuperAdmin && (!auth.positions || auth.positions.indexOf('Loyihachi') === -1)) {
          return sendJSON({ success:false, error: "Faqat 'Loyihachi' o'chira oladi" });
        }
        result = kvadratDelete(data, auth, tgId);
        break;

      case "kvadrat_claim":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error:"Ro'yxatda topilmadingiz" });
        result = processWorkflowStep(data.rowId, auth, tgId, data.targetStepIndex);
        break;

      case "kvadrat_revert":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error:"Ro'yxatda topilmadingiz" });
        result = revertWorkflowStep(data.rowId, auth, tgId, data.targetStepIndex, data.reason);
        break;

      case "force_reassign_step":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin qayta tayinlay oladi" });
        result = forceReassignStep(data.rowId, auth, data.targetStepIndex, data.newUid, data.newName, data.reason);
        break;

      case "workflow_get_config":
        result = { success:true, steps: getWorkflowConfig() };
        break;

      case "workflow_save_config":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin oqimni o'zgartira oladi" });
        result = saveWorkflowConfig(data.steps);
        break;

      case "workflow_get_settings":
        result = { success:true, isWorkflowStrict: getWorkflowStrictMode() };
        break;

      case "workflow_save_settings":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin sozlamalarni o'zgartira oladi" });
        result = setWorkflowStrictMode(data.isWorkflowStrict);
        break;

      case "get_global_settings":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin sozlamalarni ko'ra oladi" });
        result = { success: true, settings: getGlobalSettings_() };
        break;
        
      case "set_global_setting":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin sozlamalarni o'zgartira oladi" });
        result = setGlobalSetting_(data.key, data.value);
        break;

      case "positions_get_all":
        result = { success:true, positions: getAllPositions() };
        break;

      case "positions_save_all":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin lavozimlarni o'zgartira oladi" });
        result = savePositions(data.positions);
        break;

      // ---- AI Agent Boshqaruvi ----
      case "ai_get_config":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin AI sozlamalarini ko'ra oladi" });
        result = { success:true, config: getAIProvidersConfig() };
        break;

      case "ai_save_config":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin AI sozlamalarini o'zgartira oladi" });
        result = saveAIConfig(data.config);
        break;

      case "ai_run_report":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin AI hisobotini ishga tushura oladi" });
        dailyReportTask(); // Bu funksiya Telegramga javob yuboradi
        result = { success:true, message: "AI Hisobot yaratish jarayoni boshlandi. Natija Telegramga yuboriladi." };
        break;

      case "ai_chat":
        result = handleAIChat(data, auth, tgId);
        break;

      default:
        result = { success: false, error: "Noma'lum: " + action };
    }

    if (lock) lock.releaseLock();
    return sendJSON(result);

  } catch(err) {
    addErrorLog_({
      action: action || (body && body.action),
      tgId: tgId || (body && body.telegramId),
      rawBody: rawBody,
      error: err
    });
    return sendJSON({ success: false, error: err.toString() });
  }
}

// Webhook o'rnatish
function setWebhook() {
  var webAppUrl = "https://script.google.com/macros/s/AKfycbwwCfiCjL6Nvi3uXw6gfLkrXJrV30SS7YKoeQbnzJj0wXieWjTHrcn9vtPBtvonFQa4RA/exec";
  var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN +
            '/setWebhook?url=' + encodeURIComponent(webAppUrl);
  var res = UrlFetchApp.fetch(url).getContentText();
  Logger.log(res);
  return res;
}

// Webhook holatini ko'rish
function getWebhookInfo() {
  var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/getWebhookInfo';
  var res = UrlFetchApp.fetch(url).getContentText();
  Logger.log(res);
  return res;
}

// Webhook o'chirish
function deleteWebhook() {
  var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN +
            '/deleteWebhook?drop_pending_updates=true';
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}

function handleTelegramUpdate_(update) {
  try {
    if (update && update.callback_query) {
      handleCallbackQuery_(update.callback_query);
      return;
    }
    var msg = update && update.message ? update.message : null;
    if (!msg || !msg.from) return;

    var text = String(msg.text || '').trim();
    if (text.indexOf('/start') === 0) {
      handleStartCommand_(msg);
    }
  } catch (err) {
    Logger.log('[handleTelegramUpdate_ error] ' + err.toString());
  }
}

function handleCallbackQuery_(query) {
  var data = query.data || '';
  var chatId = query.message ? query.message.chat.id : query.from.id;
  var messageId = query.message ? query.message.message_id : null;
  var actorTgId = query.from.id;
  
  if (data.indexOf('conf_sal_') === 0 || data.indexOf('rej_sal_') === 0) {
    var isConfirm = data.indexOf('conf_sal_') === 0;
    var rowId = parseInt(data.replace('conf_sal_', '').replace('rej_sal_', ''), 10);
    
    // 1. Darhol foydalanuvchi ekranidagi tugmalarni o'chirib, qotib qolishni yo'qotamiz
    tgAnswerCallbackQuery_(query.id, isConfirm ? "✅ Tasdiqlandi!" : "❌ Rad etildi!", false);
    if (chatId && messageId) {
      tgEditMessageReplyMarkup_(chatId, messageId, { inline_keyboard: [] });
    }
    
    var success = false;
    var errorMsg = '';
    var actorName = '';
    var auth = checkUserRoles(actorTgId);
    actorName = auth.username || ((query.from && (query.from.first_name || query.from.username)) ? (query.from.first_name || query.from.username) : ('ID: ' + actorTgId));
    
    withWriteLock_(function() {
      var dataSheet = getSheets().dataSheet;
      var lastRow = dataSheet.getLastRow();
      if (rowId < 2 || rowId > lastRow) {
        errorMsg = "Amal topilmadi!";
        return { success: false };
      }
      var rowData = dataSheet.getRange(rowId, 1, 1, 10).getValues()[0];
      var rowTgId = String(rowData[DATA_COL.TG_ID] || '').trim();
      var currentStatus = String(rowData[DATA_COL.STATUS] || '').trim();
      
      // Agar amal allaqachon tasdiqlangan yoki rad etilgan bo'lsa, xabarlarni baribir to'g'rilaymiz
      if (currentStatus === 'Tasdiqlandi' || currentStatus === 'Rad etildi') {
        isConfirm = (currentStatus === 'Tasdiqlandi');
        success = true;
        return { success: true };
      }
      
      if (String(actorTgId) === rowTgId || auth.isBugalter || auth.isSuperAdmin) {
        var newStatus = isConfirm ? 'Tasdiqlandi' : 'Rad etildi';
        dataSheet.getRange(rowId, DATA_COL.STATUS + 1).setValue(newStatus);
        addAuditLog_(actorTgId, isConfirm ? 'confirm_record' : 'reject_record', rowId, rowToRecordForAudit_(rowData), 'updated', newStatus + ' (' + actorName + ')');
        resetDataCache_();
        touchDataVersion(DV_KEYS.FINANCE);
        success = true;
        return { success: true };
      } else {
        errorMsg = "Sizda buni tasdiqlash uchun ruxsat yo'q!";
        return { success: false };
      }
    });
    
    if (success) {
      var cache = CacheService.getScriptCache();
      // Barcha yuborilgan xabarlarni (SuperAdmin, Direktor, Bugalter, Xodim) sinxron yangilash
      var trackedJson = cache ? cache.get('trk_sal_' + rowId) : null;
      var trackedList = [];
      if (trackedJson) {
        try { trackedList = JSON.parse(trackedJson); } catch (eTrk) {}
      }
      
      var foundCurrent = false;
      for (var k = 0; k < trackedList.length; k++) {
        if (String(trackedList[k].chatId) === String(chatId) && trackedList[k].messageId === messageId) {
          foundCurrent = true;
          break;
        }
      }
      if (!foundCurrent && chatId && messageId) {
        trackedList.push({ chatId: String(chatId), messageId: messageId, baseText: (query.message ? query.message.text : '') });
      }
      
      var dataSheet = getSheets().dataSheet;
      var rowData = dataSheet.getRange(rowId, 1, 1, 10).getValues()[0];
      var rowTgId = String(rowData[DATA_COL.TG_ID] || '').trim();
      var isActorTheEmployee = (String(actorTgId) === String(rowTgId));
      
      for (var j = 0; j < trackedList.length; j++) {
        var item = trackedList[j];
        var isOwnChat = (String(item.chatId) === String(actorTgId));
        
        var recipientStatusLine = '';
        if (isConfirm) {
          if (isOwnChat) {
            recipientStatusLine = "\n\n✅ <b>Siz tomoningizdan tasdiqlandi</b>";
          } else if (isActorTheEmployee) {
            recipientStatusLine = "\n\n✅ <b>Xodim (" + actorName + ") tomonidan tasdiqlandi</b>";
          } else {
            recipientStatusLine = "\n\n✅ <b>" + actorName + " tomonidan tasdiqlandi</b>";
          }
        } else {
          if (isOwnChat) {
            recipientStatusLine = "\n\n❌ <b>Siz tomoningizdan rad etildi</b>";
          } else if (isActorTheEmployee) {
            recipientStatusLine = "\n\n❌ <b>Xodim (" + actorName + ") tomonidan rad etildi</b>";
          } else {
            recipientStatusLine = "\n\n❌ <b>" + actorName + " tomonidan rad etildi</b>";
          }
        }
        
        var itemBaseText = item.baseText || ((query.message && String(item.chatId) === String(chatId)) ? query.message.text : '');
        var cleanBaseText = String(itemBaseText || '')
          .replace(/\n⏳\s*<i>Holati:\s*Kutilmoqda\.\.\.<\/i>/gi, '')
          .replace(/\n⏳\s*Holati:\s*Kutilmoqda\.\.\./gi, '')
          .replace(/\n\n✅\s*<b>.*?<\/b>/gi, '')
          .replace(/\n\n❌\s*<b>.*?<\/b>/gi, '')
          .replace(/\n\n✅\s*.*/gi, '')
          .replace(/\n\n❌\s*.*/gi, '')
          .replace(/\. Iltimos, tasdiqlang yoki rad eting:/gi, ':')
          .replace(/Iltimos, tasdiqlang yoki rad eting:/gi, '');
          
        // Bosh sarlavhani doim qalin (bold) qilish
        if (cleanBaseText.indexOf('⚠️') === 0) {
          var firstLineEnd = cleanBaseText.indexOf('\n');
          if (firstLineEnd > 0) {
            var firstLine = cleanBaseText.substring(0, firstLineEnd);
            var restOfMsg = cleanBaseText.substring(firstLineEnd);
            var headerPure = firstLine.replace('⚠️', '').replace(/<\/?b>/gi, '').trim();
            cleanBaseText = '⚠️ <b>' + headerPure + '</b>' + restOfMsg;
          }
        }
          
        var finalMsg = cleanBaseText ? (cleanBaseText + recipientStatusLine) : (recipientStatusLine.trim());
        
        tgEditMessageText_(item.chatId, item.messageId, finalMsg, "HTML", { inline_keyboard: [] });
      }
    } else if (errorMsg) {
      tgAnswerCallbackQuery_(query.id, "⚠️ " + errorMsg, true);
    }
  }
}

function handleStartCommand_(message) {
  var from = message && message.from ? message.from : {};
  var tgId = String(from.id || '').trim();
  if (!tgId) return;

  var auth = checkUserRoles(tgId);

  // Agar foydalanuvchi allaqachon mavjud xodim yoki SuperAdmin bo'lsa -> hech qanday ortiqcha xabar yuborilmaydi
  if (auth.isSuperAdmin || auth.inList) {
    return;
  }

  var data = {
    firstName: String(from.first_name || ''),
    lastName: String(from.last_name || ''),
    tgUsername: String(from.username || '')
  };
  var reg = autoRegisterPendingUserIfMissing_(tgId, data, 'start');

  var text;
  if (reg && reg.created) {
    text = "Assalomu alaykum!\n" +
           "Siz yangi foydalanuvchi sifatida ro'yxatga qo'shildingiz.\n" +
           "Ruxsat olish uchun admin bilan bog'laning.";
  } else {
    text = "Assalomu alaykum!\n" +
           "Sizning hisobingiz tasdiqlash jarayonida.\n" +
           "Ruxsat olish uchun admin bilan bog'laning.";
  }

  var buttons = [];
  var webApp = String((CONFIG && CONFIG.WEB_APP_URL) || '').trim();
  if (webApp && webApp.indexOf('YOUR.github.io') < 0) {
    buttons.push([{ text: "📱 Web Appni ochish", web_app: { url: webApp } }]);
  }

  var adminId = String((CONFIG && CONFIG.SUPER_ADMIN_ID) || '').trim();
  if (adminId && adminId !== 'YOUR_TG_ADMIN_CHAT_ID') {
    buttons.push([{ text: "📩 Admin bilan bog'lanish", url: "tg://user?id=" + adminId }]);
  }

  var replyMarkup = buttons.length ? { inline_keyboard: buttons } : null;
  tgSendMessage_(tgId, text, null, replyMarkup);
}

function checkRateLimit_(tgId, action) {
  var ttl = getRateLimitSeconds_(action);
  if (ttl <= 0) return { success:true };

  var cache;
  try {
    cache = CacheService.getScriptCache();
  } catch (e) {
    return { success:true };
  }
  if (!cache) return { success:true };

  var key = 'rl:' + String(tgId || '0') + ':' + String(action || '');
  try {
    if (cache.get(key)) {
      return { success:false, error:"Juda tez so'rov yuborildi. 2 soniya kuting." };
    }
    cache.put(key, '1', ttl);
  } catch (e2) {
    return { success:true };
  }
  return { success:true };
}

function getRateLimitSeconds_(action) {
  if (CONFIG && CONFIG.RATE_LIMIT_ENABLED === false) return 0;
  var a = String(action || '');
  if (a === 'add' || a === 'admin_edit' || a === 'admin_delete' ||
      a === 'self_edit' || a === 'self_delete' ||
      a === 'add_hodim' || a === 'update_hodim' || a === 'delete_hodim' ||
      a === 'send_user_reminder' || a === 'send_inactive_reminders' ||
      a === 'set_reminder_text') return 2;
  if (a === 'export_to_bot') return 5;
  return 0;
}

function getErrorSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName('ErrorLog');
  if (!sh) {
    sh = ss.insertSheet('ErrorLog');
    sh.appendRow(['Timestamp', 'Action', 'TelegramId', 'Error', 'Stack', 'RawBody']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  return sh;
}

function truncateForLog_(value, maxLen) {
  var str = String(value || '');
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

function addErrorLog_(ctx) {
  try {
    var sh = getErrorSheet_();
    var errObj = ctx && ctx.error ? ctx.error : null;
    var errText = errObj ? String(errObj) : '';
    var stack = errObj && errObj.stack ? String(errObj.stack) : '';
    sh.appendRow([
      new Date(),
      String((ctx && ctx.action) || ''),
      String((ctx && ctx.tgId) || ''),
      truncateForLog_(errText, 1000),
      truncateForLog_(stack, 4000),
      truncateForLog_((ctx && ctx.rawBody) || '', 2000)
    ]);
    maybeNotifyErrorBurst_(ctx, errText);
  } catch (ignore) {}
}

function maybeNotifyErrorBurst_(ctx, errText) {
  try {
    if (!CONFIG || CONFIG.ERROR_ALERT_ENABLED === false) return;
    var threshold = Number(CONFIG.ERROR_ALERT_THRESHOLD || 3);
    var windowSec = Number(CONFIG.ERROR_ALERT_WINDOW_SEC || 300);
    if (threshold < 2 || windowSec < 30) return;

    var action = String((ctx && ctx.action) || 'unknown');
    var errShort = String(errText || 'unknown').slice(0, 120);
    var keyBase = 'errburst:' + action + ':' + errShort;

    var cache = CacheService.getScriptCache();
    if (!cache) return;

    var count = Number(cache.get(keyBase) || 0) + 1;
    cache.put(keyBase, String(count), windowSec);
    if (count < threshold) return;

    var sentKey = keyBase + ':sent';
    if (cache.get(sentKey)) return;

    var msg = "🚨 Xatolik ko'paydi\n" +
              "Action: " + action + "\n" +
              "Soni: " + count + " ta / " + windowSec + "s\n" +
              "tgId: " + String((ctx && ctx.tgId) || '—') + "\n" +
              "Xato: " + errShort;
    sendSystemAlert(msg);
    cache.put(sentKey, '1', windowSec);
  } catch (ignore) {}
}

function validateTelegramAuth(data, tgId) {
  var requireAuth = CONFIG.REQUIRE_TELEGRAM_AUTH === true;
  var initData = data && data.initData ? String(data.initData) : '';

  if (!initData) {
    if (requireAuth) {
      return { success:false, error:"Telegram auth topilmadi" };
    }
    return { success:true };
  }

  var verified = verifyTelegramInitData_(initData, CONFIG.BOT_TOKEN, tgId);
  if (!verified.success) return verified;
  return { success:true };
}

function verifyTelegramInitData_(initData, botToken, expectedTgId) {
  if (!botToken) return { success:false, error:"BOT_TOKEN sozlanmagan" };

  var params = parseInitData_(initData);
  var theirHash = params.hash;
  if (!theirHash) return { success:false, error:"Telegram hash topilmadi" };
  delete params.hash;

  var keys = Object.keys(params).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(keys[i] + '=' + params[keys[i]]);
  }
  var dataCheckString = parts.join('\n');

  var secretKey = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  var dataCheckBytes = Utilities.newBlob(dataCheckString).getBytes();
  var calcHashBytes = Utilities.computeHmacSha256Signature(dataCheckBytes, secretKey);
  var calcHash = toHex_(calcHashBytes);

  if (calcHash !== String(theirHash).toLowerCase()) {
    return { success:false, error:"Telegram auth xato (hash mismatch)" };
  }

  var maxAge = Number(CONFIG.AUTH_MAX_AGE_SEC || 0);
  if (maxAge > 0 && params.auth_date) {
    var nowSec = Math.floor(Date.now() / 1000);
    var authSec = Number(params.auth_date);
    if (isFinite(authSec) && nowSec - authSec > maxAge) {
      return { success:false, error:"Telegram auth eskirgan" };
    }
  }

  if (expectedTgId && params.user) {
    try {
      var userObj = JSON.parse(params.user);
      if (String(userObj.id) !== String(expectedTgId)) {
        return { success:false, error:"Telegram foydalanuvchi mos emas" };
      }
    } catch (e) {
      return { success:false, error:"Telegram user format xato" };
    }
  }

  return { success:true };
}

function parseInitData_(raw) {
  var out = {};
  if (!raw) return out;
  var pairs = String(raw).split('&');
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue;
    var eq = pairs[i].indexOf('=');
    var key = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i];
    var val = eq >= 0 ? pairs[i].slice(eq + 1) : '';
    key = decodeURIComponent_(key);
    val = decodeURIComponent_(val);
    out[key] = val;
  }
  return out;
}

function decodeURIComponent_(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, '%20'));
  } catch (e) {
    return String(s);
  }
}

function toHex_(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = (bytes[i] + 256) % 256;
    out.push((v < 16 ? '0' : '') + v.toString(16));
  }
  return out.join('');
}

function runSystemSelfCheck_() {
  var checks = [];
  function addCheck(key, ok, note) {
    checks.push({ key:key, ok:!!ok, note:String(note || '') });
  }

  var token = String((CONFIG && CONFIG.BOT_TOKEN) || '');
  addCheck('BOT_TOKEN', token && token !== 'YOUR_BOT_TOKEN', token ? 'sozlangan' : 'bo\'sh');

  var chatId = String((CONFIG && CONFIG.CHAT_ID) || '');
  addCheck('CHAT_ID', chatId && chatId !== 'YOUR_TG_CHAT_ID', chatId ? 'sozlangan' : 'bo\'sh');

  var superAdmin = String((CONFIG && CONFIG.SUPER_ADMIN_ID) || '');
  addCheck('SUPER_ADMIN_ID', superAdmin && superAdmin !== 'YOUR_TG_ADMIN_CHAT_ID', superAdmin ? 'sozlangan' : 'bo\'sh');

  var webApp = String((CONFIG && CONFIG.WEB_APP_URL) || '');
  addCheck('WEB_APP_URL', /^https:\/\/.+/i.test(webApp) && webApp.indexOf('YOUR.github.io') < 0, webApp || 'bo\'sh');

  addCheck('REQUIRE_TELEGRAM_AUTH', CONFIG && CONFIG.REQUIRE_TELEGRAM_AUTH === true, String(CONFIG && CONFIG.REQUIRE_TELEGRAM_AUTH));

  var authMax = Number((CONFIG && CONFIG.AUTH_MAX_AGE_SEC) || 0);
  addCheck('AUTH_MAX_AGE_SEC', authMax > 0 && authMax <= 86400, String(authMax));

  addCheck('RATE_LIMIT_ENABLED', CONFIG && CONFIG.RATE_LIMIT_ENABLED !== false, String(CONFIG && CONFIG.RATE_LIMIT_ENABLED));
  addCheck('ERROR_ALERT_ENABLED', CONFIG && CONFIG.ERROR_ALERT_ENABLED !== false, String(CONFIG && CONFIG.ERROR_ALERT_ENABLED));

  var warningCount = 0;
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].ok) warningCount++;
  }

  return {
    success: true,
    status: warningCount === 0 ? 'ok' : 'warn',
    warnings: warningCount,
    checks: checks
  };
}