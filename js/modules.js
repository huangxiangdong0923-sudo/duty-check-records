import { SLOTS, getReasonsForSlot, getReasonByCode } from './reasons.js';
import { DEFAULT_CAMPUS, groundOfGrade } from './campuses.js';

export function groundForGrade(grade, campus = DEFAULT_CAMPUS) {
  return groundOfGrade(campus, grade);
}

export const FLAG_SLOT = { code: 'flag', label: '升旗仪式' };

export const FLAG_REASONS = [
  { code: 'flag-scarf', label: '未佩戴红领巾' },
  { code: 'flag-uniform', label: '未穿着规范校服' },
  { code: 'flag-shoes', label: '未穿黑鞋子' },
  { code: 'flag-late-stay', label: '升旗仪式迟到或逗留在班级' },
  { code: 'flag-other', label: '其他情况（需备注）', requiresNote: true },
];

export const MODULES = [
  {
    id: 'daily',
    label: '日常值日检查',
    shortLabel: '日常值日',
    locationType: 'seatOrStudent',
    groupByGround: false,
    imageSuffix: '值日检查扣分情况',
  },
  {
    id: 'flag',
    label: '周一升旗检查',
    shortLabel: '周一升旗',
    locationType: 'studentNo',
    groupByGround: true,
    imageSuffix: '升旗检查扣分情况',
  },
];

export function getModule(moduleId) {
  return MODULES.find((module) => module.id === moduleId) || MODULES[0];
}

export function getSlotsForModule(moduleId) {
  return moduleId === 'flag' ? [FLAG_SLOT] : SLOTS;
}

export function getReasonsForModule(moduleId, slot) {
  return moduleId === 'flag' ? FLAG_REASONS : getReasonsForSlot(slot);
}

export function getReasonForModule(moduleId, code) {
  if (moduleId === 'flag') return FLAG_REASONS.find((reason) => reason.code === code) || null;
  return getReasonByCode(code);
}
