/**
 * js/homeWeekWidget.js — v0.0.45 신규
 *
 * 홈 화면에 있던 "우리 아이 무럭무럭!" 배너를 없애고 그 자리에 넣는 간소화 캘린더.
 * 오늘이 포함된 주(월~일)를 한 줄로 보여주고, 이전/다음 주로 이동할 수 있다.
 *
 * 의도적으로 js/calendar.js(전체 캘린더)의 렌더링 로직을 재사용하지 않고 완전히 분리된
 * 자체 상태(S.homeWeekRef)로 동작한다 — AGENTS.md "공용 원본을 특정 화면 하나 때문에
 * 함부로 바꾸지 마" 원칙에 따라, 무거운 월간/주간 뷰(드래그·타임블록 등)를 홈 위젯 때문에
 * 건드리지 않기 위함. 색상·헤더 스타일만 js/calendar.js의 themes를 그대로 가져와 앱
 * 전체와 톤을 맞춘다.
 */

import { S } from './state.js';
import { today } from './utils.js';
import { themes } from './calendar.js';
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

export function renderHomeWeek() {
  const grid = document.getElementById('homeWeekGrid');
  if (!grid) return;

  if (!S.homeWeekRef) S.homeWeekRef = today();
  const th  = themes[S.theme] || themes.rose;
  const mon = mondayOf(S.homeWeekRef);
  const td  = today();

  let headHtml = '';
  let dateHtml = '';

  for (let i = 0; i < 7; i++) {
    const d  = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds  = fmtDate(d);
    const dow = d.getDay();
    // v0.0.45: 헤더(요일 이름)는 기존 캘린더(js/calendar.js renderMonthView)와 동일하게
    // 토/일 열 위치만 고정으로 빨간색 — 날짜 숫자만 공휴일 여부까지 반영해 빨간색 처리
    const isWeekendCol = i === 5 || i === 6; // 월요일 시작이므로 5=토, 6=일
    const isRedNum = dow === 0 || dow === 6 || !!getHoliday(ds);
    const isToday  = ds === td;

    headHtml += `<div class="hw-head-cell${isWeekendCol ? ' hw-head-red' : ''}">${DOW_LABELS[i]}</div>`;
    dateHtml += `
      <div class="hw-date-cell">
        <span class="hw-date-num${isToday ? ' hw-today' : ''}${isRedNum && !isToday ? ' hw-red' : ''}">${d.getDate()}</span>
      </div>`;
  }

  grid.innerHTML = `
    <div class="hw-head-row" style="background:${th.g}">${headHtml}</div>
    <div class="hw-date-row">${dateHtml}</div>`;
}

/** 이전/다음 주 이동 (delta: -1 | 1) */
export function moveHomeWeek(delta) {
  const mon = mondayOf(S.homeWeekRef || today());
  mon.setDate(mon.getDate() + delta * 7);
  S.homeWeekRef = fmtDate(mon);
  renderHomeWeek();
}

// 인라인 onclick에서 접근할 수 있도록 전역 노출 (js/ui.js gp()·calendar.js 패턴과 동일)
window.moveHomeWeek = moveHomeWeek;
