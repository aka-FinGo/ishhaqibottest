// ============================================================
// admin_workflow.js — Admin Workflow Management
// ============================================================

let currentWorkflowSteps = [];

function initWorkflowAdmin() {
    currentWorkflowSteps = JSON.parse(JSON.stringify(myPermissions.workflowConfig || []));
    renderWorkflowSteps();
}

function renderWorkflowSteps() {
    const container = document.getElementById('workflowList');
    if (!container) return;

    if (!currentWorkflowSteps.length) {
        container.innerHTML = `<div class="empty-state" style="padding:20px;"><p>Oqim bo'sh. Qadamlar qo'shing.</p></div>`;
        return;
    }

    let html = '';
    currentWorkflowSteps.forEach((step, idx) => {
        html += `
        <div class="card" style="margin-bottom:10px; border:1px solid var(--border); background:#fff; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="background:var(--navy); color:#fff; padding:2px 10px; border-radius:15px; font-size:12px; font-weight:700;">
                    Bosqich ${idx + 1} ${step.isStart ? '(Boshlang\'ich)' : ''}
                </span>
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
            if (typeof updateTechnicalPositions === 'function') {
                updateTechnicalPositions(currentWorkflowSteps);
            }
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}
