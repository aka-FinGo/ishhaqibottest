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
    } catch (error) {
        showError("Ma'lumotlarni yuklashda xatolik: " + error.message);
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
