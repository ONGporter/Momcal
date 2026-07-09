/**
 * js/push.js (v0.0.36, v0.0.38에서 토큰 자동 갱신 추가)
 * 진짜 FCM(Firebase Cloud Messaging) 푸시 알림 — 앱을 완전히 꺼도(백그라운드/종료 상태)
 * 알림을 받을 수 있도록 이 기기의 푸시 토큰을 발급받아 Firestore에 저장하고,
 * 앱이 열려있는 동안(포그라운드) 오는 메시지를 처리한다.
 *
 * 실제 발송(언제·누구에게)은 두 갈래로 이뤄짐:
 *  - 수동: Firebase 콘솔 "Cloud Messaging → 캠페인"에서 코드 없이 전체 사용자에게 발송
 *  - 자동(v0.0.38): `functions/index.js`의 `dailyPushCheck`가 매일 09:00(Asia/Seoul)에
 *    예방접종 하루 전 / 정부지원 마감 3일 전 / 오늘 일정을 확인해서 자동 발송함
 *
 * 로그인(계정) 사용자만 지원 — 게스트 모드는 토큰을 연결할 계정(uid)이 없어서
 * 기존 로컬 알림(js/notifications.js, 앱을 열었을 때만 확인)만 계속 사용 가능.
 * 백그라운드 수신 핸들러 자체는 sw.js의 'push' 이벤트 리스너가 처리함(이 파일은
 * 권한 요청 + 토큰 발급/저장/자동 갱신 + 포그라운드 수신만 담당).
 */

import {
  firebaseApp, setDoc,
  getMessaging, getToken, onMessage, isMessagingSupported,
} from './firebase.js';
import { getCurrentUser, userDocRef } from './state.js';

// v0.0.37: Firebase 콘솔 > 프로젝트 설정 > Cloud Messaging > 웹 구성(Web configuration)
// 탭에서 옹짐꾼님이 발급받은 "웹 푸시 인증서" 키 쌍 값으로 교체 완료.
// (만약 나중에 키를 재발급하면 이 값도 같이 교체해야 함 — 재발급 시 기존 토큰은 전부 무효화됨)
const VAPID_KEY = 'BPDAP4TNZW3vHCF80G1OWRY8FvbvXKiLNcdaGzLFcNKd3cByXiacCpJ3zlCmyWf52kmKjdq3tKeDdARqphUNqFY';

const PUSH_TOKEN_SAVED_KEY = 'momcal_push_token_saved'; // 이 기기·브라우저에 토큰 저장을 완료했는지(로컬 캐시, 재요청 방지용)

let _messagingInstance; // undefined = 아직 확인 안 함, null = 미지원, 그 외 = 인스턴스

/** Messaging 인스턴스를 안전하게 얻음(미지원 브라우저에서 예외로 앱이 죽지 않도록) */
async function getMessagingSafe() {
  if (_messagingInstance !== undefined) return _messagingInstance;
  try {
    const supported = await isMessagingSupported();
    _messagingInstance = supported ? getMessaging(firebaseApp) : null;
  } catch (e) {
    _messagingInstance = null;
  }
  return _messagingInstance;
}

/** 설정 탭 — "진짜 푸시 알림" 섹션 렌더 (js/notifications.js의 로컬 알림 섹션과 별개) */
export async function renderPushSettings() {
  const wrap = document.getElementById('pushSettingsWrap');
  if (!wrap) return;

  if (!getCurrentUser()) {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default;opacity:.7">
        <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">cloud_off</span></span>
        <div class="install-txt">
          <div class="install-title">진짜 푸시 알림</div>
          <div class="install-sub">로그인(계정) 사용자만 사용할 수 있어요 — 앱을 꺼도 알림이 와요</div>
        </div>
      </div>`;
    return;
  }

  if (!('Notification' in window)) { wrap.innerHTML = ''; return; }

  const messaging = await getMessagingSafe();
  if (!messaging) {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default;opacity:.7">
        <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">cloud_off</span></span>
        <div class="install-txt">
          <div class="install-title">진짜 푸시 알림</div>
          <div class="install-sub">이 브라우저에서는 지원되지 않아요</div>
        </div>
      </div>`;
    return;
  }

  if (Notification.permission === 'denied') {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default;opacity:.7">
        <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">cloud_off</span></span>
        <div class="install-txt">
          <div class="install-title">푸시 알림이 차단되어 있어요</div>
          <div class="install-sub">브라우저·기기 설정에서 맘캘 알림 권한을 허용해주세요</div>
        </div>
      </div>`;
    return;
  }

  if (Notification.permission === 'granted' && localStorage.getItem(PUSH_TOKEN_SAVED_KEY) === 'true') {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default">
        <span class="install-ico" style="background:var(--mnl)"><span class="icon icon-sm" translate="no" aria-hidden="true">cloud_done</span></span>
        <div class="install-txt">
          <div class="install-title">진짜 푸시 알림 켜짐</div>
          <div class="install-sub">이 기기는 앱을 꺼도 맘캘 소식을 받을 수 있어요</div>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="install-link" onclick="enablePushNotifications()">
      <span class="install-ico"><span class="icon icon-sm" translate="no" aria-hidden="true">cloud_sync</span></span>
      <div class="install-txt">
        <div class="install-title">진짜 푸시 알림 켜기</div>
        <div class="install-sub">앱을 완전히 꺼도 맘캘 소식을 받을 수 있어요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** 버튼 클릭 — 알림 권한 요청 + FCM 토큰 발급 + Firestore 저장 */
export async function enablePushNotifications() {
  if (!getCurrentUser() || !('Notification' in window)) return;

  const perm = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (perm !== 'granted') { renderPushSettings(); return; }

  await fetchAndSaveToken();
  renderPushSettings();
}

/**
 * v0.0.38: 토큰 자동 갱신 — 앱을 열 때마다(권한이 이미 허용된 상태라면) 조용히
 * 다시 호출됨. FCM은 별도의 "토큰이 바뀌었다" 이벤트를 안 주기 때문에(구버전 SDK의
 * onTokenRefresh()는 모듈형 SDK에서 사라짐), 매번 getToken()을 다시 불러서 값이
 * 바뀌었으면(브라우저가 내부적으로 재발급한 경우) 새 값을 Firestore에 반영하는 방식으로
 * "갱신"을 대신함 — 대부분은 같은 토큰이 그대로 와서 updatedAt만 갱신되고 끝남.
 * 만료·무효화된 예전 토큰은 서버(functions/index.js의 sendToUser)가 발송 실패 응답을
 * 보고 자동으로 Firestore에서 지워주므로, 여기서는 "최신 토큰을 계속 보고"하는
 * 역할만 하면 됨. 버튼을 누른 적 없는 사용자(권한 자체가 없음)에게는 아무 일도 안 함.
 */
export async function refreshTokenIfNeeded() {
  if (!getCurrentUser() || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  await fetchAndSaveToken();
}

/** getToken() 호출 + Firestore 저장 — enablePushNotifications/refreshTokenIfNeeded 공용 */
async function fetchAndSaveToken() {
  const messaging = await getMessagingSafe();
  if (!messaging) return;

  try {
    // sw.js — 앱쉘 캐싱용으로 이미 등록돼있는 서비스워커를 그대로 재사용(전용
    // firebase-messaging-sw.js를 별도로 안 둠 — sw.js 상단 v0.0.36 주석 참고)
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      await saveTokenToFirestore(token);
      localStorage.setItem(PUSH_TOKEN_SAVED_KEY, 'true');
    }
  } catch (e) {
    // VAPID_KEY가 아직 플레이스홀더거나 콘솔에서 Cloud Messaging을 안 켠 상태 등에서
    // 여기로 옴 — 이 기능만 조용히 안 켜질 뿐 앱 사용에는 지장 없음
    console.warn('푸시 토큰 발급 실패(Firebase 콘솔 Cloud Messaging 설정 확인 필요):', e);
  }
}

/**
 * FCM 토큰을 로그인한 사용자 문서(users/{uid})에 저장 — 가족 그룹에 속해있어도
 * 항상 users/{uid}에 저장함(이 토큰은 "이 계정으로 로그인한 이 브라우저"를 가리키는
 * 값이라 공유 데이터 문서(families/{familyId})가 아니라 개인 계정 문서가 맞는 자리).
 * 여러 기기/브라우저에서 로그인하면 토큰이 여러 개 쌓일 수 있어서 맵으로 저장.
 */
async function saveTokenToFirestore(token) {
  await setDoc(userDocRef(), {
    fcmTokens: {
      [token]: { updatedAt: Date.now(), ua: navigator.userAgent.slice(0, 200) },
    },
  }, { merge: true });
}

/** 앱이 열려있는 동안(포그라운드) 푸시가 오면 여기로 옴 — 앱이 꺼져있을 때는 sw.js가 대신 처리 */
async function bindForegroundListener() {
  const messaging = await getMessagingSafe();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || '맘캘 MomCal';
    const body  = payload.notification?.body  || '';
    try {
      new Notification(title, { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png' });
    } catch (e) {
      // 일부 환경에서 포그라운드 중 Notification 생성자를 막아둘 수 있음 — 조용히 무시
    }
  });
}
bindForegroundListener();

window.enablePushNotifications = enablePushNotifications;
window.renderPushSettings      = renderPushSettings;
window.refreshTokenIfNeeded    = refreshTokenIfNeeded;
