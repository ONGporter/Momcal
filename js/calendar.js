/**
 * js/calendar.js — Sprint 2 업데이트
 *
 * 추가 기능:
 * - 이벤트 클릭 → 수정 Modal (권장일·실제일·병원·메모·완료)
 * - 완료 시 ✅ 표시 (캘린더 필 + 데이 패널)
 * - PC 드래그앤드롭으로 일정 이동
 * - 모바일 길게 눌러 이동 (500ms long press)
 * - S.eventMods 에 수정 내용 저장 → Firebase 반영
 */

import { S, debounceSave } from './state.js';
import { today }           from './utils.js';
import { showModal, cm }   from './modal.js';
import { vaxSched }        from '../data/vaccines.js';
import { pregEvMap }       from '../data/pregnancy.js';
import { checkEvs, foodEvs } from '../data/milestones.js';

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

/* ══════════════════════════════════════
 *  이벤트 이동 (드래그 결과)
 * ══════════════════════════════════════ */
function moveEvent(idx, newDate) {
  const ev = _cachedEvs[idx];
  if (!ev) return;
  if (!S.eventMods) S.eventMods = {};
  const key = getEventKey(ev);

  if (ev.auto) {
    // 자동 이벤트 → eventMods 에 실제일 저장
    S.eventMods[key] = { ...(S.eventMods[key] || {}), actualDate: newDate };
  } else {
    // 커스텀 이벤트 → 직접 날짜 변경
    const ce = S.customEvs.find(e => e._id === ev._id);
    if (ce) ce.date = newDate;
  }
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();
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
  const hospital = mod.hospital || '';
  const memo     = mod.memo     || ev.note || '';
  const done     = !!mod.done;

  const typeLabel = {
    req: '★ 필수', rec: '✓ 추천', vax: '💉 접종', custom: '📌 내 일정',
  }[ev.type] || '';

  showModal(ev.title, `
    <div style="font-size:.72rem;font-weight:800;color:var(--txl);margin:-4px 0 14px">${typeLabel}</div>

    ${ev.auto ? `
      <div class="fg">
        <label>🗓 권장일</label>
        <input type="date" value="${recDate}" readonly
               style="background:#F8F4FA;color:var(--txl);cursor:default;border-color:#EEE0F0">
      </div>` : ''}

    <div class="fg">
      <label>📅 실제 일정</label>
      <input type="date" id="evModDate" value="${actDate}">
    </div>
    <div class="fg">
      <label>🏥 병원명</label>
      <input id="evModHospital" placeholder="예) 서울소아과" value="${hospital}">
    </div>
    <div class="fg">
      <label>📝 메모</label>
      <input id="evModMemo" placeholder="메모 (선택)" value="${memo}">
    </div>

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
        ✅ 완료로 표시
      </label>
    </div>

    <button class="btn bpk" onclick="saveEventMod()">💾 저장</button>
    ${!ev.auto ? `
      <button class="btn" style="margin-top:8px;background:#FFF5F5;color:#E53935;
                                  box-shadow:none;border:1px solid #FFCDD2"
              onclick="delCustomEv(${ev._id});cm()">🗑 삭제</button>` : ''}
  `);
}

/** 수정 내용 저장 */
export function saveEventMod() {
  const ev = _cachedEvs[_editingIdx];
  if (!ev) { cm(); return; }

  if (!S.eventMods) S.eventMods = {};
  const key       = getEventKey(ev);
  const actualDate = document.getElementById('evModDate')?.value    || ev.date;
  const hospital   = document.getElementById('evModHospital')?.value || '';
  const memo       = document.getElementById('evModMemo')?.value     || '';
  const done       = document.getElementById('evModDone')?.checked   || false;

  S.eventMods[key] = { actualDate, hospital, memo, done };

  // 커스텀 이벤트는 날짜도 직접 반영
  if (!ev.auto) {
    const ce = S.customEvs.find(e => e._id === ev._id);
    if (ce) ce.date = actualDate;
  }

  cm();
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();
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
 * ══════════════════════════════════════ */

export function onTouchStart(evt, idx) {
  _touchIdx   = idx;
  _touchTimer = setTimeout(() => {
    _mobileDragging = true;
    if (navigator.vibrate) navigator.vibrate(60);

    const touch = evt.touches[0];
    _ghostEl = document.createElement('div');
    _ghostEl.className   = 'drag-ghost';
    _ghostEl.textContent = '📌 ' + (_cachedEvs[idx]?.title?.slice(0, 10) || '이동 중');
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

export function calMove(d) {
  S.calM += d;
  if (S.calM > 11) { S.calM = 0; S.calY++; }
  else if (S.calM < 0) { S.calM = 11; S.calY--; }
  renderCal();
}

export function setCalView(v, btn) {
  S.calView = v;
  document.querySelectorAll('.cvt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
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
  document.getElementById('calTitle').textContent = `${S.calY}년 ${S.calM + 1}월`;
  S.calView === 'month' ? renderMonthView() : renderWeekView();
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
        ${days.map(d => `<div class="cal-head-cell">${d}</div>`).join('')}
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
 * 캘린더 셀 HTML
 * - 드래그 타겟 (data-date, ondragover, ondrop)
 * - 이벤트 필: 드래그 가능, 클릭 → 수정 Modal, ✅ 완료 표시
 */
function cellHTML(ds, d, other, evs, td, th) {
  const de          = evs.filter(e => e.date === ds);
  const stickersAll = S.dayStickers[ds] || [];
  const overflow    = Math.max(0, stickersAll.length - 3);
  const showCount   = overflow > 0 ? 3 : stickersAll.length;
  const isSel       = ds === S.selDate;

  const stickerHtml = stickersAll.length
    ? `<div class="sticker-row">
        ${stickersAll.slice(0, showCount).map(s => `<span class="sticker-on-cal">${s}</span>`).join('')}
        ${overflow > 0 ? `<span class="sticker-overflow">+${overflow}</span>` : ''}
       </div>`
    : '';

  const pillsHtml = de.slice(0, 2).map(e => {
    const icon = e.done ? '✅' : (e.type === 'req' ? '★' : e.type === 'rec' ? '✓' : e.type === 'vax' ? '💉' : '📌');
    const safTitle = e.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `
      <div class="ev-pill ep-${e.type}${e.done ? ' ev-done' : ''}"
           draggable="true"
           ondragstart="onDragStart(event,${e._idx})"
           ondragend="onDragEnd(event)"
           ontouchstart="onTouchStart(event,${e._idx})"
           ontouchmove="onTouchMove(event)"
           ontouchend="onTouchEnd(event)"
           onclick="event.stopPropagation();openEvModal(${e._idx})"
           title="${safTitle}">
        ${icon}${e.title.slice(0, 5)}
      </div>`;
  }).join('');

  return `
    <div class="cal-cell${other ? ' other-month' : ''}${ds === td ? ' today' : ''}${isSel ? ' selected' : ''}"
         onclick="selectDate('${ds}')"
         data-date="${ds}"
         ondragover="onDragOver(event)"
         ondragleave="onDragLeave(event)"
         ondrop="onDrop(event,'${ds}')"
         style="${isSel ? `background:${th.cell};border:1.5px solid var(--pk)` : ''}">
      <div class="day-num" style="${ds === td ? `background:${th.today};color:#fff;border-radius:50%` : ''}">${d}</div>
      ${pillsHtml}
      ${de.length > 2
        ? `<div style="font-size:.52rem;color:var(--txl);text-align:center">+${de.length - 2}</div>`
        : ''}
      ${stickerHtml}
    </div>`;
}

/* ── 주간 뷰 ── */
function renderWeekView() {
  const th   = themes[S.theme];
  const evs  = getAllEvs();
  const curr = new Date(S.calY, S.calM, 1);
  const weekStart = new Date(curr);
  weekStart.setDate(curr.getDate() - curr.getDay());
  const days     = ['일', '월', '화', '수', '목', '금', '토'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const td = today();

  let html = `
    <div class="cal-wrap">
      <div class="cal-head-row" style="background:${th.g};grid-template-columns:44px repeat(7,1fr)">
        <div class="cal-head-cell" style="font-size:.6rem">시간</div>
        ${weekDays.map((d, i) =>
          `<div class="cal-head-cell">${days[i]}<br><span style="font-size:.84rem;font-weight:900">${d.getDate()}</span></div>`
        ).join('')}
      </div>
      <div style="display:grid;grid-template-columns:44px repeat(7,1fr)">`;

  [0, 6, 8, 10, 12, 14, 16, 18, 20, 22].forEach(h => {
    html += `<div style="font-size:.62rem;color:var(--txl);font-weight:700;padding:8px 4px;text-align:right;border-bottom:1px solid #F5EEF8">${h}시</div>`;
    weekDays.forEach(d => {
      const ds   = d.toISOString().split('T')[0];
      const de   = evs.filter(e => e.date === ds);
      const isTd = ds === td;
      html += `
        <div onclick="selectDate('${ds}')"
             data-date="${ds}"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDrop(event,'${ds}')"
             style="border-left:1px solid #F5EEF8;border-bottom:1px solid #F5EEF8;
                    padding:3px;cursor:pointer;background:${isTd ? th.cell : 'var(--wh)'};transition:background .14s"
             onmouseover="this.style.background='var(--pkl)'"
             onmouseout="this.style.background='${isTd ? th.cell : 'var(--wh)'}'">
          ${de.slice(0, 1).map(e => {
            const icon = e.done ? '✅' : (e.type === 'req' ? '★' : e.type === 'rec' ? '✓' : e.type === 'vax' ? '💉' : '📌');
            return `<div class="ev-pill ep-${e.type}${e.done ? ' ev-done' : ''}" style="font-size:.53rem"
                         onclick="event.stopPropagation();openEvModal(${e._idx})">${icon}${e.title.slice(0, 5)}</div>`;
          }).join('')}
          ${(S.dayStickers[ds] || []).slice(0, 1).map(s => `<span style="font-size:.78rem">${s}</span>`).join('')}
        </div>`;
    });
  });

  html += '</div></div>';
  document.getElementById('calView').innerHTML = html;
}

/* ══════════════════════════════════════
 *  날짜 패널 (선택된 날 이벤트 목록)
 * ══════════════════════════════════════ */
export function showDayPanel(ds) {
  const allEvs   = getAllEvs();
  const evs      = allEvs.filter(e => e.date === ds);
  const stickers = S.dayStickers[ds] || [];
  const panel    = document.getElementById('dayPanel');
  const dow      = ['일', '월', '화', '수', '목', '금', '토'][new Date(ds).getDay()];

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="day-panel">
      <div class="dp-date" style="color:var(--pkd)">
        📅 ${ds} <span style="font-size:.74rem;color:var(--txl);font-weight:500">${dow}요일</span>
      </div>

      ${stickers.length
        ? `<div style="margin-bottom:14px">
             <div style="font-size:.71rem;font-weight:800;color:var(--txl);margin-bottom:8px">🎀 붙인 스티커 (클릭하면 삭제)</div>
             <div style="display:flex;gap:6px;flex-wrap:wrap">
               ${stickers.map((s, i) =>
                 `<div onclick="removeSticker('${ds}',${i})"
                       style="font-size:1.45rem;cursor:pointer;padding:5px 7px;border-radius:10px;
                              background:var(--pkl);border:1.5px solid var(--pk)">${s}</div>`
               ).join('')}
             </div>
           </div>`
        : ''}

      ${evs.length
        ? evs.map(e => {
            const bg  = e.type === 'req' ? '#FFF0F5' : e.type === 'rec' ? '#E0F2F1' : e.type === 'vax' ? '#EDE7F6' : '#E3F2FD';
            const bc  = e.type === 'req' ? '#F06292' : e.type === 'rec' ? '#4DB6AC' : e.type === 'vax' ? '#9575CD' : '#64B5F6';
            const lbl = e.type === 'req' ? '★필수'  : e.type === 'rec' ? '추천'    : e.type === 'vax' ? '접종'    : '내일정';
            return `
              <div class="dp-ev${e.done ? ' dp-done' : ''}" style="background:${bg}">
                <div class="dp-ev-main">
                  <div class="dp-ev-title">
                    ${e.title}
                    ${e.done ? '<span style="color:var(--mn);margin-left:5px">✅</span>' : ''}
                  </div>
                  ${e.hospital ? `<div class="dp-ev-note">🏥 ${e.hospital}</div>` : ''}
                  ${e.note     ? `<div class="dp-ev-note">📝 ${e.note}</div>`     : ''}
                  ${e.recDate && e.recDate !== e.date
                    ? `<div class="dp-ev-note" style="color:var(--pu)">🗓 권장일: ${e.recDate}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
                  <span class="dp-ev-badge" style="background:${bc}">${lbl}</span>
                  <button onclick="openEvModal(${e._idx})"
                          style="background:none;border:1px solid #EEE0F0;border-radius:8px;
                                 padding:3px 8px;font-size:.65rem;font-weight:800;
                                 color:var(--txl);cursor:pointer;font-family:inherit">✏️ 수정</button>
                </div>
              </div>`;
          }).join('')
        : '<p style="color:var(--txl);font-size:.82rem;text-align:center;padding:14px">이 날은 일정이 없어요 🌸<br><span style="font-size:.74rem">아래에서 일정이나 스티커를 추가해보세요!</span></p>'}
    </div>`;
}

/* ══════════════════════════════════════
 *  커스텀 일정 추가 / 삭제
 * ══════════════════════════════════════ */
export function addCustomEv() {
  const date  = document.getElementById('evDate').value;
  const title = document.getElementById('evTitle').value.trim();
  const note  = document.getElementById('evNote').value.trim();
  const time  = document.getElementById('evTime').value;
  if (!date || !title) { alert('날짜와 제목을 입력해주세요'); return; }

  S.customEvs.push({
    date,
    title: time ? `${time} ${title}` : title,
    note,
    type: S.evType,
    auto: false,
    _id:  Date.now(),
  });
  document.getElementById('evTitle').value = '';
  document.getElementById('evNote').value  = '';
  document.getElementById('evTime').value  = '';
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
  { label: '🌸 꽃·자연', items: ['🌸','🌼','🌺','🌻','🍀','🌿','🌈','⭐','🌙','☀️','🌊','🍃','🌷','🪷','🌱','🦋'] },
  { label: '👶 아기',    items: ['👶','🍼','🧸','🎀','🍭','🎠','🐣','🐥','🐰','🐨','🦄','🐸','🐮','🐷','🐻','🐼'] },
  { label: '💕 하트',   items: ['💕','💖','💗','💝','❤️','🧡','💛','💚','💙','💜','🩷','🩵','🤍','💞','💓','💘'] },
  { label: '🎉 기념',   items: ['🎉','🎊','🎂','🎁','🏆','🥇','✨','🎈','🎀','🌟','🪄','🎗','🥳','🎺','🎵','🎶'] },
  { label: '🥣 이유식', items: ['🍚','🌾','🥩','🐔','🐟','🥕','🥦','🍠','🥔','🌽','🫛','🧀','🥚','🍳','🫐','🍎','🍌','🍓','🍇','🥑','🥛','🧆','🍲','🥣','🍜','🥗','🫘','🧅','🧄','🫚'] },
  { label: '💊 건강',   items: ['💊','💉','🩺','🏥','🩹','💪','🩻','🔬','🧬','🌡️','🩸','⚕️','🏋️','🧘','🚑','🫀'] },
];

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
  if (!S.selDate) { alert('먼저 날짜를 클릭해서 선택해주세요! 📅'); return; }
  if (!S.dayStickers[S.selDate]) S.dayStickers[S.selDate] = [];
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
  } else {
    const birth = new Date(child.birth);

    // 예방접종
    vaxSched.forEach(v => {
      const d = new Date(birth);
      d.setDate(d.getDate() + v.m * 30.44);
      const ds = d.toISOString().split('T')[0];
      evs.push({ date: ds, _origDate: ds, title: `💉 ${v.items.join(', ')}`, type: 'vax', auto: true });
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

    // 이유식
    foodEvs.forEach(ev => {
      const d = new Date(birth);
      d.setDate(d.getDate() + ev.m * 30.44 + ev.day);
      const ds = d.toISOString().split('T')[0];
      evs.push({ date: ds, _origDate: ds, title: ev.t, type: ev.r ? 'req' : 'rec', auto: true });
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
window.onDragStart         = onDragStart;
window.onDragEnd           = onDragEnd;
window.onDragOver          = onDragOver;
window.onDragLeave         = onDragLeave;
window.onDrop              = onDrop;
window.onTouchStart        = onTouchStart;
window.onTouchMove         = onTouchMove;
window.onTouchEnd          = onTouchEnd;
