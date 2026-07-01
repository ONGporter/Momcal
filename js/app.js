/**
 * js/app.js
 * 앱 메인 진입점
 * Firebase Auth 상태 감시 → 로그인/로그아웃 처리 → 데이터 로드 → UI 렌더
 */

import { auth, onAuthStateChanged } from './firebase.js';
import {
  S, applyData, setCurrentUser, subscribeToUserData, unsubscribeUserData,
} from './state.js';
import { showApp, showAuthScreen } from './auth.js';
import { renderHome, renderRegList, gp } from './ui.js';
import { renderCal, renderStickerPicker } from './calendar.js';
import { renderChecklist } from './checklist.js';

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

  // 현재 열려있는 페이지만 렌더 (불필요한 중복 렌더 방지)
  if (document.getElementById('pg-calendar').classList.contains('on')) {
    renderCal();
    renderStickerPicker();
  }
  if (document.getElementById('pg-checklist').classList.contains('on')) {
    renderChecklist();
  }
}

/* ── Firebase Auth 상태 감시 ── */
onAuthStateChanged(auth, (user) => {
  if (user) {
    setCurrentUser(user);
    showApp(user);
    subscribeToUserData(onDataLoaded);
  } else {
    setCurrentUser(null);
    unsubscribeUserData();
    showAuthScreen();
  }
});
