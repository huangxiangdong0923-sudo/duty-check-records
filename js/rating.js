import { lastMondayIso, parseIsoDate, toIsoDate, todayIso } from './dates.js';
import { classCountOf } from './campuses.js';
import { formatClassLabel } from './summary.js';

// 星级评比：统计范围内的值日检查扣分 + 周一升旗检查扣分。范围由老师自己选起止日期。
export const WEEKLY_FULL_SCORE = 250;

export const STAR_LEVELS = [
  { stars: 5, label: '五星班级', rule: '统计范围内没有被扣分', scoreText: '250 分' },
  { stars: 4, label: '四星班级', rule: '统计范围内扣 1–2 分', scoreText: '248–249 分' },
  { stars: 3, label: '三星班级', rule: '统计范围内扣 3 分及以上', scoreText: '247 分及以下' },
];

export const STAR_ORDER = STAR_LEVELS.map((level) => level.stars);

function moduleOf(record) {
  return record?.module === 'flag' ? 'flag' : 'daily';
}

export function weekRange(mondayIso = new Date()) {
  const start = lastMondayIso(mondayIso);
  const date = parseIsoDate(start) || new Date();
  date.setDate(date.getDate() + 4);
  return { start, end: toIsoDate(date) };
}

// 老师自己选的起止日期。填反了自动调换，填错了退回今天，保证一定是个能用的范围。
export function normalizeRange(startIso, endIso) {
  const start = parseIsoDate(startIso) ? String(startIso) : todayIso();
  const end = parseIsoDate(endIso) ? String(endIso) : start;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function countDays(range) {
  const start = parseIsoDate(range?.start);
  const end = parseIsoDate(range?.end);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function starLevelFor(deduction) {
  const value = Math.max(0, Math.round(Number(deduction) || 0));
  if (value === 0) return 5;
  if (value <= 2) return 4;
  return 3;
}

export function scoreFor(deduction) {
  const value = Math.max(0, Math.round(Number(deduction) || 0));
  return WEEKLY_FULL_SCORE - value;
}

export function rateRange(records, campus, range) {
  const activeRange = normalizeRange(range?.start, range?.end);
  const byClass = new Map();
  for (const grade of campus.grades) {
    for (let classNo = 1; classNo <= classCountOf(campus, grade); classNo += 1) {
      byClass.set(`${grade}-${classNo}`, {
        grade,
        classNo,
        label: formatClassLabel(grade, classNo),
        deduction: 0,
        dailyDeduction: 0,
        flagDeduction: 0,
        recordCount: 0,
      });
    }
  }

  const inRange = records.filter((record) => record.date >= activeRange.start && record.date <= activeRange.end);
  for (const record of inRange) {
    const entry = byClass.get(`${record.grade}-${record.classNo}`);
    if (!entry) continue;
    const points = Number(record.points || 1);
    entry.deduction += points;
    entry.recordCount += 1;
    if (moduleOf(record) === 'flag') entry.flagDeduction += points;
    else entry.dailyDeduction += points;
  }

  const classes = Array.from(byClass.values())
    .map((entry) => ({
      ...entry,
      score: scoreFor(entry.deduction),
      stars: starLevelFor(entry.deduction),
      unchecked: entry.recordCount === 0,
    }))
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo);

  const levels = STAR_LEVELS.map((level) => ({
    ...level,
    classes: classes.filter((entry) => entry.stars === level.stars),
  }));

  return {
    range: activeRange,
    campus,
    levels,
    classes,
    totals: {
      classCount: classes.length,
      recordCount: inRange.length,
      deduction: classes.reduce((sum, entry) => sum + entry.deduction, 0),
      uncheckedCount: classes.filter((entry) => entry.unchecked).length,
      starCounts: Object.fromEntries(levels.map((level) => [level.stars, level.classes.length])),
    },
  };
}

export function rateWeek(records, campus, mondayIso = new Date()) {
  return rateRange(records, campus, weekRange(mondayIso));
}
