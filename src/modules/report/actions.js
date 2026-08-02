let currentEditScope = 'admin';

function findRecordByRowId(rowId) {
    const rid = String(rowId);
    return globalAdminData.find(x => String(x.rowId) === rid) || myFullRecords.find(x => String(x.rowId) === rid) || null;
}

function openEdit(rowId) {
    currentEditScope = 'admin';
    const r = findRecordByRowId(rowId);
    if (!r) return;
    
    document.getElementById('editRowId').value = r.rowId;
    document.getElementById('editAmountUZS').value = r.amountUZS || '';
    document.getElementById('editAmountUSD').value = r.amountUSD || '';
    document.getElementById('editRate').value = r.rate || '';
    document.getElementById('editComment').value = r.comment || '';
    
    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    
    if (eMonth && eYear) {
        if (r.actionPeriod) {
            const parts = r.actionPeriod.split('-');
            eYear.value = parts[0];
            eMonth.value = parts[1];
        } else {
            const dMeta = getDateMonthYear(r.date);
            if (dMeta) {
                eYear.value = dMeta.year;
                eMonth.value = dMeta.month;
            }
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

function openSelfEdit(rowId) {
    currentEditScope = 'self';
    const r = findRecordByRowId(rowId);
    if (!r) return;
    
    document.getElementById('editRowId').value = r.rowId;
    document.getElementById('editAmountUZS').value = r.amountUZS || '';
    document.getElementById('editAmountUSD').value = r.amountUSD || '';
    document.getElementById('editRate').value = r.rate || '';
    document.getElementById('editComment').value = r.comment || '';
    
    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    
    if (eMonth && eYear) {
        if (r.actionPeriod) {
            const parts = r.actionPeriod.split('-');
            eYear.value = parts[0];
            eMonth.value = parts[1];
        } else {
            const dMeta = getDateMonthYear(r.date);
            if (dMeta) {
                eYear.value = dMeta.year;
                eMonth.value = dMeta.month;
            }
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

function onEditRateInput(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 5) val = val.slice(0, 5);
    input.value = val;

    const warn = document.getElementById('editRateWarning');
    const num = parseInt(val, 10);
    const usdVal = parseFloat(document.getElementById('editAmountUSD').value) || 0;

    if (val.length > 0 && (num < 11000 || num > 13000)) {
        if (warn) warn.style.display = 'block';
        input.style.borderColor = '#EF4444';
        input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
    } else {
        if (warn) warn.style.display = 'none';
        input.style.borderColor = '';
        input.style.boxShadow = '';
    }

    updateEditCurrencyView('RATE');
}

function updateEditCurrencyView(source) {
    const uzsEl = document.getElementById('editAmountUZS');
    const usdEl = document.getElementById('editAmountUSD');
    const rateEl = document.getElementById('editRate');
    const preview = document.getElementById('editConversionPreview');
    const submitBtn = document.querySelector('#editForm button[type="submit"]');

    if (!uzsEl || !usdEl || !rateEl) return;

    let uzsVal = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(uzsEl.value) : (parseFloat(String(uzsEl.value || '').replace(/\s+/g, '')) || 0);
    let usdVal = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(usdEl.value) : (parseFloat(String(usdEl.value || '').replace(/\s+/g, '')) || 0);
    let rateVal = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(rateEl.value) : (parseFloat(String(rateEl.value || '').replace(/\s+/g, '')) || 0);
    let isRateValid = true;

    if (rateEl.value.trim() !== '') {
        if (rateVal < 11000 || rateVal > 13000) {
            isRateValid = false;
        }
    }

    if (source === 'UZS' && rateVal > 0) {
        usdVal = uzsVal / rateVal;
        const formattedUsd = (usdVal % 1 === 0) ? usdVal.toString() : usdVal.toFixed(2);
        usdEl.value = (typeof formatSpaceNumberInput === 'function') ? formattedUsd.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : formattedUsd;
    } else if ((source === 'USD' || source === 'RATE') && rateVal > 0 && usdVal > 0 && isRateValid) {
        uzsVal = Math.round(usdVal * rateVal);
        const formattedUzs = uzsVal.toString();
        uzsEl.value = (typeof formatSpaceNumberInput === 'function') ? formattedUzs.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : formattedUzs;
    }

    if (submitBtn) {
        submitBtn.disabled = !isRateValid;
        submitBtn.style.opacity = isRateValid ? '1' : '0.5';
        submitBtn.style.cursor = isRateValid ? 'pointer' : 'not-allowed';
    }

    if (preview) {
        if (usdVal > 0 && rateVal > 0 && isRateValid) {
            const calc = (usdVal * rateVal).toLocaleString();
            preview.innerHTML = `<span style="color:var(--green-dark);font-size:13px;font-weight:600;">≈ ${calc} UZS (${usdVal} × ${rateVal.toLocaleString()})</span>`;
            preview.style.display = '';
        } else {
            preview.style.display = 'none';
        }
    }
}
function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function askActionReason(titleText, msg = "Sababni kiriting:") {
    if (document.activeElement) document.activeElement.blur();
    return new Promise(resolve => {
        showCustomConfirm(
            titleText,
            msg,
            "Tasdiqlash",
            "Bekor qilish",
            true,
            (reason) => resolve(reason), 
            () => resolve('') 
        );
    });
}

function askConfirmDialog(titleText, msg = "Tasdiqlaysizmi?") {
    if (document.activeElement) document.activeElement.blur();
    return new Promise(resolve => {
        showCustomConfirm(
            titleText,
            msg,
            "Ha, o'chirish",
            "Bekor",
            false,
            () => resolve(true),
            () => resolve(false)
        );
    });
}

async function saveEdit(){
    const rowId = document.getElementById('editRowId').value;
    const r = findRecordByRowId(rowId);
    if (!r) return;

    const isAdmin = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor' || myRole === 'Bugalter';
    const canEditAll = isAdmin && myPermissions.canEdit;
    const isOwner = String(r.telegramId) === String(telegramId);

    if (!canEditAll && !isOwner) {
        showToastMsg("❌ Siz faqat o'zingiz kiritgan ma'lumotni tahrirlay olasiz", true);
        return;
    }

    const amountUSD = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(document.getElementById('editAmountUSD').value) : (parseFloat(String(document.getElementById('editAmountUSD').value || '').replace(/\s+/g, '')) || 0);
    const rate = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(document.getElementById('editRate').value) : (parseFloat(String(document.getElementById('editRate').value || '').replace(/\s+/g, '')) || 0);
    
    const usdVal = parseFloat(amountUSD) || 0;
    const rateVal = parseFloat(rate) || 0;

    if (usdVal > 0) {
        if (!rateVal || rateVal < 11000 || rateVal > 13000) {
            const rateInput = document.getElementById('editRate');
            const warn = document.getElementById('editRateWarning');
            const btn = document.querySelector('#editForm button[type="submit"]');

            if (rateInput) {
                rateInput.style.borderColor = '#EF4444';
                rateInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
                rateInput.focus();
            }
            if (warn) warn.style.display = 'block';
            
            showToastMsg("❌ Tahrirlashda xatolik: Kurs 11 000 — 13 000 oralig'ida bo'lishi kerak!", true);
            
            if (btn) {
                btn.disabled = false;
                btn.innerText = '💾 Saqlash';
            }
            return; 
        }
    }

    const comment = document.getElementById('editComment').value;
    let actionPeriod = '';
    const eMonth = document.getElementById('editActionMonth');
    const eYear = document.getElementById('editActionYear');
    if (eMonth && eYear && eMonth.value && eYear.value) {
        actionPeriod = `${eYear.value}-${eMonth.value}`;
    }

    const reason = await askActionReason("Tahrirlash sababini kiriting");
    if (!reason) return;

    let amountUZS;
    if (amountUSD > 0 && rate > 0) {
        amountUZS = amountUSD * rate;
    } else {
        amountUZS = (typeof parseFormattedNumber === 'function') ? parseFormattedNumber(document.getElementById('editAmountUZS').value) : (parseFloat(String(document.getElementById('editAmountUZS').value || '').replace(/\s+/g, '')) || 0);
    }

    const saveBtn = document.querySelector('#editForm .btn-main[type="submit"]');
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');
    closeModal();

    if (currentEditScope === 'admin') {
        document.getElementById('adminList').innerHTML = `<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>`;
    }

    try {
        const action = currentEditScope === 'self' ? 'self_edit' : 'admin_edit';
        const data = await apiRequest({
            action,
            rowId,
            amountUZS,
            amountUSD,
            rate,
            comment,
            reason,
            actionPeriod,
            date: r.date,
            dateISO: r.dateISO
        });
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
        } else {
            showToastMsg('✅ Saqlandi!');
        }
    } catch {
        showToastMsg('❌ Server xatosi', true);
    } finally {
        setButtonLoading(saveBtn, false);
        if (currentEditScope === 'admin') {
            loadAdminData();
        }
        currentEditScope = 'admin';
    }
}

async function deleteRecord(rowId) {
    const r = findRecordByRowId(rowId);
    if (!r) return;

    const isAdmin = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor' || myRole === 'Bugalter';
    const canDeleteAll = isAdmin && myPermissions.canDelete;
    const isOwner = String(r.telegramId) === String(telegramId);

    if (!canDeleteAll && !isOwner) {
        showToastMsg("❌ Siz faqat o'zingiz kiritgan ma'lumotni o'chira olasiz", true);
        return;
    }

    const isOk = await askConfirmDialog("Ma'lumotni o'chirish", "Ushbu amalni butunlay o'chirishga ishonchingiz komilmi?");
    if (!isOk) return;
    
    const reason = await askActionReason("O'chirish sababini kiriting");
    if (!reason) return;

    document.getElementById('adminList').innerHTML = `<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>`;
    try {
        const data = await apiRequest({ action: "admin_delete", rowId, reason });
        if (!data.success) {
            showToastMsg('❌ ' + (data.error || "O'chirishda xato"), true);
        } else {
            showToastMsg("✅ O'chirildi");
        }
    } catch {
        showToastMsg('❌ Server xatosi', true);
    } finally {
        loadAdminData();
    }
}

async function deleteOwnRecord(rowId) {
    const r = findRecordByRowId(rowId);
    if (!r) return;

    if (String(r.telegramId) !== String(telegramId)) {
        showToastMsg("❌ Siz faqat o'zingiz kiritgan ma'lumotni o'chira olasiz", true);
        return;
    }

    const isOk = await askConfirmDialog("Ma'lumotni o'chirish", "Ushbu amalni butunlay o'chirishga ishonchingiz komilmi?");
    if (!isOk) return;

    const reason = await askActionReason("O'chirish sababini kiriting");
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

function handleFabAction() {
    if (typeof switchTab === 'function') switchTab('addTab', 'nav-add');
}

function cancelAdd() {
    if (typeof switchTab === 'function') switchTab('kvadratTab', 'nav-kvadrat');
}

function contactAdmin() {
    alert("Iltimos, adminga murojaat qiling.");
}

function formatSpaceNumberInput(el) {
    if (!el) return;
    let v = el.value.replace(/\s+/g, '');
    if (!isNaN(v) && v !== '') {
        el.value = Number(v).toLocaleString('ru-RU');
    }
}

function updateAddCurrencyView() {}
function toggleRate() {}
function onRateInput() {}
function toggleAvansForm() {}
function requestAvans() {}
function saveActionUI() {}

window.openEdit = openEdit;
window.openSelfEdit = openSelfEdit;
window.closeModal = closeModal;
if (typeof closeEditModal === 'function') window.closeEditModal = closeEditModal; else window.closeEditModal = closeModal;
window.saveEdit = saveEdit;
window.deleteRecord = deleteRecord;
window.deleteOwnRecord = deleteOwnRecord;
window.deleteSelfRecord = deleteOwnRecord;
window.handleFabAction = handleFabAction;
window.contactAdmin = contactAdmin;
window.formatSpaceNumberInput = formatSpaceNumberInput;
window.updateAddCurrencyView = updateAddCurrencyView;
window.toggleRate = toggleRate;
window.onRateInput = onRateInput;
window.cancelAdd = cancelAdd;
window.toggleAvansForm = toggleAvansForm;
window.requestAvans = requestAvans;
window.saveActionUI = saveActionUI;
window.updateEditCurrencyView = updateEditCurrencyView;
window.onEditRateInput = onEditRateInput;
