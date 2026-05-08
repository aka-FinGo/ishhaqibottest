// ============================================================
// Migration.gs — Tizimni yangi tuzilmaga o'tkazish
// ============================================================

/**
 * Ushbu funksiya barcha mavjud ish oqimlarini va eski buyurtmalarni
 * yangi "StepID" va "ColStart" tizimiga o'tkazadi.
 */
function migrateWorkflowToIDs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var wfSheet = ss.getSheetByName("WorkflowSteps");
  var kvSheet = getKvadratSheet();
  
  if (!wfSheet) return { success: false, error: "WorkflowSteps topilmadi" };

  var wfRange = wfSheet.getDataRange();
  var wfData = wfRange.getValues();
  if (wfData.length < 2) return { success: false, error: "Bosqichlar yo'q" };

  var hasChanges = false;
  
  // 1. WorkflowSteps ga StepID va ColStart qo'shish
  var headers = wfData[0];
  var needsHeaders = false;
  var stepIdCol = headers.indexOf("StepID");
  var colStartCol = headers.indexOf("ColStart");

  if (stepIdCol === -1) { headers.push("StepID"); stepIdCol = headers.length - 1; needsHeaders = true; }
  if (colStartCol === -1) { headers.push("ColStart"); colStartCol = headers.length - 1; needsHeaders = true; }
  
  if (needsHeaders) {
    // Agar headerlar qo'shilgan bo'lsa, barcha qatorlarni kengaytiramiz
    for (var r = 0; r < wfData.length; r++) {
      while (wfData[r].length < headers.length) wfData[r].push("");
    }
    wfData[0] = headers;
    hasChanges = true;
  }

  var stepIdMap = {}; // { eski_index: "step_id" }
  var nextColStart = 12;

  for (var i = 1; i < wfData.length; i++) {
    var row = wfData[i];
    var sIndex = Number(row[0]);
    var sID = String(row[stepIdCol] || '').trim();
    var sCol = Number(row[colStartCol]);

    if (!sID) {
      sID = "step_" + sIndex;
      wfData[i][stepIdCol] = sID;
      hasChanges = true;
    }
    
    if (!row[colStartCol] && row[colStartCol] !== 0) {
      if (sIndex === 1) {
        sCol = 0;
      } else {
        sCol = nextColStart;
        nextColStart += 4;
      }
      wfData[i][colStartCol] = sCol;
      hasChanges = true;
    }
    
    stepIdMap[sIndex] = sID;
  }

  if (hasChanges) {
    wfSheet.getRange(1, 1, wfData.length, headers.length).setValues(wfData);
    wfSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  }

  // 2. Kvadratlar jadvalini migratsiya qilish
  var kvRange = kvSheet.getDataRange();
  var kvData = kvRange.getValues();
  var kvChangesCount = 0;
  var hasKvChanges = false;
  
  for (var k = 1; k < kvData.length; k++) {
    var kvRow = kvData[k];
    var currentStep = String(kvRow[KV_COL.STEP_INDEX] || '');
    var rowChanged = false;
    
    if (!isNaN(parseInt(currentStep, 10)) && currentStep.indexOf('step_') === -1) {
       var newId = stepIdMap[Number(currentStep)];
       if (newId) {
         kvData[k][KV_COL.STEP_INDEX] = newId;
         rowChanged = true;
       }
    }
    
    var rawLogs = String(kvRow[KV_COL.STEP_LOGS] || '');
    if (rawLogs.indexOf('"step":') !== -1 && rawLogs.indexOf('"stepId":') === -1) {
       try {
         var logs = JSON.parse(rawLogs);
         var logChanged = false;
         for (var l = 0; l < logs.length; l++) {
           if (!logs[l].stepId && logs[l].step) {
             logs[l].stepId = stepIdMap[logs[l].step] || ("step_" + logs[l].step);
             logChanged = true;
           }
         }
         if (logChanged) {
           kvData[k][KV_COL.STEP_LOGS] = JSON.stringify(logs);
           rowChanged = true;
         }
       } catch(e) {}
    }

    if (rowChanged) {
      hasKvChanges = true;
      kvChangesCount++;
    }
  }

  if (hasKvChanges) {
    kvRange.setValues(kvData);
  }

  if (hasChanges || hasKvChanges) {
    incrementDataVersion();
  }

  return { 
    success: true, 
    message: "Migratsiya yakunlandi. " + kvChangesCount + " ta buyurtma yangilandi."
  };
}

/**
 * Ushbu funksiya "Lavozimlar", "WorkflowSteps" va "Hodimlar" jadvallarini
 * yagona PositionID tizimiga o'tkazadi.
 */
function migratePositionsToIDs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var posSheet = ss.getSheetByName("Lavozimlar");
  var wfSheet = ss.getSheetByName("WorkflowSteps");
  var empSheet = ss.getSheetByName("Hodimlar");
  
  if (!posSheet) return { success: false, error: "Lavozimlar topilmadi" };

  // 1. Lavozimlarga PositionID qo'shish
  var posRange = posSheet.getDataRange();
  var posData = posRange.getValues();
  var posHeaders = posData[0];
  var posIdCol = posHeaders.indexOf("PositionID");
  var hasPosChanges = false;

  if (posIdCol === -1) {
    posHeaders.push("PositionID");
    posIdCol = posHeaders.length - 1;
    for (var r = 0; r < posData.length; r++) {
      posData[r].push(r === 0 ? "PositionID" : "");
    }
    hasPosChanges = true;
  }

  var nameToIdMap = {};
  for (var i = 1; i < posData.length; i++) {
    var pName = String(posData[i][0] || '').trim();
    if (!pName) continue;
    var pId = String(posData[i][posIdCol] || '').trim();
    if (!pId) {
      pId = "pos_" + i;
      posData[i][posIdCol] = pId;
      hasPosChanges = true;
    }
    var normalName = pName.toLowerCase().replace(/['`‘]/g, "'");
    nameToIdMap[normalName] = pId;
  }

  if (hasPosChanges) {
    posSheet.getRange(1, 1, posData.length, posHeaders.length).setValues(posData);
    posSheet.getRange(1, 1, 1, posHeaders.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  }

  var globalHasChanges = hasPosChanges;

  // 2. WorkflowSteps dagi PositionName ni PositionID ga o'zgartirish
  if (wfSheet) {
    var wfRange = wfSheet.getDataRange();
    var wfData = wfRange.getValues();
    var wfHeaders = wfData[0];
    var hasWfChanges = false;

    if (wfHeaders[1] === "PositionName") {
      wfData[0][1] = "PositionID";
      hasWfChanges = true;
    }
    var assignedCol = wfHeaders.indexOf("AssignedTgId");
    if (assignedCol === -1) {
      wfHeaders.push("AssignedTgId");
      assignedCol = wfHeaders.length - 1;
      for (var wr = 0; wr < wfData.length; wr++) {
        wfData[wr].push(wr === 0 ? "AssignedTgId" : "");
      }
      hasWfChanges = true;
    }
    
    for (var w = 1; w < wfData.length; w++) {
      var wPosName = String(wfData[w][1] || '').trim();
      if (wPosName && wPosName.indexOf('pos_') !== 0) {
        var nName = wPosName.toLowerCase().replace(/['`‘]/g, "'");
        if (nameToIdMap[nName]) {
          wfData[w][1] = nameToIdMap[nName];
          hasWfChanges = true;
        }
      }
    }
    if (hasWfChanges) {
      wfSheet.getRange(1, 1, wfData.length, wfHeaders.length).setValues(wfData);
      globalHasChanges = true;
    }
  }

  // 3. Hodimlar jadvalidagi Lavozimlarni PositionID ga almashtirish
  if (empSheet) {
    var empRange = empSheet.getDataRange();
    var empData = empRange.getValues();
    var hasEmpChanges = false;
    for (var e = 1; e < empData.length; e++) {
      var empPosStr = String(empData[e][12] || '').trim(); // COL.LAVOZIM
      if (empPosStr && empPosStr.indexOf('pos_') === -1) {
        var pList = empPosStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var idList = [];
        for (var p = 0; p < pList.length; p++) {
          var nPos = pList[p].toLowerCase().replace(/['`‘]/g, "'");
          if (nameToIdMap[nPos]) idList.push(nameToIdMap[nPos]);
        }
        if (idList.length > 0) {
          empData[e][12] = idList.join(', ');
          hasEmpChanges = true;
        }
      }
    }
    if (hasEmpChanges) {
      empRange.setValues(empData);
      globalHasChanges = true;
    }
  }

  if (globalHasChanges) {
    incrementDataVersion();
  }

  return { success: true, message: "Lavozimlar PositionID tizimiga muvaffaqiyatli o'tkazildi!" };
}
