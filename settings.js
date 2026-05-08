// ============================================================
// SETTINGS.JS - Tema va Eslatmalar Boshqaruvi (FIXED)
// ============================================================

const THEME_KEY = 'ish_haqi_theme';
const REM_KEY = 'ish_haqi_reminders_v1';
const STORAGE_QUOTA_WARNING = 1048576; // 1MB limit for reminders

// ✅ FIX 1: HTML Escaping funksiyasi
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ✅ FIX 2: Safe localStorage bilan ishash
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      showToastMsg('❌ Xotira to\'lgan. Eski eslatmalarni o\'chiring.', true);
      console.error('Storage quota exceeded');
    } else {
      showToastMsg('❌ localStorage xatosi: ' + e.message, true);
      console.error('Storage error:', e);
    }
    return false;
  }
}

// ✅ FIX 3: Safe localStorage bilan o'qish va proper error handling
function getReminders() {
  try {
    const data = localStorage.getItem(REM_KEY) || '[]';
    return JSON.parse(data);
  } catch (e) {
    console.error('❌ Eslatmalarni yuklanishda xato:', e);
    try {
      localStorage.removeItem(REM_KEY); // Broken data o'chirish
    } catch (e2) {}
    return [];
  }
}

// ✅ Tema: ui.js dagi setTheme() va applyTheme() funksiyalari ishlatiladi
// Bu yerda alohida tema logikasi yo'q — settings.js faqat eslatmalar bilan shug'ullanadi

// ✅ FIX 6: Status message ko'rsatish va avtomatik o'chirish
function showStatus(message, isSuccess = true) {
  const st = document.getElementById('reminderStatus');
  if (!st) return;
  
  st.innerText = message;
  st.style.color = isSuccess ? 'var(--green-dark)' : 'var(--red)';
  st.style.opacity = '1';
  
  // Success xabari 3 soniyadan keyin o'chib ketsin
  if (isSuccess) {
    setTimeout(() => {
      st.style.opacity = '0';
      st.style.transition = 'opacity 0.3s ease';
    }, 3000);
  }
}

// ✅ FIX 7: Proper date sorting (string -> Date object)
function sortRemindersByDate(reminders) {
  return reminders.slice().sort((a, b) => {
    try {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB; // ✅ To'g'ri sorting
    } catch (e) {
      console.warn('Date parsing xatosi:', a.date, b.date);
      return 0;
    }
  });
}

// ✅ FIX 8: Efficient reminder rendering (event delegation)
function renderReminders() {
  const box = document.getElementById('remindersList');
  if (!box) return;

  const reminders = sortRemindersByDate(getReminders());

  if (!reminders.length) {
    box.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:32px;margin-bottom:12px;">📝</div>
        <p style="margin:0;font-weight:700;">Hali eslatma yo'q</p>
        <p style="margin:8px 0 0;font-size:13px;">
          Yuqorida yangi eslatma qo'shish uchun sana va matnni kiriting
        </p>
      </div>
    `;
    // Remove event listeners
    box.removeEventListener('click', handleReminderDelete);
    return;
  }

  // ✅ Event delegation: Barcha buttonlarga listener qo'shish o'rniga, parent ga qo'shish
  box.innerHTML = reminders.map((r, i) => `
    <div class="compact-item" data-rem-index="${i}" data-rem-date="${escapeHtml(r.date)}">
      <div>
        <div style="font-weight:700;">${escapeHtml(r.text)}</div>
        <div style="font-size:11px;color:var(--text-muted)">📅 ${escapeHtml(r.date)}</div>
      </div>
      <button class="del-icon-btn" data-action="delete" type="button">🗑</button>
    </div>
  `).join('');

  // Event delegation listener
  box.removeEventListener('click', handleReminderDelete);
  box.addEventListener('click', handleReminderDelete);
}

// ✅ FIX 9: Event delegation handler
function handleReminderDelete(e) {
  if (e.target.dataset.action !== 'delete') return;
  
  const item = e.target.closest('[data-rem-index]');
  if (!item) return;

  const remDate = item.dataset.remDate;
  const reminders = getReminders();
  
  // ✅ Date-based removal (index o'rniga)
  const filtered = reminders.filter(r => r.date !== remDate);
  
  if (safeStorageSet(REM_KEY, JSON.stringify(filtered))) {
    item.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => renderReminders(), 300);
  }
}

// ✅ FIX 10: Date validation (ISO format)
function validateDate(dateStr) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Future date tekshirish (optional)
  if (date < new Date()) {
    return { valid: false, msg: 'Sana bugunga yoki keyingi kunga bo\'lishi kerak' };
  }
  
  return { valid: true };
}

// ✅ FIX 11: Add reminder bilan proper validation va error handling
function addReminder() {
  const dateInput = document.getElementById('remDate');
  const textInput = document.getElementById('remText');
  const statusEl = document.getElementById('reminderStatus');

  if (!dateInput || !textInput || !statusEl) {
    console.error('❌ Reminder form elementlari topilmadi');
    return;
  }

  const date = dateInput.value.trim();
  const text = textInput.value.trim();

  // Validation
  if (!date) {
    showStatus('❗ Sana kiritilishi shart', false);
    dateInput.focus();
    return;
  }

  if (!text) {
    showStatus('❗ Eslatma matni kiritilishi shart', false);
    textInput.focus();
    return;
  }

  const dateValidation = validateDate(date);
  if (!dateValidation.valid) {
    showStatus(`❗ ${dateValidation.msg || 'Sana noto\'g\'ri'}`, false);
    dateInput.focus();
    return;
  }

  if (text.length > 500) {
    showStatus('❗ Matn juda uzun (max 500 harf)', false);
    return;
  }

  // Get existing reminders
  const reminders = getReminders();

  // Duplicate check
  const isDuplicate = reminders.some(r => r.date === date && r.text === text);
  if (isDuplicate) {
    showStatus('⚠️ Bu eslatma allaqachon mavjud', false);
    return;
  }

  // Check storage size
  const newReminder = { date, text };
  const newData = JSON.stringify([...reminders, newReminder]);
  if (newData.length > STORAGE_QUOTA_WARNING * 0.9) {
    showStatus('⚠️ Xotira ko\'p ish qildapti. Eski eslatmalarni o\'chiring.', false);
    return;
  }

  // Save
  if (safeStorageSet(REM_KEY, newData)) {
    dateInput.value = '';
    textInput.value = '';
    showStatus('✅ Eslatma saqlandi', true);
    renderReminders();
    dateInput.focus();
  }
}

// ✅ FIX 12: Window load event
window.addEventListener('load', () => {
  try {
    // Reminders render
    renderReminders();

    // Enter key handler for reminder input
    const remText = document.getElementById('remText');
    if (remText) {
      remText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          addReminder();
        }
      });
    }

    console.log('✅ Settings (eslatmalar) initsiyalizatsiya bajarildi');
  } catch (e) {
    console.error('❌ Settings load xatosi:', e);
  }
});