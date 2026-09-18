// ============================================================
// server/test_import_endpoint.js — TDD Suite for Google Sheets Import
// Tests: Auth protection, SuperAdmin execution, automatic backup creation, data integrity
// Run: node server/test_import_endpoint.js
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3019; // Dedicated test port
process.env.PORT = String(PORT);
process.env.REQUIRE_TELEGRAM_AUTH = 'false'; // For test runner
process.env.SUPER_ADMIN_ID = '2112012311';

const app = require('./app');
const { db } = require('./db');

let server;

function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TDD: GOOGLE SHEETS IMPORT & DATA SAFETY TEST SUITE');
  console.log('====================================================\n');

  await new Promise(res => { server = app.listen(PORT, res); });
  console.log(`✅ Test server running on port ${PORT}\n`);

  let passed = 0;
  let failed = 0;

  try {
    // ----------------------------------------------------
    // TEST 1: Xavfsizlik — Begona foydalanuvchi rad etilishi kerak
    // ----------------------------------------------------
    console.log('▶️ TEST 1: Begona / oddiy xodim admin_import_from_sheets ni chaqirganda bloklanishi:');
    const res1 = await makeRequest({
      action: 'admin_import_from_sheets',
      telegramId: '999999999',
      initData: ''
    });

    if (!res1.success && res1.error && res1.error.includes('SuperAdmin')) {
      console.log('   ✅ PASS: Begona so\'rov to\'g\'ri bloklandi:', res1.error);
      passed++;
    } else {
      console.error('   ❌ FAIL: So\'rov bloklanmadi:', res1);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 2: SuperAdmin chaqiruvi — Muvaffaqiyatli import
    // ----------------------------------------------------
    console.log('\n▶️ TEST 2: SuperAdmin (2112012311) tomonidan import muvaffaqiyatli bajarilishi:');
    const res2 = await makeRequest({
      action: 'admin_import_from_sheets',
      telegramId: '2112012311',
      initData: ''
    });

    if (res2.success && res2.stats && res2.stats.employees > 0) {
      console.log('   ✅ PASS: Import muvaffaqiyatli yakunlandi!');
      console.log(`      • Xodimlar: ${res2.stats.employees}`);
      console.log(`      • Amallar: ${res2.stats.records}`);
      console.log(`      • Kvadratlar: ${res2.stats.kvadratlar}`);
      console.log(`      • Jami UZS: ${res2.stats.totalUZS.toLocaleString()}`);
      console.log(`      • Jami m²: ${res2.stats.totalM2}`);
      passed++;
    } else {
      console.error('   ❌ FAIL: SuperAdmin import amalga oshmadi:', res2);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 3: Avtomatik Zaxira faylining mavjudligi va butunligi
    // ----------------------------------------------------
    console.log('\n▶️ TEST 3: Import oldidan avtomatik zaxira nusxasi yaratilganini tekshirish:');
    const backupsDir = path.join(__dirname, '..', 'data', 'backups');
    const backupFiles = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter(f => f.startsWith('ishhaqi_pre_import_')) : [];
    
    if (backupFiles.length > 0) {
      const latestBackup = backupFiles[backupFiles.length - 1];
      const stats = fs.statSync(path.join(backupsDir, latestBackup));
      if (stats.size > 1000) {
        console.log(`   ✅ PASS: Avtomatik zaxira nusxasi topildi: ${latestBackup} (${stats.size} bayt)`);
        passed++;
      } else {
        console.error(`   ❌ FAIL: Zaxira fayli bo'sh: ${stats.size} bayt`);
        failed++;
      }
    } else {
      console.error('   ❌ FAIL: data/backups/ ichida zaxira fayli topilmadi!');
      failed++;
    }

    // ----------------------------------------------------
    // TEST 4: SQLite bazasidagi jadvallar butunligi
    // ----------------------------------------------------
    console.log('\n▶️ TEST 4: SQLite bazasi jadvallarining haqiqiy holatini tekshirish:');
    const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get().c;
    const recCount = db.prepare('SELECT COUNT(*) as c FROM records WHERE is_deleted=0').get().c;
    const kvCount = db.prepare('SELECT COUNT(*) as c FROM kvadratlar WHERE is_deleted=0').get().c;

    if (empCount >= 20 && recCount >= 100 && kvCount >= 100) {
      console.log(`   ✅ PASS: Baza jadvallari to'liq va butun (Xodimlar: ${empCount}, Amallar: ${recCount}, Kvadratlar: ${kvCount})`);
      passed++;
    } else {
      console.error('   ❌ FAIL: Bazadagi ma\'lumotlar kutilganidan kam!');
      failed++;
    }

  } catch (err) {
    console.error('🚨 TEST RUNNER XATOLIK:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n====================================================');
    console.log(`🏁 NATIJA: ${passed} TA PASS, ${failed} TA FAIL`);
    console.log('====================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
