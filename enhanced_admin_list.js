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

// Basic edit modal function with currency-specific form
function showEditModal(rowId) {
    const record = findRecordByRowId(rowId);
    if (!record) return;
    
    let selectedMonth = '01';
    let selectedYear = new Date().getFullYear().toString();
    if (record.actionPeriod) {
        const [year, month] = record.actionPeriod.split('-');
        if (year && month) { selectedYear = year; selectedMonth = month; }
    }
    
    const isUSD = record.amountUSD && record.amountUSD > 0;
    const amountUZS = record.amountUZS || 0;
    const amountUSD = record.amountUSD || 0;
    const rate = record.rate || 0;
    const calculatedUZS = isUSD ? (amountUSD * rate) : amountUZS;
    
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const currentMonthName = monthNames[parseInt(selectedMonth) - 1];
    
    const editHtml = `
        <div id="editActionModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1002;" onclick="closeEditModal(event)">
            <div style="background: white; border-radius: 12px; padding: 24px; margin: 20px; max-width: 90%; width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0 0 8px; color: #1e293b;">✏️ Tahrirlash</h3>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${record.name || 'Noma\'lum'}</span>
                            <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${currentMonthName} / ${selectedYear}</span>
                        </div>
                    </div>
                    <button onclick="closeEditModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">&times;</button>
                </div>
                
                <div id="addFormContent" class="card" style="background: #f8fafc; border-radius: 8px; padding: 16px;">
                    <form id="financeForm">
                        <div class="input-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">DAVRI (QAYSI OY UCHUN)</label>
                            <div style="display: flex; gap: 10px;">
                                <select id="actionMonth" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 15px; background: white;">
                                    <option value="01" ${selectedMonth === '01' ? 'selected' : ''}>Yanvar</option>
                                    <option value="02" ${selectedMonth === '02' ? 'selected' : ''}>Fevral</option>
                                    <option value="03" ${selectedMonth === '03' ? 'selected' : ''}>Mart</option>
                                    <option value="04" ${selectedMonth === '04' ? 'selected' : ''}>Aprel</option>
                                    <option value="05" ${selectedMonth === '05' ? 'selected' : ''}>May</option>
                                    <option value="06" ${selectedMonth === '06' ? 'selected' : ''}>Iyun</option>
                                    <option value="07" ${selectedMonth === '07' ? 'selected' : ''}>Iyul</option>
                                    <option value="08" ${selectedMonth === '08' ? 'selected' : ''}>Avgust</option>
                                    <option value="09" ${selectedMonth === '09' ? 'selected' : ''}>Sentyabr</option>
                                    <option value="10" ${selectedMonth === '10' ? 'selected' : ''}>Oktyabr</option>
                                    <option value="11" ${selectedMonth === '11' ? 'selected' : ''}>Noyabr</option>
                                    <option value="12" ${selectedMonth === '12' ? 'selected' : ''}>Dekabr</option>
                                </select>
                                <select id="actionYear" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 15px; background: white;">
                                    ${generateYearOptions(selectedYear)}
                                </select>
                            </div>
                        </div>
                        
                        ${!isUSD ? `
                        <div class="input-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">💰 SUMMA (UZS)</label>
                            <input type="number" id="amountUZS" value="${amountUZS}" required placeholder="0" inputmode="numeric" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 16px; background: white;">
                        </div>
                        ` : `
                        <div class="input-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">💰 SUMMA (UZS)</label>
                            <input type="number" id="amountUZS" value="${amountUZS}" readonly placeholder="0" inputmode="numeric" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 16px; background: #f1f5f9; color: #64748b;">
                        </div>
                        
                        <div class="input-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">💵 SUMMA (USD)</label>
                            <input type="number" id="amountUSD" value="${amountUSD}" required placeholder="0" inputmode="numeric" onchange="calculateUZS()" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 16px; background: white;">
                        </div>
                        
                        <div class="input-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">📈 VALYUTA KURSI (1 USD = ? UZS)</label>
                            <input type="number" id="rate" value="${rate}" required placeholder="Masalan: 12600" inputmode="numeric" onchange="calculateUZS()" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 16px; background: white;">
                        </div>
                        
                        <div id="calculatedUZS" style="margin-bottom: 16px; padding: 12px; background: #dcfce7; border-radius: 8px; color: #166534; font-weight: 500;">
                            ≈ ${calculatedUZS.toLocaleString()} UZS (${amountUSD.toLocaleString()} × ${rate.toLocaleString()})
                        </div>
                        `}
                        
                        <div class="input-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #64748b; font-size: 13px;">📝 IZOH</label>
                            <textarea id="comment" rows="3" placeholder="Avans / Oylik haqida izoh..." style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; resize: vertical; background: white;">${record.comment || 'Izoh yo\'q'}</textarea>
                        </div>
                        
                        <div style="display: flex; gap: 12px;">
                            <button type="button" onclick="closeEditModal()" style="flex: 1; padding: 14px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer;">❌ Bekor</button>
                            <button type="submit" class="btn-main" id="submitBtn" onclick="performEdit('${rowId}'); return false;" style="flex: 1; padding: 14px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer;">💾 Saqlash</button>
                        </div>
                    </form>
                    <div id="status" class="status-msg"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', editHtml);
    initializeYearDropdown();
    if (tg && tg.HapticFeedback) { tg.HapticFeedback.impactOccurred('light'); }
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

// Calculate UZS from USD and rate
function calculateUZS() {
    const amountUSD = parseFloat(document.getElementById('amountUSD').value) || 0;
    const rate = parseFloat(document.getElementById('rate').value) || 0;
    const calculatedUZS = amountUSD * rate;
    const calculatedDiv = document.getElementById('calculatedUZS');
    if (calculatedDiv) {
        calculatedDiv.innerHTML = `≈ ${calculatedUZS.toLocaleString()} UZS (${amountUSD.toLocaleString()} × ${rate.toLocaleString()})`;
    }
    const amountUZSInput = document.getElementById('amountUZS');
    if (amountUZSInput) { amountUZSInput.value = calculatedUZS; }
}

// Function to perform edit action with new form
async function performEdit(rowId) {
    const actionMonth = document.getElementById('actionMonth').value;
    const actionYear = document.getElementById('actionYear').value;
    const amountUZS = parseFloat(document.getElementById('amountUZS').value) || 0;
    const amountUSD = document.getElementById('amountUSD') ? (parseFloat(document.getElementById('amountUSD').value) || 0) : 0;
    const rate = document.getElementById('rate') ? (parseFloat(document.getElementById('rate').value) || 0) : 0;
    const comment = document.getElementById('comment').value;
    
    const saveBtn = document.getElementById('submitBtn');
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = '<span style="display: inline-block; animation: spinner 1s linear infinite; border: 2px solid #f3f3f3; border-top: 2px solid #10b981; border-radius: 50%; width: 16px; height: 16px; margin-right: 8px;"></span> Saqlanmoqda...';
    saveBtn.disabled = true;
    
    try {
        const reason = prompt("Tahrirlash sababini kiriting:");
        if (!reason) { showToastMsg('❌ Sabab kiritilishi shart', true); saveBtn.innerHTML = originalText; saveBtn.disabled = false; return; }
        
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
        closeEditModal();
        showToastMsg("✅ Saqlandi");
        loadAdminData();
    } catch (error) {
        showToastMsg('❌ Server xatosi: ' + error.message, true);
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Function to close edit modal
function closeEditModal(event) {
    if (event && event.target.id !== 'editActionModal') return;
    const modal = document.getElementById('editActionModal');
    if (modal) modal.remove();
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

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
    @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;
document.head.appendChild(style);