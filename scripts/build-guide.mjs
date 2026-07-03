/**
 * scripts/build-guide.mjs — Sprint 16, Sprint 18에서 정부지원 페이지 추가
 *
 * data/checklist-data.js (앱의 체크리스트 데이터, dd 상세 설명 포함)와
 * data/government-support.js (정부지원 제도 일정 데이터)를 그대로 읽어서
 * /guide/pregnancy.html, /guide/parenting.html, /guide/food.html,
 * /guide/government-support.html 정적 페이지를 생성한다.
 *
 * 왜 정적 생성인가?
 *  - 맘캘 본체는 Firebase 로그인 뒤에서 JS로 그려지는 SPA라 검색엔진이 색인할 실질적인
 *    공개 콘텐츠가 없었음 (PROJECT_SPEC.md "수익화 & 트래픽 전략" 참고)
 *  - 이 가이드 페이지들은 로그인·JS 실행 없이도 크롤러가 텍스트를 그대로 읽을 수 있는
 *    순수 정적 HTML로 만들어 실질적인 SEO 콘텐츠 역할을 하게 함
 *  - 원본 데이터(체크리스트 dd 필드)와 내용이 어긋나지 않도록, 직접 손으로 쓰지 않고
 *    이 스크립트로 checklist-data.js에서 생성함 — 체크리스트 내용이 바뀌면 이 스크립트를
 *    다시 실행해서 가이드 페이지도 함께 갱신해야 함
 *
 * 실행 방법: node scripts/build-guide.mjs   (repo 루트에서 실행)
 */

import { clData } from '../data/checklist-data.js';
import { govSupportSchedule } from '../data/government-support.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dirname, '..');
const GUIDE = join(ROOT, 'guide');
const SITE  = 'https://momcal.vercel.app';

/* 정부지원 데이터는 {preg, postpartum, parenting} 키의 배열이라 체크리스트와 형태가 달라
   가이드 페이지용 카테고리 배열로 한 번 변환해준다. */
const govCatLabels = {
  preg:       '🤰 임신 중',
  postpartum: '👶 출산 직후 (출생 후 며칠~몇 주 이내)',
  parenting:  '🧒 육아 중',
};
const govCats = Object.entries(govSupportSchedule).map(([key, items]) => ({
  key, label: govCatLabels[key] || key, items,
}));

/**
 * 육아정보 4개 페이지 전체 항목을 하나의 검색 인덱스로 평탄화 (Sprint 21)
 * 허브 페이지(guide/index.html)의 사이트 전체 검색에 쓰임 — 페이지 이동 없이
 * 다른 카테고리 페이지의 항목도 찾아서 해당 페이지의 항목 위치(id)로 바로 연결한다.
 */
function buildSearchIndex() {
  const idx = [];
  const addCl = (cats, page) => cats.forEach(cat =>
    cat.items.forEach(it => idx.push({
      id: it.id, title: it.t, desc: it.dd || it.d || '', page, cat: cat.label,
    })));
  addCl(clData.preg, 'pregnancy.html');
  addCl(clData.born, 'parenting.html');
  addCl(clData.food, 'food.html');
  govCats.forEach(cat => cat.items.forEach(it => idx.push({
    id: it.key, title: it.title, desc: it.desc || '', page: 'government-support.html', cat: cat.label,
  })));
  return idx;
}
const searchIndex = buildSearchIndex();

/* ── 공통 head/header/footer ── */
function head(title, desc, path, jsonLd) {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}${path}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="맘캘 MomCal">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${SITE}/icons/og-image.png">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png">
<link rel="stylesheet" href="./guide.css">${jsonLd ? `\n${jsonLd}` : ''}`;
}

/**
 * FAQPage 구조화 데이터(JSON-LD) 생성 (Sprint 19)
 * - 검색결과 리치 스니펫은 2023년 이후 구글이 정부·의료기관 사이트로 제한해서 일반 사이트엔 잘 안 뜨지만,
 *   AI 개요/생성형 검색이 콘텐츠를 인용할 때 구조를 더 명확히 파악하는 데 도움이 됨 (GEO 목적)
 * - items: 카테고리 배열의 items를 평탄화한 배열
 * - questionFn(item) => 질문 문자열, answerFn(item) => 답변 문자열
 */
function faqJsonLd(cats, questionFn, answerFn) {
  const items = cats.flatMap(c => c.items);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(it => ({
      '@type': 'Question',
      name: questionFn(it),
      acceptedAnswer: {
        '@type': 'Answer',
        text: answerFn(it),
      },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function header() {
  return `<header class="g-header">
  <a class="g-logo" href="./index.html">맘캘 <img src="${SITE}/icons/logo-mark.png" alt="" class="brand-mark"></a>
  <a class="g-cta js-cta" href="${SITE}/">📅 맘캘 앱 무료로 쓰기</a>
</header>`;
}

function footer() {
  return `<div class="g-footer">
  © 맘캘 MomCal · <a href="./index.html">육아정보</a> · <a href="../privacy.html">개인정보처리방침</a> · <a href="../terms.html">이용약관</a> · <a href="../contact.html">문의</a> · <a href="${SITE}/">앱 바로가기</a>
</div>
${returningUserScript()}`;
}

/**
 * 이미 맘캘을 쓰고 있는 사용자에게는 "무료로 시작하기" 문구가 어색해서,
 * localStorage 흔적(게스트 데이터 또는 Firebase 로그인 세션)으로 기존 사용자를 감지해
 * CTA 문구를 "앱으로 돌아가기"로 바꿔준다 (Sprint 21).
 * - guide 페이지는 앱 본체와 같은 도메인(momcal.vercel.app)에서 서빙되므로 localStorage 공유됨
 * - Firebase SDK를 이 정적 페이지에 새로 붙이지 않기 위해, 세션 존재 여부만 키 이름으로 판별
 *   (Firebase Auth가 로컬 퍼시스턴스에 남기는 키는 항상 'firebase:authUser:'로 시작함)
 */
function returningUserScript() {
  return `<script>
(function(){
  try {
    var known = !!localStorage.getItem('momcal_guest_v1');
    if (!known) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('firebase:authUser:') === 0) { known = true; break; }
      }
    }
    if (!known) return;
    document.querySelectorAll('.js-cta').forEach(function(el){ el.textContent = '🏠 맘캘 앱으로 돌아가기'; });
    document.querySelectorAll('.js-cta-banner-title').forEach(function(el){ el.textContent = '📅 이 정보, 맘캘 앱에서 이어보기'; });
    document.querySelectorAll('.js-cta-banner-desc').forEach(function(el){ el.textContent = '이미 맘캘을 쓰고 계시네요! 앱으로 돌아가서 이어서 확인해보세요.'; });
    document.querySelectorAll('.js-cta-banner-btn').forEach(function(el){ el.textContent = '앱으로 돌아가기 →'; });
  } catch (e) {}
})();
</script>`;
}

function ctaBanner(text) {
  return `<div class="g-cta-banner">
  <h2 class="js-cta-banner-title">📅 ${text}</h2>
  <p class="js-cta-banner-desc">맘캘에 등록하면 오늘 날짜 기준으로 일정이 자동으로 정리돼요. 로그인 없이도 바로 써볼 수 있어요.</p>
  <a class="js-cta-banner-btn" href="${SITE}/">지금 무료로 시작하기 →</a>
</div>`;
}

/* ── 카테고리 섹션 HTML 생성 (체크리스트형: t/d/dd/r) ── */
function renderSection(cat) {
  const items = cat.items.map(it => `
    <div class="g-item" id="${it.id}">
      <h3>${it.t} ${it.r ? '<span class="req">필수</span>' : '<span class="opt">선택</span>'}</h3>
      <p>${it.dd || it.d || ''}</p>
    </div>`).join('');
  return `<section class="g-section">
    <h2>${cat.label}</h2>
    ${items}
  </section>`;
}

/* ── 카테고리 섹션 HTML 생성 (정부지원형: title/desc/importance/link/deadline) ── */
function renderGovSection(cat) {
  const items = cat.items.map(it => {
    const deadline = it.deadlineNote
      ? `<p style="margin-top:6px;font-size:.76rem;color:var(--pkd);font-weight:800">⏰ ${it.deadlineNote}</p>`
      : '';
    return `
    <div class="g-item" id="${it.key}">
      <h3>${it.title} ${it.importance === 'req' ? '<span class="req">필수</span>' : '<span class="opt">해당자</span>'}</h3>
      <p>${it.desc}</p>
      ${deadline}
      <p style="margin-top:6px"><a href="${it.link}" target="_blank" rel="noopener nofollow">공식 사이트 바로가기 →</a></p>
    </div>`;
  }).join('');
  return `<section class="g-section">
    <h2>${cat.label}</h2>
    ${items}
  </section>`;
}

/**
 * 페이지 내 검색창 (Sprint 21)
 * - 현재 페이지에 이미 렌더된 .g-item들을 텍스트로 즉석 필터링 (서버·네트워크 요청 없음)
 * - 검색 결과가 0건인 섹션은 통째로 숨겨서 스크롤 낭비를 줄임
 */
function pageSearchBox() {
  return `<div class="g-search">
    <input type="search" id="pageSearch" class="g-search-input"
           placeholder="🔍 이 페이지에서 검색 (예: 엽산, DTaP, 쌀미음)"
           oninput="filterGuidePage(this.value)">
    <div id="pageSearchCount" class="g-search-count"></div>
  </div>
  <script>
    function filterGuidePage(q) {
      q = q.trim().toLowerCase();
      var sections = document.querySelectorAll('.g-section');
      var totalShown = 0;
      sections.forEach(function(sec) {
        var items = sec.querySelectorAll('.g-item');
        var shownInSec = 0;
        items.forEach(function(it) {
          var match = !q || it.textContent.toLowerCase().indexOf(q) !== -1;
          it.style.display = match ? '' : 'none';
          if (match) shownInSec++;
        });
        sec.style.display = shownInSec > 0 ? '' : 'none';
        totalShown += shownInSec;
      });
      var countEl = document.getElementById('pageSearchCount');
      if (countEl) countEl.textContent = q ? (totalShown + '개 항목 검색됨') : '';
    }
  </script>`;
}

function page({ title, desc, path, heroTitle, heroDesc, intro, cats, ctaText, disclaimer, renderCat = renderSection, questionFn, answerFn }) {
  const jsonLd = (questionFn && answerFn) ? faqJsonLd(cats, questionFn, answerFn) : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
${head(title, desc, path, jsonLd)}
</head>
<body>
${header()}
<div class="g-hero">
  <h1>${heroTitle}</h1>
  <p>${heroDesc}</p>
</div>
<div class="g-wrap">
  <div class="g-breadcrumb"><a href="./index.html">육아정보</a> › ${heroTitle}</div>
  <div class="g-intro">${intro}</div>
  ${disclaimer ? `<div class="g-disclaimer">⚠️ ${disclaimer}</div>` : ''}
  ${pageSearchBox()}
  ${cats.map(renderCat).join('\n  ')}
  ${ctaBanner(ctaText)}
  <div class="g-nav-links">
    <a href="./pregnancy.html">🤰 임신 체크리스트</a>
    <a href="./parenting.html">👶 월령별 예방접종·건강검진</a>
    <a href="./food.html">🥣 이유식 가이드</a>
    <a href="./government-support.html">🏛️ 정부지원금</a>
  </div>
</div>
${footer()}
</body>
</html>
`;
}

/* ── 1. 임신 가이드 ── */
const pregHtml = page({
  title: '임신 주차별 체크리스트 총정리 (4주~40주) | 맘캘 육아정보',
  desc: '임신 4주부터 40주까지 산부인과 검사, 영양제, 출산 준비물을 주차별로 정리했어요. 엽산·철분 복용 시기부터 기형아 검사 일정까지 한눈에 확인하세요.',
  path: '/guide/pregnancy.html',
  heroTitle: '🤰 임신 주차별 체크리스트',
  heroDesc: '4주부터 40주까지, 꼭 챙겨야 할 검사·영양제·준비물을 주차별로 정리했어요',
  intro: '임신을 확인한 순간부터 출산까지, 시기별로 꼭 챙겨야 할 것들이 계속 바뀌어요. 아래는 임신 4주부터 40주까지, 그리고 출산 준비물까지 주차별로 정리한 체크리스트예요. 맘캘 앱에 등록하면 이 일정들이 자동으로 캘린더에 채워지고, 체크할 때마다 진행률도 확인할 수 있어요.',
  cats: clData.preg,
  ctaText: '이 일정, 캘린더에 자동으로 채워드릴까요?',
  disclaimer: '이 페이지의 의학·영양 정보는 일반적인 참고용 요약이며, 병원의 공식 안내를 대체하지 않습니다. 개인 건강 상태에 따라 다를 수 있으니 담당 산부인과와 상담해주세요.',
  questionFn: (it) => `${it.t}, 언제 어떻게 해야 하나요?`,
  answerFn:   (it) => it.dd || it.d || it.t,
});

/* ── 2. 육아(예방접종·건강검진) 가이드 ── */
const parentingHtml = page({
  title: '월령별 예방접종 · 국가건강검진 완벽 가이드 (0~5세) | 맘캘 육아정보',
  desc: 'DTaP, MMR, 폐구균 등 국가필수예방접종을 월령별로 정리했어요. 각 백신이 무엇을 예방하는지, 총 몇 차수를 언제 맞아야 하는지, 국가건강검진 일정까지 한눈에 확인하세요.',
  path: '/guide/parenting.html',
  heroTitle: '👶 월령별 예방접종 · 건강검진 가이드',
  heroDesc: '0개월부터 5세까지, 예방접종 차수·간격과 국가건강검진 일정을 정리했어요',
  intro: '신생아부터 5세까지 맞아야 하는 예방접종은 종류도 많고 차수도 헷갈리기 쉬워요. 아래는 월령별로 정리한 예방접종·건강검진·발달 체크 가이드예요. 각 백신이 무엇을 예방하는지, 총 몇 차수인지, 다음 접종까지 간격이 얼마나 되는지 자세히 적어뒀어요. 맘캘 앱에서는 실제 접종한 날짜를 입력하면 이후 회차 일정이 자동으로 재계산돼요.',
  cats: clData.born,
  ctaText: '우리 아이 접종 일정, 자동으로 계산해드릴까요?',
  disclaimer: '이 페이지의 예방접종·발달 정보는 일반적인 참고용 요약이며, 병원의 공식 안내를 대체하지 않습니다. 정확한 접종 일정과 개별 건강 상태는 반드시 소아과와 상담해주세요.',
  questionFn: (it) => `${it.t}, 언제 어떻게 해야 하나요?`,
  answerFn:   (it) => it.dd || it.d || it.t,
});

/* ── 3. 이유식 가이드 ── */
const foodHtml = page({
  title: '이유식 단계별 시작 가이드 (초기~유아식) | 맘캘 육아정보',
  desc: '쌀미음부터 유아식까지, 이유식을 단계별로 언제 어떻게 시작해야 하는지 정리했어요. 재료별 효과, 알레르기 체크 방법, 소금·설탕 없이 조리하는 법까지 확인하세요.',
  path: '/guide/food.html',
  heroTitle: '🥣 이유식 단계별 시작 가이드',
  heroDesc: '6개월 쌀미음부터 24개월 유아식까지, 재료 효과와 조리 팁을 정리했어요',
  intro: '이유식은 언제 시작해야 할지, 어떤 재료부터 줘야 할지 막막하기 쉬워요. 아래는 생후 6개월 초기 이유식부터 24개월 유아식까지, 단계별로 정리한 가이드예요. 재료마다 어떤 효과가 있는지, 알레르기는 어떻게 확인해야 하는지도 함께 적어뒀어요.',
  cats: clData.food,
  ctaText: '이유식 진행 상황, 체크리스트로 관리해보세요',
  disclaimer: '이 페이지의 이유식·영양 정보는 일반적인 참고용 요약입니다. 아이마다 알레르기·소화 상태가 다르니, 새로운 재료를 시작할 때는 소아과 상담을 권장합니다.',
  questionFn: (it) => `${it.t}, 어떻게 하나요?`,
  answerFn:   (it) => it.dd || it.d || it.t,
});

/* ── 4. 정부지원금 가이드 ── */
const govHtml = page({
  title: '임신·출산·육아 정부지원금 총정리 | 맘캘 육아정보',
  desc: '국민행복카드, 부모급여, 아동수당, 첫만남이용권 등 임신부터 육아까지 받을 수 있는 정부지원 제도를 시기별로 정리했어요. 신청 마감 기한까지 한눈에 확인하세요.',
  path: '/guide/government-support.html',
  heroTitle: '🏛️ 정부지원금 가이드',
  heroDesc: '임신 중부터 육아 중까지, 시기별로 받을 수 있는 지원 제도를 정리했어요',
  intro: '정부지원 제도는 신청 기한을 놓치면 못 받는 경우가 많아 미리 알아두는 게 중요해요. 아래는 임신 중, 출산 직후, 육아 중 시기별로 정리한 정부지원 제도예요. 맘캘 앱에 등록하면 이 일정들이 자동으로 캘린더에 채워지고, 신청 마감을 놓치지 않도록 확인할 수 있어요.',
  cats: govCats,
  ctaText: '지원금 신청 마감, 놓치지 않게 캘린더로 관리해보세요',
  disclaimer: '제도명·지원 대상·금액·마감 기한은 매년 바뀔 수 있습니다. 이 페이지는 신청 시기를 놓치지 않기 위한 참고용 안내이며, 정확한 자격 요건과 금액은 반드시 링크된 기관 홈페이지 또는 주민센터에서 다시 확인해주세요.',
  renderCat: renderGovSection,
  questionFn: (it) => `${it.title}, 어떻게 신청하나요?`,
  answerFn:   (it) => it.desc + (it.deadlineNote ? ` (${it.deadlineNote})` : ''),
});

/**
 * 허브 페이지 전체 검색창 (Sprint 21)
 * - buildSearchIndex()로 만든 153개 항목 인덱스를 페이지에 JSON으로 심어두고,
 *   입력할 때마다 제목·설명에 텍스트가 포함되는 항목을 찾아 해당 페이지의 항목 위치(#id)로 링크한다
 * - 별도 서버·API 호출 없이 정적 페이지 안에서만 동작 (fetch 불필요 → file:// 미리보기에서도 동작)
 */
function hubSearchBox() {
  return `<div class="g-search g-search-hub">
    <input type="search" id="hubSearch" class="g-search-input"
           placeholder="🔍 궁금한 것을 검색해보세요 (예: 엽산, DTaP, 부모급여)"
           oninput="filterHubSearch(this.value)">
    <div id="hubSearchResults" class="g-search-results"></div>
  </div>
  <script id="guideSearchIndex" type="application/json">${JSON.stringify(searchIndex)}</script>
  <script>
    (function() {
      var indexData = [];
      try {
        var raw = document.getElementById('guideSearchIndex');
        indexData = raw ? JSON.parse(raw.textContent) : [];
      } catch (e) {}

      function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      window.filterHubSearch = function(q) {
        var box = document.getElementById('hubSearchResults');
        q = q.trim().toLowerCase();
        if (!q) { box.className = 'g-search-results'; box.innerHTML = ''; return; }
        var matched = indexData.filter(function(it) {
          return (it.title + ' ' + it.desc).toLowerCase().indexOf(q) !== -1;
        }).slice(0, 20);
        box.className = 'g-search-results show';
        if (!matched.length) {
          box.innerHTML = '<div class="g-search-empty">검색 결과가 없어요 🔍</div>';
          return;
        }
        box.innerHTML = matched.map(function(it) {
          return '<a class="g-search-item" href="./' + it.page + '#' + it.id + '">' +
            '<span class="g-search-item-title">' + escapeHtml(it.title) + '</span>' +
            '<span class="g-search-item-cat">' + escapeHtml(it.cat) + '</span>' +
            '</a>';
        }).join('');
      };
    })();
  </script>`;
}

/* ── 5. 허브 페이지 ── */
function countItems(cats) { return cats.reduce((sum, c) => sum + c.items.length, 0); }

const hubHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
${head(
  '맘캘 육아정보 — 임신부터 이유식까지 | 맘캘 MomCal',
  '임신 주차별 체크리스트, 월령별 예방접종·건강검진, 이유식 단계별 가이드를 무료로 확인하세요. 맘캘이 정리한 육아 정보를 로그인 없이 바로 볼 수 있어요.',
  '/guide/index.html'
)}
</head>
<body>
${header()}
<div class="g-hero">
  <h1>💕 맘캘 육아정보</h1>
  <p>임신부터 육아까지, 꼭 필요한 정보만 모았어요. 로그인 없이 누구나 볼 수 있어요.</p>
</div>
<div class="g-wrap">
  <div class="g-intro">
    맘캘은 임신·출산·육아 일정을 관리하는 앱이에요. 이 페이지들은 맘캘 앱의 체크리스트에 담긴
    정보를 로그인 없이도 누구나 볼 수 있도록 정리한 육아 정보 모음입니다.
  </div>
  ${hubSearchBox()}
  <div class="g-card-grid">
    <a class="g-cat-card" href="./pregnancy.html">
      <div class="ico">🤰</div>
      <h2>임신 주차별 체크리스트</h2>
      <p>4주~40주 검사·영양제·준비물 (${countItems(clData.preg)}개 항목)</p>
    </a>
    <a class="g-cat-card" href="./parenting.html">
      <div class="ico">👶</div>
      <h2>월령별 예방접종·건강검진</h2>
      <p>0~5세 접종 일정과 발달 체크 (${countItems(clData.born)}개 항목)</p>
    </a>
    <a class="g-cat-card" href="./food.html">
      <div class="ico">🥣</div>
      <h2>이유식 단계별 가이드</h2>
      <p>초기~유아식 재료·조리법 (${countItems(clData.food)}개 항목)</p>
    </a>
    <a class="g-cat-card" href="./government-support.html">
      <div class="ico">🏛️</div>
      <h2>정부지원금 가이드</h2>
      <p>임신~육아 시기별 지원 제도 (${countItems(govCats)}개 항목)</p>
    </a>
  </div>
  ${ctaBanner('이 모든 정보, 우리 아이 일정에 맞춰 자동으로 관리해보세요')}
</div>
${footer()}
</body>
</html>
`;

/* ── 파일 쓰기 ── */
writeFileSync(join(GUIDE, 'pregnancy.html'), pregHtml);
writeFileSync(join(GUIDE, 'parenting.html'), parentingHtml);
writeFileSync(join(GUIDE, 'food.html'), foodHtml);
writeFileSync(join(GUIDE, 'government-support.html'), govHtml);
writeFileSync(join(GUIDE, 'index.html'), hubHtml);

console.log('✅ guide 페이지 생성 완료');
console.log('  - guide/index.html');
console.log('  - guide/pregnancy.html          (', countItems(clData.preg), '개 항목)');
console.log('  - guide/parenting.html         (', countItems(clData.born), '개 항목)');
console.log('  - guide/food.html               (', countItems(clData.food), '개 항목)');
console.log('  - guide/government-support.html (', countItems(govCats), '개 항목)');
