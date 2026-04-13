// ============================================================
// Positions.gs — Dynamic Technical Positions Management
// ============================================================

/**
 * Gets all defined technical positions.
 */
function getAllPositions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Lavozimlar");
  if (!sh) return [];

  var data = sh.getDataRange().getValues();
  var positions = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0]) {
      positions.push({
        name: String(row[0] || '').trim(),
        icon: String(row[1] || '').trim()
      });
    }
  }
  return positions;
}

/**
 * Saves technical positions from Admin panel.
 */
function savePositions(list) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Lavozimlar");
  if (!sh) sh = ss.insertSheet("Lavozimlar");

  sh.clear();
  sh.appendRow(["PositionName", "Icon"]);
  sh.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");

  if (list && list.length) {
    list.forEach(p => {
      if (p.name) {
        sh.appendRow([
          p.name,
          p.icon || ''
        ]);
      }
    });
  }
  return { success: true };
}
