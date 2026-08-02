const assert = require('assert');

global.window = {
  Telegram: {
    WebApp: {
      expand() {},
      setHeaderColor() {},
      initDataUnsafe: null,
      initData: ''
    }
  }
};

global.document = {
  querySelector() {
    return { content: 'test' };
  }
};

const {
  parseDateParts,
  getDateMonthYear,
  getTodayDdMmYyyy
} = require('../config.js');

function run() {
  const d1 = parseDateParts('02/03/2026');
  assert(d1, 'DD/MM/YYYY must parse');
  assert.strictEqual(d1.day, '02');
  assert.strictEqual(d1.month, '03');
  assert.strictEqual(d1.year, '2026');
  assert.strictEqual(d1.iso, '2026-03-02');

  const d2 = parseDateParts('2026-03-02');
  assert(d2, 'ISO date must parse');
  assert.strictEqual(d2.display, '02/03/2026');

  const d3 = parseDateParts('2.3.2026');
  assert(d3, 'DD.MM.YYYY must parse');
  assert.strictEqual(d3.display, '02/03/2026');

  const d4 = parseDateParts('31/02/2026');
  assert.strictEqual(d4, null, 'Invalid date must be rejected');

  const m = getDateMonthYear('02/03/2026');
  assert(m, 'Month/year parse should work');
  assert.strictEqual(m.month, '03');
  assert.strictEqual(m.year, '2026');

  const today = getTodayDdMmYyyy(new Date('2026-04-03T00:00:00Z'));
  assert.strictEqual(today.display, '03/04/2026');
  assert.strictEqual(today.iso, '2026-04-03');
}

run();
console.log('date-parse tests passed');
