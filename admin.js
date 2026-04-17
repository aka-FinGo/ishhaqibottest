/**
 * admin.js - Admin panel boshqaruvi
 * Optimizatsiya: Event Delegation, DOM Caching, Batch Updates
 */

// Global state va cache
const AdminState = {
    currentFilter: {},
    cache: {
        users: [],
        roles: [],
        positions: []
    },
    elements: {}
};

// DOM elementlarini bir marta yuklash va cache qilish
function initAdminCache() {
    AdminState.elements = {
        tableBody: document.getElementById('adminTableBody'),
        filterRole: document.getElementById('filterRole'),
        filterPosition: document.getElementById('filterPosition'),
        searchInput: document.getElementById('adminSearch'),
        addBtn: document.getElementById('addUserBtn'),
        modal: document.getElementById('userModal'),
        form: document.getElementById('userForm'),
        saveBtn: document.getElementById('saveUserBtn')
    };
}

// Asosiy yuklash funksiyasi
async function loadAdminData() {
    try {
        showLoading(true);
        
        // Check if we're in the dashboard actions area
        const adminListEl = document.getElementById('adminList');
        
        if (adminListEl) {
            // Load admin data for transactions/actions
            const response = await apiRequest({ action: 'admin_get_all' });
            
            if (response.success) {
                globalAdminData = response.data || [];
                
                // Apply any active filters
                applyFilters();
                
                // Render the admin list
                renderAdminList(globalAdminData);
                
                // Update pagination if needed
                updatePagination();
            } else {
                throw new Error(response.error || 'Ma\'lumotlarni yuklashda xatolik yuz berdi');
            }
        } else {
            // Load user management data
            const [users, roles, positions] = await Promise.all([
                apiRequest({action: 'getUsers'}),
                apiRequest({action: 'getRoles'}),
                apiRequest({action: 'getPositions'})
            ]);
            
            AdminState.cache.users = users.data || [];
            AdminState.cache.roles = roles.data || [];
            AdminState.cache.positions = positions.data || [];
            
            renderUserTable(AdminState.cache.users);
            populateFilters(AdminState.cache.roles, AdminState.cache.positions);
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
        } else {
            showError("Ma'lumotlarni yuklashda xatolik: " + error.message);
        }
    } finally {
        showLoading(false);
    }
}

// Cache helper
function cacheData(key) {
    return function(data) {
        AdminState.cache[key] = data;
        return data;
    };
}

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

// Jadvalni render qilish (Optimizatsiya: DocumentFragment)
function renderUserTable(users) {
    const tbody = AdminState.elements.tableBody;
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    const filtered = filterUsers(users);
    
    filtered.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.position || '-'}</td>
            <td>
                <button class="btn-edit" data-id="${user.id}">Tahrirlash</button>
                <button class="btn-delete" data-id="${user.id}">O'chirish</button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
}

// Function to populate employee filter
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

// Filtrlash mantiqi
function filterUsers(users) {
    const { role, position, search } = AdminState.currentFilter;
    
    return users.filter(user => {
        const matchRole = !role || user.role === role;
        const matchPos = !position || user.position === position;
        const matchSearch = !search || 
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase());
            
        return matchRole && matchPos && matchSearch;
    });
}

// Filtrlarni to'ldirish
function populateFilters(roles, positions) {
    const roleSelect = AdminState.elements.filterRole;
    const posSelect = AdminState.elements.filterPosition;
    
    if (roleSelect) {
        roleSelect.innerHTML = '<option value="">Barchasi</option>' + 
            roles.map(r => `<option value="${r}">${r}</option>`).join('');
    }
    
    if (posSelect) {
        posSelect.innerHTML = '<option value="">Barchasi</option>' + 
            positions.map(p => `<option value="${p}">${p}</option>`).join('');
    }
}

// Event Delegation (Bitta listener bilan barcha tugmalarni boshqarish)
function setupEventListeners() {
    const tableBody = AdminState.elements.tableBody;
    if (!tableBody) return;

    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        
        if (target.classList.contains('btn-edit')) {
            editUser(id);
        } else if (target.classList.contains('btn-delete')) {
            deleteUser(id);
        }
    });
    
    // Filter o'zgarishlari
    if (AdminState.elements.filterRole) {
        AdminState.elements.filterRole.addEventListener('change', (e) => {
            AdminState.currentFilter.role = e.target.value;
            renderUserTable(AdminState.cache.users);
        });
    }
    
    if (AdminState.elements.filterPosition) {
        AdminState.elements.filterPosition.addEventListener('change', (e) => {
            AdminState.currentFilter.position = e.target.value;
            renderUserTable(AdminState.cache.users);
        });
    }
    
    // Qidiruv (Debounce bilan)
    if (AdminState.elements.searchInput) {
        let timeout;
        AdminState.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                AdminState.currentFilter.search = e.target.value;
                renderUserTable(AdminState.cache.users);
            }, 300);
        });
    }
    
    // Modal saqlash
    if (AdminState.elements.saveBtn) {
        AdminState.elements.saveBtn.addEventListener('click', saveUser);
    }
}

// Foydalanuvchini tahrirlash
function editUser(id) {
    const user = AdminState.cache.users.find(u => u.id === id);
    if (!user) return;
    
    const form = AdminState.elements.form;
    if (form) {
        form.dataset.userId = id;
        form.querySelector('[name="name"]').value = user.name;
        form.querySelector('[name="email"]').value = user.email;
        form.querySelector('[name="role"]').value = user.role;
        // Boshqa maydonlar...
        
        AdminState.elements.modal.style.display = 'block';
    }
}

// Foydalanuvchini saqlash
async function saveUser() {
    const form = AdminState.elements.form;
    if (!form) return;
    
    const userId = form.dataset.userId;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    try {
        showLoading(true);
        const result = await apiRequest({action: 'saveUser', data: data, userId: userId});
        if (result.success) {
            closeModal();
            loadAdminData(); // Yangilash
            showSuccess("Muvaffaqiyatli saqlandi!");
        } else {
            showError("Saqlashda xatolik: " + (result.error || "Noma'lum xatolik"));
        }
    } catch (error) {
        showError("Saqlashda xatolik: " + error.message);
    } finally {
        showLoading(false);
    }
}

// Modalni yopish
function closeModal() {
    if (AdminState.elements.modal) {
        AdminState.elements.modal.style.display = 'none';
        AdminState.elements.form.reset();
        delete AdminState.elements.form.dataset.userId;
    }
}

// Yuklanishni boshqarish
function showLoading(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'block' : 'none';
    // Inputlarni bloklash/ochish
    const inputs = document.querySelectorAll('#userModal input, #userModal select');
    inputs.forEach(input => input.disabled = show);
}

function showError(msg) { alert(msg); }
function showSuccess(msg) { alert(msg); }

// Init
document.addEventListener('DOMContentLoaded', () => {
    initAdminCache();
    loadAdminData();
    setupEventListeners();
});