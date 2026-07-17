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
export { PUSH_TOKEN_SAVED_KEY }; // v0.0.42: js/notifications.js가 통합 알림 카드에서 "진짜 푸시로 켜졌는지" 표시할 때 씀

/* v0.3.18: 아래 두 키는 "마지막으로 Firestore에 실제 저장한 토큰 값·시각"을 기억해서
 * saveTokenToFirestore()의 무의미한 반복 호출을 막는 용도(무한 루프 버그 수정, 아래
 * fetchAndSaveToken() 주석 참고) */
const PUSH_TOKEN_VALUE_KEY    = 'momcal_push_token_value';
const PUSH_TOKEN_SAVED_AT_KEY = 'momcal_push_token_saved_at';
const TOKEN_RESAVE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 토큰이 그대로여도 하루에 한 번은 updatedAt 갱신 겸 재저장

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

/**
 * v0.0.42: 예전엔 여기서 "진짜 푸시 알림" 카드를 따로 렌더링했는데, 설정 탭에 로컬 알림
 * (js/notifications.js) 카드와 나란히 있어서 옹짐꾼님이 "왜 알림이 두 개냐"고 지적함.
 * 이제 이 파일은 UI를 그리지 않고 enablePushNotifications()/refreshTokenIfNeeded()만
 * 제공하며, 상태 표시(켜짐/꺼짐)는 js/notifications.js의 통합 카드가 대신 보여줌.
 */

/** 버튼 클릭 — 알림 권한 요청 + FCM 토큰 발급 + Firestore 저장
 *  v0.0.42: 이 함수는 이제 단독 버튼이 아니라 js/notifications.js의 통합 알림 토글이
 *  로그인 사용자에 대해 자동으로 호출함 — 성공 여부와 무관하게 renderNotificationSettings()로
 *  통합 카드를 다시 그려서 "앱을 꺼도 받을 수 있어요" 문구 반영 여부를 갱신함
 *
 * v0.3.14: js/notifications.js가 이 함수를 부를 땐 항상 Notification.requestPermission()이
 * 이미 'granted'로 resolve된 직후라, 여기서 Notification.permission을 다시 읽어 재확인하는
 * 게 원래 목적(중복 요청 방지)이었음. 그런데 일부 모바일 브라우저(특히 Android Chrome)에서는
 * requestPermission()의 Promise가 resolve된 직후에도 Notification.permission 값이 아주
 * 짧게 'default'로 읽히는 타이밍 이슈가 있어서, 이 함수가 그걸 다시 'default'로 오판해
 * Notification.requestPermission()을 또 호출 — 게다가 아래 fetchAndSaveToken()이 부르는
 * Firebase의 getToken()도 권한이 없다고 판단되면 자체적으로 한 번 더 권한을 요청하는
 * 동작이 있어서, 이 셋이 겹치면 같은 클릭 한 번에 네이티브 허용 팝업이 여러 번(최대 3번)
 * 뜨는 문제로 이어졌음(옹짐꾼님 제보, 2026-07-17). 호출 측이 이미 승인된 것을 확실히 아는
 * 경우 `alreadyGranted=true`로 넘겨서 이 함수가 Notification.permission을 다시 읽지 않고
 * 곧장 진행하도록 함 — 재요청 경로 자체를 원천 차단 */
export async function enablePushNotifications(alreadyGranted = false) {
  if (!getCurrentUser() || !('Notification' in window)) return;

  const perm = alreadyGranted || Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (perm !== 'granted') { window.renderNotificationSettings?.(); return; }

  await fetchAndSaveToken();
  window.renderNotificationSettings?.();
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

/**
 * getToken() 호출 + Firestore 저장 — enablePushNotifications/refreshTokenIfNeeded 공용
 *
 * v0.3.18: [심각한 버그 수정] 이 함수는 앱이 데이터를 새로 불러올 때마다(js/app.js의
 * onDataLoaded()) refreshTokenIfNeeded()를 통해 매번 호출됐는데, 예전엔 getToken()이
 * (대부분 이전과 같은 값을 돌려주는데도) 매번 saveTokenToFirestore()로 무조건 다시
 * 저장했음 — 그 안에서 updatedAt: Date.now()가 매번 새 값이라 "문서가 바뀜"으로 처리돼,
 * 이게 곧바로 이 기기 자신의 onSnapshot을 다시 울리고 → onDataLoaded()가 또 불리고 →
 * refreshTokenIfNeeded()가 또 저장하고… 자기 자신을 끝없이 재호출하는 무한 저장 루프였음.
 * 이 저장은 js/state.js의 debounceSave()를 거치지 않고 여기서 직접 setDoc()을 부르는
 * 별도 경로라 v0.3.16의 hasPendingLocalWrite() 가드로도 못 막았음.
 *
 * 실제 증상: (1) 이 루프가 도는 동안 지금 열려있는 화면(설정 탭이면 설정 탭, 체크리스트면
 * 체크리스트)이 계속 통째로 다시 그려져서, PC에서는 버튼을 눌러도 그 찰나에 화면이 갈아
 * 치워져 클릭이 씹혔고(로그인 직후일수록 루프가 빨라 더 자주 씹힘, 시간이 지나면 Firestore
 * 자체의 백오프로 루프가 느려지며 클릭이 먹히기 시작함), 모바일 체크리스트에서는 Legend
 * 뱃지가 빠르게 깜빡이는 것처럼 보였음(등장 애니메이션이 매번 재시작됨). 이 루프는 푸시
 * 알림 권한이 켜져 있는 기기에서만 돌아서(refreshTokenIfNeeded()의 권한 체크 참고),
 * PC 테스트 계정처럼 푸시를 안 켠 기기에는 아예 영향이 없었음(옹짐꾼님이 "설정 탭 버그는
 * PC만, Legend 버그는 모바일만"이라고 정확히 구분해주셔서 여기까지 좁힐 수 있었음).
 * 결국 Firestore가 "Write stream exhausted maximum allowed queued writes"로 쓰기 자체를
 * 거부하기 시작하는 지경까지 갔었음(2026-07-17, 옹짐꾼님 콘솔 캡처로 확인).
 *
 * 수정: 마지막으로 실제 저장한 토큰 값·시각을 로컬(localStorage)에 기억해뒀다가, 토큰이
 * 그때와 완전히 같고 24시간이 안 지났으면 이번엔 아예 저장을 건너뜀 — 매번 부르는
 * getToken() 자체(FCM SDK 캐시라 가벼움)는 그대로 두되, 불필요한 Firestore 쓰기(및 그로
 * 인한 재귀 호출)만 원천 차단함.
 */
async function fetchAndSaveToken() {
  const messaging = await getMessagingSafe();
  if (!messaging) return;

  try {
    // sw.js — 앱쉘 캐싱용으로 이미 등록돼있는 서비스워커를 그대로 재사용(전용
    // firebase-messaging-sw.js를 별도로 안 둠 — sw.js 상단 v0.0.36 주석 참고)
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      const lastToken  = localStorage.getItem(PUSH_TOKEN_VALUE_KEY);
      const lastSaved  = Number(localStorage.getItem(PUSH_TOKEN_SAVED_AT_KEY) || 0);
      const needsSave  = token !== lastToken || (Date.now() - lastSaved) > TOKEN_RESAVE_INTERVAL_MS;
      if (needsSave) {
        await saveTokenToFirestore(token);
        localStorage.setItem(PUSH_TOKEN_VALUE_KEY, token);
        localStorage.setItem(PUSH_TOKEN_SAVED_AT_KEY, String(Date.now()));
      }
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
window.refreshTokenIfNeeded    = refreshTokenIfNeeded;
