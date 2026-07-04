/**
 * js/govSupport.js — Sprint 6
 * 체크리스트 페이지의 "🟢 정부지원" 탭 렌더링
 *
 * 정부지원 일정은 캘린더의 자동 이벤트(type:'gov')와 완전히 동일한 데이터입니다.
 * 상태 변경(신청 전/신청 완료/지급 완료)은 캘린더의 일정 수정 Modal(openEvModal)을
 * 그대로 재사용하므로, 여기서 상태를 바꾸면 캘린더 화면에도 즉시 반영됩니다 (S.eventMods 공유).
 */

import { S }                      from './state.js';
import { getAllEvs, openEvModal, isGovDeadlineSoon } from './calendar.js';
import { daysUntil, stripLeadingEmoji } from './utils.js';
import { GOV_INFO_BASIS }         from '../data/government-support.js';

/** 체크리스트 페이지 내 정부지원 탭 렌더링 */
export function renderGovChecklistTab(child) {
  const sidebar = document.getElementById('clSidebar');
  const main    = document.getElementById('clMain');
  if (!sidebar || !main) return;

  sidebar.innerHTML = `
    <div class="cl-sb-hd">🟢 정부지원</div>
    <div style="padding:14px 15px;font-size:.73rem;color:var(--txl);line-height:1.7">
      임신·출산·육아 단계별 정부지원 제도를<br>놓치지 않도록 도와드려요.<br><br>
      항목을 탭하면 신청 상태를 바꿀 수 있어요.<br><br>
      <span style="color:var(--pkd);font-weight:800">📅 ${GOV_INFO_BASIS}</span><br>
      제도는 매년 바뀔 수 있으니, 정확한 금액·자격은<br>공식 사이트에서 다시 확인해주세요.
    </div>
    <div style="margin:0 15px 14px;padding:12px;background:var(--pkl);border-radius:14px">
      <div style="font-size:.68rem;font-weight:800;color:var(--pkd);margin-bottom:6px">📖 육아정보 더 알아보기</div>
      <div style="display:flex;gap:6px">
        <input type="text" id="clGuideSearchInput" placeholder="예: 부모급여, 국민행복카드"
               style="flex:1;min-width:0;padding:7px 10px;border:1.5px solid #F0D8E4;border-radius:9px;font-size:.74rem;font-family:inherit"
               onkeydown="if(event.key==='Enter')openGuideSearch()">
        <button onclick="openGuideSearch()"
                style="background:var(--pk);color:#fff;border:none;border-radius:9px;padding:0 12px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:inherit">검색</button>
      </div>
    </div>`;

  if (!child) {
    main.innerHTML = '<p style="color:var(--txl);text-align:center;padding:20px">👶 아이를 먼저 등록해주세요!</p>';
    return;
  }

  const items = getAllEvs()
    .filter(e => e.type === 'gov')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!items.length) {
    main.innerHTML = '<p style="color:var(--txl);text-align:center;padding:20px">해당하는 정부지원 일정이 없어요.</p>';
    return;
  }

  const appliedCount = items.filter(e => e.govStatus === 'applied').length;
  const paidCount    = items.filter(e => e.govStatus === 'paid').length;

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:6px">
      <h3 style="font-size:.93rem;font-weight:900;color:var(--tx)">🟢 정부지원 현황</h3>
      <span class="cl-status">신청 완료 ${appliedCount} · 지급 완료 ${paidCount} / 전체 ${items.length}</span>
    </div>
    ${items.map(e => {
      const status = e.govStatus || 'none';
      const urgent = isGovDeadlineSoon(e);
      const icon   = urgent ? '⏰' : status === 'paid' ? '✅' : status === 'applied' ? '🔵' : '🟢';
      const label  = status === 'paid' ? '지급 완료' : status === 'applied' ? '신청 완료' : '신청 전';
      const cleanTitle = stripLeadingEmoji(e.title);
      const impBadge = e.imp === 'req'
        ? '<span class="badge-r">필수</span>'
        : '<span class="badge-o">해당자</span>';
      const deadline = e.deadlineDate || e.deadlineNote;
      const dLeft = urgent ? daysUntil(e.deadlineDate) : null;
      const urgentText = dLeft === null ? '' : dLeft < 0 ? ' (마감 지남)' : dLeft === 0 ? ' (오늘 마감)' : ` (D-${dLeft})`;
      return `
        <div class="gov-cl-item${urgent ? ' gov-cl-urgent' : ''}" onclick="openEvModal(${e._idx})">
          <div class="gov-cl-icon">${icon}</div>
          <div style="flex:1;min-width:0">
            <div class="gov-cl-title">${cleanTitle} ${impBadge}${urgent ? ' <span class="badge-r">⏰ 마감임박</span>' : ''}</div>
            <div class="gov-cl-desc"${urgent ? ' style="color:#C62828;font-weight:800"' : ''}>${e.date} 권장${deadline ? ` · ⏰ 마감 ${deadline}${urgentText}` : ''}</div>
          </div>
          <span class="gov-cl-status status-${status}">${label}</span>
        </div>`;
    }).join('')}
  `;
}

window.renderGovChecklistTab = renderGovChecklistTab;
