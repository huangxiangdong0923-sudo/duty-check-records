import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImagePlan } from '../js/image-export.js';

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
