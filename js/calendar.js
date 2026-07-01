/**
 * js/calendar.js
 * 캘린더 렌더링, 일정 생성(자동/수동), 스티커 기능
 */

import { S, debounceSave } from './state.js';
import { today }           from './utils.js';
import { vaxSched }        from '../data/vaccines.js';
import { pregEvMap }       from '../data/pregnancy.js';
import { checkEvs, foodEvs } from '../data/milestones.js';

/* ── 테마 정의 ── */
export const themes = {
  rose:     { g: 'linear-gradient(135deg,#F48FB1,#CE93D8)', cell: '#FFF5FA', today: '#F06292' },
  mint:     { g: 'linear-gradient(135deg,#80DEEA,#4DB6AC)', cell: '#F0FAF8', today: '#4DB6AC' },
  sunny:    { g: 'linear-gradient(135deg,#FFD54F,#FF8A65)', cell: '#FFFDE7', today: '#FF8A65' },
  lavender: { g: 'linear-gradient(135deg,#B39DDB,#80CBC4)', cell: '#F3EFF9', today: '#9575CD' },
  peach:    { g: 'linear-gradient(135deg,#FFAB91,#F48FB1)', cell: '#FFF3EE', today: '#FF8A65' },
};

/* ── 테마 변경 ── */
export function setTheme(t, btn) {
  S.theme = t;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderCal();
  debounceSave();
}

/* ── 월 이동 ── */
export function calMove(d) {
  S.calM += d;
  if (S.calM > 11) { S.calM = 0; S.calY++; }
  else if (S.calM < 0) { S.calM = 11; S.calY--; }
  renderCal();
}

/* ── 뷰 전환 (월간/주간) ── */
export function setCalView(v, btn) {
  S.calView = v;
  document.querySelectorAll('.cvt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderCal();
}

/* ── 날짜 선택 ── */
export function selectDate(ds) {
  S.selDate = ds;
  document.getElementById('evDate').value = ds;
  renderCal();
  showDayPanel(ds);
}

/* ── 일정 종류 선택 ── */
export function setEvType(t, btn) {
  S.evType = t;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

/* ── 캘린더 메인 렌더 ── */
export function renderCal() {
  // 아이 선택 버튼 렌더
  if (S.children.length) {
    document.getElementById('calChildSel').innerHTML = S.children.map((c, i) =>
      `<button onclick="S.selC=${i};renderCal()"
        style="padding:5px 11px;border-radius:40px;border:1.5px solid ${i == S.selC ? 'var(--pk)' : '#EEE0F0'};
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
  const first = new Date(y, m, 1).getDay();
  const last  = new Date(y, m + 1, 0).getDate();
  const td    = today();
  const days  = ['일', '월', '화', '수', '목', '금', '토'];
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
    const ds = dStr(y, m - 1, prevLast - first + i + 1);
    html += cellHTML(ds, prevLast - first + i + 1, true, evs, td, th);
  }
  for (let d = 1; d <= last; d++) {
    const ds = dStr(y, m, d);
    html += cellHTML(ds, d, false, evs, td, th);
  }
  const rem = (7 - (first + last) % 7) % 7;
  for (let d = 1; d <= rem; d++) {
    const ds = dStr(y, m + 1, d);
    html += cellHTML(ds, d, true, evs, td, th);
  }

  html += '</div></div>';
  document.getElementById('calView').innerHTML = html;
  if (S.selDate) showDayPanel(S.selDate);
}

/**
 * 캘린더 셀 HTML 생성
 * Bug #7 fix: 스티커를 최대 4개까지 행으로 표시, 초과 시 +N 표시
 */
function cellHTML(ds, d, other, evs, td, th) {
  const de          = evs.filter(e => e.date === ds);
  const stickersAll = S.dayStickers[ds] || [];
  const maxShow     = 4;
  const overflow    = Math.max(0, stickersAll.length - (maxShow - 1));
  const showCount   = overflow > 0 ? maxShow - 1 : stickersAll.length;
  const isSel       = ds === S.selDate;

  const stickerHtml = stickersAll.length
    ? `<div class="sticker-row">
        ${stickersAll.slice(0, showCount).map(s => `<span class="sticker-on-cal">${s}</span>`).join('')}
        ${overflow > 0 ? `<span class="sticker-overflow">+${overflow}</span>` : ''}
       </div>`
    : '';

  return `
    <div class="cal-cell${other ? ' other-month' : ''}${ds === td ? ' today' : ''}${isSel ? ' selected' : ''}"
         onclick="selectDate('${ds}')"
         style="${isSel ? `background:${th.cell};border:1.5px solid var(--pk)` : ''}">
      <div class="day-num" style="${ds === td ? `background:${th.today};color:#fff;border-radius:50%` : ''}">${d}</div>
      ${de.slice(0, 2).map(e =>
        `<div class="ev-pill ep-${e.type}">
          ${e.type === 'req' ? '★' : e.type === 'rec' ? '✓' : e.type === 'vax' ? '💉' : '📌'}${e.title.slice(0, 5)}
         </div>`
      ).join('')}
      ${de.length > 2 ? `<div style="font-size:.52rem;color:var(--txl);text-align:center">+${de.length - 2}</div>` : ''}
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

  [0, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22].forEach(h => {
    html += `<div style="font-size:.62rem;color:var(--txl);font-weight:700;padding:8px 4px;text-align:right;border-bottom:1px solid #F5EEF8">${h}시</div>`;
    weekDays.forEach(d => {
      const ds   = d.toISOString().split('T')[0];
      const de   = evs.filter(e => e.date === ds);
      const isTd = ds === td;
      html += `
        <div onclick="selectDate('${ds}')"
             style="border-left:1px solid #F5EEF8;border-bottom:1px solid #F5EEF8;padding:3px;cursor:pointer;
                    background:${isTd ? th.cell : 'var(--wh)'};transition:background .14s"
             onmouseover="this.style.background='var(--pkl)'"
             onmouseout="this.style.background='${isTd ? th.cell : 'var(--wh)'}'">
          ${de.slice(0, 1).map(e =>
            `<div class="ev-pill ep-${e.type}" style="font-size:.53rem">${e.title.slice(0, 5)}</div>`
          ).join('')}
          ${(S.dayStickers[ds] || []).slice(0, 1).map(s => `<span style="font-size:.78rem">${s}</span>`).join('')}
        </div>`;
    });
  });

  html += '</div></div>';
  document.getElementById('calView').innerHTML = html;
}

/* ── 날짜 패널 (선택된 날 이벤트 목록) ── */
export function showDayPanel(ds) {
  const evs      = getAllEvs().filter(e => e.date === ds);
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
                              background:var(--pkl);border:1.5px solid var(--pk);transition:all .2s"
                       title="클릭하면 삭제">${s}</div>`
               ).join('')}
             </div>
           </div>`
        : ''}
      ${evs.length
        ? evs.map(e => {
            const bg  = e.type === 'req' ? '#FFF0F5' : e.type === 'rec' ? '#E0F2F1' : e.type === 'vax' ? '#EDE7F6' : '#E3F2FD';
            const bc  = e.type === 'req' ? '#F06292' : e.type === 'rec' ? '#4DB6AC' : e.type === 'vax' ? '#9575CD' : '#64B5F6';
            const lbl = e.type === 'req' ? '★필수' : e.type === 'rec' ? '추천' : e.type === 'vax' ? '접종' : '내일정';
            return `
              <div class="dp-ev" style="background:${bg}">
                <div class="dp-ev-main">
                  <div class="dp-ev-title">${e.title}</div>
                  ${e.note ? `<div class="dp-ev-note">${e.note}</div>` : ''}
                </div>
                <span class="dp-ev-badge" style="background:${bc}">${lbl}</span>
                ${!e.auto
                  ? `<button onclick="delCustomEv(${e._id})"
                             style="background:none;border:none;cursor:pointer;color:var(--txl);margin-left:8px;font-size:.83rem">🗑</button>`
                  : ''}
              </div>`;
          }).join('')
        : '<p style="color:var(--txl);font-size:.82rem;text-align:center;padding:14px">이 날은 일정이 없어요 🌸<br><span style="font-size:.74rem">아래에서 일정이나 스티커를 추가해보세요!</span></p>'}
    </div>`;
}

/* ── 일정 직접 추가 ── */
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

/* ── 일정 삭제 ── */
export function delCustomEv(id) {
  S.customEvs = S.customEvs.filter(e => e._id !== id);
  renderCal();
  if (S.selDate) showDayPanel(S.selDate);
  debounceSave();
}

/* ── 스티커 카테고리 목록 ── */
export const stickerCats = [
  { label: '🌸 꽃·자연', items: ['🌸','🌼','🌺','🌻','🍀','🌿','🌈','⭐','🌙','☀️','🌊','🍃','🌷','🪷','🌱','🦋'] },
  { label: '👶 아기',    items: ['👶','🍼','🧸','🎀','🍭','🎠','🐣','🐥','🐰','🐨','🦄','🐸','🐮','🐷','🐻','🐼'] },
  { label: '💕 하트',   items: ['💕','💖','💗','💝','❤️','🧡','💛','💚','💙','💜','🩷','🩵','🤍','💞','💓','💘'] },
  { label: '🎉 기념',   items: ['🎉','🎊','🎂','🎁','🏆','🥇','✨','🎈','🎀','🌟','🪄','🎗','🥳','🎺','🎵','🎶'] },
  { label: '🥣 이유식', items: ['🍚','🌾','🥩','🐔','🐟','🥕','🥦','🍠','🥔','🌽','🫛','🧀','🥚','🍳','🫐','🍎','🍌','🍓','🍇','🥑','🥛','🧆','🍲','🥣','🍜','🥗','🫘','🧅','🧄','🫚'] },
  { label: '💊 건강',   items: ['💊','💉','🩺','🏥','🩹','💪','🩻','🔬','🧬','🌡️','🩸','⚕️','🏋️','🧘','🚑','🫀'] },
];

/* ── 스티커 피커 렌더 ── */
export function renderStickerPicker() {
  document.getElementById('spTabs').innerHTML = stickerCats.map((c, i) =>
    `<button class="sp-tab ${i === S.selSCat ? 'on' : ''}" onclick="selSCat(${i})">${c.label}</button>`
  ).join('');
  document.getElementById('spGrid').innerHTML = stickerCats[S.selSCat].items.map(s =>
    `<div class="sp-sticker" onclick="placeSticker('${s}')">${s}</div>`
  ).join('');
}

export function selSCat(i) { S.selSCat = i; renderStickerPicker(); }

/* ── 스티커 부착 ── */
export function placeSticker(s) {
  if (!S.selDate) { alert('먼저 날짜를 클릭해서 선택해주세요! 📅'); return; }
  if (!S.dayStickers[S.selDate]) S.dayStickers[S.selDate] = [];
  S.dayStickers[S.selDate].push(s);
  renderCal();
  showDayPanel(S.selDate);
  debounceSave();
}

/* ── 스티커 삭제 ── */
export function removeSticker(date, idx) {
  S.dayStickers[date].splice(idx, 1);
  renderCal();
  showDayPanel(date);
  debounceSave();
}

/* ════════════════════════════════════
 *  자동 일정 생성 (예방접종, 이유식 등)
 * ════════════════════════════════════ */

/** 선택된 아이의 자동 일정 전체 반환 */
export function getAutoEvs(child) {
  if (!child) return [];
  const evs = [];

  if (child.stage === 'preg') {
    /* ── 임신 중 ── */
    const due = new Date(child.due || new Date());
    pregEvMap.forEach(({ w, items }) => {
      const d = new Date(due);
      d.setDate(d.getDate() - (40 - w) * 7);
      items.forEach(it => evs.push({
        date:  d.toISOString().split('T')[0],
        title: it.t,
        type:  it.r ? 'req' : 'rec',
        auto:  true,
      }));
    });
  } else {
    /* ── 육아 중 ── */
    const birth = new Date(child.birth);

    // 예방접종
    vaxSched.forEach(v => {
      const d = new Date(birth);
      d.setDate(d.getDate() + v.m * 30.44);
      evs.push({
        date:  d.toISOString().split('T')[0],
        title: `💉 ${v.items.join(', ')}`,
        type:  'vax',
        auto:  true,
      });
    });

    // 건강검진 & 발달 마일스톤
    checkEvs.forEach(({ m, items }) => {
      const d = new Date(birth);
      d.setDate(d.getDate() + m * 30.44);
      items.forEach(it => evs.push({
        date:  d.toISOString().split('T')[0],
        title: it.t,
        type:  it.r ? 'req' : 'rec',
        auto:  true,
      }));
    });

    // 이유식 단계별 일정
    foodEvs.forEach(ev => {
      const d = new Date(birth);
      d.setDate(d.getDate() + ev.m * 30.44 + ev.day);
      evs.push({
        date:  d.toISOString().split('T')[0],
        title: ev.t,
        type:  ev.r ? 'req' : 'rec',
        auto:  true,
      });
    });
  }
  return evs;
}

/** 선택된 아이의 자동 + 사용자 일정 합산 */
export function getAllEvs() {
  return [...getAutoEvs(S.children[S.selC]), ...S.customEvs];
}

// window 노출 (인라인 onclick 핸들러용)
window.renderCal        = renderCal;
window.calMove          = calMove;
window.setCalView       = setCalView;
window.setTheme         = setTheme;
window.selectDate       = selectDate;
window.showDayPanel     = showDayPanel;
window.setEvType        = setEvType;
window.addCustomEv      = addCustomEv;
window.delCustomEv      = delCustomEv;
window.renderStickerPicker = renderStickerPicker;
window.selSCat          = selSCat;
window.placeSticker     = placeSticker;
window.removeSticker    = removeSticker;
