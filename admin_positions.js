// ============================================================
// admin_positions.js — Positions Management UI
// ============================================================

let currentPositionsPool = [];

/**
 * Initializes the positions management UI.
 */
function initPositionsUI(positions) {
    currentPositionsPool = positions || [];
    renderPositionsList();
}

/**
 * Renders the list of positions in the admin panel.
 */
function renderPositionsList() {
    const container = document.getElementById('positionsListUI');
    if (!container) return;

    if (currentPositionsPool.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Hozircha lavozimlar yo\'q. Yangi qo\'shing.</p>';
        return;
    }

    let html = '';
    currentPositionsPool.forEach((p, idx) => {
        html += `
        <div class="card" style="margin-bottom:12px; padding:12px; border:1px solid var(--border); background:#F8FAFC;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:700; font-size:12px; color:var(--text-muted);">LAVOZIM #${idx + 1}</span>
                <button onclick="removePositionUI(${idx})" style="background:none; border:none; color:var(--red); font-size:18px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:grid; grid-template-columns: 80px 1fr; gap:10px;">
                <div class="input-group" style="margin-bottom:0;">
                    <label>Belgi (Icon)</label>
                    <input type="text" value="${escapeHtml(p.icon)}" onchange="updatePosField(${idx}, 'icon', this.value)" placeholder="🔧">
                </div>
                <div class="input-group" style="margin-bottom:0;">
                    <label>Lavozim Nomi</label>
                    <input type="text" value="${escapeHtml(p.name)}" onchange="updatePosField(${idx}, 'name', this.value)" placeholder="Masalan: Yig'uvchi">
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function updatePosField(idx, field, val) {
    if (currentPositionsPool[idx]) {
        currentPositionsPool[idx][field] = val;
    }
}

function addPositionUI() {
    currentPositionsPool.push({ name: '', icon: '📐' });
    renderPositionsList();
}

function removePositionUI(idx) {
    if (confirm("Ushbu lavozimni o'chirmoqchimisiz?")) {
        currentPositionsPool.splice(idx, 1);
        renderPositionsList();
    }
}

/**
 * Saves the positions to the backend.
 */
async function savePositionsUI() {
    // Validate
    const validPositions = currentPositionsPool.filter(p => p.name.trim() !== '');
    if (validPositions.length === 0 && currentPositionsPool.length > 0) {
        showToastMsg("Iltimos, lavozim nomlarini kiriting", true);
        return;
    }

    showLoading(true);
    try {
        const data = await apiRequest({
            action: 'positions_save_all',
            positions: validPositions
        });

        if (data.success) {
            showToastMsg("✅ Lavozimlar muvaffaqiyatli saqlandi!");
            // Yangi lavozimlarni lokal state'ga yangilash
            currentPositionsPool = validPositions;
            // Update global state
            if (typeof updateTechnicalPositions === 'function') {
                updateTechnicalPositions(validPositions);
            }
            if (typeof myPermissions !== 'undefined') {
                myPermissions.allPositions = validPositions;
            }
            // Re-render positions list
            renderPositionsList();
            // Refresh workflow UI if available
            if (typeof initWorkflowAdmin === 'function') {
                initWorkflowAdmin();
            }
        } else {
            showToastMsg("❌ " + (data.error || "Saqlashda xato"), true);
        }
    } catch (e) {
        showToastMsg("❌ Tarmoq xatosi", true);
    } finally {
        showLoading(false);
    }
}
