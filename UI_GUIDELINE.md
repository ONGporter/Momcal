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
/* 제목·본문·버튼·"맘캘" 로고 — 전부 동일 (v0.0.3부터) */
font-family: 'OwnglyphParkDahyun', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
font-weight: 400; /* Regular만 존재 — Bold 파일 없음 */
```

- **v0.0.3부터 폰트 하나로 통일**: 옹짐꾼님이 제공한 손글씨 폰트 "온글잎 박다현체"(Ownglyph PDH)를 제목·본문·버튼·로고 구분 없이 전부 사용. 이전처럼 로고/제목/본문/버튼마다 다른 폰트를 쓰던 방식(Paperlogy+Pretendard)을 완전히 그만둠
- **v0.0.4 예외 — "정보 글"은 Pretendard**: 체크리스트 세부 설명(`.ci-detail`)·육아정보 항목 설명(`.g-item p`)·정책 페이지 본문(`.g-doc p`/`li`)처럼 정보 전달이 목적인 긴 글은 손글씨 폰트가 가독성을 해쳐서 Pretendard로 되돌림. **새로운 "정보성 긴 글" UI를 만들 땐 이 예외를 따를지 검토할 것** — 제목/버튼/로고/짧은 라벨은 계속 온글잎 박다현체
- **파일 위치**: `fonts/OwnglyphParkDahyun.ttf` — 외부 CDN이 아니라 프로젝트에 직접 포함된 파일이며, `css/main.css`와 `guide/guide.css`에 각각 `@font-face`로 선언되어 있음(두 파일이 별도 스타일시트라 폰트를 바꿀 땐 항상 같이 수정 필요). Pretendard는 v0.0.4에서 위 예외 처리를 위해 두 파일에 다시 `@import`로 불러옴
- **Bold 파일 없음**: 이 폰트는 Regular 굵기만 제공됨. 브라우저가 임의로 두껍게 그리는 faux bold를 방지하기 위해, 원래 Bold였던 제목(`h1~h3`/`.sec`)·로고(`.logo`/`.auth-logo`/`.g-logo`)·버튼(`.btn`/`.st-btn`/`.g-btn`/`.np`)도 전부 `font-weight: normal`로 맞춰둠. 손글씨체 특성상 안 굵어도 다른 텍스트와 충분히 구분됨
- **한글 글자 수 제한**: 온글잎 폰트는 실사용 빈도가 높은 한글 2,780자만 지원함(전체 한글 11,172자 중 일부). 희귀한 한자어·이름 등 특수 글자를 쓰면 해당 글자만 시스템 기본 폰트로 대체되어 보일 수 있음 — 실제로 깨지는 곳이 보이면 캡처해서 알려주면 확인 가능
- 라이선스: 온글잎이 제작·배포하는 폰트는 영리적·상업적 사용 포함 모든 용도에 제한 없이 사용 가능(저작권은 (주)보이저엑스에 있음) — AdSense 수익화 목적에도 문제 없음
- **v0.0.4 — 기준 글자 크기 확대**: `html { font-size: 17px }`(기존 브라우저 기본 16px)로 앱 전체 `rem` 기반 글자가 함께 커짐. 단, 캘린더 셀 안 이벤트 텍스트(`.ev-line`/`.ev-more`)는 셀 공간이 빠듯해 과거 여러 버전(Sprint 25·27)에 걸쳐 맞춰둔 크기라 `px`로 고정해 이 확대에서 제외함 — 캘린더 날짜 숫자(`.day-num`)는 예외 없이 다른 곳과 동일하게 커짐
- **v0.0.4 — 로고 크기와 마스코트 크기 분리**: 이전엔 `.brand-mark`(마스코트 이미지) 높이가 로고 글씨 크기에 상대적인 `em` 단위였어서, 글씨만 키우려 해도 마스코트까지 같이 커지는 구조였음 — 마스코트 크기를 고정 `rem` 값으로 분리해서 글씨(`.logo`/`.g-logo` 1.5rem→2.2rem)만 독립적으로 키울 수 있게 정리. 로그인 화면(`.auth-logo`)은 이 변경의 영향을 받지 않도록 별도 예외 처리되어 있음
- ⚠️ **앱 본체(`css/main.css`)와 육아정보 페이지(`guide/guide.css`)는 별도 파일이라 폰트 규칙이 자동으로 동기화되지 않음** — 폰트를 바꿀 땐 항상 두 파일(`@font-face` 선언 포함)을 함께 수정할 것 (PROJECT_SPEC.md "핵심 개발 원칙" 9번 참고)

| 용도 | size | weight |
|------|------|--------|
| 페이지 제목 | 1.1~1.55rem | 400 (Regular, Bold 파일 없음) |
| 카드 제목 | 0.9~0.97rem | 400 (동일 폰트에서는 900 지정해도 렌더링상 큰 차이 없음) |
| 본문 | 0.84~0.88rem | 400 (Regular) |
| 세부 정보(체크리스트 상세 설명 등) | 0.76~0.86rem | 400 (Pretendard, v0.0.4 예외) |
| 보조 텍스트 | 0.71~0.78rem | 400 |
| 배지/태그 | 0.58~0.72rem | 400 |
| 섹션 라벨 | 0.82rem | 400, uppercase |
| 버튼 | - | 400 |
| "맘캘" 로고 워드마크 | 2.2rem(topbar/육아정보, v0.0.4) · 1.85rem(로그인 화면) | 400 |
| 캘린더 이벤트 텍스트(`.ev-line`) | 10.56px 고정(px, v0.0.4부터 전체 확대 제외) | 800 |

### 참고 — 폰트 실험 이력
- Sprint 22: 로고에 Fredoka 시도 → 한글 미지원이라 실제로는 적용 안 됨(무효)
- Sprint 26: 앱 전체를 Jua로 전환 → 본문 가독성 문제로 불만
- Sprint 27: 윤고딕 요청(상업용 폰트라 무료 CDN 불가) → Nunito로 전체 원복
- Sprint 28: 로고에만 Jua 재적용
- v0.0.1(Sprint 29): 제목·로고는 Paperlogy Bold, 본문은 Pretendard Regular, 버튼은 Pretendard SemiBold로 정착
- v0.0.2: 제목(h1~h3/`.sec`)만 Pretendard Bold로 다시 변경 — 로고(워드마크)는 Paperlogy Bold 그대로 유지. "제목 폰트가 로고랑 안 어울린다"는 피드백 반영. 이때부터 "Sprint" 대신 "버전"(v0.0.x) 명칭 사용
- v0.0.3: 옹짐꾼님이 폰트 파일(온글잎 박다현체)을 직접 제공 — Paperlogy+Pretendard 조합을 완전히 버리고 이 폰트 하나로 전면 통일. 외부 CDN 대신 프로젝트에 폰트 파일을 직접 포함하는 방식은 이번이 처음
- **v0.0.4**: 체크리스트 세부 설명 등 "정보 글"만 Pretendard로 되돌림(가독성 문제), 로고 글씨 확대(마스코트와 크기 분리), 앱 전체 기준 글자 크기 확대(캘린더 이벤트 텍스트는 제외)
- 앞으로 다른 폰트로 또 바꾸고 싶다면, 무료 CDN에 있는 폰트는 이름만 알려줘도 되고, 유료/커스텀 폰트는 이번처럼 파일(.ttf/.otf/.woff2)을 직접 전달해주면 적용 가능. Bold 등 여러 굵기가 필요하면 해당 굵기 파일도 함께 주는 게 좋음(없으면 이번처럼 전부 Regular로 통일)

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
