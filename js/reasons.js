export const SLOTS = [
  { code: 'morning', label: '上午检查' },
  { code: 'afternoon', label: '下午检查' },
  { code: 'exercise', label: '出操/升旗' },
  { code: 'break', label: '课间' },
  { code: 'eye', label: '眼保健操' },
];

export const REASONS = [
  { code: 'floor-garbage-am', slot: 'morning', label: '地面有比拳头大的垃圾、水杯或绳子' },
  { code: 'trash-bin-am', slot: 'morning', label: '垃圾桶未套袋或过满' },
  { code: 'desk-doodle-am', slot: 'morning', label: '桌面乱涂乱画严重' },
  { code: 'cabinet-am', slot: 'morning', label: '柜子物品摆放不整齐' },
  { code: 'bag-am', slot: 'morning', label: '书包没有放在柜子里' },
  { code: 'floor-garbage-pm', slot: 'afternoon', label: '地面有垃圾、水杯或绳子' },
  { code: 'trash-bin-pm', slot: 'afternoon', label: '垃圾桶未套袋或过满' },
  { code: 'desk-doodle-pm', slot: 'afternoon', label: '桌面乱涂乱画严重' },
  { code: 'cabinet-pm', slot: 'afternoon', label: '柜子物品摆放不整齐' },
  { code: 'bag-pm', slot: 'afternoon', label: '书包没有放在柜子里' },
  { code: 'fan-light', slot: 'exercise', label: '教室内风扇或电灯未关' },
  { code: 'flag-late', slot: 'exercise', label: '升旗仪式无故迟到' },
  { code: 'absent-exercise', slot: 'exercise', label: '无故不出操' },
  { code: 'exercise-play', slot: 'exercise', label: '因身体不适留在教室却打闹' },
  { code: 'corridor-play', slot: 'break', label: '爬栏杆、追逐打闹、大声喧哗或躺地打滚' },
  { code: 'litter', slot: 'break', label: '在室外走廊和公共区域随意扔垃圾' },
  { code: 'damage-public', slot: 'break', label: '损坏公物' },
  { code: 'eye-not-do', slot: 'eye', label: '提醒一次仍不做眼保健操' },
  { code: 'eye-not-serious', slot: 'eye', label: '做眼保健操不认真' },
  { code: 'talk-back', slot: 'any', label: '顶撞、挑衅值日生' },
  { code: 'rule-violation', slot: 'any', label: '违反值日细则且已告知班长登记' },
  { code: 'other', slot: 'any', label: '其他情况（需备注）', requiresNote: true },
];

export function getReasonsForSlot(slot) {
  return REASONS.filter((reason) => reason.slot === slot || reason.slot === 'any');
}

export function getReasonByCode(code) {
  return REASONS.find((reason) => reason.code === code) || null;
}
