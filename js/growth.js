/**
 * js/growth.js — Sprint 4
 * 성장 기록(키·몸무게·머리둘레) 저장 및 조회
 *
 * 홈 대시보드의 "성장" 카드에서 간단히 기록을 남기고 최근 값을 보여주기 위한 모듈입니다.
 * 데이터는 Firestore(`users/{uid}.growthRecords`)에 저장되어 기존 Firebase 구조를 그대로 따릅니다.
 * (성장 그래프·WHO 백분위 화면은 별도 Sprint에서 이 데이터를 그대로 활용해 확장할 예정입니다.)
 */

import { S, debounceSave } from './state.js';
import { showModal, cm }   from './modal.js';
import { today }           from './utils.js';

/** 특정 아이의 성장 기록을 날짜순(최신순)으로 반환 */
export function getGrowthRecords(childId) {
  return (S.growthRecords || [])
    .filter(r => r.childId === childId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** 특정 아이의 최신 기록과 그 직전 기록을 반환 (증감 표시용) */
export function getLatestGrowth(childId) {
  const records = getGrowthRecords(childId);
  return { latest: records[0] || null, prev: records[1] || null };
}

/**
 * 기록 추가 모달 열기
 * v0.0.23: 임신 중(태아)인 경우 키/몸무게(cm/kg) 대신 임신 주수·추정 체중(g)·태아 길이(cm)를
 * 입력받도록 분기함 — "임산부도 실제 태아 크기를 기록하고 싶다"는 요청으로 추가
 */
export function openGrowthModal() {
  const child = S.children[S.selC];
  if (!child) { alert('먼저 아이를 등록해주세요'); return; }
  const { latest } = getLatestGrowth(child.id);

  if (child.stage === 'preg') {
    showModal(`${child.name} 태아 성장 기록`, `
      <div class="fg">
        <label>측정일</label>
        <input type="date" id="grDate" value="${today()}">
      </div>
      <div class="fg">
        <label>임신 주수</label>
        <input type="number" min="1" max="42" id="grWeek" placeholder="예) 20" value="${latest?.week ?? child.week ?? ''}">
      </div>
      <div class="fg2">
        <div class="fg" style="margin:0">
          <label>추정 체중 (g)</label>
          <input type="number" step="1" id="grFetalWeight" placeholder="예) 330" value="${latest?.weight ?? ''}">
        </div>
        <div class="fg" style="margin:0">
          <label>태아 길이 (cm)</label>
          <input type="number" step="0.1" id="grFetalHeight" placeholder="예) 25.7" value="${latest?.height ?? ''}">
        </div>
      </div>
      <div style="font-size:.72rem;color:var(--txl);margin:-4px 0 12px;line-height:1.5">초음파 검진에서 알려주신 수치를 그대로 적어두면 돼요. 아기마다 크기 차이가 있으니 참고 기록용으로만 남겨주세요.</div>
      <button class="btn bpk" onclick="saveGrowthRecord()"><span class="icon icon-sm" translate="no" aria-hidden="true">save</span> 기록 저장</button>
    `);
    return;
  }

  showModal(`${child.name} 성장 기록`, `
    <div class="fg">
      <label>측정일</label>
      <input type="date" id="grDate" value="${today()}">
    </div>
    <div class="fg2">
      <div class="fg" style="margin:0">
        <label>키 (cm)</label>
        <input type="number" step="0.1" id="grHeight" placeholder="예) 68.5" value="${latest?.height ?? ''}">
      </div>
      <div class="fg" style="margin:0">
        <label>몸무게 (kg)</label>
        <input type="number" step="0.1" id="grWeight" placeholder="예) 8.2" value="${latest?.weight ?? ''}">
      </div>
    </div>
    <div class="fg">
      <label>머리둘레 (cm, 선택)</label>
      <input type="number" step="0.1" id="grHead" placeholder="예) 44.0" value="${latest?.head ?? ''}">
    </div>
    <button class="btn bpk" onclick="saveGrowthRecord()"><span class="icon icon-sm" translate="no" aria-hidden="true">save</span> 기록 저장</button>
  `);
}

/** 기록 저장 */
export function saveGrowthRecord() {
  const child = S.children[S.selC];
  if (!child) { cm(); return; }

  const date = document.getElementById('grDate')?.value || today();

  if (child.stage === 'preg') {
    const week   = parseInt(document.getElementById('grWeek')?.value, 10);
    const weight = parseFloat(document.getElementById('grFetalWeight')?.value);
    const height = parseFloat(document.getElementById('grFetalHeight')?.value);

    if (isNaN(weight) && isNaN(height)) {
      alert('추정 체중 또는 태아 길이 중 하나는 입력해주세요');
      return;
    }

    if (!S.growthRecords) S.growthRecords = [];
    S.growthRecords.push({
      id: Date.now(),
      childId: child.id,
      date,
      week:   isNaN(week)   ? null : week,
      height: isNaN(height) ? null : height, // cm
      weight: isNaN(weight) ? null : weight, // g (출생 후 기록과 단위가 다름 — isFetal로 구분)
      head:   null,
      isFetal: true,
    });

    cm();
    debounceSave();
    window.renderHome?.();
    if (document.getElementById('pg-growth')?.classList.contains('on')) {
      window.renderGrowthPage?.();
    }
    return;
  }

  const height = parseFloat(document.getElementById('grHeight')?.value);
  const weight = parseFloat(document.getElementById('grWeight')?.value);
  const head   = parseFloat(document.getElementById('grHead')?.value);

  if (isNaN(height) && isNaN(weight)) {
    alert('키 또는 몸무게 중 하나는 입력해주세요');
    return;
  }

  if (!S.growthRecords) S.growthRecords = [];
  S.growthRecords.push({
    id: Date.now(),
    childId: child.id,
    date,
    height: isNaN(height) ? null : height,
    weight: isNaN(weight) ? null : weight,
    head:   isNaN(head)   ? null : head,
    isFetal: false,
  });

  cm();
  debounceSave();
  window.renderHome?.();
  if (document.getElementById('pg-growth')?.classList.contains('on')) {
    window.renderGrowthPage?.();
  }
}

// window 노출
window.openGrowthModal  = openGrowthModal;
window.saveGrowthRecord = saveGrowthRecord;
