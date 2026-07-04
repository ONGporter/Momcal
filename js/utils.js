/**
 * js/utils.js
 * 공통 유틸리티 함수
 */

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (Sprint 30: 타임존 버그 수정)
 * ⚠️ 예전엔 `new Date().toISOString()`을 썼는데, toISOString()은 항상 UTC 기준이라
 * 한국시간(KST, UTC+9) 자정~오전 9시 사이에는 하루 전 날짜가 나오는 버그가 있었음
 * (예: 한국시간 7/4 새벽 1시반 → UTC로는 아직 7/3 16시반이라 "7월 3일"로 표시됨)
 * Intl.DateTimeFormat으로 기기 시간대와 무관하게 항상 한국(Asia/Seoul) 날짜를 계산하도록 수정
 */
export const today = () => {
  // en-CA 로케일은 YYYY-MM-DD 형식으로 포맷해줘서 별도 조합 없이 바로 쓸 수 있음
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
};

/**
 * 생년월일(문자열) → 생후 일수 (Sprint 30: 태어난 날을 1일로 계산하도록 변경)
 * - 기존엔 D+0(태어난 날 = 0일째) 방식이었는데, "태어난 날을 1일로 계산해달라"는
 *   요청에 맞춰 +1 — 태어난 날 당일에는 "1일째", 다음날부터 "2일째"로 표시됨
 * - 한국시간(KST) 자정 기준으로 날짜 차이를 계산해 시간대 오차 없이 정확한 날짜 수만 셈
 */
export const ageD = (b) => {
  if (!b) return 0;
  const diff = Math.floor((new Date(today() + 'T00:00:00+09:00') - new Date(b + 'T00:00:00+09:00')) / 86400000);
  return Math.max(0, diff) + 1;
};

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
