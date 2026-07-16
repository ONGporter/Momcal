/**
 * js/familyShare.js
 * 설정 탭 — 가족 그룹으로 공유
 *
 * v0.0.12: 진짜 가족 그룹 공유(각자 자기 계정으로 로그인해도 실시간 공동 편집) 추가.
 * 그동안 "배우자와 함께 쓰기"(같은 계정으로 로그인해서 공유하는 옛날 방식)를 나란히
 * 뒀었는데, v0.3.14에서 옹짐꾼님 요청으로 완전히 제거하고 가족 그룹 공유 하나로 통합함
 * — 가족 그룹이 각자 자기 계정을 쓸 수 있어 더 상위 호환이라 굳이 두 개를 유지할 필요가
 * 없었음. "배우자와 함께 쓰기"가 갖고 있던 "공유 문구를 카카오톡/문자로 보내는" 기능은
 * 아래 "초대장 보내기" 버튼으로 대체해 가족 그룹 카드 안에 흡수함.
 * "(베타)" 표기도 v0.3.14에서 뗌 — 실사용 검증이 끝난 정식 기능으로 취급.
 *
 * ⚠️ 이 기능이 실제로 안전하게 동작하려면 Firebase 콘솔의 Firestore 보안 규칙에
 * 아래 내용을 추가해야 합니다 (js/state.js 상단 주석에도 동일하게 적어둠):
 *
 *   match /families/{familyId} {
 *     allow read, write: if request.auth != null;
 *   }
 *
 * (초대 코드 자체를 비밀번호처럼 취급하는 모델 — 코드를 아는 사람만 실질적으로
 * 접근 가능하고, 멤버 목록은 표시·관리용으로만 사용)
 */

import { S, createFamily, joinFamily, leaveFamily } from './state.js';
import { showModal, cm } from './modal.js';

const APP_URL = 'https://momcal.app';

/** v0.3.14: 가족 그룹 초대 문구 — 코드를 포함해서 받는 사람이 바로 참여할 수 있게 함 */
function inviteMessage() {
  return `맘캘로 우리 아이 육아 일정을 같이 관리해요\n아래 초대 코드로 "설정 → 가족 그룹으로 공유"에서 참여하면 같은 캘린더·체크리스트·성장 기록을 실시간으로 함께 볼 수 있어요!\n\n초대 코드: ${S.familyId}\n\n${APP_URL}`;
}

/** 설정 탭 "가족 그룹으로 공유" 영역 렌더 — 가족 그룹 소속 여부에 따라 다르게 표시 */
export function renderFamilyShareLink() {
  const wrap = document.getElementById('familyShareWrap');
  if (!wrap) return;

  if (S.familyId) {
    wrap.innerHTML = `
      <div class="install-link" style="cursor:default">
        <span class="install-ico" style="background:var(--pul)"><span class="icon icon-sm" translate="no" aria-hidden="true">family_restroom</span></span>
        <div class="install-txt">
          <div class="install-title">가족 그룹으로 공유 중</div>
          <div class="install-sub">초대 코드 <b style="letter-spacing:1px;color:var(--pkd)">${S.familyId}</b> — 이 코드로 다른 가족도 참여할 수 있어요</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn family-copy-btn" style="flex:1;box-shadow:none"
                onclick="shareFamilyInvite()"><span class="icon icon-sm" translate="no" aria-hidden="true">forward_to_inbox</span> 초대장 보내기</button>
        <button class="btn family-copy-btn" style="flex:1;box-shadow:none"
                onclick="copyFamilyCode()"><span class="icon icon-sm" translate="no" aria-hidden="true">content_copy</span> 코드 복사</button>
      </div>
      <button class="btn family-leave-btn" style="width:100%;margin-top:8px;box-shadow:none"
              onclick="confirmLeaveFamily()">가족 그룹 나가기</button>`;
    return;
  }

  wrap.innerHTML = `
    <div class="install-link" onclick="openFamilyGroupModal()">
      <span class="install-ico" style="background:var(--pul)"><span class="icon icon-sm" translate="no" aria-hidden="true">family_restroom</span></span>
      <div class="install-txt">
        <div class="install-title">가족 그룹으로 공유</div>
        <div class="install-sub">각자 자기 계정으로 로그인해도 함께 볼 수 있어요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** 가족 그룹 만들기/참여하기 모달 */
function openFamilyGroupModal() {
  showModal('가족 그룹으로 공유', `
    <p style="font-size:.8rem;color:var(--txl);font-weight:700;line-height:1.7;margin-bottom:14px">
      각자 자기 계정으로 로그인한 채로 같은 캘린더·체크리스트·성장 기록을 실시간으로
      함께 볼 수 있어요. 가족 그룹에 들어가면
      <span style="color:var(--pkd)">지금 이 계정에 있던 데이터 대신 가족 그룹의 데이터가 보여요</span>
      (그룹에서 나가면 원래 내 데이터로 다시 돌아와요).
    </p>
    <button class="btn bpk" style="width:100%" onclick="createFamilyGroup()"><span class="icon icon-sm" translate="no" aria-hidden="true">add_circle</span> 새 가족 그룹 만들기</button>
    <div style="text-align:center;font-size:.72rem;color:var(--txl);font-weight:800;margin:14px 0">또는</div>
    <div class="fg" style="margin:0">
      <label>초대 코드 입력</label>
      <input id="familyJoinCode" placeholder="예) AB3D9F2K" style="text-transform:uppercase">
    </div>
    <button class="btn" style="width:100%;margin-top:10px;background:var(--pul);color:#4A148C;box-shadow:none"
            onclick="joinFamilyGroup()"><span class="icon icon-sm" translate="no" aria-hidden="true">key</span> 코드로 참여하기</button>
  `);
}

/** 새 가족 그룹 생성 */
async function createFamilyGroup() {
  try {
    const id = await createFamily();
    cm();
    alert(`가족 그룹을 만들었어요! 초대 코드: ${id}\n\n설정 탭 "가족 그룹으로 공유"의 "초대장 보내기"로 배우자에게 바로 보낼 수 있어요.`);
    location.reload();
  } catch (e) {
    // v0.3.12: 실패 시 cm()을 안 불러서 .mo(모달 오버레이, position:fixed;inset:0;z-index:500)가
    // 열린 채로 남아있었음 — 화면 전체를 덮는 투명하지 않은 배경이라 alert 확인 후에도
    // 설정 탭을 포함해 앱 전체가 아예 클릭이 안 되는 것처럼 보이는 버그였음(옹짐꾼님 제보,
    // 2026-07-16). alert보다 먼저 닫아야 사용자가 뒤 화면을 다시 조작할 수 있음
    cm();
    alert('가족 그룹 생성에 실패했어요: ' + e.message);
  }
}

/** 초대 코드로 가족 그룹 참여 */
async function joinFamilyGroup() {
  const code = (document.getElementById('familyJoinCode')?.value || '').trim().toUpperCase();
  if (!code) { alert('초대 코드를 입력해주세요'); return; }
  if (!confirm('가족 그룹에 참여하면 지금 내 계정의 데이터 대신 가족 그룹 데이터가 보여요. 계속할까요?')) return;
  try {
    await joinFamily(code);
    cm();
    location.reload();
  } catch (e) {
    // v0.3.12: createFamilyGroup()과 동일한 버그 — 실패 시 모달이 안 닫혀서 화면 전체가
    // 먹통처럼 보였음
    cm();
    alert('참여에 실패했어요: ' + e.message);
  }
}

/** 초대 코드 클립보드 복사 */
function copyFamilyCode() {
  if (!S.familyId) return;
  navigator.clipboard?.writeText(S.familyId)
    .then(() => alert('초대 코드가 복사됐어요!'))
    .catch(() => {});
}

/**
 * v0.3.14: 가족 그룹 초대장 보내기 — 예전 "배우자와 함께 쓰기"(shareWithFamily)가 하던
 * Web Share API 우선 + 클립보드 폴백 패턴을 그대로 가져오되, 문구에 실제 초대 코드를
 * 포함시켜서 받는 사람이 바로 참여할 수 있게 함
 */
async function shareFamilyInvite() {
  if (!S.familyId) return;
  const text = inviteMessage();

  if (navigator.share) {
    try {
      await navigator.share({ title: '맘캘 MomCal', text, url: APP_URL });
    } catch (e) {
      // 사용자가 공유 시트를 취소한 경우 등 — 별도 처리 불필요
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showModal('초대장 보내기', `
      <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
        초대 문구가 클립보드에 복사됐어요!<br>
        카카오톡·문자 등에 붙여넣어 배우자에게 보내주세요
      </p>
      <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인했어요</button>
    `);
  } catch (e) {
    // 클립보드 접근도 막힌 환경 — 직접 복사할 수 있도록 텍스트 노출
    showModal('초대장 보내기', `
      <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
        아래 문구를 배우자에게 직접 전달해주세요.
      </p>
      <textarea readonly onclick="this.select()" style="width:100%;margin-top:10px;padding:10px;
        border:1.5px solid #EEE0F0;border-radius:12px;font-family:inherit;font-size:.8rem;
        min-height:110px;color:var(--tx)">${text}</textarea>
      <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인했어요</button>
    `);
  }
}

/** 가족 그룹 나가기 확인 */
function confirmLeaveFamily() {
  if (!confirm('가족 그룹에서 나갈까요? 나가면 원래 내 개인 데이터로 돌아가요.')) return;
  leaveFamily().then(() => location.reload());
}

window.renderFamilyShareLink = renderFamilyShareLink;
window.openFamilyGroupModal  = openFamilyGroupModal;
window.createFamilyGroup     = createFamilyGroup;
window.joinFamilyGroup       = joinFamilyGroup;
window.copyFamilyCode        = copyFamilyCode;
window.shareFamilyInvite     = shareFamilyInvite;
window.confirmLeaveFamily    = confirmLeaveFamily;
