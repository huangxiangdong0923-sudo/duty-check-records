import { SLOTS, getReasonsForSlot } from './js/reasons.js';
import { classCountForGrade, createRecord } from './js/records.js';
import { loadRecords, saveRecords } from './js/storage.js';

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
}

initEntry();
export { state, switchTab };
