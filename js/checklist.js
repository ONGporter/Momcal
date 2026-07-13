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
import { today, icon, growthStageIconImg } from './utils.js';
import { clData }          from '../data/checklist-data.js';
import { clPacks }         from '../data/checklist-packs.js';
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
 * v0.0.31: 네 번째 인자 customKey를 넘기면 직접 추가한 항목을 key와 다른 버킷에서 읽는다
 * (예방접종/발달처럼 같은 catKey를 공유하는 카테고리에서, 직접 추가한 항목이 한쪽 탭에만
 * 들어가도록 구분하기 위함). 생략하면 기존처럼 key와 동일하게 취급된다.
 */
export function calcScore(cat, checks, key, customKey) {
  const items    = key ? getCatItems(cat, key, customKey) : cat.items;
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

/** v0.0.14: 카테고리의 원래 항목 + 사용자가 직접 추가한 항목을 합친 배열 반환
 *  v0.0.31: customKey가 key와 다르면(예: 예방접종/발달 분리) customKey 버킷에서 직접
 *  추가한 항목을 읽고, 이 분리 이전에 key(공용 버킷)에 저장돼 있던 레거시 항목도 함께
 *  보여준다(과거에 추가한 항목이 갑자기 안 보이는 걸 방지 — 새로 추가하는 항목부터는
 *  customKey 버킷에만 쌓여서 한쪽 탭에만 나타난다) */
export function getCatItems(cat, key, customKey) {
  customKey = customKey || key;
  const scoped = (customKey && S.customClItems && S.customClItems[customKey]) || [];
  const legacy = (customKey !== key && S.customClItems && S.customClItems[key]) || [];
  const custom = [...legacy, ...scoped];
  return custom.length ? [...cat.items, ...custom] : cat.items;
}

/** 점수 → 티어 (필수/선택 완료 개수 기준 — score 임계값이 아닌 실제 완료 여부로 판단) */
function getTier(reqDone, reqTotal, optDone, optTotal) {
  if (reqTotal > 0 && reqDone < reqTotal) return null; // 필수 미완료
  // v0.0.31 버그 수정: 선택 항목이 아예 없는 카테고리(예: 예방접종 대부분의 월령 카테고리)는
  // 필수만 다 채워도 Perfect에서 영원히 멈춰있었음 — 애초에 선택 항목이 없으니 그 이상 얻을
  // 방법이 없는데도 최고 등급(Legend)을 못 받는 게 부당하다는 피드백으로, 선택 항목 자체가
  // 없는 카테고리는 필수 완료 = 최고 등급(Legend)으로 처리
  if (optTotal === 0)                     return 'legend';
  if (optDone === 0)                      return 'perfect'; // 필수만 100%
  if (optDone === optTotal)               return 'legend';  // 필수+선택 모두 완료
  return 'master';                                            // 필수 100% + 선택 일부
}

/* ────────────────────────────────────
 *  v0.0.40: 체크리스트 탭 레지스트리
 *  기존엔 tabDefs가 renderChecklist() 안에 하드코딩돼있고, 다른 함수들(getCats/
 *  autoSelectCat/renderContextBanner/getCustomKey 등)은 S.clTab이 항상 "0=예방접종,
 *  1=발달..." 같은 고정 순서라고 가정하고 숫자로 분기했음. 사용자가 탭을 숨길 수 있게
 *  되면서 그 가정이 깨지므로, 이제 모든 분기는 "지금 보이는 탭 목록에서 S.clTab번째
 *  탭의 key가 무엇인가"로 판단한다(getVisibleTabDefs(child)[S.clTab]?.key).
 *  S.clTab 자체는 Firestore에 저장되지 않는 세션 전용 값이라(js/state.js emptyState 참고)
 *  이 의미 변경이 기존 저장 데이터에 영향을 주지 않는다.
 */

/** 내장 탭(임신/출산준비물/예방접종/발달/이유식/정부지원) — 항상 존재, key로 표시 여부만 결정됨 */
function builtinTabDefs(child) {
  if (!child) return [];
  if (child.stage === 'preg') {
    return [
      { key: 'preg', kind: 'indexed', tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 임신 체크' },
      { key: 'prep', kind: 'indexed', tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">inventory_2</span> 출산 준비물' },
      { key: 'gov',  kind: 'gov',     tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">account_balance</span> 정부지원' },
    ];
  }
  return [
    { key: 'vax',  kind: 'indexed', tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">vaccines</span> 예방접종' },
    { key: 'dev',  kind: 'indexed', tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 발달' },
    { key: 'food', kind: 'indexed', tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">restaurant</span> 이유식' },
    { key: 'gov',  kind: 'gov',     tabLabel: '<span class="icon icon-sm" translate="no" aria-hidden="true">account_balance</span> 정부지원' },
  ];
}

/** 준비물형(플랫) 내장 팩 — data/checklist-packs.js. 각 팩의 stage 필드(preg/born)에 맞는 것만 보여줌 */
function packTabDefs(child) {
  if (!child) return [];
  return clPacks
    .filter(p => (p.stage || 'born') === child.stage)
    .map(p => ({
      key: p.key, kind: 'flat', label: p.label, items: p.items,
      tabLabel: `<span class="icon icon-sm" translate="no" aria-hidden="true">${p.icon}</span> ${p.label}`,
    }));
}

/** 사용자가 직접 만든 플랫 체크리스트 — S.customChecklists. cl.stage(preg/born)에 맞는 것만 보여줌
 *  (v0.0.40에서 만든 기존 데이터는 stage가 없을 수 있어 'born'으로 취급 — 하위 호환) */
function customTabDefs(child) {
  if (!child) return [];
  return (S.customChecklists || [])
    .filter(c => (c.stage || 'born') === child.stage)
    .map(c => ({
      key: c.key, kind: 'flat', label: c.label, items: c.items,
      tabLabel: `<span class="icon icon-sm" translate="no" aria-hidden="true">${c.icon || 'checklist'}</span> ${c.label}`,
    }));
}

/** 숨김 설정 반영 전 전체 탭 목록(설정 화면에서 "숨긴 탭도 다시 켤 수 있게" 보여줄 때 사용) */
export function getAllTabDefs(child) {
  return [...builtinTabDefs(child), ...packTabDefs(child), ...customTabDefs(child)];
}

/** 지금 실제로 보여줄 탭 목록 — 전부 숨겨진 경우엔 안전장치로 전체를 다시 보여줌(빈 화면 방지) */
export function getVisibleTabDefs(child) {
  const all = getAllTabDefs(child);
  const hidden = new Set((S.clSettings && S.clSettings.hiddenTabs) || []);
  const visible = all.filter(t => !hidden.has(t.key));
  return visible.length ? visible : all;
}

/* ────────────────────────────────────
 *  체크리스트 진입점
 * ──────────────────────────────────── */
export function renderChecklist() {
  const csel = document.getElementById('clChildSel');
  csel.innerHTML = S.children.length
    ? S.children.map((c, i) =>
        `<option value="${i}" ${i == S.selC ? 'selected' : ''}>${c.name}</option>`
      ).join('')
    : '<option>아이를 등록해주세요</option>';

  const child   = S.children[S.selC];
  const tabDefs = getVisibleTabDefs(child);
  if ((S.clTab || 0) >= tabDefs.length) S.clTab = 0; // 탭 숨김/커스텀 삭제로 목록이 줄어든 경우 방어

  // Sprint 3: 현재 주차/월령에 맞는 카테고리 자동 선택
  if (child) autoSelectCat(child, tabDefs);

  const tb = document.getElementById('clTabBar');
  tb.innerHTML = tabDefs.map((t, i) =>
    `<button class="cl-tab-btn ${(S.clTab || 0) === i ? 'on' : ''}"
             onclick="switchClTab(${i})">${t.tabLabel}</button>`
  ).join('') + (child
    ? `<button type="button" class="cl-tab-settings-btn" title="체크리스트 표시·연동 설정" onclick="gp('settings')">
         <span class="icon icon-sm" translate="no" aria-hidden="true">tune</span> 편집
       </button>`
    : '');

  const hintEl = document.getElementById('clTabHint');
  if (hintEl) hintEl.style.display = child ? '' : 'none'; // v0.0.43: "편집" 버튼이 뭘 하는지 처음 보는 사람도 알 수 있게 짧은 안내 추가

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
  const tabDefs = getVisibleTabDefs(child);
  if (child) autoSelectCat(child, tabDefs);
  document.querySelectorAll('.cl-tab-btn').forEach((b, j) => b.classList.toggle('on', j === i));
  renderContextBanner(child);
  renderClSidebar();
}

/* ────────────────────────────────────
 *  현재 주차/월령 → 카테고리 자동 선택
 * ──────────────────────────────────── */
function autoSelectCat(child, tabDefs) {
  const cats = getCats();
  if (!cats.length) return;
  tabDefs = tabDefs || getVisibleTabDefs(child);
  const curKey = tabDefs[S.clTab || 0]?.key;

  if (child.stage === 'preg' && curKey === 'preg' && child.week) {
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

    // v0.0.30: 육아 체크가 예방접종/발달 두 탭으로 나뉘었지만 월령→카테고리 매핑(milestones)은
    // 동일한 catKey를 공유하므로, 두 탭 모두에서 같은 자동 선택 로직을 적용
  } else if (child.stage === 'born' && (curKey === 'vax' || curKey === 'dev') && child.birth) {
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

  // v0.0.30: 육아 체크가 예방접종/발달 두 탭으로 나뉘었지만, 홈 대시보드 카드는 예전처럼
  // "이번 달 육아체크 전체 진행 상황"을 한 번에 보여줘야 하므로 두 탭을 합쳐서 계산함.
  // 두 배열은 같은 catKey를 공유해서(S.checks 저장 키도 공유) items만 이어붙이면 됨.
  // v0.0.31: 직접 추가한 항목도 탭별로 나뉘어 저장되므로(getCustomKey 참고), 여기서도
  // 예방접종/발달 각각의 customKey로 조회해서 합쳐야 홈 카드 진행률에서 누락되지 않음.
  const cats = child.stage === 'preg'
    ? clData.preg.filter(c => c.key !== 'preg_prep')
    : clData.born_vax.map((vaxCat, i) => {
        const devCat = clData.born_dev[i];
        const catKey = `${child.id}_${vaxCat.key}`;
        const vaxItems = getCatItems(vaxCat, catKey, `${catKey}__vax`);
        const devItems = devCat ? getCatItems(devCat, catKey, `${catKey}__dev`) : [];
        return { key: vaxCat.key, label: vaxCat.label, items: [...vaxItems, ...devItems] };
      });
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
  // v0.0.31: born 단계는 cat.items에 이미 예방접종/발달(+각 탭 커스텀 항목)을 합쳐놨으므로
  // key를 넘기지 않고 cat.items를 그대로 씀(넘기면 getCatItems가 다시 조회해 레거시 공용
  // 버킷 항목이 중복 합산될 수 있음). preg는 기존처럼 key로 커스텀 항목을 조회함.
  const { reqDone, reqTotal, optDone, optTotal } =
    child.stage === 'preg' ? calcScore(cat, checks, key) : calcScore(cat, checks);

  // v0.0.9: 홈 대시보드 카드용 — 배지 티어 + 다음 추천 항목
  // (다른 대시보드 카드들처럼 강조색 서브 텍스트를 보여주기 위함)
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);
  const catItems = child.stage === 'preg' ? getCatItems(cat, key) : cat.items;
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
  const tabDefs = getVisibleTabDefs(child);
  const curKey  = tabDefs[S.clTab || 0]?.key;

  if (child.stage === 'preg' && curKey === 'preg' && child.week) {
    const week = parseInt(child.week) || 0;
    if (!week) { el.innerHTML = ''; return; }
    const trimester = week <= 12 ? '1분기' : week <= 27 ? '2분기' : '3분기';
    const weeksLeft = Math.max(0, 40 - week);
    el.innerHTML = `
      <span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 현재 <strong>${week}주차</strong> · ${trimester}
      <span style="color:var(--txl);font-weight:700;margin-left:auto;font-size:.76rem">출산까지 약 ${weeksLeft}주</span>`;

  } else if (child.stage === 'born' && (curKey === 'vax' || curKey === 'dev') && child.birth) {
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

/* 육아 체크 "아기→돌쟁이→어린이" 성장 단계 아이콘을 아이 성별에 맞춰 바꾸기 위한 헬퍼
 * (v0.0.22 이모지 버전 → v0.0.53 이미지로 교체) — 실제 파일 매핑은 js/utils.js의
 * growthStageIconImg()에 있음(GROWTH_STAGE_FILES). 성별 미정('u')이면 옹짐꾼님 요청대로
 * 항상 "남아" 이미지를 기본값으로 씀. */
function applyGrowthStageGender(cats, gender) {
  return cats.map(c => {
    const iconHtml = growthStageIconImg(c.key, gender);
    if (!iconHtml) return c;
    return { ...c, label: c.label.replace(/^\S+/, iconHtml) };
  });
}

/* ────────────────────────────────────
 *  현재 탭의 카테고리 목록 반환
 * ──────────────────────────────────── */
export function getCats() {
  const child = S.children[S.selC];
  if (!child) return [];
  const tabDefs = getVisibleTabDefs(child);
  const tab = tabDefs[S.clTab || 0];
  if (!tab) return [];

  if (tab.key === 'preg') return clData.preg.filter(c => c.key !== 'preg_prep');
  if (tab.key === 'prep') return clData.preg.filter(c => c.key === 'preg_prep');
  // v0.0.30: 육아 체크 탭이 예방접종/발달/이유식/정부지원으로 늘어남
  if (tab.key === 'vax')  return applyGrowthStageGender(clData.born_vax, child.gender);
  if (tab.key === 'dev')  return applyGrowthStageGender(clData.born_dev, child.gender);
  if (tab.key === 'food') return clData.food;
  // v0.0.40: 준비물형(플랫) 팩·커스텀 체크리스트 — 월령 인덱싱 없이 카테고리 1개짜리로 취급
  // (calcScore/getCatItems/renderClMain은 원래 {key,label,items} 모양이면 뭐든 동일하게 처리함)
  if (tab.kind === 'flat') return [{ key: tab.key, label: tab.label, items: tab.items }];
  return []; // 정부지원 탭은 getCats 대상 아님(renderGovChecklistTab에서 별도 렌더링)
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

/**
 * v0.0.31: 직접 추가한 항목(customClItems)의 저장 키.
 * 예방접종(탭0)/발달(탭1)처럼 같은 catKey(m0, m2…)를 공유하는 카테고리에서, 직접 추가한
 * 항목이 두 탭에 함께 보이던 문제 — 육아(born) 탭에서만 탭 구분을 키에 추가해서 분리한다.
 * (S.checks는 그대로 공용 key를 씀 — 기존 항목 체크 상태 호환성 때문에 건드리지 않음)
 */
function getCustomKey(child, cat) {
  const key = `${child.id}_${cat.key}`;
  const curKey = getVisibleTabDefs(child)[S.clTab || 0]?.key;
  if (child && child.stage === 'born' && (curKey === 'vax' || curKey === 'dev')) {
    return `${key}__${curKey}`;
  }
  return key;
}

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

  // Sprint 6, v0.0.30 수정, v0.0.40: 정부지원 탭은 kind:'gov'로 표시되는 탭 — 위치(인덱스)가
  // 아니라 key로 판단해야 탭을 숨기거나 순서가 바뀌어도 정확히 찾음. 별도 모듈에서 렌더링.
  const tabDefs = getVisibleTabDefs(child);
  const curTab  = tabDefs[S.clTab || 0];
  if (curTab && curTab.kind === 'gov') {
    renderGovChecklistTab(child);
    return;
  }

  const cats = getCats();
  if (S.selClCat >= cats.length) S.selClCat = 0;

  document.getElementById('clSidebar').innerHTML = cats.map((cat, i) => {
    const key = `${child.id}_${cat.key}`;
    if (!S.checks[key]) S.checks[key] = {};
    const customKey = getCustomKey(child, cat);

    const { score, basePct, reqDone, reqTotal, optDone, optTotal } = calcScore(cat, S.checks[key], key, customKey);
    const tier = getTier(reqDone, reqTotal, optDone, optTotal);

    let pctHtml;
    if (tier === 'legend') {
      // v0.0.31: 선택 항목이 원래 없어서 legend가 된 경우 "200%"라고 하면 실제보다 과장돼 보이니 100%로 표시
      const legendPct = optTotal === 0 ? '100%' : '200%';
      pctHtml = `<span class="cl-sb-pct cl-sb-legend"><span class="icon icon-sm" translate="no" aria-hidden="true">emoji_events</span> ${legendPct}</span>`;
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
  const customKey = getCustomKey(child, cat);

  const { score, basePct, optDone, optTotal, reqDone, reqTotal } = calcScore(cat, S.checks[key], key, customKey);
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);

  // ── 배지 & 상태 텍스트 ──
  let badgeHtml;
  if (tier === 'legend') {
    // v0.0.31: 선택 항목이 원래 없어서 legend가 된 경우엔 "필수 항목만으로 달성"이라고 정확히 표시
    badgeHtml = optTotal === 0
      ? `<div class="cl-badge cl-badge-legend"><span class="icon icon-sm" translate="no" aria-hidden="true">emoji_events</span> Legend — 필수 100% 달성!</div>`
      : `<div class="cl-badge cl-badge-legend"><span class="icon icon-sm" translate="no" aria-hidden="true">emoji_events</span> Legend — 200% 달성!</div>`;
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
    ${(() => {
      // v0.0.44: 커스텀 체크리스트(사용자가 "새 체크리스트 만들기"로 직접 만든 것)는
      // 어차피 전부 본인이 만든 항목이라 "내가 추가함" 배지로 구분할 의미가 없다는 피드백
      // 반영 — 이 카테고리에서는 배지 없이 모든 항목을 똑같이 삭제 가능하게 처리한다.
      // (준비물 팩처럼 원래 콘텐츠(dd)가 있는 카테고리는 기존처럼 구분을 유지함)
      const isCustomChecklist = cat.key.startsWith('custom_');
      return getCatItems(cat, key, customKey).map(it => {
        const uid       = `${key}_${it.id}`;
        const checked   = !!S.checks[key][it.id];
        const isCustomAdd = !isCustomChecklist && it.id.startsWith('custom_');
        const canDelete   = isCustomChecklist || isCustomAdd;
        const deleteOnclick = isCustomChecklist
          ? `deleteCustomChecklistItemInTab('${cat.key}','${customKey}','${it.id}')`
          : `deleteCustomClItem('${customKey}','${it.id}')`;
        return `
        <div class="ci-wrap" id="ciwrap_${uid}">
          <div class="ci ${checked ? 'done' : ''}" onclick="tgCk('${key}','${it.id}')">
            <div class="ci-box"></div>
            <div style="flex:1;min-width:0">
              <div class="ci-title">${it.t}
                ${it.r ? '<span class="badge-r">필수</span>' : '<span class="badge-o">선택</span>'}
                ${isCustomAdd ? '<span class="badge-custom">내가 추가함</span>' : ''}
              </div>
              ${it.d ? `<div class="ci-desc">${it.d}</div>` : ''}
            </div>
            ${canDelete ? `
            <button type="button" class="ci-expand-btn" aria-label="삭제"
                    onclick="event.stopPropagation();${deleteOnclick}">
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
      }).join('');
    })()}
    <button type="button" class="cl-add-item-btn" onclick="openAddClItemModal('${customKey}','${cat.key}')">
      ＋ 항목 직접 추가하기
    </button>`;
}

/**
 * v0.0.14: 체크리스트 항목 직접 추가
 * 사용자가 추가한 항목도 기존 항목과 완전히 동일한 규칙(calcScore)으로 필수/선택
 * 퍼센티지 계산에 들어간다 — getCatItems()가 cat.items와 합쳐서 반환해주기 때문에
 * 별도 계산 로직을 새로 만들 필요 없이 그대로 반영됨.
 */
function openAddClItemModal(key, catKey) {
  showModal('체크리스트 항목 추가', `
    <div class="fg" style="margin:0">
      <label>항목 이름</label>
      <input id="clNewItemTitle" placeholder="예) 목욕 후 보습제 바르기" maxlength="40">
    </div>
    <div class="fg" style="margin-top:10px">
      <label>필수 여부</label>
      <div style="display:flex;gap:8px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:700;color:var(--tx);cursor:pointer;white-space:nowrap;flex-shrink:0">
          <input type="radio" name="clNewItemReq" value="1" checked> 필수
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;font-weight:700;color:var(--tx);cursor:pointer;white-space:nowrap;flex-shrink:0">
          <input type="radio" name="clNewItemReq" value="0"> 선택
        </label>
      </div>
    </div>
    <button class="btn bpk" style="width:100%;margin-top:16px" onclick="submitAddClItem('${key}','${catKey}')">추가하기</button>
  `);
}

/**
 * v0.0.44: 커스텀 체크리스트(cat.key가 'custom_'로 시작)는 사용자가 처음부터 다 만든
 * 목록이라 "내가 추가함"으로 따로 구분할 이유가 없다는 피드백을 받아, 이 경우엔
 * S.customClItems(아이별 별도 버킷)가 아니라 S.customChecklists의 items 배열에
 * 바로 써서 설정 탭의 "편집"과 완전히 같은 데이터를 보게 함(양방향 반영이 저절로 됨).
 * 그 외(준비물 팩·내장 카테고리)는 기존처럼 아이별 customClItems 버킷을 그대로 씀.
 */
function submitAddClItem(key, catKey) {
  const titleInput = document.getElementById('clNewItemTitle');
  const title = (titleInput?.value || '').trim();
  if (!title) { alert('항목 이름을 입력해주세요'); return; }
  const req = document.querySelector('input[name="clNewItemReq"]:checked')?.value === '1';

  if (catKey && catKey.startsWith('custom_')) {
    const cl = (S.customChecklists || []).find(c => c.key === catKey);
    if (cl) cl.items.push({ id: `cclt_${Date.now()}`, t: title, r: req });
  } else {
    if (!S.customClItems[key]) S.customClItems[key] = [];
    S.customClItems[key].push({ id: `custom_${Date.now()}`, t: title, r: req });
  }

  cm();
  renderClSidebar(); // 사이드바 %와 메인 화면 함께 갱신
  debounceSave();
}

/** 내가 추가한 항목 삭제 (기존 체크리스트 원본 항목은 삭제 불가) — 준비물 팩·내장 카테고리용 */
function deleteCustomClItem(key, id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  S.customClItems[key] = (S.customClItems[key] || []).filter(it => it.id !== id);
  if (S.checks[key]) delete S.checks[key][id];
  renderClSidebar();
  debounceSave();
}

/**
 * v0.0.44: 커스텀 체크리스트 전용 삭제 — cl.items(설정 탭 "편집"과 공유하는 배열)에서
 * 지우고, 혹시 v0.0.43 이전 방식으로 저장된 레거시 customClItems 항목이 남아있으면
 * 그것도 함께 정리한다. 체크리스트 자체가 모든 아이가 공유하는 하나의 템플릿이라
 * 체크 상태도 아이 전체를 순회하며 정리함.
 */
function deleteCustomChecklistItemInTab(catKey, customKey, id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  const cl = (S.customChecklists || []).find(c => c.key === catKey);
  if (cl) cl.items = cl.items.filter(it => it.id !== id);
  if (S.customClItems && S.customClItems[customKey]) {
    S.customClItems[customKey] = S.customClItems[customKey].filter(it => it.id !== id);
  }
  Object.keys(S.checks || {}).forEach(k => {
    if (k.endsWith('_' + catKey) && S.checks[k]) delete S.checks[k][id];
  });
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
  const customKey = getCustomKey(child, cat);
  const { basePct, reqDone, reqTotal, optDone, optTotal } = calcScore(cat, S.checks[key], key, customKey);
  const tier = getTier(reqDone, reqTotal, optDone, optTotal);

  const TIER_BADGE = {
    // v0.0.31: 선택 항목이 없어서 legend가 된 카테고리는 "200%"라고 하면 과장돼 보이니 정확히 표시
    legend:  { emoji: '🏆', text: optTotal === 0 ? 'Legend · 필수 100% 달성!' : 'Legend · 200% 달성!', bg: 'linear-gradient(135deg,#FCE4EC,#F3E5F5,#E3F2FD)', color: '#C2185B' },
    master:  { emoji: '👑', text: `Master · ${basePct}% 달성`, bg: 'linear-gradient(135deg,#EDE7F6,#D1C4E9)', color: '#4A148C' },
    perfect: { emoji: '✅', text: 'Perfect · 필수 100%', bg: 'linear-gradient(135deg,#FFF8E1,#FFF3CD)', color: '#7B5800' },
  };
  const badge = TIER_BADGE[tier];

  const doneItems = getCatItems(cat, key, customKey).filter(it => S.checks[key][it.id]);
  const totalItems = getCatItems(cat, key, customKey).length;

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
window.deleteCustomChecklistItemInTab = deleteCustomChecklistItemInTab;
