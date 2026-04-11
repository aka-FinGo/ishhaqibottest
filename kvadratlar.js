// ============================================================
// KVADRATLAR.JS — Measurements Logic
// ============================================================

let kvFullRecords = [];
let kvFilteredRecords = [];

/**
 * Populates staff dropdowns and basic filters.
 */
function populateKvadratMeta(staffList) {
    const staffFilter = document.getElementById('kvFilterStaff');
    const staffSelect = document.getElementById('kvStaffSelect');
    
    if (staffFilter) {
        staffFilter.innerHTML = '<option value="all">Barcha hodimlar</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            staffFilter.appendChild(opt);
        });
    }
    
    if (staffSelect) {
        staffSelect.innerHTML = '<option value="">Tanlang...</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            staffSelect.appendChild(opt);
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
}

/**
 * Initializes the tab: loads data from server.
 */
async function initKvadratTab() {
    const listContainer = document.getElementById('kvList');
    listContainer.innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            applyKvFilters();
        } else {
            showToastMsg('❌ ' + (data.error || 'Yuklashda xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

/**
 * Renders the filtered list of measurements.
 */
function renderKvList() {
    const container = document.getElementById('kvList');
    const totalDisplay = document.getElementById('kvTotalM2');
    
    if (!kvFilteredRecords.length) {
        container.innerHTML = '<div class="empty-msg">Ma\'lumot topilmadi</div>';
        totalDisplay.innerText = '0';
        return;
    }

    let totalM2 = 0;
    let html = '';

    kvFilteredRecords.forEach(rec => {
        totalM2 += rec.totalM2;
        
        // Ownership check
        const isOwner = String(rec.ownerTgId) === String(telegramId);
        const canManage = isOwner || myRole === 'Admin' || myRole === 'SuperAdmin';

        html += `
            <div class="history-item">
                <div class="hist-main">
                    <div class="hist-left">
                        <div class="hist-reason">${rec.orderName}</div>
                        <div class="hist-meta">
                            <span>👤 ${rec.staffName}</span> • 
                            <span>📅 ${rec.date}</span>
                        </div>
                    </div>
                    <div class="hist-right">
                        <div class="hist-amt" style="color:var(--navy);">${rec.totalM2.toLocaleString()} m²</div>
                        ${canManage ? `
                        <div style="display:flex; gap:8px; margin-top:4px; justify-content: flex-end;">
                            <span onclick="openKvModal(${rec.rowId})" style="cursor:pointer; font-size:16px;">✏️</span>
                            <span onclick="deleteKv(${rec.rowId})" style="cursor:pointer; font-size:16px;">🗑️</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    totalDisplay.innerText = totalM2.toLocaleString();
}

/**
 * Applies current filters to the full records.
 */
function applyKvFilters() {
    const month = document.getElementById('kvFilterMonth').value;
    const year = document.getElementById('kvFilterYear').value;
    const staff = document.getElementById('kvFilterStaff').value;

    kvFilteredRecords = kvFullRecords.filter(rec => {
        // Month filter (record.month is "_01", "_02" etc)
        if (month !== 'all') {
            const targetM = "_" + month;
            if (rec.month !== targetM) return false;
        }
        // Year filter (record.date is "DD/MM/YYYY")
        if (year !== 'all') {
            if (!rec.date.endsWith(year)) return false;
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
 * Modal control
 */
function openKvModal(rowId = null) {
    const modal = document.getElementById('kvadratModal');
    const title = document.getElementById('kvModalTitle');
    const form = document.getElementById('kvForm');
    
    form.reset();
    document.getElementById('kvRowId').value = rowId || '';

    if (rowId) {
        title.innerText = '✏️ Tahrirlash';
        const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        if (rec) {
            document.getElementById('kvOrderName').value = rec.orderName;
            document.getElementById('kvTotalM2Input').value = rec.totalM2;
            document.getElementById('kvStaffSelect').value = rec.staffName;
        }
    } else {
        title.innerText = '📐 Kvadrat kiritish';
        // Auto select current user if in staff list
        if (globalEmployeeList.includes(myUsername)) {
            document.getElementById('kvStaffSelect').value = myUsername;
        }
    }

    modal.classList.remove('hidden');
}

function closeKvModal() {
    document.getElementById('kvadratModal').classList.add('hidden');
}

/**
 * Save record (Add or Edit)
 */
async function saveKv() {
    const rowId = document.getElementById('kvRowId').value;
    const orderName = document.getElementById('kvOrderName').value;
    const totalM2 = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName = document.getElementById('kvStaffSelect').value;

    if (!orderName || totalM2 <= 0 || !staffName) {
        showToastMsg('❌ Ma\'lumotlarni to\'liq kiriting', true);
        return;
    }

    try {
        const action = rowId ? 'kvadrat_edit' : 'kvadrat_add';
        const data = await apiRequest({ action, rowId, orderName, totalM2, staffName });
        
        if (data.success) {
            showToastMsg('✅ Saqlandi!');
            closeKvModal();
            initKvadratTab(); // Refresh list
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
    
    if (!confirm('Ushbu o\'lchovni o\'chirishga ishonchingiz komilmi?')) return;

    try {
        const data = await apiRequest({ action: 'kvadrat_delete', rowId });
        if (data.success) {
            showToastMsg('✅ O\'chirildi');
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'O\'chirishda xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}
