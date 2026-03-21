// ================= BATAFSIL MA'LUMOT MODALI =================

function showDetailModal(r, canEdit) {
    const uzs  = Number(r.amountUZS) || 0;
    const usd  = Number(r.amountUSD) || 0;
    // FIX: rate turli fieldlarda kelishi mumkin
    const rate = Number(r.rate) || Number(r.exchangeRate) || Number(r.kurs) || 0;
    const isUsd = usd > 0;

    const currencyBadge = isUsd
        ? `<span class="detail-badge usd">💵 Dollar</span>`
        : `<span class="detail-badge uzs">💰 So'm</span>`;

    // FIX: rate 0 bo'lsa hisoblash yo'li bilan topamiz
    const effectiveRate = rate > 0 ? rate : (usd > 0 && uzs > 0 ? Math.round(uzs / usd) : 0);

    let amountRows = '';
    if (isUsd) {
        amountRows = `
        <div class="detail-row">
            <span class="detail-key">Summa (USD)</span>
            <span class="detail-val usd-val">$${usd.toLocaleString()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">Valyuta kursi</span>
            <span class="detail-val">${effectiveRate > 0 ? '1$ = ' + effectiveRate.toLocaleString() + ' UZS' : '—'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">So'mga aylantirish</span>
            <span class="detail-val uzs-val">${uzs.toLocaleString()} UZS</span>
        </div>`;
    } else {
        amountRows = `
        <div class="detail-row">
            <span class="detail-key">Summa (UZS)</span>
            <span class="detail-val uzs-val">${uzs.toLocaleString()} UZS</span>
        </div>`;
    }

    const nameRow = r.name
        ? `<div class="detail-row"><span class="detail-key">Xodim</span><span class="detail-val"><strong>${r.name}</strong></span></div>`
        : '';

    let actionBtns = '';
    if (canEdit) {
        const canDel = myRole === 'SuperAdmin' || myPermissions.canDelete;
        const canEd  = myRole === 'SuperAdmin' || myPermissions.canEdit;
        actionBtns = `
        <div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
            ${canEd  ? `<button class="edit-btn" style="flex:1;padding:13px;border-radius:10px;font-size:14px;"
                onclick="closeDetailModal();openEdit(${r.rowId})">✏️ Tahrirlash</button>` : ''}
            ${canDel ? `<button class="del-btn" style="flex:1;padding:13px;border-radius:10px;font-size:14px;"
                onclick="closeDetailModal();deleteRecord(${r.rowId})">🗑 O'chirish</button>` : ''}
        </div>`;
    }

    document.getElementById('detailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div class="detail-header">
            ${currencyBadge}
            <div class="detail-comment">${r.comment || '—'}</div>
            <div class="detail-date">📅 ${r.date || '—'}</div>
        </div>
        <div class="detail-card">
            ${nameRow}
            ${amountRows}
        </div>
        <button class="btn-secondary" style="margin-top:12px;" onclick="closeDetailModal()">✕ Yopish</button>
        ${actionBtns}`;

    document.getElementById('detailModal').classList.remove('hidden');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}