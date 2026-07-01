/**
 * js/utils.js
 * 공통 유틸리티 함수
 */

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
export const today = () => new Date().toISOString().split('T')[0];

/** 생년월일(문자열) → 생후 일수 */
export const ageD = (b) => b ? Math.max(0, Math.floor((Date.now() - new Date(b)) / 86400000)) : 0;

/** 생년월일(문자열) → "N일 (M개월)" 형식 문자열 */
export function ageFmt(b) {
  if (!b) return '';
  const d = ageD(b);
  const m = Math.floor(d / 30.44);
  return m < 1 ? `${d}일` : `${d}일 (${m}개월)`;
}
