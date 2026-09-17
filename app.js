import { SLOTS, getReasonsForSlot } from './js/reasons.js';
import { classCountForGrade, createRecord } from './js/records.js';
import { loadRecords, saveRecords, createBackup, importBackup } from './js/storage.js';
import { summarize, getTotals } from './js/summary.js';
import { renderSummaryBlob, downloadBlob } from './js/image-export.js';

const state = { records: loadRecords(), selectedReasonCode: null };

const $ = (id) => document.getElementById(id);

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fillGradeOptions() {
  const select = $('f-grade');
  select.innerHTML = '';
  for (const grade of [1, 2, 3, 4]) {
    const option = document.createElement('option');
    option.value = String(grade);
    option.textContent = ['', '一年级', '二年级', '三年级', '四年级'][grade];
    select.appendChild(option);
  }
}

function fillClassOptions() {
  const grade = Number($('f-grade').value || 1);
  const select = $('f-class');
  select.innerHTML = '';
  for (let classNo = 1; classNo <= classCountForGrade(grade); classNo += 1) {
    const option = document.createElement('option');
    option.value = String(classNo);
    option.textContent = `${classNo}班`;
    select.appendChild(option);
  }
}

function fillSlotOptions() {
  const select = $('f-slot');
  select.innerHTML = '';
  for (const slot of SLOTS) {
    const option = document.createElement('option');
    option.value = slot.code;
    option.textContent = slot.label;
    select.appendChild(option);
  }
}

function renderReasons() {
  const grid = $('reason-grid');
  grid.innerHTML = '';
  for (const reason of getReasonsForSlot($('f-slot').value || 'morning')) {
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

function updateLocationFields() {
  const isStudent = document.querySelector('input[name="locationType"]:checked').value === 'student';
  $('seat-fields').hidden = isStudent;
  $('student-fields').hidden = !isStudent;
}

function formDraft() {
  const locationType = document.querySelector('input[name="locationType"]:checked').value;
  return {
    date: $('f-date').value,
    grade: Number($('f-grade').value),
    classNo: Number($('f-class').value),
    locationType,
    row: locationType === 'seat' ? Number($('f-row').value) : null,
    seat: locationType === 'seat' ? Number($('f-seat').value) : null,
    studentName: locationType === 'student' ? $('f-student').value : '',
    slot: $('f-slot').value,
    reasonCode: state.selectedReasonCode || '',
    points: Number($('f-points').value || 1),
    note: $('f-note').value,
  };
}

function renderTodayList() {
  const date = $('f-date').value || todayIso();
  const records = state.records.filter((record) => record.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = $('today-list');
  list.innerHTML = '';
  if (!records.length) {
    list.textContent = '今天还没有扣分记录。';
    return;
  }
  for (const record of records) {
    const item = document.createElement('div');
    item.className = 'record-item';
    const location = record.locationType === 'student' ? record.studentName : `第${record.row}排第${record.seat}个`;
    item.innerHTML = `<strong>${record.grade}年级${record.classNo}班</strong> ${location} · ${record.reasonLabel} · <span class="points">-${record.points}分</span>`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      if (!confirm('确定删除这条记录吗？')) return;
      state.records = state.records.filter((candidate) => candidate.id !== record.id);
      saveRecords(state.records);
      renderTodayList();
    });
    item.appendChild(remove);
    list.appendChild(item);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('is-active', panel.id === `panel-${tabName}`));
  if (tabName === 'summary') window.dispatchEvent(new CustomEvent('app:summary'));
  if (tabName === 'history') window.dispatchEvent(new CustomEvent('app:history'));
}

function renderSummary() {
  const date = $('summary-date').value || todayIso();
  const groups = summarize(state.records, date);
  const totals = getTotals(groups);
  $('summary-total').textContent = groups.length
    ? `当天合计：${totals.totalPoints}分 · ${totals.classCount}个班级 · ${totals.entryCount}条记录`
    : '当天没有扣分记录';
  $('summary-message').textContent = '';
  const container = $('summary-groups');
  container.innerHTML = '';
  for (const group of groups) {
    const card = document.createElement('section');
    card.className = 'summary-class';
    card.innerHTML = `<h3>${group.label}（${group.totalPoints}分）</h3>`;
    for (const entry of group.entries) {
      const line = document.createElement('div');
      line.className = 'summary-entry';
      const location = entry.locationType === 'student' ? entry.studentName : `第${entry.row}排第${entry.seat}个`;
      line.innerHTML = `<span>${location} · ${entry.reasonLabel}</span><span class="points">-${entry.points}分</span>`;
      card.appendChild(line);
    }
    container.appendChild(card);
  }
}

async function exportSummaryImage() {
  const date = $('summary-date').value || todayIso();
  const groups = summarize(state.records, date);
  if (!groups.length) {
    $('summary-message').textContent = '当天没有扣分记录，暂不能导出图片。';
    return;
  }
  const blob = await renderSummaryBlob(state.records, date);
  downloadBlob(blob, `${date}-值日检查扣分情况.png`);
  $('summary-message').textContent = '图片已生成并开始下载。';
}

function renderHistory() {
  const dates = Array.from(new Set(state.records.map((record) => record.date))).sort().reverse();
  const container = $('history-list');
  container.innerHTML = '';
  if (!dates.length) {
    container.textContent = '还没有历史记录。';
    return;
  }
  for (const date of dates) {
    const count = state.records.filter((record) => record.date === date).length;
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
  downloadBlob(blob, `值日扣分备份-${todayIso()}.json`);
  $('history-message').textContent = '备份文件已生成。';
}

async function importBackupFile(file) {
  const text = await file.text();
  const mode = $('import-mode').value;
  if (mode === 'replace') {
    if (!confirm('覆盖会删除本机现有记录，确定继续吗？')) return;
    const parsed = JSON.parse(text);
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.records)) throw new Error('备份文件格式不正确');
    state.records = parsed.records;
    saveRecords(state.records);
    $('history-message').textContent = `已覆盖导入 ${state.records.length} 条记录。`;
  } else {
    const result = importBackup(text, state.records);
    state.records = result.records;
    saveRecords(state.records);
    $('history-message').textContent = `合并完成：新增 ${result.added} 条，跳过 ${result.skipped} 条重复记录。`;
  }
  renderHistory();
  renderTodayList();
  renderSummary();
}

function initEntry() {
  fillGradeOptions();
  fillClassOptions();
  fillSlotOptions();
  $('f-date').value = todayIso();
  $('summary-date').value = todayIso();
  updateLocationFields();
  renderReasons();
  renderTodayList();

  $('f-grade').addEventListener('change', fillClassOptions);
  $('f-slot').addEventListener('change', () => {
    state.selectedReasonCode = null;
    renderReasons();
  });
  document.querySelectorAll('input[name="locationType"]').forEach((input) => input.addEventListener('change', updateLocationFields));
  $('f-date').addEventListener('change', renderTodayList);
  $('summary-date').addEventListener('change', renderSummary);
  $('export-image').addEventListener('click', exportSummaryImage);
  window.addEventListener('app:summary', renderSummary);
  $('export-backup').addEventListener('click', exportBackup);
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importBackupFile(file);
    } catch (error) {
      $('history-message').textContent = error.message;
    } finally {
      event.target.value = '';
    }
  });
  window.addEventListener('app:history', renderHistory);
  $('entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const message = $('entry-message');
    try {
      const record = createRecord(formDraft());
      state.records = [record, ...state.records];
      saveRecords(state.records);
      message.textContent = `已保存：${record.grade}年级${record.classNo}班 · ${record.reasonLabel}`;
      state.selectedReasonCode = null;
      $('f-note').value = '';
      $('f-points').value = '1';
      renderReasons();
      renderTodayList();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  renderSummary();
  renderHistory();
}

initEntry();
export { state, switchTab, renderSummary, renderHistory };
