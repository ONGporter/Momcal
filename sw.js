/**
 * sw.js — 맘캘 서비스 워커 (Sprint 11: PWA 홈 화면 추가)
 *
 * 목적:
 *  1) 홈 화면 설치(Add to Home Screen)를 위해 브라우저가 요구하는 서비스 워커 등록
 *  2) 앱 셸(정적 파일)을 캐싱해서 오프라인/네트워크 불안정 시에도 앱이 열리도록 지원
 *
 * 전략: stale-while-revalidate (캐시 우선 응답 + 백그라운드에서 최신본으로 갱신)
 * Firebase 등 외부 도메인 요청(인증·데이터 동기화)은 건드리지 않고 그대로 통과시킵니다.
 */

// v0.0.18: 폴더 구조 정리(AGENTS.md/ARCHITECTURE.md/docs/) 작업 중 앱쉘 캐시 목록에서
// 누락된 js 모듈 8개(theme.js/fontSize.js/calFontSize.js/guestMode.js/familyShare.js/
// accountDelete.js/pwaInstall.js/adSlot.js) 발견 — 여러 버전에 걸쳐 계속 빠져있었음(오프라인
// 상태에서 다크모드·글자크기·가족공유 등 설정 탭 기능이 깨질 수 있었던 잠재 버그) — 추가하고 캐시 버전 상향
// v0.0.20: "AI스럽지 않은 실제 서비스 수준" 리디자인 — 아이콘 라이브러리 도입,
// 팔레트·반경·간격 토큰 변경으로 CSS/JS 다수 변경 — 캐시 버전 상향
// v0.0.21: 나머지 이모지 대부분을 아이콘으로 전환(캘린더 모달·체크리스트·정부지원·
// 성장·알림·가족공유·계정삭제·guide/ 육아정보 페이지 전체) — 정적 파일 대량 변경으로 캐시 버전 상향
// v0.0.22: Legend 트로피 아이콘, 그라디언트 완전 제거(.bpk), 체크리스트 사이드바 줄바꿈 정리,
// 종류 선택 아이콘 통일, 아이 성별 기반 성장단계 아이콘, 예방접종/정부지원 이모지 마커 제거(데이터 마이그레이션 포함)
// v0.0.23: 정부지원 사이드바 통일, 태아 성장 기록, 체크리스트 추천/비추천(도움돼요),
// 체크리스트 이미지 공유(html2canvas 신규 도입) 반영 — 캐시 버전 상향
// v0.0.39: 관리자 푸시 발송 기능 추가(admin.html/js/admin.js/css/admin.css) — 이 페이지들은
// APP_SHELL(오프라인 캐시 대상)에 넣지 않음(privacy.html 등 기존 독립 정책 페이지와 동일 취급).
// js/firebase.js에 Firestore 쿼리 함수(collection/addDoc/query 등) export가 추가되어
// 앱 본체가 쓰는 정적 파일 내용이 바뀌었으므로 캐시 버전은 올림.
// v0.0.40: 체크리스트 커스터마이징(탭 표시/캘린더 연동 설정, 준비물 팩, 사용자 정의 체크리스트)
// 추가 — 새 js/데이터 파일 캐시 목록에 반영, 캐시 버전 상향
const CACHE_NAME = 'momcal-shell-v45';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/auth.css',
  './css/calendar.css',
  './css/checklist.css',
  './css/modal.css',
  './css/growth.css',
  './js/accountDelete.js',
  './js/adSlot.js',
  './js/app.js',
  './js/auth.js',
  './js/calendar.js',
  './js/calFontSize.js',
  './js/checklist.js',
  './js/checklistSettings.js',
  './js/checklistCalendarLink.js',
  './js/demoMode.js',
  './js/familyShare.js',
  './js/firebase.js',
  './js/fontSize.js',
  './js/govSupport.js',
  './js/growth.js',
  './js/growthChart.js',
  './js/guestMode.js',
  './js/modal.js',
  './js/notifications.js',
  './js/pwaInstall.js',
  './js/push.js',
  './js/splash.js',
  './js/state.js',
  './js/theme.js',
  './js/ui.js',
  './js/utils.js',
  './js/vaccineSeries.js',
  './data/checklist-data.js',
  './data/checklist-links.js',
  './data/checklist-packs.js',
  './data/government-support.js',
  './data/milestones.js',
  './data/pregnancy.js',
  './data/tips.js',
  './data/vaccine-series.js',
  './data/vaccines.js',
  './data/who-growth.js',
  './data/kr-holidays.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/logo-mark.png',
  './fonts/OwnglyphParkDahyun.ttf', // v0.0.3: 커스텀 폰트 추가 — 오프라인에서도 폰트가 깨지지 않도록 미리 캐싱
  './fonts/OmyuPretty.ttf', // v0.0.5: 세부 정보용 폰트 추가
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // 캐싱 실패해도 설치 자체는 진행 (일부 파일 누락 시 앱이 죽지 않도록)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 같은 출처(same-origin) 요청만 캐싱 대상 — Firebase Auth/Firestore, CDN 등은 그대로 네트워크로
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached); // 오프라인이면 캐시로 대체

      return cached || fetchPromise;
    })
  );
});

/**
 * v0.0.36: 진짜 FCM 푸시 수신 핸들러 — Sprint 29 때 만들어둔 뼈대를 실제로 연결함.
 *
 * "브링 유어 오운 서비스워커(Bring your own service worker)" 방식: Firebase의
 * firebase-messaging-sw.js(compat SDK) 없이, 이 sw.js가 직접 'push'/'notificationclick'을
 * 처리함 — js/push.js의 getToken() 호출 시 serviceWorkerRegistration으로 이 sw.js의
 * registration을 넘겨주면 Firebase가 이 핸들러로 알림을 전달해줌(공식 지원 방식).
 * firebase-messaging-sw.js를 별도로 안 두는 이유: 이미 앱쉘 캐싱용 sw.js가 있는 상태에서
 * 서비스워커를 2개 등록하면 스코프 충돌 위험이 있어서, Firebase 공식 문서도 기존
 * 서비스워커가 있으면 이 방식(직접 처리)을 권장함.
 *
 * 페이로드 형태: Firebase 콘솔의 "Cloud Messaging → 캠페인" 화면에서 보낸 메시지는
 * { notification: {title, body, icon}, data: {...} } 형태로 옴. data-only 메시지
 * (Admin SDK/서버에서 notification 필드 없이 보낸 경우)는 최상위에 바로 title/body가
 * 올 수도 있어서 두 형태 다 대응함.
 *
 * ⚠️ 이 핸들러는 "받는" 쪽만 담당함 — 실제로 언제·누구에게 보낼지는 Firebase 콘솔에서
 * 수동으로 캠페인을 만들어 보내거나(코드 불필요), "예방접종 하루 전"처럼 자동화하려면
 * 별도 서버 스케줄러(Cloud Functions + Cloud Scheduler, Blaze 요금제)가 필요함 —
 * docs/TODO.md "FCM 2단계(자동 발송)" 참고.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch (e) { payload = { notification: { title: '맘캘 MomCal', body: event.data.text() } }; }

  const n = payload.notification || payload; // notification 필드가 없으면 data-only 메시지로 간주
  const title = n.title || '맘캘 MomCal';
  const body  = n.body  || '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: n.icon || './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: payload.data || {},
    })
  );
});

/** 알림을 탭하면 앱 창을 포커스하거나 새로 열어줌 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
