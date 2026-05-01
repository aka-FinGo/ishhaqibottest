// ============================================================
// employee.js — Xodim funksiyalari
// ============================================================
let myCurrentPage = 1;
const MY_ITEMS_PER_PAGE = 8;

function initYearDropdowns() {
    const curYear = new Date().getFullYear();
    const actionYear = document.getElementById('actionYear');
    const editActionYear = document.getElementById('editActionYear');
    let opts = '';
    for (let i = curYear - 2; i <= curYear + 1; i++) {
        opts += `<option value="${i}" ${i === curYear ? 'selected' : ''}>${i}</option>`;
    }
    if (actionYear) actionYear.innerHTML = opts;
    if (editActionYear) editActionYear.innerHTML = opts;

    if (document.getElementById('actionMonth')) {
        const mm = String(new Date().getMonth() + 1).padStart(2, '0');
        document.getElementById('actionMonth').value = mm;
    }
}

function initMyFilters() {
    initYearDropdowns();
    const yearSel = document.getElementById('myFilterYear');
    let years = new Set();
    myFullRecords.forEach(r => {
        let y;
        if (r.actionPeriod) y = r.actionPeriod.split('-')[0];
        else {
            const dateMeta = getDateMonthYear(r.date);
            if (dateMeta) y = dateMeta.year;
        }
        if (y) years.add(y);
    });
    yearSel.innerHTML = '<option value="all">Yillar</option>';
    Array.from(years).sort((a, b) => b - a).forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSel.appendChild(option);
    });
    applyMyFilters();
}

function applyMyFilters() {
    const month = document.getElementById('myFilterMonth').value;
    const year = document.getElementById('myFilterYear').value;
    myFilteredRecords = myFullRecords.filter(r => {
        let m = true, y = true;
        let rYear, rMonth;
        if (r.actionPeriod) {
            const parts = r.actionPeriod.split('-');
            rYear = parts[0]; rMonth = parts[1];
        } else {
            const dateMeta = getDateMonthYear(r.date);
            if (dateMeta) { rYear = dateMeta.year; rMonth = dateMeta.month; }
        }

        if (!rYear && !rMonth && (month !== 'all' || year !== 'all')) return false;

        if (rYear || rMonth) {
            if (month !== 'all') m = rMonth === month;
            if (year !== 'all') y = rYear === year;
        }
        return m && y;
    });
    myCurrentPage = 1;
    drawMyHistoryUI();
}

function resetMyFilters() {
    document.getElementById('myFilterMonth').value = 'all';
    document.getElementById('myFilterYear').value = 'all';
    applyMyFilters();
}

function drawMyHistoryUI() {
    let tUZS = 0, tUSD = 0, tTotal = 0;
    myFilteredRecords.forEach(r => {
        const uzs = Number(r.amountUZS) || 0, usd = Number(r.amountUSD) || 0;
        tTotal += uzs;
        if (usd > 0) tUSD += usd; else tUZS += uzs;
    });
    const uzsEl = document.getElementById('myUzs');
    const usdEl = document.getElementById('myUsd');
    const totEl = document.getElementById('myTotalBudget');
    if (uzsEl) uzsEl.innerText = tUZS.toLocaleString();
    if (usdEl) usdEl.innerText = '$' + tUSD.toLocaleString();
    if (totEl) totEl.innerText = tTotal.toLocaleString() + ' UZS';
    renderMyPage();
}

function renderMyPage() {
    const sortedMyData = [...myFilteredRecords].sort((a, b) => {
        const davrA = getDavrSortKey(a.actionPeriod, a.date, a.dateISO);
        const davrB = getDavrSortKey(b.actionPeriod, b.date, b.dateISO);
        if (davrB !== davrA) {
            return davrB.localeCompare(davrA);
        }
        const dateA = new Date(a.dateISO || (a.date ? a.date.split('/').reverse().join('-') : ''));
        const dateB = new Date(b.dateISO || (b.date ? b.date.split('/').reverse().join('-') : ''));
        return dateB - dateA;
    });

    const totalPages = Math.ceil(sortedMyData.length / MY_ITEMS_PER_PAGE);
    const start = (myCurrentPage - 1) * MY_ITEMS_PER_PAGE;
    const pageData = sortedMyData.slice(start, start + MY_ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    let lastDavr = null;

    if (pageData.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `<div class="empty-icon">💸</div><p>Hali hech qanday amal yo'q</p>`;
        fragment.appendChild(emptyState);
    } else {
        pageData.forEach((r, i) => {
            const uzs = Number(r.amountUZS) || 0, usd = Number(r.amountUSD) || 0;
            const rate = Number(r.rate) || 0;
            const effRate = rate > 0 ? rate : (usd > 0 && uzs > 0 ? Math.round(uzs / usd) : 0);
            const origIdx = myFilteredRecords.indexOf(r);
            const safeComment = escapeHtml(r.comment || '—');
            let displayDate = escapeHtml(r.date || '—');
            const currentDavr = getDavrSortKey(r.actionPeriod, r.date, r.dateISO);
            let relDavr = getDavrLabel(currentDavr);
            if (relDavr !== lastDavr) {
                const dateHeader = document.createElement('div');
                dateHeader.style.cssText = 'font-size:13px; font-weight:700; color:#64748b; margin:16px 0 8px 4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;';
                dateHeader.textContent = relDavr;
                fragment.appendChild(dateHeader);
                lastDavr = relDavr;
            }
            let dateHtml = `<span class="item-date" style="font-size:11px; opacity:0.7;">$ ${displayDate}</span>`;
            if (r.actionPeriod) {
                dateHtml = `<span class="item-date" style="font-size:11px; opacity:0.7;">📅 Davr: ${r.actionPeriod} (${displayDate})</span>`;
            }
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.style.cssText = 'cursor:pointer; background:white; border-radius:12px; padding:12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);';
            itemDiv.onclick = () => showMyDetailModal(origIdx);
            itemDiv.innerHTML = `
                <div class="item-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="item-name" style="font-weight:600; color:#1e293b; font-size:14px;">
                        ${uzs > 0 ? '🟢 ' : (usd > 0 ? '🟡 ' : '🔴 ')} ${safeComment}
                    </span>
                    ${dateHtml}
                </div>
                <div class="item-amounts" style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                    ${uzs > 0 ? `<span class="amount-chip uzs" style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600;">💰 ${uzs.toLocaleString()} UZS</span>` : ''}
                    ${usd > 0 ? `<span class="amount-chip usd" style="background:#fef9c3; color:#854d0e; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600;">💵 $${usd.toLocaleString()}</span>` : ''}
                    ${usd > 0 && effRate > 0 ? `<span class="rate-tag" style="background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px; font-size:11px;">📈 1$=${effRate.toLocaleString()}</span>` : ''}
                </div>
            `;
            fragment.appendChild(itemDiv);
        });
        if (totalPages > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `page-btn ${i === myCurrentPage ? 'active' : ''}`;
                btn.onclick = () => goToMyPage(i);
                btn.innerText = i;
                paginationDiv.appendChild(btn);
            }
            fragment.appendChild(paginationDiv);
        }
    }
    const myHistoryEl = document.getElementById('myHistory');
    myHistoryEl.innerHTML = '';
    myHistoryEl.appendChild(fragment);
}

function goToMyPage(page) {
    myCurrentPage = page;
    renderMyPage();
    document.getElementById('myHistory').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showMyDetailModal(idx) {
    const r = myFilteredRecords[idx]; if (!r) return;
    showDetailModal(r, 'self');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function resetAddForm() {
    document.getElementById('amount').value = '';
    document.getElementById('currency').value = 'UZS';
    document.getElementById('rate').value = '';
    document.getElementById('comment').value = '';
    if (document.getElementById('actionMonth')) {
        document.getElementById('actionMonth').value = String(new Date().getMonth() + 1).padStart(2, '0');
        document.getElementById('actionYear').value = new Date().getFullYear();
    }
    toggleRate();
}

// ---- Yangi amal ----
document.getElementById('financeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkAddPermission()) return;

    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('status');
    const actionMonth = document.getElementById('actionMonth') ? document.getElementById('actionMonth').value : '';
    const actionYear = document.getElementById('actionYear') ? document.getElementById('actionYear').value : '';
    const actionPeriod = actionYear && actionMonth ? `${actionYear}-${actionMonth}` : '';

    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const rate = parseFloat(document.getElementById('rate').value) || 0;
    const comment = document.getElementById('comment').value || "Izoh yo'q";
    const amountUZS = currency === 'USD' ? amount * rate : amount;
    const amountUSD = currency === 'USD' ? amount : 0;

    if (currency === 'USD' && rate < 5000) return alert("Iltimos, to'g'ri kursni kiriting!");

    const isDuplicate = myFullRecords.some(r => {
        const rUzs = Number(r.amountUZS) || 0;
        const rUsd = Number(r.amountUSD) || 0;
        const rPeriod = r.actionPeriod || '';
        return rUzs === amountUZS && rUsd === amountUSD && rPeriod === actionPeriod;
    });

    if (isDuplicate) {
        const confirmMsg = `Ushbu davr (${actionPeriod || 'joriy'}) uchun ${amount.toLocaleString()} ${currency} miqdoridagi amal allaqachon mavjud!`;
        if (typeof showConfirmModal === 'function') {
            showConfirmModal(confirmMsg, () => {
                executeFinanceAdd(btn, status, amountUZS, amountUSD, rate, comment, actionPeriod);
            });
        } else if (confirm('⚠️ ' + confirmMsg + '\n\nBaribir saqlaysizmi?')) {
            executeFinanceAdd(btn, status, amountUZS, amountUSD, rate, comment, actionPeriod);
        }
    } else {
        executeFinanceAdd(btn, status, amountUZS, amountUSD, rate, comment, actionPeriod);
    }
});

async function executeFinanceAdd(btn, status, amountUZS, amountUSD, rate, comment, actionPeriod) {
    const today = getTodayDdMmYyyy();
    const date = today.display;
    btn.disabled = true; btn.innerText = '⏳ Yuborilmoqda...';

    try {
        const data = await apiRequest({
            action: 'add', employeeName, telegramId, amountUZS, amountUSD, rate, comment, date, dateISO: today.iso, actionPeriod
        });
        if (data.success) {
            status.style.color = 'var(--green-dark)'; status.innerText = '✅ Muvaffaqiyatli saqlandi!';
            myFullRecords.push({
                rowId: data.rowId || Date.now(),
                name: myUsername || employeeName || '—',
                amountUZS: Number(amountUZS) || 0,
                amountUSD: Number(amountUSD) || 0,
                rate: Number(rate) || 0,
                comment: comment,
                date: date,
                actionPeriod: actionPeriod,
                dateISO: today.iso
            });
            applyMyFilters();
            resetAddForm();
            btn.disabled = false; btn.innerText = '💾 Saqlash';
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            status.style.color = 'var(--red)'; status.innerText = '❌ ' + (data.error || 'Xato');
            btn.disabled = false; btn.innerText = '💾 Saqlash';
        }
    } catch (e) {
        status.style.color = 'var(--red)'; status.innerText = '❌ Xato yuz berdi.';
        btn.disabled = false; btn.innerText = '💾 Saqlash';
    }
}
