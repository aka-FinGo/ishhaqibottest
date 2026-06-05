// ============================================================
// GS_DATAVERSIONS.GS — Jadval versiyalari (lastModified)
// Har bir jadval o'zgarganda uning timestamp i yangilanadi.
// init javobida dataVersions qaytariladi — client faqat
// o'zgargan kalitni qayta yuklaydi.
// ============================================================

var DV_KEYS = {
  KVADRATLAR: 'dv_kvadratlar',
  FINANCE:    'dv_finance',
  EMPLOYEES:  'dv_employees',
  WORKFLOW:   'dv_workflow'
};

/**
 * Jadval versiyasini hozirgi vaqtga yangilaydi.
 * Kvadrat qo'shildi/o'chirildi/o'zgartirildi — shu funksiyani chaqiradi.
 */
function touchDataVersion(key) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty(key, String(Date.now()));
    
    // AI keshni ham yangilash (async tarzda, xato bo'lsa o'tkazib yuborish)
    try { rebuildAiCache(); } catch(cacheErr) {
      Logger.log('[touchDataVersion] AI cache rebuild xato: ' + cacheErr.message);
    }
  } catch(e) {
    Logger.log('[touchDataVersion] ' + key + ': ' + e.message);
  }
}

/**
 * Barcha jadval versiyalarini qaytaradi.
 * init javobiga qo'shiladi.
 * @returns {{ kvadratlar: number, finance: number, employees: number, workflow: number }}
 */
function getDataVersions() {
  try {
    var p = PropertiesService.getScriptProperties();
    return {
      kvadratlar: Number(p.getProperty(DV_KEYS.KVADRATLAR)) || 0,
      finance:    Number(p.getProperty(DV_KEYS.FINANCE))    || 0,
      employees:  Number(p.getProperty(DV_KEYS.EMPLOYEES))  || 0,
      workflow:   Number(p.getProperty(DV_KEYS.WORKFLOW))   || 0
    };
  } catch(e) {
    Logger.log('[getDataVersions] ' + e.message);
    return { kvadratlar: 0, finance: 0, employees: 0, workflow: 0 };
  }
}