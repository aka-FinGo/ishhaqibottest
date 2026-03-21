// ================= ADMIN FUNKSIYALARI =================

async function loadAdminData() {
    document.getElementById('adminList').innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;
    try {
        const res  = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'admin_get_all', telegramId }) });
        const data = await res.json();
        if (data.success) {
            globalAdminData = data.data || [];
            filteredData    = [...globalAdminData];
            currentPage = 1;
            populateFilters();
            calculateTotal();
            renderAdminPage();
        } else {
            showAdminError(data.error || 'Server xatosi');
        }
    } catch(e) {
        console.error(e);
        showAdminError('Internet ulanishini tekshiring.');
    }
}

function showAdminError(msg) {
    document.getElementById('adminList').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p style="color:#EF4444;font-weight:700;">Yuklanmadi</p>
            <p style="font-size:12px;margin-top:6px;color:var(--text-muted);">${msg}</p>
            <button class="btn-main bg-navy" style="margin-top:16px;width:auto;padding:10px 24px;" onclick="loadAdminData()">🔄 Qayta urinish</button>
        </div>`;
}

function populateFilters() {
    const empSel  = document.getElementById('filterEmployee');
    const yearSel = document.getElementById('filterYear');
    let emps = new Set(), years = new Set();
    globalAdminData.forEach(r => {
        if (r.name) emps.add(r.name);
        if (r.date) { const p = r.date.split('/'); if (p[2]) years.add(p[2]); }
    });
    empSel.innerHTML  = '<option value="all">Barcha xodimlar</option>';
    yearSel.innerHTML = '<option value="all">Yillar</option>';
    Array.from(emps).sort().forEach(e => empSel.innerHTML  += `<option value="${e}">${e}</option>`);
    Array.from(years).sort((a,b) => b-a).forEach(y => yearSel.innerHTML += `<option value="${y}">${y}</option>`);
}

let debounceTimer;
function applyFilters() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const query = (document.getElementById('searchInput').value || '').toLowerCase();
        const emp   = document.getElementById('filterEmployee').value;
        const month = document.getElementById('filterMonth').value;
        const year  = document.getElementById('filterYear').value;
        filteredData = globalAdminData.filter(item => {
            const mt = (item.name    && item.name.toLowerCase().includes(query)) ||
                       (item.comment && item.comment.toLowerCase().includes(query));
            const me = emp === 'all' || item.name === emp;
            let mm = true, my = true;
            if (item.date) {
                const p = item.date.split('/');
                if (month !== 'all') mm = p[1] === month;
                if (year  !== 'all') my = p[2] === year;
            }
            return mt && me && mm && my;
        });
        currentPage = 1; calculateTotal(); renderAdminPage();
    }, 300);
}

function calculateTotal() {
    let total = 0;
    filteredData.forEach(r => { total += Number(r.amountUZS) || 0; });
    const bEl = document.getElementById('totalCompanyUzs');
    const cEl = document.getElementById('filteredCount');
    if (bEl) bEl.innerText = total.toLocaleString() + ' UZS';
    if (cEl) cEl.innerText = filteredData.length;
}

function renderAdminPage() {
    if (!filteredData.length) {
        document.getElementById('adminList').innerHTML =
            `<div class="empty-state"><div class="empty-icon">🔍</div><p>Ma'lumot topilmadi</p></div>`;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    const start    = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageData = filteredData.slice(start, start + ITEMS_PER_PAGE);

    // Huquqlarni aniqlaymiz
    const canEditAny = myRole === 'SuperAdmin' ||
                       (myRole === 'Admin' && (myPermissions.canEdit || myPermissions.canDelete));

    let html = '';
    pageData.forEach(r => {
        const gIdx  = filteredData.indexOf(r);
        const isUsd = Number(r.amountUSD) > 0;
        const rate  = Number(r.rate) || Number(r.exchangeRate) || 0;
        const effRate = rate > 0 ? rate : (isUsd && r.amountUZS > 0 ? Math.round(r.amountUZS/r.amountUSD) : 0);

        html += `
        <div class="history-item" onclick="showAdminDetailModal(${gIdx})" style="cursor:pointer;">
            <div class="item-header">
                <span class="item-name">👤 ${r.name || '—'}</span>
                <span class="item-date">${r.date || '—'}</span>
            </div>
            <div class="item-comment">📝 ${r.comment || '—'}</div>
            <div class="item-amounts">
                ${Number(r.amountUZS) > 0 ? `<span class="amount-chip uzs">💰 ${Number(r.amountUZS).toLocaleString()} UZS</span>` : ''}
                ${isUsd ? `<span class="amount-chip usd">💵 $${Number(r.amountUSD).toLocaleString()}</span>` : ''}
                ${isUsd && effRate > 0 ? `<span class="rate-tag">📈 ${effRate.toLocaleString()}</span>` : ''}
            </div>
            ${canEditAny ? `<div class="item-edit-hint">→ batafsil</div>` : ''}
        </div>`;
    });

    document.getElementById('adminList').innerHTML = html;
    renderPaginationControls();
}

function renderPaginationControls() {
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    let html = '';
    if (totalPages > 1)
        for (let i = 1; i <= totalPages; i++)
            html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goToPage(${i})">${i}</button>`;
    document.getElementById('pagination').innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderAdminPage();
    document.getElementById('adminDataArea').scrollIntoView({ behavior:'smooth' });
}

function showAdminDetailModal(gIdx) {
    const r = filteredData[gIdx];
    if (!r) return;
    // canEdit = SuperAdmin yoki ruxsatli Admin
    const canEdit = myRole === 'SuperAdmin' ||
                    (myRole === 'Admin' && (myPermissions.canEdit || myPermissions.canDelete));
    showDetailModal(r, canEdit);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}