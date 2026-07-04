/**
 * js/state.js
 * 앱 전체 상태(S) 관리 및 Firebase 저장/로드
 *
 * S는 단일 전역 객체입니다. 모든 모듈이 이 파일에서 import하여 사용합니다.
 * window.S 로도 노출되어 인라인 onclick 핸들러에서 직접 접근할 수 있습니다.
 */

import { auth, db, doc, setDoc, onSnapshot } from './firebase.js';

/* ── 기본 상태 팩토리 ── */
export function emptyState() {
  return {
    children:    [],   // 등록된 아이/임신 프로필
    customEvs:   [],   // 사용자가 직접 추가한 일정
    dayStickers: {},   // { 'YYYY-MM-DD': [emoji, ...] }
    checks:      {},   // { 'childId_catKey': { itemId: true } }
    eventMods:   {},   // { 'eventKey': { actualDate, hospital, memo, done } }
    growthRecords: [], // [{ id, childId, date, height, weight, head }] — 성장 기록 (Sprint 4)
    evColors:    {},   // { req, rec, food, vax, gov, custom } — 사용자 지정 일정 색상 (Sprint 21, 없으면 기본색)
    theme:       'rose',
    selC:        0,    // 현재 선택된 아이 인덱스
  };
}

/* ── 전역 상태 객체 ── */
export const S = Object.assign(emptyState(), {
  // UI 상태 (Firebase에 저장하지 않음)
  gender:   'm',
  rStage:   'born',
  calY:     new Date().getFullYear(),
  calM:     new Date().getMonth(),
  calView:  'month',
  calWeekRef: null,      // v0.0.11: 주간 뷰 전용 기준일(YYYY-MM-DD) — calMove()가 7일 단위로 이동
  selDate:  null,
  evType:   'custom',
  selSCat:  0,           // 선택된 스티커 카테고리 인덱스
  clTab:    0,           // 체크리스트 탭 인덱스
  selClCat: 0,           // 체크리스트 선택된 사이드바 항목
  growthMetric: 'height', // 성장그래프 탭에서 선택된 지표 ('height'|'weight'|'head')
  isDemoMode: false,      // Sprint 8: 체험 모드 여부 (로그인 없이 샘플 데이터로 둘러보기)
  isGuestMode: false,     // Sprint 15: 게스트 모드 여부 (로그인 없이 실제 데이터를 로컬에 저장해 사용)
  calFilter: { food: false, vax: false, gov: false }, // Sprint 11: 캘린더 타입 필터 (전부 false = 전체 표시)
});

// 인라인 onclick 에서 S.xxx 직접 접근 가능하도록 window에 노출
window.S = S;

/* ── 현재 로그인 사용자 ── */
let _currentUser = null;
export const getCurrentUser   = () => _currentUser;
export const setCurrentUser   = (u) => { _currentUser = u; };

/* ── Firestore 문서 레퍼런스 ── */
export function userDocRef() {
  return doc(db, 'users', _currentUser.uid);
}

/* ── 상태 저장 ── */
export async function saveState() {
  // Sprint 15: 게스트 모드(로그인 안 함)는 로컬(localStorage)에 저장 — js/guestMode.js가 처리
  // (순환 import 방지를 위해 window 경유 호출 — 프로젝트 전반의 기존 패턴과 동일)
  if (S.isGuestMode) {
    window.saveGuestData?.();
    return;
  }
  if (!_currentUser) return;
  try {
    await setDoc(userDocRef(), {
      children:    S.children,
      customEvs:   S.customEvs,
      dayStickers: S.dayStickers,
      checks:      S.checks,
      eventMods:   S.eventMods || {},
      growthRecords: S.growthRecords || [],
      evColors:    S.evColors || {},
      theme:       S.theme,
      selC:        S.selC,
      updatedAt:   Date.now(),
    });
    flashSave();
  } catch (e) {
    console.error('저장 실패', e);
  }
}

/* ── 디바운스 저장 (600ms) ── */
let _saveTimer;
export function debounceSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveState, 600);
}

/* ── 저장 완료 배지 표시 ── */
export function flashSave() {
  const el = document.getElementById('saveBadge');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

/* ── Firebase 실시간 구독 ── */
let _firestoreUnsub = null;

/**
 * 로그인 후 Firestore 실시간 구독 시작
 *
 * v0.0.9 버그 수정 — 체크리스트 배지가 두 번 깜빡이던 버그 재발 원인:
 * debounceSave()로 setDoc()을 호출하면(=우리 기기 자신의 저장), Firestore가 서버 응답 전에
 * 로컬 캐시로 먼저 onSnapshot을 "낙관적으로" 한 번 더 쏴준다(snap.metadata.hasPendingWrites
 * === true). 체크 클릭 시 이미 tgCk()가 화면을 1회 그렸는데, 약 600ms 뒤 debounceSave()
 * 저장이 실행되며 "내가 방금 쓴 내용"이 onSnapshot으로 그대로 되돌아와 app.js가 또 한 번
 * 사이드바/메인을 다시 그렸음 — 그래서 배지 애니메이션이 두 번 재생됨.
 * (이전 Sprint 7에서 고친 건 tgCk() 내부에서 같은 클릭에 renderClMain()이 중복 호출되던
 * 것이었고, 이후 다른 기기와의 실시간 동기화를 위해 app.js가 onSnapshot마다
 * renderClSidebar()를 다시 호출하는 코드가 추가되면서 이 새로운 경로로 버그가 재발함)
 * 해결: snap.metadata.hasPendingWrites를 onData의 두 번째 인자로 함께 넘겨서 "내 기기가
 * 방금 쓴 내용의 로컬 에코"인지 "실제로 다른 기기/탭에서 바뀐 내용"인지 구분함(app.js에서 사용).
 */
export function subscribeToUserData(onData) {
  if (_firestoreUnsub) { _firestoreUnsub(); _firestoreUnsub = null; }
  _firestoreUnsub = onSnapshot(
    userDocRef(),
    (snap) => onData(snap.exists() ? snap.data() : null, snap.metadata.hasPendingWrites),
    (err)  => console.error('구독 오류', err),
  );
}

/** 로그아웃 시 구독 해제 */
export function unsubscribeUserData() {
  if (_firestoreUnsub) { _firestoreUnsub(); _firestoreUnsub = null; }
}

/**
 * Firestore에서 불러온 데이터를 S에 적용
 * @param {Object|null} data
 */
export function applyData(data) {
  const fresh = data || emptyState();
  S.children    = fresh.children    || [];
  S.customEvs   = fresh.customEvs   || [];
  S.dayStickers = fresh.dayStickers || {};
  S.checks      = fresh.checks      || {};
  S.eventMods   = fresh.eventMods   || {};
  S.growthRecords = fresh.growthRecords || [];
  S.evColors    = fresh.evColors    || {};
  S.theme       = fresh.theme       || 'rose';
  // selC 범위 보정
  S.selC = Math.max(0, Math.min(fresh.selC || 0, S.children.length - 1));
}
