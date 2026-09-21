import { summarize, getTotals, summarizeFlag, formatFlagItemText } from './summary.js';

function formatDateTitle(date, suffix = '值日检查扣分情况') {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日${suffix}`;
}

function locationText(record) {
  if (record.locationType === 'student') return record.studentName || '学生';
  return `第${record.row}排第${record.seat}个`;
}

export function buildImagePlan(records, date, options = {}) {
  const groups = summarize(records, date, 'daily');
  if (!groups.length) return null;
  const width = options.width || 1080;
  const padding = options.padding || 64;
  const rows = [];
  let y = padding + 20;
  const push = (row) => {
    rows.push({ ...row, y });
    y += row.height;
  };
  push({ type: 'title', text: formatDateTitle(date), x: width / 2, y, height: 70, size: 44, weight: 700, color: '#1F2937', align: 'center' });
  y += 16;
  for (const group of groups) {
    push({ type: 'class', text: `${group.label}（${group.totalPoints}分）`, x: padding, y, height: 54, size: 30, weight: 700, color: '#1E5AA8', align: 'left' });
    for (const entry of group.entries) {
      push({
        type: 'entry',
        text: `${locationText(entry)} · ${entry.reasonLabel} · -${entry.points}分`,
        x: padding + 24,
        y,
        height: 42,
        size: 24,
        weight: 400,
        color: '#1F2937',
        align: 'left',
      });
    }
    y += 12;
  }
  const totals = getTotals(groups);
  push({ type: 'total', text: `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级`, x: padding, y, height: 58, size: 28, weight: 700, color: '#C00000', align: 'left' });
  return { width, height: Math.ceil(y + padding), rows, groups, totals };
}

export function buildFlagImagePlan(records, date, options = {}) {
  const { grounds, totals } = summarizeFlag(records, date);
  if (!grounds.length) return null;
  const width = options.width || 1080;
  const padding = options.padding || 64;
  const rows = [];
  let y = padding + 20;
  const push = (row) => {
    rows.push({ ...row, y });
    y += row.height;
  };
  push({ type: 'title', text: formatDateTitle(date, '升旗检查扣分情况'), x: width / 2, y, height: 70, size: 44, weight: 700, color: '#1F2937', align: 'center' });
  y += 16;
  for (const ground of grounds) {
    push({
      type: 'ground',
      text: ground.gradesLabel ? `${ground.label}（${ground.gradesLabel}）` : ground.label,
      x: padding,
      y,
      height: 56,
      size: 32,
      weight: 700,
      color: '#C2410C',
      align: 'left',
    });
    for (const classGroup of ground.classes) {
      push({
        type: 'class',
        text: `${classGroup.label}（${classGroup.totalPoints}分）`,
        x: padding + 24,
        y,
        height: 50,
        size: 28,
        weight: 700,
        color: '#1E5AA8',
        align: 'left',
      });
      for (const item of classGroup.items) {
        push({
          type: 'entry',
          text: formatFlagItemText(item),
          x: padding + 56,
          y,
          height: 42,
          size: 24,
          weight: 400,
          color: '#1F2937',
          align: 'left',
        });
      }
    }
    y += 16;
  }
  push({ type: 'total', text: `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级`, x: padding, y, height: 58, size: 28, weight: 700, color: '#C00000', align: 'left' });
  return { width, height: Math.ceil(y + padding), rows, grounds, totals };
}

export function drawImagePlan(canvas, plan) {
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  for (const row of plan.rows) {
    ctx.fillStyle = row.color;
    ctx.textAlign = row.align;
    ctx.font = `${row.weight} ${row.size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText(row.text, row.x, row.y);
  }
  return canvas;
}

export function renderSummaryBlob(records, date, moduleId = 'daily') {
  const plan = moduleId === 'flag' ? buildFlagImagePlan(records, date) : buildImagePlan(records, date);
  if (!plan) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  drawImagePlan(canvas, plan);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
