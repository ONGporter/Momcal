# 공개 콘텐츠 페이지 (SEO)

> **상태**: ✅ 구현 완료 (Sprint 16, Sprint 18 정부지원 추가, Sprint 19 JSON-LD, Sprint 21 검색·CTA)
> **관련 코드**: `guide/*.html`, `scripts/build-guide.mjs`, `guide/guide.css`

`guide/` 아래 4개 페이지(`pregnancy.html`, `parenting.html`, `food.html`, `government-support.html`)와 허브(`guide/index.html`)는 로그인·JS 실행 없이도 검색엔진이 텍스트를 그대로 읽을 수 있는 **순수 정적 HTML**입니다. 앱 본체(SPA)와는 완전히 분리되어 있습니다 — 같은 저장소·같은 배포에 포함되지만, Firebase나 앱의 JS 모듈을 전혀 로드하지 않습니다.

- **콘텐츠 출처**: `data/checklist-data.js`(임신/육아/이유식 체크리스트 항목)와 `data/government-support.js`(정부지원 제도 일정)를 그대로 사용 — 앱 데이터와 내용이 어긋나지 않도록 직접 손으로 쓰지 않고 스크립트로 생성함
- **생성 방법**: `node scripts/build-guide.mjs`를 저장소 루트에서 실행하면 `data/checklist-data.js`를 읽어 `guide/*.html`을 다시 만듦
- **⚠️ 체크리스트 내용을 수정했다면 반드시 이 스크립트를 다시 실행**해서 가이드 페이지도 함께 갱신해야 함 (자동으로 동기화되지 않음 — 정적 파일이기 때문)
- **스타일**: `guide/guide.css` 하나로 `guide/` 페이지와 `privacy.html`/`terms.html`/`contact.html`이 공통으로 사용. `docs/UI_GUIDELINE.md`의 브랜드 컬러·폰트를 따르지만 앱 전용 CSS(`css/main.css` 등)와는 독립적 (앱에 불필요한 스타일을 끌어오지 않기 위함)
- **앱과의 연결**: 앱 하단 푸터·로그인 화면에 육아정보/정책 페이지 링크가 있고, 가이드 페이지에는 "맘캘 앱 무료로 쓰기" CTA가 곳곳에 있어 콘텐츠 → 앱 유입 동선을 만듦
- **구조화 데이터(JSON-LD, Sprint 19)**: 4개 콘텐츠 페이지(`pregnancy`/`parenting`/`food`/`government-support`)에는 각 항목을 질문·답변 쌍으로 변환한 `FAQPage` 스키마가 `<head>`에 삽입되어 있음 (`scripts/build-guide.mjs`의 `faqJsonLd()`가 생성). ⚠️ 구글이 2023년부터 FAQ 리치 스니펫 노출을 정부·의료기관 등 공신력 있는 사이트로 제한해서, 일반 사이트인 맘캘에는 검색결과의 시각적 리치 스니펫은 잘 안 뜰 가능성이 높음 — 다만 AI 개요·생성형 검색이 콘텐츠를 인용할 때 구조를 더 명확히 인식하는 데 도움이 될 수 있어 추가함 (GEO 목적)
- **검색 기능 (Sprint 21)**: 허브 페이지(`guide/index.html`)에는 4개 페이지 153개 항목 전체를 대상으로 하는 사이트 전체 검색창이 있음 — 빌드 시점에 `buildSearchIndex()`가 만든 JSON을 페이지에 심어두고, 입력 시 클라이언트에서만 필터링(서버 호출 없음). 각 카테고리 페이지에는 그 페이지 안에서만 즉석 필터링하는 검색창이 별도로 있음. 항목마다 `id` 속성(체크리스트는 `it.id`, 정부지원은 `it.key`)이 있어 검색 결과에서 `#앵커`로 바로 이동 가능
- **기존 사용자 CTA 전환 (Sprint 21)**: 정적 페이지라 로그인 여부를 서버에서 알 수 없지만, 앱과 같은 도메인이라 `localStorage`를 공유하는 점을 이용해 게스트 데이터(`momcal_guest_v1`) 또는 Firebase 로그인 세션(`firebase:authUser:` 접두 키) 흔적으로 기존 사용자를 감지함 — 감지되면 "무료로 시작하기" 문구가 "앱으로 돌아가기"로 자동 전환됨 (`returningUserScript()`)
- **⚠️ 검증 도구 선택 주의**: Google "리치 검색결과 테스트"(search.google.com/test/rich-results)는 일반 사이트의 FAQPage를 아예 검사 대상에서 제외하는 것으로 보여, 코드가 정상이어도 "감지된 항목 없음"이 뜸 (배포 문제·문법 오류가 아님, 실사용 확인됨). JSON-LD가 실제로 유효한지 확인하려면 구글 도구 대신 **schema.org 공식 검증 도구**(validator.schema.org)를 사용할 것

## 정책 페이지 (Google AdSense 심사 준비)

`privacy.html`(개인정보처리방침), `terms.html`(이용약관), `contact.html`(문의)은 향후 AdSense 심사에 대비해 만들어둠.

- 문의 이메일은 `jws12131411@gmail.com`으로 반영됨 (Sprint 17)
- 개인정보처리방침의 "계정 삭제·데이터 삭제는 문의 이메일로 요청" 문구는 Sprint 17에서 앱 내 자체 탈퇴 기능이 추가되며 함께 갱신됨 (`docs/product-specs/account-deletion.md` 참고)

## SEO 적용 현황 (Sprint 14)

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 메타 description/keywords, canonical | ✅ 적용 | `index.html` |
| sitemap.xml | ✅ 적용 | 현재는 SPA라 단일 URL만 포함 |
| robots.txt | ✅ 적용 | 전체 허용 + sitemap 위치 안내 |
| Open Graph / Twitter Card | ✅ 적용 | 카카오톡·페이스북·트위터 공유 시 미리보기 이미지(`icons/og-image.png`) 노출 |
| 로그인 없이 보는 공개 콘텐츠 | ✅ 적용 (Sprint 16, Sprint 18에서 정부지원 추가) | `guide/` — 임신·예방접종·이유식·정부지원 상세 정보 153개 항목, 정적 HTML |
| AdSense 심사용 정책 페이지 | ✅ 적용 (Sprint 16) | `privacy.html`/`terms.html`/`contact.html` (Sprint 17에서 문의 이메일 반영) |
| Google Search Console 등록 | ✅ 소유권 확인 완료 | 사이트맵 제출 등 후속 절차는 `docs/TODO.md` 참고 |
| 네이버 서치어드바이저 등록 | ✅ 소유권 확인 완료 | 사이트맵 제출·수집 요청 등 후속 절차는 `docs/TODO.md` 참고 |
| 커스텀 404 페이지 | ✅ 적용 (v0.0.56) | `404.html` — Vercel이 `vercel.json` 없는 정적 배포에서 루트의 `404.html`을 자동으로 인식해서 404 응답 시 보여줌. 마스코트 이미지 + 홈으로 가기 버튼, `noindex, follow`로 색인 제외 |
