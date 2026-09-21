import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImagePlan } from '../js/image-export.js';
import { buildFlagImagePlan } from '../js/image-export.js';

const records = [
  { id: 'r1', date: '2026-09-17', grade: 3, classNo: 1, points: 1,
    locationType: 'seat', row: 3, seat: 4, studentName: '',
    reasonLabel: '地面有垃圾', createdAt: '2026-09-17T01:00:00.000Z' },
  { id: 'r2', date: '2026-09-17', grade: 3, classNo: 1, points: 2,
    locationType: 'student', row: null, seat: null, studentName: '张三',
    reasonLabel: '桌面乱涂乱画严重', createdAt: '2026-09-17T02:00:00.000Z' },
];

test('empty day has no image plan', () => {
  assert.equal(buildImagePlan(records, '2026-09-18'), null);
});

test('image plan contains title, class subtotal, entries, and total', () => {
  const plan = buildImagePlan(records, '2026-09-17');
  const texts = plan.rows.map((row) => row.text);
  assert.equal(plan.width, 1080);
  assert.ok(plan.height > 300);
  assert.ok(texts.includes('9月17日值日检查扣分情况'));
  assert.ok(texts.includes('三年级1班（3分）'));
  assert.ok(texts.some((text) => text.includes('第3排第4个') && text.includes('地面有垃圾')));
  assert.ok(texts.some((text) => text.includes('张三') && text.includes('桌面乱涂乱画严重')));
  assert.ok(texts.includes('当天合计：3分 · 1个班级'));
});

const flagRecords = [
  {
    id: 'f1', module: 'flag', date: '2026-09-21', grade: 1, classNo: 2, points: 3,
    locationType: 'studentNo', studentNos: ['3', '7', '12'],
    reasonCode: 'flag-scarf', reasonLabel: '未佩戴红领巾', createdAt: '2026-09-21T01:00:00.000Z',
  },
  {
    id: 'f2', module: 'flag', date: '2026-09-21', grade: 2, classNo: 4, points: 1,
    locationType: 'studentNo', studentNos: [],
    reasonCode: 'flag-late-stay', reasonLabel: '升旗仪式迟到或逗留在班级', createdAt: '2026-09-21T02:00:00.000Z',
  },
];

test('flag image plan has no output on a day without deductions', () => {
  assert.equal(buildFlagImagePlan(flagRecords, '2026-09-22'), null);
});

test('flag image plan lists both playgrounds with class details', () => {
  const plan = buildFlagImagePlan(flagRecords, '2026-09-21');
  const texts = plan.rows.map((row) => row.text);
  assert.equal(plan.width, 1080);
  assert.ok(texts.includes('9月21日升旗检查扣分情况'));
  assert.ok(texts.includes('金轮操场（一、四年级）'));
  assert.ok(texts.includes('玉兔操场（二、三年级）'));
  assert.ok(texts.includes('一年级2班（3分）'));
  assert.ok(texts.includes('未佩戴红领巾：3、7、12 号（3分）'));
  assert.ok(texts.includes('二年级4班（1分）'));
  assert.ok(texts.includes('升旗仪式迟到或逗留在班级：整班（1分）'));
  assert.ok(texts.includes('当天合计：4分 · 2个班级'));
});

test('flag image plan skips playgrounds without deductions', () => {
  const onlyGrade3 = [{
    id: 'f3', module: 'flag', date: '2026-09-21', grade: 3, classNo: 5, points: 1,
    locationType: 'studentNo', studentNos: ['2'],
    reasonCode: 'flag-shoes', reasonLabel: '未穿黑鞋子', createdAt: '2026-09-21T03:00:00.000Z',
  }];
  const texts = buildFlagImagePlan(onlyGrade3, '2026-09-21').rows.map((row) => row.text);
  assert.ok(texts.includes('玉兔操场（二、三年级）'));
  assert.ok(!texts.some((text) => text.startsWith('金轮操场')));
});

test('flag image plan keeps every row inside the canvas width', () => {
  const plan = buildFlagImagePlan(flagRecords, '2026-09-21');
  for (const row of plan.rows) {
    const half = (row.text.length * row.size) / (row.align === 'center' ? 2 : 1);
    assert.ok(row.x + half <= plan.width, `${row.text} overflows`);
  }
});
