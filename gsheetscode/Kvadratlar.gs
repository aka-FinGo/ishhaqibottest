// ============================================================
// KVADRATLAR.GS — Measurements Management
// ============================================================

var KVADRAT_SHEET_NAME = "Kvadratlar";

var KV_COL = {
  DATE:          0,
  NO:            1,
  MONTH:         2,
  TOTAL_M2:      3,
  ORDER_NAME:    4,
  STAFF_NAME:    5,
  OWNER_TG_ID:   6,
  IS_DELETED:    7
};

var KV_HEADERS = [
  "Sana", "№", "Oy", "Jami m2:", "Buyurtma nomi/Mijoz ismi", "Hodim", "OwnerTgId", "IsDeleted"
];

/**
 * Returns the Kvadratlar sheet, creating it if necessary.
 */
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
    
    // Set column formats
    sh.getRange("A:A").setNumberFormat("dd/MM/yyyy");
    sh.getRange("C:C").setNumberFormat("@"); // Month as text
    sh.getRange("D:D").setNumberFormat("0.00");
    sh.getRange("B:B").setNumberFormat("0");
  }
  return sh;
}

/**
 * Adds a new measurement record.
 */
function kvadratAdd(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKratSheet_internal();
    var lastRow = sh.getLastRow();
    
    // Calculate next Number (№)
    var nextNo = 1;
    if (lastRow > 1) {
      var lastNo = parseInt(sh.getRange(lastRow, KV_COL.NO + 1).getValue(), 10);
      if (!isNaN(lastNo)) nextNo = lastNo + 1;
    }
    
    var today = new Date();
    var monthStr = "_" + String(today.getMonth() + 1).padStart(2, '0');
    
    sh.appendRow([
      today,
      nextNo,
      "'" + monthStr, // Apostrophe to force text
      Number(data.totalM2) || 0,
      String(data.orderName || "").trim(),
      String(data.staffName || "").trim(),
      String(actorTgId),
      0 // IsDeleted = false
    ]);
    
    return { success: true };
  });
}

/**
 * Gets all measurement records.
 */
function kvadratGetAll(options) {
  var sh = getKratSheet_internal();
  var values = sh.getDataRange().getValues();
  var records = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[KV_COL.IS_DELETED]) === "1" || row[KV_COL.IS_DELETED] === true) continue;
    
    records.push({
      rowId:      i + 1,
      date:       formatDateCell(row[KV_COL.DATE]),
      no:         row[KV_COL.NO],
      month:      String(row[KV_COL.MONTH] || '').replace("'", ""),
      totalM2:    Number(row[KV_COL.TOTAL_M2]) || 0,
      orderName:  String(row[KV_COL.ORDER_NAME] || ''),
      staffName:  String(row[KV_COL.STAFF_NAME] || ''),
      ownerTgId:  String(row[KV_COL.OWNER_TG_ID] || '')
    });
  }
  
  // Sort by rowId desc (newest first)
  records.reverse();
  
  return { success: true, data: records };
}

/**
 * Edits a measurement record.
 */
function kvadratEdit(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKratSheet_internal();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: "Qator topilmadi" };
    
    var existing = sh.getRange(row, 1, 1, KV_HEADERS.length).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();
    
    // Permission check: Owner or Admin
    if (!auth.isAdmin && ownerTgId !== String(actorTgId)) {
      return { success: false, error: "Tahrirlashga ruxsat yo'q" };
    }
    
    sh.getRange(row, KV_COL.TOTAL_M2 + 1).setValue(Number(data.totalM2) || 0);
    sh.getRange(row, KV_COL.ORDER_NAME + 1).setValue(String(data.orderName || "").trim());
    sh.getRange(row, KV_COL.STAFF_NAME + 1).setValue(String(data.staffName || "").trim());
    
    return { success: true };
  });
}

/**
 * Deletes a measurement record (Logical delete).
 */
function kvadratDelete(data, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKratSheet_internal();
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: "Qator topilmadi" };
    
    var existing = sh.getRange(row, 1, 1, KV_HEADERS.length).getValues()[0];
    var ownerTgId = String(existing[KV_COL.OWNER_TG_ID] || '').trim();
    
    // Permission check: Owner or Admin
    if (!auth.isAdmin && ownerTgId !== String(actorTgId)) {
      return { success: false, error: "O'chirishga ruxsat yo'q" };
    }
    
    sh.getRange(row, KV_COL.IS_DELETED + 1).setValue(1);
    return { success: true };
  });
}

// Internal helper to avoid recursion or naming conflicts
function getKratSheet_internal() {
  return getKvadratSheet();
}
