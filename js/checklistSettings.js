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
 * + born 팩/커스텀)을 화면에서 구분해서 보여줌.
 * 실제 표시 여부(hiddenTabs)·연동 설정은 이 구분과 무관하게 동일한 저장 구조를 씀.
 *
 * v0.2.5: 정부지원(gov)은 원래 "공통" 그룹으로 따로 묶여 있었는데(단일 탭이라 임산부용/
 * 육아용 구분이 없어서), 옹짐꾼님 피드백으로 "공통" 그룹 자체를 없애고 임산부용·육아용
 * 화면에 각각 정부지원 행을 하나씩 넣기로 함 — 두 행 모두 실제로는 같은 탭(key='gov')의
 * 표시/숨김 상태를 공유해서 보여주고, 편집(직접 추가) 버튼만 단계별로 다른 목록(gov_preg/
 * gov_born pseudo-key)을 열도록 rowHtml()의 editKey로 분리함(renderChecklistSettings() 참고).
 *
 * 탭 목록·표시 로직 자체(getVisibleTabDefs 등)는 js/checklist.js에 있고, 이 파일은
 * "그 설정값을 사용자가 바꾸는 UI"만 담당함(순환 참조 방지를 위해 checklist.js를
 * import하지 않고, S.clSettings/S.customChecklists를 직접 읽고 씀).
 */

import { S, debounceSave } from './state.js';
import { escapeHtml } from './utils.js';
import { clPacks } from '../data/checklist-packs.js';
import { showModal, cm } from './modal.js';
import { resyncTabForAllChildren } from './checklistCalendarLink.js';

/** 내장 탭 6종 — js/checklist.js의 builtinTabDefs()와 key를 맞춰야 함(바뀌면 여기도 같이 고칠 것)
 *  v0.2.4: '출산 준비물'(prep)도 준비물 팩과 똑같이 "직접 추가한 항목" 편집을 지원하도록
 *  editable:true 추가 — clData.preg의 'preg_prep' 카테고리 하나뿐인 인덱스 탭이라 항목 자체
 *  (기본 제공 내용)는 못 바꾸고, 준비물 팩처럼 사용자가 덧붙인 항목만 관리 가능(BUILTIN_CAT_KEY_MAP 참고) */
const PREG_ROWS = [
  { key: 'preg', icon: 'pregnant_woman', label: '임신 체크' },
  { key: 'prep', icon: 'inventory_2',    label: '출산 준비물', editable: true },
];
const BORN_ROWS = [
  { key: 'vax',  icon: 'vaccines',   label: '예방접종', syncable: true },
  { key: 'dev',  icon: 'child_care', label: '발달',     syncable: true },
  { key: 'food', icon: 'restaurant', label: '이유식' },
];

/** 설정 화면의 row key → 실제 항목 배열에서 쓰는 카테고리 key로 변환.
 *  대부분(준비물 팩)은 tab key와 cat.key가 같지만, '출산 준비물'(prep)만 js/checklist.js의
 *  getCats()에서 실제로 clData.preg의 'preg_prep' 카테고리를 반환하므로 여기서 매핑해줘야
 *  "직접 추가한 항목"이 체크리스트 탭에서 보는 것과 같은 자리(S.customClItems 키)에 저장됨. */
const BUILTIN_CAT_KEY_MAP = { prep: 'preg_prep' };
function resolveCatKey(packKey) { return BUILTIN_CAT_KEY_MAP[packKey] || packKey; }

function ensureClSettings() {
  if (!S.clSettings) S.clSettings = { hiddenTabs: [], calendarSync: {} };
  if (!S.clSettings.hiddenTabs)   S.clSettings.hiddenTabs = [];
  if (!S.clSettings.calendarSync) S.clSettings.calendarSync = {};
  return S.clSettings;
}

// v0.2.1: 로컬 escapeHtml() 제거 — js/utils.js의 공용 escapeHtml()로 통일(동일 로직 중복이었음)
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

/** 캘린더 연동 켜기/끄기 (예방접종·발달 탭만 대상)
 *  v0.0.42: 끄면 js/calendar.js의 getAutoEvs()가 해당 카테고리 일정을 통째로 숨기고,
 *  다시 켜면 지금 체크리스트 상태를 기준으로 캘린더 완료 표시를 재동기화한 뒤 다시 보여줌 */
export function toggleClCalendarSync(key) {
  const s = ensureClSettings();
  const turningOn = isSyncOff(key);
  if (turningOn) {
    delete s.calendarSync[key]; // 기본값(연동 켜짐)이면 굳이 저장하지 않음
    resyncTabForAllChildren(key);
  } else {
    s.calendarSync[key] = false;
  }
  debounceSave();
  renderChecklistSettings();
  // 지금 캘린더 탭을 보고 있으면 화면에도 즉시 반영
  if (document.getElementById('pg-calendar')?.classList.contains('on')) {
    window.renderCal?.();
  }
}

/** v0.2.5: editKey — 편집(연필) 버튼이 표시/숨김 토글과 다른 key로 라우팅해야 하는 경우
 *  (정부지원처럼 "표시 여부"는 실제 탭 key(gov)로, "직접 추가 편집"은 별도 pseudo-key
 *  (gov_preg/gov_born)로 openEditChecklistModal()에 분기해야 할 때 씀). 안 주면 key와 동일. */
function rowHtml({ key, icon, label, syncable, deletable, editable, editKey, hideToggle }) {
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
          <button type="button" class="ci-expand-btn" aria-label="편집" onclick="openEditChecklistModal('${editKey || key}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">edit</span></span>
          </button>` : ''}
        ${deletable ? `
          <button type="button" class="ci-expand-btn" aria-label="삭제" onclick="deleteCustomChecklist('${key}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span></span>
          </button>` : ''}
        ${hideToggle ? '' : `
        <button type="button" class="notif-toggle-btn" onclick="toggleClTabHidden('${key}')">${hidden ? '숨김' : '표시중'}</button>`}
      </div>
    </div>`;
}

/** 설정 탭 — #clSettingsWrap에 렌더 */
export function renderChecklistSettings() {
  const wrap = document.getElementById('clSettingsWrap');
  if (!wrap) return;

  const packPregRows = clPacks.filter(p => p.stage === 'preg').map(p => ({ key: p.key, icon: p.icon, label: p.label, editable: true }));
  const packBornRows = clPacks.filter(p => (p.stage || 'born') === 'born').map(p => ({ key: p.key, icon: p.icon, label: p.label, editable: true }));
  const customPregRows = (S.customChecklists || []).filter(c => c.stage === 'preg')
    .map(c => ({ key: c.key, icon: c.icon || 'checklist', label: c.label, deletable: true, editable: true }));
  const customBornRows = (S.customChecklists || []).filter(c => (c.stage || 'born') === 'born')
    .map(c => ({ key: c.key, icon: c.icon || 'checklist', label: c.label, deletable: true, editable: true }));

  // v0.2.5: 정부지원은 원래 "표시/숨김"(공통 그룹, key='gov' 하나뿐)과 "직접 추가 편집"
  // (임산부용/육아용 각각, hideToggle:true라 편집 버튼만 있던 행)이 화면에 총 3줄로 따로
  // 있었는데, 옹짐꾼님 요청으로 "공통" 그룹 자체를 없애고 임산부용·육아용에 각각 정부지원
  // 행 하나씩만 남기기로 함 — 표시/숨김 토글은 실제 탭 key(gov, 단일 탭이라 두 행이 결국
  // 같은 hiddenTabs 상태를 공유·표시함)를, 편집 버튼은 이전과 동일하게 stage별 pseudo-key
  // (gov_preg/gov_born)를 쓰도록 rowHtml()의 editKey로 분리함(openEditChecklistModal()의
  // 기존 분기 로직은 그대로 재사용).
  const govPregCount = (S.customGovItems || []).filter(it => it.stage === 'preg').length;
  const govBornCount = (S.customGovItems || []).filter(it => it.stage === 'born').length;
  const govPregRow = { key: 'gov', icon: 'account_balance', editable: true, editKey: 'gov_preg',
    label: `정부지원${govPregCount ? ` (직접 추가 ${govPregCount}개)` : ''}` };
  const govBornRow = { key: 'gov', icon: 'account_balance', editable: true, editKey: 'gov_born',
    label: `정부지원${govBornCount ? ` (직접 추가 ${govBornCount}개)` : ''}` };

  wrap.innerHTML = `
    <div class="cl-settings-group-label"><span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 임산부용</div>
    ${PREG_ROWS.map(rowHtml).join('')}
    ${packPregRows.map(rowHtml).join('')}
    ${customPregRows.length ? customPregRows.map(rowHtml).join('') : ''}
    ${rowHtml(govPregRow)}

    <div class="cl-settings-group-label"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 육아용</div>
    ${BORN_ROWS.map(rowHtml).join('')}
    ${packBornRows.map(rowHtml).join('')}
    ${customBornRows.length ? customBornRows.map(rowHtml).join('') : ''}
    ${rowHtml(govBornRow)}

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
        <button type="button" class="st-btn on" id="newClStageBorn" onclick="setNewClStage('born')"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 육아용</button>
        <button type="button" class="st-btn" id="newClStagePreg" onclick="setNewClStage('preg')"><span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 임산부용</button>
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
  if (key === 'gov_preg') return openGovItemsModal('preg');
  if (key === 'gov_born') return openGovItemsModal('born');
  // v0.2.4: '출산 준비물'(prep)도 준비물 팩과 같은 "직접 추가한 항목만 편집" 방식을 씀
  if (key.startsWith('pack_') || key === 'prep') return openEditPackExtrasModal(key);
  return openEditCustomChecklistModal(key);
}

/**
 * v0.0.44: 체크리스트 탭에서 "＋ 항목 직접 추가하기"로 만든 항목은 이제 cl.items에 바로
 * 쓰이지만(js/checklist.js의 submitAddClItem 참고), v0.0.43 이전에 추가된 항목은 아직
 * S.customClItems[{child.id}_{key}]에 남아있을 수 있어서 편집 화면을 열 때 함께 보여주고
 * 저장 시 cl.items로 완전히 옮겨서(마이그레이션) 다음부턴 한곳에서만 관리되게 함.
 */
function legacyItemsFor(key) {
  const child = S.children[S.selC];
  const legacyKey = child ? `${child.id}_${key}` : null;
  return { legacyKey, legacyItems: (legacyKey && S.customClItems && S.customClItems[legacyKey]) || [] };
}

function openEditCustomChecklistModal(key) {
  const cl = (S.customChecklists || []).find(c => c.key === key);
  if (!cl) return;
  const { legacyItems } = legacyItemsFor(key);
  const allItems = [...cl.items, ...legacyItems];
  showModal(`"${cl.label}" 편집`, `
    <div class="fg" style="margin:0">
      <label>이름</label>
      <input id="editClLabel" value="${escapeAttr(cl.label)}" maxlength="20">
    </div>
    <div class="fg" style="margin-top:10px">
      <label>항목</label>
      <div id="editClItemsList">${allItems.map((it, i) => editItemRowHtml(it, i)).join('')}</div>
      <button type="button" class="cl-add-item-btn" style="margin-top:8px" onclick="addEditClItemRow()">＋ 항목 추가</button>
    </div>
    <div class="cl-form-msg" id="editClMsg"></div>
    <button class="btn bpk" style="width:100%;margin-top:10px" onclick="submitEditChecklist('${cl.key}')">저장</button>
  `);
}

/**
 * v0.0.43: 준비물 팩(예: "100일 준비")은 콘텐츠(dd 상세 설명 포함)가 데이터 파일에 미리
 * 정해져 있어서 그 항목들 자체는 여기서 수정할 수 없음 — 대신 체크리스트 탭에서
 * "＋ 항목 직접 추가하기"로 사용자가 덧붙인 항목만 편집 대상. 두 화면이 같은
 * S.customClItems 배열을 그대로 읽고 쓰기 때문에 별도 동기화 코드 없이 서로 반영됨
 * (체크리스트 탭에서 추가 → 설정에 바로 보임, 설정에서 수정 → 체크리스트 탭에 바로 반영).
 * 어떤 아이 기준으로 보여줄지는 지금 앱에서 선택 중인 아이(S.selC)를 그대로 씀 —
 * 체크리스트 탭에서 그 항목을 추가할 때도 같은 아이가 선택돼 있었을 것이기 때문.
 */
function openEditPackExtrasModal(packKey) {
  const child = S.children[S.selC];
  if (!child) { alert('먼저 체크리스트 탭에서 아이를 등록·선택해주세요'); return; }
  const pack = clPacks.find(p => p.key === packKey);
  // v0.2.4: 'prep'(출산 준비물)처럼 clPacks에 없는 내장 탭은 PREG_ROWS/BORN_ROWS에서 라벨을 찾음
  const label = pack ? pack.label : ([...PREG_ROWS, ...BORN_ROWS].find(r => r.key === packKey)?.label || '');
  const customKey = `${child.id}_${resolveCatKey(packKey)}`;
  const items = (S.customClItems && S.customClItems[customKey]) || [];

  showModal(`"${label}"에 직접 추가한 항목`, `
    <div class="cl-form-msg" style="margin-top:0;color:var(--txl);font-weight:600">${escapeHtml(child.name || '')} 기준이에요. 원래 있던 기본 항목은 여기서 못 바꿔요.</div>
    <div class="fg" style="margin-top:10px">
      <div id="editClItemsList">${items.map((it, i) => editItemRowHtml(it, i)).join('')}</div>
      <button type="button" class="cl-add-item-btn" style="margin-top:8px" onclick="addEditClItemRow()">＋ 항목 추가</button>
    </div>
    <div class="cl-form-msg" id="editClMsg"></div>
    <button class="btn bpk" style="width:100%;margin-top:10px" onclick="submitEditPackExtras('${packKey}')">저장</button>
  `);
}

export function submitEditPackExtras(packKey) {
  const child = S.children[S.selC];
  if (!child) return;
  const customKey = `${child.id}_${resolveCatKey(packKey)}`;
  const existing = (S.customClItems && S.customClItems[customKey]) || [];

  const rows = Array.from(document.querySelectorAll('#editClItemsList .cl-edit-item-row'));
  const items = [];
  rows.forEach((row) => {
    const text = row.querySelector('.cl-edit-item-text')?.value.trim();
    if (!text) return; // 빈 항목은 삭제로 취급
    const req = !!row.querySelector('.cl-edit-item-req-cb')?.checked;
    const idxAttr = row.getAttribute('data-idx');
    const original = /^\d+$/.test(idxAttr) ? existing[Number(idxAttr)] : null;
    const id = original ? original.id : `custom_${Date.now()}_${items.length}`; // 체크리스트 탭의 "+ 항목 추가"와 같은 id 접두어 규칙
    items.push({ id, t: text, r: req });
  });

  if (!S.customClItems) S.customClItems = {};
  S.customClItems[customKey] = items;
  // 삭제된 항목의 체크 상태도 함께 정리
  if (S.checks[customKey]) {
    const validIds = new Set(items.map((i) => i.id));
    Object.keys(S.checks[customKey]).forEach((id) => {
      if (id.startsWith('custom_') && !validIds.has(id)) delete S.checks[customKey][id];
    });
  }

  cm();
  debounceSave();
  window.renderChecklist?.(); // 체크리스트 탭이 열려있으면 다음에 그 탭을 볼 때 바로 반영됨
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

  const { legacyKey, legacyItems } = legacyItemsFor(key);
  const allItems = [...cl.items, ...legacyItems];

  const rows = Array.from(document.querySelectorAll('#editClItemsList .cl-edit-item-row'));
  const items = [];
  rows.forEach((row) => {
    const text = row.querySelector('.cl-edit-item-text')?.value.trim();
    if (!text) return; // 빈 항목은 무시(삭제한 것으로 취급)
    const req = !!row.querySelector('.cl-edit-item-req-cb')?.checked;
    const idxAttr = row.getAttribute('data-idx');
    const original = /^\d+$/.test(idxAttr) ? allItems[Number(idxAttr)] : null;
    // 기존 항목은 id를 유지해야 그동안 체크한 상태(S.checks)가 끊기지 않음
    const id = original ? original.id : `cclt_${cl.id}_${Date.now()}_${items.length}`;
    items.push({ id, t: text, r: req });
  });

  if (!items.length) { if (msgEl) { msgEl.textContent = '항목을 한 개 이상 남겨주세요'; msgEl.classList.add('cl-form-msg-err'); } return; }

  cl.label = label;
  cl.items = items; // 레거시 항목까지 포함한 전체 목록으로 교체 — 이제부터 한곳(cl.items)에서만 관리됨
  if (legacyKey && S.customClItems) delete S.customClItems[legacyKey]; // 마이그레이션 완료, 중복 방지

  cm();
  debounceSave();
  renderChecklistSettings();
  window.renderChecklist?.();
}

/* ── 정부지원 항목 직접 추가 (v0.2.4) ──
 * 앱이 기본 제공하는 전국 단위 정부지원 일정(data/government-support.js) 외에, 지자체마다
 * 다른 지원금처럼 앱에 없는 항목을 사용자가 직접 추가하는 기능. 날짜를 직접 골라서 넣는
 * 방식이라(임신 주차·출생 후 개월수 기준 자동 계산이 아님) 관리가 단순함 — 추가한 항목은
 * js/calendar.js의 getAutoEvs()가 읽어서 기존 정부지원 항목과 완전히 같은 방식으로 캘린더·
 * 체크리스트 정부지원 탭에 표시됨(js/govSupport.js도 참고). stage로 임산부용/육아용을
 * 구분하는데, S.customGovItems 자체는 커스텀 체크리스트처럼 가족 전체가 공유하는 목록이고
 * (아이별로 따로 저장하지 않음), 화면에는 지금 아이의 stage와 같은 항목만 보임. */

function govItemRowHtml(it) {
  return `
    <div class="cl-edit-item-row" data-id="${it.id}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:.8rem">${escapeHtml(it.title)} ${it.imp === 'req' ? '<span class="badge-r">필수</span>' : '<span class="badge-o">해당자</span>'}</div>
        <div style="font-size:.7rem;color:var(--txl);margin-top:2px">${escapeHtml(it.date)}${it.desc ? ' · ' + escapeHtml(it.desc) : ''}</div>
      </div>
      <button type="button" class="cl-edit-item-remove" aria-label="이 항목 삭제" onclick="deleteCustomGovItem('${it.id}')">
        <span class="icon icon-sm" translate="no" aria-hidden="true">close</span>
      </button>
    </div>`;
}

export function openGovItemsModal(stage) {
  const items = (S.customGovItems || []).filter(it => it.stage === stage);
  const stageLabel = stage === 'preg' ? '임산부용' : '육아용';
  showModal(`정부지원 항목 직접 추가 (${stageLabel})`, `
    <div class="cl-form-msg" style="margin-top:0;color:var(--txl);font-weight:600">지자체별 지원금처럼 앱에 없는 정부지원 항목을 추가하면 캘린더·체크리스트 정부지원 탭에 똑같이 표시돼요.</div>
    <div id="govItemsList" style="margin-top:10px">${items.length ? items.map(govItemRowHtml).join('') : '<div class="cl-form-msg" style="margin:0">아직 직접 추가한 항목이 없어요</div>'}</div>
    <div class="fg" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-200)">
      <label>새 항목 추가</label>
      <input id="newGovTitle" placeholder="예) OO구 출산지원금" maxlength="30" style="margin-top:6px">
      <div class="fg2" style="margin-top:8px">
        <div>
          <label style="font-size:.72rem">날짜</label>
          <input id="newGovDate" type="date">
        </div>
        <div>
          <label style="font-size:.72rem">중요도</label>
          <div class="stage-toggle" style="margin:4px 0 0">
            <button type="button" class="st-btn on" id="newGovImpReq" onclick="setNewGovImp('req')">필수</button>
            <button type="button" class="st-btn" id="newGovImpRec" onclick="setNewGovImp('rec')">해당자</button>
          </div>
        </div>
      </div>
      <input id="newGovDesc" placeholder="설명 (선택)" maxlength="60" style="margin-top:8px">
      <input id="newGovLink" placeholder="신청 링크 (선택)" maxlength="200" style="margin-top:8px">
    </div>
    <div class="cl-form-msg" id="newGovMsg"></div>
    <button class="btn bpk" style="width:100%;margin-top:10px" onclick="submitAddGovItem('${stage}')">추가하기</button>
  `);
  window._newGovImp = 'req';
}

export function setNewGovImp(val) {
  window._newGovImp = val === 'rec' ? 'rec' : 'req';
  document.getElementById('newGovImpReq')?.classList.toggle('on', window._newGovImp === 'req');
  document.getElementById('newGovImpRec')?.classList.toggle('on', window._newGovImp === 'rec');
}

export function submitAddGovItem(stage) {
  const title = (document.getElementById('newGovTitle')?.value || '').trim();
  const date  = document.getElementById('newGovDate')?.value || '';
  const desc  = (document.getElementById('newGovDesc')?.value || '').trim();
  const link  = (document.getElementById('newGovLink')?.value || '').trim();
  const msgEl = document.getElementById('newGovMsg');
  if (!title) { if (msgEl) { msgEl.textContent = '항목 이름을 입력해주세요'; msgEl.classList.add('cl-form-msg-err'); } return; }
  if (!date)  { if (msgEl) { msgEl.textContent = '날짜를 선택해주세요';     msgEl.classList.add('cl-form-msg-err'); } return; }

  if (!S.customGovItems) S.customGovItems = [];
  S.customGovItems.push({
    id: `gov_${Date.now()}`, title, stage, date,
    imp: window._newGovImp === 'rec' ? 'rec' : 'req', desc, link,
  });

  debounceSave();
  renderChecklistSettings();
  openGovItemsModal(stage); // 방금 추가한 항목이 반영된 목록으로 다시 열기
  window.renderChecklist?.();
  if (document.getElementById('pg-calendar')?.classList.contains('on')) window.renderCal?.();
}

export function deleteCustomGovItem(id) {
  if (!confirm('이 정부지원 항목을 삭제할까요?')) return;
  const item = (S.customGovItems || []).find(it => it.id === id);
  S.customGovItems = (S.customGovItems || []).filter(it => it.id !== id);
  // 지금까지 이 항목에 저장된 신청 상태(신청 완료 등)도 함께 정리
  if (item && S.eventMods) delete S.eventMods[`auto_${item.date}_${item.title}`];

  debounceSave();
  renderChecklistSettings();
  // v0.2.5: 이 삭제 버튼은 두 곳에서 쓰임 — (1) 설정의 "정부지원 항목 직접 추가" 관리 모달
  // 안 목록, (2) 체크리스트 → 정부지원 탭의 항목 목록(모달 없이 바로 삭제). (2)에서 눌렀을 때도
  // 무조건 openGovItemsModal()을 다시 열어버려서, 추가 버튼을 누르지 않았는데도 "항목 추가"
  // 팝업이 뜨는 버그였음(옹짐꾼님 제보).
  // v0.2.5의 수정은 "#govItemsList가 DOM에 있으면 모달이 열린 것"으로 판단했는데 이게 틀렸음:
  // 모달을 닫는 cm()(js/modal.js)은 #modal에서 open 클래스만 떼고 #mB의 innerHTML은 지우지
  // 않아서(display:none으로 안 보이기만 함), 이 모달을 한 번이라도 열었다 닫으면 그 뒤로도
  // #govItemsList가 DOM에 계속 남아 있었음 — 그래서 체크리스트 탭에서 지울 때도 "모달이 열려
  //있다"고 잘못 판단해 버그가 재현된 것. #modal 자체가 실제로 open 클래스를 갖고 있는지(화면에
  // 보이는 상태인지)까지 함께 확인해야 진짜로 "지금 열려있는지"를 판단할 수 있음.
  const govModalOpen = document.getElementById('modal')?.classList.contains('open')
    && document.getElementById('govItemsList');
  if (item && govModalOpen) {
    openGovItemsModal(item.stage);
  }
  window.renderChecklist?.();
  if (document.getElementById('pg-calendar')?.classList.contains('on')) window.renderCal?.();
}

window.toggleClTabHidden        = toggleClTabHidden;
window.toggleClCalendarSync     = toggleClCalendarSync;
window.renderChecklistSettings  = renderChecklistSettings;
window.openCreateChecklistModal = openCreateChecklistModal;
window.setNewClStage            = setNewClStage;
window.submitCreateChecklist    = submitCreateChecklist;
window.deleteCustomChecklist    = deleteCustomChecklist;
window.openEditChecklistModal   = openEditChecklistModal;
window.submitEditPackExtras     = submitEditPackExtras;
window.addEditClItemRow         = addEditClItemRow;
window.submitEditChecklist      = submitEditChecklist;
window.openGovItemsModal        = openGovItemsModal;
window.setNewGovImp             = setNewGovImp;
window.submitAddGovItem         = submitAddGovItem;
window.deleteCustomGovItem      = deleteCustomGovItem;
