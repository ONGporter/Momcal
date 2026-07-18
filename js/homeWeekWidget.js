/**
 * js/homeWeekWidget.js — v0.0.45 신규, v0.0.46/v0.0.47/v0.0.48 개편
 *
 * 홈 화면에 있던 "우리 아이 무럭무럭!" 배너를 없애고 그 자리에 넣는 간소화 캘린더.
 * 오늘(또는 선택된 날짜)이 포함된 주(일~토)를 한 줄로 보여주고, 이전/다음 주로 이동할 수 있다.
 * v0.0.48: 요일 시작을 월요일 → 일요일로 변경 — 캘린더 탭 월간 뷰(js/calendar.js
 * renderMonthView, `['일','월','화','수','목','금','토']` + `new Date(y,m,1).getDay()`
 * 기준 일요일 시작 그리드)와 요일 순서를 완전히 맞춤.
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
import { themes, getAllEvs, cellHTML, selectDateForViewing } from './calendar.js';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 주어진 날짜(YYYY-MM-DD)가 속한 주의 일요일 Date 객체를 반환 (v0.0.48: 캘린더 탭과 동일하게 일요일 시작) */
function sundayOf(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay(); // 0=일 ~ 6=토
  d.setDate(d.getDate() - dow);
  return d;
}

/** 주가 걸친 월을 "7월" 또는 "7월 - 8월"(연도가 겹치면 연도도 함께) 형태로 표시 */
function monthRangeLabel(start, end) {
  const y1 = start.getFullYear(), m1 = start.getMonth() + 1;
  const y2 = end.getFullYear(), m2 = end.getMonth() + 1;
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

  const th    = themes.rose; // v0.4.0: 캘린더 색상 테마 선택 기능 삭제 — 항상 rose 고정
  const start = sundayOf(focusDate());
  const end   = new Date(start); end.setDate(start.getDate() + 6);
  const td    = today();
  const evs   = getAllEvs();

  if (monEl) monEl.textContent = monthRangeLabel(start, end);

  let headHtml = '';
  let bodyHtml = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = fmtDate(d);
    // 헤더(요일 이름)는 기존 캘린더(js/calendar.js renderMonthView)와 동일하게 일/토 열만 고정 빨간색
    const isWeekendCol = i === 0 || i === 6; // v0.0.48: 일요일 시작이므로 0=일, 6=토
    headHtml += `<div class="cal-head-cell${isWeekendCol ? ' cal-head-red' : ''}">${DOW_LABELS[i]}</div>`;
    // 캘린더 탭과 완전히 같은 셀 렌더러 재사용 — 일정·스티커·완료표시·공휴일 표시가 그대로 나옴
    bodyHtml += cellHTML(ds, d.getDate(), false, evs, td, th);
  }

  grid.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-head-row" style="background:${th.g}">${headHtml}</div>
      <div class="cal-body">${bodyHtml}</div>
    </div>`;

  // v0.4.4: [버그 수정] "홈 화면에서 달력 한번만 눌러도 바로 일정 추가 팝업이 뜬다"는 제보 —
  // cellHTML이 각 셀에 심어둔 자체 onclick="selectDate(ds)"가 버블링 단계에서 이 컨테이너의
  // onclick보다 먼저 실행돼서였음(v0.4.0부터 selectDate()가 "이미 선택된 날짜 재클릭 시
  // 팝업" 로직을 갖게 됐는데, S.selDate가 마침 그 날짜였다면 첫 클릭에도 셀 자체 핸들러가
  // 먼저 팝업을 열어버림). 캡처 단계 리스너로 바꿔서 셀 자체 핸들러보다 먼저 가로채고
  // stopPropagation()으로 아예 실행되지 않게 막음 — 매번 innerHTML을 새로 그리므로(위) 이
  // .cal-body는 항상 새 엘리먼트라 리스너가 중복으로 쌓일 걱정은 없음
  grid.querySelector('.cal-body').addEventListener('click', (evt) => {
    evt.stopPropagation();
    onHomeWeekCellClick(evt);
  }, true);
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
 * cellHTML이 이미 각 셀에 data-date·자체 onclick(selectDate)을 심어주므로, 클릭된 셀을
 * event delegation으로 찾아 캘린더 탭 이동만 담당한다 — 단, 셀 자체의 onclick(selectDate)이
 * 그대로 실행되면 안 되므로(v0.4.4 버그 수정 참고) renderHomeWeek()에서 캡처 단계 +
 * stopPropagation()으로 이 함수만 실행되도록 걸어둠.
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
  // v0.4.4: [버그 수정] selectDate()는 "이미 선택된 날짜 재클릭 시 팝업" 로직이 있어서,
  // 홈 위젯에서 넘어올 때 그 날짜가 우연히 이미 S.selDate였으면 첫 클릭에 팝업이 떠버리는
  // 문제가 있었음 — 여기서는 항상 "그냥 보여주기"만 해야 하므로 selectDateForViewing() 사용
  selectDateForViewing(ds); // 선택 상태·세부일정 패널까지 확실히 맞춤(멱등적이라 다시 호출해도 안전)
}

// 인라인 onclick에서 접근할 수 있도록 전역 노출 (js/ui.js gp()·calendar.js 패턴과 동일)
// v0.4.4: onHomeWeekCellClick은 이제 addEventListener(capture)로만 붙으므로 window 노출 불필요
window.moveHomeWeek        = moveHomeWeek;
