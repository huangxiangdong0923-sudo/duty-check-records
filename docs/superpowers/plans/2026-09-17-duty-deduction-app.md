# 值日扣分记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user static web app that records daily duty-check deductions, summarizes the day by class, and exports the summary as a PNG image.

**Architecture:** Plain HTML/CSS/JavaScript ES modules with no build step. Browser localStorage stores records. Pure logic modules are tested with Node's built-in test runner. Canvas renders the PNG export. A service worker and manifest make the site installable and usable offline.

**Tech Stack:** HTML, CSS, browser JavaScript ES modules, localStorage, Canvas, Service Worker, Node 24 built-in test runner, Python 3 and Pillow only for generating app icons.

## Global Constraints

These constraints apply to every task:

- Static site only, no server, no login, no database.
- UI language is Simplified Chinese (`zh-CN`).
- Records are stored in localStorage under `duty-deduction-records-v1`.
- Grades are 1-4; grade 1-3 have classes 1-18; grade 4 has classes 1-23.
- Seat locations are recorded as vertical position: row counted vertically and seat counted vertically within that row.
- Points default to 1; a record may override points with a positive number.
- Fixed reasons come from the supplied duty rules; `other` requires a note.
- PNG export shows only classes that have deductions.
- No runtime dependency may be loaded from a CDN.
- All dates use `YYYY-MM-DD`; timestamps use ISO strings.
- Every task ends with a commit.

---

## File Structure

Create:

```text
值日扣分记录/
├── index.html
├── styles.css
├── app.js
├── package.json
├── manifest.webmanifest
├── sw.js
├── js/
│   ├── reasons.js
│   ├── records.js
│   ├── storage.js
│   ├── summary.js
│   └── image-export.js
├── tests/
│   ├── scaffold.test.mjs
│   ├── reasons.test.mjs
│   ├── records.test.mjs
│   ├── storage.test.mjs
│   ├── summary.test.mjs
│   └── image-layout.test.mjs
├── scripts/
│   └── make_icons.py
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── docs/
    └── superpowers/
        ├── specs/2026-09-17-duty-deduction-app-design.md
        └── plans/2026-09-17-duty-deduction-app.md
```

Responsibilities:

- `index.html`: complete DOM shell and all element IDs used by `app.js`.
- `styles.css`: responsive phone-first visual system.
- `app.js`: tab routing, DOM events, and calls into pure modules.
- `js/reasons.js`: fixed reason catalog and slot lookup.
- `js/records.js`: record validation, creation, normalization, and update.
- `js/storage.js`: localStorage, backup creation, backup parsing, merge import.
- `js/summary.js`: date filtering, class grouping, totals, and labels.
- `js/image-export.js`: image layout plan, Canvas renderer, PNG download.
- `sw.js`: offline cache of the app shell.
- `manifest.webmanifest`: installable PWA metadata.

---

### Task 1: Scaffold the static app and test harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`
- Create: `tests/scaffold.test.mjs`

**Interfaces:**
- Consumes: none.
- Produces: the DOM IDs used by later tasks and the `npm test` command.

- [ ] **Step 1: Write the failing scaffold test**

Create `tests/scaffold.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/scaffold.test.mjs`

Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Create the scaffold**

Create `package.json`:

```json
{
  "name": "duty-deduction-records",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "serve": "python3 -m http.server 5173"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#1E5AA8">
  <title>值日扣分记录</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="app-header">
    <h1>值日扣分记录</h1>
    <nav class="tabs" aria-label="页面切换">
      <button type="button" class="tab is-active" data-tab="entry">录入</button>
      <button type="button" class="tab" data-tab="summary">汇总</button>
      <button type="button" class="tab" data-tab="history">历史与备份</button>
    </nav>
  </header>

  <main>
    <section id="panel-entry" class="panel is-active">
      <form id="entry-form" novalidate>
        <label>日期
          <input id="f-date" name="date" type="date" required>
        </label>
        <label>年级
          <select id="f-grade" name="grade" required></select>
        </label>
        <label>班级
          <select id="f-class" name="classNo" required></select>
        </label>

        <fieldset>
          <legend>填写位置方式</legend>
          <label><input type="radio" name="locationType" value="seat" checked> 第几排第几个</label>
          <label><input type="radio" name="locationType" value="student"> 学生姓名</label>
        </fieldset>

        <div id="seat-fields">
          <label>第几排（竖着数）
            <input id="f-row" name="row" type="number" min="1" step="1">
          </label>
          <label>第几个（竖着数）
            <input id="f-seat" name="seat" type="number" min="1" step="1">
          </label>
        </div>

        <div id="student-fields" hidden>
          <label>学生姓名
            <input id="f-student" name="studentName" type="text" maxlength="20">
          </label>
        </div>

        <label>检查时间
          <select id="f-slot" name="slot" required></select>
        </label>

        <div id="reason-grid" class="reason-grid" aria-label="扣分原因"></div>

        <label>分值
          <input id="f-points" name="points" type="number" min="1" step="1" value="1" required>
        </label>
        <label>备注
          <textarea id="f-note" name="note" rows="2" maxlength="80"></textarea>
        </label>
        <p id="entry-message" class="message" role="status"></p>
        <button id="save-record" type="submit" class="primary">保存记录</button>
      </form>
      <h2>今日记录</h2>
      <div id="today-list" class="record-list"></div>
    </section>

    <section id="panel-summary" class="panel">
      <label>汇总日期
        <input id="summary-date" type="date">
      </label>
      <div id="summary-total" class="summary-total"></div>
      <p id="summary-message" class="message" role="status"></p>
      <button id="export-image" type="button" class="primary">导出当天图片</button>
      <div id="summary-groups" class="summary-groups"></div>
    </section>

    <section id="panel-history" class="panel">
      <h2>历史日期</h2>
      <div id="history-list" class="record-list"></div>
      <h2>备份</h2>
      <button id="export-backup" type="button">导出 JSON 备份</button>
      <label>导入方式
        <select id="import-mode">
          <option value="merge" selected>合并导入</option>
          <option value="replace">覆盖本机数据</option>
        </select>
      </label>
      <label>选择备份文件
        <input id="import-file" type="file" accept="application/json,.json">
      </label>
      <p id="history-message" class="message" role="status"></p>
    </section>
  </main>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

Create `styles.css`:

```css
:root {
  --blue: #1E5AA8;
  --blue-soft: #EAF1FA;
  --orange: #C2410C;
  --red: #C00000;
  --green: #2E9E6B;
  --ink: #1F2937;
  --muted: #64748B;
  --line: #D9E2EC;
  --bg: #F6F8FB;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
.app-header { background: #FFFFFF; padding: 16px 16px 0; border-bottom: 1px solid var(--line); }
h1 { margin: 0 0 12px; font-size: 24px; }
.tabs { display: flex; gap: 8px; }
.tab { border: 0; background: var(--blue-soft); color: var(--blue); padding: 10px 14px; border-radius: 12px 12px 0 0; font-size: 16px; }
.tab.is-active { background: var(--blue); color: #FFFFFF; }
main { max-width: 720px; margin: 0 auto; padding: 16px; }
.panel { display: none; }
.panel.is-active { display: block; }
label, fieldset { display: block; margin: 12px 0; font-size: 16px; }
input, select, textarea { width: 100%; padding: 10px; margin-top: 6px; border: 1px solid var(--line); border-radius: 10px; font-size: 16px; }
fieldset label { display: inline-flex; gap: 6px; margin-right: 16px; }
fieldset input { width: auto; margin: 0; }
.reason-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 12px 0; }
.reason { text-align: left; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: #FFFFFF; font-size: 15px; }
.reason.is-selected { border: 2px solid var(--blue); background: var(--blue-soft); }
.primary { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: var(--blue); color: #FFFFFF; font-size: 17px; }
.message { color: var(--red); min-height: 24px; }
.record-list { display: grid; gap: 8px; }
.record-item, .summary-class { background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; padding: 12px; }
.record-item button { margin-right: 8px; }
.summary-total { font-size: 20px; font-weight: 700; margin: 12px 0; }
.summary-class h3 { margin: 0 0 8px; color: var(--blue); }
.summary-entry { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
.points { color: var(--red); font-weight: 700; }
@media (min-width: 640px) {
  .reason-grid { grid-template-columns: 1fr 1fr; }
}
```

Create `app.js`:

```javascript
document.querySelector('h1').textContent = '值日扣分记录';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/scaffold.test.mjs`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html styles.css app.js tests/scaffold.test.mjs
git commit -m "chore: scaffold duty deduction app"
```

---

### Task 2: Add the fixed reason catalog

**Files:**
- Create: `js/reasons.js`
- Create: `tests/reasons.test.mjs`

**Interfaces:**
- Produces: `SLOTS`, `REASONS`, `getReasonsForSlot(slot)`, `getReasonByCode(code)`.
- Later tasks import these names exactly.

- [ ] **Step 1: Write the failing test**

Create `tests/reasons.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, REASONS, getReasonsForSlot, getReasonByCode } from '../js/reasons.js';

test('reason codes are unique', () => {
  assert.equal(new Set(REASONS.map((reason) => reason.code)).size, REASONS.length);
});

test('slot lookup returns slot-specific and shared reasons', () => {
  const codes = getReasonsForSlot('morning').map((reason) => reason.code);
  assert.ok(codes.includes('floor-garbage-am'));
  assert.ok(codes.includes('other'));
  assert.ok(!codes.includes('eye-not-do'));
});

test('other reason requires a note', () => {
  assert.equal(getReasonByCode('other').requiresNote, true);
});

test('all slots have labels', () => {
  assert.deepEqual(SLOTS.map((slot) => slot.code), ['morning', 'afternoon', 'exercise', 'break', 'eye']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/reasons.test.mjs`

Expected: FAIL because `js/reasons.js` does not exist.

- [ ] **Step 3: Implement the reason catalog**

Create `js/reasons.js`:

```javascript
export const SLOTS = [
  { code: 'morning', label: '上午检查' },
  { code: 'afternoon', label: '下午检查' },
  { code: 'exercise', label: '出操/升旗' },
  { code: 'break', label: '课间' },
  { code: 'eye', label: '眼保健操' },
];

export const REASONS = [
  { code: 'floor-garbage-am', slot: 'morning', label: '地面有比拳头大的垃圾、水杯或绳子' },
  { code: 'trash-bin-am', slot: 'morning', label: '垃圾桶未套袋或过满' },
  { code: 'desk-doodle-am', slot: 'morning', label: '桌面乱涂乱画严重' },
  { code: 'cabinet-am', slot: 'morning', label: '柜子物品摆放不整齐' },
  { code: 'bag-am', slot: 'morning', label: '书包没有放在柜子里' },
  { code: 'floor-garbage-pm', slot: 'afternoon', label: '地面有垃圾、水杯或绳子' },
  { code: 'trash-bin-pm', slot: 'afternoon', label: '垃圾桶未套袋或过满' },
  { code: 'desk-doodle-pm', slot: 'afternoon', label: '桌面乱涂乱画严重' },
  { code: 'cabinet-pm', slot: 'afternoon', label: '柜子物品摆放不整齐' },
  { code: 'bag-pm', slot: 'afternoon', label: '书包没有放在柜子里' },
  { code: 'fan-light', slot: 'exercise', label: '教室内风扇或电灯未关' },
  { code: 'flag-late', slot: 'exercise', label: '升旗仪式无故迟到' },
  { code: 'absent-exercise', slot: 'exercise', label: '无故不出操' },
  { code: 'exercise-play', slot: 'exercise', label: '因身体不适留在教室却打闹' },
  { code: 'corridor-play', slot: 'break', label: '爬栏杆、追逐打闹、大声喧哗或躺地打滚' },
  { code: 'litter', slot: 'break', label: '在室外走廊和公共区域随意扔垃圾' },
  { code: 'damage-public', slot: 'break', label: '损坏公物' },
  { code: 'eye-not-do', slot: 'eye', label: '提醒一次仍不做眼保健操' },
  { code: 'eye-not-serious', slot: 'eye', label: '做眼保健操不认真' },
  { code: 'talk-back', slot: 'any', label: '顶撞、挑衅值日生' },
  { code: 'rule-violation', slot: 'any', label: '违反值日细则且已告知班长登记' },
  { code: 'other', slot: 'any', label: '其他情况（需备注）', requiresNote: true },
];

export function getReasonsForSlot(slot) {
  return REASONS.filter((reason) => reason.slot === slot || reason.slot === 'any');
}

export function getReasonByCode(code) {
  return REASONS.find((reason) => reason.code === code) || null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/reasons.test.mjs`

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add js/reasons.js tests/reasons.test.mjs
git commit -m "feat: add fixed deduction reasons"
```

---

### Task 3: Add record validation and creation

**Files:**
- Create: `js/records.js`
- Create: `tests/records.test.mjs`

**Interfaces:**
- Consumes: `getReasonByCode`, `SLOTS` from `js/reasons.js`.
- Produces: `classCountForGrade(grade)`, `validateDraft(draft)`, `createRecord(draft, options)`, `normalizeRecord(record)`, `updateRecord(record, patch, nowIso)`.

- [ ] **Step 1: Write the failing test**

Create `tests/records.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { classCountForGrade, validateDraft, createRecord, updateRecord } from '../js/records.js';

const baseDraft = {
  date: '2026-09-17',
  grade: 3,
  classNo: 1,
  locationType: 'seat',
  row: 3,
  seat: 4,
  studentName: '',
  slot: 'morning',
  reasonCode: 'floor-garbage-am',
  points: 1,
  note: '',
};

test('grade class counts follow the school range', () => {
  assert.equal(classCountForGrade(3), 18);
  assert.equal(classCountForGrade(4), 23);
});

test('valid seat draft passes validation', () => {
  assert.equal(validateDraft(baseDraft).valid, true);
});

test('other reason requires a note', () => {
  const result = validateDraft({ ...baseDraft, reasonCode: 'other', note: '' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('其他情况必须填写备注'));
});

test('createRecord applies defaults and timestamps', () => {
  const record = createRecord(baseDraft, {
    now: () => '2026-09-17T01:00:00.000Z',
    idFactory: () => 'record-1',
  });
  assert.equal(record.id, 'record-1');
  assert.equal(record.points, 1);
  assert.equal(record.reasonLabel, '地面有比拳头大的垃圾、水杯或绳子');
  assert.equal(record.createdAt, '2026-09-17T01:00:00.000Z');
});

test('updateRecord refreshes updatedAt', () => {
  const record = createRecord(baseDraft, {
    now: () => '2026-09-17T01:00:00.000Z',
    idFactory: () => 'record-1',
  });
  const updated = updateRecord(record, { note: '已核实' }, '2026-09-17T02:00:00.000Z');
  assert.equal(updated.note, '已核实');
  assert.equal(updated.updatedAt, '2026-09-17T02:00:00.000Z');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/records.test.mjs`

Expected: FAIL because `js/records.js` does not exist.

- [ ] **Step 3: Implement record logic**

Create `js/records.js`:

```javascript
import { SLOTS, getReasonByCode } from './reasons.js';

const GRADE_MIN = 1;
const GRADE_MAX = 4;

export function classCountForGrade(grade) {
  return Number(grade) === 4 ? 23 : 18;
}

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeRecord(input) {
  return {
    id: String(input.id || makeId()),
    date: String(input.date || ''),
    grade: Number(input.grade),
    classNo: Number(input.classNo),
    locationType: input.locationType === 'student' ? 'student' : 'seat',
    row: input.row === null || input.row === '' ? null : Number(input.row),
    seat: input.seat === null || input.seat === '' ? null : Number(input.seat),
    studentName: String(input.studentName || '').trim(),
    slot: String(input.slot || ''),
    reasonCode: String(input.reasonCode || ''),
    reasonLabel: String(input.reasonLabel || ''),
    points: Number(input.points || 1),
    note: String(input.note || '').trim(),
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function validateDraft(draft) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || ''))) errors.push('日期格式应为 YYYY-MM-DD');
  if (!Number.isInteger(Number(draft.grade)) || Number(draft.grade) < GRADE_MIN || Number(draft.grade) > GRADE_MAX) {
    errors.push('年级必须是一至四年级');
  }
  const maxClass = classCountForGrade(Number(draft.grade));
  if (!Number.isInteger(Number(draft.classNo)) || Number(draft.classNo) < 1 || Number(draft.classNo) > maxClass) {
    errors.push(`班级必须是 1-${maxClass} 班`);
  }
  if (draft.locationType === 'student') {
    if (!String(draft.studentName || '').trim()) errors.push('请填写学生姓名');
  } else {
    if (!Number.isInteger(Number(draft.row)) || Number(draft.row) < 1) errors.push('第几排必须是正整数');
    if (!Number.isInteger(Number(draft.seat)) || Number(draft.seat) < 1) errors.push('第几个必须是正整数');
  }
  if (!SLOTS.some((slot) => slot.code === draft.slot)) errors.push('请选择检查时间');
  const reason = getReasonByCode(draft.reasonCode);
  if (!reason) errors.push('请选择扣分原因');
  if (reason?.requiresNote && !String(draft.note || '').trim()) errors.push('其他情况必须填写备注');
  if (!Number.isFinite(Number(draft.points)) || Number(draft.points) <= 0) errors.push('分值必须大于 0');
  return { valid: errors.length === 0, errors };
}

export function createRecord(draft, options = {}) {
  const result = validateDraft(draft);
  if (!result.valid) throw new Error(result.errors.join('；'));
  const now = options.now ? options.now() : new Date().toISOString();
  const id = options.idFactory ? options.idFactory() : makeId();
  const reason = getReasonByCode(draft.reasonCode);
  return normalizeRecord({
    ...draft,
    id,
    reasonLabel: reason.label,
    points: Number(draft.points || 1),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateRecord(record, patch, nowIso = new Date().toISOString()) {
  return normalizeRecord({ ...record, ...patch, id: record.id, createdAt: record.createdAt, updatedAt: nowIso });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/records.test.mjs`

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add js/records.js tests/records.test.mjs
git commit -m "feat: add record validation and creation"
```

---

### Task 4: Add local storage, backup, and merge import

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.test.mjs`

**Interfaces:**
- Consumes: `normalizeRecord`, `validateDraft` from `js/records.js`.
- Produces: `STORAGE_KEY`, `loadRecords(storage?)`, `saveRecords(records, storage?)`, `createBackup(records, now?)`, `parseBackup(text)`, `importBackup(text, existing)`.

- [ ] **Step 1: Write the failing test**

Create `tests/storage.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords, saveRecords, createBackup, importBackup } from '../js/storage.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const record = {
  id: 'r1', date: '2026-09-17', grade: 3, classNo: 1,
  locationType: 'seat', row: 3, seat: 4, studentName: '',
  slot: 'morning', reasonCode: 'floor-garbage-am',
  reasonLabel: '地面有比拳头大的垃圾、水杯或绳子', points: 1, note: '',
  createdAt: '2026-09-17T01:00:00.000Z', updatedAt: '2026-09-17T01:00:00.000Z',
};

test('saveRecords and loadRecords round-trip', () => {
  const storage = memoryStorage();
  saveRecords([record], storage);
  assert.deepEqual(loadRecords(storage), [record]);
});

test('backup round-trip keeps schema and records', () => {
  const backup = createBackup([record], '2026-09-17T02:00:00.000Z');
  const text = JSON.stringify(backup);
  const result = importBackup(text, []);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.records, [record]);
});

test('merge import skips duplicate ids', () => {
  const result = importBackup(JSON.stringify(createBackup([record])), [record]);
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 1);
});

test('invalid backup throws', () => {
  assert.throws(() => importBackup('{"schemaVersion":2,"records":[]}', []), /备份文件格式不正确/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/storage.test.mjs`

Expected: FAIL because `js/storage.js` does not exist.

- [ ] **Step 3: Implement storage and backup**

Create `js/storage.js`:

```javascript
import { normalizeRecord } from './records.js';

export const STORAGE_KEY = 'duty-deduction-records-v1';

export function loadRecords(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('本机数据格式不正确');
  return parsed.map(normalizeRecord);
}

export function saveRecords(records, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(records.map(normalizeRecord)));
  return records;
}

export function createBackup(records, now = new Date().toISOString()) {
  return { schemaVersion: 1, exportedAt: now, records: records.map(normalizeRecord) };
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.records)) {
    throw new Error('备份文件格式不正确');
  }
  return data.records.map(normalizeRecord);
}

export function importBackup(text, existing) {
  const incoming = parseBackup(text);
  const byId = new Map(existing.map((record) => [record.id, record]));
  let added = 0;
  let skipped = 0;
  for (const record of incoming) {
    if (byId.has(record.id)) {
      skipped += 1;
    } else {
      byId.set(record.id, record);
      added += 1;
    }
  }
  return { records: Array.from(byId.values()), added, skipped };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/storage.test.mjs`

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.mjs
git commit -m "feat: add local storage and backup import"
```

---

### Task 5: Add daily summary and totals

**Files:**
- Create: `js/summary.js`
- Create: `tests/summary.test.mjs`

**Interfaces:**
- Produces: `formatClassLabel(grade, classNo)`, `summarize(records, date)`, `getTotals(groups)`.

- [ ] **Step 1: Write the failing test**

Create `tests/summary.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClassLabel, summarize, getTotals } from '../js/summary.js';

const records = [
  { id: 'r1', date: '2026-09-17', grade: 3, classNo: 1, points: 1, createdAt: '2026-09-17T01:00:00.000Z' },
  { id: 'r2', date: '2026-09-17', grade: 3, classNo: 1, points: 2, createdAt: '2026-09-17T02:00:00.000Z' },
  { id: 'r3', date: '2026-09-17', grade: 4, classNo: 23, points: 1, createdAt: '2026-09-17T03:00:00.000Z' },
  { id: 'r4', date: '2026-09-16', grade: 3, classNo: 1, points: 1, createdAt: '2026-09-16T01:00:00.000Z' },
];

test('formatClassLabel uses Chinese grade names', () => {
  assert.equal(formatClassLabel(3, 1), '三年级1班');
  assert.equal(formatClassLabel(4, 23), '四年级23班');
});

test('summarize groups only the selected date', () => {
  const groups = summarize(records, '2026-09-17');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].classNo, 1);
  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups[0].totalPoints, 3);
});

test('getTotals counts classes and entries', () => {
  const totals = getTotals(summarize(records, '2026-09-17'));
  assert.deepEqual(totals, { totalPoints: 4, classCount: 2, entryCount: 3 });
});

test('empty day returns no groups and zero totals', () => {
  const groups = summarize(records, '2026-09-18');
  assert.deepEqual(groups, []);
  assert.deepEqual(getTotals(groups), { totalPoints: 0, classCount: 0, entryCount: 0 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/summary.test.mjs`

Expected: FAIL because `js/summary.js` does not exist.

- [ ] **Step 3: Implement summary logic**

Create `js/summary.js`:

```javascript
const GRADE_LABELS = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级' };

export function formatClassLabel(grade, classNo) {
  return `${GRADE_LABELS[grade] || `${grade}年级`}${classNo}班`;
}

export function summarize(records, date) {
  const filtered = records.filter((record) => record.date === date);
  const map = new Map();
  for (const record of filtered) {
    const key = `${record.grade}-${record.classNo}`;
    if (!map.has(key)) {
      map.set(key, {
        grade: Number(record.grade),
        classNo: Number(record.classNo),
        label: formatClassLabel(Number(record.grade), Number(record.classNo)),
        entries: [],
        totalPoints: 0,
      });
    }
    const group = map.get(key);
    group.entries.push(record);
    group.totalPoints += Number(record.points || 1);
  }
  return Array.from(map.values())
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    }));
}

export function getTotals(groups) {
  return groups.reduce((totals, group) => ({
    totalPoints: totals.totalPoints + group.totalPoints,
    classCount: totals.classCount + 1,
    entryCount: totals.entryCount + group.entries.length,
  }), { totalPoints: 0, classCount: 0, entryCount: 0 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/summary.test.mjs`

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add js/summary.js tests/summary.test.mjs
git commit -m "feat: add daily summary and totals"
```

---

### Task 6: Add the PNG layout planner

**Files:**
- Create: `js/image-export.js`
- Create: `tests/image-layout.test.mjs`

**Interfaces:**
- Consumes: `summarize`, `getTotals` from `js/summary.js`.
- Produces: `buildImagePlan(records, date, options?)`, `drawImagePlan(canvas, plan)`, `renderSummaryBlob(records, date)`, `downloadBlob(blob, filename)`.

- [ ] **Step 1: Write the failing layout test**

Create `tests/image-layout.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/image-layout.test.mjs`

Expected: FAIL because `js/image-export.js` does not exist.

- [ ] **Step 3: Implement the layout planner and browser renderer**

Create `js/image-export.js`:

```javascript
import { summarize, getTotals } from './summary.js';

function formatDateTitle(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${month}月${day}日值日检查扣分情况`;
}

function locationText(record) {
  if (record.locationType === 'student') return record.studentName || '学生';
  return `第${record.row}排第${record.seat}个`;
}

export function buildImagePlan(records, date, options = {}) {
  const groups = summarize(records, date);
  if (!groups.length) return null;
  const width = options.width || 1080;
  const padding = options.padding || 64;
  const rows = [];
  let y = padding + 20;
  const push = (row) => {
    rows.push({ ...row, y });
    y += row.height;
  };
  push({ type: 'title', text: formatDateTitle(date), x: width / 2, y, height: 70, size: 44, weight: 700, color: '#1F2937', align: 'center' });
  y += 16;
  for (const group of groups) {
    push({ type: 'class', text: `${group.label}（${group.totalPoints}分）`, x: padding, y, height: 54, size: 30, weight: 700, color: '#1E5AA8', align: 'left' });
    for (const entry of group.entries) {
      push({
        type: 'entry',
        text: `${locationText(entry)} · ${entry.reasonLabel} · -${entry.points}分`,
        x: padding + 24,
        y,
        height: 42,
        size: 24,
        weight: 400,
        color: '#1F2937',
        align: 'left',
      });
    }
    y += 12;
  }
  const totals = getTotals(groups);
  push({ type: 'total', text: `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级`, x: padding, y, height: 58, size: 28, weight: 700, color: '#C00000', align: 'left' });
  return { width, height: Math.ceil(y + padding), rows, groups, totals };
}

export function drawImagePlan(canvas, plan) {
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  for (const row of plan.rows) {
    ctx.fillStyle = row.color;
    ctx.textAlign = row.align;
    ctx.font = `${row.weight} ${row.size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText(row.text, row.x, row.y);
  }
  return canvas;
}

export function renderSummaryBlob(records, date) {
  const plan = buildImagePlan(records, date);
  if (!plan) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  drawImagePlan(canvas, plan);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/image-layout.test.mjs`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add js/image-export.js tests/image-layout.test.mjs
git commit -m "feat: add PNG layout and canvas export"
```

---

### Task 7: Build the entry screen and today list

**Files:**
- Modify: `app.js`
- Modify: `index.html` only if a missing ID is discovered during browser testing

**Interfaces:**
- Consumes: `SLOTS`, `getReasonsForSlot`; `classCountForGrade`, `createRecord`, `updateRecord`; `loadRecords`, `saveRecords`.
- Produces: working entry form, today list, and tab switching used by later tasks.

- [ ] **Step 1: Replace `app.js` with the entry implementation**

Use this complete file:

```javascript
import { SLOTS, getReasonsForSlot } from './js/reasons.js';
import { classCountForGrade, createRecord } from './js/records.js';
import { loadRecords, saveRecords } from './js/storage.js';

const state = { records: loadRecords(), selectedReasonCode: null };

const $ = (id) => document.getElementById(id);

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fillGradeOptions() {
  const select = $('f-grade');
  select.innerHTML = '';
  for (const grade of [1, 2, 3, 4]) {
    const option = document.createElement('option');
    option.value = String(grade);
    option.textContent = ['', '一年级', '二年级', '三年级', '四年级'][grade];
    select.appendChild(option);
  }
}

function fillClassOptions() {
  const grade = Number($('f-grade').value || 1);
  const select = $('f-class');
  select.innerHTML = '';
  for (let classNo = 1; classNo <= classCountForGrade(grade); classNo += 1) {
    const option = document.createElement('option');
    option.value = String(classNo);
    option.textContent = `${classNo}班`;
    select.appendChild(option);
  }
}

function fillSlotOptions() {
  const select = $('f-slot');
  select.innerHTML = '';
  for (const slot of SLOTS) {
    const option = document.createElement('option');
    option.value = slot.code;
    option.textContent = slot.label;
    select.appendChild(option);
  }
}

function renderReasons() {
  const grid = $('reason-grid');
  grid.innerHTML = '';
  for (const reason of getReasonsForSlot($('f-slot').value || 'morning')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reason';
    button.textContent = reason.label;
    button.dataset.code = reason.code;
    button.setAttribute('aria-pressed', 'false');
    if (reason.code === state.selectedReasonCode) {
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
    }
    button.addEventListener('click', () => {
      state.selectedReasonCode = reason.code;
      renderReasons();
    });
    grid.appendChild(button);
  }
}

function updateLocationFields() {
  const isStudent = document.querySelector('input[name="locationType"]:checked').value === 'student';
  $('seat-fields').hidden = isStudent;
  $('student-fields').hidden = !isStudent;
}

function formDraft() {
  const locationType = document.querySelector('input[name="locationType"]:checked').value;
  return {
    date: $('f-date').value,
    grade: Number($('f-grade').value),
    classNo: Number($('f-class').value),
    locationType,
    row: locationType === 'seat' ? Number($('f-row').value) : null,
    seat: locationType === 'seat' ? Number($('f-seat').value) : null,
    studentName: locationType === 'student' ? $('f-student').value : '',
    slot: $('f-slot').value,
    reasonCode: state.selectedReasonCode || '',
    points: Number($('f-points').value || 1),
    note: $('f-note').value,
  };
}

function renderTodayList() {
  const date = $('f-date').value || todayIso();
  const records = state.records.filter((record) => record.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = $('today-list');
  list.innerHTML = '';
  if (!records.length) {
    list.textContent = '今天还没有扣分记录。';
    return;
  }
  for (const record of records) {
    const item = document.createElement('div');
    item.className = 'record-item';
    const location = record.locationType === 'student' ? record.studentName : `第${record.row}排第${record.seat}个`;
    item.innerHTML = `<strong>${record.grade}年级${record.classNo}班</strong> ${location} · ${record.reasonLabel} · <span class="points">-${record.points}分</span>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      if (!confirm('确定删除这条记录吗？')) return;
      state.records = state.records.filter((candidate) => candidate.id !== record.id);
      saveRecords(state.records);
      renderTodayList();
    });
    item.appendChild(remove);
    list.appendChild(item);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('is-active', panel.id === `panel-${tabName}`));
  if (tabName === 'summary') window.dispatchEvent(new CustomEvent('app:summary'));
  if (tabName === 'history') window.dispatchEvent(new CustomEvent('app:history'));
}

function initEntry() {
  fillGradeOptions();
  fillClassOptions();
  fillSlotOptions();
  $('f-date').value = todayIso();
  $('summary-date').value = todayIso();
  updateLocationFields();
  renderReasons();
  renderTodayList();

  $('f-grade').addEventListener('change', fillClassOptions);
  $('f-slot').addEventListener('change', () => {
    state.selectedReasonCode = null;
    renderReasons();
  });
  document.querySelectorAll('input[name="locationType"]').forEach((input) => input.addEventListener('change', updateLocationFields));
  $('f-date').addEventListener('change', renderTodayList);
  $('entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const message = $('entry-message');
    try {
      const record = createRecord(formDraft());
      state.records = [record, ...state.records];
      saveRecords(state.records);
      message.textContent = `已保存：${record.grade}年级${record.classNo}班 · ${record.reasonLabel}`;
      state.selectedReasonCode = null;
      $('f-note').value = '';
      $('f-points').value = '1';
      renderReasons();
      renderTodayList();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
}

initEntry();
export { state, switchTab };
```

- [ ] **Step 2: Run all unit tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Browser smoke test**

Run: `npm run serve`

Open `http://localhost:5173` and verify:

- switching among 录入 / 汇总 / 历史与备份 works
- changing grade changes class count; grade 4 shows 23 classes
- choosing `出操/升旗` changes the reason buttons
- seat mode saves “第3排第4个”, student mode saves a name
- saving moves the record into 今日记录
- deleting a record asks for confirmation and removes it

- [ ] **Step 4: Commit**

```bash
git add app.js index.html styles.css
git commit -m "feat: add deduction entry screen"
```

---

### Task 8: Build the daily summary screen and PNG export

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `summarize`, `getTotals`, `renderSummaryBlob`, `downloadBlob`.
- Produces: summary renderer and `导出当天图片` behavior.

- [ ] **Step 1: Add summary rendering to `app.js`**

Add these imports at the top:

```javascript
import { summarize, getTotals } from './js/summary.js';
import { renderSummaryBlob, downloadBlob } from './js/image-export.js';
```

Add these functions before `initEntry()`:

```javascript
function renderSummary() {
  const date = $('summary-date').value || todayIso();
  const groups = summarize(state.records, date);
  const totals = getTotals(groups);
  $('summary-total').textContent = groups.length
    ? `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级 · ${totals.entryCount}条记录`
    : '当天没有扣分记录';
  $('summary-message').textContent = '';
  const container = $('summary-groups');
  container.innerHTML = '';
  for (const group of groups) {
    const card = document.createElement('section');
    card.className = 'summary-class';
    card.innerHTML = `<h3>${group.label}（${group.totalPoints}分）</h3>`;
    for (const entry of group.entries) {
      const line = document.createElement('div');
      line.className = 'summary-entry';
      const location = entry.locationType === 'student' ? entry.studentName : `第${entry.row}排第${entry.seat}个`;
      line.innerHTML = `<span>${location} · ${entry.reasonLabel}</span><span class="points">-${entry.points}分</span>`;
      card.appendChild(line);
    }
    container.appendChild(card);
  }
}

async function exportSummaryImage() {
  const date = $('summary-date').value || todayIso();
  const groups = summarize(state.records, date);
  if (!groups.length) {
    $('summary-message').textContent = '当天没有扣分记录，暂不能导出图片。';
    return;
  }
  const blob = await renderSummaryBlob(state.records, date);
  downloadBlob(blob, `${date}-值日检查扣分情况.png`);
  $('summary-message').textContent = '图片已生成并开始下载。';
}
```

Wire the events inside `initEntry()`:

```javascript
$('summary-date').addEventListener('change', renderSummary);
$('export-image').addEventListener('click', exportSummaryImage);
window.addEventListener('app:summary', renderSummary);
```

Call `renderSummary()` once at the end of `initEntry()`, and expose it for later tasks:

```javascript
export { state, switchTab, renderSummary };
```

- [ ] **Step 2: Run all unit tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Browser test**

Run: `npm run serve`, open `http://localhost:5173`, and verify:

- only classes with deductions appear in 汇总
- changing the summary date updates the list
- a day with no records shows “当天没有扣分记录”
- 导出当天图片 downloads a PNG
- the image contains title, class subtotals, entries, and 当天合计
- no zero-deduction class appears in the image

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add daily summary and image export"
```

---

### Task 9: Build history and backup screens

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `loadRecords`, `saveRecords`, `createBackup`, `importBackup`.
- Produces: history date list, JSON export, merge import, and replace import.

- [ ] **Step 1: Extend imports**

Change the storage import to:

```javascript
import { loadRecords, saveRecords, createBackup, importBackup } from './js/storage.js';
```

- [ ] **Step 2: Add history and backup functions**

Add these functions before `initEntry()`:

```javascript
function renderHistory() {
  const dates = Array.from(new Set(state.records.map((record) => record.date))).sort().reverse();
  const container = $('history-list');
  container.innerHTML = '';
  if (!dates.length) {
    container.textContent = '还没有历史记录。';
    return;
  }
  for (const date of dates) {
    const count = state.records.filter((record) => record.date === date).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'record-item';
    button.textContent = `${date}　${count} 条记录`;
    button.addEventListener('click', () => {
      $('summary-date').value = date;
      renderSummary();
      switchTab('summary');
    });
    container.appendChild(button);
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(createBackup(state.records), null, 2)], { type: 'application/json' });
  downloadBlob(blob, `值日扣分备份-${todayIso()}.json`);
  $('history-message').textContent = '备份文件已生成。';
}

async function importBackupFile(file) {
  const text = await file.text();
  const mode = $('import-mode').value;
  if (mode === 'replace') {
    if (!confirm('覆盖会删除本机现有记录，确定继续吗？')) return;
    const parsed = JSON.parse(text);
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.records)) throw new Error('备份文件格式不正确');
    state.records = parsed.records;
    saveRecords(state.records);
    $('history-message').textContent = `已覆盖导入 ${state.records.length} 条记录。`;
  } else {
    const result = importBackup(text, state.records);
    state.records = result.records;
    saveRecords(state.records);
    $('history-message').textContent = `合并完成：新增 ${result.added} 条，跳过 ${result.skipped} 条重复记录。`;
  }
  renderHistory();
  renderTodayList();
  renderSummary();
}
```

- [ ] **Step 3: Wire events**

Inside `initEntry()` add:

```javascript
$('export-backup').addEventListener('click', exportBackup);
$('import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importBackupFile(file);
  } catch (error) {
    $('history-message').textContent = error.message;
  } finally {
    event.target.value = '';
  }
});
window.addEventListener('app:history', renderHistory);
```

Call `renderHistory()` once at the end of `initEntry()` and export it:

```javascript
export { state, switchTab, renderSummary, renderHistory };
```

- [ ] **Step 4: Run tests and browser checks**

Run: `npm test`

Then run `npm run serve` and verify:

- history lists only dates with records
- clicking a history date opens that day in 汇总
- exported backup downloads a JSON file
- merge import adds new records and skips duplicate IDs
- replace import requires confirmation and overwrites local data
- invalid JSON shows an error without changing data

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add history and backup workflow"
```

---

### Task 10: Add PWA manifest, icons, and offline cache

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `scripts/make_icons.py`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `app.js`

**Interfaces:**
- Consumes: none.
- Produces: installable PWA with offline app shell.

- [ ] **Step 1: Create the manifest**

Create `manifest.webmanifest`:

```json
{
  "name": "值日扣分记录",
  "short_name": "值日扣分",
  "lang": "zh-CN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F6F8FB",
  "theme_color": "#1E5AA8",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create the service worker**

Create `sw.js`:

```javascript
const CACHE = 'duty-deduction-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './js/reasons.js',
  './js/records.js',
  './js/storage.js',
  './js/summary.js',
  './js/image-export.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
```

- [ ] **Step 3: Generate icons**

Create `scripts/make_icons.py`:

```python
from PIL import Image, ImageDraw, ImageFont

for size in (192, 512):
    image = Image.new("RGB", (size, size), "#1E5AA8")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", int(size * 0.52))
    text = "值"
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((size - (box[2] - box[0])) / 2, (size - (box[3] - box[1])) / 2 - box[1]), text, fill="#FFFFFF", font=font)
    image.save(f"icons/icon-{size}.png")
```

Run:

```bash
mkdir -p icons
python3 scripts/make_icons.py
```

- [ ] **Step 4: Register the service worker**

Add to the end of `app.js`:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
```

- [ ] **Step 5: Test PWA and offline use**

Run: `npm run serve`

Open `http://localhost:5173`, then:

- confirm `manifest.webmanifest` loads without errors in browser devtools
- confirm the service worker registers and assets appear in Cache Storage
- switch the browser to Offline in devtools and reload; the app still opens
- on iPhone Safari, use Share then Add to Home Screen and open the installed app

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js scripts/make_icons.py icons app.js
git commit -m "feat: add PWA offline support"
```

---

### Task 11: Deploy to a static host

**Files:**
- No source files.

**Interfaces:**
- Consumes: a completed local app that passes `npm test`.
- Produces: a stable HTTPS link usable on phone and computer.

**External prerequisite:** the user must provide a host account. Preferred: GitHub account. Fallback: Netlify account.

- [ ] **Step 1: Verify the local build one last time**

Run:

```bash
npm test
npm run serve
```

Expected: tests pass and the app opens at `http://localhost:5173`.

- [ ] **Step 2: Deploy with GitHub Pages**

Ask the user for their GitHub username and an empty repository URL. Then:

```bash
git remote add origin <repository-url>
git push -u origin main
```

In the repository settings, enable Pages with:

- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

Wait for the Pages URL, then verify:

- the app opens over HTTPS on the computer
- the app opens over HTTPS on the phone
- “Add to Home Screen” installs the PWA

If the user has no GitHub account, use the fallback:

- create a Netlify account
- drag the project folder into Netlify Drop
- set the published directory to the project root
- copy the HTTPS URL and verify on both devices

- [ ] **Step 3: Record the URL**

Add the final URL to the project README:

```markdown
# 值日扣分记录

访问地址：<final-url>
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: record deployed URL"
```

---

### Task 12: Final acceptance and version tag

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-duty-deduction-app-design.md` only if acceptance reveals a mismatch

**Interfaces:**
- Consumes: deployed URL.
- Produces: verified v1.0.0.

- [ ] **Step 1: Run the acceptance checklist on both devices**

On phone and computer:

- open the deployed URL
- record a seat-based deduction with `第3排第4个`
- record a student-name deduction
- verify both appear in 今日记录
- verify the summary shows only classes with deductions
- export the daily PNG
- verify the image title, class subtotals, entries, and total
- export a JSON backup
- import the backup on the other device using 合并导入
- verify duplicate records are skipped
- install the app to the phone home screen and open it offline

- [ ] **Step 2: Record any fixes**

If any check fails, fix it, rerun `npm test`, redo the relevant browser check, and commit:

```bash
git add .
git commit -m "fix: resolve acceptance issue"
```

- [ ] **Step 3: Tag v1.0.0**

```bash
git tag -a v1.0.0 -m "值日扣分记录 v1.0.0"
git push origin main --tags
```

---

## Self-Review

Spec coverage:

- Static single-user app and manual sync: Tasks 1, 4, 9, 11.
- Phone and computer access: Tasks 10, 11, 12.
- Fixed reasons and default 1 point: Tasks 2, 3, 7.
- Vertical row/seat or student name: Tasks 3, 6, 7, 8.
- Daily summary only for classes with deductions: Tasks 5, 8.
- PNG export: Tasks 6, 8, 12.
- History and backup merge/replace: Tasks 4, 9.
- PWA/offline: Task 10.
- Acceptance and deployment: Tasks 11, 12.

Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain; the only external dependency is the user-provided hosting account in Task 11, which is an explicit prerequisite.

Type consistency: later tasks use `classCountForGrade`, `createRecord`, `updateRecord`, `loadRecords`, `saveRecords`, `createBackup`, `importBackup`, `summarize`, `getTotals`, `buildImagePlan`, `renderSummaryBlob`, and `downloadBlob` exactly as defined in earlier tasks.
