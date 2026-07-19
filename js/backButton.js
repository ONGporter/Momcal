/**
 * js/backButton.js — v0.4.6 신규, v0.4.7 재설계, v0.4.9 종료 확인 삭제(단순화)
 *
 * "뒤로가기 누르면 앱이 바로 종료된다"는 옹짐꾼님 요청으로 시작한 기능. 이 저장소엔
 * Android 네이티브 프로젝트가 없어(v0.3.26에서 이미 확인됨) onBackPressed()를 직접 못
 * 건드리므로, 표준 History API(pushState/popstate)만으로 구현함.
 *
 * v0.4.9: "confirm()으로 종료 확인을 띄우고 확인을 눌러도 실제로는 안 닫힌다"(v0.4.8에서
 * window.close()로 바꿔봤지만 여전히 해결 안 됨 — 결국 스크립트가 연 적 없는 창/탭은 웹
 * 표준상 못 닫는 게 근본 원인이라, 이 프로젝트처럼 네이티브 코드가 없는 TWA에서는 "확인
 * 누르면 바로 종료"를 기술적으로 보장할 방법이 없음) → 옹짐꾼님 요청대로 종료 확인
 * 팝업 자체를 없애고, 대신 훨씬 더 단순하고 확실하게 동작하는 방식으로 바꿈:
 *   - 탭을 이동할 때마다 history.pushState()로 한 칸씩 쌓음(탭 스택은 state 객체 안에
 *     통째로 담아둠 — v0.4.7에서 도입한 방식 그대로 유지)
 *   - 뒤로가기(popstate)가 오면 그 항목에 저장된 이전 탭으로 화면만 돌려놓음(pushState를
 *     다시 하지 않음 — 여기가 핵심 단순화 포인트)
 *   - "홈 화면에서 한 번 더 뒤로가기"는 이제 우리가 쌓아둔 히스토리가 하나도 안 남은
 *     상태라 popstate 자체가 발생하지 않고, 브라우저/TWA가 그 즉시 알아서 앱을 닫음
 *     (우리 JS가 전혀 개입하지 않으므로 100% 확실하게, 지연 없이 닫힘 — confirm()이나
 *     window.close()보다 오히려 더 안정적임)
 */

let _restoring = false; // popstate로 복원 중인 이동은 다시 스택에 쌓지 않기 위한 가드

function currentStack() {
  return (history.state && history.state.tabStack) || ['home'];
}

/** js/ui.js의 gp()가 탭을 옮길 때마다 호출 — 정상적인(뒤로가기가 아닌) 이동만 히스토리에 쌓음 */
export function recordTabVisit(page) {
  if (_restoring) { _restoring = false; return; }
  const stack = currentStack();
  if (stack[stack.length - 1] === page) return; // 같은 탭 재클릭은 무시
  history.pushState({ tabStack: [...stack, page] }, '');
}

/** 뒤로가기가 오면 그 히스토리 항목에 저장된 탭으로 화면만 돌려놓음(재푸시 없음) */
function handlePopState(e) {
  const stack = (e.state && e.state.tabStack) || ['home'];
  const targetPage = stack[stack.length - 1];
  _restoring = true;
  try {
    window.gp(targetPage, document.querySelector(`.np[data-page="${targetPage}"]`));
  } finally {
    _restoring = false; // gp()가 예외로 중간에 멈추더라도 다음 popstate가 오작동하지 않도록 항상 리셋
  }
}

/** 앱 시작 시 1회 호출 — js/app.js에서 실행 */
export function initBackButtonHandling() {
  history.replaceState({ tabStack: ['home'] }, ''); // 시작 지점 표시(별도 버퍼는 안 쌓음)
  window.addEventListener('popstate', handlePopState);
}
