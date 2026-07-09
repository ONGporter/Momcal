/**
 * data/milestones.js
 * 육아 마일스톤 (건강검진·발달) 및 이유식 일정 데이터
 */

/**
 * 월수별 건강검진·발달 체크 이벤트
 *
 * Sprint 14 버그 수정: 이 목록에 "DTaP·IPV·Hib 등 5종 접종"처럼 예방접종을 요약해서
 * 언급하는 항목들이 섞여 있었는데, data/vaccines.js의 vaxSched가 정확히 같은 날짜에
 * 백신 1종당 1개씩 개별 이벤트(💉 DTaP 1차 등)를 이미 만들고 있어서 캘린더에
 * "예방접종이 중복"되어 보이는 원인이었음 (같은 날짜에 요약 문구 + 개별 항목이 함께 표시).
 * → 예방접종 관련 요약 문구는 모두 제거하고, 이 목록은 건강검진·발달·이유식 등
 *   vaxSched와 겹치지 않는 마일스톤만 다룸 (예방접종 표시는 전부 vaxSched에 위임).
 * @type {Array<{m: number, items: Array<{t: string, r: boolean}>}>}
 */
export const checkEvs = [
  { m: 0,  items: [
    { t: '신생아 청각·대사이상 검사', r: true },
    { t: '비타민 D 400IU 시작',       r: true },
  ]},
  { m: 2,  items: [
    { t: '영유아 건강검진 1차', r: true },
  ]},
  { m: 4,  items: [
    { t: '영유아 건강검진 2차', r: true },
  ]},
  { m: 6,  items: [
    { t: '영유아 건강검진 3차',   r: true },
  ]},
  { m: 9,  items: [
    { t: '영유아 건강검진 4차', r: true },
    { t: '안전문 설치',         r: true },
  ]},
  { m: 12, items: [
    { t: '돌 건강검진 (5차)', r: true },
    { t: '생우유 시작 가능',  r: false },
  ]},
  { m: 18, items: [
    { t: '영유아 건강검진 6차', r: true },
  ]},
  { m: 24, items: [
    { t: '영유아 건강검진 7차', r: true },
  ]},
  { m: 36, items: [
    { t: '일본뇌염 3차',       r: true },
    { t: '영유아 건강검진 8차', r: true },
  ]},
];

/**
 * v0.0.31: 이유식 자동 일정 데이터(foodEvs)는 제거함 — 이유식은 이제 캘린더 스티커로
 * 사용자가 직접 기록하는 방식으로 바뀜(js/calendar.js의 placeSticker 참고).
 * 이전 데이터가 필요하면 git 이력에서 확인 가능.
 */
