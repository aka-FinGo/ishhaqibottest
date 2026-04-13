// ============================================================
// KVADRATLAR.GS — Measurements Management
// ============================================================

var KVADRAT_SHEET_NAME = "Kvadratlar";

var KV_COL = {
  DATE:             0,
  NO:               1,
  MONTH:            2,
  TOTAL_M2:         3,
  ORDER_NAME:       4,
  STAFF_NAME:       5, // Created By
  OWNER_TG_ID:      6,
  IS_DELETED:       7,
  STEP_INDEX:       8,
  STATUS:           9,
  STEP_LOGS:        10
};

var KV_HEADERS = [
  "Sana", "№", "Oy", "Jami m2:", "Buyurtma nomi/Mijoz ismi", "Hodim", "OwnerTgId", "IsDeleted", 
  "CurrentStep", "Status", "WorkflowLogs"
];

function getKvadratSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KVADRAT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(KVADRAT_SHEET_NAME);
    sh.appendRow(KV_HEADERS);
    sh.getRange(1, 1, 1, KV_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#1e293b")
      .setFontColor("#ffffff");
    sh.getRange("A:A").setNumberFormat("dd/MM/yyyy");
    sh.getRange("C:C").setNumberFormat("@");
    sh.getRange("D:D").setNumberFormat("0.00");
    sh.getRange("B:B").setNumberFormat("0");
  }
  return sh;
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
 * Adds a new measurement record.
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

    sh.appendRow([
      today,
      nextNo,
      "'" + monthStr,          // Force text with apostrophe
      Number(data.totalM2) || 0,
      String(data.orderName || '').trim(),
      String(data.staffName || '').trim(),
      String(actorTgId),
      0,
      1, // Step 1: Kiritildi
      "yangi",
      JSON.stringify([{ step: 1, uid: String(actorTgId), d: today.toISOString() }])
    ]);

    var row = sh.getLastRow();
    sh.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(row, 3).setNumberFormat('@');
    sh.getRange(row, 4).setNumberFormat('0.00');

    return { success: true, rowId: row };
  });
}

/**
 * Gets all measurement records.
 */
function kvadratGetAll(options) {
  var sh = getKvadratSheet();
  var values      = sh.getDataRange().getValues();
  var records     = [];
  var userMap     = buildUsernameMap(); // For resolving names from IDs

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var isDeleted = row[KV_COL.IS_DELETED];
    if (isDeleted === 1 || isDeleted === true ||
        String(isDeleted).toLowerCase() === '1' ||
        String(isDeleted).toLowerCase() === 'true') continue;

    // Clean up month: remove leading apostrophe/underscore to get clean value
    var rawMonth = String(row[KV_COL.MONTH] || '');
    var cleanMonth = rawMonth.replace(/^'/, '');   // remove apostrophe
    // Keep "_03" format for frontend filtering

    records.push({
      rowId:      i + 1,
      date:       formatDateCell(row[KV_COL.DATE]),
      no:         Number(row[KV_COL.NO]) || '',
      month:      cleanMonth,                          // "_03" etc
      totalM2:    Number(row[KV_COL.TOTAL_M2]) || 0,
      orderName:  String(row[KV_COL.ORDER_NAME] || ''),
      staffName:         String(row[KV_COL.STAFF_NAME] || ''),
      ownerTgId:         String(row[KV_COL.OWNER_TG_ID] || ''),
      currentStep:       Number(row[KV_COL.STEP_INDEX]) || 1,
      status:            String(row[KV_COL.STATUS] || 'yangi'),
      logs:              (function(){
        try { return JSON.parse(row[KV_COL.STEP_LOGS] || '[]'); }
        catch(e) { return []; }
      })()
    });
  }

  // Newest first
  records.reverse();
  return { success: true, data: records };
}

/**
 * Edits a measurement record.
 */
function kvadratEdit(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) {
      return { success: false, error: 'Qator topilmadi' };
    }

    var existing = sh.getRange(row, 1, 1, KV_HEADERS.length).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();

    // Only owner or admin can edit
    if (!auth.isAdmin && !auth.isSuperAdmin && ownerTgId !== String(actorTgId)) {
      return { success: false, error: "Tahrirlashga ruxsat yo'q" };
    }

    sh.getRange(row, KV_COL.TOTAL_M2    + 1).setValue(Number(data.totalM2) || 0);
    sh.getRange(row, KV_COL.ORDER_NAME  + 1).setValue(String(data.orderName || '').trim());
    sh.getRange(row, KV_COL.STAFF_NAME  + 1).setValue(String(data.staffName || '').trim());

    if (data.month) {
      var monthStr = normalizeKvMonth_(data.month);
      sh.getRange(row, KV_COL.MONTH + 1).setValue("'" + monthStr);
    }

    return { success: true };
  });
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

    if (type === 'yiguvchi') {
      if (!positions.indexOf || positions.indexOf('Yig\'uvchi') === -1) {
        return { success: false, error: 'Sizda "Yig\'uvchi" lavozimi yo\'q' };
      }
      sh.getRange(row, KV_COL.YIGUVCHI_ID     + 1).setValue(String(actorTgId));
      sh.getRange(row, KV_COL.YIGUVCHI_DATE   + 1).setValue(now);
      sh.getRange(row, KV_COL.STATUS         + 1).setValue('yig\'ildi');
    } 
    else if (type === 'qadoqlovchi') {
      if (!positions.indexOf || positions.indexOf('Qadoqlovchi') === -1) {
        return { success: false, error: 'Sizda "Qadoqlovchi" lavozimi yo\'q' };
      }
      sh.getRange(row, KV_COL.QADOQLOVCHI_ID   + 1).setValue(String(actorTgId));
      sh.getRange(row, KV_COL.QADOQLOVCHI_DATE + 1).setValue(now);
      sh.getRange(row, KV_COL.STATUS           + 1).setValue('tayyor');
    }

    return { success: true };
  });
}

function getKratSheet_internal() {
  return getKvadratSheet();
}