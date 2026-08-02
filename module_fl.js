// ============================================================
// module_fl.js — Native Integrated Module Logic (No Iframe)
// ============================================================
const MODULE_API = 'https://script.google.com/macros/s/AKfycbxlNd85TBCBhMXUx-dWQ3dfGqLvIK-njvwXE0Nltt07My5uFvIQh90R_VZLL34ZjZacLQ/exec';

let PWD = '', allModules = [], editing = null, activeFilter = 'all';
let selFiles = { pdf: null, video: null };
let currentFilter = 'all';

function initModuleFl() {
  const apiDisplay = document.getElementById('api-display');
  if (apiDisplay) {
    apiDisplay.textContent = 'script.google.com › ' + MODULE_API.split('/s/')[1].slice(0, 20) + '…';
  }

  // Setup drag & drop
  ['pdf','video'].forEach(t => {
    const d = document.getElementById(t+'-drop');
    if (!d) return;
    d.addEventListener('dragover',  e => { e.preventDefault(); d.classList.add('drag'); });
    d.addEventListener('dragleave', () => d.classList.remove('drag'));
    d.addEventListener('drop', e => {
      e.preventDefault(); d.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) { selFiles[t] = f; document.getElementById(t+'-fname').textContent = '📎 ' + f.name; }
    });
  });
}

// AUTH
async function doLogin() {
  const passEl = document.getElementById('inp-pass');
  if (!passEl) return;
  const pass = passEl.value.trim();
  const errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  if (!pass) { showErr('Parol kiriting'); return; }

  const btn = document.getElementById('login-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Ulanmoqda...';
  }
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
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';
  if (btn) { btn.disabled = false; btn.innerHTML = 'Kirish'; }
  setConn(true);
  loadModules();
}

function showErr(m) {
  const el = document.getElementById('login-err');
  if (el) { el.textContent = '❌ ' + m; el.style.display = 'block'; }
}

function logout() {
  localStorage.removeItem('cx_pw');
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appScreen) appScreen.style.display = 'none';
}

function setConn(ok) {
  const el = document.getElementById('conn');
  if (!el) return;
  el.className = 'conn-dot ' + (ok ? 'ok' : 'err');
  const lbl = el.querySelector('.lbl');
  if (lbl) lbl.textContent = ok ? 'ulangan' : 'xato';
}

// API
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

// MODULES
async function loadModules() {
  showSkeletons();
  try {
    const d = await apiGet({ action:'modules' });
    if (d.error) { toast(d.error,'err'); setConn(false); return; }
    allModules = Array.isArray(d) ? d : [];
    updateStats();
    filterModules();
    setConn(true);
  } catch(e) { toast(e.message,'err'); setConn(false); }
}

function showSkeletons() {
  const grid = g('mod-grid');
  if (grid) grid.innerHTML = Array(6).fill('<div class="skeleton"></div>').join('');
}

function updateStats() {
  const n = allModules.length;
  const tgPdf   = allModules.filter(m => m.tgPdfId).length;
  const tgVideo = allModules.filter(m => m.tgVideoId).length;
  const furTotal = allModules.reduce((s,m) =>
    s + Object.values(m.furnituralar||{}).reduce((a,v) => a+v.length, 0), 0);

  const pct = v => n > 0 ? Math.round(v/n*100)+'%' : '0%';
  if (g('s-total')) g('s-total').textContent  = n;
  if (g('s-pdf')) g('s-pdf').textContent    = tgPdf;
  if (g('s-video')) g('s-video').textContent  = tgVideo;
  if (g('s-fur')) g('s-fur').textContent    = furTotal;
  if (g('sb-pdf')) g('sb-pdf').style.width   = pct(tgPdf);
  if (g('sb-video')) g('sb-video').style.width = pct(tgVideo);
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  filterModules();
}

function filterModules() {
  const searchInp = g('search');
  const q = searchInp ? searchInp.value.toLowerCase() : '';
  const sortSel = g('sort-sel');
  const sort = sortSel ? sortSel.value : 'art';
  let list = [...allModules];

  if (currentFilter === 'tg')    list = list.filter(m => m.tgPdfId || m.tgVideoId);
  if (currentFilter === 'nopdf') list = list.filter(m => !m.tgPdfId && !m.pdfUrl);
  if (currentFilter === 'novid') list = list.filter(m => !m.tgVideoId && !m.videoUrl);

  if (q) list = list.filter(m =>
    m.artikul.toLowerCase().includes(q) ||
    (m.nomi||'').toLowerCase().includes(q)
  );

  if (sort==='art')   list.sort((a,b) => a.artikul.localeCompare(b.artikul));
  if (sort==='art-d') list.sort((a,b) => b.artikul.localeCompare(a.artikul));
  if (sort==='nom')   list.sort((a,b) => (a.nomi||'').localeCompare(b.nomi||''));
  if (sort==='fur')   list.sort((a,b) => furCount(b) - furCount(a));

  renderGrid(list);
}

function furCount(m) {
  return Object.values(m.furnituralar||{}).reduce((s,v) => s+v.length, 0);
}

function renderGrid(list) {
  const grid = g('mod-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="text-align:center;padding:40px;color:var(--mf-text3)">
      <div style="font-size:36px;margin-bottom:8px">📦</div>
      <p>Modullar topilmadi</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map((m, i) => {
    const driveId = m.pdfUrl?.match(/[-\w]{25,}/)?.[0];
    const hasTgPdf   = !!m.tgPdfId;
    const hasTgVideo = !!m.tgVideoId;
    const hasDrivePdf = !!m.pdfUrl && !hasTgPdf;
    const hasDriveVid = !!m.videoUrl && !hasTgVideo;
    const fc = furCount(m);

    const thumb = driveId
      ? `<img src="https://lh3.googleusercontent.com/d/${driveId}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div style="display:none;width:100%;height:140px;align-items:center;justify-content:center;font-size:28px">📄</div>`
      : `<div style="display:flex;width:100%;height:100px;align-items:center;justify-content:center;font-size:28px;background:var(--mf-bg3);border-radius:8px">📦</div>`;

    return `<div class="mod-card" onclick="openModal('${esc(m.artikul)}')">
      <div class="thumb">${thumb}</div>
      <div class="body" style="margin-top:8px">
        <div class="art" style="font-weight:700;color:var(--mf-amber)">${esc(m.artikul)}</div>
        <div class="nom" style="font-size:13px;color:var(--mf-text2)">${esc(m.nomi||'—')}</div>
      </div>
      <div class="footer" style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--mf-text3)">
        <span>🔧 ${fc} furnitura</span>
        <span>✏️ Tahrirlash</span>
      </div>
    </div>`;
  }).join('');
}

// UPLOADS
function fileSelected(inp, type) {
  const f = inp.files[0]; if (!f) return;
  selFiles[type] = f;
  g(type+'-fname').textContent = f.name + ' (' + (f.size/1024/1024).toFixed(1) + ' MB)';
}

async function uploadFile(type) {
  const f = selFiles[type];
  if (!f) { toast('Avval fayl tanlang','warn'); return; }
  if (f.size > 50*1024*1024) { toast('50MB dan katta fayl qabul qilinmaydi','err'); return; }

  const prog = g(type+'-prog');
  const bar  = g(type+'-bar');
  const stat = g(type+'-stat');

  if (prog) prog.style.display = 'block';
  if (bar) bar.style.width = '10%';
  if (stat) { stat.textContent = 'Base64 ga o\'girish...'; stat.style.color = 'var(--mf-text3)'; }

  try {
    const b64 = await toBase64(f);
    if (bar) bar.style.width = '40%';
    if (stat) stat.textContent = 'Telegram\'ga yuklanyapti...';

    const r = await apiPost({
      action: 'upload_file',
      fileBase64: b64.split(',')[1],
      fileName: f.name,
      mimeType: f.type || 'application/octet-stream',
      fileType: type,
    });
    if (bar) bar.style.width = '100%';

    if (r.ok && r.file_id) {
      if (stat) { stat.textContent = '✅ file_id: ' + r.file_id.slice(0,18) + '...'; stat.style.color = 'var(--mf-green)'; }
      g(type==='pdf' ? 'f-tgPdf' : 'f-tgVideo').value = r.file_id;
      toast((type==='pdf'?'PDF':'Video') + ' yuklandi ✅', 'ok');
      selFiles[type] = null;
      g(type+'-fname').textContent = '';
    } else {
      if (stat) { stat.textContent = '❌ ' + (r.error||'Xato'); stat.style.color = 'var(--mf-red)'; }
      toast(r.error||'Yuklash xatosi','err');
    }
  } catch(e) {
    if (stat) { stat.textContent = '❌ ' + e.message; stat.style.color = 'var(--mf-red)'; }
    toast(e.message,'err');
  }
}

function toBase64(f) {
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Fayl o\'qilmadi'));
    r.readAsDataURL(f);
  });
}

// MODAL
function openModal(artikul=null) {
  editing = artikul;
  selFiles = {pdf:null,video:null};
  ['pdf','video'].forEach(t => {
    if (g(t+'-fname')) g(t+'-fname').textContent = '';
    if (g(t+'-prog')) g(t+'-prog').style.display = 'none';
    if (g(t+'-bar')) g(t+'-bar').style.width = '0';
    if (g(t+'-stat')) { g(t+'-stat').textContent = ''; g(t+'-stat').style.color = 'var(--mf-text3)'; }
  });

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
    setTimeout(()=> { if (g('f-art')) g('f-art').focus(); }, 100);
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
  if (!artikul) { toast('Artikul kiritilmagan!','err'); artEl.focus(); return; }

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
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saqlanmoqda...'; }

  try {
    const r = await apiPost({action:'save_module',module});
    if (r.ok) {
      toast(`"${artikul}" saqlandi ✅`,'ok');
      closeModal(); loadModules();
    } else toast(r.error||'Saqlashda xato','err');
  } catch(e) { toast(e.message,'err'); }
  finally { if(btn) { btn.disabled=false; btn.innerHTML='💾 Saqlash'; } }
}

async function delModule() {
  if (!editing) return;
  if (!confirm(`"${editing}" modulini o'chirishni tasdiqlaysizmi?`)) return;

  try {
    const r = await apiPost({action:'delete_module',artikul:editing});
    if (r.ok) { toast(`"${editing}" o'chirildi`,'ok'); closeModal(); loadModules(); }
    else toast(r.error,'err');
  } catch(e) { toast(e.message,'err'); }
}

function renderFurEditor(data) {
  const el = g('fur-editor');
  if (!el) return;
  el.innerHTML = '';
  const entries = Object.entries(data);
  if (entries.length === 0) {
    el.innerHTML = '<div class="fur-empty" id="fur-empty">Hali kategoriya yo\'q. "+ Kategoriya" tugmasini bosing.</div>';
  } else {
    entries.forEach(([k,v]) => addCat(k,v));
  }
  updateFurCnt();
}

function addCat(name='', items=[]) {
  const el  = g('fur-editor');
  if (!el) return;
  const emp = el.querySelector('.fur-empty');
  if (emp) emp.remove();

  const cid = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.className = 'fur-cat'; div.id = cid;
  div.style.marginBottom = '12px';
  div.innerHTML = `
    <div class="fur-cat-head" style="display:flex;gap:8px;margin-bottom:8px">
      <input value="${esc(name)}" placeholder="Kategoriya nomi..." class="cat-nm" style="flex:1;padding:6px;background:var(--mf-bg3);border:1px solid var(--mf-border);border-radius:4px;color:var(--mf-text)">
      <button class="btn btn-ghost btn-sm" onclick="addRow('${cid}')">+ Qo'shish</button>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${cid}').remove();updateFurCnt()">✕</button>
    </div>
    <div class="fur-items" id="i_${cid}"></div>`;
  el.appendChild(div);
  (items||[]).forEach(it => addRow(cid, it.nomi, it.ulchov, it.soni));
  if (!items.length) addRow(cid);
}

function addRow(cid, nomi='', ulchov='', soni='') {
  const c = g('i_'+cid); if (!c) return;
  const r = document.createElement('div'); r.className='fur-row';
  r.style.display = 'flex'; r.style.gap = '6px'; r.style.marginBottom = '6px';
  r.innerHTML = `
    <input value="${esc(nomi)}" placeholder="Nomi" style="flex:2;padding:6px;background:var(--mf-bg3);border:1px solid var(--mf-border);border-radius:4px;color:var(--mf-text)">
    <input value="${esc(ulchov)}" placeholder="O'lchov" style="flex:1;padding:6px;background:var(--mf-bg3);border:1px solid var(--mf-border);border-radius:4px;color:var(--mf-text)">
    <input value="${esc(soni)}" placeholder="Soni" style="width:60px;padding:6px;background:var(--mf-bg3);border:1px solid var(--mf-border);border-radius:4px;color:var(--mf-text)">
    <button class="btn-icon" style="font-size:12px" onclick="this.parentElement.remove();updateFurCnt()">✕</button>`;
  c.appendChild(r); updateFurCnt();
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

function updateFurCnt() {
  const n = document.querySelectorAll('.fur-row').length;
  if (g('fur-cnt')) g('fur-cnt').textContent = n ? n + ' ta' : '';
}

function toast(msg, type='ok') {
  const el = g('toast');
  if (!el) return;
  const t  = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span></span>${esc(msg)}`;
  el.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3200);
}

function g(id) { return document.getElementById(id); }
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  initModuleFl();
  const pw = localStorage.getItem('cx_pw');
  if (pw) {
    const inp = document.getElementById('inp-pass');
    if (inp) { inp.value = pw; doLogin(); }
  }
});
