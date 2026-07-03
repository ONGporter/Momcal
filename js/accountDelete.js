/**
 * js/accountDelete.js — Sprint 17
 * 계정 자체 탈퇴(영구 삭제) 기능
 *
 * 삭제 대상: Firestore 문서(users/{uid}에 저장된 모든 데이터) + Firebase Auth 계정 자체.
 * 되돌릴 수 없는 파괴적 동작이라, 그냥 버튼 하나로 바로 실행하지 않고
 * 확인 문구를 정확히 입력해야만 삭제 버튼이 활성화되는 확인 모달을 거친다.
 *
 * Firebase는 보안상 "최근에 로그인한 세션"에서만 계정 삭제(deleteUser)를 허용한다.
 * 로그인한 지 오래됐으면 auth/requires-recent-login 에러가 나는데, 이 경우
 * 로그인 방식(이메일/비밀번호 vs Google)에 맞춰 재인증을 한 번 더 받은 뒤 재시도한다.
 */

import {
  auth, googleProvider,
  deleteUser, deleteDoc,
  reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider,
} from './firebase.js';
import { userDocRef } from './state.js';
import { showModal, cm } from './modal.js';

const CONFIRM_WORD = '삭제';

/** 1단계: 삭제 확인 모달 — 정확한 문구를 입력해야 버튼이 활성화됨 */
export function openDeleteAccountModal() {
  const user = auth.currentUser;
  if (!user) return;

  showModal('⚠️ 계정 영구 삭제', `
    <div style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7;text-align:left">
      <p>계정을 삭제하면 아래 데이터가 <b style="color:#C62828">전부 영구적으로 사라지고 복구할 수 없어요.</b></p>
      <ul style="margin:10px 0;padding-left:20px;color:var(--txl);font-size:.8rem">
        <li>등록된 아이/임신 프로필</li>
        <li>캘린더 일정·스티커</li>
        <li>체크리스트 완료 기록</li>
        <li>성장 기록</li>
        <li>로그인 계정 자체</li>
      </ul>
      <p style="margin-top:14px">정말 삭제하려면 아래 칸에 <b style="color:var(--pkd)">"${CONFIRM_WORD}"</b>라고 입력해주세요.</p>
      <input id="delConfirmInput" placeholder="${CONFIRM_WORD}" autocomplete="off"
             oninput="document.getElementById('delConfirmBtn').disabled = (this.value !== '${CONFIRM_WORD}')"
             style="width:100%;margin-top:8px;padding:11px 13px;border:1.5px solid #EEE0F0;
                    border-radius:12px;font-family:inherit;font-size:.86rem;box-sizing:border-box">
      <div id="delErr" style="color:#C62828;font-size:.76rem;font-weight:800;margin-top:8px;min-height:1em"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn" onclick="cm()"
                style="flex:1;background:#F0EAF0;color:var(--txl)">취소</button>
        <button id="delConfirmBtn" disabled onclick="confirmDeleteAccount()"
                style="flex:1;background:#C62828;color:#fff;border:none;border-radius:13px;
                       padding:12px 18px;font-weight:800;font-family:inherit;cursor:pointer"
                onmouseover="if(!this.disabled)this.style.opacity='.85'"
                onmouseout="this.style.opacity='1'">영구 삭제</button>
      </div>
    </div>
  `);
}

/** 2단계: 실제 삭제 실행 (확인 모달의 삭제 버튼에서 호출) */
export async function confirmDeleteAccount() {
  const btn = document.getElementById('delConfirmBtn');
  const err = document.getElementById('delErr');
  if (btn) { btn.disabled = true; btn.textContent = '삭제하는 중...'; }
  if (err) err.textContent = '';

  try {
    await performDeletion();
    cm();
    // 탈퇴 완료 안내 — onAuthStateChanged가 곧바로 게스트 모드로 전환해줌
    setTimeout(() => {
      showModal('👋 탈퇴가 완료됐어요', `
        <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
          그동안 맘캘을 이용해주셔서 감사했어요.<br>모든 데이터가 삭제됐습니다.
        </p>
        <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인</button>
      `);
    }, 200);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      await handleReauthThenDelete(err, btn);
    } else {
      if (err) err.textContent = '삭제 중 오류가 발생했어요. 다시 시도해주세요.';
      if (btn) { btn.disabled = false; btn.textContent = '영구 삭제'; }
      console.error('계정 삭제 실패', e);
    }
  }
}

/** Firestore 문서 + Auth 계정 삭제 (순서: Firestore 먼저 → Auth) */
async function performDeletion() {
  const user = auth.currentUser;
  await deleteDoc(userDocRef()).catch(() => {}); // 이미 지워졌어도 무시하고 계속 진행
  await deleteUser(user);
}

/** 세션이 오래돼 재인증이 필요한 경우 — 로그인 방식에 맞춰 재인증 후 삭제 재시도 */
async function handleReauthThenDelete(err, btn) {
  const user = auth.currentUser;
  const providerId = user.providerData[0]?.providerId;

  try {
    if (providerId === 'google.com') {
      await reauthenticateWithPopup(user, googleProvider);
    } else {
      // 이메일/비밀번호 로그인 — 비밀번호를 다시 물어봄
      const pw = await promptPassword();
      if (pw === null) { // 사용자가 취소함
        if (btn) { btn.disabled = false; btn.textContent = '영구 삭제'; }
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, pw);
      await reauthenticateWithCredential(user, credential);
    }
    // 재인증 성공 — 삭제 재시도
    await performDeletion();
    cm();
    setTimeout(() => {
      showModal('👋 탈퇴가 완료됐어요', `
        <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
          그동안 맘캘을 이용해주셔서 감사했어요.<br>모든 데이터가 삭제됐습니다.
        </p>
        <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인</button>
      `);
    }, 200);
  } catch (e2) {
    if (err) err.textContent = '재인증에 실패했어요. 다시 시도해주세요.';
    if (btn) { btn.disabled = false; btn.textContent = '영구 삭제'; }
    console.error('재인증 실패', e2);
  }
}

/** 비밀번호 재입력 모달 (Promise로 값을 반환 — 취소 시 null) */
function promptPassword() {
  return new Promise((resolve) => {
    showModal('🔐 본인 확인', `
      <p style="font-size:.84rem;font-weight:700;color:var(--tx);margin-bottom:10px">
        보안을 위해 비밀번호를 다시 한 번 입력해주세요.
      </p>
      <input id="reauthPwInput" type="password" placeholder="비밀번호" autocomplete="current-password"
             style="width:100%;padding:11px 13px;border:1.5px solid #EEE0F0;border-radius:12px;
                    font-family:inherit;font-size:.86rem;box-sizing:border-box">
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn" onclick="window.__reauthCancel()"
                style="flex:1;background:#F0EAF0;color:var(--txl)">취소</button>
        <button class="btn bpk" onclick="window.__reauthSubmit()" style="flex:1">확인</button>
      </div>
    `);
    window.__reauthSubmit = () => {
      const val = document.getElementById('reauthPwInput')?.value || '';
      resolve(val);
    };
    window.__reauthCancel = () => {
      cm();
      resolve(null);
    };
  });
}

window.openDeleteAccountModal = openDeleteAccountModal;
window.confirmDeleteAccount   = confirmDeleteAccount;
