/**
 * js/ui.js
 * 홈 화면, 등록 기능, 네비게이션
 */

import { S, debounceSave, selectChild } from './state.js';
import { ageFmt, ageD, today, icon, avatarDisplay, avatarToken, escapeHtml } from './utils.js';
import { showModal }             from './modal.js';
import { getAllEvs }             from './calendar.js';
import { getTodayCategoryInfo }  from './checklist.js';
import { getLatestGrowth }       from './growth.js';
import { getDailyTip }           from '../data/tips.js';
import { renderPwaInstallLink }  from './pwaInstall.js';
import { renderFamilyShareLink } from './familyShare.js';
import { renderNotificationSettings } from './notifications.js';
import { renderThemeSettings }   from './theme.js';
import { renderFontSizeSettings } from './fontSize.js';
import { renderCalFontSizeSettings } from './calFontSize.js';
import { renderChecklistSettings } from './checklistSettings.js'; // v0.0.40: 체크리스트 표시/캘린더 연동/커스텀 만들기
import { renderAdSlot }          from './adSlot.js';
import { renderHomeWeek }        from './homeWeekWidget.js'; // v0.0.45: 홈 화면 간소화 주간 캘린더
import { recordTabVisit }        from './backButton.js'; // v0.4.6: 뒤로가기 = 이전 탭 이동

/* ════════════════════════════════════
 *  네비게이션
 * ════════════════════════════════════ */

/**
 * 페이지 전환
 * @param {string} id  - 'home' | 'register' | 'calendar' | 'checklist' | 'growth' | 'settings'
 * @param {Element} btn - 클릭된 nav 버튼
 */
export function gp(id, btn) {
  recordTabVisit(id); // v0.4.6: 뒤로가기 히스토리에 이 이동을 기록(자세한 내용은 js/backButton.js)
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-' + id).classList.add('on');
  document.querySelectorAll('.np').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');

  // 페이지별 초기 렌더 (동적 import를 피하기 위해 window 함수 호출)
  const pageRender = {
    home:      () => renderHome(),
    calendar:  () => { window.renderCal(); window.renderStickerPicker(); },
    checklist: () => window.renderChecklist(),
    growth:    () => window.renderGrowthPage(),
    register:  () => renderRegList(),
    settings:  () => renderSettings(), // v0.0.5: 설정 탭 신규
  };
  pageRender[id]?.();
}

/* ════════════════════════════════════
 *  설정 탭 (v0.0.5)
 *  기존 홈 화면 "더 편하게 쓰기" 항목(가족 공유·알림)과 다크 모드를 여기로 모음.
 *  "어플로 추가"는 사용자 요청으로 홈 화면에 그대로 남겨둠(pwaInstall.js 참고)
 * ════════════════════════════════════ */
export function renderSettings() {
  renderThemeSettings();
  renderFontSizeSettings();
  renderCalFontSizeSettings();
  renderFamilyShareLink();
  renderNotificationSettings(); // v0.0.42: 로컬 알림 + 진짜 푸시(FCM)를 하나의 카드로 통합
  renderChecklistSettings(); // v0.0.40
}

/* ════════════════════════════════════
 *  홈 화면
 * ════════════════════════════════════ */
export function renderHome() {
  renderHomeWeek(); // v0.0.45: 이번 주 간소화 캘린더
  renderDashboard();

  // 프로필 카드
  const ps = document.getElementById('homeProfiles');
  ps.innerHTML = S.children.map((c, i) => `
    <div class="pcard ${i == S.selC ? 'sel' : ''}" onclick="selectChild(${i});renderHome()">
      <div class="pav">${avatarDisplay(c.avatar, '1.9rem')}</div>
      <div class="pnm">${escapeHtml(c.name)}</div>
      <div class="pag">${c.stage === 'preg' ? `<span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> ${c.week}주차` : ageFmt(c.birth)}</div>
      <span class="pst ${c.stage === 'preg' ? 'st-preg' : 'st-born'}">${c.stage === 'preg' ? '임신중' : '육아중'}</span>
    </div>`
  ).join('') + `<div class="add-pcard" onclick="gp('register',document.querySelector('.np[data-page=register]'))"><span>＋</span><p>등록하기</p></div>`;

  // 홈 화면 추가(PWA 설치) 링크 — v0.0.5: 이것만 홈에 남기고 나머지는 설정 탭으로 이동
  renderPwaInstallLink();
}

/* ════════════════════════════════════
 *  홈 대시보드 (Sprint 4)
 *  오늘 상태를 한눈에: 아이 나이·다음 일정·체크리스트·성장·최근 접종·육아 팁
 * ════════════════════════════════════ */
export function renderDashboard() {
  const el = document.getElementById('dashGrid');
  if (!el) return;

  renderAdSlot('adSlotHome', 'home'); // 대시보드 하단 — 아이 등록 여부와 무관하게 항상 표시

  const child = S.children[S.selC];
  if (!child) {
    el.innerHTML = `
      <div class="dash-card dash-empty" onclick="gp('register',document.querySelector('.np[data-page=register]'))">
        <div class="dash-icon" style="background:var(--gray-100)"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span></div>
        <div class="dash-label">아직 등록된 아이가 없어요</div>
        <div class="dash-value" style="font-size:.78rem;color:var(--pk)">＋ 지금 등록하기</div>
      </div>`;
    return;
  }

  el.innerHTML = [
    dashAgeCard(child),
    dashNextEventCard(child),
    // v0.0.16: "체크리스트가 '오늘' 카드 옆이 아니라 원래처럼 아래에 오면 좋겠다"는 요청으로
    // v0.0.8에서 바꿨던 "오늘"+"체크리스트" 나란히 배치를 되돌림 — 순서만 원래(Sprint 4)대로
    // 복원하면 데스크톱 2열 그리드에서도, 모바일의 "첫 두 카드만 나란히" 규칙에서도
    // 체크리스트가 자연스럽게 둘째 줄(아래)에 위치하게 됨(css/main.css .dash-grid 참고)
    dashChecklistCard(child),
    dashGrowthCard(child),
    // v0.0.16: "최근 접종" 카드는 사용자 요청으로 제거함
    dashTipCard(),
  ].join('');
}

/** 오늘 며칠째 / 몇 주차 */
function dashAgeCard(child) {
  if (child.stage === 'preg') {
    const week = parseInt(child.week) || 0;
    const left = Math.max(0, 40 - week);
    return dashCard('pregnant_woman', '임신 주차', `${week}주차`, `출산까지 약 ${left}주`);
  }
  const d = ageD(child.birth);
  const m = Math.floor(d / 30.44);
  return dashCard('child_care', `${escapeHtml(child.name)} 오늘`, `${d}일째`, m >= 1 ? `${m}개월` : '신생아');
}

/** 다음 일정 */
function dashNextEventCard(child) {
  const todayStr = today();
  const upcoming = getAllEvs()
    .filter(e => e.date >= todayStr && !e.done)
    .sort((a, b) => a.date < b.date ? -1 : 1)[0];

  if (!upcoming) {
    return dashCard('calendar_month', '다음 일정', '예정된 일정 없음', '캘린더에서 추가해보세요', "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
  }
  const days = Math.round((new Date(upcoming.date) - new Date(todayStr)) / 86400000);
  const dLabel = days === 0 ? '오늘' : `${days}일 후`;
  return dashCard('calendar_month', '다음 일정', upcoming.title.replace(/^\d{2}:\d{2}(~\d{2}:\d{2})?\s/, ''), dLabel, "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
}

/**
 * 오늘 체크리스트 진행
 * v0.0.15: 기존엔 "N / N 완료"로 필수+선택을 합쳐서 한 줄로만 보여줬는데,
 * 필수만 봐도 되는지 헷갈린다는 피드백으로 "필수" / "전체" 수치를 나눠서 표시.
 * v0.0.16: 처음엔 두 줄로 나눴는데, "전체" 수치를 "필수" 수치 오른쪽으로 옮겨 한 줄로
 * 합쳐달라는 요청으로 변경(길면 카드 폭에서 말줄임표로 잘릴 수 있음, 옹짐꾼님 확인).
 * 배지(Perfect/Master/Legend)는 그 아래 작은 칩으로 별도 표시 — 기존엔 Perfect는 배지
 * 축에서 빠졌었는데, 필수만 다 채워도 성취감을 주는 게 낫다는 피드백으로 Perfect 배지도 추가함.
 * v0.0.20: 배지 이모지(🏅👑🌈)를 아이콘으로 교체 — 등급 구분은 배지 배경색(금/보라/무지개
 * 그라디언트)으로 유지하되(정보 전달용 색상 예외, docs/UI_GUIDELINE.md 참고), 글자는 아이콘+텍스트로
 */
function dashChecklistCard(child) {
  const info = getTodayCategoryInfo(child);
  const onclick = "gp('checklist',document.querySelector('.np[data-page=checklist]'))";
  if (!info) {
    return dashCard('checklist', '체크리스트', '-', '', onclick);
  }
  const { tier, reqDone, reqTotal, doneTotal, itemsTotal } = info;

  const BADGE = {
    perfect: { cls: 'dash-badge-mini-perfect', iconName: 'verified',          label: 'Perfect' },
    master:  { cls: 'dash-badge-mini-master',  iconName: 'workspace_premium', label: 'Master' },
    legend:  { cls: 'dash-badge-mini-legend',  iconName: 'emoji_events',      label: 'Legend' },
  };
  const badge = BADGE[tier];

  return `
    <div class="dash-card" onclick="${onclick}">
      <div class="dash-icon">${icon('checklist')}</div>
      <div class="dash-body">
        <div class="dash-label">${info.cat.label}</div>
        <div class="dash-value">${reqDone} / ${reqTotal} 완료(필수) <span class="dash-sub-inline">${doneTotal} / ${itemsTotal} 완료(전체)</span></div>
        ${badge ? `<div class="dash-badge-mini ${badge.cls}">${icon(badge.iconName, { size: 'sm' })} ${badge.label}</div>` : ''}
      </div>
    </div>`;
}

/** 성장 기록 (+ Sprint 11: 30일 이상 기록 없으면 리마인더) */
function dashGrowthCard(child) {
  const { latest, prev } = getLatestGrowth(child.id);
  const isPreg = child.stage === 'preg';
  const label = isPreg ? '태아 기록' : '성장 기록';

  if (!latest) {
    return dashCard('trending_up', label, '아직 기록 없어요', '탭해서 첫 기록 남기기', 'openGrowthModal()');
  }

  const daysSince = Math.floor((new Date(today()) - new Date(latest.date)) / 86400000);
  if (daysSince >= 30) {
    return dashCard('trending_up', label, `마지막 기록 ${daysSince}일 전`, '탭해서 새 기록 남기기', 'openGrowthModal()');
  }

  if (isPreg) {
    const parts = [];
    if (latest.weight != null) {
      const d = prev?.weight != null ? latest.weight - prev.weight : null;
      parts.push(`체중 ${latest.weight}g${d != null ? ` (${d >= 0 ? '+' : ''}${d})` : ''}`);
    }
    if (latest.height != null) {
      const d = prev?.height != null ? latest.height - prev.height : null;
      parts.push(`길이 ${latest.height}cm${d != null ? ` (${d >= 0 ? '+' : ''}${d.toFixed(1)})` : ''}`);
    }
    const sub = latest.week != null ? `임신 ${latest.week}주차` : `${latest.date} 기록`;
    return dashCard('trending_up', label, parts[0] || '-', parts[1] ? `${parts[1]} · ${sub}` : sub, 'openGrowthModal()');
  }

  const parts = [];
  if (latest.height != null) {
    const d = prev?.height != null ? latest.height - prev.height : null;
    parts.push(`키 ${latest.height}cm${d != null ? ` (${d >= 0 ? '+' : ''}${d.toFixed(1)})` : ''}`);
  }
  if (latest.weight != null) {
    const d = prev?.weight != null ? latest.weight - prev.weight : null;
    parts.push(`몸무게 ${latest.weight}kg${d != null ? ` (${d >= 0 ? '+' : ''}${d.toFixed(1)})` : ''}`);
  }
  return dashCard('trending_up', label, parts[0] || '-', parts[1] || `${latest.date} 기록`, 'openGrowthModal()');
}

/** 오늘의 육아 팁 */
function dashTipCard() {
  return dashCard('lightbulb', '오늘의 육아 팁', getDailyTip(), '', '', true);
}

/**
 * 대시보드 카드 공통 HTML
 * v0.0.20: 아이콘 배경을 카드마다 다른 파스텔 색(var(--pul)/var(--bll)/var(--yll) 등)으로
 * 칠하던 방식에서 벗어나, 중립 그레이(var(--gray-100)) + 핑크 아이콘으로 통일함 — "카드마다
 * 다른 색 사각형"이 흔한 AI 생성 대시보드 패턴이라, 단일 액센트로 차분하게 정리(docs/UI_GUIDELINE.md 참고)
 */
function dashCard(iconName, label, value, sub, onclick, isTip) {
  return `
    <div class="dash-card${isTip ? ' dash-tip' : ''}" ${onclick ? `onclick="${onclick}"` : ''}>
      <div class="dash-icon">${icon(iconName)}</div>
      <div class="dash-body">
        <div class="dash-label">${label}</div>
        <div class="dash-value${isTip ? ' dash-tip-text' : ''}">${value}</div>
        ${sub ? `<div class="dash-sub">${sub}</div>` : ''}
      </div>
    </div>`;
}

/* ════════════════════════════════════
 *  아이 등록
 * ════════════════════════════════════ */

/** 임신/출산 스테이지 전환 */
export function setRStage(s, btn) {
  S.rStage = s;
  document.querySelectorAll('.st-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('rBornWrap').style.display = s === 'born' ? 'block' : 'none';
  document.getElementById('rPregWrap').style.display = s === 'preg' ? 'block' : 'none';
}

/** 성별 선택 */
export function sg(g) {
  S.gender = g;
  ['m', 'f', 'u'].forEach(x => document.getElementById('g' + x)?.classList.toggle('on', x === g));
}

/** 아이 등록 */
export function regChild() {
  const name = document.getElementById('rName').value.trim();
  if (!name) { alert('이름을 입력해주세요'); return; }

  const birth = S.rStage === 'born' ? document.getElementById('rBirth').value : '';
  const due   = S.rStage === 'preg' ? document.getElementById('rDue').value   : '';
  const week  = parseInt(document.getElementById('rWeek')?.value) || 8;

  if (S.rStage === 'born' && !birth) { alert('생년월일을 입력해주세요'); return; }

  // v0.0.53: 순수 이모지 대신 이미지 토큰 저장(avatarToken) — 렌더링 시 avatarDisplay()가 <img>로 바꿔줌
  S.children.push({ name, gender: S.gender, stage: S.rStage, birth, due, week, avatar: avatarToken(S.gender), id: Date.now() });
  S.selC = S.children.length - 1;
  document.getElementById('rName').value = '';

  renderRegList();
  renderHome();
  debounceSave();
  showModal('등록 완료!', `
    <p style="line-height:2;font-size:.9rem">
      <b>${name}</b> 등록 완료! <span class="icon icon-sm" translate="no" aria-hidden="true">celebration</span><br>
      캘린더에 일정이 자동으로 채워졌어요!<br>
      <span style="font-size:.78rem;color:var(--txl)">Firebase에 자동 저장돼요 <span class="icon icon-sm" translate="no" aria-hidden="true">save</span></span>
    </p><br>
    <button class="btn bpk" onclick="cm();gp('calendar',document.querySelector('.np[data-page=calendar]'))">캘린더 보러가기 →</button>`
  );
}

/** 등록 목록 렌더 */
export function renderRegList() {
  const el = document.getElementById('regList');
  if (!S.children.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="margin-top:4px">
      <div class="sec" style="font-size:.8rem">등록 목록</div>
      ${S.children.map((c, i) => `
        <div class="reg-list-item">
          <span style="font-size:1.35rem">${avatarDisplay(c.avatar, '1.35rem')}</span>
          <div style="flex:1">
            <b style="font-size:.88rem">${c.name}</b>
            <div style="font-size:.72rem;color:var(--txl);margin-top:2px">
              ${c.stage === 'preg' ? `<span class="icon icon-sm" translate="no" aria-hidden="true">pregnant_woman</span> 임신 ${c.week}주 · 예정일 ${c.due || '미정'}` : ageFmt(c.birth)}
            </div>
          </div>
          <button onclick="deleteChild(${i})"
                  style="background:none;border:none;cursor:pointer;color:var(--txl);font-size:.9rem"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span></button>
        </div>`).join('')}
    </div>`;
}

/** 아이 삭제 */
export function deleteChild(i) {
  S.children.splice(i, 1);
  if (S.selC >= S.children.length) S.selC = Math.max(0, S.children.length - 1);
  renderRegList();
  renderHome();
  debounceSave();
}

// window 노출
window.gp               = gp;
window.renderHome       = renderHome;
window.renderDashboard  = renderDashboard;
window.setRStage   = setRStage;
window.sg          = sg;
window.regChild    = regChild;
window.renderRegList = renderRegList;
window.deleteChild = deleteChild;
