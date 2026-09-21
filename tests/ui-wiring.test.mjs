import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

function htmlIds() {
  return new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (match) => match[1]));
}

test('every element id used by app.js exists in index.html', () => {
  const ids = htmlIds();
  const used = Array.from(app.matchAll(/\$\('([^']+)'\)/g), (match) => match[1])
    .filter((id) => !id.includes('${'));
  const missing = used.filter((id) => !ids.has(id));
  assert.deepEqual(missing, []);
});

test('index.html exposes the module switch and flag entry fields', () => {
  for (const id of ['module-switch', 'ground-chip', 'flag-fields', 'f-student-nos', 'daily-only', 'summary-title']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.equal((html.match(/data-module="/g) || []).length, 2);
});

test('service worker caches every module script', () => {
  for (const asset of ['./js/modules.js', './js/dates.js', './js/records.js', './js/summary.js', './js/image-export.js']) {
    assert.ok(sw.includes(asset), `${asset} missing from service worker cache list`);
  }
});
