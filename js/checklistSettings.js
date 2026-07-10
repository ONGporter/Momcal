/**
 * js/checklistSettings.js (v0.0.40, v0.0.41에서 임신/육아 그룹 분리 + 편집 UI 추가)
 * 설정 탭 — "체크리스트 관리" 섹션
 *
 * 네 가지를 담당함:
 *  1) 체크리스트 탭(내장 + 준비물 팩 + 커스텀) 표시/숨김 — S.clSettings.hiddenTabs
 *  2) 예방접종·발달 탭의 캘린더 연동 켜기/끄기 — S.clSettings.calendarSync
 *     (다른 탭(이유식·정부지원·준비물 팩·커스텀)은 애초에 캘린더와 연결된 항목이 없어서
 *      토글을 보여주지 않음 — data/checklist-links.js에 매핑이 있는 탭만 의미가 있음)
 *  3) 사용자가 직접 만드는 준비물형(플랫) 체크리스트 — S.customChecklists
 *  4) 만든 체크리스트의 이름·항목을 나중에 통째로 편집 (v0.0.41)
 *
 * v0.0.41: 임산부용(임신 체크/출산 준비물 + preg 팩/커스텀)과 육아용(예방접종/발달/이유식
 * + born 팩/커스텀)을 화면에서 구분해서 보여줌 — 정부지원만 두 단계 공통이라 별도 묶음.
 * 실제 표시 여부(hiddenTabs)·연동 설정은 이 구분과 무관하게 동일한 저장 구조를 씀.
 *
 * 탭 목록·표시 로직 자체(getVisibleTabDefs 등)는 js/checklist.js에 있고, 이 파일은
 * "그 설정값을 사용자가 바꾸는 UI"만 담당함(순환 참조 방지를 위해 checklist.js를
 * import하지 않고, S.clSettings/S.customChecklists를 직접 읽고 씀).
 */

import { S, debounceSave } from './state.js';
import { clPacks } from '../data/checklist-packs.js';
import { showModal, cm } from './modal.js';

/** 내장 탭 6종 — js/checklist.js의 builtinTabDefs()와 key를 맞춰야 함(바뀌면 여기도 같이 고칠 것) */
const PREG_ROWS = [
  { key: 'preg', icon: 'pregnant_woman', label: '임신 체크' },
  { key: 'prep', icon: 'inventory_2',    label: '출산 준비물' },
];
const BORN_ROWS = [
  { key: 'vax',  icon: 'vaccines',   label: '예방접종', syncable: true },
  { key: 'dev',  icon: 'child_care', label: '발달',     syncable: true },
  { key: 'food', icon: 'restaurant', label: '이유식' },
];
const COMMON_ROWS = [
  { key: 'gov', icon: 'account_balance', label: '정부지원' },
];

function ensureClSettings() {
  if (!S.clSettings) S.clSettings = { hiddenTabs: [], calendarSync: {} };
  if (!S.clSettings.hiddenTabs)   S.clSettings.hiddenTabs = [];
  if (!S.clSettings.calendarSync) S.clSettings.calendarSync = {};
  return S.clSettings;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, '&#10;'); }

function isHidden(key)  { return ensureClSettings().hiddenTabs.includes(key); }
function isSyncOff(key) { return ensureClSettings().calendarSync[key] === false; }

/** 탭 표시/숨김 토글 */
export function toggleClTabHidden(key) {
  const s = ensureClSettings();
  const i = s.hiddenTabs.indexOf(key);
  if (i >= 0) s.hiddenTabs.splice(i, 1); else s.hiddenTabs.push(key);
  debounceSave();
  renderChecklistSettings();
  window.renderChecklist?.(); // 지금 체크리스트 탭을 보고 있으면 탭 구성을 즉시 반영
}

/** 캘린더 연동 켜기/끄기 (예방접종·발달 탭만 대상) */
export function toggleClCalendarSync(key) {
  const s = ensureClSettings();
  if (isSyncOff(key)) {
    delete s.calendarSync[key]; // 기본값(연동 켜짐)이면 굳이 저장하지 않음
  } else {
    s.calendarSync[key] = false;
  }
  debounceSave();
  renderChecklistSettings();
}

function rowHtml({ key, icon, label, syncable, deletable, editable }) {
  const hidden = isHidden(key);
  return `
    <div class="cl-settings-row">
      <span class="icon icon-sm cl-settings-row-icon" translate="no" aria-hidden="true">${icon}</span>
      <span class="cl-settings-row-label">${escapeHtml(label)}</span>
      <div class="cl-settings-row-actions">
        ${syncable ? `
          <button type="button" class="notif-toggle-btn" onclick="toggleClCalendarSync('${key}')">
            ${isSyncOff(key) ? '캘린더 연동 꺼짐' : '캘린더 연동 켜짐'}
          </button>` : ''}
        ${editable ? `
          <button type="button" class="ci-expand-btn" aria-label="편집" onclick="openEditChecklistModal('${key}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">edit</span></span>
          </button>` : ''}
        ${deletable ? `
          <button type="button" class="ci-expand-btn" aria-label="삭제" onclick="deleteCustomChecklist('${key}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span></span>
          </button>` : ''}
        <button type="button" class="notif-toggle-btn" onclick="toggleClTabHidden('${key}')">${hidden ? '숨김' : '표시중'}</button>
      </div>
    </div>`;
}

/** 설정 탭 — #clSettingsWrap에 렌더 */
export function renderChecklistSettings() {
  const wrap = document.getElementById('clSettingsWrap');
  if (!wrap) return;

  const packPregRows = clPacks.filter(p => p.stage === 'preg').map(p => ({ key: p.key, icon: p.icon, label: p.label }));
  const packBornRows = clPacks.filter(p => (p.stage || 'born') === 'born').map(p => ({ key: p.key, icon: p.icon, label: p.label }));
  const customPregRows = (S.customChecklists || []).filter(c => c.stage === 'preg')
    .map(c => ({ key: c.key, icon: c.icon || 'checklist', label: c.label, deletable: true, editable: true }));
  const customBornRows = (S.customChecklists || []).filter(c => (c.stage || 'born') === 'born')
    .map(c => ({ key: c.key, icon: c.icon || 'checklist', label: c.label, deletable: true, editable: true }));

  wrap.innerHTML = `
    <div class="cl-settings-hint">아이 단계(임신중/출생 후)에 따라 실제로 보이는 탭이 달라져요 — 여기서는 두 단계를 나눠서 한 번에 관리해요.</div>

    <div class="cl-settings-group-label">🤰 임산부용</div>
    ${PREG_ROWS.map(rowHtml).join('')}
    ${packPregRows.map(rowHtml).join('')}
    ${customPregRows.length ? customPregRows.map(rowHtml).join('') : ''}

    <div class="cl-settings-group-label">🍼 육아용</div>
    ${BORN_ROWS.map(rowHtml).join('')}
    ${packBornRows.map(rowHtml).join('')}
    ${customBornRows.length ? customBornRows.map(rowHtml).join('') : ''}

    <div class="cl-settings-group-label">공통</div>
    ${COMMON_ROWS.map(rowHtml).join('')}

    <button type="button" class="btn bmn" style="margin-top:14px" onclick="openCreateChecklistModal()">＋ 새 체크리스트 만들기</button>
  `;
}

/* ── 커스텀 체크리스트 만들기 ── */

export function openCreateChecklistModal() {
  showModal('새 체크리스트 만들기', `
    <div class="fg" style="margin:0">
      <label>이름</label>
      <input id="newClLabel" placeholder="예) 어린이집 준비물" maxlength="20">
    </div>
    <div class="fg" style="margin-top:10px">
      <label>어느 단계용인가요?</label>
      <div class="stage-toggle" style="margin-top:4px">
        <button type="button" class="st-btn on" id="newClStageBorn" onclick="setNewClStage('born')">🍼 육아용</button>
        <button type="button" class="st-btn" id="newClStagePreg" onclick="setNewClStage('preg')">🤰 임산부용</button>
      </div>
    </div>
    <div class="fg" style="margin-top:10px">
      <label>항목 (한 줄에 하나씩, 나중에 편집·추가할 수 있어요)</label>
      <textarea id="newClItems" rows="5" placeholder="가방
여벌옷
물티슈"></textarea>
    </div>
    <div class="cl-form-msg" id="newClMsg"></div>
    <button class="btn bpk" style="width:100%;margin-top:10px" onclick="submitCreateChecklist()">만들기</button>
  `);
  window._newClStage = 'born';
}

/** 새 체크리스트 만들기 모달의 임산부용/육아용 토글 */
export function setNewClStage(stage) {
  window._newClStage = stage;
  document.getElementById('newClStageBorn')?.classList.toggle('on', stage === 'born');
  document.getElementById('newClStagePreg')?.classList.toggle('on', stage === 'preg');
}

export function submitCreateChecklist() {
  const labelInput = document.getElementById('newClLabel');
  const label = (labelInput?.value || '').trim();
  const raw   = document.getElementById('newClItems')?.value || '';
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const msgEl = document.getElementById('newClMsg');
  const stage = window._newClStage === 'preg' ? 'preg' : 'born';

  if (!label) { if (msgEl) { msgEl.textContent = '이름을 입력해주세요'; msgEl.classList.add('cl-form-msg-err'); } return; }

  const id = Date.now();
  // v0.0.40: id 접두어를 'cclt_'로 둬서 사용자가 나중에 "＋ 항목 직접 추가하기"로 덧붙이는
  // 항목(접두어 'custom_')과 겹치지 않게 함 — 겹치면 삭제 버튼이 엉뚱한 걸 지우려고 시도함
  const items = lines.map((t, i) => ({ id: `cclt_${id}_${i}`, t, r: true }));

  if (!S.customChecklists) S.customChecklists = [];
  S.customChecklists.push({ id, key: `custom_${id}`, label, icon: 'checklist', stage, items });

  cm();
  debounceSave();
  renderChecklistSettings();
  window.renderChecklist?.();
}

export function deleteCustomChecklist(key) {
  if (!confirm('이 체크리스트를 삭제할까요? 그동안 체크한 기록도 함께 사라져요.')) return;

  S.customChecklists = (S.customChecklists || []).filter(c => c.key !== key);
  const s = ensureClSettings();
  s.hiddenTabs = s.hiddenTabs.filter(k => k !== key);
  delete s.calendarSync[key];
  // 아이별로 저장된 체크 상태·직접 추가한 항목도 함께 정리(모든 아이 순회)
  Object.keys(S.checks || {}).forEach(k => { if (k.endsWith('_' + key)) delete S.checks[k]; });
  Object.keys(S.customClItems || {}).forEach(k => { if (k.endsWith('_' + key)) delete S.customClItems[k]; });

  debounceSave();
  renderChecklistSettings();
  window.renderChecklist?.();
}

/* ── 커스텀 체크리스트 편집 (v0.0.41) ──
 * 항목 자체(이름·필수여부·추가/삭제)를 통째로 다시 쓰는 방식 — 기존 항목은 data-idx로
 * 원본을 추적해서 id를 그대로 유지하고(체크 상태가 끊기지 않게), 새로 추가된 행만
 * 새 id를 발급한다. */

function editItemRowHtml(it, idxAttr) {
  return `
    <div class="cl-edit-item-row" data-idx="${idxAttr}">
      <input type="text" class="cl-edit-item-text" value="${escapeAttr(it.t)}" maxlength="40">
      <label class="cl-edit-item-req">
        <input type="checkbox" class="cl-edit-item-req-cb" ${it.r ? 'checked' : ''}> 필수
      </label>
      <button type="button" class="cl-edit-item-remove" aria-label="이 항목 삭제" onclick="this.closest('.cl-edit-item-row').remove()">
        <span class="icon icon-sm" translate="no" aria-hidden="true">close</span>
      </button>
    </div>`;
}

export function openEditChecklistModal(key) {
  const cl = (S.customChecklists || []).find(c => c.key === key);
  if (!cl) return;
  showModal(`"${cl.label}" 편집`, `
    <div class="fg" style="margin:0">
      <label>이름</label>
      <input id="editClLabel" value="${escapeAttr(cl.label)}" maxlength="20">
    </div>
    <div class="fg" style="margin-top:10px">
      <label>항목</label>
      <div id="editClItemsList">${cl.items.map((it, i) => editItemRowHtml(it, i)).join('')}</div>
      <button type="button" class="cl-add-item-btn" style="margin-top:8px" onclick="addEditClItemRow()">＋ 항목 추가</button>
    </div>
    <div class="cl-form-msg" id="editClMsg"></div>
    <button class="btn bpk" style="width:100%;margin-top:10px" onclick="submitEditChecklist('${cl.key}')">저장</button>
  `);
}

export function addEditClItemRow() {
  const list = document.getElementById('editClItemsList');
  if (!list) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = editItemRowHtml({ t: '', r: true }, 'new');
  const row = wrap.firstElementChild;
  list.appendChild(row);
  row.querySelector('.cl-edit-item-text')?.focus();
}

export function submitEditChecklist(key) {
  const cl = (S.customChecklists || []).find(c => c.key === key);
  if (!cl) return;
  const msgEl = document.getElementById('editClMsg');
  const label = (document.getElementById('editClLabel')?.value || '').trim();
  if (!label) { if (msgEl) { msgEl.textContent = '이름을 입력해주세요'; msgEl.classList.add('cl-form-msg-err'); } return; }

  const rows = Array.from(document.querySelectorAll('#editClItemsList .cl-edit-item-row'));
  const items = [];
  rows.forEach((row) => {
    const text = row.querySelector('.cl-edit-item-text')?.value.trim();
    if (!text) return; // 빈 항목은 무시(삭제한 것으로 취급)
    const req = !!row.querySelector('.cl-edit-item-req-cb')?.checked;
    const idxAttr = row.getAttribute('data-idx');
    const original = /^\d+$/.test(idxAttr) ? cl.items[Number(idxAttr)] : null;
    // 기존 항목은 id를 유지해야 그동안 체크한 상태(S.checks)가 끊기지 않음
    const id = original ? original.id : `cclt_${cl.id}_${Date.now()}_${items.length}`;
    items.push({ id, t: text, r: req });
  });

  if (!items.length) { if (msgEl) { msgEl.textContent = '항목을 한 개 이상 남겨주세요'; msgEl.classList.add('cl-form-msg-err'); } return; }

  cl.label = label;
  cl.items = items;

  cm();
  debounceSave();
  renderChecklistSettings();
  window.renderChecklist?.();
}

window.toggleClTabHidden        = toggleClTabHidden;
window.toggleClCalendarSync     = toggleClCalendarSync;
window.renderChecklistSettings  = renderChecklistSettings;
window.openCreateChecklistModal = openCreateChecklistModal;
window.setNewClStage            = setNewClStage;
window.submitCreateChecklist    = submitCreateChecklist;
window.deleteCustomChecklist    = deleteCustomChecklist;
window.openEditChecklistModal   = openEditChecklistModal;
window.addEditClItemRow         = addEditClItemRow;
window.submitEditChecklist      = submitEditChecklist;
