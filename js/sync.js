// 云同步：把记录存到自己的私有 GitHub 仓库，手机和电脑共用同一份数据。
import { normalizeRecord } from './records.js';

export const SYNC_SETTINGS_KEY = 'duty-check-sync-settings-v1';
export const SYNC_SCHEMA_VERSION = 1;

export const DEFAULT_SYNC_TARGET = Object.freeze({
  owner: 'huangxiangdong0923-sudo',
  repo: 'duty-check-data',
  path: 'records.json',
  branch: 'main',
  apiBase: 'https://api.github.com',
});

export class SyncConflictError extends Error {
  constructor(message = '云端数据刚刚被另一台设备更新过') {
    super(message);
    this.name = 'SyncConflictError';
  }
}

export function emptySyncSettings() {
  return { ...DEFAULT_SYNC_TARGET, token: '', lastSyncedAt: '' };
}

export function hasSyncToken(settings) {
  return Boolean(String(settings?.token || '').trim());
}

export function loadSyncSettings(storage = globalThis.localStorage) {
  const raw = storage.getItem(SYNC_SETTINGS_KEY);
  if (!raw) return emptySyncSettings();
  try {
    const parsed = JSON.parse(raw);
    return {
      ...emptySyncSettings(),
      ...parsed,
      token: typeof parsed?.token === 'string' ? parsed.token : '',
    };
  } catch {
    return emptySyncSettings();
  }
}

export function saveSyncSettings(settings, storage = globalThis.localStorage) {
  const next = { ...emptySyncSettings(), ...settings };
  storage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function timestampOf(record) {
  const value = Date.parse(record?.updatedAt || record?.createdAt || '');
  return Number.isFinite(value) ? value : 0;
}

function tombstoneSet(...sources) {
  const ids = new Set();
  for (const source of sources) {
    for (const id of source || []) ids.add(String(id));
  }
  return ids;
}

export function sortRecords(records) {
  return [...records].sort((a, b) => {
    const byCreated = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (byCreated !== 0) return byCreated;
    return String(a.id).localeCompare(String(b.id));
  });
}

// 两边都有的同一条记录，以 updatedAt 较新的为准；被删除过的 id 一律不保留。
export function mergeLocalAndCloud(local, cloud) {
  const deleted = tombstoneSet(local?.deletedIds, cloud?.deletedIds);
  const byId = new Map();
  for (const record of cloud?.records || []) byId.set(record.id, record);
  for (const record of local?.records || []) {
    const existing = byId.get(record.id);
    if (!existing || timestampOf(record) > timestampOf(existing)) byId.set(record.id, record);
  }
  const records = [];
  for (const [id, record] of byId) {
    if (!deleted.has(id)) records.push(record);
  }
  return { records: sortRecords(records), deletedIds: Array.from(deleted).sort() };
}

export function buildCloudPayload(state, nowIso = new Date().toISOString()) {
  const records = (state?.records || []).map(normalizeRecord);
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: nowIso,
    records: sortRecords(records),
    deletedIds: Array.from(tombstoneSet(state?.deletedIds)).sort(),
  };
}

export function parseCloudPayload(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (data?.schemaVersion !== SYNC_SCHEMA_VERSION || !Array.isArray(data.records)) {
    throw new Error('云端数据格式不正确');
  }
  return {
    records: data.records.map(normalizeRecord),
    deletedIds: Array.from(tombstoneSet(data.deletedIds)).sort(),
  };
}

export function fingerprint(state) {
  return JSON.stringify({
    records: sortRecords((state?.records || []).map(normalizeRecord)).sort((a, b) => a.id.localeCompare(b.id)),
    deletedIds: Array.from(tombstoneSet(state?.deletedIds)).sort(),
  });
}

export function isSameState(a, b) {
  return fingerprint(a) === fingerprint(b);
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return globalThis.btoa(binary);
}

function decodeBase64(base64) {
  const binary = globalThis.atob(String(base64).replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function contentsUrl(settings) {
  const base = String(settings.apiBase || DEFAULT_SYNC_TARGET.apiBase).replace(/\/+$/, '');
  return `${base}/repos/${settings.owner}/${settings.repo}/contents/${settings.path}`;
}

function authHeaders(settings) {
  return {
    Authorization: `Bearer ${String(settings.token || '').trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function describeHttpError(status, action) {
  if (status === 401) return new Error('令牌无效或已过期，请重新生成并粘贴');
  if (status === 403) return new Error('令牌没有读写权限，请检查令牌的仓库和权限设置');
  if (status === 404) return new Error('找不到云端仓库，请检查令牌能访问的仓库');
  return new Error(`${action}失败（HTTP ${status}）`);
}

export async function fetchCloudState(settings, fetchImpl = globalThis.fetch) {
  const branch = encodeURIComponent(settings.branch || DEFAULT_SYNC_TARGET.branch);
  const response = await fetchImpl(`${contentsUrl(settings)}?ref=${branch}`, {
    method: 'GET',
    headers: authHeaders(settings),
    cache: 'no-store',
  });
  if (response.status === 404) return { sha: null, payload: { records: [], deletedIds: [] }, exists: false };
  if (!response.ok) throw describeHttpError(response.status, '读取云端');
  const body = await response.json();
  const payload = parseCloudPayload(body.content ? decodeBase64(body.content) : { schemaVersion: SYNC_SCHEMA_VERSION, records: [] });
  return { sha: body.sha || null, payload, exists: true, updatedAt: body.commit?.committer?.date || '' };
}

export async function putCloudState(settings, payload, sha, fetchImpl = globalThis.fetch) {
  const body = {
    message: `更新值日检查记录 ${payload.updatedAt}`,
    content: encodeBase64(`${JSON.stringify(payload, null, 2)}\n`),
    branch: settings.branch || DEFAULT_SYNC_TARGET.branch,
  };
  if (sha) body.sha = sha;
  const response = await fetchImpl(contentsUrl(settings), {
    method: 'PUT',
    headers: { ...authHeaders(settings), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if ([400, 409, 422].includes(response.status)) throw new SyncConflictError();
  if (!response.ok) throw describeHttpError(response.status, '上传云端');
  const data = await response.json();
  return { sha: data?.content?.sha || sha || null };
}

// 拉取云端 → 合并 → 需要时推回云端；被别人抢先更新时自动重试一次。
export async function syncNow({ settings, local, fetchImpl = globalThis.fetch, nowIso }) {
  const remote = await fetchCloudState(settings, fetchImpl);
  let merged = mergeLocalAndCloud(local, remote.payload);
  const changedLocally = !isSameState(local, merged);

  if (isSameState(merged, remote.payload)) {
    return { ...merged, uploaded: false, changedLocally };
  }

  const stamp = nowIso || new Date().toISOString();
  try {
    const { sha } = await putCloudState(settings, buildCloudPayload(merged, stamp), remote.sha, fetchImpl);
    return { ...merged, uploaded: true, changedLocally, sha };
  } catch (error) {
    if (!(error instanceof SyncConflictError)) throw error;
    const retry = await fetchCloudState(settings, fetchImpl);
    merged = mergeLocalAndCloud(merged, retry.payload);
    const { sha } = await putCloudState(settings, buildCloudPayload(merged, stamp), retry.sha, fetchImpl);
    return { ...merged, uploaded: true, changedLocally: true, sha, retried: true };
  }
}

export function formatClock(iso, date = new Date()) {
  const value = iso ? new Date(iso) : date;
  if (Number.isNaN(value.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
