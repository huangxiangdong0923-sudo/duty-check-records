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
