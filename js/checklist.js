/**
 * js/checklist.js — Sprint 7 버그 수정
 * 체크리스트 렌더링 및 항목 토글
 *
 * Sprint 7 버그 수정:
 * 1. 사이드바 카테고리 클릭 시 renderClSidebar()를 호출하도록 수정
 *    (기존엔 renderClMain()만 호출해 선택된 카테고리 하이라이트 색이 바뀌지 않았음 —
 *     체크리스트 항목을 체크해야만(renderClSidebar 트리거) 색이 바뀌는 것처럼 보였던 버그)
 * 2. 진행률 0~49% 구간을 회색으로 표시 (기존엔 항상 녹색)
 * 3. calcScore 공식 수정 — 필수 100% 달성 전에는 선택 항목이 점수에 전혀 반영되지 않도록 변경
 * 4. 선택 항목까지 모두 완료 시 최대 200%까지 오르도록 변경 (기존 150% → 200%)
 * 5. tgCk에서 renderClMain()을 두 번 호출하던 것을 renderClSidebar() 한 번으로 통합
 *    (배지 애니메이션이 두 번 재생되어 깜빡임이 2회로 보이던 버그 수정)
 *
 * Sprint 3 추가:
 * - 임신 주차별 세분화: 9개 주차 범위 카테고리 (4~7주 / 8~11주 / ... / 36~40주)
 * - 월령 자동 선택: 현재 임신 주차·아이 월령에 맞는 카테고리 자동 이동
 * - 컨텍스트 배너: 현재 주차·분기 또는 월령 표시
 * - 진행률 티어 시스템 (Sprint 7 기준):
 *     필수 미완료 = 회색 %, 배지 없음
 *     100% = 필수 완료(선택 0개) → Perfect (금색, verified 아이콘)
 *     100~199% = 필수 완료 + 선택 일부 → Master (보라, workspace_premium 아이콘)
 *     200% = 필수 + 선택 모두 완료 → Legend (레인보우, emoji_events 트로피 아이콘 — v0.0.22)
 */

import { S, debounceSave } from './state.js';
import { today, icon }     from './utils.js';
import { clData }          from '../data/checklist-data.js';
import { renderGovChecklistTab } from './govSupport.js';
import { syncChecklistToCalendar } from './checklistCalendarLink.js';
import { renderAdSlot } from './adSlot.js';
import { showModal, cm } from './modal.js';

/* ────────────────────────────────────
 *  점수 계산 유틸
 * ──────────────────────────────────── */

/**
 * 점수 계산 — 0~200%
 * 필수 항목을 100% 채우기 전에는 선택 항목이 점수에 전혀 반영되지 않는다.
 * 필수 100% 달성 후에만 선택 완료율(0~100%)이 그대로 보너스로 더해진다.
 *   예) 필수 4개·선택 2개 중 필수 3개+선택 1개 완료 → 75% (선택 무시)
 *       필수 4개 모두 완료 (선택 0개) → 100%
 *       필수 4개 모두 완료 + 선택 1개 → 150%
 *       필수 4개 모두 완료 + 선택 2개 모두 → 200%
 * 매번 현재 checks 상태로부터 처음부터 다시 계산하므로, 체크 순서나
 * 체크/해제 이력과 무관하게 항상 "지금 체크된 항목"만 기준으로 정확한 값이 나온다.
 *
 * v0.0.14: 세 번째 인자 key를 넘기면 사용자가 직접 추가한 항목(S.customClItems[key])도
 * 기존 항목과 완전히 똑같은 규칙으로 필수/선택 계산에 합산된다 (getCatItems() 참고).
 */
export function calcScore(cat, checks, key) {
  const items    = key ? getCatItems(cat, key) : cat.items;
  const reqItems = items.filter(it => it.r);
  const optItems = items.filter(it => !it.r);
  const reqDone  = reqItems.filter(it => checks[it.id]).length;
  const optDone  = optItems.filter(it => checks[it.id]).length;
  const reqTotal = reqItems.length;
  const optTotal = optItems.length;

  const basePct  = reqTotal ? Math.round(reqDone / reqTotal * 100) : 100;
  const bonusPct = basePct >= 100 && optTotal ? Math.round(optDone / optTotal * 100) : 0;

  return {
    score:    Math.min(200, basePct + bonusPct), // 0~200
    basePct,                                      // 0~100 (필수만)
    optDone,
    optTotal,
    reqDone,
    reqTotal,
  };
}

/** v0.0.14: 카테고리의 원래 항목 + 사용자가 직접 추가한 항목을 합친 배열 반환 */
export function getCatItems(cat, key) {
  const custom = (S.customClItems && S.customClItems[key]) || [];
  return custom.length ? [...cat.items, ...custom] : cat.items;
}

/** 점수 → 티어 (필수/선택 완료 개수 기준 — score 임계값이 아닌 실제 완료 여부로 판단) */
function getTier(reqDone, reqTotal, optDone, optTotal) {
  if (reqTotal > 0 && reqDone < reqTotal) return null; // 필수 미완료
  if (optTotal === 0 || optDone === 0)    return 'perfect'; // 필수만 100%
  if (optDone === optTotal)               return 'legend';  // 필수+선택 모두 완료
  return 'master';                                            // 필수 100% + 선택 일부
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
        ? [{ label: '<span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 임신 체크', key: 'preg' }, { label: '<span class="icon icon-sm" translate="no" aria-hidden="true">inventory_2</span> 출산 준비물', key: 'prep' }, { label: '<span class="icon icon-sm" translate="no" aria-hidden="true">account_balance</span> 정부지원', key: 'gov' }]
        : [{ label: '<span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 육아 체크', key: 'born' }, { label: '<span class="icon icon-sm" translate="no" aria-hidden="true">restaurant</span> 이유식', key: 'food' }, { label: '<span class="icon icon-sm" translate="no" aria-hidden="true">account_balance</span> 정부지원', key: 'gov' }])
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
  renderAdSlot('adSlotChecklist', 'checklist');
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
      (new Date(today()).getTime() - new Date(child.birth).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
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
 *  Sprint 4: 홈 대시보드용 — 오늘에 해당하는 카테고리 조회 (읽기 전용)
 *  autoSelectCat과 동일한 매핑 로직을 사용하지만 S.selClCat/S.clTab을
 *  변경하지 않아 체크리스트 페이지의 현재 선택 상태에 영향을 주지 않습니다.
 * ──────────────────────────────────── */
export function getTodayCategoryInfo(child) {
  if (!child) return null;

  const cats = child.stage === 'preg'
    ? clData.preg.filter(c => c.key !== 'preg_prep')
    : clData.born;
  if (!cats.length) return null;

  let idx = 0;
  if (child.stage === 'preg' && child.week) {
    const week = parseInt(child.week) || 1;
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
    const found = cats.findIndex(c => c.key === weekKey);
    if (found >= 0) idx = found;
  } else if (child.stage === 'born' && child.birth) {
    const ageMonths = Math.floor(
      (new Date(today()).getTime() - new Date(child.birth).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );
    const milestones = [0, 2, 4, 6, 9, 12, 18, 24, 36];
    for (let i = 0; i < milestones.length; i++) {
      if (ageMonths >= milestones[i]) idx = i;
    }
    idx = Math.min(idx, cats.length - 1);
  }

  const cat = cats[idx];
  const key = `${child.id}_${cat.key}`;
  const checks = S.checks[key] || {};
  const { reqDone, reqTotal, optDone, optTotal } = calcScore(cat, checks, key);

  // v0.0.9: 홈 대시보드 카드용 — 배지 티어 + 다음 추천 항목
  // (다른 대시보드 카드들처럼 강조색 서브 텍스트를 보여주기 위함)
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);
  const catItems = getCatItems(cat, key);
  let nextItem = null;
  if (tier === null) {
    // 필수 미완료 → 다음 미완료 필수 항목을 추천 (배지를 얻으려면 이것부터)
    nextItem = catItems.find(it => it.r && !checks[it.id]) || null;
  } else if (tier === 'perfect' || tier === 'master') {
    // 필수는 이미 완료 → 다음 미완료 선택 항목을 추천 (다음 티어로)
    nextItem = catItems.find(it => !it.r && !checks[it.id]) || null;
  }

  return {
    cat, reqDone, reqTotal, optDone, optTotal, tier, nextItem,
    doneTotal:  reqDone + optDone,
    itemsTotal: catItems.length,
  };
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
      <span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 현재 <strong>${week}주차</strong> · ${trimester}
      <span style="color:var(--txl);font-weight:700;margin-left:auto;font-size:.76rem">출산까지 약 ${weeksLeft}주</span>`;

  } else if (child.stage === 'born' && S.clTab === 0 && child.birth) {
    const ageMs     = new Date(today()).getTime() - new Date(child.birth).getTime();
    const ageMonths = Math.floor(ageMs / (30.44 * 24 * 60 * 60 * 1000));
    const ageWeeks  = Math.floor(ageMs  / (7 * 24 * 60 * 60 * 1000));
    const display   = ageMonths < 3 ? `${ageWeeks}주` : `${ageMonths}개월`;
    el.innerHTML = `
      <span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 현재 <strong>${display}</strong>
      <span style="color:var(--txl);font-weight:700;margin-left:auto;font-size:.76rem">${child.name}이(가) 쑥쑥 크는 중 <span class="icon icon-sm" translate="no" aria-hidden="true">eco</span></span>`;

  } else {
    el.innerHTML = '';
  }
}

/* 육아 체크 "아기→어린이→다 자란 아이" 성장 단계 아이콘을 아이 성별에 맞춰 바꾸기 위한 매핑
 * (v0.0.22) — Unicode엔 "아기 남아/여아"를 구분하는 전용 이모지가 없어서, 아기 단계도
 * 어린이와 같은 👦/👧로 통일함(성별 미정이면 중성 이모지로 이전 단계감을 그대로 유지) */
const GROWTH_STAGE_ICON = {
  m18: { m: '👦', f: '👧', u: '👶' },
  m24: { m: '👦', f: '👧', u: '🧒' },
  m36: { m: '👦', f: '👧', u: '🧑' },
};

/** clData.born 배열의 m18/m24/m36 라벨 앞 이모지를 아이 성별에 맞게 바꿔서 새 배열로 반환
 *  (원본 clData.born은 건드리지 않음 — guide 페이지 생성 등 다른 곳에서도 그대로 씀) */
function applyGrowthStageGender(cats, gender) {
  return cats.map(c => {
    const iconMap = GROWTH_STAGE_ICON[c.key];
    if (!iconMap) return c;
    const icon = iconMap[gender] || iconMap.u;
    return { ...c, label: c.label.replace(/^\S+/, icon) };
  });
}

/* ────────────────────────────────────
 *  현재 탭의 카테고리 목록 반환
 * ──────────────────────────────────── */
export function getCats() {
  const child = S.children[S.selC];
  if (!child) return [];
  const tab = S.clTab || 0;
  if (child.stage === 'preg') {
    if (tab === 0) return clData.preg.filter(c => c.key !== 'preg_prep');
    if (tab === 1) return clData.preg.filter(c => c.key === 'preg_prep');
    return []; // tab 2 = 🟢 정부지원 (getCats 대상 아님, renderGovChecklistTab 에서 별도 렌더링)
  }
  if (tab === 0) return applyGrowthStageGender(clData.born, child.gender);
  if (tab === 1) return clData.food;
  return []; // tab 2 = 🟢 정부지원
}

/**
 * 체크리스트 사이드바 하단 — 육아정보 검색 (Sprint 29)
 * 체크리스트 항목의 짧은 설명만으론 부족할 때, 육아정보 페이지(guide/)의
 * 자세한 설명을 검색해서 바로 찾아볼 수 있도록 새 탭으로 연결함
 * v0.0.23: govSupport.js도 이 함수를 그대로 가져다 씀 — 예전엔 govSupport.js가 마크업을
 * 따로 복사해서 좌우 여백(margin)이 달라 "정부지원 탭만 상자 안에 든 것처럼" 보였음
 */
export function guideSearchBoxHtml(placeholder = '예: 엽산, DTaP, 쌀미음') {
  return `
    <div style="margin-top:14px;padding:12px;background:var(--pkl);border-radius:14px">
      <div style="font-size:.68rem;font-weight:800;color:var(--pkd);margin-bottom:6px"><span class="icon icon-sm" translate="no" aria-hidden="true">menu_book</span> 육아정보 더 알아보기</div>
      <div style="display:flex;gap:6px">
        <input type="text" id="clGuideSearchInput" placeholder="${placeholder}"
               style="flex:1;min-width:0;padding:7px 10px;border:1.5px solid #F0D8E4;border-radius:9px;font-size:.74rem;font-family:inherit"
               onkeydown="if(event.key==='Enter')openGuideSearch()">
        <button onclick="openGuideSearch()"
                style="background:var(--pk);color:#fff;border:none;border-radius:9px;padding:0 12px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:inherit">검색</button>
      </div>
    </div>`;
}

/** 육아정보 허브 페이지에 검색어를 담아 새 탭으로 이동 */
function openGuideSearch() {
  const input = document.getElementById('clGuideSearchInput');
  const q = input ? input.value.trim() : '';
  if (!q) return;
  window.open('./guide/index.html?q=' + encodeURIComponent(q), '_blank');
}
window.openGuideSearch = openGuideSearch;

/* ────────────────────────────────────
 *  사이드바 렌더
 * ──────────────────────────────────── */
export function renderClSidebar() {
  const child = S.children[S.selC];
  if (!child) {
    document.getElementById('clSidebar').innerHTML = '';
    document.getElementById('clMain').innerHTML =
      '<p style="color:var(--txl);text-align:center;padding:20px"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 아이를 먼저 등록해주세요!</p>';
    return;
  }

  // Sprint 6: 정부지원 탭(항상 마지막, index 2)은 별도 모듈에서 렌더링
  if ((S.clTab || 0) === 2) {
    renderGovChecklistTab(child);
    return;
  }

  const cats = getCats();
  if (S.selClCat >= cats.length) S.selClCat = 0;

  document.getElementById('clSidebar').innerHTML = cats.map((cat, i) => {
    const key = `${child.id}_${cat.key}`;
    if (!S.checks[key]) S.checks[key] = {};

    const { score, basePct, reqDone, reqTotal, optDone, optTotal } = calcScore(cat, S.checks[key], key);
    const tier = getTier(reqDone, reqTotal, optDone, optTotal);

    let pctHtml;
    if (tier === 'legend') {
      pctHtml = `<span class="cl-sb-pct cl-sb-legend"><span class="icon icon-sm" translate="no" aria-hidden="true">emoji_events</span> 200%</span>`;
    } else if (tier === 'master') {
      pctHtml = `<span class="cl-sb-pct cl-sb-master"><span class="icon icon-sm" translate="no" aria-hidden="true">workspace_premium</span> ${score}%</span>`;
    } else if (tier === 'perfect') {
      pctHtml = `<span class="cl-sb-pct cl-sb-perfect"><span class="icon icon-sm" translate="no" aria-hidden="true">verified</span> 100%</span>`;
    } else {
      // Bug fix: 0~49% 구간은 회색으로 표시 (기존엔 항상 녹색이었음)
      pctHtml = `<span class="cl-sb-pct${basePct < 50 ? ' cl-sb-low' : ''}">${basePct}%</span>`;
    }

    return `<div class="cl-sb-item ${i === S.selClCat ? 'on' : ''}"
                 onclick="S.selClCat=${i};renderClSidebar()">
              <span>${cat.label}</span>
              ${pctHtml}
            </div>`;
  }).join('') + guideSearchBoxHtml();

  renderClMain();
}

/* ────────────────────────────────────
 *  메인 영역 렌더
 * ──────────────────────────────────── */
export function renderClMain() {
  const child = S.children[S.selC];
  if (!child) {
    document.getElementById('clMain').innerHTML =
      '<p style="color:var(--txl);text-align:center;padding:20px"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 아이를 먼저 등록해주세요!</p>';
    return;
  }
  const cats = getCats();
  const cat  = cats[S.selClCat];
  if (!cat) { document.getElementById('clMain').innerHTML = ''; return; }

  const key = `${child.id}_${cat.key}`;
  if (!S.checks[key]) S.checks[key] = {};

  const { score, basePct, optDone, optTotal, reqDone, reqTotal } = calcScore(cat, S.checks[key], key);
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);

  // ── 배지 & 상태 텍스트 ──
  let badgeHtml;
  if (tier === 'legend') {
    badgeHtml = `<div class="cl-badge cl-badge-legend"><span class="icon icon-sm" translate="no" aria-hidden="true">emoji_events</span> Legend — 200% 달성!</div>`;
  } else if (tier === 'master') {
    badgeHtml = `<div class="cl-badge cl-badge-master"><span class="icon icon-sm" translate="no" aria-hidden="true">workspace_premium</span> Master — ${score}% 달성</div>`;
  } else if (tier === 'perfect') {
    badgeHtml = `<div class="cl-badge cl-badge-perfect"><span class="icon icon-sm" translate="no" aria-hidden="true">verified</span> Perfect — 필수 100%</div>`;
  } else {
    badgeHtml = `<span class="cl-status${basePct < 50 ? ' cl-status-low' : ''}">필수 ${reqDone}/${reqTotal}</span>`;
  }

  // ── 진행률 바 색상 ──
  const barClass = tier === 'legend' ? 'rainbow' : tier === 'master' ? 'master' : tier === 'perfect' ? 'full' : '';
  const barWidth = Math.min(basePct, 100);

  document.getElementById('clMain').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <h3 style="font-size:.93rem;font-weight:900;color:var(--tx)">${cat.label}</h3>
      <div style="display:flex;align-items:center;gap:6px">
        ${badgeHtml}
        <button type="button" class="cl-share-btn" title="이미지로 저장·공유" onclick="shareChecklistImage()">
          <span class="icon icon-sm" translate="no" aria-hidden="true">share</span>
        </button>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill${barClass ? ' ' + barClass : ''}" style="width:${barWidth}%"></div>
    </div>
    ${tier === null
      ? `<div style="font-size:.68rem;color:var(--txl);font-weight:700;margin:-10px 0 14px">필수 항목을 먼저 모두 체크하면 선택 항목이 점수에 반영돼요 (필수 완료 시 <span class="icon icon-sm" translate="no" aria-hidden="true">verified</span> Perfect 배지 획득!)</div>`
      : tier === 'perfect' && optTotal > 0
      ? `<div style="font-size:.68rem;color:#5B4FCF;font-weight:700;margin:-10px 0 14px"><span class="icon icon-sm" translate="no" aria-hidden="true">star</span> 선택 항목까지 체크하면 최대 200%까지 올라가요!</div>`
      : ''
    }
    ${getCatItems(cat, key).map(it => {
      const uid      = `${key}_${it.id}`;
      const checked  = !!S.checks[key][it.id];
      const isCustom = it.id.startsWith('custom_');
      return `
      <div class="ci-wrap" id="ciwrap_${uid}">
        <div class="ci ${checked ? 'done' : ''}" onclick="tgCk('${key}','${it.id}')">
          <div class="ci-box"></div>
          <div style="flex:1;min-width:0">
            <div class="ci-title">${it.t}
              ${it.r ? '<span class="badge-r">필수</span>' : '<span class="badge-o">선택</span>'}
              ${isCustom ? '<span class="badge-custom">내가 추가함</span>' : ''}
            </div>
            ${it.d ? `<div class="ci-desc">${it.d}</div>` : ''}
          </div>
          ${isCustom ? `
          <button type="button" class="ci-expand-btn" aria-label="삭제"
                  onclick="event.stopPropagation();deleteCustomClItem('${key}','${it.id}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">close</span></span>
          </button>` : it.dd ? `
          <button type="button" class="ci-expand-btn" aria-label="자세히 보기"
                  onclick="event.stopPropagation();toggleCiDetail('${uid}')">
            <span class="ci-expand-arrow">▾</span>
          </button>` : ''}
        </div>
        ${it.dd ? `<div class="ci-detail">
          <span class="icon icon-sm" translate="no" aria-hidden="true">menu_book</span> ${it.dd}
          <div class="ci-feedback">
            <span class="ci-feedback-label">이 설명이 도움이 됐나요?</span>
            <button type="button" class="ci-feedback-btn ${S.itemFeedback?.[it.id] === 'up' ? 'on-up' : ''}"
                    onclick="event.stopPropagation();setItemFeedback('${it.id}','up')">
              <span class="icon icon-sm" translate="no" aria-hidden="true">thumb_up</span> 도움돼요
            </button>
            <button type="button" class="ci-feedback-btn ${S.itemFeedback?.[it.id] === 'down' ? 'on-down' : ''}"
                    onclick="event.stopPropagation();setItemFeedback('${it.id}','down')">
              <span class="icon icon-sm" translate="no" aria-hidden="true">thumb_down</span> 아쉬워요
            </button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('')}
    <button type="button" class="cl-add-item-btn" onclick="openAddClItemModal('${key}')">
      ＋ 항목 직접 추가하기
    </button>`;
}

/**
 * v0.0.14: 체크리스트 항목 직접 추가
 * 사용자가 추가한 항목도 기존 항목과 완전히 동일한 규칙(calcScore)으로 필수/선택
 * 퍼센티지 계산에 들어간다 — getCatItems()가 cat.items와 합쳐서 반환해주기 때문에
 * 별도 계산 로직을 새로 만들 필요 없이 그대로 반영됨.
 */
function openAddClItemModal(key) {
  showModal('체크리스트 항목 추가', `
    <div class="fg" style="margin:0">
      <label>항목 이름</label>
      <input id="clNewItemTitle" placeholder="예) 목욕 후 보습제 바르기" maxlength="40">
    </div>
    <div class="fg" style="margin-top:10px">
      <label>필수 여부</label>
      <div style="display:flex;gap:8px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:700;color:var(--tx);cursor:pointer">
          <input type="radio" name="clNewItemReq" value="1" checked> 필수
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:700;color:var(--tx);cursor:pointer">
          <input type="radio" name="clNewItemReq" value="0"> 선택
        </label>
      </div>
    </div>
    <button class="btn bpk" style="width:100%;margin-top:16px" onclick="submitAddClItem('${key}')">추가하기</button>
  `);
}

function submitAddClItem(key) {
  const titleInput = document.getElementById('clNewItemTitle');
  const title = (titleInput?.value || '').trim();
  if (!title) { alert('항목 이름을 입력해주세요'); return; }
  const req = document.querySelector('input[name="clNewItemReq"]:checked')?.value === '1';

  if (!S.customClItems[key]) S.customClItems[key] = [];
  S.customClItems[key].push({ id: `custom_${Date.now()}`, t: title, r: req });

  cm();
  renderClSidebar(); // 사이드바 %와 메인 화면 함께 갱신
  debounceSave();
}

/** 내가 추가한 항목 삭제 (기존 체크리스트 원본 항목은 삭제 불가) */
function deleteCustomClItem(key, id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  S.customClItems[key] = (S.customClItems[key] || []).filter(it => it.id !== id);
  if (S.checks[key]) delete S.checks[key][id];
  renderClSidebar();
  debounceSave();
}

/** 체크리스트 항목 상세 설명 펼치기/접기 (Sprint 14) */
export function toggleCiDetail(uid) {
  document.getElementById('ciwrap_' + uid)?.classList.toggle('open');
}

/**
 * v0.0.23: 체크리스트 항목 "도움돼요/아쉬워요" 개인 반응 — 같은 값을 다시 누르면 취소(토글).
 * 다른 사용자와 집계되는 공개 투표가 아니라 내 계정에만 저장되는 개인 표시임(로그인 시 기기 간 동기화됨).
 * 육아정보 페이지(guide/)에도 같은 버튼이 있지만, 그쪽은 로그인이 없는 정적 페이지라
 * 브라우저 localStorage에 따로 저장됨(서로 연동되진 않지만 같은 UI·조작 방식을 공유함).
 */
export function setItemFeedback(itemId, value) {
  if (!S.itemFeedback) S.itemFeedback = {};
  S.itemFeedback[itemId] = S.itemFeedback[itemId] === value ? undefined : value;
  if (S.itemFeedback[itemId] === undefined) delete S.itemFeedback[itemId];
  debounceSave();
  renderClMain();
}

/**
 * 체크 토글
 * Bug fix: 기존엔 renderClMain()을 먼저 호출한 뒤 renderClSidebar()가 내부에서
 * renderClMain()을 또 호출해 메인 영역이 두 번 렌더링되어 배지가 두 번 깜빡였음.
 * renderClSidebar() 한 번만 호출하면 사이드바 %와 메인 화면이 함께 정확히 갱신된다.
 */
export function tgCk(key, id) {
  if (!S.checks[key]) S.checks[key] = {};
  S.checks[key][id] = !S.checks[key][id];

  // Sprint 11: 캘린더 연동 — 예방접종·건강검진처럼 연결된 캘린더 일정이 있으면 완료 상태도 함께 갱신
  const child = S.children[S.selC];
  if (child && syncChecklistToCalendar(child, id, S.checks[key][id])) {
    if (document.getElementById('pg-calendar')?.classList.contains('on')) {
      window.renderCal?.();
      if (S.selDate) window.showDayPanel?.(S.selDate);
    }
  }

  renderClSidebar();  // 사이드바 % + 메인 화면(1회) 갱신
  debounceSave();
}

/**
 * v0.0.23: 체크리스트를 이미지로 저장·공유하는 기능 — 사람들이 공유하면서 앱 유입이
 * 늘어나길 바라는 목적으로 추가함.
 * 실제 체크박스·버튼이 있는 화면을 그대로 캡처하지 않고, 공유용으로 깔끔하게 정리된
 * 전용 카드를 화면 밖(왼쪽 -9999px)에 잠깐 만들어서 그걸 캡처함 — 그래야 공유 이미지에
 * 인터랙션 요소 없이 결과만 깨끗하게 나오고, 맘캘 브랜드 표시(앱 유입 목적)도 넣을 수 있음.
 * html2canvas(index.html에 CDN으로 로드됨)로 그 카드를 캡처한 뒤, 모바일에서 공유 시트를
 * 지원하면(navigator.share + canShare) 바로 공유하고, 아니면 이미지 파일 다운로드로 대체함.
 */
export async function shareChecklistImage() {
  const child = S.children[S.selC];
  if (!child) { alert('먼저 아이를 등록해주세요'); return; }
  if (typeof html2canvas === 'undefined') {
    alert('이미지 생성 기능을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');
    return;
  }

  const cats = getCats();
  const cat = cats[S.selClCat];
  if (!cat) return;
  const key = `${child.id}_${cat.key}`;
  if (!S.checks[key]) S.checks[key] = {};
  const { basePct, reqDone, reqTotal, optDone, optTotal } = calcScore(cat, S.checks[key], key);
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);

  const TIER_BADGE = {
    legend:  { emoji: '🏆', text: 'Legend · 200% 달성!', bg: 'linear-gradient(135deg,#FCE4EC,#F3E5F5,#E3F2FD)', color: '#C2185B' },
    master:  { emoji: '👑', text: `Master · ${basePct}% 달성`, bg: 'linear-gradient(135deg,#EDE7F6,#D1C4E9)', color: '#4A148C' },
    perfect: { emoji: '✅', text: 'Perfect · 필수 100%', bg: 'linear-gradient(135deg,#FFF8E1,#FFF3CD)', color: '#7B5800' },
  };
  const badge = TIER_BADGE[tier];

  const doneItems = getCatItems(cat, key).filter(it => S.checks[key][it.id]);
  const totalItems = getCatItems(cat, key).length;

  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;left:-9999px;top:0;width:380px;padding:32px 26px;background:linear-gradient(180deg,#ffffff,#FFF7FA);font-family:"OwnglyphParkDahyun","Apple SD Gothic Neo",sans-serif;border-radius:24px;box-sizing:border-box;';
  card.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:1.25rem;font-weight:900;color:#F06292">맘캘 <span style="font-size:.82rem;color:#8A849A;font-weight:700">MomCal</span></div>
    </div>
    <div style="text-align:center;font-size:.8rem;color:#8A849A;font-weight:700;margin-bottom:4px">${child.name}의 체크리스트</div>
    <div style="text-align:center;font-size:1.15rem;font-weight:900;color:#2D2D3A;margin-bottom:18px">${cat.label}</div>
    <div style="text-align:center;margin-bottom:14px">
      <div style="display:inline-block;padding:14px 30px;border-radius:20px;background:#FFF0F5;font-size:2rem;font-weight:900;color:#F06292">${basePct}%</div>
    </div>
    <div style="text-align:center;font-size:.82rem;color:#2D2D3A;font-weight:700;margin-bottom:16px">
      필수 ${reqDone}/${reqTotal} 완료${optTotal ? ` · 선택 ${optDone}/${optTotal}` : ''}
    </div>
    ${badge ? `
    <div style="text-align:center;margin-bottom:18px">
      <span style="display:inline-block;padding:8px 18px;border-radius:14px;background:${badge.bg};color:${badge.color};font-weight:900;font-size:.85rem">${badge.emoji} ${badge.text}</span>
    </div>` : ''}
    <div style="border-top:1.5px dashed #F0D8E4;padding-top:14px;margin-top:6px">
      ${doneItems.slice(0, 8).map(it => `<div style="font-size:.76rem;color:#2D2D3A;padding:3px 0">✅ ${it.t}</div>`).join('')}
      ${doneItems.length > 8 ? `<div style="font-size:.72rem;color:#8A849A;padding:3px 0">그 외 ${doneItems.length - 8}개 더 완료 (전체 ${totalItems}개 중 ${doneItems.length}개 완료)</div>` : ''}
    </div>
    <div style="text-align:center;font-size:.66rem;color:#B0A8C0;margin-top:20px">momcal.app · 임신·육아 캘린더 앱</div>
  `;
  document.body.appendChild(card);

  try {
    const canvas = await html2canvas(card, { scale: 2, backgroundColor: '#ffffff' });
    document.body.removeChild(card);

    canvas.toBlob(async (blob) => {
      if (!blob) { alert('이미지 생성에 실패했어요. 다시 시도해주세요.'); return; }
      const fileName = `맘캘_${child.name}_체크리스트.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '맘캘 체크리스트', text: `${child.name}의 체크리스트 진행 상황이에요!` });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return; // 사용자가 공유 취소 — 에러 아님
          // 공유 실패 시 다운로드로 대체
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (e) {
    if (card.parentElement) document.body.removeChild(card);
    alert('이미지 생성에 실패했어요. 다시 시도해주세요.');
  }
}

// window 노출
window.renderChecklist = renderChecklist;
window.renderClSidebar = renderClSidebar;
window.renderClMain    = renderClMain;
window.tgCk            = tgCk;
window.switchClTab     = switchClTab;
window.toggleCiDetail  = toggleCiDetail;
window.setItemFeedback = setItemFeedback;
window.shareChecklistImage = shareChecklistImage;
window.openAddClItemModal = openAddClItemModal;
window.submitAddClItem    = submitAddClItem;
window.deleteCustomClItem = deleteCustomClItem;
