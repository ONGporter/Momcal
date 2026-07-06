/**
 * js/calFontSize.js — v0.0.16 신규
 * 설정 탭 — 캘린더 안 글자 크기 조절
 *
 * 배경: 캘린더 셀 안 일정 텍스트(.ev-line/.ev-more, 주간 뷰 .week-ev-block)는 셀 공간이
 * 빠듯해서 과거부터 rem이 아니라 px로 고정해왔음(js/fontSize.js 주석 참고) — 그 말은 앱
 * 전체 글자 크기(5단계) 설정을 바꿔도 캘린더 안 글자만은 그대로였다는 뜻. "캘린더 글자가
 * 너무 작다"는 피드백에 앱 전체를 키우는 대신, 캘린더 전용 글자 크기를 별도로 조절할 수 있게 함.
 *
 * - 선택값은 localStorage(momcal_cal_fontsize)에 저장하고, <html data-cal-fontsize="sm|lg|xl">
 *   속성으로 전환('md'/보통은 기본값이라 속성을 따로 붙이지 않음)
 * - 실제 크기 전환은 css/calendar.css의 html[data-cal-fontsize="..."] 재정의가 담당
 * - 앱 전체 글자 크기 설정(js/fontSize.js)과는 완전히 별개로 동작함(서로 곱해지지 않음 —
 *   두 설정이 같이 켜져 있어도 각자 자기 담당 요소만 조절)
 */

const CAL_FONTSIZE_KEY = 'momcal_cal_fontsize';
const CAL_SIZES = [
  { key: 'sm', label: '작게' },
  { key: 'md', label: '보통' },
  { key: 'lg', label: '크게' },
  { key: 'xl', label: '매우 크게' },
];

/** 현재 저장된 캘린더 글자 크기 반환 ('sm' | 'md' | 'lg' | 'xl') */
export function getCalFontSize() {
  const v = localStorage.getItem(CAL_FONTSIZE_KEY);
  return CAL_SIZES.some(s => s.key === v) ? v : 'md';
}

/** 설정 탭의 버튼 클릭 핸들러 */
export function setCalFontSize(size) {
  if (size === 'md') {
    document.documentElement.removeAttribute('data-cal-fontsize');
  } else {
    document.documentElement.setAttribute('data-cal-fontsize', size);
  }
  try { localStorage.setItem(CAL_FONTSIZE_KEY, size); } catch (e) { /* 저장 실패해도 화면 전환은 그대로 유지 */ }
  renderCalFontSizeSettings();
}

/** 설정 탭 — 캘린더 글자 크기 버튼 UI 렌더 */
export function renderCalFontSizeSettings() {
  const wrap = document.getElementById('calFontSizeSettingsWrap');
  if (!wrap) return;

  const cur = getCalFontSize();
  wrap.innerHTML = `
    <div class="install-link" style="cursor:default">
      <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span></span>
      <div class="install-txt">
        <div class="install-title">캘린더 글자 크기</div>
        <div class="install-sub">캘린더 안 일정 글자만 따로 조절해요</div>
      </div>
    </div>
    <div class="fontsize-seg fontsize-seg-5">
      ${CAL_SIZES.map(s => `
        <button class="fontsize-seg-btn ${s.key === cur ? 'on' : ''}"
                onclick="setCalFontSize('${s.key}')">${s.label}</button>
      `).join('')}
    </div>`;
}

/** 캘린더 툴바의 "⚙️ 설정" 바로가기 — 설정 탭으로 이동 */
export function goToCalSettings() {
  const btn = document.querySelector('.np[data-page=settings]');
  window.gp?.('settings', btn);
}

window.setCalFontSize         = setCalFontSize;
window.renderCalFontSizeSettings = renderCalFontSizeSettings;
window.goToCalSettings        = goToCalSettings;
