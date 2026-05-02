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

  var wfData = wfSheet.getDataRange().getValues();
  if (wfData.length < 2) return { success: false, error: "Bosqichlar yo'q" };

  var hasChanges = false;
  
  // 1. WorkflowSteps ga StepID va ColStart qo'shish
  var headers = wfData[0];
  var needsHeaders = false;
  if (headers.indexOf("StepID") === -1) { headers.push("StepID"); needsHeaders = true; }
  if (headers.indexOf("ColStart") === -1) { headers.push("ColStart"); needsHeaders = true; }
  
  if (needsHeaders) {
    wfSheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    hasChanges = true;
  }

  var stepIdMap = {}; // { eski_index: "step_id" }
  var nextColStart = 12;

  for (var i = 1; i < wfData.length; i++) {
    var row = wfData[i];
    var sIndex = Number(row[0]);
    var sID = String(row[6] || '').trim();
    var sCol = Number(row[7]);

    if (!sID) {
      sID = "step_" + sIndex; // eski index asosida oson ID beramiz
      wfSheet.getRange(i + 1, 7).setValue(sID);
      hasChanges = true;
    }
    
    if (!row[7] && row[7] !== 0) { // ColStart bo'sh bo'lsa
      if (sIndex === 1) {
        sCol = 0;
      } else {
        sCol = nextColStart;
        nextColStart += 4;
      }
      wfSheet.getRange(i + 1, 8).setValue(sCol);
      hasChanges = true;
    }
    
    stepIdMap[sIndex] = sID;
  }

  // 2. Kvadratlar jadvalini migratsiya qilish
  var kvData = kvSheet.getDataRange().getValues();
  var kvChanges = 0;
  
  for (var k = 1; k < kvData.length; k++) {
    var kvRow = kvData[k];
    var currentStep = String(kvRow[KV_COL.STEP_INDEX] || '');
    
    // Agar CurrentStep raqam bo'lsa uni ID ga o'zgartiramiz
    if (!isNaN(parseInt(currentStep, 10)) && currentStep.indexOf('step_') === -1) {
       var newId = stepIdMap[Number(currentStep)];
       if (newId) {
         kvSheet.getRange(k + 1, KV_COL.STEP_INDEX + 1).setValue(newId);
         kvChanges++;
       }
    }
    
    // WorkflowLogs ni ham yangilash
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
           kvSheet.getRange(k + 1, KV_COL.STEP_LOGS + 1).setValue(JSON.stringify(logs));
           if (kvChanges === 0) kvChanges++; // qator o'zgarganini belgilash
         }
       } catch(e) {}
    }
  }

  if (hasChanges || kvChanges > 0) {
    incrementDataVersion();
  }

  return { 
    success: true, 
    message: "Migratsiya yakunlandi. " + kvChanges + " ta buyurtma yangilandi."
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
  var posData = posSheet.getDataRange().getValues();
  var posHeaders = posData[0];
  if (posHeaders.indexOf("PositionID") === -1) {
    posHeaders.push("PositionID");
    posSheet.getRange(1, 1, 1, posHeaders.length).setValues([posHeaders])
            .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  }

  var nameToIdMap = {}; // {"Yig'uvchi": "pos_2"}
  var hasChanges = false;

  for (var i = 1; i < posData.length; i++) {
    var pName = String(posData[i][0] || '').trim();
    if (!pName) continue;
    var pId = String(posData[i][2] || '').trim();
    if (!pId) {
      pId = "pos_" + i;
      posSheet.getRange(i + 1, 3).setValue(pId);
      hasChanges = true;
    }
    // Har xil tutuq belgilarini bitta qilib xaritaga solamiz
    var normalName = pName.toLowerCase().replace(/['`‘]/g, "'");
    nameToIdMap[normalName] = pId;
  }

  // 2. WorkflowSteps dagi PositionName ni PositionID ga o'zgartirish
  if (wfSheet) {
    var wfData = wfSheet.getDataRange().getValues();
    var wfHeaders = wfData[0];
    if (wfHeaders[1] === "PositionName") {
      wfSheet.getRange(1, 2).setValue("PositionID");
      hasChanges = true;
    }
    if (wfHeaders.indexOf("AssignedTgId") === -1) {
      wfSheet.getRange(1, 9).setValue("AssignedTgId");
      hasChanges = true;
    }
    
    for (var w = 1; w < wfData.length; w++) {
      var wPosName = String(wfData[w][1] || '').trim();
      if (wPosName && wPosName.indexOf('pos_') !== 0) {
        var nName = wPosName.toLowerCase().replace(/['`‘]/g, "'");
        if (nameToIdMap[nName]) {
          wfSheet.getRange(w + 1, 2).setValue(nameToIdMap[nName]);
          hasChanges = true;
        }
      }
    }
  }

  // 3. Hodimlar jadvalidagi Lavozimlarni PositionID ga almashtirish
  if (empSheet) {
    var empData = empSheet.getDataRange().getValues();
    for (var e = 1; e < empData.length; e++) {
      var empPosStr = String(empData[e][12] || '').trim(); // COL.LAVOZIM
      if (empPosStr && empPosStr.indexOf('pos_') === -1) { // Faqatgina ism bo'lsa
        var pList = empPosStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var idList = [];
        for (var p = 0; p < pList.length; p++) {
          var nPos = pList[p].toLowerCase().replace(/['`‘]/g, "'");
          if (nameToIdMap[nPos]) idList.push(nameToIdMap[nPos]);
        }
        if (idList.length > 0) {
          empSheet.getRange(e + 1, 13).setValue(idList.join(', '));
          hasChanges = true;
        }
      }
    }
  }

  if (hasChanges) {
    incrementDataVersion();
  }

  return { success: true, message: "Lavozimlar PositionID tizimiga muvaffaqiyatli o'tkazildi!" };
}
