# AGENTS.md

> 이 저장소에서 작업하는 AI 코딩 에이전트(Claude Code 등)를 위한 진입점 문서입니다.
> 사람이 봐도 되지만, 에이전트는 다른 무엇보다 **이 파일을 가장 먼저** 읽어주세요.

## 프로젝트 한 줄 요약
**맘캘 MomCal** — 임신부터 육아까지 일정·체크리스트·성장 기록을 관리하는 한국어 PWA.
Vanilla JS(ES6 모듈) + Firebase(Firestore/Auth), Vercel 배포. 빌드 스텝 없음(번들러 없음).

## 작업 시작 전 반드시 읽을 것 (이 순서대로)
1. **`docs/TODO.md`** — 지금 무엇을 해야 하는지(이번 버전 확인 항목, 다음 후보 기능, 버그). **여기 있는 작업만 수행하세요.**
2. **`docs/PROJECT_SPEC.md`** — 프로젝트가 지금 어떤 상태인지(구조·Firebase 스키마·완료 기능 요약·핵심 개발 원칙)
3. **`docs/UI_GUIDELINE.md`** — 컬러·타이포·컴포넌트 규칙 (새 UI를 만들거나 고칠 때)
4. **`ARCHITECTURE.md`** — 기술 스택·모듈 맵·데이터 흐름 (구조 전체가 궁금할 때)

## 최우선 원칙 (항상, 예외 없이 적용)
1. **기존 기능을 절대 삭제하지 않고 유지하면서 리팩터링한다**
2. **새 프로젝트를 생성하지 않는다** — 항상 이 저장소 위에서 이어서 작업
3. **기존 Firebase 구조를 유지한다** — 컬렉션·필드 추가는 OK, 기존 필드명·구조는 바꾸지 않음
4. **기존 UI 디자인을 최대한 유지한다** — `docs/UI_GUIDELINE.md` 규칙을 따름
5. **모든 기능은 모듈화하여 구현한다** — 새 기능은 새 파일 또는 기존 모듈에 함수 추가
6. **복잡한 기능보다 사용성을 우선한다**
7. **"부모가 매일 여는 앱"을 목표로 개발한다**

## 금지 규칙 — "이건 절대 하지 마"

과거에 실제로 문제가 됐던 것들과, 이 저장소 구조상 절대 손대면 안 되는 것들입니다. 위 "최우선 원칙"이 방향이라면, 이건 구체적인 지뢰밭 지도입니다.

### 실제로 반복됐던 실수 (사고 이력 있음)
- **버전 문자열을 한 곳만 고치고 넘어가지 마** — `index.html`의 `.site-footer-version`과 `scripts/build-guide.mjs`의 `APP_VERSION`은 항상 세트로 수정. (v0.0.15~16에서 이걸 빼먹어 화면 버전이 두 버전 동안 안 올라간 적 있음 — `docs/TODO.md` 참고). **`privacy.html`/`terms.html`/`contact.html`도 각자 독립된 `.site-footer-version`을 갖고 있어서 똑같이 올려야 함** — 이 3개는 원래 버전 동기화 루틴 대상에 아예 없어서 v0.0.28에서 40여 버전째 방치된 채 발견된 적 있음(v0.3.11, `node scripts/check-docs.mjs`가 이제 자동 검사함)
- **새 `js/` 파일을 추가하면서 `sw.js`의 `APP_SHELL` 캐시 목록 추가를 빼먹지 마** — 오프라인 앱쉘 캐싱에서 빠지면 오프라인 상태에서 그 기능만 조용히 깨짐 (v0.0.18에서 8개 모듈이 여러 버전째 누락된 걸 발견함)
- **하드코딩된 색상(`#fff`, `#FFF5F5` 같은 리터럴)을 새로 만들지 마 — 반드시 `css/main.css`의 CSS 변수를 써라** — 다크 모드 미대응 요소가 버전마다 새로 발견되는 근본 원인이 이거였음
- **앱 본체(`index.html`/`css/`/`js/`)만 고치고 `guide/` 쪽을 빼먹지 마** — 폰트·색상·로고·버전 표시처럼 "앱 전체" 요청은 항상 두 갈래(앱 본체 + 육아정보 페이지) 다 확인
- **같은 내용을 여러 문서에 중복 기록하지 마** — 새 내용을 어디 적을지 이 파일 맨 아래 "문서 간 역할 분리" 표를 먼저 확인. 표에 없는 새 역할이 아니면 새 파일도 만들지 마라
- **요청받지 않은 범위까지 임의로 확장하지 마** — 작업 중 관련 없어 보이는 별개 이슈를 발견해도 마음대로 같이 고치지 말고, 먼저 언급하고 확인받은 뒤에 진행
- **검증 없이 "완료"라고 보고하지 마** — CSS는 중괄호 짝 확인, JS는 `node --check`, 가능하면 Live Server로 실제 화면까지 확인한 뒤에만 결과물을 전달

### 이 저장소에서 절대 건드리면 안 되는 파일·값
- **`guide/*.html`을 직접 열어서 고치지 마** — `scripts/build-guide.mjs`가 `data/*.js`로부터 매번 새로 생성하는 결과물이라, 직접 고쳐도 다음 재생성 때 흔적도 없이 사라짐. 내용을 바꾸려면 `data/checklist-data.js`/`data/government-support.js`를 고치고 `node scripts/build-guide.mjs`를 실행할 것
- **`functions/data/*.js`를 직접 고치지 마** (v0.0.38 추가) — `functions/scripts/sync-data.cjs`가 배포 직전에 루트 `data/*.js`에서 복사해오는 결과물이라, `guide/*.html`과 똑같은 성격임. 예방접종·정부지원 알림 로직을 바꾸려면 루트 `data/vaccines.js` 등을 고칠 것
- **`index.html`의 `google-site-verification`/`naver-site-verification` 메타 태그를 지우거나 값을 바꾸지 마** — Google Search Console·네이버 서치어드바이저 소유권 인증에 실제로 쓰이는 값. 지워지면 재인증 절차를 처음부터 다시 해야 함
- **`js/firebase.js`의 Firebase 설정값(`apiKey`, 프로젝트 ID 등)을 다른 값으로 교체하지 마** — 실제 운영 중인 Firebase 프로젝트(`momcal-fd12b`)에 연결된 값. 테스트용으로라도 바꾸면 실사용자 데이터 연결이 끊김
- **Firestore 보안 규칙을 코드로 대체하려 하지 마** — Firebase 콘솔에서만 설정 가능한 영역. 규칙이 필요하면 옹짐꾼님께 콘솔에서 직접 추가해달라고 안내할 것(`docs/product-specs/family-sharing.md` 참고)
- **`index.html`에 고정해둔 CDN 라이브러리 버전(Chart.js 4.4.4)을 임의로 올리거나 latest 추적 링크로 바꾸지 마** — 버전 고정은 의도된 것(예고 없는 API 변경으로 성장그래프가 깨지는 걸 방지)

### 시크릿·재사용 요소·외부 의존성 (다른 스택의 흔한 금지 규칙을 이 저장소에 맞게 번역함)
- **API 키·시크릿 값을 프론트엔드 코드(`js/*.js`, `index.html`)에 하드코딩해서 커밋하지 마** — 지금은 프론트엔드에 노출되는 비밀값이 없음(Firebase 웹 설정의 `apiKey`는 공개돼도 안전한 값, Firestore 보안 규칙이 실제 방어선). 하지만 `docs/TODO.md` "AI 육아비서 구조"가 실현되면 OpenAI 같은 API 키가 생기는데, 이런 키는 **절대 프론트엔드 코드에 두지 말고** Vercel Serverless Function 뒤에 두고 프론트는 그 함수만 호출할 것
- **`guide/*.html`을 손으로 고치지 마 — 반드시 `scripts/build-guide.mjs`로 재생성** — 이 저장소엔 `ios/`·`android/` 네이티브 폴더 대신 이 정적 페이지가 "직접 만지면 안 되는 생성된 산출물"에 해당함(위에서 이미 언급했지만 가장 자주 실수하는 지점이라 여기서도 재강조)
- **여러 화면이 함께 쓰는 공용 요소(`css/main.css`의 `.btn`/`.fg`/`.dash-card`/`.type-btn`, `js/modal.js`의 `showModal()`/`cm()`, `js/ui.js`의 `gp()` 등) 원본을 특정 화면 하나 때문에 함부로 바꾸지 마** — 다른 리액트 프로젝트의 "Reusables 원본(`components/ui`) 직접 수정 금지"에 대응하는 규칙. 특정 화면만 다르게 보이게 하고 싶으면 새 클래스·새 함수를 만들 것, 공용 원본의 기존 동작·시그니처는 그대로 둘 것
- **`node_modules` 해당 없음** — 이 저장소는 번들러·패키지 매니저가 없는 순수 정적 사이트라 `node_modules` 자체가 없음. 대신 위 CDN 라이브러리 버전 고정 규칙이 같은 역할(외부 의존성을 함부로 건드리지 않기)을 함

## 작업 완료 후 체크리스트
- [ ] 완료한 항목을 `docs/TODO.md`에서 지우고 `docs/CHANGELOG.md`에 기록했는가
- [ ] **버전을 올렸다면** `index.html`의 `.site-footer-version`과 `scripts/build-guide.mjs`의 `APP_VERSION`을 **함께** 올리고 `node scripts/build-guide.mjs`를 재실행했는가 — v0.0.15~16에서 이 항목을 빼먹어서 화면 버전이 두 버전 동안 안 올라간 적이 있음(`docs/TODO.md` 참고). **`privacy.html`/`terms.html`/`contact.html`의 `.site-footer-version`도 같이 올렸는가** — v0.3.11에서 이 3곳이 v0.0.28로 40여 버전째 방치된 게 발견됨
- [ ] 정적 파일(아이콘·CSS·JS)을 바꿨다면 `sw.js`의 `CACHE_NAME` 버전도 올렸는가
- [ ] `data/checklist-data.js` 또는 `data/government-support.js`를 바꿨다면 `node scripts/build-guide.mjs`를 재실행해 `guide/*.html`에 반영했는가 (자동 반영 안 됨)
- [ ] 앱 본체(`index.html`/`css/`/`js/`)와 육아정보 페이지(`guide/`) 양쪽에 적용해야 하는 변경(폰트·색상·로고·버전 표시 등)이라면 양쪽 다 반영했는가 — 자세한 목록은 `ARCHITECTURE.md`의 "동시 적용 원칙" 참고

## 자주 쓰는 명령
```bash
node scripts/build-guide.mjs   # 공개 SEO 페이지(guide/*.html) 재생성 — data/*.js 수정 후 필수
cd functions && npm run deploy # Cloud Functions 배포(FCM 자동 발송) — data/*.js → functions/data/ 동기화 후 firebase deploy (v0.0.38)
```
- 그 외 빌드 스텝 없음(Vanilla JS, 번들러 없음). `pip`/`npm install` 등 별도 설치 없이 정적 파일 그대로 서빙됨
- 자동화된 테스트 없음 — Live Server 등으로 `index.html`을 열어 수동 확인 후 GitHub push → Vercel 자동 배포
- **예외**: `functions/`만 별도 Node 프로젝트(Cloud Functions, Firebase Blaze 요금제 필요) — `functions/package.json`에 의존성이 있고 `firebase deploy --only functions`로 별도 배포됨(Vercel과 무관, GitHub push만으로는 안 나감)

## 저장소 구조 (요약 — 자세한 건 `ARCHITECTURE.md`)
```
index.html, css/, js/, data/     앱 본체(SPA)
guide/                            scripts/build-guide.mjs로 생성되는 정적 SEO 페이지 — 직접 편집 금지
docs/                             프로젝트 문서(사양·가이드라인·할일·변경이력)
docs/product-specs/              기능별 상세 스펙(가족공유·게스트모드·SEO·수익화·계정삭제·푸시알림) — 도메인별로 분리됨
functions/                        Cloud Functions(FCM 예약 발송, v0.0.38) — 별도 Node 프로젝트, Vercel 배포와 무관
fonts/, icons/                    정적 리소스
sw.js, manifest.json              PWA
privacy.html·terms.html·contact.html·404.html, robots.txt, sitemap.xml   정책·SEO 페이지
```

## 문서 간 역할 분리 (중복 방지 — 예전에 PROJECT_SPEC.md와 CHANGELOG.md 내용이 겹쳐서 정리한 적 있음)
| 문서 | 역할 |
|---|---|
| `AGENTS.md` (이 파일) | 에이전트 워크플로·원칙·체크리스트 |
| `ARCHITECTURE.md` | 기술 스택·모듈 구조·데이터 흐름 — 자주 안 바뀌는 "어떻게 만들어졌는지" |
| `docs/PROJECT_SPEC.md` | 프로젝트 개요·버전 정책·Firebase 스키마 요약 — 기능별 상세는 아래로 분리됨 |
| `docs/product-specs/*.md` | 기능 하나당 파일 하나(가족공유·게스트모드·SEO·수익화·계정삭제) — 목차는 `docs/product-specs/index.md` |
| `docs/TODO.md` | 지금 당장 할 일 (확인 항목·다음 후보·버그) |
| `docs/CHANGELOG.md` | 버전별 변경 이력 + 맨 위 "완료 기능 요약" 표 |
| `docs/UI_GUIDELINE.md` | 디자인 시스템(컬러·타이포·컴포넌트) |

새로 문서를 추가하고 싶을 때는 이 표에 없는 새 역할인지 먼저 확인하고, 기존 문서 중 하나에 이미 들어갈 자리가 있다면 새 파일을 만들지 마세요. 기능 하나를 깊게 다루는 새 스펙 문서가 필요하면 `docs/PROJECT_SPEC.md`에 이어붙이지 말고 `docs/product-specs/`에 새 파일로 추가하고 `index.md`에 등록하세요.

## Doc-gardening 체크리스트 (문서 부패 방지)

이 저장소엔 CI가 없습니다(빌드 스텝이 없는 정적 사이트라 마련하지 않음). 그래서 "문서가 실제 코드와 어긋나는 것"을 잡아내는 건 오랫동안 매 세션 시작 시 사람이 손으로 훑는 방식뿐이었는데, 실제로 이걸 안 해서 버전 표시가 2개 버전 동안 안 맞은 적(v0.0.15~16), CHANGELOG 헤더가 깨진 채로 방치된 적(v0.0.19), product-specs/index.md 상태 표와 UI_GUIDELINE.md/ARCHITECTURE.md 색상 표가 실제 코드와 어긋난 채 방치된 적(v0.2.1 감사에서 발견)이 있었습니다.

**v0.2.2부터**: 아래 항목 중 기계적으로 비교 가능한 것들은 `node scripts/check-docs.mjs`로 자동화했습니다. **새 세션을 시작할 때, 본 작업 전에 반드시 이 명령을 먼저 실행**하고, 나온 항목을 고친 뒤 본 작업을 시작하세요. 이 스크립트는 "숫자·키가 어긋났다" 류만 잡아주고, 문장이 자연스러운지·내용이 실제로 맞는지는 여전히 사람이 봐야 하므로 아래 수동 체크리스트도 참고용으로 남겨둡니다:
- [ ] `index.html`의 `.site-footer-version`, `scripts/build-guide.mjs`의 `APP_VERSION`, `docs/CHANGELOG.md` 맨 위 항목의 버전, 그리고 `privacy.html`/`terms.html`/`contact.html`의 `.site-footer-version`까지 전부 같은가
- [ ] `docs/CHANGELOG.md`의 `## [v0.0.x]` 헤더들이 순서대로(최신이 위) 끊김 없이 이어지는가 — 본문이 헤더 없이 붕 떠 있지 않은가
- [ ] `docs/TODO.md` "현재 확인 필요 항목"의 최상단 버전 번호가 실제 최신 버전과 일치하는가
- [ ] `js/` 아래 실제 파일 목록과 `sw.js`의 `APP_SHELL` 배열을 diff — 새로 생겼는데 캐시 목록에 없는 파일이 있는가 (`ls js/ | sort`와 `grep -oP "(?<='./js/)[^']+" sw.js | sort`를 비교)
- [ ] `docs/product-specs/index.md`의 표와 실제 `docs/product-specs/` 폴더 파일 목록이 일치하는가
- [ ] `docs/product-specs/index.md`의 상태 표시(✅/🟡/🔴)가 각 파일 자체의 "> **상태**:" 줄과 같은 단계를 가리키는가(하나만 갱신되고 다른 하나가 안 따라간 경우가 실제로 있었음)
- [ ] `js/calendar.js`의 `DEFAULT_EV_COLORS`에 있는 카테고리 키가 `ARCHITECTURE.md`·`docs/UI_GUIDELINE.md`의 색상 표에 전부 나오는가(새 카테고리 추가 시 두 문서 다 누락되기 쉬움)

뭔가 어긋난 걸 발견하면, 원래 요청과 무관해도 먼저 짧게 언급하고 고쳐도 되는지 확인한 뒤 진행하세요(위 "요청받지 않은 범위까지 임의로 확장하지 마" 규칙과 세트로 적용).
