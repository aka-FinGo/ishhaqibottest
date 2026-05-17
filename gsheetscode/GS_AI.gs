// ============================================================
// GS_AI.gs — AI Agent Multi-Provider Engine & Cron Tasks
// Supports: Groq, Gemini, OpenRouter, Ollama
// ============================================================

/**
 * AI Provider konfiguratsiyalarini o'qish (kesh bilan)
 */
function getAIProvidersConfig() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("ai_providers_config");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName("AI_Sozlamalar");
  if (!sh) return [];

  var data = sh.getDataRange().getValues();
  var providers = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // Provider name bo'sh bo'lsa sakrash
    providers.push({
      provider: String(row[0] || '').trim(),
      model:    String(row[1] || '').trim(),
      apiKey:   String(row[2] || '').trim(),
      priority: Number(row[3]) || 99,
      isActive: Number(row[4]) === 1,
      baseURL:  String(row[5] || '').trim()
    });
  }
  
  // Aktiv provayderlarni ustuvorlik (priority) bo'yicha tartiblash
  var activeProviders = providers.filter(function(p) { return p.isActive && p.apiKey; });
  activeProviders.sort(function(a, b) { return a.priority - b.priority; });
  
  cache.put("ai_providers_config", JSON.stringify({ all: providers, active: activeProviders }), 3600);
  return { all: providers, active: activeProviders };
}

/**
 * Admin paneldan kelgan AI sozlamalarini saqlash
 */
function saveAIConfig(configList) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName("AI_Sozlamalar");
  if (!sh) return { success: false, error: "Jadval topilmadi" };

  sh.clear();
  var headers = ["Provider", "Model", "API_Key", "Priority", "IsActive", "BaseURL"];
  sh.appendRow(headers);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#7e22ce").setFontColor("#ffffff");

  if (configList && configList.length > 0) {
    var output = configList.map(function(c) {
      return [
        c.provider,
        c.model,
        c.apiKey,
        c.priority,
        c.isActive ? 1 : 0,
        c.baseURL
      ];
    });
    sh.getRange(2, 1, output.length, headers.length).setValues(output);
  }

  CacheService.getScriptCache().remove("ai_providers_config");
  return { success: true };
}

/**
 * Universal AI chaqiruv funksiyasi (Fallback mantiqi bilan)
 */
function callAI(prompt) {
  var config = getAIProvidersConfig();
  if (config.active.length === 0) {
    return { success: false, error: "Faol AI provayder yoki API Key topilmadi!" };
  }

  var lastError = "";

  // Provayderlarni ustuvorlik bo'yicha aylanib chiqish (Fallback logic)
  for (var i = 0; i < config.active.length; i++) {
    var prov = config.active[i];
    try {
      var responseText = "";
      
      if (prov.provider.toLowerCase() === "gemini") {
        responseText = callGeminiAPI_(prompt, prov.model, prov.apiKey, prov.baseURL);
      } 
      else if (prov.provider.toLowerCase() === "groq") {
        responseText = callGroqAPI_(prompt, prov.model, prov.apiKey, prov.baseURL);
      }
      else if (prov.provider.toLowerCase() === "openrouter") {
        responseText = callOpenRouterAPI_(prompt, prov.model, prov.apiKey, prov.baseURL);
      }
      else if (prov.provider.toLowerCase() === "ollama") {
        responseText = callOllamaAPI_(prompt, prov.model, prov.baseURL);
      }

      if (responseText) {
        return { success: true, text: responseText, provider: prov.provider };
      }
    } catch (e) {
      lastError = prov.provider + " Error: " + e.message;
      Logger.log("AI Fallback trigged. " + lastError);
      // Xatolik bo'lsa sikl davom etadi va keyingi provayderga o'tadi
    }
  }

  return { success: false, error: "Barcha AI provayderlar xato berdi. Oxirgi xato: " + lastError };
}

// -------------------------------------------------------------
// PROVIDER SPECIFIC ADAPTERS
// -------------------------------------------------------------

function callGeminiAPI_(prompt, model, apiKey, baseURL) {
  var url = baseURL + model + ":generateContent?key=" + apiKey;
  var payload = {
    "contents": [{
      "parts": [{"text": prompt}]
    }],
    "generationConfig": {
      "temperature": 0.4
    }
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  
  if (json.error) throw new Error(json.error.message);
  if (json.candidates && json.candidates.length > 0) {
    return json.candidates[0].content.parts[0].text;
  }
  throw new Error("Bo'sh javob");
}

function callGroqAPI_(prompt, model, apiKey, baseURL) {
  var payload = {
    "model": model,
    "messages": [
      {"role": "system", "content": "Siz moliyaviy ma'lumotlar tahlilchisisiz. Qisqa, aniq va londa hisobot yozing."},
      {"role": "user", "content": prompt}
    ],
    "temperature": 0.4
  };

  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(baseURL, options);
  var json = JSON.parse(response.getContentText());
  
  if (json.error) throw new Error(json.error.message);
  return json.choices[0].message.content;
}

function callOpenRouterAPI_(prompt, model, apiKey, baseURL) {
  var payload = {
    "model": model,
    "messages": [
      {"role": "user", "content": prompt}
    ],
    "temperature": 0.4
  };

  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": CONFIG.WEB_APP_URL, 
      "X-Title": "ERP Tizimi"
    },
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(baseURL, options);
  var json = JSON.parse(response.getContentText());
  
  if (json.error) throw new Error(json.error.message);
  return json.choices[0].message.content;
}

function callOllamaAPI_(prompt, model, baseURL) {
  // Ollama odatda apiKey talab qilmaydi (local yoki xususiy server uchun)
  var payload = {
    "model": model,
    "prompt": prompt,
    "stream": false
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(baseURL, options);
  var json = JSON.parse(response.getContentText());
  
  if (json.error) throw new Error(json.error);
  return json.response;
}

// -------------------------------------------------------------
// CRONJOB: KUNLIK HISOBOT YARATISH VA YUBORISH
// -------------------------------------------------------------

/**
 * Bu funksiya Time-Driven Trigger orqali har kuni 08:00 da ishlashi kerak.
 */
function dailyReportTask() {
  try {
    var rawData = gatherDailyDataForAI_();
    if (rawData.length < 50) { // Agar ma'lumot juda kam yoki yo'q bo'lsa
       sendTelegramNotification({ 
         employeeName: "AI Agent", 
         amountUZS: 0, 
         amountUSD: 0, 
         rate: 0, 
         comment: "📉 Bugun tahlil qilish uchun yetarli ma'lumot topilmadi.", 
         date: new Date().toLocaleDateString() 
       });
       return;
    }

    var prompt = buildAnalyticsSystemPrompt("company", {
      isSuperAdmin: true, isAdmin: true,
      roleKey: "SUPER_ADMIN",
      permissions: { canViewAll: true }
    }, null) +
    "\n\nYuqoridagi ma'lumotlarga asoslanib KUNLIK HISOBOT tayyorla. " +
    "Tuzilma: 1) Umumiy holat 2) Kritik muammolar " +
    "3) Moliya 4) Hodimlar 5) Tavsiyalar. Qisqa va aniq.";
    var aiResponse = callAI(prompt);
    
    if (aiResponse.success) {
      // AI javobini SuperAdmin yoki maxsus guruhga yuborish
      var msg = "🤖 *AI Kunlik Hisobot (" + aiResponse.provider + ")*\n\n" + aiResponse.text;
      
      // Standart notification funksiyasini biroz moslashtirib chaqiramiz yoki to'g'ridan to'g'ri UrlFetchApp qilamiz
      var url = "https://api.telegram.org/bot" + CONFIG.BOT_TOKEN + "/sendMessage";
      var payload = {
        chat_id: CONFIG.SUPER_ADMIN_ID,
        text: msg,
        parse_mode: "Markdown"
      };
      
      UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload)
      });
      
    } else {
      Logger.log("AI Report Error: " + aiResponse.error);
    }
  } catch (e) {
    Logger.log("Cronjob Fatal Error: " + e.message);
  }
}

/**
 * AI tahlil qilishi uchun oxirgi kun ma'lumotlarini to'playdi
 */
function gatherDailyDataForAI_() {
  // GS_AI_ANALYTICS.gs dan to'liq boyitilgan kontekst olamiz
  var fakeAuth = {
    isSuperAdmin: true, isAdmin: true,
    roleKey: 'SUPER_ADMIN',
    permissions: { canViewAll: true }
  };
  var ctx = buildAnalyticsContext('company', fakeAuth, null);

  // Daily report uchun JSON ga o'tkazamiz
  return JSON.stringify({
    summary:            ctx.summary,
    orderGaps:          ctx.orderGaps,
    stuckOrders:        ctx.stuckOrders   ? { count: ctx.stuckOrders.count,   orders: ctx.stuckOrders.orders.slice(0, 10)   } : null,
    duplicateOrders:    ctx.duplicateOrders ? { count: ctx.duplicateOrders.count, list: ctx.duplicateOrders.list.slice(0, 5) } : null,
    financialAnomalies: ctx.financialAnomalies ? { list: ctx.financialAnomalies.list.slice(0, 5), avg: ctx.financialAnomalies.avgPerRecord } : null,
    staffWorkload:      ctx.staffWorkload  ? { top5: ctx.staffWorkload.top5_busiest } : null,
    noProgress:         ctx.noProgressRecords
  });
}