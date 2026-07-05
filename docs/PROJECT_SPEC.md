# 맘캘 MomCal — 프로젝트 스펙

> **Claude에게**: 이 파일을 먼저 읽고 프로젝트 전체 맥락을 파악한 후 작업하세요.
>
> **이 문서의 역할**: 프로젝트가 *지금 어떤 상태인지* 설명하는 참고 문서입니다 — 구조, 스키마, 원칙, 이미 완료된 기능의 이력만 다룹니다.
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

## 버전 관리 정책 (v0.0.1부터 시작, v0.0.2에서 정책 보완)

- 형식: `0.0.1` (major.minor.patch 비슷한 구조지만 정확한 semver는 아님)
- **끝자리**: 버그 수정처럼 작은 변경마다 Claude가 자율적으로 올림 (예: 0.0.1 → 0.0.2)
- **가운데 자리**: 기능 단위 업데이트 등 의미 있는 변경 시점 — **사용자가 지정하는 시점에만** 올림 (Claude가 임의로 올리지 않음)
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
- **인증**: Email/Password + Google OAuth
- **Firestore 문서 경로**: `users/{uid}` (+ v0.0.12부터 `families/{familyId}`, 아래 "가족 그룹 공유" 참고)

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
      "avatar": "👦"
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
    "2024-07-01": ["🌸", "💕"]
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
    { "id": 1234567890, "childId": 1234567890, "date": "2024-07-01", "height": 65, "weight": 7, "head": 42 }
  ],
  "evColors": { "food": "#E53935", "vax": "#9575CD" },
  "theme": "rose",
  "selC": 0,
  "updatedAt": 1234567890
}
```

- `eventMods`의 키는 자동 일정이면 `auto_{원본날짜}_{제목}`, 커스텀 일정이면 `custom_{_id}` 형식 (`js/calendar.js`의 `getEventKey()` 참고)
- `growthRecords`는 Sprint 4에서 추가, `checks`/`eventMods`는 Sprint 2~6 사이 단계적으로 추가됨 — 전부 하위 호환 유지(과거 데이터에 필드가 없으면 빈 배열/객체로 처리)

---

## 가족 그룹 공유 (v0.0.12)

각자 자기 계정으로 로그인한 채로 같은 데이터를 실시간 공동 편집할 수 있는 기능. 기존 `users/{uid}` 구조를 바꾸지 않고 **덧붙이는 방식**으로 구현함(핵심 개발 원칙 3번 — 기존 필드명·구조 유지).

### 구조
- **`users/{uid}` 문서에 필드 추가**: `familyId` (string|null) — 가족 그룹에 속해있으면 그 그룹의 ID, 아니면 `null`/필드 없음
- **신규 컬렉션 `families/{familyId}`**: `users/{uid}`와 동일한 앱 데이터 스키마(`children`/`customEvs`/`dayStickers`/`checks`/`eventMods`/`growthRecords`/`evColors`/`theme`/`selC`) + `members`(uid 배열) + `createdAt`
- **데이터 읽기/쓰기 분기** (`js/state.js`의 `dataDocRef()`): `S.familyId`가 있으면 `families/{familyId}`를, 없으면 기존처럼 `users/{uid}`를 그대로 사용 — 가족 그룹에 참여하지 않은 기존 사용자는 동작이 이전과 100% 동일함
- **구독 구조** (`js/state.js`의 `subscribeToUserData()`): `users/{uid}`를 항상 구독해서 `familyId`를 확인하고, `familyId`가 있을 때만 `families/{familyId}`를 추가로 구독하는 2단계 구조

### 초대 코드
- 8자리 랜덤 코드(`O`/`0`/`I`/`1`처럼 헷갈리는 문자 제외) — `families/{familyId}`의 문서 ID로 그대로 사용
- 가족 그룹 생성 시 지금 내 데이터를 그대로 `families/{familyId}`로 복사(`createFamily()`), 참여 시 초대 코드로 기존 가족 문서에 내 uid를 `members`에 추가하고 내 `users/{uid}.familyId`를 그 코드로 연결(`joinFamily()`), 나가면 `familyId`를 지우고 원래 내 `users/{uid}` 데이터로 복귀(`leaveFamily()`, 예전 데이터는 지워지지 않고 그대로 남아있음)

### ⚠️ Firestore 보안 규칙 — 콘솔에서 직접 추가 필요
코드만으로는 실제 접근 권한까지 설정할 수 없어서, Firebase 콘솔 → Firestore Database → 규칙에 아래 내용을 **추가**해야 실제로 동작함(기존 `users/{uid}` 규칙은 그대로 두고 이 블록만 추가):
```
match /families/{familyId} {
  allow read, write: if request.auth != null;
}
```
초대 코드 자체를 "이 코드를 아는 사람 = 가족"으로 취급하는 단순한 모델(멤버 목록 기반 규칙은 "참여" 시점에 아직 멤버가 아닌 사람이 자기 uid를 추가해야 하는 구조적 문제가 있어 채택하지 않음) — 링크 공유와 비슷한 수준의 신뢰 모델.

✅ **v0.0.15에서 실제 두 계정으로 테스트 완료** — 초대 코드로 참여 후 양쪽 계정에서 캘린더·체크리스트가 실시간으로 함께 반영되는 것 확인됨(베타 딱지는 유지, 아래 TODO.md "미완성" 목록에서는 제외).

---

## 게스트 모드 (로컬 저장) — Sprint 15

로그인하지 않은 기본 상태는 **게스트 모드**입니다. Firebase 로그인 화면으로 막지 않고, 앱을 곧바로 실제로 사용할 수 있습니다.

- **저장 위치**: `localStorage` 키 `momcal_guest_v1` (기기·브라우저 단위 — 다른 기기에서는 보이지 않음)
- **저장 데이터 구성**: Firestore 문서 스키마와 동일 (`children`, `customEvs`, `dayStickers`, `checks`, `eventMods`, `growthRecords`, `theme`, `selC`)
- **저장 트리거**: 기존 코드 전체가 이미 `debounceSave()` → `saveState()`를 거치므로, `js/state.js`의 `saveState()` 한 곳에서 `S.isGuestMode` 여부로 Firestore/localStorage를 분기함 — 개별 기능 코드는 전혀 수정할 필요 없었음
- **로그인 진입점**: 상단 우측 "🔐 로그인" 칩(`#guestLoginChip`) → 로그인 화면이 게스트 화면 위에 열림(닫기 ✕ 가능, 강제 관문 아님)
- **로그인 시 데이터 이전 규칙** (`js/app.js`의 `onDataLoaded`):
  - Firestore에 문서가 없는 완전히 새 계정 + 이 기기에 게스트 데이터가 있으면 → 게스트 데이터를 그대로 계정으로 업로드하고 로컬 데이터는 정리
  - 이미 데이터가 있는 기존 계정으로 로그인하면 → 클라우드 데이터를 그대로 사용, 이 기기의 게스트 데이터는 덮어쓰지 않고 그대로 둠(자동 병합은 하지 않음)
- **"예시 데이터로 둘러보기"(`js/demoMode.js`, 구 "체험 모드")와의 차이**: 데모는 저장이 전혀 안 되는 미리 채워진 샘플 데이터 미리보기이고, 게스트 모드는 실제 사용자의 진짜 데이터가 로컬에 저장됨. 데모 시작 시 `S.isGuestMode`를 꺼서 샘플 데이터가 게스트의 실제 로컬 데이터를 덮어쓰지 않도록 안전장치가 있고, 데모 종료 시 게스트 화면(자신의 실제 데이터)으로 복귀함

---

## 공개 콘텐츠 페이지 (SEO) — Sprint 16

`guide/` 아래 4개 페이지(`pregnancy.html`, `parenting.html`, `food.html`, `government-support.html`)와 허브(`guide/index.html`)는 로그인·JS 실행 없이도 검색엔진이 텍스트를 그대로 읽을 수 있는 **순수 정적 HTML**입니다. 앱 본체(SPA)와는 완전히 분리되어 있습니다 — 같은 저장소·같은 배포에 포함되지만, Firebase나 앱의 JS 모듈을 전혀 로드하지 않습니다.

- **콘텐츠 출처**: `data/checklist-data.js`(임신/육아/이유식 체크리스트 항목)와 `data/government-support.js`(정부지원 제도 일정)를 그대로 사용 — 앱 데이터와 내용이 어긋나지 않도록 직접 손으로 쓰지 않고 스크립트로 생성함
- **생성 방법**: `node scripts/build-guide.mjs`를 저장소 루트에서 실행하면 `data/checklist-data.js`를 읽어 `guide/*.html`을 다시 만듦
- **⚠️ 체크리스트 내용을 수정했다면 반드시 이 스크립트를 다시 실행**해서 가이드 페이지도 함께 갱신해야 함 (자동으로 동기화되지 않음 — 정적 파일이기 때문)
- **스타일**: `guide/guide.css` 하나로 `guide/` 페이지와 `privacy.html`/`terms.html`/`contact.html`이 공통으로 사용. UI_GUIDELINE.md의 브랜드 컬러·폰트를 따르지만 앱 전용 CSS(`css/main.css` 등)와는 독립적 (앱에 불필요한 스타일을 끌어오지 않기 위함)
- **앱과의 연결**: 앱 하단 푸터·로그인 화면에 육아정보/정책 페이지 링크가 있고, 가이드 페이지에는 "맘캘 앱 무료로 쓰기" CTA가 곳곳에 있어 콘텐츠 → 앱 유입 동선을 만듦
- **구조화 데이터(JSON-LD, Sprint 19)**: 4개 콘텐츠 페이지(`pregnancy`/`parenting`/`food`/`government-support`)에는 각 항목을 질문·답변 쌍으로 변환한 `FAQPage` 스키마가 `<head>`에 삽입되어 있음 (`scripts/build-guide.mjs`의 `faqJsonLd()`가 생성). ⚠️ 구글이 2023년부터 FAQ 리치 스니펫 노출을 정부·의료기관 등 공신력 있는 사이트로 제한해서, 일반 사이트인 맘캘에는 검색결과의 시각적 리치 스니펫은 잘 안 뜰 가능성이 높음 — 다만 AI 개요·생성형 검색이 콘텐츠를 인용할 때 구조를 더 명확히 인식하는 데 도움이 될 수 있어 추가함 (GEO 목적)
- **검색 기능 (Sprint 21)**: 허브 페이지(`guide/index.html`)에는 4개 페이지 153개 항목 전체를 대상으로 하는 사이트 전체 검색창이 있음 — 빌드 시점에 `buildSearchIndex()`가 만든 JSON을 페이지에 심어두고, 입력 시 클라이언트에서만 필터링(서버 호출 없음). 각 카테고리 페이지에는 그 페이지 안에서만 즉석 필터링하는 검색창이 별도로 있음. 항목마다 `id` 속성(체크리스트는 `it.id`, 정부지원은 `it.key`)이 있어 검색 결과에서 `#앵커`로 바로 이동 가능
- **기존 사용자 CTA 전환 (Sprint 21)**: 정적 페이지라 로그인 여부를 서버에서 알 수 없지만, 앱과 같은 도메인이라 `localStorage`를 공유하는 점을 이용해 게스트 데이터(`momcal_guest_v1`) 또는 Firebase 로그인 세션(`firebase:authUser:` 접두 키) 흔적으로 기존 사용자를 감지함 — 감지되면 "무료로 시작하기" 문구가 "앱으로 돌아가기"로 자동 전환됨 (`returningUserScript()`)
- **⚠️ 검증 도구 선택 주의**: Google "리치 검색결과 테스트"(search.google.com/test/rich-results)는 일반 사이트의 FAQPage를 아예 검사 대상에서 제외하는 것으로 보여, 코드가 정상이어도 "감지된 항목 없음"이 뜸 (배포 문제·문법 오류가 아님, 실사용 확인됨). JSON-LD가 실제로 유효한지 확인하려면 구글 도구 대신 **schema.org 공식 검증 도구**(validator.schema.org)를 사용할 것

### 정책 페이지 (Google AdSense 심사 준비)

`privacy.html`(개인정보처리방침), `terms.html`(이용약관), `contact.html`(문의)은 향후 AdSense 심사에 대비해 만들어둠.

- 문의 이메일은 `jws12131411@gmail.com`으로 반영됨 (Sprint 17)
- 개인정보처리방침의 "계정 삭제·데이터 삭제는 문의 이메일로 요청" 문구는 Sprint 17에서 앱 내 자체 탈퇴 기능이 추가되며 함께 갱신됨 (아래 "계정 영구 삭제" 섹션 참고)

---

## 계정 영구 삭제 (자체 탈퇴) — Sprint 17

사용자 메뉴(우측 상단 프로필 클릭) → "계정 영구 삭제"에서 로그인 계정을 스스로 탈퇴할 수 있음.

- **삭제 대상**: Firestore 문서(`users/{uid}`, 아이 프로필·캘린더·체크리스트·성장 기록 전부) + Firebase Auth 계정 자체
- **삭제 순서**: Firestore 문서 삭제 → Auth 계정 삭제 (Firestore 문서가 이미 없어도 에러 없이 무시하고 계속 진행하도록 처리)
- **오조작 방지**: 되돌릴 수 없는 파괴적 동작이라, "삭제"라는 문구를 정확히 입력해야만 삭제 버튼이 활성화되는 확인 모달을 거침
- **재인증 처리**: Firebase는 로그인한 지 오래된 세션에서는 보안상 계정 삭제를 거부하고 `auth/requires-recent-login` 에러를 던짐 — 이 경우 로그인 방식에 맞춰 자동으로 재인증을 요청한 뒤 삭제를 재시도함
  - 이메일/비밀번호 로그인 → 비밀번호 재입력 모달
  - Google 로그인 → Google 재인증 팝업(`reauthenticateWithPopup`)
- 삭제 완료 후에는 `onAuthStateChanged`가 자동으로 게스트 모드로 전환함 (Sprint 15 게스트 모드 로직 재사용, 별도 처리 불필요)
- 신규 파일: `js/accountDelete.js`

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

## 수익화 & 트래픽 전략 (Sprint 14 추가)

맘캘은 **향후 광고 기반으로 수익화할 예정**입니다. 광고 수익은 결국 트래픽(조회수·방문자수)에 비례하므로, 아래 원칙을 새 기능 설계 시 함께 고려합니다.

### 광고 수익화 준비 (구현 완료)
- `js/adSlot.js` — 홈 대시보드·체크리스트·성장 페이지 하단에 광고 슬롯 컴포넌트 배치. 현재는 AdSense 미연동 상태(`AD_ENABLED=false`)라 육아 팁으로 대체 표시되며, 심사 통과 후 값만 채우면 바로 전환됨 (Sprint 13)

### 조회수·유입 확대를 위해 고려할 점
- **로그인 장벽 (Sprint 15에서 완화, Sprint 16·18에서 실질적 콘텐츠 확보)**: 게스트 모드로 가입 장벽은 낮아졌고, `guide/` 공개 콘텐츠 페이지로 검색엔진이 실제로 색인할 수 있는 텍스트 콘텐츠(임신·예방접종·이유식·정부지원 상세 정보, 총 153개 항목)가 생김. 이전엔 "SPA라 색인할 페이지가 사실상 1개뿐"이었는데, 이제 `guide/` 하위 4개 페이지가 추가되어 "DTaP 1차 예방접종", "이유식 쌀미음", "부모급여 신청" 같은 구체적인 키워드로도 검색엔진에 걸릴 가능성이 생김
- **SEO 기본기**: `robots.txt`, `sitemap.xml`(guide·정책 페이지 URL 포함), Open Graph/Twitter 메타 태그 적용 완료 — 상세 내용은 아래 "SEO" 절 참고
- **콘텐츠 확장**: `guide/` 페이지는 `data/checklist-data.js`에서 스크립트로 생성되므로, 체크리스트에 항목을 추가할 때마다 `node scripts/build-guide.mjs`만 다시 실행하면 공개 콘텐츠도 함께 늘어남
- **재방문율**: 광고 노출 총량은 결국 "얼마나 자주 여는 앱인가"에 달려 있음 — 알림(FCM), 매일 확인할 이유(오늘의 팁, 다가오는 일정)를 늘리는 기능이 광고 수익과도 직결됨

### SEO 적용 현황 (Sprint 14)

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 메타 description/keywords, canonical | ✅ 적용 | `index.html` |
| sitemap.xml | ✅ 적용 | 현재는 SPA라 단일 URL만 포함 |
| robots.txt | ✅ 적용 | 전체 허용 + sitemap 위치 안내 |
| Open Graph / Twitter Card | ✅ 적용 | 카카오톡·페이스북·트위터 공유 시 미리보기 이미지(`icons/og-image.png`) 노출 |
| 로그인 없이 보는 공개 콘텐츠 | ✅ 적용 (Sprint 16, Sprint 18에서 정부지원 추가) | `guide/` — 임신·예방접종·이유식·정부지원 상세 정보 153개 항목, 정적 HTML |
| AdSense 심사용 정책 페이지 | ✅ 적용 (Sprint 16) | `privacy.html`/`terms.html`/`contact.html` (Sprint 17에서 문의 이메일 반영) |
| Google Search Console 등록 | ✅ 소유권 확인 완료 | 사이트맵 제출 등 후속 절차는 TODO.md 참고 |
| 네이버 서치어드바이저 등록 | ✅ 소유권 확인 완료 | 사이트맵 제출·수집 요청 등 후속 절차는 TODO.md 참고 |

---

## 기능 목록 및 Sprint 현황

> **완료된 기능의 전체 이력은 CHANGELOG.md 맨 앞 "✅ 완료 기능 요약" 표로 옮겼습니다** (이 문서와 중복되어 있었고, 내용이 길어 버전 표시처럼 자주 갱신해야 할 항목을 놓치기 쉬웠음). 이 문서는 구조·스키마·원칙 같은 "지금 상태"만 다루고, 버전별 변경 이력은 CHANGELOG.md, 예정된 작업은 TODO.md "다음 후보"를 참고하세요.
