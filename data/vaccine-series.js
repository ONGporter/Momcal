/**
 * data/vaccine-series.js — Sprint 6
 * 예방접종 회차별 최소 접종 간격(일) 참고 데이터
 *
 * `titles`는 data/vaccines.js 의 항목 이름과 정확히 일치해야 합니다 (일정 매칭 기준).
 * `minIntervalDays[i]`는 titles[i] → titles[i+1] 사이에 반드시 지켜야 할 최소 간격(일)입니다.
 *
 * ⚠️ 참고용 근사치입니다. 실제 접종 간격은 아이 건강 상태·백신 종류에 따라 소아과 의사와
 * 상담 후 결정해야 하며, 이 앱은 병원의 공식 접종 스케줄을 대체하지 않습니다.
 * (일본뇌염 1·2차, 독감, BCG 는 이 앱에서 단일 일정으로 관리되어 회차 자동 재계산 대상이 아닙니다.)
 */
export const vaxSeries = [
  {
    key: 'hepb', label: 'B형간염',
    titles: ['B형 간염 1차', 'B형 간염 2차', 'B형 간염 3차'],
    minIntervalDays: [28, 56],
  },
  {
    key: 'dtap', label: 'DTaP',
    titles: ['DTaP 1차', 'DTaP 2차', 'DTaP 3차', 'DTaP 4차', 'DTaP 5차'],
    minIntervalDays: [28, 28, 168, 365],
  },
  {
    key: 'ipv', label: 'IPV',
    titles: ['IPV 1차', 'IPV 2차', 'IPV 3차', 'IPV 4차'],
    minIntervalDays: [28, 28, 180],
  },
  {
    key: 'hib', label: 'Hib',
    titles: ['Hib 1차', 'Hib 2차'],
    minIntervalDays: [28],
  },
  {
    key: 'pcv', label: '폐구균',
    titles: ['폐구균 1차', '폐구균 2차', '폐구균 3차'],
    minIntervalDays: [28, 60],
  },
  {
    key: 'rota', label: '로타바이러스',
    titles: ['로타바이러스 1차', '로타바이러스 2차'],
    minIntervalDays: [28],
  },
  {
    key: 'mmr', label: 'MMR',
    titles: ['MMR 1차', 'MMR 2차'],
    minIntervalDays: [28],
  },
  {
    key: 'var', label: '수두',
    titles: ['수두 1차', '수두 2차'],
    minIntervalDays: [84],
  },
  {
    key: 'hepa', label: 'A형간염',
    titles: ['A형 간염 1차', 'A형 간염 2차'],
    minIntervalDays: [180],
  },
];
