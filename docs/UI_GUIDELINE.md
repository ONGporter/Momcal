# 맘캘 UI 가이드라인

> Claude에게: 새 UI 요소를 만들 때 이 파일의 규칙만 보고 판단하세요.
> 새로운 색상·폰트·컴포넌트 패턴을 임의로 추가하지 마세요.
> 이 파일은 일부러 짧게 유지합니다 — 버전별 변경 "이력"은 여기 적지 말고 `docs/CHANGELOG.md`에 적으세요.
> 여기는 항상 "지금 규칙이 뭔가"만 답해야 하는 문서입니다.

---

## 디자인 철학

- **팔레트: 핑크 · 화이트 · 그레이만 사용.** 새 UI에 색을 고민 중이면 기본값은 핑크 아니면 그레이. 다른 색(민트·보라·파랑·노랑)은 아래 "색상 예외 목록"에 있는 정보 구분 용도일 때만 허용.
- **이모지 대부분 삭제 → 아이콘 라이브러리(Material Symbols)로 대체.** 아래 "아이콘 시스템" 참고.
- **둥글기 16px**(`--radius`). 작은 요소(배지·태그)는 별도 값 유지.
- **여백은 12 / 16 / 20px만**(`--sp-sm`/`--sp-md`/`--sp-lg`). 13px·15px·18px 같은 임의 값을 새로 만들지 말 것.
- **그라디언트 규칙**: 버튼·탭·진행률바 등 "조작 가능한 UI"는 전부 단색(`var(--pk)`). 히어로/배너류(`guide/`의 `.g-hero`·`.g-cta-banner`, v0.0.45 이전엔 앱 홈의 `.home-hero`도 포함됐으나 이번 주 간소화 캘린더 위젯으로 교체되며 제거됨)는 예외로 핑크 계열 그라디언트(`linear-gradient(135deg, #F8BBD0 0%, #F06292 100%)`)를 허용 — **단, 항상 이 정확한 핑크 2색 조합만 쓸 것, 보라·파랑 등 다른 색을 섞지 말 것.** 등급 배지(Perfect/Master/Legend)도 정보 전달용 그라디언트 예외.
- **모바일 우선** — 터치 타겟 최소 44px.
- **애니메이션은 과하지 않게** — 0.2~0.3s ease, 필요한 곳만.

### "AI 티" 자가 진단 — 새 UI를 만들고 나서 체크
1. 이 화면에 그라디언트를 2번 이상 썼는가? → 하나만 남기고 단색으로
2. 카드마다 아이콘 배경색이 다른가? (파스텔 무지개) → 정보 구분 목적 아니면 전부 `var(--gray-100)`
3. 장식용 이모지가 텍스트 앞뒤에 붙었는가? (예: "✨ 완료했어요!") → 삭제하거나 `icon()`으로 교체
4. 여백이 12/16/20 중 하나가 아닌가? → 가장 가까운 값으로
5. 문구가 상투적인가? ("함께해요", "더 나은 내일을 위해") → 구체적 정보로 (예: "3/5 완료")

### 색상 예외 목록 (팔레트 규칙에서 제외 — "정보 전달용"이라 유지)
| 위치 | 색 | 이유 |
|---|---|---|
| 캘린더 이벤트 카테고리(필수/추천/접종/정부지원) | 민트·보라·파랑 | 일정 종류 구분 |
| 캘린더 테마 선택지(rose/mint/sunny/lavender/peach) | 5색 | 사용자가 직접 고르는 개인화 옵션 |
| 체크리스트 등급 배지(Perfect/Master/Legend) | 금색/보라/무지개 그라디언트 | 게임화 보상 |
| 위험/삭제 동작 | 빨강(`#E53935`류) | destructive 예외 |

---

## 컬러 시스템

모든 색상은 CSS 변수로 사용. **하드코딩 금지** — 다크 모드 미대응의 근본 원인이었음. 새 색이 필요하면 이 파일에 변수를 먼저 추가.

```css
:root {
  /* 메인 팔레트 */
  --pk:  #F06292;   /* 버튼, 강조, 선택 */
  --pkl: #FFF0F5;   /* 핑크 배경(연함) */
  --pkd: #C2185B;   /* 핑크 텍스트(진함) */
  --gray-50:  #FAFAFA;
  --gray-100: #F2F2F5;  /* 카드 안 아이콘 배경 등 중립 배경 */
  --gray-200: #E5E5EA;
  --gray-300: #D1D1D8;
  --gray-500: #8A849A;  /* = --txl */
  --gray-700: #4A4A57;

  /* 정보 전달용 예외 색 — 위 "색상 예외 목록" 용도로만 사용 */
  --mn:  #4DB6AC; --mnl: #E0F2F1;   /* 캘린더: 추천 */
  --pu:  #9575CD; --pul: #EDE7F6;   /* 캘린더: 접종 */
  --bl:  #64B5F6; --bll: #E3F2FD;   /* 캘린더: 내 일정(기본값) */
  --yl:  #FFD54F; --yll: #FFFDE7;   /* 배지: Perfect 등급 */
  --pk2: #CE93D8;                   /* 배지: Master 등급 */

  --tx:  #2D2D3A;   /* 본문 텍스트 */
  --txl: #8A849A;   /* 보조 텍스트 */
  --wh:  #ffffff;

  --bg:   #F8F4FA;
  --card: #ffffff;
  --card-shadow: 0 2px 16px rgba(160,80,140,.09);

  --radius: 16px;
  --sp-sm: 12px;
  --sp-md: 16px;
  --sp-lg: 20px;
}
```

### 히어로/배너 그라디언트 (허용된 유일한 그라디언트 패턴)
```css
background: linear-gradient(135deg, #F8BBD0 0%, #F06292 100%);
/* 우상단 은은한 장식(선택) */
background: radial-gradient(circle, rgba(255,255,255,.18), transparent);
```
적용처: 육아정보(`guide/`) `.g-hero`·`.g-cta-banner`. 이 두 곳은 항상 같은 그라디언트로 통일할 것 — 색을 새로 고르지 말 것. (v0.0.45: 앱 홈의 `.home-hero`는 이번 주 간소화 캘린더 위젯(`.home-week-card`)으로 교체되며 제거됨 — 새 위젯은 카드 배경에 그라디언트를 쓰지 않고 헤더 행에만 캘린더 테마색을 씀)

### 그 외 모든 곳(버튼·탭·진행률바)
```css
background: var(--pk);  /* 단색만 */
```

---

## 아이콘 시스템

**Material Symbols Outlined** 사용 (Google Fonts CDN, 모든 HTML `<head>`에 이미 로드됨).

JS 모듈에서는 **반드시 `js/utils.js`의 `icon()` 헬퍼로만** 아이콘을 만들 것(마크업 직접 작성 금지 — 나중에 스타일을 한 곳에서 바꿀 수 있어야 함):
```js
import { icon } from './utils.js';
icon('home')                          // 기본 24px
icon('checklist', { size: 'sm' })     // 작게
icon('trending_up', { size: 'lg' })   // 크게
icon('verified', { fill: true })      // 채워진 스타일(활성 상태 등)
```

정적 HTML에서는:
```html
<span class="icon icon-sm" translate="no" aria-hidden="true">calendar_month</span>
```

색은 항상 `currentColor` 상속 — 아이콘 자체에 색을 지정하지 말고 부모 `color`만 바꿀 것.

새 아이콘이 필요하면 [fonts.google.com/icons](https://fonts.google.com/icons)에서 이름만 찾아 쓰면 됨(설치 불필요).

### 이모지를 계속 쓰는 예외
- **캘린더 스티커** — 사용자가 직접 고르는 콘텐츠 자체가 이모지(UI 크롬 아님)
- **아이 프로필 아바타**(👦/👧/🍼) — 아이콘보다 친근한 "아바타" 성격
- **체크리스트 카테고리 라벨**(`data/checklist-data.js`) — 임신은 태아 크기 비교 과일, 육아는 씨앗→나무→아이 성장 진행감을 의도적으로 표현. 바꾸면 앱 체크리스트와 `guide/pregnancy.html`·`guide/parenting.html`에 동시 반영됨(단일 소스)

---

## 다크 모드

`js/theme.js`에서 켜고 끔. `<html data-theme="dark">` 속성으로 전환되고, `css/main.css`·`guide/guide.css` 안의 `html[data-theme="dark"] { ... }` 블록이 색을 재정의함. `localStorage`에만 저장(기기별, Firestore 미동기화).

- **적용 범위**: 앱 본체 + 육아정보 페이지(`guide/`) 모두. 단, 육아정보 페이지엔 토글이 따로 없음 — 앱 설정 탭 값을 각 페이지 `<head>` 인라인 스크립트가 읽어서 적용만 함.
- **작동 원리**: "컬러 시스템"의 CSS 변수(`--bg`/`--card`/`--tx`/`--txl`/`--wh`)를 다크용 값으로 재정의 — 이 변수를 쓰는 요소는 자동 전환됨. **새 컴포넌트를 만들 때 하드코딩 색 대신 변수를 쓰면 다크 모드가 별도 작업 없이 적용됨.**
- **한계**: 코드 곳곳에 `#fff`/`#EEE5F4` 같은 하드코딩 색이 아직 남아있어, 그런 요소는 `html[data-theme="dark"] .클래스 { ... }`로 하나씩 별도 대응해야 함.
- 새 화면이 다크 모드에서 이상하면(밝은 배경에 밝은 글씨 등) `css/main.css`와 `guide/guide.css` **두 파일 다** `html[data-theme="dark"]` 블록에 클래스를 추가해서 보정.

---

## 타이포그래피

```css
/* 제목·본문·버튼·로고 — 전부 동일 */
font-family: 'OwnglyphParkDahyun', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
font-weight: 400; /* Regular만 존재 — Bold 파일 없음, 굵어 보여야 할 곳도 normal 유지 */
```

- **정보 글(긴 설명)만 예외**: 체크리스트 세부 설명(`.ci-detail`)·육아정보 항목 설명(`.g-item p`)·정책 페이지 본문(`.g-doc p`/`li`)은 `'OmyuPretty', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif` 사용. 제목/버튼/로고/짧은 라벨은 계속 온글잎 박다현체.
- **파일**: `fonts/OwnglyphParkDahyun.ttf`(제목·본문·버튼·로고), `fonts/OmyuPretty.ttf`(정보 글). 둘 다 프로젝트 내 직접 포함(외부 CDN 아님). `css/main.css`와 `guide/guide.css`에 각각 `@font-face` 선언 — **폰트를 바꿀 땐 항상 두 파일 다 수정**.
- **Bold 파일 없음** — 브라우저 faux bold를 막기 위해 제목(`h1~h3`/`.sec`)·로고·버튼도 전부 `font-weight: normal`.
- 두 폰트 다 실사용 빈도 높은 한글 위주 지원(전체 11,172자보다 적음) — 희귀 한자어·이름은 시스템 폰트로 대체되어 보일 수 있음.
- **기준 크기**: `html { font-size: 17px }`. 캘린더 셀 내 이벤트 텍스트(`.ev-line`/`.ev-more`)만 공간이 빠듯해 `px` 고정(이 확대에서 제외).

| 용도 | size | weight |
|------|------|--------|
| 페이지 제목 | 1.1~1.55rem | 400 |
| 카드 제목 | 0.9~0.97rem | 400 |
| 본문 | 0.84~0.88rem | 400 |
| 세부 정보(체크리스트 설명 등) | 0.76~0.86rem | 400 (오뮤 다예쁨체) |
| 보조 텍스트 | 0.71~0.78rem | 400 |
| 배지/태그 | 0.58~0.72rem | 400 |
| 섹션 라벨 | 0.82rem | 400, uppercase |
| "맘캘" 로고 워드마크 | 2.2rem(topbar/육아정보) · 1.85rem(로그인) | 400 |
| 캘린더 이벤트 텍스트(`.ev-line`) | 10.56px 고정 | 800 |

---

## 컴포넌트 규칙

### 카드 (`.card`)
```css
background: var(--card);
border-radius: var(--radius);   /* 16px */
box-shadow: var(--card-shadow);
padding: var(--sp-lg);          /* 20px */
```
카드 안 카드는 `border-radius: 12px`, `padding: var(--sp-md)`(16px). hover 시 `transform: translateY(-3px)` + 그림자 강화.

### 버튼
```css
/* 메인(.bpk) */
background: var(--pk);
box-shadow: 0 4px 14px rgba(240,98,146,.28);
border-radius: 13px;
font-weight: 800;
padding: var(--sp-sm) var(--sp-lg);   /* 12px 20px */

/* 완료/확인(.bmn) */
background: var(--mn);

/* hover 공통 */
opacity: .87;
transform: translateY(-1px);
```

### 탭 / 필 버튼
```css
/* 비활성 */
background: var(--gray-100); color: var(--txl);
border-radius: 40px; font-weight: 800;

/* 활성 */
background: var(--pk); color: #fff;
box-shadow: 0 3px 12px rgba(240,98,146,.28);
```
하단 nav-pills는 5개 탭(홈/캘린더/체크리스트/성장/설정), `repeat(5, minmax(0,1fr))` 그리드. 520px·380px 두 단계 반응형으로 글자 축소 — 탭을 더 추가하면 이 폭 계산을 재검토할 것.

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
| 필수(required) | `#FFEBEE` | `#C62828` |
| 선택(optional) | `#E0F2F1` | `#00695C` |
| 완료 수 표시 | `var(--mnl)` | `var(--mn)` |
```css
font-size: .58~.72rem; font-weight: 800;
padding: 2~3px 6~9px; border-radius: 7~10px;
```

### 섹션 라벨 (`.sec`)
```css
font-size: .82rem; font-weight: 900; color: var(--txl);
text-transform: uppercase; letter-spacing: .06em; margin-bottom: 14px;
```

### 진행률 바
```css
/* 트랙 */
background: #EEE0F0; border-radius: 20px; height: 7px;
/* 채움 — 단색만 */
background: var(--pk); transition: width .5s;
```

### 모달
```css
/* 오버레이 */
background: rgba(30,10,40,.45); backdrop-filter: blur(5px);
/* 박스 */
border-radius: 24px; padding: 26px; max-width: 430px; max-height: 85vh;
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

이 5개는 사용자가 직접 고르는 캘린더 배경 테마로, 위 "그라디언트 규칙"과 무관하게 항상 예외.

---

## 애니메이션

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: fadeUp .28s ease;      /* 페이지 전환 */
transition: all .2s;              /* 공통 */
transition: all .22s;             /* 카드 hover */
```

---

## 반응형

```css
@media (max-width: 640px) {
  .cl-layout  { grid-template-columns: 1fr; }  /* 체크리스트 사이드바 세로 전환 */
  .cl-sidebar { position: static; }
  .cal-cell   { min-height: 52px; }            /* 캘린더 셀 축소 */
  .fg2 { grid-template-columns: 1fr; }         /* 폼 2열 → 1열 */
}
```

---

## 스티커 표시 규칙

- 캘린더 셀 내 최대 **3개** 표시, 초과 시 `+N` 배지(배경 `var(--txl)`, 흰 텍스트)
- `.sticker-row` — flex, 우하단 정렬
- 날짜 패널에서는 전체 표시(클릭 시 삭제)

---

## 금지 사항

- ❌ 하드코딩 색상 (CSS 변수 사용)
- ❌ 외부 UI 라이브러리 (Bootstrap, Tailwind 등)
- ❌ `icon()` 헬퍼를 거치지 않고 아이콘 마크업 직접 쓰기
- ❌ 핑크·화이트·그레이 외의 색을 장식 목적으로 새로 쓰기 (정보 전달용 예외는 위 목록 참고)
- ❌ 히어로/배너류 외의 곳에 새 그라디언트 추가하기, 또는 히어로/배너에 지정된 핑크 2색 외의 그라디언트 색 조합 쓰기
- ❌ 12/16/20px 스케일에 없는 임의의 padding/margin 값 새로 만들기
- ❌ `position: absolute` 남발 (레이아웃 붕괴 원인)
- ❌ `!important` 사용
- ❌ 인라인 스타일 남발 (동적 값 제외)
