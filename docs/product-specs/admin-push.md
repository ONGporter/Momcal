# 관리자 푸시 발송 (v0.0.39)

> 상태: 🟡 코드 구현 완료 · **Firebase 콘솔 설정(보안 규칙) + 관리자 클레임 부여 대기**
> admin.html에서 제목·내용·대상(전체/임산부/연령별/특정 UID)을 입력해 즉시 또는 예약 발송할 수 있는 관리자 전용 도구.

## 왜 별도 페이지(`admin.html`)인가

`index.html` SPA 안에 탭으로 넣지 않고 완전히 분리된 정적 페이지로 만든 이유:
- 일반 사용자 번들에 관리자 코드·UI가 섞여 들어가지 않게 하기 위함 (코드 분리 = 노출 표면 축소)
- `privacy.html`/`contact.html`과 같은 기존 "독립 정적 페이지" 패턴을 그대로 재사용
- `sw.js`의 `APP_SHELL`(오프라인 캐시 대상)에도 포함하지 않음 — 관리자 도구는 오프라인 지원이 필요 없음(정책 페이지들과 동일한 취급)

## 접근 제어 — 2단계 방어

1. **클라이언트 (UI 게이트)** — `admin.html` 접속 시 로그인 요구 → 로그인 성공 후 `getIdTokenResult(user, true)`로 ID 토큰의 커스텀 클레임을 확인해서 `admin === true`가 아니면 "접근 권한 없음" 화면만 보여줌. 이건 **UI를 보여줄지**만 결정하는 것이지 실제 보안 방어선이 아님.
2. **서버 (Firestore 보안 규칙, 실제 방어선)** — `adminBroadcasts` 컬렉션은 커스텀 클레임이 있는 사용자만 읽고 쓸 수 있어야 함. **아래 규칙을 Firebase 콘솔 → Firestore Database → 규칙에 반드시 추가할 것** (AGENTS.md 규칙상 Claude가 직접 적용할 수 없는 영역 — 코드로 대체 불가):

```
match /adminBroadcasts/{broadcastId} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

이 규칙을 추가하지 않으면 관리자가 아닌 로그인 사용자도 브라우저 콘솔에서 직접 Firestore를 호출해 발송 문서를 만들 수 있음 — **배포 전 필수 설정**.

## 관리자 지정 방법 (커스텀 클레임)

Firestore 필드가 아니라 **Firebase Auth 커스텀 클레임**으로 관리자를 판별함(위조 불가능, Admin SDK로만 설정 가능). 로컬에서 1회성으로 실행:

```bash
cd functions
node scripts/set-admin-claim.cjs <UID>            # 관리자 권한 부여
node scripts/set-admin-claim.cjs <UID> --check     # 현재 상태만 확인
node scripts/set-admin-claim.cjs <UID> --remove    # 권한 해제
```

UID는 Firebase 콘솔 → Authentication → Users에서 확인. 최초 1회 `gcloud auth application-default login`이 필요할 수 있음(스크립트 파일 상단 주석 참고). 권한 부여 후 해당 계정은 **로그아웃 후 다시 로그인**해야 적용됨(ID 토큰 갱신 시점에만 클레임이 반영됨).

## 데이터 모델 — `adminBroadcasts/{broadcastId}`

```json
{
  "title": "맘캘 새 소식",
  "body": "이번 주 업데이트를 확인해보세요",
  "target": "all",
  "targetParams": {},
  "scheduledAt": null,
  "status": "pending",
  "createdBy": "관리자 uid",
  "createdByEmail": "admin@example.com",
  "createdAt": 1234567890,
  "sentAt": null,
  "result": null
}
```

- `target`: `'all'` | `'pregnant'` | `'ageRange'` | `'uid'`
- `targetParams`: `ageRange`면 `{ minMonth, maxMonth }`, `uid`면 `{ uids: [...] }`, 그 외는 `{}`
- `scheduledAt`: `null`이면 즉시 발송, 미래 timestamp(ms)면 예약 발송
- `status`: `'pending'` → `'sent'` | `'failed'`
- `result`(발송 후 채워짐): `{ targetUserCount, sentUserCount, successCount, failCount }`
  - `targetUserCount`: 대상 조건에 맞은 사용자 수(푸시 토큰 유무 무관)
  - `sentUserCount`: 그중 실제 푸시 토큰이 있어 발송을 시도한 사용자 수
  - `successCount`/`failCount`: 토큰(기기) 단위 성공/실패 수 — 사용자 1명이 여러 기기를 등록했을 수 있어 사용자 수와 다를 수 있음

## 대상(target) 산정 로직

`functions/index.js`의 `getEffectiveChildren()`/`matchesBroadcastTarget()`이 담당 — `js/state.js`의 `dataDocRef()` 분기(가족 그룹이면 `families/{familyId}` 문서, 아니면 `users/{uid}` 자체)와 동일한 규칙으로 각 사용자가 실제로 보고 있는 `children` 배열을 구한 뒤 판정함.

- **전체**: 조건 없음
- **임산부**: `children` 중 `stage === 'preg'`인 항목이 하나라도 있으면 대상
- **연령별**: `children` 중 출생아(`stage !== 'preg'`, `birth` 있음)의 만 나이(개월, KST 기준)가 `[minMonth, maxMonth]` 범위에 하나라도 들어오면 대상
- **특정 UID**: 대상 산정 없이 입력된 UID로 `users/{uid}` 문서를 직접 조회

## 발송 처리 — Cloud Functions (`functions/index.js`)

- **즉시 발송**: `onBroadcastCreated`(Firestore `onDocumentCreated` 트리거) — `scheduledAt`이 없는 문서가 생성되면 곧바로 실행됨(보통 몇 초 이내)
- **예약 발송**: `processScheduledBroadcasts`(5분마다 실행되는 `onSchedule`) — `status == 'pending' && scheduledAt <= 지금`인 문서를 찾아 발송. **예약 시각은 최대 5분까지 늦게 발송될 수 있음**(정확히 그 순간이 아니라 "그 시각이 지난 뒤 처음 도는 5분 주기"에 처리됨)
- 두 함수 모두 실제 발송은 `sendToUser()`(기존 `dailyPushCheck`가 쓰던 함수를 `title` 파라미터를 받도록 확장해 공용으로 씀)를 재사용 — 무효 토큰 자동 정리 로직도 동일하게 적용됨
- ⚠️ `processScheduledBroadcasts`의 쿼리(`status ==` + `scheduledAt <=` 복합 조건)는 **Firestore 복합 색인이 필요**함 — 배포 후 최초 실행 시 오류 로그에 색인 생성 링크가 뜨면 그걸 눌러서 한 번 만들어줘야 정상 동작함 (Firestore에서 흔한 절차, 별도 코드 작업 불필요)

## 배포 체크리스트 (옹짐꾼님 액션)

1. Firebase 콘솔 → Firestore Database → 규칙에 위 `adminBroadcasts` 규칙 추가
2. `functions/scripts/set-admin-claim.cjs`로 관리자 계정에 클레임 부여
3. `cd functions && npm run deploy` (predeploy 훅이 `sync-data.cjs`를 자동 실행함, 기존 `dailyPushCheck`와 함께 `onBroadcastCreated`/`processScheduledBroadcasts`도 같이 배포됨)
4. 관리자 계정으로 https://momcal.app/admin.html 접속 → 로그아웃 후 재로그인(클레임 반영) → 접근 확인
5. 테스트 발송 1건(전체 대상, 즉시) → 발송 이력에서 `status: 'sent'`와 `result` 값 확인
6. 예약 발송 1건 테스트 → 5분 이내 발송되는지 확인(첫 실행 시 색인 생성이 필요하면 Firebase 콘솔 로그의 안내 링크 사용)

## 알려진 한계 (다음에 개선 가능)

- 예약 발송의 시간 정밀도가 최대 5분 — 초 단위 정밀도가 필요하면 Cloud Tasks 등으로 개선 가능(현재는 과설계로 판단해 보류)
- 발송 취소/수정 기능 없음 — 잘못 예약한 건은 Firebase 콘솔에서 Firestore 문서를 직접 지우거나 `status`를 `'failed'`로 바꿔서 막아야 함
- 발송 이력 목록은 최근 30건만 표시(페이지네이션 없음)
