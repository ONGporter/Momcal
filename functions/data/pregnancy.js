/**
 * data/pregnancy.js
 * 임신 주차별 자동 일정 데이터
 * w: 임신 주수, items: [{t: 제목, r: 필수여부}]
 */

/** @type {Array<{w: number, items: Array<{t: string, r: boolean}>}>} */
export const pregEvMap = [
  { w: 4,  items: [
    { t: '산부인과 첫 방문 (임신 확인)', r: true },
    { t: '엽산 복용 시작 400~800mcg',    r: true },
    { t: '흡연·음주 완전 중단',           r: true },
  ]},
  { w: 8,  items: [
    { t: '초음파 검사 (심박 확인)', r: true },
    { t: '혈액 기본 검사',           r: true },
    { t: '오메가3 복용 시작',         r: false },
  ]},
  { w: 11, items: [
    { t: '1차 기형아 검사 (NT 초음파)', r: true },
    { t: '철분제 시작 30mg/일',          r: true },
    { t: '치과 검진',                    r: false },
  ]},
  { w: 16, items: [
    { t: '2차 기형아 검사 (쿼드마커)', r: true },
    { t: '유모차·아기띠 구매',          r: false },
    { t: '임신선 예방 오일 시작',       r: false },
  ]},
  { w: 20, items: [
    { t: '정밀 초음파 (태아 기관 확인)', r: true },
    { t: '카시트 구매·설치',              r: true },
    { t: '신생아 용품 구매 시작',         r: false },
  ]},
  { w: 24, items: [
    { t: '임신성 당뇨 검사 (50g)', r: true },
    { t: '아기용품 세탁·소독',     r: false },
    { t: '출산 준비 교실 등록',    r: false },
  ]},
  { w: 28, items: [
    { t: '백일해 예방접종 (산모)', r: false },
    { t: '출산 가방 준비',         r: false },
  ]},
  { w: 32, items: [
    { t: '태아 성장 초음파',  r: true },
    { t: 'GBS 검사',          r: true },
    { t: '산후조리원 예약',   r: false },
  ]},
  { w: 36, items: [
    { t: '매주 산부인과 방문',              r: true },
    { t: '태동 매일 체크 (2시간 10회)',     r: true },
    { t: '아기방 최종 점검',               r: false },
  ]},
];
