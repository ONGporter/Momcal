/**
 * js/ui.js
 * 홈 화면, 등록 기능, 네비게이션
 */

import { S, debounceSave }       from './state.js';
import { ageFmt, ageD, today }   from './utils.js';
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
import { renderAdSlot }          from './adSlot.js';

/* ════════════════════════════════════
 *  네비게이션
 * ════════════════════════════════════ */

/**
 * 페이지 전환
 * @param {string} id  - 'home' | 'register' | 'calendar' | 'checklist' | 'growth' | 'settings'
 * @param {Element} btn - 클릭된 nav 버튼
 */
export function gp(id, btn) {
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
  renderFamilyShareLink();
  renderNotificationSettings();
}

/* ════════════════════════════════════
 *  홈 화면
 * ════════════════════════════════════ */
export function renderHome() {
  renderDashboard();

  // 프로필 카드
  const ps = document.getElementById('homeProfiles');
  ps.innerHTML = S.children.map((c, i) => `
    <div class="pcard ${i == S.selC ? 'sel' : ''}" onclick="S.selC=${i};renderHome()">
      <div class="pav">${c.avatar}</div>
      <div class="pnm">${c.name}</div>
      <div class="pag">${c.stage === 'preg' ? `🤰 ${c.week}주차` : ageFmt(c.birth)}</div>
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
        <div class="dash-icon" style="background:var(--pkl)">👶</div>
        <div class="dash-label">아직 등록된 아이가 없어요</div>
        <div class="dash-value" style="font-size:.78rem;color:var(--pk)">＋ 지금 등록하기</div>
      </div>`;
    return;
  }

  el.innerHTML = [
    dashAgeCard(child),
    dashNextEventCard(child),
    dashChecklistCard(child),
    dashGrowthCard(child),
    dashVaxCard(child),
    dashTipCard(),
  ].join('');
}

/** 👶 오늘 며칠째 / 몇 주차 */
function dashAgeCard(child) {
  if (child.stage === 'preg') {
    const week = parseInt(child.week) || 0;
    const left = Math.max(0, 40 - week);
    return dashCard('🤰', 'var(--pul)', '임신 주차', `${week}주차`, `출산까지 약 ${left}주`);
  }
  const d = ageD(child.birth);
  const m = Math.floor(d / 30.44);
  return dashCard('👶', 'var(--pkl)', `${child.name} 오늘`, `${d}일째`, m >= 1 ? `${m}개월` : '신생아');
}

/** 📅 다음 일정 */
function dashNextEventCard(child) {
  const todayStr = today();
  const upcoming = getAllEvs()
    .filter(e => e.date >= todayStr && !e.done)
    .sort((a, b) => a.date < b.date ? -1 : 1)[0];

  if (!upcoming) {
    return dashCard('📅', 'var(--bll)', '다음 일정', '예정된 일정 없음', '캘린더에서 추가해보세요', "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
  }
  const days = Math.round((new Date(upcoming.date) - new Date(todayStr)) / 86400000);
  const dLabel = days === 0 ? '오늘' : `${days}일 후`;
  return dashCard('📅', 'var(--bll)', '다음 일정', upcoming.title.replace(/^\d{2}:\d{2}\s/, ''), dLabel, "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
}

/** 📋 오늘 체크리스트 진행 */
function dashChecklistCard(child) {
  const info = getTodayCategoryInfo(child);
  if (!info) {
    return dashCard('📋', 'var(--mnl)', '체크리스트', '-', '', "gp('checklist',document.querySelector('.np[data-page=checklist]'))");
  }
  return dashCard('📋', 'var(--mnl)', info.cat.label, `${info.doneTotal} / ${info.itemsTotal} 완료`, '', "gp('checklist',document.querySelector('.np[data-page=checklist]'))");
}

/** 📈 성장 기록 (+ Sprint 11: 30일 이상 기록 없으면 리마인더) */
function dashGrowthCard(child) {
  const { latest, prev } = getLatestGrowth(child.id);
  if (!latest) {
    return dashCard('📈', 'var(--yll)', '성장 기록', '아직 기록 없어요', '탭해서 첫 기록 남기기', 'openGrowthModal()');
  }

  const daysSince = Math.floor((new Date(today()) - new Date(latest.date)) / 86400000);
  if (daysSince >= 30) {
    return dashCard('📈', 'var(--yll)', '성장 기록', `마지막 기록 ${daysSince}일 전`, '탭해서 새 기록 남기기 ✏️', 'openGrowthModal()');
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
  return dashCard('📈', 'var(--yll)', '성장 기록', parts[0] || '-', parts[1] || `${latest.date} 기록`, 'openGrowthModal()');
}

/** 💉 최근 접종 */
function dashVaxCard(child) {
  const todayStr = today();
  const recent = getAllEvs()
    .filter(e => e.type === 'vax' && e.done && e.date <= todayStr)
    .sort((a, b) => a.date > b.date ? -1 : 1)[0];

  if (!recent) {
    return dashCard('💉', 'var(--pul)', '최근 접종', '완료 기록 없음', '캘린더에서 완료 체크하기', "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
  }
  return dashCard('💉', 'var(--pul)', '최근 접종', recent.title.replace(/^💉\s*/, ''), `${recent.date} 완료`, "gp('calendar',document.querySelector('.np[data-page=calendar]'))");
}

/** ⭐ 오늘의 육아 팁 */
function dashTipCard() {
  return dashCard('⭐', 'var(--pkl)', '오늘의 육아 팁', getDailyTip(), '', '', true);
}

/** 대시보드 카드 공통 HTML */
function dashCard(icon, bg, label, value, sub, onclick, isTip) {
  return `
    <div class="dash-card${isTip ? ' dash-tip' : ''}" ${onclick ? `onclick="${onclick}"` : ''}>
      <div class="dash-icon" style="background:${bg}">${icon}</div>
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
  if (!name) { alert('이름을 입력해주세요 🥺'); return; }

  const av    = { m: '👦', f: '👧', u: '🍼' };
  const birth = S.rStage === 'born' ? document.getElementById('rBirth').value : '';
  const due   = S.rStage === 'preg' ? document.getElementById('rDue').value   : '';
  const week  = parseInt(document.getElementById('rWeek')?.value) || 8;

  if (S.rStage === 'born' && !birth) { alert('생년월일을 입력해주세요'); return; }

  S.children.push({ name, gender: S.gender, stage: S.rStage, birth, due, week, avatar: av[S.gender], id: Date.now() });
  S.selC = S.children.length - 1;
  document.getElementById('rName').value = '';

  renderRegList();
  renderHome();
  debounceSave();
  showModal('🎉 등록 완료!', `
    <p style="line-height:2;font-size:.9rem">
      <b>${name}</b> 등록 완료! 🎉<br>
      캘린더에 일정이 자동으로 채워졌어요!<br>
      <span style="font-size:.78rem;color:var(--txl)">Firebase에 자동 저장돼요 💾</span>
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
          <span style="font-size:1.35rem">${c.avatar}</span>
          <div style="flex:1">
            <b style="font-size:.88rem">${c.name}</b>
            <div style="font-size:.72rem;color:var(--txl);margin-top:2px">
              ${c.stage === 'preg' ? `🤰 임신 ${c.week}주 · 예정일 ${c.due || '미정'}` : ageFmt(c.birth)}
            </div>
          </div>
          <button onclick="deleteChild(${i})"
                  style="background:none;border:none;cursor:pointer;color:var(--txl);font-size:.9rem">🗑</button>
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
