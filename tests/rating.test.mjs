import test from 'node:test';
import assert from 'node:assert/strict';
import { WEEKLY_FULL_SCORE, rateWeek, scoreFor, starLevelFor, weekRange } from '../js/rating.js';
import { getCampus } from '../js/campuses.js';

const EAST = getCampus('east');
const SOUTH = getCampus('south');

function record(id, date, grade, classNo, points, module = 'daily') {
  return { id, campus: 'east', module, date, grade, classNo, points };
}

test('week range runs Monday to Friday', () => {
  assert.deepEqual(weekRange('2026-09-21'), { start: '2026-09-21', end: '2026-09-25' });
  assert.deepEqual(weekRange('2026-09-24'), { start: '2026-09-21', end: '2026-09-25' });
  assert.deepEqual(weekRange('2026-09-27'), { start: '2026-09-21', end: '2026-09-25' });
});

test('star levels follow the school rule', () => {
  assert.equal(WEEKLY_FULL_SCORE, 250);
  assert.equal(starLevelFor(0), 5);
  assert.equal(starLevelFor(1), 4);
  assert.equal(starLevelFor(2), 4);
  assert.equal(starLevelFor(3), 3);
  assert.equal(starLevelFor(17), 3);
});

test('score is the full score minus the weekly deduction', () => {
  assert.equal(scoreFor(0), 250);
  assert.equal(scoreFor(1), 249);
  assert.equal(scoreFor(2), 248);
  assert.equal(scoreFor(3), 247);
});

test('every class of the campus gets a rating', () => {
  const result = rateWeek([], EAST, '2026-09-21');
  assert.equal(result.totals.classCount, 77);
  assert.equal(result.totals.starCounts[5], 77);
  assert.equal(result.totals.recordCount, 0);
  const south = rateWeek([], SOUTH, '2026-09-21');
  assert.equal(south.totals.classCount, 36);
  assert.deepEqual([...new Set(south.classes.map((entry) => entry.grade))], [5, 6]);
});

test('a clean class is five stars', () => {
  const result = rateWeek([], EAST, '2026-09-21');
  const level5 = result.levels.find((level) => level.stars === 5);
  assert.ok(level5.classes.some((entry) => entry.label === '三年级1班'));
  assert.equal(level5.classes[0].score, 250);
  assert.equal(level5.classes[0].unchecked, true);
});

test('one or two points drop a class to four stars', () => {
  const records = [
    record('a', '2026-09-22', 3, 1, 2),
    record('b', '2026-09-23', 3, 2, 1),
  ];
  const result = rateWeek(records, EAST, '2026-09-21');
  const find = (label) => result.classes.find((entry) => entry.label === label);
  assert.equal(find('三年级1班').stars, 4);
  assert.equal(find('三年级1班').score, 248);
  assert.equal(find('三年级2班').stars, 4);
  assert.equal(find('三年级2班').score, 249);
});

test('three points or more drop a class to three stars', () => {
  const records = [
    record('a', '2026-09-22', 4, 23, 1),
    record('b', '2026-09-24', 4, 23, 2, 'flag'),
  ];
  const result = rateWeek(records, EAST, '2026-09-21');
  const entry = result.classes.find((item) => item.label === '四年级23班');
  assert.equal(entry.deduction, 3);
  assert.equal(entry.stars, 3);
  assert.equal(entry.score, 247);
  assert.equal(entry.dailyDeduction, 1);
  assert.equal(entry.flagDeduction, 2);
});

test('both the daily checks and the flag check count', () => {
  const records = [
    record('a', '2026-09-21', 1, 1, 1, 'flag'),
    record('b', '2026-09-22', 1, 1, 1),
    record('c', '2026-09-23', 1, 1, 1),
  ];
  const entry = rateWeek(records, EAST, '2026-09-21').classes.find((item) => item.label === '一年级1班');
  assert.equal(entry.deduction, 3);
  assert.equal(entry.stars, 3);
});

test('records outside Monday to Friday do not count', () => {
  const records = [
    record('sat', '2026-09-26', 2, 1, 5),
    record('sun', '2026-09-27', 2, 1, 5),
    record('prev', '2026-09-18', 2, 1, 5),
    record('next', '2026-09-28', 2, 1, 5),
  ];
  const result = rateWeek(records, EAST, '2026-09-21');
  const entry = result.classes.find((item) => item.label === '二年级1班');
  assert.equal(entry.deduction, 0);
  assert.equal(entry.stars, 5);
  assert.equal(entry.unchecked, true);
  assert.equal(result.totals.recordCount, 0);
});

test('weekly totals add up every class deduction', () => {
  const records = [
    record('a', '2026-09-21', 1, 1, 3),
    record('b', '2026-09-22', 4, 5, 2),
  ];
  const result = rateWeek(records, EAST, '2026-09-21');
  assert.equal(result.totals.deduction, 5);
  assert.equal(result.totals.starCounts[3], 1);
  assert.equal(result.totals.starCounts[4], 1);
  assert.equal(result.totals.starCounts[5], 75);
  assert.equal(result.totals.uncheckedCount, 75);
});

test('the south campus rates grades 5 and 6 only', () => {
  const records = [
    record('s1', '2026-09-22', 5, 3, 2),
    record('s2', '2026-09-23', 6, 18, 4),
  ].map((item) => ({ ...item, campus: 'south' }));
  const result = rateWeek(records, SOUTH, '2026-09-21');
  const find = (label) => result.classes.find((entry) => entry.label === label);
  assert.equal(find('五年级3班').stars, 4);
  assert.equal(find('六年级18班').stars, 3);
  assert.equal(result.totals.classCount, 36);
});
