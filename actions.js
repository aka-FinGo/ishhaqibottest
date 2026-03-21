// ================= TAHRIRLASH VA O'CHIRISH =================

function openEdit(rowId) {
    const r = globalAdminData.find(x => String(x.rowId) === String(rowId));
    if (!r) return;

    document.getElementById('editRowId').value     = r.rowId;
    document.getElementById('editAmountUZS').value = r.amountUZS || '';
    document.getElementById('editAmountUSD').value = r.amountUSD || '';
    document.getElementById('editRate').value      = r.rate      || '';
    document.getElementById('editComment').value   = r.comment   || '';

    const headerName = document.getElementById('editHeaderName');
    const headerDate = document.getElementById('editHeaderDate');
    if (headerName) headerName.innerText = r.name || '—';
    if (headerDate) headerDate.innerText = r.date || '—';

    // FIX 4: UZS/USD holati ko'rinishi
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

async function saveEdit() {
    const rowId     = document.getElementById('editRowId').value;
    const amountUSD = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate      = parseFloat(document.getElementById('editRate').value)      || 0;
    const comment   = document.getElementById('editComment').value;

    // FIX 4: UZS ni qayta hisoblash
    let amountUZS;
    if (amountUSD > 0 && rate > 0) {
        amountUZS = amountUSD * rate;  // Dollar × Kurs
    } else {
        amountUZS = parseFloat(document.getElementById('editAmountUZS').value) || 0;
    }

    closeModal();
    document.getElementById('adminList').innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "admin_edit", telegramId, rowId, amountUZS, amountUSD, rate, comment })
    });
    loadAdminData();
}

async function deleteRecord(rowId) {
    if (!confirm("Ushbu ma'lumotni o'chirishga ishonchingiz komilmi?")) return;
    document.getElementById('adminList').innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "admin_delete", telegramId, rowId })
    });
    loadAdminData();
}