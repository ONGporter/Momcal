/**
 * js/homeWeekWidget.js — v0.0.45 신규, v0.0.46 개편
 *
 * 홈 화면에 있던 "우리 아이 무럭무럭!" 배너를 없애고 그 자리에 넣는 간소화 캘린더.
 * 오늘이 포함된 주(월~일)를 한 줄로 보여주고, 이전/다음 주로 이동할 수 있다.
 *
 * v0.0.46: "독립된 미니 캘린더"가 아니라 "전체 캘린더의 한 주치 슬라이스"가 되도록 변경.
 * 자체 기준일(S.homeWeekRef)을 따로 두지 않고 캘린더 탭과 완전히 같은 상태(S.calWeekRef)를
 * 공유한다 — 캘린더 탭에서 주간 뷰로 주를 이동하면 홈 위젯도 같은 주를 보여주고, 반대로
 * 홈 위젯에서 주를 이동해도 다음에 캘린더 탭(주간 뷰)을 열면 그 주가 그대로 이어진다.
 * 날짜를 클릭하면 캘린더 탭의 주간 뷰로 이동해 그 날짜를 선택한 상태로 보여준다.
 *
 * 렌더링 로직 자체(무거운 월간/주간 뷰의 드래그·타임블록 등)는 여전히 js/calendar.js의
 * 것을 그대로 갖다 쓰지 않고 이 파일에서 가볍게 새로 그린다 — AGENTS.md "공용 원본을
 * 특정 화면 하나 때문에 함부로 바꾸지 마" 원칙에 따름. 색상(themes)·날짜 선택 로직은
 * js/calendar.js의 것을 그대로 가져와 써서 두 화면이 항상 같은 결과를 내게 한다.
 */

import { S } from './state.js';
import { today } from './utils.js';
import { themes, selectDate } from './calendar.js';
import { getHoliday } from '../data/kr-holidays.js';

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

export function renderHomeWeek() {
  const grid  = document.getElementById('homeWeekGrid');
  const monEl = document.getElementById('homeWeekMonth');
  if (!grid) return;

  // v0.0.46: 캘린더 탭과 같은 기준일(S.calWeekRef)을 공유 — 아직 아무도 설정한 적 없으면 오늘 기준
  if (!S.calWeekRef) S.calWeekRef = today();
  const th  = themes[S.theme] || themes.rose;
  const mon = mondayOf(S.calWeekRef);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const td  = today();

  if (monEl) monEl.textContent = monthRangeLabel(mon, sun);

  let headHtml = '';
  let dateHtml = '';

  for (let i = 0; i < 7; i++) {
    const d  = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds  = fmtDate(d);
    const dow = d.getDay();
    // 헤더(요일 이름)는 기존 캘린더(js/calendar.js renderMonthView)와 동일하게
    // 토/일 열 위치만 고정으로 빨간색 — 날짜 숫자만 공휴일 여부까지 반영해 빨간색 처리
    const isWeekendCol = i === 5 || i === 6; // 월요일 시작이므로 5=토, 6=일
    const isRedNum = dow === 0 || dow === 6 || !!getHoliday(ds);
    const isToday  = ds === td;

    headHtml += `<div class="hw-head-cell${isWeekendCol ? ' hw-head-red' : ''}">${DOW_LABELS[i]}</div>`;
    dateHtml += `
      <div class="hw-date-cell" onclick="goToCalendarDay('${ds}')" title="캘린더에서 보기">
        <span class="hw-date-num${isToday ? ' hw-today' : ''}${isRedNum && !isToday ? ' hw-red' : ''}">${d.getDate()}</span>
      </div>`;
  }

  grid.innerHTML = `
    <div class="hw-head-row" style="background:${th.g}">${headHtml}</div>
    <div class="hw-date-row">${dateHtml}</div>`;
}

/** 이전/다음 주 이동 (delta: -1 | 1) — 캘린더 탭과 공유하는 S.calWeekRef를 직접 이동시킨다 */
export function moveHomeWeek(delta) {
  const mon = mondayOf(S.calWeekRef || today());
  mon.setDate(mon.getDate() + delta * 7);
  S.calWeekRef = fmtDate(mon);
  renderHomeWeek();
}

/**
 * 홈 위젯에서 날짜를 클릭하면 캘린더 탭으로 이동해 그 날짜가 보이는 주간 뷰를 연다.
 * S.calWeekRef는 이미 홈 위젯과 공유 중이므로 그대로 두고(재계산하는 setCalView()는
 * 일부러 쓰지 않음 — today/selDate 기준으로 다시 계산해버려서 미래/과거 주로 이동한
 * 상태에서 클릭하면 엉뚱하게 오늘이 있는 주로 되돌아가버림), 뷰 상태와 토글 버튼
 * UI만 "주간"으로 맞춰준다.
 */
function goToCalendarDay(ds) {
  S.calView = 'week';
  window.gp('calendar', document.querySelector(".np[data-page='calendar']"));
  document.querySelectorAll('.cvt').forEach(b => b.classList.remove('on'));
  const weekBtn = [...document.querySelectorAll('.cvt')].find(b => b.textContent.trim() === '주간');
  if (weekBtn) weekBtn.classList.add('on');
  selectDate(ds);
}

// 인라인 onclick에서 접근할 수 있도록 전역 노출 (js/ui.js gp()·calendar.js 패턴과 동일)
window.moveHomeWeek    = moveHomeWeek;
window.goToCalendarDay = goToCalendarDay;
