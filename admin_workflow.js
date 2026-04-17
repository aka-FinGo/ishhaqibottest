/**
 * admin_workflow.js - Jarayonlarni boshqarish (Admin)
 * Optimizatsiya: Event Delegation, DOM Caching, apiRequest orqali ishlash
 * Muammo hal qilindi: Inputlar blokdan chiqishi va Select qiymatlari saqlanishi
 */

const WorkflowState = {
    processes: [],
    stages: [],
    currentFilter: {},
    editingId: null,
    elements: {}
};

// 1. DOM Elementlarini Cache qilish
function initWorkflowCache() {
    WorkflowState.elements = {
        tableBody: document.getElementById('workflowTableBody'),
        filterStatus: document.getElementById('filterProcessStatus'),
        filterStage: document.getElementById('filterProcessStage'),
        searchInput: document.getElementById('workflowSearch'),
        addBtn: document.getElementById('addProcessBtn'),
        modal: document.getElementById('processModal'),
        form: document.getElementById('processForm'),
        saveBtn: document.getElementById('saveProcessBtn'),
        closeBtn: document.getElementById('closeProcessModal'),
        // Form ichidagi muhim elementlar
        startStageSelect: document.getElementById('startStage'),
        endStageSelect: document.getElementById('endStage')
    };
}

// 2. Ma'lumotlarni Yuklash (apiRequest orqali)
async function loadWorkflowData() {
    try {
        toggleLoading(true);
        
        // Parallel so'rovlar
        const [processes, stages] = await Promise.all([
            apiRequest({ action: 'getProcesses' }),
            apiRequest({ action: 'getStages' })
        ]);

        WorkflowState.processes = processes.result || processes.data || [];
        WorkflowState.stages = stages.result || stages.data || [];

        renderTable(WorkflowState.processes);
        populateStageFilters(WorkflowState.stages);
        
    } catch (error) {
        console.error("Jarayonlarni yuklashda xatolik:", error);
        alert("Jarayonlarni yuklashda xatolik yuz berdi: " + error.message);
    } finally {
        toggleLoading(false);
    }
}

// 3. Jadvalni Render Qilish (DocumentFragment optimizatsiyasi)
function renderTable(processes) {
    const tbody = WorkflowState.elements.tableBody;
    if (!tbody) return;

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    const filtered = filterProcesses(processes);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Ma\'lumot topilmadi</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        // Xavfsiz HTML render
        tr.innerHTML = `
            <td>${escapeHtml(item.name || '')}</td>
            <td>${escapeHtml(item.code || '')}</td>
            <td><span class="badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}">${item.status}</span></td>
            <td>${escapeHtml(item.startStageName || '-')}</td>
            <td>${escapeHtml(item.endStageName || '-')}</td>
            <td>
                <button class="btn-sm btn-edit" data-id="${item.id}">✏️</button>
                <button class="btn-sm btn-delete" data-id="${item.id}">🗑️</button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// 4. Filtrlash Mantiqi
function filterProcesses(list) {
    const { status, stage, search } = WorkflowState.currentFilter;
    return list.filter(item => {
        const matchStatus = !status || item.status === status;
        const matchStage = !stage || item.startStage === stage || item.endStage === stage;
        const matchSearch = !search || 
            (item.name && item.name.toLowerCase().includes(search.toLowerCase())) ||
            (item.code && item.code.toLowerCase().includes(search.toLowerCase()));
        return matchStatus && matchStage && matchSearch;
    });
}

// 5. Selectlarni To'ldirish (Boshlanish/Yakunlash bosqichi uchun)
function populateStageFilters(stages) {
    const startSel = WorkflowState.elements.startStageSelect;
    const endSel = WorkflowState.elements.endStageSelect;
    const filterSel = WorkflowState.elements.filterStage;

    if (!stages || stages.length === 0) return;

    const optionsHtml = '<option value="">Tanlang...</option>' + 
        stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    // Hozirgi tanlovni saqlab qolish uchun qiymatni keyinroq o'rnatamiz
    if (startSel) {
        const currentVal = startSel.value;
        startSel.innerHTML = optionsHtml;
        if (currentVal) startSel.value = currentVal;
    }
    
    if (endSel) {
        const currentVal = endSel.value;
        endSel.innerHTML = optionsHtml;
        if (currentVal) endSel.value = currentVal;
    }

    if (filterSel) {
        filterSel.innerHTML = '<option value="">Barchasi</option>' + 
            stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    }
}

// 6. Event Listenerlar (Delegation)
function setupWorkflowListeners() {
    // Jadval ichidagi tugmalar
    const tbody = WorkflowState.elements.tableBody;
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const id = btn.dataset.id;
            if (btn.classList.contains('btn-edit')) openEditModal(id);
            if (btn.classList.contains('btn-delete')) deleteProcess(id);
        });
    }

    // Qidiruv (Debounce)
    const searchInput = WorkflowState.elements.searchInput;
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                WorkflowState.currentFilter.search = e.target.value.trim();
                renderTable(WorkflowState.processes);
            }, 300);
        });
    }

    // Filterlar
    const filterStatus = WorkflowState.elements.filterStatus;
    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            WorkflowState.currentFilter.status = e.target.value;
            renderTable(WorkflowState.processes);
        });
    }

    const filterStage = WorkflowState.elements.filterStage;
    if (filterStage) {
        filterStage.addEventListener('change', (e) => {
            WorkflowState.currentFilter.stage = e.target.value;
            renderTable(WorkflowState.processes);
        });
    }

    // Modal ochish/yopish
    const addBtn = WorkflowState.elements.addBtn;
    if (addBtn) addBtn.addEventListener('click', () => openEditModal(null));

    const closeBtn = WorkflowState.elements.closeBtn;
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Saqlash
    const saveBtn = WorkflowState.elements.saveBtn;
    if (saveBtn) saveBtn.addEventListener('click', handleSave);
}

// 7. Modalni Ochish (Yangi yoki Tahrir)
function openEditModal(id) {
    WorkflowState.editingId = id;
    const form = WorkflowState.elements.form;
    const modal = WorkflowState.elements.modal;
    
    if (!form || !modal) return;

    // Formani tozalash
    form.reset();
    
    // Selectlarni yangilash (agar hali yuklanmagan bo'lsa)
    if (WorkflowState.stages.length > 0) {
        populateStageFilters(WorkflowState.stages);
    }

    if (id) {
        // Tahrirlash rejimi
        const item = WorkflowState.processes.find(p => p.id == id);
        if (item) {
            form.querySelector('[name="name"]')?.setValue || (form.querySelector('[name="name"]').value = item.name);
            form.querySelector('[name="code"]')?.setValue || (form.querySelector('[name="code"]').value = item.code);
            
            // MUHIM: Select qiymatlarini to'g'ri o'rnatish
            const startSel = WorkflowState.elements.startStageSelect;
            const endSel = WorkflowState.elements.endStageSelect;
            
            if (startSel) startSel.value = item.startStage || item.startStageId || '';
            if (endSel) endSel.value = item.endStage || item.endStageId || '';
            
            // Statusni ham o'rnatish kerak bo'lsa
            const statusSel = form.querySelector('[name="status"]');
            if (statusSel) statusSel.value = item.status || 'active';
        }
        modal.querySelector('.modal-title').textContent = "Jarayonni Tahrirlash";
    } else {
        // Yangi qo'shish
        modal.querySelector('.modal-title').textContent = "Yangi Jarayon";
        // Default qiymatlar
        if (WorkflowState.elements.startStageSelect) WorkflowState.elements.startStageSelect.value = "";
        if (WorkflowState.elements.endStageSelect) WorkflowState.elements.endStageSelect.value = "";
    }

    modal.style.display = 'flex';
}

// 8. Saqlash Jarayoni (apiRequest)
async function handleSave() {
    const form = WorkflowState.elements.form;
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Validatsiya
    if (!data.name || !data.code) {
        alert("Ism va Kod majburiy!");
        return;
    }

    // Start/End Stage ID larni to'g'rilash
    if (WorkflowState.elements.startStageSelect) {
        data.startStageId = WorkflowState.elements.startStageSelect.value;
        data.startStageName = WorkflowState.elements.startStageSelect.options[WorkflowState.elements.startStageSelect.selectedIndex]?.text || '';
    }
    if (WorkflowState.elements.endStageSelect) {
        data.endStageId = WorkflowState.elements.endStageSelect.value;
        data.endStageName = WorkflowState.elements.endStageSelect.options[WorkflowState.elements.endStageSelect.selectedIndex]?.text || '';
    }

    try {
        setButtonLoading(WorkflowState.elements.saveBtn, true, "Saqlanmoqda...");
        
        // Inputlarni bloklash (faqat saqlash paytida)
        toggleFormInputs(true);

        const payload = {
            action: WorkflowState.editingId ? 'updateProcess' : 'createProcess',
            data: data,
            id: WorkflowState.editingId
        };

        const response = await apiRequest(payload);
        
        if (response.status === 'success' || response.result) {
            closeModal();
            await loadWorkflowData(); // Jadvalni yangilash
            alert(WorkflowState.editingId ? "O'zgartirish saqlandi!" : "Yangi jarayon qo'shildi!");
        } else {
            throw new Error(response.message || "Noma'lum xatolik");
        }

    } catch (error) {
        console.error("Saqlash xatosi:", error);
        alert("Saqlashda xatolik: " + error.message);
    } finally {
        setButtonLoading(WorkflowState.elements.saveBtn, false);
        toggleFormInputs(false); // Inputlarni QAYTA OCHISH (Muammo shu yerda hal bo'ladi)
    }
}

// 9. Yordamchi Funksiyalar
function closeModal() {
    const modal = WorkflowState.elements.modal;
    if (modal) {
        modal.style.display = 'none';
        WorkflowState.editingId = null;
        WorkflowState.elements.form?.reset();
    }
}

function toggleFormInputs(disabled) {
    const form = WorkflowState.elements.form;
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, select, button:not(#closeProcessModal)');
    inputs.forEach(input => {
        // Saqlash tugmasini alohida boshqaramiz, qolganlarni blocklaymiz
        if (input.id !== 'saveProcessBtn') {
            input.disabled = disabled;
        }
    });
}

function toggleLoading(show) {
    const loader = document.getElementById('globalLoader') || document.getElementById('loader');
    if (loader) loader.style.display = show ? 'block' : 'none';
    
    // Umumiy opacity o'zgarishi
    const mainContent = document.querySelector('.main-content') || document.body;
    if (mainContent) mainContent.style.pointerEvents = show ? 'none' : 'auto';
}

async function deleteProcess(id) {
    if (!confirm("Rostdan ham o'chirmoqchimisiz?")) return;
    
    try {
        toggleLoading(true);
        const response = await apiRequest({
            action: 'deleteProcess',
            id: id
        });
        
        if (response.status === 'success' || response.result) {
            await loadWorkflowData();
            alert("O'chirildi!");
        } else {
            throw new Error(response.message);
        }
    } catch (error) {
        alert("O'chirishda xatolik: " + error.message);
    } finally {
        toggleLoading(false);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initWorkflowCache();
    loadWorkflowData();
    setupWorkflowListeners();
});
