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
| 배포 URL | https://momcal.vercel.app |
| 수익 모델 | 추후 광고 기반 (자세한 내용은 "수익화 & 트래픽 전략" 섹션 참고) |

---

## 기술 스택

- **Frontend**: Vanilla JS (ES6 Module), HTML5, CSS3
- **Backend**: Firebase Auth + Cloud Firestore
- **배포**: GitHub Push → Vercel 자동 배포
- **폰트**: 본문은 Nunito, "맘캘" 로고 워드마크는 Jua (Google Fonts CDN, Sprint 28 — 여러 스프린트에 걸친 폰트 실험 끝에 로고에만 좁혀 적용하는 것으로 정착)
- **아이콘**: 이모지 전용 (외부 아이콘 라이브러리 없음)
- **차트**: Chart.js (CDN, jsDelivr 폴백)
- **PWA**: manifest.json + sw.js (홈 화면 설치·오프라인 앱 셸 캐싱)

---

## 프로젝트 구조

```
momcal/
├── index.html              # 앱 진입점 (SEO 메타·OG 태그·PWA 메타 포함)
├── privacy.html             # 개인정보처리방침 (Sprint 16, 로그인 불필요)
├── terms.html                # 이용약관 (Sprint 16, 로그인 불필요)
├── contact.html              # 문의 페이지 (Sprint 16, 로그인 불필요)
├── manifest.json            # PWA 매니페스트
├── sw.js                     # 서비스 워커 (정적 파일 캐싱)
├── robots.txt                # 검색엔진 크롤링 허용 + sitemap 위치 안내 (Sprint 14)
├── sitemap.xml                # 검색엔진 제출용 사이트맵 (Sprint 14, Sprint 16에서 guide/정책 페이지 URL 추가)
├── guide/                    # 로그인 없이 보는 공개 육아정보 콘텐츠 (Sprint 16, SEO 목적)
│   ├── index.html             # 육아정보 허브 (카테고리 목록)
│   ├── pregnancy.html         # 임신 주차별 체크리스트 상세 (정적 HTML, JS 불필요)
│   ├── parenting.html         # 월령별 예방접종·건강검진 상세
│   ├── food.html               # 이유식 단계별 가이드
│   ├── government-support.html # 정부지원금 시기별 가이드 (Sprint 18)
│   └── guide.css               # 공개 페이지 전용 스타일 (앱 css와 독립)
├── scripts/
│   └── build-guide.mjs        # data/checklist-data.js → guide/*.html 정적 생성 스크립트 (Sprint 16)
├── icons/
│   ├── icon-192.png, icon-512.png (+maskable 버전)
│   ├── apple-touch-icon.png
│   ├── logo-mark.png          # 로고 옆 인라인용 마스코트 이미지, 배경 투명 (Sprint 24)
│   └── og-image.png          # 소셜 공유 미리보기 이미지 1200x630 (Sprint 14 생성, Sprint 22에서 마스코트 캐릭터로 교체)
├── css/
│   ├── main.css             # 전역 스타일, topbar, 대시보드, 광고 슬롯, 설치/공유 링크
│   ├── auth.css              # 로그인 화면, 유저 메뉴
│   ├── calendar.css          # 캘린더 그리드, 이벤트 필, 필터
│   ├── checklist.css        # 체크리스트 레이아웃, 상세 설명 아코디언
│   ├── modal.css              # 모달 공통
│   └── growth.css             # 성장그래프 페이지
├── js/
│   ├── app.js               # 메인 진입점 — Auth 감시·데이터 연결·SW 등록
│   ├── firebase.js          # Firebase 초기화 및 export
│   ├── state.js              # 전역 상태(S), Firestore 저장/로드
│   ├── auth.js                # 로그인·회원가입·Google·로그아웃
│   ├── ui.js                  # 홈 대시보드·등록·네비게이션
│   ├── calendar.js           # 캘린더 렌더·자동일정·드래그·필터·모달
│   ├── checklist.js          # 체크리스트 렌더·토글·상세 설명 아코디언
│   ├── checklistCalendarLink.js # 체크리스트 ↔ 캘린더 완료 상태 양방향 연동
│   ├── vaccineSeries.js      # 예방접종 실접종일 기준 이후 회차 자동 재계산
│   ├── govSupport.js         # 정부지원 체크리스트 탭
│   ├── growth.js              # 성장 기록 CRUD
│   ├── growthChart.js        # 성장그래프 페이지(Chart.js)
│   ├── pwaInstall.js         # "어플로 추가" 링크 (설치 프롬프트/iOS 안내)
│   ├── familyShare.js        # "배우자와 함께 쓰기" 공유 링크
│   ├── guestMode.js          # 게스트 모드 — 로그인 없이 로컬(localStorage)에 실제 데이터 저장 (Sprint 15)
│   ├── accountDelete.js      # 계정 영구 삭제(자체 탈퇴) — Firestore 문서 + Auth 계정 삭제 (Sprint 17)
│   ├── adSlot.js              # 광고 슬롯 컴포넌트 (AdSense 연동 준비)
│   ├── demoMode.js            # 예시 데이터로 둘러보기 (샘플 데이터, 저장 안 함 — 게스트 모드와는 별개)
│   ├── modal.js               # showModal(), cm()
│   └── utils.js                # today(), ageFmt() 등 유틸
└── data/
    ├── vaccines.js            # 예방접종 스케줄 (월령별 백신 목록 — 캘린더 자동일정의 단일 진실 공급원)
    ├── vaccine-series.js      # 예방접종 회차별 최소 접종 간격 (자동 재계산용)
    ├── pregnancy.js            # 임신 주차별 자동 일정
    ├── milestones.js          # 건강검진·발달·이유식 마일스톤 (예방접종은 다루지 않음 — vaccines.js와 역할 분리)
    ├── checklist-data.js       # 체크리스트 전체 데이터 (항목별 상세 설명 dd 필드 포함, Sprint 14)
    ├── checklist-links.js      # 체크리스트 ↔ 캘린더 일정 매핑
    ├── government-support.js   # 정부지원금 스케줄·안내
    ├── who-growth.js            # WHO 성장 백분위 근사 참고 테이블
    └── tips.js                  # 오늘의 육아 팁 (홈 대시보드·광고 슬롯 대체 콘텐츠 겸용)
```

> ⚠️ **예방접종 데이터는 `data/vaccines.js`(vaxSched)가 유일한 소스입니다.** 캘린더에 표시되는 개별 접종 이벤트(💉 DTaP 1차 등)는 전부 여기서 생성돼요. `data/milestones.js`의 건강검진 마일스톤에는 예방접종을 요약해서 언급하는 항목을 절대 추가하지 마세요 — 같은 날짜에 두 번 표시되는 "중복" 버그의 원인이었습니다 (Sprint 14에서 수정).

---

## Firebase 구조

- **프로젝트 ID**: `momcal-fd12b`
- **리전**: `asia-northeast3` (서울)
- **인증**: Email/Password + Google OAuth
- **Firestore 문서 경로**: `users/{uid}`

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

`js/state.js`에 정의. 모든 모듈이 `import { S } from './state.js'`로 공유.

| 키 | 타입 | Firebase 저장 | 설명 |
|----|------|:---:|------|
| `children` | Array | ✅ | 등록된 아이/임신 프로필 목록 |
| `customEvs` | Array | ✅ | 사용자 직접 추가 일정 |
| `dayStickers` | Object | ✅ | 날짜별 스티커 배열 |
| `checks` | Object | ✅ | 체크리스트 완료 상태 |
| `eventMods` | Object | ✅ | 자동 일정의 실제일·완료·메모 등 수정 사항 (Sprint 2) |
| `growthRecords` | Array | ✅ | 성장 기록 목록 (Sprint 4) |
| `evColors` | Object | ✅ | 사용자 지정 일정 색상 `{req, rec, food, vax, gov, custom}` — 없으면 기본색 사용 (Sprint 21) |
| `theme` | String | ✅ | 캘린더 테마 (rose/mint/sunny/lavender/peach) |
| `selC` | Number | ✅ | 현재 선택된 아이 인덱스 |
| `calY`, `calM` | Number | ❌ (UI 전용) | 캘린더 표시 연·월 |
| `calView` | String | ❌ | 'month' \| 'week' |
| `selDate` | String | ❌ | 선택된 날짜 (YYYY-MM-DD) |
| `evType` | String | ❌ | 일정 추가 종류 |
| `selSCat` | Number | ❌ | 스티커 카테고리 인덱스 |
| `clTab` | Number | ❌ | 체크리스트 탭 인덱스 |
| `selClCat` | Number | ❌ | 체크리스트 사이드바 선택 항목 |
| `growthMetric` | String | ❌ | 성장그래프 선택 지표 ('height'\|'weight'\|'head') |
| `isDemoMode` | Boolean | ❌ | 예시 데이터 둘러보기 여부 — 저장 안 함 (Sprint 8) |
| `isGuestMode` | Boolean | ❌ (로컬 저장은 함) | 게스트 모드 여부 — Firestore 대신 localStorage에 저장 (Sprint 15) |
| `calFilter` | Object | ❌ | 캘린더 타입 필터 {food, vax, gov} (Sprint 11) |

---

## 이벤트 타입

| 타입 | 의미 | 색상 |
|------|------|------|
| `req` | 필수 일정 | 핑크 #F06292 |
| `rec` | 추천 일정 | 민트 #4DB6AC |
| `vax` | 예방접종 | 보라 #9575CD |
| `gov` | 정부지원 | 그린 (Sprint 6 추가) |
| `custom` | 내 일정 | 파랑 #64B5F6 |

---

## 핵심 개발 원칙

1. **기존 기능 절대 삭제 금지** — 리팩터링·기능 추가 시에도 기존 동작 유지
2. **새 프로젝트를 생성하지 않는다** — 항상 기존 레포·기존 구조 위에서 이어서 작업
3. **Firebase 구조 유지** — Firestore 문서 스키마 변경 시 하위 호환성 확보 (필드 추가는 되지만 기존 필드명·구조는 바꾸지 않음)
4. **기존 UI 디자인을 최대한 유지** — UI_GUIDELINE.md의 컬러·타이포·컴포넌트 규칙을 따름
5. **모든 기능은 모듈화** — 새 기능은 새 파일 또는 기존 모듈에 함수 추가
6. **사용성 우선** — 복잡한 기능보다 매일 쓰는 기능을 더 쉽게, 부모가 매일 여는 앱을 목표로 개발
7. **window 노출 규칙** — 인라인 onclick에서 쓰는 함수는 모듈 하단에 `window.xxx = xxx`
8. **ES6 Module 사용** — `type="module"`, `import/export` 일관 적용

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

완료된 기능의 이력만 기록합니다. **예정된 작업·후보 기능은 TODO.md "다음 후보"를 참고하세요.**

### ✅ 완료 (Sprint 1~19)

| Sprint | 주요 기능 |
|:---:|------|
| 1 | Firebase 로그인(Email+Google), 아이/임신 프로필 등록·삭제, 예방접종·이유식 자동 일정, 캘린더(월/주간), 스티커, 체크리스트, 테마 5종, 모듈 리팩터링 |
| 2 | 일정 클릭 수정 Modal(권장일·실제일·병원·메모·완료), 일정 드래그 이동(PC)/길게 눌러 이동(모바일) |
| 3 | 체크리스트 임신 주차별 세분화(9단계), 진행률 시스템 개선(필수 100%→선택 보너스) |
| 4 | 홈 대시보드 개편(오늘 나이·다음 일정·체크리스트·성장·접종·팁 카드), 성장 기록 CRUD |
| 5 | 성장그래프 탭 (Chart.js) |
| 6 | 예방접종 실접종일 기준 이후 회차 자동 재계산, 정부지원 일정 자동 생성 |
| 7 | 체크리스트 진행률·배지 버그 수정 |
| 8 | 홈 화면 정리, 성장그래프 버그 수정, 로그인 없이 체험하기(데모 모드) |
| 9 | 성장그래프 P10/P90 또래 참고선, 모바일 드래그 버그 수정 |
| 10 | 정부지원 실시간 반영, 예방접종 그룹핑 표시, 성장그래프 생후일수 고정축, 레이아웃 조정(등록 버튼 이동) |
| 11 | 성장그래프 축 위치 조정, 캘린더↔체크리스트 완료 상태 양방향 연동, PWA(manifest·서비스워커), 캘린더 타입 필터, 예방접종 묶음 드래그 버그 수정 |
| 12 | 홈 탭 "홈 화면에 추가" 링크 (설치 프롬프트/iOS 안내) |
| 13 | "어플로 추가" 문구 변경, "배우자와 함께 쓰기" 공유 링크, 광고 슬롯 컴포넌트(AdSense 연동 준비), 상단 네비게이션 2줄 구조, 대시보드 카드 폭 고정 |
| 14 | 캘린더 예방접종 중복 표시 버그 수정, 체크리스트 항목별 상세 설명 펼치기(아코디언), SEO 메타/OG/sitemap.xml/robots.txt 적용, 수익화 전략 문서화 |
| 15 | 게스트 모드 신규 추가 — 로그인 없이도 실제 데이터를 로컬(localStorage)에 저장해 바로 사용 가능, 로그인은 상단 "🔐 로그인" 칩으로 재배치(백업·기기 간 동기화 목적), 로그인 시 게스트 데이터 자동 계정 이전(신규 계정 한정) |
| 16 | 로그인 없이 보는 공개 육아정보 콘텐츠(`guide/`) 신규 추가 — 임신·예방접종·이유식 체크리스트 137개 항목을 정적 HTML로 생성(SEO 목적), Google AdSense 심사 대비 개인정보처리방침·이용약관·문의 페이지 추가, sitemap.xml에 신규 URL 반영 |
| 17 | 계정 영구 삭제(자체 탈퇴) 기능 추가 — Firestore 문서·Auth 계정 삭제, 확인 문구 입력 방식의 오조작 방지, 재인증 자동 처리(이메일·Google), 문의 페이지 실제 이메일 반영 |
| 18 | 육아정보 공개 페이지에 정부지원금 가이드(`guide/government-support.html`) 추가 — 국민행복카드·부모급여·아동수당 등 16개 항목, `data/government-support.js` 기반 자동 생성, sitemap.xml·허브 페이지·전체 내비게이션에 반영 |
| 19 | 육아정보 4개 콘텐츠 페이지에 FAQPage 구조화 데이터(JSON-LD) 추가 — 항목별 질문·답변 형태로 변환해 검색엔진·생성형 AI 검색이 콘텐츠를 더 명확히 인식하도록 함 |
| 20 | 정부지원 마감 임박 강조 — 정확한 마감일 계산이 가능한 4개 항목(출생신고·부모급여·아동수당·양육수당)이 마감 7일 이내로 남으면 캘린더·데이 패널·일정 수정 모달·체크리스트 정부지원 탭에 빨간 테두리·⏰ 표시로 강조. `js/utils.js`에 `daysUntil()`, `js/calendar.js`에 `isGovDeadlineSoon()` 추가 |
| 21 | 캘린더 필 이모지 아이콘 제거(중복 표시·모바일 "..." 잘림 버그 수정) → 색상 기반 표시로 전환, 카테고리별(필수/추천/이유식/접종/정부지원/내일정) 색상 사용자 지정 기능(`S.evColors`) 추가, 육아정보 페이지에 기존 사용자 감지 시 CTA 문구 자동 전환, 육아정보 허브 페이지 전체 검색 + 카테고리별 페이지 내 검색 기능 추가 |
| 22 | 브랜드 리뉴얼 — 새 "M" 마스코트 캐릭터로 앱 아이콘(icon-192/512, 마스커블, apple-touch-icon) 전체 교체, og-image를 새 마스코트 기반으로 재제작, "맘캘" 워드마크 전용 폰트로 Fredoka 적용(본문은 Nunito 유지) |
| 23 | 캘린더 필 글자 잘림 추가 수정 — 실사용 확인 결과 Sprint 21의 아이콘 제거만으로는 부족했음이 확인되어, 1줄 말줄임 → 최대 2줄 줄바꿈(`-webkit-line-clamp:2`) 방식으로 전환, 셀 높이 확대(80→96px, 모바일 52→76px) |
| 24 | "맘캘 💕" 로고의 하트 이모지를 실제 마스코트 이미지(`icons/logo-mark.png`)로 교체(topbar·로그인 화면·육아정보 페이지 5곳), 서비스 워커 캐시 버전 갱신(`momcal-shell-v1`→`v2`)으로 최근 스프린트들의 아이콘·폰트 변경사항이 기존 사용자에게도 확실히 반영되도록 함 |
| 25 | 모바일 캘린더 필 글자 크기 축소(`.58rem`→`.5rem`, 모바일 전용) — 기존 640px 반응형 브레이크포인트에 규칙 추가, PC는 영향 없음 |
| 26 | 앱 전체 폰트를 Fredoka(한글 미지원으로 실제 미적용 상태였음)→Jua(한글 지원 귀여운 폰트)로 교체, 캘린더 필을 배경 박스 방식에서 네이티브 캘린더 스타일의 색상 텍스트 줄 방식으로 전면 개편(`renderPrimaryPill`/`renderEvDots` → `renderCellEvents`/`renderEventLine`) |
| 27 | PC 캘린더 글자 크기 확대(`.58rem`→`.66rem`, 모바일은 유지), 캘린더 일정을 "형광펜" 스타일(옅은 배경+진한 글자, 최소 여백)로 재개편, 폰트를 Jua/Fredoka 실험 이전의 Nunito로 원복(윤고딕은 상업용 폰트라 무료 CDN 적용 불가) |
| 28 | 육아정보 4개 페이지에 카테고리 탭 추가(스크롤 없이 원하는 구간으로 바로 이동), 홈 히어로 배너 축소·모바일 대시보드 1열 변경, "맘캘" 로고 폰트(Jua)를 로고 워드마크로만 범위 좁혀 재적용 + 정책 페이지(privacy/terms/contact) 로고 이미지 누락 발견해 반영, 장식용 이모지(💕✨🎀 등) 중 "AI스럽다"는 피드백 받은 자리들을 맥락에 맞는 이모지로 교체 |