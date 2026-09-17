import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('index.html contains the three app panels', () => {
  for (const id of ['panel-entry', 'panel-summary', 'panel-history']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('index.html contains the entry form controls', () => {
  for (const id of [
    'entry-form', 'f-date', 'f-grade', 'f-class', 'seat-fields', 'f-row',
    'f-seat', 'student-fields', 'f-student', 'f-slot', 'reason-grid',
    'f-points', 'f-note', 'save-record', 'entry-message', 'today-list'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('index.html contains the summary and history controls', () => {
  for (const id of [
    'summary-date', 'summary-total', 'summary-groups', 'export-image',
    'summary-message', 'history-list', 'export-backup', 'import-file',
    'import-mode', 'history-message'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
