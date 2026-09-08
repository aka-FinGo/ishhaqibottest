// ============================================================
// MIGRATE_SETTINGS_FROM_GAS.JS
// Migrates ONLY settings, workflow, positions, AI config and employees
// directly from live Google Apps Script to SQLite without touching records/kvadratlar.
// ============================================================
'use strict';

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db, setSetting } = require('./db');

const BOT_TOKEN = (process.env.BOT_TOKEN && process.env.BOT_TOKEN !== 'YOUR_BOT_TOKEN')
  ? process.env.BOT_TOKEN
  : '8355215374:AAENva7vRDUX7qQ9793wAHjzw-uHnxePVyk';
const SUPER_ADMIN_ID = (process.env.SUPER_ADMIN_ID && process.env.SUPER_ADMIN_ID !== 'YOUR_TG_ADMIN_CHAT_ID')
  ? process.env.SUPER_ADMIN_ID
  : '2112012311';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwwCfiCjL6Nvi3uXw6gfLkrXJrV30SS7YKoeQbnzJj0wXieWjTHrcn9vtPBtvonFQa4RA/exec';

function generateInitData(botToken, tgId) {
  const user = JSON.stringify({ id: Number(tgId), first_name: 'iRealBy_3D' });
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: 'AAGHmigration',
    user: user
  };

  const keys = Object.keys(params).sort();
  const checkString = keys.map(k => k + '=' + params[k]).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  return keys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&') + '&hash=' + hash;
}

async function fetchFromGAS(action, extra = {}) {
  const initData = generateInitData(BOT_TOKEN, SUPER_ADMIN_ID);
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: action,
      telegramId: String(SUPER_ADMIN_ID),
      initData: initData,
      ...extra
    })
  });
  return await res.json();
}

async function run() {
  console.log('🔄 Google Apps Script dan sozlamalarni ko\'chirish boshlandi...\n');

  // 1. Global Settings
  console.log('1️⃣ Global sozlamalar yuklanmoqda...');
  const globalRes = await fetchFromGAS('get_global_settings');
  if (globalRes.success && globalRes.settings) {
    const s = globalRes.settings;
    setSetting('ONLY_BUGALTER_ADD', s.onlyBugalterAdd ? '1' : '0');
    setSetting('DISABLE_EMP_EDIT_DELETE', s.disableEmpEditDelete ? '1' : '0');
    setSetting('NOTIFY_DIRECTOR', s.notifyDirector ? '1' : '0');
    setSetting('WORKFLOW_STRICT_MODE', s.workflowStrictMode ? '1' : '0');
    console.log('   ✅ Global sozlamalar saqlandi:');
    console.log(`      • ONLY_BUGALTER_ADD: ${s.onlyBugalterAdd}`);
    console.log(`      • DISABLE_EMP_EDIT_DELETE: ${s.disableEmpEditDelete}`);
    console.log(`      • NOTIFY_DIRECTOR: ${s.notifyDirector}`);
    console.log(`      • WORKFLOW_STRICT_MODE: ${s.workflowStrictMode}`);
  } else {
    console.warn('   ⚠️ Global sozlamalarni olib bo\'lmadi:', globalRes.error);
  }

  // 2. Reminder Text
  console.log('\n2️⃣ Eslatma matni yuklanmoqda...');
  const reminderRes = await fetchFromGAS('get_reminder_text');
  if (reminderRes.success && reminderRes.text) {
    setSetting('REMINDER_TEXT', reminderRes.text);
    console.log(`   ✅ Eslatma matni saqlandi: "${reminderRes.text.substring(0, 60)}..."`);
  }

  // 3. Workflow Steps
  console.log('\n3️⃣ Kvadratlar Workflow bosqichlari yuklanmoqda...');
  const wfRes = await fetchFromGAS('workflow_get_config');
  if (wfRes.success && Array.isArray(wfRes.steps)) {
    db.exec('DELETE FROM workflow_steps;');
    const stmt = db.prepare(`
      INSERT INTO workflow_steps (step_index, position_name, action_label, status_label, is_start)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const step of wfRes.steps) {
      stmt.run(
        step.index || step.step_index,
        step.position || step.position_name || '',
        step.action || step.action_label || '',
        step.status || step.status_label || '',
        step.isStart ? 1 : 0
      );
    }
    console.log(`   ✅ ${wfRes.steps.length} ta workflow bosqichlari saqlandi.`);
  }

  // 4. Positions
  console.log('\n4️⃣ Lavozimlar yuklanmoqda...');
  const posRes = await fetchFromGAS('positions_get_all');
  if (posRes.success && Array.isArray(posRes.positions)) {
    db.exec('DELETE FROM positions;');
    const stmt = db.prepare('INSERT INTO positions (position_name, icon) VALUES (?, ?)');
    for (const p of posRes.positions) {
      if (p.name) {
        stmt.run(p.name, p.icon || '💼');
      }
    }
    console.log(`   ✅ ${posRes.positions.length} ta lavozimlar saqlandi.`);
  }

  // 5. AI Configurations
  console.log('\n5️⃣ AI Agent konfiguratsiyasi yuklanmoqda...');
  const aiRes = await fetchFromGAS('ai_get_config');
  if (aiRes.success && aiRes.config) {
    setSetting('AI_PROVIDERS_CONFIG', JSON.stringify(aiRes.config));
    console.log(`   ✅ ${(aiRes.config.all || []).length} ta AI provayder sozlamalari saqlandi.`);
  }

  // 6. Employees (Hodimlar)
  console.log('\n6️⃣ Hodimlar ro\'yxati va huquqlari yuklanmoqda...');
  const empRes = await fetchFromGAS('get_hodimlar');
  if (empRes.success && Array.isArray(empRes.data)) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO employees (
        telegram_id, username, can_add, super_admin, direktor, admin,
        can_view_all, can_edit, can_delete, can_export, can_view_dash,
        role, lavozim, guruh, is_sardor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const emp of empRes.data) {
      const tgId = String(emp.tgId || emp.telegram_id || '').trim();
      if (!tgId) continue;

      const username = String(emp.username || '').trim();
      const positionsStr = Array.isArray(emp.positions) ? emp.positions.join(',') : String(emp.lavozim || '');

      stmt.run(
        tgId,
        username,
        emp.canAdd ? 1 : 0,
        emp.isSuperAdmin ? 1 : 0,
        emp.isDirektor ? 1 : 0,
        emp.isAdmin ? 1 : 0,
        emp.canViewAll ? 1 : 0,
        emp.canEdit ? 1 : 0,
        emp.canDelete ? 1 : 0,
        emp.canExport ? 1 : 0,
        emp.canViewDash ? 1 : 0,
        String(emp.role || 'EMPLOYEE'),
        positionsStr,
        String(emp.group || ''),
        emp.isSardor ? 1 : 0
      );
      count++;
    }
    console.log(`   ✅ ${count} ta hodim ma'lumotlari va ruxsatlari saqlandi.`);
  }

  console.log('\n🎉 BARCHA SOZLAMALAR VA XODIMLAR MUVAFFAQIYATLI KO\'CHIRILDI!');
  console.log('ℹ️ Asosiy moliya yozuvlari va buyurtmalarga tegilmadi.');
}

run().catch(console.error);
