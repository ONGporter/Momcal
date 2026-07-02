/**
 * js/pwaInstall.js
 * 홈 탭 "우리 가족" 아래 — 홈 화면에 추가(PWA 설치) 링크 (Sprint 12)
 *
 * - Android/Chrome 등: beforeinstallprompt 이벤트를 캡처해뒀다가
 *   링크 탭 시 네이티브 설치 프롬프트를 띄움
 * - iOS Safari: beforeinstallprompt 미지원 → "공유 → 홈 화면에 추가"
 *   수동 안내 모달을 대신 보여줌
 * - 이미 홈 화면에서 실행 중(standalone)이면 링크 자체를 숨김
 */

import { showModal } from './modal.js';

/** 브라우저가 캡처해둔 설치 프롬프트 이벤트 (Android/Chrome 계열) */
let deferredPrompt = null;

/** 현재 standalone(이미 설치되어 실행 중) 여부 */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari 구버전 대응
}

/** iOS(Safari 계열) 여부 */
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

/** 홈 탭 "홈 화면에 추가" 링크 렌더 */
export function renderPwaInstallLink() {
  const wrap = document.getElementById('pwaInstallWrap');
  if (!wrap) return;

  // 이미 설치되어 앱처럼 실행 중이면 링크 숨김
  if (isStandalone()) {
    wrap.innerHTML = '';
    return;
  }

  // Android/Chrome 등 — 네이티브 설치 프롬프트 사용 가능
  if (deferredPrompt) {
    wrap.innerHTML = installLinkHTML('installPwa()');
    return;
  }

  // iOS Safari — beforeinstallprompt 미지원, 수동 안내로 대체
  if (isIOS()) {
    wrap.innerHTML = installLinkHTML('showIosInstallGuide()');
    return;
  }

  // 설치를 지원하지 않는 환경 — 링크 숨김
  wrap.innerHTML = '';
}

function installLinkHTML(onclick) {
  return `
    <div class="install-link" onclick="${onclick}">
      <span class="install-ico">📲</span>
      <div class="install-txt">
        <div class="install-title">홈 화면에 추가</div>
        <div class="install-sub">앱처럼 빠르고 편하게 열어보세요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** Android/Chrome 등 — 네이티브 설치 프롬프트 실행 */
async function installPwa() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null; // 한 번 쓴 프롬프트는 재사용 불가
  renderPwaInstallLink();
}

/** iOS — 수동 설치 안내 모달 */
function showIosInstallGuide() {
  showModal('📲 홈 화면에 추가하기', `
    <div style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
      <p style="margin-bottom:14px">사파리 브라우저에서 아래 순서대로 진행해주세요.</p>
      <ol style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:10px">
        <li>화면 하단(또는 상단)의 <b style="color:var(--pk)">공유 버튼 ⬆️</b>을 탭하세요</li>
        <li>메뉴에서 <b style="color:var(--pk)">"홈 화면에 추가"</b>를 선택하세요</li>
        <li>오른쪽 위 <b style="color:var(--pk)">"추가"</b>를 탭하면 완료예요!</li>
      </ol>
      <p style="margin-top:16px;font-size:.76rem;color:var(--txl)">
        ※ 아이폰의 크롬 등 다른 브라우저를 쓰신다면 메뉴 위치가 조금 다를 수 있어요. 사파리 사용을 권장해요.
      </p>
    </div>
    <button class="bpk" style="width:100%;margin-top:18px" onclick="cm()">확인했어요</button>
  `);
}

/* ── 설치 프롬프트 이벤트 감시 ── */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();      // 브라우저 기본 미니 인포바 대신 우리 링크로 유도
  deferredPrompt = e;
  renderPwaInstallLink();
});

/* ── 설치 완료 시 링크 제거 ── */
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  renderPwaInstallLink();
});

// 인라인 onclick / 다른 모듈에서 호출할 수 있도록 window에 노출
window.installPwa            = installPwa;
window.showIosInstallGuide   = showIosInstallGuide;
window.renderPwaInstallLink  = renderPwaInstallLink;
