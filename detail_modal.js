/* ---------------------------------------------------------------
   detail_modal.js — Batafsil modal
   Barcha inline stillar components.css klasslariga ko'chirildi.
   Mavzu (standart / dark) avtomatik ishlaydi.
   --------------------------------------------------------------- */

/* HTML escape xavfsizligi */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showDetailModal(r, mode) {
    if (!r) return;

    const uzs    = Number(r.amountUZS) || 0;
    const usd    = Number(r.amountUSD) || 0;
    const rowId  = Number(r.rowId) || 0;
    const safeName    = escapeHtml(r.name    || '—');
    const safeComment = escapeHtml(r.comment || '—');
    const safeDate    = escapeHtml(r.date    || '—');
    const safePeriod  = r.actionPeriod ? escapeHtml(r.actionPeriod) : '';
    const rate        = Number(r.rate) || Number(r.exchangeRate) || Number(r.kurs) || 0;

    /* Tahrirlash tarixi */
    const isEdited      = !!r.editReason;
    const safeEditReason = isEdited ? escapeHtml(r.editReason) : '';
    const oldUzs = Number(r.oldAmountUZS) || 0;
    const oldUsd = Number(r.oldAmountUSD) || 0;

    const isUsd         = usd > 0;
    const effectiveRate = rate > 0 ? rate : (usd > 0 && uzs > 0 ? Math.round(uzs / usd) : 0);

    /* Tahrirlash tarixi bloki */
    let editHistoryBlock = '';
    if (isEdited) {
        editHistoryBlock = `
        <div class="dm-edit-hist">
            <div class="dm-edit-hist__title">
                <span>📝</span> Tahrirlash Tarixi
            </div>
            <div class="dm-edit-hist__row">
                <span class="dm-edit-hist__key">Eski Summa:</span>
                <span class="dm-edit-hist__val">
                    ${oldUsd > 0 ? '$' + oldUsd.toLocaleString() : oldUzs.toLocaleString() + ' UZS'}
                </span>
            </div>
            <div class="dm-edit-hist__reason">
                <span style="opacity:0.8;">Sabab:</span>
                <span style="font-weight:600;">${safeEditReason}</span>
            </div>
        </div>`;
    }

    /* Amal tugmalari */
    let actionBtns = '';
    // Tahrirlash va o'chirish huquqlari:
    // Faqat SuperAdmin uchun cheksiz huquq.
    // Boshqa xodimlar (Bugalter, Admin, Direktor, Employee) uchun
    // Google Sheets jadvalida (canEdit va canDelete ustunlarida) ruxsat berilgan bo'lsagina tugmalar chiqadi!
    const isSuperAdmin = (typeof myRole !== 'undefined' && myRole === 'SuperAdmin');
    const hasEditPerm = Boolean(typeof myPermissions !== 'undefined' && myPermissions && myPermissions.canEdit);
    const hasDeletePerm = Boolean(typeof myPermissions !== 'undefined' && myPermissions && myPermissions.canDelete);

    const isPrivileged = typeof myRole !== 'undefined' && (myRole === 'SuperAdmin' || myRole === 'Admin' || myRole === 'Direktor' || myRole === 'Bugalter');
    const isOwner = Boolean(typeof telegramId !== 'undefined' && telegramId && r && r.telegramId && String(r.telegramId) === String(telegramId));
    
    const canEditAll = isSuperAdmin || (isPrivileged && hasEditPerm);
    const canDeleteAll = isSuperAdmin || (isPrivileged && hasDeletePerm);

    const canEd = canEditAll || (hasEditPerm && isOwner);
    const canDel = canDeleteAll || (hasDeletePerm && isOwner);

    if (mode === 'admin' || mode === true) {
        const editBtn = canEd
            ? `<button class="dm-act-btn dm-act-btn--edit" title="Tahrirlash" onclick="closeDetailModal();openEdit(${rowId})">✏️</button>`
            : '';
        const delBtn = canDel
            ? `<button class="dm-act-btn dm-act-btn--del" title="O'chirish" onclick="closeDetailModal();deleteRecord(${rowId})">🗑</button>`
            : '';
        actionBtns = (editBtn || delBtn) ? `<div class="dm-act-row">${editBtn}${delBtn}</div>` : '';
    } else if (mode === 'self') {
        const editBtn = canEd
            ? `<button class="dm-act-btn dm-act-btn--edit" title="Tahrirlash" onclick="closeDetailModal();openSelfEdit(${rowId})">✏️</button>`
            : '';
        const delBtn = canDel
            ? `<button class="dm-act-btn dm-act-btn--del" title="O'chirish" onclick="closeDetailModal();deleteOwnRecord(${rowId})">🗑</button>`
            : '';
        actionBtns = (editBtn || delBtn) ? `<div class="dm-act-row">${editBtn}${delBtn}</div>` : '';
    }

    /* Valyuta badge */
    const badgeClass = isUsd ? 'dm-badge--usd' : 'dm-badge--uzs';
    const badgeLabel  = isUsd ? "💵 DOLLAR TO'LOVI" : "💰 SO'M TO'LOVI";
    
    /* Status badge */
    const status = r.status || 'Tasdiqlandi';
    let statusBadge = '';
    if (status === 'Tasdiqlandi') {
        statusBadge = `<span style="background:#22c55e; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:10px;">✅ Tasdiqlangan</span>`;
    } else if (status === 'Kutilmoqda') {
        statusBadge = `<span style="background:#f59e0b; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:10px;">⏳ Kutilmoqda</span>`;
    } else if (status === 'Rad etildi') {
        statusBadge = `<span style="background:#ef4444; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:10px;">❌ Rad etilgan</span>`;
    }

    /* Davr chipi */
    const periodChip = safePeriod
        ? `<span class="dm-period-chip">🔄 Davr: ${safePeriod}</span>`
        : '';

    /* Summalar bloki */
    let amountsBlock = '';
    if (isUsd) {
        amountsBlock = `
            ${r.name ? `
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">Mas'ul Xodim:</span>
                <span class="dm-amounts__name">${safeName}</span>
            </div>` : ''}
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">Summa (USD):</span>
                <span class="dm-amounts__usd">$${usd.toLocaleString()}</span>
            </div>
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">Valyuta kursi:</span>
                <span class="dm-amounts__rate">
                    ${effectiveRate > 0 ? '1$ = ' + effectiveRate.toLocaleString() + ' UZS' : '—'}
                </span>
            </div>
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">So'mga aylantirish:</span>
                <span class="dm-amounts__conv">${uzs.toLocaleString()} UZS</span>
            </div>`;
    } else {
        amountsBlock = `
            ${r.name ? `
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">Mas'ul Xodim:</span>
                <span class="dm-amounts__name">${safeName}</span>
            </div>` : ''}
            <div class="dm-amounts__row">
                <span class="dm-amounts__key">Summa (UZS):</span>
                <span class="dm-amounts__uzs">${uzs.toLocaleString()} UZS</span>
            </div>`;
    }

    /* Modal ichidagi kontent */
    const detailModalBodyEl = document.getElementById('detailModalBody');
    if (detailModalBodyEl) {
        detailModalBodyEl.innerHTML = `
            <div class="modal-drag"></div>

            <div class="dm-top-row">
                <div style="display:flex; align-items:center;">
                    <div class="dm-badge ${badgeClass}">${badgeLabel}</div>
                    ${statusBadge}
                </div>
                ${actionBtns}
            </div>

            <div class="dm-body-header">
                <h2 class="dm-title">${safeComment}</h2>
                <div class="dm-date-row">
                    <span class="dm-date-chip">📅 ${safeDate}</span>
                    ${periodChip}
                </div>
            </div>

            ${editHistoryBlock}

            <div class="dm-amounts">
                ${amountsBlock}
            </div>

            <button class="dm-close-btn" onclick="closeDetailModal()">✕ Yopish</button>
        `;
    }

    const modalEl = document.getElementById('detailModal');
    if (modalEl) {
        modalEl.classList.remove('hidden');
        if (!modalEl.dataset.backdropAttached) {
            modalEl.dataset.backdropAttached = 'true';
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) {
                    closeDetailModal();
                }
            });
        }
    }
}

function closeDetailModal() {
    const modalEl = document.getElementById('detailModal');
    if (modalEl) {
        modalEl.classList.add('hidden');
    }
}
