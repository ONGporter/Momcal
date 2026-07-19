/**
 * js/backButton.js — v0.4.6 신규, v0.4.7 재설계, v0.4.8 종료 확인 후 미종료 버그 수정
 *
 * "뒤로가기 누르면 앱이 바로 종료된다. 종료 확인을 띄우거나, 전에 있던 화면으로 가지게
 * 해달라"는 옹짐꾼님 요청. 이 저장소엔 Android 네이티브 프로젝트가 없어(v0.3.26에서 이미
 * 확인됨) onBackPressed()를 직접 못 건드리므로, 표준 History API(pushState/popstate)만으로
 * 최대한 가깝게 구현함.
 *
 * v0.4.7 재설계 이유: v0.4.6은 별도 JS 배열(_tabStack)로 방문 순서를 따로 추적하면서 매번
 * popstate 이후 수동으로 history.pushState()를 다시 호출해 "버퍼"를 채워두는 방식이었는데,
 * 그 재푸시를 실수로라도 건너뛰면(또는 그 사이 예외가 나면) 버퍼가 영영 사라져서 "전 페이지
 * 갔다가 한 번 더 누르면 바로 종료"·"종료 확인이 아예 안 뜸" 버그로 이어짐(옹짐꾼님 재제보).
 * 이번엔 탭 스택 자체를 history.pushState()의 state 객체 안에 통째로 담아둠 — 각 히스토리
 * 항목이 "그 시점의 스택"을 스스로 들고 있으므로, popstate로 어디로 이동하든 그 항목의
 * state를 그대로 읽으면 되고 별도로 재푸시할 필요가 없음(재푸시를 깜빡해서 버퍼가 사라지는
 * 실수 자체가 구조적으로 불가능해짐). 앱 시작 시 버퍼를 2칸(둘 다 'home' 스택) 만들어두는데,
 * 뒤로가기를 눌렀을 때 "직전까지 보이고 있던 탭"이 이미 홈이었고 이번에도 홈이면(=더 이상
 * 뒤로 갈 곳이 없는 상태) 그때 종료를 확인함.
 *
 * v0.4.8 수정: "확인을 눌러도 바로 안 닫히고 뒤로가기를 한 번 더 눌러야 닫힌다"는 재제보 —
 * 종료 확인 시점은 이미 우리가 만든 히스토리의 맨 밑바닥이라, history.back()을 호출해도
 * 더 갈 곳이 없어 조용히 무시되던 게 원인이었음(아무 반응이 없어 보였던 이유). 대신
 * window.close()를 시도하도록 바꿈(자세한 이유는 아래 confirm() 분기 주석 참고) — 다만
 * 웹 표준만으로는 "확인 클릭 즉시 100% 종료"를 보장할 방법이 없어서, 환경에 따라 확인 후
 * 뒤로가기를 한 번 더 눌러야 완전히 닫히는 경우가 있을 수 있음(네이티브 Android 프로젝트가
 * 없어 onBackPressed()를 직접 못 건드리는 근본적인 한계, v0.3.26 참고).
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

function handlePopState(e) {
  // popstate 핸들러가 실행되는 이 시점엔 아직 gp()를 안 불렀으므로, 화면엔 "뒤로가기 누르기
  // 직전까지 보이던 탭"이 그대로 남아있음 — 이걸로 "이미 홈이었는지"를 판단함
  const wasHome = document.getElementById('pg-home')?.classList.contains('on');
  const stack = (e.state && e.state.tabStack) || ['home'];
  const targetPage = stack[stack.length - 1];

  if (!wasHome || targetPage !== 'home') {
    // 홈이 아닌 곳에 있었거나, 이번에 돌아갈 곳이 홈이 아니면 → 그 탭으로 화면만 전환
    // (더 되돌아갈 곳이 남아있을 수 있으니 종료 확인은 아직 안 함)
    _restoring = true;
    try {
      window.gp(targetPage, document.querySelector(`.np[data-page="${targetPage}"]`));
    } finally {
      _restoring = false; // gp()가 예외로 중간에 멈추더라도 다음 popstate가 오작동하지 않도록 항상 리셋
    }
    return;
  }

  // 이미 홈이었고, 이번에도 홈(=더 갈 곳이 없어서 계속 홈에 머무는 상태)에서 뒤로가기 → 종료 확인
  if (confirm('맘캘을 종료할까요?')) {
    // v0.4.8: [버그 수정] "확인을 눌러도 바로 안 닫히고 한 번 더 눌러야 닫힌다"는 재제보 —
    // 원인은 이 시점이 이미 우리가 만든 히스토리의 맨 밑바닥이라(더 뒤로 갈 데가 없음)
    // history.back()을 호출해도 갈 곳이 없어 그냥 조용히 무시됐던 것(아무 일도 안 일어남).
    // window.close()를 시도함 — 일부 TWA 환경에선 이걸로 바로 닫히기도 하고, 안 되는
    // 환경에서도 부작용 없이 무시되므로(웹 표준상 스크립트가 연 적 없는 창은 못 닫음),
    // 그 경우엔 바로 다음 뒤로가기(우리 JS가 더 이상 가로챌 히스토리가 없으므로 이번엔
    // 브라우저/TWA가 직접 처리)로 확실히 닫힘. 웹 표준만으로는 "확인 클릭 즉시 100% 종료"를
    // 보장할 방법이 없음 — 네이티브 onBackPressed()를 직접 못 건드리는 이 프로젝트의
    // 근본적인 한계(v0.3.26 참고)라, 확인 후 뒤로가기 한 번을 더 눌러야 완전히 닫히는
    // 경우가 있을 수 있음을 사용자에게도 안내해둘 것
    window.close();
  } else {
    history.pushState({ tabStack: ['home'] }, ''); // 취소하면 버퍼를 다시 채워 앱에 머무름
  }
}

/** 앱 시작 시 1회 호출 — js/app.js에서 실행 */
export function initBackButtonHandling() {
  history.replaceState({ tabStack: ['home'] }, ''); // 시작 지점 표시(스택은 안 늘림)
  history.pushState({ tabStack: ['home'] }, '');     // 여분 1칸 — 홈에서 뒤로가기 눌렀을 때 종료 확인을 띄우기 위한 완충
  window.addEventListener('popstate', handlePopState);
}
