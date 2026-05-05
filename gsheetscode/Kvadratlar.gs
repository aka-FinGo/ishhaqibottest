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
  STAFF_NAME:       6,
  OWNER_TG_ID:      7,
  IS_DELETED:       8,
  STEP_INDEX:       9,
  STATUS:           10,
  STEP_LOGS:        11
};

var KV_BASE_HEADERS = [
  "Sana", "№", "Oy", "Yil", "Jami m2:", "Buyurtma nomi/Mijoz ismi", "Kirituvchi", "OwnerTgId", "IsDeleted", 
  "CurrentStep", "Status", "WorkflowLogs"
];

function getKvadratSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KVADRAT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(KVADRAT_SHEET_NAME);
    sh.appendRow(KV_BASE_HEADERS);
    sh.getRange(1, 1, 1, KV_BASE_HEADERS.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  ensureKvadratInfrastructure_(sh);
  return sh;
}

function ensureKvadratInfrastructure_(sh) {
  var config = (typeof getWorkflowConfig === 'function') ? getWorkflowConfig() : [];
  var dynamicHeaders = [];
  config.forEach(function(s) {
    if (s.index > 1) {
      dynamicHeaders.push(s.position + " (Hodim)");
      dynamicHeaders.push(s.position + " (Hodim ID)");
      dynamicHeaders.push(s.position + " (m2)");
      dynamicHeaders.push(s.position + " (Sana)");
    }
  });
  
  var fullHeaders = KV_BASE_HEADERS.concat(dynamicHeaders);
  var currentLastCol = sh.getLastColumn();
  var currentHeaders = sh.getRange(1, 1, 1, Math.max(currentLastCol, 1)).getValues()[0];
  
  var updateNeeded = false;
  var infraVer = "v3"; // Version to force format updates
  var currentInfra = sh.getRange(1, 1).getComment();
  
  if (currentLastCol < fullHeaders.length || currentInfra !== infraVer) {
    updateNeeded = true;
  } else {
    for (var i = 0; i < fullHeaders.length; i++) {
      if (String(currentHeaders[i] || '') !== fullHeaders[i]) {
        updateNeeded = true;
        break;
      }
    }
  }
  
  if (updateNeeded) {
    var requiredTotal = fullHeaders.length;
    if (sh.getMaxColumns() < requiredTotal) {
      sh.insertColumnsAfter(sh.getMaxColumns(), requiredTotal - sh.getMaxColumns());
    }
    sh.getRange(1, 1, 1, requiredTotal).setValues([fullHeaders])
      .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    
    // Set column formats to prevent data type issues (e.g. m2 being seen as date)
    config.forEach(function(s) {
      if (s.index > 1) {
        var startCol = 13 + (s.index - 2) * 4; // 1-indexed column
        // Row 2 to bottom
        var numRows = sh.getMaxRows() - 1;
        if (numRows > 0) {
          // Col 1: Hodim (Text), Col 2: Hodim ID (Text)
          sh.getRange(2, startCol, numRows, 2).setNumberFormat("@");
          // Col 3: m2 (Number)
          sh.getRange(2, startCol + 2, numRows, 1).setNumberFormat("0.00");
          // Col 4: Sana (Date)
          sh.getRange(2, startCol + 3, numRows, 1).setNumberFormat("dd.mm.yyyy HH:mm");
        }
      }
    });

    sh.getRange(1, 1).setComment(infraVer);

    // If it's a migration (e.g. Yil column was missing at index 3)
    if (currentHeaders[3] !== "Yil") {
       migrateKvadratYears();
    }
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
      JSON.stringify([{ step: 1, uid: String(actorTgId), u: auth.username || resolvedStaffName || '—', d: today.toISOString() }])
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
  var reason = String(data.reason || '').trim();
  if (!reason) return { success: false, error: "Tahrirlash sababini ko'rsatishingiz shart!" };

  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) {
      return { success: false, error: 'Qator topilmadi' };
    }

    var existing = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();

    // Ruxsatni tekshirish
    var isAdmin = auth.isSuperAdmin || auth.isAdmin || auth.isDirector;
    var isOwner = ownerTgId === String(actorTgId);
    var canEditAll = isAdmin && auth.permissions.canEdit;

    if (!auth.isSuperAdmin && !canEditAll && !isOwner) {
      return { success: false, error: "Siz faqat o'zingiz kiritgan buyurtmani tahrirlashingiz mumkin!" };
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
    
    addAuditLog_(actorTgId, 'kvadrat_edit', row, null, null, reason);
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
  var reason = String(data.reason || '').trim();
  if (!reason) return { success: false, error: "O'chirish sababini ko'rsatishingiz shart!" };

  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) {
      return { success: false, error: 'Qator topilmadi' };
    }

    var existing = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();

    // Ruxsatni tekshirish
    var isAdmin = auth.isSuperAdmin || auth.isAdmin || auth.isDirector;
    var isOwner = ownerTgId === String(actorTgId);
    var canDeleteAll = isAdmin && auth.permissions.canDelete;

    if (!auth.isSuperAdmin && !canDeleteAll && !isOwner) {
      return { success: false, error: "Siz faqat o'zingiz kiritgan buyurtmani o'chira olasiz!" };
    }

    sh.getRange(row, KV_COL.IS_DELETED + 1).setValue(1);
    addAuditLog_(actorTgId, 'kvadrat_delete', row, null, 'deleted', reason);
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