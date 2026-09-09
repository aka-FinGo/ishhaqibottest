// ============================================================
// EVENTS.JS — Realtime Server-Sent Events (SSE) Hub
// Enables live bidirectional sync for WebApp, GSheet Jadval,
// and Telegram Webhook notifications
// ============================================================
'use strict';

const clients = new Set();

/**
 * Handle incoming SSE connection (GET /api/events)
 */
function handleSSEConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  clients.add(res);
  console.log(`🔌 [SSE Connected] Client ulandi. Faol mijozlar: ${clients.size}`);

  // Initial connection handshake
  const welcomePayload = JSON.stringify({
    ok: true,
    time: Date.now(),
    clients: clients.size
  });
  res.write(`event: connected\ndata: ${welcomePayload}\n\n`);

  // Heartbeat keep-alive ping every 20s to prevent Nginx/proxy timeout
  const pingInterval = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
      clients.delete(res);
    }
  }, 20000);

  // Clean up on disconnect (res.on('close') fires when connection terminates)
  const cleanup = () => {
    clearInterval(pingInterval);
    clients.delete(res);
    console.log(`🔌 [SSE Disconnected] Client uzildi. Qolgan mijozlar: ${clients.size}`);
  };

  res.on('close', cleanup);
}

/**
 * Broadcast an update event to all connected clients
 * @param {string} table - 'records' | 'kvadratlar' | 'employees' | 'settings' | 'workflow' | 'positions'
 * @param {string} action - 'add' | 'edit' | 'delete' | 'status_change' | 'step_change' | etc.
 * @param {object} meta - Extra metadata (rowId, tgId, status, actor, etc.)
 */
function broadcast(table, action, meta = {}) {
  console.log(`📢 [SSE Broadcast] Table: ${table}, Action: ${action}, Faol mijozlar soni: ${clients.size}`);
  if (clients.size === 0) return;

  const payload = JSON.stringify({
    table: String(table || 'general'),
    action: String(action || 'update'),
    timestamp: Date.now(),
    ...meta
  });

  const sseMessage = `event: change\ndata: ${payload}\n\n`;

  for (const client of clients) {
    try {
      client.write(sseMessage);
    } catch (err) {
      clients.delete(client);
    }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = {
  handleSSEConnection,
  broadcast,
  getClientCount
};
