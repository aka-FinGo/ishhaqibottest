let currentPositionsPool = [];

// Initialize positions UI
function initPositionsUI(positions) {
    currentPositionsPool = positions || [];
    renderPositionsList();
}

// Render positions list
function renderPositionsList() {
    const container = document.getElementById('positionsListUI');
    if (!container) return;

    if (currentPositionsPool.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Hozircha lavozimlar yo\'q. Yangi qo\'shing.</p>';
        return;
    }

    let html = '';
    currentPositionsPool.forEach((p, idx) => {
        html += `
            <div class="card" style="margin-bottom:12px;padding:12px;border:1px solid var(--border);background:#F8FAFC;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:700;font-size:12px;color:var(--text-muted);">LAVOZIM #${idx + 1}</span>
                    <button class="remove-pos-btn" data-idx="${idx}" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;">&times;</button>
                </div>
                <div style="display:grid;grid-template-columns:80px 1fr;gap:10px;">
                    <div class="input-group" style="margin-bottom:0;">
                        <label>Belgi (Icon)</label>
                        <input type="text" class="pos-icon-input" data-idx="${idx}" value="${escapeHtml(p.icon)}" placeholder="🔧">
                    </div>
                    <div class="input-group" style="margin-bottom:0;">
                        <label>Lavozim Nomi</label>
                        <input type="text" class="pos-name-input" data-idx="${idx}" value="${escapeHtml(p.name)}" placeholder="Masalan:Yig'uvchi">
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    attachPositionListeners();
}

// Attach event listeners for position controls
function attachPositionListeners() {
    const container = document.getElementById('positionsListUI');
    if (!container) return;

    // Icon input
    container.querySelectorAll('.pos-icon-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            updatePosField(idx, 'icon', e.target.value);
        });
    });

    // Name input
    container.querySelectorAll('.pos-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            updatePosField(idx, 'name', e.target.value);
        });
    });

    // Remove button
    container.querySelectorAll('.remove-pos-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            removePositionUI(idx);
        });
    });
}

// Update position field
function updatePosField(idx, field, val) {
    if (currentPositionsPool[idx]) {
        currentPositionsPool[idx][field] = val;
    }
}

// Add new position
function addPositionUI() {
    currentPositionsPool.push({name: '', icon: '📐'});
    renderPositionsList();
}

// Remove position
function removePositionUI(idx) {
    if (confirm("Ushbu lavozimni o'chirmoqchimisiz?")) {
        currentPositionsPool.splice(idx, 1);
        renderPositionsList();
    }
}

// Save positions
async function savePositionsUI() {
    const validPositions = currentPositionsPool.filter(p => p.name.trim() !== '');

    if (validPositions.length === 0 && currentPositionsPool.length > 0) {
        showToastMsg("❌ Iltimos, lavozim nomlarini kiriting", true);
        return;
    }

    const saveBtn = document.querySelector('button[onclick*="savePositionsUI"]');
    if (saveBtn) {
        setButtonLoading(saveBtn, true, 'Saqlanmoqda...');
    }

    try {
        const data = await apiRequest({
            action: 'positions_save_all',
            positions: validPositions
        });

        if (data.success) {
            showToastMsg("✅ Lavozimlar muvaffaqiyatli saqlandi!");
            currentPositionsPool = validPositions;

            if (typeof updateTechnicalPositions === 'function') {
                updateTechnicalPositions(validPositions);
            }

            if (typeof myPermissions !== 'undefined') {
                myPermissions.allPositions = validPositions;
            }

            renderPositionsList();

            if (typeof initWorkflowAdmin === 'function') {
                initWorkflowAdmin();
            }
        } else {
            showToastMsg("❌ " + (data.error || "Saqlashda xato"), true);
        }
    } catch (e) {
        showToastMsg("❌ Tarmoq xatosi", true);
    } finally {
        if (saveBtn) {
            setButtonLoading(saveBtn, false);
        }
    }
}

// HTML escape function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
