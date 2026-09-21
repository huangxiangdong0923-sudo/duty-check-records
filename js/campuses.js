// 每个校区一份配置：年级范围、各班数量、操场划分。
// 新增校区只要在这里加一条，再按 scripts/build_campus_pages.mjs 生成入口页。

export const CAMPUSES = [
  {
    id: 'east',
    label: '东校区',
    shortLabel: '值日检查',
    grades: [1, 2, 3, 4],
    classCounts: { 1: 18, 2: 18, 3: 18, 4: 23 },
    grounds: [
      { code: 'jinlun', label: '金轮操场', gradesLabel: '一、四年级', grades: [1, 4] },
      { code: 'yuetu', label: '玉兔操场', gradesLabel: '二、三年级', grades: [2, 3] },
    ],
  },
  {
    id: 'south',
    label: '南校区',
    shortLabel: '值日检查南',
    grades: [5, 6],
    // TODO: 待老师确认南校区五、六年级各自的班级数
    classCounts: { 5: 6, 6: 6 },
    grounds: [
      { code: 'south-field', label: '操场', gradesLabel: '五、六年级', grades: [5, 6] },
    ],
  },
];

export const DEFAULT_CAMPUS = CAMPUSES[0];

export function getCampus(campusId) {
  return CAMPUSES.find((campus) => campus.id === campusId) || DEFAULT_CAMPUS;
}

export function detectCampusId(pathname = globalThis.location?.pathname || '/') {
  const match = /\/campus\/([a-z0-9-]+)\//i.exec(String(pathname));
  if (match) return match[1];
  return DEFAULT_CAMPUS.id;
}

export function gradesOf(campus) {
  return campus.grades.slice();
}

export function classCountOf(campus, grade) {
  return campus.classCounts[Number(grade)] || 0;
}

export function groundOfGrade(campus, grade) {
  const value = Number(grade);
  return campus.grounds.find((ground) => ground.grades.includes(value)) || null;
}

export function filterByCampus(records, campusId) {
  return records.filter((record) => getCampus(record.campus).id === getCampus(campusId).id);
}
