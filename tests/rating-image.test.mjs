import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRatingImagePlan } from '../js/image-export.js';
import { getCampus } from '../js/campuses.js';

const EAST = getCampus('east');
const SOUTH = getCampus('south');

function record(id, date, grade, classNo, points, module = 'daily') {
  return { id, campus: 'east', module, date, grade, classNo, points };
}

const records = [
  record('a', '2026-09-22', 3, 1, 2),
  record('b', '2026-09-24', 4, 23, 3, 'flag'),
];

test('rating image lists the week, the campus, and every star level', () => {
  const plan = buildRatingImagePlan(records, EAST, '2026-09-21');
  const texts = plan.rows.map((row) => row.text);
  assert.equal(plan.width, 1080);
  assert.ok(texts.includes('9月21日–9月25日星级班级评比'));
  assert.ok(texts.includes('东校区 · 满分 250 分'));
  assert.ok(texts.some((text) => text.startsWith('五星班级　75 个')));
  assert.ok(texts.some((text) => text.startsWith('四星班级　1 个')));
  assert.ok(texts.some((text) => text.startsWith('三星班级　1 个')));
  assert.ok(texts.includes('共 77 个班级 · 本周合计扣 5 分 · 2 条检查记录'));
});

test('rating image shows the deduction next to four and three star classes', () => {
  const plan = buildRatingImagePlan(records, EAST, '2026-09-21');
  const body = plan.rows.map((row) => row.text).join(' ');
  assert.ok(body.includes('三年级1班（-2）'));
  assert.ok(body.includes('四年级23班（-3）'));
});

test('rating image never overflows the canvas', () => {
  const plan = buildRatingImagePlan(records, EAST, '2026-09-21');
  for (const row of plan.rows) {
    const half = (row.text.length * row.size) / (row.align === 'center' ? 2 : 1);
    assert.ok(row.x + half <= plan.width, `${row.text} overflows`);
  }
});

test('south campus rating image covers grades 5 and 6 only', () => {
  const plan = buildRatingImagePlan([], SOUTH, '2026-09-21');
  const texts = plan.rows.map((row) => row.text);
  assert.ok(texts.includes('南校区 · 满分 250 分'));
  assert.ok(texts.some((text) => text.startsWith('五星班级　36 个')));
  assert.ok(!texts.some((text) => text.includes('一年级')));
});

test('a week without any seven-star class prints 无', () => {
  const heavy = [record('c', '2026-09-22', 1, 1, 9)];
  const plan = buildRatingImagePlan(heavy, { ...SOUTH, grades: [1], classCounts: { 1: 1 }, label: '测试校区' }, '2026-09-21');
  const texts = plan.rows.map((row) => row.text);
  assert.ok(texts.some((text) => text.startsWith('五星班级　0 个')));
  assert.ok(texts.includes('无'));
});
