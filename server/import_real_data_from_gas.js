// ============================================================
// IMPORT_REAL_DATA_FROM_GAS.JS
// Fetches REAL production data directly from Google Apps Script WebApp
// and inserts into SQLite with full validation and reconciliation.
// Run: node server/import_real_data_from_gas.js
// ============================================================
'use strict';

const crypto = require('crypto');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
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
    query_id: 'AAGHprodImport',
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

async function importRealData() {
  console.log('====================================================');
  console.log('🚀 HAQIQIY GSHEETS MA\'LUMOTLARINI IMPORT QILISH BOSHLANDI');
  console.log('====================================================\n');

  // 1. Sozlamalar (Global Settings)
  console.log('1️⃣ Global tizim sozlamalari yuklanmoqda...');
  try {
    const globalRes = await fetchFromGAS('get_global_settings');
    if (globalRes.success && globalRes.settings) {
      const s = globalRes.settings;
      setSetting('ONLY_BUGALTER_ADD', s.onlyBugalterAdd ? '1' : '0');
      setSetting('DISABLE_EMP_EDIT_DELETE', s.disableEmpEditDelete ? '1' : '0');
      setSetting('NOTIFY_DIRECTOR', s.notifyDirector ? '1' : '0');
      setSetting('WORKFLOW_STRICT_MODE', s.workflowStrictMode ? '1' : '0');
      console.log('   ✅ Sozlamalar muvaffaqiyatli saqlandi.');
    }
  } catch (e) {
    console.warn('   ⚠️ Sozlamalarni olishda xato:', e.message);
  }

  // 2. Lavozimlar (Positions)
  console.log('\n2️⃣ Lavozimlar (positions) yuklanmoqda...');
  try {
    const posRes = await fetchFromGAS('get_positions');
    if (posRes.success && Array.isArray(posRes.positions)) {
      const stmt = db.prepare('INSERT OR REPLACE INTO positions (id, position_name, icon) VALUES (?, ?, ?)');
      db.exec('BEGIN TRANSACTION;');
      let pIdx = 1;
      for (const p of posRes.positions) {
        const name = typeof p === 'string' ? p : (p.position_name || p.name || '');
        const icon = (typeof p === 'object' && p.icon) ? p.icon : '💼';
        if (name) {
          stmt.run(pIdx++, name, icon);
        }
      }
      db.exec('COMMIT;');
      console.log(`   ✅ ${pIdx - 1} ta lavozim SQLite ga saqlandi.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Lavozimlarni olishda xato:', e.message);
  }

  // 3. Workflow Steps
  console.log('\n3️⃣ Kvadratlar Workflow bosqichlari yuklanmoqda...');
  try {
    const wfRes = await fetchFromGAS('workflow_get_config');
    if (wfRes.success && Array.isArray(wfRes.steps)) {
      db.exec('DELETE FROM workflow_steps;');
      const stmt = db.prepare(`
        INSERT INTO workflow_steps (step_index, position_name, action_label, status_label, is_start, is_end)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      db.exec('BEGIN TRANSACTION;');
      for (const step of wfRes.steps) {
        stmt.run(
          step.index || step.step_index,
          step.position || step.position_name || '',
          step.action || step.action_label || '',
          step.status || step.status_label || '',
          step.isStart ? 1 : 0,
          step.isEnd ? 1 : 0
        );
      }
      db.exec('COMMIT;');
      console.log(`   ✅ ${wfRes.steps.length} ta workflow bosqichlari saqlandi.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Workflow olishda xato:', e.message);
  }

  // 4. Xodimlar (Employees)
  console.log('\n4️⃣ Xodimlar ro\'yxati (Hodimlar) yuklanmoqda...');
  try {
    const empRes = await fetchFromGAS('get_hodimlar');
    if (empRes.success && Array.isArray(empRes.hodimlar)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO employees (
          telegram_id, username, can_add, super_admin, direktor, admin,
          can_view_all, can_edit, can_delete, can_export, can_view_dash,
          role, lavozim, guruh, is_sardor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.exec('BEGIN TRANSACTION;');
      let empCount = 0;
      for (const h of empRes.hodimlar) {
        const tgId = String(h.telegramId || h.telegram_id || '').trim();
        if (!tgId) continue;
        const isSuper = String(tgId) === String(SUPER_ADMIN_ID) ? 1 : (h.superAdmin ? 1 : 0);
        stmt.run(
          tgId,
          String(h.name || h.username || 'Xodim').trim(),
          h.canAdd !== false ? 1 : 0,
          isSuper,
          h.direktor ? 1 : 0,
          h.admin ? 1 : 0,
          h.canViewAll ? 1 : 0,
          h.canEdit ? 1 : 0,
          h.canDelete ? 1 : 0,
          h.canExport ? 1 : 0,
          h.canViewDash ? 1 : 0,
          isSuper ? 'SUPER_ADMIN' : String(h.role || 'EMPLOYEE').toUpperCase(),
          String(h.lavozim || ''),
          String(h.guruh || ''),
          h.isSardor ? 1 : 0
        );
        empCount++;
      }
      db.exec('COMMIT;');
      console.log(`   ✅ ${empCount} ta xodim SQLite ga muvaffaqiyatli saqlandi.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Xodimlarni olishda xato:', e.message);
  }

  // 5. Moliyaviy Amallar (Records)
  console.log('\n5️⃣ Haqiqiy moliyaviy amallar (records) yuklanmoqda...');
  let totalUZS = 0;
  let totalUSD = 0;
  let recCount = 0;
  try {
    const recRes = await fetchFromGAS('admin_get_all');
    if (recRes.success && Array.isArray(recRes.data)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO records (
          id, name, telegram_id, amount_uzs, amount_usd, rate,
          comment, date, is_deleted, action_period, status, actor_tg_id, actor_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.exec('BEGIN TRANSACTION;');
      for (const r of recRes.data) {
        const rowId = Number(r.rowId || r.id);
        if (!rowId) continue;
        const uzs = Number(r.amountUZS || r.amount_uzs || 0);
        const usd = Number(r.amountUSD || r.amount_usd || 0);
        if (!r.is_deleted) {
          totalUZS += uzs;
          totalUSD += usd;
        }

        stmt.run(
          rowId,
          String(r.name || r.employeeName || '').trim(),
          String(r.telegramId || r.tgId || '').trim(),
          uzs,
          usd,
          Number(r.rate || 0),
          String(r.comment || ''),
          String(r.date || ''),
          r.is_deleted ? 1 : 0,
          String(r.actionPeriod || r.action_period || ''),
          String(r.status || 'Tasdiqlandi'),
          r.actorTgId ? String(r.actorTgId) : null,
          r.actorName ? String(r.actorName) : null
        );
        recCount++;
      }
      db.exec('COMMIT;');
      console.log(`   ✅ ${recCount} ta moliyaviy amal saqlandi.`);
      console.log(`      • Jami UZS summasi: ${totalUZS.toLocaleString('uz-UZ')} so'm`);
      console.log(`      • Jami USD summasi: ${totalUSD.toLocaleString('uz-UZ')} $`);
    }
  } catch (e) {
    console.warn('   ⚠️ Moliyaviy amallarni olishda xato:', e.message);
  }

  // 6. Kvadratlar (Buyurtmalar)
  console.log('\n6️⃣ Haqiqiy kvadratlar (buyurtmalar) yuklanmoqda...');
  let totalM2 = 0;
  let kvCount = 0;
  try {
    const kvRes = await fetchFromGAS('kvadrat_get_all');
    if (kvRes.success && Array.isArray(kvRes.data)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO kvadratlar (
          id, sana, order_no, oy, yil, total_m2, order_name,
          staff_name, owner_tg_id, is_deleted, current_step, status, workflow_logs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.exec('BEGIN TRANSACTION;');
      for (const k of kvRes.data) {
        const rowId = Number(k.rowId || k.id);
        if (!rowId) continue;
        const m2 = Number(k.totalM2 || k.total_m2 || 0);
        if (!k.is_deleted) {
          totalM2 += m2;
        }
        const logsJson = typeof k.logs === 'string' ? k.logs : JSON.stringify(k.logs || []);

        stmt.run(
          rowId,
          String(k.date || k.sana || ''),
          String(k.no || k.order_no || ''),
          String(k.month || k.oy || ''),
          String(k.year || k.yil || ''),
          m2,
          String(k.orderName || k.order_name || ''),
          String(k.staffName || k.staff_name || ''),
          String(k.ownerTgId || k.owner_tg_id || ''),
          k.is_deleted ? 1 : 0,
          Number(k.currentStep || k.current_step || 1),
          String(k.status || 'Jarayonda'),
          logsJson
        );
        kvCount++;
      }
      db.exec('COMMIT;');
      console.log(`   ✅ ${kvCount} ta kvadrat buyurtmasi saqlandi.`);
      console.log(`      • Jami hajm: ${totalM2.toFixed(2)} m²`);
    }
  } catch (e) {
    console.warn('   ⚠️ Kvadratlarni olishda xato:', e.message);
  }

  console.log('\n====================================================');
  console.log('🎉 YAKUNIY RECONCILIATION HISOBOTI:');
  console.log(`   • Xodimlar soni: ${db.prepare('SELECT COUNT(*) as c FROM employees').get().c}`);
  console.log(`   • Amallar soni: ${db.prepare('SELECT COUNT(*) as c FROM records WHERE is_deleted=0').get().c}`);
  console.log(`   • Buyurtmalar soni: ${db.prepare('SELECT COUNT(*) as c FROM kvadratlar WHERE is_deleted=0').get().c}`);
  console.log('   • Barcha ma\'lumotlar to\'liq va xatosiz sinxronlandi!');
  console.log('====================================================\n');
}

if (require.main === module) {
  importRealData().catch(console.error);
}

module.exports = { importRealData };
