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
import { daysUntil, stripLeadingEmoji, icon, escapeHtml } from './utils.js';
import { GOV_INFO_BASIS }         from '../data/government-support.js';
import { guideSearchBoxHtml }     from './checklist.js';

/** 체크리스트 페이지 내 정부지원 탭 렌더링 */
export function renderGovChecklistTab(child) {
  const sidebar = document.getElementById('clSidebar');
  const main    = document.getElementById('clMain');
  if (!sidebar || !main) return;

  sidebar.innerHTML = `
    <div class="cl-sb-hd">${icon('account_balance', { size: 'sm' })} 정부지원</div>
    <div style="padding:14px 15px;font-size:.73rem;color:var(--txl);line-height:1.7">
      임신·출산·육아 단계별 정부지원 제도를 놓치지 않도록 도와드려요.<br><br>
      항목을 탭하면 신청 상태를 바꿀 수 있어요.<br><br>
      <span style="color:var(--pkd);font-weight:800">${icon('event', { size: 'sm' })} ${GOV_INFO_BASIS}</span><br>
      제도는 매년 바뀔 수 있으니, 정확한 금액·자격은 공식 사이트에서 다시 확인해주세요.
    </div>
    ${guideSearchBoxHtml('예: 부모급여, 국민행복카드')}`;

  if (!child) {
    main.innerHTML = `<p style="color:var(--txl);text-align:center;padding:20px">${icon('child_care', { size: 'sm' })} 아이를 먼저 등록해주세요!</p>`;
    return;
  }

  // v0.2.4: 지자체별 지원금처럼 앱에 없는 정부지원 항목을 이 탭에서 바로 추가할 수 있게
  // 함(설정 → 체크리스트 관리에서도 같은 모달을 열 수 있음, js/checklistSettings.js 참고)
  const addBtnHtml = `
    <button type="button" class="cl-add-item-btn" onclick="openGovItemsModal('${child.stage}')">
      ＋ 항목 직접 추가하기
    </button>`;

  const items = getAllEvs()
    .filter(e => e.type === 'gov')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!items.length) {
    main.innerHTML = `<p style="color:var(--txl);text-align:center;padding:20px">해당하는 정부지원 일정이 없어요.</p>${addBtnHtml}`;
    return;
  }

  const appliedCount = items.filter(e => e.govStatus === 'applied').length;
  const paidCount    = items.filter(e => e.govStatus === 'paid').length;

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:6px">
      <h3 style="font-size:.93rem;font-weight:900;color:var(--tx)">${icon('account_balance', { size: 'sm' })} 정부지원 현황</h3>
      <span class="cl-status">신청 완료 ${appliedCount} · 지급 완료 ${paidCount} / 전체 ${items.length}</span>
    </div>
    ${items.map(e => {
      const status = e.govStatus || 'none';
      const urgent = isGovDeadlineSoon(e);
      // v0.0.21: 상태 점(🟢/🔵/✅/⏰)을 아이콘으로 교체 — 상태 구분 색은 정보 전달용 예외로 유지
      const statusIcon = urgent ? icon('schedule', { size: 'sm', style: 'color:#C62828' })
        : status === 'paid'    ? icon('check_circle', { size: 'sm', style: 'color:#2E7D32' })
        : status === 'applied' ? icon('radio_button_checked', { size: 'sm', style: 'color:var(--bl)' })
        : icon('trip_origin', { size: 'sm', style: 'color:#2E7D32' });
      const label  = status === 'paid' ? '지급 완료' : status === 'applied' ? '신청 완료' : '신청 전';
      const cleanTitle = escapeHtml(stripLeadingEmoji(e.title));
      const impBadge = e.imp === 'req'
        ? '<span class="badge-r">필수</span>'
        : '<span class="badge-o">해당자</span>';
      const deadline = e.deadlineDate || e.deadlineNote;
      const dLeft = urgent ? daysUntil(e.deadlineDate) : null;
      const urgentText = dLeft === null ? '' : dLeft < 0 ? ' (마감 지남)' : dLeft === 0 ? ' (오늘 마감)' : ` (D-${dLeft})`;
      return `
        <div class="gov-cl-item${urgent ? ' gov-cl-urgent' : ''}" onclick="openEvModal(${e._idx})">
          <div class="gov-cl-icon">${statusIcon}</div>
          <div style="flex:1;min-width:0">
            <div class="gov-cl-title">${cleanTitle} ${impBadge}${e.customGov ? ' <span class="badge-custom">내가 추가함</span>' : ''}${urgent ? ` <span class="badge-r">${icon('schedule', { size: 'sm' })} 마감임박</span>` : ''}</div>
            <div class="gov-cl-desc"${urgent ? ' style="color:#C62828;font-weight:800"' : ''}>${escapeHtml(e.date)} 권장${deadline ? ` · ${icon('schedule', { size: 'sm' })} 마감 ${escapeHtml(deadline)}${urgentText}` : ''}</div>
          </div>
          <span class="gov-cl-status status-${status}">${label}</span>
          ${e.customGov ? `
          <button type="button" class="ci-expand-btn" aria-label="삭제" onclick="event.stopPropagation();deleteCustomGovItem('${e._customGovId}')">
            <span class="ci-expand-arrow"><span class="icon icon-sm" translate="no" aria-hidden="true">close</span></span>
          </button>` : ''}
        </div>`;
    }).join('')}
    ${addBtnHtml}
  `;
}

window.renderGovChecklistTab = renderGovChecklistTab;
