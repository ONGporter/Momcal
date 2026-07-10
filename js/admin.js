/**
 * js/admin.js (v0.0.39)
 * admin.html 전용 스크립트 — 앱 본체(index.html/js/app.js)와는 완전히 분리된 별도 진입점.
 *
 * 접근 제어 2단계:
 *  1) 이 파일(클라이언트) — Firebase Auth 로그인 + ID 토큰의 커스텀 클레임(admin===true)
 *     확인. 클레임은 서버(Admin SDK)만 발급 가능하고 위조 불가능하지만, 이 화면의
 *     체크는 어디까지나 "UI를 보여줄지"만 결정함 — 실제 방어선은 아래 2)번.
 *  2) Firestore 보안 규칙 — adminBroadcasts 컬렉션에 대해 request.auth.token.admin
 *     === true 인 사용자만 read/write 허용하도록 Firebase 콘솔에서 반드시 설정해야 함
 *     (AGENTS.md 규칙상 보안 규칙은 코드로 대체 불가 — docs/product-specs/admin-push.md
 *     에 적어둔 규칙 문자열을 콘솔에 그대로 추가할 것). 이 규칙이 없으면 클레임이 없는
 *     사용자도 브라우저 콘솔에서 직접 Firestore를 호출해 발송을 시도할 수 있음.
 *  관리자 지정 자체는 functions/scripts/set-admin-claim.cjs를 로컬에서 1회 실행.
 */

import {
  auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, getIdTokenResult,
  db, collection, addDoc, query, orderBy, limit, getDocs,
} from './firebase.js';

let currentUser = null;
let isAdmin = false;

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ── 화면 전환 ── */
function showScreen(name) {
  ['adminLoginScreen', 'adminNoAccessScreen', 'adminPanel'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = id === name ? '' : 'none';
  });
}

/* ── 로그인 ── */
window.adminLogin = async function adminLogin() {
  const email = $('adminEmail').value.trim();
  const pw = $('adminPw').value;
  const errEl = $('adminLoginErr');
  errEl.textContent = '';
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요'; return; }

  const btn = $('adminLoginBtn');
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // 이후 처리는 onAuthStateChanged가 이어받음
  } catch (e) {
    errEl.textContent = '로그인 실패 — 이메일/비밀번호를 확인해주세요';
  } finally {
    btn.disabled = false;
  }
};

window.adminLogout = async function adminLogout() {
  await signOut(auth);
};

/* ── 인증 상태 변화 ── */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    isAdmin = false;
    showScreen('adminLoginScreen');
    return;
  }
  try {
    // forceRefresh(true) — 방금 관리자 권한을 부여받은 경우에도 캐시된 옛 토큰이 아니라
    // 최신 커스텀 클레임을 확인하도록 강제 갱신
    const tokenResult = await getIdTokenResult(user, true);
    isAdmin = tokenResult.claims?.admin === true;
  } catch (e) {
    console.error('권한 확인 실패', e);
    isAdmin = false;
  }

  if (!isAdmin) {
    showScreen('adminNoAccessScreen');
    return;
  }
  showScreen('adminPanel');
  const nameEl = $('adminUserLabel');
  if (nameEl) nameEl.textContent = user.email || user.uid;
  loadHistory();
});

/* ── 발송 폼 — 대상 선택에 따른 세부 필드 토글 ── */
window.onBcTargetChange = function onBcTargetChange() {
  const target = $('bcTarget').value;
  $('bcAgeFields').style.display = target === 'ageRange' ? '' : 'none';
  $('bcUidFields').style.display = target === 'uid' ? '' : 'none';
};

function targetLabel(target, params = {}) {
  if (target === 'all') return '전체';
  if (target === 'pregnant') return '임산부';
  if (target === 'ageRange') return `${params.minMonth ?? 0}~${params.maxMonth ?? '∞'}개월`;
  if (target === 'uid') return `특정 사용자 ${(params.uids || []).length}명`;
  return target;
}

/* ── 발송/예약 등록 ── */
window.submitBroadcast = async function submitBroadcast() {
  const msgEl = $('bcMsg');
  msgEl.textContent = '';
  msgEl.className = 'admin-msg';

  const title = $('bcTitle').value.trim();
  const body = $('bcBody').value.trim();
  const target = $('bcTarget').value;
  const scheduleVal = $('bcSchedule').value;

  if (!title || !body) { msgEl.textContent = '제목과 내용을 입력해주세요'; msgEl.classList.add('err'); return; }

  const targetParams = {};
  if (target === 'ageRange') {
    const min = Number($('bcMinMonth').value);
    const max = Number($('bcMaxMonth').value);
    targetParams.minMonth = Number.isFinite(min) && $('bcMinMonth').value !== '' ? min : 0;
    targetParams.maxMonth = Number.isFinite(max) && $('bcMaxMonth').value !== '' ? max : 999;
    if (targetParams.minMonth > targetParams.maxMonth) {
      msgEl.textContent = '연령 범위가 올바르지 않아요 (최소 ≤ 최대)'; msgEl.classList.add('err'); return;
    }
  }
  if (target === 'uid') {
    const raw = $('bcUids').value.trim();
    const uids = raw.split(/[\s,]+/).filter(Boolean);
    if (!uids.length) { msgEl.textContent = '대상 UID를 한 개 이상 입력해주세요'; msgEl.classList.add('err'); return; }
    targetParams.uids = uids;
  }

  let scheduledAt = null;
  if (scheduleVal) {
    scheduledAt = new Date(scheduleVal).getTime();
    if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
      msgEl.textContent = '예약 시각은 현재보다 미래여야 해요'; msgEl.classList.add('err'); return;
    }
  }

  const btn = $('bcSubmitBtn');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'adminBroadcasts'), {
      title, body, target, targetParams,
      scheduledAt,
      status: 'pending',
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email || null,
      createdAt: Date.now(),
      sentAt: null,
      result: null,
    });
    msgEl.textContent = scheduledAt
      ? '예약 발송이 등록됐어요 (예약 시각 5분 이내에 발송돼요)'
      : '발송을 시작했어요 (잠시 후 발송 이력에서 결과를 확인해주세요)';
    msgEl.classList.add('ok');
    $('bcTitle').value = '';
    $('bcBody').value = '';
    $('bcSchedule').value = '';
    $('bcUids').value = '';
    loadHistory();
  } catch (e) {
    console.error('발송 등록 실패', e);
    msgEl.textContent = '등록 실패 — Firestore 보안 규칙(adminBroadcasts)이 설정돼있는지 확인해주세요';
    msgEl.classList.add('err');
  } finally {
    btn.disabled = false;
  }
};

/* ── 발송 이력 ── */
async function loadHistory() {
  const listEl = $('bcHistory');
  if (!listEl) return;
  listEl.innerHTML = '<div class="admin-empty">불러오는 중…</div>';
  try {
    const q = query(collection(db, 'adminBroadcasts'), orderBy('createdAt', 'desc'), limit(30));
    const snap = await getDocs(q);
    if (snap.empty) { listEl.innerHTML = '<div class="admin-empty">발송 이력이 없어요</div>'; return; }
    listEl.innerHTML = snap.docs.map((d) => renderHistoryItem(d.data())).join('');
  } catch (e) {
    console.error('이력 조회 실패', e);
    listEl.innerHTML = '<div class="admin-empty">불러오기 실패 — 콘솔에서 오류를 확인해주세요</div>';
  }
}
window.refreshBcHistory = loadHistory;

function renderHistoryItem(b) {
  const statusMap = { pending: '⏳ 대기중', sent: '✅ 발송완료', failed: '⚠️ 실패' };
  const statusLabel = statusMap[b.status] || b.status;
  const when = b.scheduledAt ? new Date(b.scheduledAt).toLocaleString('ko-KR') : '즉시 발송';
  let resultTxt = '';
  if (b.result) {
    resultTxt = `대상 ${b.result.targetUserCount}명 (토큰 보유 ${b.result.sentUserCount}명) · 성공 ${b.result.successCount} / 실패 ${b.result.failCount}`;
  } else if (b.status === 'failed' && b.error) {
    resultTxt = b.error;
  }
  return `
    <div class="admin-history-item">
      <div class="admin-history-top">
        <strong>${escapeHtml(b.title)}</strong>
        <span class="admin-status admin-status-${escapeHtml(b.status)}">${statusLabel}</span>
      </div>
      <div class="admin-history-body">${escapeHtml(b.body)}</div>
      <div class="admin-history-meta">
        대상: ${escapeHtml(targetLabel(b.target, b.targetParams))} · ${escapeHtml(when)}${resultTxt ? ' · ' + escapeHtml(resultTxt) : ''}
      </div>
    </div>`;
}
