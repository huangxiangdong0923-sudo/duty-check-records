import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClassLabel, summarize, getTotals } from '../js/summary.js';

const records = [
  { id: 'r1', date: '2026-09-17', grade: 3, classNo: 1, points: 1, createdAt: '2026-09-17T01:00:00.000Z' },
  { id: 'r2', date: '2026-09-17', grade: 3, classNo: 1, points: 2, createdAt: '2026-09-17T02:00:00.000Z' },
  { id: 'r3', date: '2026-09-17', grade: 4, classNo: 23, points: 1, createdAt: '2026-09-17T03:00:00.000Z' },
  { id: 'r4', date: '2026-09-16', grade: 3, classNo: 1, points: 1, createdAt: '2026-09-16T01:00:00.000Z' },
];

test('formatClassLabel uses Chinese grade names', () => {
  assert.equal(formatClassLabel(3, 1), '三年级1班');
  assert.equal(formatClassLabel(4, 23), '四年级23班');
});

test('summarize groups only the selected date', () => {
  const groups = summarize(records, '2026-09-17');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].classNo, 1);
  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups[0].totalPoints, 3);
});

test('getTotals counts classes and entries', () => {
  const totals = getTotals(summarize(records, '2026-09-17'));
  assert.deepEqual(totals, { totalPoints: 4, classCount: 2, entryCount: 3 });
});

test('empty day returns no groups and zero totals', () => {
  const groups = summarize(records, '2026-09-18');
  assert.deepEqual(groups, []);
  assert.deepEqual(getTotals(groups), { totalPoints: 0, classCount: 0, entryCount: 0 });
});
