# 맘캘 MomCal — 프로젝트 스펙

> Claude에게: 이 파일을 먼저 읽고 프로젝트 전체 맥락을 파악한 후 작업하세요.

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

---

## 기술 스택

- **Frontend**: Vanilla JS (ES6 Module), HTML5, CSS3
- **Backend**: Firebase Auth + Cloud Firestore
- **배포**: GitHub Push → Vercel 자동 배포
- **폰트**: Nunito (Google Fonts CDN)
- **아이콘**: 이모지 전용 (외부 아이콘 라이브러리 없음)

---

## 프로젝트 구조

```
momcal/
├── index.html              # 앱 진입점 (HTML 구조만 담당)
├── css/
│   ├── main.css            # 전역 스타일, 공통 컴포넌트
│   ├── auth.css            # 로그인 화면
│   ├── calendar.css        # 캘린더 그리드, 이벤트 필
│   ├── checklist.css       # 체크리스트 레이아웃
│   └── modal.css           # 모달 공통
├── js/
│   ├── app.js              # 메인 진입점 — Auth 감시·데이터 연결
│   ├── firebase.js         # Firebase 초기화 및 export
│   ├── state.js            # 전역 상태(S), Firestore 저장/로드
│   ├── auth.js             # 로그인·회원가입·Google·로그아웃
│   ├── ui.js               # 홈·등록·네비게이션
│   ├── calendar.js         # 캘린더 렌더·자동일정·스티커
│   ├── checklist.js        # 체크리스트 렌더·토글
│   ├── modal.js            # showModal(), cm()
│   └── utils.js            # today(), ageFmt() 등 유틸
└── data/
    ├── vaccines.js         # 예방접종 스케줄
    ├── pregnancy.js        # 임신 주차별 자동 일정
    ├── milestones.js       # 건강검진·이유식 마일스톤
    └── checklist-data.js   # 체크리스트 전체 데이터
```

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
  "theme": "rose",
  "selC": 0,
  "updatedAt": 1234567890
}
```

---

## 전역 상태 객체 (S)

`js/state.js`에 정의. 모든 모듈이 `import { S } from './state.js'`로 공유.

| 키 | 타입 | 설명 |
|----|------|------|
| `children` | Array | 등록된 아이/임신 프로필 목록 |
| `customEvs` | Array | 사용자 직접 추가 일정 |
| `dayStickers` | Object | 날짜별 스티커 배열 |
| `checks` | Object | 체크리스트 완료 상태 |
| `theme` | String | 캘린더 테마 (rose/mint/sunny/lavender/peach) |
| `selC` | Number | 현재 선택된 아이 인덱스 |
| `calY`, `calM` | Number | 캘린더 표시 연·월 |
| `calView` | String | 'month' \| 'week' |
| `selDate` | String | 선택된 날짜 (YYYY-MM-DD) |
| `evType` | String | 일정 추가 종류 |
| `selSCat` | Number | 스티커 카테고리 인덱스 |
| `clTab` | Number | 체크리스트 탭 인덱스 |
| `selClCat` | Number | 체크리스트 사이드바 선택 항목 |

---

## 이벤트 타입

| 타입 | 의미 | 색상 |
|------|------|------|
| `req` | 필수 일정 | 핑크 #F06292 |
| `rec` | 추천 일정 | 민트 #4DB6AC |
| `vax` | 예방접종 | 보라 #9575CD |
| `custom` | 내 일정 | 파랑 #64B5F6 |

---

## 핵심 개발 원칙

1. **기존 기능 절대 삭제 금지** — 리팩터링·기능 추가 시에도 기존 동작 유지
2. **Firebase 구조 유지** — Firestore 문서 스키마 변경 시 하위 호환성 확보
3. **모든 기능은 모듈화** — 새 기능은 새 파일 또는 기존 모듈에 함수 추가
4. **사용성 우선** — 복잡한 기능보다 매일 쓰는 기능을 더 쉽게
5. **window 노출 규칙** — 인라인 onclick에서 쓰는 함수는 모듈 하단에 `window.xxx = xxx`
6. **ES6 Module 사용** — `type="module"`, `import/export` 일관 적용

---

## 기능 목록 및 Sprint 현황

### ✅ 완료

| 기능 | Sprint |
|------|--------|
| Firebase 로그인 (Email + Google) | 1 |
| 아이/임신 프로필 등록·삭제 | 1 |
| 예방접종·이유식 자동 일정 생성 | 1 |
| 캘린더 (월간/주간 뷰) | 1 |
| 스티커 부착·삭제 (최대 3+N 표시) | 1 |
| 체크리스트 (임신/육아/이유식) | 1 |
| 테마 5종 (rose/mint/sunny/lavender/peach) | 1 |
| 모듈 리팩터링 (CSS 5개, JS 9개, data 4개) | 1 |

### 🔲 예정

| 기능 | Sprint |
|------|--------|
| 일정 클릭 수정 Modal (권장일·실제일·병원·메모·완료) | 2 |
| 일정 드래그 이동 (PC) / 길게 눌러 이동 (모바일) | 2 |
| 체크리스트 주차별 세분화 | 3 |
| 진행률 시스템 개선 (필수 100%, 추천 시 초과 달성) | 3 |
| 병원 방문 기록 (키·몸무게·머리둘레·메모) | 4 |
| 성장 그래프 (Chart.js + WHO 곡선) | 4 |
| 홈 대시보드 개편 | 5 |
| AI 육아비서 구조 (OpenAI 연결 준비) | 5 |
| 오늘의 브리핑 카드 | 5 |
| 가족 공유 구조 | 미정 |
| FCM 알림 | 미정 |
