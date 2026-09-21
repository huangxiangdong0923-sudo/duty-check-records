import { GROUNDS, FLAG_REASONS, groundForGrade } from './modules.js';

const GRADE_LABELS = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级' };

function moduleOf(record) {
  return record?.module === 'flag' ? 'flag' : 'daily';
}

export function formatClassLabel(grade, classNo) {
  return `${GRADE_LABELS[grade] || `${grade}年级`}${classNo}班`;
}

export function summarize(records, date, moduleId = 'daily') {
  const filtered = records.filter((record) => record.date === date && moduleOf(record) === moduleId);
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

export function normalizeStudentNoArray(studentNos) {
  return Array.from(new Set((studentNos || []).map((value) => String(Number(value)))))
    .filter((value) => value !== 'NaN')
    .sort((a, b) => Number(a) - Number(b));
}

export function formatStudentNoList(studentNos) {
  return normalizeStudentNoArray(studentNos).join('、');
}

export function flagItemLocationText(item) {
  const nos = formatStudentNoList(item.studentNos);
  if (nos && item.classLevel) return `${nos} 号及整班`;
  if (nos) return `${nos} 号`;
  return '整班';
}

export function formatFlagItemText(item) {
  return `${item.reasonLabel}：${flagItemLocationText(item)}（${item.points}分）`;
}

function reasonOrder(code) {
  const index = FLAG_REASONS.findIndex((reason) => reason.code === code);
  return index === -1 ? FLAG_REASONS.length : index;
}

export function summarizeFlag(records, date) {
  const filtered = records.filter((record) => record.date === date && moduleOf(record) === 'flag');
  const groundMap = new Map();
  let entryCount = 0;
  for (const record of filtered) {
    entryCount += 1;
    const ground = groundForGrade(record.grade) || { code: 'unknown', label: '未分组', gradesLabel: '' };
    if (!groundMap.has(ground.code)) {
      groundMap.set(ground.code, { code: ground.code, label: ground.label, gradesLabel: ground.gradesLabel, totalPoints: 0, classMap: new Map() });
    }
    const groundGroup = groundMap.get(ground.code);
    groundGroup.totalPoints += Number(record.points || 1);

    const classKey = `${record.grade}-${record.classNo}`;
    if (!groundGroup.classMap.has(classKey)) {
      groundGroup.classMap.set(classKey, {
        grade: Number(record.grade),
        classNo: Number(record.classNo),
        label: formatClassLabel(Number(record.grade), Number(record.classNo)),
        totalPoints: 0,
        itemMap: new Map(),
      });
    }
    const classGroup = groundGroup.classMap.get(classKey);
    classGroup.totalPoints += Number(record.points || 1);

    const reasonKey = record.reasonCode || 'unknown';
    if (!classGroup.itemMap.has(reasonKey)) {
      classGroup.itemMap.set(reasonKey, {
        reasonCode: reasonKey,
        reasonLabel: record.reasonLabel || '未填写原因',
        studentNos: [],
        classLevel: false,
        points: 0,
        count: 0,
      });
    }
    const item = classGroup.itemMap.get(reasonKey);
    const nos = (record.studentNos || []).map((value) => String(Number(value)));
    if (nos.length) item.studentNos.push(...nos);
    else item.classLevel = true;
    item.points += Number(record.points || 1);
    item.count += 1;
  }

  const groundOrder = [...GROUNDS.map((ground) => ground.code), 'unknown'];
  const grounds = Array.from(groundMap.values())
    .sort((a, b) => groundOrder.indexOf(a.code) - groundOrder.indexOf(b.code))
    .map((ground) => ({
      code: ground.code,
      label: ground.label,
      gradesLabel: ground.gradesLabel,
      totalPoints: ground.totalPoints,
      classes: Array.from(ground.classMap.values())
        .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
        .map((classGroup) => ({
          grade: classGroup.grade,
          classNo: classGroup.classNo,
          label: classGroup.label,
          totalPoints: classGroup.totalPoints,
          items: Array.from(classGroup.itemMap.values())
            .sort((a, b) => reasonOrder(a.reasonCode) - reasonOrder(b.reasonCode) || a.reasonCode.localeCompare(b.reasonCode))
            .map((item) => ({ ...item, studentNos: normalizeStudentNoArray(item.studentNos) })),
        })),
    }));

  const totals = {
    totalPoints: grounds.reduce((sum, ground) => sum + ground.totalPoints, 0),
    classCount: grounds.reduce((sum, ground) => sum + ground.classes.length, 0),
    entryCount,
  };
  return { grounds, totals };
}
