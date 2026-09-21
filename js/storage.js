import { normalizeRecord } from './records.js';

export const STORAGE_KEY = 'duty-deduction-records-v1';
// 删除记录后留下 id 记号，云同步时才能把删除同步到其它设备。
export const TOMBSTONE_KEY = 'duty-check-tombstones-v1';

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

export function loadTombstones(storage = globalThis.localStorage) {
  const raw = storage.getItem(TOMBSTONE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function saveTombstones(ids, storage = globalThis.localStorage) {
  const unique = Array.from(new Set((ids || []).map(String))).sort();
  storage.setItem(TOMBSTONE_KEY, JSON.stringify(unique));
  return unique;
}

export function addTombstone(ids, id) {
  return Array.from(new Set([...(ids || []).map(String), String(id)])).sort();
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
