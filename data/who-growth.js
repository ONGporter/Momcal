/**
 * data/who-growth.js
 * 성장 백분위 계산용 참고 데이터 (키 / 몸무게 / 머리둘레)
 *
 * ⚠️ 중요:
 * 이 파일의 수치는 WHO 성장 표준(Child Growth Standards)의 대표적인 중앙값(50th percentile)을
 * 참고하여 구성한 "근사치"이며, WHO가 실제 배포하는 LMS(L, M, S) 공식 파라미터 원본이 아닙니다.
 * 백분위는 정규분포 근사(중앙값 med ± 표준편차 sd)로 계산하므로 병원에서 사용하는 공식 성장曲선과
 * 다소 차이가 있을 수 있습니다. → 화면에는 항상 "참고용" 문구를 함께 표시합니다.
 *
 * 향후 개선 방향:
 * 이 파일을 WHO 공식 LMS 테이블(0~60개월, 1개월 단위, L/M/S 3개 파라미터)로 교체하면
 * js/growthChart.js 의 계산 로직(computePercentile)만 LMS 공식으로 바꾸면 되도록
 * "성별 → 지표(height/weight/head) → 개월수 배열" 구조를 그대로 유지해두었습니다.
 */

/** 개월수(m) 기준 중앙값(med)과 근사 표준편차(sd) — 남아 */
const boys = {
  height: [
    { m: 0,  med: 49.9,  sd: 1.7 },
    { m: 2,  med: 57.6,  sd: 2.0 },
    { m: 4,  med: 63.9,  sd: 2.2 },
    { m: 6,  med: 67.6,  sd: 2.4 },
    { m: 9,  med: 72.0,  sd: 2.5 },
    { m: 12, med: 75.7,  sd: 2.6 },
    { m: 18, med: 82.3,  sd: 2.9 },
    { m: 24, med: 87.1,  sd: 3.0 },
    { m: 36, med: 96.1,  sd: 3.4 },
    { m: 48, med: 103.3, sd: 3.6 },
    { m: 60, med: 110.0, sd: 3.9 },
  ],
  weight: [
    { m: 0,  med: 3.3,  sd: 0.43 },
    { m: 2,  med: 5.6,  sd: 0.73 },
    { m: 4,  med: 7.0,  sd: 0.91 },
    { m: 6,  med: 7.9,  sd: 1.03 },
    { m: 9,  med: 8.9,  sd: 1.16 },
    { m: 12, med: 9.6,  sd: 1.25 },
    { m: 18, med: 10.9, sd: 1.42 },
    { m: 24, med: 12.2, sd: 1.59 },
    { m: 36, med: 14.3, sd: 1.86 },
    { m: 48, med: 16.3, sd: 2.12 },
    { m: 60, med: 18.3, sd: 2.38 },
  ],
  head: [
    { m: 0,  med: 34.5, sd: 0.9 },
    { m: 2,  med: 38.3, sd: 1.0 },
    { m: 4,  med: 40.6, sd: 1.0 },
    { m: 6,  med: 42.6, sd: 1.1 },
    { m: 9,  med: 44.2, sd: 1.1 },
    { m: 12, med: 45.5, sd: 1.1 },
    { m: 18, med: 46.9, sd: 1.2 },
    { m: 24, med: 48.3, sd: 1.2 },
    { m: 36, med: 49.7, sd: 1.2 },
    { m: 48, med: 50.5, sd: 1.3 },
    { m: 60, med: 51.1, sd: 1.3 },
  ],
};

/** 개월수(m) 기준 중앙값(med)과 근사 표준편차(sd) — 여아 */
const girls = {
  height: [
    { m: 0,  med: 49.1,  sd: 1.7 },
    { m: 2,  med: 56.4,  sd: 2.0 },
    { m: 4,  med: 62.1,  sd: 2.2 },
    { m: 6,  med: 65.7,  sd: 2.3 },
    { m: 9,  med: 70.1,  sd: 2.5 },
    { m: 12, med: 74.0,  sd: 2.6 },
    { m: 18, med: 80.7,  sd: 2.8 },
    { m: 24, med: 85.7,  sd: 3.0 },
    { m: 36, med: 95.1,  sd: 3.3 },
    { m: 48, med: 102.7, sd: 3.6 },
    { m: 60, med: 109.4, sd: 3.8 },
  ],
  weight: [
    { m: 0,  med: 3.2,  sd: 0.42 },
    { m: 2,  med: 5.1,  sd: 0.66 },
    { m: 4,  med: 6.4,  sd: 0.83 },
    { m: 6,  med: 7.3,  sd: 0.95 },
    { m: 9,  med: 8.2,  sd: 1.07 },
    { m: 12, med: 8.9,  sd: 1.16 },
    { m: 18, med: 10.2, sd: 1.33 },
    { m: 24, med: 11.5, sd: 1.50 },
    { m: 36, med: 13.9, sd: 1.81 },
    { m: 48, med: 16.1, sd: 2.09 },
    { m: 60, med: 18.2, sd: 2.37 },
  ],
  head: [
    { m: 0,  med: 33.9, sd: 0.8 },
    { m: 2,  med: 37.3, sd: 0.9 },
    { m: 4,  med: 39.5, sd: 1.0 },
    { m: 6,  med: 41.5, sd: 1.0 },
    { m: 9,  med: 43.1, sd: 1.1 },
    { m: 12, med: 44.5, sd: 1.1 },
    { m: 18, med: 46.2, sd: 1.2 },
    { m: 24, med: 47.5, sd: 1.2 },
    { m: 36, med: 49.0, sd: 1.2 },
    { m: 48, med: 50.0, sd: 1.2 },
    { m: 60, med: 50.6, sd: 1.3 },
  ],
};

/**
 * @typedef {'height'|'weight'|'head'} GrowthMetric
 * @typedef {'m'|'f'|'u'} ChildGender
 */

/**
 * 성별 문자열('m'|'f'|'u') → 참고 테이블
 * 'u'(성별 미정)인 경우 남아/여아 데이터를 평균하여 사용 (화면에 "평균 기준" 안내 필요)
 */
export function refTableFor(gender) {
  if (gender === 'm') return boys;
  if (gender === 'f') return girls;
  // 성별 미정 → 남/여 평균 테이블 동적 생성
  const avg = {};
  ['height', 'weight', 'head'].forEach(metric => {
    avg[metric] = boys[metric].map((b, i) => {
      const g = girls[metric][i];
      return {
        m:   b.m,
        med: +((b.med + g.med) / 2).toFixed(2),
        sd:  +((b.sd  + g.sd)  / 2).toFixed(2),
      };
    });
  });
  return avg;
}

export const growthMetricLabel = {
  height: { label: '키',     unit: 'cm', icon: 'straighten' },
  weight: { label: '몸무게', unit: 'kg', icon: 'monitor_weight' },
  head:   { label: '머리둘레', unit: 'cm', icon: 'panorama_horizontal' },
};

/** v0.0.23: 임신 중(태아) 성장 기록 전용 지표 라벨 — 단위가 다름(g/cm, kg 아님) */
export const fetalMetricLabel = {
  weight: { label: '추정 체중', unit: 'g', icon: 'monitor_weight' },
  height: { label: '태아 길이', unit: 'cm', icon: 'straighten' },
};
