// ============================================================
// GS_AI_ANALYTICS.GS — Pro darajadagi ma'lumot tahlili
// AI chat va daily report uchun boyitilgan kontekst tayyorlaydi
//
// Qo'shilgan analizlar:
//   1. Buyurtma raqamlaridagi bo'shliq (gap) aniqlovchi
//   2. Workflow qotib qolgan buyurtmalar
//   3. Takroriy buyurtma nomlari (dublikat)
//   4. Hodim yuklamasi balansi
//   5. Moliyaviy anomaliyalar (keskin o'sish/pasayish)
//   6. Status progressiz yozuvlar
// ============================================================

/**
 * AI uchun to'liq boyitilgan kontekst
 * GS_AI_CHAT.gs va GS_AI.gs dan chaqiriladi
 *
 * @param {string} scope - 'company' | 'own'
 * @param {Object} auth
 * @param {string} tgId
 * @returns {Object} context obyekti
 */
function buildAnalyticsContext(scope, auth, tgId) {
  var ctx = {};

  try {
    var kvData      = kvadratGetAll().data   || [];
    var financeData = adminGetAll().data     || [];

    // ── 1. Buyurtma raqam bo'shliqlari ─────────────────────
    ctx.orderGaps = detectOrderGaps_(kvData);

    // ── 2. Workflow'da qotib qolganlar ──────────────────────
    ctx.stuckOrders = detectStuckOrders_(kvData);

    // ── 3. Dublikat buyurtma nomlari ────────────────────────
    ctx.duplicateOrders = detectDuplicateOrders_(kvData);

    // ── 4. Hodim yuklamasi ──────────────────────────────────
    ctx.staffWorkload = buildStaffWorkload_(kvData, financeData);

    // ── 5. Moliyaviy anomaliyalar ───────────────────────────
    ctx.financialAnomalies = detectFinancialAnomalies_(financeData);

    // ── 6. Status progressiz yozuvlar ──────────────────────
    ctx.noProgressRecords = detectNoProgress_(kvData);

    // ── 7. Umumiy statistika ────────────────────────────────
    ctx.summary = buildSummary_(kvData, financeData);

    // ── 8. Foydalanuvchi o'z ma'lumotlari (own scope) ───────
    if (scope === 'own') {
      ctx.myStats = buildMyStats_(tgId, kvData, financeData);
    }

    // ── 9. RAW JSON MA'LUMOTLAR (Q&A uchun) ─────────────────
    if (scope === 'company') {
      ctx.rawFinance = financeData.map(function(r) { return { sana: r.date, ism: r.name, uzs: r.amountUZS, usd: r.amountUSD, izoh: r.comment }; });
      ctx.rawKv = kvData.map(function(r) { return { no: r.no, nom: r.orderName, xodim: r.staffName, m2: r.totalM2, status: r.status, sana: r.date }; });
    } else {
      ctx.rawFinance = financeData.filter(function(r) { return String(r.telegramId) === String(tgId); }).map(function(r) { return { sana: r.date, uzs: r.amountUZS, izoh: r.comment }; });
      ctx.rawKv = kvData.filter(function(r) { return String(r.ownerTgId) === String(tgId); }).map(function(r) { return { no: r.no, nom: r.orderName, m2: r.totalM2, status: r.status }; });
    }

  } catch (e) {
    Logger.log('[buildAnalyticsContext] Xato: ' + e.message);
    ctx.error = e.message;
  }

  return ctx;
}

// ============================================================
// 1. BUYURTMA RAQAM BO'SHLIQLARI
// ============================================================

/**
 * KV_COL.NO maydonidagi raqamlarni tahlil qilib
 * bo'sh raqamlarni (gaps) va tartibsiz raqamlarni aniqlaydi.
 *
 * Misol:
 *   Bazada: 200, 202, 205
 *   Natija: { missing: [201, 203, 204], outOfOrder: [], maxNo: 205, totalOrders: 3 }
 */
function detectOrderGaps_(kvData) {
  // Faqat raqamli "no" larni olamiz
  var numbers = [];
  var nonNumeric = [];

  kvData.forEach(function(r) {
    var raw = String(r.no || '').trim().replace(/[^\d]/g, '');
    if (raw) {
      var n = parseInt(raw, 10);
      if (!isNaN(n) && n > 0) numbers.push({ no: n, orderName: r.orderName, staffName: r.staffName, date: r.date });
    } else if (r.no && String(r.no).trim()) {
      nonNumeric.push(r.no);
    }
  });

  if (numbers.length < 2) {
    return { hasGaps: false, missing: [], note: 'Tahlil uchun yetarli raqamli buyurtma yo\'q' };
  }

  // Takroriy raqamlarni topamiz
  var seen = {};
  var duplicateNos = [];
  numbers.forEach(function(item) {
    if (seen[item.no]) {
      duplicateNos.push(item.no);
    } else {
      seen[item.no] = true;
    }
  });

  var uniqueNos = Object.keys(seen).map(Number).sort(function(a, b) { return a - b; });
  var minNo = uniqueNos[0];
  var maxNo = uniqueNos[uniqueNos.length - 1];

  // Bo'sh raqamlarni topamiz (min dan max gacha)
  var seenSet = {};
  uniqueNos.forEach(function(n) { seenSet[n] = true; });

  var missing = [];
  // Faqat oqilona diapazon (max-min <= 500) tahlil qilinadi
  if (maxNo - minNo <= 500) {
    for (var i = minNo; i <= maxNo; i++) {
      if (!seenSet[i]) missing.push(i);
    }
  }

  // Eng katta bo'shliqlarni topamiz
  var gaps = [];
  for (var j = 0; j < uniqueNos.length - 1; j++) {
    var diff = uniqueNos[j + 1] - uniqueNos[j] - 1;
    if (diff > 0) {
      gaps.push({
        from: uniqueNos[j],
        to:   uniqueNos[j + 1],
        count: diff
      });
    }
  }
  gaps.sort(function(a, b) { return b.count - a.count; });

  return {
    hasGaps:       missing.length > 0,
    missing:       missing.slice(0, 30),     // Max 30 ta ko'rsatamiz
    missingCount:  missing.length,
    topGaps:       gaps.slice(0, 5),         // Eng katta 5 bo'shliq
    duplicateNos:  duplicateNos,
    minNo:         minNo,
    maxNo:         maxNo,
    totalOrders:   numbers.length,
    nonNumericNos: nonNumeric.slice(0, 10),
    completeness:  Math.round((numbers.length / (maxNo - minNo + 1)) * 100)
  };
}

// ============================================================
// 2. WORKFLOW DA QOTIB QOLGAN BUYURTMALAR
// ============================================================

/**
 * Uzoq vaqt davomida bir statusda qolgan buyurtmalarni aniqlaydi.
 * "Qotib qolgan" = 7 kundan ko'p bir statusda.
 */
function detectStuckOrders_(kvData) {
  var now       = new Date();
  var threshold = 7; // kun
  var stuck     = [];

  kvData.forEach(function(r) {
    if (r.status === 'tugallangan' || r.status === 'bekor') return;

    // Oxirgi log sanasini olamiz
    var lastActivity = null;
    if (r.logs && r.logs.length > 0) {
      var lastLog = r.logs[r.logs.length - 1];
      if (lastLog.date) {
        try { lastActivity = new Date(lastLog.date); } catch(e) {}
      }
    }

    // Log bo'lmasa, yozuv sanasini olamiz
    if (!lastActivity && r.date) {
      var parsed = parseDateInput_(r.date, null);
      if (parsed) lastActivity = parsed.dateObj;
    }

    if (!lastActivity) return;

    var daysDiff = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
    if (daysDiff >= threshold) {
      stuck.push({
        no:          r.no,
        orderName:   r.orderName,
        staffName:   r.staffName,
        status:      r.status,
        currentStep: r.currentStep,
        daysStuck:   daysDiff,
        lastActivity: r.date
      });
    }
  });

  stuck.sort(function(a, b) { return b.daysStuck - a.daysStuck; });

  return {
    count:   stuck.length,
    orders:  stuck.slice(0, 15),
    hasStuck: stuck.length > 0
  };
}

// ============================================================
// 3. DUBLIKAT BUYURTMA NOMLARI
// ============================================================

function detectDuplicateOrders_(kvData) {
  var nameMap = {};

  kvData.forEach(function(r) {
    var name = String(r.orderName || '').trim().toLowerCase();
    if (!name) return;
    if (!nameMap[name]) nameMap[name] = [];
    nameMap[name].push({ no: r.no, staffName: r.staffName, date: r.date, status: r.status });
  });

  var duplicates = [];
  Object.keys(nameMap).forEach(function(name) {
    if (nameMap[name].length > 1) {
      duplicates.push({
        orderName: name,
        count:     nameMap[name].length,
        entries:   nameMap[name]
      });
    }
  });

  duplicates.sort(function(a, b) { return b.count - a.count; });

  return {
    hasDuplicates: duplicates.length > 0,
    count:         duplicates.length,
    list:          duplicates.slice(0, 10)
  };
}

// ============================================================
// 4. HODIM YUKLAMASI BALANSI
// ============================================================

function buildStaffWorkload_(kvData, financeData) {
  var workload = {};

  // Kvadratlar bo'yicha
  kvData.forEach(function(r) {
    var name = r.staffName || 'Noma\'lum';
    if (!workload[name]) workload[name] = { kv_count: 0, kv_m2: 0, finance_uzs: 0, active: 0, done: 0 };
    workload[name].kv_count++;
    workload[name].kv_m2 += Number(r.totalM2) || 0;
    if (r.status === 'tugallangan') workload[name].done++;
    else workload[name].active++;
  });

  // Moliya bo'yicha
  financeData.forEach(function(r) {
    var name = r.name || 'Noma\'lum';
    if (!workload[name]) workload[name] = { kv_count: 0, kv_m2: 0, finance_uzs: 0, active: 0, done: 0 };
    workload[name].finance_uzs += Number(r.amountUZS) || 0;
  });

  // Eng ko'p va kam yuklamali
  var sorted = Object.keys(workload).map(function(name) {
    return { name: name, data: workload[name] };
  }).sort(function(a, b) { return b.data.kv_m2 - a.data.kv_m2; });

  return {
    total_staff:  sorted.length,
    top5_busiest: sorted.slice(0, 5),
    top5_least:   sorted.slice(-5).reverse(),
    all:          sorted
  };
}

// ============================================================
// 5. MOLIYAVIY ANOMALIYALAR
// ============================================================

/**
 * Kunlik o'rtachadan 3x yuqori yozuvlarni anomaliya deb belgilaydi.
 */
function detectFinancialAnomalies_(financeData) {
  if (!financeData.length) return { hasAnomalies: false, list: [] };

  // Umumiy o'rtacha hisoblash
  var totalUZS = 0;
  financeData.forEach(function(r) { totalUZS += Number(r.amountUZS) || 0; });
  var avgUZS = totalUZS / financeData.length;

  var anomalies = [];
  financeData.forEach(function(r) {
    var uzs = Number(r.amountUZS) || 0;
    if (uzs > avgUZS * 3) {
      anomalies.push({
        hodim:     r.name,
        amountUZS: uzs,
        avgUZS:    Math.round(avgUZS),
        ratio:     Math.round(uzs / avgUZS * 10) / 10,
        comment:   r.comment,
        date:      r.date
      });
    }
  });

  anomalies.sort(function(a, b) { return b.amountUZS - a.amountUZS; });

  // Kunlik trend (oxirgi 30 kun)
  var dailyTotals = {};
  var now = new Date();
  financeData.forEach(function(r) {
    var parsed = parseDateInput_(r.date, null);
    if (!parsed) return;
    var daysDiff = Math.floor((now - parsed.dateObj) / 86400000);
    if (daysDiff > 30) return;
    var key = parsed.dateObj.toISOString().split('T')[0];
    if (!dailyTotals[key]) dailyTotals[key] = 0;
    dailyTotals[key] += Number(r.amountUZS) || 0;
  });

  var trendDays = Object.keys(dailyTotals).sort();
  var trend = trendDays.map(function(d) { return { date: d, total: dailyTotals[d] }; });

  return {
    hasAnomalies: anomalies.length > 0,
    avgPerRecord: Math.round(avgUZS),
    list:         anomalies.slice(0, 10),
    dailyTrend:   trend
  };
}

// ============================================================
// 6. STATUS PROGRESSIZ YOZUVLAR
// ============================================================

function detectNoProgress_(kvData) {
  var yangi = kvData.filter(function(r) {
    return r.status === 'yangi' || r.currentStep <= 1;
  });

  return {
    count: yangi.length,
    orders: yangi.slice(0, 10).map(function(r) {
      return { no: r.no, orderName: r.orderName, staffName: r.staffName, date: r.date };
    })
  };
}

// ============================================================
// 7. UMUMIY STATISTIKA
// ============================================================

function buildSummary_(kvData, financeData) {
  var totalM2    = kvData.reduce(function(s, r) { return s + (Number(r.totalM2) || 0); }, 0);
  var totalUZS   = financeData.reduce(function(s, r) { return s + (Number(r.amountUZS) || 0); }, 0);
  var totalUSD   = financeData.reduce(function(s, r) { return s + (Number(r.amountUSD) || 0); }, 0);

  var statusMap  = {};
  kvData.forEach(function(r) {
    var s = r.status || 'yangi';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  return {
    kv_total:        kvData.length,
    kv_total_m2:     Math.round(totalM2 * 100) / 100,
    finance_total:   financeData.length,
    finance_uzs:     totalUZS,
    finance_usd:     totalUSD,
    status_breakdown: statusMap
  };
}

// ============================================================
// 8. FOYDALANUVCHI O'Z STATISTIKASI (own scope)
// ============================================================

function buildMyStats_(tgId, kvData, financeData) {
  var myKv  = kvData.filter(function(r) { return String(r.ownerTgId) === String(tgId); });
  var myFin = financeData.filter(function(r) { return String(r.telegramId) === String(tgId); });

  return {
    kv_count:    myKv.length,
    kv_m2:       myKv.reduce(function(s, r) { return s + (Number(r.totalM2) || 0); }, 0),
    kv_active:   myKv.filter(function(r) { return r.status !== 'tugallangan'; }).length,
    kv_done:     myKv.filter(function(r) { return r.status === 'tugallangan'; }).length,
    finance_uzs: myFin.reduce(function(s, r) { return s + (Number(r.amountUZS) || 0); }, 0),
    recent_kv:   myKv.slice(0, 5).map(function(r) {
      return { no: r.no, orderName: r.orderName, status: r.status, m2: r.totalM2 };
    })
  };
}

// ============================================================
// SISTEM PROMPT YARATISH (boyitilgan)
// ============================================================

/**
 * Analytics kontekstidan AI uchun tizim prompt yaratadi.
 * GS_AI_CHAT.gs dagi _buildSystemPrompt_ ni almashtiradi.
 */
function buildAnalyticsSystemPrompt(scope, auth, tgId) {
  var ctx  = buildAnalyticsContext(scope, auth, tgId);
  var today = new Date().toLocaleDateString('uz-UZ', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  var p = 'Sen Aristokrat Mebel korxonasining ERP tizimi uchun PRO darajadagi AI tahlilchisisang. ' +
          'Bugun: ' + today + '. Rol: ' + (auth.roleKey || 'USER') + '.\n' +
          'Qoidalar:\n' +
          '- Faqat o\'zbek tilida, aniq va qisqa javob ber\n' +
          '- Aniqlangan muammolarga DARHOL e\'tibor qarat\n' +
          '- Raqamlar va foizlar bilan ishlat\n' +
          '- Maslahat berar ekan, aniq harakatlar tavsiya qil\n' +
          '- Maxfiy ma\'lumotlar (API key, token) hech qachon oshkor qilma\n\n';

  // Umumiy statistika
  if (ctx.summary) {
    var s = ctx.summary;
    p += '📊 UMUMIY HOLAT:\n';
    p += '- Jami buyurtmalar: ' + s.kv_total + ' ta, ' + s.kv_total_m2 + ' m²\n';
    p += '- Moliyaviy yozuvlar: ' + s.finance_total + ' ta\n';
    p += '- Jami xarajat: ' + _fmt(s.finance_uzs) + ' UZS, ' + _fmt(s.finance_usd) + ' USD\n';
    if (s.status_breakdown) {
      var statuses = Object.keys(s.status_breakdown).map(function(k) {
        return k + ': ' + s.status_breakdown[k];
      }).join(', ');
      p += '- Status taqsimoti: ' + statuses + '\n';
    }
    p += '\n';
  }

  // Buyurtma raqam bo'shliqlari — ENG MUHIM
  if (ctx.orderGaps && ctx.orderGaps.hasGaps) {
    var g = ctx.orderGaps;
    p += '🔴 BUYURTMA RAQAM BO\'SHLIQLARI (MUHIM!):\n';
    p += '- Diapazon: №' + g.minNo + ' – №' + g.maxNo + '\n';
    p += '- Jami buyurtmalar: ' + g.totalOrders + ' ta\n';
    p += '- To\'liqlik: ' + g.completeness + '%\n';
    p += '- Bazaga qo\'shilmagan raqamlar (' + g.missingCount + ' ta): ';
    p += g.missing.length > 20
      ? g.missing.slice(0, 20).join(', ') + '... va yana ' + (g.missingCount - 20) + ' ta'
      : g.missing.join(', ');
    p += '\n';
    if (g.topGaps && g.topGaps.length) {
      p += '- Eng katta bo\'shliqlar:\n';
      g.topGaps.forEach(function(gap) {
        p += '  • №' + gap.from + ' dan №' + gap.to + ' gacha — ' + gap.count + ' ta raqam yo\'q\n';
      });
    }
    if (g.duplicateNos && g.duplicateNos.length) {
      p += '- Takroriy raqamlar: ' + g.duplicateNos.join(', ') + '\n';
    }
    p += '\n';
  } else if (ctx.orderGaps) {
    p += '✅ BUYURTMA RAQAMLARI: Ketma-ketlik to\'g\'ri\n\n';
  }

  // Qotib qolgan buyurtmalar
  if (ctx.stuckOrders && ctx.stuckOrders.hasStuck) {
    var st = ctx.stuckOrders;
    p += '🟡 HARAKATSIZ BUYURTMALAR (' + st.count + ' ta, 7+ kun):\n';
    st.orders.slice(0, 8).forEach(function(o) {
      p += '  • №' + o.no + ' "' + o.orderName + '" — ' + o.daysStuck + ' kun, step: ' + o.currentStep + ', hodim: ' + o.staffName + '\n';
    });
    p += '\n';
  }

  // Dublikatlar
  if (ctx.duplicateOrders && ctx.duplicateOrders.hasDuplicates) {
    var dup = ctx.duplicateOrders;
    p += '🟠 DUBLIKAT BUYURTMA NOMLARI (' + dup.count + ' ta):\n';
    dup.list.slice(0, 5).forEach(function(d) {
      p += '  • "' + d.orderName + '" — ' + d.count + ' marta kiritilgan\n';
    });
    p += '\n';
  }

  // Moliyaviy anomaliyalar
  if (ctx.financialAnomalies && ctx.financialAnomalies.hasAnomalies) {
    var fa = ctx.financialAnomalies;
    p += '💰 MOLIYAVIY ANOMALIYALAR (o\'rtachadan 3x yuqori):\n';
    p += '- O\'rtacha yozuv: ' + _fmt(fa.avgPerRecord) + ' UZS\n';
    fa.list.slice(0, 5).forEach(function(a) {
      p += '  • ' + a.hodim + ': ' + _fmt(a.amountUZS) + ' UZS (x' + a.ratio + ')\n';
    });
    p += '\n';
  }

  // Hodim yuklamasi
  if (ctx.staffWorkload) {
    var sw = ctx.staffWorkload;
    p += '👥 HODIM YUKLAMASI (' + sw.total_staff + ' ta xodim):\n';
    p += '- Eng band:\n';
    sw.top5_busiest.slice(0, 3).forEach(function(s) {
      p += '  • ' + s.name + ': ' + s.data.kv_count + ' buyurtma, ' +
           Math.round(s.data.kv_m2) + ' m²\n';
    });
    p += '- Eng kam yuklamali:\n';
    sw.top5_least.slice(0, 3).forEach(function(s) {
      p += '  • ' + s.name + ': ' + s.data.kv_count + ' buyurtma\n';
    });
    p += '\n';
  }

  // Progresssiz
  if (ctx.noProgressRecords && ctx.noProgressRecords.count > 0) {
    p += '⏳ BOSHLANG\'ICH STATUSDA: ' + ctx.noProgressRecords.count + ' ta buyurtma hali birinchi stepda\n\n';
  }

  // Own scope uchun
  if (scope === 'own' && ctx.myStats) {
    var my = ctx.myStats;
    p += '👤 SIZNING STATISTIKANGIZ:\n';
    p += '- Jami buyurtmalar: ' + my.kv_count + ' ta (' + Math.round(my.kv_m2) + ' m²)\n';
    p += '- Faol: ' + my.kv_active + ', Tugallangan: ' + my.kv_done + '\n';
    p += '- Jami xarajat: ' + _fmt(my.finance_uzs) + ' UZS\n\n';
  }

  // ── KESHDAN JSON MA'LUMOTLAR O'QISH (ScriptProperties) ──
  try {
    var cachedKv = getAiCachedKv();
    var cachedFin = getAiCachedFin();
    var cacheTs = getAiCacheTimestamp();
    
    if (cachedKv.length > 0) {
      // Kalitlarni tiklash: n=raqam, o=buyurtma nomi, x=xodim, m=m2, s=status, d=sana
      p += '📦 BUYURTMALAR JADVALI (' + cachedKv.length + ' ta):\n';
      p += 'Format: {n:raqam, o:buyurtma_nomi, x:xodim, m:m2, s:status, d:sana, oy:oy, y:yil, st:step}\n';
      p += '```json\n' + JSON.stringify(cachedKv) + '\n```\n\n';
    }
    
    if (cachedFin.length > 0) {
      // Kalitlarni tiklash: d=sana, i=ism, u=UZS, $=USD, c=izoh
      p += '📥 MOLIYAVIY YOZUVLAR (' + cachedFin.length + ' ta):\n';
      p += 'Format: {d:sana, i:ism, u:UZS, $:USD, c:izoh}\n';
      p += '```json\n' + JSON.stringify(cachedFin) + '\n```\n\n';
    }
    
    if (cacheTs > 0) {
      p += '🕐 Kesh yangilangan: ' + new Date(cacheTs).toLocaleString('uz-UZ') + '\n\n';
    }
    
    if (cachedKv.length === 0 && cachedFin.length === 0) {
      p += '⚠️ AI kesh bo\'sh. Admin paneldan biror ma\'lumot qo\'shing yoki yangilang — kesh avtomatik quriladi.\n\n';
    }
  } catch(cacheReadErr) {
    Logger.log('[buildAnalyticsSystemPrompt] Kesh o\'qish xato: ' + cacheReadErr.message);
    // Fallback: ctx dagi raw ma'lumotlarni ishlatish
    if (ctx.rawKv && ctx.rawKv.length > 0) {
      p += '📦 BUYURTMALAR (fallback):\n```json\n' + JSON.stringify(ctx.rawKv.slice(-200)) + '\n```\n\n';
    }
    if (ctx.rawFinance && ctx.rawFinance.length > 0) {
      p += '📥 MOLIYAVIY YOZUVLAR (fallback):\n```json\n' + JSON.stringify(ctx.rawFinance.slice(-200)) + '\n```\n\n';
    }
  }

  p += 'MUHIM QOIDALAR:\n';
  p += '- Foydalanuvchi aniq buyurtma raqami so\'rasa (masalan №211), yuqoridagi JSON dan "n" maydoni bo\'yicha izla va TO\'LIQ ma\'lumot ber\n';
  p += '- Aniq hodim haqida so\'ralsa, JSON dagi "x" (xodim) yoki "i" (ism) maydoni bo\'yicha filtrla\n';
  p += '- Aniq oy/sana so\'ralsa, "d","oy","y" maydonlari bo\'yicha filtrla\n';
  p += '- Agar so\'ralgan ma\'lumot JSON da yo\'q bo\'lsa, "topilmadi" dema — kesh bo\'sh bo\'lishi mumkin, admin paneldan keshni yangilashni tavsiya qil\n';
  p += '- Har doim dalilga asoslangan, aniq va batafsil javob ber\n';
  
  return p;
}

function _fmt(n) {
  return Number(n || 0).toLocaleString('uz-UZ');
}