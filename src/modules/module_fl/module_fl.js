// ============================================================
// module_fl.js — Native Integrated Module Logic
// User View (Bosh Sahifa) & Admin View (Modullar Admin Paneli)
// ============================================================
const MODULE_API = 'https://script.google.com/macros/s/AKfycbxlNd85TBCBhMXUx-dWQ3dfGqLvIK-njvwXE0Nltt07My5uFvIQh90R_VZLL34ZjZacLQ/exec';

let PWD = '', allModules = [], userModules = [];
let selFiles = { pdf: null, video: null };
let currentFilter = 'all';

// USER VIEW (Bosh Sahifa / Modul Katalogi)
async function initModuleFl() {
  await loadUserModules();
}

async function loadUserModules() {
  const grid = document.getElementById('userModuleGrid');
  if (grid) grid.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">⏳ Modullar yuklanmoqda...</div>';

  try {
    const r = await fetch(`${MODULE_API}?action=modules`);
    const d = await r.json();
    userModules = Array.isArray(d) ? d : [];
    renderUserModules(userModules);
  } catch (e) {
    console.error('Error loading user modules:', e);
    if (grid) grid.innerHTML = '<div style="color:var(--mf-red,#ef4444); font-size:13px;">❌ Modullarni yuklashda xatolik yuz berdi.</div>';
  }
}

function filterUserModules() {
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
      ? `<a href="${esc(m.pdfUrl)}" target="_blank" class="btn-secondary" style="font-size:11px; padding:4px 8px; text-decoration:none;">📄 Chizma PDF</a>`
      : '';
    const videoBtn = m.videoUrl 
      ? `<a href="${esc(m.videoUrl)}" target="_blank" class="btn-secondary" style="font-size:11px; padding:4px 8px; text-decoration:none;">🎬 Video</a>`
      : '';

    return `<div class="card" style="margin:0; padding:14px; background:var(--surface); border:1px solid var(--border); border-radius:12px;">
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
        <button class="btn-secondary" onclick="toggleFurView('${esc(m.artikul)}')" style="font-size:11px; padding:4px 8px;">🔧 Furnituralar</button>
      </div>

      <div id="fur_list_${esc(m.artikul)}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid var(--border); font-size:12px;">
        ${renderFurListHTML(m.furnituralar)}
      </div>
    </div>`;
  }).join('');
}

function toggleFurView(artikul) {
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
      <strong style="color:var(--cyan-neon); font-size:11px;">${esc(catName)}:</strong>
      <ul style="margin:4px 0 0 16px; padding:0; list-style-type:disc;">
        ${items.map(it => `<li>${esc(it.nomi)} ${it.ulchov ? `(${esc(it.ulchov)})` : ''} — <b>${esc(it.soni)} ta</b></li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// ADMIN VIEW (Modullar Admin Paneli)
async function doLogin() {
  const passEl = document.getElementById('inp-pass');
  if (!passEl) return;
  const pass = passEl.value.trim();
  const errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  if (!pass) { showErr('Parol kiriting'); return; }

  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Ulanmoqda...'; }
  PWD = pass;

  try {
    const d = await apiGet({ action: 'ping' });
    if (d.error) throw new Error(d.error);
  } catch(e) {
    showErr(e.message);
    if (btn) { btn.disabled = false; btn.innerHTML = 'Kirish'; }
    PWD = ''; return;
  }

  localStorage.setItem('cx_pw', pass);
  const loginScreen = document.getElementById('admin-login-screen');
  const appScreen = document.getElementById('admin-app');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';
  if (btn) { btn.disabled = false; btn.innerHTML = 'Kirish'; }
  loadModules();
}

function showErr(m) {
  const el = document.getElementById('login-err');
  if (el) { el.textContent = '❌ ' + m; el.style.display = 'block'; }
}

function logout() {
  localStorage.removeItem('cx_pw');
  const loginScreen = document.getElementById('admin-login-screen');
  const appScreen = document.getElementById('admin-app');
  if (loginScreen) loginScreen.style.display = 'block';
  if (appScreen) appScreen.style.display = 'none';
}

async function apiGet(p) {
  const r = await fetch(`${MODULE_API}?${new URLSearchParams({password:PWD,...p})}`);
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t.slice(0,120)); }
}

async function apiPost(b) {
  const r = await fetch(MODULE_API, { method:'POST', body:JSON.stringify({...b,password:PWD}) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t.slice(0,120)); }
}

async function loadModules() {
  try {
    const d = await apiGet({ action:'modules' });
    if (d.error) { toast(d.error,'err'); return; }
    allModules = Array.isArray(d) ? d : [];
    updateStats();
    filterModules();
  } catch(e) { toast(e.message,'err'); }
}

function updateStats() {
  const n = allModules.length;
  const tgPdf   = allModules.filter(m => m.tgPdfId).length;
  const tgVideo = allModules.filter(m => m.tgVideoId).length;
  const furTotal = allModules.reduce((s,m) =>
    s + Object.values(m.furnituralar||{}).reduce((a,v) => a+v.length, 0), 0);

  if (g('s-total')) g('s-total').textContent  = n;
  if (g('s-pdf')) g('s-pdf').textContent    = tgPdf;
  if (g('s-video')) g('s-video').textContent  = tgVideo;
  if (g('s-fur')) g('s-fur').textContent    = furTotal;
}

function filterModules() {
  const q = (g('search')?.value || '').toLowerCase();
  let list = [...allModules];
  if (q) list = list.filter(m => m.artikul.toLowerCase().includes(q) || (m.nomi||'').toLowerCase().includes(q));
  renderAdminGrid(list);
}

function renderAdminGrid(list) {
  const grid = g('mod-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Modullar topilmadi</div>';
    return;
  }

  grid.innerHTML = list.map(m => `
    <div class="card" style="margin:0; padding:10px; background:var(--surface); border:1px solid var(--border);" onclick="openModal('${esc(m.artikul)}')">
      <div style="font-weight:700; color:var(--cyan-neon);">${esc(m.artikul)}</div>
      <div style="font-size:12px; color:var(--text-muted);">${esc(m.nomi||'—')}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">✏️ Tahrirlash</div>
    </div>
  `).join('');
}

function openModal(artikul=null) {
  editing = artikul;
  if (artikul) {
    const m = allModules.find(x => x.artikul===artikul);
    if (!m) return;
    if (g('modal-title')) g('modal-title').textContent = 'Modulni tahrirlash';
    if (g('modal-sub')) g('modal-sub').textContent   = m.artikul;
    if (g('btn-del')) g('btn-del').style.display   = 'inline-flex';
    sv('f-art',    m.artikul);
    sv('f-nom',    m.nomi      || '');
    sv('f-tgPdf',  m.tgPdfId  || '');
    sv('f-tgVideo',m.tgVideoId|| '');
    sv('f-pdfUrl', m.pdfUrl   || '');
    sv('f-videoUrl',m.videoUrl|| '');
    renderFurEditor(m.furnituralar||{});
  } else {
    if (g('modal-title')) g('modal-title').textContent = 'Yangi modul';
    if (g('modal-sub')) g('modal-sub').textContent   = 'Yangi yozuv qo\'shish';
    if (g('btn-del')) g('btn-del').style.display   = 'none';
    ['f-art','f-nom','f-tgPdf','f-tgVideo','f-pdfUrl','f-videoUrl'].forEach(id=>sv(id,''));
    renderFurEditor({});
  }

  const modal = g('mod-modal');
  if (modal) modal.classList.add('active');
}

function closeModal() {
  const modal = g('mod-modal');
  if (modal) modal.classList.remove('active');
}

function sv(id,v){ if(g(id)) g(id).value=v; }

async function saveModule() {
  const artEl = g('f-art');
  if (!artEl) return;
  const artikul = artEl.value.trim();
  if (!artikul) { toast('Artikul kiritilmagan!','err'); return; }

  const module = {
    artikul,
    nomi:       g('f-nom')?.value.trim()||'',
    tgPdfId:    g('f-tgPdf')?.value.trim()||'',
    tgVideoId:  g('f-tgVideo')?.value.trim()||'',
    pdfUrl:     g('f-pdfUrl')?.value.trim()||'',
    videoUrl:   g('f-videoUrl')?.value.trim()||'',
    furnituralar: collectFur(),
  };

  const btn = g('btn-save');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Saqlanmoqda...'; }

  try {
    const r = await apiPost({action:'save_module',module});
    if (r.ok) {
      toast(`"${artikul}" saqlandi ✅`,'ok');
      closeModal(); loadModules(); loadUserModules();
    } else toast(r.error||'Saqlashda xato','err');
  } catch(e) { toast(e.message,'err'); }
  finally { if(btn) { btn.disabled=false; btn.innerHTML='💾 Saqlash'; } }
}

async function delModule() {
  if (!editing) return;
  if (!confirm(`"${editing}" modulini o'chirishni tasdiqlaysizmi?`)) return;

  try {
    const r = await apiPost({action:'delete_module',artikul:editing});
    if (r.ok) { toast(`"${editing}" o'chirildi`,'ok'); closeModal(); loadModules(); loadUserModules(); }
    else toast(r.error,'err');
  } catch(e) { toast(e.message,'err'); }
}

function renderFurEditor(data) {
  const el = g('fur-editor');
  if (!el) return;
  el.innerHTML = '';
  const entries = Object.entries(data);
  if (entries.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Hali kategoriya yo\'q. "+ Kategoriya" tugmasini bosing.</div>';
  } else {
    entries.forEach(([k,v]) => addCat(k,v));
  }
}

function addCat(name='', items=[]) {
  const el  = g('fur-editor');
  if (!el) return;

  const cid = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.className = 'fur-cat'; div.id = cid;
  div.style.marginBottom = '12px';
  div.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input value="${esc(name)}" placeholder="Kategoriya..." class="cat-nm" style="flex:1;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text)">
      <button class="btn-secondary" onclick="addRow('${cid}')">+ Qo'shish</button>
      <button class="btn-danger" onclick="document.getElementById('${cid}').remove()">✕</button>
    </div>
    <div id="i_${cid}"></div>`;
  el.appendChild(div);
  (items||[]).forEach(it => addRow(cid, it.nomi, it.ulchov, it.soni));
  if (!items.length) addRow(cid);
}

function addRow(cid, nomi='', ulchov='', soni='') {
  const c = g('i_'+cid); if (!c) return;
  const r = document.createElement('div');
  r.className = 'fur-row';
  r.style.cssText = 'display:flex; gap:6px; margin-bottom:6px;';
  r.innerHTML = `
    <input value="${esc(nomi)}" placeholder="Nomi" style="flex:2;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text)">
    <input value="${esc(ulchov)}" placeholder="O'lchov" style="flex:1;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text)">
    <input value="${esc(soni)}" placeholder="Soni" style="width:60px;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text)">
    <button class="btn-secondary" style="font-size:12px; padding:4px 8px;" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(r);
}

function collectFur() {
  const res = {};
  document.querySelectorAll('.fur-cat').forEach(cat => {
    const nm = cat.querySelector('.cat-nm')?.value.trim(); if (!nm) return;
    const items = [];
    cat.querySelectorAll('.fur-row').forEach(row => {
      const inp = row.querySelectorAll('input');
      const n = inp[0]?.value.trim();
      if (n) items.push({nomi:n, ulchov:inp[1]?.value.trim()||'', soni:inp[2]?.value.trim()||''});
    });
    res[nm] = items;
  });
  return res;
}

function toast(msg, type='ok') {
  if (typeof showToastMsg === 'function') {
    showToastMsg(msg, type === 'err');
  } else {
    alert(msg);
  }
}

function g(id) { return document.getElementById(id); }
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  initModuleFl();
});
