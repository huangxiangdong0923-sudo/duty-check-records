import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULES,
  FLAG_REASONS,
  getModule,
  getReasonsForModule,
  getReasonForModule,
  getSlotsForModule,
  groundForGrade,
} from '../js/modules.js';
import { CAMPUSES, DEFAULT_CAMPUS, getCampus, detectCampusId } from '../js/campuses.js';

const EAST_GROUNDS = getCampus('east').grounds;

test('grade 1 and 4 belong to JInlun playground', () => {
  assert.equal(groundForGrade(1).code, 'jinlun');
  assert.equal(groundForGrade(4).code, 'jinlun');
  assert.equal(groundForGrade(1).label, '金轮操场');
});

test('grade 2 and 3 belong to Yuetu playground', () => {
  assert.equal(groundForGrade(2).code, 'yuetu');
  assert.equal(groundForGrade(3).code, 'yuetu');
  assert.equal(groundForGrade(3).label, '玉兔操场');
});

test('unknown grade has no playground', () => {
  assert.equal(groundForGrade(5), null);
  assert.equal(groundForGrade(''), null);
});

test('each grade appears in exactly one playground', () => {
  for (const campus of CAMPUSES) {
    const assigned = campus.grounds.flatMap((ground) => ground.grades);
    assert.deepEqual([...assigned].sort((a, b) => a - b), campus.grades.slice().sort((a, b) => a - b), campus.id);
  }
});

test('flag module keeps the ten fixed checks the school listed', () => {
  const labels = FLAG_REASONS.map((reason) => reason.label);
  assert.equal(labels.length, 5);
  assert.ok(labels.includes('未佩戴红领巾'));
  assert.ok(labels.includes('未穿着规范校服'));
  assert.ok(labels.includes('未穿黑鞋子'));
  assert.ok(labels.includes('升旗仪式迟到或逗留在班级'));
});

test('reason codes are unique across every module', () => {
  const all = [...getReasonsForModule('daily', 'morning'), ...FLAG_REASONS].map((reason) => reason.code);
  assert.equal(new Set(all).size, all.length);
});

test('flag module has one slot and its own reasons', () => {
  assert.deepEqual(getSlotsForModule('flag').map((slot) => slot.code), ['flag']);
  assert.ok(getReasonsForModule('flag', 'whatever').every((reason) => reason.code.startsWith('flag-')));
  assert.equal(getReasonForModule('flag', 'flag-shoes').label, '未穿黑鞋子');
  assert.equal(getReasonForModule('flag', 'floor-garbage-am'), null);
});

test('daily module keeps working through the module lookup helpers', () => {
  assert.ok(getReasonsForModule('daily', 'morning').length > 5);
  assert.equal(getReasonForModule('daily', 'trash-bin-am').label, '垃圾桶未套袋或过满');
  assert.equal(getSlotsForModule('daily').length, 5);
});

test('unknown module id falls back to daily', () => {
  assert.equal(getModule('nope').id, 'daily');
  assert.deepEqual(MODULES.map((module) => module.id), ['daily', 'flag']);
});

test('东校区 covers grades 1-4 across two playgrounds', () => {
  assert.deepEqual(DEFAULT_CAMPUS.grades, [1, 2, 3, 4]);
  assert.deepEqual(EAST_GROUNDS.map((ground) => ground.code), ['jinlun', 'yuetu']);
});

test('南校区 has one playground for grades 5 and 6', () => {
  const south = getCampus('south');
  assert.deepEqual(south.grades, [5, 6]);
  assert.equal(south.grounds.length, 1);
  assert.deepEqual(south.grounds[0].grades, [5, 6]);
  assert.equal(groundForGrade(5, south).code, 'south-field');
  assert.equal(groundForGrade(6, south).code, 'south-field');
  assert.equal(groundForGrade(4, south), null);
});

test('campus detection reads the URL path', () => {
  assert.equal(detectCampusId('/duty-check-records/'), 'east');
  assert.equal(detectCampusId('/duty-check-records/index.html'), 'east');
  assert.equal(detectCampusId('/duty-check-records/campus/south/'), 'south');
  assert.equal(detectCampusId('/duty-check-records/campus/south/index.html'), 'south');
});
