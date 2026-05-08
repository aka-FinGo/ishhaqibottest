// ================= DASHBOARD =================
// Optimizatsiya: Chart instance caching va memory management
const _charts = {};
function destroyChart(id) { 
    if (!_charts[id]) return;
    try { _charts[id].destroy(); } catch(e) {}
    delete _charts[id]; 
}

const MONTHS_UZ = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
const PALETTE   = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];

// Memoization for expensive calculations
const _memo = {};
function memoize(key, fn) {
    if (_memo[key] !== undefined) return _memo[key];
    const result = fn();
    _memo[key] = result;
    return result;
}
function clearMemo() { Object.keys(_memo).forEach(k => delete _memo[k]); }

// ============================================================
// FIX 1: parseDate — DD/MM/YYYY va ISO format ikkalasini ham qabul qiladi
// Google Sheets Date → JSON → "2026-03-16T00:00:00.000Z" → to'g'ri parse
// ============================================================
function parseDate(s) {
    const dateMeta = parseDateParts(s);
    if (!dateMeta) return null;
    const y = dateMeta.year;
    const m = dateMeta.month;
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx < 0 || mIdx > 11) return null;

    return {
        m,
        y,
        key:   `${y}-${m}`,
        label: `${MONTHS_UZ[mIdx]} ${y}`
    };
}

function getRecordMonthKey(r) {
    if (r.actionPeriod) {
        const parts = r.actionPeriod.split('-');
        if (parts.length === 2) {
            const y = parts[0];
            const m = parts[1];
            const mIdx = parseInt(m, 10) - 1;
            if (mIdx >= 0 && mIdx <= 11) {
                return { m, y, key: `${y}-${m}`, label: `${MONTHS_UZ[mIdx]} ${y}` };
            }
        }
    }
    return parseDate(r.date);
}

function getLastNMonths(n) {
    const r = [], now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        r.push({ key: `${y}-${m}`, label: `${MONTHS_UZ[d.getMonth()]} ${y}` });
    }
    return r;
}

function sumByMonthKey(recs, months) {
    const map = {};
    months.forEach(mo => { map[mo.key] = 0; });
    recs.forEach(r => {
        const d = getRecordMonthKey(r);
        if (d && map[d.key] !== undefined) map[d.key] += Number(r.amountUZS) || 0;
    });
    return months.map(mo => map[mo.key]);
}

function sumByEmployee(recs) {
    const map = {};
    recs.forEach(r => { if (!r.name) return; map[r.name] = (map[r.name] || 0) + (Number(r.amountUZS) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function sumByCategory(recs) {
    const map = {};
    recs.forEach(r => {
        const k = (r.comment || 'Izohsiz').slice(0, 22);
        map[k] = (map[k] || 0) + (Number(r.amountUZS) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

const sumUZS  = r => r.reduce((s, x) => s + (Number(x.amountUZS) || 0), 0);
const sumUSD  = r => r.reduce((s, x) => s + (Number(x.amountUSD) || 0), 0);
const pureUZS = r => r.filter(x => !Number(x.amountUSD)).reduce((s, x) => s + (Number(x.amountUZS) || 0), 0);
const convUZS = r => r.filter(x => Number(x.amountUSD) > 0).reduce((s, x) => s + (Number(x.amountUZS) || 0), 0);

function avgMonthly(recs) {
    const keys = new Set(recs.map(r => { const d = getRecordMonthKey(r); return d ? d.key : null; }).filter(Boolean));
    return keys.size ? Math.round(sumUZS(recs) / keys.size) : 0;
}

function peakMonth(recs) {
    const map = {};
    recs.forEach(r => {
        const d = getRecordMonthKey(r);
        if (d) map[d.label] = (map[d.label] || 0) + (Number(r.amountUZS) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : '—';
}

function fmt(v) {
    return v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toLocaleString();
}

// ---- Chart helpers ----
const BF = { family: "'Plus Jakarta Sans',sans-serif" };
const TC = { font: { ...BF, size: 11 }, color: '#64748B' };
const TU = { callbacks: { label: c => ` ${c.dataset.label || ''}: ${Number(c.raw).toLocaleString()} UZS` } };
const tickCb = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v;

function mkDonut(id, labels, vals, colors) {
    destroyChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    const total = vals.reduce((s, v) => s + v, 0);
    if (!total) return; // bo'sh bo'lsa chizmaymiz
    _charts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
        options: {
            cutout: '70%',
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { position: 'bottom', labels: { padding: 14, font: { ...BF, size: 11, weight: '600' }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${Number(c.raw).toLocaleString()} UZS` } }
            }
        }
    });
}

function mkBar(id, labels, datasets, stacked = false) {
    destroyChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _charts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: { stacked, grid: { display: false }, ticks: TC },
                y: { stacked, grid: { color: '#F1F5F9' }, ticks: { ...TC, callback: tickCb } }
            },
            plugins: {
                legend: { display: datasets.length > 1, labels: { font: { ...BF, size: 11 }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: TU
            }
        }
    });
}

function mkHBar(id, labels, vals, colors) {
    destroyChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _charts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 6, borderSkipped: 'start' }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: { grid: { color: '#F1F5F9' }, ticks: { ...TC, callback: tickCb } },
                y: { grid: { display: false }, ticks: { font: { ...BF, size: 12, weight: '600' }, color: '#0F172A' } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${Number(c.raw).toLocaleString()} UZS` } } }
        }
    });
}

function mkLine(id, labels, datasets) {
    destroyChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _charts[id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            scales: {
                x: { grid: { display: false }, ticks: TC },
                y: { grid: { color: '#F1F5F9' }, ticks: { ...TC, callback: tickCb } }
            },
            plugins: {
                legend: { display: datasets.length > 1, labels: { font: { ...BF, size: 11 }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: TU
            }
        }
    });
}

// ---- UI helpers ----
function sCard(icon, label, val, sub = '', ac = '') {
    return `<div class="dash-stat-card" style="${ac ? 'border-top:3px solid ' + ac : ''}">
        <div class="dash-stat-icon">${icon}</div>
        <div class="dash-stat-body">
            <div class="dash-stat-label">${label}</div>
            <div class="dash-stat-value">${val}</div>
            ${sub ? `<div class="dash-stat-sub">${sub}</div>` : ''}
        </div></div>`;
}

function cCard(title, id, h = 220) {
    return `<div class="dash-chart-card">
        <div class="dash-chart-title">${title}</div>
        <div style="position:relative;height:${h}px;"><canvas id="${id}"></canvas></div>
    </div>`;
}

function secTitle(t) { return `<div class="dash-section-title">${t}</div>`; }

// ============================================================
// FIX 2: 6-oy stacked bar — So'm va Dollar to'g'ri ajratiladi
// ============================================================
function calc6MonthSplit(recs, months6) {
    return months6.map(mo => {
        let uzs = 0, usd = 0;
        recs.forEach(r => {
            const d = getRecordMonthKey(r);
            if (!d || d.key !== mo.key) return;
            const isUsd = Number(r.amountUSD) > 0;
            if (isUsd) {
                usd += Number(r.amountUZS) || 0;
            } else {
                uzs += Number(r.amountUZS) || 0;
            }
        });
        return { uzs, usd };
    });
}

// ============================================================
// FIX 3: Personal charts — donut, category, txCount
// ============================================================
function renderPersonalCharts(prefix, recs, months6) {
    // Bar
    mkBar(prefix + '_monthly', months6.map(m => m.label), [{
        label: 'Hisob',
        data: sumByMonthKey(recs, months6),
        backgroundColor: months6.map((_, i) => i === months6.length - 1 ? '#10B981' : '#BFDBFE'),
        borderRadius: 6,
        borderSkipped: 'bottom'
    }]);

    // Donut
    const pu = pureUZS(recs), cu = convUZS(recs);
    if (pu > 0 || cu > 0) {
        mkDonut(prefix + '_donut', ["Faqat So'm", "Dollar (so'mga)"], [pu, cu], ['#10B981', '#F59E0B']);
    } else {
        const el = document.getElementById(prefix + '_donut');
        if (el && el.parentElement) {
            el.parentElement.innerHTML = '<div class="dash-empty" style="padding:20px;">Ma\'lumot yo\'q</div>';
        }
    }

    // Category
    const bycat = sumByCategory(recs);
    if (bycat.length) {
        mkHBar(prefix + '_cat', bycat.map(x => x[0]), bycat.map(x => x[1]), PALETTE);
    }

    // Tx count line
    const txPerMo = months6.map(mo => recs.filter(r => { const d = getRecordMonthKey(r); return d && d.key === mo.key; }).length);
    mkLine(prefix + '_txCount', months6.map(m => m.label), [{
        label: 'Amallar',
        data: txPerMo,
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139,92,246,0.08)',
        borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#8B5CF6',
        fill: true, tension: 0.4
    }]);
}

function personalChartsHTML(prefix, bycat) {
    return `
    ${cCard('📊 Oylik Hisob', prefix + '_monthly', 200)}
    ${cCard('🥧 Valyuta Taqsimoti', prefix + '_donut', 230)}
    ${bycat.length ? cCard('📋 Hisob Toifalari', prefix + '_cat', Math.max(160, bycat.length * 44)) : ''}
    ${cCard('📈 Oylik Amallar Soni', prefix + '_txCount', 160)}`;
}

// ============================================================
// ASOSIY YUKLASH
// ============================================================
function loadDashboard() {
    const el = document.getElementById('dashboardContent');
    if (!el) return;
    
    // Show loading indicator
    el.innerHTML = `<div class="dash-empty" style="padding:50px 20px;"><div style="font-size:40px">⏳</div><p style="margin-top:12px;">Yuklanmoqda...</p></div>`;
    
    try {
        if      (myRole === 'SuperAdmin') renderSuperAdminDashboard(el);
        else if (myRole === 'Direktor')   renderDirektorDashboard(el);
        else if (myRole === 'Admin')      renderAdminDashboard(el);
        else                              renderUserDashboard(el);
    } catch (error) {
        console.error('Dashboard rendering error:', error);
        el.innerHTML = `<div class="dash-empty"><p style="color:var(--red);">❌ Dashboardni chizishda xatolik: ${error.message}</p></div>`;
    }
}

// ---- Ma'lumot yuklash yordamchisi ----
function loadGlobalDataThen(callback) {
    if (globalAdminData.length && !globalAdminDataIsPartial) { callback(); return; }
    const el = document.getElementById('dashboardContent');
    el.innerHTML = `<div class="dash-empty" style="padding:50px 20px;"><div style="font-size:40px">⏳</div><p style="margin-top:12px;">Yuklanmoqda...</p></div>`;
    apiRequest({ action: 'admin_get_all' })
        .then(data => {
            if (data.success) {
                globalAdminData = data.data || [];
                globalAdminDataIsPartial = false;
                filteredData    = [...globalAdminData];
                callback();
            } else {
                el.innerHTML = `<div class="dash-empty"><p style="color:var(--red);">❌ Yuklanmadi. Admin paneliga o'ting.</p></div>`;
            }
        })
        .catch(() => {
            el.innerHTML = `<div class="dash-empty"><p style="color:var(--red);">❌ Internet ulanishini tekshiring.</p></div>`;
        });
}

// ============================================================
// HODIM DASHBOARD
// ============================================================
function renderUserDashboard(el) {
    const rec = myFullRecords;
    if (!rec.length) {
        el.innerHTML = `<div class="empty-state" style="padding:60px 20px;"><div style="font-size:40px">📭</div><p>Hali amallar kiritilmagan</p></div>`;
        return;
    }
    const months6 = getLastNMonths(6);
    const bycat   = sumByCategory(rec);
    const total   = sumUZS(rec), usd = sumUSD(rec), avg = avgMonthly(rec);
    const usdCnt  = rec.filter(r => Number(r.amountUSD) > 0).length;

    el.innerHTML = `
    <div class="dash-role-badge user">👤 Mening Statistikam</div>
    <div class="dash-stats-grid">
        ${sCard('💰', 'Jami Hisob', fmt(total) + ' UZS', 'So\'mda hisoblaganda', '#10B981')}
        ${sCard('💵', 'Dollar Hisob', '$' + usd.toLocaleString(), 'Dollar formatida', '#F59E0B')}
        ${sCard('📅', 'Oylik O\'rtacha', fmt(avg) + ' UZS', 'Hisoblangan o\'rtacha', '#3B82F6')}
        ${sCard('🏆', 'Eng Faol Oy', peakMonth(rec), 'Eng ko\'p hisob', '#8B5CF6')}
        ${sCard('📋', 'Jami Amallar', rec.length + ' ta', 'Kiritilgan amallar', '#EC4899')}
        ${sCard('💱', 'Dollar Amallar', usdCnt + ' ta', 'USD formatida', '#14B8A6')}
    </div>
    ${personalChartsHTML('chartU', bycat)}`;

    renderPersonalCharts('chartU', rec, months6);
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function renderAdminDashboard(el) {
    const my = myFullRecords;
    const showCompany = myPermissions.canViewDash && globalAdminData.length > 0;
    const all     = showCompany ? globalAdminData : [];
    const months6 = getLastNMonths(6);
    const bycat   = sumByCategory(my);

    el.innerHTML = `
    <div class="dash-role-badge admin">🛡 Admin Statistikasi</div>

    ${secTitle('👤 Mening Statistikam')}
    <div class="dash-stats-grid">
        ${sCard('💰', 'Jami Hisobim', fmt(sumUZS(my)) + ' UZS', '', '#10B981')}
        ${sCard('💵', 'Dollar', '$' + sumUSD(my).toLocaleString(), '', '#F59E0B')}
        ${sCard('📅', 'Oylik O\'rtacha', fmt(avgMonthly(my)) + ' UZS', '', '#3B82F6')}
        ${sCard('📋', 'Jami Amallarim', my.length + ' ta', '', '#EC4899')}
    </div>
    ${personalChartsHTML('chartA_my', bycat)}

    ${showCompany ? `
    ${secTitle('🏢 Kompaniya (Sizga ruxsat berilgan)')}
    <div class="dash-stats-grid">
        ${sCard('💰', 'Jami Budjet', fmt(sumUZS(all)) + ' UZS', '', '#10B981')}
        ${sCard('👥', 'Xodimlar::', new Set(all.map(r => r.name)).size + ' nafar', '', '#3B82F6')}
    </div>
    ${cCard('📈 Kompaniya Trendi', 'chartA_allTrend', 200)}
    ` : ''}`;

    renderPersonalCharts('chartA_my', my, months6);

    if (showCompany) {
        mkLine('chartA_allTrend', months6.map(m => m.label), [{
            label: 'Kompaniya', data: sumByMonthKey(all, months6),
            borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#3B82F6', fill: true, tension: 0.4
        }]);
    }
}

// ============================================================
// DIREKTOR DASHBOARD
// ============================================================
function renderDirektorDashboard(el) {
    loadGlobalDataThen(() => {
        const all     = globalAdminData;
        const my      = myFullRecords;
        const months6 = getLastNMonths(6);
        const months12 = getLastNMonths(12);
        const byEmp   = sumByEmployee(all).slice(0, 8);
        const m6split = calc6MonthSplit(all, months6);
        const bycat   = sumByCategory(my);

        el.innerHTML = `
        <div class="dash-role-badge boss">🎯 Direktor — To'liq Ko'rinish</div>

        ${secTitle('🏢 Kompaniya Statistikasi')}
        <div class="dash-stats-grid">
            ${sCard('💰', 'Jami Budjet', fmt(sumUZS(all)) + ' UZS', '', '#10B981')}
            ${sCard('💵', 'Dollar', '$' + sumUSD(all).toLocaleString(), '', '#F59E0B')}
            ${sCard('👥', 'Xodimlar::', new Set(all.map(r => r.name)).size + ' nafar', '', '#3B82F6')}
            ${sCard('📋', 'Amallar', all.length + ' ta', '', '#8B5CF6')}
            ${sCard('📅', 'Oylik O\'rtacha', fmt(avgMonthly(all)) + ' UZS', '', '#EC4899')}
            ${sCard('🏆', 'Eng Faol Oy', peakMonth(all) || '—', '', '#14B8A6')}
        </div>
        ${cCard('📈 12 Oylik Trend', 'chartD_trend', 220)}
        ${cCard('🥧 Valyuta Taqsimoti', 'chartD_donut', 250)}
        ${cCard('🏅 Top Xodimlar:::', 'chartD_emp', Math.max(200, byEmp.length * 50))}
        ${cCard('📊 6 Oy (So\'m / Dollar)', 'chartD_bar6', 220)}

        ${secTitle('👤 Mening Statistikam')}
        <div class="dash-stats-grid">
            ${sCard('💰', 'Jami Hisobim', fmt(sumUZS(my)) + ' UZS', '', '#10B981')}
            ${sCard('💵', 'Dollar', '$' + sumUSD(my).toLocaleString(), '', '#F59E0B')}
            ${sCard('📅', 'Oylik O\'rtacha', fmt(avgMonthly(my)) + ' UZS', '', '#3B82F6')}
            ${sCard('📋', 'Amallarim', my.length + ' ta', '', '#EC4899')}
        </div>
        ${personalChartsHTML('chartD_my', bycat)}`;

        mkLine('chartD_trend', months12.map(m => m.label), [{
            label: 'Jami', data: sumByMonthKey(all, months12),
            borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.07)',
            borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#10B981', fill: true, tension: 0.4
        }]);
        mkDonut('chartD_donut', ["Faqat So'm", "Dollar (so'mga)"], [pureUZS(all), convUZS(all)], ['#10B981', '#F59E0B']);
        mkHBar('chartD_emp', byEmp.map(e => e[0].split(' ')[0]), byEmp.map(e => e[1]), byEmp.map((_, i) => PALETTE[i % PALETTE.length]));
        mkBar('chartD_bar6', months6.map(m => m.label), [
            { label: "So'm",   data: m6split.map(x => x.uzs), backgroundColor: '#10B981', borderRadius: 4, borderSkipped: 'bottom' },
            { label: "Dollar", data: m6split.map(x => x.usd), backgroundColor: '#F59E0B', borderRadius: 4, borderSkipped: 'bottom' }
        ], true);
        renderPersonalCharts('chartD_my', my, months6);
    });
}

// ============================================================
// SUPERADMIN DASHBOARD
// ============================================================
function renderSuperAdminDashboard(el) {
    loadGlobalDataThen(() => {
        const all      = globalAdminData;
        const my       = myFullRecords;
        const months6  = getLastNMonths(6);
        const months12 = getLastNMonths(12);
        const byEmp    = sumByEmployee(all).slice(0, 8);
        const m6split  = calc6MonthSplit(all, months6);
        const bycat    = sumByCategory(my);

        el.innerHTML = `
        <div class="dash-role-badge boss">👑 SuperAdmin — To'liq Nazorat</div>

        ${secTitle('🏢 Kompaniya Statistikasi')}
        <div class="dash-stats-grid">
            ${sCard('💰', 'Jami Budjet', fmt(sumUZS(all)) + ' UZS', '', '#10B981')}
            ${sCard('💵', 'Dollar', '$' + sumUSD(all).toLocaleString(), '', '#F59E0B')}
            ${sCard('👥', 'Xodimlar:', new Set(all.map(r => r.name)).size + ' nafar', '', '#3B82F6')}
            ${sCard('📋', 'Amallar', all.length + ' ta', '', '#8B5CF6')}
            ${sCard('📅', 'Oylik O\'rtacha', fmt(avgMonthly(all)) + ' UZS', '', '#EC4899')}
            ${sCard('🏆', 'Eng Faol Oy', peakMonth(all) || '—', '', '#14B8A6')}
        </div>
        ${cCard('📈 12 Oylik Trend', 'chartS_trend', 220)}
        ${cCard('🥧 Valyuta Taqsimoti', 'chartS_donut', 240)}
        ${cCard('🏅 Top Xodimlar:::', 'chartS_emp', Math.max(200, byEmp.length * 50))}
        ${cCard('📊 6 Oy (So\'m / Dollar)', 'chartS_bar6', 220)}

        ${secTitle('👤 Mening Statistikam')}
        <div class="dash-stats-grid">
            ${sCard('💰', 'Jami Hisobim', fmt(sumUZS(my)) + ' UZS', '', '#10B981')}
            ${sCard('💵', 'Dollar', '$' + sumUSD(my).toLocaleString(), '', '#F59E0B')}
            ${sCard('📅', 'Oylik O\'rtacha', fmt(avgMonthly(my)) + ' UZS', '', '#3B82F6')}
            ${sCard('📋', 'Amallarim', my.length + ' ta', '', '#EC4899')}
        </div>
        ${personalChartsHTML('chartS_my', bycat)}`;

        mkLine('chartS_trend', months12.map(m => m.label), [{
            label: 'Jami', data: sumByMonthKey(all, months12),
            borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.07)',
            borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#10B981', fill: true, tension: 0.4
        }]);
        mkDonut('chartS_donut', ["Faqat So'm", "Dollar (so'mga)"], [pureUZS(all), convUZS(all)], ['#10B981', '#F59E0B']);
        mkHBar('chartS_emp', byEmp.map(e => e[0].split(' ')[0]), byEmp.map(e => e[1]), byEmp.map((_, i) => PALETTE[i % PALETTE.length]));
        mkBar('chartS_bar6', months6.map(m => m.label), [
            { label: "So'm",   data: m6split.map(x => x.uzs), backgroundColor: '#10B981', borderRadius: 4, borderSkipped: 'bottom' },
            { label: "Dollar", data: m6split.map(x => x.usd), backgroundColor: '#F59E0B', borderRadius: 4, borderSkipped: 'bottom' }
        ], true);
        renderPersonalCharts('chartS_my', my, months6);
    });
}
