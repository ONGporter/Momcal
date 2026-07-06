/**
 * js/vaccineSeries.js — Sprint 6
 * 예방접종 실제 접종일 기준 이후 회차 자동 재계산
 *
 * 규칙:
 *  - 수정된 회차의 지연일수(delay) 만큼 이후 회차의 권장일을 함께 미룬다
 *  - 단, 이전 회차(새로 계산된 날짜) 기준 최소 접종 간격(minIntervalDays)은 항상 보장한다
 *  - 이미 "완료" 처리된 회차는 날짜를 건드리지 않는다 (실제로 접종을 마쳤으므로)
 *    — 다만 그 다음 회차의 최소 간격 계산 기준일로는 사용한다
 */

import { S }        from './state.js';
import { vaxSeries } from '../data/vaccine-series.js';

const toStr    = (d) => d.toISOString().split('T')[0];
const addDays  = (dateStr, days) => { const d = new Date(dateStr); d.setDate(d.getDate() + days); return toStr(d); };
const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

/** v0.0.22부터 예방접종 이벤트 제목엔 이모지 접두어가 안 붙지만(js/calendar.js getAutoEvs 참고),
 *  혹시 모를 예전 형식 문자열이 섞여 들어와도 안전하도록 방어적으로 유지 */
const stripIcon = (title) => title.replace(/^💉\s*/, '');

/** 제목으로 소속 시리즈와 회차 인덱스 찾기 */
function findSeries(title) {
  const clean = stripIcon(title);
  for (const series of vaxSeries) {
    const idx = series.titles.indexOf(clean);
    if (idx >= 0) return { series, idx };
  }
  return null;
}

/**
 * 회차 재계산 실행
 * @param {Array} autoVaxEvs   - 해당 아이의 자동 예방접종 이벤트 목록 (type:'vax', {title, _origDate, date})
 * @param {string} editedTitle - 방금 수정된 회차 제목 (ev.title 그대로, v0.0.22부터 이모지 접두어 없음)
 * @param {string} editedActualDate - 방금 수정된 회차의 실제 접종일 (YYYY-MM-DD)
 * @returns {Array<{title:string,newDate:string}>} 자동으로 조정된 이후 회차 목록
 */
export function recalcVaccineSeries(autoVaxEvs, editedTitle, editedActualDate) {
  const found = findSeries(editedTitle);
  if (!found) return []; // 단일 접종(BCG, 독감, 일본뇌염 등)은 재계산 대상 아님

  const { series, idx } = found;
  if (idx >= series.titles.length - 1) return []; // 마지막 회차 → 조정할 다음 회차 없음

  const editedEv = autoVaxEvs.find(e => stripIcon(e.title) === series.titles[idx]);
  const origEdited = editedEv ? editedEv._origDate : editedActualDate;
  const delay = diffDays(editedActualDate, origEdited); // 양수면 지연, 음수면 앞당김

  if (!S.eventMods) S.eventMods = {};
  const changed = [];
  let prevActual = editedActualDate;

  for (let i = idx + 1; i < series.titles.length; i++) {
    const cleanTitle = series.titles[i];
    const ev = autoVaxEvs.find(e => stripIcon(e.title) === cleanTitle);
    if (!ev) continue; // 이 아이 스케줄에 해당 회차가 없으면 건너뜀

    const key = 'auto_' + ev._origDate + '_' + ev.title; // getEventKey()와 동일한 규칙
    const existingMod = S.eventMods[key] || {};

    if (existingMod.done) {
      // 이미 접종 완료 — 날짜는 유지하고 다음 회차 간격 계산 기준일로만 사용
      prevActual = existingMod.actualDate || ev.date;
      continue;
    }

    const minGap      = series.minIntervalDays[i - 1] || 0;
    const shiftedDate = addDays(ev._origDate, delay);
    const minAllowed  = addDays(prevActual, minGap);
    // 문자열이 YYYY-MM-DD 형식이므로 사전식 비교가 곧 날짜 비교와 동일
    const newDate = shiftedDate > minAllowed ? shiftedDate : minAllowed;

    const currentDate = existingMod.actualDate || ev.date;
    if (newDate !== currentDate) {
      S.eventMods[key] = { ...existingMod, actualDate: newDate, recalculated: true };
      changed.push({ title: cleanTitle, newDate });
    }
    prevActual = newDate;
  }

  return changed;
}
