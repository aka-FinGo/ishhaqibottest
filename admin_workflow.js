/**
 * admin_workflow.js - Jarayonlar va Bosqichlarni Boshqarish
 * Optimizatsiya: State Management, Dynamic Select Fix, Event Delegation
 */

const WorkflowState = {
    workflows: [],
    stages: [], // Barcha mavjud bosqichlar
    currentFilter: {},
    editingId: null,
    cache: {
        stagesMap: {} // Tez qidirish uchun xesh-xarita
    },
    elements: {}
};

// 1. DOM Elementlarini Cache qilish
function initWorkflowCache() {
    WorkflowState.elements = {
        tableBody: document.getElementById('workflowTableBody'),
        stageSelectStart: document.getElementById('startStageSelect'),
        stageSelectEnd: document.getElementById('endStageSelect'),
        searchInput: document.getElementById('workflowSearch'),
        filterStatus: document.getElementById('filterWorkflowStatus'),
        modal: document.getElementById('workflowModal'),
        form: document.getElementById('workflowForm'),
        saveBtn: document.getElementById('saveWorkflowBtn'),
        loader: document.getElementById('workflowLoader')
    };
}

// 2. Ma'lumotlarni Yuklash (Batch)
async function loadWorkflows() {
    try {
        toggleLoading(true);
        
        // Parallel so'rovlar
        const [workflows, allStages] = await Promise.all([
            google.script.run.getWorkflows(),
            google.script.run.getAllStages()
        ]);

        WorkflowState.workflows = workflows;
        WorkflowState.stages = allStages;
        
        // Xesh-xarita yaratish (Tez ishlash uchun)
        WorkflowState.cache.stagesMap = {};
        allStages.forEach(s => WorkflowState.cache.stagesMap[s.id] = s.name);

        renderTable();
        populateStageSelects(); // Selectlarni to'ldirish
        
    } catch (error) {
        console.error("Workflow yuklashda xatolik:", error);
        alert("Jarayonlarni yuklashda xatolik yuz berdi!");
    } finally {
        toggleLoading(false);
    }
}

// 3. Jadvalni Render Qilish (DocumentFragment)
function renderTable() {
    const tbody = WorkflowState.elements.tableBody;
    if (!tbody) return;

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    const filtered = filterWorkflows(WorkflowState.workflows);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Ma\'lumot topilmadi</td></tr>';
        return;
    }

    filtered.forEach(wf => {
        const tr = document.createElement('tr');
        // Bosqich nomlarini ID dan olish
        const startName = WorkflowState.cache.stagesMap[wf.startStageId] || 'Noma\'lum';
        const endName = WorkflowState.cache.stagesMap[wf.endStageId] || 'Noma\'lum';

        tr.innerHTML = `
            <td>${wf.name}</td>
            <td>${startName}</td>
            <td>${endName}</td>
            <td><span class="badge ${wf.status}">${wf.status}</span></td>
            <td>
                <button class="btn-sm btn-edit" data-id="${wf.id}">✏️</button>
                <button class="btn-sm btn-delete" data-id="${wf.id}">🗑️</button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// 4. Filtrlash Mantiqi
function filterWorkflows(list) {
    const { search, status } = WorkflowState.currentFilter;
    return list.filter(wf => {
        const matchSearch = !search || wf.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !status || wf.status === status;
        return matchSearch && matchStatus;
    });
}

// 5. Selectlarni To'ldirish (MUHIM: Tanlovni Saqlash)
function populateStageSelects(selectedStartId = null, selectedEndId = null) {
    const startSel = WorkflowState.elements.stageSelectStart;
    const endSel = WorkflowState.elements.stageSelectEnd;
    
    if (!startSel || !endSel) return;

    const optionsHtml = '<option value="">Tanlang...</option>' + 
        WorkflowState.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    // Hozirgi qiymatlarni saqlab qolamiz (agar modal ochiq bo'lsa)
    const currentStart = selectedStartId || startSel.value;
    const currentEnd = selectedEndId || endSel.value;

    startSel.innerHTML = optionsHtml;
    endSel.innerHTML = optionsHtml;

    // Qiymatlarni qayta tiklash (Bu "tanlov yo'qolishi" muammosini hal qiladi)
    if (currentStart) startSel.value = currentStart;
    if (currentEnd) endSel.value = currentEnd;
}

// 6. Event Delegation (Barcha hodisalar uchun bitta joy)
function setupWorkflowListeners() {
    const tableBody = WorkflowState.elements.tableBody;
    
    // Jadval ichidagi tugmalar
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const id = btn.dataset.id;
            if (btn.classList.contains('btn-edit')) openEditModal(id);
            if (btn.classList.contains('btn-delete')) deleteWorkflow(id);
        });
    }

    // Qidiruv (Debounce)
    if (WorkflowState.elements.searchInput) {
        let timeout;
        WorkflowState.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                WorkflowState.currentFilter.search = e.target.value;
                renderTable();
            }, 300);
        });
    }

    // Status filtri
    if (WorkflowState.elements.filterStatus) {
        WorkflowState.elements.filterStatus.addEventListener('change', (e) => {
            WorkflowState.currentFilter.status = e.target.value;
            renderTable();
        });
    }

    // Modal saqlash tugmasi
    if (WorkflowState.elements.saveBtn) {
        WorkflowState.elements.saveBtn.addEventListener('click', saveWorkflowData);
    }
    
    // Modal yopilganda formani tozalash
    const modal = WorkflowState.elements.modal;
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeWorkflowModal();
        });
    }
}

// 7. Modalni Ochish (Tahrirlash)
function openEditModal(id) {
    const wf = WorkflowState.workflows.find(w => w.id == id);
    if (!wf) return;

    WorkflowState.editingId = id;
    const form = WorkflowState.elements.form;
    
    // Formani to'ldirish
    form.querySelector('[name="wfName"]').value = wf.name;
    form.querySelector('[name="wfStatus"]').value = wf.status;
    
    // Selectlarni to'ldirish VA tanlovni saqlash
    // Avval selectlarni yangilaymiz, keyin qiymatni set qilamiz
    populateStageSelects(); 
    
    // Kichik kechikish bilan qiymatni o'rnatamiz (DOM renderdan keyin)
    setTimeout(() => {
        if (WorkflowState.elements.stageSelectStart) 
            WorkflowState.elements.stageSelectStart.value = wf.startStageId;
        if (WorkflowState.elements.stageSelectEnd) 
            WorkflowState.elements.stageSelectEnd.value = wf.endStageId;
    }, 0);

    WorkflowState.elements.modal.style.display = 'block';
}

// 8. Saqlash Funksiyasi
async function saveWorkflowData() {
    const form = WorkflowState.elements.form;
    if (!form.checkValidity()) {
        alert("Iltimos, barcha maydonlarni to'ldiring!");
        return;
    }

    const formData = new FormData(form);
    const data = {
        name: formData.get('wfName'),
        status: formData.get('wfStatus'),
        startStageId: formData.get('startStage'), // Name atributiga e'tibor bering
        endStageId: formData.get('endStage')
    };

    // Inputlarni vaqtincha bloklash (faqat saqlash paytida)
    toggleFormInputs(true);

    try {
        await google.script.run
            .withSuccessHandler(() => {
                closeWorkflowModal();
                loadWorkflows(); // Jadvalni yangilash
                alert("Muvaffaqiyatli saqlandi!");
            })
            .withFailureHandler((err) => {
                alert("Xatolik: " + err.message);
                toggleFormInputs(false);
            })
            .saveWorkflow(data, WorkflowState.editingId);
    } catch (e) {
        toggleFormInputs(false);
    }
}

// 9. O'chirish
async function deleteWorkflow(id) {
    if (!confirm("Rostdan ham o'chirmoqchimisiz?")) return;
    
    try {
        await google.script.run.deleteWorkflow(id);
        loadWorkflows();
    } catch (e) {
        alert("O'chirishda xatolik: " + e.message);
    }
}

// Yordamchi funksiyalar
function closeWorkflowModal() {
    WorkflowState.elements.modal.style.display = 'none';
    WorkflowState.elements.form.reset();
    WorkflowState.editingId = null;
    toggleFormInputs(false);
}

function toggleFormInputs(disabled) {
    const inputs = WorkflowState.elements.form.querySelectorAll('input, select, button');
    inputs.forEach(el => {
        if (el.id !== 'saveWorkflowBtn') el.disabled = disabled; 
        // Save tugmasini bloklamaymiz yoki alohida boshqaramiz
    });
    // Loader ko'rsatish
    const btn = WorkflowState.elements.saveBtn;
    if (btn) {
        btn.textContent = disabled ? 'Saqlanmoqda...' : 'Saqlash';
        btn.disabled = disabled;
    }
}

function toggleLoading(show) {
    if (WorkflowState.elements.loader) {
        WorkflowState.elements.loader.style.display = show ? 'block' : 'none';
    }
    if (WorkflowState.elements.tableBody) {
        WorkflowState.elements.tableBody.style.opacity = show ? '0.5' : '1';
        WorkflowState.elements.tableBody.style.pointerEvents = show ? 'none' : 'auto';
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initWorkflowCache();
    loadWorkflows();
    setupWorkflowListeners();
});
