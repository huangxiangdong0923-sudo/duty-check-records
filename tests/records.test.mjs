import test from 'node:test';
import assert from 'node:assert/strict';
import { classCountForGrade, validateDraft, createRecord, updateRecord } from '../js/records.js';

const baseDraft = {
  date: '2026-09-17',
  grade: 3,
  classNo: 1,
  locationType: 'seat',
  row: 3,
  seat: 4,
  studentName: '',
  slot: 'morning',
  reasonCode: 'floor-garbage-am',
  points: 1,
  note: '',
};

test('grade class counts follow the school range', () => {
  assert.equal(classCountForGrade(3), 18);
  assert.equal(classCountForGrade(4), 23);
});

test('valid seat draft passes validation', () => {
  assert.equal(validateDraft(baseDraft).valid, true);
});

test('other reason requires a note', () => {
  const result = validateDraft({ ...baseDraft, reasonCode: 'other', note: '' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('其他情况必须填写备注'));
});

test('createRecord applies defaults and timestamps', () => {
  const record = createRecord(baseDraft, {
    now: () => '2026-09-17T01:00:00.000Z',
    idFactory: () => 'record-1',
  });
  assert.equal(record.id, 'record-1');
  assert.equal(record.points, 1);
  assert.equal(record.reasonLabel, '地面有比拳头大的垃圾、水杯或绳子');
  assert.equal(record.createdAt, '2026-09-17T01:00:00.000Z');
});

test('updateRecord refreshes updatedAt', () => {
  const record = createRecord(baseDraft, {
    now: () => '2026-09-17T01:00:00.000Z',
    idFactory: () => 'record-1',
  });
  const updated = updateRecord(record, { note: '已核实' }, '2026-09-17T02:00:00.000Z');
  assert.equal(updated.note, '已核实');
  assert.equal(updated.updatedAt, '2026-09-17T02:00:00.000Z');
});
