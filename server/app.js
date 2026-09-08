// ============================================================
// APP.JS — Main Express Server
// Serves frontend from public/ and API routes
// ============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3010;

// ── Static frontend ───────────────────────────────────────────
const ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR, { dotfiles: 'ignore' }));

// ── Raw body parser ───────────────────────────────────────────
// Mirrors GAS behaviour: no Content-Type header required
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    if (data) {
      try   { req.body = JSON.parse(data); }
      catch { req.body = {}; }
    } else {
      req.body = {};
    }
    next();
  });
});

// ── CORS — allow GitHub Pages + Telegram WebApp ───────────────
app.use(cors({ origin: '*' }));

// ── Health check (GET /api) ───────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'API ishlayapti ✅', version: '2.0.0-sqlite' });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api',     require('./routes/api'));
app.use('/webhook', require('./routes/webhook'));

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[Server xatosi]', err);
  res.json({ success: false, error: err.message || 'Server ichki xatosi' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Ishhaqibot Server port ${PORT} da ishlayapti`);
  console.log(`   http://localhost:${PORT}`);
});

module.exports = app;
