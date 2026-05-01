// ============================================================
// KVADRATLAR.GS — Measurements Management
// ============================================================

var KVADRAT_SHEET_NAME = "Kvadratlar";

var KV_COL = {
  DATE:             0,
  NO:               1,
  MONTH:            2,
  YEAR:             3,
  TOTAL_M2:         4,
  ORDER_NAME:       5,
  STAFF_NAME:       6, // Display name (hodim ismi)
  OWNER_TG_ID:      7,
  IS_DELETED:       8,
  STEP_INDEX:       9,
  STATUS:           10,
  STEP_LOGS:        11,
  YIGUVCHI_NAME:   12, // Yig'uvchi ismi
  YIGUVCHI_M2:     13, // Yig'uvchi bajargan m2
  QADOQLOVCHI_NAME:14, // Qadoqlovchi ismi
  QADOQLOVCHI_M2:  15  // Qadoqlovchi bajargan m2
};

var KV_HEADERS = [
  "Sana", "№", "Oy", "Yil", "Jami m2:", "Buyurtma nomi/Mijoz ismi", "Hodim", "OwnerTgId", "IsDeleted", 
  "CurrentStep", "Status", "WorkflowLogs", "Yig'uvchi", "Yig'uvchi m2", "Qadoqlovchi", "Qadoqlovchi m2"
];

function getKvadratSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KVADRAT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(KVADRAT_SHEET_NAME);
    sh.appendRow(KV_HEADERS);
    sh.getRange(1, 1, 1, KV_HEADERS.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  ensureKvadratInfrastructure_(sh);
  return sh;
}

function ensureKvadratInfrastructure_(sh) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, Math.max(lastCol, KV_HEADERS.length)).getValues()[0];
  
  // Check if "Yil" column exists at index 3 (4th column)
  if (headers[KV_COL.YEAR] !== "Yil") {
    sh.insertColumnAfter(3); // Insert after "Oy" (index 2)
    sh.getRange(1, KV_COL.YEAR + 1).setValue("Yil").setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    // Run migration immediately
    migrateKvadratYears();
  }
}

// Sanitize month string — accepts "_03", "03", "3" → stores "_03"
function normalizeKvMonth_(val) {
  if (!val) {
    var m = String(new Date().getMonth() + 1).padStart(2, '0');
    return '_' + m;
  }
  var clean = String(val).replace(/^_+/, '').replace(/^'/, '').trim();
  var num = parseInt(clean, 10);
  if (!isFinite(num) || num < 1 || num > 12) {
    var m2 = String(new Date().getMonth() + 1).padStart(2, '0');
    return '_' + m2;
  }
  return '_' + String(num).padStart(2, '0');
}

/**
 * Hodim tgId orqali ismini hodimlar ro'yxatidan topadi.
 * Avval username map'dan qidiradi, topilmasa staffName ni qaytaradi.
 */
function resolveStaffName_(ownerTgId, fallbackStaffName, userMap) {
  if (!ownerTgId) return fallbackStaffName || '';
  var mapped = userMap && userMap[String(ownerTgId)];
  if (mapped) return mapped;
  return fallbackStaffName || '';
}

/**
 * Adds a new measurement record.
 * staffName hodimlar ro'yxatidan avtomatik olinadi (tgId orqali).
 */
function kvadratAdd(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var lastRow = sh.getLastRow();

    // Auto-increment №
    var nextNo = 1;
    if (lastRow > 1) {
      var lastNo = parseInt(sh.getRange(lastRow, KV_COL.NO + 1).getValue(), 10);
      if (!isNaN(lastNo)) nextNo = lastNo + 1;
    }

    var today = new Date();
    var monthStr = normalizeKvMonth_(data.month);
    var yearStr = String(data.year || today.getFullYear());

    // Hodim ismini hodimlar ro'yxatidan olamiz
    var userMap = buildUsernameMap();
    var resolvedStaffName = resolveStaffName_(actorTgId, data.staffName, userMap);

    var orderNo = String(data.no || '').trim();
    if (!orderNo) {
      orderNo = String(nextNo);
    }

    sh.appendRow([
      today,
      orderNo,
      "'" + monthStr,          // Force text with apostrophe
      "'" + yearStr,           // Year column
      Number(data.totalM2) || 0,
      String(data.orderName || '').trim(),
      resolvedStaffName,       // Hodimlar ro'yxatidan olingan ism
      String(actorTgId),
      0,
      1, // Step 1: Kiritildi
      "yangi",
      JSON.stringify([{ step: 1, uid: String(actorTgId), d: today.toISOString() }])
    ]);

    var row = sh.getLastRow();
    sh.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(row, 3).setNumberFormat('@');
    sh.getRange(row, 4).setNumberFormat('@'); // Year format
    sh.getRange(row, 5).setNumberFormat('0.00');

    return { success: true, rowId: row };
  });
}

function kvadratGetAll(options) {
  var sh = getKvadratSheet();
  var values      = sh.getDataRange().getValues();
  var records     = [];
  var userMap     = buildUsernameMap(); // tgId → username map

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var isDeleted = row[KV_COL.IS_DELETED];
    if (isDeleted === 1 || isDeleted === true ||
        String(isDeleted).toLowerCase() === '1' ||
        String(isDeleted).toLowerCase() === 'true') continue;

    var rawMonth = String(row[KV_COL.MONTH] || '');
    var cleanMonth = rawMonth.replace(/^'/, '');
    var year = String(row[KV_COL.YEAR] || '').replace(/^'/, '');

    var ownerTgId  = String(row[KV_COL.OWNER_TG_ID] || '');
    var staffNameRaw = String(row[KV_COL.STAFF_NAME] || '');
    var resolvedName = resolveStaffName_(ownerTgId, staffNameRaw, userMap);

    records.push({
      rowId:      i + 1,
      date:       formatDateCell(row[KV_COL.DATE]),
      no:         String(row[KV_COL.NO] || ''),
      month:      cleanMonth,
      year:       year,
      totalM2:    Number(row[KV_COL.TOTAL_M2]) || 0,
      orderName:  String(row[KV_COL.ORDER_NAME] || ''),
      staffName:         resolvedName,
      ownerTgId:         ownerTgId,
      currentStep:       Number(row[KV_COL.STEP_INDEX]) || 1,
      status:            String(row[KV_COL.STATUS] || 'yangi'),
      logs:              (function(){
        try { return JSON.parse(row[KV_COL.STEP_LOGS] || '[]'); }
        catch(e) { return []; }
      })(),
      yiguvchiName: String(row[KV_COL.YIGUVCHI_NAME] || ''),
      yiguvchiM2:   Number(row[KV_COL.YIGUVCHI_M2]) || 0,
      qadoqlovchiName: String(row[KV_COL.QADOQLOVCHI_NAME] || ''),
      qadoqlovchiM2:   Number(row[KV_COL.QADOQLOVCHI_M2]) || 0
    });
  }

  records.reverse();
  return { success: true, data: records };
}

function kvadratEdit(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) {
      return { success: false, error: 'Qator topilmadi' };
    }

    var existing = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();

    if (!auth.isAdmin && !auth.isSuperAdmin && ownerTgId !== String(actorTgId)) {
      return { success: false, error: "Tahrirlashga ruxsat yo'q" };
    }

    var targetOwnerId = (data.ownerTgId && String(data.ownerTgId).trim()) ? String(data.ownerTgId).trim() : ownerTgId;
    var userMap = buildUsernameMap();
    var resolvedName = resolveStaffName_(targetOwnerId, data.staffName, userMap);

    sh.getRange(row, KV_COL.TOTAL_M2    + 1).setValue(Number(data.totalM2) || 0);
    if (typeof data.no !== 'undefined') {
      sh.getRange(row, KV_COL.NO + 1).setValue(String(data.no || '').trim());
    }
    sh.getRange(row, KV_COL.ORDER_NAME  + 1).setValue(String(data.orderName || '').trim());
    sh.getRange(row, KV_COL.STAFF_NAME  + 1).setValue(resolvedName);

    if (data.month) {
      var monthStr = normalizeKvMonth_(data.month);
      sh.getRange(row, KV_COL.MONTH + 1).setValue("'" + monthStr);
    }
    if (data.year) {
      sh.getRange(row, KV_COL.YEAR + 1).setValue("'" + String(data.year));
    }

    return { success: true };
  });
}

function migrateKvadratYears() {
  var sh = getKvadratSheet();
  var values = sh.getDataRange().getValues();
  var updated = 0;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var currentYear = String(row[KV_COL.YEAR] || '').trim();
    if (!currentYear) {
      var date = row[KV_COL.DATE];
      var year = new Date().getFullYear();
      if (date instanceof Date) {
        year = date.getFullYear();
      } else if (String(date).indexOf('.') !== -1) {
        var parts = String(date).split('.');
        if (parts.length === 3) year = parts[2];
      }
      sh.getRange(i + 1, KV_COL.YEAR + 1).setValue("'" + year);
      updated++;
    }
  }
  return { success: true, updated: updated };
}

/**
 * Deletes a measurement record (soft delete).
 */
function kvadratDelete(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) {
      return { success: false, error: 'Qator topilmadi' };
    }

    var existing = sh.getRange(row, 1, 1, KV_HEADERS.length).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();

    // Only owner or admin can delete
    if (!auth.isAdmin && !auth.isSuperAdmin && ownerTgId !== String(actorTgId)) {
      return { success: false, error: "O'chirishga ruxsat yo'q" };
    }

    sh.getRange(row, KV_COL.IS_DELETED + 1).setValue(1);
    return { success: true };
  });
}

/**
 * Claims work (Assembly or Packaging).
 * Sets the worker's name AND their m2 (same as totalM2).
 */
function kvadratClaimWork(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: 'Buyurtma topilmadi' };

    var type = data.claimType; // 'yiguvchi' or 'qadoqlovchi'
    var userName = auth.username || 'Noma\'lum';
    var positions = auth.positions || [];
    var now = new Date();
    
    // Get the total m2 for this order
    var totalM2 = Number(sh.getRange(row, KV_COL.TOTAL_M2 + 1).getValue()) || 0;

    if (type === 'yiguvchi') {
      if (!positions.indexOf || positions.indexOf('Yig\'uvchi') === -1) {
        return { success: false, error: 'Sizda "Yig\'uvchi" lavozimi yo\'q' };
      }
      sh.getRange(row, KV_COL.YIGUVCHI_NAME + 1).setValue(userName);
      sh.getRange(row, KV_COL.YIGUVCHI_M2 + 1).setValue(totalM2); // Same as total m2
      sh.getRange(row, KV_COL.STATUS         + 1).setValue('yig\'ildi');
    } 
    else if (type === 'qadoqlovchi') {
      if (!positions.indexOf || positions.indexOf('Qadoqlovchi') === -1) {
        return { success: false, error: 'Sizda "Qadoqlovchi" lavozimi yo\'q' };
      }
      sh.getRange(row, KV_COL.QADOQLOVCHI_NAME + 1).setValue(userName);
      sh.getRange(row, KV_COL.QADOQLOVCHI_M2 + 1).setValue(totalM2); // Same as total m2
      sh.getRange(row, KV_COL.STATUS           + 1).setValue('tayyor');
    }

    return { success: true };
  });
}

/**
 * Mavjud yozuvlardagi Hodim ustunini hodimlar ro'yxatidan yangilaydi.
 * Bu funksiyani bir marta ishga tushirish kerak (migration).
 */
function migrateKvadratStaffNames() {
  var sh = getKvadratSheet();
  var values = sh.getDataRange().getValues();
  var userMap = buildUsernameMap();
  var updated = 0;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var ownerTgId = String(row[KV_COL.OWNER_TG_ID] || '').trim();
    if (!ownerTgId) continue;

    var resolvedName = userMap[ownerTgId];
    if (!resolvedName) continue;

    var currentName = String(row[KV_COL.STAFF_NAME] || '').trim();
    if (currentName !== resolvedName) {
      sh.getRange(i + 1, KV_COL.STAFF_NAME + 1).setValue(resolvedName);
      updated++;
    }
  }

  return { success: true, updated: updated, message: updated + " ta yozuv yangilandi" };
}

function getKratSheet_internal() {
  return getKvadratSheet();
}