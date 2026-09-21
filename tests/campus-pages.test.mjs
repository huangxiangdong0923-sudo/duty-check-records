import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPUSES, DEFAULT_CAMPUS, filterByCampus } from '../js/campuses.js';
import { renderCampusHtml, renderCampusManifest, secondaryCampuses } from '../scripts/build_campus_pages.mjs';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const template = await readFile(path.join(rootDir, 'index.html'), 'utf8');
const baseManifest = JSON.parse(await readFile(path.join(rootDir, 'manifest.webmanifest'), 'utf8'));
const sw = await readFile(path.join(rootDir, 'sw.js'), 'utf8');

test('every campus except the default has a generated entry page', () => {
  assert.deepEqual(secondaryCampuses().map((campus) => campus.id), ['south']);
});

for (const campus of secondaryCampuses()) {
  test(`${campus.label} entry page matches the current template`, async () => {
    const actual = await readFile(path.join(rootDir, 'campus', campus.id, 'index.html'), 'utf8');
    assert.equal(actual, renderCampusHtml(template, campus));
  });

  test(`${campus.label} manifest matches the current template`, async () => {
    const actual = JSON.parse(await readFile(path.join(rootDir, 'campus', campus.id, 'manifest.webmanifest'), 'utf8'));
    assert.deepEqual(actual, renderCampusManifest(baseManifest, campus));
  });

  test(`${campus.label} entry page loads shared assets from the repo root`, async () => {
    const html = await readFile(path.join(rootDir, 'campus', campus.id, 'index.html'), 'utf8');
    assert.match(html, /src="\.\.\/\.\.\/app\.js"/);
    assert.match(html, /href="\.\.\/\.\.\/styles\.css"/);
    assert.match(html, /href="\.\/manifest\.webmanifest"/);
    assert.match(html, new RegExp(`<title>值日检查记录（${campus.label}）</title>`));
  });

  test(`${campus.label} entry page is pre-cached for offline use`, () => {
    assert.ok(sw.includes(`'./campus/${campus.id}/'`), `${campus.id} directory url missing from service worker cache`);
    assert.ok(sw.includes(`./campus/${campus.id}/index.html`), `${campus.id} page missing from service worker cache`);
    assert.ok(sw.includes(`./campus/${campus.id}/manifest.webmanifest`), `${campus.id} manifest missing from service worker cache`);
  });
}

test('every campus module script is pre-cached', () => {
  for (const asset of ['./js/campuses.js', './js/modules.js', './js/records.js', './js/summary.js']) {
    assert.ok(sw.includes(asset), `${asset} missing from service worker cache list`);
  }
});

test('campus configs are well formed', () => {
  const ids = CAMPUSES.map((campus) => campus.id);
  assert.equal(new Set(ids).size, ids.length, 'campus ids must be unique');
  for (const campus of CAMPUSES) {
    assert.ok(campus.label && campus.shortLabel, `${campus.id} needs labels`);
    assert.ok(campus.grades.length, `${campus.id} needs grades`);
    assert.ok(campus.grounds.length, `${campus.id} needs at least one playground`);
    for (const grade of campus.grades) {
      assert.ok(campus.classCounts[grade] > 0, `${campus.id} grade ${grade} needs a class count`);
    }
  }
  assert.equal(getCampusName(DEFAULT_CAMPUS.id), '东校区');
});

test('records are separated by campus', () => {
  const records = [
    { id: 'e1', campus: 'east', grade: 3 },
    { id: 's1', campus: 'south', grade: 5 },
    { id: 'legacy', grade: 2 },
  ];
  assert.deepEqual(filterByCampus(records, 'east').map((record) => record.id), ['e1', 'legacy']);
  assert.deepEqual(filterByCampus(records, 'south').map((record) => record.id), ['s1']);
});

function getCampusName(id) {
  return CAMPUSES.find((campus) => campus.id === id)?.label;
}
