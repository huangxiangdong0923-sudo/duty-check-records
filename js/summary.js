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
