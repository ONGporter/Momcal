/**
 * functions/index.js (v0.0.38)
 * 매일 오전 9시(Asia/Seoul)에 실행되는 예약 함수 — 예방접종 하루 전, 정부지원 마감 3일 전,
 * 오늘 일정을 확인해서 FCM 푸시로 발송한다.
 *
 * ⚠️ functions/data/*.js는 이 폴더에서 직접 수정하는 파일이 아니라, 배포 직전에
 * `firebase.json`의 predeploy 훅(`functions/scripts/sync-data.cjs`)이 루트 `data/`에서
 * 복사해오는 산출물임(guide/*.html과 같은 성격) — 예방접종·정부지원 일정 데이터를 바꾸려면
 * 항상 루트 `data/vaccines.js` 등을 고칠 것, `functions/data/`를 직접 고쳐도 다음 배포 때
 * 흔적도 없이 사라짐.
 *
 * 이 파일의 날짜 계산 로직(computeAutoEvs)은 js/calendar.js의 getAutoEvs()를 최대한
 * 그대로 포팅한 것 — 두 로직이 계속 같은 날짜를 계산하도록, getAutoEvs()를 고칠 땐
 * 이 파일도 함께 검토할 것(반대 방향도 마찬가지).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

import { vaxSched } from './data/vaccines.js';
import { checkEvs } from './data/milestones.js';
import { pregEvMap } from './data/pregnancy.js';
import { govSupportSchedule } from './data/government-support.js';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Firestore 리전(asia-northeast3, 서울)과 맞춤 — PROJECT_SPEC.md "Firebase 구조" 참고
setGlobalOptions({ region: 'asia-northeast3' });

/* ══════════════════════════════════════
 *  날짜 유틸 — js/utils.js의 today()/daysUntil()과 동일 로직(KST 기준)
 * ══════════════════════════════════════ */

/** KST(Asia/Seoul) 기준 오늘 날짜 문자열(YYYY-MM-DD) */
function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** dateStr(YYYY-MM-DD)이 오늘로부터 며칠 뒤인지 (지난 날짜면 음수) */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(todayKST());
  return Math.round(diff / 86400000);
}

/** baseDateStr(YYYY-MM-DD) + deltaDays일 → YYYY-MM-DD (js/calendar.js getAutoEvs와 동일한 UTC 기준 계산) */
function addFromDate(baseDateStr, deltaDays) {
  const d = new Date(baseDateStr);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

/* ══════════════════════════════════════
 *  자동 일정 계산 — js/calendar.js의 getAutoEvs() 포팅
 * ══════════════════════════════════════ */

/** @param {object} child - S.children의 항목 하나 */
function computeAutoEvs(child) {
  const evs = [];

  if (child.stage === 'preg') {
    if (!child.due) return evs;
    pregEvMap.forEach(({ w, items }) => {
      const ds = addFromDate(child.due, -(40 - w) * 7);
      items.forEach(it => evs.push({ date: ds, _origDate: ds, title: it.t, type: it.r ? 'req' : 'rec', auto: true }));
    });
    govSupportSchedule.preg.forEach(it => {
      const ds = addFromDate(child.due, -(40 - it.week) * 7);
      evs.push({ date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true, deadlineDate: null });
    });
  } else {
    if (!child.birth) return evs;
    vaxSched.forEach(v => {
      const ds = addFromDate(child.birth, v.m * 30.44);
      v.items.forEach(it => evs.push({ date: ds, _origDate: ds, title: it, type: 'vax', auto: true }));
    });
    checkEvs.forEach(({ m, items }) => {
      const ds = addFromDate(child.birth, m * 30.44);
      items.forEach(it => evs.push({ date: ds, _origDate: ds, title: it.t, type: it.r ? 'req' : 'rec', auto: true }));
    });
    govSupportSchedule.postpartum.forEach(it => {
      const ds = addFromDate(child.birth, it.day);
      const deadlineDate = it.deadlineDay != null ? addFromDate(child.birth, it.deadlineDay) : null;
      evs.push({ date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true, deadlineDate });
    });
    govSupportSchedule.parenting.forEach(it => {
      const ds = addFromDate(child.birth, it.month * 30.44);
      evs.push({ date: ds, _origDate: ds, title: it.title, type: 'gov', auto: true, deadlineDate: null });
    });
  }
  return evs;
}

/** js/calendar.js의 getEventKey() 포팅 — auto 이벤트만 대상(커스텀 일정은 별도 처리) */
function getEventKey(ev) {
  return 'auto_' + (ev._origDate || ev.date) + '_' + ev.title;
}

/** js/calendar.js의 applyMods() 포팅 — 사용자가 실접종일 입력·완료 체크한 내용 반영 */
function applyMods(evs, eventMods) {
  if (!eventMods) return evs;
  return evs.map(ev => {
    const mod = eventMods[getEventKey(ev)];
    if (!mod) return ev;
    return {
      ...ev,
      date: mod.actualDate || ev.date,
      done: !!mod.done,
      govStatus: mod.govStatus || 'none',
    };
  });
}

/** js/calendar.js의 applyCustomMods() 포팅 */
function applyCustomMods(customEvs, eventMods) {
  if (!eventMods) return customEvs;
  return customEvs.map(ev => {
    const mod = eventMods['custom_' + ev._id];
    if (!mod) return ev;
    return { ...ev, done: !!mod.done };
  });
}

/**
 * 데이터 문서(users/{uid} 또는 families/{familyId}) 하나에서 전체 이벤트 계산
 * — 클라이언트(getAllEvs)와 달리 "선택된 아이 1명"이 아니라 등록된 아이 전원을 대상으로 함
 * (선택 상태는 UI 전용 개념이라 알림 계산에는 의미가 없음)
 */
function computeAllEvs(dataDoc) {
  const children = dataDoc.children || [];
  const eventMods = dataDoc.eventMods || {};
  const autoAll = children.flatMap(child =>
    applyMods(computeAutoEvs(child), eventMods).map(ev => ({ ...ev, childName: child.name }))
  );
  const customAll = applyCustomMods(dataDoc.customEvs || [], eventMods);
  return [...autoAll, ...customAll];
}

/* ══════════════════════════════════════
 *  알림 메시지 조립
 * ══════════════════════════════════════ */

/**
 * @param {object} dataDoc - children/customEvs/eventMods를 담은 데이터 문서
 * @returns {string[]} 오늘 보낼 알림 문구 목록(없으면 빈 배열)
 */
function buildNotifications(dataDoc) {
  const evs = computeAllEvs(dataDoc);
  const todayStr = todayKST();
  const multiChild = (dataDoc.children || []).length > 1;
  const label = (e) => (multiChild && e.childName ? `${e.childName} - ${e.title}` : e.title);
  const messages = [];

  // 1) 오늘 일정 (예방접종·건강검진·정부지원·내 일정 전부 포함, 완료 처리된 건 제외)
  const todayEvs = evs.filter(e => e.date === todayStr && !e.done);
  if (todayEvs.length) {
    const names = todayEvs.slice(0, 2).map(label).join(', ');
    messages.push(`오늘 일정 ${todayEvs.length}건: ${names}${todayEvs.length > 2 ? ' 외' : ''}`);
  }

  // 2) 예방접종 하루 전
  const vaxTomorrow = evs.filter(e => e.type === 'vax' && !e.done && daysUntil(e.date) === 1);
  if (vaxTomorrow.length) {
    const names = vaxTomorrow.slice(0, 2).map(label).join(', ');
    messages.push(`💉 내일 예방접종: ${names}${vaxTomorrow.length > 2 ? ' 외' : ''}`);
  }

  // 3) 정부지원 마감 3일 전 (이미 신청/지급 완료 처리된 건 제외)
  const govDue3 = evs.filter(e =>
    e.type === 'gov' && e.deadlineDate &&
    e.govStatus !== 'applied' && e.govStatus !== 'paid' &&
    daysUntil(e.deadlineDate) === 3
  );
  govDue3.forEach(e => messages.push(`⏰ ${label(e)} 신청 마감이 3일 남았어요`));

  return messages;
}

/* ══════════════════════════════════════
 *  발송 + 토큰 자동 정리
 * ══════════════════════════════════════ */

/**
 * 한 사용자(users/{uid})의 저장된 모든 토큰으로 발송하고, 무효화된 토큰은
 * Firestore에서 자동으로 지운다("토큰 자동 갱신" 요청사항의 서버 쪽 대응 —
 * 클라이언트는 앱을 열 때마다 최신 토큰을 다시 저장하고(js/push.js의
 * refreshTokenIfNeeded), 서버는 발송 실패로 죽은 토큰을 이렇게 청소함).
 */
async function sendToUser(uid, tokensMap, body) {
  const tokens = Object.keys(tokensMap || {});
  if (!tokens.length) return;

  let resp;
  try {
    resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: '맘캘 MomCal', body },
      webpush: {
        notification: {
          icon: 'https://momcal.app/icons/icon-192.png',
          badge: 'https://momcal.app/icons/icon-192.png',
        },
        fcmOptions: { link: 'https://momcal.app/' },
      },
    });
  } catch (e) {
    console.error(`푸시 발송 실패 (uid=${uid}):`, e);
    return;
  }

  const deadTokens = [];
  resp.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code;
    // 브라우저에서 알림 권한을 껐거나, 사이트 데이터를 지웠거나, 토큰이 만료된 경우 등
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') {
      deadTokens.push(tokens[i]);
    }
  });

  if (deadTokens.length) {
    const updates = {};
    deadTokens.forEach(t => { updates[`fcmTokens.${t}`] = FieldValue.delete(); });
    try {
      await db.collection('users').doc(uid).update(updates);
    } catch (e) {
      console.error(`무효 토큰 정리 실패 (uid=${uid}):`, e);
    }
  }
}

/* ══════════════════════════════════════
 *  예약 함수 — 매일 09:00 Asia/Seoul
 * ══════════════════════════════════════ */

export const dailyPushCheck = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Asia/Seoul' },
  async () => {
    // families 컬렉션을 미리 전부 읽어서 맵으로 캐싱 — 가족 그룹 멤버 여러 명이
    // 같은 families/{familyId} 문서를 데이터 소스로 공유하므로 한 번만 읽으면 됨
    const familiesSnap = await db.collection('families').get();
    const familyDocs = new Map();
    familiesSnap.forEach(doc => familyDocs.set(doc.id, doc.data()));

    const usersSnap = await db.collection('users').get();

    // 같은 데이터 소스(가족 그룹 등)에 대한 메시지 재계산을 피하기 위한 캐시
    const msgCache = new Map();
    const tasks = [];

    usersSnap.forEach(userDoc => {
      const u = userDoc.data();
      const tokens = u.fcmTokens;
      if (!tokens || !Object.keys(tokens).length) return; // 푸시 토큰 없는 사용자는 스킵

      // js/state.js dataDocRef()와 동일한 분기: familyId가 있으면 가족 공유 문서,
      // 없으면 본인 문서 자체가 데이터 소스
      let dataDoc;
      let cacheKey;
      if (u.familyId && familyDocs.has(u.familyId)) {
        dataDoc = familyDocs.get(u.familyId);
        cacheKey = 'family:' + u.familyId;
      } else {
        dataDoc = u;
        cacheKey = 'user:' + userDoc.id;
      }

      let messages = msgCache.get(cacheKey);
      if (messages === undefined) {
        try {
          messages = buildNotifications(dataDoc);
        } catch (e) {
          console.error(`알림 계산 실패 (${cacheKey}):`, e);
          messages = [];
        }
        msgCache.set(cacheKey, messages);
      }

      if (!messages.length) return;
      const body = messages.slice(0, 3).join(' · ');
      tasks.push(sendToUser(userDoc.id, tokens, body));
    });

    await Promise.allSettled(tasks);
  }
);
