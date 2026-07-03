# 맘캘 UI 가이드라인

> Claude에게: 새 UI 요소를 만들 때 이 파일의 규칙을 따르세요.
> 새로운 색상·폰트·컴포넌트 패턴을 임의로 추가하지 마세요.

---

## 디자인 철학

- **따뜻하고 귀여운 톤** — 파스텔 핑크/민트 계열
- **모바일 우선** — 손가락으로 누르기 쉬운 터치 타겟 (최소 44px)
- **과하지 않은 애니메이션** — 0.2~0.3s ease, 필요한 곳만
- **이모지 아이콘** — 외부 아이콘 라이브러리 없이 이모지로 통일

---

## 컬러 시스템

모든 색상은 CSS 변수로 사용. 하드코딩 금지.

```css
:root {
  /* 메인 핑크 */
  --pk:  #F06292;   /* 버튼, 강조, 선택 */
  --pkl: #FFF0F5;   /* 핑크 배경 (연함) */
  --pkd: #C2185B;   /* 핑크 텍스트 (진함) */
  --pk2: #CE93D8;   /* 보조 핑크 (그라디언트 끝) */

  /* 민트 (완료·추천) */
  --mn:  #4DB6AC;
  --mnl: #E0F2F1;

  /* 보라 (접종) */
  --pu:  #9575CD;
  --pul: #EDE7F6;

  /* 파랑 (내 일정) */
  --bl:  #64B5F6;
  --bll: #E3F2FD;

  /* 텍스트 */
  --tx:  #2D2D3A;   /* 본문 */
  --txl: #8A849A;   /* 보조 */
  --wh:  #ffffff;

  /* 배경 */
  --bg:   #F8F4FA;
  --card: #ffffff;
  --card-shadow: 0 2px 16px rgba(160,80,140,.09);
  --radius: 20px;
}
```

### 그라디언트 패턴

```css
/* 메인 버튼, 활성 탭 */
background: linear-gradient(135deg, #F06292, #9C27B0);

/* 영웅 배너 */
background: linear-gradient(135deg, #F48FB1 0%, #CE93D8 50%, #90CAF9 100%);

/* 사이드바 헤더 */
background: linear-gradient(135deg, #F06292, #9C27B0);
```

---

## 타이포그래피

```css
font-family: 'Nunito', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
```

앱 전체의 기본 폰트는 **Nunito**입니다. (Sprint 22에서 로고에 Fredoka, Sprint 26에서 전체에 Jua를 시도했으나, 각각 한글 미지원·가독성 문제로 Sprint 27에서 다시 Nunito로 원복됨 — 아래 참고)

| 용도 | size | weight |
|------|------|--------|
| 페이지 제목 | 1.1~1.55rem | 900 |
| 카드 제목 | 0.9~0.97rem | 900 |
| 본문 | 0.84~0.88rem | 700 |
| 보조 텍스트 | 0.71~0.78rem | 700 |
| 배지/태그 | 0.58~0.72rem | 800 |
| 섹션 라벨 | 0.82rem | 900, uppercase |

### 참고 — 폰트 실험 이력 (Sprint 22 → 26 → 27)
- Sprint 22: "맘캘" 로고에만 Fredoka 적용 시도 → Fredoka는 한글 미지원 라틴 전용 폰트라 한글 텍스트에는 실제로 적용되지 않았음(무효)
- Sprint 26: 앱 전체를 한글 지원 귀여운 폰트 Jua로 전환 → 사용해보니 여전히 원하는 느낌이 아니었음
- Sprint 27: 윤고딕 요청 → 상업용 유료 폰트라 무료 CDN으로 가져올 수 없어 적용 불가. 요청에 따라 Nunito로 원복
- 무료 CDN(Google Fonts)에서 쓸 수 있는 폰트로 다시 시도하고 싶다면 다음에 새 폰트명을 알려주세요. 유료 폰트(윤고딕 등)를 쓰려면 라이선스 구매 후 폰트 파일(.woff2 등)을 직접 전달해주셔야 프로젝트에 넣어드릴 수 있습니다.

---

## 컴포넌트 규칙

### 카드 (`.card`)

```css
background: var(--card);
border-radius: var(--radius);   /* 20px */
box-shadow: var(--card-shadow);
padding: 22px;
```

- 카드 안 카드는 `border-radius: 18px`, `padding: 18px`
- hover 시: `transform: translateY(-3px)` + 그림자 강화

### 버튼

```css
/* 메인 (bpk) */
background: linear-gradient(135deg, #F06292, #9C27B0);
box-shadow: 0 4px 14px rgba(200,80,180,.28);
border-radius: 13px;
font-weight: 800;
padding: 12px 18px;

/* 완료/확인 (bmn) */
background: linear-gradient(135deg, #4DB6AC, #00897B);

/* hover 공통 */
opacity: .87;
transform: translateY(-1px);
```

### 탭 / 필 버튼

```css
/* 비활성 */
background: #EEE5F4;
color: var(--txl);
border-radius: 40px;
font-weight: 800;

/* 활성 */
background: linear-gradient(135deg, #F06292, #9C27B0);
color: #fff;
box-shadow: 0 3px 12px rgba(200,80,180,.28);
```

### 입력 필드

```css
border: 1.5px solid #EEE0F0;
border-radius: 12px;
padding: 10px 13px;
font-family: inherit;

/* focus */
border-color: var(--pk);
```

### 배지 / 태그

| 종류 | 배경 | 텍스트 |
|------|------|--------|
| 필수 (required) | `#FFEBEE` | `#C62828` |
| 선택 (optional) | `#E0F2F1` | `#00695C` |
| 완료 수 표시 | `var(--mnl)` | `var(--mn)` |

```css
font-size: .58~.72rem;
font-weight: 800;
padding: 2~3px 6~9px;
border-radius: 7~10px;
```

### 섹션 라벨 (`.sec`)

```css
font-size: .82rem;
font-weight: 900;
color: var(--txl);
text-transform: uppercase;
letter-spacing: .06em;
margin-bottom: 14px;
```

### 진행률 바

```css
/* 트랙 */
background: #EEE0F0;
border-radius: 20px;
height: 7px;

/* 채움 */
background: linear-gradient(90deg, #F06292, #9C27B0);
transition: width .5s;
```

### 모달

```css
/* 오버레이 */
background: rgba(30,10,40,.45);
backdrop-filter: blur(5px);

/* 박스 */
border-radius: 24px;
padding: 26px;
max-width: 430px;
max-height: 85vh;
box-shadow: 0 20px 60px rgba(160,60,140,.2);
animation: fadeUp .28s ease;
```

---

## 이벤트 타입별 색상

| type | 라벨 | 배경 | 포인트 색 |
|------|------|------|-----------|
| `req` | ★필수 | `#FFF0F5` | `#F06292` |
| `rec` | 추천 | `#E0F2F1` | `#4DB6AC` |
| `vax` | 접종 | `#EDE7F6` | `#9575CD` |
| `custom` | 내일정 | `#E3F2FD` | `#64B5F6` |

---

## 캘린더 테마

| 테마 | 그라디언트 | 선택 셀 | 오늘 |
|------|-----------|---------|------|
| rose | `#F48FB1 → #CE93D8` | `#FFF5FA` | `#F06292` |
| mint | `#80DEEA → #4DB6AC` | `#F0FAF8` | `#4DB6AC` |
| sunny | `#FFD54F → #FF8A65` | `#FFFDE7` | `#FF8A65` |
| lavender | `#B39DDB → #80CBC4` | `#F3EFF9` | `#9575CD` |
| peach | `#FFAB91 → #F48FB1` | `#FFF3EE` | `#FF8A65` |

---

## 애니메이션

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 페이지 전환 */
animation: fadeUp .28s ease;

/* 트랜지션 공통 */
transition: all .2s;
transition: all .22s;   /* 카드 hover */
```

---

## 반응형

```css
@media (max-width: 640px) {
  /* 체크리스트: 사이드바 세로 전환 */
  .cl-layout  { grid-template-columns: 1fr; }
  .cl-sidebar { position: static; }

  /* 캘린더 셀 축소 */
  .cal-cell { min-height: 52px; }

  /* 홈 제목 축소 */
  .home-hero h1 { font-size: 1.28rem; }

  /* 폼 2열 → 1열 */
  .fg2 { grid-template-columns: 1fr; }
}
```

---

## 스티커 표시 규칙

- 캘린더 셀 내 최대 **3개** 표시
- 초과 시 `+N` 배지 (배경: `var(--txl)`, 흰 텍스트)
- `.sticker-row` — flex, 우하단 정렬
- 날짜 패널에서는 전체 표시 (클릭 시 삭제)

---

## 금지 사항

- ❌ 하드코딩 색상 (CSS 변수 사용)
- ❌ 외부 UI 라이브러리 (Bootstrap, Tailwind 등)
- ❌ 외부 아이콘 라이브러리 (Font Awesome 등)
- ❌ `position: absolute` 남발 (레이아웃 붕괴 원인)
- ❌ `!important` 사용
- ❌ 인라인 스타일 남발 (동적 값 제외)
