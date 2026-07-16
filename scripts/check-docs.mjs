#!/usr/bin/env node
/**
 * scripts/check-docs.mjs — v0.2.2에서 추가
 *
 * 이 저장소엔 CI가 없어서(정적 사이트, 빌드 스텝 없음) 문서가 코드와 어긋나는 걸
 * 잡아낼 자동화가 지금까지 전혀 없었다. AGENTS.md의 "Doc-gardening 체크리스트"가
 * 사람(Claude)이 매 세션 시작 시 손으로 훑는 방식이었는데, v0.2.1에서 실제로
 * 여러 개를 놓쳤다 (product-specs/index.md 상태 표 오래됨, UI_GUIDELINE.md/
 * ARCHITECTURE.md 색상 표에 gov/food 카테고리 누락 + rec 라벨/색상값 오기재,
 * CHANGELOG.md 연도 오타).
 *
 * 이 스크립트는 그 체크리스트 중 "문자열/구조를 기계적으로 비교할 수 있는 항목"을
 * 자동화한다. 완전한 대체는 아니고(문장 표현이 자연스러운지, 내용이 정확한지는
 * 여전히 사람이 봐야 함), 최소한 "숫자·키가 어긋났다" 류의 반복되는 실수는 잡아준다.
 *
 * 실행: node scripts/check-docs.mjs
 * 새 세션 시작 시 AGENTS.md의 Doc-gardening 체크리스트 대신(+보완으로) 먼저 이걸 돌릴 것.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let issues = [];
let checks = 0;
const fail = (msg) => issues.push(msg);
const check = (label, fn) => { checks++; try { fn(); } catch (e) { fail(`[${label}] 체크 실행 중 오류: ${e.message}`); } };

// ── 1. 버전 3곳 일치: index.html / build-guide.mjs / CHANGELOG.md 맨 위 ──
check('버전 일치', () => {
  const html = read('index.html');
  const footerM = html.match(/site-footer-version[^>]*>[^v]*(v[\d.]+)/);
  const build = read('scripts/build-guide.mjs');
  const buildM = build.match(/APP_VERSION\s*=\s*['"]([\d.v]+)['"]/);
  const changelog = read('docs/CHANGELOG.md');
  const clM = changelog.match(/^##\s*\[(v[\d.]+)\]/m);

  const footerV = footerM?.[1];
  const buildV = buildM?.[1];
  const clV = clM?.[1];

  if (!footerV) fail('index.html에서 .site-footer-version 버전을 못 찾음');
  if (!buildV) fail('scripts/build-guide.mjs에서 APP_VERSION을 못 찾음');
  if (!clV) fail('docs/CHANGELOG.md 맨 위에서 "## [vX.X.X]" 헤더를 못 찾음');
  if (footerV && buildV && footerV !== buildV) {
    fail(`버전 불일치: index.html(${footerV}) ≠ build-guide.mjs(${buildV})`);
  }
  if (footerV && clV && footerV !== clV) {
    fail(`버전 불일치: index.html(${footerV}) ≠ CHANGELOG.md 최신 항목(${clV})`);
  }

  // v0.3.11: privacy.html/terms.html/contact.html도 index.html과 똑같은
  // .site-footer-version을 갖고 있는 독립 정적 페이지인데, 지금까지 버전 동기화
  // 루틴(위 index.html/build-guide.mjs/CHANGELOG.md 3곳) 대상에서 빠져있어서
  // v0.0.28에서 40여 버전째 방치된 채 발견됨(옹짐꾼님 제보, 2026-07-16) — 재발
  // 방지를 위해 여기서도 함께 검사
  if (footerV) {
    for (const f of ['privacy.html', 'terms.html', 'contact.html']) {
      const pageM = read(f).match(/site-footer-version[^>]*>[^v]*(v[\d.]+)/);
      const pageV = pageM?.[1];
      if (!pageV) fail(`${f}에서 .site-footer-version 버전을 못 찾음`);
      else if (pageV !== footerV) fail(`버전 불일치: index.html(${footerV}) ≠ ${f}(${pageV})`);
    }
  }
});

// ── 2. CHANGELOG.md 버전 헤더가 이어지는가 (세션 규칙 기준) ──
check('CHANGELOG 버전 순서', () => {
  const changelog = read('docs/CHANGELOG.md');
  const versions = [...changelog.matchAll(/^##\s*\[(v(\d+)\.(\d+)\.(\d+))\]/gm)]
    .map(m => ({ raw: m[1], major: +m[2], minor: +m[3], patch: +m[4] }));
  for (let i = 0; i < versions.length - 1; i++) {
    const cur = versions[i], prev = versions[i + 1]; // cur가 더 최신(파일 위쪽)
    const sameSession = cur.major === prev.major && cur.minor === prev.minor && cur.patch === prev.patch + 1;
    const newSession = cur.major === prev.major && cur.minor === prev.minor + 1 && cur.patch === 0;
    if (!sameSession && !newSession) {
      fail(`CHANGELOG 버전 순서 이상: [${prev.raw}] 다음에 [${cur.raw}]는 규칙(끝자리+1 또는 새 세션=가운데+1·끝자리 0)에 안 맞음`);
    }
  }
});

// ── 3. docs/TODO.md 최상단 버전이 최신 버전과 일치하는가 ──
check('TODO.md 버전 언급', () => {
  const html = read('index.html');
  const footerV = html.match(/site-footer-version[^>]*>[^v]*(v[\d.]+)/)?.[1];
  const todo = read('docs/TODO.md');
  // "인계 노트" 목록은 항상 `**v0.2.1** — ...` 형태로 굵게 시작하므로, 이 굵은 버전 표기만
  // 대상으로 삼는다(머리말 설명문에 등장하는 예시 버전 번호는 오탐 원인이라 제외).
  const bolded = [...todo.matchAll(/\*\*v(\d+\.\d+\.\d+)\*\*/g)].map(m => `v${m[1]}`);
  if (footerV && bolded.length && bolded[0] !== footerV) {
    fail(`docs/TODO.md 인계 노트 최상단 버전(${bolded[0]})이 최신 버전(${footerV})과 다름`);
  }
});

// ── 4. sw.js APP_SHELL과 js/ 폴더 실제 파일 목록 diff ──
check('sw.js 캐시 목록', () => {
  // admin.js는 sw.js 상단 주석(v0.0.39)에 따라 의도적으로 오프라인 캐시(APP_SHELL) 대상에서
  // 제외됨(admin.html/css도 동일) — privacy.html 같은 독립 정책 페이지와 동일 취급이라 정상.
  const INTENTIONALLY_EXCLUDED = new Set(['admin.js']);
  const sw = read('sw.js');
  const shellFiles = new Set([...sw.matchAll(/\.\/js\/([\w.-]+\.js)/g)].map(m => m[1]));
  const actualFiles = readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js') && !INTENTIONALLY_EXCLUDED.has(f));
  const missing = actualFiles.filter(f => !shellFiles.has(f));
  if (missing.length) {
    fail(`sw.js APP_SHELL에 없는 js/ 파일: ${missing.join(', ')} (새 파일 추가했다면 캐시 목록·CACHE_NAME 버전도 갱신 필요)`);
  }
});

// ── 5. docs/product-specs/index.md 표 vs 실제 폴더 파일 목록 ──
check('product-specs 목차', () => {
  const indexMd = read('docs/product-specs/index.md');
  const linked = new Set([...indexMd.matchAll(/\[`([\w.-]+\.md)`\]/g)].map(m => m[1]));
  const actual = readdirSync(join(ROOT, 'docs/product-specs')).filter(f => f.endsWith('.md') && f !== 'index.md');
  const missingFromIndex = actual.filter(f => !linked.has(f));
  const missingFromDisk = [...linked].filter(f => !actual.includes(f));
  if (missingFromIndex.length) fail(`docs/product-specs/index.md에 링크가 없는 파일: ${missingFromIndex.join(', ')}`);
  if (missingFromDisk.length) fail(`docs/product-specs/index.md가 링크하지만 실제로 없는 파일: ${missingFromDisk.join(', ')}`);
});

// ── 6. product-specs/index.md 상태 이모지 vs 각 파일 자체 상태 줄 이모지 ──
check('product-specs 상태 동기화', () => {
  const indexMd = read('docs/product-specs/index.md');
  const rows = [...indexMd.matchAll(/\[`([\w.-]+\.md)`\][^\n|]*\|[^\n|]*\|\s*([✅🟡🔴⚪]?)/g)];
  for (const [, file, emoji] of rows) {
    let content;
    try { content = read(`docs/product-specs/${file}`); } catch { continue; }
    const fileEmoji = content.match(/>\s*\*\*상태\*\*[:：]\s*([✅🟡🔴⚪])/)?.[1];
    if (fileEmoji && emoji && fileEmoji !== emoji) {
      fail(`상태 표시 불일치: index.md의 ${file} 행은 "${emoji}"인데 파일 본문 상태는 "${fileEmoji}" — 둘 중 하나가 오래됨`);
    }
  }
});

// ── 7. 캘린더 이벤트 카테고리 키가 문서 색상 표에 다 있는가 ──
check('이벤트 카테고리 vs 색상 문서', () => {
  const cal = read('js/calendar.js');
  const colorBlock = cal.match(/DEFAULT_EV_COLORS\s*=\s*\{([\s\S]*?)\}/)?.[1] || '';
  const keys = [...colorBlock.matchAll(/^\s*(\w+):/gm)].map(m => m[1]);
  const arch = read('ARCHITECTURE.md');
  const uiGuide = read('docs/UI_GUIDELINE.md');
  for (const key of keys) {
    const inArch = new RegExp('`' + key + '`').test(arch);
    const inGuide = new RegExp('`' + key + '`').test(uiGuide);
    if (!inArch) fail(`ARCHITECTURE.md 이벤트 타입 표에 \`${key}\` 카테고리가 안 보임 (js/calendar.js DEFAULT_EV_COLORS엔 있음)`);
    if (!inGuide) fail(`docs/UI_GUIDELINE.md 색상 표에 \`${key}\` 카테고리가 안 보임 (js/calendar.js DEFAULT_EV_COLORS엔 있음)`);
  }
});

// ── 8. docs/TODO.md "인계 노트"가 최근 10개 버전을 넘지 않는가 ──
// v0.2.5: 문서 자체(TODO.md 상단 안내문)가 "최근 10개 버전 이내로 유지"하라고 명시하는데도
// v0.1.0~v0.2.4까지 7번의 세션 동안 아무도 꼬리를 안 지워서 15개까지 쌓인 걸 옹짐꾼님이
// 직접 발견함 — 매번 위에 새로 추가만 하고 아래를 지우는 걸 깜빡하기 쉬운 실수라 자동화함.
check('TODO.md 인계 노트 개수', () => {
  const todo = read('docs/TODO.md');
  // 실제 인계 노트 목록은 "## ⚠️..." 헤더 바로 다음, 첫 "### "(서비스워커 이슈 등 하위 섹션)나
  // "## "(다음 큰 섹션) 전까지만임 — 그 아래 "### 알아두면 좋은 것"에도 "- **v0.0.47**: ..."처럼
  // 인계 노트와 똑같은 볼드 버전 표기가 섞여 있어서, lookahead를 "\n## "까지로만 두면 그 잡다한
  // 항목까지 다 세어버려 오탐(14개로 잘못 셈)이 남 — 직접 겪은 실수라 주석 남김.
  const section = todo.match(/## ⚠️ 새 대화로 이어갈 때[\s\S]*?(?=\n### |\n## |\n---)/);
  if (!section) { fail('docs/TODO.md에서 "인계 노트" 섹션을 못 찾음(제목이 바뀌었다면 이 체크도 같이 수정할 것)'); return; }
  const entries = section[0].match(/^- \*\*v\d+\.\d+\.\d+\*\*/gm) || [];
  if (entries.length > 10) {
    fail(`docs/TODO.md 인계 노트가 ${entries.length}개 있음(최근 10개만 유지하는 규칙, 파일 상단 안내문·PROJECT_SPEC.md 참고) — 오래된 항목부터 지울 것`);
  }
});

// ── 결과 출력 ──
console.log(`check-docs: ${checks}개 항목 확인`);
if (issues.length === 0) {
  console.log('✅ 문서-코드 불일치 없음');
  process.exit(0);
} else {
  console.log(`❌ ${issues.length}건 발견:\n`);
  issues.forEach((m, i) => console.log(`${i + 1}. ${m}`));
  process.exit(1);
}
