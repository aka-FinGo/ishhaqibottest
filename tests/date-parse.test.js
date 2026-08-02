import assert from 'assert';

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

import {
  parseDateParts,
  getDateMonthYear,
  getTodayDdMmYyyy
} from '../src/core/config.js';

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

  const m1 = getDateMonthYear('02/03/2026');
  assert.strictEqual(m1.month, 3);
  assert.strictEqual(m1.year, 2026);

  const todayStr = getTodayDdMmYyyy();
  assert(/^\d{2}\/\d{2}\/\d{4}$/.test(todayStr), 'today must be DD/MM/YYYY');

  console.log('date-parse tests passed');
}

run();
