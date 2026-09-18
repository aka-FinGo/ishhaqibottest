// ============================================================
// test_api.js -- Local Integration Test Suite
// Run: node server/test_api.js
// Requires: Server running at localhost:3010
//           Set REQUIRE_TELEGRAM_AUTH=false in .env for local testing
// ============================================================

'use strict';

const http = require('http');

const HOST     = process.env.TEST_HOST || 'localhost';
const PORT     = Number(process.env.PORT) || 3010;
const API_PATH = '/api';

// Fake local telegram ID for tests (not a real user)
const TEST_TG_ID = 'TEST_LOCAL';

// Helper: POST request
function testRequest(action, extra = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, telegramId: TEST_TG_ID, ...extra });

    const options = {
      hostname: HOST,
      port: PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Test-Mode': 'true'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          reject(new Error('Invalid JSON response (status ' + res.statusCode + '): ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') {
        reject(new Error('Connection refused -- is the server running on port ' + PORT + '?'));
      } else {
        reject(e);
      }
    });

    req.setTimeout(8000, () => {
      req.destroy(new Error('Request timeout (8s)'));
    });

    req.write(body);
    req.end();
  });
}

// Health check (GET /api)
function healthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: API_PATH,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') {
        reject(new Error('Connection refused -- is the server running on port ' + PORT + '?'));
      } else {
        reject(e);
      }
    });
    req.setTimeout(5000, () => req.destroy(new Error('Timeout')));
    req.end();
  });
}

// Test runner
let passed = 0;
let failed = 0;
const results = [];

async function runTest(name, fn) {
  process.stdout.write('  ' + name + '... ');
  try {
    await fn();
    console.log('PASS');
    passed++;
    results.push({ name, ok: true });
  } catch (e) {
    console.log('FAIL -- ' + e.message);
    failed++;
    results.push({ name, ok: false, error: e.message });
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHasKey(obj, key) {
  if (!(key in obj)) throw new Error('Missing key: "' + key + '" in response');
}

// Test Suite
let spawnedServer = null;

async function runTests() {
  console.log('');
  console.log('Ishhaqibot API Test Suite');
  console.log('Target: http://' + HOST + ':' + PORT + API_PATH);
  console.log('-------------------------------------------------------');
  console.log('');

  // Auto-start server if not already running
  try {
    await healthCheck();
  } catch (e) {
    process.env.REQUIRE_TELEGRAM_AUTH = 'false';
    const app = require('./app');
    await new Promise(resolve => {
      spawnedServer = app.listen(PORT, resolve);
    });
    console.log('  [Auto-spawned in-process server on port ' + PORT + ']');
  }

  // Test 1: Health check
  await runTest('Test 1: Health check (GET /api)', async () => {
    const res = await healthCheck();
    assert(res.status === 200 || res.status === 404, 'Unexpected HTTP ' + res.status);
  });

  // Test 2: init action
  await runTest('Test 2: init -- user initialization', async () => {
    const res = await testRequest('init');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Response must be a JSON object');
    assertHasKey(res.body, 'success');
  });

  // Test 3: get_all action
  await runTest('Test 3: get_all -- all payment records', async () => {
    const res = await testRequest('get_all');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
    if (res.body.success) {
      assertHasKey(res.body, 'data');
      assert(Array.isArray(res.body.data), '"data" must be an array');
    }
  });

  // Test 4: get_hodimlar action
  await runTest('Test 4: get_hodimlar -- employee list', async () => {
    const res = await testRequest('get_hodimlar');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
    if (res.body.success) {
      assertHasKey(res.body, 'data');
      assert(Array.isArray(res.body.data), '"data" must be an array');
    }
  });

  // Test 5: get_positions action
  await runTest('Test 5: get_positions -- position list', async () => {
    const res = await testRequest('get_positions');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
    if (res.body.success) {
      assertHasKey(res.body, 'data');
      assert(Array.isArray(res.body.data), '"data" must be an array');
    }
  });

  // Test 6: get_workflow_config action
  await runTest('Test 6: get_workflow_config -- workflow steps', async () => {
    const res = await testRequest('get_workflow_config');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
    if (res.body.success) {
      assertHasKey(res.body, 'data');
      assert(Array.isArray(res.body.data), '"data" must be an array');
    }
  });

  // Test 7: get_global_settings action
  await runTest('Test 7: get_global_settings -- app settings', async () => {
    const res = await testRequest('get_global_settings');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
  });

  // Test 8: self_check action
  await runTest('Test 8: self_check -- user self info', async () => {
    const res = await testRequest('self_check');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(typeof res.body === 'object', 'Must be JSON object');
    assertHasKey(res.body, 'success');
  });

  // Test 9: admin_import_from_sheets (auth protection)
  await runTest('Test 9: admin_import_from_sheets -- auth check', async () => {
    // Calling with fake non-admin ID must fail
    const res = await testRequest('admin_import_from_sheets');
    assert(res.status === 200, 'HTTP ' + res.status);
    assert(res.body && res.body.success === false, 'Non-admin request must be rejected');
  });

  if (spawnedServer) {
    spawnedServer.close();
  }

  // Summary
  console.log('');
  console.log('-------------------------------------------------------');
  const total = passed + failed;
  if (failed === 0) {
    console.log('All ' + total + '/' + total + ' tests passed!');
  } else {
    console.log('Results: ' + passed + '/' + total + ' tests passed, ' + failed + ' failed');
    console.log('');
    console.log('Failed tests:');
    results.filter(r => !r.ok).forEach(r => {
      console.log('  FAIL: ' + r.name);
      console.log('     ' + r.error);
    });
  }
  console.log('-------------------------------------------------------');

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('\nFatal test error:', e.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('  1. Make sure the server is running: node server/app.js');
  console.error('  2. Set REQUIRE_TELEGRAM_AUTH=false in your .env file');
  console.error('  3. Check port: expected port ' + PORT);
  process.exit(1);
});