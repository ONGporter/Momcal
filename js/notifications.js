/**
 * js/notifications.js — Sprint 29
 * 알림 기능 1차 버전 (브라우저 알림 권한 기반의 "로컬" 알림)
 *
 * ⚠️ 중요 — 진짜 FCM 푸시 알림(앱을 완전히 꺼도 정해진 시각에 오는 알림)은 아직 아님.
 * 그걸 만들려면 아래 3가지가 필요한데, 전부 Firebase 콘솔 소유자 권한이나 유료 요금제가
 * 필요해서 코드만으로는 대신할 수 없었음 (TODO.md에 상세 안내 남겨둠):
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
 */

import { today, stripLeadingEmoji } from './utils.js';
import { getAllEvs, isGovDeadlineSoon } from './calendar.js';

const LAST_NOTIFIED_KEY = 'momcal_last_notified_date';

/** 홈 탭 "더 편하게 쓰기" 아래 — 알림 권한 상태에 따른 안내/버튼 렌더 */
export function renderNotificationSettings() {
  const wrap = document.getElementById('notifSettingsWrap');
  if (!wrap) return;

  if (!('Notification' in window)) {
    wrap.innerHTML = ''; // 알림 API 미지원 브라우저(일부 구형 iOS Safari 등) — 조용히 숨김
    return;
  }

  const perm = Notification.permission; // 'default' | 'granted' | 'denied'

  if (perm === 'granted') {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default">
        <span class="install-ico" style="background:var(--mnl)">🔔</span>
        <div class="install-txt">
          <div class="install-title">알림 켜짐</div>
          <div class="install-sub">오늘 일정·마감 임박 알림을 받아요 (앱을 열었을 때 확인)</div>
        </div>
      </div>`;
    checkAndNotify();
    return;
  }

  if (perm === 'denied') {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default;opacity:.7">
        <span class="install-ico">🔕</span>
        <div class="install-txt">
          <div class="install-title">알림이 차단되어 있어요</div>
          <div class="install-sub">브라우저·기기 설정에서 맘캘 알림 권한을 허용해주세요</div>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="install-link" onclick="requestNotificationPermission()">
      <span class="install-ico">🔔</span>
      <div class="install-txt">
        <div class="install-title">알림 받기</div>
        <div class="install-sub">오늘 일정·정부지원 마감을 놓치지 않게 알려드려요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** 알림 권한 요청 (버튼 클릭 시) */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  renderNotificationSettings();
  if (result === 'granted') checkAndNotify(true);
}

/**
 * 오늘 일정·마감 임박 여부를 확인해서 알림을 띄움
 * @param {boolean} force - true면 오늘 이미 띄웠어도 다시 확인(권한을 방금 허용했을 때 등)
 */
export async function checkAndNotify(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const todayStr = today();
  if (!force && localStorage.getItem(LAST_NOTIFIED_KEY) === todayStr) return; // 하루 한 번만

  const evs = getAllEvs();
  const todayEvs   = evs.filter(e => e.date === todayStr && !e.done);
  const urgentGov  = evs.filter(e => isGovDeadlineSoon(e));

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
