/**
 * employee.js - Xodimlar paneli
 * Optimizatsiya: Lazy Loading, Event Delegation, Minimal DOM updates
 */

const EmployeeState = {
    tasks: [],
    currentUser: null,
    elements: {}
};

// DOM Cache
function initEmployeeCache() {
    EmployeeState.elements = {
        taskList: document.getElementById('employeeTaskList'),
        statusFilter: document.getElementById('empStatusFilter'),
        refreshBtn: document.getElementById('empRefreshBtn')
    };
}

// Ma'lumotlarni yuklash
async function loadEmployeeTasks() {
    try {
        toggleLoading(true);
        const user = await google.script.run.getCurrentUser();
        EmployeeState.currentUser = user;
        
        const tasks = await google.script.run.getEmployeeTasks(user.email);
        EmployeeState.tasks = tasks;
        
        renderTasks(tasks);
    } catch (error) {
        console.error("Xatolik:", error);
        alert("Vazifalarni yuklashda xatolik!");
    } finally {
        toggleLoading(false);
    }
}

// Vazifalarni chiqarish (Optimizatsiya: Fragment)
function renderTasks(tasks) {
    const list = EmployeeState.elements.taskList;
    if (!list) return;
    
    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    const status = EmployeeState.elements.statusFilter?.value || 'all';
    const filtered = status === 'all' ? tasks : tasks.filter(t => t.status === status);
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state">Vazifalar topilmadi</div>';
        return;
    }
    
    filtered.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <h3>${task.title}</h3>
            <p>${task.description}</p>
            <span class="badge ${task.status}">${task.status}</span>
            <button class="btn-start" data-id="${task.id}" ${task.status !== 'pending' ? 'disabled' : ''}>
                ${task.status === 'pending' ? 'Boshlash' : 'Boshlangan'}
            </button>
        `;
        fragment.appendChild(div);
    });
    
    list.appendChild(fragment);
}

// Event Listenerlar (Delegation)
function setupEmployeeListeners() {
    const list = EmployeeState.elements.taskList;
    if (!list) return;
    
    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-start')) {
            const id = e.target.dataset.id;
            updateTaskStatus(id, 'in_progress');
        }
    });
    
    if (EmployeeState.elements.statusFilter) {
        EmployeeState.elements.statusFilter.addEventListener('change', () => {
            renderTasks(EmployeeState.tasks);
        });
    }
    
    if (EmployeeState.elements.refreshBtn) {
        EmployeeState.elements.refreshBtn.addEventListener('click', loadEmployeeTasks);
    }
}

// Vazifa holatini yangilash
async function updateTaskStatus(id, status) {
    try {
        toggleLoading(true);
        await google.script.run.updateTaskStatus(id, status);
        
        // Local yangilash (API ga qayta so'rov yubormaslik uchun)
        const taskIndex = EmployeeState.tasks.findIndex(t => t.id == id);
        if (taskIndex > -1) {
            EmployeeState.tasks[taskIndex].status = status;
            renderTasks(EmployeeState.tasks);
        }
        
        alert("Holat o'zgartirildi!");
    } catch (error) {
        alert("Xatolik: " + error.message);
    } finally {
        toggleLoading(false);
    }
}

function toggleLoading(show) {
    const loader = document.getElementById('empLoader');
    if (loader) loader.style.display = show ? 'block' : 'none';
    if (EmployeeState.elements.taskList) {
        EmployeeState.elements.taskList.style.opacity = show ? '0.5' : '1';
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initEmployeeCache();
    loadEmployeeTasks();
    setupEmployeeListeners();
});
