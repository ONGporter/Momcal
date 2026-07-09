/**
 * data/vaccines.js
 * 예방접종 스케줄 데이터
 * 월수(m) 기준으로 생후 몇 개월에 접종할 항목들을 정의합니다.
 *
 * Sprint 6 버그 수정: IPV 접종이 1·2차만 있고 3차가 누락되어 있던 것을 6개월차(DTaP 3차와 동시)에 추가.
 * (자동 재계산 로직이 회차별 최소 간격을 정확히 계산하려면 회차 번호가 연속적이어야 함)
 */

/** @type {Array<{m: number, items: string[]}>} */
export const vaxSched = [
  { m: 0,  items: ['B형 간염 1차', 'BCG (결핵)'] },
  { m: 1,  items: ['B형 간염 2차'] },
  { m: 2,  items: ['DTaP 1차', 'IPV 1차', 'Hib 1차', '폐구균 1차', '로타바이러스 1차'] },
  { m: 4,  items: ['DTaP 2차', 'IPV 2차', 'Hib 2차', '폐구균 2차', '로타바이러스 2차'] },
  { m: 6,  items: ['DTaP 3차', 'IPV 3차', 'B형 간염 3차', '폐구균 3차', '독감 예방접종'] },
  { m: 12, items: ['MMR 1차', '수두 1차', 'A형 간염 1차'] },
  { m: 15, items: ['DTaP 4차'] },
  { m: 18, items: ['A형 간염 2차'] },
  { m: 24, items: ['일본뇌염 1·2차'] },
  { m: 48, items: ['DTaP 5차', 'IPV 4차', 'MMR 2차', '수두 2차'] },
];
