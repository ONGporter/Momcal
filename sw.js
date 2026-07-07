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
const CACHE_NAME = 'momcal-shell-v34';

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
  './js/state.js',
  './js/theme.js',
  './js/ui.js',
  './js/utils.js',
  './js/vaccineSeries.js',
  './data/checklist-data.js',
  './data/checklist-links.js',
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
 * Sprint 29: 향후 FCM(Firebase Cloud Messaging) 진짜 푸시를 붙일 때 쓸 기본 뼈대.
 * ⚠️ 지금은 아무도 이 서비스워커로 실제 push 메시지를 "보내주는" 서버가 없어서
 * 이 핸들러가 호출될 일이 없음 — Firebase 콘솔에서 Cloud Messaging을 설정하고
 * 서버(Cloud Functions 등)에서 실제로 push를 보내기 시작하면 그때부터 동작함.
 * 지금 알림은 js/notifications.js가 앱이 열려 있을 때 브라우저 Notification API로
 * 직접 띄우는 방식(로컬 알림)이며, 이 핸들러와는 별개로 이미 동작함.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch (e) { payload = { title: '맘캘 MomCal', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || '맘캘 MomCal', {
      body: payload.body || '',
      icon: './icons/icon-192.png',
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
