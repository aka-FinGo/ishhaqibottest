// ================= TAHRIRLASH VA O'CHIRISH =================
let currentEditScope = 'admin';

function findRecordByRowId(rowId) {
    const rid = String(rowId);
    return globalAdminData.find(x => String(x.rowId) === rid) ||
           myFullRecords.find(x => String(x.rowId) === rid) ||
           null;
}

function openEdit(rowId) {
    currentEditScope = 'admin';
    const r = findRecordByRowId(rowId);
    if (!r) return;

    document.getElementById('editRowId').value     = r.rowId;
    document.getElementById('editAmountUZS').value = r.amountUZS || '';
    document.getElementById('editAmountUSD').value = r.amountUSD || '';
    document.getElementById('editRate').value      = r.rate      || '';
    document.getElementById('editComment').value   = r.comment   || '';

    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    if (eMonth && eYear) {
        if (r.actionPeriod) {
            const parts = r.actionPeriod.split('-');
            eYear.value = parts[0];
            eMonth.value = parts[1];
        } else {
            const dMeta = getDateMonthYear(r.date);
            if (dMeta) { eYear.value = dMeta.year; eMonth.value = dMeta.month; }
        }
    }

    const headerName = document.getElementById('editHeaderName');
    const headerDate = document.getElementById('editHeaderDate');
    if (headerName) headerName.innerText = r.name || '—';
    if (headerDate) headerDate.innerText = r.date || '—';

    // FIX 4: UZS/USD holati ko'rinishi
    updateEditCurrencyView();

    document.getElementById('editModal').classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

function openSelfEdit(rowId) {
    currentEditScope = 'self';
    const r = findRecordByRowId(rowId);
    if (!r) return;

    document.getElementById('editRowId').value     = r.rowId;
    document.getElementById('editAmountUZS').value = r.amountUZS || '';
    document.getElementById('editAmountUSD').value = r.amountUSD || '';
    document.getElementById('editRate').value      = r.rate      || '';
    document.getElementById('editComment').value   = r.comment   || '';

    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    if (eMonth && eYear) {
        if (r.actionPeriod) {
            const parts = r.actionPeriod.split('-');
            eYear.value = parts[0];
            eMonth.value = parts[1];
        } else {
            const dMeta = getDateMonthYear(r.date);
            if (dMeta) { eYear.value = dMeta.year; eMonth.value = dMeta.month; }
        }
    }

    const headerName = document.getElementById('editHeaderName');
    const headerDate = document.getElementById('editHeaderDate');
    if (headerName) headerName.innerText = r.name || '—';
    if (headerDate) headerDate.innerText = r.date || '—';

    updateEditCurrencyView();
    document.getElementById('editModal').classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

// FIX 4: Tahrirlash modalida USD kiritilsa → UZS avtomatik hisoblanadi
//         UZS kiritilsa → USD 0 ga tushadi
function updateEditCurrencyView() {
    const usdVal  = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rateVal = parseFloat(document.getElementById('editRate').value)      || 0;

    const usdRow  = document.getElementById('editUsdRow');
    const rateRow = document.getElementById('editRateRow');
    const preview = document.getElementById('editConversionPreview');

    if (usdVal > 0) {
        // Dollar rejimi
        if (usdRow)  usdRow.style.display  = '';
        if (rateRow) rateRow.style.display = '';
        if (preview && rateVal > 0) {
            const calc = (usdVal * rateVal).toLocaleString();
            preview.innerHTML = `<span style="color:var(--green-dark);font-size:13px;font-weight:600;">
                ≈ ${calc} UZS (${usdVal} × ${rateVal.toLocaleString()})
            </span>`;
            preview.style.display = '';
        } else if (preview) {
            preview.style.display = 'none';
        }
    } else {
        // So'm rejimi
        if (usdRow)  usdRow.style.display  = 'none';
        if (rateRow) rateRow.style.display = 'none';
        if (preview) preview.style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function askActionReason(titleText) {
    const reason = prompt(`${titleText} sababini kiriting:`);
    if (!reason || !String(reason).trim()) {
        showToastMsg('❌ Sabab kiritilishi shart', true);
        return '';
    }
    return String(reason).trim();
}

async function saveEdit() {
    const rowId     = document.getElementById('editRowId').value;
    const amountUSD = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate      = parseFloat(document.getElementById('editRate').value)      || 0;
    const comment   = document.getElementById('editComment').value;
    
    let actionPeriod = '';
    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    if (eMonth && eYear && eMonth.value && eYear.value) {
        actionPeriod = `${eYear.value}-${eMonth.value}`;
    }

    const reason    = askActionReason("Tahrirlash");
    if (!reason) return;

    // FIX 4: UZS ni qayta hisoblash
    let amountUZS;
    if (amountUSD > 0 && rate > 0) {
        amountUZS = amountUSD * rate;  // Dollar × Kurs
    } else {
        amountUZS = parseFloat(document.getElementById('editAmountUZS').value) || 0;
    }

    closeModal();
    if (currentEditScope === 'admin') {
        document.getElementById('adminList').innerHTML = `
            <div class="skeleton skeleton-item"></div>
            <div class="skeleton skeleton-item"></div>`;
    }

    try {
        const action = currentEditScope === 'self' ? 'self_edit' : 'admin_edit';
        const data = await apiRequest({ action, rowId, amountUZS, amountUSD, rate, comment, reason, actionPeriod });
        if (!data.success) {
            showToastMsg('❌ ' + (data.error || 'Saqlashda xato'), true);
            return;
        }
        if (currentEditScope === 'self') {
            const rec = findRecordByRowId(rowId);
            if (rec) {
                rec.amountUZS = Number(amountUZS) || 0;
                rec.amountUSD = Number(amountUSD) || 0;
                rec.rate = Number(rate) || 0;
                rec.comment = comment || '';
                rec.actionPeriod = actionPeriod;
            }
            applyMyFilters();
            showToastMsg('✅ Saqlandi!');
            return;
        }
    } catch {
        showToastMsg('❌ Server xatosi', true);
    } finally {
        if (currentEditScope === 'admin') {
            loadAdminData();
        }
        currentEditScope = 'admin';
    }
}

async function deleteRecord(rowId) {
    if (!confirm("Ushbu ma'lumotni o'chirishga ishonchingiz komilmi?")) return;
    const reason = askActionReason("O'chirish");
    if (!reason) return;
    document.getElementById('adminList').innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    try {
        const data = await apiRequest({ action: "admin_delete", rowId, reason });
        if (!data.success) {
            showToastMsg('❌ ' + (data.error || "O'chirishda xato"), true);
        }
    } catch {
        showToastMsg('❌ Server xatosi', true);
    } finally {
        loadAdminData();
    }
}

async function deleteOwnRecord(rowId) {
    if (!confirm("Ushbu ma'lumotni o'chirishga ishonchingiz komilmi?")) return;
    const reason = askActionReason("O'chirish");
    if (!reason) return;

    try {
        const data = await apiRequest({ action: "self_delete", rowId, reason });
        if (!data.success) {
            showToastMsg('❌ ' + (data.error || "O'chirishda xato"), true);
            return;
        }
        myFullRecords = myFullRecords.filter(function (r) {
            return String(r.rowId) !== String(rowId);
        });
        applyMyFilters();
        showToastMsg("✅ O'chirildi");
    } catch {
        showToastMsg('❌ Server xatosi', true);
    }
}
