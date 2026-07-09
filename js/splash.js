/**
 * js/splash.js (v0.0.34)
 * 앱 자체 스플래시 화면 제어.
 * index.html의 #appSplash는 body 최상단에 이미 그려져 있고(로그인 확인 전부터 보임),
 * app.js가 로그인 상태 확인 + 첫 데이터 로드를 마치면 hideSplash()를 호출해 페이드아웃시킴.
 *
 * 안전장치: 어떤 이유로든(네트워크 지연, 에러 등) 정상 경로에서 hideSplash()가 호출되지
 * 않으면 화면이 스플래시에 영원히 갇히므로, 최대 대기시간(4초) 이후에는 무조건 닫는다.
 */

const SPLASH_MAX_WAIT_MS = 4000;
let _hidden = false;

export function hideSplash() {
  if (_hidden) return;
  _hidden = true;
  const el = document.getElementById('appSplash');
  if (!el) return;
  el.classList.add('out');
  // 트랜지션 종료 후 완전히 화면에서 제거(레이아웃·클릭 이벤트에서 확실히 빠지도록)
  el.addEventListener('transitionend', () => { el.style.display = 'none'; }, { once: true });
}

// 안전장치: 정상 흐름에서 못 닫혀도 4초 뒤엔 무조건 닫음
setTimeout(hideSplash, SPLASH_MAX_WAIT_MS);

// window 노출 — 기존 프로젝트 패턴과 동일(순환 import 없이 다른 모듈에서 호출 가능)
window.hideSplash = hideSplash;
