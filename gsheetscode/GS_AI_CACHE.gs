// ============================================================
// GS_AI_CACHE.GS — AI uchun JSON kesh (ScriptProperties da)
//
// Ma'lumotlar o'zgarganda (touchDataVersion chaqirilganda)
// avtomatik ravishda ScriptProperties ga JSON yoziladi.
// AI chat so'rov kelganda — Sheets dan emas, shu keshdan o'qiladi.
//
// Kalitlar:
//   ai_kv_1, ai_kv_2, ...   — Buyurtmalar (chunks)
//   ai_fin_1, ai_fin_2, ... — Moliyaviy yozuvlar (chunks)
//   ai_cache_ts              — Kesh yangilangan vaqt
// ============================================================

var AI_CACHE_CHUNK_SIZE = 8000; // ScriptProperties 9KB limit, xavfsiz 8KB

// ─────────────────────────────────────────────────────────────
// KESHNI QAYTA QURISH — touchDataVersion dan chaqiriladi
// ─────────────────────────────────────────────────────────────

function rebuildAiCache() {
  try {
    var props = PropertiesService.getScriptProperties();

    // ── 1. Eski kesh kalitlarini tozalash ──────────────────
    var allProps = props.getProperties();
    var keysToDelete = Object.keys(allProps).filter(function(k) {
      return k.indexOf('ai_kv_') === 0 || k.indexOf('ai_fin_') === 0;
    });
    if (keysToDelete.length > 0) {
      keysToDelete.forEach(function(k) { props.deleteProperty(k); });
    }

    // ── 2. Buyurtmalar (Kvadratlar) ────────────────────────
    var kvResult = kvadratGetAll();
    var kvData = (kvResult && kvResult.data) ? kvResult.data : [];
    
    var kvCompact = kvData.map(function(r) {
      return {
        n: r.no,           // raqam
        o: r.orderName,    // buyurtma nomi
        x: r.staffName,    // xodim
        m: r.totalM2,      // kvadrat metr
        s: r.status,       // status
        d: r.date,         // sana
        oy: r.month,       // oy
        y: r.year,         // yil
        st: r.currentStep  // qadami
      };
    });

    var kvJson = JSON.stringify(kvCompact);
    var kvChunks = splitToChunks_(kvJson, AI_CACHE_CHUNK_SIZE);
    kvChunks.forEach(function(chunk, i) {
      props.setProperty('ai_kv_' + (i + 1), chunk);
    });
    props.setProperty('ai_kv_count', String(kvChunks.length));

    // ── 3. Moliyaviy yozuvlar ──────────────────────────────
    var finResult = adminGetAll();
    var finData = (finResult && finResult.data) ? finResult.data : [];

    var finCompact = finData.map(function(r) {
      return {
        d: r.date,         // sana
        i: r.name,         // ism
        u: r.amountUZS,    // UZS
        $: r.amountUSD,    // USD
        c: r.comment       // izoh
      };
    });

    var finJson = JSON.stringify(finCompact);
    var finChunks = splitToChunks_(finJson, AI_CACHE_CHUNK_SIZE);
    finChunks.forEach(function(chunk, i) {
      props.setProperty('ai_fin_' + (i + 1), chunk);
    });
    props.setProperty('ai_fin_count', String(finChunks.length));

    // ── 4. Timestamp ───────────────────────────────────────
    props.setProperty('ai_cache_ts', String(Date.now()));

    Logger.log('[rebuildAiCache] Kesh yangilandi: ' + kvCompact.length + ' buyurtma, ' + finCompact.length + ' moliyaviy yozuv, ' +
               kvChunks.length + '+' + finChunks.length + ' chunk');

    return { success: true, kv: kvCompact.length, fin: finCompact.length };

  } catch (e) {
    Logger.log('[rebuildAiCache] XATO: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// KESHDAN O'QISH — AI chat dan chaqiriladi
// ─────────────────────────────────────────────────────────────

function getAiCachedKv() {
  return _readChunkedProp_('ai_kv');
}

function getAiCachedFin() {
  return _readChunkedProp_('ai_fin');
}

function getAiCacheTimestamp() {
  try {
    return Number(PropertiesService.getScriptProperties().getProperty('ai_cache_ts')) || 0;
  } catch(e) { return 0; }
}

// ─────────────────────────────────────────────────────────────
// YORDAMCHILAR
// ─────────────────────────────────────────────────────────────

function splitToChunks_(str, chunkSize) {
  var chunks = [];
  for (var i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.substring(i, i + chunkSize));
  }
  return chunks;
}

function _readChunkedProp_(prefix) {
  try {
    var props = PropertiesService.getScriptProperties();
    var count = Number(props.getProperty(prefix + '_count')) || 0;
    if (count === 0) return [];

    var json = '';
    for (var i = 1; i <= count; i++) {
      json += props.getProperty(prefix + '_' + i) || '';
    }
    return json ? JSON.parse(json) : [];
  } catch (e) {
    Logger.log('[_readChunkedProp_] ' + prefix + ': ' + e.message);
    return [];
  }
}
