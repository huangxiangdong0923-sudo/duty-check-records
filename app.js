import { getModule, getSlotsForModule, getReasonsForModule, groundForGrade } from './js/modules.js';
import { classCountForGrade, createRecord, defaultPointsFor, parseStudentNos } from './js/records.js';
import { loadRecords, saveRecords, createBackup, importBackup } from './js/storage.js';
import { summarize, getTotals, summarizeFlag, flagItemLocationText } from './js/summary.js';
import { renderSummaryBlob, renderRatingBlob, downloadBlob } from './js/image-export.js';
import { todayIso, lastMondayIso, formatChipDateWithWeekday } from './js/dates.js';
import { DEFAULT_CAMPUS, detectCampusId, filterByCampus, getCampus } from './js/campuses.js';
import { rateWeek } from './js/rating.js';

const GRADE_LABELS = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const CAMPUS = getCampus(detectCampusId());
const APP_NAME = CAMPUS.id === DEFAULT_CAMPUS.id ? '值日检查记录' : `值日检查记录（${CAMPUS.label}）`;

const state = {
  records: loadRecords(),
  moduleId: 'daily',
  selectedReasonCode: null,
  pointsDirty: false,
  entryDateTouched: false,
  summaryDateTouched: false,
};

const $ = (id) => document.getElementById(id);

function setMessage(id, text, ok = false) {
  const element = $(id);
  element.textContent = text;
  element.classList.toggle('is-ok', Boolean(ok && text));
}

function currentModule() {
  return getModule(state.moduleId);
}

function moduleOf(record) {
  return record?.module === 'flag' ? 'flag' : 'daily';
}

function campusRecords() {
  return filterByCampus(state.records, CAMPUS.id);
}

function defaultDateFor(moduleId) {
  return moduleId === 'flag' ? lastMondayIso() : todayIso();
}

function classLabel(grade, classNo) {
  return `${GRADE_LABELS[grade] || `${grade}年级`}${classNo}班`;
}

function fillGradeOptions() {
  const select = $('f-grade');
  select.innerHTML = '';
  for (const grade of CAMPUS.grades) {
    const option = document.createElement('option');
    option.value = String(grade);
    option.textContent = GRADE_LABELS[grade];
    select.appendChild(option);
  }
}

function fillClassOptions() {
  const grade = Number($('f-grade').value || CAMPUS.grades[0]);
  const select = $('f-class');
  select.innerHTML = '';
  for (let classNo = 1; classNo <= classCountForGrade(grade, CAMPUS); classNo += 1) {
    const option = document.createElement('option');
    option.value = String(classNo);
    option.textContent = `${classNo}班`;
    select.appendChild(option);
  }
  updateGroundChip();
}

function fillSlotOptions() {
  const select = $('f-slot');
  select.innerHTML = '';
  for (const slot of getSlotsForModule(state.moduleId)) {
    const option = document.createElement('option');
    option.value = slot.code;
    option.textContent = slot.label;
    select.appendChild(option);
  }
}

function updateGroundChip() {
  const chip = $('ground-chip');
  if (state.moduleId !== 'flag') {
    chip.hidden = true;
    chip.textContent = '';
    return;
  }
  const ground = groundForGrade($('f-grade').value, CAMPUS);
  chip.hidden = false;
  chip.textContent = ground ? `检查地点：${ground.label}（${ground.gradesLabel}）` : '检查地点：未确定';
}

function updateLocationFields() {
  const isSeat = document.querySelector('input[name="locationType"]:checked')?.value === 'seat';
  $('seat-fields').hidden = !isSeat;
  $('student-fields').hidden = isSeat;
}

function updateModuleVisibility() {
  const isFlag = state.moduleId === 'flag';
  $('daily-only').hidden = isFlag;
  $('flag-fields').hidden = !isFlag;
  document.querySelectorAll('.module').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.module === state.moduleId);
  });
  $('summary-title').textContent = `${currentModule().label}汇总`;
}

function renderReasons() {
  const grid = $('reason-grid');
  grid.innerHTML = '';
  for (const reason of getReasonsForModule(state.moduleId, $('f-slot').value)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reason';
    button.textContent = reason.label;
    button.dataset.code = reason.code;
    button.setAttribute('aria-pressed', 'false');
    if (reason.code === state.selectedReasonCode) {
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
    }
    button.addEventListener('click', () => {
      state.selectedReasonCode = reason.code;
      renderReasons();
    });
    grid.appendChild(button);
  }
}

function syncAutoPoints() {
  if (state.pointsDirty) return;
  $('f-points').value = String(defaultPointsFor($('f-student-nos').value));
}

function formDraft() {
  const isFlag = state.moduleId === 'flag';
  const locationType = isFlag ? 'studentNo' : document.querySelector('input[name="locationType"]:checked').value;
  return {
    campus: CAMPUS.id,
    module: state.moduleId,
    date: $('f-date').value,
    grade: Number($('f-grade').value),
    classNo: Number($('f-class').value),
    locationType,
    row: locationType === 'seat' ? Number($('f-row').value) : null,
    seat: locationType === 'seat' ? Number($('f-seat').value) : null,
    studentName: locationType === 'student' ? $('f-student').value : '',
    studentNos: isFlag ? $('f-student-nos').value : [],
    slot: $('f-slot').value,
    reasonCode: state.selectedReasonCode || '',
    points: Number($('f-points').value || 1),
    note: $('f-note').value,
  };
}

function locationText(record) {
  if (record.locationType === 'student') return record.studentName || '学生';
  if (record.locationType === 'studentNo') {
    const nos = parseStudentNos(record.studentNos);
    return nos.length ? `${nos.join('、')} 号` : '整班';
  }
  return `第${record.row}排第${record.seat}个`;
}

function renderTodayList() {
  const date = $('f-date').value || todayIso();
  const records = campusRecords()
    .filter((record) => record.date === date && moduleOf(record) === state.moduleId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = $('today-list');
  list.innerHTML = '';
  if (!records.length) {
    list.textContent = '这一天还没有扣分记录。';
    return;
  }
  for (const record of records) {
    const item = document.createElement('div');
    item.className = 'record-item';
    const content = document.createElement('span');
    content.innerHTML = `<strong>${classLabel(record.grade, record.classNo)}</strong> ${locationText(record)} · ${record.reasonLabel} · <span class="points">-${record.points}分</span>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      if (!confirm('确定删除这条记录吗？')) return;
      state.records = state.records.filter((candidate) => candidate.id !== record.id);
      saveRecords(state.records);
      renderTodayList();
      renderSummary();
      renderRating();
      renderHistory();
    });
    item.append(content, remove);
    list.appendChild(item);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('is-active', panel.id === `panel-${tabName}`));
  if (tabName === 'summary') renderSummary();
  if (tabName === 'rating') renderRating();
  if (tabName === 'history') renderHistory();
}

function switchModule(moduleId) {
  state.moduleId = getModule(moduleId).id;
  state.selectedReasonCode = null;
  state.pointsDirty = false;
  $('f-student-nos').value = '';
  $('f-points').value = '1';
  fillSlotOptions();
  updateModuleVisibility();
  updateGroundChip();
  renderReasons();
  if (!state.entryDateTouched) $('f-date').value = defaultDateFor(state.moduleId);
  if (!state.summaryDateTouched) $('summary-date').value = defaultDateFor(state.moduleId);
  renderTodayList();
  renderSummary();
  renderRating();
  renderHistory();
}

function renderFlagClassCard(classGroup) {
  const card = document.createElement('section');
  card.className = 'summary-class';
  const heading = document.createElement('h4');
  heading.textContent = `${classGroup.label}（${classGroup.totalPoints}分）`;
  card.appendChild(heading);
  for (const item of classGroup.items) {
    const line = document.createElement('div');
    line.className = 'summary-entry';
    const text = document.createElement('span');
    text.textContent = `${item.reasonLabel}：${flagItemLocationText(item)}`;
    const points = document.createElement('span');
    points.className = 'points';
    points.textContent = `-${item.points}分`;
    line.append(text, points);
    card.appendChild(line);
  }
  return card;
}

function renderSummary() {
  const date = $('summary-date').value || todayIso();
  const container = $('summary-groups');
  container.innerHTML = '';
  setMessage('summary-message', '');

  if (state.moduleId === 'flag') {
    const { grounds, totals } = summarizeFlag(campusRecords(), date);
    $('summary-total').textContent = totals.entryCount
      ? `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级 · ${totals.entryCount}条记录`
      : '当天没有扣分记录';
    for (const ground of grounds) {
      const section = document.createElement('section');
      section.className = 'summary-ground';
      const heading = document.createElement('h3');
      heading.textContent = ground.gradesLabel ? `${ground.label}（${ground.gradesLabel}）` : ground.label;
      section.appendChild(heading);
      for (const classGroup of ground.classes) section.appendChild(renderFlagClassCard(classGroup));
      container.appendChild(section);
    }
    return;
  }

  const groups = summarize(campusRecords(), date, 'daily');
  const totals = getTotals(groups);
  $('summary-total').textContent = groups.length
    ? `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级 · ${totals.entryCount}条记录`
    : '当天没有扣分记录';
  for (const group of groups) {
    const card = document.createElement('section');
    card.className = 'summary-class';
    const heading = document.createElement('h3');
    heading.textContent = `${group.label}（${group.totalPoints}分）`;
    card.appendChild(heading);
    for (const entry of group.entries) {
      const line = document.createElement('div');
      line.className = 'summary-entry';
      const text = document.createElement('span');
      text.textContent = `${locationText(entry)} · ${entry.reasonLabel}`;
      const points = document.createElement('span');
      points.className = 'points';
      points.textContent = `-${entry.points}分`;
      line.append(text, points);
      card.appendChild(line);
    }
    container.appendChild(card);
  }
}

async function exportSummaryImage() {
  const date = $('summary-date').value || todayIso();
  const hasRecords = campusRecords().some((record) => record.date === date && moduleOf(record) === state.moduleId);
  if (!hasRecords) {
    setMessage('summary-message', '当天没有扣分记录，暂不能导出图片。');
    return;
  }
  const blob = await renderSummaryBlob(campusRecords(), date, state.moduleId);
  if (!blob) {
    setMessage('summary-message', '图片生成失败，请重试。');
    return;
  }
  downloadBlob(blob, `${date}-${currentModule().imageSuffix}.png`);
  setMessage('summary-message', '图片已生成并开始下载。', true);
}

function ratingMonday() {
  return lastMondayIso($('rating-week').value || todayIso());
}

function renderRating() {
  const rating = rateWeek(campusRecords(), CAMPUS, ratingMonday());
  $('rating-title').textContent = `${CAMPUS.label}本周星级班级评比`;
  $('rating-range').textContent = `统计范围：${formatChipDateWithWeekday(rating.range.start)} 至 ${formatChipDateWithWeekday(rating.range.end)}（周一至周五）`;
  $('rating-total').textContent = `本周共 ${rating.totals.classCount} 个班级 · 合计扣 ${rating.totals.deduction} 分 · ${rating.totals.recordCount} 条检查记录`;
  setMessage('rating-message', '');

  const container = $('rating-groups');
  container.innerHTML = '';
  for (const level of rating.levels) {
    const section = document.createElement('section');
    section.className = `summary-ground rating-level-${level.stars}`;
    const heading = document.createElement('h3');
    heading.textContent = `${level.label}　${level.classes.length} 个`;
    const rule = document.createElement('p');
    rule.className = 'rating-rule';
    rule.textContent = `${level.rule} · ${level.scoreText}`;
    const chips = document.createElement('div');
    chips.className = 'rating-chips';
    if (!level.classes.length) {
      const empty = document.createElement('span');
      empty.className = 'rating-rule';
      empty.textContent = '无';
      chips.appendChild(empty);
    }
    for (const entry of level.classes) {
      const chip = document.createElement('span');
      chip.className = 'rating-chip';
      chip.append(document.createTextNode(entry.label));
      if (level.stars !== 5) {
        const deduction = document.createElement('span');
        deduction.className = 'deduction';
        deduction.textContent = `-${entry.deduction}`;
        chip.appendChild(deduction);
      }
      chips.appendChild(chip);
    }
    section.append(heading, rule, chips);
    container.appendChild(section);
  }
  if (rating.totals.uncheckedCount) {
    const note = document.createElement('p');
    note.className = 'rating-rule';
    note.textContent = `说明：其中 ${rating.totals.uncheckedCount} 个班级本周还没有检查记录，按未被扣分计为五星。`;
    container.appendChild(note);
  }
}

async function exportRatingImage() {
  const mondayIso = ratingMonday();
  const rating = rateWeek(campusRecords(), CAMPUS, mondayIso);
  if (!rating.totals.recordCount) {
    setMessage('rating-message', '这一周还没有检查记录，暂不能导出图片。');
    return;
  }
  const blob = await renderRatingBlob(campusRecords(), CAMPUS, mondayIso);
  if (!blob) {
    setMessage('rating-message', '图片生成失败，请重试。');
    return;
  }
  downloadBlob(blob, `${rating.range.start}-${rating.range.end}-星级班级评比.png`);
  setMessage('rating-message', '图片已生成并开始下载。', true);
}

function renderHistory() {
  const dates = Array.from(new Set(
    campusRecords().filter((record) => moduleOf(record) === state.moduleId).map((record) => record.date),
  )).sort().reverse();
  const container = $('history-list');
  container.innerHTML = '';
  if (!dates.length) {
    container.textContent = '还没有历史记录。';
    return;
  }
  for (const date of dates) {
    const count = campusRecords().filter((record) => record.date === date && moduleOf(record) === state.moduleId).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'record-item';
    button.textContent = `${date}　${count} 条记录`;
    button.addEventListener('click', () => {
      $('summary-date').value = date;
      renderSummary();
      switchTab('summary');
    });
    container.appendChild(button);
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(createBackup(state.records), null, 2)], { type: 'application/json' });
  downloadBlob(blob, `值日检查备份-${todayIso()}.json`);
  setMessage('history-message', '备份文件已生成。', true);
}

async function importBackupFile(file) {
  const text = await file.text();
  const mode = $('import-mode').value;
  if (mode === 'replace') {
    if (!confirm('覆盖会删除本机现有记录，确定继续吗？')) return;
    const result = importBackup(text, []);
    state.records = result.records;
    saveRecords(state.records);
    setMessage('history-message', `已覆盖导入 ${state.records.length} 条记录。`, true);
  } else {
    const result = importBackup(text, state.records);
    state.records = result.records;
    saveRecords(state.records);
    setMessage('history-message', `合并完成：新增 ${result.added} 条，跳过 ${result.skipped} 条重复记录。`, true);
  }
  renderHistory();
  renderTodayList();
  renderSummary();
  renderRating();
}

function resetEntryForm() {
  state.selectedReasonCode = null;
  state.pointsDirty = false;
  $('f-note').value = '';
  $('f-points').value = '1';
  $('f-student-nos').value = '';
  renderReasons();
}

function initEntry() {
  document.title = APP_NAME;
  $('app-title').textContent = APP_NAME;
  fillGradeOptions();
  fillClassOptions();
  fillSlotOptions();
  $('f-date').value = defaultDateFor(state.moduleId);
  $('summary-date').value = defaultDateFor(state.moduleId);
  $('rating-week').value = lastMondayIso();
  updateLocationFields();
  updateModuleVisibility();
  updateGroundChip();
  renderReasons();
  renderTodayList();

  document.querySelectorAll('.module').forEach((button) => {
    button.addEventListener('click', () => switchModule(button.dataset.module));
  });
  $('f-grade').addEventListener('change', () => {
    fillClassOptions();
    updateGroundChip();
  });
  $('f-slot').addEventListener('change', () => {
    state.selectedReasonCode = null;
    renderReasons();
  });
  $('f-student-nos').addEventListener('input', syncAutoPoints);
  $('f-points').addEventListener('input', () => {
    state.pointsDirty = true;
  });
  document.querySelectorAll('input[name="locationType"]').forEach((input) => input.addEventListener('change', updateLocationFields));
  $('f-date').addEventListener('change', () => {
    state.entryDateTouched = true;
    renderTodayList();
  });
  $('summary-date').addEventListener('change', () => {
    state.summaryDateTouched = true;
    renderSummary();
  });
  $('rating-week').addEventListener('change', renderRating);
  $('export-image').addEventListener('click', exportSummaryImage);
  $('export-rating').addEventListener('click', exportRatingImage);
  $('export-backup').addEventListener('click', exportBackup);
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importBackupFile(file);
    } catch (error) {
      setMessage('history-message', error.message);
    } finally {
      event.target.value = '';
    }
  });
  $('entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const record = createRecord(formDraft());
      state.records = [record, ...state.records];
      saveRecords(state.records);
      setMessage('entry-message', `已保存：${classLabel(record.grade, record.classNo)} · ${record.reasonLabel} · ${locationText(record)}`, true);
      resetEntryForm();
      renderTodayList();
      renderSummary();
      renderRating();
      renderHistory();
    } catch (error) {
      setMessage('entry-message', error.message);
    }
  });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  renderSummary();
  renderRating();
  renderHistory();
}

initEntry();
export { state, switchTab, switchModule, renderSummary, renderRating, renderHistory, renderTodayList };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('./sw.js', import.meta.url);
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
