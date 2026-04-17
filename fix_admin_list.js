/**
 * Fix for admin list display
 * This function properly renders the admin list in #adminList element
 */

// Function to render admin list (transactions/actions)
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
        // Compare dates - assuming 'date' field exists
        const dateA = new Date(a.date || a.createdAt || a.timestamp || '');
        const dateB = new Date(b.date || b.createdAt || b.timestamp || '');
        return dateB - dateA; // Newest first
    });

    let html = '<div class="admin-list-container">';
    
    sortedData.forEach(item => {
        const amountUZS = item.amountUZS || 0;
        const amountUSD = item.amountUSD || 0;
        const rate = item.rate || 0;
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
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #1e293b;">${name}</div>
                    <div style="color: #64748b; font-size: 12px;">${date}</div>
                </div>
                
                <div style="margin-bottom: 8px;">
                    <div style="color: #64748b; font-size: 13px;">${comment}</div>
                    ${actionPeriod ? `<div style="color: #0ea5e9; font-size: 12px; margin-top: 4px;">Davr: ${actionPeriod}</div>` : ''}
                </div>
                
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    ${amountUZS ? `<div class="amount-chip uzs" style="
                        background: #dcfce7;
                        color: #166534;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                    ">💰 ${Number(amountUZS).toLocaleString()} UZS</div>` : ''}
                    
                    ${amountUSD ? `<div class="amount-chip usd" style="
                        background: #dbeafe;
                        color: #1e40af;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                    ">💵 $${Number(amountUSD).toLocaleString()}</div>` : ''}
                    
                    ${rate ? `<div class="rate-tag" style="
                        background: #fef3c7;
                        color: #92400e;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    ">📈 ${Number(rate).toLocaleString()}</div>` : ''}
                </div>
                
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="btn-edit" onclick="openEdit('${item.rowId || item.id}')" style="
                        background: #e0f2fe;
                        color: #0369a1;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                    ">Tahrirlash</button>
                    <button class="btn-delete" onclick="deleteRecord('${item.rowId || item.id}')" style="
                        background: #fee2e2;
                        color: #b91c1c;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                    ">O'chirish</button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    adminListEl.innerHTML = html;
}

// Enhanced loadAdminData function that properly populates adminList
async function loadAdminData() {
    try {
        // Show loading state
        const adminListEl = document.getElementById('adminList');
        if (adminListEl) {
            adminListEl.innerHTML = `
                <div class="skeleton skeleton-item" style="height: 60px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
                <div class="skeleton skeleton-item" style="height: 60px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
                <div class="skeleton skeleton-item" style="height: 60px; background: #f1f5f9; margin-bottom: 12px; border-radius: 8px;"></div>
            `;
        }

        // Get all transactions/actions from the server
        const response = await apiRequest({ action: 'admin_get_all' });
        
        if (response.success) {
            globalAdminData = response.data || [];
            
            // Apply any active filters
            applyFilters();
            
            // Render the admin list
            renderAdminList(filteredData || globalAdminData);
            
            // Update pagination if needed
            updatePagination();
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
                    <button onclick="loadAdminData()" style="
                        margin-top: 16px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Qayta urinib ko'rish</button>
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
        // Search filter
        const matchesSearch = !searchTerm || 
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (item.comment && item.comment.toLowerCase().includes(searchTerm));

        // Employee filter
        const matchesEmployee = employeeFilter === 'all' || item.name === employeeFilter;

        // Month filter
        let matchesMonth = monthFilter === 'all';
        if (monthFilter !== 'all') {
            if (item.actionPeriod) {
                const [year, month] = item.actionPeriod.split('-');
                matchesMonth = month === monthFilter;
            } else {
                const dateMeta = getDateMonthYear(item.date);
                if (dateMeta) {
                    matchesMonth = dateMeta.month === monthFilter;
                }
            }
        }

        // Year filter
        let matchesYear = yearFilter === 'all';
        if (yearFilter !== 'all') {
            if (item.actionPeriod) {
                const [year] = item.actionPeriod.split('-');
                matchesYear = year === yearFilter;
            } else {
                const dateMeta = getDateMonthYear(item.date);
                if (dateMeta) {
                    matchesYear = dateMeta.year === yearFilter;
                }
            }
        }

        return matchesSearch && matchesEmployee && matchesMonth && matchesYear;
    });

    // Update count display
    const countEl = document.getElementById('filteredCount');
    if (countEl) {
        countEl.textContent = filteredData.length;
    }

    // Re-render the list with filtered data
    renderAdminList(filteredData);
}

// Function to update pagination
function updatePagination() {
    // Simple pagination - could be enhanced based on requirements
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) {
        // For now, just hide pagination if not needed
        paginationEl.style.display = 'none';
    }
}

// Populate employee filter dropdown
function populateEmployeeFilter() {
    const filterEmployee = document.getElementById('filterEmployee');
    if (!filterEmployee) return;

    // Get unique employee names from globalAdminData
    const employeeNames = [...new Set(globalAdminData.map(item => item.name))].filter(Boolean);
    
    filterEmployee.innerHTML = '<option value="all">Barcha xodimlar</option>';
    employeeNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterEmployee.appendChild(option);
    });
}