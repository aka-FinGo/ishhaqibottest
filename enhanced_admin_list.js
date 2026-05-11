/**
 * enhanced_admin_list.js
 * Barcha inline stillar components.css ga ko'chirildi.
 * style.textContent injection olib tashlandi.
 */

const ADMIN_ITEMS_PER_PAGE = 15;
let adminCurrentPage = 1;

/* HTML escape */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ---------------------------------------------------------------
   renderAdminList — CSS klasslari bilan
   --------------------------------------------------------------- */
function renderAdminList(data) {
    const adminListEl = document.getElementById('adminList');
    if (!adminListEl) { console.error('adminList element not found'); return; }

    if (!data || !Array.isArray(data) || data.length === 0) {
        adminListEl.innerHTML = `
            <div class="empty-state">
                <div style="font-size:60px; margin-bottom:16px;">📋</div>
                <h3 style="margin:0 0 8px;">Hech qanday amal topilmadi</h3>
                <p style="margin:0; font-size:14px;">Hozircha tizimda hech qanday amal kiritilmagan</p>
            </div>`;
        return;
    }

    /* Davr bo'yicha saralash */
    const sortedData = [...data].sort((a, b) => {
        const davrA = getDavrSortKey(a.actionPeriod, a.date, a.dateISO);
        const davrB = getDavrSortKey(b.actionPeriod, b.date, b.dateISO);
        if (davrB !== davrA) return davrB.localeCompare(davrA);
        const dateA = new Date(a.dateISO || (a.date ? a.date.split('/').reverse().join('-') : ''));
        const dateB = new Date(b.dateISO || (b.date ? b.date.split('/').reverse().join('-') : ''));
        return dateB - dateA;
    });

    /* Sahifalash */
    const totalPages  = Math.ceil(sortedData.length / ADMIN_ITEMS_PER_PAGE);
    const start       = (adminCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
    const paginatedData = sortedData.slice(start, start + ADMIN_ITEMS_PER_PAGE);

    const fragment  = document.createDocumentFragment();
    const container = document.createElement('div');
    container.className = 'admin-list-container';
    let lastDavr = null;

    paginatedData.forEach(item => {
        const amountUZS  = item.amountUZS  || 0;
        const amountUSD  = item.amountUSD  || 0;
        const comment     = item.comment    || 'Izohsiz';
        const name        = item.name       || 'Noma\'lum';
        const date        = item.date       || 'Sana kiritilmagan';
        const actionPeriod = item.actionPeriod || '';

        const currentDavr = getDavrSortKey(item.actionPeriod, item.date, item.dateISO);
        const relDavr     = getDavrLabel(currentDavr);

        /* Davr sarlavhasi */
        if (relDavr !== lastDavr) {
            const dateHeader = document.createElement('div');
            dateHeader.style.cssText = 'font-size:13px; font-weight:700; color:var(--text-muted); margin:16px 0 8px 4px; border-bottom:1px solid var(--border); padding-bottom:4px;';
            dateHeader.textContent = relDavr;
            container.appendChild(dateHeader);
            lastDavr = relDavr;
        }

        /* Rang belgisi */
        const dot = amountUZS > 0 ? '🟢 ' : (amountUSD > 0 ? '🟡 ' : '🔴 ');

        /* Chiplar */
        const uzsChip = amountUZS
            ? `<span class="chip-uzs">${Number(amountUZS).toLocaleString()} UZS</span>` : '';
        const usdChip = amountUSD
            ? `<span class="chip-usd">$${Number(amountUSD).toLocaleString()}</span>` : '';

        /* Davr chipi */
        const periodLine = actionPeriod
            ? `<div class="ali__period">Davr: ${escapeHtml(actionPeriod)}</div>` : '';

        const li = document.createElement('div');
        li.className = 'ali';
        li.innerHTML = `
            <div class="ali__row">
                <div class="ali__name">${dot}${escapeHtml(name)}</div>
                <div class="ali__date">${escapeHtml(date)}</div>
            </div>
            <div class="ali__bot">
                <div class="ali__comment">${escapeHtml(comment)}</div>
                <div class="ali__chips">${uzsChip}${usdChip}</div>
            </div>
            ${periodLine}
        `;
        li.addEventListener('click', () => showActionDetails(item));
        container.appendChild(li);
    });

    fragment.appendChild(container);

    /* Pagination */
    if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';
        paginationDiv.style.cssText = 'display:flex; justify-content:center; gap:8px; padding:20px 0; flex-wrap:wrap;';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === adminCurrentPage ? 'active' : ''}`;
            btn.onclick = () => goToAdminPage(i);
            btn.innerText = i;
            paginationDiv.appendChild(btn);
        }
        fragment.appendChild(paginationDiv);
    }

    adminListEl.innerHTML = '';
    adminListEl.appendChild(fragment);
}

function goToAdminPage(page) {
    adminCurrentPage = page;
    renderAdminList(filteredData);
    document.getElementById('adminList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Batafsil modal */
function showActionDetails(item) {
    showDetailModal(item, 'admin');
    if (typeof tg !== 'undefined' && tg && typeof tg.HapticFeedback !== 'undefined') {
        tg.HapticFeedback.impactOccurred('light');
    }
}

/* ---------------------------------------------------------------
   O'chirish modal — CSS klasslari bilan
   --------------------------------------------------------------- */
function showDeleteConfirm(rowId) {
    const confirmHtml = `
        <div id="deleteConfirmModal" class="dc-overlay">
            <div class="dc-box">
                <h3 class="dc-title">O'chirishni tasdiqlang</h3>
                <p class="dc-desc">Ushbu amalni o'chirishni xohlaysizmi?</p>
                <div>
                    <label class="dc-label">Sababini kiriting:</label>
                    <textarea id="deleteReason" rows="3"
                        placeholder="Sababini qisqacha yozing..."></textarea>
                </div>
                <div class="dc-actions">
                    <button class="dc-cancel" onclick="closeDeleteConfirmModal()">Bekor qilish</button>
                    <button class="dc-del"    onclick="performDelete('${rowId}')">O'chirish</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', confirmHtml);
    document.getElementById('deleteReason').focus();
}

async function performDelete(rowId) {
    const reason = document.getElementById('deleteReason').value.trim();
    if (!reason) { showToastMsg('❌ Iltimos, sababini kiriting!', true); return; }

    const deleteBtn = document.querySelector('#deleteConfirmModal .dc-del');
    const originalText = deleteBtn.textContent;
    deleteBtn.innerHTML = '<span style="display:inline-block; animation:js-spinner 1s linear infinite; border:2px solid rgba(255,255,255,0.3); border-top-color:var(--comp-del-text); border-radius:50%; width:16px; height:16px; margin-right:8px;"></span> O\'chirilmoqda...';
    deleteBtn.disabled = true;

    try {
        const data = await apiRequest({ action: "admin_delete", rowId, reason });
        if (!data.success) throw new Error(data.error || "O'chirishda xato");
        closeDeleteConfirmModal();
        showToastMsg("✅ O'chirildi");
        if (typeof loadAdminData === 'function') loadAdminData();
    } catch (error) {
        showToastMsg('❌ Server xatosi: ' + error.message, true);
    } finally {
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled  = false;
    }
}

function closeDeleteConfirmModal(event) {
    if (event && event.target.id !== 'deleteConfirmModal') return;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.remove();
}

/* Edit — mavjud modal tizimini ishlatadi */
function openEdit(rowId) {
    if (typeof originalOpenEdit === 'function') {
        originalOpenEdit(rowId);
    } else if (typeof openEditOriginal === 'function') {
        openEditOriginal(rowId);
    } else {
        showEditModal(rowId);
    }
}

function showEditModal(rowId) {
    const record = findRecordByRowId(rowId);
    if (!record) return;

    document.getElementById('editRowId').value = rowId;
    document.getElementById('editHeaderName').textContent = '👤 ' + (record.name || '—');

    let selectedMonth = '01';
    let selectedYear  = new Date().getFullYear().toString();
    if (record.actionPeriod) {
        const [year, month] = record.actionPeriod.split('-');
        if (year && month) { selectedYear = year; selectedMonth = month; }
    }
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    document.getElementById('editHeaderDate').textContent = '📅 ' + monthNames[parseInt(selectedMonth) - 1] + ' / ' + selectedYear;
    document.getElementById('editActionMonth').value = selectedMonth;

    const yearSelect = document.getElementById('editActionYear');
    yearSelect.innerHTML = generateYearOptions(selectedYear);

    document.getElementById('editAmountUZS').value = record.amountUZS || '';
    document.getElementById('editAmountUSD').value = record.amountUSD || '';
    document.getElementById('editRate').value      = record.rate      || '';
    document.getElementById('editComment').value   = record.comment   || '';

    updateEditCurrencyView();

    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.classList.remove('hidden');
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
}

function generateYearOptions(selectedYear) {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        options += `<option value="${year}" ${year.toString() === selectedYear ? 'selected' : ''}>${year}</option>`;
    }
    return options;
}

function initializeYearDropdown() {
    const yearSelect = document.getElementById('actionYear');
    if (yearSelect && yearSelect.options.length === 0) {
        yearSelect.innerHTML = generateYearOptions(yearSelect.value);
    }
}

function updateEditCurrencyView() {
    const amountUSD  = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate       = parseFloat(document.getElementById('editRate').value)       || 0;
    const calculatedUZS = amountUSD * rate;

    const editUsdRow           = document.getElementById('editUsdRow');
    const editRateRow          = document.getElementById('editRateRow');
    const editConversionPreview = document.getElementById('editConversionPreview');

    if (editUsdRow && editRateRow && editConversionPreview) {
        if (amountUSD > 0) {
            editUsdRow.style.display            = 'block';
            editRateRow.style.display           = 'block';
            editConversionPreview.style.display = 'block';
            editConversionPreview.innerHTML     = `<strong>≈ ${calculatedUZS.toLocaleString()} UZS</strong> (${amountUSD.toLocaleString()} × ${rate.toLocaleString()})`;
        } else {
            editUsdRow.style.display            = 'none';
            editRateRow.style.display           = 'none';
            editConversionPreview.style.display = 'none';
        }
    }
}

async function performEdit() {
    const rowId       = document.getElementById('editRowId').value;
    const actionMonth = document.getElementById('editActionMonth').value;
    const actionYear  = document.getElementById('editActionYear').value;
    const amountUZS   = parseFloat(document.getElementById('editAmountUZS').value) || 0;
    const amountUSD   = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate        = parseFloat(document.getElementById('editRate').value)       || 0;
    const comment     = document.getElementById('editComment').value;

    const saveBtn = document.querySelector('#editForm .btn-main');
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = '⏳ Saqlanmoqda...';

    try {
        let reason = '';
        if (typeof askActionReason === 'function') {
            reason = await askActionReason("Tahrirlash");
            if (!reason) { saveBtn.textContent = originalText; return; }
        }
        const data = await apiRequest({
            action: 'admin_edit', rowId,
            actionPeriod: `${actionYear}-${actionMonth}`,
            amountUZS: amountUSD > 0 ? 0 : amountUZS,
            amountUSD: amountUSD > 0 ? amountUSD : 0,
            rate: amountUSD > 0 ? rate : 0,
            comment, reason
        });
        if (!data.success) throw new Error(data.error || "Saqlashda xato");
        closeModal();
        showToastMsg("✅ Saqlandi");
        if (typeof loadAdminData === 'function') loadAdminData();
    } catch (error) {
        showToastMsg('❌ Server xatosi: ' + error.message, true);
    } finally {
        saveBtn.textContent = originalText;
    }
}

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.classList.add('hidden');
}

/* ---------------------------------------------------------------
   loadAdminData — ruxsat tekshiruvi bilan
   --------------------------------------------------------------- */
async function loadAdminData() {
    if (myRole !== 'SuperAdmin' && myRole !== 'Admin' && myRole !== 'Direktor') {
        const adminListEl = document.getElementById('adminList');
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:60px; margin-bottom:16px;">🔒</div>
                    <h3>Ruxsat yo'q</h3>
                    <p>Bu sahifani ko'rish uchun ruxsat yo'q</p>
                </div>`;
        }
        return;
    }

    if (myRole !== 'SuperAdmin' && (!myPermissions || !myPermissions.canViewAll)) {
        const adminListEl = document.getElementById('adminList');
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:60px; margin-bottom:16px;">🔒</div>
                    <h3>Ruxsat yo'q</h3>
                    <p>Barcha amallarni ko'rish ruxsati yo'q</p>
                </div>`;
        }
        return;
    }

    /* Keshdan ko'rsat */
    try {
        const cachedAdminData = localStorage.getItem('globalAdminData');
        if (cachedAdminData) {
            globalAdminData = JSON.parse(cachedAdminData);
            populateEmployeeFilter();
            populateYearFilter();
            populateMonthFilter();
            applyFilters();
        }
    } catch (e) {}

    /* Skelet */
    const adminListEl = document.getElementById('adminList');
    if (adminListEl && (!globalAdminData || globalAdminData.length === 0)) {
        adminListEl.innerHTML = `
            <div class="skeleton-container" style="padding:16px;">
                ${['60%','80%','40%'].map(w => `
                <div class="js-skeleton-card">
                    <div class="js-skeleton-line" style="height:18px; width:${w}; margin-bottom:8px;"></div>
                    <div class="js-skeleton-line" style="height:12px; width:30%; margin-bottom:12px;"></div>
                    <div style="display:flex; gap:8px;">
                        <div class="js-skeleton-line" style="height:22px; width:80px; border-radius:12px;"></div>
                        <div class="js-skeleton-line" style="height:22px; width:80px; border-radius:12px;"></div>
                    </div>
                </div>`).join('')}
            </div>`;
    }

    try {
        const response = await apiRequest({ action: 'admin_get_all' });
        if (response.success) {
            globalAdminData = response.data || [];
            localStorage.setItem('globalAdminData', JSON.stringify(globalAdminData));
            populateEmployeeFilter();
            populateYearFilter();
            populateMonthFilter();
            applyFilters();
            renderAdminList(filteredData || globalAdminData);
        } else {
            throw new Error(response.error || 'Ma\'lumotlarni yuklashda xatolik yuz berdi');
        }
    } catch (error) {
        console.error('Admin data load error:', error);
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:60px; margin-bottom:16px;">⚠️</div>
                    <h3>Xatolik yuz berdi</h3>
                    <p>${error.message || 'Ma\'lumotlarni yuklashda xatolik yuz berdi'}</p>
                    <button onclick="loadAdminData()" class="btn-main" style="width:auto; padding:8px 16px; margin-top:16px;">
                        Qayta urinib ko'rish
                    </button>
                </div>`;
        }
    }
}

/* Filtr funksiyalari */
function applyFilters() {
    const searchTerm     = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const employeeFilter = document.getElementById('filterEmployee')?.value || 'all';
    const monthFilter    = document.getElementById('filterMonth')?.value    || 'all';
    const yearFilter     = document.getElementById('filterYear')?.value     || 'all';

    adminCurrentPage = 1;

    filteredData = globalAdminData.filter(item => {
        const matchesSearch   = !searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.comment && item.comment.toLowerCase().includes(searchTerm));
        const matchesEmployee = employeeFilter === 'all' || item.name === employeeFilter;
        let matchesMonth = monthFilter === 'all';
        if (monthFilter !== 'all') {
            if (item.actionPeriod) { const [, month] = item.actionPeriod.split('-'); matchesMonth = month === monthFilter; }
            else { const dateMeta = getDateMonthYear(item.date); if (dateMeta) matchesMonth = dateMeta.month === monthFilter; }
        }
        let matchesYear = yearFilter === 'all';
        if (yearFilter !== 'all') {
            if (item.actionPeriod) { const [year] = item.actionPeriod.split('-'); matchesYear = year === yearFilter; }
            else { const dateMeta = getDateMonthYear(item.date); if (dateMeta) matchesYear = dateMeta.year === yearFilter; }
        }
        return matchesSearch && matchesEmployee && matchesMonth && matchesYear;
    });

    const countEl = document.getElementById('filteredCount');
    if (countEl) countEl.textContent = filteredData.length;

    let totalUZS = 0, totalUSD = 0, effectiveTotalUZS = 0;
    filteredData.forEach(item => {
        const uzs  = Number(item.amountUZS) || 0;
        const usd  = Number(item.amountUSD) || 0;
        const rate = Number(item.rate)      || 0;
        totalUZS += uzs; totalUSD += usd;
        effectiveTotalUZS += uzs;
        if (usd > 0 && rate > 0) effectiveTotalUZS += usd * rate;
    });

    const uzsOnlyEl = document.getElementById('totalCompanyUzsOnly');
    const usdOnlyEl = document.getElementById('totalCompanyUsdOnly');
    if (uzsOnlyEl) uzsOnlyEl.innerHTML = `<span>${totalUZS.toLocaleString()}</span>`;
    if (usdOnlyEl) usdOnlyEl.innerHTML = `<span>$${totalUSD.toLocaleString()}</span>`;

    const budgetEl = document.getElementById('totalCompanyUzs');
    if (budgetEl) {
        let text = effectiveTotalUZS.toLocaleString() + ' UZS';
        if (totalUSD > 0) text += ` | $${totalUSD.toLocaleString()}`;
        budgetEl.textContent = text;
    }

    renderAdminList(filteredData);
}

function resetAdminFilters() {
    const searchInput    = document.getElementById('searchInput');
    const filterEmployee = document.getElementById('filterEmployee');
    const filterMonth    = document.getElementById('filterMonth');
    const filterYear     = document.getElementById('filterYear');
    if (searchInput)    searchInput.value    = '';
    if (filterEmployee) filterEmployee.value = 'all';
    if (filterMonth)    filterMonth.value    = 'all';
    if (filterYear)     filterYear.value     = 'all';
    applyFilters();
}

function updatePagination() {
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) paginationEl.style.display = 'none';
}

function canExportData() {
    return myRole === 'SuperAdmin' || (myPermissions && myPermissions.canExport);
}

function populateEmployeeFilter() {
    const filterEmployee = document.getElementById('filterEmployee');
    if (!filterEmployee) return;
    const employeeNames = [...new Set(globalAdminData.map(item => item.name))].filter(Boolean);
    filterEmployee.innerHTML = '<option value="all">Barcha xodimlar</option>';
    employeeNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name; option.textContent = name;
        filterEmployee.appendChild(option);
    });
}

function populateYearFilter() {
    const filterYear = document.getElementById('filterYear');
    if (!filterYear) return;
    const years = [...new Set(globalAdminData.map(item => {
        if (item.actionPeriod) { const [year] = item.actionPeriod.split('-'); return year; }
        const dateMeta = getDateMonthYear(item.date);
        return dateMeta ? dateMeta.year : null;
    }).filter(Boolean))];
    filterYear.innerHTML = '<option value="all">Barcha yillar</option>';
    years.sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year; option.textContent = year;
        filterYear.appendChild(option);
    });
}

function populateMonthFilter() {
    const filterMonth = document.getElementById('filterMonth');
    if (!filterMonth) return;
    const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    filterMonth.innerHTML = '<option value="all">Barcha oylar</option>';
    monthNames.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = (index + 1).toString().padStart(2, '0');
        option.textContent = name;
        filterMonth.appendChild(option);
    });
}

/* ⚠️ style injeksiyasi OLIB TASHLANDI — barcha stillar components.css da */
