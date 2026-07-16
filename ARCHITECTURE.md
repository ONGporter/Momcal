# ARCHITECTURE.md

> 맘캘 MomCal의 기술 아키텍처 개요입니다. 자주 바뀌지 않는 **"어떻게 만들어졌는지"**를 다룹니다.
> 지금 상태의 세부 사항(Firebase 스키마 전체, 기능별 설계, 수익화 전략 등)은 `docs/PROJECT_SPEC.md`를,
> 에이전트 작업 원칙·워크플로는 `AGENTS.md`를 참고하세요.

---

## 개요

앱은 두 갈래로 나뉩니다.

1. **앱 본체 (SPA)** — `index.html` 하나에 모든 화면(홈/캘린더/체크리스트/성장/설정)이 담겨 있고 JS로 전환. Firebase 로그인 없이도 게스트 모드로 바로 사용 가능
2. **공개 콘텐츠 페이지 (`guide/`)** — 로그인·JS 실행 없이도 검색엔진이 읽을 수 있는 정적 HTML. `scripts/build-guide.mjs`가 `data/*.js`로부터 생성(SEO 목적, 직접 편집 금지)

두 갈래 모두 같은 브랜드(폰트·색상·로고·버전 표시)를 공유하지만 코드는 독립적입니다 — 아래 "동시 적용 원칙" 참고.

---

## 기술 스택

- **Frontend**: Vanilla JS (ES6 Module), HTML5, CSS3 — 프레임워크·번들러 없음
- **Backend**: Firebase Auth + Cloud Firestore + Cloud Functions(v0.0.38부터, FCM 예약 발송용 — Blaze 요금제)
- **배포**: 앱 본체는 GitHub Push → Vercel 자동 배포(빌드 스텝 없음, 정적 파일 그대로 서빙). `functions/`는 별도 경로로 `firebase deploy --only functions`(수동, Vercel과 무관 — `docs/product-specs/push-notifications.md` 참고)
- **폰트**: "온글잎 박다현체"(Ownglyph PDH)를 기본으로 사용 — 제목·본문·버튼·로고 대부분 동일, `fonts/OwnglyphParkDahyun.ttf`를 `@font-face`로 직접 서빙(외부 CDN 아님). Regular 굵기만 있어 굵게 표시가 필요한 곳도 `font-weight: normal`로 고정. **예외**: 체크리스트 세부 설명·육아정보 항목 설명·정책 페이지 본문 등 정보 전달용 긴 글은 "오뮤 다예쁨체"(Omyu Pretty, `fonts/OmyuPretty.ttf`)로 별도 적용
- **기준 글자 크기**: `html { font-size: 19px }` — 앱 전체 `rem` 기반 글자가 이 값에 비례해서 커짐. 단, 캘린더 셀 안 이벤트 텍스트(`.ev-line`/`.ev-more`/`.week-ev-block`, `css/calendar.css`)는 셀 공간이 빠듯해 의도적으로 `px`로 고정해 이 확대에서 제외됨 — **새로 만드는 캘린더 셀 안 텍스트도 이 규칙을 따를지 검토할 것**. 설정 탭에서 사용자가 5단계로 직접 조절 가능(`html[data-fontsize]`, `js/fontSize.js`); 캘린더 안 글자만 따로 조절하는 설정도 별도로 있음(`html[data-cal-fontsize]`, `js/calFontSize.js`)
- **아이콘**: 이모지 전용 (외부 아이콘 라이브러리 없음)
- **차트**: Chart.js (CDN, jsDelivr 폴백)
- **DOM→이미지 캡처**: html2canvas (CDN, jsDelivr 폴백 — v0.0.23, 체크리스트 이미지 공유 전용)
- **PWA**: `manifest.json` + `sw.js` (홈 화면 설치·오프라인 앱 셸 캐싱)

---

## 디렉터리 구조

```
momcal/
├── AGENTS.md                # AI 에이전트 진입점(원칙·워크플로)
├── ARCHITECTURE.md           # 이 문서
├── docs/                     # 프로젝트 문서
│   ├── PROJECT_SPEC.md        # 지금 상태(스키마 상세, 기능 설계, 수익화 전략)
│   ├── UI_GUIDELINE.md        # 디자인 시스템(컬러·타이포·컴포넌트)
│   ├── TODO.md                 # 지금 할 일(확인 항목·다음 후보·버그)
│   └── CHANGELOG.md           # 버전별 변경 이력 + 완료 기능 요약 표
├── index.html                # 앱 진입점 (SEO 메타·OG 태그·PWA 메타 포함)
├── privacy.html / terms.html / contact.html   # 정책 페이지 (로그인 불필요)
├── admin.html                 # 관리자 전용 푸시 발송 페이지 (v0.0.39, admin 커스텀 클레임 필요, SPA 밖 독립 진입점)
├── manifest.json             # PWA 매니페스트
├── sw.js                      # 서비스 워커 (정적 파일 캐싱)
├── robots.txt / sitemap.xml   # 검색엔진 크롤링·사이트맵
├── guide/                     # 공개 육아정보 콘텐츠 (SEO 목적, 직접 편집 금지)
│   ├── index.html              # 육아정보 허브 (카테고리 목록)
│   ├── pregnancy.html          # 임신 주차별 체크리스트 상세
│   ├── parenting.html          # 월령별 예방접종·건강검진 상세
│   ├── food.html                # 이유식 단계별 가이드
│   ├── government-support.html  # 정부지원금 시기별 가이드
│   └── guide.css                # 공개 페이지 전용 스타일 (앱 css와 독립)
├── scripts/
│   └── build-guide.mjs         # data/checklist-data.js 등 → guide/*.html 정적 생성 스크립트
├── icons/                      # PWA 아이콘, OG 이미지, 로고 마크
├── fonts/                       # 커스텀 폰트 파일 (@font-face로 직접 서빙)
├── css/
│   ├── main.css               # 전역 스타일, topbar, 대시보드, 광고 슬롯, 설치/공유 링크
│   ├── auth.css                # 로그인 화면, 유저 메뉴
│   ├── calendar.css            # 캘린더 그리드, 이벤트 필, 필터, 주간뷰 시간대 그리드
│   ├── checklist.css           # 체크리스트 레이아웃, 상세 설명 아코디언
│   ├── modal.css                # 모달 공통
│   ├── growth.css               # 성장그래프 페이지
│   └── admin.css                # admin.html 전용 (v0.0.39)
├── js/                          # 아래 "모듈 맵" 참고
├── data/                        # 정적 데이터(코드 아님, 콘텐츠) — 아래 "데이터 파일" 참고
├── functions/                    # Cloud Functions(FCM 예약 발송, v0.0.38) — 별도 Node 프로젝트
│   ├── index.js                  # dailyPushCheck(매일 09:00) + onBroadcastCreated/processScheduledBroadcasts(관리자 발송, v0.0.39)
│   ├── data/                     # ⚠️ 직접 편집 금지 — sync-data.cjs가 루트 data/*.js에서 복사한 산출물
│   ├── scripts/sync-data.cjs     # predeploy 훅: data/*.js → functions/data/ 동기화
│   ├── scripts/set-admin-claim.cjs  # 관리자 커스텀 클레임 부여/해제 (로컬 1회성 실행, v0.0.39)
│   └── package.json
├── firebase.json / .firebaserc   # Cloud Functions 배포 설정(functions.predeploy, 프로젝트 ID)
```

> ⚠️ **예방접종 데이터는 `data/vaccines.js`(vaxSched)가 유일한 소스입니다.** 캘린더에 표시되는 개별 접종 이벤트(DTaP 1차 등, v0.0.22부터 제목에 이모지 접두어 없음 — `js/utils.js`의 `icon()`으로 화면에서만 표시)는 전부 여기서 생성됩니다. `data/milestones.js`의 건강검진 마일스톤에 예방접종을 요약해서 언급하는 항목을 추가하면 같은 날짜에 두 번 표시되는 "중복" 버그가 재발합니다.

### 모듈 맵 (`js/`)

| 파일 | 역할 |
|---|---|
| `app.js` | 메인 진입점 — Auth 감시·데이터 연결·SW 등록·다른 모듈 임포트 |
| `firebase.js` | Firebase 초기화 및 export |
| `state.js` | 전역 상태(S), Firestore 저장/로드, 가족 그룹/게스트 모드 데이터 소스 분기 |
| `auth.js` | 로그인·회원가입·Google·로그아웃 |
| `ui.js` | 홈 대시보드·아이 등록·네비게이션(`gp()`)·설정 탭 조립 |
| `calendar.js` | 캘린더 렌더(월/주간)·자동일정·드래그·필터·색상 시스템·일정 수정 모달 |
| `checklist.js` | 체크리스트 렌더·토글·점수 계산·상세 설명 아코디언·탭 레지스트리(v0.0.40, `getVisibleTabDefs` — key 기반 탭 판별) |
| `checklistSettings.js` | 설정 탭 "체크리스트 관리" — 탭 표시/숨김, 예방접종·발달 캘린더 연동 켜기/끄기, 사용자 정의 체크리스트 만들기/삭제 (v0.0.40) |
| `checklistCalendarLink.js` | 체크리스트 ↔ 캘린더 완료 상태 양방향 연동 (v0.0.40: `S.clSettings.calendarSync`로 탭별 끄기 가능) |
| `vaccineSeries.js` | 예방접종 실접종일 기준 이후 회차 자동 재계산 |
| `govSupport.js` | 정부지원 체크리스트 탭 |
| `growth.js` / `growthChart.js` | 성장 기록 CRUD / 성장그래프(Chart.js)·성장 예측 |
| `pwaInstall.js` | "어플로 추가" 링크 (설치 프롬프트/iOS 안내) |
| `familyShare.js` | "배우자와 함께 쓰기" / 가족 그룹 공유 — 설정 탭 |
| `notifications.js` | 알림 기능 — 로컬 알림("앱을 열었을 때"만 확인) + 설정 탭 통합 알림 UI(v0.0.42부터 `push.js`의 FCM 등록도 여기서 같이 트리거) |
| `push.js` | 진짜 FCM 푸시 알림 — 토큰 발급/저장, 포그라운드 수신 (v0.0.36). v0.0.42부터 자체 UI 없음(`notifications.js`가 흡수) — 자세한 구조는 `docs/product-specs/push-notifications.md` |
| `theme.js` | 다크 모드 토글 — 설정 탭, localStorage 저장, 앱 본체 전용 |
| `fontSize.js` / `calFontSize.js` | 앱 전체 글자 크기 / 캘린더 전용 글자 크기 조절 |
| `guestMode.js` | 게스트 모드 — 로그인 없이 로컬(localStorage)에 실제 데이터 저장 |
| `accountDelete.js` | 계정 영구 삭제(자체 탈퇴) — Firestore 문서 + Auth 계정 삭제 |
| `adSlot.js` | 광고 슬롯 컴포넌트 (AdSense 연동 준비) |
| `demoMode.js` | 예시 데이터로 둘러보기 (샘플 데이터, 저장 안 함 — 게스트 모드와 별개) |
| `modal.js` | `showModal()`, `cm()` |
| `utils.js` | `today()`(KST 기준), `ageD()`, `ageFmt()` 등 유틸 |
| `splash.js` | 앱 자체 스플래시 화면 — `hideSplash()`, 최대 4초 안전장치 타임아웃 포함 (v0.0.34) |
| `admin.js` | `admin.html` 전용 — 로그인 게이트(admin 커스텀 클레임 확인)·발송 폼·발송 이력 (v0.0.39, 앱 본체 SPA와 별개 진입점이라 `app.js`가 import하지 않음, `sw.js` 앱쉘 캐시 대상 아님 — `docs/product-specs/admin-push.md` 참고) |

### 데이터 파일 (`data/`)

| 파일 | 역할 |
|---|---|
| `vaccines.js` | 예방접종 스케줄 (월령별 백신 목록 — 캘린더 자동일정의 단일 진실 공급원) |
| `vaccine-series.js` | 예방접종 회차별 최소 접종 간격 (자동 재계산용) |
| `pregnancy.js` | 임신 주차별 자동 일정 |
| `milestones.js` | 건강검진·발달·이유식 마일스톤 (예방접종은 다루지 않음) |
| `checklist-data.js` | 체크리스트 전체 데이터 (항목별 상세 설명 포함) |
| `checklist-packs.js` | 준비물형(플랫) 체크리스트 팩 — 외출 준비물·100일 준비·돌 준비·돌사진 준비·태명 정하기·태교여행 준비·출산가방·산후조리원·신생아 맞이 준비·여행(외박) 준비물·어린이집(유치원) 준비·상비약 체크리스트·이유식 준비 (v0.0.40, v0.3.1에서 7종 추가) |
| `checklist-links.js` | 체크리스트 ↔ 캘린더 일정 매핑 |
| `government-support.js` | 정부지원금 스케줄·안내 |
| `kr-holidays.js` | 한국 공휴일 데이터 (캘린더 날짜 판별용) |
| `who-growth.js` | WHO 성장 백분위 근사 참고 테이블 |
| `tips.js` | 오늘의 육아 팁 |

---

## Firebase 개요

- **프로젝트 ID**: `momcal-fd12b` / **리전**: `asia-northeast3`(서울) / **인증**: Email+Password + Google OAuth + 카카오 로그인(Cloud Function 경유, v0.3.5)
- **문서 경로**: `users/{uid}` (가족 그룹에 속해있으면 `families/{familyId}`)
- 전체 Firestore 스키마(필드별 상세)는 `docs/PROJECT_SPEC.md` "Firebase 구조" 참고

## 데이터 흐름

1. 로그인 사용자 — Firestore 문서 하나(`users/{uid}` 또는 `families/{familyId}`)에 전체 앱 상태 저장, `onSnapshot`으로 실시간 동기화(`js/state.js`의 `subscribeToUserData`)
2. 게스트 — 같은 스키마를 `localStorage`(`momcal_guest_v1`)에 저장
3. 모든 화면은 전역 상태 객체 `S`(`js/state.js`)를 읽고 씀 → `debounceSave()`가 Firestore/localStorage에 반영
4. 로그인 시 게스트 데이터는 완전히 새 계정일 때만 자동으로 계정에 이전됨

---

## 코딩 컨벤션

- **ES6 Module 사용** — `type="module"`, `import`/`export` 일관 적용
- **window 노출 규칙** — 인라인 `onclick`에서 쓰는 함수는 모듈 하단에 `window.xxx = xxx`로 등록
- **앱 본체·육아정보 페이지(`guide/`) 동시 적용 원칙** — 앱은 `index.html`(SPA)과 `guide/*.html`(정적 페이지) 두 갈래로 나뉘고 스타일시트도 `css/main.css`/`guide/guide.css`로 분리돼 있어서, 한쪽만 고치고 다른 쪽을 빼먹기 쉬움. **아래 항목을 변경할 땐 반드시 양쪽을 함께 확인·수정할 것**:
  - 폰트(제목/본문/버튼 font-family, `fonts/` 아래 커스텀 폰트 파일과 `@font-face` 선언), 색상 팔레트, 로고·마스코트(`.logo`/`.g-logo`, `.brand-mark`) 크기, 글자 크기 조절 기준값(`html[data-fontsize]`)
  - **버전 표시(`.site-footer-version`)** — 아래 "버전 관리" 참고
  - 하단 푸터 구성(`.site-footer`/`.site-footer-links`) — 링크 목록·아이콘·순서가 서로 달라지지 않도록 함
  - 공용 아이콘 이미지(`icons/` 아래 파일들)
  - 그 외 "앱 전체에 적용해달라"는 식의 요청은 기본적으로 이 두 갈래 모두를 포함하는 것으로 해석함

---

## 버전 관리 (중요 — 두 곳 함께 갱신)

버전을 올릴 때 아래 두 곳을 **반드시 함께** 수정해야 화면 버전 표시가 어긋나지 않습니다(v0.0.15~16에서 이걸 빼먹어 화면이 두 버전 동안 "v0.0.14"로 멈춰있던 적이 있음):

1. `index.html`의 `.site-footer-version` 텍스트
2. `scripts/build-guide.mjs`의 `APP_VERSION` 상수 — 수정 후 `node scripts/build-guide.mjs` 재실행 필요(안 하면 `guide/*.html`에 반영 안 됨)

버전 번호 자체의 관리 정책(끝자리/가운데자리 올리는 기준)은 `docs/PROJECT_SPEC.md` "버전 관리 정책" 참고.

---

## 전역 상태 객체 (S)

`js/state.js`에 정의. 모든 모듈이 `import { S } from './state.js'`로 공유.

| 키 | 타입 | Firebase 저장 | 설명 |
|----|------|:---:|------|
| `children` | Array | ✅ | 등록된 아이/임신 프로필 목록 |
| `customEvs` | Array | ✅ | 사용자 직접 추가 일정. `type:'custom'`("내 일정")인 경우에만 v0.0.16부터 `color`(개별 일정 색상, 없으면 `evColors.custom`/기본색) 필드를 가질 수 있음 |
| `dayStickers` | Object | ✅ | 날짜별 스티커 배열 |
| `checks` | Object | ✅ | 체크리스트 완료 상태 |
| `eventMods` | Object | ✅ | 자동 일정의 실제일·완료·메모 등 수정 사항 (Sprint 2) |
| `growthRecords` | Array | ✅ | 성장 기록 목록 (Sprint 4). v0.0.23부터 `week`(임신 주수)·`isFetal`(태아 기록 여부) 필드 추가 — 임신 중 아이는 태아 기록(g/cm)도 여기 함께 저장됨 |
| `itemFeedback` | Object | ✅ | v0.0.23: `{ itemId: 'up'\|'down' }` — 체크리스트 항목 "도움돼요/아쉬워요" 개인 반응 |
| `evColors` | Object | ✅ | 사용자 지정 카테고리 공통 색상 `{req, rec, food, vax, gov}` — 없으면 기본색 사용 (Sprint 21). v0.0.16부터 `custom`은 범례에서 빠지고 일정별 `color` 필드로 대체됨(범례로는 더 이상 못 바꿈, 기존에 저장된 `evColors.custom` 값은 그대로 남아있지만 이제 쓰이지 않음) |
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
| `rec` | 선택 일정 | 민트 #26A69A |
| `food` | 이유식 | 빨강 #E53935 |
| `vax` | 예방접종 | 보라 #9575CD |
| `gov` | 정부지원 | 그린 #43A047 (Sprint 6 추가) |
| `custom` | 내 일정 | 파랑 #64B5F6 (개별 일정별로 `color` 필드로 재지정 가능, v0.0.16) |

---

## 배포 파이프라인

GitHub(`ONGporter/Momcal`) push → Vercel 자동 빌드·배포(빌드 스텝 없음, 정적 파일 그대로 서빙) → `momcal.app`(커스텀 도메인, `momcal.vercel.app`도 301 리다이렉트로 계속 접속 가능)
