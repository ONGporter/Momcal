# 맘캘 MomCal — 프로젝트 스펙

> **Claude에게**: 이 파일을 먼저 읽고 프로젝트 전체 맥락을 파악한 후 작업하세요.
>
> **이 문서의 역할**: 프로젝트가 *지금 어떤 상태인지* 설명하는 참고 문서입니다 — 구조 개요, Firebase 스키마, 버전 정책만 다룹니다. **기능별 상세 설계(가족 공유·게스트 모드·SEO·수익화·계정 삭제)는 `docs/product-specs/`로 분리되어 있습니다** — 목차는 `docs/product-specs/index.md` 참고.
> **할 일 목록이 아닙니다.** "지금 무엇을 해야 하는지"(현재 스프린트 확인 항목, 다음에 만들 후보 기능, 버그)는 전부 **TODO.md**에 있습니다. 새 기능을 추가하거나 예정된 작업을 적을 땐 이 파일이 아니라 TODO.md에 적어주세요.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | 맘캘 MomCal |
| 목적 | 임신~육아 일정·체크리스트·성장 기록 관리 웹앱 |
| 타겟 | 임산부, 0~5세 자녀를 둔 부모 |
| 철학 | **부모가 매일 여는 앱. 복잡한 기능보다 사용성 우선** |
| 레포 | https://github.com/ONGporter/Momcal |
| 배포 URL | https://momcal.app (커스텀 도메인, Vercel 연결 완료 · https://momcal.vercel.app 로도 계속 접속 가능) |
| 수익 모델 | 추후 광고 기반 (자세한 내용은 "수익화 & 트래픽 전략" 섹션 참고) |
| 버전 | v0.0.1부터 시작 (Sprint 29). 화면 최하단에 표시됨 — 앱 본체(`index.html`)와 육아정보 페이지(`guide/*.html`) 양쪽 모두 표시(v0.0.2부터) |

---

## 버전 관리 정책 (v0.0.1부터 시작, v0.0.2에서 정책 보완, v0.1.0에서 세션 단위 규칙 추가)

- 형식: `0.0.1` (major.minor.patch 비슷한 구조지만 정확한 semver는 아님)
- **끝자리**: 버그 수정처럼 작은 변경마다 Claude가 자율적으로 올림 (예: 0.1.0 → 0.1.1)
- **가운데 자리**: **v0.1.0부터는 새 대화(세션)를 시작할 때마다 자동으로 올리고 끝자리는 0으로 초기화**한다(옹짐꾼님 지시, v0.0.61 종료 후 반영). 예: v0.0.61로 끝난 세션 다음, 새 대화의 첫 업데이트는 `v0.1.0` — 그 대화 안에서 이어지는 수정은 `v0.1.1`, `v0.1.2`처럼 끝자리만 올린다. 그다음 또 새 대화를 시작하면 `v0.2.0`부터 다시 시작한다. (v0.0.x 시절엔 가운데 자리를 사용자가 지정하는 시점에만 올렸으나, 이 규칙으로 대체됨 — "새 대화 = 가운데 자리 +1, 끝자리 0"이 지금부터의 기준)
- **v0.0.2부터**: "스프린트"라는 개발 단위 명칭 대신 "버전"(v0.0.x)으로 통일해서 부름. Sprint 1~28은 버전 체계 도입 이전 기록이라 과거 주석·CHANGELOG 항목은 그대로 두되(역사적 기록), Sprint 29 = v0.0.1로 대응됨. 새로 작업할 때는 CHANGELOG.md 표제와 코드 주석에 "Sprint N" 대신 "vX.X.X"를 사용할 것
- **버전 문자열이 표시되는 두 곳** — 버전을 올릴 땐 반드시 두 곳을 함께 수정해야 함 (하나만 바꾸면 앱 본체와 육아정보 페이지 버전 표시가 어긋남):
  1. `index.html` 최하단 `.site-footer-version` 텍스트
  2. `scripts/build-guide.mjs`의 `APP_VERSION` 상수 (수정 후 `node scripts/build-guide.mjs` 재실행 필요 — 안 하면 `guide/*.html`에 반영 안 됨)

---

## 기술 스택

> 기술 스택 상세(폰트·글자 크기·PWA 등)는 `ARCHITECTURE.md`의 "기술 스택"으로 옮겼습니다. 여기서는 중복하지 않습니다.

## Firebase 구조

- **프로젝트 ID**: `momcal-fd12b`
- **리전**: `asia-northeast3` (서울)
- **인증**: Email/Password + Google OAuth + 카카오 로그인(Cloud Function 경유, v0.3.5 — `docs/product-specs/kakao-login.md` 참고)
- **요금제**: Blaze(종량제) — v0.0.38부터 Cloud Functions(FCM 예약 발송) 사용을 위해 전환됨
- **Firestore 문서 경로**: `users/{uid}` (+ v0.0.12부터 `families/{familyId}`, 아래 "가족 그룹 공유" 참고 / + v0.0.39부터 `adminBroadcasts/{broadcastId}`, 아래 "관리자 푸시 발송" 참고)

### Firestore 문서 스키마

```json
{
  "children": [
    {
      "id": 1234567890,
      "name": "민준",
      "gender": "m",
      "stage": "born",
      "birth": "2024-01-15",
      "due": "",
      "week": 0,
      "avatar": "momcal:avatar_boy"
    }
  ],
  "customEvs": [
    {
      "_id": 1234567890,
      "date": "2024-07-01",
      "title": "소아과 방문",
      "note": "메모",
      "type": "custom",
      "color": "#64B5F6",
      "auto": false
    }
  ],
  "dayStickers": {
    "2024-07-01": ["🌸", "💕", "momcal:hug"]
  },
  "checks": {
    "{childId}_{catKey}": {
      "{itemId}": true
    }
  },
  "eventMods": {
    "{eventKey}": {
      "actualDate": "2024-07-05",
      "hospital": "행복소아과",
      "memo": "다음 접종 예약함",
      "done": true,
      "govStatus": "applied",
      "recalculated": false
    }
  },
  "growthRecords": [
    { "id": 1234567890, "childId": 1234567890, "date": "2024-07-01", "height": 65, "weight": 7, "head": 42, "isFetal": false },
    { "id": 1234567891, "childId": 9876543210, "date": "2024-03-01", "week": 20, "height": 25.7, "weight": 330, "head": null, "isFetal": true }
  ],
  "itemFeedback": { "b0_1": "up" },
  "evColors": { "food": "#E53935", "vax": "#9575CD" },
  "theme": "rose",
  "selC": 0,
  "updatedAt": 1234567890
}
```

- `eventMods`의 키는 자동 일정이면 `auto_{원본날짜}_{제목}`, 커스텀 일정이면 `custom_{_id}` 형식 (`js/calendar.js`의 `getEventKey()` 참고) — v0.0.22부터 제목에 이모지 접두어가 안 붙음(예전 형식 키는 `js/state.js`의 `migrateEventModKeys()`가 로드 시 자동 이전)
- `growthRecords`는 Sprint 4에서 추가, `checks`/`eventMods`는 Sprint 2~6 사이 단계적으로 추가됨 — 전부 하위 호환 유지(과거 데이터에 필드가 없으면 빈 배열/객체로 처리). v0.0.23부터 `week`(임신 주수)·`isFetal`(태아 기록 여부) 필드 추가 — 둘 다 없으면(과거 데이터) 출생 후 기록으로 취급됨
- `itemFeedback`은 v0.0.23에서 추가 — 체크리스트 항목별 "도움돼요/아쉬워요" 개인 반응(다른 사용자와 집계되는 공개 투표 아님)
- `avatar`는 v0.0.53부터 순수 이모지(`👦`/`👧`/`👶`) 대신 `momcal:avatar_boy`/`momcal:avatar_girl` 토큰을 저장(캘린더 스티커 `dayStickers`의 `momcal:xxx` 토큰과 동일한 패턴) — 렌더링 시 `js/utils.js`의 `avatarDisplay()`가 이 맵을 보고 `<img>`로 바꿔치기하며, 매핑에 없는 값(예전에 저장된 순수 이모지)은 그대로 반환해 과거 데이터도 안 깨짐. `<select><option>`처럼 이미지를 아예 못 쓰는 자리는 `avatarTextFallback()`으로 성별 기반 이모지 텍스트만 별도로 씀(둘 다 성별 미정이면 남아 쪽을 기본값으로 함)

---

## 가족 그룹 공유

> `docs/product-specs/family-sharing.md`로 옮겼습니다.

---

## 게스트 모드

> `docs/product-specs/guest-mode.md`로 옮겼습니다.

---

## 공개 콘텐츠 페이지 (SEO) · 정책 페이지

> `docs/product-specs/seo-content.md`로 옮겼습니다.

---

## 계정 영구 삭제 (자체 탈퇴)

> `docs/product-specs/account-deletion.md`로 옮겼습니다.

---

## 관리자 푸시 발송

> `docs/product-specs/admin-push.md` 참고 (v0.0.39).

---

## 체크리스트 커스터마이징

> `docs/product-specs/checklist-customization.md` 참고 (v0.0.40).

---

## 전역 상태 객체 (S)

> `S`의 전체 필드 표는 `ARCHITECTURE.md`의 "전역 상태 객체 (S)"로 옮겼습니다.

---

## 이벤트 타입

> 이벤트 타입·색상 표는 `ARCHITECTURE.md`의 "이벤트 타입"으로 옮겼습니다.

---

## 핵심 개발 원칙

> 최우선 원칙(1~6번)은 `AGENTS.md`로, 코딩 컨벤션(window 노출 규칙·ES6 모듈·앱 본체/육아정보 동시 적용 원칙)은 `ARCHITECTURE.md`의 "코딩 컨벤션"으로 옮겼습니다. 새로 작업을 시작할 땐 이 두 문서를 먼저 확인하세요.

---

## 수익화 & 트래픽 전략

> `docs/product-specs/monetization.md`로 옮겼습니다 (SEO 적용 현황 표는 `docs/product-specs/seo-content.md`에 있음).

---

## 기능 목록 및 Sprint 현황

> **완료된 기능의 전체 이력은 CHANGELOG.md 맨 앞 "✅ 완료 기능 요약" 표로 옮겼습니다** (이 문서와 중복되어 있었고, 내용이 길어 버전 표시처럼 자주 갱신해야 할 항목을 놓치기 쉬웠음). 이 문서는 구조·스키마·원칙 같은 "지금 상태"만 다루고, 버전별 변경 이력은 CHANGELOG.md, 예정된 작업은 TODO.md "다음 후보"를 참고하세요.
