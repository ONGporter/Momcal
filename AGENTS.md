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

## 작업 완료 후 체크리스트
- [ ] 완료한 항목을 `docs/TODO.md`에서 지우고 `docs/CHANGELOG.md`에 기록했는가
- [ ] **버전을 올렸다면** `index.html`의 `.site-footer-version`과 `scripts/build-guide.mjs`의 `APP_VERSION`을 **함께** 올리고 `node scripts/build-guide.mjs`를 재실행했는가 — v0.0.15~16에서 이 항목을 빼먹어서 화면 버전이 두 버전 동안 안 올라간 적이 있음(`docs/TODO.md` 참고)
- [ ] 정적 파일(아이콘·CSS·JS)을 바꿨다면 `sw.js`의 `CACHE_NAME` 버전도 올렸는가
- [ ] `data/checklist-data.js` 또는 `data/government-support.js`를 바꿨다면 `node scripts/build-guide.mjs`를 재실행해 `guide/*.html`에 반영했는가 (자동 반영 안 됨)
- [ ] 앱 본체(`index.html`/`css/`/`js/`)와 육아정보 페이지(`guide/`) 양쪽에 적용해야 하는 변경(폰트·색상·로고·버전 표시 등)이라면 양쪽 다 반영했는가 — 자세한 목록은 `ARCHITECTURE.md`의 "동시 적용 원칙" 참고

## 자주 쓰는 명령
```bash
node scripts/build-guide.mjs   # 공개 SEO 페이지(guide/*.html) 재생성 — data/*.js 수정 후 필수
```
- 그 외 빌드 스텝 없음(Vanilla JS, 번들러 없음). `pip`/`npm install` 등 별도 설치 없이 정적 파일 그대로 서빙됨
- 자동화된 테스트 없음 — Live Server 등으로 `index.html`을 열어 수동 확인 후 GitHub push → Vercel 자동 배포

## 저장소 구조 (요약 — 자세한 건 `ARCHITECTURE.md`)
```
index.html, css/, js/, data/     앱 본체(SPA)
guide/                            scripts/build-guide.mjs로 생성되는 정적 SEO 페이지 — 직접 편집 금지
docs/                             프로젝트 문서(사양·가이드라인·할일·변경이력)
fonts/, icons/                    정적 리소스
sw.js, manifest.json              PWA
privacy.html·terms.html·contact.html, robots.txt, sitemap.xml   정책·SEO 페이지
```

## 문서 간 역할 분리 (중복 방지 — 예전에 PROJECT_SPEC.md와 CHANGELOG.md 내용이 겹쳐서 정리한 적 있음)
| 문서 | 역할 |
|---|---|
| `AGENTS.md` (이 파일) | 에이전트 워크플로·원칙·체크리스트 |
| `ARCHITECTURE.md` | 기술 스택·모듈 구조·데이터 흐름 — 자주 안 바뀌는 "어떻게 만들어졌는지" |
| `docs/PROJECT_SPEC.md` | 지금 상태(스키마 상세, 기능별 설계, 수익화 전략 등) |
| `docs/TODO.md` | 지금 당장 할 일 (확인 항목·다음 후보·버그) |
| `docs/CHANGELOG.md` | 버전별 변경 이력 + 맨 위 "완료 기능 요약" 표 |
| `docs/UI_GUIDELINE.md` | 디자인 시스템(컬러·타이포·컴포넌트) |

새로 문서를 추가하고 싶을 때는 이 표에 없는 새 역할인지 먼저 확인하고, 기존 문서 중 하나에 이미 들어갈 자리가 있다면 새 파일을 만들지 마세요.
