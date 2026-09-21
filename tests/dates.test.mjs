import test from 'node:test';
import assert from 'node:assert/strict';
import { lastMondayIso, formatChipDate, formatChipDateWithWeekday, toIsoDate, parseIsoDate } from '../js/dates.js';

test('lastMondayIso returns the same day when the date is a Monday', () => {
  // 2026-09-21 is a Monday.
  assert.equal(lastMondayIso('2026-09-21'), '2026-09-21');
});

test('lastMondayIso walks back from midweek', () => {
  assert.equal(lastMondayIso('2026-09-22'), '2026-09-21');
  assert.equal(lastMondayIso('2026-09-23'), '2026-09-21');
  assert.equal(lastMondayIso('2026-09-25'), '2026-09-21');
});

test('lastMondayIso walks back across a Sunday', () => {
  // 2026-09-27 is a Sunday, the Monday before is 2026-09-21.
  assert.equal(lastMondayIso('2026-09-27'), '2026-09-21');
});

test('lastMondayIso walks back across a month boundary', () => {
  // 2026-10-01 is a Thursday, the Monday before is 2026-09-28.
  assert.equal(lastMondayIso('2026-10-01'), '2026-09-28');
});

test('date helpers round trip local dates', () => {
  assert.equal(toIsoDate(new Date(2026, 8, 21)), '2026-09-21');
  assert.equal(toIsoDate(parseIsoDate('2026-09-21')), '2026-09-21');
});

test('formatChipDate prints a short Chinese date', () => {
  assert.equal(formatChipDate('2026-09-21'), '9月21日');
  assert.equal(formatChipDateWithWeekday('2026-09-21'), '9月21日 周一');
});
