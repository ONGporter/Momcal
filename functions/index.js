/**
 * functions/index.js (v0.0.38, v0.0.39에서 관리자 푸시 발송 추가)
 * 매일 오전 9시(Asia/Seoul)에 실행되는 예약 함수 — 예방접종 하루 전, 정부지원 마감 3일 전,
 * 오늘 일정을 확인해서 FCM 푸시로 발송한다.
 *
 * v0.0.39: 관리자(admin.html)가 Firestore adminBroadcasts 컬렉션에 문서를 쓰면
 * 이 파일의 onBroadcastCreated(즉시 발송)/processScheduledBroadcasts(예약 발송)가
 * 실제 FCM 전송을 담당한다. 자세한 구조는 docs/product-specs/admin-push.md 참고.
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
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

import { vaxSched } from './data/vaccines.js';
import { checkEvs } from './data/milestones.js';
import { pregEvMap } from './data/pregnancy.js';
import { govSupportSchedule } from './data/government-support.js';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const fbAuth = getAuth();

// v0.3.7: 카카오 REST API 키 — kakaoLogin()이 인가 코드를 access token으로 교환할 때 씀
// (JavaScript 키와는 다른 키, 클라이언트에 노출되면 안 되는 값이라 Secret Manager로 관리함).
// 배포 전에 `firebase functions:secrets:set KAKAO_REST_API_KEY` 로 값을 등록해둬야 함.
const kakaoRestApiKey = defineSecret('KAKAO_REST_API_KEY');

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
async function sendToUser(uid, tokensMap, body, title = '맘캘 MomCal') {
  const tokens = Object.keys(tokensMap || {});
  if (!tokens.length) return { success: 0, fail: 0 };

  let resp;
  try {
    resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
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
    return { success: 0, fail: tokens.length };
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

  return { success: resp.successCount, fail: resp.failureCount };
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

/* ══════════════════════════════════════
 *  v0.0.39 — 관리자 푸시 발송 (admin.html)
 *  Firestore `adminBroadcasts/{broadcastId}` 문서를 admin.html이 생성하면,
 *  아래 두 함수 중 하나가 실제 FCM 발송을 수행하고 문서 상태를 갱신한다.
 *  자세한 구조·보안 규칙 안내는 docs/product-specs/admin-push.md 참고.
 * ══════════════════════════════════════ */

/** KST 기준 만 나이(개월) — birthStr(YYYY-MM-DD) 기준 오늘까지 경과 개월 수 */
function ageInMonthsKST(birthStr) {
  const diffDays = (new Date(todayKST()) - new Date(birthStr)) / 86400000;
  return diffDays / 30.44;
}

/**
 * 사용자 문서 하나가 실제로 보고 있는 children 배열을 반환
 * (js/state.js dataDocRef()와 동일한 분기 — 가족 그룹이면 공유 문서의 children을 씀)
 */
function getEffectiveChildren(userData, familyDocs) {
  if (userData.familyId && familyDocs.has(userData.familyId)) {
    return familyDocs.get(userData.familyId).children || [];
  }
  return userData.children || [];
}

/** 대상 조건(target/targetParams)에 children 배열이 부합하는지 판정 ('uid' 타깃은 별도 처리) */
function matchesBroadcastTarget(children, target, params) {
  if (target === 'all') return true;
  if (target === 'pregnant') return children.some(c => c.stage === 'preg');
  if (target === 'ageRange') {
    const min = Number.isFinite(params.minMonth) ? params.minMonth : 0;
    const max = Number.isFinite(params.maxMonth) ? params.maxMonth : 999;
    return children.some(c => {
      if (c.stage === 'preg' || !c.birth) return false;
      const age = ageInMonthsKST(c.birth);
      return age >= min && age <= max;
    });
  }
  return false;
}

/**
 * adminBroadcasts/{broadcastId} 문서 하나를 실제로 발송하고 결과를 문서에 기록.
 * onBroadcastCreated(즉시)와 processScheduledBroadcasts(예약) 양쪽에서 공용으로 씀.
 */
async function runBroadcast(broadcastId, data) {
  const broadcastRef = db.collection('adminBroadcasts').doc(broadcastId);
  try {
    const familiesSnap = await db.collection('families').get();
    const familyDocs = new Map();
    familiesSnap.forEach(d => familyDocs.set(d.id, d.data()));

    const targetParams = data.targetParams || {};
    let targetUsers = []; // [{ id, data }]

    if (data.target === 'uid') {
      const uids = Array.isArray(targetParams.uids) ? targetParams.uids : [];
      const snaps = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
      snaps.forEach(snap => { if (snap.exists()) targetUsers.push({ id: snap.id, data: snap.data() }); });
    } else {
      const usersSnap = await db.collection('users').get();
      usersSnap.forEach(doc => {
        const u = doc.data();
        const children = getEffectiveChildren(u, familyDocs);
        if (matchesBroadcastTarget(children, data.target, targetParams)) {
          targetUsers.push({ id: doc.id, data: u });
        }
      });
    }

    let successCount = 0, failCount = 0, sentUserCount = 0;
    const tasks = targetUsers.map(async ({ id, data: u }) => {
      const tokens = u.fcmTokens;
      if (!tokens || !Object.keys(tokens).length) return;
      sentUserCount++;
      const r = await sendToUser(id, tokens, data.body, data.title);
      successCount += r.success;
      failCount += r.fail;
    });
    await Promise.allSettled(tasks);

    await broadcastRef.update({
      status: 'sent',
      sentAt: Date.now(),
      result: {
        targetUserCount: targetUsers.length, // 조건에 맞은 사용자 수(토큰 유무 무관)
        sentUserCount,                        // 그중 실제 토큰이 있어 발송을 시도한 사용자 수
        successCount,                         // 성공한 토큰(기기) 수
        failCount,                            // 실패한 토큰(기기) 수
      },
    });
  } catch (e) {
    console.error(`관리자 발송 실패 (broadcastId=${broadcastId}):`, e);
    await broadcastRef.update({
      status: 'failed',
      sentAt: Date.now(),
      error: String(e).slice(0, 500),
    }).catch(() => {});
  }
}

/**
 * 즉시 발송 — admin.html이 scheduledAt 없이(=지금 바로) 문서를 생성하면 곧바로 트리거됨.
 * 예약 발송(scheduledAt 있음)은 여기서 건너뛰고 processScheduledBroadcasts가 처리함
 * (한 건이 두 경로에서 중복 발송되지 않도록 분리).
 */
export const onBroadcastCreated = onDocumentCreated('adminBroadcasts/{broadcastId}', async (event) => {
  const data = event.data?.data();
  if (!data || data.status !== 'pending' || data.scheduledAt) return;
  await runBroadcast(event.params.broadcastId, data);
});

/**
 * 예약 발송 — 5분마다 실행해서 예약 시각(scheduledAt)이 지난 대기 중 건을 발송함.
 * Firestore 인계 규칙상 scheduledAt이 null인 문서는 범위 조건(<=)에 아예 매칭되지 않아
 * 즉시 발송 건과 자연히 분리됨(onBroadcastCreated가 이미 처리했으므로 중복 없음).
 * ⚠️ 이 쿼리는 (status ==, scheduledAt <=) 복합 색인이 필요 — 최초 배포 후 Firebase가
 * 콘솔 로그에 색인 생성 링크를 안내하면 그걸 눌러서 한 번 만들어줘야 정상 동작함.
 */
export const processScheduledBroadcasts = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Seoul' },
  async () => {
    const now = Date.now();
    const snap = await db.collection('adminBroadcasts')
      .where('status', '==', 'pending')
      .where('scheduledAt', '<=', now)
      .get();

    const tasks = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (!data.scheduledAt) return; // 방어적 가드(위 주석 참고)
      tasks.push(runBroadcast(doc.id, data));
    });
    await Promise.allSettled(tasks);
  },
);

/**
 * ══════════════════════════════════════
 * 카카오 로그인 (v0.3.5, v0.3.7에서 방식 변경)
 * ══════════════════════════════════════
 * v0.3.7: 클라이언트가 Kakao.Auth.login()(팝업 방식)으로 access token을 직접 받아서 보내는
 * 방식으로 만들었었는데, 그 함수가 현재 카카오 JS SDK 버전엔 없다는 게 실제 에러로 확인됨
 * (TypeError: Kakao.Auth.login is not a function) — 지금 SDK가 지원하는 유일한 방식인
 * Kakao.Auth.authorize()(리다이렉트 방식)로 전면 교체함.
 *
 * 흐름: 클라이언트가 Kakao.Auth.authorize()를 부르면 카카오 로그인 페이지로 이동했다가,
 * 로그인이 끝나면 "?code=인가코드"를 붙여서 우리 앱으로 돌아온다(js/auth.js의
 * handleKakaoRedirectIfNeeded() 참고). 이 함수는 그 인가 코드(code)를 받아서:
 * ① kauth.kakao.com/oauth/token에 코드를 보내 access token으로 교환하고(REST API 키 필요 —
 *    JavaScript 키와 다른 값, Secret Manager로 관리),
 * ② 그 access token으로 kapi.kakao.com/v2/user/me를 호출해 사용자 정보를 얻고,
 * ③ 검증된 카카오 회원번호로 Firebase Auth 사용자를 만들거나 갱신하고,
 * ④ 그 사용자로 로그인할 수 있는 Firebase 커스텀 토큰을 발급해서 클라이언트에 돌려준다.
 *
 * uid는 'kakao:{카카오 회원번호}' 형식으로 별도 네임스페이스를 씀 — 기존 이메일/구글
 * 로그인 사용자의 uid(Firebase가 자동 생성하는 임의 문자열)와 절대 겹치지 않음.
 *
 * ⚠️ email 필드는 일부러 안 씀 — 카카오 동의항목에서 이메일을 안 받기로 했고(개인 개발자
 * 앱은 이메일 제공이 기본 막혀있음), 설령 나중에 받더라도 이미 그 이메일로 가입된 기존
 * Firebase 계정이 있으면 auth.createUser()/updateUser()가 'auth/email-already-exists'로
 * 충돌할 수 있어서(Firebase는 이메일을 유니크 키로 취급함) 지금은 아예 안 건드리는 게 안전함.
 * 즉 같은 사람이 이메일 계정과 카카오 계정을 각각 만들면 서로 다른 두 계정으로 남는다 —
 * 계정 연결(병합) 기능은 아직 없음, 필요해지면 별도로 설계할 것
 * (docs/product-specs/kakao-login.md 참고).
 */
export const kakaoLogin = onCall({ secrets: [kakaoRestApiKey] }, async (request) => {
  const code        = request.data?.code;
  const redirectUri = request.data?.redirectUri;
  if (!code || !redirectUri) {
    throw new HttpsError('invalid-argument', '카카오 인가 코드가 없습니다');
  }

  // 1) 인가 코드를 access token으로 교환 — redirect_uri는 authorize() 호출 때 쓴 값과
  //    정확히 같아야 카카오가 유효한 요청으로 인정함
  let accessToken;
  try {
    const tokenResp = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: kakaoRestApiKey.value(),
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || '카카오 토큰 교환 실패');
    }
    accessToken = tokenData.access_token;
  } catch (e) {
    throw new HttpsError('unauthenticated', '카카오 인증에 실패했습니다');
  }

  // 2) access token으로 사용자 정보 요청
  let kakaoUser;
  try {
    const resp = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error(`카카오 API 응답 오류: ${resp.status}`);
    kakaoUser = await resp.json();
  } catch (e) {
    throw new HttpsError('unauthenticated', '카카오 사용자 정보를 확인할 수 없습니다');
  }

  const kakaoId = kakaoUser?.id;
  if (!kakaoId) throw new HttpsError('unauthenticated', '카카오 사용자 정보를 확인할 수 없습니다');

  const uid = `kakao:${kakaoId}`;
  const profile = kakaoUser.kakao_account?.profile || kakaoUser.properties || {};
  const displayName = profile.nickname || profile.nickName || '카카오 사용자';
  const photoURL = profile.profile_image_url || profile.profile_image || undefined;

  // 3) Firebase Auth 사용자 생성 또는 최신 프로필로 갱신
  const userFields = { displayName, ...(photoURL ? { photoURL } : {}) };
  try {
    await fbAuth.updateUser(uid, userFields);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      await fbAuth.createUser({ uid, ...userFields });
    } else {
      throw new HttpsError('internal', '사용자 정보 처리 중 오류가 발생했습니다');
    }
  }

  // 4) 이 uid로 로그인 가능한 Firebase 커스텀 토큰 발급
  const token = await fbAuth.createCustomToken(uid, { provider: 'kakao' });
  return { token };
});
