/**
 * js/ui.js
 * 홈 화면, 등록 기능, 네비게이션
 */

import { S, debounceSave } from './state.js';
import { ageFmt }          from './utils.js';
import { showModal }       from './modal.js';
import { getAutoEvs }      from './calendar.js';
import { today }           from './utils.js';

/* ════════════════════════════════════
 *  네비게이션
 * ════════════════════════════════════ */

/**
 * 페이지 전환
 * @param {string} id  - 'home' | 'register' | 'calendar' | 'checklist'
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
    register:  () => renderRegList(),
  };
  pageRender[id]?.();
}

/* ════════════════════════════════════
 *  홈 화면
 * ════════════════════════════════════ */
export function renderHome() {
  // 프로필 카드
  const ps = document.getElementById('homeProfiles');
  ps.innerHTML = S.children.map((c, i) => `
    <div class="pcard ${i == S.selC ? 'sel' : ''}" onclick="S.selC=${i};renderHome()">
      <div class="pav">${c.avatar}</div>
      <div class="pnm">${c.name}</div>
      <div class="pag">${c.stage === 'preg' ? `🤰 ${c.week}주차` : ageFmt(c.birth)}</div>
      <span class="pst ${c.stage === 'preg' ? 'st-preg' : 'st-born'}">${c.stage === 'preg' ? '임신중' : '육아중'}</span>
    </div>`
  ).join('') + `<div class="add-pcard" onclick="gp('register',document.querySelectorAll('.np')[1])"><span>＋</span><p>등록하기</p></div>`;

  // 오늘 일정
  const te = document.getElementById('homeTodayEvs');
  if (!S.children.length) {
    te.innerHTML = '<p style="color:var(--txl);font-size:.84rem;text-align:center;padding:12px">아이를 등록하면 오늘 일정이 나타나요!</p>';
    return;
  }
  const todayStr = today();
  const evs = getAutoEvs(S.children[S.selC]).filter(e => e.date === todayStr).slice(0, 5);
  te.innerHTML = evs.length
    ? evs.map(e => {
        const bg  = e.type === 'req' ? '#FFF0F5' : e.type === 'rec' ? '#E0F2F1' : e.type === 'vax' ? '#EDE7F6' : '#E3F2FD';
        const dc  = e.type === 'req' ? '#F06292' : e.type === 'rec' ? '#4DB6AC' : e.type === 'vax' ? '#9575CD' : '#64B5F6';
        const lbl = e.type === 'req' ? '★필수'  : e.type === 'rec' ? '추천'    : e.type === 'vax' ? '접종'    : '일정';
        return `<div class="today-ev" style="background:${bg}">
                  <div class="tev-dot" style="background:${dc}"></div>
                  <div class="tev-text">${e.title}</div>
                  <span class="tev-badge" style="background:${dc}">${lbl}</span>
                </div>`;
      }).join('')
    : '<p style="color:var(--txl);font-size:.84rem;text-align:center;padding:12px">오늘은 등록된 일정이 없어요 🌟</p>';
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
      <b>${name}</b> 등록 완료! 💕<br>
      캘린더에 일정이 자동으로 채워졌어요!<br>
      <span style="font-size:.78rem;color:var(--txl)">Firebase에 자동 저장돼요 💾</span>
    </p><br>
    <button class="btn bpk" onclick="cm();gp('calendar',document.querySelectorAll('.np')[2])">캘린더 보러가기 →</button>`
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
window.gp          = gp;
window.renderHome  = renderHome;
window.setRStage   = setRStage;
window.sg          = sg;
window.regChild    = regChild;
window.renderRegList = renderRegList;
window.deleteChild = deleteChild;
