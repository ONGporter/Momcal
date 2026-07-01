/**
 * js/checklist.js — Sprint 3 업데이트
 * 체크리스트 렌더링 및 항목 토글
 *
 * Bug #6 fix: tgCk에서 renderClMain을 먼저 호출하여 체크박스 시각 즉시 반영 후
 *             renderClSidebar로 퍼센트 업데이트
 *
 * Sprint 3 추가:
 * - 임신 주차별 세분화: 9개 주차 범위 카테고리 (4~7주 / 8~11주 / ... / 36~40주)
 * - 월령 자동 선택: 현재 임신 주차·아이 월령에 맞는 카테고리 자동 이동
 * - 컨텍스트 배너: 현재 주차·분기 또는 월령 표시
 * - 진행률 티어 시스템:
 *     100% = 필수 완료 → Perfect 🏅 (금색)
 *     120% = 필수 완료 + 선택 40% → Master 👑 (보라)
 *     150% = 필수 + 선택 모두 완료 → Legend 🌈 (레인보우)
 */

import { S, debounceSave } from './state.js';
import { clData }          from '../data/checklist-data.js';

/* ────────────────────────────────────
 *  점수 계산 유틸
 * ──────────────────────────────────── */

/**
 * 점수 계산 — 0~150%
 * base (필수 100%) + bonus (선택 50%)
 */
function calcScore(cat, checks) {
  const reqItems = cat.items.filter(it => it.r);
  const optItems = cat.items.filter(it => !it.r);
  const reqDone  = reqItems.filter(it => checks[it.id]).length;
  const optDone  = optItems.filter(it => checks[it.id]).length;
  const reqTotal = reqItems.length;
  const optTotal = optItems.length;

  const basePct  = reqTotal ? Math.round(reqDone / reqTotal * 100) : 100;
  const bonusPct = optTotal ? Math.round(optDone / optTotal * 50)  : 0;
  return {
    score:    basePct + bonusPct,   // 0~150
    basePct,                         // 0~100 (필수만)
    optDone,
    optTotal,
    reqDone,
    reqTotal,
  };
}

/** 점수 → 티어 */
function getTier(score) {
  if (score >= 150) return 'legend';
  if (score >= 120) return 'master';
  if (score >= 100) return 'perfect';
  return null;
}

/* ────────────────────────────────────
 *  체크리스트 진입점
 * ──────────────────────────────────── */
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

  // Sprint 3: 현재 주차/월령에 맞는 카테고리 자동 선택
  if (child) autoSelectCat(child);

  const tb = document.getElementById('clTabBar');
  tb.innerHTML = tabDefs.map((t, i) =>
    `<button class="cl-tab-btn ${(S.clTab || 0) === i ? 'on' : ''}"
             onclick="switchClTab(${i})">${t.label}</button>`
  ).join('');

  renderContextBanner(child);
  renderClSidebar();
}

/* ────────────────────────────────────
 *  탭 전환 (자동 카테고리 선택 포함)
 * ──────────────────────────────────── */
export function switchClTab(i) {
  S.clTab    = i;
  S.selClCat = 0;
  const child = S.children[S.selC];
  if (child) autoSelectCat(child);
  document.querySelectorAll('.cl-tab-btn').forEach((b, j) => b.classList.toggle('on', j === i));
  renderContextBanner(child);
  renderClSidebar();
}

/* ────────────────────────────────────
 *  현재 주차/월령 → 카테고리 자동 선택
 * ──────────────────────────────────── */
function autoSelectCat(child) {
  const cats = getCats();
  if (!cats.length) return;

  if (child.stage === 'preg' && S.clTab === 0 && child.week) {
    const week = parseInt(child.week) || 1;
    // 주차 → 카테고리 key 매핑
    const weekKey =
      week <= 7  ? 'preg_w04' :
      week <= 11 ? 'preg_w08' :
      week <= 15 ? 'preg_w12' :
      week <= 19 ? 'preg_w16' :
      week <= 23 ? 'preg_w20' :
      week <= 27 ? 'preg_w24' :
      week <= 31 ? 'preg_w28' :
      week <= 35 ? 'preg_w32' :
                   'preg_w36';
    const idx = cats.findIndex(c => c.key === weekKey);
    if (idx >= 0) S.selClCat = idx;

  } else if (child.stage === 'born' && S.clTab === 0 && child.birth) {
    const ageMonths = Math.floor(
      (Date.now() - new Date(child.birth).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );
    // 월령 → 카테고리 인덱스 매핑
    // m0=0개월, m2=2개월, m4=4개월, m6=6개월, m9=9개월, m12=12개월, m18=18개월, m24=24개월, m36=36개월
    const milestones = [0, 2, 4, 6, 9, 12, 18, 24, 36];
    let catIdx = 0;
    for (let i = 0; i < milestones.length; i++) {
      if (ageMonths >= milestones[i]) catIdx = i;
    }
    S.selClCat = Math.min(catIdx, cats.length - 1);
  }
}

/* ────────────────────────────────────
 *  현재 주차/월령 컨텍스트 배너
 * ──────────────────────────────────── */
function renderContextBanner(child) {
  const el = document.getElementById('clContextBanner');
  if (!el) return;
  if (!child) { el.innerHTML = ''; return; }

  if (child.stage === 'preg' && S.clTab === 0 && child.week) {
    const week = parseInt(child.week) || 0;
    if (!week) { el.innerHTML = ''; return; }
    const trimester = week <= 12 ? '1분기' : week <= 27 ? '2분기' : '3분기';
    const weeksLeft = Math.max(0, 40 - week);
    el.innerHTML = `
      🤰 현재 <strong>${week}주차</strong> · ${trimester}
      <span style="color:var(--txl);font-weight:700;margin-left:auto;font-size:.76rem">출산까지 약 ${weeksLeft}주</span>`;

  } else if (child.stage === 'born' && S.clTab === 0 && child.birth) {
    const ageMs     = Date.now() - new Date(child.birth).getTime();
    const ageMonths = Math.floor(ageMs / (30.44 * 24 * 60 * 60 * 1000));
    const ageWeeks  = Math.floor(ageMs  / (7 * 24 * 60 * 60 * 1000));
    const display   = ageMonths < 3 ? `${ageWeeks}주` : `${ageMonths}개월`;
    el.innerHTML = `
      👶 현재 <strong>${display}</strong>
      <span style="color:var(--txl);font-weight:700;margin-left:auto;font-size:.76rem">${child.name}이(가) 쑥쑥 크는 중 💕</span>`;

  } else {
    el.innerHTML = '';
  }
}

/* ────────────────────────────────────
 *  현재 탭의 카테고리 목록 반환
 * ──────────────────────────────────── */
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

/* ────────────────────────────────────
 *  사이드바 렌더
 * ──────────────────────────────────── */
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
    const key = `${child.id}_${cat.key}`;
    if (!S.checks[key]) S.checks[key] = {};

    const { score, basePct } = calcScore(cat, S.checks[key]);
    const tier = getTier(score);

    let pctHtml;
    if (tier === 'legend') {
      pctHtml = `<span class="cl-sb-pct cl-sb-legend">🌈</span>`;
    } else if (tier === 'master') {
      pctHtml = `<span class="cl-sb-pct cl-sb-master">👑 ${score}%</span>`;
    } else if (tier === 'perfect') {
      pctHtml = `<span class="cl-sb-pct cl-sb-perfect">🏅 100%</span>`;
    } else {
      pctHtml = `<span class="cl-sb-pct">${basePct}%</span>`;
    }

    return `<div class="cl-sb-item ${i === S.selClCat ? 'on' : ''}"
                 onclick="S.selClCat=${i};renderClMain()">
              <span>${cat.label}</span>
              ${pctHtml}
            </div>`;
  }).join('');

  renderClMain();
}

/* ────────────────────────────────────
 *  메인 영역 렌더
 * ──────────────────────────────────── */
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

  const key = `${child.id}_${cat.key}`;
  if (!S.checks[key]) S.checks[key] = {};

  const { score, basePct, optDone, optTotal, reqDone, reqTotal } = calcScore(cat, S.checks[key]);
  const tier = getTier(score);

  // ── 배지 & 상태 텍스트 ──
  let badgeHtml;
  if (tier === 'legend') {
    badgeHtml = `<div class="cl-badge cl-badge-legend">🌈 Legend — 모두 완료!</div>`;
  } else if (tier === 'master') {
    badgeHtml = `<div class="cl-badge cl-badge-master">👑 Master — ${score}% 달성</div>`;
  } else if (tier === 'perfect') {
    badgeHtml = `<div class="cl-badge cl-badge-perfect">🏅 Perfect — 필수 100%</div>`;
  } else {
    badgeHtml = `<span class="cl-status">필수 ${reqDone}/${reqTotal}${optDone > 0 ? ` · 선택 +${optDone}` : ''}</span>`;
  }

  // ── 진행률 바 색상 ──
  const barClass = tier === 'legend' ? 'rainbow' : tier === 'master' ? 'master' : tier === 'perfect' ? 'full' : '';
  const barWidth = Math.min(basePct, 100);

  document.getElementById('clMain').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <h3 style="font-size:.93rem;font-weight:900;color:var(--tx)">${cat.label}</h3>
      ${badgeHtml}
    </div>
    <div class="progress-bar">
      <div class="progress-fill${barClass ? ' ' + barClass : ''}" style="width:${barWidth}%"></div>
    </div>
    ${tier ? '' : (optDone > 0
      ? `<div style="font-size:.68rem;color:#5B4FCF;font-weight:700;margin:-10px 0 14px">🌟 선택 항목 ${optDone}개 완료 — Master까지 ${120 - score}%!</div>`
      : `<div style="font-size:.68rem;color:var(--txl);font-weight:700;margin:-10px 0 14px">필수 완료 시 🏅 Perfect 배지 획득!</div>`
    )}
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
 * 이후 renderClSidebar() → 사이드바 % 업데이트
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
window.switchClTab     = switchClTab;
