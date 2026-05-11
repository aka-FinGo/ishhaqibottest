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
            return { bg: '#FDE68A', color: '#92400E', label: 'Boshlang\'ich' };
        case 'middle':
            return { bg: '#FECACA', color: '#991B1B', label: 'O\'rta bosqich' };
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

    const isStrict = !!myPermissions.isWorkflowStrict;

    const topControls = `
        <div style="background:#fff; border:1px solid var(--border); border-radius:18px; padding:18px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
            <div style="margin-bottom:15px;">
                <label style="font-size:15px; font-weight:800; color:var(--navy); display:block; margin-bottom:8px;">Qat'iy ketma-ketlik tartibi</label>
                <div style="display:flex; gap:10px;">
                    <select id="strictWorkflowSelect" style="flex:2; border-radius:12px; font-weight:600; height:46px;">
                        <option value="true" ${isStrict ? 'selected' : ''}>✅ Ha (Qat'iy tartib)</option>
                        <option value="false" ${!isStrict ? 'selected' : ''}>🔓 Yo'q (Erkin tartib)</option>
                    </select>
                    <button onclick="saveStrictSettingUI()" class="btn-main" style="flex:1; margin-top:0; height:46px; font-size:13px; background:var(--blue);">
                        Saqlash
                    </button>
                </div>
                <div style="font-size:11px; color:var(--text-muted); line-height:1.3; margin-top:8px;">
                    <b>Qat'iy:</b> Xodimlar faqat navbati kelgan bosqichni tasdiqlay oladi.<br>
                    <b>Erkin:</b> Xodimlar istalgan bosqichni tasdiqlashi mumkin.
                </div>
            </div>
            <div style="height:1px; background:#F1F5F9; margin:15px 0;"></div>
            <button id="stageConfigBtn" class="btn-secondary" style="width: 100%; height:44px; border-color:var(--blue); color:var(--blue); border-radius:12px; font-weight:700; background:rgba(59,130,246,0.05);">
                ⚙️ Boshlanish / Yakunlash bosqichi
            </button>
        </div>
    `;

    if (!currentWorkflowSteps.length) {
        container.innerHTML = topControls + `<div class="empty-state" style="padding:20px;"><p>Oqim bo'sh. Qadamlar qo'shing.</p></div>`;
        attachStageConfigHandler();
        attachWorkflowListeners();
        return;
    }

    let html = topControls;
    currentWorkflowSteps.forEach((step, idx) => {
        const phaseColors = getWorkflowStepColors(idx, currentWorkflowSteps.length);
        html += `
        <div class="card" style="margin-bottom:20px; border:2px solid ${phaseColors.bg}; background:#fff; padding:16px; border-radius:18px; box-shadow:var(--shadow-md);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #F1F5F9;">
                <div>
                    <span style="background:${phaseColors.bg}; color:${phaseColors.color}; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:800;">
                        BOSQICH ${idx + 1}
                    </span>
                    <span style="margin-left:8px; font-size:12px; font-weight:700; color:${phaseColors.color}; opacity:0.8;">${phaseColors.label}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="del-icon-btn move-up-btn" data-idx="${idx}" style="background:#F1F5F9; color:#64748B; width:30px; height:30px; font-size:12px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button class="del-icon-btn move-down-btn" data-idx="${idx}" style="background:#F1F5F9; color:#64748B; width:30px; height:30px; font-size:12px;" ${idx === currentWorkflowSteps.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="del-icon-btn delete-step-btn" data-idx="${idx}" style="background:#FEE2E2; color:#EF4444; width:30px; height:30px; font-size:12px;">🗑</button>
                </div>
            </div>

            <div class="filter-row" style="margin-bottom:12px; display:flex; gap:10px;">
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:800; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase;">👤 Lavozim</label>
                    <select class="position-select" data-idx="${idx}" style="width:100%; border-radius:12px; font-weight:600;">
                        <option value="">-- Tanlang --</option>
                        ${TECHNICAL_POSITIONS.map(p => `
                            <option value="${escapeHtml(p.name)}" ${step.position === p.name ? 'selected' : ''}>
                                ${p.icon} ${p.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:800; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase;">🔘 Tugma matni</label>
                    <input type="text" class="action-input" data-idx="${idx}" value="${escapeHtml(step.action)}" placeholder="Masalan: Men kesdim" style="border-radius:12px; font-weight:600;">
                </div>
            </div>

            <div style="margin-bottom:4px;">
                <label style="font-size:11px; font-weight:800; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase;">📊 Status (Amaldan keyin)</label>
                <input type="text" class="status-input" data-idx="${idx}" value="${escapeHtml(step.status)}" placeholder="Masalan: Kesildi" style="border-radius:12px; font-weight:600;">
            </div>
        </div>`;
    });

    container.innerHTML = html;
    attachStageConfigHandler();
    attachWorkflowListeners();
}

function attachWorkflowListeners() {
    const container = document.getElementById('workflowList');
    if (!container) return;

    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            moveWorkflowStep(idx, -1);
        });
    });

    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            moveWorkflowStep(idx, 1);
        });
    });

    container.querySelectorAll('.delete-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            removeWorkflowStep(idx);
        });
    });

    container.querySelectorAll('.position-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            updateStepData(idx, 'position', e.target.value);
        });
    });

    container.querySelectorAll('.action-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            updateStepData(idx, 'action', e.target.value);
        });
    });

    container.querySelectorAll('.status-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            updateStepData(idx, 'status', e.target.value);
        });
    });
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
    const saveBtn = event.currentTarget;
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');
    try {
        const data = await apiRequest({
            action: 'workflow_save_config',
            steps: currentWorkflowSteps
        });
        if (data.success) {
            showToastMsg('✅ Oqim saqlandi! Ilovani yangilang.');
            myPermissions.workflowConfig = currentWorkflowSteps;
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

function attachStageConfigHandler() {
    const btn = document.getElementById('stageConfigBtn');
    if (btn) btn.onclick = showStageConfigDialog;
}

function showStageConfigDialog() {
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
                <button id="saveStageConfig" class="btn-main" style="flex: 1; padding: 12px; background: #10B981; color: white; border: none; border-radius: 10px; font-weight: 600;">Saqlash</button>
                <button id="cancelStageConfig" class="btn-secondary" style="flex: 1; padding: 12px; background: #EF4444; color: white; border: none; border-radius: 10px; font-weight: 600;">Bekor qilish</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    document.getElementById('saveStageConfig').onclick = saveStageConfig;
    document.getElementById('cancelStageConfig').onclick = () => document.body.removeChild(dialog);
}

async function saveStageConfig() {
    const startStage = parseInt(document.getElementById('startStageSelect').value, 10);
    const endStage = parseInt(document.getElementById('endStageSelect').value, 10);
    currentWorkflowSteps.forEach((step, idx) => {
        step.isStart = !Number.isNaN(startStage) && idx === startStage;
        step.isEnd = !Number.isNaN(endStage) && idx === endStage;
    });
    const btn = event.currentTarget;
    setButtonLoading(btn, true, 'Saqlanmoqda...');
    try {
        const data = await apiRequest({ action: 'workflow_save_config', steps: currentWorkflowSteps });
        if (data.success) {
            showToastMsg('✅ Sozlamalar saqlandi!');
            myPermissions.workflowConfig = currentWorkflowSteps;
            document.body.removeChild(document.getElementById('stageConfigDialog'));
            renderWorkflowSteps();
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    } finally {
        setButtonLoading(btn, false);
    }
}

async function saveStrictSettingUI() {
    const sel = document.getElementById("strictWorkflowSelect");
    if (!sel) return;
    const isStrict = sel.value === "true";
    const btn = event.currentTarget;
    setButtonLoading(btn, true, "Saqlanmoqda...");
    try {
        const data = await apiRequest({ action: "workflow_save_settings", isWorkflowStrict: isStrict });
        if (data.success) {
            myPermissions.isWorkflowStrict = isStrict;
            showToastMsg("✅ Oqim tartibi yangilandi");
        } else {
            showToastMsg("❌ " + (data.error || "Xato"), true);
        }
    } catch (e) {
        showToastMsg("❌ Tarmoq xatosi", true);
    } finally {
        setButtonLoading(btn, false);
    }
}
