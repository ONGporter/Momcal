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
- **폰트**: Nunito (Google Fonts CDN)
- **아이콘**: 이모지 전용 (외부 아이콘 라이브러리 없음)
- **차트**: Chart.js (CDN, jsDelivr 폴백)
- **PWA**: manifest.json + sw.js (홈 화면 설치·오프라인 앱 셸 캐싱)

---

## 프로젝트 구조

```
momcal/
├── index.html              # 앱 진입점 (SEO 메타·OG 태그·PWA 메타 포함)
├── manifest.json            # PWA 매니페스트
├── sw.js                     # 서비스 워커 (정적 파일 캐싱)
├── robots.txt                # 검색엔진 크롤링 허용 + sitemap 위치 안내 (Sprint 14)
├── sitemap.xml                # 검색엔진 제출용 사이트맵 (Sprint 14)
├── icons/
│   ├── icon-192.png, icon-512.png (+maskable 버전)
│   ├── apple-touch-icon.png
│   └── og-image.png          # 소셜 공유 미리보기 이미지 1200x630 (Sprint 14)
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
│   ├── adSlot.js              # 광고 슬롯 컴포넌트 (AdSense 연동 준비)
│   ├── demoMode.js            # 로그인 없이 체험하기 (샘플 데이터, 저장 안 함)
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
  "theme": "rose",
  "selC": 0,
  "updatedAt": 1234567890
}
```

- `eventMods`의 키는 자동 일정이면 `auto_{원본날짜}_{제목}`, 커스텀 일정이면 `custom_{_id}` 형식 (`js/calendar.js`의 `getEventKey()` 참고)
- `growthRecords`는 Sprint 4에서 추가, `checks`/`eventMods`는 Sprint 2~6 사이 단계적으로 추가됨 — 전부 하위 호환 유지(과거 데이터에 필드가 없으면 빈 배열/객체로 처리)

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
| `isDemoMode` | Boolean | ❌ | 체험 모드 여부 (Sprint 8) |
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
- **로그인 장벽**: 현재 앱은 대부분 기능이 Firebase 로그인 뒤에 있어 검색엔진이 색인할 실질적인 공개 콘텐츠가 없음. 광고 수익을 위해서는 **로그인 없이도 볼 수 있는 공개 콘텐츠**(예: 이번 스프린트에서 체크리스트에 추가한 예방접종·이유식 상세 설명 같은 육아 정보)를 블로그/정보 페이지 형태로 별도 노출하는 방안을 중장기적으로 검토
- **SEO 기본기**: `robots.txt`, `sitemap.xml`, Open Graph/Twitter 메타 태그 적용 완료 (Sprint 14) — 상세 내용은 아래 "SEO" 절 참고
- **콘텐츠 확장**: 체크리스트 항목의 상세 설명(dd) 데이터는 향후 공개 콘텐츠 페이지의 원천 데이터로도 재활용 가능하도록 설계됨 (data/checklist-data.js)
- **재방문율**: 광고 노출 총량은 결국 "얼마나 자주 여는 앱인가"에 달려 있음 — 알림(FCM), 매일 확인할 이유(오늘의 팁, 다가오는 일정)를 늘리는 기능이 광고 수익과도 직결됨

### SEO 적용 현황 (Sprint 14)

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 메타 description/keywords, canonical | ✅ 적용 | `index.html` |
| sitemap.xml | ✅ 적용 | 현재는 SPA라 단일 URL만 포함 |
| robots.txt | ✅ 적용 | 전체 허용 + sitemap 위치 안내 |
| Open Graph / Twitter Card | ✅ 적용 | 카카오톡·페이스북·트위터 공유 시 미리보기 이미지(`icons/og-image.png`) 노출 |
| Google Search Console 등록 | ⏳ 미등록 | 소유자 계정 인증 필요 — 등록 절차는 TODO.md 참고 |
| 네이버 서치어드바이저 등록 | ⏳ 미등록 | 소유자 계정 인증 필요 — 등록 절차는 TODO.md 참고 |

---

## 기능 목록 및 Sprint 현황

완료된 기능의 이력만 기록합니다. **예정된 작업·후보 기능은 TODO.md "다음 후보"를 참고하세요.**

### ✅ 완료 (Sprint 1~14)

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

