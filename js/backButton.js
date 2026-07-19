/**
 * js/backButton.js — v0.4.6 신규
 *
 * "뒤로가기 누르면 앱이 바로 종료된다. 종료 확인을 띄우거나, 전에 있던 화면으로 가지게
 * 해달라"는 옹짐꾼님 요청. 이 저장소엔 Android 네이티브 프로젝트가 없어(v0.3.26에서 이미
 * 확인됨) onBackPressed()를 직접 못 건드리므로, 표준 History API(pushState/popstate)만으로
 * 최대한 가깝게 구현함:
 *
 * - 탭을 이동할 때마다(js/ui.js의 gp()) 방문 순서를 우리 자체 배열(_tabStack)에 쌓고,
 *   똑같이 history.pushState()로 브라우저/TWA 히스토리에도 한 칸씩 쌓음.
 * - 뒤로가기(popstate)가 오면: 쌓아둔 탭이 더 있으면 그 이전 탭으로 화면을 돌려놓고,
 *   다음 뒤로가기도 우리가 계속 가로챌 수 있도록 pushState로 항목을 다시 채워둠
 *   → 결과적으로 "뒤로가기 = 이전 탭으로 이동"이 됨(요청 2번째 안).
 * - 더 갈 곳이 없으면(홈 화면까지 다 돌아온 상태) confirm()으로 "정말 종료할지" 물어봄
 *   → 취소하면 다시 채워서 앱에 머무름, 확인하면 더 이상 안 채워서 다음 뒤로가기에
 *   실제로 앱이 닫히게 둠(요청 1번째 안 — confirm 시점에 100% 즉시 종료까지는 웹 표준
 *   API로 보장할 수 없지만, 최소한 실수로 바로 꺼지던 원래 문제는 확실히 막아줌).
 */

let _tabStack = ['home'];
let _restoring = false; // popstate로 복원 중인 이동은 다시 스택에 쌓지 않기 위한 가드

/** js/ui.js의 gp()가 탭을 옮길 때마다 호출 — 정상적인(뒤로가기가 아닌) 이동만 스택에 기록함 */
export function recordTabVisit(page) {
  if (_restoring) { _restoring = false; return; }
  if (_tabStack[_tabStack.length - 1] === page) return; // 같은 탭 재클릭은 무시
  _tabStack.push(page);
  history.pushState({ momcalTab: page }, '');
}

function handlePopState() {
  if (_tabStack.length > 1) {
    _tabStack.pop();
    const prevPage = _tabStack[_tabStack.length - 1];
    _restoring = true;
    window.gp(prevPage, document.querySelector(`.np[data-page="${prevPage}"]`));
    history.pushState({ momcalTab: prevPage }, ''); // 다음 뒤로가기도 계속 가로챌 수 있도록 다시 채워둠
    return;
  }
  // 더 갈 곳이 없음(홈 화면) — 정말 종료할지 확인
  if (!confirm('맘캘을 종료할까요?')) {
    history.pushState({ momcalTab: 'home' }, ''); // 취소하면 다시 채워서 앱에 머무름
  }
  // 확인을 눌렀으면 여기서 더 안 채움 — 다음 뒤로가기(또는 이 시점 이후 첫 뒤로가기)에 실제 종료됨
}

/** 앱 시작 시 1회 호출 — js/app.js에서 실행 */
export function initBackButtonHandling() {
  history.replaceState({ momcalTab: 'home' }, ''); // 시작 지점 표시(스택은 안 늘림)
  history.pushState({ momcalTab: 'home' }, '');     // 버퍼 1개 확보 — 있어야 첫 뒤로가기도 popstate로 잡힘
  window.addEventListener('popstate', handlePopState);
}
