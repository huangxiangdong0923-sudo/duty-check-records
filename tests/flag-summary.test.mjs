import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFlag, formatFlagItemText, formatStudentNoList, flagItemLocationText } from '../js/summary.js';

function flagRecord(id, overrides = {}) {
  return {
    id,
    module: 'flag',
    date: '2026-09-21',
    grade: 1,
    classNo: 2,
    locationType: 'studentNo',
    studentNos: [],
    reasonCode: 'flag-scarf',
    reasonLabel: '未佩戴红领巾',
    points: 1,
    createdAt: `2026-09-21T0${id.slice(1)}:00:00.000Z`,
    ...overrides,
  };
}

const records = [
  flagRecord('r1', { studentNos: ['3', '7', '12'], points: 3 }),
  flagRecord('r2', { studentNos: ['4'], points: 1 }),
  flagRecord('r3', { grade: 4, classNo: 23, reasonCode: 'flag-shoes', reasonLabel: '未穿黑鞋子', studentNos: ['9'], points: 1 }),
  flagRecord('r4', { grade: 2, classNo: 4, reasonCode: 'flag-late-stay', reasonLabel: '升旗仪式迟到或逗留在班级', studentNos: [], points: 1 }),
  { id: 'daily1', date: '2026-09-21', grade: 3, classNo: 1, points: 5, createdAt: '2026-09-21T09:00:00.000Z' },
  flagRecord('r5', { date: '2026-09-14', studentNos: ['1'], points: 1 }),
];

test('flag summary ignores daily records and other dates', () => {
  const { grounds, totals } = summarizeFlag(records, '2026-09-21');
  assert.equal(totals.entryCount, 4);
  assert.equal(totals.totalPoints, 6);
  assert.equal(totals.classCount, 3);
  assert.ok(!grounds.some((ground) => ground.classes.some((item) => item.classNo === 1 && item.grade === 3)));
});

test('flag summary puts JInlun before Yuetu', () => {
  const { grounds } = summarizeFlag(records, '2026-09-21');
  assert.deepEqual(grounds.map((ground) => ground.code), ['jinlun', 'yuetu']);
  assert.equal(grounds[0].label, '金轮操场');
  assert.equal(grounds[0].gradesLabel, '一、四年级');
  assert.equal(grounds[1].label, '玉兔操场');
});

test('flag summary merges the same reason inside one class and sorts student numbers', () => {
  const { grounds } = summarizeFlag(records, '2026-09-21');
  const grade1 = grounds[0].classes.find((item) => item.grade === 1);
  assert.equal(grade1.label, '一年级2班');
  assert.equal(grade1.items.length, 1);
  assert.deepEqual(grade1.items[0].studentNos, ['3', '4', '7', '12']);
  assert.equal(grade1.items[0].points, 4);
  assert.equal(flagItemLocationText(grade1.items[0]), '3、4、7、12 号');
  assert.equal(grade1.totalPoints, 4);
});

test('flag summary marks class level records', () => {
  const { grounds } = summarizeFlag(records, '2026-09-21');
  const grade2 = grounds[1].classes[0];
  assert.equal(grade2.label, '二年级4班');
  assert.equal(grade2.items[0].classLevel, true);
  assert.equal(formatFlagItemText(grade2.items[0]), '升旗仪式迟到或逗留在班级：整班（1分）');
});

test('flag summary mixes class level and student numbers in one line', () => {
  const mixed = [
    flagRecord('m1', { reasonCode: 'flag-uniform', reasonLabel: '未穿着规范校服', studentNos: ['5'], points: 1 }),
    flagRecord('m2', { reasonCode: 'flag-uniform', reasonLabel: '未穿着规范校服', studentNos: [], points: 1 }),
  ];
  const { grounds } = summarizeFlag(mixed, '2026-09-21');
  assert.equal(formatFlagItemText(grounds[0].classes[0].items[0]), '未穿着规范校服：5 号及整班（2分）');
});

test('playgrounds without deductions stay out of the summary', () => {
  const onlyGrade3 = [flagRecord('g3', { grade: 3, classNo: 5, studentNos: ['2'], points: 1 })];
  const { grounds } = summarizeFlag(onlyGrade3, '2026-09-21');
  assert.deepEqual(grounds.map((ground) => ground.code), ['yuetu']);
});

test('student number list formatting de-duplicates and sorts', () => {
  assert.equal(formatStudentNoList(['12', '3', '3', '07']), '3、7、12');
  assert.equal(formatStudentNoList([]), '');
});
