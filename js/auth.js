/**
 * js/auth.js
 * Firebase 인증 관련 함수 (로그인, 회원가입, Google, 카카오, 로그아웃)
 */

import {
  auth, googleProvider, functionsApp,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signInWithCustomToken, signOut, updateProfile, httpsCallable,
} from './firebase.js';
import { S } from './state.js';

/**
 * v0.3.5: 카카오 로그인 — Kakao는 Firebase Auth 기본 제공 provider가 아니라서,
 * ① Kakao JS SDK로 access token을 받고 → ② Cloud Function(kakaoLogin, functions/index.js)에
 * 보내서 그 토큰을 검증하고 → ③ Firebase 커스텀 토큰을 발급받아 → ④ signInWithCustomToken()으로
 * 로그인을 완료하는 4단계 다리를 놔야 함. 로그인 화면 자체는 기존 signInGoogle()과 UX가
 * 동일하도록 맞춤(버튼 누르면 팝업 → 완료).
 *
 * ⚠️ 카카오 계정에 이메일 동의항목을 안 받기로 했음(개인 개발자 앱은 이메일 제공이 기본
 * 막혀있어서) — 그래서 카카오로 로그인한 사용자는 Firebase Auth의 email 필드가 비어있음.
 * uid는 'kakao:{카카오 회원번호}'로 별도 네임스페이스를 씀 — 같은 사람이 이메일 계정과
 * 카카오 계정을 각각 만들면 서로 다른 두 계정으로 분리됨(계정 연결/병합 기능은 아직 없음,
 * 필요해지면 별도로 설계할 것 — docs/product-specs/kakao-login.md 참고).
 */
const KAKAO_JS_KEY = 'c587496d93376a2b32061d18fb0a3e9b'; // Kakao Developers에서 발급받은 JavaScript 키(v0.3.6)

function ensureKakaoInit() {
  if (!window.Kakao) throw new Error('카카오 SDK가 로드되지 않았어요');
  if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
}

/* ── 카카오 로그인 ── */
export async function signInKakao() {
  const loader = document.getElementById('authLoading');
  const errEl  = document.getElementById('authErr');
  errEl.textContent = '';
  loader.style.display = 'block';
  try {
    ensureKakaoInit();
    // 1) 카카오 팝업으로 access token 발급 (Kakao.Auth.login은 팝업 방식 — Kakao.Auth.authorize의
    //    리다이렉트 방식과 달리 페이지 이동이 없어서, 번들러·라우터 없는 이 SPA 구조에 훨씬 잘 맞음)
    const kakaoAuthObj = await new Promise((resolve, reject) => {
      window.Kakao.Auth.login({ success: resolve, fail: reject });
    });
    // 2) 그 access token으로 Cloud Function 호출 → Firebase 커스텀 토큰 발급
    const kakaoLogin = httpsCallable(functionsApp, 'kakaoLogin');
    const result = await kakaoLogin({ accessToken: kakaoAuthObj.access_token });
    // 3) 커스텀 토큰으로 실제 Firebase 로그인 완료
    await signInWithCustomToken(auth, result.data.token);
  } catch (e) {
    if (e?.error !== 'access_denied') { // 사용자가 취소한 경우엔 에러 메시지 안 띄움(Google 팝업 취소와 동일하게 조용히 무시)
      errEl.textContent = '카카오 로그인에 실패했어요. 다시 시도해주세요';
    }
  }
  loader.style.display = 'none';
}

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
  if (S.isDemoMode) { window.exitDemoMode?.(); return; } // Sprint 8: 체험 모드는 Firebase 없이 종료
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
  // Sprint 15: 로그인 상태에서는 유저칩을 보여주고, 게스트용 "로그인" 칩은 숨김
  const userChip  = document.getElementById('userChip');
  const loginChip = document.getElementById('guestLoginChip');
  if (userChip)  userChip.style.display  = 'flex';
  if (loginChip) loginChip.style.display = 'none';

  const label = (user.displayName || user.email || '').split('@')[0];
  document.getElementById('userLabel').textContent   = label;
  document.getElementById('userAvatar').textContent  = (label || '?')[0].toUpperCase();
  document.getElementById('userMenuEmail').textContent = user.email || '';
}

export function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
}

/** Sprint 15: 로그인 화면 닫기(✕) — 로그인하지 않고 이전 화면(게스트 모드)으로 돌아가기 */
export function closeAuthScreen() {
  document.getElementById('authScreen').style.display = 'none';
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
window.setAuthTab      = setAuthTab;
window.submitAuth      = submitAuth;
window.signInGoogle    = signInGoogle;
window.signInKakao     = signInKakao;
window.doSignOut       = doSignOut;
window.toggleUserMenu  = toggleUserMenu;
window.showAuthScreen  = showAuthScreen;
window.closeAuthScreen = closeAuthScreen;
