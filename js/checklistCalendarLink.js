/**
 * js/checklistCalendarLink.js — Sprint 11
 * 체크리스트 ↔ 캘린더 완료 상태 양방향 연동
 *
 * 예방접종·건강검진처럼 체크리스트와 캘린더 양쪽에 같은 항목이 존재하는 경우,
 * 한쪽에서 완료 체크하면 다른 쪽도 자동으로 완료 처리됩니다.
 * 매핑 목록은 data/checklist-links.js 참고.
 *
 * 참고: 이미 저장되어 있던 기존 데이터(연동 기능 이전에 한쪽만 체크해둔 경우)를
 * 자동으로 맞춰주지는 않습니다 — 오직 "새로 체크/해제하는 순간"부터 연동됩니다.
 */

import { S }          from './state.js';
import { getAutoEvs } from './calendar.js';
import { checklistCalendarLinks } from '../data/checklist-links.js';

function calTitleFor(link) {
  return link.type === 'vax' ? `💉 ${link.calTitle}` : link.calTitle;
}

/**
 * 체크리스트 항목 체크/해제 → 연결된 캘린더 이벤트 완료 상태에 반영
 * @returns {boolean} 연동된 항목이 있었는지 여부
 */
export function syncChecklistToCalendar(child, itemId, checked) {
  if (!child) return false;
  const link = checklistCalendarLinks.find(l => l.itemId === itemId);
  if (!link) return false;

  const fullTitle = calTitleFor(link);
  const ev = getAutoEvs(child).find(e => e.title === fullTitle);
  if (!ev) return false; // 이 아이 일정에 해당 이벤트가 없음 (스킵)

  if (!S.eventMods) S.eventMods = {};
  const key = `auto_${ev._origDate}_${ev.title}`;
  const existing = S.eventMods[key] || {};
  S.eventMods[key] = { ...existing, done: checked };
  return true;
}

/**
 * 캘린더 이벤트 완료 체크/해제 → 연결된 체크리스트 항목에 반영
 * @param {string} eventTitle - ev.title (예: '💉 DTaP 1차' 또는 '영유아 건강검진 1차')
 * @returns {boolean} 연동된 항목이 있었는지 여부
 */
export function syncCalendarToChecklist(child, eventTitle, done) {
  if (!child) return false;
  const isVax = eventTitle.startsWith('💉');
  const cleanTitle = isVax ? eventTitle.replace(/^💉\s*/, '') : eventTitle;

  const link = checklistCalendarLinks.find(l =>
    l.calTitle === cleanTitle && l.type === (isVax ? 'vax' : 'checkup')
  );
  if (!link) return false;

  const key = `${child.id}_${link.catKey}`;
  if (!S.checks[key]) S.checks[key] = {};
  S.checks[key][link.itemId] = done;
  return true;
}

// calendar.js에서 순환 import 없이 호출할 수 있도록 window에도 노출
window.syncCalendarToChecklist = syncCalendarToChecklist;
window.syncChecklistToCalendar = syncChecklistToCalendar;
