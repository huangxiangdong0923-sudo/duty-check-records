import test from 'node:test';
import assert from 'node:assert/strict';
import { addTombstone, loadTombstones, saveTombstones } from '../js/storage.js';
import {
  SyncConflictError,
  buildCloudPayload,
  emptySyncSettings,
  fetchCloudState,
  formatClock,
  hasSyncToken,
  isSameState,
  loadSyncSettings,
  mergeLocalAndCloud,
  parseCloudPayload,
  putCloudState,
  saveSyncSettings,
  syncNow,
} from '../js/sync.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function record(id, overrides = {}) {
  return {
    id, campus: 'east', module: 'daily', date: '2026-09-21', grade: 3, classNo: 2,
    locationType: 'seat', row: 2, seat: 3, studentName: '', studentNos: [],
    slot: 'morning', reasonCode: 'floor-garbage-am', reasonLabel: '地面有垃圾',
    points: 1, note: '',
    createdAt: '2026-09-21T01:00:00.000Z', updatedAt: '2026-09-21T01:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function encode(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

function decode(base64) {
  return Buffer.from(base64, 'base64').toString('utf8');
}

// 模拟 GitHub contents API：GET 读文件，PUT 按 sha 做乐观并发控制。
// externalWrite 用来模拟「我们读完文件后，另一台设备抢先写了一次」。
function fakeGithub({ initial = null, externalWrite = null } = {}) {
  let file = initial ? { text: JSON.stringify(initial), sha: 'sha-1' } : null;
  let pendingExternal = externalWrite;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ method, url, body: options.body ? JSON.parse(options.body) : null, headers: options.headers });
    if (method === 'GET') {
      if (!file) return jsonResponse({ message: 'Not Found' }, 404);
      return jsonResponse({ sha: file.sha, content: encode(file.text) });
    }
    const body = options.body ? JSON.parse(options.body) : {};
    if (pendingExternal) {
      file = { text: JSON.stringify(pendingExternal), sha: `sha-external-${calls.length}` };
      pendingExternal = null;
    }
    if (file && body.sha !== file.sha) return jsonResponse({ message: 'sha mismatch' }, 409);
    file = { text: decode(body.content), sha: `sha-${calls.length}` };
    return jsonResponse({ content: { sha: file.sha } });
  };
  return {
    fetchImpl,
    calls,
    read: () => (file ? JSON.parse(file.text) : null),
    putCount: () => calls.filter((call) => call.method === 'PUT').length,
  };
}

const settings = { ...emptySyncSettings(), token: 'token-abc' };

test('settings round-trip keeps the token only when saved', () => {
  const storage = memoryStorage();
  assert.equal(hasSyncToken(loadSyncSettings(storage)), false);
  saveSyncSettings({ ...settings, lastSyncedAt: '2026-09-21T02:00:00.000Z' }, storage);
  const loaded = loadSyncSettings(storage);
  assert.equal(loaded.token, 'token-abc');
  assert.equal(loaded.repo, 'duty-check-data');
  assert.equal(loaded.lastSyncedAt, '2026-09-21T02:00:00.000Z');
  assert.equal(hasSyncToken(loadSyncSettings(memoryStorage({ 'duty-check-sync-settings-v1': 'not json' }))), false);
});

test('tombstones are stored sorted and unique', () => {
  const storage = memoryStorage();
  const ids = saveTombstones(addTombstone(addTombstone([], 'r2'), 'r1'), storage);
  assert.deepEqual(ids, ['r1', 'r2']);
  assert.deepEqual(loadTombstones(storage), ['r1', 'r2']);
  assert.deepEqual(loadTombstones(memoryStorage({ 'duty-check-tombstones-v1': 'oops' })), []);
});

test('merge keeps records from both sides', () => {
  const merged = mergeLocalAndCloud(
    { records: [record('r1')], deletedIds: [] },
    { records: [record('r2')], deletedIds: [] },
  );
  assert.deepEqual(merged.records.map((item) => item.id).sort(), ['r1', 'r2']);
});

test('merge prefers the newer version of the same record', () => {
  const merged = mergeLocalAndCloud(
    { records: [record('r1', { points: 2, updatedAt: '2026-09-21T05:00:00.000Z' })], deletedIds: [] },
    { records: [record('r1', { points: 5, updatedAt: '2026-09-21T04:00:00.000Z' })], deletedIds: [] },
  );
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].points, 2);

  const reversed = mergeLocalAndCloud(
    { records: [record('r1', { points: 2, updatedAt: '2026-09-21T03:00:00.000Z' })], deletedIds: [] },
    { records: [record('r1', { points: 5, updatedAt: '2026-09-21T04:00:00.000Z' })], deletedIds: [] },
  );
  assert.equal(reversed.records[0].points, 5);
});

test('deleted ids win over both sides', () => {
  const merged = mergeLocalAndCloud(
    { records: [record('r1')], deletedIds: ['r2'] },
    { records: [record('r1'), record('r2')], deletedIds: [] },
  );
  assert.deepEqual(merged.records.map((item) => item.id), ['r1']);
  assert.deepEqual(merged.deletedIds, ['r2']);
});

test('cloud payload round-trips Chinese text', () => {
  const payload = buildCloudPayload({
    records: [record('r1', { studentName: '张小明', note: '靠窗第三排' })],
    deletedIds: ['r9'],
  }, '2026-09-21T06:00:00.000Z');
  const parsed = parseCloudPayload(JSON.stringify(payload));
  assert.equal(parsed.records[0].studentName, '张小明');
  assert.equal(parsed.records[0].note, '靠窗第三排');
  assert.deepEqual(parsed.deletedIds, ['r9']);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.updatedAt, '2026-09-21T06:00:00.000Z');
  assert.throws(() => parseCloudPayload('{"schemaVersion":9}'), /云端数据格式不正确/);
});

test('same-state detection ignores record order', () => {
  const a = { records: [record('r1'), record('r2')], deletedIds: ['r3'] };
  const b = { records: [record('r2'), record('r1')], deletedIds: ['r3'] };
  assert.equal(isSameState(a, b), true);
  assert.equal(isSameState(a, { ...b, deletedIds: [] }), false);
});

test('fetchCloudState returns an empty payload when the file does not exist yet', async () => {
  const github = fakeGithub();
  const state = await fetchCloudState(settings, github.fetchImpl);
  assert.equal(state.exists, false);
  assert.equal(state.sha, null);
  assert.deepEqual(state.payload, { records: [], deletedIds: [] });
});

test('fetch and put keep UTF-8 intact and target the configured branch', async () => {
  const github = fakeGithub({ initial: buildCloudPayload({ records: [record('r1', { studentName: '李小红' })], deletedIds: [] }) });
  const state = await fetchCloudState(settings, github.fetchImpl);
  assert.equal(state.payload.records[0].studentName, '李小红');
  assert.match(github.calls[0].url, /\?ref=main$/);
  assert.equal(github.calls[0].headers.Authorization, 'Bearer token-abc');

  await putCloudState(settings, buildCloudPayload({ records: [record('r2', { note: '第二排第三座' })], deletedIds: [] }, '2026-09-21T07:00:00.000Z'), state.sha, github.fetchImpl);
  assert.equal(github.read().records[0].note, '第二排第三座');
  assert.match(github.calls.at(-1).url, /\/contents\/records\.json$/);
  assert.equal(github.calls.at(-1).body.branch, 'main');
});

test('put requires the latest sha, otherwise it reports a conflict', async () => {
  const github = fakeGithub({ initial: buildCloudPayload({ records: [record('r1')], deletedIds: [] }) });
  assert.equal(github.calls.length, 0);
  await assert.rejects(
    () => putCloudState(settings, buildCloudPayload({ records: [record('r2')], deletedIds: [] }), 'sha-wrong', github.fetchImpl),
    SyncConflictError,
  );
});

test('sync uploads when both sides changed and skips the upload when nothing changed', async () => {
  const github = fakeGithub({ initial: buildCloudPayload({ records: [record('r1')], deletedIds: [] }) });
  const result = await syncNow({
    settings,
    local: { records: [record('r2')], deletedIds: [] },
    fetchImpl: github.fetchImpl,
    nowIso: '2026-09-21T08:00:00.000Z',
  });
  assert.equal(result.uploaded, true);
  assert.deepEqual(result.records.map((item) => item.id).sort(), ['r1', 'r2']);
  assert.equal(github.read().records.length, 2);
  assert.equal(github.read().updatedAt, '2026-09-21T08:00:00.000Z');

  const before = github.calls.length;
  const second = await syncNow({ settings, local: { records: result.records, deletedIds: [] }, fetchImpl: github.fetchImpl });
  assert.equal(second.uploaded, false);
  assert.equal(github.calls.length, before + 1);
});

test('sync retries once when another device wrote first', async () => {
  const github = fakeGithub({
    initial: buildCloudPayload({ records: [record('r1')], deletedIds: [] }),
    externalWrite: buildCloudPayload({ records: [record('r1'), record('r3')], deletedIds: [] }),
  });
  const result = await syncNow({
    settings,
    local: { records: [record('r2')], deletedIds: [] },
    fetchImpl: github.fetchImpl,
    nowIso: '2026-09-21T09:00:00.000Z',
  });
  assert.equal(result.retried, true);
  assert.equal(github.putCount(), 2);
  assert.deepEqual(github.read().records.map((item) => item.id).sort(), ['r1', 'r2', 'r3']);
});

test('http failures become readable Chinese messages', async () => {
  const unauthorized = async () => jsonResponse({ message: 'Bad credentials' }, 401);
  await assert.rejects(() => fetchCloudState(settings, unauthorized), /令牌无效或已过期/);
  const forbidden = async () => jsonResponse({ message: 'Forbidden' }, 403);
  await assert.rejects(() => fetchCloudState(settings, forbidden), /没有读写权限/);
  const forbiddenPut = async () => jsonResponse({ message: 'Forbidden' }, 403);
  await assert.rejects(() => putCloudState(settings, buildCloudPayload({ records: [], deletedIds: [] }), null, forbiddenPut), /没有读写权限/);
});

test('formatClock shows a readable sync time', () => {
  assert.match(formatClock('2026-09-21T09:05:00.000+08:00'), /^09-21 \d{2}:\d{2}$/);
  assert.match(formatClock('', new Date('2026-09-21T09:05:00+08:00')), /^09-21 \d{2}:\d{2}$/);
  assert.equal(formatClock('not a date'), '');
});
