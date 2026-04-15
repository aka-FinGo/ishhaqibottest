// ================= BATAFSIL MA'LUMOT MODALI =================

function showDetailModal(r, mode) {
    const uzs  = Number(r.amountUZS) || 0;
    const usd  = Number(r.amountUSD) || 0;
    const rowId = Number(r.rowId) || 0;
    const safeName = escapeHtml(r.name || '—');
    const safeComment = escapeHtml(r.comment || '—');
    const safeDate = escapeHtml(r.date || '—');
    const safePeriod = r.actionPeriod ? escapeHtml(r.actionPeriod) : '';
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
        ? `<div class="detail-row"><span class="detail-key">Xodim</span><span class="detail-val"><strong>${safeName}</strong></span></div>`
        : '';

    let actionBtns = '';
    if (mode === 'admin' || mode === true) {
        const canDel = myRole === 'SuperAdmin' || myPermissions.canDelete;
        const canEd  = myRole === 'SuperAdmin' || myPermissions.canEdit;
        actionBtns = `
        <div style="display:flex;gap:8px;margin-bottom:14px;margin-top:0;">
            ${canEd  ? `<button class="edit-btn" style="flex:1;padding:10px;border-radius:10px;font-size:13px;"
                onclick="closeDetailModal();openEdit(${rowId})">✏️ Tahrirlash</button>` : ''}
            ${canDel ? `<button class="del-btn" style="flex:1;padding:10px;border-radius:10px;font-size:13px;"
                onclick="closeDetailModal();deleteRecord(${rowId})">🗑 O'chirish</button>` : ''}
        </div>`;
    } else if (mode === 'self') {
        actionBtns = `
        <div style="display:flex;gap:8px;margin-bottom:14px;margin-top:0;">
            <button class="edit-btn" style="flex:1;padding:10px;border-radius:10px;font-size:13px;"
                onclick="closeDetailModal();openSelfEdit(${rowId})">✏️ Tahrirlash</button>
            <button class="del-btn" style="flex:1;padding:10px;border-radius:10px;font-size:13px;"
                onclick="closeDetailModal();deleteOwnRecord(${rowId})">🗑 O'chirish</button>
        </div>`;
    }

    document.getElementById('detailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div class="detail-header">
            ${currencyBadge}
            <div class="detail-comment">${safeComment}</div>
            <div class="detail-date">📅 yozildi: ${safeDate}</div>
            ${safePeriod ? `<div class="detail-date" style="margin-top:4px;color:var(--text-main);font-weight:600;">🔄 Davr: ${safePeriod}</div>` : ''}
        </div>
        ${actionBtns}
        <div class="detail-card">
            ${nameRow}
            ${amountRows}
        </div>
        <button class="btn-secondary" style="margin-top:12px;" onclick="closeDetailModal()">✕ Yopish</button>`;

    document.getElementById('detailModal').classList.remove('hidden');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}
