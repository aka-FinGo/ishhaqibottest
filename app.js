// =========================================================
// ⚠️ DIQQAT! GOOGLE SCRIPT SSILKASINI SHU YERGA QO'YASIZ!
// =========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyELe4JB8a4NpmaZr2wlonnOwu9gDIkumw3JEu2VuMyl--pwImUrcvkG4e5H1GnONk9Pw/exec"; 

const tg = window.Telegram.WebApp;
tg.expand();

// Foydalanuvchi ma'lumotlarini Telegramdan avtomatik olish
const user = tg.initDataUnsafe?.user;
const employeeName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : "Test User";
const telegramId = user ? String(user.id) : "Yo'q";

let globalAdminData = []; 
let filteredData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10; 
let myRole = 'User'; 
let myFullRecords = []; // Xodimning hamma ma'lumotlari (original)
let myFilteredRecords = []; // Filtrlangan ma'lumotlar
// ================= 1. DASTLABKI YUKLANISH =================
window.onload = async () => {
    document.getElementById('greeting').innerText = `Salom, ${user ? user.first_name : 'Xodim'}!`;
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "init", telegramId }) });
        const data = await res.json();
        
        if (data.success) {
            renderMyHistory(data.data);
            
            if (data.isBoss) myRole = 'Boss';
            else if (data.isAdmin) myRole = 'Admin';
            else if (data.isDirector) myRole = 'Direktor';

            if (myRole !== 'User') {
                document.getElementById('nav-admin').classList.remove('hidden');
            }
            if (myRole === 'Boss') {
                document.getElementById('bossNav').classList.remove('hidden');
            }
        }
    } catch (e) { console.error("Xato:", e); }
};

// ================= 2. NAVIGATSIYA =================
function switchTab(tabId, navId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(navId !== 'nav-add') document.getElementById(navId).classList.add('active');
    
    if (tabId === 'adminTab') loadAdminData();
}

function switchAdminSub(areaId, btn) {
    document.getElementById('adminDataArea').classList.add('hidden');
    document.getElementById('adminRolesArea').classList.add('hidden');
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(areaId).classList.remove('hidden');
    btn.classList.add('active');
}

function toggleRate() { 
    const isUsd = document.getElementById('currency').value === 'USD';
    document.getElementById('rateDiv').classList.toggle('hidden', !isUsd);
}

// ================= 3. MENING HISOBOTIM (Jami Budjet bilan) =================
function renderMyHistory(records) {
    let tUZS = 0;           // Faqat so'mda kiritilganlar
    let tUSD = 0;           // Faqat dollarda kiritilganlar
    let tTotalBudget = 0;   // JAMI BUDJET (Dollar*Kurs + So'm)
    let html = '';

    [...records].reverse().forEach(r => {
        const uzsVal = Number(r.amountUZS) || 0;
        const usdVal = Number(r.amountUSD) || 0;

        // amountUZS backendda allaqachon (USD * Rate) qilib saqlanadi
        tTotalBudget += uzsVal;

        if (usdVal > 0) {
            tUSD += usdVal;
        } else {
            tUZS += uzsVal;
        }

        html += `<div class="history-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:600;">${r.comment}</span>
                <span style="font-size:11px; color:#888;">📅 ${r.date}</span>
            </div>
            <div style="text-align:right;">
                ${uzsVal > 0 ? `<div style="color:#2e7d32; font-weight:bold;">${uzsVal.toLocaleString()} UZS</div>` : ''}
                ${usdVal > 0 ? `<div style="color:#e65100; font-weight:bold;">$${usdVal.toLocaleString()}</div>` : ''}
            </div>
        </div>`;
    });

    document.getElementById('myUzs').innerText = tUZS.toLocaleString(); 
    document.getElementById('myUsd').innerText = '$' + tUSD.toLocaleString();
    
    // Jami budjetni ko'rsatish
    const budgetEl = document.getElementById('myTotalBudget');
    if (budgetEl) budgetEl.innerText = tTotalBudget.toLocaleString() + " UZS";

    document.getElementById('myHistory').innerHTML = html || "<p class='text-center text-gray'>Hali hech qanday xarajat yo'q</p>";
}

// ================= 4. YANGI XARAJAT QO'SHISH =================
document.getElementById('financeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn'); 
    const status = document.getElementById('status');
    
    let amount = parseFloat(document.getElementById('amount').value); 
    let currency = document.getElementById('currency').value;
    let rate = parseFloat(document.getElementById('rate').value) || 0; 
    let comment = document.getElementById('comment').value || "Izoh yo'q";
    
    let amountUZS = currency === 'USD' ? amount * rate : amount; 
    let amountUSD = currency === 'USD' ? amount : 0;
    
    if (currency === 'USD' && rate < 5000) return alert("Iltimos, to'g'ri kursni kiriting!");

    const date = new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

    btn.disabled = true; btn.innerText = "Yuborilmoqda...";
    try {
        await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "add", employeeName, telegramId, amountUZS, amountUSD, rate, comment, date }) });
        status.style.color = "green"; status.innerText = "✅ Tizimga saqlandi!";
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) { 
        status.style.color = "red"; status.innerText = "❌ Xato yuz berdi";
        btn.disabled = false; btn.innerText = "Saqlash"; 
    }
});

// ================= 5. ADMIN FILTRLAR VA HISOBOT =================
async function loadAdminData() {
    document.getElementById('adminList').innerHTML = "<p class='text-center'>Yuklanmoqda... ⏳</p>";
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "admin_get_all", telegramId }) });
        const data = await res.json();
        if (data.success) { 
            globalAdminData = data.data; 
            filteredData = [...globalAdminData];
            currentPage = 1;
            populateFilters();
            calculateTotal();
            renderAdminPage(); 
        }
    } catch(e) {}
}

function populateFilters() {
    const empSelect = document.getElementById('filterEmployee');
    const yearSelect = document.getElementById('filterYear');
    let employees = new Set();
    let years = new Set();
    
    globalAdminData.forEach(r => {
        if(r.name) employees.add(r.name);
        if(r.date) years.add(r.date.split('/')[2]); 
    });

    empSelect.innerHTML = '<option value="all">Barcha xodimlar</option>';
    yearSelect.innerHTML = '<option value="all">Yillar</option>';

    Array.from(employees).sort().forEach(emp => empSelect.innerHTML += `<option value="${emp}">${emp}</option>`);
    Array.from(years).sort((a,b)=>b-a).forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
}

let debounceTimer;
function applyFilters() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const emp = document.getElementById('filterEmployee').value;
        const month = document.getElementById('filterMonth').value;
        const year = document.getElementById('filterYear').value;

        filteredData = globalAdminData.filter(item => {
            const matchesText = (item.name && item.name.toLowerCase().includes(query)) || 
                                (item.comment && item.comment.toLowerCase().includes(query));
            const matchesEmp = emp === 'all' || item.name === emp;
            
            let matchesMonth = true;
            let matchesYear = true;
            
            if (item.date) {
                const parts = item.date.split('/');
                if (month !== 'all') matchesMonth = parts[1] === month;
                if (year !== 'all') matchesYear = parts[2] === year;
            }
            return matchesText && matchesEmp && matchesMonth && matchesYear;
        });

        currentPage = 1;
        calculateTotal();
        renderAdminPage();
    }, 300);
}

function calculateTotal() {
    let totalBudget = 0;
    filteredData.forEach(r => {
        totalBudget += Number(r.amountUZS) || 0;
    });

    const budgetElement = document.getElementById('totalCompanyUzs');
    if (budgetElement) budgetElement.innerText = totalBudget.toLocaleString() + " UZS";

    const countElement = document.getElementById('filteredCount');
    if (countElement) countElement.innerText = filteredData.length;
}

function renderAdminPage() {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = filteredData.slice(start, end);
    
    let html = '';
    pageData.forEach(r => {
        const isUsd = r.amountUSD > 0;
        const rateText = isUsd && r.rate ? `<span style="font-size:10px; color:#888;">(Kurs: ${r.rate})</span>` : '';
        
        let actionBtns = '';
        if (myRole === 'Boss' || myRole === 'Admin') {
            // Tahrirlashga ism va sanani ham uzatamiz
            actionBtns = `
            <div class="action-btns" style="margin-top:8px;">
                <button class="edit-btn" onclick="openEdit(${r.rowId}, ${r.amountUZS}, ${r.amountUSD}, ${r.rate}, '${r.comment}', '${r.name}', '${r.date}')">✏️ Tahrirlash</button>
                <button class="del-btn" onclick="deleteRecord(${r.rowId})">🗑 O'chirish</button>
            </div>`;
        }

        html += `<div class="history-item" style="flex-direction: column; align-items: stretch;">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:5px;">
                <strong>👤 ${r.name}</strong><span style="font-size:11px; color:#888;">📅 ${r.date}</span>
            </div>
            <div style="margin:8px 0; color:#444;">📝 ${r.comment}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:bold; font-size:15px;">
                    ${r.amountUZS > 0 ? `<div style="color:#2e7d32;">${Number(r.amountUZS).toLocaleString()} UZS</div>` : ''}
                    ${isUsd ? `<div style="color:#e65100;">$${Number(r.amountUSD).toLocaleString()} ${rateText}</div>` : ''}
                </div>
            </div>
            ${actionBtns}
        </div>`;
    });
    document.getElementById('adminList').innerHTML = html;
    renderPaginationControls();
}

function renderPaginationControls() {
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    let html = '';
    if(totalPages > 1) {
        for(let i=1; i<=totalPages; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
    }
    document.getElementById('pagination').innerHTML = html;
}

function goToPage(page) { 
    currentPage = page; 
    renderAdminPage(); 
    document.getElementById('adminDataArea').scrollIntoView({ behavior: 'smooth' });
}

// ================= 6. EXCEL (.XLSX) EXPORT =================
async function exportToExcel() {
    try {
        if (typeof XLSX === 'undefined') {
            alert("Xatolik: Excel kutubxonasi yuklanmagan!");
            return;
        }

        if (filteredData.length === 0) {
            alert("Eksport qilish uchun ma'lumot yo'q!");
            return;
        }

        tg.MainButton.setText("Fayl botga yuborilmoqda...").show();

        // 1. Ma'lumotlarni Excel uchun tayyorlash
        const exportData = filteredData.map(r => {
            const isUsd = Number(r.amountUSD) > 0;
            return {
                "Sana": r.date || "",
                "Xodim": r.name || "",
                "Izoh": r.comment || "",
                "Summa (UZS)": Number(r.amountUZS) || 0,
                "Summa (USD)": Number(r.amountUSD) || 0,
                "Kurs": isUsd ? (Number(r.rate) || "Ko'rsatilmagan") : "-" // Dollarda bo'lsa kursni yozadi
            };
        });

        // 2. Excel varag'ini yaratish
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        // Ustunlar kengligini chiroyli qilish
        worksheet['!cols'] = [
            {wch: 12}, {wch: 20}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 15}
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Fintech_Hisobot");

        // 3. Base64 formatiga o'tkazish
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const fileName = `Hisobot_${new Date().toISOString().slice(0,10)}.xlsx`;

        // 4. Bot orqali yuborish (Serverga so'rov)
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "export_to_bot",
                telegramId: telegramId,
                base64: wbout,
                fileName: fileName
            })
        });

        const result = await response.json();

        if (result.success) {
            tg.MainButton.hide();
            tg.showAlert("✅ Excel hisobot shaxsiy xabaringizga (Botdan) yuborildi!");
        } else {
            throw new Error(result.error || "Faylni yuborishda xatolik");
        }

    } catch (error) {
        console.error("Export xatosi:", error);
        alert("Xatolik: Ma'lumotni Excel qilishda muammo bo'ldi. " + error.message);
        tg.MainButton.hide();
    }
}

// ================= 7. TAHRIRLASH (Tushunarli Modal) =================
function openEdit(rowId, uzs, usd, rate, comment, name, date) {
    document.getElementById('editRowId').value = rowId;
    document.getElementById('editAmountUZS').value = uzs;
    document.getElementById('editAmountUSD').value = usd;
    document.getElementById('editRate').value = rate;
    document.getElementById('editComment').value = (comment !== 'undefined' && comment !== 'null') ? comment : '';
    
    // Headerga kimning ma'lumoti ekanini yozish
    const headerName = document.getElementById('editHeaderName');
    const headerDate = document.getElementById('editHeaderDate');
    if (headerName) headerName.innerText = "👤 " + name;
    if (headerDate) headerDate.innerText = "📅 " + date;
    
    document.getElementById('editModal').classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('medium');
}

function closeModal() { 
    document.getElementById('editModal').classList.add('hidden'); 
}

async function saveEdit() {
    const rowId = document.getElementById('editRowId').value;
    const amountUZS = document.getElementById('editAmountUZS').value;
    const amountUSD = document.getElementById('editAmountUSD').value;
    const rate = document.getElementById('editRate').value;
    const comment = document.getElementById('editComment').value;
    
    closeModal();
    document.getElementById('adminList').innerHTML = "<p class='text-center'>Saqlanmoqda... ⏳</p>";
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "admin_edit", telegramId, rowId, amountUZS, amountUSD, rate, comment }) 
    });
    loadAdminData();
}

async function deleteRecord(rowId) {
    if(!confirm("Ushbu ma'lumotni o'chirishga ishonchingiz komilmi?")) return;
    document.getElementById('adminList').innerHTML = "<p class='text-center'>O'chirilmoqda... ⏳</p>";
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "admin_delete", telegramId, rowId }) });
    loadAdminData();
}

// ================= 8. ROLLAR BOSHQARUVI =================
async function loadAdmins() {
    document.getElementById('rolesList').innerHTML = "<p class='text-center'>Yuklanmoqda... ⏳</p>";
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "get_admins", telegramId }) });
        const data = await res.json();
        if (data.success) {
            let html = '';
            data.data.forEach(r => {
                let badgeColor = r.role === 'Boss' ? '#d84315' : (r.role === 'Direktor' ? '#00838f' : '#2a5298');
                html += `<div class="history-item">
                    <div><strong>${r.name}</strong><br><span style="font-size:11px; color:#888;">ID: ${r.tgId}</span></div>
                    <div style="text-align:right;">
                        <span style="background:${badgeColor}; color:#fff; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:bold;">${r.role}</span><br>
                        <button class="del-btn" style="padding:4px 10px; width:auto; margin-top:5px;" onclick="delAdmin(${r.rowId})">🗑</button>
                    </div>
                </div>`;
            });
            document.getElementById('rolesList').innerHTML = html;
        }
    } catch(e) {}
}

async function addAdmin() {
    const st = document.getElementById('adminStatus');
    const newTgId = document.getElementById('newAdminId').value;
    const newName = document.getElementById('newAdminName').value || "Yangi Xodim";
    const newRole = document.getElementById('newAdminRole').value;
    
    if(!newTgId) { st.style.color="red"; st.innerText="ID raqami yozilishi shart!"; return; }
    st.style.color="#888"; st.innerText="Qo'shilmoqda...";

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "add_admin", telegramId, newTgId, newName, newRole }) });
        const data = await res.json();
        if (data.success) {
            st.style.color="green"; st.innerText="✅ Tizimga muvaffaqiyatli qo'shildi!";
            document.getElementById('newAdminId').value = ''; 
            document.getElementById('newAdminName').value = '';
            loadAdmins();
        } else { st.style.color="red"; st.innerText="❌ " + (data.error || "Xato"); }
    } catch(e) {}
}

async function delAdmin(rowId) {
    if(!confirm("Bu rolni o'chirishga ishonchingiz komilmi?")) return;
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "del_admin", telegramId, rowId }) });
        const data = await res.json();
        if (data.success) { loadAdmins(); } else { alert(data.error); }
    } catch(e) {}
}
