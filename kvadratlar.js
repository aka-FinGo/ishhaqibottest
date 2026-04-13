// ============================================================
// KVADRATLAR.JS — Measurements Logic
// ============================================================

let kvFullRecords = [];
let kvFilteredRecords = [];

const KV_MONTHS_UZ = [
    '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

/**
 * Month string like "_01" → "Yanvar"
 */
function kvMonthLabel(monthStr) {
    const clean = String(monthStr || '').replace(/^_+/, '').replace(/^'/, '');
    const num = parseInt(clean, 10);
    return (num >= 1 && num <= 12) ? KV_MONTHS_UZ[num] : (clean || '—');
}

/**
 * Populates staff dropdowns and basic filters.
 */
function populateKvadratMeta(staffList) {
    const staffFilter = document.getElementById('kvFilterStaff');
    const kvStaffModal = document.getElementById('kvStaffSelect');

    if (staffFilter) {
        staffFilter.innerHTML = '<option value="all">Barcha hodimlar</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            staffFilter.appendChild(opt);
        });
    }

    if (kvStaffModal) {
        kvStaffModal.innerHTML = '<option value="">Hodimni tanlang...</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            kvStaffModal.appendChild(opt);
        });
    }

    // Populate years for kvFilterYear
    const yearSel = document.getElementById('kvFilterYear');
    if (yearSel) {
        const currentYear = new Date().getFullYear();
        yearSel.innerHTML = '<option value="all">Yillar</option>';
        for (let y = currentYear; y >= 2024; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        }
    }

    // Populate month/year in add modal
    _initKvFormYears();
}

function _initKvFormYears() {
    const curYear = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const yearEl = document.getElementById('kvActionYear');
    if (yearEl) {
        yearEl.innerHTML = '';
        for (let y = curYear + 1; y >= curYear - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === curYear) opt.selected = true;
            yearEl.appendChild(opt);
        }
    }

    const monthEl = document.getElementById('kvActionMonth');
    if (monthEl) monthEl.value = curMonth;
}

/**
 * Initializes the tab: loads data from server.
 */
async function initKvadratTab() {
    const listContainer = document.getElementById('kvList');
    if (!listContainer) return;
    listContainer.innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            applyKvFilters();
        } else {
            listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
        }
    } catch (e) {
        const listEl = document.getElementById('kvList');
        if (listEl) listEl.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Tarmoq xatosi</p></div>`;
    }
}

/**
 * Renders the filtered list of measurements.
 */
function renderKvList() {
    const container = document.getElementById('kvList');
    const totalDisplay = document.getElementById('kvTotalM2');
    if (!container) return;

    if (!kvFilteredRecords.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📏</div>
                <p>Ma'lumot topilmadi</p>
            </div>`;
        if (totalDisplay) totalDisplay.innerText = '0';
        return;
    }

    let totalM2 = 0;
    let html = '';

    kvFilteredRecords.forEach((rec, idx) => {
        totalM2 += Number(rec.totalM2) || 0;

        const isOwner = String(rec.ownerTgId) === String(telegramId);
        const canManage = isOwner || myRole === 'Admin' || myRole === 'SuperAdmin';
        
        const monthLabel = kvMonthLabel(rec.month);
        const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
        
        // Status colors & labels
        let statusHtml = '';
        const status = rec.status || 'yangi';
        if (status === 'yangi') {
            statusHtml = `<span class="kv-badge b-yellow">🟡 Yangi</span>`;
        } else if (status === 'yig\'ildi') {
            statusHtml = `<span class="kv-badge b-blue">🔵 Yig'ildi</span>`;
        } else if (status === 'tayyor') {
            statusHtml = `<span class="kv-badge b-green">🟢 Tayyor</span>`;
        }

        // Quick action button logic
        let actionBtn = '';
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        
        if (status === 'yangi' && positions.indexOf('Yig\'uvchi') !== -1) {
            actionBtn = `<button class="kv-claim-btn b-blue" onclick="event.stopPropagation();claimKvWork(${rec.rowId}, 'yiguvchi')">🔧 Men yig'dim</button>`;
        } else if (status === 'yig\'ildi' && positions.indexOf('Qadoqlovchi') !== -1) {
            actionBtn = `<button class="kv-claim-btn b-green" onclick="event.stopPropagation();claimKvWork(${rec.rowId}, 'qadoqlovchi')">📦 Men qadoqladim</button>`;
        }

        html += `
        <div class="history-item kv-item" onclick="showKvDetailModal(${idx})" style="cursor:pointer;">
            <div class="item-header">
                <span class="item-name" style="display:flex;align-items:center;gap:6px;">
                    <span style="background:#EFF6FF;color:#1D4ED8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">
                        №${rec.no || '—'}
                    </span>
                    ${statusHtml}
                </span>
                <span class="item-date">📅 ${escapeHtml(rec.date || '—')}</span>
            </div>
            <div style="font-size:15px;font-weight:700;color:var(--navy);margin:6px 0 4px;">
                📌 ${escapeHtml(rec.orderName || '—')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:var(--text-muted);">👤 ${escapeHtml(rec.staffName || '—')}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                     ${actionBtn}
                     <span style="background:#0F172A;color:#fff;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:800;">
                        ${m2Val} m²
                     </span>
                </div>
            </div>
            ${canManage ? `<div class="item-edit-hint">→ batafsil</div>` : ''}
        </div>`;
    });

    container.innerHTML = html;
    if (totalDisplay) totalDisplay.innerText = totalM2.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
}

/**
 * Show detail modal for a kvadrat record
 */
function showKvDetailModal(idx) {
    const rec = kvFilteredRecords[idx];
    if (!rec) return;

    const isOwner = String(rec.ownerTgId) === String(telegramId);
    const canManage = isOwner || myRole === 'Admin' || myRole === 'SuperAdmin';
    const monthLabel = kvMonthLabel(rec.month);
    const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

    // Workflow actions in modal
    let claimBtnHtml = '';
    const status = rec.status || 'yangi';
    const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
    
    if (status === 'yangi' && positions.indexOf('Yig\'uvchi') !== -1) {
        claimBtnHtml = `<button class="btn-main" style="background:#2563EB;margin-bottom:10px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, 'yiguvchi')">🔧 Men yig'dim</button>`;
    } else if (status === 'yig\'ildi' && positions.indexOf('Qadoqlovchi') !== -1) {
        claimBtnHtml = `<button class="btn-main" style="background:#059669;margin-bottom:10px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, 'qadoqlovchi')">📦 Men qadoqladim</button>`;
    }

    document.getElementById('kvDetailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div class="detail-header">
            <span class="detail-badge uzs" style="background:#EFF6FF;color:#1D4ED8;">📐 Kvadrat o'lchov</span>
            <div class="detail-comment">📌 ${escapeHtml(rec.orderName || '—')}</div>
            <div class="detail-date">📅 Sana: ${escapeHtml(rec.date || '—')}</div>
        </div>
        <div class="detail-card">
            <div class="detail-row">
                <span class="detail-key">Status</span>
                <span class="detail-val">${status === 'yangi' ? '🟡 Yangi' : (status === 'yig\'ildi' ? '🔵 Yig\'ildi' : '🟢 Tayyor')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">№</span>
                <span class="detail-val">${rec.no || '—'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Loyihachi</span>
                <span class="detail-val"><strong>${escapeHtml(rec.staffName || '—')}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Yig'uvchi</span>
                <span class="detail-val">${escapeHtml(rec.yiguvchi || '—')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Qadoqlovchi</span>
                <span class="detail-val">${escapeHtml(rec.qadoqlovchi || '—')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Jami m²</span>
                <span class="detail-val" style="color:#0F172A;font-size:18px;">${m2Val} m²</span>
            </div>
        </div>
        ${claimBtnHtml}
        <button class="btn-secondary" style="margin-top:12px;" onclick="closeKvDetailModal()">✕ Yopish</button>
        ${actionBtns}`;

    document.getElementById('kvDetailModal').classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeKvDetailModal() {
    document.getElementById('kvDetailModal').classList.add('hidden');
}

/**
 * Applies current filters to the full records.
 */
function applyKvFilters() {
    const month = document.getElementById('kvFilterMonth')?.value || 'all';
    const year = document.getElementById('kvFilterYear')?.value || 'all';
    const staff = document.getElementById('kvFilterStaff')?.value || 'all';

    kvFilteredRecords = kvFullRecords.filter(rec => {
        // Month filter: rec.month is "_01", "_02" etc
        if (month !== 'all') {
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            if (cleanMonth !== month) return false;
        }
        // Year filter: rec.date is "DD/MM/YYYY"
        if (year !== 'all') {
            if (!String(rec.date || '').endsWith(String(year))) return false;
        }
        // Staff filter
        if (staff !== 'all') {
            if (rec.staffName !== staff) return false;
        }
        return true;
    });

    renderKvList();
}

/**
 * Open Add/Edit modal
 */
function openKvModal(rowId = null) {
    const modal = document.getElementById('kvadratModal');
    const title = document.getElementById('kvModalTitle');
    const form = document.getElementById('kvForm');

    form.reset();
    document.getElementById('kvRowId').value = rowId || '';
    _initKvFormYears();

    if (rowId) {
        title.innerText = '✏️ Tahrirlash';
        const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        if (rec) {
            document.getElementById('kvOrderName').value = rec.orderName || '';
            document.getElementById('kvTotalM2Input').value = rec.totalM2 || '';
            document.getElementById('kvStaffSelect').value = rec.staffName || '';

            // Parse month from rec.month like "_03" → "03"
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            const monthEl = document.getElementById('kvActionMonth');
            if (monthEl && cleanMonth) monthEl.value = cleanMonth.padStart(2, '0');

            // Parse year from rec.date "DD/MM/YYYY"
            const yearEl = document.getElementById('kvActionYear');
            if (yearEl && rec.date) {
                const parts = String(rec.date).split('/');
                if (parts.length === 3) yearEl.value = parts[2];
            }
        }
    } else {
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        if (myRole !== 'SuperAdmin' && positions.indexOf('Loyihachi') === -1) {
            showToastMsg('❌ Faqat "Loyihachi" buyurtma qo\'sha oladi', true);
            return;
        }

        title.innerText = '📐 Yangi o\'lchov kiritish';
        // Auto-select current user
        if (typeof globalEmployeeList !== 'undefined' && globalEmployeeList.includes(myUsername)) {
            const sel = document.getElementById('kvStaffSelect');
            if (sel) sel.value = myUsername;
        }
    }

    modal.classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

function closeKvModal() {
    document.getElementById('kvadratModal').classList.add('hidden');
}

/**
 * Save record (Add or Edit)
 */
async function saveKv() {
    const rowId = document.getElementById('kvRowId').value;
    const orderName = (document.getElementById('kvOrderName').value || '').trim();
    const totalM2 = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName = document.getElementById('kvStaffSelect').value;
    const month = document.getElementById('kvActionMonth')?.value || '';
    const year = document.getElementById('kvActionYear')?.value || '';
    const monthStr = (year && month) ? `_${month}` : '';

    if (!orderName) {
        showToastMsg('❌ Buyurtma nomini kiriting', true);
        return;
    }
    if (totalM2 <= 0) {
        showToastMsg('❌ m² miqdorini kiriting', true);
        return;
    }
    if (!staffName) {
        showToastMsg('❌ Hodimni tanlang', true);
        return;
    }

    try {
        const action = rowId ? 'kvadrat_edit' : 'kvadrat_add';
        const data = await apiRequest({
            action,
            rowId: rowId || undefined,
            orderName,
            totalM2,
            staffName,
            month: monthStr,
            year
        });

        if (data.success) {
            showToastMsg('✅ Saqlandi!');
            closeKvModal();
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Saqlashda xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

/**
 * Delete record
 */
async function deleteKv(rowId) {
    if (document.activeElement) document.activeElement.blur();
    await new Promise(r => setTimeout(r, 50));

    if (!confirm("Ushbu o'lchovni o'chirishga ishonchingiz komilmi?")) return;

    try {
        const data = await apiRequest({ action: 'kvadrat_delete', rowId });
        if (data.success) {
            showToastMsg("✅ O'chirildi");
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || "O'chirishda xato"), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

/**
 * Claims work (Yig'uvchi or Qadoqlovchi)
 */
async function claimKvWork(rowId, claimType) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    
    try {
        const data = await apiRequest({
            action: 'kvadrat_claim',
            rowId,
            claimType
        });

        if (data.success) {
            showToastMsg('✅ Muvaffaqiyatli belgilandi!');
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato yuz berdi'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}