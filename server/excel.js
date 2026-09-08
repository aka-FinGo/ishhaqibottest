// ============================================================
// server/excel.js — Excel Export using ExcelJS
// Port of export.js (frontend XLSX logic) to Node.js backend
// ============================================================

'use strict';

let ExcelJS;
try { ExcelJS = require('exceljs'); } catch (e) { ExcelJS = null; }

const tg = require('./telegram');

/**
 * generateExcelBuffer — creates xlsx buffer matching the frontend export format
 * Mirrors the style from public/export.js converted to ExcelJS
 */
async function generateExcelBuffer(records, employeeName) {
  if (!ExcelJS) throw new Error('exceljs modul topilmadi. npm install exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FinGo Backend';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Hisobot');

  // Column widths matching export.js
  sheet.columns = [
    { key: 'date',      width: 13 },
    { key: 'name',      width: 22 },
    { key: 'comment',   width: 35 },
    { key: 'amountUZS', width: 16 },
    { key: 'amountUSD', width: 14 },
    { key: 'rate',      width: 14 },
  ];

  // Header row
  const headerRow = sheet.addRow(['Sana', 'Xodim', 'Izoh', 'Summa (UZS)', 'Summa (USD)', 'Kurs (UZS)']);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE65100' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  });

  let totalUZS = 0;

  records.forEach((r, idx) => {
    const uzs = Number(r.amountUZS) || 0;
    const usd = Number(r.amountUSD) || 0;
    const rate = Number(r.rate) || 0;
    const isUsd = usd > 0;
    const kurs = isUsd ? (rate > 0 ? rate : (uzs > 0 && usd > 0 ? Math.round(uzs / usd) : 0)) : 0;
    totalUZS += uzs;

    const rowFill = idx % 2 === 0
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F0' } };

    const dataRow = sheet.addRow([
      r.date || '',
      r.name || employeeName || '',
      r.comment || '',
      uzs,
      usd,
      isUsd && kurs > 0 ? kurs : '-'
    ]);

    dataRow.eachCell((cell, colNumber) => {
      cell.fill = rowFill;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        right: { style: 'thin', color: { argb: 'FFEEEEEE' } }
      };
      // Numeric columns right-aligned with number format
      if (colNumber === 4 || colNumber === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      }
      if (colNumber === 6 && typeof cell.value === 'number') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      }
    });
  });

  // Total row
  const totalRow = sheet.addRow(['', '', 'Jami:', totalUZS, '', '']);
  totalRow.getCell(3).font = { bold: true, name: 'Arial', size: 11 };
  totalRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(4).font = { bold: true, name: 'Arial', size: 11 };
  totalRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
  totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(4).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * sendExcelReport — generates excel and sends via telegram bot
 */
async function sendExcelReport(tgId, records, employeeName) {
  if (!records || records.length === 0) {
    return { success: false, error: "Eksport uchun ma'lumot yo'q!" };
  }

  const fileName = 'Hisobot_' + (employeeName || 'Xodim') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';

  try {
    const buffer = await generateExcelBuffer(records, employeeName);
    const result = await tg.sendExcelToUser(tgId, buffer, fileName);
    return { success: !!result.ok, error: result.description };
  } catch (err) {
    console.error('[sendExcelReport]', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { generateExcelBuffer, sendExcelReport };
