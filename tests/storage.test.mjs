import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords, saveRecords, createBackup, importBackup } from '../js/storage.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const record = {
  id: 'r1', campus: 'east', module: 'daily', date: '2026-09-17', grade: 3, classNo: 1,
  locationType: 'seat', row: 3, seat: 4, studentName: '', studentNos: [],
  slot: 'morning', reasonCode: 'floor-garbage-am',
  reasonLabel: '地面有比拳头大的垃圾、水杯或绳子', points: 1, note: '',
  createdAt: '2026-09-17T01:00:00.000Z', updatedAt: '2026-09-17T01:00:00.000Z',
};

test('saveRecords and loadRecords round-trip', () => {
  const storage = memoryStorage();
  saveRecords([record], storage);
  assert.deepEqual(loadRecords(storage), [record]);
});

test('backup round-trip keeps schema and records', () => {
  const backup = createBackup([record], '2026-09-17T02:00:00.000Z');
  const text = JSON.stringify(backup);
  const result = importBackup(text, []);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.records, [record]);
});

test('merge import skips duplicate ids', () => {
  const result = importBackup(JSON.stringify(createBackup([record])), [record]);
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 1);
});

test('invalid backup throws', () => {
  assert.throws(() => importBackup('{"schemaVersion":2,"records":[]}', []), /备份文件格式不正确/);
});
