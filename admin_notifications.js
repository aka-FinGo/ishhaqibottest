// ============================================================
// ADMIN_NOTIFICATIONS.JS - Xabar yuborish boshqaruvi (ENHANCED)
// ============================================================

let pendingNotifyData = null;
let notifyTargetUsers = [];
let lastSendResults = [];

// ✅ Admin notification targets ni yuklash
async function loadNotifyTargets() {
  try {
    const data = await apiRequest({ action: 'list_notify_users' });
    if (data.success) {
      notifyTargetUsers = data.data || [];
      const select = document.getElementById('adminNotifyTargetTgId');
      if (select) {
        select.innerHTML = '<option value="">User tanlang</option>';
        notifyTargetUsers.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.tgId;
          opt.textContent = `${u.username || u.tgId}`;
          select.appendChild(opt);
        });
      }
      console.log('✅ Notify targets loaded:', notifyTargetUsers.length);
    } else {
      console.error('❌ Failed to load targets:', data.error);
    }
  } catch (e) {
    console.error('❌ Error loading notify targets:', e);
  }
}

// ✅ Xabar matn sozlamalarini yuklash
async function loadReminderTextSettings(forceRefresh = false) {
  try {
    const textarea = document.getElementById('adminReminderText');
    if (!textarea) return;

    if (!forceRefresh && textarea.value.trim()) {
      return; // Already loaded
    }

    const data = await apiRequest({ action: 'get_reminder_text' });
    if (data.success) {
      textarea.value = data.text || '';
      setNotifyStatus('✅ Xabar matni yuklandi', false, 'admin');
    } else {
      console.error('❌ Failed to load reminder text:', data.error);
      setNotifyStatus('❌ Yuklashda xato', true, 'admin');
    }
  } catch (e) {
    console.error('❌ Error loading reminder text:', e);
    setNotifyStatus('❌ Tarmoq xatosi', true, 'admin');
  }
}

// ✅ Xabar matn sozlamalarini saqlash
async function saveReminderTextSettings() {
  try {
    const textarea = document.getElementById('adminReminderText');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) {
      setNotifyStatus('❌ Xabar matni bo\'sh', true, 'admin');
      return;
    }

    if (text.length > 1000) {
      setNotifyStatus('❌ Matn juda uzun (max 1000 harf)', true, 'admin');
      return;
    }

    const btn = document.querySelector('[onclick*="saveReminderTextSettings"]');
    if (btn) setButtonLoading(btn, true, 'Saqlanmoqda...');

    const data = await apiRequest({
      action: 'set_reminder_text',
      text: text
    });

    if (data.success) {
      setNotifyStatus('✅ Xabar matni saqlandi', false, 'admin');
    } else {
      setNotifyStatus('❌ ' + (data.error || 'Xato'), true, 'admin');
    }

    if (btn) setButtonLoading(btn, false);
  } catch (e) {
    console.error('❌ Error saving reminder text:', e);
    setNotifyStatus('❌ Tarmoq xatosi', true, 'admin');
  }
}

// ✅ Xabar yuborish tayyorlash
async function prepareReminderSend(mode) {
  try {
    const textarea = document.getElementById('adminReminderText');
    const messageText = textarea ? textarea.value.trim() : '';

    if (!messageText) {
      setNotifyStatus('❌ Xabar matni bo\'sh', true, 'admin');
      return;
    }

    let targets = [];
    let confirmText = '';

    if (mode === 'single') {
      const selectEl = document.getElementById('adminNotifyTargetTgId');
      const selectedTgId = selectEl ? selectEl.value : '';
      if (!selectedTgId) {
        setNotifyStatus('❌ User tanlang', true, 'admin');
        return;
      }
      targets = [selectedTgId];
      const user = notifyTargetUsers.find(u => String(u.tgId) === String(selectedTgId));
      confirmText = `${user ? user.username : selectedTgId} ga xabar yuboriladi?`;
    } else if (mode === 'inactive') {
      const daysEl = document.getElementById('adminInactiveDays');
      const days = daysEl ? parseInt(daysEl.value) : 14;
      if (days < 1 || days > 365) {
        setNotifyStatus('❌ Kun 1-365 oraliqida bo\'lishi kerak', true, 'admin');
        return;
      }

      // Get inactive users
      const data = await apiRequest({ action: 'get_inactive_users', days });
      if (data.success) {
        targets = data.data || [];
        confirmText = `${targets.length} ta nom'istirollarni ga xabar yuboriladi (${days} kunga nizo'q)?`;
      } else {
        setNotifyStatus('❌ ' + (data.error || 'Yuklashda xato'), true, 'admin');
        return;
      }
    }

    if (targets.length === 0) {
      setNotifyStatus('❌ Hech kimga xabar yuborilmaydi', true, 'admin');
      return;
    }

    // Show confirmation
    pendingNotifyData = {
      mode,
      targets,
      messageText
    };

    const confirmBox = document.getElementById('adminNotifyConfirmBox');
    const confirmTextEl = document.getElementById('adminNotifyConfirmText');
    if (confirmBox && confirmTextEl) {
      confirmTextEl.innerText = confirmText;
      confirmBox.classList.remove('hidden');
    }

    setNotifyStatus(`📬 Tasdiqlanishni kutilmoqda: ${targets.length} ta`, false, 'admin');
  } catch (e) {
    console.error('❌ Error preparing reminder send:', e);
    setNotifyStatus('❌ Xato', true, 'admin');
  }
}

// ✅ Xabar yuborish tasdiqlash
async function confirmReminderSend() {
  if (!pendingNotifyData) {
    setNotifyStatus('❌ Hech nima tasdiqlanmadi', true, 'admin');
    return;
  }

  const { mode, targets, messageText } = pendingNotifyData;

  try {
    const confirmBtn = document.querySelector('[onclick*="confirmReminderSend"]');
    if (confirmBtn) setButtonLoading(confirmBtn, true, 'Yuborilmoqda...');

    let result;
    if (mode === 'single') {
      result = await apiRequest({
        action: 'send_user_reminder',
        targetTgId: targets[0],
        messageText
      });
    } else if (mode === 'inactive') {
      const daysEl = document.getElementById('adminInactiveDays');
      const days = daysEl ? parseInt(daysEl.value) : 14;
      result = await apiRequest({
        action: 'send_inactive_reminders',
        days,
        messageText
      });
    }

    if (result && result.success) {
      const sentCount = result.sent || targets.length;
      setNotifyStatus(`✅ ${sentCount} ta xabar yuborildi!`, false, 'admin');
      cancelReminderSend();
    } else {
      setNotifyStatus('❌ ' + (result?.error || 'Xato'), true, 'admin');
    }

    if (confirmBtn) setButtonLoading(confirmBtn, false);
  } catch (e) {
    console.error('❌ Error confirming reminder send:', e);
    setNotifyStatus('❌ Tarmoq xatosi', true, 'admin');
  }
}

// ✅ Xabar yuborish bekor qilish
function cancelReminderSend() {
  pendingNotifyData = null;
  const confirmBox = document.getElementById('adminNotifyConfirmBox');
  if (confirmBox) {
    confirmBox.classList.add('hidden');
  }
  setNotifyStatus('', false, 'admin');
}

// ✅ Status xabari ko'rsatish
function setNotifyStatus(message, isError = false, area = 'admin') {
  let statusEl;
  
  if (area === 'admin_service') {
    statusEl = document.getElementById('adminServiceStatus');
  } else {
    statusEl = document.getElementById('adminNotifyStatus');
  }

  if (!statusEl) return;

  statusEl.innerText = message;
  statusEl.style.color = isError ? 'var(--red)' : 'var(--green-dark)';
  statusEl.style.opacity = message ? '1' : '0';

  // Auto-hide success messages
  if (!isError && message) {
    setTimeout(() => {
      statusEl.style.opacity = '0';
    }, 4000);
  }
}

// Initialize when tab loads
function initNotificationsTab() {
  loadNotifyTargets();
  loadReminderTextSettings();
}