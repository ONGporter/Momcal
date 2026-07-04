/**
 * js/fontSize.js — v0.0.7
 * 설정 탭 — 글자 크기 조절 (작게/보통/크게)
 *
 * - 선택값은 localStorage(momcal_fontsize)에 저장하고, <html data-fontsize="sm|lg"> 속성으로 전환
 *   ('md'/보통은 기본값이라 속성을 따로 붙이지 않음 — css/main.css의 html { font-size: 17px } 기본 규칙 그대로 적용)
 * - 실제 크기 전환은 css/main.css의 html[data-fontsize="sm"/"lg"] { font-size: ... } 재정의가 담당.
 *   앱 대부분의 글자가 rem 단위라 루트 글자 크기만 바뀌어도 전체적으로 함께 커지거나 작아짐
 * - 캘린더 셀 안 이벤트 텍스트(.ev-line/.ev-more)는 px로 고정되어 있어 이 조절의 영향을 받지 않음(의도됨)
 * - index.html <head> 맨 위의 인라인 스크립트가 저장된 값을 미리 읽어서 적용해두기 때문에
 *   페이지 로드 시 글자 크기가 바뀌는 현상(FOUC)이 없음
 * - **육아정보 페이지(guide/)에도 동일하게 적용됨** — 같은 localStorage 값을 guide 페이지의
 *   자체 인라인 스크립트(scripts/build-guide.mjs의 head())가 읽어서 적용하고,
 *   guide/guide.css에도 css/main.css와 동일한 3단계 값이 정의되어 있음
 */

const FONTSIZE_KEY = 'momcal_fontsize';
const SIZES = [
  { key: 'sm', label: '작게' },
  { key: 'md', label: '보통' },
  { key: 'lg', label: '크게' },
];

/** 현재 저장된 글자 크기 반환 ('sm' | 'md' | 'lg') */
export function getFontSize() {
  const v = localStorage.getItem(FONTSIZE_KEY);
  return (v === 'sm' || v === 'lg') ? v : 'md';
}

/** 설정 탭의 버튼 클릭 핸들러 */
export function setFontSize(size) {
  if (size === 'md') {
    document.documentElement.removeAttribute('data-fontsize');
  } else {
    document.documentElement.setAttribute('data-fontsize', size);
  }
  try { localStorage.setItem(FONTSIZE_KEY, size); } catch (e) { /* 저장 실패해도 화면 전환은 그대로 유지 */ }
  renderFontSizeSettings();
}

/** 설정 탭 — 글자 크기 3단 버튼 UI 렌더 */
export function renderFontSizeSettings() {
  const wrap = document.getElementById('fontSizeSettingsWrap');
  if (!wrap) return;

  const cur = getFontSize();
  wrap.innerHTML = `
    <div class="install-link" style="cursor:default">
      <span class="install-ico">🔤</span>
      <div class="install-txt">
        <div class="install-title">글자 크기</div>
        <div class="install-sub">앱과 육아정보 페이지 글자 크기를 함께 조절해요</div>
      </div>
      <div class="fontsize-seg">
        ${SIZES.map(s => `
          <button class="fontsize-seg-btn ${s.key === cur ? 'on' : ''}"
                  onclick="event.stopPropagation();setFontSize('${s.key}')">${s.label}</button>
        `).join('')}
      </div>
    </div>`;
}

window.setFontSize            = setFontSize;
window.renderFontSizeSettings = renderFontSizeSettings;
