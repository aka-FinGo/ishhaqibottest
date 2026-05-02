function showDetailModal(r, mode) {
    const uzs = Number(r.amountUZS) || 0;
    const usd = Number(r.amountUSD) || 0;
    const rowId = Number(r.rowId) || 0;
    const safeName = escapeHtml(r.name || '—');
    const safeComment = escapeHtml(r.comment || '—');
    const safeDate = escapeHtml(r.date || '—');
    const safePeriod = r.actionPeriod ? escapeHtml(r.actionPeriod) : '';
    const rate = Number(r.rate) || Number(r.exchangeRate) || Number(r.kurs) || 0;

    // Tahrirlash tarixi ma'lumotlari
    const isEdited = !!r.editReason;
    const safeEditReason = isEdited ? escapeHtml(r.editReason) : '';
    const oldUzs = Number(r.oldAmountUZS) || 0;
    const oldUsd = Number(r.oldAmountUSD) || 0;

    const isUsd = usd > 0;
    const effectiveRate = rate > 0 ? rate : (usd > 0 && uzs > 0 ? Math.round(uzs / usd) : 0);

    let editHistoryBlock = '';
    if (isEdited) {
        editHistoryBlock = `
        <div style="background:#FFFBEB; border:1px solid #FEF3C7; border-radius:12px; padding:12px; margin-bottom:15px;">
            <div style="font-size:10px; font-weight:800; color:#B45309; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                <span>📝</span> Tahrirlash Tarixi
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:12px; color:#92400E;">Eski Summa:</span>
                <span style="font-size:12px; font-weight:700; color:#92400E; text-decoration:line-through;">
                    ${oldUsd > 0 ? '$' + oldUsd.toLocaleString() : oldUzs.toLocaleString() + ' UZS'}
                </span>
            </div>
            <div style="font-size:12px; color:#92400E; display:flex; gap:6px;">
                <span style="opacity:0.8;">Sabab:</span>
                <span style="font-weight:600;">${safeEditReason}</span>
            </div>
        </div>
        `;
    }

    let actionBtns = '';
    if (mode === 'admin' || mode === true) {
        const canDel = myRole === 'SuperAdmin' || myPermissions.canDelete;
        const canEd = myRole === 'SuperAdmin' || myPermissions.canEdit;
        const editBtn = canEd ? `<button style="width:36px; height:36px; border-radius:10px; background:#FEF3C7; color:#92400E; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="Tahrirlash" onclick="closeDetailModal();openEdit(${rowId})">✏️</button>` : '';
        const deleteBtn = canDel ? `<button style="width:36px; height:36px; border-radius:10px; background:#FEE2E2; color:#991B1B; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="O'chirish" onclick="closeDetailModal();deleteRecord(${rowId})">🗑</button>` : '';
        actionBtns = (editBtn || deleteBtn) ? `<div style="display:flex; gap:8px;">${editBtn}${deleteBtn}</div>` : '';
    } else if (mode === 'self') {
        actionBtns = `<div style="display:flex; gap:8px;">
            <button style="width:36px; height:36px; border-radius:10px; background:#FEF3C7; color:#92400E; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="Tahrirlash" onclick="closeDetailModal();openSelfEdit(${rowId})">✏️</button>
            <button style="width:36px; height:36px; border-radius:10px; background:#FEE2E2; color:#991B1B; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="O'chirish" onclick="closeDetailModal();deleteOwnRecord(${rowId})">🗑</button>
        </div>`;
    }

    const currencyColor = isUsd ? '#92400E' : '#059669';
    const currencyBg = isUsd ? '#FFF7ED' : '#ECFDF5';

    document.getElementById('detailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div style="background:${currencyBg}; color:${currencyColor}; font-weight:700; font-size:10px; padding:4px 10px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase;">
                ${isUsd ? '💵 DOLLAR' : '💰 SO\'M'} TO'LOVI
            </div>
            ${actionBtns}
        </div>

        <div style="margin-bottom:20px;">
            <h2 style="margin:0; font-size:22px; color:#1E293B; font-weight:800;">${safeComment}</h2>
            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                <span style="color:#64748B; font-size:12px; display:flex; align-items:center; gap:4px;">
                    📅 ${safeDate}
                </span>
                ${safePeriod ? `
                <span style="color:#0369A1; background:#F0F9FF; padding:2px 8px; border-radius:6px; font-weight:700; font-size:12px; display:flex; align-items:center; gap:4px;">
                    🔄 Davr: ${safePeriod}
                </span>` : ''}
            </div>
        </div>

        ${editHistoryBlock}

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:16px; padding:15px; margin-bottom:20px;">
            ${r.name ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid #E2E8F0; margin-bottom:12px;">
                <span style="font-size:13px; color:#64748B; font-weight:500;">Mas'ul Xodim:</span>
                <span style="font-size:14px; color:#1E293B; font-weight:700;">${safeName}</span>
            </div>` : ''}
            
            ${isUsd ? `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-size:13px; color:#64748B; font-weight:500;">Summa (USD):</span>
                <span style="font-size:16px; color:#92400E; font-weight:800;">$${usd.toLocaleString()}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-size:13px; color:#64748B; font-weight:500;">Valyuta kursi:</span>
                <span style="font-size:14px; color:#1E293B; font-weight:700;">${effectiveRate > 0 ? '1$ = ' + effectiveRate.toLocaleString() + ' UZS' : '—'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:#64748B; font-weight:500;">So'mga aylantirish:</span>
                <span style="font-size:16px; color:#059669; font-weight:800;">${uzs.toLocaleString()} UZS</span>
            </div>
            ` : `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:#64748B; font-weight:500;">Summa (UZS):</span>
                <span style="font-size:18px; color:#059669; font-weight:800;">${uzs.toLocaleString()} UZS</span>
            </div>
            `}
        </div>

        <button class="btn-secondary" style="width:100%; height:48px; border-radius:14px; font-weight:700; font-size:14px; border:1px solid #E2E8F0; background:white; color:#1E293B; cursor:pointer;" onclick="closeDetailModal()">✕ Yopish</button>
    `;
    document.getElementById('detailModal').classList.remove('hidden');
}

function closeDetailModal(){
    document.getElementById('detailModal').classList.add('hidden');
}