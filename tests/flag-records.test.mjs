import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord, validateDraft, createRecord, parseStudentNos, defaultPointsFor, findInvalidStudentNos } from '../js/records.js';
import { loadRecords, STORAGE_KEY } from '../js/storage.js';

const baseFlagDraft = {
  module: 'flag',
  date: '2026-09-21',
  grade: 2,
  classNo: 4,
  locationType: 'studentNo',
  studentNos: '3 7 12',
  slot: 'flag',
  reasonCode: 'flag-scarf',
  points: 3,
  note: '',
};

test('student numbers accept every common separator', () => {
  assert.deepEqual(parseStudentNos('3 7 12'), ['3', '7', '12']);
  assert.deepEqual(parseStudentNos('3、7、12'), ['3', '7', '12']);
  assert.deepEqual(parseStudentNos('3,7,12'), ['3', '7', '12']);
  assert.deepEqual(parseStudentNos('3，7；12'), ['3', '7', '12']);
  assert.deepEqual(parseStudentNos(['3', '7']), ['3', '7']);
});

test('student numbers are de-duplicated and sorted numerically', () => {
  assert.deepEqual(parseStudentNos('12 3 3 100 07'), ['3', '7', '12', '100']);
});

test('invalid student numbers are reported', () => {
  assert.deepEqual(findInvalidStudentNos('3 abc 0 1234 -5'), ['abc', '0', '1234', '-5']);
  assert.deepEqual(parseStudentNos('3 abc 12'), ['3', '12']);
});

test('default points follow how many students were recorded', () => {
  assert.equal(defaultPointsFor('3 7 12'), 3);
  assert.equal(defaultPointsFor(''), 1);
});

test('flag draft saves with student numbers', () => {
  const record = createRecord(baseFlagDraft, {
    now: () => '2026-09-21T01:00:00.000Z',
    idFactory: () => 'flag-1',
  });
  assert.equal(record.module, 'flag');
  assert.deepEqual(record.studentNos, ['3', '7', '12']);
  assert.equal(record.reasonLabel, '未佩戴红领巾');
  assert.equal(record.points, 3);
});

test('flag draft with empty student numbers is a class level record', () => {
  const result = validateDraft({ ...baseFlagDraft, studentNos: '', points: 1 });
  assert.equal(result.valid, true);
});

test('flag draft rejects broken student numbers', () => {
  const result = validateDraft({ ...baseFlagDraft, studentNos: '3 abc' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('学号必须是 1-3 位数字')));
});

test('flag draft rejects more than twenty student numbers', () => {
  const many = Array.from({ length: 21 }, (_, index) => index + 1).join(' ');
  const result = validateDraft({ ...baseFlagDraft, studentNos: many });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('一次最多登记 20 个学号')));
});

test('flag draft rejects daily reasons and the other reason without a note', () => {
  assert.equal(validateDraft({ ...baseFlagDraft, reasonCode: 'floor-garbage-am' }).valid, false);
  const other = validateDraft({ ...baseFlagDraft, reasonCode: 'flag-other', note: '' });
  assert.equal(other.valid, false);
  assert.ok(other.errors.includes('其他情况必须填写备注'));
});

test('normalizeRecord keeps old daily records readable', () => {
  const record = normalizeRecord({
    id: 'old-1',
    date: '2026-09-17',
    grade: 3,
    classNo: 1,
    locationType: 'seat',
    row: 3,
    seat: 4,
    slot: 'morning',
    reasonCode: 'floor-garbage-am',
    points: 1,
  });
  assert.equal(record.module, 'daily');
  assert.deepEqual(record.studentNos, []);
  assert.equal(record.campus, 'east');
});

test('南校区 draft accepts grade 5 and rejects grade 4', () => {
  const southDraft = { ...baseFlagDraft, campus: 'south', grade: 5, classNo: 3, studentNos: '1 2', points: 2 };
  assert.equal(validateDraft(southDraft).valid, true);
  assert.equal(validateDraft({ ...southDraft, grade: 4 }).valid, false);
  assert.equal(validateDraft({ ...southDraft, grade: 5, classNo: 99 }).valid, false);
});

test('南校区 record keeps its campus', () => {
  const record = createRecord({ ...baseFlagDraft, campus: 'south', grade: 6, classNo: 2 }, {
    now: () => '2026-09-21T01:00:00.000Z',
    idFactory: () => 'south-1',
  });
  assert.equal(record.campus, 'south');
  assert.equal(record.grade, 6);
});

test('records saved by the previous version still load', () => {
  const store = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
  store.value = JSON.stringify([{ id: 'old-1', date: '2026-09-17', grade: 3, classNo: 1, locationType: 'seat', row: 3, seat: 4, slot: 'morning', reasonCode: 'floor-garbage-am', points: 1 }]);
  const records = loadRecords(store);
  assert.equal(records.length, 1);
  assert.equal(records[0].module, 'daily');
  assert.equal(STORAGE_KEY, 'duty-deduction-records-v1');
});

test('flag records round trip through storage', () => {
  const store = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
  const record = createRecord(baseFlagDraft, { now: () => '2026-09-21T01:00:00.000Z', idFactory: () => 'flag-1' });
  store.setItem(STORAGE_KEY, JSON.stringify([record]));
  const [loaded] = loadRecords(store);
  assert.equal(loaded.module, 'flag');
  assert.deepEqual(loaded.studentNos, ['3', '7', '12']);
});
