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
