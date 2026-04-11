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
    for(let i = curYear - 2; i <= curYear + 1; i++) {
        opts += `<option value="${i}" ${i === curYear ? 'selected' : ''}>${i}</option>`;
    }
    if(actionYear) actionYear.innerHTML = opts;
    if(editActionYear) editActionYear.innerHTML = opts;

    if(document.getElementById('actionMonth')) {
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
        if(r.actionPeriod) y = r.actionPeriod.split('-')[0];
        else {
            const dateMeta = getDateMonthYear(r.date);
            if (dateMeta) y = dateMeta.year;
        }
        if(y) years.add(y);
    });
    yearSel.innerHTML = '<option value="all">Yillar</option>';
    Array.from(years).sort((a,b)=>b-a).forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSel.appendChild(option);
    });
    applyMyFilters();
}

function applyMyFilters() {
    const month = document.getElementById('myFilterMonth').value;
    const year  = document.getElementById('myFilterYear').value;
    myFilteredRecords = myFullRecords.filter(r => {
        let m=true, y=true;
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
            if (year  !== 'all') y = rYear === year;
        }
        return m&&y;
    });
    myCurrentPage=1;
    drawMyHistoryUI();
}

function drawMyHistoryUI() {
    let tUZS=0, tUSD=0, tTotal=0;
    myFilteredRecords.forEach(r=>{
        const uzs=Number(r.amountUZS)||0, usd=Number(r.amountUSD)||0;
        tTotal+=uzs;
        if(usd>0) tUSD+=usd; else tUZS+=uzs;
    });
    const uzsEl=document.getElementById('myUzs');
    const usdEl=document.getElementById('myUsd');
    const totEl=document.getElementById('myTotalBudget');
    if(uzsEl) uzsEl.innerText=tUZS.toLocaleString();
    if(usdEl) usdEl.innerText='$'+tUSD.toLocaleString();
    if(totEl) totEl.innerText=tTotal.toLocaleString()+' UZS';
    renderMyPage();
}

function renderMyPage() {
    const reversed  = [...myFilteredRecords].reverse();
    const totalPages= Math.ceil(reversed.length/MY_ITEMS_PER_PAGE);
    const start     = (myCurrentPage-1)*MY_ITEMS_PER_PAGE;
    const pageData  = reversed.slice(start, start+MY_ITEMS_PER_PAGE);

    let html='';
    pageData.forEach((r,i)=>{
        const uzs=Number(r.amountUZS)||0, usd=Number(r.amountUSD)||0;
        const rate=Number(r.rate)||0;
        const effRate=rate>0?rate:(usd>0&&uzs>0?Math.round(uzs/usd):0);
        const origIdx=myFilteredRecords.length-1-start-i;
        const safeComment = escapeHtml(r.comment || '—');
        let dateHtml = `<span class="item-date">⏳ ${escapeHtml(r.date || '—')}</span>`;
        if (r.actionPeriod) {
            dateHtml = `<span class="item-date">📅 Davr: ${r.actionPeriod} (Yozildi: ${escapeHtml(r.date || '—')})</span>`;
        }
        html+=`
        <div class="history-item" onclick="showMyDetailModal(${origIdx})" style="cursor:pointer;">
            <div class="item-header">
                <span class="item-name">📝 ${safeComment}</span>
                ${dateHtml}
            </div>
            <div class="item-amounts">
                ${uzs>0?`<span class="amount-chip uzs">💰 ${uzs.toLocaleString()} UZS</span>`:''}
                ${usd>0?`<span class="amount-chip usd">💵 $${usd.toLocaleString()}</span>`:''}
                ${usd>0&&effRate>0?`<span class="rate-tag">📈 ${effRate.toLocaleString()}</span>`:''}
            </div>
        </div>`;
    });

    let pagHtml='';
    if(totalPages>1){
        pagHtml='<div class="pagination">';
        for(let i=1;i<=totalPages;i++)
            pagHtml+=`<button class="page-btn ${i===myCurrentPage?'active':''}" onclick="goToMyPage(${i})">${i}</button>`;
        pagHtml+='</div>';
    }

    document.getElementById('myHistory').innerHTML=
        html?html+pagHtml:`<div class="empty-state"><div class="empty-icon">💸</div><p>Hali hech qanday amal yo'q</p></div>`;
}

function goToMyPage(page){
    myCurrentPage=page;
    renderMyPage();
    document.getElementById('myHistory').scrollIntoView({behavior:'smooth',block:'start'});
}

function showMyDetailModal(idx){
    const r=myFilteredRecords[idx]; if(!r)return;
    showDetailModal(r,'self');
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred('light');
}

function resetAddForm() {
    document.getElementById('amount').value = '';
    document.getElementById('currency').value = 'UZS';
    document.getElementById('rate').value = '';
    document.getElementById('comment').value = '';
    if(document.getElementById('actionMonth')) {
        document.getElementById('actionMonth').value = String(new Date().getMonth() + 1).padStart(2, '0');
        document.getElementById('actionYear').value = new Date().getFullYear();
    }
    toggleRate();
}

// ---- Yangi amal ----
document.getElementById('financeForm').addEventListener('submit', async(e)=>{
    e.preventDefault();

    // Ruxsatni qayta tekshiramiz
    if (!checkAddPermission()) return;

    const btn    =document.getElementById('submitBtn');
    const status =document.getElementById('status');
    const actionMonth = document.getElementById('actionMonth') ? document.getElementById('actionMonth').value : '';
    const actionYear = document.getElementById('actionYear') ? document.getElementById('actionYear').value : '';
    const actionPeriod = actionYear && actionMonth ? `${actionYear}-${actionMonth}` : '';

    const amount  =parseFloat(document.getElementById('amount').value);
    const currency=document.getElementById('currency').value;
    const rate    =parseFloat(document.getElementById('rate').value)||0;
    const comment =document.getElementById('comment').value||"Izoh yo'q";
    const amountUZS=currency==='USD'?amount*rate:amount;
    const amountUSD=currency==='USD'?amount:0;
    if(currency==='USD'&&rate<5000)return alert("Iltimos, to'g'ri kursni kiriting!");

    const today = getTodayDdMmYyyy();
    const date = today.display;
    btn.disabled=true; btn.innerText='⏳ Yuborilmoqda...';

    try{
        const data = await apiRequest({
            action:'add',employeeName,telegramId,amountUZS,amountUSD,rate,comment,date,dateISO:today.iso, actionPeriod
        });
        if(data.success){
            status.style.color='var(--green-dark)'; status.innerText='✅ Muvaffaqiyatli saqlandi!';
            myFullRecords.push({
                rowId: Date.now(),
                name: myUsername || employeeName || '—',
                amountUZS: Number(amountUZS) || 0,
                amountUSD: Number(amountUSD) || 0,
                rate: Number(rate) || 0,
                comment: comment,
                date: date,
                actionPeriod: actionPeriod
            });
            applyMyFilters();
            resetAddForm();
            btn.disabled=false; btn.innerText='💾 Saqlash';
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            status.style.color='var(--red)'; status.innerText='❌ '+(data.error||'Xato');
            btn.disabled=false; btn.innerText='💾 Saqlash';
        }
    }catch{
        status.style.color='var(--red)'; status.innerText='❌ Xato yuz berdi.';
        btn.disabled=false; btn.innerText='💾 Saqlash';
    }
});
