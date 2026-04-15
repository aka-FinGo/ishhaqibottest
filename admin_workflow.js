// ============================================================
// admin_workflow.js — Admin Workflow Management
// ============================================================

let currentWorkflowSteps = [];

function getWorkflowStepColors(idx, total) {
    const position = total <= 2 ? (idx === 0 ? 'start' : 'end')
        : idx === 0 ? 'start'
        : idx === total - 1 ? 'end'
        : 'middle';

    switch (position) {
        case 'start':
            return { bg: '#FDE68A', color: '#92400E', label: 'Boshlanish' };
        case 'middle':
            return { bg: '#FECACA', color: '#991B1B', label: 'O‘rta bosqich' };
        case 'end':
            return { bg: '#DCFCE7', color: '#166534', label: 'Yakun' };
        default:
            return { bg: '#E2E8F0', color: '#475569', label: 'Bosqich' };
    }
}

function initWorkflowAdmin() {
    currentWorkflowSteps = JSON.parse(JSON.stringify(myPermissions.workflowConfig || []));
    renderWorkflowSteps();
}

function renderWorkflowSteps() {
    const container = document.getElementById('workflowList');
    if (!container) return;

    // Add button for start/end stage configuration
    const configButton = `
        <div style="margin-bottom: 15px;">
            <button id="stageConfigBtn" class="btn-primary" style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-weight: 600;">
                Boshlanish / Yakunlash bosqichi
            </button>
        </div>
    `;

    if (!currentWorkflowSteps.length) {
        container.innerHTML = configButton + `<div class="empty-state" style="padding:20px;"><p>Oqim bo'sh. Qadamlar qo'shing.</p></div>`;
        attachStageConfigHandler();
        return;
    }

    let html = configButton;
    currentWorkflowSteps.forEach((step, idx) => {
        const phaseColors = getWorkflowStepColors(idx, currentWorkflowSteps.length);
        html += `
        <div class="card" style="margin-bottom:10px; border:1px solid ${phaseColors.bg}; background:#fff; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="background:${phaseColors.bg}; color:${phaseColors.color}; padding:2px 10px; border-radius:15px; font-size:12px; font-weight:700;">
                    Bosqich ${idx + 1} ${step.isStart ? '(Boshlang\'ich)' : step.isEnd ? '(Yakun)' : ''}
                </span>
                <span style="font-size:11px; font-weight:700; color:${phaseColors.color};">${phaseColors.label}</span>
            </div>
                <div style="display:flex; gap:5px;">
                    <button class="del-icon-btn" style="background:#F1F5F9; color:#64748B;" onclick="moveWorkflowStep(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button class="del-icon-btn" style="background:#F1F5F9; color:#64748B;" onclick="moveWorkflowStep(${idx}, 1)" ${idx === currentWorkflowSteps.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="del-icon-btn" style="background:#FEE2E2; color:#EF4444;" onclick="removeWorkflowStep(${idx})">🗑</button>
                </div>
            </div>
            
            <div class="filter-row" style="margin-bottom:8px;">
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:4px;">🏷 Lavozim</label>
                    <select onchange="updateStepData(${idx}, 'position', this.value)" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:10px;">
                        <option value="">-- Tanlang --</option>
                        ${TECHNICAL_POSITIONS.map(p => `
                            <option value="${escapeHtml(p.name)}" ${step.position === p.name ? 'selected' : ''}>
                                ${p.icon} ${p.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:4px;">🔘 Tugma matni</label>
                    <input type="text" value="${escapeHtml(step.action)}" onchange="updateStepData(${idx}, 'action', this.value)" placeholder="Masalan: Men kesdim">
                </div>
            </div>
            
            <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:4px;">📊 Status (Amaldan keyin)</label>
                <input type="text" value="${escapeHtml(step.status)}" onchange="updateStepData(${idx}, 'status', this.value)" placeholder="Masalan: Kesildi">
            </div>
            
            <div style="margin-top:8px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                    <input type="checkbox" ${step.isStart ? 'checked' : ''} onchange="updateStepData(${idx}, 'isStart', this.checked)">
                    <span>Bu buyurtmani yaratadigan qadam (Start)</span>
                </label>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    attachStageConfigHandler();
}

function updateStepData(idx, field, val) {
    if (currentWorkflowSteps[idx]) {
        currentWorkflowSteps[idx][field] = val;
    }
}

function addNewWorkflowStep() {
    currentWorkflowSteps.push({
        position: '',
        action: 'Bajardim',
        status: 'Bajarildi',
        isStart: false
    });
    renderWorkflowSteps();
}

function removeWorkflowStep(idx) {
    if (!confirm("Ushbu bosqichni o'chirishga ishonchingiz komilmi?")) return;
    currentWorkflowSteps.splice(idx, 1);
    renderWorkflowSteps();
}

function moveWorkflowStep(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= currentWorkflowSteps.length) return;
    const temp = currentWorkflowSteps[idx];
    currentWorkflowSteps[idx] = currentWorkflowSteps[target];
    currentWorkflowSteps[target] = temp;
    renderWorkflowSteps();
}

async function saveWorkflowConfigUI() {
    if (!currentWorkflowSteps.length) {
        showToastMsg('❌ Kamida bitta bosqich bo\'lishi shart', true);
        return;
    }

    try {
        const data = await apiRequest({
            action: 'workflow_save_config',
            steps: currentWorkflowSteps
        });

            if (data.success) {
                showToastMsg('✅ Oqim saqlandi! Ilovani yangilang.');
                // Update local config so roles.js picks it up
                myPermissions.workflowConfig = currentWorkflowSteps;
            } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

function attachStageConfigHandler() {
    const btn = document.getElementById('stageConfigBtn');
    if (btn) {
        btn.addEventListener('click', showStageConfigDialog);
    }
}

function showStageConfigDialog() {
    // Create and show dialog for stage configuration
    const dialog = document.createElement('div');
    dialog.id = 'stageConfigDialog';
    dialog.className = 'modal';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;';
    
    dialog.innerHTML = `
        <div class="card" style="width: 90%; max-width: 500px; background: #fff; border-radius: 15px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top: 0; color: var(--navy);">Boshlanish / Yakunlash bosqichi</h3>
            <p style="color: var(--text-muted); font-size: 14px;">Qaysi jarayondan keyin boshlanish va yakunlash bosqichi tugashi kerakligini belgilang:</p>
            
            <div style="margin-bottom: 15px;">
                <label style="font-weight: 600; display: block; margin-bottom: 5px;">Boshlanish bosqichi:</label>
                <select id="startStageSelect" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;">
                    <option value="">Tanlanmagan</option>
                    ${currentWorkflowSteps.map((step, idx) => 
                        `<option value="${idx}" ${step.isStart ? 'selected' : ''}>${step.position || `Bosqich ${idx + 1}`}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="font-weight: 600; display: block; margin-bottom: 5px;">Yakunlash bosqichi:</label>
                <select id="endStageSelect" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;">
                    <option value="">Tanlanmagan</option>
                    ${currentWorkflowSteps.map((step, idx) => 
                        `<option value="${idx}" ${step.isEnd ? 'selected' : ''}>${step.position || `Bosqich ${idx + 1}`}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button id="saveStageConfig" class="btn-primary" style="flex: 1; padding: 12px; background: #10B981; color: white; border: none; border-radius: 10px; font-weight: 600;">Saqlash</button>
                <button id="cancelStageConfig" class="btn-secondary" style="flex: 1; padding: 12px; background: #EF4444; color: white; border: none; border-radius: 10px; font-weight: 600;">Bekor qilish</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add event listeners
    document.getElementById('saveStageConfig').addEventListener('click', saveStageConfig);
    document.getElementById('cancelStageConfig').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

function saveStageConfig() {
    const startStage = document.getElementById('startStageSelect').value;
    const endStage = document.getElementById('endStageSelect').value;
    
    // Update workflow steps with start/end flags
    currentWorkflowSteps.forEach((step, idx) => {
        step.isStart = idx == startStage;
        step.isEnd = idx == endStage;
    });
    
    // Save to localStorage or send to server
    myPermissions.workflowConfig = currentWorkflowSteps;
    localStorage.setItem('myPermissions', JSON.stringify(myPermissions));
    
    // Close dialog
    const dialog = document.getElementById('stageConfigDialog');
    if (dialog) {
        document.body.removeChild(dialog);
    }
    
    // Re-render workflow steps
    renderWorkflowSteps();
    
    alert('Sozlamalar saqlandi!');
}
