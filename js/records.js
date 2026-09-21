import { getReasonForModule, getSlotsForModule } from './modules.js';
import { DEFAULT_CAMPUS, classCountOf, getCampus } from './campuses.js';

export const MAX_STUDENT_NOS = 20;

export function classCountForGrade(grade, campus = DEFAULT_CAMPUS) {
  return classCountOf(campus, grade);
}

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function moduleOf(value) {
  return value === 'flag' ? 'flag' : 'daily';
}

function studentNoTokens(raw) {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '')
    .split(/[\s,，、;；/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeStudentNo(token) {
  if (!/^\d{1,4}$/.test(token)) return null;
  const value = Number(token);
  if (value < 1 || value > 999) return null;
  return String(value);
}

export function findInvalidStudentNos(raw) {
  return studentNoTokens(raw).filter((token) => normalizeStudentNo(token) === null);
}

export function parseStudentNos(raw) {
  const seen = new Set();
  for (const token of studentNoTokens(raw)) {
    const value = normalizeStudentNo(token);
    if (value) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => Number(a) - Number(b));
}

export function defaultPointsFor(studentNos) {
  const count = parseStudentNos(studentNos).length;
  return count > 0 ? count : 1;
}

export function normalizeRecord(input) {
  return {
    id: String(input.id || makeId()),
    campus: getCampus(input.campus).id,
    module: moduleOf(input.module),
    date: String(input.date || ''),
    grade: Number(input.grade),
    classNo: Number(input.classNo),
    locationType: input.locationType === 'student' ? 'student' : input.locationType === 'studentNo' ? 'studentNo' : 'seat',
    row: input.row === null || input.row === '' ? null : Number(input.row),
    seat: input.seat === null || input.seat === '' ? null : Number(input.seat),
    studentName: String(input.studentName || '').trim(),
    studentNos: parseStudentNos(input.studentNos),
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
  const moduleId = moduleOf(draft.module);
  const campus = getCampus(draft.campus);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || ''))) errors.push('日期格式应为 YYYY-MM-DD');
  if (!campus.grades.includes(Number(draft.grade))) {
    errors.push(`${campus.label}的年级只能是${campus.grades.map((grade) => `${grade}年级`).join('、')}`);
  }
  const maxClass = classCountForGrade(Number(draft.grade), campus);
  if (!Number.isInteger(Number(draft.classNo)) || Number(draft.classNo) < 1 || Number(draft.classNo) > maxClass) {
    errors.push(`班级必须是 1-${maxClass} 班`);
  }
  if (moduleId === 'flag') {
    const invalid = findInvalidStudentNos(draft.studentNos);
    if (invalid.length) errors.push(`学号必须是 1-3 位数字：${invalid.join('、')}`);
    if (studentNoTokens(draft.studentNos).length > MAX_STUDENT_NOS) errors.push(`一次最多登记 ${MAX_STUDENT_NOS} 个学号`);
  } else {
    if (draft.locationType === 'student') {
      if (!String(draft.studentName || '').trim()) errors.push('请填写学生姓名');
    } else {
      if (!Number.isInteger(Number(draft.row)) || Number(draft.row) < 1) errors.push('第几排必须是正整数');
      if (!Number.isInteger(Number(draft.seat)) || Number(draft.seat) < 1) errors.push('第几个必须是正整数');
    }
  }
  if (!getSlotsForModule(moduleId).some((slot) => slot.code === draft.slot)) errors.push('请选择检查时间');
  const reason = getReasonForModule(moduleId, draft.reasonCode);
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
  const reason = getReasonForModule(moduleOf(draft.module), draft.reasonCode);
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
