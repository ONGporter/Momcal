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

/** X축 최대값 — 100일 단위로, 기록이 늘어나면 100→200→300... 자동 확장 */
const AXIS_STEP = 100;
function computeAxisMax(ageDaysList) {
  const maxAge = ageDaysList.length ? Math.max(...ageDaysList) : 0;
  return Math.max(AXIS_STEP, Math.ceil((maxAge + 1) / AXIS_STEP) * AXIS_STEP);
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
    return;
  }

  if (child.stage === 'preg') {
    empty.innerHTML = `<p style="color:var(--txl);text-align:center;padding:30px 10px">🤰 성장 기록은 출생 후부터 남길 수 있어요!</p>`;
    document.getElementById('growthSummaryGrid').innerHTML = '';
    document.getElementById('growthChartWrap').style.display = 'none';
    document.getElementById('growthRecordList').innerHTML = '';
    return;
  }

  empty.innerHTML = '';
  document.getElementById('growthChartWrap').style.display = 'block';

  renderSummary(child);
  renderMetricToggle();
  renderChart(child, S.growthMetric || 'height');
  renderRecordList(child);
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

/* ── Chart.js 라인 차트 ── */
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

  // Sprint 10: X축을 "생후 일수" 고정 축으로 — 기록 날짜 간격과 무관하게 실제 날짜 비례 위치에 표시되고,
  // 100일을 넘으면 축이 100→200→300...으로 자동 확장된다.
  const ageDaysList = records.map(r => ageDaysAt(child.birth, r.date));
  const axisMax     = computeAxisMax(ageDaysList);
  const refStep     = axisMax <= 200 ? 5 : 10; // 참고선을 촘촘하게 그릴 간격(일)

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

  _chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: `${child.name} ${label}`,
          data: myPoints,
          borderColor: '#F06292',
          backgroundColor: 'rgba(240,98,146,.12)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#F06292',
          tension: .3,
          fill: true,
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
          label: '하위 10% (P10)',
          data: p10Points,
          borderColor: '#FFB74D',
          borderDash: [3, 3],
          borderWidth: 1.2,
          pointRadius: 0,
          tension: .3,
          fill: '-1', // 바로 위 데이터셋(P90)까지 음영 채우기 → 또래 10~90% 정상범위 밴드
          backgroundColor: 'rgba(255,183,77,.09)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'Nunito' }, boxWidth: 12 } },
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
