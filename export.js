// ================= EXCEL EKSPORT =================

async function exportToBot(dataList, fileNameBase, scope) {
    if (!dataList || dataList.length === 0) {
        return alert("Eksport uchun ma'lumot yo'q!");
    }

    tg.MainButton.setText("Fayl botga yuborilmoqda...").show();

    try {
        // ============================================================
        // USLUBLAR
        // ============================================================
        const HEADER_STYLE = {
            fill: { patternType: "solid", fgColor: { rgb: "E65100" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 11 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top:    { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left:   { style: "thin", color: { rgb: "CCCCCC" } },
                right:  { style: "thin", color: { rgb: "CCCCCC" } }
            }
        };

        const DATA_STYLE = {
            font: { name: "Arial", sz: 10 },
            alignment: { vertical: "center" },
            border: {
                top:    { style: "thin", color: { rgb: "EEEEEE" } },
                bottom: { style: "thin", color: { rgb: "EEEEEE" } },
                left:   { style: "thin", color: { rgb: "EEEEEE" } },
                right:  { style: "thin", color: { rgb: "EEEEEE" } }
            }
        };

        const NUM_STYLE = {
            ...DATA_STYLE,
            alignment: { horizontal: "right", vertical: "center" },
            numFmt: '#,##0'
        };

        const TOTAL_LABEL_STYLE = {
            font: { bold: true, name: "Arial", sz: 11 },
            alignment: { horizontal: "right", vertical: "center" }
        };

        const TOTAL_NUM_STYLE = {
            font: { bold: true, name: "Arial", sz: 11 },
            alignment: { horizontal: "right", vertical: "center" },
            fill: { patternType: "solid", fgColor: { rgb: "FFF3E0" } },
            numFmt: '#,##0'
        };

        // ============================================================
        // SARLAVHALAR
        // ============================================================
        const headers = ["Sana", "Xodim", "Izoh", "Summa (UZS)", "Summa (USD)", "Kurs (UZS)"];
        const cols    = ["A", "B", "C", "D", "E", "F"];

        const ws = {};
        const range = { s: { c: 0, r: 0 }, e: { c: 5, r: dataList.length + 1 } };

        // Sarlavha qatori (1-qator)
        headers.forEach((h, i) => {
            const cell = { v: h, t: "s", s: HEADER_STYLE };
            ws[cols[i] + "1"] = cell;
        });

        // ============================================================
        // MA'LUMOT QATORLARI
        // ============================================================
        let totalUZS = 0;

        dataList.forEach((r, idx) => {
            const row    = idx + 2; // 2-qatordan boshlanadi
            const isUsd  = Number(r.amountUSD) > 0;
            const uzs    = Number(r.amountUZS) || 0;
            const usd    = Number(r.amountUSD) || 0;
            const rate   = Number(r.rate)      || 0;
            const kurs   = isUsd ? (rate > 0 ? rate : (uzs > 0 && usd > 0 ? Math.round(uzs/usd) : 0)) : 0;

            totalUZS += uzs;

            // Fon — juft/toq qatorlar
            const rowFill = idx % 2 === 0
                ? { patternType: "solid", fgColor: { rgb: "FFFFFF" } }
                : { patternType: "solid", fgColor: { rgb: "FFF8F0" } };

            const dStyle = { ...DATA_STYLE, fill: rowFill };
            const nStyle = { ...NUM_STYLE,  fill: rowFill };

            ws["A" + row] = { v: r.date    || "", t: "s", s: dStyle };
            ws["B" + row] = { v: r.name    || (typeof employeeName !== 'undefined' ? employeeName : ""), t: "s", s: dStyle };
            ws["C" + row] = { v: r.comment || "", t: "s", s: dStyle };
            ws["D" + row] = { v: uzs,  t: "n", s: nStyle };
            ws["E" + row] = { v: usd,  t: "n", s: nStyle };
            ws["F" + row] = { v: isUsd && kurs > 0 ? kurs : "-", t: isUsd && kurs > 0 ? "n" : "s", s: nStyle };
        });

        // ============================================================
        // JAMI QATORI (oxirgi qator)
        // ============================================================
        const totalRow = dataList.length + 2;

        ws["A" + totalRow] = { v: "", t: "s" };
        ws["B" + totalRow] = { v: "", t: "s" };
        ws["C" + totalRow] = { v: "Jami:", t: "s", s: TOTAL_LABEL_STYLE };
        ws["D" + totalRow] = { v: totalUZS, t: "n", s: TOTAL_NUM_STYLE };
        ws["E" + totalRow] = { v: "", t: "s" };
        ws["F" + totalRow] = { v: "", t: "s" };

        // ============================================================
        // USTUN KENGLIKLARI
        // ============================================================
        ws["!ref"]  = XLSX.utils.encode_range(range);
        ws["!cols"] = [
            { wch: 13 },  // A: Sana
            { wch: 22 },  // B: Xodim
            { wch: 35 },  // C: Izoh
            { wch: 16 },  // D: Summa UZS
            { wch: 14 },  // E: Summa USD
            { wch: 14 }   // F: Kurs
        ];

        // Qator balandligi — sarlavha balandroq
        ws["!rows"] = [{ hpt: 20 }]; // sarlavha qatori

        // ============================================================
        // WORKBOOK YARATISH
        // ============================================================
        const wb       = XLSX.utils.book_new();
        wb.Props       = { Title: "Aristokrat Hisobot", Author: "Aristokrat ERP" };
        XLSX.utils.book_append_sheet(wb, ws, "Hisobot");

        const base64   = XLSX.write(wb, { bookType: "xlsx", type: "base64", cellStyles: true });
        const fileName = fileNameBase + "_" + new Date().toISOString().slice(0, 10) + ".xlsx";

        // ============================================================
        // BOTGA YUBORISH
        // ============================================================
        const result = await apiRequest({
            action: "export_to_bot",
            base64,
            fileName,
            scope: scope || 'self'
        }, { timeoutMs: 30000 });
        tg.MainButton.hide();

        if (result.success) {
            tg.showAlert("✅ Hisobot shaxsiy xabaringizga (Botdan) yuborildi!");
        } else {
            throw new Error(result.error || "Yuborishda xatolik");
        }

    } catch (err) {
        tg.MainButton.hide();
        alert("❌ Xatolik: " + err.message);
    }
}

// Xodim o'z hisobotini yuklab oladi
function exportMyExcel() {
    exportToBot(myFilteredRecords, "Hisobot_" + employeeName, "self");
}

// Admin paneldan eksport — agar bitta hodim tanlangan bo'lsa, ism bilan
async function exportAdminExcel() {
    if (!canExportCompanyData) {
        showToastMsg("❌ Kompaniya eksport ruxsati yo'q", true);
        return;
    }
    const empSelect = document.getElementById('filterEmployee');
    const empVal    = empSelect ? empSelect.value : 'all';
    const baseName  = empVal !== 'all'
        ? "Hisobot_" + empVal
        : "Kompaniya_Umumiy_Hisoboti";
    try {
        let exportData = filteredData;
        if (typeof fetchAdminFilteredDataForExport === 'function') {
            exportData = await fetchAdminFilteredDataForExport();
        }
        exportToBot(exportData, baseName, "all");
    } catch (err) {
        showToastMsg('❌ ' + (err.message || 'Eksport xatosi'), true);
    }
}
