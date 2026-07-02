/**
 * js/adSlot.js
 * 광고 슬롯 컴포넌트 (Sprint 13)
 *
 * 지금은 Google AdSense를 연결하지 않은 상태 — 아래 fallback 콘텐츠(육아 팁)가
 * 대신 표시된다. 나중에 AdSense 심사가 끝나면:
 *   1) AD_ENABLED = true 로 변경
 *   2) AD_CLIENT 에 발급받은 퍼블리셔 ID(ca-pub-XXXXXXXXXXXXXXXX) 입력
 *   3) AD_SLOTS 의 각 자리(home/checklist/growth)에 슬롯 ID 입력
 *   4) index.html <head>에 AdSense 스크립트 태그 한 줄 추가
 *      (<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>)
 * 그러면 코드 구조 변경 없이 바로 광고가 노출된다.
 */

import { getDailyTip } from '../data/tips.js';

/* ── AdSense 연동 설정 (연동 전까지는 건드릴 필요 없음) ── */
const AD_ENABLED = false;
const AD_CLIENT  = ''; // 예: 'ca-pub-1234567890123456'
const AD_SLOTS   = {
  home:      '', // 홈 대시보드 하단
  checklist: '', // 체크리스트 하단
  growth:    '', // 성장 페이지 하단
};

/** 광고 미연동 시 자리 대신 보여줄 육아 팁 — 홈 대시보드의 "오늘의 팁" 카드와
 *  겹치지 않도록 배치마다 다른 offset으로 날짜 순환 팁을 가져온다. */
const FALLBACK_OFFSET = { home: 5, checklist: 9, growth: 13 };

const FALLBACK_LABEL = {
  home:      '💡 오늘의 육아 팁',
  checklist: '💡 체크리스트 활용 팁',
  growth:    '💡 성장 기록 팁',
};

/**
 * 광고 슬롯 렌더 — containerId 요소 내부를 채운다.
 * @param {string} containerId - 광고를 표시할 DOM 요소 id
 * @param {'home'|'checklist'|'growth'} placement - 광고 배치 위치
 */
export function renderAdSlot(containerId, placement) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (AD_ENABLED && AD_CLIENT && AD_SLOTS[placement]) {
    el.innerHTML = `
      <div class="ad-slot">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="${AD_CLIENT}"
             data-ad-slot="${AD_SLOTS[placement]}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>`;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense 스크립트가 아직 로드되지 않은 경우 등 — 무시하고 다음 렌더에서 재시도
    }
    return;
  }

  // 광고 미연동 — 육아 팁으로 대체 표시 (빈 공간 방지)
  const tip = getDailyTip(FALLBACK_OFFSET[placement] ?? 0);
  el.innerHTML = `
    <div class="ad-slot ad-fallback">
      <span class="ad-fallback-ico">💡</span>
      <div class="ad-fallback-body">
        <div class="ad-fallback-label">${FALLBACK_LABEL[placement] ?? '💡 육아 팁'}</div>
        <div class="ad-fallback-text">${tip}</div>
      </div>
    </div>`;
}

window.renderAdSlot = renderAdSlot;
