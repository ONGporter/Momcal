/**
 * js/growthChart.js — Sprint 5
 * 성장그래프 탭: 백분위 계산, 차트 렌더, 기록 목록
 *
 * 데이터 흐름:
 *  - 기록 저장/조회는 js/growth.js (getGrowthRecords, getLatestGrowth, openGrowthModal 등)
 *  - 백분위/또래 평균 계산은 data/who-growth.js 의 WHO LMS 파라미터를 사용
 *    (계산 방식·데이터 출처·정확도 안내는 data/who-growth.js 상단 주석 참고)
 *  - 화면에는 항상 "참고용, 의학적 진단 아님" 문구를 함께 표시
 */

import { S, debounceSave }               from './state.js';
import { showModal, cm }                 from './modal.js';
import { getGrowthRecords, getLatestGrowth, openGrowthModal } from './growth.js';
import { refTableFor, growthMetricLabel, fetalMetricLabel } from '../data/who-growth.js';
import { renderAdSlot } from './adSlot.js';
import { icon } from './utils.js';

/* ══════════════════════════════════════
 *  나이(개월) 계산
 * ══════════════════════════════════════ */

/** 출생일과 기록일 사이의 개월 수 (소수점 포함) */
function ageMonthsAt(birth, dateStr) {
  const days = (new Date(dateStr) - new Date(birth)) / 86400000;
  return Math.max(0, days / 30.44);
}

/** 출생일과 기록일 사이의 일수 (정수) — Sprint 10: 고정 X축 계산용 */
function ageDaysAt(birth, dateStr) {
  const days = Math.round((new Date(dateStr) - new Date(birth)) / 86400000);
  return Math.max(0, days);
}

/**
 * X축 최대값 계산 (Sprint 11, v0.0.2에서 step 단위 세분화)
 * "오늘 기준 우리 아이 생후 일수"가 축의 약 70% 지점에 오도록 계산하고,
 * 보기 좋은 단위로 반올림한다. (예: 오늘 140일 → 200일까지 표시, 오늘 14일 → 20일까지 표시)
 * ⚠️ v0.0.1까지는 항상 100일 단위로만 반올림해서, 신생아처럼 생후 일수가 작을 때
 * 축이 필요 이상으로 넓어 보이는 문제가 있었음(예: 14일 아기인데 0~100일 축) — 아이 나이대에
 * 맞춰 5/20/50/100일 단위로 유연하게 반올림하도록 수정.
 * 단, 실제 기록이 이보다 더 최근/많으면(예: 미래 날짜 오기록 등) 기록도 항상 포함되도록 보정한다.
 */
const AXIS_POSITION = 0.7; // 오늘 날짜가 축의 70% 지점에 오도록

/** 목표값 크기에 따라 보기 좋은 반올림 단위를 고른다 */
function niceAxisStep(target) {
  if (target <= 50)  return 5;
  if (target <= 200) return 20;
  if (target <= 600) return 50;
  return 100;
}

function computeAxisMax(todayAgeDays, ageDaysList) {
  const maxRecordAge = ageDaysList.length ? Math.max(...ageDaysList) : 0;
  const baseAge = Math.max(todayAgeDays, maxRecordAge);
  const target  = baseAge / AXIS_POSITION;
  const step    = niceAxisStep(target);
  return Math.max(step, Math.ceil(target / step) * step);
}

/* ══════════════════════════════════════
 *  WHO LMS 보간 + 백분위 계산
 *  (계산 방식 설명·데이터 출처는 data/who-growth.js 상단 주석 참고)
 * ══════════════════════════════════════ */

/** 특정 개월수에서의 LMS 파라미터(L,M,S)를 선형 보간으로 추정 */
function interpAt(table, ageMonths) {
  const pts = table;
  if (ageMonths <= pts[0].m) {
    const f = pts[0];
    return { L: f.L, M: f.M, S: f.S };
  }
  if (ageMonths >= pts[pts.length - 1].m) {
    const last = pts[pts.length - 1];
    return { L: last.L, M: last.M, S: last.S };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (ageMonths >= a.m && ageMonths <= b.m) {
      const t = (ageMonths - a.m) / (b.m - a.m);
      return {
        L: a.L + (b.L - a.L) * t,
        M: a.M + (b.M - a.M) * t,
        S: a.S + (b.S - a.S) * t,
      };
    }
  }
  const f = pts[0];
  return { L: f.L, M: f.M, S: f.S };
}

/** 표준정규분포 누적분포함수 (Abramowitz-Stegun 근사) */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** 측정값(X) → WHO LMS z-점수 */
function lmsZ(value, L, M, S) {
  if (!M || !S) return null;
  // L이 0에 아주 가까우면 로그 형태로 계산(0으로 나눔 방지)
  if (Math.abs(L) < 1e-7) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/** WHO LMS z-점수 → 측정값(X) — 참고 백분위 라인 계산용(LMS 역변환) */
function lmsValue(z, L, M, S) {
  if (Math.abs(L) < 1e-7) return M * Math.exp(S * z);
  const base = 1 + L * S * z;
  if (base <= 0) return M; // 극단값에서 음수 밑이 되는 경우 방어
  return M * Math.pow(base, 1 / L);
}

/**
 * 백분위 계산 — WHO LMS 방식
 * @returns {number|null} 1~99 사이 정수, 계산 불가 시 null
 */
export function computePercentile(value, ageMonths, gender, metric) {
  if (value == null || isNaN(value)) return null;
  const table = refTableFor(gender)[metric];
  const { L, M, S } = interpAt(table, ageMonths);
  const z = lmsZ(value, L, M, S);
  if (z == null || isNaN(z)) return null;
  const pct = Math.round(normalCdf(z) * 100);
  return Math.min(99, Math.max(1, pct));
}

/** 특정 개월수에서의 또래 중앙값(P50 = M) */
export function referenceMedianAt(ageMonths, gender, metric) {
  const table = refTableFor(gender)[metric];
  return interpAt(table, ageMonths).M;
}

/**
 * WHO 표준 백분위 라인용 z-점수 상수.
 * 임상 성장도표(소아 성장도표)에서 통용되는 3·15·50·85·97 백분위 라인에 맞춘 값.
 */
const Z_P03 = -1.88079; // 하위 3%
const Z_P15 = -1.03643; // 하위 15%
const Z_P85 =  1.03643; // 상위 15%(=85 백분위)
const Z_P97 =  1.88079; // 상위 3%(=97 백분위)

/** 특정 개월수·z-score에서의 참고값 — LMS 역변환으로 계산 */
export function referencePercentileAt(ageMonths, gender, metric, z) {
  const table = refTableFor(gender)[metric];
  const { L, M, S } = interpAt(table, ageMonths);
  return lmsValue(z, L, M, S);
}

/* ══════════════════════════════════════
 *  성장그래프 페이지 렌더
 * ══════════════════════════════════════ */

let _chart = null; // Chart.js 인스턴스 (탭 재진입 시 재사용/파괴)

/**
 * v0.0.29 버그 수정: 차트를 감싸는 wrap div가 `height:220px`로 고정돼 있는데,
 * 기록이 없을 때 보여주는 안내 문구(특히 태아용 문구·큰 글자 크기 설정)가 길어지면
 * 이 고정 높이를 넘어서 바로 아래 `.growth-disclaimer` 안내문과 겹쳐 보이는 버그가 있었음.
 * → 문구만 보여줄 땐 높이를 유동적으로 풀고, 실제 Chart.js 그래프를 그릴 땐 다시 고정 높이로 되돌림
 *   (Chart.js는 `responsive:true`+`maintainAspectRatio:false` 조합에서 부모에 명시적 높이가 있어야
 *   캔버스 크기를 잡을 수 있어서, 그래프를 그릴 땐 고정 높이가 계속 필요함)
 */
function setChartWrapAutoHeight(canvas, isAuto) {
  const wrap = canvas && canvas.parentElement;
  if (!wrap) return;
  wrap.style.height = isAuto ? 'auto' : '220px';
  wrap.style.minHeight = isAuto ? '220px' : '';
}

export function renderGrowthPage() {
  renderAdSlot('adSlotGrowth', 'growth'); // 성장 페이지 하단 — 아이 등록 여부와 무관하게 항상 표시

  const sel = document.getElementById('growthChildSel');
  sel.innerHTML = S.children.length
    ? S.children.map((c, i) =>
        `<option value="${i}" ${i == S.selC ? 'selected' : ''}>${c.avatar} ${c.name}</option>`
      ).join('')
    : '<option>아이를 등록해주세요</option>';

  const child = S.children[S.selC];
  const empty = document.getElementById('growthEmptyMsg');

  if (!child) {
    empty.innerHTML = `<p style="color:var(--txl);text-align:center;padding:30px 10px"><span class="icon icon-sm" translate="no" aria-hidden="true">child_care</span> 아이를 먼저 등록해주세요!</p>`;
    document.getElementById('growthSummaryGrid').innerHTML = '';
    document.getElementById('growthChartWrap').style.display = 'none';
    document.getElementById('growthRecordList').innerHTML = '';
    document.getElementById('growthPredictionCard').innerHTML = '';
    return;
  }

  if (child.stage === 'preg') {
    renderFetalGrowthPage(child);
    return;
  }

  // v0.0.25: 태아 화면에서 출생 후 화면으로 전환할 때 이전 내용을 모두 지우고 시작
  empty.innerHTML = '';
  document.getElementById('growthChartWrap').style.display = 'block';
  document.getElementById('growthSummaryGrid').innerHTML   = ''; // 태아 요약 카드 잔존 방지
  document.getElementById('growthRecordList').innerHTML    = ''; // 태아 기록 목록 잔존 방지
  document.getElementById('growthMetricToggle').innerHTML = ''; // 태아 메트릭 토글 잔존 방지
  // v0.0.29 버그 수정: 태아 화면에서 숨겼던 WHO 백분위 안내문을 출생 후 화면에서는 다시 표시
  const mainDisclaimer = document.getElementById('growthMainDisclaimer');
  if (mainDisclaimer) mainDisclaimer.style.display = '';

  renderSummary(child);
  renderMetricToggle();
  renderChart(child, S.growthMetric || 'height');
  renderRecordList(child);
  renderPrediction(child);
}

/**
 * v0.0.23: 임신 중(태아) 성장 기록 화면 — "임산부도 실제 태아 크기를 기록하고 싶다"는 요청으로 추가.
 * 출생 후 화면과 컨테이너(growthSummaryGrid/growthChartWrap/growthRecordList/growthPredictionCard)를
 * 그대로 재사용하되, 내용은 완전히 다르게 그림:
 *  - WHO 또래 백분위 비교는 하지 않음(태아 백분위 참고 자료마다 수치가 크게 달라 정확성을 보장하기
 *    어려움 — 검증된 WHO 표가 있는 출생 후 성장과 달리, 여기서는 우리 아이 자신의 기록 추이만 보여줌)
 *  - "한 달 뒤 예상" 예측 카드도 표시하지 않음(같은 이유)
 */
function renderFetalGrowthPage(child) {
  // v0.0.25: 출생 후 화면에서 태아 화면으로 전환할 때 이전 내용을 모두 지우고 시작
  document.getElementById('growthEmptyMsg').innerHTML = '';
  document.getElementById('growthChartWrap').style.display = 'block';
  document.getElementById('growthPredictionCard').innerHTML = '';
  document.getElementById('growthSummaryGrid').innerHTML   = ''; // 출생 후 백분위 카드 잔존 방지
  document.getElementById('growthRecordList').innerHTML    = ''; // 출생 후 기록 목록 잔존 방지
  document.getElementById('growthMetricToggle').innerHTML = ''; // 출생 후 메트릭 토글 잔존 방지
  // v0.0.29 버그 수정: 출생 후 전용 WHO 백분위 안내문(.growth-disclaimer, 정적 index.html 요소)이
  // 태아 화면 전환 시에도 지워지지 않고 그대로 남아있던 문제 — 태아 화면은 원래 설계상
  // WHO 백분위 비교를 하지 않으므로(TODO.md 참고) 이 안내문 자체를 숨김
  const mainDisclaimer = document.getElementById('growthMainDisclaimer');
  if (mainDisclaimer) mainDisclaimer.style.display = 'none';

  renderFetalSummary(child);
  renderFetalMetricToggle();
  const metric = (S.growthMetric === 'weight' || S.growthMetric === 'height') ? S.growthMetric : 'weight';
  S.growthMetric = metric;
  renderFetalChart(child, metric);
  renderFetalRecordList(child);
}

function renderFetalMetricToggle() {
  const cur = S.growthMetric || 'weight';
  document.getElementById('growthMetricToggle').innerHTML = Object.keys(fetalMetricLabel).map(m => {
    const { label, icon: iconName } = fetalMetricLabel[m];
    return `<button class="cvt ${m === cur ? 'on' : ''}" onclick="switchGrowthMetric('${m}')">${icon(iconName, { size: 'sm' })} ${label}</button>`;
  }).join('');
}

function renderFetalSummary(child) {
  const { latest } = getLatestGrowth(child.id);
  const el = document.getElementById('growthSummaryGrid');

  if (!latest) {
    el.innerHTML = `
      <div class="growth-pct-card growth-pct-empty" onclick="openGrowthModal()">
        <div style="font-size:1.6rem"><span class="icon icon-lg" translate="no" aria-hidden="true">pregnant_woman</span></div>
        <div style="font-weight:800;font-size:.84rem;margin-top:6px">첫 태아 기록을 남겨보세요</div>
        <div style="font-size:.72rem;color:var(--txl);margin-top:2px">탭해서 임신 주수·추정 체중 입력하기</div>
      </div>`;
    return;
  }

  el.innerHTML = ['weight', 'height'].map(metric => {
    const { label, unit, icon: iconName } = fetalMetricLabel[metric];
    const value = latest[metric];
    if (value == null) {
      return `<div class="growth-pct-card"><div class="growth-pct-icon">${icon(iconName)}</div><div class="growth-pct-label">${label}</div><div class="growth-pct-value" style="color:var(--txl);font-size:.78rem">기록 없음</div></div>`;
    }
    return `
      <div class="growth-pct-card">
        <div class="growth-pct-icon">${icon(iconName)}</div>
        <div class="growth-pct-label">${label}</div>
        <div class="growth-pct-value">${value}${unit}</div>
      </div>`;
  }).join('') + (latest.week != null
    ? `<div class="growth-pct-card"><div class="growth-pct-icon">${icon('event')}</div><div class="growth-pct-label">임신 주수</div><div class="growth-pct-value">${latest.week}주차</div></div>`
    : '');
}

function renderFetalChart(child, metric) {
  const canvas = document.getElementById('growthChartCanvas');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    if (_chartLoadRetries < 10) {
      setChartWrapAutoHeight(canvas, true);
      canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
        <p style="text-align:center;color:var(--txl);font-size:.78rem;padding:20px 0;margin:0"><span class="icon icon-sm" translate="no" aria-hidden="true">bar_chart</span> 그래프를 불러오는 중...</p>`;
      _chartLoadRetries++;
      setTimeout(() => renderFetalChart(child, metric), 500);
    } else {
      setChartWrapAutoHeight(canvas, true);
      canvas.parentElement.innerHTML = `
        <p style="text-align:center;color:#C62828;font-size:.8rem;padding:30px 10px;line-height:1.6">
          <span class="icon icon-sm" translate="no" aria-hidden="true">wifi_off</span> 그래프 라이브러리를 불러오지 못했어요.<br>인터넷 연결을 확인하고 새로고침 해주세요.
        </p>`;
    }
    return;
  }
  _chartLoadRetries = 0;

  const records = getGrowthRecords(child.id)
    .filter(r => r[metric] != null && r.week != null)
    .sort((a, b) => a.week - b.week);

  const { label, unit, icon: iconName } = fetalMetricLabel[metric];

  if (_chart) { _chart.destroy(); _chart = null; }

  if (records.length < 1) {
    setChartWrapAutoHeight(canvas, true);
    canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
      <p style="text-align:center;color:var(--txl);font-size:.8rem;padding:30px 10px;line-height:1.6">
        ${icon(iconName, { size: 'sm' })} ${label} 기록이 아직 없어요.<br>아래 "＋ 성장 기록 추가"에서 임신 주수와 ${label}를 입력해보세요.
      </p>`;
    return;
  }

  setChartWrapAutoHeight(canvas, false);

  const points = records.map(r => ({ x: r.week, y: r[metric] }));
  const weekMax = Math.max(40, ...points.map(p => p.x)) + 2;

  _chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label: `${child.name} ${label}`,
        data: points,
        borderColor: '#F06292',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#F06292',
        tension: .3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'OwnglyphParkDahyun' }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            title: (items) => `임신 ${items[0]?.parsed.x ?? ''}주차`,
            label:  (ctx)   => `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: weekMax,
          title: { display: true, text: '임신 주수', font: { size: 10, weight: 800 }, color: '#8A849A' },
          ticks: { stepSize: 4, font: { size: 10 } },
        },
        y: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

function renderFetalRecordList(child) {
  const records = getGrowthRecords(child.id);
  const el = document.getElementById('growthRecordList');
  if (!records.length) { el.innerHTML = ''; return; }

  el.innerHTML = records.map(r => `
    <div class="growth-record-item">
      <div style="flex:1">
        <div style="font-weight:800;font-size:.82rem;color:var(--tx)">${r.date}${r.week != null ? ` · 임신 ${r.week}주차` : ''}</div>
        <div style="font-size:.74rem;color:var(--txl);margin-top:2px">
          ${r.weight != null ? `추정 체중 ${r.weight}g` : ''}${r.height != null ? `　태아 길이 ${r.height}cm` : ''}
        </div>
      </div>
      <button onclick="deleteGrowthRecord(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--txl);font-size:.9rem"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span></button>
    </div>`).join('');
}

/** 아이 변경 시 (select onchange) */
export function switchGrowthChild(i) {
  S.selC = +i;
  renderGrowthPage();
}

/** 지표 토글 (키 / 몸무게 / 머리둘레) */
export function switchGrowthMetric(metric) {
  S.growthMetric = metric;
  const child = S.children[S.selC];
  if (!child) return;
  if (child.stage === 'preg') {
    renderFetalMetricToggle();
    renderFetalChart(child, metric);
    return;
  }
  renderMetricToggle();
  renderChart(child, metric);
}

function renderMetricToggle() {
  const cur = S.growthMetric || 'height';
  document.getElementById('growthMetricToggle').innerHTML = Object.keys(growthMetricLabel).map(m => {
    const { label, icon: iconName } = growthMetricLabel[m];
    return `<button class="cvt ${m === cur ? 'on' : ''}" onclick="switchGrowthMetric('${m}')">${icon(iconName, { size: 'sm' })} ${label}</button>`;
  }).join('');
}

/* ── 백분위 요약 카드 3종 ── */
function renderSummary(child) {
  const { latest } = getLatestGrowth(child.id);
  const el = document.getElementById('growthSummaryGrid');

  if (!latest) {
    el.innerHTML = `
      <div class="growth-pct-card growth-pct-empty" onclick="openGrowthModal()">
        <div style="font-size:1.6rem"><span class="icon icon-lg" translate="no" aria-hidden="true">trending_up</span></div>
        <div style="font-weight:800;font-size:.84rem;margin-top:6px">첫 성장 기록을 남겨보세요</div>
        <div style="font-size:.72rem;color:var(--txl);margin-top:2px">탭해서 키·몸무게 입력하기</div>
      </div>`;
    return;
  }

  const ageM = ageMonthsAt(child.birth, latest.date);
  const genderNote = child.gender === 'u' ? '<div class="growth-gender-note">성별 미정 — 평균 기준 백분위</div>' : '';

  el.innerHTML = ['height', 'weight', 'head'].map(metric => {
    const { label, unit, icon: iconName } = growthMetricLabel[metric];
    const value = latest[metric];
    if (value == null) {
      return `<div class="growth-pct-card"><div class="growth-pct-icon">${icon(iconName)}</div><div class="growth-pct-label">${label}</div><div class="growth-pct-value" style="color:var(--txl);font-size:.78rem">기록 없음</div></div>`;
    }
    const pct = computePercentile(value, ageM, child.gender, metric);
    return `
      <div class="growth-pct-card">
        <div class="growth-pct-icon">${icon(iconName)}</div>
        <div class="growth-pct-label">${label}</div>
        <div class="growth-pct-value">${value}${unit}</div>
        ${pct != null ? `<div class="growth-pct-badge">또래 상위 ${100 - pct}% · <b>${pct}%</b></div>` : ''}
      </div>`;
  }).join('') + genderNote;
}

/* ── Sprint 29: 성장 예측 (참고용) ── */
/**
 * 최근 2개 기록의 변화량(하루당 증가율)을 그대로 미래로 연장해서 예측치를 계산.
 * ⚠️ 아주 단순한 선형 추정이라 실제 성장 곡선(영유아기엔 증가폭이 점점 완만해짐)과는
 * 다를 수 있음 — 그래서 "참고용" 문구를 항상 함께 표시하고, 1개월 앞까지만 보여줌
 * (기간이 길어질수록 선형 추정의 오차가 커지기 때문)
 */
function predictGrowth(childId, metric) {
  const records = getGrowthRecords(childId).filter(r => r[metric] != null);
  if (records.length < 2) return null;
  const [latest, prev] = records; // getGrowthRecords는 최신순 정렬
  const daysDiff = (new Date(latest.date) - new Date(prev.date)) / 86400000;
  if (daysDiff < 3) return null; // 너무 가까운 기록 2개로는 추세가 불안정해서 제외

  const rate = (latest[metric] - prev[metric]) / daysDiff; // 하루당 변화량
  const predicted = latest[metric] + rate * 30.44; // 1개월(30.44일) 후 예측
  return { predicted: Math.round(predicted * 10) / 10, current: latest[metric], rate };
}

function renderPrediction(child) {
  const el = document.getElementById('growthPredictionCard');
  if (!el) return;

  const rows = ['height', 'weight', 'head']
    .map(metric => ({ metric, pred: predictGrowth(child.id, metric) }))
    .filter(r => r.pred);

  if (!rows.length) {
    el.innerHTML = ''; // 기록이 2개 미만이거나 간격이 너무 짧으면 예측 카드 자체를 숨김
    return;
  }

  el.innerHTML = `
    <div class="growth-predict-card">
      <div class="growth-predict-title">한 달 뒤 예상 (참고용)</div>
      <div class="growth-predict-rows">
        ${rows.map(({ metric, pred }) => {
          const { label, unit, icon: iconName } = growthMetricLabel[metric];
          const diff = Math.round((pred.predicted - pred.current) * 10) / 10;
          const diffTxt = diff >= 0 ? `+${diff}` : `${diff}`;
          return `
            <div class="growth-predict-row">
              <span>${icon(iconName, { size: 'sm' })} ${label}</span>
              <span class="growth-predict-value">${pred.predicted}${unit} <small>(${diffTxt}${unit})</small></span>
            </div>`;
        }).join('')}
      </div>
      <div class="growth-disclaimer" style="margin-top:8px"><span class="icon icon-sm" translate="no" aria-hidden="true">info</span> 최근 두 기록의 증가 추세를 그대로 연장한 단순 추정치예요. 아이 성장은 시기마다 속도가 달라질 수 있어 실제와 다를 수 있으니, 참고용으로만 봐주세요. 의학적 진단이 아닙니다.</div>
    </div>`;
}


let _chartLoadRetries = 0;

function renderChart(child, metric) {
  const canvas = document.getElementById('growthChartCanvas');
  if (!canvas) return;

  // Sprint 8 버그 수정: Chart.js CDN 로딩이 늦거나 실패하면 예전엔 아무 것도 표시되지 않고
  // 조용히 return 되어 "그래프가 안 보이는" 문제가 있었음.
  // → 로딩 중이면 안내 문구를 보여주고 최대 10회(약 5초) 재시도, 그래도 실패하면 에러 메시지 표시.
  if (typeof Chart === 'undefined') {
    if (_chartLoadRetries < 10) {
      setChartWrapAutoHeight(canvas, true);
      canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
        <p style="text-align:center;color:var(--txl);font-size:.78rem;padding:20px 0;margin:0"><span class="icon icon-sm" translate="no" aria-hidden="true">bar_chart</span> 그래프를 불러오는 중...</p>`;
      _chartLoadRetries++;
      setTimeout(() => renderChart(child, metric), 500);
    } else {
      setChartWrapAutoHeight(canvas, true);
      canvas.parentElement.innerHTML = `
        <p style="text-align:center;color:#C62828;font-size:.8rem;padding:30px 10px;line-height:1.6">
          <span class="icon icon-sm" translate="no" aria-hidden="true">wifi_off</span> 그래프 라이브러리를 불러오지 못했어요.<br>인터넷 연결을 확인하고 새로고침 해주세요.
        </p>`;
    }
    return;
  }
  _chartLoadRetries = 0;

  const records = getGrowthRecords(child.id)
    .filter(r => r[metric] != null)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  const { label, unit } = growthMetricLabel[metric];

  // Sprint 10/11, v0.0.2: X축을 "생후 일수" 고정 축으로 — 오늘 날짜가 축의 70% 지점에 오도록 계산됨
  const ageDaysList  = records.map(r => ageDaysAt(child.birth, r.date));
  const todayAgeDays = ageDaysAt(child.birth, new Date());

  // v0.0.2: "한 달 뒤 예상" 참고선 — 최근 기록 지점에서 예측 지점까지 이어지는 점선을 그래프에도 표시.
  // renderPrediction()의 카드와 같은 계산(predictGrowth)을 그대로 재사용.
  const prediction = predictGrowth(child.id, metric);
  let predictionLine = null;
  if (prediction && ageDaysList.length) {
    const lastAgeDays = ageDaysList[ageDaysList.length - 1];
    const lastValue   = records[records.length - 1][metric];
    const predAgeDays = lastAgeDays + 30; // predictGrowth는 30.44일 기준 — 정수 축이라 30일로 표기
    predictionLine = {
      data: [{ x: lastAgeDays, y: lastValue }, { x: predAgeDays, y: prediction.predicted }],
      ageDays: predAgeDays,
    };
  }

  // 예측 지점까지 포함해서 축 범위를 계산 — 예측선이 잘리지 않도록
  const axisCandidates = predictionLine ? [...ageDaysList, predictionLine.ageDays] : ageDaysList;
  const axisMax = computeAxisMax(todayAgeDays, axisCandidates);
  const refStep = axisMax <= 200 ? 5 : 10; // 참고선을 촘촘하게 그릴 간격(일)

  const myPoints = records.map((r, i) => ({ x: ageDaysList[i], y: r[metric] }));

  // WHO 표준 백분위 참고선(P3/P15/P50/P85/P97)은 기록 유무와 무관하게
  // 0~axisMax 전체를 매끄러운 곡선으로 생성
  const p50Points = [], p85Points = [], p15Points = [], p97Points = [], p03Points = [];
  for (let d = 0; d <= axisMax; d += refStep) {
    const ageM = d / 30.44;
    const g = child.gender;
    p50Points.push({ x: d, y: +referenceMedianAt(ageM, g, metric).toFixed(1) });
    p85Points.push({ x: d, y: +referencePercentileAt(ageM, g, metric, Z_P85).toFixed(1) });
    p15Points.push({ x: d, y: +referencePercentileAt(ageM, g, metric, Z_P15).toFixed(1) });
    p97Points.push({ x: d, y: +referencePercentileAt(ageM, g, metric, Z_P97).toFixed(1) });
    p03Points.push({ x: d, y: +referencePercentileAt(ageM, g, metric, Z_P03).toFixed(1) });
  }

  if (_chart) { _chart.destroy(); _chart = null; }

  if (records.length < 1) {
    const { icon: iconName } = growthMetricLabel[metric];
    setChartWrapAutoHeight(canvas, true);
    canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
      <p style="text-align:center;color:var(--txl);font-size:.8rem;padding:30px 10px;line-height:1.6">
        ${icon(iconName, { size: 'sm' })} ${label} 기록이 아직 없어요.<br>아래 "＋ 성장 기록 추가"에서 ${label}를 입력해보세요.
      </p>`;
    return;
  }

  setChartWrapAutoHeight(canvas, false);

  // 실측(우리 아이)은 진한 분홍 실선, WHO 참고 백분위선은 얇은 회색·점선 계열로 표시.
  // 바깥쪽(P3/P97)일수록 더 흐리게 해서 중앙(P50)이 시각적으로 강조되도록 함.
  const bandStyle = (label, data, opts) => ({
    label, data,
    borderColor: opts.color,
    borderDash: opts.dash,
    borderWidth: opts.width,
    pointRadius: 0,
    tension: .3,
    fill: false,
  });

  const datasets = [
    {
      label: `${child.name} ${label}`,
      data: myPoints,
      borderColor: '#F06292',
      borderWidth: 2.5,
      pointRadius: 4,
      pointBackgroundColor: '#F06292',
      tension: .3,
      fill: false,
    },
    bandStyle('상위 3% (P97)',  p97Points, { color: '#E0C9A6', dash: [2, 3], width: 1 }),
    bandStyle('상위 15% (P85)', p85Points, { color: '#F2B872', dash: [3, 3], width: 1.1 }),
    bandStyle('또래 평균 (P50)', p50Points, { color: '#9E96B0', dash: [5, 4], width: 1.6 }),
    bandStyle('하위 15% (P15)', p15Points, { color: '#7FC6BD', dash: [3, 3], width: 1.1 }),
    bandStyle('하위 3% (P3)',   p03Points, { color: '#AFDAD3', dash: [2, 3], width: 1 }),
  ];

  if (predictionLine) {
    datasets.push({
      // v0.0.2: 그래프 안에도 "한 달 뒤 예상" 점선을 추가 — 실측(진한 실선)과 구분되도록
      // 얇은 점선 + 끝점만 빈 원으로 표시, 실제 기록이 아니라 참고용 추정치임을 시각적으로 구분
      label: '한 달 뒤 예상 (참고용)',
      data: predictionLine.data,
      borderColor: '#F06292',
      borderDash: [2, 3],
      borderWidth: 1.8,
      pointRadius: [0, 4],
      pointBackgroundColor: '#fff',
      pointBorderColor: '#F06292',
      pointBorderWidth: 2,
      tension: 0,
      fill: false,
    });
  }

  _chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'OwnglyphParkDahyun' }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            title: (items) => `생후 ${items[0]?.parsed.x ?? ''}일`,
            label:  (ctx)   => `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: axisMax,
          title: { display: true, text: '생후 일수(일)', font: { size: 10, weight: 800 }, color: '#8A849A' },
          ticks: { stepSize: axisMax / 10, font: { size: 10 } },
        },
        y: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

/* ── 기록 목록 (삭제 가능) ── */
function renderRecordList(child) {
  const records = getGrowthRecords(child.id);
  const el = document.getElementById('growthRecordList');
  if (!records.length) { el.innerHTML = ''; return; }

  el.innerHTML = records.map(r => `
    <div class="growth-record-item">
      <div style="flex:1">
        <div style="font-weight:800;font-size:.82rem;color:var(--tx)">${r.date}</div>
        <div style="font-size:.74rem;color:var(--txl);margin-top:2px">
          ${r.height != null ? `키 ${r.height}cm` : ''}${r.weight != null ? `　몸무게 ${r.weight}kg` : ''}${r.head != null ? `　머리둘레 ${r.head}cm` : ''}
        </div>
      </div>
      <button onclick="deleteGrowthRecord(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--txl);font-size:.9rem"><span class="icon icon-sm" translate="no" aria-hidden="true">delete</span></button>
    </div>`).join('');
}

/** 기록 삭제 */
export function deleteGrowthRecord(id) {
  S.growthRecords = (S.growthRecords || []).filter(r => r.id !== id);
  debounceSave();
  renderGrowthPage();
  window.renderDashboard?.();
}

// window 노출
window.renderGrowthPage    = renderGrowthPage;
window.switchGrowthChild   = switchGrowthChild;
window.switchGrowthMetric  = switchGrowthMetric;
window.deleteGrowthRecord  = deleteGrowthRecord;
