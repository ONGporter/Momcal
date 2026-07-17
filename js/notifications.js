/**
 * js/notifications.js — Sprint 29, v0.0.2에서 알림 끄기 토글 추가, v0.0.7에서 세부 설정 추가
 * 알림 기능 1차 버전 (브라우저 알림 권한 기반의 "로컬" 알림)
 *
 * v0.0.42: 예전엔 이 로컬 알림("알림 켜짐")과 js/push.js의 진짜 FCM 푸시("진짜 푸시 알림 켜짐")가
 * 설정 탭에 별개 카드로 떠 있어서 사용자 입장에서 알림이 중복돼 보인다는 피드백을 받음.
 * 이제 이 파일이 유일한 UI 진입점 — 토글을 켜면 로컬 확인(이 파일)과 로그인 사용자의 FCM
 * 등록(js/push.js의 enablePushNotifications)이 함께 이뤄짐. js/push.js는 더 이상 자체 UI를
 * 그리지 않음.
 *
 * ⚠️ 중요 — 진짜 FCM 푸시 알림(앱을 완전히 꺼도 정해진 시각에 오는 알림)은 아직 아님.
 * 그걸 만들려면 아래 3가지가 필요한데, 전부 Firebase 콘솔 소유자 권한이나 유료 요금제가
 * 필요해서 코드만으로는 대신할 수 없었음 (docs/TODO.md에 상세 안내 남겨둠):
 *   1. Firebase 콘솔에서 Cloud Messaging 사용 설정 + VAPID 키 발급
 *   2. firebase-messaging-sw.js 서비스워커 추가 및 등록
 *   3. "예방접종 하루 전"처럼 특정 시각에 알림을 실제로 "보내는" 서버 쪽 스케줄러
 *      (Firebase Cloud Functions + Cloud Scheduler — Blaze(종량제) 요금제 필요)
 *
 * 대신 이번엔 "앱을 열었을 때(포그라운드)" 아래 조건에 해당하면 알림을 띄우는
 * 방식으로 구현함 — 매일 앱을 여는 부모에게는 실질적으로 비슷한 효과를 기대할 수 있음.
 *  - 오늘 예정된 일정(예방접종·건강검진·이유식·정부지원)이 있는 경우
 *  - 정부지원 마감이 임박한 경우 (Sprint 20의 isGovDeadlineSoon 재사용)
 * 하루 한 번만 뜨도록 localStorage에 마지막 알림 날짜를 기록해둠.
 *
 * v0.0.2: 브라우저 알림 권한(Notification.permission) 자체는 JS로 되돌릴 수 없어서
 * (권한 취소는 브라우저/기기 설정에서만 가능), 앱 안에서 껐다 켰다 할 수 있는 별도의
 * "알림 사용 여부" 플래그(localStorage)를 추가함 — 권한은 유지한 채 알림 표시만 끔.
 *
 * v0.0.7: 알림 세부 설정 2가지 추가
 *  - 카테고리별 on/off: "오늘 일정" 알림과 "정부지원 마감" 알림을 따로 껐다 켤 수 있음
 *  - 알림 받을 시간대: "언제든/오전/낮/저녁" 중 고르면, 그 시간대에 앱을 열었을 때만 알림이 뜸.
 *    ⚠️ 이건 정해진 시각에 알림을 "보내주는" 게 아니라, 그 시간대에 앱을 열어야 알림이 뜨는
 *    방식이라는 한계는 그대로임 — 그래도 "오전에만"으로 해두면 밤늦게 앱을 열었을 때
 *    알림이 안 뜨게 걸러주는 효과는 있음. 시간대를 벗어나 알림을 건너뛴 날은
 *    "오늘 확인함" 처리를 하지 않아서, 같은 날 나중에 그 시간대 안에 다시 앱을 열면 정상적으로 뜸
 */

import { today, stripLeadingEmoji } from './utils.js';
import { getAllEvs, isGovDeadlineSoon } from './calendar.js';
import { enablePushNotifications, PUSH_TOKEN_SAVED_KEY } from './push.js'; // v0.0.42: 로컬 알림 + 진짜 푸시(FCM)를 하나의 토글로 통합
import { getCurrentUser } from './state.js';

const LAST_NOTIFIED_KEY = 'momcal_last_notified_date';
const NOTIF_ENABLED_KEY = 'momcal_notif_enabled'; // v0.0.2
const NOTIF_CAT_TODAY_KEY = 'momcal_notif_cat_today'; // v0.0.7
const NOTIF_CAT_GOV_KEY   = 'momcal_notif_cat_gov';   // v0.0.7
const NOTIF_WINDOW_KEY    = 'momcal_notif_window';    // v0.0.7: 'any' | 'morning' | 'afternoon' | 'evening'
const PERM_CONFIRMED_KEY  = 'momcal_notif_perm_confirmed'; // v0.3.21

const TIME_WINDOWS = [
  { key: 'any',       label: '언제든' },
  { key: 'morning',   label: '오전 (6~12시)' },
  { key: 'afternoon', label: '낮 (12~18시)' },
  { key: 'evening',   label: '저녁 (18~24시)' },
];

/**
 * v0.3.15: requestPermission() 프로미스가 'granted'로 resolve된 직후에도, 일부 모바일
 * 브라우저(특히 Android Chrome)에서는 전역 Notification.permission 값이 아주 짧게(수십~
 * 수백ms) 'default'로 읽히는 타이밍 버그가 있음(js/push.js v0.3.14 주석에서 이미 확인된
 * 문제). 이 함수 바로 아래 requestNotificationPermission()이 renderNotificationSettings()를
 * 그 즉시 다시 부르면서 이 값을 재조회하다 보니, 실제로는 방금 허용됐는데도 "알림 받기"
 * 화면으로 도로 튕겨 보이고, 뒤이어 enablePushNotifications()가 부르는 Firebase
 * getToken()도 같은 순간 권한이 없다고 오판해 requestPermission()을 한 번 더 호출해서
 * 네이티브 허용 팝업이 한 클릭에 2번 뜨는 문제로 이어졌음(옹짐꾼님 제보, 2026-07-17).
 *
 * v0.3.21: [Firebase 이중 팝업 회피용 — UI를 막는 대기가 아님] 이 함수는 오직
 * enablePushNotifications() 호출 여부를 정할 때만 쓰임(아래 requestNotificationPermission()
 * 참고). 화면(UI) 갱신은 더 이상 이 함수를 기다리지 않음 — v0.3.20까지는 여기서 최대 2.5초를
 * 기다린 "뒤에" 화면을 그려서 사용자 입장에서 허용 버튼을 누르고 2.5초씩 멈춰있는 것처럼
 * 느껴졌음(옹짐꾼님 피드백, 2026-07-17). 이제 화면은 즉시 바뀌고, 이 대기는 Firebase의
 * 이중 팝업을 막기 위한 백그라운드 판단에만 쓰여서 체감 대기시간이 없음.
 */
function waitForGrantedPermission(maxWaitMs = 2500, stepMs = 50) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function poll() {
      const granted = Notification.permission === 'granted';
      if (granted || Date.now() - start >= maxWaitMs) {
        resolve(granted);
        return;
      }
      setTimeout(poll, stepMs);
    })();
  });
}

/**
 * v0.3.21: [핵심 수정] 일부 모바일 브라우저는 사용자가 분명히 "허용"을 누르고
 * Notification.requestPermission()의 Promise도 'granted'로 정상 resolve됐는데도, 그 뒤로
 * Notification.permission을 아무리 다시 읽어도 계속 'default'로 알려주는 것으로 확인됨
 * (2.5초는 물론, 하위 설정을 바꿀 때마다 다시 읽어봐도 계속 틀린 값 — 단순 타이밍 문제가
 * 아니라 그 브라우저가 이 프로퍼티를 애초에 안 믿을 만하게 구현한 것으로 보임). 이 상태에서
 * 매번 Notification.permission을 그대로 믿고 화면을 그리면, 알림 하위 설정을 바꾸거나
 * "끄기"를 누르는 등 권한과 무관한 조작을 할 때마다 화면이 "알림 받기"로 되돌아가 보임
 * (옹짐꾼님 제보, 2026-07-17).
 *
 * 권한 자체는 실제로 브라우저에 정상 저장되어 있음(요청이 'granted'로 resolve됐다는 게
 * 그 증거) — 문제는 브라우저가 그 값을 JS에 정확히 보고를 안 해주는 것뿐이므로, 앱이
 * 직접 "한 번이라도 확실히 허용된 걸 확인했다"는 사실을 기억해두고(PERM_CONFIRMED_KEY),
 * 라이브 값이 못 미더울 때(=granted도 denied도 아닐 때) 이 기억을 우선 신뢰함. 다만 라이브
 * 값이 명시적으로 'denied'라고 답하면 그건 그대로 존중함(실제로 차단했을 수 있으므로).
 */
function effectivePermission() {
  const live = Notification.permission;
  if (live === 'granted' || live === 'denied') return live;
  return localStorage.getItem(PERM_CONFIRMED_KEY) === 'true' ? 'granted' : live;
}

/** v0.0.2: 알림 사용 여부 — 값이 없으면(처음 권한을 받았을 때) 기본 켜짐으로 취급 */
function isNotifEnabled() {
  return localStorage.getItem(NOTIF_ENABLED_KEY) !== 'false';
}

/** v0.0.7: 카테고리별 on/off — 값이 없으면 기본 켜짐 */
function isCategoryEnabled(catKey) {
  return localStorage.getItem(catKey) !== 'false';
}

/** v0.0.7: 카테고리 토글 버튼 클릭 핸들러 */
export function toggleNotifCategory(catKey) {
  localStorage.setItem(catKey, isCategoryEnabled(catKey) ? 'false' : 'true');
  renderNotificationSettings();
}

/** v0.0.7: 현재 저장된 알림 시간대 */
function getTimeWindow() {
  const v = localStorage.getItem(NOTIF_WINDOW_KEY);
  return TIME_WINDOWS.some(w => w.key === v) ? v : 'any';
}

/** v0.0.7: 알림 시간대 select 변경 핸들러 */
export function setNotifWindow(value) {
  localStorage.setItem(NOTIF_WINDOW_KEY, value);
  renderNotificationSettings();
}

/** v0.0.7: 지금이 선택된 알림 시간대 안인지 확인 */
function isWithinTimeWindow() {
  const w = getTimeWindow();
  if (w === 'any') return true;
  const hour = new Date().getHours();
  if (w === 'morning')   return hour >= 6  && hour < 12;
  if (w === 'afternoon') return hour >= 12 && hour < 18;
  if (w === 'evening')   return hour >= 18 && hour < 24;
  return true;
}

/** v0.0.2: 알림 켜기/끄기 토글 버튼 클릭 핸들러
 *  v0.0.42: 로그인 사용자면 로컬 알림과 함께 진짜 푸시(FCM) 등록도 시도함 */
export function toggleNotifications(enable) {
  localStorage.setItem(NOTIF_ENABLED_KEY, enable ? 'true' : 'false');
  renderNotificationSettings();
  if (enable) {
    checkAndNotify(true);
    // v0.3.14: 이 시점은 Notification.permission이 이미 'granted'인 게 확실한 경로(아래
    // renderNotificationSettings()의 perm==='granted' 분기에서만 이 토글 버튼이 보임)라
    // enablePushNotifications()가 권한을 다시 확인/재요청하지 않도록 alreadyGranted=true 전달
    if (getCurrentUser()) enablePushNotifications(true);
  }
}

/** v0.0.7: 알림이 켜져 있을 때 "설정 탭"에 표시할 세부 설정(카테고리·시간대) */
function renderNotifSubSettings() {
  const todayOn = isCategoryEnabled(NOTIF_CAT_TODAY_KEY);
  const govOn   = isCategoryEnabled(NOTIF_CAT_GOV_KEY);
  const win     = getTimeWindow();
  return `
    <div class="notif-subsettings">
      <label class="notif-check">
        <input type="checkbox" ${todayOn ? 'checked' : ''} onchange="toggleNotifCategory('${NOTIF_CAT_TODAY_KEY}')">
        오늘 일정 알림
      </label>
      <label class="notif-check">
        <input type="checkbox" ${govOn ? 'checked' : ''} onchange="toggleNotifCategory('${NOTIF_CAT_GOV_KEY}')">
        정부지원 마감 알림
      </label>
      <div class="notif-window-row">
        <span>알림 받을 시간대</span>
        <select onchange="setNotifWindow(this.value)">
          ${TIME_WINDOWS.map(w => `<option value="${w.key}" ${w.key === win ? 'selected' : ''}>${w.label}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

/** 설정 탭 — 알림 권한 상태에 따른 안내/버튼 렌더
 *  v0.3.21: forcedPerm을 넘기면 그 값을 최우선으로 쓰고, 안 넘기면 effectivePermission()
 *  (라이브 값 + 로컬 확정 기억)으로 판단함 — 위 effectivePermission() 주석 참고 */
export function renderNotificationSettings(forcedPerm) {
  const wrap = document.getElementById('notifSettingsWrap');
  if (!wrap) return;

  if (!('Notification' in window)) {
    wrap.innerHTML = ''; // 알림 API 미지원 브라우저(일부 구형 iOS Safari 등) — 조용히 숨김
    return;
  }

  const perm = forcedPerm || effectivePermission(); // 'default' | 'granted' | 'denied'

  if (perm === 'granted') {
    if (isNotifEnabled()) {
      // v0.0.42: 로그인 사용자의 FCM 토큰이 이미 저장돼 있으면 "앱을 꺼도 받을 수 있어요"로 문구를 올려줌
      const pushReady = !!getCurrentUser() && localStorage.getItem(PUSH_TOKEN_SAVED_KEY) === 'true';
      wrap.innerHTML = `
        <div class="install-link" style="cursor:default">
          <span class="install-ico" style="background:var(--mnl)"><span class="icon icon-sm" translate="no" aria-hidden="true">notifications_active</span></span>
          <div class="install-txt">
            <div class="install-title">알림 켜짐</div>
            <div class="install-sub">${pushReady ? '앱을 완전히 꺼도 맘캘 소식을 받을 수 있어요' : '오늘 일정·마감 임박 알림을 받아요 (앱을 열었을 때 확인)'}</div>
          </div>
          <button class="notif-toggle-btn" onclick="event.stopPropagation();toggleNotifications(false)">끄기</button>
        </div>
        ${renderNotifSubSettings()}`;
      checkAndNotify();
    } else {
      wrap.innerHTML = `
        <div class="install-link" style="cursor:default;opacity:.7">
          <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">notifications_off</span></span>
          <div class="install-txt">
            <div class="install-title">알림 꺼짐</div>
            <div class="install-sub">앱에서 알림을 받지 않아요. 다시 켜면 오늘 일정을 알려드려요</div>
          </div>
          <button class="notif-toggle-btn" onclick="event.stopPropagation();toggleNotifications(true)">켜기</button>
        </div>`;
    }
    return;
  }

  if (perm === 'denied') {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default;opacity:.7">
        <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">notifications_off</span></span>
        <div class="install-txt">
          <div class="install-title">알림이 차단되어 있어요</div>
          <div class="install-sub">브라우저·기기 설정에서 맘캘 알림 권한을 허용해주세요</div>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="install-link" onclick="requestNotificationPermission()">
      <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">notifications</span></span>
      <div class="install-txt">
        <div class="install-title">알림 받기</div>
        <div class="install-sub">오늘 일정·정부지원 마감을 놓치지 않게 알려드려요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** 알림 권한 요청 (버튼 클릭 시)
 *  v0.0.42: 로그인 사용자면 허용과 동시에 진짜 푸시(FCM)도 함께 등록 시도
 *  v0.3.21: [재구성] result가 'granted'면 그 즉시(대기 없이) 화면을 갱신하고 확정 플래그를
 *  저장함 — 사용자 입장에서 허용 버튼을 누르자마자 바로 "알림 켜짐"으로 바뀜. Firebase의
 *  이중 팝업을 막기 위한 waitForGrantedPermission() 대기는 화면과 분리해 백그라운드에서만
 *  진행하고, 그 결과에 따라 enablePushNotifications() 호출 여부만 결정함(대기 중에도
 *  사용자는 이미 정상적으로 쓰고 있으니 체감 지연이 없음) */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(NOTIF_ENABLED_KEY, 'true'); // v0.0.2: 새로 허용하면 항상 켜짐 상태로 시작
    localStorage.setItem(PERM_CONFIRMED_KEY, 'true'); // v0.3.21: 라이브 값을 못 믿는 기기를 위한 로컬 기억
  }
  renderNotificationSettings(result); // v0.3.21: 대기 없이 즉시 반영
  if (result === 'granted') {
    checkAndNotify(true);
    if (getCurrentUser()) {
      // v0.3.19/21: Firebase getToken()이 아직 권한이 없다고 오판해 팝업을 한 번 더 띄우는
      // 걸 막기 위한 확인 — 화면은 이미 위에서 갱신했으니 여기서 기다려도 사용자는 못 느낌.
      // 시간 안에 확정 못 봐도(아주 느린 기기) 억지로 진행하지 않고 다음 앱 실행 때
      // js/push.js의 refreshTokenIfNeeded()가 조용히 등록을 마무리하도록 넘김
      waitForGrantedPermission().then((confirmedGranted) => {
        if (confirmedGranted) enablePushNotifications(true);
      });
    }
  }
}

/**
 * 오늘 일정·마감 임박 여부를 확인해서 알림을 띄움
 * @param {boolean} force - true면 오늘 이미 띄웠어도, 선호 시간대가 아니어도 강제로 다시 확인
 *   (권한을 방금 허용했을 때, 설정을 방금 켰을 때 등 — 사용자가 방금 한 조작에 바로 피드백을 주기 위함)
 */
export async function checkAndNotify(force = false) {
  if (!('Notification' in window) || effectivePermission() !== 'granted') return;
  if (!isNotifEnabled()) return; // v0.0.2: 앱 내에서 알림을 꺼둔 경우 표시하지 않음

  // v0.0.7: 선호 시간대가 아니면 "오늘 확인함" 처리를 하지 않고 그냥 건너뜀 —
  // 그래야 같은 날 나중에 선호 시간대 안에 다시 앱을 열었을 때 정상적으로 알림이 뜸
  if (!force && !isWithinTimeWindow()) return;

  const todayStr = today();
  if (!force && localStorage.getItem(LAST_NOTIFIED_KEY) === todayStr) return; // 하루 한 번만

  const evs = getAllEvs();
  const todayEvs  = isCategoryEnabled(NOTIF_CAT_TODAY_KEY) ? evs.filter(e => e.date === todayStr && !e.done) : [];
  const urgentGov = isCategoryEnabled(NOTIF_CAT_GOV_KEY)   ? evs.filter(e => isGovDeadlineSoon(e)) : [];

  const messages = [];
  if (todayEvs.length) {
    const names = todayEvs.slice(0, 2).map(e => stripLeadingEmoji(e.title)).join(', ');
    messages.push(`오늘 일정 ${todayEvs.length}건: ${names}${todayEvs.length > 2 ? ' 외' : ''}`);
  }
  urgentGov.forEach(e => messages.push(`⏰ ${stripLeadingEmoji(e.title)} 신청 마감이 임박했어요`));

  localStorage.setItem(LAST_NOTIFIED_KEY, todayStr);
  if (!messages.length) return;

  const body  = messages[0] + (messages.length > 1 ? ` (외 ${messages.length - 1}건)` : '');
  const title = '맘캘 MomCal';
  const opts  = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png' };

  try {
    // 서비스 워커가 준비돼 있으면 그쪽으로 띄우는 게 모바일 브라우저 호환성이 더 좋음
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, opts);
    } else {
      new Notification(title, opts);
    }
  } catch (e) {
    // 일부 환경(권한은 있지만 Notification 생성자를 막아둔 모바일 브라우저 등)에서는
    // 조용히 무시 — 알림을 못 띄워도 앱 사용 자체에는 지장 없음
  }
}

window.requestNotificationPermission = requestNotificationPermission;
window.renderNotificationSettings    = renderNotificationSettings;
window.checkAndNotify                = checkAndNotify;
window.toggleNotifications           = toggleNotifications;
window.toggleNotifCategory           = toggleNotifCategory;
window.setNotifWindow                = setNotifWindow;
