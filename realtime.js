/**
 * realtime.js — Aristokrat Ish Haqi Realtime Sinxronizatsiya Dvigateli
 * 
 * Server-Sent Events (SSE) + BroadcastChannel orqali:
 * WebApp, GSheet Jadval va Telegram bot o'rtasida 100% jonli sinxronlash!
 */
(function (global) {
  'use strict';

  const CHANNEL_NAME = 'ishhaqi_realtime_bus';
  let _evtSource = null;
  let _broadcastChannel = null;
  let _reconnectTimer = null;
  let _reconnectDelay = 1000;
  let _isConnected = false;

  const _listeners = {
    all: new Set(),
    records: new Set(),
    kvadratlar: new Set(),
    employees: new Set(),
    settings: new Set(),
    workflow: new Set(),
    positions: new Set()
  };

  const _statusListeners = new Set();

  // ── BroadcastChannel (Iframe & Tablararo 0ms aloqa) ─────────
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      _broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      _broadcastChannel.onmessage = (e) => {
        if (e.data && e.data.table) {
          _dispatchChange(e.data, 'broadcast_channel');
        }
      };
    } catch (e) {
      console.warn('[Realtime] BroadcastChannel ochilmadi:', e);
    }
  }

  // ── Iframe va Window postMessage aloqasi ─────────────────────
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ISHHAQI_REALTIME_EVENT' && e.data.payload) {
      _dispatchChange(e.data.payload, 'post_message');
    }
  });

  // ── SSE Ulanishi ───────────────────────────────────────────
  function connect() {
    if (_evtSource) {
      try { _evtSource.close(); } catch(e) {}
      _evtSource = null;
    }

    const sseUrl = '/api/events';

    try {
      _evtSource = new EventSource(sseUrl);

      _evtSource.addEventListener('connected', (e) => {
        _isConnected = true;
        _reconnectDelay = 1000;
        _notifyStatus(true);
        console.log('🟢 [Realtime] Serverga ulandi (SSE):', e.data);
      });

      _evtSource.addEventListener('change', (e) => {
        try {
          const payload = JSON.parse(e.data);
          _dispatchChange(payload, 'sse');

          // Iframe yoki boshqa oynalarga ham BroadcastChannel orqali uzatamiz
          if (_broadcastChannel) {
            try { _broadcastChannel.postMessage(payload); } catch(err) {}
          }
        } catch (err) {
          console.error('[Realtime] SSE parse xatosi:', err);
        }
      });

      _evtSource.onerror = () => {
        _isConnected = false;
        _notifyStatus(false);
        try { _evtSource.close(); } catch(e) {}
        _evtSource = null;

        // Qayta ulanish (exponential backoff)
        if (!_reconnectTimer) {
          _reconnectTimer = setTimeout(() => {
            _reconnectTimer = null;
            _reconnectDelay = Math.min(_reconnectDelay * 1.5, 10000);
            connect();
          }, _reconnectDelay);
        }
      };
    } catch (err) {
      console.warn('[Realtime] EventSource yaratishda xatolik:', err);
    }
  }

  // Internet paydo bo'lganda darhol qayta ulanish
  window.addEventListener('online', () => {
    _reconnectDelay = 1000;
    connect();
  });

  // ── Hodisalarni Tarqatish (Dispatch) ────────────────────────
  function _dispatchChange(payload, source) {
    const table = payload.table || 'general';
    const action = payload.action || 'update';

    console.log(`⚡ [Realtime Change] Table: ${table} | Action: ${action} | Manba: ${source}`, payload);

    // Global listenerlar
    _listeners.all.forEach(fn => {
      try { fn(payload); } catch(e) { console.error('[Realtime Listener Error]', e); }
    });

    // Jadval bo'yicha maxsus listenerlar
    if (_listeners[table]) {
      _listeners[table].forEach(fn => {
        try { fn(payload); } catch(e) { console.error('[Realtime Table Listener Error]', e); }
      });
    }

    // Window global CustomEvent
    try {
      window.dispatchEvent(new CustomEvent('ishhaqi:realtime', { detail: payload }));
      window.dispatchEvent(new CustomEvent(`ishhaqi:change:${table}`, { detail: payload }));
    } catch(e) {}
  }

  function _notifyStatus(connected) {
    _statusListeners.forEach(fn => {
      try { fn(connected); } catch(e) {}
    });
  }

  // ── Public API ──────────────────────────────────────────────
  const RealtimeSync = {
    /**
     * Jadval o'zgarishini tinglash
     * @param {string} table - 'records' | 'kvadratlar' | 'employees' | 'settings' | 'workflow'
     * @param {function} callback
     */
    on(table, callback) {
      if (typeof callback !== 'function') return;
      if (!_listeners[table]) _listeners[table] = new Set();
      _listeners[table].add(callback);
    },

    /**
     * Barcha o'zgarishlarni tinglash
     */
    onAll(callback) {
      if (typeof callback === 'function') {
        _listeners.all.add(callback);
      }
    },

    /**
     * Ulanish holati o'zgarganda xabardor bo'lish
     */
    onStatusChange(callback) {
      if (typeof callback === 'function') {
        _statusListeners.add(callback);
        callback(_isConnected);
      }
    },

    /**
     * Mahalliy o'zgarishni boshqa tab/iframelarga e'lon qilish
     */
    notifyLocalChange(table, action, meta = {}) {
      const payload = { table, action, timestamp: Date.now(), ...meta };
      _dispatchChange(payload, 'local_notify');
      if (_broadcastChannel) {
        try { _broadcastChannel.postMessage(payload); } catch(e) {}
      }
      // Ota oyna yoki farzand iframega yuborish
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'ISHHAQI_REALTIME_EVENT', payload }, '*');
        }
        const iframe = document.getElementById('adminSheetsIframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'ISHHAQI_REALTIME_EVENT', payload }, '*');
        }
      } catch(e) {}
    },

    /**
     * Qayta-qayta so'rov yubormaslik uchun debounce yordamchisi
     */
    debounce(func, wait = 300) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    },

    get isConnected() {
      return _isConnected;
    },

    connect
  };

  // Avtomatik ulanish
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', connect);
    } else {
      connect();
    }
  }

  global.RealtimeSync = RealtimeSync;

})(typeof window !== 'undefined' ? window : this);
