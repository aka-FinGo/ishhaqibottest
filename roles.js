function toggleHodimPerms(tgId) {
    const btn  = document.getElementById('hbtn_'  + tgId);
    const body = document.getElementById('hbody_' + tgId);
    if (!btn || !body) return;
    const isOpen = body.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// ============================================================
// roles.js — Hodimlar boshqaruvi (SuperAdmin)
// ============================================================

async function loadHodimlar() {
    const list = document.getElementById('hodimlarList');
    list.innerHTML = `<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>`;

    try {
        const res  = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'get_hodimlar', telegramId }) });
        const data = await res.json();

        if (!data.success) { list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">${data.error}</p></div>`; return; }

        if (!data.data.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>Hali hodim qo'shilmagan</p></div>`;
            return;
        }

        let html = '';
        data.data.forEach(h => {
            const roleBadge = h.isSuperAdmin ? '<span class="role-badge boss">👑 SuperAdmin</span>'
                            : h.isDirektor   ? '<span class="role-badge direktor">🎯 Direktor</span>'
                            : h.isAdmin      ? '<span class="role-badge admin">🛡 Admin</span>'
                            : '<span class="role-badge" style="background:#F1F5F9;color:#64748B;">👤 Hodim</span>';

            html += `
            <div class="role-item" style="flex-direction:column;align-items:stretch;">

                <!-- Sarlavha: ism + ID + o'chirish -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="flex:1;min-width:0;">
                        <div class="role-item-name">${h.username || '—'}</div>
                        <div class="role-item-id">ID: ${h.tgId}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                        ${roleBadge}
                        <button class="del-icon-btn" onclick="deleteHodim('${h.tgId}')">🗑</button>
                    </div>
                </div>

                <!-- Username o'zgartirish -->
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);
                                  text-transform:uppercase;letter-spacing:0.5px;
                                  display:block;margin-bottom:5px;">
                        👤 Ko'rsatiladigan ism (UserName)
                    </label>
                    <input type="text"
                           id="uname_${h.tgId}"
                           value="${h.username || ''}"
                           placeholder="Masalan: Ali (Haydovchi)"
                           style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                                  border-radius:var(--radius-sm);font-size:14px;
                                  font-family:var(--font);background:#FAFBFD;">
                </div>

                <!-- Ruxsatlar — collapsible -->
                <button class="perm-toggle-btn" id="hbtn_${h.tgId}"
                        onclick="toggleHodimPerms('${h.tgId}')">
                    <span>🔐 Ruxsatlarni sozlash</span>
                    <span class="perm-arrow">▼</span>
                </button>
                <div class="perm-body" id="hbody_${h.tgId}">
                    <div class="hodim-perms-grid">
                        ${permToggle(h.tgId,'canAdd',      h.canAdd,      '➕ Amal qo\'shish')}
                        ${permToggle(h.tgId,'isSuperAdmin',h.isSuperAdmin,'👑 SuperAdmin')}
                        ${permToggle(h.tgId,'isDirektor',  h.isDirektor,  '🎯 Direktor')}
                        ${permToggle(h.tgId,'isAdmin',     h.isAdmin,     '🛡 Admin')}
                        ${permToggle(h.tgId,'canViewAll',  h.canViewAll,  '👁 Barchasini ko\'rish')}
                        ${permToggle(h.tgId,'canEdit',     h.canEdit,     '✏️ Tahrirlash')}
                        ${permToggle(h.tgId,'canDelete',   h.canDelete,   '🗑 O\'chirish')}
                        ${permToggle(h.tgId,'canExport',   h.canExport,   '📥 Excel')}
                        ${permToggle(h.tgId,'canViewDash', h.canViewDash, '📈 Dashboard')}
                    </div>
                    <button class="perm-save-btn" onclick="saveHodim('${h.tgId}')">💾 Saqlash</button>
                </div>
            </div>`;
        });
        list.innerHTML = html;

    } catch {
        list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Yuklanmadi</p></div>`;
    }
}

function permToggle(tgId, field, val, label) {
    const checked = Number(val) === 1;
    const id = `hp_${tgId}_${field}`;
    return `<label class="perm-label ${checked?'checked':''}" onclick="togglePermLabel(this,'${id}')">
        <input type="checkbox" id="${id}" ${checked?'checked':''} onclick="event.stopPropagation();syncPermLabel(this)">
        <span>${label}</span>
    </label>`;
}

function togglePermLabel(lbl, cbId) {
    const cb = document.getElementById(cbId);
    if (cb) { cb.checked = !cb.checked; syncPermLabel(cb); }
}
function syncPermLabel(cb) {
    const lbl = cb.closest('.perm-label');
    if (lbl) lbl.classList.toggle('checked', cb.checked);
}

async function saveHodim(tgId) {
    const fields = ['canAdd','isSuperAdmin','isDirektor','isAdmin','canViewAll','canEdit','canDelete','canExport','canViewDash'];
    const payload = { action:'update_hodim', telegramId, tgId };
    fields.forEach(f => {
        const el = document.getElementById(`hp_${tgId}_${f}`);
        payload[f] = el ? (el.checked ? 1 : 0) : 0;
    });
    // Username ni ham yuboramiz
    const usernameEl = document.getElementById(`uname_${tgId}`);
    if (usernameEl) payload.username = usernameEl.value;

    try {
        const res  = await fetch(API_URL, { method:'POST', body:JSON.stringify(payload) });
        const data = await res.json();
        showToastMsg(data.success ? '✅ Saqlandi!' : '❌ ' + data.error, !data.success);
    } catch { showToastMsg('❌ Server xatosi', true); }
}

async function addHodim() {
    const tgIdEl    = document.getElementById('newHodimId');
    const usernameEl= document.getElementById('newHodimName');
    const st        = document.getElementById('hodimStatus');

    const newTgId   = tgIdEl.value.trim();
    const username  = usernameEl.value.trim() || 'Yangi Xodim';

    if (!newTgId) { st.style.color='var(--red)'; st.innerText='❗ Telegram ID kiritilishi shart!'; return; }
    st.style.color='var(--text-muted)'; st.innerText='⏳ Qo\'shilmoqda...';

    try {
        const res  = await fetch(API_URL, { method:'POST', body:JSON.stringify({
            action:'add_hodim', telegramId,
            tgId: newTgId, username,
            canAdd:1, isSuperAdmin:0, isDirektor:0, isAdmin:0,
            canViewAll:0, canEdit:0, canDelete:0, canExport:0, canViewDash:0
        })});
        const data = await res.json();
        if (data.success) {
            st.style.color='var(--green-dark)'; st.innerText='✅ Qo\'shildi!';
            tgIdEl.value=''; usernameEl.value='';
            loadHodimlar();
        } else { st.style.color='var(--red)'; st.innerText='❌ '+(data.error||'Xato'); }
    } catch { st.style.color='var(--red)'; st.innerText='❌ Server xatosi'; }
}

async function deleteHodim(tgId) {
    if (!confirm("Bu hodimni ro'yxatdan o'chirishga ishonchingiz komilmi?")) return;
    try {
        const res  = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'delete_hodim', telegramId, tgId }) });
        const data = await res.json();
        if (data.success) loadHodimlar();
        else showToastMsg('❌ '+(data.error||"Xato"), true);
    } catch { showToastMsg('❌ Server xatosi', true); }
}
