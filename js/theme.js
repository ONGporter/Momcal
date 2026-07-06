/**
 * js/theme.js — v0.0.5
 * 설정 탭 — 다크 모드 토글
 *
 * - 선택값은 localStorage(momcal_theme)에 저장하고, <html data-theme="dark"> 속성으로 전환
 * - 실제 색상 전환은 css/main.css의 `html[data-theme="dark"] { ... }` 변수 재정의가 담당
 * - index.html <head> 맨 위의 인라인 스크립트가 저장된 값을 CSS 로드 전에 미리 적용해둬서,
 *   페이지를 열 때 밝은 화면이 잠깐 번쩍이는 현상(FOUC)이 없음
 * - 육아정보 페이지(guide/)는 정적 SEO 페이지라 이번 버전에서는 다크 모드 대상에서 제외함
 *   (앱 본체에서만 지원 — docs/TODO.md 참고)
 * ⚠️ 캘린더 탭의 색상 테마(장미/민트/맑음/라벤더/복숭아, S.theme, Firestore에 저장)와는
 *   다른 별개 기능임 — 이 다크 모드는 기기별 localStorage 설정이라 Firestore에 저장되지 않음
 */

const THEME_KEY = 'momcal_theme';

/** 현재 저장된 테마 반환 ('light' | 'dark') */
export function getTheme() {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 저장 실패해도 화면 전환은 그대로 유지 */ }
}

/** 설정 탭의 토글 버튼 클릭 핸들러 */
export function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  renderThemeSettings();
}

/** 설정 탭 — 다크 모드 토글 UI 렌더 */
export function renderThemeSettings() {
  const wrap = document.getElementById('themeSettingsWrap');
  if (!wrap) return;

  const isDark = getTheme() === 'dark';
  wrap.innerHTML = `
    <div class="install-link" style="cursor:default">
      <span class="install-ico" style="background:${isDark ? 'var(--pul)' : 'var(--pkl)'}">${isDark ? '<span class="icon icon-sm" translate="no" aria-hidden="true">dark_mode</span>' : '<span class="icon icon-sm" translate="no" aria-hidden="true">light_mode</span>'}</span>
      <div class="install-txt">
        <div class="install-title">다크 모드</div>
        <div class="install-sub">${isDark ? '어두운 화면을 쓰고 있어요' : '화면을 어둡게 바꿔서 밤에 눈이 편해져요'}</div>
      </div>
      <button class="notif-toggle-btn" onclick="event.stopPropagation();toggleTheme()">${isDark ? '끄기' : '켜기'}</button>
    </div>`;
}

window.toggleTheme        = toggleTheme;
window.renderThemeSettings = renderThemeSettings;
