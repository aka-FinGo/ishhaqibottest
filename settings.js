// ============================================================
// settings.js — Dark mode + reminder manager (local)
// ============================================================
const THEME_KEY = 'ish_haqi_theme';
const REM_KEY = 'ish_haqi_reminders_v1';

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  const tg = document.getElementById('themeToggle');
  if (tg) tg.checked = isDark;
}

function toggleTheme() {
  const checked = document.getElementById('themeToggle').checked;
  const theme = checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function getReminders() {
  try {
    return JSON.parse(localStorage.getItem(REM_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderReminders() {
  const box = document.getElementById('remindersList');
  if (!box) return;

  const reminders = getReminders().sort((a, b) => (a.date > b.date ? 1 : -1));
  if (!reminders.length) {
    box.innerHTML = '<div class="empty-state"><p>Eslatmalar yo\'q.</p></div>';
    return;
  }

  box.innerHTML = reminders.map((r, i) => `
    <div class="compact-item">
      <div>
        <div style="font-weight:700;">${r.text}</div>
        <div style="font-size:11px;color:var(--text-muted)">📅 ${r.date}</div>
      </div>
      <button class="del-icon-btn" onclick="removeReminder(${i})">🗑</button>
    </div>
  `).join('');
}

function addReminder() {
  const date = document.getElementById('remDate').value;
  const text = (document.getElementById('remText').value || '').trim();
  const st = document.getElementById('reminderStatus');

  if (!date || !text) {
    st.style.color = 'var(--red)';
    st.innerText = '❗ Sana va matnni to\'ldiring.';
    return;
  }

  const rems = getReminders();
  rems.push({ date, text });
  localStorage.setItem(REM_KEY, JSON.stringify(rems));

  document.getElementById('remDate').value = '';
  document.getElementById('remText').value = '';
  st.style.color = 'var(--green-dark)';
  st.innerText = '✅ Eslatma saqlandi.';

  renderReminders();
}

function removeReminder(idx) {
  const rems = getReminders();
  rems.splice(idx, 1);
  localStorage.setItem(REM_KEY, JSON.stringify(rems));
  renderReminders();
}

window.addEventListener('load', () => {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
  renderReminders();
});
