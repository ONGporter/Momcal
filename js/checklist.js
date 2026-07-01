/**
 * js/checklist.js
 * 체크리스트 렌더링 및 항목 토글
 *
 * Bug #6 fix: tgCk에서 renderClMain을 먼저 호출하여 체크박스 시각 즉시 반영 후
 *             renderClSidebar로 퍼센트 업데이트
 */

import { S, debounceSave } from './state.js';
import { clData }          from '../data/checklist-data.js';

/* ── 체크리스트 진입점 ── */
export function renderChecklist() {
  const csel = document.getElementById('clChildSel');
  csel.innerHTML = S.children.length
    ? S.children.map((c, i) =>
        `<option value="${i}" ${i == S.selC ? 'selected' : ''}>${c.avatar} ${c.name}</option>`
      ).join('')
    : '<option>아이를 등록해주세요</option>';

  const child   = S.children[S.selC];
  const tabDefs = child
    ? (child.stage === 'preg'
        ? [{ label: '🤰 임신 체크', key: 'preg' }, { label: '📦 출산 준비물', key: 'prep' }]
        : [{ label: '👶 육아 체크', key: 'born' }, { label: '🥣 이유식', key: 'food' }])
    : [];

  const tb = document.getElementById('clTabBar');
  tb.innerHTML = tabDefs.map((t, i) =>
    `<button class="cl-tab-btn ${(S.clTab || 0) === i ? 'on' : ''}"
             onclick="S.clTab=${i};S.selClCat=0;renderClSidebar()">${t.label}</button>`
  ).join('');

  renderClSidebar();
}

/* ── 현재 탭의 카테고리 목록 반환 ── */
export function getCats() {
  const child = S.children[S.selC];
  if (!child) return [];
  const tab = S.clTab || 0;
  if (child.stage === 'preg') {
    return tab === 0
      ? clData.preg.filter(c => c.key !== 'preg_prep')
      : clData.preg.filter(c => c.key === 'preg_prep');
  }
  return tab === 0 ? clData.born : clData.food;
}

/* ── 사이드바 렌더 ── */
export function renderClSidebar() {
  const child = S.children[S.selC];
  if (!child) {
    document.getElementById('clSidebar').innerHTML = '';
    document.getElementById('clMain').innerHTML =
      '<p style="color:var(--txl);text-align:center;padding:20px">👶 아이를 먼저 등록해주세요!</p>';
    return;
  }

  const cats = getCats();
  if (S.selClCat >= cats.length) S.selClCat = 0;

  document.getElementById('clSidebar').innerHTML = cats.map((cat, i) => {
    const key  = `${child.id}_${cat.key}`;
    if (!S.checks[key]) S.checks[key] = {};
    const done = cat.items.filter(it => S.checks[key][it.id]).length;
    const pct  = cat.items.length ? Math.round(done / cat.items.length * 100) : 0;
    return `<div class="cl-sb-item ${i === S.selClCat ? 'on' : ''}"
                 onclick="S.selClCat=${i};renderClMain()">
              <span>${cat.label}</span>
              <span class="cl-sb-pct">${pct}%</span>
            </div>`;
  }).join('');

  renderClMain();
}

/* ── 메인 영역 렌더 ── */
export function renderClMain() {
  const child = S.children[S.selC];
  if (!child) {
    document.getElementById('clMain').innerHTML =
      '<p style="color:var(--txl);text-align:center;padding:20px">👶 아이를 먼저 등록해주세요!</p>';
    return;
  }
  const cats = getCats();
  const cat  = cats[S.selClCat];
  if (!cat) { document.getElementById('clMain').innerHTML = ''; return; }

  const key  = `${child.id}_${cat.key}`;
  if (!S.checks[key]) S.checks[key] = {};
  const done = cat.items.filter(it => S.checks[key][it.id]).length;
  const pct  = cat.items.length ? Math.round(done / cat.items.length * 100) : 0;

  document.getElementById('clMain').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="font-size:.93rem;font-weight:900;color:var(--tx)">${cat.label}</h3>
      <span style="font-size:.76rem;font-weight:800;color:var(--mn);background:var(--mnl);padding:3px 9px;border-radius:10px">
        ${done}/${cat.items.length} 완료
      </span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    ${cat.items.map(it => `
      <div class="ci ${S.checks[key][it.id] ? 'done' : ''}" onclick="tgCk('${key}','${it.id}')">
        <div class="ci-box"></div>
        <div style="flex:1">
          <div class="ci-title">${it.t}
            ${it.r ? '<span class="badge-r">필수</span>' : '<span class="badge-o">선택</span>'}
          </div>
          ${it.d ? `<div class="ci-desc">${it.d}</div>` : ''}
        </div>
      </div>`).join('')}`;
}

/**
 * 체크 토글 (Bug #6 fix)
 * renderClMain() 먼저 → 체크박스 즉시 시각 반영
 * 이후 renderClSidebar() → 사이드바 퍼센트 업데이트
 */
export function tgCk(key, id) {
  if (!S.checks[key]) S.checks[key] = {};
  S.checks[key][id] = !S.checks[key][id];
  renderClMain();     // 즉시 시각 업데이트
  renderClSidebar();  // 사이드바 % 업데이트
  debounceSave();
}

// window 노출
window.renderChecklist = renderChecklist;
window.renderClSidebar = renderClSidebar;
window.renderClMain    = renderClMain;
window.tgCk            = tgCk;
