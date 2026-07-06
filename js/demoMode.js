/**
 * js/demoMode.js — Sprint 8, Sprint 15 안전장치 보강
 * "체험하기" — 예시로 미리 채워진 샘플 데이터로 앱을 둘러보는 기능
 *
 * 실제 Firebase(Auth/Firestore)에는 전혀 연결되지 않습니다.
 * setCurrentUser()를 호출하지 않으므로 js/state.js의 saveState()가
 * `if (!_currentUser) return;` 가드에 걸려 항상 조용히 스킵됩니다 — 즉 저장 시도 자체가 없습니다.
 * 기존 로그인 플로우·Firebase 구조는 전혀 건드리지 않는 완전히 독립적인 로컬 미리보기 모드입니다.
 *
 * Sprint 15: 로그인 없는 기본 상태가 "게스트 모드"(실제 데이터를 로컬에 저장)로 바뀌면서,
 * 체험 모드 진입 시 S.isGuestMode를 꺼서 샘플 데이터가 실수로 게스트의 진짜 로컬 데이터를
 * 덮어쓰지 않도록 안전장치를 추가. 체험 종료 시에는 로그인 화면이 아니라 원래 쓰던
 * 게스트 화면(자신의 실제 데이터)으로 돌아가도록 변경.
 */

import { S }              from './state.js';
import { showApp }        from './auth.js';
import { clData }         from '../data/checklist-data.js';

const toStr   = (d) => d.toISOString().split('T')[0];
const addDays = (base, days) => { const d = new Date(base); d.setDate(d.getDate() + days); return d; };

/** 체험용 샘플 데이터를 S에 채워 넣기 */
function seedDemoData() {
  const birth    = addDays(new Date(), -128); // 생후 약 4개월
  const birthStr = toStr(birth);
  const childId  = Date.now();

  const eventMods = {};
  const vax0 = toStr(addDays(birth, 0));
  eventMods[`auto_${vax0}_B형 간염 1차`] = { actualDate: vax0, hospital: '튼튼소아과', memo: '', done: true };
  eventMods[`auto_${vax0}_BCG (결핵)`]   = { actualDate: vax0, hospital: '튼튼소아과', memo: '', done: true };

  const vax2 = toStr(addDays(birth, Math.round(2 * 30.44)));
  eventMods[`auto_${vax2}_DTaP 1차`] = { actualDate: vax2, hospital: '튼튼소아과', memo: '', done: true };

  const birthReport = toStr(addDays(birth, 3));
  eventMods[`auto_${birthReport}_출생신고`] = { actualDate: birthReport, hospital: '', memo: '', done: true, govStatus: 'paid' };

  const parentBenefit = toStr(addDays(birth, 5));
  eventMods[`auto_${parentBenefit}_부모급여 신청`] = { actualDate: parentBenefit, hospital: '', memo: '', done: false, govStatus: 'applied' };

  const checks = {};
  try {
    const cat0 = clData.born[0];
    if (cat0) {
      const key = `${childId}_${cat0.key}`;
      checks[key] = {};
      cat0.items.slice(0, 2).forEach(it => { checks[key][it.id] = true; });
    }
  } catch (e) { /* 데이터 로드 전이면 무시 */ }

  const growthRecords = [
    { id: Date.now() - 1000, childId, date: toStr(addDays(birth, 30)), height: 55.5, weight: 4.5, head: 37.5 },
    { id: Date.now(),        childId, date: toStr(addDays(birth, 90)), height: 61.2, weight: 6.3, head: 40.1 },
  ];

  const todayStr = toStr(new Date());

  S.children      = [{ id: childId, name: '민준 (체험)', gender: 'm', stage: 'born', birth: birthStr, due: '', week: 0, avatar: '👦' }];
  S.customEvs     = [{ _id: Date.now() + 1, date: todayStr, title: '소아과 정기 방문', note: '체험 모드 샘플 일정', type: 'custom', auto: false }];
  S.dayStickers   = { [todayStr]: ['🌸', '💕'] };
  S.checks        = checks;
  S.eventMods     = eventMods;
  S.growthRecords = growthRecords;
  S.theme         = 'rose';
  S.selC          = 0;
  S.growthMetric  = 'height';
}

/** 체험 모드 시작 */
export function startDemoMode() {
  S.isDemoMode  = true;
  S.isGuestMode = false; // Sprint 15: 샘플 데이터가 게스트의 실제 로컬 데이터를 덮어쓰지 않도록 저장 경로 차단
  seedDemoData();

  document.body.classList.add('demo-active');
  document.getElementById('demoBanner')?.classList.add('show');

  showApp({ displayName: '체험 중', email: '체험 모드 (로그인 안 함)' });

  // 초기 렌더 (app.js의 onDataLoaded와 동일한 순서)
  window.renderHome?.();
  window.renderRegList?.();
  if (document.getElementById('pg-calendar')?.classList.contains('on')) {
    window.renderCal?.();
    window.renderStickerPicker?.();
  }
  if (document.getElementById('pg-checklist')?.classList.contains('on')) {
    window.renderChecklist?.();
  }
  if (document.getElementById('pg-growth')?.classList.contains('on')) {
    window.renderGrowthPage?.();
  }
}

/** 체험 모드 종료 → 원래 쓰던 게스트 화면(자신의 실제 데이터)으로 복귀 (Sprint 15) */
export function exitDemoMode() {
  S.isDemoMode = false;
  document.body.classList.remove('demo-active');
  document.getElementById('demoBanner')?.classList.remove('show');
  const menu = document.getElementById('userMenu');
  if (menu) menu.style.display = 'none';
  window.enterGuestMode?.();
}

window.startDemoMode = startDemoMode;
window.exitDemoMode  = exitDemoMode;
