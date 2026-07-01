/**
 * js/auth.js
 * Firebase 인증 관련 함수 (로그인, 회원가입, Google, 로그아웃)
 */

import {
  auth, googleProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile,
} from './firebase.js';

/* ── 로그인/회원가입 탭 전환 ── */
let authMode = 'login'; // 'login' | 'signup'

export function setAuthTab(mode) {
  authMode = mode;
  document.getElementById('tabLogin').classList.toggle('on',  mode === 'login');
  document.getElementById('tabSignup').classList.toggle('on', mode === 'signup');
  document.getElementById('nameFg').style.display         = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').textContent    = mode === 'signup' ? '회원가입' : '로그인';
  document.getElementById('authErr').textContent          = '';
}

/* ── Firebase 에러 코드 → 한국어 메시지 ── */
function authErrMsg(code) {
  const map = {
    'auth/invalid-email':        '이메일 형식이 올바르지 않아요',
    'auth/user-not-found':       '가입되지 않은 이메일이에요',
    'auth/wrong-password':       '비밀번호가 틀렸어요',
    'auth/invalid-credential':   '이메일 또는 비밀번호가 틀렸어요',
    'auth/email-already-in-use': '이미 가입된 이메일이에요',
    'auth/weak-password':        '비밀번호는 6자 이상이어야 해요',
    'auth/popup-closed-by-user': '',
  };
  return map[code] || '오류가 발생했어요. 다시 시도해주세요';
}

/* ── 이메일 로그인 / 회원가입 ── */
export async function submitAuth() {
  const email  = document.getElementById('authEmail').value.trim();
  const pw     = document.getElementById('authPw').value;
  const name   = document.getElementById('authName').value.trim();
  const errEl  = document.getElementById('authErr');
  const loader = document.getElementById('authLoading');

  errEl.textContent = '';
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요'; return; }
  if (authMode === 'signup' && !name) { errEl.textContent = '이름을 입력해주세요'; return; }

  loader.style.display = 'block';
  try {
    if (authMode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pw);
    }
  } catch (e) {
    errEl.textContent = authErrMsg(e.code);
  }
  loader.style.display = 'none';
}

/* ── Google 로그인 ── */
export async function signInGoogle() {
  const loader = document.getElementById('authLoading');
  loader.style.display = 'block';
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    document.getElementById('authErr').textContent = authErrMsg(e.code);
  }
  loader.style.display = 'none';
}

/* ── 로그아웃 ── */
export async function doSignOut() {
  await signOut(auth);
  toggleUserMenu(false);
}

/* ── 사용자 메뉴 토글 ── */
export function toggleUserMenu(force) {
  const m = document.getElementById('userMenu');
  const show = force !== undefined ? force : m.style.display === 'none';
  m.style.display = show ? 'block' : 'none';
}

/* ── 앱 화면 표시 / 인증 화면 표시 ── */
export function showApp(user) {
  document.getElementById('authScreen').style.display = 'none';
  const label = (user.displayName || user.email || '').split('@')[0];
  document.getElementById('userLabel').textContent   = label;
  document.getElementById('userAvatar').textContent  = (label || '?')[0].toUpperCase();
  document.getElementById('userMenuEmail').textContent = user.email || '';
}

export function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
}

// 외부 클릭 시 사용자 메뉴 닫기
document.addEventListener('click', (e) => {
  const chip = document.getElementById('userChip');
  const menu = document.getElementById('userMenu');
  if (menu && chip && !chip.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// window 노출
window.setAuthTab     = setAuthTab;
window.submitAuth     = submitAuth;
window.signInGoogle   = signInGoogle;
window.doSignOut      = doSignOut;
window.toggleUserMenu = toggleUserMenu;
