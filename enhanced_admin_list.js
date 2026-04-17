/**
 * Enhanced admin list display
 * Improved UI with compact list and modal details
 */

// Function to render compact admin list
function renderAdminList(data) {
    const adminListEl = document.getElementById('adminList');
    if (!adminListEl) {
        console.error('adminList element not found');
        return;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
        adminListEl.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #64748b;">
                <div style="font-size: 60px; margin-bottom: 16px;">📋</div>
                <h3 style="margin: 0 0 8px; color: #1e293b;">Hech qanday amal topilmadi</h3>
                <p style="margin: 0; font-size: 14px;">Hozircha tizimda hech qanday amal kiritilmagan</p>
            </div>
        `;
        return;
    }

    // Sort data by date (newest first)
    const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || a.timestamp || '');
        const dateB = new Date(b.date || b.createdAt || b.timestamp || '');
        return dateB - dateA;
    });

    let html = '<div class="admin-list-container">';
    
    sortedData.forEach(item => {
        const amountUZS = item.amountUZS || 0;
        const amountUSD = item.amountUSD || 0;
        const comment = item.comment || 'Izohsiz';
        const name = item.name || 'Noma\'lum';
        const date = item.date || 'Sana kiritilmagan';
        const actionPeriod = item.actionPeriod || '';

        html += `
            <div class="admin-list-item" style="
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                cursor: pointer;
            " onclick="showActionDetails(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #1e293b; flex-grow: 1;">${name}</div>
                    <div style="color: #64748b; font-size: 12px; text-align: right; min-width: 80px;">${date}</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #64748b; font-size: 13px; flex-grow: 1; max-width: 70%;">${comment}</div>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        ${amountUZS ? `<span style="
                            background: #dcfce7;
                            color: #166534;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 11px;
                            font-weight: 500;
                        ">${Number(amountUZS).toLocaleString()} UZS</span>` : ''}
                        
                        ${amountUSD ? `<span style="
                            background: #dbeafe;
                            color: #1e40af;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 11px;
                            font-weight: 500;
                        ">$${Number(amountUSD).toLocaleString()}</span>` : ''}
                    </div>
                </div>
                
                ${actionPeriod ? `<div style="color: #0ea5e9; font-size: 11px; margin-top: 6px;">Davr: ${actionPeriod}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    adminListEl.innerHTML = html;
}

// Function to show action details in modal
function showActionDetails(item) {
    showDetailModal(item, 'admin');
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Function to show delete confirmation modal
function showDeleteConfirm(rowId) {
    const confirmHtml = `
        <div id="deleteConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1001;
        " onclick="closeDeleteConfirmModal(event)">
            <div style="
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin: 20px;
                max-width: 90%;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            " onclick="event.stopPropagation()">
                <h3 style="margin: 0 0 16px; color: #b91c1c;">O'chirishni tasdiqlang</h3>
                <p style="color: #64748b; margin: 0 0 16px;">Ushbu amalni o'chirishni xohlaysizmi?</p>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #334155;">Sababini kiriting:</label>
                    <textarea id="deleteReason" rows="3" style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; resize: vertical;" placeholder="Sababini qisqacha yozing..."></textarea>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button onclick="closeDeleteConfirmModal()" style="flex: 1; background: #f1f5f9; color: #475569; border: none; padding: 12px; border-radius: 8px; font-weight: 500; cursor: pointer;">Bekor qilish</button>
                    <button onclick="performDelete('${rowId}')" style="flex: 1; background: #fecaca; color: #b91c1c; border: none; padding: 12px; border-radius: 8px; font-weight: 500; cursor: pointer;">O'chirish</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', confirmHtml);
    document.getElementById('deleteReason').focus();
}

// Function to perform delete action
async function performDelete(rowId) {
    const reason = document.getElementById('deleteReason').value.trim();
    if (!reason) { alert('Iltimos, sababini kiriting!'); return; }
    const deleteBtn = document.querySelector('#deleteConfirmModal button:last-child');
    const originalText = deleteBtn.textContent;
    deleteBtn.innerHTML = '<span style="display: inline-block; animation: spinner 1s linear infinite; border: 2px solid #f3f3f3; border-top: 2px solid #b91c1c; border-radius: 50%; width: 16px; height: 16px; margin-right: 8px;"></span> O\'chirilmoqda...';
    deleteBtn.disabled = true;
    try {
        const data = await apiRequest({action: "admin_delete", rowId, reason});
        if (!data.success) throw new Error(data.error || "O'chirishda xato");
        closeDeleteConfirmModal();
        showToastMsg("✅ O'chirildi");
        loadAdminData();
    } catch (error) {
        showToastMsg('❌ Server xatosi: ' + error.message, true);
    } finally {
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled = false;
    }
}

// Function to close delete confirmation modal
function closeDeleteConfirmModal(event) {
    if (event && event.target.id !== 'deleteConfirmModal') return;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.remove();
}

// Enhanced edit function with modal
function openEdit(rowId) {
    if (typeof originalOpenEdit === 'function') {
        originalOpenEdit(rowId);
    } else if (typeof openEditOriginal === 'function') {
        openEditOriginal(rowId);
    } else {
        showEditModal(rowId);
    }
}

// Use existing editModal from index.html
function showEditModal(rowId) {
    const record = findRecordByRowId(rowId);
    if (!record) return;
    
    // Fill existing form fields
    document.getElementById('editRowId').value = rowId;
    
    // Set name and date in header
    document.getElementById('editHeaderName').textContent = '👤 ' + (record.name || '—');
    
    let selectedMonth = '01';
    let selectedYear = new Date().getFullYear().toString();
    if (record.actionPeriod) {
        const [year, month] = record.actionPeriod.split('-');
        if (year && month) { selectedYear = year; selectedMonth = month; }
    }
    
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    document.getElementById('editHeaderDate').textContent = '📅 ' + monthNames[parseInt(selectedMonth) - 1] + ' / ' + selectedYear;
    
    // Set form values
    document.getElementById('editActionMonth').value = selectedMonth;
    
    // Fill year dropdown
    const yearSelect = document.getElementById('editActionYear');
    yearSelect.innerHTML = generateYearOptions(selectedYear);
    
    // Set amounts
    document.getElementById('editAmountUZS').value = record.amountUZS || '';
    document.getElementById('editAmountUSD').value = record.amountUSD || '';
    document.getElementById('editRate').value = record.rate || '';
    document.getElementById('editComment').value = record.comment || '';
    
    // Update currency view
    updateEditCurrencyView();
    
    // Show modal (using existing modal system)
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.classList.remove('hidden');
        if (tg && tg.HapticFeedback) { tg.HapticFeedback.impactOccurred('light'); }
    }
}

// Generate year options
function generateYearOptions(selectedYear) {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        options += `<option value="${year}" ${year.toString() === selectedYear ? 'selected' : ''}>${year}</option>`;
    }
    return options;
}

// Initialize year dropdown
function initializeYearDropdown() {
    const yearSelect = document.getElementById('actionYear');
    if (yearSelect && yearSelect.options.length === 0) {
        yearSelect.innerHTML = generateYearOptions(yearSelect.value);
    }
}

// Update currency view for edit form (existing function)
function updateEditCurrencyView() {
    const amountUSD = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate = parseFloat(document.getElementById('editRate').value) || 0;
    const calculatedUZS = amountUSD * rate;
    
    // Show/hide USD and rate rows based on input
    const editUsdRow = document.getElementById('editUsdRow');
    const editRateRow = document.getElementById('editRateRow');
    const editConversionPreview = document.getElementById('editConversionPreview');
    
    if (editUsdRow && editRateRow && editConversionPreview) {
        if (amountUSD > 0) {
            editUsdRow.style.display = 'block';
            editRateRow.style.display = 'block';
            editConversionPreview.style.display = 'block';
            editConversionPreview.innerHTML = `<strong>≈ ${calculatedUZS.toLocaleString()} UZS</strong> (${amountUSD.toLocaleString()} × ${rate.toLocaleString()})`;
        } else {
            editUsdRow.style.display = 'none';
            editRateRow.style.display = 'none';
            editConversionPreview.style.display = 'none';
        }
    }
}

// Function to perform edit action using existing form
async function performEdit() {
    const rowId = document.getElementById('editRowId').value;
    const actionMonth = document.getElementById('editActionMonth').value;
    const actionYear = document.getElementById('editActionYear').value;
    const amountUZS = parseFloat(document.getElementById('editAmountUZS').value) || 0;
    const amountUSD = parseFloat(document.getElementById('editAmountUSD').value) || 0;
    const rate = parseFloat(document.getElementById('editRate').value) || 0;
    const comment = document.getElementById('editComment').value;
    
    const saveBtn = document.querySelector('#editForm .btn-main');
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = '<span style="display: inline-block; animation: spinner 1s linear infinite; border: 2px solid #f3f3f3; border-top: 2px solid #10b981; border-radius: 50%; width: 16px; height: 16px; margin-right: 8px;"></span> Saqlanmoqda...';
    
    try {
        const reason = prompt("Tahrirlash sababini kiriting:");
        if (!reason) { showToastMsg('❌ Sabab kiritilishi shart', true); saveBtn.textContent = originalText; return; }
        
        const data = await apiRequest({
            action: 'admin_edit',
            rowId,
            actionPeriod: `${actionYear}-${actionMonth}`,
            amountUZS: amountUSD > 0 ? 0 : amountUZS,
            amountUSD: amountUSD > 0 ? amountUSD : 0,
            rate: amountUSD > 0 ? rate : 0,
            comment,
            reason
        });
        
        if (!data.success) throw new Error(data.error || "Saqlashda xato");
        closeModal();
        showToastMsg("✅ Saqlandi");
        loadAdminData();
    } catch (error) {
        showToastMsg('❌ Server xatosi: ' + error.message, true);
    } finally {
        saveBtn.textContent = originalText;
    }
}

// Function to close edit modal (using existing modal)
function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.classList.add('hidden');
    }
}

// Enhanced loadAdminData function with loading states
async function loadAdminData() {
    try {
        const adminListEl = document.getElementById('adminList');
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="skeleton-container" style="padding: 20px;">
                    <div class="skeleton skeleton-item" style="height: 80px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
                    <div class="skeleton skeleton-item" style="height: 80px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
                    <div class="skeleton skeleton-item" style="height: 80px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
                </div>
            `;
        }
        const response = await apiRequest({ action: 'admin_get_all' });
        if (response.success) {
            globalAdminData = response.data || [];
            
            // Populate filters
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
        const adminListEl = document.getElementById('adminList');
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="error-state" style="padding: 40px 20px; text-align: center; color: #dc2626;">
                    <div style="font-size: 60px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="margin: 0 0 8px; color: #b91c1c;">Xatolik yuz berdi</h3>
                    <p style="margin: 0; font-size: 14px;">${error.message || 'Ma\'lumotlarni yuklashda xatolik yuz berdi'}</p>
                    <button onclick="loadAdminData()" style="margin-top: 16px; background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Qayta urinib ko'rish</button>
                </div>
            `;
        }
    }
}

// Function to apply filters to admin data
function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const employeeFilter = document.getElementById('filterEmployee')?.value || 'all';
    const monthFilter = document.getElementById('filterMonth')?.value || 'all';
    const yearFilter = document.getElementById('filterYear')?.value || 'all';

    filteredData = globalAdminData.filter(item => {
        const matchesSearch = !searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.comment && item.comment.toLowerCase().includes(searchTerm));
        const matchesEmployee = employeeFilter === 'all' || item.name === employeeFilter;
        let matchesMonth = monthFilter === 'all';
        if (monthFilter !== 'all') {
            if (item.actionPeriod) { const [year, month] = item.actionPeriod.split('-'); matchesMonth = month === monthFilter; }
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
    renderAdminList(filteredData);
}

// Function to update pagination
function updatePagination() {
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) paginationEl.style.display = 'none';
}

// Function to populate employee filter
function populateEmployeeFilter() {
    const filterEmployee = document.getElementById('filterEmployee');
    if (!filterEmployee) return;
    const employeeNames = [...new Set(globalAdminData.map(item => item.name))].filter(Boolean);
    filterEmployee.innerHTML = '<option value="all">Barcha xodimlar</option>';
    employeeNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterEmployee.appendChild(option);
    });
}

// Function to populate year filter
function populateYearFilter() {
    const filterYear = document.getElementById('filterYear');
    if (!filterYear) return;
    
    const years = [...new Set(globalAdminData.map(item => {
        if (item.actionPeriod) {
            const [year] = item.actionPeriod.split('-');
            return year;
        }
        const dateMeta = getDateMonthYear(item.date);
        return dateMeta ? dateMeta.year : null;
    }).filter(Boolean))];
    
    filterYear.innerHTML = '<option value="all">Barcha yillar</option>';
    years.sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYear.appendChild(option);
    });
}

// Function to populate month filter
function populateMonthFilter() {
    const filterMonth = document.getElementById('filterMonth');
    if (!filterMonth) return;
    
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    filterMonth.innerHTML = '<option value="all">Barcha oylar</option>';
    monthNames.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = (index + 1).toString().padStart(2, '0');
        option.textContent = name;
        filterMonth.appendChild(option);
    });
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
    @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;
document.head.appendChild(style);