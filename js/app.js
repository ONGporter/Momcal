/**
 * js/app.js
 * 앱 메인 진입점
 * Firebase Auth 상태 감시 → 로그인/로그아웃 처리 → 데이터 로드 → UI 렌더
 *
 * Bug Fix:
 * - _firstLoad 플래그로 초기 로드와 onSnapshot 재발동 구분
 * - 초기 로드: renderChecklist() (자동 카테고리 선택 포함)
 * - 이후 onSnapshot: renderClSidebar()만 호출 (카테고리 선택 유지)
 */

import { auth, onAuthStateChanged } from './firebase.js';
import {
  S, applyData, setCurrentUser, subscribeToUserData, unsubscribeUserData,
} from './state.js';
import { showApp, showAuthScreen } from './auth.js';
import { renderHome, renderRegList, gp } from './ui.js';
import { renderCal, renderStickerPicker } from './calendar.js';
import { renderChecklist, renderClSidebar } from './checklist.js';
import { renderGrowthPage } from './growthChart.js';
import './growth.js';
import './demoMode.js';
import './checklistCalendarLink.js';

/* ── 초기 로드 여부 플래그 ── */
let _firstLoad = true;

/* ── 테마 버튼 UI 동기화 ── */
function syncThemeUI() {
  const themeMap = { rose: 0, mint: 1, sunny: 2, lavender: 3, peach: 4 };
  const idx = themeMap[S.theme] ?? 0;
  document.querySelectorAll('.theme-btn').forEach((b, i) => b.classList.toggle('on', i === idx));
}

/**
 * Firestore 데이터를 S에 적용하고 현재 페이지 렌더
 * @param {Object|null} data
 */
function onDataLoaded(data) {
  applyData(data);
  syncThemeUI();
  renderHome();
  renderRegList();

  if (document.getElementById('pg-calendar').classList.contains('on')) {
    renderCal();
    renderStickerPicker();
  }

  if (document.getElementById('pg-checklist').classList.contains('on')) {
    if (_firstLoad) {
      // 초기 로드: 자동 카테고리 선택 포함 전체 렌더
      renderChecklist();
    } else {
      // onSnapshot 재발동: 사이드바 % 만 업데이트 (카테고리 선택 유지)
      renderClSidebar();
    }
  }

  if (document.getElementById('pg-growth').classList.contains('on')) {
    renderGrowthPage();
  }

  _firstLoad = false;
}

/* ── Firebase Auth 상태 감시 ── */
onAuthStateChanged(auth, (user) => {
  if (user) {
    _firstLoad = true; // 로그인 시 첫 로드로 초기화
    setCurrentUser(user);
    showApp(user);
    subscribeToUserData(onDataLoaded);
  } else {
    setCurrentUser(null);
    unsubscribeUserData();
    showAuthScreen();
  }
});

/* ── PWA 서비스 워커 등록 (Sprint 11: 홈 화면 추가) ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 서비스 워커 등록 실패해도 앱 사용에는 지장 없음 (오프라인 캐싱만 못 함)
    });
  });
}
