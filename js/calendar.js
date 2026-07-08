/**
 * js/calendar.js — Sprint 2 업데이트
 *
 * 추가 기능:
 * - 이벤트 클릭 → 수정 Modal (권장일·실제일·메모·완료, "내 일정"은 제목·시작/종료 시간·색상도 수정 가능 — v0.0.17)
 * - 완료 시 ✅ 표시 (캘린더 필 + 데이 패널)
 * - PC 드래그앤드롭으로 일정 이동
 * - 모바일 길게 눌러 이동 (500ms long press)
 * - S.eventMods 에 수정 내용 저장 → Firebase 반영
 */

import { S, debounceSave } from './state.js';
import { today, daysUntil, stripLeadingEmoji, icon } from './utils.js';
import { showModal, cm }   from './modal.js';
import { vaxSched }        from '../data/vaccines.js';
import { pregEvMap }       from '../data/pregnancy.js';
import { checkEvs } from '../data/milestones.js';
import { recalcVaccineSeries } from './vaccineSeries.js';
import { govSupportSchedule } from '../data/government-support.js';
import { getHoliday } from '../data/kr-holidays.js';

/**
 * 정부지원 항목 마감 임박 여부 (Sprint 20)
 * - 정확한 마감일(deadlineDate)이 있는 항목만 대상 (deadlineNote만 있는 항목은 정확한 날짜 계산 불가)
 * - 이미 신청/지급 완료 처리된 항목은 더 이상 임박 표시 안 함
 * - 마감까지 7일 이하로 남았거나 이미 지난 경우 true
 */
export function isGovDeadlineSoon(e) {
  if (e.type !== 'gov' || !e.deadlineDate) return false;
  if (e.govStatus === 'applied' || e.govStatus === 'paid') return false;
  const d = daysUntil(e.deadlineDate);
  return d !== null && d <= 7;
}

/* ══════════════════════════════════════
 *  일정 색상 시스템 (Sprint 21)
 * ══════════════════════════════════════
 * 캘린더 필에서 이모지 아이콘을 없애고, 대신 타입별 색상으로 구분한다.
 * - 이유식(food)은 데이터상 req/rec 타입을 그대로 쓰지만(cat:'food'만 붙음),
 *   색상 구분에서는 별도 카테고리로 취급해 "🔴이유식"처럼 눈에 띄게 함
 * - 사용자가 색상을 직접 바꾸면 S.evColors에 저장되고(Firebase/localStorage 공통),
 *   지정하지 않은 카테고리는 DEFAULT_EV_COLORS를 그대로 사용
 */
export const DEFAULT_EV_COLORS = {
  req:    '#F06292', // 필수
  rec:    '#26A69A', // 추천
  food:   '#E53935', // 이유식
  vax:    '#9575CD', // 접종
  gov:    '#43A047', // 정부지원
  custom: '#64B5F6', // 내 일정
};

export const EV_CATEGORY_LABELS = {
  req: '필수', rec: '추천', food: '이유식', vax: '접종', gov: '정부지원', custom: '내 일정',
};

export const EV_CATEGORY_ORDER = ['req', 'rec', 'food', 'vax', 'gov', 'custom'];

/** 이벤트 → 색상 카테고리 (이유식은 type과 무관하게 별도 카테고리) */
export function getEvCategory(e) {
  return e.cat === 'food' ? 'food' : e.type;
}

/** 카테고리 → 실제 표시 색상 (사용자 지정 > 기본값) */
export function getEvColor(cat) {
  return (S.evColors && S.evColors[cat]) || DEFAULT_EV_COLORS[cat] || '#9E9E9E';
}

/**
 * v0.0.16: 일정 1건의 실제 표시 색상.
 * "내 일정"(custom)으로 직접 추가한 일정은 추가할 때 고른 색(e.color)을 그대로 쓰고,
 * 그 외(필수/추천/접종/정부지원 등)는 기존처럼 카테고리 공통 색(범례에서 바꿀 수 있음)을 쓴다.
 * "내 일정"을 카테고리 공통 색 하나로 묶어두면 여러 개인 일정을 구분하기 어렵다는
 * 피드백으로, "내 일정"만 일정 추가 시 직접 색을 고르는 방식으로 바꿈(범례에서는 제외됨).
 */
export function getEvDisplayColor(e) {
  if (e.type === 'custom' && e.color) return e.color;
  return getEvColor(getEvCategory(e));
}

/**
 * v0.0.17: "내 일정" 색상 선택 폭이 너무 넓다는 피드백(자유 색상 피커) — 파스텔 톤 7개 중
 * 고르는 방식으로 변경. 첫 번째("하늘")는 기존 기본색(#64B5F6)과 동일해서, 이미 저장된
 * 옛 일정도 그대로 프리셋 중 하나로 자연스럽게 매칭됨.
 */
export const CUSTOM_EV_COLOR_PRESETS = [
  { name: '하늘',   color: '#64B5F6' },
  { name: '민트',   color: '#80CBC4' },
  { name: '라벤더', color: '#B39DDB' },
  { name: '로즈',   color: '#F48FB1' },
  { name: '피치',   color: '#FFAB91' },
  { name: '레몬',   color: '#FFE082' },
  { name: '그레이', color: '#B0BEC5' },
];

/** 색상 스와치 UI(숨김 input + 동그란 버튼들) HTML — 일정 추가 폼·수정 모달에서 공용으로 씀 */
function colorSwatchesHtml(hiddenInputId, selectedColor) {
  const sel = (selectedColor || CUSTOM_EV_COLOR_PRESETS[0].color).toLowerCase();
  return `
    <input type="hidden" id="${hiddenInputId}" value="${sel}">
    <div class="ev-color-swatches">
      ${CUSTOM_EV_COLOR_PRESETS.map(p => `
        <button type="button"
                class="ev-color-swatch${p.color.toLowerCase() === sel ? ' on' : ''}"
                style="background:${p.color}" title="${p.name}"
                onclick="selectEvColorSwatch('${hiddenInputId}', '${p.color}', this)"></button>
      `).join('')}
    </div>`;
}

/** 스와치 클릭 핸들러 — 숨김 input 값을 갱신하고 선택 표시를 옮김 */
export function selectEvColorSwatch(inputId, color, btn) {
  const input = document.getElementById(inputId);
  if (input) input.value = color;
  btn.parentElement.querySelectorAll('.ev-color-swatch').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}
window.selectEvColorSwatch = selectEvColorSwatch;

/** 일정 추가 폼의 색상 스와치 렌더 — renderCal()에서 캘린더 탭을 열 때마다 호출됨.
 *  이미 골라둔 색이 있으면 그대로 유지(일정을 여러 개 연달아 추가할 때 매번 다시
 *  고르지 않아도 되도록) — 없으면 첫 번째 프리셋("하늘")을 기본값으로 보여줌 */
export function renderAddEvColorSwatches() {
  const wrap = document.getElementById('evColorSwatchWrap');
  if (!wrap) return;
  const prevColor = document.getElementById('evColor')?.value;
  wrap.innerHTML = colorSwatchesHtml('evColor', prevColor || CUSTOM_EV_COLOR_PRESETS[0].color);
}

/** 사용자가 특정 카테고리 색상을 직접 지정 */
export function setEvColor(cat, color) {
  if (!S.evColors) S.evColors = {};
  S.evColors[cat] = color;
  renderCal(); // renderCal() 내부에서 renderCalLegend()도 함께 호출됨
  if (document.getElementById('pg-checklist')?.classList.contains('on')) {
    window.renderGovChecklistTab?.(S.children?.[S.selC]);
  }
  debounceSave();
}

/** 특정 카테고리 색상을 기본값으로 되돌림 */
export function resetEvColor(cat) {
  if (S.evColors) delete S.evColors[cat];
  renderCal();
  if (document.getElementById('pg-checklist')?.classList.contains('on')) {
    window.renderGovChecklistTab?.(S.children?.[S.selC]);
  }
  debounceSave();
}

/**
 * 캘린더 하단 색상 범례 렌더 — 각 항목을 탭하면 색상을 직접 고를 수 있음
 * v0.0.16: "내 일정"(custom)은 일정을 추가할 때 직접 색을 고르는 방식으로 바뀌어서
 * 범례에서는 제외함(카테고리 공통 색 하나로 묶어두면 여러 개인 일정을 구분하기 어려웠음)
 */
export function renderCalLegend() {
  const el = document.getElementById('calLegend');
  if (!el) return;
  el.innerHTML = EV_CATEGORY_ORDER.filter(cat => cat !== 'custom').map(cat => {
    const color = getEvColor(cat);
    const label = EV_CATEGORY_LABELS[cat];
    const isCustomColor = !!(S.evColors && S.evColors[cat]);
    return `
      <label class="legend-item" title="탭해서 ${label} 색상 바꾸기">
        <input type="color" class="legend-color-input" value="${color}"
               onchange="setEvColor('${cat}', this.value)">
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-label">${label}</span>
        ${isCustomColor ? `<span class="legend-reset" title="기본색으로" onclick="event.preventDefault();resetEvColor('${cat}')">↺</span>` : ''}
      </label>`;
  }).join('');
}
window.setEvColor   = setEvColor;
window.resetEvColor = resetEvColor;

/* ══════════════════════════════════════
 *  테마
 * ══════════════════════════════════════ */
export const themes = {
  rose:     { g: 'linear-gradient(135deg,#F48FB1,#CE93D8)', cell: '#FFF5FA', today: '#F06292' },
  mint:     { g: 'linear-gradient(135deg,#80DEEA,#4DB6AC)', cell: '#F0FAF8', today: '#4DB6AC' },
  sunny:    { g: 'linear-gradient(135deg,#FFD54F,#FF8A65)', cell: '#FFFDE7', today: '#FF8A65' },
  lavender: { g: 'linear-gradient(135deg,#B39DDB,#80CBC4)', cell: '#F3EFF9', today: '#9575CD' },
  peach:    { g: 'linear-gradient(135deg,#FFAB91,#F48FB1)', cell: '#FFF3EE', today: '#FF8A65' },
};

/* ══════════════════════════════════════
 *  이벤트 캐시 & 편집 상태
 * ══════════════════════════════════════ */
let _cachedEvs   = [];   // getAllEvs() 결과 (인덱스 포함)
let _editingIdx  = -1;   // openEvModal에서 편집 중인 인덱스

/* ══════════════════════════════════════
 *  드래그 상태 — PC
 * ══════════════════════════════════════ */
let _dragIdx = null;

/* ══════════════════════════════════════
 *  드래그 상태 — 모바일 (Long Press)
 * ══════════════════════════════════════ */
let _touchTimer     = null;
let _touchIdx       = null;
let _mobileDragging = false;
let _ghostEl        = null;

/* ══════════════════════════════════════
 *  이벤트 키 & 모드 유틸
 * ══════════════════════════════════════ */

/** 이벤트마다 고유 키 생성 (Firebase 저장용) */
function getEventKey(ev) {
  if (!ev.auto) return 'custom_' + ev._id;
  // 자동 이벤트는 원본 날짜 + 제목으로 키 고정
  return 'auto_' + (ev._origDate || ev.date) + '_' + ev.title;
}

/** S.eventMods 를 자동 이벤트에 적용 */
function applyMods(evs) {
  if (!S.eventMods) return evs;
  return evs.map(ev => {
    const mod = S.eventMods[getEventKey(ev)];
    if (!mod) return ev;
    return {
      ...ev,
      date:     mod.actualDate || ev.date,
      recDate:  ev._origDate || ev.date,   // 권장일(원본)
      hospital: mod.hospital || '',
      note:     mod.memo     || ev.note || '',
      done:     !!mod.done,
      recalculated: !!mod.recalculated,    // Sprint 6: 자동 재계산으로 조정된 일정인지
      govStatus: mod.govStatus || 'none',  // Sprint 6: 정부지원 진행 상태
    };
  });
}

/** S.eventMods 를 커스텀 이벤트에 적용 (done/hospital/memo) */
function applyCustomMods(evs) {
  if (!S.eventMods) return evs;
  return evs.map(ev => {
    const mod = S.eventMods['custom_' + ev._id];
    if (!mod) return ev;
    return {
      ...ev,
      done:     !!mod.done,
      hospital: mod.hospital || '',
      note:     mod.memo     || ev.note || '',
    };
  });
}

/* ══════════════════════════════════════
 *  전체 이벤트 (모드 적용 + 인덱스 부여)
 * ══════════════════════════════════════ */
export function getAllEvs() {
  const auto   = applyMods(getAutoEvs(S.children[S.selC]));
  const custom = applyCustomMods(S.customEvs);
  _cachedEvs   = [...auto, ...custom].map((ev, i) => ({ ...ev, _idx: i }));
  return _cachedEvs;
}

/**
 * 이벤트 이동 (드래그 결과)
 * Sprint 11: idx 하나 또는 배열(묶음 예방접종 그룹 전체 이동) 모두 지원
 */
function moveEvent(idxOrArr, newDate) {
  const indices = Array.isArray(idxOrArr) ? idxOrArr : [idxOrArr];
  if (!S.eventMods) S.eventMods = {};
  const child = S.children[S.selC];

  let allRecalced = [];
  indices.forEach(idx => {
    const ev = _cachedEvs[idx];
    if (!ev) return;
    const key = getEventKey(ev);

    if (ev.auto) {
      // 자동 이벤트 → eventMods 에 실제일 저장
      S.eventMods[key] = { ...(S.eventMods[key] || {}), actualDate: newDate };
      // Sprint 6: 예방접종이면 이후 회차 자동 재계산
      if (ev.type === 'vax') {
        const autoVaxEvs = getAutoEvs(child).filter(e => e.type === 'vax');
        allRecalced = allRecalced.concat(recalcVaccineSeries(autoVaxEvs, ev.title, newDate));
      }
    } else {
      // 커스텀 이벤트 → 직접 날짜 변경
      const ce = S.customEvs.find(e => e._id === ev._id);
      if (ce) ce.date = newDate;
    }
  });

  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();

  if (allRecalced.length) {
    // 그룹 이동 시 중복 안내 방지 (같은 항목이 두 번 잡히는 경우 제거)
    const seen = new Set();
    const uniq = allRecalced.filter(c => {
      const k = c.title + '|' + c.newDate;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    showRecalcNotice(uniq);
  }
}

/* ══════════════════════════════════════
 *  일정 수정 Modal
 * ══════════════════════════════════════ */

/** 일정 수정 Modal 열기 */
export function openEvModal(idx) {
  const ev = _cachedEvs[idx];
  if (!ev) return;
  _editingIdx = idx;

  if (!S.eventMods) S.eventMods = {};
  const key      = getEventKey(ev);
  const mod      = S.eventMods[key] || {};
  const recDate  = ev.recDate || ev._origDate || ev.date;
  const actDate  = mod.actualDate || ev.date;
  const memo     = mod.memo     || ev.note || '';
  const done     = !!mod.done;
  const isGov    = ev.type === 'gov';
  const govStatus = mod.govStatus || 'none';
  // v0.0.17: "내 일정"으로 직접 추가한 일정(!ev.auto)만 제목·시작/종료 시간을 수정할 수 있음 —
  // 자동 생성 일정(예방접종·정부지원 등)은 제목이 데이터에서 나오는 값이라 수정 대상에서 제외
  const { time: parsedTime, endTime: parsedEndTime, title: parsedTitle } = ev.auto
    ? { time: '', endTime: '', title: '' }
    : parseEvTitleWithTime(ev.title);

  const typeLabel = {
    req: `${icon('star', { size: 'sm' })} 필수`, rec: `${icon('recommend', { size: 'sm' })} 추천`,
    vax: `${icon('vaccines', { size: 'sm' })} 접종`, gov: `${icon('account_balance', { size: 'sm' })} 정부지원`, custom: `${icon('push_pin', { size: 'sm' })} 내 일정`,
  }[ev.type] || '';

  const govStatusOptions = [
    { val: 'none',    label: '신청 전' },
    { val: 'applied', label: '신청 완료' },
    { val: 'paid',    label: '지급 완료' },
  ];

  showModal(stripLeadingEmoji(ev.title), `
    <div style="font-size:.72rem;font-weight:800;color:var(--txl);margin:-4px 0 14px">
      ${typeLabel}${isGov && ev.imp ? (ev.imp === 'req' ? '<span class="badge-r">필수</span>' : '<span class="badge-o">해당자</span>') : ''}
    </div>

    ${isGov ? (() => {
      const urgent = isGovDeadlineSoon(ev);
      const dLeft  = urgent ? daysUntil(ev.deadlineDate) : null;
      const urgentText = dLeft === null ? '' : dLeft < 0 ? ' (마감 지남)' : dLeft === 0 ? ' (오늘 마감)' : ` (D-${dLeft})`;
      return `
      <div style="background:${urgent ? '#FFF3F3' : '#F8F4FA'};border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:.78rem;color:var(--tx);line-height:1.6;${urgent ? 'border:1.5px solid #C62828' : ''}">
        ${ev.desc ? `<div>${ev.desc}</div>` : ''}
        ${(ev.deadlineDate || ev.deadlineNote) ? `<div style="color:#C62828;font-weight:800;margin-top:6px">⏰ 마감: ${ev.deadlineDate || ev.deadlineNote}${urgentText}</div>` : ''}
        ${ev.link ? `<a href="${ev.link}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;color:var(--bl);font-weight:800;text-decoration:underline"><span class="icon icon-sm" translate="no" aria-hidden="true">open_in_new</span> 관련 기관 바로가기</a>` : ''}
      </div>`;
    })() : ''}

    ${ev.auto ? `
      <div class="fg">
        <label><span class="icon icon-sm" translate="no" aria-hidden="true">event_available</span> 권장일</label>
        <input type="date" value="${recDate}" readonly
               style="background:#F8F4FA;color:var(--txl);cursor:default;border-color:#EEE0F0">
      </div>` : `
      <div class="fg">
        <label><span class="icon icon-sm" translate="no" aria-hidden="true">edit_note</span> 제목</label>
        <input id="evModTitle" value="${esc(parsedTitle)}">
      </div>
      <div class="fg2">
        <div class="fg" style="margin:0"><label>시작 시간 (선택)</label><input type="time" id="evModTime" value="${parsedTime}"></div>
        <div class="fg" style="margin:0"><label>종료 시간 (선택)</label><input type="time" id="evModEndTime" value="${parsedEndTime}"></div>
      </div>`}

    <div class="fg">
      <label><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> ${isGov ? '신청 예정일' : '실제 일정'}</label>
      <input type="date" id="evModDate" value="${actDate}">
    </div>
    ${(ev.type === 'custom' && !ev.auto) ? `
      <div class="fg">
        <label><span class="icon icon-sm" translate="no" aria-hidden="true">palette</span> 일정 색상</label>
        ${colorSwatchesHtml('evModColor', ev.color || getEvColor('custom'))}
      </div>` : ''}
    <div class="fg">
      <label><span class="icon icon-sm" translate="no" aria-hidden="true">edit_note</span> 메모</label>
      <input id="evModMemo" placeholder="메모 (선택)" value="${memo}">
    </div>

    ${isGov ? `
      <input type="hidden" id="evModGovStatus" value="${govStatus}">
      <div class="fg">
        <label><span class="icon icon-sm" translate="no" aria-hidden="true">flag</span> 진행 상태</label>
        <div class="type-row" id="govStatusRow">
          ${govStatusOptions.map(o => `
            <button type="button" class="type-btn${o.val === govStatus ? ' on' : ''}"
                    onclick="setGovStatusRadio('${o.val}')">${o.label}</button>`).join('')}
        </div>
      </div>` : `
      <div style="display:flex;align-items:center;gap:10px;
                  padding:12px 14px;background:#F0FFF4;border-radius:12px;
                  margin-bottom:14px;cursor:pointer"
           onclick="document.getElementById('evModDone').click()">
        <input type="checkbox" id="evModDone"
               style="width:18px;height:18px;accent-color:var(--mn);cursor:pointer"
               ${done ? 'checked' : ''}
               onclick="event.stopPropagation()">
        <label for="evModDone"
               style="font-weight:800;font-size:.9rem;cursor:pointer;color:#2E7D32">
          <span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span> 완료로 표시
        </label>
      </div>`}

    <button class="btn bpk" onclick="saveEventMod()"><span class="icon icon-sm" translate="no" aria-hidden="true">save</span> 저장</button>
    ${!ev.auto ? `
      <button class="btn" style="margin-top:8px;background:#FFF5F5;color:#E53935;
                                  box-shadow:none;border:1px solid #FFCDD2"
              onclick="delCustomEv(${ev._id});cm()"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span> 삭제</button>` : ''}
  `);
}

/** Sprint 6: 정부지원 진행 상태 버튼 클릭 */
export function setGovStatusRadio(val) {
  const input = document.getElementById('evModGovStatus');
  if (input) input.value = val;
  document.querySelectorAll('#govStatusRow .type-btn').forEach(b => {
    b.classList.toggle('on', b.textContent.trim() === ({ none: '신청 전', applied: '신청 완료', paid: '지급 완료' })[val]);
  });
}

/** 수정 내용 저장 */
export function saveEventMod() {
  const ev = _cachedEvs[_editingIdx];
  if (!ev) { cm(); return; }

  if (!S.eventMods) S.eventMods = {};
  const key        = getEventKey(ev);
  const mod        = S.eventMods[key] || {};
  const isGov      = ev.type === 'gov';
  const actualDate = document.getElementById('evModDate')?.value    || ev.date;
  // v0.0.17: 병원명 입력 필드는 없앴지만(요청), 예전에 이미 저장된 값이 있다면 그대로 유지
  // (수정 모달에서 다른 항목을 저장할 때 조용히 지워지지 않도록)
  const hospital   = mod.hospital || '';
  const memo       = document.getElementById('evModMemo')?.value     || '';
  const govStatus  = isGov ? (document.getElementById('evModGovStatus')?.value || 'none') : undefined;
  const done       = isGov ? govStatus === 'paid' : (document.getElementById('evModDone')?.checked || false);

  // v0.0.17: "내 일정"(!ev.auto)은 제목·시작/종료 시간도 함께 검증·반영
  if (!ev.auto) {
    const newTime    = document.getElementById('evModTime')?.value    || '';
    const newEndTime = document.getElementById('evModEndTime')?.value || '';
    const newTitle   = document.getElementById('evModTitle')?.value.trim() || '';
    if (!newTitle) { alert('제목을 입력해주세요'); return; }
    if (newTime && newEndTime && newEndTime <= newTime) {
      alert('종료 시간이 시작 시간보다 늦어야 해요');
      return;
    }
    const ce = S.customEvs.find(e => e._id === ev._id);
    if (ce) {
      ce.date  = actualDate;
      ce.title = buildEvTitleWithTime(newTime, newEndTime, newTitle);
      if (ev.type === 'custom') {
        const colorInput = document.getElementById('evModColor');
        if (colorInput) ce.color = colorInput.value;
      }
    }
  }

  S.eventMods[key] = isGov
    ? { actualDate, hospital, memo, done, govStatus }
    : { actualDate, hospital, memo, done };

  // Sprint 6: 예방접종이면 이후 회차 자동 재계산 (병원 권장 최소 간격 유지)
  let recalced = [];
  if (ev.auto && ev.type === 'vax') {
    const autoVaxEvs = getAutoEvs(S.children[S.selC]).filter(e => e.type === 'vax');
    recalced = recalcVaccineSeries(autoVaxEvs, ev.title, actualDate);
  }

  // Sprint 11: 체크리스트 연동 — 예방접종·건강검진처럼 연결된 체크리스트 항목이 있으면 함께 갱신
  if (ev.auto && (ev.type === 'vax' || ev.type === 'req' || ev.type === 'rec')) {
    window.syncCalendarToChecklist?.(S.children[S.selC], ev.title, ev.type, done);
  }

  cm();
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();

  // Sprint 10 버그 수정: 체크리스트 "🟢 정부지원" 탭이 열려 있을 때, 캘린더 모달에서
  // 상태를 바꿔도 반영이 안 되고 다른 탭을 다녀와야만 갱신되던 문제 수정
  if (document.getElementById('pg-checklist')?.classList.contains('on')) {
    window.renderClSidebar?.();
  }

  if (recalced.length) showRecalcNotice(recalced);
}

/** Sprint 6: 예방접종 회차 자동 조정 안내 모달 */
function showRecalcNotice(changed) {
  showModal('이후 접종일 자동 조정', `
    <p style="font-size:.86rem;line-height:1.7;margin-bottom:12px;color:var(--tx)">
      실제 접종일 기준으로 이후 일정을 자동 조정했습니다.<br>
      <span style="font-size:.74rem;color:var(--txl);font-weight:600">(병원 권장 최소 간격은 유지했어요)</span>
    </p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
      ${changed.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:9px 13px;background:var(--pul);border-radius:11px;
                    font-size:.8rem;font-weight:800;color:#4A148C">
          <span><span class="icon icon-sm" translate="no" aria-hidden="true">vaccines</span> ${stripLeadingEmoji(c.title)}</span><span><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> ${c.newDate}</span>
        </div>`).join('')}
    </div>
    <button class="btn bpk" onclick="cm()">확인</button>
  `);
}

/* ══════════════════════════════════════
 *  드래그앤드롭 — PC
 * ══════════════════════════════════════ */

export function onDragStart(evt, idx) {
  _dragIdx = idx;
  evt.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { if (evt.target) evt.target.style.opacity = '0.4'; }, 0);
}

export function onDragEnd(evt) {
  if (evt.target) evt.target.style.opacity = '1';
  _dragIdx = null;
}

export function onDragOver(evt) {
  evt.preventDefault();
  evt.currentTarget.classList.add('drag-over');
}

export function onDragLeave(evt) {
  evt.currentTarget.classList.remove('drag-over');
}

export function onDrop(evt, ds) {
  evt.preventDefault();
  evt.currentTarget.classList.remove('drag-over');
  if (_dragIdx === null) return;
  moveEvent(_dragIdx, ds);
  _dragIdx = null;
}

/* ══════════════════════════════════════
 *  드래그앤드롭 — 모바일 (Long Press 500ms)
 *
 * Sprint 9 버그 수정: 길게 눌러 드래그하는 도중 스크롤 등 시스템 제스처가 끼어들면
 * 브라우저가 touchend 대신 touchcancel을 발생시키는데, 기존엔 이 경우를 처리하지
 * 않아 고스트 요소(.drag-ghost)가 화면에 그대로 남아 마치 일정이 캘린더 셀 밖으로
 * 삐져나와 중복된 것처럼 보이는 버그가 있었다. touchcancel을 명시적으로 처리해
 * 고스트를 반드시 제거하고 드래그 상태를 초기화한다.
 * ══════════════════════════════════════ */

/** 드래그 상태 완전 초기화 (고스트 제거 포함) */
function resetTouchDrag() {
  clearTimeout(_touchTimer);
  if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
  _mobileDragging = false;
  _touchIdx       = null;
}

export function onTouchStart(evt, idx) {
  resetTouchDrag(); // 이전에 정리되지 않은 고스트/타이머가 남아있다면 먼저 정리 (안전장치)
  _touchIdx   = idx;
  _touchTimer = setTimeout(() => {
    _mobileDragging = true;
    if (navigator.vibrate) navigator.vibrate(60);

    const touch = evt.touches[0];
    const label = Array.isArray(idx)
      ? `💉 예방접종 ${idx.length}건`
      : (stripLeadingEmoji(_cachedEvs[idx]?.title || '').slice(0, 10) || '이동 중');
    _ghostEl = document.createElement('div');
    _ghostEl.className   = 'drag-ghost';
    _ghostEl.textContent = label;
    _ghostEl.style.left  = touch.clientX - 50 + 'px';
    _ghostEl.style.top   = touch.clientY - 25 + 'px';
    document.body.appendChild(_ghostEl);
  }, 500);
}

export function onTouchMove(evt) {
  if (!_mobileDragging) {
    clearTimeout(_touchTimer);
    return;
  }
  evt.preventDefault(); // 드래그 중에만 스크롤 방지
  const touch = evt.touches[0];
  if (_ghostEl) {
    _ghostEl.style.left = touch.clientX - 50 + 'px';
    _ghostEl.style.top  = touch.clientY - 25 + 'px';
  }
}

export function onTouchEnd(evt) {
  clearTimeout(_touchTimer);
  if (!_mobileDragging) { _touchIdx = null; return; }

  if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }

  // 터치 놓은 위치의 캘린더 셀 찾기
  const touch = evt.changedTouches[0];
  const el    = document.elementFromPoint(touch.clientX, touch.clientY);
  const cell  = el?.closest('[data-date]');
  if (cell && _touchIdx !== null) {
    moveEvent(_touchIdx, cell.dataset.date);
  }

  _mobileDragging = false;
  _touchIdx       = null;
}

/** 터치가 취소된 경우(스크롤·전화 알림 등 시스템 제스처 개입) — 이동 없이 상태만 정리 */
export function onTouchCancel(_evt) {
  resetTouchDrag();
}

// 안전장치: 드래그 도중 앱 전환·알림 등으로 화면 포커스를 잃으면 고스트가 남지 않도록 정리
document.addEventListener('visibilitychange', () => { if (document.hidden) resetTouchDrag(); });
window.addEventListener('blur', resetTouchDrag);

/* ══════════════════════════════════════
 *  네비게이션
 * ══════════════════════════════════════ */

export function setTheme(t, btn) {
  S.theme = t;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderCal();
  debounceSave();
}

/**
 * v0.0.11 버그 수정: 주간 뷰에서 ◀/▶ 를 눌러도 한 주가 아니라 "한 달"씩 이동해서
 * 계속 같은 주(그 달 1일이 속한 주)만 보이던 문제.
 * 원인: renderWeekView()가 매번 `new Date(S.calY, S.calM, 1)`(그 달의 1일)을 기준으로
 * 주를 다시 계산했는데, calMove()는 월(S.calM)만 ±1 해서 주 단위 이동 상태를 따로
 * 기억할 방법이 없었음. 이제 주간 뷰 전용 기준일(S.calWeekRef)을 따로 두고,
 * 주간 뷰에서는 이 값을 7일 단위로 이동시킨다 (월간 뷰의 월 이동 로직은 그대로 유지).
 */
export function calMove(d) {
  if (S.calView === 'week') {
    if (!S.calWeekRef) S.calWeekRef = S.selDate || today();
    const wd = new Date(S.calWeekRef);
    wd.setDate(wd.getDate() + d * 7);
    S.calWeekRef = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-${String(wd.getDate()).padStart(2, '0')}`;
    // 월간 뷰로 다시 전환했을 때도 자연스럽게 이어지도록 년/월도 함께 맞춰둔다
    S.calY = wd.getFullYear();
    S.calM = wd.getMonth();
    renderCal();
    return;
  }
  S.calM += d;
  if (S.calM > 11) { S.calM = 0; S.calY++; }
  else if (S.calM < 0) { S.calM = 11; S.calY--; }
  renderCal();
}

export function setCalView(v, btn) {
  S.calView = v;
  document.querySelectorAll('.cvt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  if (v === 'week') {
    // v0.0.25: 주간 뷰로 전환할 때 "오늘"이 현재 보이는 달 안에 있으면 오늘 기준,
    // 없으면 선택된 날짜, 그도 없으면 해당 달 1일 순으로 기준일을 결정.
    // 예전엔 선택된 날짜가 없으면 무조건 1일로 이동해서 항상 첫 주부터 시작하는 문제가 있었음.
    const curMonthPrefix = `${S.calY}-${String(S.calM + 1).padStart(2, '0')}`;
    const td = today();
    if (td.startsWith(curMonthPrefix)) {
      // 보고 있는 달에 오늘이 있으면 오늘 기준으로 주 기준일 설정
      S.calWeekRef = td;
    } else if (S.selDate && S.selDate.startsWith(curMonthPrefix)) {
      // 선택된 날짜가 그 달 안이면 그 날 기준
      S.calWeekRef = S.selDate;
    } else {
      // 그 외에는 그 달 1일(이전 동작 유지)
      S.calWeekRef = `${curMonthPrefix}-01`;
    }
  }
  renderCal();
}

export function selectDate(ds) {
  S.selDate = ds;
  document.getElementById('evDate').value = ds;
  renderCal();
  showDayPanel(ds);
}

export function setEvType(t, btn) {
  S.evType = t;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  // v0.0.16: "내 일정"일 때만 색상 선택 필드를 보여줌(그 외 종류는 범례의 공통 색을 그대로 씀)
  const colorGroup = document.getElementById('evColorGroup');
  if (colorGroup) colorGroup.style.display = t === 'custom' ? 'block' : 'none';
}

/* ══════════════════════════════════════
 *  캘린더 렌더링
 * ══════════════════════════════════════ */

export function renderCal() {
  if (S.children.length) {
    document.getElementById('calChildSel').innerHTML = S.children.map((c, i) =>
      `<button onclick="S.selC=${i};renderCal()"
        style="padding:5px 11px;border-radius:40px;
               border:1.5px solid ${i == S.selC ? 'var(--pk)' : '#EEE0F0'};
               background:${i == S.selC ? 'var(--pkl)' : 'var(--wh)'};
               color:${i == S.selC ? 'var(--pkd)' : 'var(--txl)'};
               font-size:.73rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s">
        ${c.avatar} ${c.name}
      </button>`
    ).join('');
  }
  // v0.0.11: 주간 뷰는 자체 기준일(S.calWeekRef)을 따로 갖고 있어서, 그 기준일의 월/연도로 타이틀 표시
  if (S.calView === 'week' && S.calWeekRef) {
    const wd = new Date(S.calWeekRef);
    document.getElementById('calTitle').textContent = `${wd.getFullYear()}년 ${wd.getMonth() + 1}월`;
  } else {
    document.getElementById('calTitle').textContent = `${S.calY}년 ${S.calM + 1}월`;
  }
  S.calView === 'month' ? renderMonthView() : renderWeekView();
  renderCalLegend();
  renderAddEvColorSwatches(); // v0.0.17: 일정 추가 폼의 "내 일정" 색상 스와치(멱등적이라 매번 다시 그려도 안전)
}

/* ── 월간 뷰 ── */
function renderMonthView() {
  const th    = themes[S.theme];
  const evs   = getAllEvs();
  const y = S.calY, m = S.calM;
  const first    = new Date(y, m, 1).getDay();
  const last     = new Date(y, m + 1, 0).getDate();
  const td       = today();
  const days     = ['일', '월', '화', '수', '목', '금', '토'];
  const prevLast = new Date(y, m, 0).getDate();
  const dStr = (yy, mm, dd) =>
    `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  let html = `
    <div class="cal-wrap">
      <div class="cal-head-row" style="background:${th.g}">
        ${days.map((d, i) => `<div class="cal-head-cell${i === 0 || i === 6 ? ' cal-head-red' : ''}">${d}</div>`).join('')}
      </div>
      <div class="cal-body">`;

  for (let i = 0; i < first; i++) {
    html += cellHTML(dStr(y, m - 1, prevLast - first + i + 1), prevLast - first + i + 1, true, evs, td, th);
  }
  for (let d = 1; d <= last; d++) {
    html += cellHTML(dStr(y, m, d), d, false, evs, td, th);
  }
  const rem = (7 - (first + last) % 7) % 7;
  for (let d = 1; d <= rem; d++) {
    html += cellHTML(dStr(y, m + 1, d), d, true, evs, td, th);
  }
  html += '</div></div>';
  document.getElementById('calView').innerHTML = html;
  if (S.selDate) showDayPanel(S.selDate);
}

/**
 * Sprint 11: 캘린더 타입 필터 — 이유식/예방접종/정부지원
 * S.calFilter의 값이 모두 false면 전체 표시, 하나라도 true면 선택된 타입만 표시.
 */
function applyCalFilter(dayEvs) {
  const f = S.calFilter;
  if (!f || (!f.food && !f.vax && !f.gov)) return dayEvs;
  return dayEvs.filter(e =>
    (f.vax  && e.type === 'vax') ||
    (f.gov  && e.type === 'gov') ||
    (f.food && e.cat  === 'food')
  );
}

/** 필터 버튼 클릭 */
export function toggleCalFilter(type, btn) {
  if (!S.calFilter) S.calFilter = { food: false, vax: false, gov: false };
  S.calFilter[type] = !S.calFilter[type];
  if (btn) btn.classList.toggle('on', S.calFilter[type]);
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
}

/**
 * Sprint 10: 같은 날짜의 예방접종 이벤트들을 화면 표시용으로 하나의 그룹으로 묶기.
 * 데이터(S.eventMods, 재계산 로직)는 그대로 개별 항목 단위를 유지하고,
 * 오직 "보여주는 방식"만 묶는다 — 그룹 항목을 펼치면 원래 개별 항목이 그대로 나온다.
 */
function groupVaxEvents(dayEvs) {
  const vaxEvs = dayEvs.filter(e => e.type === 'vax');
  if (vaxEvs.length <= 1) return dayEvs;

  const doseSuffixes = vaxEvs.map(e => (e.title.match(/(\d+차)$/) || [])[1]);
  const allSameDose  = doseSuffixes.every(s => s && s === doseSuffixes[0]);
  const groupTitle   = allSameDose
    ? `${doseSuffixes[0]} 접종 (${vaxEvs.length}종)`
    : `예방접종 (${vaxEvs.length}건)`;
  const allDone = vaxEvs.every(e => e.done);

  const groupEv = {
    date: vaxEvs[0].date, type: 'vax', title: groupTitle, done: allDone,
    _isVaxGroup: true, _groupItems: vaxEvs,
  };

  let inserted = false;
  const result = [];
  dayEvs.forEach(e => {
    if (e.type === 'vax') {
      if (!inserted) { result.push(groupEv); inserted = true; }
    } else {
      result.push(e);
    }
  });
  return result;
}

/**
 * 캘린더 셀 HTML
 * - 드래그 타겟 (data-date, ondragover, ondrop)
 * - 이벤트 필: 드래그 가능, 클릭 → 수정 Modal, ✅ 완료 표시
 */
function cellHTML(ds, d, other, evs, td, th) {
  const de           = groupVaxEvents(applyCalFilter(evs.filter(e => e.date === ds)));
  const stickersAll  = S.dayStickers[ds] || [];

  // v0.0.12: 토요일·일요일·한국 공휴일은 날짜 숫자를 붉은색 계열로 표시
  const dow        = new Date(ds).getDay();
  const isHoliday  = !!getHoliday(ds);
  const isRedDay   = dow === 0 || dow === 6 || isHoliday;

  // v0.0.11: 이유식 스티커는 따로 빼서 날짜 숫자 옆에 표시 — 나머지 스티커의
  // "3개 넘으면 +N" 묶음 카운트에 포함되지 않도록 완전히 독립적으로 처리
  const foodStickers  = stickersAll.filter(s => isFoodSticker(s));
  const otherStickers = stickersAll.filter(s => !isFoodSticker(s));

  const overflow    = Math.max(0, otherStickers.length - 3);
  const showCount   = overflow > 0 ? 3 : otherStickers.length;
  const isSel       = ds === S.selDate;

  const stickerHtml = otherStickers.length
    ? `<div class="sticker-row">
        ${otherStickers.slice(0, showCount).map(s => `<span class="sticker-on-cal">${s}</span>`).join('')}
        ${overflow > 0 ? `<span class="sticker-overflow">+${overflow}</span>` : ''}
       </div>`
    : '';

  const FOOD_MAX     = 2;
  const foodOverflow = Math.max(0, foodStickers.length - FOOD_MAX);
  const foodShow     = foodOverflow > 0 ? FOOD_MAX : foodStickers.length;
  const foodHtml     = foodStickers.length
    ? `<span class="day-food-stickers">
        ${foodStickers.slice(0, foodShow).map(s => `<span class="food-sticker-on-cal" title="${formatSticker(s)}">${stickerEmoji(s)}</span>`).join('')}
        ${foodOverflow > 0 ? `<span class="food-sticker-overflow">+${foodOverflow}</span>` : ''}
       </span>`
    : '';

  const evsHtml = renderCellEvents(de);

  // 오늘 날짜면 기존처럼 원형 강조가 우선, 아니면 주말/공휴일 여부에 따라 붉은 글자색만 적용
  const dayNumStyle = ds === td
    ? `background:${th.today};color:#fff;border-radius:50%`
    : (isRedDay ? 'color:var(--holiday-red)' : '');

  return `
    <div class="cal-cell${other ? ' other-month' : ''}${ds === td ? ' today' : ''}${isSel ? ' selected' : ''}"
         onclick="selectDate('${ds}')"
         data-date="${ds}"
         ondragover="onDragOver(event)"
         ondragleave="onDragLeave(event)"
         ondrop="onDrop(event,'${ds}')"
         style="${isSel ? `background:${th.cell};border:1.5px solid var(--pk)` : ''}">
      <div class="day-num-row">
        <div class="day-num" style="${dayNumStyle}">${d}</div>
        ${foodHtml}
      </div>
      ${evsHtml}
      ${stickerHtml}
    </div>`;
}

/**
 * 하루치 이벤트 표시 (Sprint 26)
 * - 네이티브 캘린더 앱(삼성 캘린더 등)처럼 배경색 박스 없이 "색상 글자"로만 구분해서
 *   보여주는 방식으로 변경. Sprint 21~23에서 배경 필 + 아이콘/점 조합으로 여러 번
 *   손봤지만, 배경 박스 자체가 안쪽 여백을 잡아먹어 글자가 들어갈 자리가 좁았던 게
 *   근본 원인이었음 — 박스를 없애고 나니 훨씬 많은 글자가 그대로 보임
 * - 최대 3건까지 각각 한 줄씩 색상 텍스트로 보여주고, 그 이상은 "+N"으로 표시
 */
function renderCellEvents(de) {
  if (!de.length) return '';
  const MAX = 3;
  const sorted  = [...de].sort((a, b) => evPriority(a) - evPriority(b));
  const shown   = sorted.slice(0, MAX);
  const overflow = sorted.length - shown.length;
  const lines = shown.map(renderEventLine).join('');
  const moreHtml = overflow > 0 ? `<div class="ev-more">+${overflow}건 더보기</div>` : '';
  return `<div class="ev-lines">${lines}${moreHtml}</div>`;
}

/** 대표로 보여줄 순서를 고르는 우선순위 (숫자가 작을수록 먼저 표시) */
function evPriority(e) {
  if (isGovDeadlineSoon(e)) return 0;
  const order = { vax: 1, req: 2, gov: 3, food: 4, rec: 5, custom: 6 };
  return order[getEvCategory(e)] ?? 9;
}

/**
 * v0.0.15: 주간 뷰 시간대 그리드 — 연속 병합 + 겹침 시 좌우 분할로 전면 개편
 *
 * v0.0.14까지는 시간대를 여러 칸("6시","8시"...)으로 나눠 각 칸마다 이벤트를 따로
 * 그렸는데, 그러다 보니 여러 시간에 걸친 일정이 칸 경계마다 끊어져 보이고(같은 제목이
 * 칸 수만큼 반복 표시) 겹치는 일정은 "+N"으로만 뭉뚱그려졌음.
 * v0.0.15부터는 하루 칸을 절대좌표 컨테이너 하나로 만들고, 그 안에 이벤트를
 * 시작~종료 시각에 맞춰 실제 높이를 가진 블록 하나로 이어서 그린다(제목도 블록당 1번만
 * 표시). 겹치는 시간대의 일정은 겹치는 것들끼리만 트랙을 나눠 좌우로 분할 배치한다
 * (Google Calendar류 캘린더의 흔한 레이아웃 방식 — layoutDayTimedEvents 참고).
 */
const WEEK_HOUR_SLOTS = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const WEEK_ROW_H = 48; // px — 위 슬롯 하나당 세로 높이(라벨 칸 높이와 반드시 일치시켜야 함)
const WEEK_MIN_BLOCK_H = 22; // px — 아주 짧은 일정도 최소 이 높이는 확보(탭하기 쉽게)
// 슬롯 경계를 "분" 단위로 환산한 누적 배열 (예: [0,360,480,600,...,1440])
const WEEK_SLOT_BOUNDS_MIN = [...WEEK_HOUR_SLOTS.map(h => h * 60), 24 * 60];

/** 제목 앞 "HH:MM" 또는 "HH:MM~HH:MM" 프리픽스에서 [시작,종료) 분 단위 구간을 추출.
 *  시간 정보가 없으면 null(=주간 뷰 "종일" 행 대상). 종료 시간이 없으면 1분짜리 구간으로 취급. */
function getEvTimeRangeMinutes(ev) {
  const m = (ev.title || '').match(/^(\d{2}):(\d{2})(?:~(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const end   = m[3] != null ? parseInt(m[3], 10) * 60 + parseInt(m[4], 10) : start + 1;
  return { start, end };
}

/**
 * "분(0~1440)" → 시간 그리드 세로 픽셀 위치로 변환.
 * WEEK_HOUR_SLOTS는 칸마다 실제 길이가 다르지만(0~6시=6시간, 6~8시=2시간 등) 화면에서는
 * 모두 같은 높이(WEEK_ROW_H)로 그려지므로, 슬롯 안에서는 비례(fraction)로 위치를 잡는다.
 */
function weekMinutesToY(min) {
  for (let i = 0; i < WEEK_HOUR_SLOTS.length; i++) {
    const segStart = WEEK_SLOT_BOUNDS_MIN[i];
    const segEnd   = WEEK_SLOT_BOUNDS_MIN[i + 1];
    if (min <= segEnd) {
      const frac = segEnd > segStart ? (min - segStart) / (segEnd - segStart) : 0;
      return (i + frac) * WEEK_ROW_H;
    }
  }
  return WEEK_HOUR_SLOTS.length * WEEK_ROW_H;
}

/**
 * 하루치 시간 일정을 겹치는 것끼리만 묶어(cluster) 트랙(가로 분할 자리)을 배정한다.
 * 겹치지 않는 일정은 트랙 계산에서 서로 영향을 주지 않으므로(전체 폭을 그대로 씀),
 * 하루에 겹치는 일정이 하나만 있어도 나머지 일정 전부가 좁아지는 일은 없다.
 * 각 항목에 _track(내 트랙 번호)과 _trackCount(그 그룹의 전체 트랙 수)를 추가해서 반환.
 */
function layoutDayTimedEvents(items) {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const clusters = [];
  let current = [];
  let clusterEnd = -Infinity;
  sorted.forEach(it => {
    if (current.length && it.top >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(it);
    clusterEnd = Math.max(clusterEnd, it.bottom);
  });
  if (current.length) clusters.push(current);

  const out = [];
  clusters.forEach(cluster => {
    const trackEnds = []; // 각 트랙의 마지막 종료 위치(px)
    cluster.forEach(it => {
      let track = trackEnds.findIndex(end => end <= it.top);
      if (track === -1) { track = trackEnds.length; trackEnds.push(it.bottom); }
      else { trackEnds[track] = it.bottom; }
      it._track = track;
    });
    const trackCount = trackEnds.length;
    cluster.forEach(it => { it._trackCount = trackCount; out.push(it); });
  });
  return out;
}

/** 시간대 그리드 안 이벤트 블록 1건 HTML (제목은 블록당 한 번만 표시) */
function renderWeekTimedBlock(e, top, height, track, trackCount) {
  const urgent = isGovDeadlineSoon(e);
  const color  = urgent ? '#C62828' : getEvDisplayColor(e);
  const bg     = color + '2B';
  const label  = stripLeadingEmoji(e.title);
  const safe   = esc(label);
  const doneCss = e.done ? 'text-decoration:line-through;opacity:.55;' : '';
  const leftPct  = (track / trackCount) * 100;
  const widthPct = 100 / trackCount;
  const style = `position:absolute;top:${top}px;height:${height}px;
                 left:calc(${leftPct}% + 1px);width:calc(${widthPct}% - 2px);
                 background:${bg};color:${color};${doneCss}
                 display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
                 overflow:hidden;white-space:normal;line-height:1.25;padding:2px 4px;z-index:1`;

  if (e._isVaxGroup) {
    const groupIndices = `[${e._groupItems.map(item => item._idx).join(',')}]`;
    return `
      <div class="ev-line week-ev-block"
           style="${style}"
           draggable="true"
           ondragstart="event.stopPropagation();onDragStart(event,${groupIndices})"
           ondragend="onDragEnd(event)"
           ontouchstart="onTouchStart(event,${groupIndices})"
           ontouchmove="onTouchMove(event)"
           ontouchend="onTouchEnd(event)"
           ontouchcancel="onTouchCancel(event)"
           title="${safe} — 탭하면 자세히, 꾹 눌러 이동">${label}</div>`;
  }

  return `
    <div class="ev-line week-ev-block"
         style="${style}"
         draggable="true"
         ondragstart="event.stopPropagation();onDragStart(event,${e._idx})"
         ondragend="onDragEnd(event)"
         ontouchstart="onTouchStart(event,${e._idx})"
         ontouchmove="onTouchMove(event)"
         ontouchend="onTouchEnd(event)"
         ontouchcancel="onTouchCancel(event)"
         onclick="event.stopPropagation();openEvModal(${e._idx})"
         title="${safe}${urgent ? ' — ⏰ 마감 임박' : ''}">${label}</div>`;
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 이벤트 1건 — 배경 없이 카테고리 색상 그대로 텍스트에 입힘 (네이티브 캘린더 스타일) */
function renderEventLine(e) {
  const urgent = isGovDeadlineSoon(e);
  const color  = urgent ? '#C62828' : getEvDisplayColor(e);
  const bg     = color + '2B'; // 형광펜 느낌의 옅은 배경 (~17% 불투명도) — 뱃지와 같은 "연한 배경 + 진한 글자" 톤
  const label  = stripLeadingEmoji(e.title);
  const safe   = esc(label);
  const doneCss = e.done ? 'text-decoration:line-through;opacity:.55;' : '';
  const style  = `background:${bg};color:${color};${doneCss}`;

  if (e._isVaxGroup) {
    const groupIndices = `[${e._groupItems.map(item => item._idx).join(',')}]`;
    return `
      <div class="ev-line"
           style="${style}"
           draggable="true"
           ondragstart="onDragStart(event,${groupIndices})"
           ondragend="onDragEnd(event)"
           ontouchstart="onTouchStart(event,${groupIndices})"
           ontouchmove="onTouchMove(event)"
           ontouchend="onTouchEnd(event)"
           ontouchcancel="onTouchCancel(event)"
           title="${safe} — 탭하면 자세히, 꾹 눌러 이동">${label}</div>`;
  }

  return `
    <div class="ev-line"
         style="${style}"
         draggable="true"
         ondragstart="onDragStart(event,${e._idx})"
         ondragend="onDragEnd(event)"
         ontouchstart="onTouchStart(event,${e._idx})"
         ontouchmove="onTouchMove(event)"
         ontouchend="onTouchEnd(event)"
         ontouchcancel="onTouchCancel(event)"
         onclick="event.stopPropagation();openEvModal(${e._idx})"
         title="${safe}${urgent ? ' — ⏰ 마감 임박' : ''}">${label}</div>`;
}

/* ── 주간 뷰 ── */
function renderWeekView() {
  const th   = themes[S.theme];
  const evs  = getAllEvs();
  // v0.0.11: 이전엔 항상 "그 달 1일"을 기준으로 주를 계산해서, calMove()로 아무리 이동해도
  // (월 단위로만 바뀌다 보니) 사실상 그 달의 첫 주만 계속 보였음.
  // 이제 주간 뷰 전용 기준일(S.calWeekRef, calMove()가 7일 단위로 이동시킴)을 사용한다.
  if (!S.calWeekRef) S.calWeekRef = S.selDate || today();
  const curr = new Date(S.calWeekRef);
  const weekStart = new Date(curr);
  weekStart.setDate(curr.getDate() - curr.getDay());
  const days     = ['일', '월', '화', '수', '목', '금', '토'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const td = today();

  // v0.0.15: 헤더의 이유식 스티커는 날짜 숫자 밑에, 일반 스티커는 아래 "종일" 행에 —
  // 이전엔 "종일" 행 하나에 이유식+일반 스티커가 섞여 있어서 이유식 스티커가 잘 안 보였음.
  let html = `
    <div class="cal-wrap">
      <div class="cal-head-row" style="background:${th.g};grid-template-columns:44px repeat(7,1fr)">
        <div class="cal-head-cell" style="font-size:.6rem">시간</div>
        ${weekDays.map((d, i) => {
          const wds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const isRed = i === 0 || i === 6 || !!getHoliday(wds);
          const foodStickers  = (S.dayStickers[wds] || []).filter(s => isFoodSticker(s));
          const FOOD_MAX      = 2;
          const foodOverflow  = Math.max(0, foodStickers.length - FOOD_MAX);
          const foodHtml = foodStickers.length
            ? `<div class="week-head-food-stickers" title="이유식 스티커">
                 <span class="week-head-food-label">이유식</span>
                 ${foodStickers.slice(0, FOOD_MAX).map(s => `<span class="food-sticker-on-cal" title="${formatSticker(s)}">${stickerEmoji(s)}</span>`).join('')}
                 ${foodOverflow > 0 ? `<span class="food-sticker-overflow">+${foodOverflow}</span>` : ''}
               </div>`
            : '';
          return `<div class="cal-head-cell${isRed ? ' cal-head-red' : ''}">${days[i]}<br><span style="font-size:.84rem;font-weight:900">${d.getDate()}</span>${foodHtml}</div>`;
        }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:44px repeat(7,1fr);
                   grid-template-rows:auto repeat(${WEEK_HOUR_SLOTS.length},${WEEK_ROW_H}px)">`;

  // ── "종일" 행 (1행) — 시간 없는 일정 + 일반 스티커 (이유식 스티커는 위 헤더로 이동) ──
  html += `<div class="week-grid-line" style="grid-column:1;grid-row:1;font-size:.62rem;color:var(--txl);font-weight:700;padding:10px 4px;text-align:right;border-bottom:1px solid #F5EEF8">종일</div>`;
  weekDays.forEach((d, di) => {
    const ds  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const de  = groupVaxEvents(applyCalFilter(evs.filter(e => e.date === ds && !getEvTimeRangeMinutes(e))));
    const isTd = ds === td;

    const otherStickers = (S.dayStickers[ds] || []).filter(s => !isFoodSticker(s));
    const stickerHtml = otherStickers.length
      ? `<div class="sticker-row" style="position:static;margin-top:2px;justify-content:flex-start">
          ${otherStickers.slice(0, 4).map(s => `<span class="sticker-on-cal">${s}</span>`).join('')}
          ${otherStickers.length > 4 ? `<span class="sticker-overflow">+${otherStickers.length - 4}</span>` : ''}
         </div>`
      : '';

    html += `
      <div onclick="selectDate('${ds}')"
           data-date="${ds}"
           class="week-grid-line${isTd ? ' week-today-cell' : ''}"
           style="grid-column:${di + 2};grid-row:1;min-height:56px;
                  border-left:1px solid #F5EEF8;border-bottom:1px solid #F5EEF8;
                  padding:4px;cursor:pointer;background:${isTd ? th.cell : 'var(--wh)'};transition:background .14s"
           ondragover="onDragOver(event)"
           ondragleave="onDragLeave(event)"
           ondrop="onDrop(event,'${ds}')"
           onmouseover="this.style.background='var(--pkl)'"
           onmouseout="this.style.background='${isTd ? th.cell : 'var(--wh)'}'">
        ${renderCellEvents(de)}
        ${stickerHtml}
      </div>`;
  });

  // ── 시간 라벨 칸 (왼쪽 첫 열, 슬롯당 1칸) ──
  WEEK_HOUR_SLOTS.forEach((h, hi) => {
    html += `<div class="week-grid-line" style="grid-column:1;grid-row:${hi + 2};height:${WEEK_ROW_H}px;box-sizing:border-box;font-size:.62rem;color:var(--txl);font-weight:700;padding:6px 4px 0 0;text-align:right;border-bottom:1px solid #F5EEF8">${h}시</div>`;
  });

  // ── 요일별 시간대 트랙 (하루 전체를 세로로 이어진 절대좌표 컨테이너 하나로) ──
  // v0.0.15: 시작~종료 구간이 있는 일정을 실제 길이를 가진 블록 하나로 이어 그리고,
  // 겹치는 일정끼리만 좌우로 트랙을 나눠 색을 분리한다(layoutDayTimedEvents 참고).
  const trackHeight = WEEK_HOUR_SLOTS.length * WEEK_ROW_H;
  weekDays.forEach((d, di) => {
    const ds  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isTd = ds === td;

    const timedEvs = groupVaxEvents(applyCalFilter(evs.filter(e => e.date === ds && !!getEvTimeRangeMinutes(e))));
    const items = timedEvs.map(e => {
      const tr  = getEvTimeRangeMinutes(e);
      const top = weekMinutesToY(tr.start);
      const bottom = Math.max(weekMinutesToY(tr.end), top + WEEK_MIN_BLOCK_H);
      return { ev: e, top, bottom };
    });
    const laidOut = layoutDayTimedEvents(items);
    const blocksHtml = laidOut
      .map(it => renderWeekTimedBlock(it.ev, it.top, it.bottom - it.top, it._track, it._trackCount))
      .join('');
    const hourLinesHtml = WEEK_HOUR_SLOTS
      .map((_, hi) => `<div class="week-hour-line" style="position:absolute;top:${hi * WEEK_ROW_H}px;left:0;right:0"></div>`)
      .join('');

    html += `
      <div onclick="selectDate('${ds}')"
           data-date="${ds}"
           class="week-grid-line${isTd ? ' week-today-cell' : ''}"
           ondragover="onDragOver(event)"
           ondragleave="onDragLeave(event)"
           ondrop="onDrop(event,'${ds}')"
           style="grid-column:${di + 2};grid-row:2 / span ${WEEK_HOUR_SLOTS.length};
                  position:relative;height:${trackHeight}px;box-sizing:border-box;
                  border-left:1px solid #F5EEF8;cursor:pointer;
                  background:${isTd ? th.cell : 'var(--wh)'};transition:background .14s"
           onmouseover="this.style.background='var(--pkl)'"
           onmouseout="this.style.background='${isTd ? th.cell : 'var(--wh)'}'">
        ${hourLinesHtml}
        ${blocksHtml}
      </div>`;
  });

  html += '</div></div>';
  document.getElementById('calView').innerHTML = html;
}

/* ══════════════════════════════════════
 *  날짜 패널 (선택된 날 이벤트 목록)
 * ══════════════════════════════════════ */
export function showDayPanel(ds) {
  const allEvs   = getAllEvs();
  const evs      = groupVaxEvents(applyCalFilter(allEvs.filter(e => e.date === ds)));
  const stickers = S.dayStickers[ds] || [];
  const panel    = document.getElementById('dayPanel');
  const dow      = ['일', '월', '화', '수', '목', '금', '토'][new Date(ds).getDay()];
  const holiday  = getHoliday(ds); // v0.0.24: 공휴일이면 세부일정 상단에 이름 표시

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="day-panel">
      <div class="dp-date" style="color:var(--pkd)">
        <span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> ${ds} <span style="font-size:.74rem;color:var(--txl);font-weight:500">${dow}요일</span>
      </div>

      ${holiday
        ? `<div class="dp-holiday" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;
                   padding:8px 12px;border-radius:12px;background:var(--pkl);
                   border:1.5px solid var(--holiday-red);color:var(--holiday-red);
                   font-size:.82rem;font-weight:800">
             <span class="icon icon-sm" translate="no" aria-hidden="true">celebration</span> ${holiday}
           </div>`
        : ''}

      ${stickers.length
        ? `<div style="margin-bottom:14px">
             <div style="font-size:.71rem;font-weight:800;color:var(--txl);margin-bottom:8px"><span class="icon icon-sm" translate="no" aria-hidden="true">sell</span> 붙인 스티커 (클릭하면 삭제)</div>
             <div style="display:flex;gap:6px;flex-wrap:wrap">
               ${stickers.map((s, i) =>
                 `<div onclick="removeSticker('${ds}',${i})"
                       style="font-size:1.45rem;cursor:pointer;padding:5px 7px;border-radius:10px;
                              background:var(--pkl);border:1.5px solid var(--pk);display:flex;align-items:center;gap:2px">
                       ${stickerEmoji(s)}${isFoodSticker(s) && s.includes('|')
                         ? `<span style="font-size:.62rem;font-weight:800;color:var(--pkd)">${s.split('|')[1]}g</span>` : ''}
                       </div>`
               ).join('')}
             </div>
           </div>`
        : ''}

      ${evs.length
        ? evs.map(e => {
            const bc  = getEvDisplayColor(e);
            const bg  = bc + '1A'; // 배경은 포인트 색의 옅은 톤(약 10% 불투명도)

            // Sprint 10: 예방접종 그룹 카드 — 회차별 개별 항목을 리스트로 펼쳐 보여줌
            if (e._isVaxGroup) {
              return `
                <div class="dp-ev" style="background:${bg};flex-direction:column;align-items:stretch">
                  <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
                    <div class="dp-ev-main">
                      <div class="dp-ev-title">
                        ${stripLeadingEmoji(e.title)}
                        ${e.done ? '<span style="color:var(--mn);margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span> 모두 완료</span>' : ''}
                      </div>
                    </div>
                    <span class="dp-ev-badge" style="background:${bc}">필수</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    ${e._groupItems.map(item => `
                      <div class="dp-vax-item-row" style="display:flex;justify-content:space-between;align-items:center;
                                  border-radius:9px;padding:6px 10px">
                        <span style="font-size:.78rem;font-weight:700;color:var(--tx)">
                          ${item.done ? '<span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span>' : '<span class="icon icon-sm" translate="no" aria-hidden="true">radio_button_unchecked</span>'} ${stripLeadingEmoji(item.title)}
                          ${item.recalculated ? '<span style="color:#7B1FA2;font-size:.65rem;margin-left:4px"><span class="icon icon-sm" translate="no" aria-hidden="true">sync</span>조정됨</span>' : ''}
                        </span>
                        <button onclick="openEvModal(${item._idx})"
                                style="background:none;border:1px solid #EEE0F0;border-radius:8px;
                                       padding:2px 8px;font-size:.62rem;font-weight:800;
                                       color:var(--txl);cursor:pointer;font-family:inherit"><span class="icon icon-sm" translate="no" aria-hidden="true">edit</span> 수정</button>
                      </div>`).join('')}
                  </div>
                </div>`;
            }

            // v0.0.29: 체크리스트 정부지원 탭(js/govSupport.js)과 동일한 문구로 통일(이모지 제거)
            const govLbl = e.govStatus === 'paid' ? '지급 완료' : e.govStatus === 'applied' ? '신청 완료' : '신청 전';
            // v0.0.29 버그 수정: 접종도 필수 항목인데 배지가 "접종"으로만 나와 필수 여부가 안 보이던 문제 → 필수로 통일
            const lbl = e.type === 'req' ? '★필수'  : e.type === 'rec' ? '추천'    : e.type === 'vax' ? '★필수'    : e.type === 'gov' ? govLbl : '내일정';
            const urgent = isGovDeadlineSoon(e);
            const dLeft = urgent ? daysUntil(e.deadlineDate) : null;
            const urgentText = dLeft === null ? '' : dLeft < 0 ? '(마감 지남)' : dLeft === 0 ? '(오늘 마감)' : `(D-${dLeft})`;
            return `
              <div class="dp-ev${e.done ? ' dp-done' : ''}${urgent ? ' dp-ev-urgent' : ''}" style="background:${bg}">
                <div class="dp-ev-main">
                  <div class="dp-ev-title">
                    ${stripLeadingEmoji(e.title)}
                    ${e.done ? '<span style="color:var(--mn);margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span></span>' : ''}
                    ${e.type === 'gov' && e.imp === 'req' ? '<span class="badge-r" style="margin-left:5px">필수</span>' : ''}
                    ${e.type === 'gov' && e.imp === 'rec' ? '<span class="badge-o" style="margin-left:5px">해당자</span>' : ''}
                    ${urgent ? `<span class="badge-r" style="margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">schedule</span> 마감임박</span>` : ''}
                  </div>
                  ${e.hospital ? `<div class="dp-ev-note"><span class="icon icon-sm" translate="no" aria-hidden="true">local_hospital</span> ${e.hospital}</div>` : ''}
                  ${e.note     ? `<div class="dp-ev-note"><span class="icon icon-sm" translate="no" aria-hidden="true">edit_note</span> ${e.note}</div>`     : ''}
                  ${e.recDate && e.recDate !== e.date
                    ? `<div class="dp-ev-note" style="color:var(--pu)"><span class="icon icon-sm" translate="no" aria-hidden="true">event_available</span> 권장일: ${e.recDate}</div>` : ''}
                  ${e.recalculated
                    ? `<div class="dp-ev-note" style="color:#7B1FA2;font-weight:800"><span class="icon icon-sm" translate="no" aria-hidden="true">sync</span> 실접종일 기준 자동 조정됨</div>` : ''}
                  ${e.type === 'gov' && e.desc
                    ? `<div class="dp-ev-note" style="margin-top:4px">${e.desc}</div>` : ''}
                  ${e.type === 'gov' && (e.deadlineDate || e.deadlineNote)
                    ? `<div class="dp-ev-note" style="color:#C62828;font-weight:${urgent ? 800 : 400}">⏰ 마감: ${e.deadlineDate || e.deadlineNote} ${urgentText}</div>` : ''}
                  ${e.type === 'gov' && e.link
                    ? `<a href="${e.link}" target="_blank" rel="noopener" style="font-size:.72rem;color:var(--bl);font-weight:800;text-decoration:underline"><span class="icon icon-sm" translate="no" aria-hidden="true">open_in_new</span> 관련 기관 바로가기</a>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
                  <span class="dp-ev-badge" style="background:${bc}">${lbl}</span>
                  <button onclick="openEvModal(${e._idx})"
                          style="background:none;border:1px solid #EEE0F0;border-radius:8px;
                                 padding:3px 8px;font-size:.65rem;font-weight:800;
                                 color:var(--txl);cursor:pointer;font-family:inherit"><span class="icon icon-sm" translate="no" aria-hidden="true">edit</span> 수정</button>
                </div>
              </div>`;
          }).join('')
        : '<p style="color:var(--txl);font-size:.82rem;text-align:center;padding:14px">이 날은 일정이 없어요<br><span style="font-size:.74rem">아래에서 일정이나 스티커를 추가해보세요!</span></p>'}
    </div>`;
}

/* ══════════════════════════════════════
 *  커스텀 일정 추가 / 삭제
 * ══════════════════════════════════════ */

/**
 * v0.0.17: "HH:MM"/"HH:MM~HH:MM" 시간 프리픽스를 제목 앞에 붙이거나(build) 다시
 * 분리해내는(parse) 공용 헬퍼. addCustomEv(추가)·saveEventMod(수정)가 함께 씀 —
 * 로직이 한 곳에만 있어야 두 곳이 서로 다르게 동작하는 일이 없음.
 */
function buildEvTitleWithTime(time, endTime, title) {
  let prefix = '';
  if (time && endTime) prefix = `${time}~${endTime} `;
  else if (time) prefix = `${time} `;
  return prefix ? `${prefix}${title}` : title;
}

/** 저장된 제목에서 시간 프리픽스와 순수 제목을 분리 (수정 모달 프리필용) */
function parseEvTitleWithTime(fullTitle) {
  const m = (fullTitle || '').match(/^(\d{2}:\d{2})(?:~(\d{2}:\d{2}))?\s(.*)$/);
  if (!m) return { time: '', endTime: '', title: fullTitle || '' };
  return { time: m[1], endTime: m[2] || '', title: m[3] };
}

export function addCustomEv() {
  const date    = document.getElementById('evDate').value;
  const title   = document.getElementById('evTitle').value.trim();
  const note    = document.getElementById('evNote').value.trim();
  const time    = document.getElementById('evTime').value;
  const endTime = document.getElementById('evEndTime').value;
  if (!date || !title) { alert('날짜와 제목을 입력해주세요'); return; }

  // v0.0.13: 종료 시간이 시작 시간보다 빠르거나 같으면 등록 막고 안내
  if (time && endTime && endTime <= time) {
    alert('종료 시간이 시작 시간보다 늦어야 해요');
    return;
  }

  // v0.0.16: "내 일정"으로 추가할 때는 직접 고른 색을 이 일정에만 저장(color 필드) —
  // 필수/추천/접종으로 추가하면 기존처럼 카테고리 공통 색을 그대로 씀
  const color = S.evType === 'custom' ? (document.getElementById('evColor')?.value || '') : '';

  S.customEvs.push({
    date,
    title: buildEvTitleWithTime(time, endTime, title),
    note,
    type: S.evType,
    ...(color ? { color } : {}),
    auto: false,
    _id:  Date.now(),
  });
  document.getElementById('evTitle').value   = '';
  document.getElementById('evNote').value    = '';
  document.getElementById('evTime').value    = '';
  document.getElementById('evEndTime').value = '';
  renderCal();
  if (S.selDate === date) showDayPanel(date);
  debounceSave();
}

export function delCustomEv(id) {
  S.customEvs = S.customEvs.filter(e => e._id !== id);
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();
}

/* ══════════════════════════════════════
 *  스티커
 * ══════════════════════════════════════ */
export const stickerCats = [
  { key: 'nature', label: `${icon('spa', { size: 'sm' })} 꽃·자연`, items: ['🌸','🌼','🌺','🌻','🍀','🌿','🌈','⭐','🌙','☀️','🌊','🍃','🌷','🪷','🌱','🦋'] },
  { key: 'baby',   label: `${icon('child_care', { size: 'sm' })} 아기`, items: ['👶','🍼','🧸','🎀','🍭','🎠','🐣','🐥','🐰','🐨','🦄','🐸','🐮','🐷','🐻','🐼'] },
  { key: 'heart',  label: `${icon('favorite', { size: 'sm' })} 하트`, items: ['💕','💖','💗','💝','❤️','🧡','💛','💚','💙','💜','🩷','🩵','🤍','💞','💓','💘'] },
  { key: 'celebrate', label: `${icon('celebration', { size: 'sm' })} 기념`, items: ['🎉','🎊','🎂','🎁','🏆','🥇','✨','🎈','🎀','🌟','🪄','🎗','🥳','🎺','🎵','🎶'] },
  { key: 'food',   label: `${icon('restaurant', { size: 'sm' })} 이유식`, items: ['🍚','🌾','🥩','🐔','🐟','🥕','🥦','🍠','🥔','🌽','🫛','🧀','🥚','🍳','🫐','🍎','🍌','🍓','🍇','🥑','🥛','🧆','🍲','🥣','🍜','🥗','🫘','🧅','🧄','🫚'] },
  { key: 'health', label: `${icon('health_and_safety', { size: 'sm' })} 건강`, items: ['💊','💉','🩺','🏥','🩹','💪','🩻','🔬','🧬','🌡️','🩸','⚕️','🏋️','🧘','🚑','🫀'] },
];

/**
 * v0.0.11: 이유식 스티커 판별용 Set
 * 캘린더 셀에서 이유식 스티커만 날짜 숫자 옆으로 따로 빼서 보여주기 위함
 * (다른 스티커들의 "3개 넘으면 +N" 묶음 카운트와는 완전히 독립적으로 표시)
 * v0.0.21: label 텍스트로 찾던 걸 안정적인 key로 변경 — label에 아이콘 마크업이 들어가면서
 * 텍스트 일치로 찾는 게 더 취약해짐(마크업이 바뀌면 조용히 깨질 수 있음)
 */
const FOOD_STICKER_SET = new Set(stickerCats.find(c => c.key === 'food').items);

/**
 * v0.0.31: 이유식 스티커에 먹은 양(g)을 함께 기록할 수 있게 됨 — 저장 형식은
 * "이모지|g수"(g수를 입력한 경우) 또는 그냥 "이모지"(입력 안 한 경우, 기존 데이터와 동일).
 * 아래 두 헬퍼로 이 형식을 다루는 곳을 한 곳에 모아둠(다른 곳에서 직접 split하지 말 것).
 */
function stickerEmoji(s) { return s.split('|')[0]; }
function isFoodSticker(s) { return FOOD_STICKER_SET.has(stickerEmoji(s)); }
/** 캘린더/데이 패널에 표시할 텍스트 — g수가 있으면 "🍚(50g)", 없으면 "🍚" 그대로 */
function formatSticker(s) {
  const [emoji, grams] = s.split('|');
  return grams ? `${emoji}(${grams}g)` : emoji;
}

export function renderStickerPicker() {
  document.getElementById('spTabs').innerHTML = stickerCats.map((c, i) =>
    `<button class="sp-tab ${i === S.selSCat ? 'on' : ''}" onclick="selSCat(${i})">${c.label}</button>`
  ).join('');
  document.getElementById('spGrid').innerHTML = stickerCats[S.selSCat].items.map(s =>
    `<div class="sp-sticker" onclick="placeSticker('${s}')">${s}</div>`
  ).join('');
}

export function selSCat(i) { S.selSCat = i; renderStickerPicker(); }

export function placeSticker(s) {
  if (!S.selDate) { alert('먼저 날짜를 클릭해서 선택해주세요!'); return; }
  if (!S.dayStickers[S.selDate]) S.dayStickers[S.selDate] = [];

  // v0.0.31: 이유식 스티커는 먹은 양(g)을 함께 기록할 수 있음(선택 사항 — 취소하거나
  // 빈 값으로 두면 예전처럼 이모지만 붙음)
  if (FOOD_STICKER_SET.has(s)) {
    const input = prompt(`${s} 먹은 양을 g으로 입력해주세요 (선택 사항, 비워두면 기록 없이 붙어요)`, '');
    if (input !== null) {
      const g = parseInt(input.trim(), 10);
      if (!isNaN(g) && g > 0) {
        S.dayStickers[S.selDate].push(`${s}|${g}`);
        renderCal(); showDayPanel(S.selDate); debounceSave();
        return;
      }
    }
  }

  S.dayStickers[S.selDate].push(s);
  renderCal(); showDayPanel(S.selDate); debounceSave();
}

export function removeSticker(date, idx) {
  S.dayStickers[date].splice(idx, 1);
  renderCal(); showDayPanel(date); debounceSave();
}

/* ══════════════════════════════════════
 *  자동 이벤트 생성
 * ══════════════════════════════════════ */
export function getAutoEvs(child) {
  if (!child) return [];
  const evs = [];

  if (child.stage === 'preg') {
    const due = new Date(child.due || new Date());
    pregEvMap.forEach(({ w, items }) => {
      const d = new Date(due);
      d.setDate(d.getDate() - (40 - w) * 7);
      const ds = d.toISOString().split('T')[0];
      items.forEach(it => evs.push({
        date: ds, _origDate: ds, title: it.t, type: it.r ? 'req' : 'rec', auto: true,
      }));
    });

    // 정부지원 (임신 중) — Sprint 6
    govSupportSchedule.preg.forEach(it => {
      const d = new Date(due);
      d.setDate(d.getDate() - (40 - it.week) * 7);
      const ds = d.toISOString().split('T')[0];
      evs.push({
        date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true,
        imp: it.importance, desc: it.desc, link: it.link, deadlineNote: it.deadlineNote || null,
      });
    });
  } else {
    const birth = new Date(child.birth);

    // 예방접종 — Sprint 6: 회차별 자동 재계산을 위해 방문(월) 단위 병합 대신
    // 백신 1종당 1개 이벤트로 생성 (같은 날짜에 여러 개 표시될 수 있음, 캘린더 셀은 +N 배지로 처리됨)
    vaxSched.forEach(v => {
      const d = new Date(birth);
      d.setDate(d.getDate() + v.m * 30.44);
      const ds = d.toISOString().split('T')[0];
      v.items.forEach(it => evs.push({
        date: ds, _origDate: ds, title: it, type: 'vax', auto: true,
      }));
    });

    // 건강검진 & 마일스톤
    checkEvs.forEach(({ m, items }) => {
      const d = new Date(birth);
      d.setDate(d.getDate() + m * 30.44);
      const ds = d.toISOString().split('T')[0];
      items.forEach(it => evs.push({
        date: ds, _origDate: ds, title: it.t, type: it.r ? 'req' : 'rec', auto: true,
      }));
    });

    // v0.0.31: 자동 이유식 일정 생성을 없앰 — 아이마다 실제 이유식 진행 속도가 너무 달라서
    // "정해진 날짜에 뭘 먹어야 한다"는 자동 일정이 오히려 부담스럽다는 피드백으로, 이유식은
    // 이제 캘린더 스티커(🍚 등, g수 기록 가능)로 사용자가 직접 기록하는 방식으로 바꿈.
    // 예전엔 여기서 data/milestones.js의 foodEvs를 순회하며 이유식 일정을 자동 생성했음
    // (필요하면 git 이력에서 되돌릴 수 있음).

    // 정부지원 (출산 직후) — Sprint 6
    govSupportSchedule.postpartum.forEach(it => {
      const d = new Date(birth);
      d.setDate(d.getDate() + it.day);
      const ds = d.toISOString().split('T')[0];
      let deadlineDate = null;
      if (it.deadlineDay != null) {
        const dd = new Date(birth);
        dd.setDate(dd.getDate() + it.deadlineDay);
        deadlineDate = dd.toISOString().split('T')[0];
      }
      evs.push({
        date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true,
        imp: it.importance, desc: it.desc, link: it.link,
        deadlineNote: it.deadlineNote || null, deadlineDate,
      });
    });

    // 정부지원 (육아) — Sprint 6
    govSupportSchedule.parenting.forEach(it => {
      const d = new Date(birth);
      d.setDate(d.getDate() + it.month * 30.44);
      const ds = d.toISOString().split('T')[0];
      evs.push({
        date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true,
        imp: it.importance, desc: it.desc, link: it.link, deadlineNote: it.deadlineNote || null,
      });
    });
  }
  return evs;
}

/* ══════════════════════════════════════
 *  window 노출 (인라인 onclick 핸들러용)
 * ══════════════════════════════════════ */
window.renderCal           = renderCal;
window.calMove             = calMove;
window.setCalView          = setCalView;
window.setTheme            = setTheme;
window.selectDate          = selectDate;
window.showDayPanel        = showDayPanel;
window.setEvType           = setEvType;
window.addCustomEv         = addCustomEv;
window.delCustomEv         = delCustomEv;
window.renderStickerPicker = renderStickerPicker;
window.selSCat             = selSCat;
window.placeSticker        = placeSticker;
window.removeSticker       = removeSticker;
window.openEvModal         = openEvModal;
window.saveEventMod        = saveEventMod;
window.setGovStatusRadio   = setGovStatusRadio;
window.onDragStart         = onDragStart;
window.onDragEnd           = onDragEnd;
window.onDragOver          = onDragOver;
window.onDragLeave         = onDragLeave;
window.onDrop              = onDrop;
window.onTouchStart        = onTouchStart;
window.onTouchMove         = onTouchMove;
window.onTouchEnd          = onTouchEnd;
window.onTouchCancel       = onTouchCancel;
window.toggleCalFilter     = toggleCalFilter;
