/**
 * admin_workflow.js - Jarayonlarni boshqarish (Optimizatsiya + Universal API)
 */

const WorkflowState = {
    processes: [],
    stages: [],
    currentEditId: null,
    elements: {}
};

// DOM Elementlarini Cache qilish
function initWorkflowCache() {
    WorkflowState.elements = {
        tableBody: document.getElementById('workflowTableBody'),
        processSelect: document.getElementById('filterProcess'),
        stageStartSelect: document.getElementById('stageStart'),
        stageEndSelect: document.getElementById('stageEnd'),
        saveBtn: document.getElementById('saveWorkflowBtn'),
        modal: document.getElementById('workflowModal'),
        form: document.getElementById('workflowForm'),
        loader: document.getElementById('workflowLoader')
    };
}

// Ma'lumotlarni yuklash (Universal)
async function loadWorkflowData() {
    toggleLoading(true);
    try {
        // Config orqali chaqiruv
        const [processes, stages] = await Promise.all([
            CONFIG.callServer('getProcesses'),
            CONFIG.callServer('getStages')
        ]);

        WorkflowState.processes = processes;
        WorkflowState.stages = stages;

        renderTable(processes); // Yoki jarayonlar ro'yxati
        populateSelects(stages);
        
        // Agar tahrirlash ochiq bo'lsa, qiymatlarni tiklash
        if (WorkflowState.currentEditId) {
            restoreFormState();
        }
    } catch (error) {
        console.error("Xatolik:", error);
        alert("Jarayonlarni yuklashda xatolik! (URL to'g'riligini tekshiring)");
    } finally {
        toggleLoading(false);
    }
}

// Jadvalni chiqarish
function renderTable(data) {
    const tbody = WorkflowState.elements.tableBody;
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.startStage || '-'}</td>
            <td>${item.endStage || '-'}</td>
            <td>
                <button class="btn-edit" data-id="${item.id}">✏️</button>
                <button class="btn-delete" data-id="${item.id}">🗑️</button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

// Selectlarni to'ldirish (Tanlovni saqlab qolish bilan)
function populateSelects(stages) {
    const startSel = WorkflowState.elements.stageStartSelect;
    const endSel = WorkflowState.elements.stageEndSelect;
    
    if (!startSel || !endSel) return;

    // Hozirgi tanlovlarni saqlab olamiz
    const currentStart = startSel.value;
    const currentEnd = endSel.value;

    const optionsHtml = '<option value="">Tanlang...</option>' + 
        stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    startSel.innerHTML = optionsHtml;
    endSel.innerHTML = optionsHtml;

    // Qiymatlarni tiklash (agar mavjud bo'lsa)
    if (currentStart) startSel.value = currentStart;
    if (currentEnd) endSel.value = currentEnd;
}

// Formani tiklash (Tahrirlashdan keyin inputlar bloklanib qolmasligi uchun)
function restoreFormState() {
    const item = WorkflowState.processes.find(p => p.id == WorkflowState.currentEditId);
    if (!item || !WorkflowState.elements.form) return;

    const form = WorkflowState.elements.form;
    
    // Inputlarni faollashtirish (Blockdan chiqarish)
    Array.from(form.elements).forEach(el => el.disabled = false);

    // Qiymatlarni to'ldirish
    if (form.querySelector('[name="processName"]')) 
        form.querySelector('[name="processName"]').value = item.name;
    
    if (WorkflowState.elements.stageStartSelect) 
        WorkflowState.elements.stageStartSelect.value = item.startStageId || '';
        
    if (WorkflowState.elements.stageEndSelect) 
        WorkflowState.elements.stageEndSelect.value = item.endStageId || '';
}

// Event Listenerlar (Delegation)
function setupWorkflowListeners() {
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

    if (WorkflowState.elements.saveBtn) {
        WorkflowState.elements.saveBtn.addEventListener('click', saveWorkflow);
    }
    
    // Modal yopilganda holatni tozalash
    const modal = WorkflowState.elements.modal;
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeWorkflowModal();
        });
    }
}

// Tahrirlashni ochish
function openEditModal(id) {
    WorkflowState.currentEditId = id;
    const modal = WorkflowState.elements.modal;
    if (modal) modal.style.display = 'block';
    
    // Ma'lumotlarni yuklash va formani to'ldirish
    loadWorkflowData(); 
}

// Saqlash
async function saveWorkflow() {
    const form = WorkflowState.elements.form;
    if (!form) return;

    toggleLoading(true);
    
    // Inputlarni vaqtincha bloklash (faqat saqlash paytida)
    Array.from(form.elements).forEach(el => el.disabled = true);

    const data = {
        id: WorkflowState.currentEditId,
        name: form.querySelector('[name="processName"]')?.value,
        startStageId: WorkflowState.elements.stageStartSelect?.value,
        endStageId: WorkflowState.elements.stageEndSelect?.value
    };

    try {
        await CONFIG.callServer('saveWorkflow', data);
        closeWorkflowModal();
        loadWorkflowData();
        alert("Muvaffaqiyatli saqlandi!");
    } catch (error) {
        alert("Saqlashda xatolik: " + error.message);
        // Xatolik bo'lsa inputlarni qayta ochish
        Array.from(form.elements).forEach(el => el.disabled = false);
    } finally {
        toggleLoading(false);
    }
}

function closeWorkflowModal() {
    WorkflowState.currentEditId = null;
    const modal = WorkflowState.elements.modal;
    if (modal) {
        modal.style.display = 'none';
        if (WorkflowState.elements.form) WorkflowState.elements.form.reset();
    }
}

function toggleLoading(show) {
    const loader = WorkflowState.elements.loader;
    if (loader) loader.style.display = show ? 'block' : 'none';
    
    // Faqat loader paytida umumiy fonni o'chirib qo'ymaslik kerak
    // Inputlarni boshqarish saveWorkflow ichida amalga oshiriladi
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initWorkflowCache();
    loadWorkflowData();
    setupWorkflowListeners();
});
