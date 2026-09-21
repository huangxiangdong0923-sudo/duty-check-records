import { summarize, getTotals, summarizeFlag, formatFlagItemText } from './summary.js';
import { WEEKLY_FULL_SCORE, rateWeek } from './rating.js';

function formatDateTitle(date, suffix = '值日检查扣分情况') {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日${suffix}`;
}

function locationText(record) {
  if (record.locationType === 'student') return record.studentName || '学生';
  return `第${record.row}排第${record.seat}个`;
}

export function wrapText(text, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars < 4 || text.length <= maxChars) return [text];
  const lines = [];
  let current = '';
  for (const [index, piece] of text.split('、').entries()) {
    const chunk = index === 0 ? piece : `、${piece}`;
    if (current && current.length + chunk.length > maxChars) {
      lines.push(`${current}、`);
      current = chunk.replace(/^、/, '');
    } else {
      current += chunk;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapTokens(tokens, maxChars, separator = '  ') {
  const lines = [];
  let current = '';
  for (const token of tokens) {
    const candidate = current ? `${current}${separator}${token}` : token;
    if (current && candidate.length > maxChars) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildRatingImagePlan(records, campus, mondayIso, options = {}) {
  const rating = rateWeek(records, campus, mondayIso);
  const width = options.width || 1080;
  const padding = options.padding || 64;
  const rows = [];
  let y = padding + 20;
  const push = (row) => {
    rows.push({ ...row, y });
    y += row.height;
  };
  push({
    type: 'title',
    text: `${formatDateTitle(rating.range.start, '')}–${formatDateTitle(rating.range.end, '')}星级班级评比`,
    x: width / 2,
    y,
    height: 70,
    size: 44,
    weight: 700,
    color: '#1F2937',
    align: 'center',
  });
  push({
    type: 'subtitle',
    text: `${campus.label} · 满分 ${WEEKLY_FULL_SCORE} 分`,
    x: width / 2,
    y,
    height: 46,
    size: 26,
    weight: 400,
    color: '#64748B',
    align: 'center',
  });
  y += 16;

  const indent = padding;
  const maxChars = Math.max(12, Math.floor((width - indent - padding) / 24));
  for (const level of rating.levels) {
    push({
      type: 'level',
      text: `${level.label}　${level.classes.length} 个（${level.scoreText}）`,
      x: padding,
      y,
      height: 54,
      size: 30,
      weight: 700,
      color: level.stars === 5 ? '#C2410C' : level.stars === 4 ? '#1E5AA8' : '#1F2937',
      align: 'left',
    });
    const tokens = level.classes.length
      ? level.classes.map((entry) => (level.stars === 5 ? entry.label : `${entry.label}（-${entry.deduction}）`))
      : ['无'];
    for (const line of wrapTokens(tokens, maxChars)) {
      push({
        type: 'entry',
        text: line,
        x: padding + 24,
        y,
        height: 42,
        size: 24,
        weight: 400,
        color: '#1F2937',
        align: 'left',
      });
    }
    y += 14;
  }

  push({
    type: 'total',
    text: `共 ${rating.totals.classCount} 个班级 · 本周合计扣 ${rating.totals.deduction} 分 · ${rating.totals.recordCount} 条检查记录`,
    x: padding,
    y,
    height: 58,
    size: 26,
    weight: 700,
    color: '#C00000',
    align: 'left',
  });
  return { width, height: Math.ceil(y + padding), rows, rating };
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
        const indent = padding + 56;
        const maxChars = Math.max(12, Math.floor((width - indent - padding) / 24));
        for (const [index, line] of wrapText(formatFlagItemText(item), maxChars).entries()) {
          push({
            type: 'entry',
            text: line,
            x: index === 0 ? indent : indent + 24,
            y,
            height: 42,
            size: 24,
            weight: 400,
            color: '#1F2937',
            align: 'left',
          });
        }
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

export function renderRatingBlob(records, campus, mondayIso) {
  const plan = buildRatingImagePlan(records, campus, mondayIso);
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
