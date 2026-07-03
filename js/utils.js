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

/**
 * 기준 날짜 문자열(YYYY-MM-DD) → 오늘로부터 며칠 남았는지 (Sprint 20)
 * 지난 날짜면 음수 반환. dateStr이 없으면 null.
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86400000);
}

/**
 * 문자열 맨 앞의 이모지(+공백)를 제거해서 반환 (Sprint 21)
 * ⚠️ 화면 표시 전용 헬퍼입니다 — 실제 데이터(ev.title)는 절대 이 함수로 바꾸지 마세요.
 * eventMods의 키가 `auto_{날짜}_{title}` 형식이라 title 원본이 바뀌면
 * 기존 사용자가 저장해둔 병원명·메모·완료 여부가 전부 매칭 실패로 사라집니다.
 * 캘린더 필 등 "보여주기"에서만 이 함수의 반환값을 쓰세요.
 */
export function stripLeadingEmoji(str) {
  if (!str) return '';
  return str.replace(/^[\p{Extended_Pictographic}\u200d\uFE0F\s]+/u, '').trim();
}
