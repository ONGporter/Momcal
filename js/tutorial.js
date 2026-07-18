/**
 * js/tutorial.js — v0.4.4 신규, v0.4.5에서 실제 스크린샷 추가
 *
 * 처음 가입한 사용자에게 맘캘의 핵심 기능을 소개하는 온보딩 튜토리얼(풀스크린 슬라이드).
 * "가입/로그인하는 사람한테 핵심 기능을 튜토리얼로 알려주고 싶다"는 옹짐꾼님 요청으로,
 * 다음 4가지를 반드시 포함함:
 *   1. 체크리스트 ↔ 캘린더 연동 기능
 *   2. 체크리스트 추가·제거 기능
 *   3. 체크리스트 항목 직접 추가 기능
 *   4. 이유식 캘린더로 활용하기
 *
 * v0.4.5: "아이콘+설명 말고, 아까 준 실제 화면 캡처로 확대해서 보여줄 순 없냐"는 요청으로,
 * 아이콘 대신 옹짐꾼님이 직접 찍어준 실제 앱 스크린샷을 각 단계에 넣음(icons/tutorial/*.png,
 * 원본에서 필요한 부분만 크롭). 화면을 탭하면 라이트박스로 더 크게 확대해서 볼 수 있음
 * (openTutorialImageZoom/closeTutorialImageZoom) — 작은 글자까지 잘 안 보인다는 피드백을
 * 고려해 "확대"라는 요청 취지를 한 번 더 살림. 첫/끝 단계는 스크린샷이 필요 없는 인사말이라
 * 기존처럼 아이콘 배지를 그대로 씀.
 *
 * 표시 조건: "이 기기에서 튜토리얼을 본 적이 있는지"를 localStorage로 기기 단위 판단함
 * (Firestore/계정 데이터에는 안 넣음 — 다른 기기에서 로그인하면 다시 한번 보여줘도 튜토리얼
 * 성격상 자연스럽고, 굳이 스키마에 필드를 추가할 만큼 중요한 값도 아님).
 * - 이메일 회원가입 성공 직후, Google 로그인이 신규 계정 생성인 경우(getAdditionalUserInfo)
 *   자동으로 한 번 뜸(js/auth.js에서 호출)
 * - 설정 탭의 "튜토리얼 다시보기" 버튼으로 언제든 다시 볼 수 있음(js/ui.js 정착 화면)
 */

const TUTORIAL_SEEN_KEY = 'momcal_tutorial_seen';

const TUTORIAL_STEPS = [
  {
    icon: 'waving_hand',
    bg: '#FDE0EC',
    title: '맘캘에 오신 걸 환영해요!',
    desc: '임신부터 육아까지, 놓치기 쉬운 일정과 준비물을 체크리스트와 캘린더로 한 번에 챙길 수 있어요. 핵심 기능 몇 가지만 30초만 보고 가세요.',
  },
  {
    img: './icons/tutorial/calendar-sync.png',
    title: '체크리스트 ↔ 캘린더, 자동으로 연동돼요',
    desc: '예방접종·건강검진처럼 시기가 정해진 체크리스트는 캘린더에 자동으로 일정이 생겨요. 체크리스트에서 완료 체크하면 캘린더의 그 일정에도 완료 표시가 함께 남아요.',
  },
  {
    img: './icons/tutorial/checklist-settings.png',
    title: '체크리스트, 필요한 것만 골라 보세요',
    desc: '안 쓰는 체크리스트는 숨기고, 출산가방·100일 준비 같은 준비물 팩은 필요할 때 "＋ 추가하기"로 켤 수 있어요. 설정 탭 → 체크리스트 관리에서 언제든 바꿀 수 있어요.',
  },
  {
    img: './icons/tutorial/checklist-add-item.png',
    title: '목록에 없는 항목은 직접 추가해요',
    desc: '각 체크리스트 맨 아래 "항목 직접 추가하기"를 누르면 우리 아이한테만 필요한 항목도 자유롭게 만들 수 있어요.',
  },
  {
    img: './icons/tutorial/food-calendar.png',
    title: '이유식 캘린더로도 활용해보세요',
    desc: '이유식도 스티커로 기록하면 캘린더가 그대로 이유식 다이어리가 돼요. 이유식 필터를 켜면 그날 먹인 이유식과 양(g)이 캘린더에 크게 보여요.',
  },
  {
    icon: 'celebration',
    bg: '#FDE0EC',
    title: '이제 시작해볼까요?',
    desc: '궁금한 기능이 더 있으면 설정 탭에서 "튜토리얼 다시보기"로 언제든 다시 볼 수 있어요.',
    isLast: true,
  },
];

let _step = 0;

function renderTutorialStep() {
  const body = document.getElementById('tutorialBody');
  if (!body) return;
  const s = TUTORIAL_STEPS[_step];
  const isFirst = _step === 0;

  const mediaHtml = s.img
    ? `<div class="tut-shot-wrap" onclick="openTutorialImageZoom('${s.img}')">
         <img class="tut-shot" src="${s.img}" alt="">
         <span class="tut-shot-zoom-hint"><span class="icon icon-sm" translate="no" aria-hidden="true">zoom_in</span> 눌러서 확대</span>
       </div>`
    : `<div class="tut-icon" style="background:${s.bg}"><span class="icon" translate="no" aria-hidden="true">${s.icon}</span></div>`;

  body.innerHTML = `
    ${mediaHtml}
    <h3 class="tut-title">${s.title}</h3>
    <p class="tut-desc">${s.desc}</p>
    <div class="tut-dots">
      ${TUTORIAL_STEPS.map((_, i) => `<span class="tut-dot${i === _step ? ' on' : ''}"></span>`).join('')}
    </div>
    <div class="tut-actions">
      ${isFirst
        ? `<button type="button" class="tut-skip-btn" onclick="closeTutorial()">건너뛰기</button>`
        : `<button type="button" class="btn bmn" onclick="tutorialPrev()">이전</button>`}
      <button type="button" class="btn bpk" onclick="${s.isLast ? 'closeTutorial()' : 'tutorialNext()'}">${s.isLast ? '시작하기' : '다음'}</button>
    </div>
  `;
}

/** 튜토리얼 열기 — 설정 탭의 "다시보기" 버튼과 신규 가입 후 자동 호출 둘 다 이 함수로 진입 */
export function openTutorial() {
  _step = 0;
  const screen = document.getElementById('tutorialScreen');
  if (!screen) return;
  screen.style.display = 'flex';
  renderTutorialStep();
}

export function closeTutorial() {
  const screen = document.getElementById('tutorialScreen');
  if (screen) screen.style.display = 'none';
  try { localStorage.setItem(TUTORIAL_SEEN_KEY, 'true'); } catch (e) { /* 저장 실패해도 닫기는 그대로 동작 */ }
}

export function tutorialNext() {
  if (_step < TUTORIAL_STEPS.length - 1) { _step++; renderTutorialStep(); }
}

export function tutorialPrev() {
  if (_step > 0) { _step--; renderTutorialStep(); }
}

/** v0.4.5: 스크린샷을 탭하면 화면 가득 크게 보여주는 라이트박스 — 다시 탭하면 닫힘 */
export function openTutorialImageZoom(src) {
  const zoom = document.getElementById('tutorialImgZoom');
  if (!zoom) return;
  zoom.querySelector('img').src = src;
  zoom.style.display = 'flex';
}
export function closeTutorialImageZoom() {
  const zoom = document.getElementById('tutorialImgZoom');
  if (zoom) zoom.style.display = 'none';
}

/** 신규 가입 직후에만 호출 — 이 기기에서 이미 본 적 있으면 건너뜀 */
export function maybeShowTutorialForNewUser() {
  let seen = false;
  try { seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true'; } catch (e) { /* localStorage 접근 실패 시 그냥 한 번 더 보여줌(치명적이지 않음) */ }
  if (!seen) openTutorial();
}

// 인라인 onclick에서 접근할 수 있도록 전역 노출
window.openTutorial          = openTutorial;
window.closeTutorial         = closeTutorial;
window.tutorialNext          = tutorialNext;
window.tutorialPrev          = tutorialPrev;
window.openTutorialImageZoom  = openTutorialImageZoom;
window.closeTutorialImageZoom = closeTutorialImageZoom;

