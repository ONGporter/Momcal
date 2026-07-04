/**
 * js/growthChart.js — Sprint 5
 * 성장그래프 탭: 백분위 계산, 차트 렌더, 기록 목록
 *
 * 데이터 흐름:
 *  - 기록 저장/조회는 js/growth.js (getGrowthRecords, getLatestGrowth, openGrowthModal 등)
 *  - 백분위/또래 평균 계산은 data/who-growth.js 의 참고 테이블(근사치)을 사용
 *  - 화면에는 항상 "참고용, 의학적 진단 아님" 문구를 함께 표시
 */

import { S, debounceSave }               from './state.js';
import { showModal, cm }                 from './modal.js';
import { getGrowthRecords, getLatestGrowth, openGrowthModal } from './growth.js';
import { refTableFor, growthMetricLabel } from '../data/who-growth.js';
import { renderAdSlot } from './adSlot.js';

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
 *  참고 테이블 보간 + 백분위 계산 (근사)
 * ══════════════════════════════════════ */

/** 특정 개월수에서의 med/sd를 선형 보간으로 추정 */
function interpAt(table, ageMonths) {
  const pts = table;
  if (ageMonths <= pts[0].m) return { med: pts[0].med, sd: pts[0].sd };
  if (ageMonths >= pts[pts.length - 1].m) {
    const last = pts[pts.length - 1];
    return { med: last.med, sd: last.sd };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (ageMonths >= a.m && ageMonths <= b.m) {
      const t = (ageMonths - a.m) / (b.m - a.m);
      return { med: a.med + (b.med - a.med) * t, sd: a.sd + (b.sd - a.sd) * t };
    }
  }
  return { med: pts[0].med, sd: pts[0].sd };
}

/** 표준정규분포 누적분포함수 (Abramowitz-Stegun 근사) */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * 백분위 계산 (근사치)
 * @returns {number|null} 1~99 사이 정수, 계산 불가 시 null
 */
export function computePercentile(value, ageMonths, gender, metric) {
  if (value == null || isNaN(value)) return null;
  const table = refTableFor(gender)[metric];
  const { med, sd } = interpAt(table, ageMonths);
  if (!sd) return null;
  const z = (value - med) / sd;
  const pct = Math.round(normalCdf(z) * 100);
  return Math.min(99, Math.max(1, pct));
}

/** 특정 개월수에서의 또래 평균(중앙값) 값 */
export function referenceMedianAt(ageMonths, gender, metric) {
  const table = refTableFor(gender)[metric];
  return interpAt(table, ageMonths).med;
}

/* Sprint 9: 상위/하위 10% 참고선 — 표준정규분포 근사 z-score 상수 */
const Z_P10 = -1.2816; // 하위 10%
const Z_P90 = 1.2816;  // 상위 10%

/** 특정 개월수·z-score에서의 참고값 (med + z*sd) — P10/P90 라인 계산용 */
export function referencePercentileAt(ageMonths, gender, metric, z) {
  const table = refTableFor(gender)[metric];
  const { med, sd } = interpAt(table, ageMonths);
  return med + z * sd;
}

/* ══════════════════════════════════════
 *  성장그래프 페이지 렌더
 * ══════════════════════════════════════ */

let _chart = null; // Chart.js 인스턴스 (탭 재진입 시 재사용/파괴)

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
    empty.innerHTML = `<p style="color:var(--txl);text-align:center;padding:30px 10px">👶 아이를 먼저 등록해주세요!</p>`;
    document.getElementById('growthSummaryGrid').innerHTML = '';
    document.getElementById('growthChartWrap').style.display = 'none';
    document.getElementById('growthRecordList').innerHTML = '';
    document.getElementById('growthPredictionCard').innerHTML = '';
    return;
  }

  if (child.stage === 'preg') {
    empty.innerHTML = `<p style="color:var(--txl);text-align:center;padding:30px 10px">🤰 성장 기록은 출생 후부터 남길 수 있어요!</p>`;
    document.getElementById('growthSummaryGrid').innerHTML = '';
    document.getElementById('growthChartWrap').style.display = 'none';
    document.getElementById('growthRecordList').innerHTML = '';
    document.getElementById('growthPredictionCard').innerHTML = '';
    return;
  }

  empty.innerHTML = '';
  document.getElementById('growthChartWrap').style.display = 'block';

  renderSummary(child);
  renderMetricToggle();
  renderChart(child, S.growthMetric || 'height');
  renderRecordList(child);
  renderPrediction(child);
}

/** 아이 변경 시 (select onchange) */
export function switchGrowthChild(i) {
  S.selC = +i;
  renderGrowthPage();
}

/** 지표 토글 (키 / 몸무게 / 머리둘레) */
export function switchGrowthMetric(metric) {
  S.growthMetric = metric;
  renderMetricToggle();
  const child = S.children[S.selC];
  if (child) renderChart(child, metric);
}

function renderMetricToggle() {
  const cur = S.growthMetric || 'height';
  document.getElementById('growthMetricToggle').innerHTML = Object.keys(growthMetricLabel).map(m => {
    const { label, icon } = growthMetricLabel[m];
    return `<button class="cvt ${m === cur ? 'on' : ''}" onclick="switchGrowthMetric('${m}')">${icon} ${label}</button>`;
  }).join('');
}

/* ── 백분위 요약 카드 3종 ── */
function renderSummary(child) {
  const { latest } = getLatestGrowth(child.id);
  const el = document.getElementById('growthSummaryGrid');

  if (!latest) {
    el.innerHTML = `
      <div class="growth-pct-card growth-pct-empty" onclick="openGrowthModal()">
        <div style="font-size:1.6rem">📈</div>
        <div style="font-weight:800;font-size:.84rem;margin-top:6px">첫 성장 기록을 남겨보세요</div>
        <div style="font-size:.72rem;color:var(--txl);margin-top:2px">탭해서 키·몸무게 입력하기</div>
      </div>`;
    return;
  }

  const ageM = ageMonthsAt(child.birth, latest.date);
  const genderNote = child.gender === 'u' ? '<div class="growth-gender-note">성별 미정 — 평균 기준 백분위</div>' : '';

  el.innerHTML = ['height', 'weight', 'head'].map(metric => {
    const { label, unit, icon } = growthMetricLabel[metric];
    const value = latest[metric];
    if (value == null) {
      return `<div class="growth-pct-card"><div class="growth-pct-icon">${icon}</div><div class="growth-pct-label">${label}</div><div class="growth-pct-value" style="color:var(--txl);font-size:.78rem">기록 없음</div></div>`;
    }
    const pct = computePercentile(value, ageM, child.gender, metric);
    return `
      <div class="growth-pct-card">
        <div class="growth-pct-icon">${icon}</div>
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
      <div class="growth-predict-title">🔮 한 달 뒤 예상 (참고용)</div>
      <div class="growth-predict-rows">
        ${rows.map(({ metric, pred }) => {
          const { label, unit, icon } = growthMetricLabel[metric];
          const diff = Math.round((pred.predicted - pred.current) * 10) / 10;
          const diffTxt = diff >= 0 ? `+${diff}` : `${diff}`;
          return `
            <div class="growth-predict-row">
              <span>${icon} ${label}</span>
              <span class="growth-predict-value">${pred.predicted}${unit} <small>(${diffTxt}${unit})</small></span>
            </div>`;
        }).join('')}
      </div>
      <div class="growth-disclaimer" style="margin-top:8px">📌 최근 두 기록의 증가 추세를 그대로 연장한 단순 추정치예요. 아이 성장은 시기마다 속도가 달라질 수 있어 실제와 다를 수 있으니, 참고용으로만 봐주세요. 의학적 진단이 아닙니다.</div>
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
      canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
        <p style="text-align:center;color:var(--txl);font-size:.78rem;padding:20px 0;margin:0">📊 그래프를 불러오는 중...</p>`;
      _chartLoadRetries++;
      setTimeout(() => renderChart(child, metric), 500);
    } else {
      canvas.parentElement.innerHTML = `
        <p style="text-align:center;color:#C62828;font-size:.8rem;padding:30px 10px;line-height:1.6">
          📡 그래프 라이브러리를 불러오지 못했어요.<br>인터넷 연결을 확인하고 새로고침 해주세요.
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

  // 또래 평균/P90/P10 참고선은 기록 유무와 무관하게 0~axisMax 전체를 매끄러운 곡선으로 생성
  const refPoints = [], p90Points = [], p10Points = [];
  for (let d = 0; d <= axisMax; d += refStep) {
    const ageM = d / 30.44;
    refPoints.push({ x: d, y: +referenceMedianAt(ageM, child.gender, metric).toFixed(1) });
    p90Points.push({ x: d, y: +referencePercentileAt(ageM, child.gender, metric, Z_P90).toFixed(1) });
    p10Points.push({ x: d, y: +referencePercentileAt(ageM, child.gender, metric, Z_P10).toFixed(1) });
  }

  if (_chart) { _chart.destroy(); _chart = null; }

  if (records.length < 1) {
    const { icon } = growthMetricLabel[metric];
    canvas.parentElement.innerHTML = `<canvas id="growthChartCanvas"></canvas>
      <p style="text-align:center;color:var(--txl);font-size:.8rem;padding:30px 10px;line-height:1.6">
        ${icon} ${label} 기록이 아직 없어요.<br>아래 "＋ 성장 기록 추가"에서 ${label}를 입력해보세요.
      </p>`;
    return;
  }

  // v0.0.2: "은유 키" 실측 데이터 영역 채우기(fill) 제거 — 실선/점선과 색상만으로 구분하도록 정리
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
    {
      label: '또래 평균 (P50)',
      data: refPoints,
      borderColor: '#B0A8C0',
      borderDash: [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: .3,
      fill: false,
    },
    {
      label: '상위 10% (P90)',
      data: p90Points,
      borderColor: '#FFB74D',
      borderDash: [3, 3],
      borderWidth: 1.2,
      pointRadius: 0,
      tension: .3,
      fill: false,
    },
    {
      // v0.0.2: P90과 같은 색이라 구별이 안 되고, 그 사이 음영 채우기도 헷갈린다는 피드백 —
      // 채우기 제거하고 민트 계열 색으로 바꿔서 상위/하위 참고선을 색으로 구분되게 함
      label: '하위 10% (P10)',
      data: p10Points,
      borderColor: '#4DB6AC',
      borderDash: [3, 3],
      borderWidth: 1.2,
      pointRadius: 0,
      tension: .3,
      fill: false,
    },
  ];

  if (predictionLine) {
    datasets.push({
      // v0.0.2: 그래프 안에도 "한 달 뒤 예상" 점선을 추가 — 실측(진한 실선)과 구분되도록
      // 얇은 점선 + 끝점만 빈 원으로 표시, 실제 기록이 아니라 참고용 추정치임을 시각적으로 구분
      label: '🔮 한 달 뒤 예상 (참고용)',
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
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'Pretendard' }, boxWidth: 12 } },
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
      <button onclick="deleteGrowthRecord(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--txl);font-size:.9rem">🗑</button>
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
