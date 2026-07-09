/**
 * js/splash.js (v0.0.34)
 * 앱 자체 스플래시 화면 제어.
 * index.html의 #appSplash는 body 최상단에 이미 그려져 있고(로그인 확인 전부터 보임),
 * app.js가 로그인 상태 확인 + 첫 데이터 로드를 마치면 hideSplash()를 호출해 페이드아웃시킴.
 *
 * 최소 노출 시간: 게스트 모드처럼 로컬 데이터라 로드가 거의 즉시 끝나면 스플래시가
 * 깜빡하고 지나가 버려서(v0.0.34 최초 배포 시 피드백), 로드가 아무리 빨라도 최소
 * SPLASH_MIN_MS(1.8초)는 보이도록 시작 시각을 기준으로 남은 시간만큼 지연 후 닫는다.
 *
 * 안전장치: 어떤 이유로든(네트워크 지연, 에러 등) 정상 경로에서 hideSplash()가 호출되지
 * 않으면 화면이 스플래시에 영원히 갇히므로, 최대 대기시간(4초) 이후에는 무조건 닫는다.
 * (최소 노출 시간보다 항상 크게 잡아야 함 — 안전장치가 먼저 발동해버리면 의미 없음)
 */

const SPLASH_MIN_MS = 1800;
const SPLASH_MAX_WAIT_MS = 4000;
const _startedAt = Date.now();
let _hidden = false;

function doHide() {
  if (_hidden) return;
  _hidden = true;
  const el = document.getElementById('appSplash');
  if (!el) return;
  el.classList.add('out');
  // 트랜지션 종료 후 완전히 화면에서 제거(레이아웃·클릭 이벤트에서 확실히 빠지도록)
  el.addEventListener('transitionend', () => { el.style.display = 'none'; }, { once: true });
}

export function hideSplash() {
  const elapsed = Date.now() - _startedAt;
  const remaining = SPLASH_MIN_MS - elapsed;
  if (remaining > 0) {
    setTimeout(doHide, remaining);
  } else {
    doHide();
  }
}

// 안전장치: 정상 흐름에서 못 닫혀도 4초 뒤엔 무조건 닫음(최소 노출 시간 로직을 건너뛰고 즉시 닫음)
setTimeout(doHide, SPLASH_MAX_WAIT_MS);

// window 노출 — 기존 프로젝트 패턴과 동일(순환 import 없이 다른 모듈에서 호출 가능)
window.hideSplash = hideSplash;
