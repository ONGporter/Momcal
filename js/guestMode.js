/**
 * js/guestMode.js — Sprint 15
 * 로그인 없이도 앱을 곧바로 실제로 쓸 수 있는 "게스트 모드"
 *
 * 기존 js/demoMode.js("체험하기")는 저장이 전혀 안 되는 샘플 데이터 미리보기였다면,
 * 게스트 모드는 실제 사용자의 진짜 데이터를 이 브라우저의 localStorage에 저장한다.
 * Firebase 로그인을 하지 않은 기본 상태 = 게스트 모드이며, 로그인은 "다른 기기와도
 * 동기화하고 싶을 때 하는 백업/동기화용 선택 사항"으로 재배치된다 (Sprint 15).
 *
 * ⚠️ localStorage는 기기·브라우저 단위로 저장되므로, 다른 기기에서는 보이지 않는다.
 * 기기 간 동기화가 필요하면 로그인(회원가입)을 안내한다.
 *
 * 로그인 성공 시 데이터 이전 규칙 (js/app.js의 onDataLoaded에서 처리):
 *  - Firestore에 아직 문서가 없는 완전히 새 계정이고, 이 기기에 게스트 데이터가 있으면
 *    → 게스트 데이터를 그대로 계정으로 업로드(최초 1회)하고 로컬 게스트 데이터는 정리한다.
 *  - 이미 데이터가 있는 기존 계정으로 로그인한 경우 → 클라우드 데이터를 그대로 사용하고,
 *    이 기기의 게스트 데이터는 덮어쓰지 않기 위해 손대지 않는다(남겨둠).
 */

import { S, applyData, emptyState } from './state.js';
import { hideSplash } from './splash.js'; // v0.0.34: 앱 자체 스플래시 — 게스트 모드 첫 렌더 완료 시점에 닫음

const GUEST_KEY = 'momcal_guest_v1';

/** localStorage에서 게스트 데이터 원본 읽기 (파싱 실패 시 null) */
function readGuestRaw() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** 의미 있는 게스트 데이터(등록된 아이가 1명 이상)가 있는지 여부 */
export function hasGuestData() {
  const data = readGuestRaw();
  return !!(data && Array.isArray(data.children) && data.children.length > 0);
}

/** 게스트 데이터 가져오기 (없으면 빈 상태) */
export function getGuestData() {
  return readGuestRaw() || emptyState();
}

/** 게스트 데이터 삭제 (계정으로 이전 완료 후 정리용) */
export function clearGuestData() {
  try { localStorage.removeItem(GUEST_KEY); } catch (e) { /* 무시 */ }
}

/** 현재 S를 게스트 데이터로 localStorage에 저장 (Firestore 저장 필드와 동일 구성) */
export function saveGuestData() {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({
      children:      S.children,
      customEvs:     S.customEvs,
      dayStickers:   S.dayStickers,
      checks:        S.checks,
      eventMods:     S.eventMods || {},
      growthRecords: S.growthRecords || [],
      itemFeedback:  S.itemFeedback || {},
      evColors:      S.evColors || {},
      theme:         S.theme,
      selC:          S.selC,
      updatedAt:     Date.now(),
    }));
    flashGuestSave();
  } catch (e) {
    console.error('게스트 데이터 저장 실패', e);
  }
}

/** 저장 완료 배지 표시 (state.js의 flashSave와 동일한 UI 재사용) */
function flashGuestSave() {
  const el = document.getElementById('saveBadge');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

/** 게스트 모드로 앱 화면 렌더 (로그인 없이 바로 사용) */
export function enterGuestMode() {
  S.isGuestMode = true;
  applyData(getGuestData());

  document.getElementById('authScreen').style.display = 'none';
  const userChip  = document.getElementById('userChip');
  const loginChip = document.getElementById('guestLoginChip');
  if (userChip)  userChip.style.display  = 'none';
  if (loginChip) loginChip.style.display = 'flex';

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
  hideSplash();
}

// window 노출 — state.js에서 순환 import 없이 호출하기 위해 (기존 프로젝트 패턴과 동일)
window.enterGuestMode = enterGuestMode;
window.saveGuestData  = saveGuestData;
