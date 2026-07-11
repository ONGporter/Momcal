/**
 * js/homeWeekWidget.js — v0.0.45 신규, v0.0.46/v0.0.47 개편
 *
 * 홈 화면에 있던 "우리 아이 무럭무럭!" 배너를 없애고 그 자리에 넣는 간소화 캘린더.
 * 오늘(또는 선택된 날짜)이 포함된 주(월~일)를 한 줄로 보여주고, 이전/다음 주로 이동할 수 있다.
 *
 * v0.0.47: "전체 캘린더 탭의 한 주치를 그대로 가져온 것"이 되도록 js/calendar.js의
 * 실제 셀 렌더러(cellHTML)와 이벤트 데이터(getAllEvs)를 그대로 재사용한다 — 그래서 일정
 * 색상 줄·스티커·완료 표시·공휴일 표시가 캘린더 탭과 완전히 동일하게 보인다(직접 재구현하지
 * 않음으로써 두 화면이 항상 같은 결과를 내게 함, AGENTS.md 원칙과도 맞음: cellHTML은 export만
 * 추가했을 뿐 내부 동작은 전혀 안 건드림).
 *
 * 동기화 대상은 "월간 뷰"다 — 별도의 주간 전용 기준일(S.calWeekRef, 캘린더 탭 주간 뷰 전용)을
 * 쓰지 않고, 앱 전체가 이미 공유하는 "현재 선택된 날짜"(S.selDate, 없으면 오늘)를 기준으로
 * 주를 계산한다. 날짜를 클릭하거나 위젯에서 주를 이동하면 캘린더 탭의 월간 뷰가 보여줄
 * 연/월(S.calY/S.calM)도 함께 맞춰서, 나중에 캘린더 탭(월간 뷰)을 열어도 같은 맥락이 이어진다.
 */

import { S } from './state.js';
import { today } from './utils.js';
import { themes, getAllEvs, cellHTML, selectDate } from './calendar.js';

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 주어진 날짜(YYYY-MM-DD)가 속한 주의 월요일 Date 객체를 반환 */
function mondayOf(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay(); // 0=일 ~ 6=토
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/** 주가 걸친 월을 "7월" 또는 "7월 - 8월"(연도가 겹치면 연도도 함께) 형태로 표시 */
function monthRangeLabel(mon, sun) {
  const y1 = mon.getFullYear(), m1 = mon.getMonth() + 1;
  const y2 = sun.getFullYear(), m2 = sun.getMonth() + 1;
  if (y1 === y2 && m1 === m2) return `${m1}월`;
  if (y1 === y2) return `${m1}월 - ${m2}월`;
  return `${y1}년 ${m1}월 - ${y2}년 ${m2}월`;
}

/** 현재 홈 위젯이 보여줘야 할 "기준일" — 선택된 날짜가 있으면 그 날, 없으면 오늘 */
function focusDate() {
  return S.selDate || today();
}

export function renderHomeWeek() {
  const grid  = document.getElementById('homeWeekGrid');
  const monEl = document.getElementById('homeWeekMonth');
  if (!grid) return;

  const th  = themes[S.theme] || themes.rose;
  const mon = mondayOf(focusDate());
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const td  = today();
  const evs = getAllEvs();

  if (monEl) monEl.textContent = monthRangeLabel(mon, sun);

  let headHtml = '';
  let bodyHtml = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds = fmtDate(d);
    // 헤더(요일 이름)는 기존 캘린더(js/calendar.js renderMonthView)와 동일하게 토/일 열만 고정 빨간색
    const isWeekendCol = i === 5 || i === 6; // 월요일 시작이므로 5=토, 6=일
    headHtml += `<div class="cal-head-cell${isWeekendCol ? ' cal-head-red' : ''}">${DOW_LABELS[i]}</div>`;
    // 캘린더 탭과 완전히 같은 셀 렌더러 재사용 — 일정·스티커·완료표시·공휴일 표시가 그대로 나옴
    bodyHtml += cellHTML(ds, d.getDate(), false, evs, td, th);
  }

  grid.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-head-row" style="background:${th.g}">${headHtml}</div>
      <div class="cal-body" onclick="onHomeWeekCellClick(event)">${bodyHtml}</div>
    </div>`;
}

/** 이전/다음 주 이동 (delta: -1 | 1) — 기준일을 7일 단위로 옮기고, 캘린더 탭 월간 뷰의 연/월도 함께 맞춤 */
export function moveHomeWeek(delta) {
  const d = new Date(focusDate());
  d.setDate(d.getDate() + delta * 7);
  const newRef = fmtDate(d);
  S.selDate = newRef;
  S.calY = d.getFullYear();
  S.calM = d.getMonth();
  renderHomeWeek();
}

/**
 * 홈 위젯의 날짜 셀을 클릭했을 때 캘린더 탭(월간 뷰)으로 이동한다.
 * cellHTML이 이미 각 셀에 data-date·자체 onclick(selectDate)을 넣어주므로,
 * 여기서는 클릭된 셀을 event delegation으로 찾아 캘린더 탭 이동만 담당한다.
 */
function onHomeWeekCellClick(evt) {
  const cell = evt.target.closest('.cal-cell');
  if (!cell) return;
  goToCalendarDay(cell.dataset.date);
}

/**
 * 캘린더 탭 월간 뷰로 이동해 해당 날짜가 보이는 달을 펼치고 그 날짜를 선택 상태로 만든다.
 * (v0.0.46에선 주간 뷰로 보냈었는데, "주간 뷰가 아니라 월간 뷰와 연동해달라"는 피드백으로
 * v0.0.47에서 변경 — S.calView를 강제로 'month'로 맞추고 .cvt 토글 UI도 함께 갱신)
 */
function goToCalendarDay(ds) {
  const d = new Date(ds);
  S.calY = d.getFullYear();
  S.calM = d.getMonth();
  S.calView = 'month';
  window.gp('calendar', document.querySelector(".np[data-page='calendar']"));
  document.querySelectorAll('.cvt').forEach(b => b.classList.remove('on'));
  const monthBtn = [...document.querySelectorAll('.cvt')].find(b => b.textContent.trim() === '월간');
  if (monthBtn) monthBtn.classList.add('on');
  selectDate(ds); // 선택 상태·세부일정 패널까지 확실히 맞춤(멱등적이라 다시 호출해도 안전)
}

// 인라인 onclick에서 접근할 수 있도록 전역 노출 (js/ui.js gp()·calendar.js 패턴과 동일)
window.moveHomeWeek        = moveHomeWeek;
window.onHomeWeekCellClick = onHomeWeekCellClick;
