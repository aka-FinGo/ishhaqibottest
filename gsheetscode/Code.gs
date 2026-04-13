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

    switch (action) {

      case "init":
        result = initUser(tgId, auth, data);
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

      case "kvadrat_delete":
        if (!auth.isSuperAdmin && (!auth.positions || auth.positions.indexOf('Loyihachi') === -1)) {
          return sendJSON({ success:false, error: "Faqat 'Loyihachi' o'chira oladi" });
        }
        result = kvadratDelete(data, auth, tgId);
        break;

      case "kvadrat_claim":
        if (!auth.inList && !auth.isSuperAdmin) return sendJSON({ success:false, error:"Ro'yxatda topilmadingiz" });
        result = processWorkflowStep(data.rowId, auth, tgId);
        break;

      case "workflow_get_config":
        result = { success:true, steps: getWorkflowConfig() };
        break;

      case "workflow_save_config":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin oqimni o'zgartira oladi" });
        result = saveWorkflowConfig(data.steps);
        break;

      case "positions_get_all":
        result = { success:true, positions: getAllPositions() };
        break;

      case "positions_save_all":
        if (!auth.isSuperAdmin) return sendJSON({ success:false, error: "Faqat SuperAdmin lavozimlarni o'zgartira oladi" });
        result = savePositions(data.positions);
        break;

      default:
        result = { success: false, error: "Noma'lum: " + action };
    }

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

// Webhook o'chirish
function deleteWebhook() {
  var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN +
            '/deleteWebhook?drop_pending_updates=true';
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}

function handleTelegramUpdate_(update) {
  var msg = update && update.message ? update.message : null;
  if (!msg || !msg.from) return;

  var text = String(msg.text || '').trim();
  if (text.indexOf('/start') === 0) {
    handleStartCommand_(msg);
  }
}

function handleStartCommand_(message) {
  var from = message && message.from ? message.from : {};
  var tgId = String(from.id || '').trim();
  if (!tgId) return;

  var data = {
    firstName: String(from.first_name || ''),
    lastName: String(from.last_name || ''),
    tgUsername: String(from.username || '')
  };
  var reg = autoRegisterPendingUserIfMissing_(tgId, data, 'start');

  var text;
  var auth = checkUserRoles(tgId);

  if (reg && reg.created) {
    text = "Assalomu alaykum!\n" +
           "Siz yangi foydalanuvchi sifatida ro'yxatga qo'shildingiz.\n" +
           "Ruxsat olish uchun admin bilan bog'laning.";
  } else if (auth.isSuperAdmin || auth.inList) {
    text = "Assalomu alaykum! Tizimga xush kelibsiz.\n" +
           "Pastdagi tugma orqali Web App dasturini oching:";
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
