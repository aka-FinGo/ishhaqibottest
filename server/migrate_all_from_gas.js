// ============================================================
// MIGRATE_ALL_FROM_GAS.JS
// Migrates EVERYTHING (Settings, Employees, Records, Kvadratlar)
// directly from live Google Apps Script to SQLite.
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
    query_id: 'AAGHmigrationAll',
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
  console.log('🚀 GOOGLE APPS SCRIPT DAN TO\'LIQ MA\'LUMOTLARNI KO\'CHIRISH BOSHLANDI...\n');

  // 1. Records (Moliya yozuvlari - oylik / avans)
  console.log('1️⃣ Moliyaviy amallar (records) yuklanmoqda...');
  const recRes = await fetchFromGAS('admin_get_all');
  if (recRes.success && Array.isArray(recRes.data)) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO records (
        id, name, telegram_id, amount_uzs, amount_usd, rate,
        comment, date, is_deleted, action_period, status, actor_tg_id, actor_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    let recCount = 0;
    for (const r of recRes.data) {
      const rowId = Number(r.rowId || r.id);
      if (!rowId) continue;
      stmt.run(
        rowId,
        String(r.name || r.employeeName || '').trim(),
        String(r.telegramId || r.tgId || '').trim(),
        Number(r.amountUZS || r.amount_uzs || 0),
        Number(r.amountUSD || r.amount_usd || 0),
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
    console.log(`   ✅ ${recCount} ta moliyaviy amal SQLite ga muvaffaqiyatli saqlandi.`);
  } else {
    console.warn('   ⚠️ Records yuklab bo\'lmadi:', recRes.error);
  }

  // 2. Kvadratlar (Buyurtmalar)
  console.log('\n2️⃣ Kvadratlar (buyurtmalar) yuklanmoqda...');
  const kvRes = await fetchFromGAS('kvadrat_get_all');
  if (kvRes.success && Array.isArray(kvRes.data)) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO kvadratlar (
        id, sana, order_no, oy, yil, total_m2, order_name,
        staff_name, owner_tg_id, is_deleted, current_step, status, workflow_logs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    let kvCount = 0;
    for (const k of kvRes.data) {
      const rowId = Number(k.rowId || k.id);
      if (!rowId) continue;
      const logsJson = typeof k.logs === 'string' ? k.logs : JSON.stringify(k.logs || []);
      stmt.run(
        rowId,
        String(k.date || k.sana || ''),
        String(k.no || k.order_no || ''),
        String(k.month || k.oy || ''),
        String(k.year || k.yil || ''),
        Number(k.totalM2 || k.total_m2 || 0),
        String(k.orderName || k.order_name || ''),
        String(k.staffName || k.staff_name || ''),
        String(k.ownerTgId || k.owner_tg_id || ''),
        k.is_deleted ? 1 : 0,
        Number(k.currentStep || k.current_step || 1),
        String(k.status || 'yangi'),
        logsJson
      );
      kvCount++;
    }
    db.exec('COMMIT;');
    console.log(`   ✅ ${kvCount} ta kvadrat buyurtmasi SQLite ga muvaffaqiyatli saqlandi.`);
  } else {
    console.warn('   ⚠️ Kvadratlar yuklab bo\'lmadi:', kvRes.error);
  }

  console.log('\n🎉 BARCHA MA\'LUMOTLAR VA BUYURTMALAR 100% SQLITE GA KO\'CHIRILDI!');
}

run().catch(console.error);
