# 진짜 푸시 알림 (FCM)

> **상태**: ✅ 배포·테스트 완료(옹짐꾼님이 admin.html 발송을 통해 실제 수신까지 확인함)
> **관련 코드**: `js/push.js`(클라이언트, 토큰 관리만 — UI 없음), `js/notifications.js`(통합 설정 UI, v0.0.42), `sw.js`(`push`/`notificationclick` 이벤트), `js/firebase.js`(Messaging SDK import), `functions/index.js`(예약 발송, Cloud Functions)

기존 `js/notifications.js`(로컬 알림, "앱을 열었을 때"만 확인)와 별개로, 앱을 완전히 꺼도(백그라운드·종료 상태) 알림을 받을 수 있는 실제 FCM 웹 푸시. 로그인(계정) 사용자만 지원 — 게스트 모드는 토큰을 연결할 계정(uid)이 없어서 기존 로컬 알림만 계속 사용 가능.

## 두 알림 시스템의 관계

| | `js/notifications.js` (로컬 알림) | `js/push.js` + `functions/` (진짜 푸시) |
|---|---|---|
| 앱이 꺼져있을 때 | ❌ 안 옴 | ✅ 옴 |
| 게스트 모드 | ✅ 지원 | ❌ 로그인 필요 |
| 발송 방식 | 클라이언트가 조건 확인 후 직접 표시 | 서버(Cloud Functions)가 매일 09:00 확인 후 발송 |
| 자동화 상태 | 완전 자동(앱 열 때마다 조건 확인) | ✅ 완전 자동(v0.0.38, 매일 09:00 Asia/Seoul) |

두 시스템은 내부적으로는 여전히 별개(로컬 조건 확인 vs 서버 자동 발송)지만, **v0.0.42부터 설정 탭 UI는 하나로 통합됨** — 예전엔 "알림 켜짐"(로컬)과 "진짜 푸시 알림 켜짐"(FCM) 카드가 나란히 있어서 사용자에게 알림이 두 개처럼 보인다는 지적을 받음. 이제 `js/push.js`는 자체 UI를 그리지 않고(`renderPushSettings()` 삭제) `enablePushNotifications()`/`refreshTokenIfNeeded()`만 제공하며, `js/notifications.js`의 토글 하나가:
- 로컬 알림 플래그를 켜고
- 로그인 사용자라면 `enablePushNotifications()`도 함께 호출해 FCM 등록까지 시도함

상태 문구도 FCM 토큰 저장 여부(`localStorage`의 `PUSH_TOKEN_SAVED_KEY`, `js/push.js`에서 export)에 따라 자동으로 "앱을 완전히 꺼도 받을 수 있어요"로 바뀜. `index.html`의 `pushSettingsWrap` div는 더 이상 안 씀(제거됨) — `notifSettingsWrap` 하나만 남음.

## 구조 — 1단계(수신 인프라)

- **클라이언트**: `js/push.js`가 알림 권한 요청 → `getToken()`으로 이 기기의 FCM 토큰 발급 → `users/{uid}.fcmTokens`에 저장. 앱이 열려있는 동안 오는 메시지는 `onMessage()`로 직접 처리(포그라운드), 앱이 꺼져있을 때는 서비스워커가 대신 받음(백그라운드)
- **토큰 자동 갱신** (v0.0.38): 권한이 이미 허용된 상태라면 앱을 열 때마다(`js/app.js`의 `onDataLoaded`) `refreshTokenIfNeeded()`가 조용히 다시 `getToken()`을 호출해 최신 토큰을 Firestore에 반영함 — 모듈형 FCM SDK에는 `onTokenRefresh()` 이벤트가 없어서 "앱을 열 때마다 다시 물어보고 바뀌었으면 갱신"하는 방식으로 대신함
- **서비스워커**: 전용 `firebase-messaging-sw.js`를 따로 두지 않고, 기존 앱쉘 캐싱용 `sw.js`가 "브링 유어 오운 서비스워커" 방식으로 `push`/`notificationclick` 이벤트를 직접 처리함(Firebase 공식 지원 방식) — 서비스워커를 2개 등록하면 스코프 충돌 위험이 있어서 하나로 통합
- **Firestore 스키마 추가** (`users/{uid}` 문서, 가족 그룹에 속해있어도 **항상** 개인 계정 문서에 저장):
  ```json
  { "fcmTokens": { "{FCM 토큰 문자열}": { "updatedAt": 1234567890, "ua": "Mozilla/5.0 ..." } } }
  ```
  여러 기기/브라우저에서 로그인하면 토큰이 여러 개 쌓임(맵 구조, `setDoc(..., {merge:true})`로 기존 토큰을 지우지 않고 추가·갱신만 함)

## 구조 — 2단계(자동 발송, v0.0.38 추가)

- **`functions/index.js`의 `dailyPushCheck`**: Cloud Scheduler가 매일 09:00(Asia/Seoul)에 트리거하는 Cloud Functions v2 예약 함수
- **대상 조회**: `users` 컬렉션 전체를 순회하며 `fcmTokens`이 있는 사용자만 골라냄 → `familyId`가 있으면 `families/{familyId}` 문서를, 없으면 본인 `users/{uid}` 문서 자체를 데이터 소스로 씀(`js/state.js`의 `dataDocRef()`와 동일한 분기) → 같은 가족 그룹 멤버 여러 명이 있으면 가족 데이터는 한 번만 계산해서 재사용(캐싱)
- **일정 계산**: `js/calendar.js`의 `getAutoEvs()`/`applyMods()`를 그대로 포팅(`functions/index.js`의 `computeAutoEvs`/`applyMods`) — 두 로직이 계속 같은 날짜를 계산하도록, 클라이언트 쪽 로직을 고치면 이 파일도 함께 검토해야 함. 클라이언트와 달리 "선택된 아이 1명"이 아니라 **등록된 아이 전원**을 대상으로 계산함(아이 선택은 UI 전용 개념)
- **알림 3종** (`buildNotifications()`):
  1. **오늘 일정** — 오늘 날짜에 걸린 모든 이벤트(예방접종·건강검진·정부지원·내 일정), 완료 처리된 건 제외
  2. **예방접종 하루 전** — `type==='vax'`이고 날짜가 정확히 내일인 것(완료 제외)
  3. **정부지원 마감 3일 전** — `deadlineDate`가 있고 정확히 3일 후이며, 아직 신청/지급 완료 처리(`govStatus`)가 안 된 것
  - 아이가 둘 이상이면 메시지에 아이 이름을 붙여서 구분(`민준 - DTaP 2차`)
  - 하루에 여러 항목이 겹치면 알림 하나에 " · "로 묶어서 보냄(스팸처럼 여러 번 오지 않도록)
- **토큰 자동 정리** (`sendToUser()`): 발송 실패 응답에서 `messaging/registration-token-not-registered`/`messaging/invalid-registration-token` 코드가 오면 그 토큰을 Firestore `fcmTokens`에서 자동 삭제 — 앱 삭제·알림 차단 등으로 죽은 토큰이 계속 쌓이는 걸 방지(v0.0.38, "토큰 자동 갱신" 요청사항의 서버 쪽 대응)
- **데이터 동기화**: `functions/data/*.js`는 배포 직전에 `functions/scripts/sync-data.cjs`(`firebase.json`의 predeploy 훅)가 루트 `data/vaccines.js` 등에서 복사해오는 산출물 — **직접 수정 금지**(`guide/*.html`과 같은 성격, AGENTS.md 참고)

## 배포 방법

```bash
cd functions
npm install          # 최초 1회 (firebase-admin, firebase-functions 설치)
npm run deploy        # data 동기화 + firebase deploy --only functions
```

- `firebase-tools` CLI가 로컬에 설치되어 있어야 함(`npm install -g firebase-tools`), `firebase login`으로 옹짐꾼님 Firebase 계정 로그인 필요
- 배포되는 프로젝트는 `.firebaserc`에 고정돼있음(`momcal-fd12b`)
- Cloud Functions는 Vercel과 무관한 별도 배포 경로임 — 앱 본체(`index.html`/`css/`/`js/`)를 GitHub에 push해도 Cloud Functions는 안 나감, 위 명령을 직접 실행해야 함

## Firebase 콘솔에서 옹짐꾼님이 해야 할 일

1. ~~Cloud Messaging 사용 설정~~
2. ~~VAPID 키(웹 푸시 인증서) 발급~~
3. ~~`js/push.js`의 `VAPID_KEY` 상수 교체~~ (v0.0.37에서 완료)
4. ~~Blaze(종량제) 요금제로 전환~~ (완료 — Cloud Functions는 Blaze 요금제에서만 배포 가능)
5. ~~`functions` 배포~~ (완료 — `dailyPushCheck` 배포 성공 확인됨)
6. **다음 확인 필요**: 설정 탭 → "진짜 푸시 알림 켜기" → 알림 허용 → `users/{uid}` 문서에 `fcmTokens` 필드가 생기는지 Firestore 콘솔에서 확인
7. **자동 발송 확인**: Firebase 콘솔 → Functions → `dailyPushCheck` → "테스트 실행"으로 즉시 1회 실행(스케줄 안 기다려도 됨) → 예방접종/정부지원/오늘 일정이 있는 계정에서 실제로 알림이 오는지 확인 — 앱을 완전히 꺼둔 상태에서 확인할 것
8. Cloud Functions 로그(Firebase 콘솔 → Functions → 로그, 또는 `firebase functions:log`)로 실행 여부·에러 확인 가능

## 알아두면 좋은 것

- **비용**: Blaze 요금제라도 Cloud Scheduler 1개(무료 한도 내 — 하루 1회는 사실상 무료) + Cloud Functions 실행(무료 한도 월 200만 회, 하루 1회 실행은 무료 한도에 전혀 안 걸림) + Firestore 읽기(사용자 수만큼, 무료 한도 하루 5만 회)로 사용자 수가 적을 때는 사실상 무료 범위 — 사용자가 크게 늘어나면 Firestore 읽기 비용을 다시 점검할 것
- **확장성**: 지금은 `users` 컬렉션 전체를 매번 스캔함(작은 사용자 수에서는 문제 없음) — 사용자가 많아지면 `fcmTokens`이 있는 사용자만 걸러내는 별도 인덱스/컬렉션 구조로 최적화하는 걸 고려
- **알림 시각을 바꾸고 싶으면**: `functions/index.js`의 `dailyPushCheck` 스케줄 문자열(`'0 9 * * *'`, cron 형식)을 바꾸고 재배포
- **알림 종류를 추가/변경하고 싶으면**: `functions/index.js`의 `buildNotifications()` 함수 수정 — 계산에 필요한 데이터가 `data/` 안에 이미 있다면 `functions/scripts/sync-data.cjs`의 `FILES_TO_SYNC` 목록에 추가할 것
