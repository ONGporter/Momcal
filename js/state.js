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
  selDate:  null,
  evType:   'custom',
  selSCat:  0,           // 선택된 스티커 카테고리 인덱스
  clTab:    0,           // 체크리스트 탭 인덱스
  selClCat: 0,           // 체크리스트 선택된 사이드바 항목
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
  if (!_currentUser) return;
  try {
    await setDoc(userDocRef(), {
      children:    S.children,
      customEvs:   S.customEvs,
      dayStickers: S.dayStickers,
      checks:      S.checks,
      eventMods:   S.eventMods || {},
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

/** 로그인 후 Firestore 실시간 구독 시작 */
export function subscribeToUserData(onData) {
  if (_firestoreUnsub) { _firestoreUnsub(); _firestoreUnsub = null; }
  _firestoreUnsub = onSnapshot(
    userDocRef(),
    (snap) => onData(snap.exists() ? snap.data() : null),
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
  S.theme       = fresh.theme       || 'rose';
  // selC 범위 보정
  S.selC = Math.max(0, Math.min(fresh.selC || 0, S.children.length - 1));
}
