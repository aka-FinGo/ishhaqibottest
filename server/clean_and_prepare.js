// ============================================================
// CLEAN_AND_PREPARE.JS
// Creates a full backup and safely cleans all test data
// (records, orders, logs) while preserving SuperAdmin,
// positions, workflow_steps, and global settings.
// Run: node server/clean_and_prepare.js
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { db } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'ishhaqi.db');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function cleanAndPrepare() {
  console.log('🛡️ 1. BAZANI TO\'LIQ ZAXIRALASH...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `ishhaqi_pre_clean_${timestamp}.db`);

  if (fs.existsSync(DB_PATH)) {
    try {
      await db.backup(backupPath);
      console.log(`   ✅ Zaxira muvaffaqiyatli saqlandi: ${backupPath}`);
      executeCleanup();
    } catch (err) {
      console.error('   ❌ Zaxiralashda xatolik:', err);
      process.exit(1);
    }
  } else {
    console.log('   ⚠️ Baza fayli topilmadi, tozalashga o\'tiladi.');
    executeCleanup();
  }
}

function executeCleanup() {
  console.log('\n🧹 2. TEST MA\'LUMOTLARINI TOZALASH...');

  const superAdminId = String(process.env.SUPER_ADMIN_ID || '2112012311');

  db.exec('BEGIN TRANSACTION;');

  try {
    // Clean financial records
    const recDeleted = db.prepare('DELETE FROM records').run().changes;
    console.log(`   • ${recDeleted} ta test moliyaviy amallari (records) o'chirildi.`);

    // Clean kvadratlar orders
    const kvDeleted = db.prepare('DELETE FROM kvadratlar').run().changes;
    console.log(`   • ${kvDeleted} ta test kvadrat buyurtmalari o'chirildi.`);

    // Clean tracking, approvals, logs
    db.prepare('DELETE FROM pending_approvals').run();
    db.prepare('DELETE FROM tracked_messages').run();
    db.prepare('DELETE FROM error_logs').run();
    db.prepare('DELETE FROM rate_limit').run();
    console.log('   • Tasdiqlashlar, xabarlar kuzatuvi va xatoliklar jurnali tozalandi.');

    // Reset autoincrement sequences
    db.exec(`
      DELETE FROM sqlite_sequence 
      WHERE name IN ('records', 'kvadratlar', 'pending_approvals', 'tracked_messages', 'error_logs');
    `);
    console.log('   • ID hisoblagichlari (AUTOINCREMENT) 1 ga qaytarildi.');

    // Ensure SuperAdmin exists
    const adminCheck = db.prepare('SELECT telegram_id FROM employees WHERE telegram_id = ?').get(superAdminId);
    if (!adminCheck) {
      db.prepare(`
        INSERT INTO employees (
          telegram_id, username, can_add, super_admin, direktor, admin,
          can_view_all, can_edit, can_delete, can_export, can_view_dash, role, lavozim
        ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'SUPER_ADMIN', 'Bosh Admin')
      `).run(superAdminId, process.env.SUPER_ADMIN_NAME || 'iRealBy_3D');
      console.log(`   • SuperAdmin (${superAdminId}) profil sifatida mustahkamlandi.`);
    }

    db.exec('COMMIT;');
    console.log('   ✅ Tranzaksiya muvaffaqiyatli yakunlandi.');

    // Reclaim disk space
    db.exec('VACUUM;');
    console.log('   • Baza siqildi (VACUUM bajarildi).');

    console.log('\n✨ BAZA TEST MA\'LUMOTLARDAN TO\'LIQ TOZALANDI VA HAQIQIY MA\'LUMOTLARNI YUKLASHGA TAYYOR!');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ Tozalashda xatolik yuz berdi, o\'zgarishlar bekor qilindi:', err);
    process.exit(1);
  }
}

cleanAndPrepare();
