const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(now = new Date()) {
  return toIsoDate(now);
}

export function lastMondayIso(from = new Date()) {
  const base = typeof from === 'string' ? parseIsoDate(from) : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (!base || Number.isNaN(base.getTime())) return todayIso();
  const daysSinceMonday = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - daysSinceMonday);
  return toIsoDate(base);
}

export function formatChipDate(iso) {
  const date = parseIsoDate(iso);
  if (!date) return String(iso || '');
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatChipDateWithWeekday(iso) {
  const date = parseIsoDate(iso);
  if (!date) return String(iso || '');
  return `${formatChipDate(iso)} ${WEEKDAY_LABELS[date.getDay()]}`;
}
