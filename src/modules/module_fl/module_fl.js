// ============================================================
// src/modules/module_fl/module_fl.js — Native Module Integration
// No black screens, no CORS errors, 0% iframe
// ============================================================
const MODULE_API = 'https://script.google.com/macros/s/AKfycbxlNd85TBCBhMXUx-dWQ3dfGqLvIK-njvwXE0Nltt07My5uFvIQh90R_VZLL34ZjZacLQ/exec';

let PWD = localStorage.getItem('cx_pw') || '';
let allModules = [], userModules = [];

// Entry point when clicking "Modul" tab
export async function initModuleFl() {
  const savedPw = localStorage.getItem('cx_pw');
  if (savedPw) {
    PWD = savedPw;
    const loginCard = document.getElementById('moduleFlLoginCard');
    const appArea = document.getElementById('moduleFlAppArea');
    if (loginCard) loginCard.style.display = 'none';
    if (appArea) appArea.style.display = 'block';
    await loadUserModules();
  } else {
    const loginCard = document.getElementById('moduleFlLoginCard');
    const appArea = document.getElementById('moduleFlAppArea');
    if (loginCard) loginCard.style.display = 'block';
    if (appArea) appArea.style.display = 'none';
  }
}

export async function initModuleFlWithPass() {
  const inp = document.getElementById('moduleFlPassInput');
  const err = document.getElementById('moduleFlPassErr');
  if (err) err.style.display = 'none';
  
  const pass = (inp?.value || '').trim();
  if (!pass) {
    if (err) { err.textContent = '❌ Parolni kiriting'; err.style.display = 'block'; }
    return;
  }

  PWD = pass;
  try {
    const r = await fetch(`${MODULE_API}?action=ping&password=${encodeURIComponent(PWD)}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);

    localStorage.setItem('cx_pw', PWD);
    const loginCard = document.getElementById('moduleFlLoginCard');
    const appArea = document.getElementById('moduleFlAppArea');
    if (loginCard) loginCard.style.display = 'none';
    if (appArea) appArea.style.display = 'block';
    await loadUserModules();
  } catch (e) {
    if (err) { err.textContent = '❌ ' + (e.message || 'Noto\'g\'ri parol'); err.style.display = 'block'; }
  }
}

async function loadUserModules() {
  const grid = document.getElementById('userModuleGrid');
  if (grid) grid.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">⏳ Modullar yuklanmoqda...</div>';

  try {
    const r = await fetch(`${MODULE_API}?action=modules&password=${encodeURIComponent(PWD)}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);

    userModules = Array.isArray(d) ? d : [];
    renderUserModules(userModules);
  } catch (e) {
    console.error('Error loading user modules:', e);
    if (grid) grid.innerHTML = `<div style="color:#ef4444; font-size:13px; padding:15px; background:rgba(239,68,68,0.1); border-radius:10px;">
      ❌ Modullarni yuklashda xatolik: ${esc(e.message)}
    </div>`;
  }
}

export function filterUserModules() {
  const q = (document.getElementById('userModuleSearch')?.value || '').toLowerCase();
  let list = [...userModules];
  if (q) {
    list = list.filter(m => 
      (m.artikul || '').toLowerCase().includes(q) ||
      (m.nomi || '').toLowerCase().includes(q)
    );
  }
  renderUserModules(list);
}

function renderUserModules(list) {
  const grid = document.getElementById('userModuleGrid');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">
      📦 Hech qanday modul topilmadi.
    </div>`;
    return;
  }

  grid.innerHTML = list.map(m => {
    const furCount = Object.values(m.furnituralar || {}).reduce((s, v) => s + v.length, 0);
    const pdfBtn = m.pdfUrl 
      ? `<a href="${esc(m.pdfUrl)}" target="_blank" class="btn-secondary" style="font-size:11px; padding:4px 10px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">📄 Chizma PDF</a>`
      : (m.tgPdfId ? `<span class="btn-secondary" style="font-size:11px; padding:4px 8px; opacity:0.8;">📄 TG PDF ID</span>` : '');
      
    const videoBtn = m.videoUrl 
      ? `<a href="${esc(m.videoUrl)}" target="_blank" class="btn-secondary" style="font-size:11px; padding:4px 10px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">🎬 Video</a>`
      : (m.tgVideoId ? `<span class="btn-secondary" style="font-size:11px; padding:4px 8px; opacity:0.8;">🎬 TG Video ID</span>` : '');

    return `<div class="card" style="margin:0; padding:14px; background:var(--surface,#16181d); border:1px solid var(--border,#262930); border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:16px; font-weight:700; color:var(--cyan-neon, #00f2ff);">${esc(m.artikul)}</div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">${esc(m.nomi || '—')}</div>
        </div>
        <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:rgba(0,242,255,0.1); color:var(--cyan-neon,#00f2ff);">🔧 ${furCount} ta</span>
      </div>

      <div style="display:flex; gap:6px; margin-top:12px; flex-wrap:wrap;">
        ${pdfBtn}
        ${videoBtn}
        <button class="btn-secondary" onclick="toggleFurView('${esc(m.artikul)}')" style="font-size:11px; padding:4px 10px;">🔧 Furnituralar</button>
      </div>

      <div id="fur_list_${esc(m.artikul)}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid var(--border,#262930); font-size:12px;">
        ${renderFurListHTML(m.furnituralar)}
      </div>
    </div>`;
  }).join('');
}

export function toggleFurView(artikul) {
  const el = document.getElementById(`fur_list_${artikul}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderFurListHTML(furnituralar) {
  if (!furnituralar || Object.keys(furnituralar).length === 0) {
    return '<div style="color:var(--text-muted);">Furnituralar ro\'yxati kiritilmagan.</div>';
  }

  return Object.entries(furnituralar).map(([catName, items]) => `
    <div style="margin-bottom:8px;">
      <strong style="color:var(--cyan-neon,#00f2ff); font-size:11px;">${esc(catName)}:</strong>
      <ul style="margin:4px 0 0 16px; padding:0; list-style-type:disc;">
        ${items.map(it => `<li>${esc(it.nomi)} ${it.ulchov ? `(${esc(it.ulchov)})` : ''} — <b>${esc(it.soni)} ta</b></li>`).join('')}
      </ul>
    </div>
  `).join('');
}

function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.initModuleFl = initModuleFl;
window.initModuleFlWithPass = initModuleFlWithPass;
window.filterUserModules = filterUserModules;
window.toggleFurView = toggleFurView;
