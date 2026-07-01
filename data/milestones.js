/**
 * data/milestones.js
 * 육아 마일스톤 (건강검진·발달) 및 이유식 일정 데이터
 */

/**
 * 월수별 건강검진·발달 체크 이벤트
 * @type {Array<{m: number, items: Array<{t: string, r: boolean}>}>}
 */
export const checkEvs = [
  { m: 0,  items: [
    { t: '신생아 청각·대사이상 검사', r: true },
    { t: '비타민 D 400IU 시작',       r: true },
  ]},
  { m: 2,  items: [
    { t: 'DTaP·IPV·Hib 등 5종 접종', r: true },
    { t: '영유아 건강검진 1차',        r: true },
  ]},
  { m: 4,  items: [
    { t: 'DTaP 2차 등 접종',  r: true },
    { t: '영유아 건강검진 2차', r: true },
  ]},
  { m: 6,  items: [
    { t: '이유식 시작! (쌀미음)', r: true },
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
    { t: 'DTaP 4차·A형간염 2차', r: true },
    { t: '영유아 건강검진 6차',   r: true },
  ]},
  { m: 24, items: [
    { t: '일본뇌염 접종 시작', r: true },
    { t: '영유아 건강검진 7차', r: true },
  ]},
  { m: 36, items: [
    { t: '일본뇌염 3차',       r: true },
    { t: '영유아 건강검진 8차', r: true },
  ]},
];

/**
 * 이유식 단계별 자동 일정
 * @type {Array<{m: number, day: number, t: string, r: boolean}>}
 */
export const foodEvs = [
  { m: 6,  day: 1,  t: '🥣 쌀미음 시작!',                 r: true  },
  { m: 6,  day: 6,  t: '🥕 당근 미음 시도',               r: false },
  { m: 6,  day: 12, t: '🌽 단호박 미음 시도',             r: false },
  { m: 6,  day: 18, t: '🥔 감자 미음 시도',               r: false },
  { m: 6,  day: 24, t: '🍠 고구마 미음 시도',             r: false },
  { m: 8,  day: 1,  t: '🍲 이유식 하루 2회 시작 (7배죽)', r: true  },
  { m: 8,  day: 5,  t: '🐔 닭안심 미음 시도',             r: false },
  { m: 8,  day: 12, t: '🐟 흰살생선 시도',                r: false },
  { m: 8,  day: 18, t: '🥦 브로콜리·시금치 추가',         r: false },
  { m: 8,  day: 24, t: '🫛 두부 추가',                     r: false },
  { m: 9,  day: 1,  t: '🍌 핑거푸드 시작',                r: false },
  { m: 10, day: 1,  t: '🍱 이유식 5배죽 — 중기!',        r: true  },
  { m: 10, day: 3,  t: '🥩 소고기 추가 (철분)',           r: true  },
  { m: 10, day: 10, t: '🧇 달걀 노른자 추가',             r: false },
  { m: 10, day: 18, t: '🫐 블루베리 시도',                r: false },
  { m: 11, day: 1,  t: '🥚 달걀 흰자 시도',               r: false },
  { m: 12, day: 1,  t: '🍚 유아식 전환! (진밥+국+반찬)', r: true  },
  { m: 12, day: 3,  t: '🥛 생우유 시작 가능',             r: false },
  { m: 12, day: 10, t: '🐟 등푸른생선 시도',              r: false },
  { m: 18, day: 1,  t: '🥘 균형 식사 3회 — 편식 주의',  r: false },
  { m: 24, day: 1,  t: '🥘 유아식 완성! 가족 식사 함께', r: false },
];
