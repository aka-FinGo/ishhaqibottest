// ============================================================
// GS_AI_CHAT.GS — Webapp AI Chat backend
// Code.gs da doPost() switch ichiga qo'shiladi:
//   case "ai_chat": result = handleAIChat(data, auth, tgId); break;
// ============================================================

/**
 * Webapp chat so'rovini qayta ishlash
 * @param {Object} data  - { message, history, scope }
 * @param {Object} auth  - checkUserRoles() natijasi
 * @param {string} tgId
 */
function handleAIChat(data, auth, tgId) {
    // Ruxsat tekshirish
    var canUse = auth.isSuperAdmin || auth.isAdmin ||
                 (auth.role === 'Direktor' || auth.roleKey === 'DIRECTOR');
    if (!canUse) {
        return { success: false, error: 'AI chat ruxsati yo\'q' };
    }

    var userMessage = String(data.message || '').trim();
    if (!userMessage) {
        return { success: false, error: 'Xabar bo\'sh' };
    }
    if (userMessage.length > 2000) {
        return { success: false, error: 'Xabar juda uzun (maks 2000 belgi)' };
    }

    // Kontekst to'plash
    var scope = String(data.scope || 'own');
    var canSeeCompany = auth.isSuperAdmin ||
                        (auth.roleKey === 'DIRECTOR') ||
                        auth.permissions.canViewAll;
    if (scope === 'company' && !canSeeCompany) {
        scope = 'own'; // Ruxsat yo'q bo'lsa o'z ma'lumotlariga tushiramiz
    }

    // Suhbat tarixi (oxirgi 10 xabar)
    var history = Array.isArray(data.history) ? data.history.slice(-10) : [];

    // Pro tahlilchi system prompt — GS_AI_ANALYTICS.gs dan
    var systemPrompt = buildAnalyticsSystemPrompt(scope, auth, tgId);

    // AI ga yuborish
    var aiPayload = _buildAIPayload_(systemPrompt, history, userMessage);
    var response = callAIWithPayload_(aiPayload);

    if (!response.success) {
        return { success: false, error: response.error };
    }

    return { success: true, reply: response.text, provider: response.provider };
}

// ============================================================
// KONTEKST TO'PLASH
// ============================================================

function _buildChatContext_(tgId, scope, auth) {
    var ctx = {};

    try {
        if (scope === 'company' && (auth.isSuperAdmin || auth.permissions.canViewAll)) {
            // Kompaniya: umumiy statistika (og'ir ma'lumot emas)
            var allData = adminGetAll({ limit: 200 });
            if (allData && allData.data) {
                ctx.totalRecords = allData.data.length;
                ctx.totalUZS = allData.data.reduce(function(s, r) {
                    return s + (Number(r.amountUZS) || 0);
                }, 0);
                ctx.totalUSD = allData.data.reduce(function(s, r) {
                    return s + (Number(r.amountUSD) || 0);
                }, 0);

                // Hodim bo'yicha guruhlaymiz
                var byStaff = {};
                allData.data.forEach(function(r) {
                    var n = r.name || 'Noma\'lum';
                    if (!byStaff[n]) byStaff[n] = { uzs: 0, usd: 0, count: 0 };
                    byStaff[n].uzs   += Number(r.amountUZS) || 0;
                    byStaff[n].usd   += Number(r.amountUSD) || 0;
                    byStaff[n].count += 1;
                });
                ctx.byStaff = byStaff;

                // Kvadratlar statistikasi
                var kvData = kvadratGetAll ? kvadratGetAll() : null;
                if (kvData && kvData.data) {
                    ctx.totalKvadratlar = kvData.data.length;
                    ctx.totalM2 = kvData.data.reduce(function(s, r) {
                        return s + (Number(r.totalM2) || 0);
                    }, 0);
                }
            }
        } else {
            // Faqat o'z yozuvlari
            var myData = getUserRecords_(tgId);
            if (myData) {
                ctx.myRecordCount = myData.length;
                ctx.myTotalUZS = myData.reduce(function(s, r) {
                    return s + (Number(r.amountUZS) || 0);
                }, 0);
                ctx.myTotalUSD = myData.reduce(function(s, r) {
                    return s + (Number(r.amountUSD) || 0);
                }, 0);
                // Oxirgi 5 ta yozuv
                ctx.myRecent = myData.slice(-5).map(function(r) {
                    return { sana: r.date, summa: r.amountUZS, izoh: r.comment };
                });
            }
        }
    } catch (e) {
        Logger.log('[_buildChatContext_] Kontekst xatosi: ' + e.message);
        ctx.error = 'Kontekst yuklanmadi';
    }

    return ctx;
}

function _buildSystemPrompt_(scope, auth, context) {
    var today = new Date().toLocaleDateString('uz-UZ', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    var base = 'Sen Aristokrat Mebel korxonasining ERP tizimi AI yordamchisisан. ' +
               'Bugun: ' + today + '. ' +
               'Rol: ' + (auth.roleKey || 'USER') + '. ' +
               'Faqat o\'zbek tilida, qisqa va aniq javob ber. ' +
               'Sanoq, jadval talab qilsa markdown ishlatishingiz mumkin. ' +
               'Kompaniya sir ma\'lumotlarini (API kalitlar, bot token) hech qachon oshkor qilma.\n\n';

    if (scope === 'company' && context.totalRecords !== undefined) {
        base += 'KOMPANIYA MA\'LUMOTLARI:\n';
        base += '- Jami yozuvlar: ' + context.totalRecords + '\n';
        base += '- Jami xarajat (UZS): ' + (context.totalUZS || 0).toLocaleString() + '\n';
        base += '- Jami xarajat (USD): ' + (context.totalUSD || 0).toLocaleString() + '\n';
        if (context.totalM2) {
            base += '- Ishlangan kvadratlar: ' + context.totalKvadratlar + ' ta, ' +
                    Number(context.totalM2).toFixed(2) + ' m²\n';
        }
        if (context.byStaff) {
            base += '- Hodimlar bo\'yicha:\n';
            Object.keys(context.byStaff).slice(0, 15).forEach(function(name) {
                var s = context.byStaff[name];
                base += '  • ' + name + ': ' + s.count + ' ta yozuv, ' +
                        s.uzs.toLocaleString() + ' UZS\n';
            });
        }
    } else if (context.myRecordCount !== undefined) {
        base += 'FOYDALANUVCHI MA\'LUMOTLARI:\n';
        base += '- Jami yozuvlar: ' + context.myRecordCount + '\n';
        base += '- Jami (UZS): ' + (context.myTotalUZS || 0).toLocaleString() + '\n';
        base += '- Jami (USD): ' + (context.myTotalUSD || 0).toLocaleString() + '\n';
        if (context.myRecent && context.myRecent.length) {
            base += '- Oxirgi yozuvlar:\n';
            context.myRecent.forEach(function(r) {
                base += '  • ' + r.sana + ': ' + r.summa + ' UZS — ' + (r.izoh || '') + '\n';
            });
        }
    }

    return base;
}

// ============================================================
// AI CHAQIRUV (multi-turn payload)
// ============================================================

function _buildAIPayload_(systemPrompt, history, userMessage) {
    // messages formatida: system + history + yangi xabar
    var messages = [{ role: 'system', content: systemPrompt }];

    history.forEach(function(h) {
        if (h.role === 'user' || h.role === 'assistant') {
            messages.push({ role: h.role, content: String(h.content || '') });
        }
    });

    messages.push({ role: 'user', content: userMessage });

    return messages;
}

/**
 * Faol provayderlarni ustuvorlik bo'yicha aylanib chiqadi.
 * callAI() dan farqi: messages massivi (multi-turn) qabul qiladi.
 */
function callAIWithPayload_(messages) {
    var config = getAIProvidersConfig();
    if (!config.active || config.active.length === 0) {
        return { success: false, error: 'Faol AI provayder topilmadi. Admin paneldan sozlang.' };
    }

    var lastError = '';
    for (var i = 0; i < config.active.length; i++) {
        var p = config.active[i];
        try {
            var result = _callProviderWithMessages_(p, messages);
            if (result.success) {
                return { success: true, text: result.text, provider: p.provider };
            }
            lastError = p.provider + ': ' + result.error;
            Logger.log('[callAIWithPayload_] Fallback: ' + lastError);
        } catch (e) {
            lastError = p.provider + ': ' + e.message;
            Logger.log('[callAIWithPayload_] Exception: ' + lastError);
        }
    }
    return { success: false, error: 'Barcha AI provayderlar xato berdi. Oxirgi: ' + lastError };
}

function _callProviderWithMessages_(provider, messages) {
    var url    = provider.baseURL;
    var apiKey = provider.apiKey;
    var model  = provider.model;

    // Gemini o'ziga xos format
    if (provider.provider === 'Gemini') {
        return _callGeminiChat_(url, apiKey, model, messages);
    }

    // OpenAI-compatible (Groq, OpenRouter, Ollama)
    var payload = JSON.stringify({ model: model, messages: messages, max_tokens: 1024 });
    var options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: payload,
        muteHttpExceptions: true
    };
    var res  = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var json = JSON.parse(res.getContentText());

    if (code !== 200) {
        var errMsg = (json.error && json.error.message) ? json.error.message : 'HTTP ' + code;
        return { success: false, error: errMsg };
    }
    var text = json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content
        : '';
    if (!text) return { success: false, error: 'Bo\'sh javob' };
    return { success: true, text: text.trim() };
}

function _callGeminiChat_(baseURL, apiKey, model, messages) {
    // messages → Gemini contents formatiga o'tkazish
    var contents = [];
    messages.forEach(function(m) {
        if (m.role === 'system') {
            // Gemini system rolini 'user' sifatida qo'shamiz (Gemini 1.5 system_instruction qo'llab-quvvatlaydi)
            contents.push({ role: 'user', parts: [{ text: m.content }] });
            contents.push({ role: 'model', parts: [{ text: 'Tushundim.' }] });
        } else {
            contents.push({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            });
        }
    });

    var url = baseURL + model + ':generateContent?key=' + apiKey;
    var payload = JSON.stringify({ contents: contents });
    var options = {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true
    };
    var res  = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var json = JSON.parse(res.getContentText());

    if (code !== 200) {
        var errMsg = (json.error && json.error.message) ? json.error.message : 'Gemini HTTP ' + code;
        return { success: false, error: errMsg };
    }
    var text = json.candidates && json.candidates[0] &&
               json.candidates[0].content && json.candidates[0].content.parts
        ? json.candidates[0].content.parts.map(function(p) { return p.text; }).join('')
        : '';
    if (!text) return { success: false, error: 'Gemini bo\'sh javob' };
    return { success: true, text: text.trim() };
}

// ============================================================
// YORDAMCHI: foydalanuvchi yozuvlarini olish
// ============================================================

function getUserRecords_(tgId) {
    try {
        var rows = getDataRows_();
        if (!rows || rows.length < 2) return [];
        return rows.slice(1)
            .filter(function(r) {
                return String(r[DATA_COL.TG_ID] || '') === String(tgId) &&
                       !r[DATA_COL.IS_DELETED];
            })
            .map(function(r) {
                return {
                    date:      r[DATA_COL.DATE],
                    amountUZS: r[DATA_COL.AMOUNT_UZS],
                    amountUSD: r[DATA_COL.AMOUNT_USD],
                    comment:   r[DATA_COL.COMMENT]
                };
            });
    } catch (e) {
        Logger.log('[getUserRecords_] ' + e.message);
        return [];
    }
}