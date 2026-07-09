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
  S, applyData, setCurrentUser, subscribeToUserData, unsubscribeUserData, saveState,
} from './state.js';
import { showApp } from './auth.js';
import { enterGuestMode, hasGuestData, getGuestData, clearGuestData } from './guestMode.js';
import { renderHome, renderRegList, renderSettings, gp } from './ui.js';
import { renderCal, renderStickerPicker } from './calendar.js';
import { renderChecklist, renderClSidebar } from './checklist.js';
import { renderGrowthPage } from './growthChart.js';
import { checkAndNotify } from './notifications.js';
import './growth.js';
import './demoMode.js';
import './checklistCalendarLink.js';
import './pwaInstall.js';
import './familyShare.js';
import './accountDelete.js';
import './theme.js'; // v0.0.5: 다크 모드 — 설정 탭을 열지 않아도 window.toggleTheme 등록되도록 임포트
import './fontSize.js'; // v0.0.7: 글자 크기 조절 — 설정 탭을 열지 않아도 window.setFontSize 등록되도록 임포트
import './calFontSize.js'; // v0.0.16: 캘린더 전용 글자 크기 조절 — 설정 탭을 열지 않아도 window.setCalFontSize 등록되도록 임포트
import { hideSplash } from './splash.js'; // v0.0.34: 앱 자체 스플래시 — 첫 렌더 완료 시점에 닫음
import './push.js'; // v0.0.36: FCM 진짜 푸시 알림 — 설정 탭을 열지 않아도 window.enablePushNotifications 등록되도록 임포트

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
 * Sprint 15: Firestore에 아직 문서가 없는 완전히 새 계정(data === null)이고
 * 이 기기에 게스트로 쓰던 데이터가 있으면, 그 데이터를 그대로 계정으로 옮겨준다
 * (기존 계정으로 로그인한 경우엔 클라우드 데이터를 그대로 쓰고 게스트 데이터는 건드리지 않음).
 * @param {Object|null} data
 */
function onDataLoaded(data, hasPendingWrites) {
  if (!data && hasGuestData()) {
    applyData(getGuestData());
    S.isGuestMode = false;
    saveState();       // 최초 1회 Firestore에 업로드 (이후 onSnapshot이 다시 자연스럽게 발동됨)
    clearGuestData();   // 계정으로 옮겨졌으니 이 기기의 로컬 게스트 데이터는 정리
  } else {
    applyData(data);
  }
  syncThemeUI();
  renderHome();
  renderRegList();

  // v0.0.5: 알림 확인 UI를 설정 탭으로 옮기면서, 알림 자체는 탭 방문 여부와 무관하게
  // 앱을 열 때마다(데이터 로드 시) 항상 확인하도록 여기서 별도로 호출
  checkAndNotify();

  if (document.getElementById('pg-settings').classList.contains('on')) {
    renderSettings();
  }

  if (document.getElementById('pg-calendar').classList.contains('on')) {
    renderCal();
    renderStickerPicker();
  }

  if (document.getElementById('pg-checklist').classList.contains('on')) {
    if (_firstLoad) {
      // 초기 로드: 자동 카테고리 선택 포함 전체 렌더
      renderChecklist();
    } else if (!hasPendingWrites) {
      // onSnapshot 재발동: 사이드바 % 만 업데이트 (카테고리 선택 유지)
      // v0.0.9 버그 수정: hasPendingWrites === true는 "내 기기가 방금 debounceSave()로 쓴
      // 내용"이 로컬 캐시에서 그대로 되돌아온 에코일 뿐이라, 이미 tgCk()가 즉시 화면을
      // 갱신했으므로 여기서 또 그리면 배지 애니메이션이 중복 재생됨(체크 직후 1회 +
      // 저장 완료 시점(~600ms 후) 1회 = 총 2회 깜빡임). 실제로 다른 기기/탭에서 데이터가
      // 바뀐 경우(hasPendingWrites === false, 서버 확정 변경)에만 다시 그려 동기화한다.
      renderClSidebar();
    }
  }

  if (document.getElementById('pg-growth').classList.contains('on')) {
    // v0.0.25: 체크리스트와 동일한 hasPendingWrites 가드 적용.
    // hasPendingWrites===true는 debounceSave()가 Firestore에 쓴 내용이 로컬 캐시에서
    // 되돌아온 에코일 뿐 — 성장 기록 추가 직후 renderGrowthPage()가 이미 호출됐으므로
    // 여기서 또 그리면 그래프가 두 번 깜빡임. 서버 확정 변경(다른 기기 동기화)에만 반응.
    if (_firstLoad || !hasPendingWrites) {
      renderGrowthPage();
    }
  }

  _firstLoad = false;
  hideSplash();
}

/* ── Firebase Auth 상태 감시 ── */
onAuthStateChanged(auth, (user) => {
  if (user) {
    _firstLoad = true; // 로그인 시 첫 로드로 초기화
    S.isGuestMode = false;
    setCurrentUser(user);
    showApp(user);
    subscribeToUserData(onDataLoaded);
  } else {
    setCurrentUser(null);
    unsubscribeUserData();
    // Sprint 15: 로그인 안 된 기본 상태 = 게스트 모드 (로그인 화면으로 막지 않고 바로 앱 사용)
    enterGuestMode();
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
