# 진짜 푸시 알림 (FCM)

> **상태**: 🟡 클라이언트 코드 + VAPID 키 설정 완료(v0.0.37) · Firestore 토큰 저장·테스트 발송 실기기 확인 대기 중
> **관련 코드**: `js/push.js`, `sw.js`(`push`/`notificationclick` 이벤트), `js/firebase.js`(Messaging SDK import)

기존 `js/notifications.js`(로컬 알림, "앱을 열었을 때"만 확인)와 별개로, 앱을 완전히 꺼도(백그라운드·종료 상태) 알림을 받을 수 있는 실제 FCM 웹 푸시. 로그인(계정) 사용자만 지원 — 게스트 모드는 토큰을 연결할 계정(uid)이 없어서 기존 로컬 알림만 계속 사용 가능.

## 두 알림 시스템의 관계

| | `js/notifications.js` (로컬 알림) | `js/push.js` (진짜 푸시, 이번에 추가) |
|---|---|---|
| 앱이 꺼져있을 때 | ❌ 안 옴 | ✅ 옴 |
| 게스트 모드 | ✅ 지원 | ❌ 로그인 필요 |
| 발송 방식 | 클라이언트가 조건 확인 후 직접 표시 | 서버(Firebase)가 실제로 "보냄" |
| 지금 자동화 상태 | 완전 자동(앱 열 때마다 조건 확인) | **수신 인프라만 준비됨 — 발송은 아직 수동** |

두 시스템은 서로 대체가 아니라 보완 관계 — 껐다 켜지 않는 게 아니라 둘 다 계속 켜둠. 설정 탭에도 두 섹션이 나란히 있음(`notifSettingsWrap`/`pushSettingsWrap`).

## 구조

- **클라이언트**: `js/push.js`가 알림 권한 요청 → `getToken()`으로 이 기기의 FCM 토큰 발급 → `users/{uid}.fcmTokens`에 저장. 앱이 열려있는 동안 오는 메시지는 `onMessage()`로 직접 처리(포그라운드), 앱이 꺼져있을 때는 서비스워커가 대신 받음(백그라운드)
- **서비스워커**: 전용 `firebase-messaging-sw.js`를 따로 두지 않고, 기존 앱쉘 캐싱용 `sw.js`가 "브링 유어 오운 서비스워커(bring your own service worker)" 방식으로 `push`/`notificationclick` 이벤트를 직접 처리함(Firebase 공식 지원 방식) — 서비스워커를 2개 등록하면 스코프 충돌 위험이 있어서 하나로 통합. `getToken()` 호출 시 `serviceWorkerRegistration`으로 이 `sw.js`의 registration을 넘겨줌
- **Firestore 스키마 추가** (`users/{uid}` 문서, 가족 그룹에 속해있어도 **항상** 개인 계정 문서에 저장 — 토큰은 "이 계정으로 로그인한 이 브라우저"를 가리키는 값이라 공유 데이터 문서가 아니라 개인 계정 문서가 맞는 자리):
  ```json
  {
    "fcmTokens": {
      "{FCM 토큰 문자열}": { "updatedAt": 1234567890, "ua": "Mozilla/5.0 ..." }
    }
  }
  ```
  여러 기기/브라우저에서 로그인하면 토큰이 여러 개 쌓임(맵 구조라 자연스럽게 누적, `setDoc(..., {merge:true})`로 기존 토큰을 지우지 않고 추가만 함)

## 발송(보내는 쪽) — 지금 가능한 것 vs 아직 안 되는 것

- **✅ 지금 콘솔 설정만 마치면 바로 가능**: Firebase 콘솔 → Cloud Messaging → 새 캠페인 화면에서 코드 작성 없이 전체 사용자에게(또는 조건별로) 알림을 보낼 수 있음(이 프로젝트는 `measurementId`가 이미 설정돼있어 Analytics 연동 타겟팅도 가능) — "공지사항을 모든 사용자에게 한 번에 보내기" 같은 용도에 적합
- **❌ 아직 안 됨(2단계, 이번 범위 밖)**: "이 아이의 예방접종 하루 전"처럼 **사용자마다 다른 시각**에 자동으로 개인화된 알림을 보내는 것 — 이건 `fcmTokens`을 읽어서 실제로 발송을 트리거하는 서버 쪽 스케줄러(Cloud Functions + Cloud Scheduler)가 필요하고, Firebase Blaze(종량제) 요금제로 전환해야 함. 진행하려면 `docs/TODO.md` "FCM 2단계" 참고

## Firebase 콘솔에서 옹짐꾼님이 해야 할 일

1. ~~Cloud Messaging 사용 설정~~
2. ~~VAPID 키(웹 푸시 인증서) 발급~~
3. ~~`js/push.js`의 `VAPID_KEY` 상수 교체~~ (v0.0.37에서 완료)
4. **다음 확인 필요**: 설정 탭 → "진짜 푸시 알림 켜기" 클릭 → 브라우저 알림 권한 허용 → `users/{uid}` 문서에 `fcmTokens` 필드가 생기는지 Firestore 콘솔에서 확인
5. **테스트 발송**: Cloud Messaging → 캠페인 → 새 알림 만들기 → "테스트 메시지 전송"에 4번에서 확인한 토큰을 붙여넣고 전송 → 앱을 완전히 꺼둔 상태에서도 알림이 오는지 확인
6. (선택, 나중에) 개인화 자동 발송을 원하면 Blaze 요금제 전환 + Cloud Functions 작성 — `docs/TODO.md` "FCM 2단계" 참고
