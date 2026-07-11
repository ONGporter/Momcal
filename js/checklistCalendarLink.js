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

/**
 * v0.0.40: 사용자가 설정 탭에서 이 탭(예방접종/발달)의 캘린더 연동을 꺼뒀는지 확인.
 * 기본값은 켜짐(true) — S.clSettings.calendarSync[tabKey]가 명시적으로 false일 때만 꺼짐.
 * 이유식·정부지원·준비물 팩·커스텀 체크리스트는 애초에 checklistCalendarLinks에 매핑이
 * 없어서 이 함수를 거치지 않고도 자연히 연동되지 않음(추가 처리 불필요).
 */
function isSyncEnabled(tabKey) {
  return !(S.clSettings && S.clSettings.calendarSync && S.clSettings.calendarSync[tabKey] === false);
}

/**
 * v0.0.22: 예방접종(💉)·정부지원(🟢) 이벤트 제목의 이모지 접두어를 없애면서(제목엔 더 이상
 * 이모지가 안 붙음 — 화면 표시는 어차피 stripLeadingEmoji()로 항상 지워왔어서 시각적 변화는
 * 없음), 이 파일의 매칭 로직도 이모지 문자열 대신 ev.type을 기준으로 바꿈.
 */
function calTitleFor(link) {
  return link.calTitle;
}

/**
 * v0.0.42 버그 수정: checklist-links.js의 건강검진 항목은 type이 'checkup' 문자열이지만,
 * js/calendar.js의 getAutoEvs()가 실제로 만드는 건강검진 이벤트의 ev.type은 'checkup'이
 * 아니라 필수/추천 여부에 따른 'req'|'rec'임(임신 체크와 같은 규칙을 재사용해서 그럼).
 * 그래서 예전 코드(`e.type === link.type`)는 link.type이 'checkup'인 항목에 대해 절대
 * 매칭되는 이벤트를 못 찾았음 — 즉 발달(건강검진) 쪽은 체크리스트→캘린더 방향 동기화가
 * 계속 조용히 실패해왔던 것으로 보임. 이 함수로 실제 타입 규칙에 맞게 판별한다.
 */
function evTypeMatchesLink(ev, linkType) {
  return linkType === 'vax' ? ev.type === 'vax' : (ev.type === 'req' || ev.type === 'rec');
}

/**
 * 체크리스트 항목 체크/해제 → 연결된 캘린더 이벤트 완료 상태에 반영 (내부용, 연동 켜짐 여부를 확인하지 않음)
 */
function doSyncChecklistToCalendar(child, link, checked) {
  const fullTitle = calTitleFor(link);
  const ev = getAutoEvs(child).find(e => e.title === fullTitle && evTypeMatchesLink(e, link.type));
  if (!ev) return false; // 이 아이 일정에 해당 이벤트가 없음 (스킵)

  if (!S.eventMods) S.eventMods = {};
  const key = `auto_${ev._origDate}_${ev.title}`;
  const existing = S.eventMods[key] || {};
  S.eventMods[key] = { ...existing, done: checked };
  return true;
}

/**
 * 체크리스트 항목 체크/해제 → 연결된 캘린더 이벤트 완료 상태에 반영
 * @returns {boolean} 연동된 항목이 있었는지 여부
 */
export function syncChecklistToCalendar(child, itemId, checked) {
  if (!child) return false;
  const link = checklistCalendarLinks.find(l => l.itemId === itemId);
  if (!link) return false;
  if (!isSyncEnabled(link.type === 'vax' ? 'vax' : 'dev')) return false;
  return doSyncChecklistToCalendar(child, link, checked);
}

/**
 * v0.0.42: 캘린더 연동을 껐다가 다시 켤 때 호출 — 꺼져있던 동안 체크리스트에서 바뀐 내용이
 * 캘린더엔 반영 안 돼 있을 수 있으니(꺼진 동안엔 tgCk가 동기화를 건너뜀), 지금 체크리스트
 * 상태를 기준으로 모든 아이의 캘린더 완료 표시를 한 번에 다시 맞춘다.
 * (js/checklistSettings.js의 toggleClCalendarSync가 "켜기"로 전환할 때만 호출함)
 */
export function resyncTabForAllChildren(tabKey) {
  const links = checklistCalendarLinks.filter(l => (l.type === 'vax' ? 'vax' : 'dev') === tabKey);
  (S.children || []).forEach(child => {
    links.forEach(link => {
      const key = `${child.id}_${link.catKey}`;
      const checked = !!(S.checks[key] && S.checks[key][link.itemId]);
      doSyncChecklistToCalendar(child, link, checked);
    });
  });
}

/**
 * 캘린더 이벤트 완료 체크/해제 → 연결된 체크리스트 항목에 반영
 * @param {string} eventTitle - ev.title (예: 'DTaP 1차' 또는 '영유아 건강검진 1차', v0.0.22부터 이모지 접두어 없음)
 * @param {string} eventType  - ev.type ('vax'|'req'|'rec' 등) — 예전엔 제목 앞 💉로 예방접종 여부를 판별했으나,
 *                              이제 이모지가 없으므로 type으로 직접 판별함
 * @returns {boolean} 연동된 항목이 있었는지 여부
 */
export function syncCalendarToChecklist(child, eventTitle, eventType, done) {
  if (!child) return false;
  const isVax = eventType === 'vax';
  if (!isSyncEnabled(isVax ? 'vax' : 'dev')) return false;

  const link = checklistCalendarLinks.find(l =>
    l.calTitle === eventTitle && l.type === (isVax ? 'vax' : 'checkup')
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
window.resyncTabForAllChildren = resyncTabForAllChildren;
