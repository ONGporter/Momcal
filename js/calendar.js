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
import { today, daysUntil, stripLeadingEmoji, icon, avatarDisplay, escapeHtml, sanitizeUrl, attachTimeInputMask } from './utils.js';
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

// v0.3.25: "일정 직접 추가" 폼의 시간 입력(index.html에 정적으로 존재)은 앱 시작 시 1회만
// 붙이면 됨 — module script는 DOM 파싱 후 실행되므로 이 시점에 엘리먼트가 이미 존재함.
attachTimeInputMask('evTime');
attachTimeInputMask('evEndTime');

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
  rec:    '#26A69A', // 선택
  food:   '#E53935', // 이유식
  vax:    '#9575CD', // 접종
  gov:    '#43A047', // 정부지원
  custom: '#64B5F6', // 내 일정
};

export const EV_CATEGORY_LABELS = {
  // v0.0.33: 체크리스트에서는 선택 항목을 "선택"이라고 부르는데(항목 추가 모달의 "필수/선택"
  // 참고) 캘린더 연동 일정만 "추천"이라고 따로 불러서 용어가 안 맞았음 — "선택"으로 통일
  req: '필수', rec: '선택', food: '이유식', vax: '접종', gov: '정부지원', custom: '내 일정',
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
 * 그 외(필수/선택/접종/정부지원 등)는 기존처럼 카테고리 공통 색(범례에서 바꿀 수 있음)을 쓴다.
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

/**
 * v0.0.33: "일정 직접 추가" 폼에서 "내 일정" 스와치를 고르면 나오는 개별 색상 선택지 —
 * 민트/라벤더/로즈는 각각 선택(#26A69A)/접종(#9575CD)/필수(#F06292)와 톤이 비슷해서
 * 헷갈릴 수 있어 제외하고, 뚜렷이 구분되는 색만 남김(하늘/피치/레몬/그레이).
 * 수정 Modal의 색상 스와치(이미 만들어둔 "내 일정"의 색을 다시 바꿀 때)는 원래 7색 전부
 * 그대로 씀 — 거긴 종류 선택과 무관해서 헷갈릴 상황이 아님.
 */
export const CUSTOM_EV_COLOR_PRESETS_FOR_ADD = CUSTOM_EV_COLOR_PRESETS.filter(p =>
  !['민트', '라벤더', '로즈'].includes(p.name)
);

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

/**
 * v0.0.32: "일정 직접 추가" 폼의 "종류" 버튼(내 일정/필수/선택/접종)과 "일정 색상" 스와치를
 * 하나로 합침 — 종류마다 색이 이미 정해져 있는데 색을 또 따로 고르는 게 중복이라는 피드백으로,
 * 범례와 똑같은 색의 스와치를 눌러서 종류+색을 한 번에 고르게 함
 * (getEvColor()를 그대로 써서, 범례에서 색을 바꿔둔 경우에도 항상 최신 색으로 표시됨)
 * v0.0.33: 다만 "내 일정"은 원래 일정마다 다른 색으로 구분해서 쓰던 용도라, "내 일정"을
 * 고르면 아래에 개별 색상 선택지가 추가로 나타남(다른 종류 색과 안 겹치는 팔레트만 제공).
 * v0.1.0: "정부지원"(gov) 추가 — 하단 범례(renderCalLegend)를 없애면서 종류별 색을 확인·선택할
 * 수 있는 자리가 이 스와치뿐이라, 기존에 없던 gov도 여기 포함시킴. 이유식(food)은 이벤트로
 * 직접 추가하는 종류가 아니라(스티커로만 기록) 그대로 제외.
 */
const ADDABLE_EV_TYPES = ['custom', 'req', 'rec', 'vax', 'gov'];

/**
 * v0.4.0: 캘린더 날짜를 한 번 더 누르면 뜨는 "일정 추가" 팝업(openQuickAddModal)이 이 스와치를
 * 그대로 재사용할 수 있도록 id에 suffix를 붙일 수 있게 함(suffix='' → 기존 하단 폼과 완전히
 * 동일, suffix='Qa' → 팝업 전용 id). 팝업과 하단 폼이 같은 페이지에 동시에 존재해도(모달은
 * #mB 안에 별도로 그려짐) id가 겹치지 않아 서로 값을 덮어쓰지 않음.
 */
function evTypeSwatchesHtml(selectedType, selectedCustomColor, suffix = '') {
  const sel = selectedType || 'custom';
  const customColor = (selectedCustomColor || CUSTOM_EV_COLOR_PRESETS_FOR_ADD[0].color).toLowerCase();
  const typeId   = 'evType' + suffix;
  const colorId  = 'evColor' + suffix;
  const pickerId = 'evCustomColorPicker' + suffix;
  return `
    <input type="hidden" id="${typeId}" value="${sel}">
    <div class="ev-type-swatches">
      ${ADDABLE_EV_TYPES.map(cat => `
        <button type="button" class="ev-type-swatch${cat === sel ? ' on' : ''}"
                onclick="selectEvTypeSwatch('${cat}', this, '${suffix}')">
          <span class="ev-type-dot" style="background:${getEvColor(cat)}"></span>
          <span class="ev-type-label">${EV_CATEGORY_LABELS[cat]}</span>
        </button>
      `).join('')}
    </div>
    <div id="${pickerId}" style="display:${sel === 'custom' ? 'flex' : 'none'};gap:8px;flex-wrap:wrap;margin-top:8px">
      <input type="hidden" id="${colorId}" value="${customColor}">
      ${CUSTOM_EV_COLOR_PRESETS_FOR_ADD.map(p => `
        <button type="button"
                class="ev-color-swatch${p.color.toLowerCase() === customColor ? ' on' : ''}"
                style="background:${p.color}" title="${p.name}"
                onclick="selectEvColorSwatch('${colorId}', '${p.color}', this)"></button>
      `).join('')}
    </div>`;
}

/** 종류+색상 스와치 클릭 핸들러 — "내 일정"을 고르면 개별 색상 선택지를 함께 보여줌 */
export function selectEvTypeSwatch(cat, btn, suffix = '') {
  const input = document.getElementById('evType' + suffix);
  if (input) input.value = cat;
  btn.parentElement.querySelectorAll('.ev-type-swatch').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const picker = document.getElementById('evCustomColorPicker' + suffix);
  if (picker) picker.style.display = cat === 'custom' ? 'flex' : 'none';
}
window.selectEvTypeSwatch = selectEvTypeSwatch;

/** 일정 추가 폼의 종류+색상 스와치 렌더 — renderCal()에서 캘린더 탭을 열 때마다 호출됨.
 *  이미 골라둔 종류·개별 색이 있으면 그대로 유지(일정을 여러 개 연달아 추가할 때 매번 다시
 *  고르지 않아도 되도록) — 없으면 첫 번째("내 일정")를 기본값으로 보여줌 */
export function renderAddEvColorSwatches() {
  const wrap = document.getElementById('evColorSwatchWrap');
  if (!wrap) return;
  const prevType  = document.getElementById('evType')?.value;
  const prevColor = document.getElementById('evColor')?.value;
  wrap.innerHTML = evTypeSwatchesHtml(prevType || 'custom', prevColor);
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
 * v0.1.0: index.html에서 #calLegend 요소 자체를 제거함(옹짐꾼님 요청 — "일정 색상" 스와치와
 * 내용이 중복돼 보인다는 피드백). 이 함수는 el이 없으면 그냥 조용히 리턴하므로 에러 없이
 * 남겨둠 — 요소를 되살리면 그대로 다시 작동함. 단, 이 함수가 그동안 "필수/선택/이유식/접종/
 * 정부지원" 공통 색을 사용자가 직접 바꾸는 유일한 진입점이었으므로, 되살릴 계획이 없다면
 * 그 색상 커스터마이징 기능 자체가 없어졌다는 점을 인지할 것(정부지원은 v0.1.0에서 evTypeSwatchesHtml에
 * 추가됐지만, 이유식은 여전히 색을 바꿀 UI가 없음).
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
 *  캘린더 헤더/선택 날짜 색상
 * ══════════════════════════════════════ */
/**
 * v0.4.0: 캘린더 탭의 색상 테마 선택 기능(장미/민트/맑음/라벤더/복숭아 5종, S.theme) 삭제 —
 * "의미가 없는 것 같다"는 옹짐꾼님 피드백으로, 고를 수 있던 5색 중 브랜드 기본색인
 * "장미(rose)"로 고정함. S.theme 필드 자체는 기존 Firebase 스키마 유지 원칙에 따라
 * state.js/demoMode.js/guestMode.js에서 계속 읽고 쓰지만(과거 데이터 호환), 실제 렌더링에는
 * 더 이상 쓰이지 않음 — 아래 `themes.rose` 값만 항상 사용(themes[S.theme] 참조를 모두 제거).
 */
export const themes = {
  rose: { g: 'linear-gradient(135deg,#F48FB1,#CE93D8)', cell: '#FFF5FA', today: '#F06292' },
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

/**
 * v0.4.1: "1박 이상이면 연결되게 표시하고 싶다"는 요청으로 멀티데이(여러 날에 걸친) 일정
 * 지원 추가 — 사용자가 직접 추가한 일정(S.customEvs, ev.auto=false)에만 선택적으로
 * `endDate`(시작일보다 늦은 날짜)를 저장할 수 있음. endDate가 없거나 date와 같으면 기존과
 * 완전히 동일한 하루짜리 일정으로 취급(기존 저장 데이터·자동 생성 일정은 전혀 영향 없음).
 */
function evCoversDate(e, ds) {
  return ds >= e.date && ds <= (e.endDate || e.date);
}
function isMultiDayEv(e) {
  return !!e.endDate && e.endDate > e.date;
}

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
      // v0.4.1: 1박 이상(멀티데이) 일정은 드래그로 옮겨도 여행 기간이 유지되도록
      // endDate도 시작일과 같은 만큼 함께 밀어줌(끝나는 날만 그대로 두면 기간이 늘거나
      // 줄거나 심하면 endDate < date가 되는 문제가 생김)
      const ce = S.customEvs.find(e => e._id === ev._id);
      if (ce) {
        if (ce.endDate && ce.endDate > ce.date) {
          const days = Math.round((new Date(ce.endDate) - new Date(ce.date)) / 86400000);
          const nd = new Date(newDate);
          nd.setDate(nd.getDate() + days);
          ce.endDate = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
        }
        ce.date = newDate;
      }
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
    req: `${icon('star', { size: 'sm' })} 필수`, rec: `${icon('recommend', { size: 'sm' })} 선택`,
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
        ${ev.desc ? `<div>${escapeHtml(ev.desc)}</div>` : ''}
        ${(ev.deadlineDate || ev.deadlineNote) ? `<div style="color:#C62828;font-weight:800;margin-top:6px">⏰ 마감: ${escapeHtml(ev.deadlineDate || ev.deadlineNote)}${urgentText}</div>` : ''}
        ${sanitizeUrl(ev.link) ? `<a href="${escapeHtml(sanitizeUrl(ev.link))}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;color:var(--bl);font-weight:800;text-decoration:underline"><span class="icon icon-sm" translate="no" aria-hidden="true">open_in_new</span> 관련 기관 바로가기</a>` : ''}
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
        <div class="fg" style="margin:0"><label>시작 시간 (선택)</label><input type="text" inputmode="numeric" maxlength="5" placeholder="예: 09:30" id="evModTime" value="${parsedTime}"></div>
        <div class="fg" style="margin:0"><label>종료 시간 (선택)</label><input type="text" inputmode="numeric" maxlength="5" placeholder="예: 10:30" id="evModEndTime" value="${parsedEndTime}"></div>
      </div>`}

    <div class="fg">
      <label><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> ${isGov ? '신청 예정일' : '실제 일정'}</label>
      <input type="date" id="evModDate" value="${actDate}">
    </div>
    ${!ev.auto ? `
      <div class="fg">
        <label><span class="icon icon-sm" translate="no" aria-hidden="true">date_range</span> 종료일 (선택, 1박 이상이면)</label>
        <input type="date" id="evModEndDate" value="${ev.endDate || ''}">
      </div>` : ''}
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
  // v0.3.25: 모달 안 시간 입력은 showModal()이 매번 #mB를 새로 채우면서 새 엘리먼트로
  // 교체되므로, 열 때마다 다시 붙여줘야 함(요소별 _timeMaskAttached 플래그로 중복 방지)
  if (!ev.auto) {
    attachTimeInputMask('evModTime');
    attachTimeInputMask('evModEndTime');
  }
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
    const newTime    = validHHMM(document.getElementById('evModTime')?.value    || '');
    const newEndTime = validHHMM(document.getElementById('evModEndTime')?.value || '');
    const newTitle   = document.getElementById('evModTitle')?.value.trim() || '';
    if (!newTitle) { alert('제목을 입력해주세요'); return; }
    if (newTime && newEndTime && newEndTime <= newTime) {
      alert('종료 시간이 시작 시간보다 늦어야 해요');
      return;
    }
    // v0.4.1: "1박 이상이면 연결되게 표시하고 싶다"는 요청으로 종료일(선택) 필드도 함께 반영 —
    // 시작일(actualDate)보다 빠르면 저장을 막고, 시작일과 같거나 비워두면 하루짜리 일정으로
    // 되돌림(ce.endDate 자체를 지워서 evCoversDate/isMultiDayEv가 예전처럼 동작하게 함)
    const newEndDateRaw = document.getElementById('evModEndDate')?.value || '';
    if (newEndDateRaw && newEndDateRaw < actualDate) {
      alert('종료일이 시작일보다 늦어야 해요');
      return;
    }
    const ce = S.customEvs.find(e => e._id === ev._id);
    if (ce) {
      ce.date  = actualDate;
      ce.title = buildEvTitleWithTime(newTime, newEndTime, newTitle);
      if (newEndDateRaw && newEndDateRaw > actualDate) ce.endDate = newEndDateRaw;
      else delete ce.endDate;
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
          <span><span class="icon icon-sm" translate="no" aria-hidden="true">vaccines</span> ${esc(stripLeadingEmoji(c.title))}</span><span><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> ${c.newDate}</span>
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

/**
 * v0.4.0: "날짜를 한번 더 누르면 일정 추가 팝업이 뜨면 좋겠다"는 피드백 —
 * 이미 선택돼 있는 날짜(day panel이 이미 열려있는 그 날짜)를 다시 누르면 하단 "일정 직접
 * 추가" 폼까지 스크롤할 필요 없이 openQuickAddModal()이 바로 뜸. 처음 누르는 날짜(아직
 * 선택 안 된 상태)는 기존처럼 day panel만 열림 — 이래야 "그냥 그 날 뭐가 있나 보기"와
 * "그 날에 뭘 추가하기"가 각각 1번 클릭·2번 클릭으로 자연스럽게 구분됨.
 */
export function selectDate(ds) {
  if (S.selDate === ds) {
    openQuickAddModal(ds);
    return;
  }
  S.selDate = ds;
  document.getElementById('evDate').value = ds;
  renderCal();
  showDayPanel(ds);
}

/* ══════════════════════════════════════
 *  캘린더 렌더링
 * ══════════════════════════════════════ */

export function renderCal() {
  if (S.children.length) {
    document.getElementById('calChildSel').innerHTML = S.children.map((c, i) =>
      `<button onclick="selectChild(${i});renderCal()"
        style="padding:5px 11px;border-radius:40px;
               border:1.5px solid ${i == S.selC ? 'var(--pk)' : '#EEE0F0'};
               background:${i == S.selC ? 'var(--pkl)' : 'var(--wh)'};
               color:${i == S.selC ? 'var(--pkd)' : 'var(--txl)'};
               font-size:.73rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s">
        ${avatarDisplay(c.avatar, '1.1em')} ${esc(c.name)}
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
  const th    = themes.rose;
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
 * v0.0.32: 필터는 한 번에 하나만 켤 수 있음(중복 선택 시 기존 일정과 이유식 강조가 뒤섞여
 * 보이는 문제로, 서로 배타적인 라디오 버튼처럼 동작하도록 변경 — toggleCalFilter 참고)
 * 이유식 필터는 더 이상 "이벤트"를 거르는 게 아니라(이유식은 스티커로만 기록되므로) 셀
 * 가운데에 스티커를 크게 보여주는 방식으로 동작함(cellHTML 참고) — 그래서 이유식 필터가
 * 켜져 있을 땐 이벤트를 전부 숨김(스티커 강조와 뒤섞이지 않도록)
 */
function applyCalFilter(dayEvs) {
  const f = S.calFilter;
  if (!f || (!f.food && !f.vax && !f.gov)) return dayEvs;
  if (f.food) return [];
  return dayEvs.filter(e =>
    (f.vax && e.type === 'vax') ||
    (f.gov && e.type === 'gov')
  );
}

/** 필터 버튼 클릭 — v0.0.32: 한 번에 하나만 켤 수 있도록 배타적으로 동작(같은 걸 다시 누르면 꺼짐) */
export function toggleCalFilter(type, btn) {
  if (!S.calFilter) S.calFilter = { food: false, vax: false, gov: false };
  const wasOn = !!S.calFilter[type];
  S.calFilter = { food: false, vax: false, gov: false };
  S.calFilter[type] = !wasOn;
  document.querySelectorAll('.cal-filter-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.filter === type && !wasOn)
  );
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
export function cellHTML(ds, d, other, evs, td, th) {
  // v0.0.32: 이유식 필터가 켜져 있으면 칸 가운데에 이유식 스티커(g수 포함)를 크게 보여주고
  // 나머지 일정·스티커는 숨김 — 필터를 눌렀을 때 실제로 뭔가 달라지게 하기 위함
  // (이유식은 더 이상 자동 일정이 아니라 스티커로만 기록되므로, 이벤트 필터와는 다르게 다룸)
  const isFoodFilterOn = !!(S.calFilter && S.calFilter.food);
  const de           = groupVaxEvents(applyCalFilter(evs.filter(e => evCoversDate(e, ds))));
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
        ${otherStickers.slice(0, showCount).map(s => `<span class="sticker-on-cal">${stickerDisplay(s, '.8rem')}</span>`).join('')}
        ${overflow > 0 ? `<span class="sticker-overflow">+${overflow}</span>` : ''}
       </div>`
    : '';

  const FOOD_MAX     = 2;
  const foodOverflow = Math.max(0, foodStickers.length - FOOD_MAX);
  const foodShow     = foodOverflow > 0 ? FOOD_MAX : foodStickers.length;
  const foodHtml     = foodStickers.length
    ? `<span class="day-food-stickers">
        ${foodStickers.slice(0, foodShow).map(s => `<span class="food-sticker-on-cal" title="${formatSticker(s)}">${stickerDisplay(s, '.74rem')}</span>`).join('')}
        ${foodOverflow > 0 ? `<span class="food-sticker-overflow">+${foodOverflow}</span>` : ''}
       </span>`
    : '';

  // 이유식 필터 켜졌을 때: 칸 가운데에 "🍚 50g" 형태로 세로로 크게 나열
  const foodCenterHtml = foodStickers.length
    ? `<div class="day-food-center">
        ${foodStickers.map(s => `<span class="food-center-item">${foodCenterItemHtml(s)}</span>`).join('')}
       </div>`
    : '';

  const evsHtml = renderCellEvents(de, ds);

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
        ${isFoodFilterOn ? '' : foodHtml}
      </div>
      ${isFoodFilterOn
        ? foodCenterHtml
        : `${evsHtml}${stickerHtml}`}
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
function renderCellEvents(de, ds) {
  if (!de.length) return '';
  const MAX = 3;
  const sorted  = [...de].sort((a, b) => evPriority(a) - evPriority(b));
  const shown   = sorted.slice(0, MAX);
  const overflow = sorted.length - shown.length;
  const lines = shown.map(e => renderEventLine(e, ds)).join('');
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
           title="${safe} — 탭하면 자세히, 꾹 눌러 이동">${safe}</div>`;
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
         title="${safe}${urgent ? ' — ⏰ 마감 임박' : ''}">${safe}</div>`;
}

// v0.2.1: js/utils.js의 공용 escapeHtml()로 통일(기존엔 따옴표만 이스케이프하던 로컬 함수였음)
const esc = escapeHtml;

/**
 * v0.4.1: 이벤트 1건 — 배경 없이 카테고리 색상 그대로 텍스트에 입힘 (네이티브 캘린더 스타일)
 * 1박 이상(멀티데이) 일정은 이 칸이 그 일정의 어느 지점인지(시작/중간/끝)에 따라 이어지는
 * 쪽의 모서리를 각지게 만들고 칸 여백(4px)만큼 밀어 붙여서, 여러 날짜 칸에 걸쳐 하나의
 * 색상 바가 이어진 것처럼 보이게 함. 주(week) 경계에서는 다음 줄로 넘어가므로 일요일/토요일
 * 칸에서는 그 줄 안에서만 이어지고 새 줄에서 다시 이어짐(달력이 요일별 칸으로 이루어진
 * 구조상 자연스러운 처리 — 대부분의 캘린더 앱도 주 경계에서는 같은 방식으로 끊어 보여줌)
 */
function renderEventLine(e, ds) {
  const urgent = isGovDeadlineSoon(e);
  const color  = urgent ? '#C62828' : getEvDisplayColor(e);
  const bg     = color + '2B'; // 형광펜 느낌의 옅은 배경 (~17% 불투명도) — 뱃지와 같은 "연한 배경 + 진한 글자" 톤
  const label  = stripLeadingEmoji(e.title);
  const safe   = esc(label);
  const doneCss = e.done ? 'text-decoration:line-through;opacity:.55;' : '';

  const multi = ds != null && isMultiDayEv(e);
  let joinCss = '';
  let joinClass = '';
  if (multi) {
    const dow = new Date(ds).getDay();
    const roundLeft  = ds === e.date  || dow === 0;
    const roundRight = ds === e.endDate || dow === 6;
    joinClass = ' ev-line-multi';
    joinCss =
      `border-top-left-radius:${roundLeft ? '4px' : '0'};border-bottom-left-radius:${roundLeft ? '4px' : '0'};` +
      `border-top-right-radius:${roundRight ? '4px' : '0'};border-bottom-right-radius:${roundRight ? '4px' : '0'};` +
      `${roundLeft ? '' : 'margin-left:-4px;padding-left:6px;'}${roundRight ? '' : 'margin-right:-4px;padding-right:6px;'}`;
  }
  const style = `background:${bg};color:${color};${doneCss}${joinCss}`;

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
           title="${safe} — 탭하면 자세히, 꾹 눌러 이동">${safe}</div>`;
  }

  return `
    <div class="ev-line${joinClass}"
         style="${style}"
         draggable="true"
         ondragstart="onDragStart(event,${e._idx})"
         ondragend="onDragEnd(event)"
         ontouchstart="onTouchStart(event,${e._idx})"
         ontouchmove="onTouchMove(event)"
         ontouchend="onTouchEnd(event)"
         ontouchcancel="onTouchCancel(event)"
         onclick="event.stopPropagation();openEvModal(${e._idx})"
         title="${safe}${urgent ? ' — ⏰ 마감 임박' : ''}">${safe}</div>`;
}

/* ── 주간 뷰 ── */
function renderWeekView() {
  const th   = themes.rose;
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
                 ${foodStickers.slice(0, FOOD_MAX).map(s => `<span class="food-sticker-on-cal" title="${formatSticker(s)}">${stickerDisplay(s, '.74rem')}</span>`).join('')}
                 ${foodOverflow > 0 ? `<span class="food-sticker-overflow">+${foodOverflow}</span>` : ''}
               </div>`
            : '';
          return `<div class="cal-head-cell${isRed ? ' cal-head-red' : ''}">${days[i]}<br><span style="font-size:.84rem;font-weight:900">${d.getDate()}</span>${foodHtml}</div>`;
        }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:44px repeat(7,1fr);
                   grid-template-rows:auto repeat(${WEEK_HOUR_SLOTS.length},${WEEK_ROW_H}px)">`;

  // ── "종일" 행 (1행) — 시간 없는 일정 + 일반 스티커 (이유식 스티커는 위 헤더로 이동) ──
  const isFoodFilterOn = !!(S.calFilter && S.calFilter.food);
  html += `<div class="week-grid-line" style="grid-column:1;grid-row:1;font-size:.62rem;color:var(--txl);font-weight:700;padding:10px 4px;text-align:right;border-bottom:1px solid #F5EEF8">종일</div>`;
  weekDays.forEach((d, di) => {
    const ds  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const de  = groupVaxEvents(applyCalFilter(evs.filter(e => evCoversDate(e, ds) && (!getEvTimeRangeMinutes(e) || isMultiDayEv(e)))));
    const isTd = ds === td;

    const otherStickers = (S.dayStickers[ds] || []).filter(s => !isFoodSticker(s));
    const stickerHtml = otherStickers.length
      ? `<div class="sticker-row" style="position:static;margin-top:2px;justify-content:flex-start">
          ${otherStickers.slice(0, 4).map(s => `<span class="sticker-on-cal">${stickerDisplay(s, '.8rem')}</span>`).join('')}
          ${otherStickers.length > 4 ? `<span class="sticker-overflow">+${otherStickers.length - 4}</span>` : ''}
         </div>`
      : '';

    // v0.0.32: 이유식 필터가 켜져 있으면 "종일" 행에 이유식 스티커(g수 포함)를 강조해서 보여줌
    const wdFoodStickers = (S.dayStickers[ds] || []).filter(s => isFoodSticker(s));
    const foodCenterHtml = wdFoodStickers.length
      ? `<div class="day-food-center">
          ${wdFoodStickers.map(s => `<span class="food-center-item">${foodCenterItemHtml(s)}</span>`).join('')}
         </div>`
      : '';

    html += `
      <div onclick="selectDate('${ds}')"
           data-date="${ds}"
           class="week-grid-line${isTd ? ' week-today-cell' : ''}"
           style="grid-column:${di + 2};grid-row:1;min-height:56px;display:flex;flex-direction:column;
                  border-left:1px solid #F5EEF8;border-bottom:1px solid #F5EEF8;
                  padding:4px;cursor:pointer;background:${isTd ? th.cell : 'var(--wh)'};transition:background .14s"
           ondragover="onDragOver(event)"
           ondragleave="onDragLeave(event)"
           ondrop="onDrop(event,'${ds}')"
           onmouseover="this.style.background='var(--pkl)'"
           onmouseout="this.style.background='${isTd ? th.cell : 'var(--wh)'}'">
        ${isFoodFilterOn ? foodCenterHtml : `${renderCellEvents(de, ds)}${stickerHtml}`}
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

    const timedEvs = groupVaxEvents(applyCalFilter(evs.filter(e => e.date === ds && !!getEvTimeRangeMinutes(e) && !isMultiDayEv(e))));
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
  const evs      = groupVaxEvents(applyCalFilter(allEvs.filter(e => evCoversDate(e, ds))));
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
                       ${stickerDisplay(s, '1.45rem')}${isFoodSticker(s) && s.includes('|')
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
            // v0.0.32: 캘린더에 뜨는 건 어차피 다 필수 성격이라 "필수" 배지가 불필요한 정보라는
            // 피드백으로, 묶음 카드 헤더의 배지를 없애고 단순 제목 한 줄로 정리
            if (e._isVaxGroup) {
              return `
                <div class="dp-ev" style="background:${bg};flex-direction:column;align-items:stretch">
                  <div class="dp-ev-title" style="margin-bottom:8px">
                    ${esc(stripLeadingEmoji(e.title))}
                    ${e.done ? '<span style="color:var(--mn);margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span> 모두 완료</span>' : ''}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    ${e._groupItems.map(item => `
                      <div class="dp-vax-item-row" style="display:flex;justify-content:space-between;align-items:center;
                                  border-radius:9px;padding:6px 10px">
                        <span style="font-size:.78rem;font-weight:700;color:var(--tx)">
                          ${item.done ? '<span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span>' : '<span class="icon icon-sm" translate="no" aria-hidden="true">radio_button_unchecked</span>'} ${esc(stripLeadingEmoji(item.title))}
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

            const urgent = isGovDeadlineSoon(e);
            const dLeft = urgent ? daysUntil(e.deadlineDate) : null;
            const urgentText = dLeft === null ? '' : dLeft < 0 ? '(마감 지남)' : dLeft === 0 ? '(오늘 마감)' : `(D-${dLeft})`;
            return `
              <div class="dp-ev${e.done ? ' dp-done' : ''}${urgent ? ' dp-ev-urgent' : ''}" style="background:${bg}">
                <div class="dp-ev-main">
                  <div class="dp-ev-title">
                    ${esc(stripLeadingEmoji(e.title))}
                    ${e.done ? '<span style="color:var(--mn);margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">check_circle</span></span>' : ''}
                    ${e.type === 'gov' && e.imp === 'rec' ? '<span class="badge-o" style="margin-left:5px">해당자</span>' : ''}
                    ${urgent ? `<span class="badge-r" style="margin-left:5px"><span class="icon icon-sm" translate="no" aria-hidden="true">schedule</span> 마감임박</span>` : ''}
                  </div>
                  ${e.hospital ? `<div class="dp-ev-note"><span class="icon icon-sm" translate="no" aria-hidden="true">local_hospital</span> ${esc(e.hospital)}</div>` : ''}
                  ${isMultiDayEv(e)
                    ? `<div class="dp-ev-note" style="color:var(--pk);font-weight:800"><span class="icon icon-sm" translate="no" aria-hidden="true">date_range</span> ${e.date} ~ ${e.endDate}</div>` : ''}
                  ${e.note     ? `<div class="dp-ev-note"><span class="icon icon-sm" translate="no" aria-hidden="true">edit_note</span> ${esc(e.note)}</div>`     : ''}
                  ${e.recDate && e.recDate !== e.date
                    ? `<div class="dp-ev-note" style="color:var(--pu)"><span class="icon icon-sm" translate="no" aria-hidden="true">event_available</span> 권장일: ${e.recDate}</div>` : ''}
                  ${e.recalculated
                    ? `<div class="dp-ev-note" style="color:#7B1FA2;font-weight:800"><span class="icon icon-sm" translate="no" aria-hidden="true">sync</span> 실접종일 기준 자동 조정됨</div>` : ''}
                  ${e.type === 'gov' && e.desc
                    ? `<div class="dp-ev-note" style="margin-top:4px">${escapeHtml(e.desc)}</div>` : ''}
                  ${e.type === 'gov' && (e.deadlineDate || e.deadlineNote)
                    ? `<div class="dp-ev-note" style="color:#C62828;font-weight:${urgent ? 800 : 400}">⏰ 마감: ${escapeHtml(e.deadlineDate || e.deadlineNote)} ${urgentText}</div>` : ''}
                  ${e.type === 'gov' && sanitizeUrl(e.link)
                    ? `<a href="${escapeHtml(sanitizeUrl(e.link))}" target="_blank" rel="noopener" style="font-size:.72rem;color:var(--bl);font-weight:800;text-decoration:underline"><span class="icon icon-sm" translate="no" aria-hidden="true">open_in_new</span> 관련 기관 바로가기</a>` : ''}
                </div>
                <button onclick="openEvModal(${e._idx})"
                        style="background:none;border:1px solid #EEE0F0;border-radius:8px;flex-shrink:0;
                               padding:3px 8px;font-size:.65rem;font-weight:800;
                               color:var(--txl);cursor:pointer;font-family:inherit"><span class="icon icon-sm" translate="no" aria-hidden="true">edit</span> 수정</button>
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

/** v0.3.25: 시간 입력이 텍스트 필드로 바뀌면서(attachTimeInputMask) 값이 항상 완전한
 *  "HH:MM"이라는 보장이 없어짐(예: blur 없이 바로 등록 버튼을 누른 경우) — 형식이 안 맞으면
 *  빈 값 취급해서 잘못된 문자열이 그대로 저장되지 않도록 함 */
function validHHMM(v) { return /^\d{2}:\d{2}$/.test(v) ? v : ''; }

/**
 * v0.4.0: 날짜를 한 번 더 눌러 여는 팝업(openQuickAddModal)도 이 함수를 그대로 재사용하도록
 * suffix 파라미터 추가 — suffix=''(기본값)는 하단 "일정 직접 추가" 폼(기존 동작 그대로),
 * suffix='Qa'는 팝업 전용 필드(evDateQa 등)를 읽고, 저장 후 팝업을 닫음(cm()).
 * v0.4.1: "1박 이상이면 연결되게 표시하고 싶다"는 요청으로 종료일(선택) 필드 추가 —
 * 비워두면 기존과 동일한 하루짜리 일정, 시작일보다 늦은 날짜를 넣으면 그 범위 전체 날짜
 * 칸에 이어지는 색상 바로 표시됨(evCoversDate/isMultiDayEv, renderEventLine 참고).
 */
export function addCustomEv(suffix = '') {
  const $ = (id) => document.getElementById(id + suffix);
  const date    = $('evDate').value;
  const endDateRaw = $('evEndDate')?.value || '';
  const title   = $('evTitle').value.trim();
  const note    = $('evNote').value.trim();
  const time    = validHHMM($('evTime').value);
  const endTime = validHHMM($('evEndTime').value);
  if (!date || !title) { alert('날짜와 제목을 입력해주세요'); return; }

  // v0.0.13: 종료 시간이 시작 시간보다 빠르거나 같으면 등록 막고 안내
  if (time && endTime && endTime <= time) {
    alert('종료 시간이 시작 시간보다 늦어야 해요');
    return;
  }
  // v0.4.1: 종료일이 시작일보다 빠르면 등록 막고 안내(같은 날짜면 그냥 하루짜리 일정으로 처리)
  if (endDateRaw && endDateRaw < date) {
    alert('종료일이 시작일보다 늦어야 해요');
    return;
  }
  const endDate = endDateRaw && endDateRaw > date ? endDateRaw : '';

  // v0.0.32: "종류" 버튼을 없애고 색상 스와치가 종류를 겸함(evTypeSwatchesHtml 참고) —
  // 필수/선택/접종은 항상 범례의 카테고리 공통 색을 그대로 씀(getEvDisplayColor가 e.color가
  // 없으면 자동으로 그렇게 처리함)
  // v0.0.33: "내 일정"만은 원래대로 일정별 개별 색을 저장함(다른 종류 색과 안 겹치는
  // 팔레트 — CUSTOM_EV_COLOR_PRESETS_FOR_ADD 참고)
  const type  = $('evType')?.value || 'custom';
  const color = type === 'custom' ? ($('evColor')?.value || '') : '';

  S.customEvs.push({
    date,
    title: buildEvTitleWithTime(time, endTime, title),
    note,
    type,
    ...(color ? { color } : {}),
    ...(endDate ? { endDate } : {}),
    auto: false,
    _id:  Date.now(),
  });
  if (suffix) {
    // 팝업은 제출 후 그대로 닫음(하단 폼처럼 필드를 비우고 계속 보여줄 필요가 없음)
    cm();
  } else {
    $('evTitle').value   = '';
    $('evNote').value    = '';
    $('evTime').value    = '';
    $('evEndTime').value = '';
    if ($('evEndDate')) $('evEndDate').value = '';
  }
  renderCal();
  if (S.selDate === date) showDayPanel(date);
  debounceSave();
}

/**
 * v0.4.0: 날짜를 한 번 더 눌렀을 때 뜨는 "일정 추가" 팝업 — 하단 "일정 직접 추가" 폼과
 * 완전히 같은 필드 구성을 쓰되 id에 'Qa' suffix를 붙여 겹치지 않게 함(evTypeSwatchesHtml/
 * addCustomEv의 suffix 파라미터 참고). 날짜는 누른 그 날짜로 미리 채워두고 수정 불가로
 * 두지 않음(다른 날짜로 바꿔서 추가하고 싶을 수도 있어 그대로 편집 가능하게 둠).
 * v0.4.1: "1박 이상이면 연결되게 표시하고 싶다"는 요청으로 종료일(선택) 필드 추가 —
 * 하단 폼과 마찬가지로 시작일/종료일을 한 줄로 붙여 보여줌.
 */
export function openQuickAddModal(ds) {
  showModal('일정 추가', `
    <div class="fg2">
      <div class="fg" style="margin:0"><label><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span> 시작일</label>
        <input type="date" id="evDateQa" value="${ds}"></div>
      <div class="fg" style="margin:0"><label>종료일 (선택, 1박 이상이면)</label><input type="date" id="evEndDateQa"></div>
    </div>
    <div class="fg2" style="margin-top:10px">
      <div class="fg" style="margin:0"><label>시작 시간 (선택)</label><input type="text" inputmode="numeric" maxlength="5" placeholder="예: 09:30" id="evTimeQa"></div>
      <div class="fg" style="margin:0"><label>종료 시간 (선택)</label><input type="text" inputmode="numeric" maxlength="5" placeholder="예: 10:30" id="evEndTimeQa"></div>
    </div>
    <div class="fg">
      <label>제목</label>
      <input id="evTitleQa" placeholder="예) 소아과 방문, 이유식 시작">
    </div>
    <div class="fg">
      <label>메모</label>
      <input id="evNoteQa" placeholder="추가 메모 (선택)">
    </div>
    <div class="fg">
      <label><span class="icon icon-sm" translate="no" aria-hidden="true">palette</span> 일정 색상</label>
      <div id="evColorSwatchWrapQa"></div>
    </div>
    <button class="btn bpk" style="margin-top:6px" onclick="addCustomEv('Qa')">일정 추가</button>
  `);
  document.getElementById('evColorSwatchWrapQa').innerHTML = evTypeSwatchesHtml('custom', null, 'Qa');
  attachTimeInputMask('evTimeQa');
  attachTimeInputMask('evEndTimeQa');
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
  // v0.0.55: 이유식 카테고리도 기존 이모지 30종 → 자체 제작 이미지 48종으로 교체(패턴은
  // 'momcal_action'·'nature'와 동일). food 카테고리는 특히 FOOD_STICKER_SET·isFoodSticker()가
  // 이 items 배열을 그대로 기준 삼아 "이유식 스티커인지" 판별하므로, 여기 값을 바꾸는 것만으로
  // 나머지 이유식 전용 로직(먹은 양 g 기록, 캘린더 셀 별도 표시 등)이 자동으로 새 값을 따라감.
  // v0.3.25: 옹짐꾼님 요청으로 '꽃·자연'과 순서를 바꿔 맨 앞으로 옮김(이유식을 가장 많이
  // 씀 — 스티커 피커를 열면 바로 보이도록) — items 내용 자체는 그대로, 배열 위치만 이동.
  { key: 'food',   label: `${icon('restaurant', { size: 'sm' })} 이유식`, items: [
      'momcal:food_rice', 'momcal:food_oatmeal', 'momcal:food_bread', 'momcal:food_barley',
      'momcal:food_potato', 'momcal:food_sweet_potato', 'momcal:food_corn',
      'momcal:food_beef', 'momcal:food_chicken', 'momcal:food_egg_yolk',
      'momcal:food_salmon', 'momcal:food_cod', 'momcal:food_anchovy',
      'momcal:food_tofu', 'momcal:food_kidney_bean', 'momcal:food_milk', 'momcal:food_cheese', 'momcal:food_yogurt',
      'momcal:food_broccoli', 'momcal:food_carrot', 'momcal:food_spinach', 'momcal:food_sweet_pumpkin',
      'momcal:food_zucchini', 'momcal:food_cucumber', 'momcal:food_avocado', 'momcal:food_tomato',
      'momcal:food_onion', 'momcal:food_green_onion', 'momcal:food_cabbage', 'momcal:food_napa_cabbage', 'momcal:food_bok_choy',
      'momcal:food_eggplant', 'momcal:food_paprika', 'momcal:food_radish', 'momcal:food_lotus_root', 'momcal:food_green_pea',
      'momcal:food_shiitake_mushroom', 'momcal:food_enoki_mushroom', 'momcal:food_king_oyster_mushroom',
      'momcal:food_apple', 'momcal:food_banana', 'momcal:food_pear', 'momcal:food_peach',
      'momcal:food_strawberry', 'momcal:food_blueberry', 'momcal:food_kiwi', 'momcal:food_orange', 'momcal:food_korean_melon',
    ] },
  // v0.0.52: 기존 이모지 16종 → 옹짐꾼님이 제작한 자체 일러스트(투명 배경 PNG) 25종으로 교체.
  // 'momcal_action' 카테고리와 동일한 패턴(momcal:xxx 토큰 + ICON_STICKERS 매핑)을 그대로 재사용.
  // 이미 저장된 기존 이모지 스티커(예: 날짜에 붙여둔 🌸)는 ICON_STICKERS에 없으므로
  // stickerDisplay()가 텍스트로 폴백해 기존처럼 그대로 보임 — 과거 데이터는 안 깨짐.
  // v0.0.60: 꽃·자연 카테고리를 옹짐꾼님이 새로 주신 이미지 28종으로 전면 교체(기존 25종은 폐기 —
  // icons/stickers/flower-nature/의 예전 파일도 함께 삭제됨). 체크리스트 성장 단계(m0~m12)
  // 아이콘도 이 세트 중 6개(sprout/clover/leaf/branch/potted_plant/tree)를 재사용함
  // (js/utils.js의 GROWTH_STAGE_FILES 참고) — 파일명이 서로 겹치므로 두 곳 다 건드릴 때 주의.
  { key: 'nature', label: `${icon('spa', { size: 'sm' })} 꽃·자연`, items: [
      'momcal:flower_cherry_blossom', 'momcal:flower_rose', 'momcal:flower_tulip', 'momcal:flower_sunflower',
      'momcal:flower_daisy', 'momcal:flower_hydrangea', 'momcal:flower_lily', 'momcal:flower_carnation',
      'momcal:flower_freesia', 'momcal:flower_lavender', 'momcal:flower_cotton', 'momcal:flower_cactus',
      'momcal:flower_leaf', 'momcal:flower_leaf_blade', 'momcal:flower_branch', 'momcal:flower_clover',
      'momcal:flower_sprout', 'momcal:flower_potted_plant', 'momcal:flower_tree', 'momcal:flower_grass_field',
      'momcal:flower_moss', 'momcal:flower_sunshine', 'momcal:flower_moon',
      'momcal:flower_starlight', 'momcal:flower_sky', 'momcal:flower_rainbow', 'momcal:flower_sea',
      'momcal:flower_waterfall',
    ] },
  // v0.0.58: 아기 카테고리도 기존 이모지 16종 → 자체 제작 이미지 21종으로 교체(다른 이미지
  // 카테고리와 동일 패턴 — momcal:babyitem_xxx 토큰 + ICON_STICKERS)
  { key: 'baby',   label: `${icon('child_care', { size: 'sm' })} 아기`, items: [
      'momcal:babyitem_newborn', 'momcal:babyitem_face', 'momcal:babyitem_girl_toddler',
      'momcal:babyitem_bottle', 'momcal:babyitem_pacifier', 'momcal:babyitem_bib', 'momcal:babyitem_diaper',
      'momcal:babyitem_clothes', 'momcal:babyitem_hat', 'momcal:babyitem_socks', 'momcal:babyitem_blanket',
      'momcal:babyitem_stroller', 'momcal:babyitem_bathtub', 'momcal:babyitem_bath_duck',
      'momcal:babyitem_teddy_bear', 'momcal:babyitem_toy', 'momcal:babyitem_rattle', 'momcal:babyitem_mobile',
      'momcal:babyitem_picture_book', 'momcal:babyitem_footprint', 'momcal:babyitem_balloon',
    ] },
  // v0.0.59: 하트·기념·건강 카테고리도 기존 이모지 → 자체 제작 이미지로 교체 — 이번으로 스티커
  // 전체 8개 카테고리가 모두 이미지 기반으로 전환 완료(momcal-action/flower-nature/babyfood/
  // baby-items에 이어서). 다른 카테고리와 동일 패턴(momcal:xxx 토큰 + ICON_STICKERS)
  { key: 'heart',  label: `${icon('favorite', { size: 'sm' })} 하트`, items: [
      'momcal:heart_basic', 'momcal:heart_pink', 'momcal:heart_orange', 'momcal:heart_yellow',
      'momcal:heart_blue', 'momcal:heart_purple', 'momcal:heart_brown', 'momcal:heart_white', 'momcal:heart_mint',
      'momcal:heart_rainbow', 'momcal:heart_plaid', 'momcal:heart_sparkle', 'momcal:heart_star', 'momcal:heart_flower',
      'momcal:heart_ribbon', 'momcal:heart_layered', 'momcal:heart_wing', 'momcal:heart_gem', 'momcal:heart_lock',
      'momcal:heart_letter', 'momcal:heart_bandage', 'momcal:heart_stitch', 'momcal:heart_smile', 'momcal:heart_hand',
      'momcal:heart_love_burst', 'momcal:heart_baby', 'momcal:heart_mom', 'momcal:heart_dad',
    ] },
  { key: 'celebrate', label: `${icon('celebration', { size: 'sm' })} 기념`, items: [
      'momcal:memorial_pregnancy_confirmed', 'momcal:memorial_first_ultrasound', 'momcal:memorial_first_meeting',
      'momcal:memorial_day_100', 'momcal:memorial_day_200', 'momcal:memorial_day_300', 'momcal:memorial_day_500',
      'momcal:memorial_first_feeding', 'momcal:memorial_first_baby_food', 'momcal:memorial_first_tooth',
      'momcal:memorial_first_vaccination', 'momcal:memorial_rollover_success', 'momcal:memorial_sitting_success',
      'momcal:memorial_crawling_success', 'momcal:memorial_first_steps', 'momcal:memorial_birthday',
      'momcal:memorial_daycare_start', 'momcal:memorial_kindergarten_start', 'momcal:memorial_graduation',
      'momcal:memorial_first_trip', 'momcal:memorial_family_photo', 'momcal:memorial_anniversary',
      'momcal:memorial_special_day', 'momcal:memorial_memory_keeping',
    ] },
  { key: 'health', label: `${icon('health_and_safety', { size: 'sm' })} 건강`, items: [
      'momcal:health_hospital_visit', 'momcal:health_appointment', 'momcal:health_health_checkup', 'momcal:health_vaccination',
      'momcal:health_temperature_log', 'momcal:health_medication_record', 'momcal:health_growth_record', 'momcal:health_health_journal',
      'momcal:health_cold_respiratory', 'momcal:health_rhinitis_nasal', 'momcal:health_ear_health', 'momcal:health_eye_health',
      'momcal:health_dental_oral', 'momcal:health_skin_eczema', 'momcal:health_allergy', 'momcal:health_digestion_stomachache',
      'momcal:health_stool_record', 'momcal:health_potty_training', 'momcal:health_sleep_record', 'momcal:health_water_intake',
      'momcal:health_vitamin_d', 'momcal:health_immunity_care', 'momcal:health_heart_rate', 'momcal:health_wound_disinfection',
    ] },
  // v0.0.50: 맘캘 육아 액션 시리즈 — 유니코드 이모지가 아니라 자체 제작 일러스트(PNG) 스티커.
  // 저장 형식은 기존 이모지 스티커와 완전히 동일한 문자열(S.dayStickers에 그대로 push/split)이라
  // Firebase 구조·기존 저장 데이터는 전혀 안 건드림 — 다만 값 자체가 이모지가 아니라
  // 'momcal:' 접두어가 붙은 고유 토큰이고, 렌더링 시 stickerDisplay()가 이 접두어를 보고
  // ICON_STICKERS 맵에서 이미지를 찾아 <img>로 그려줌(못 찾으면 텍스트 그대로 폴백).
  { key: 'momcal_action', label: `${icon('emoji_people', { size: 'sm' })} 맘캘 육아`, items: [
      'momcal:diaper_change', 'momcal:sleep_time', 'momcal:play', 'momcal:bath', 'momcal:kiss',
      'momcal:hug', 'momcal:brush_teeth', 'momcal:milk_feeding', 'momcal:baby_food_eating', 'momcal:reading',
    ] },
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

/**
 * v0.0.50: 이미지 기반 스티커('momcal:xxx' 토큰) → 실제 파일 매핑.
 * key는 stickerCats items에 저장된 값과 정확히 같아야 함
 * (Firestore에 이 문자열 그대로 저장되므로 key를 바꾸면 이미 저장된 사용자 데이터와 어긋남 — 바꾸지 말 것).
 * v0.0.52: 폴더가 여러 개(momcal-action/, flower-nature/)로 늘어나서 항목마다 path(하위 폴더명)를
 * 따로 갖도록 확장 — file은 파일명만, path는 STICKER_ICON_BASE 밑의 하위 폴더명.
 * "맘캘 육아" 10종은 이번에 새 원화로 전부 교체됐는데, 8개는 기존 파일명(bath.png 등)과 같아서
 * 그대로 덮어쓰면 브라우저/CDN 캐시가 예전 이미지를 계속 보여주는 문제(v0.0.51에서 겪은 캐시 이슈와
 * 동일 원인)가 재발할 수 있어 전부 새 파일명(_v2)으로 저장 — 예전 파일은 삭제함.
 */
const ICON_STICKERS = {
  'momcal:diaper_change':    { path: 'momcal-action', file: 'diaper_change_v2.png',    label: '기저귀 갈기' },
  'momcal:sleep_time':       { path: 'momcal-action', file: 'sleep_time_v2.png',       label: '꿈나라 가기' },
  'momcal:play':             { path: 'momcal-action', file: 'play_v2.png',             label: '놀이하기' },
  'momcal:bath':             { path: 'momcal-action', file: 'bath_v2.png',             label: '목욕하기' },
  'momcal:kiss':             { path: 'momcal-action', file: 'kiss_v2.png',             label: '뽀뽀하기' },
  'momcal:hug':              { path: 'momcal-action', file: 'hug_v2.png',              label: '안아주기' },
  'momcal:brush_teeth':      { path: 'momcal-action', file: 'brush_teeth_v2.png',      label: '양치하기' },
  'momcal:milk_feeding':     { path: 'momcal-action', file: 'milk_feeding_v2.png',     label: '우유먹기' },
  'momcal:baby_food_eating': { path: 'momcal-action', file: 'baby_food_eating_v2.png', label: '이유식먹기' },
  'momcal:reading':          { path: 'momcal-action', file: 'reading_v2.png',          label: '책읽기' },
  // v0.0.60: 꽃·자연 카테고리 — 기존 25종 전면 교체(v0.0.52 세트 폐기)
  'momcal:flower_cherry_blossom': { path: 'flower-nature', file: 'cherry_blossom.png', label: '벚꽃' },
  'momcal:flower_rose':           { path: 'flower-nature', file: 'rose.png',           label: '장미' },
  'momcal:flower_tulip':          { path: 'flower-nature', file: 'tulip.png',          label: '튤립' },
  'momcal:flower_sunflower':      { path: 'flower-nature', file: 'sunflower.png',      label: '해바라기' },
  'momcal:flower_daisy':          { path: 'flower-nature', file: 'daisy.png',          label: '데이지' },
  'momcal:flower_hydrangea':      { path: 'flower-nature', file: 'hydrangea.png',      label: '수국' },
  'momcal:flower_lily':           { path: 'flower-nature', file: 'lily.png',           label: '백합' },
  'momcal:flower_carnation':      { path: 'flower-nature', file: 'carnation.png',      label: '카네이션' },
  'momcal:flower_freesia':        { path: 'flower-nature', file: 'freesia.png',        label: '프리지아' },
  'momcal:flower_lavender':       { path: 'flower-nature', file: 'lavender.png',       label: '라벤더' },
  'momcal:flower_cotton':         { path: 'flower-nature', file: 'cotton.png',         label: '목화' },
  'momcal:flower_cactus':         { path: 'flower-nature', file: 'cactus.png',         label: '선인장' },
  'momcal:flower_leaf':           { path: 'flower-nature', file: 'leaf.png',           label: '나뭇잎' },
  'momcal:flower_leaf_blade':     { path: 'flower-nature', file: 'leaf_blade.png',     label: '풀잎' },
  'momcal:flower_branch':         { path: 'flower-nature', file: 'branch.png',         label: '나뭇가지' },
  'momcal:flower_clover':         { path: 'flower-nature', file: 'clover.png',         label: '클로버' },
  'momcal:flower_sprout':         { path: 'flower-nature', file: 'sprout.png',         label: '새싹' },
  'momcal:flower_potted_plant':   { path: 'flower-nature', file: 'potted_plant.png',   label: '화분' },
  'momcal:flower_tree':           { path: 'flower-nature', file: 'tree.png',           label: '나무' },
  'momcal:flower_grass_field':    { path: 'flower-nature', file: 'grass_field.png',    label: '풀밭' },
  'momcal:flower_moss':           { path: 'flower-nature', file: 'moss.png',           label: '이끼' },
  'momcal:flower_sunshine':       { path: 'flower-nature', file: 'sunshine.png',       label: '햇살' },
  'momcal:flower_moon':           { path: 'flower-nature', file: 'moon.png',           label: '달' },
  'momcal:flower_starlight':      { path: 'flower-nature', file: 'starlight.png',      label: '별빛' },
  'momcal:flower_sky':            { path: 'flower-nature', file: 'sky.png',            label: '하늘' },
  'momcal:flower_rainbow':        { path: 'flower-nature', file: 'rainbow.png',        label: '무지개' },
  'momcal:flower_sea':            { path: 'flower-nature', file: 'sea.png',            label: '바다' },
  'momcal:flower_waterfall':      { path: 'flower-nature', file: 'waterfall.png',      label: '폭포' },
  // v0.0.55: 이유식 카테고리
  'momcal:food_rice':               { path: 'babyfood', file: 'rice.png',               label: '쌀' },
  'momcal:food_oatmeal':            { path: 'babyfood', file: 'oatmeal.png',            label: '오트밀' },
  'momcal:food_bread':              { path: 'babyfood', file: 'bread.png',              label: '빵' },
  'momcal:food_barley':             { path: 'babyfood', file: 'barley.png',             label: '보리' },
  'momcal:food_potato':             { path: 'babyfood', file: 'potato.png',             label: '감자' },
  'momcal:food_sweet_potato':       { path: 'babyfood', file: 'sweet_potato.png',       label: '고구마' },
  'momcal:food_corn':               { path: 'babyfood', file: 'corn.png',               label: '옥수수' },
  'momcal:food_beef':               { path: 'babyfood', file: 'beef.png',               label: '소고기' },
  'momcal:food_chicken':            { path: 'babyfood', file: 'chicken.png',            label: '닭고기' },
  'momcal:food_egg_yolk':           { path: 'babyfood', file: 'egg_yolk.png',           label: '노른자' },
  'momcal:food_salmon':             { path: 'babyfood', file: 'salmon.png',             label: '연어' },
  'momcal:food_cod':                { path: 'babyfood', file: 'cod.png',                label: '대구' },
  'momcal:food_anchovy':            { path: 'babyfood', file: 'anchovy.png',            label: '멸치' },
  'momcal:food_tofu':               { path: 'babyfood', file: 'tofu.png',               label: '두부' },
  'momcal:food_kidney_bean':        { path: 'babyfood', file: 'kidney_bean.png',        label: '강낭콩' },
  'momcal:food_milk':               { path: 'babyfood', file: 'milk.png',               label: '우유' },
  'momcal:food_cheese':             { path: 'babyfood', file: 'cheese.png',             label: '치즈' },
  'momcal:food_yogurt':             { path: 'babyfood', file: 'yogurt.png',             label: '요거트' },
  'momcal:food_broccoli':           { path: 'babyfood', file: 'broccoli.png',           label: '브로콜리' },
  'momcal:food_carrot':             { path: 'babyfood', file: 'carrot.png',             label: '당근' },
  'momcal:food_spinach':            { path: 'babyfood', file: 'spinach.png',            label: '시금치' },
  'momcal:food_sweet_pumpkin':      { path: 'babyfood', file: 'sweet_pumpkin.png',      label: '단호박' },
  'momcal:food_zucchini':           { path: 'babyfood', file: 'zucchini.png',           label: '애호박' },
  'momcal:food_cucumber':           { path: 'babyfood', file: 'cucumber.png',           label: '오이' },
  'momcal:food_avocado':            { path: 'babyfood', file: 'avocado.png',            label: '아보카도' },
  'momcal:food_tomato':             { path: 'babyfood', file: 'tomato.png',             label: '토마토' },
  'momcal:food_onion':              { path: 'babyfood', file: 'onion.png',              label: '양파' },
  'momcal:food_green_onion':        { path: 'babyfood', file: 'green_onion.png',        label: '파' },
  'momcal:food_cabbage':            { path: 'babyfood', file: 'cabbage.png',            label: '양배추' },
  'momcal:food_napa_cabbage':       { path: 'babyfood', file: 'napa_cabbage.png',       label: '배추' },
  'momcal:food_bok_choy':           { path: 'babyfood', file: 'bok_choy.png',           label: '청경채' },
  'momcal:food_eggplant':           { path: 'babyfood', file: 'eggplant.png',           label: '가지' },
  'momcal:food_paprika':            { path: 'babyfood', file: 'paprika.png',            label: '파프리카' },
  'momcal:food_radish':             { path: 'babyfood', file: 'radish.png',             label: '무' },
  'momcal:food_lotus_root':         { path: 'babyfood', file: 'lotus_root.png',         label: '연근' },
  'momcal:food_green_pea':          { path: 'babyfood', file: 'green_pea.png',          label: '완두콩' },
  'momcal:food_shiitake_mushroom':  { path: 'babyfood', file: 'shiitake_mushroom.png',  label: '표고버섯' },
  'momcal:food_enoki_mushroom':     { path: 'babyfood', file: 'enoki_mushroom.png',     label: '팽이버섯' },
  'momcal:food_king_oyster_mushroom': { path: 'babyfood', file: 'king_oyster_mushroom.png', label: '새송이버섯' },
  'momcal:food_apple':              { path: 'babyfood', file: 'apple.png',              label: '사과' },
  'momcal:food_banana':             { path: 'babyfood', file: 'banana.png',             label: '바나나' },
  'momcal:food_pear':               { path: 'babyfood', file: 'pear.png',               label: '배' },
  'momcal:food_peach':              { path: 'babyfood', file: 'peach.png',              label: '복숭아' },
  'momcal:food_strawberry':         { path: 'babyfood', file: 'strawberry.png',         label: '딸기' },
  'momcal:food_blueberry':          { path: 'babyfood', file: 'blueberry.png',          label: '블루베리' },
  'momcal:food_kiwi':               { path: 'babyfood', file: 'kiwi.png',               label: '키위' },
  'momcal:food_orange':             { path: 'babyfood', file: 'orange.png',             label: '오렌지' },
  'momcal:food_korean_melon':       { path: 'babyfood', file: 'korean_melon.png',       label: '참외' },
  // v0.0.58: 아기 카테고리
  'momcal:babyitem_newborn':        { path: 'baby-items', file: 'newborn.png',      label: '신생아' },
  'momcal:babyitem_face':           { path: 'baby-items', file: 'baby_face.png',    label: '아기 얼굴' },
  'momcal:babyitem_girl_toddler':   { path: 'baby-items', file: 'girl_toddler.png', label: '여자 아기' },
  'momcal:babyitem_bottle':         { path: 'baby-items', file: 'baby_bottle.png',  label: '젖병' },
  'momcal:babyitem_pacifier':       { path: 'baby-items', file: 'pacifier.png',     label: '쪽쪽이' },
  'momcal:babyitem_bib':            { path: 'baby-items', file: 'bib.png',          label: '턱받이' },
  'momcal:babyitem_diaper':         { path: 'baby-items', file: 'diaper.png',       label: '기저귀' },
  'momcal:babyitem_clothes':        { path: 'baby-items', file: 'clothes.png',      label: '아기옷' },
  'momcal:babyitem_hat':            { path: 'baby-items', file: 'baby_hat.png',     label: '아기 모자' },
  'momcal:babyitem_socks':          { path: 'baby-items', file: 'socks.png',        label: '양말' },
  'momcal:babyitem_blanket':        { path: 'baby-items', file: 'baby_blanket.png', label: '속싸개' },
  'momcal:babyitem_stroller':       { path: 'baby-items', file: 'stroller.png',     label: '유모차' },
  'momcal:babyitem_bathtub':        { path: 'baby-items', file: 'baby_bathtub.png', label: '아기 욕조' },
  'momcal:babyitem_bath_duck':      { path: 'baby-items', file: 'bath_duck.png',    label: '목욕 오리' },
  'momcal:babyitem_teddy_bear':     { path: 'baby-items', file: 'teddy_bear.png',   label: '곰인형' },
  'momcal:babyitem_toy':            { path: 'baby-items', file: 'toy.png',          label: '장난감' },
  'momcal:babyitem_rattle':         { path: 'baby-items', file: 'rattle.png',       label: '딸랑이' },
  'momcal:babyitem_mobile':         { path: 'baby-items', file: 'mobile.png',       label: '모빌' },
  'momcal:babyitem_picture_book':   { path: 'baby-items', file: 'picture_book.png', label: '그림책' },
  'momcal:babyitem_footprint':      { path: 'baby-items', file: 'footprint.png',    label: '발자국' },
  'momcal:babyitem_balloon':        { path: 'baby-items', file: 'balloon.png',      label: '풍선' },
  // v0.0.59: 하트 카테고리
  'momcal:heart_basic':      { path: 'heart', file: 'basic_heart.png',  label: '기본 하트' },
  'momcal:heart_pink':       { path: 'heart', file: 'pink_heart.png',   label: '분홍 하트' },
  'momcal:heart_orange':     { path: 'heart', file: 'orange_heart.png', label: '주황 하트' },
  'momcal:heart_yellow':     { path: 'heart', file: 'yellow_heart.png', label: '노란 하트' },
  'momcal:heart_blue':       { path: 'heart', file: 'blue_heart.png',   label: '파란 하트' },
  'momcal:heart_purple':     { path: 'heart', file: 'purple_heart.png', label: '보라 하트' },
  'momcal:heart_brown':      { path: 'heart', file: 'brown_heart.png',  label: '갈색 하트' },
  'momcal:heart_white':      { path: 'heart', file: 'white_heart.png',  label: '하얀 하트' },
  'momcal:heart_mint':       { path: 'heart', file: 'mint_heart.png',   label: '민트 하트' },
  'momcal:heart_rainbow':    { path: 'heart', file: 'rainbow_heart.png', label: '무지개 하트' },
  'momcal:heart_plaid':      { path: 'heart', file: 'plaid_heart.png',  label: '체크무늬 하트' },
  'momcal:heart_sparkle':    { path: 'heart', file: 'sparkle_heart.png', label: '반짝이는 하트' },
  'momcal:heart_star':       { path: 'heart', file: 'star_heart.png',   label: '별 하트' },
  'momcal:heart_flower':     { path: 'heart', file: 'flower_heart.png', label: '꽃 하트' },
  'momcal:heart_ribbon':     { path: 'heart', file: 'ribbon_heart.png', label: '리본 하트' },
  'momcal:heart_layered':    { path: 'heart', file: 'layered_heart.png', label: '겹 하트' },
  'momcal:heart_wing':       { path: 'heart', file: 'wing_heart.png',   label: '날개 하트' },
  'momcal:heart_gem':        { path: 'heart', file: 'gem_heart.png',    label: '보석 하트' },
  'momcal:heart_lock':       { path: 'heart', file: 'lock_heart.png',   label: '자물쇠 하트' },
  'momcal:heart_letter':     { path: 'heart', file: 'letter_heart.png', label: '편지 하트' },
  'momcal:heart_bandage':    { path: 'heart', file: 'bandage_heart.png', label: '밴드 하트' },
  'momcal:heart_stitch':     { path: 'heart', file: 'stitch_heart.png', label: '스티치 하트' },
  'momcal:heart_smile':      { path: 'heart', file: 'smile_heart.png',  label: '웃는 하트' },
  'momcal:heart_hand':       { path: 'heart', file: 'hand_heart.png',   label: '손하트' },
  'momcal:heart_love_burst': { path: 'heart', file: 'love_burst.png',   label: '사랑 폭발' },
  'momcal:heart_baby':       { path: 'heart', file: 'baby_heart.png',   label: '아기 하트' },
  'momcal:heart_mom':        { path: 'heart', file: 'mom_heart.png',    label: '엄마 하트' },
  'momcal:heart_dad':        { path: 'heart', file: 'dad_heart.png',    label: '아빠 하트' },
  // v0.0.59: 기념 카테고리
  'momcal:memorial_pregnancy_confirmed': { path: 'memorial', file: 'pregnancy_confirmed.png', label: '임신 확인' },
  'momcal:memorial_first_ultrasound':    { path: 'memorial', file: 'first_ultrasound.png',    label: '첫 초음파' },
  'momcal:memorial_first_meeting':       { path: 'memorial', file: 'first_meeting.png',       label: '첫 만남' },
  'momcal:memorial_day_100':             { path: 'memorial', file: 'day_100.png',             label: '100일' },
  'momcal:memorial_day_200':             { path: 'memorial', file: 'day_200.png',             label: '200일' },
  'momcal:memorial_day_300':             { path: 'memorial', file: 'day_300.png',             label: '300일' },
  'momcal:memorial_day_500':             { path: 'memorial', file: 'day_500.png',             label: '500일' },
  'momcal:memorial_first_feeding':       { path: 'memorial', file: 'first_feeding.png',       label: '첫 수유' },
  'momcal:memorial_first_baby_food':     { path: 'memorial', file: 'first_baby_food.png',     label: '첫 이유식' },
  'momcal:memorial_first_tooth':         { path: 'memorial', file: 'first_tooth.png',         label: '첫니' },
  'momcal:memorial_first_vaccination':   { path: 'memorial', file: 'first_vaccination.png',   label: '첫 예방접종' },
  'momcal:memorial_rollover_success':    { path: 'memorial', file: 'rollover_success.png',    label: '뒤집기 성공' },
  'momcal:memorial_sitting_success':     { path: 'memorial', file: 'sitting_success.png',     label: '앉기 성공' },
  'momcal:memorial_crawling_success':    { path: 'memorial', file: 'crawling_success.png',    label: '배밀이 성공' },
  'momcal:memorial_first_steps':         { path: 'memorial', file: 'first_steps.png',         label: '첫 걸음' },
  'momcal:memorial_birthday':            { path: 'memorial', file: 'birthday.png',            label: '생일' },
  'momcal:memorial_daycare_start':       { path: 'memorial', file: 'daycare_start.png',       label: '어린이집 등원' },
  'momcal:memorial_kindergarten_start':  { path: 'memorial', file: 'kindergarten_start.png',  label: '유치원 입학' },
  'momcal:memorial_graduation':          { path: 'memorial', file: 'graduation.png',          label: '졸업' },
  'momcal:memorial_first_trip':          { path: 'memorial', file: 'first_trip.png',          label: '첫 여행' },
  'momcal:memorial_family_photo':        { path: 'memorial', file: 'family_photo.png',        label: '가족사진' },
  'momcal:memorial_anniversary':         { path: 'memorial', file: 'anniversary.png',         label: '기념일' },
  'momcal:memorial_special_day':         { path: 'memorial', file: 'special_day.png',         label: '특별한 날' },
  'momcal:memorial_memory_keeping':      { path: 'memorial', file: 'memory_keeping.png',      label: '추억 기록' },
  // v0.0.59: 건강 카테고리
  'momcal:health_hospital_visit':       { path: 'health', file: 'hospital_visit.png',       label: '병원 방문' },
  'momcal:health_appointment':          { path: 'health', file: 'appointment.png',          label: '병원 예약' },
  'momcal:health_health_checkup':       { path: 'health', file: 'health_checkup.png',       label: '건강검진' },
  'momcal:health_vaccination':          { path: 'health', file: 'vaccination.png',          label: '예방접종' },
  'momcal:health_temperature_log':      { path: 'health', file: 'temperature_log.png',      label: '체온 기록' },
  'momcal:health_medication_record':    { path: 'health', file: 'medication_record.png',    label: '투약 기록' },
  'momcal:health_growth_record':        { path: 'health', file: 'growth_record.png',        label: '성장 기록' },
  'momcal:health_health_journal':       { path: 'health', file: 'health_journal.png',       label: '건강 일지' },
  'momcal:health_cold_respiratory':     { path: 'health', file: 'cold_respiratory.png',     label: '감기·호흡기' },
  'momcal:health_rhinitis_nasal':       { path: 'health', file: 'rhinitis_nasal.png',       label: '비염·콧물' },
  'momcal:health_ear_health':           { path: 'health', file: 'ear_health.png',           label: '귀 건강' },
  'momcal:health_eye_health':           { path: 'health', file: 'eye_health.png',           label: '눈 건강' },
  'momcal:health_dental_oral':          { path: 'health', file: 'dental_oral.png',          label: '치아·구강' },
  'momcal:health_skin_eczema':          { path: 'health', file: 'skin_eczema.png',          label: '피부·습진' },
  'momcal:health_allergy':              { path: 'health', file: 'allergy.png',              label: '알레르기' },
  'momcal:health_digestion_stomachache': { path: 'health', file: 'digestion_stomachache.png', label: '소화·복통' },
  'momcal:health_stool_record':         { path: 'health', file: 'stool_record.png',         label: '배변 기록' },
  'momcal:health_potty_training':       { path: 'health', file: 'potty_training.png',       label: '배변 훈련' },
  'momcal:health_sleep_record':         { path: 'health', file: 'sleep_record.png',         label: '수면 기록' },
  'momcal:health_water_intake':         { path: 'health', file: 'water_intake.png',         label: '수분 섭취' },
  'momcal:health_vitamin_d':            { path: 'health', file: 'vitamin_d.png',            label: '비타민D' },
  'momcal:health_immunity_care':        { path: 'health', file: 'immunity_care.png',        label: '면역 관리' },
  'momcal:health_heart_rate':           { path: 'health', file: 'heart_rate.png',           label: '심박수' },
  'momcal:health_wound_disinfection':   { path: 'health', file: 'wound_disinfection.png',   label: '상처 소독' },
};
const STICKER_ICON_BASE = './icons/stickers/';

/**
 * 스티커 값 하나를 화면에 그릴 HTML을 반환. ICON_STICKERS에 있는 이미지 스티커면 <img>,
 * 아니면(기존 이모지 스티커) 텍스트 그대로 폴백 — 매핑에 없는 값이 와도 절대 빈 화면이 되지 않음.
 * size는 기존 이모지가 쓰던 font-size 값을 그대로 넘겨서 시각적 크기를 맞춤(예: '.8rem', '1.45rem').
 */
function stickerDisplay(s, size) {
  const meta = ICON_STICKERS[stickerEmoji(s)];
  if (!meta) return stickerEmoji(s);
  return `<img class="sticker-img" src="${STICKER_ICON_BASE}${meta.path}/${meta.file}" alt="${meta.label}" title="${meta.label}" style="width:${size};height:${size}" loading="lazy">`;
}

function formatSticker(s) {
  const [raw, grams] = s.split('|');
  const label = ICON_STICKERS[raw]?.label || raw; // 이미지 토큰이면 사람이 읽을 라벨로, 레거시 이모지면 그대로
  return grams ? `${label}(${grams}g)` : label;
}

/** v0.0.55: 이유식 필터 켜졌을 때 칸 가운데에 크게 보여주는 항목 — stickerDisplay()가 이미지
 *  토큰이면 <img>를, 레거시 이모지면 텍스트를 반환하므로 그 뒤에 g수(있으면)만 붙여줌 */
function foodCenterItemHtml(s) {
  const grams = s.includes('|') ? s.split('|')[1] : '';
  return `${stickerDisplay(s, '1.1em')}${grams ? ` ${grams}g` : ''}`;
}

export function renderStickerPicker() {
  document.getElementById('spTabs').innerHTML = stickerCats.map((c, i) =>
    `<button class="sp-tab ${i === S.selSCat ? 'on' : ''}" onclick="selSCat(${i})">${c.label}</button>`
  ).join('');
  document.getElementById('spGrid').innerHTML = stickerCats[S.selSCat].items.map(s =>
    `<div class="sp-sticker" onclick="placeSticker('${s}')">${stickerDisplay(s, '38px')}</div>`
  ).join('');
}

/**
 * v0.4.0: "스티커가 바로 보이지 말고 눌렀을 때 열렸으면 좋겠다"는 피드백으로,
 * 스티커 피커를 기본 접힘 아코디언으로 변경 — 헤더(.sp-header)를 누르면 #spBody(탭+그리드)가
 * 열림/닫힘. 열림 상태는 DOM에만 있고 S(Firestore)엔 저장하지 않음(기기별·탭 전환마다 매번
 * 다시 접힌 채로 시작해도 무방한 순수 UI 상태라 스키마에 추가할 필요가 없음).
 */
export function toggleStickerPicker() {
  const body     = document.getElementById('spBody');
  const chevron  = document.getElementById('spHeaderChevron');
  if (!body) return;
  const opening = !body.classList.contains('open');
  body.classList.toggle('open', opening);
  if (chevron) chevron.textContent = opening ? 'expand_less' : 'expand_more';
}

/** v0.4.0: PC용 좌우 화살표 버튼 — 그리드 폭의 90%만큼 부드럽게 스크롤 */
export function scrollStickerGrid(dir) {
  const grid = document.getElementById('spGrid');
  if (!grid) return;
  grid.scrollBy({ left: dir * grid.clientWidth * 0.9, behavior: 'smooth' });
}

/**
 * v0.4.0: "스티커 옆으로 넘기는 게 모바일에서는 좋은데 PC에서는 잘 안 된다"는 피드백 —
 * 마우스로도 자연스럽게 넘길 수 있도록 3가지를 추가함:
 * (1) 마우스 휠의 세로 스크롤을 가로 스크롤로 변환(트랙패드의 가로 휠 입력은 그대로 둠)
 * (2) 클릭 드래그로 좌우 스크롤(모바일 스와이프의 PC 버전)
 * (3) 좌우 화살표 버튼(scrollStickerGrid, 위)
 * #spGrid는 index.html에 정적으로 있는 컨테이너라(카테고리 전환 시 내부 스티커만
 * renderStickerPicker()가 다시 채움) attachTimeInputMask()와 같은 멱등 가드로 앱 시작 시
 * 1회만 붙이면 됨.
 */
function initStickerGridPcNav() {
  const grid = document.getElementById('spGrid');
  if (!grid || grid._pcNavAttached) return;
  grid._pcNavAttached = true;

  grid.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 이미 가로 입력(트랙패드)이면 기본 동작 유지
    e.preventDefault();
    grid.scrollLeft += e.deltaY;
  }, { passive: false });

  let dragging = false, startX = 0, startScroll = 0, moved = false;
  grid.addEventListener('mousedown', (e) => {
    dragging = true; moved = false;
    startX = e.pageX; startScroll = grid.scrollLeft;
    grid.classList.add('sp-grid-dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 4) moved = true;
    grid.scrollLeft = startScroll - dx;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    grid.classList.remove('sp-grid-dragging');
  });
  // 드래그로 조금이라도 움직였으면 그 클릭이 스티커 선택(placeSticker)으로 이어지지 않게 막음
  grid.addEventListener('click', (e) => {
    if (moved) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
initStickerGridPcNav();

export function selSCat(i) { S.selSCat = i; renderStickerPicker(); }

export function placeSticker(s) {
  if (!S.selDate) { alert('먼저 날짜를 클릭해서 선택해주세요!'); return; }
  if (!S.dayStickers[S.selDate]) S.dayStickers[S.selDate] = [];

  // v0.0.31: 이유식 스티커는 먹은 양(g)을 함께 기록할 수 있음(선택 사항 — 취소하거나
  // 빈 값으로 두면 예전처럼 이모지만 붙음)
  if (FOOD_STICKER_SET.has(s)) {
    const input = prompt(`${formatSticker(s)} 먹은 양을 g으로 입력해주세요 (선택 사항, 비워두면 기록 없이 붙어요)`, '');
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
  let evs = [];

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

  // v0.2.4: 사용자가 설정 탭에서 직접 추가한 정부지원 항목(지자체별 지원금 등) — 앱 기본
  // 제공 govSupportSchedule과 똑같은 모양(type:'gov')으로 섞어 넣어서 캘린더·체크리스트
  // 정부지원 탭에 기존 항목과 동일하게 표시되게 함. 날짜는 사용자가 직접 고른 절대 날짜라
  // (임신 주차/개월수 기반 자동 계산이 아님) 그대로 씀. stage가 지금 아이 단계와 같은
  // 항목만 보여줌(임산부용으로 추가한 건 임신 중인 아이에게만, 육아용은 출생한 아이에게만).
  (S.customGovItems || []).filter(it => it.stage === child.stage).forEach(it => {
    evs.push({
      date: it.date, _origDate: it.date, title: it.title, type: 'gov', auto: true,
      imp: it.imp || 'rec', desc: it.desc || '', link: it.link || '',
      deadlineNote: null, deadlineDate: null, customGov: true, _customGovId: it.id,
    });
  });

  // v0.0.42: 체크리스트 캘린더 연동을 꺼두면(설정 탭 → 체크리스트 관리), 완료 체크 동기화만
  // 멈추는 게 아니라 캘린더에서 해당 카테고리 일정 자체를 안 보이게 함(연동을 다시 켜면 복원).
  // 건강검진 이벤트는 ev.type이 'checkup'이 아니라 필수/추천 여부에 따라 'req'/'rec'로 저장돼
  // 있는데, 이 req/rec는 임신 단계(pregEvMap)에서도 같은 문자열을 쓰지만 코드 branch가
  // preg/born으로 완전히 분리돼 있어서(위 if문) born 단계에서만 만들어진 이벤트라는 게 보장됨.
  const sync = S.clSettings && S.clSettings.calendarSync;
  if (sync) {
    if (sync.vax === false) evs = evs.filter(e => e.type !== 'vax');
    if (child.stage === 'born' && sync.dev === false) evs = evs.filter(e => e.type !== 'req' && e.type !== 'rec');
  }
  return evs;
}

/* ══════════════════════════════════════
 *  window 노출 (인라인 onclick 핸들러용)
 * ══════════════════════════════════════ */
window.renderCal           = renderCal;
window.calMove             = calMove;
window.setCalView          = setCalView;
window.selectDate          = selectDate;
window.showDayPanel        = showDayPanel;
window.addCustomEv         = addCustomEv;
window.delCustomEv         = delCustomEv;
window.renderStickerPicker = renderStickerPicker;
window.toggleStickerPicker = toggleStickerPicker;
window.scrollStickerGrid   = scrollStickerGrid;
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
