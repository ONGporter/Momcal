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
 * v0.3.7: Kakao.Auth.login()(팝업 방식)이 현재 SDK 버전(2.8.0)에 없다는 게 실제 콘솔 에러로
 * 확인됨(TypeError: Kakao.Auth.login is not a function) — v0.3.5에서 예전 문서를 믿고 만든
 * 게 틀렸음. 지금 카카오 JS SDK가 지원하는 유일한 방식은 Kakao.Auth.authorize()(리다이렉트
 * 방식)라, 로그인 흐름 전체를 이걸로 바꿈:
 *   1) signInKakao() — Kakao.Auth.authorize() 호출 → 브라우저가 카카오 로그인 페이지로 이동
 *   2) 로그인 완료되면 카카오가 KAKAO_REDIRECT_URI로 "?code=인가코드"를 붙여서 되돌려줌
 *   3) 앱이 다시 로드되면서 handleKakaoRedirectIfNeeded()가 그 code를 발견 → Cloud Function에
 *      보내 access token으로 교환(서버에서 REST API 키로 처리, functions/index.js 참고) →
 *      Firebase 커스텀 토큰 발급 → signInWithCustomToken()으로 로그인 완료
 * Google처럼 팝업으로 끝나는 방식이 아니라 페이지가 한 번 이동했다 돌아오는 방식이라 UX가
 * 살짝 다름(로딩이 한 번 더 보임) — 대신 지금 SDK에서 실제로 동작하는 유일한 방식임.
 *
 * ⚠️ KAKAO_REDIRECT_URI는 Kakao Developers의 "카카오 로그인 > Redirect URI"에 등록한 값과
 * 정확히 똑같아야 함(한 글자라도 다르면 카카오가 거부함) — 등록 안 돼있으면 로그인 페이지
 * 이동 자체가 에러로 막힘.
 */
const KAKAO_JS_KEY = 'c587496d93376a2b32061d18fb0a3e9b'; // Kakao Developers에서 발급받은 JavaScript 키(v0.3.6)
const KAKAO_REDIRECT_URI = 'https://momcal.app/'; // Kakao Developers "Redirect URI"에 이 값 그대로 등록 필요

function ensureKakaoInit() {
  if (!window.Kakao) throw new Error('카카오 SDK가 로드되지 않았어요');
  if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
}

/* ── 카카오 로그인 시작 — 버튼 클릭 시 카카오 로그인 페이지로 이동 ── */
export function signInKakao() {
  try {
    ensureKakaoInit();
  } catch (e) {
    document.getElementById('authErr').textContent = '카카오 로그인을 사용할 수 없어요';
    return;
  }
  window.Kakao.Auth.authorize({
    redirectUri: KAKAO_REDIRECT_URI,
    scope: 'profile_nickname,profile_image',
  });
}

/**
 * 카카오 로그인 페이지에서 돌아왔을 때(URL에 ?code=... 붙어서 옴) 로그인을 마무리함 —
 * js/app.js가 앱 시작 시 한 번 호출함. code가 없으면(카카오 로그인을 거치지 않은 일반
 * 방문) 아무 일도 안 하고 조용히 리턴.
 */
export async function handleKakaoRedirectIfNeeded() {
  const params = new URLSearchParams(location.search);
  const code  = params.get('code');
  const error = params.get('error'); // 사용자가 카카오 로그인 화면에서 취소한 경우 등
  if (!code && !error) return;
  history.replaceState(null, '', location.pathname); // 새로고침해도 code가 재사용되지 않도록 URL 정리
  if (error) return; // 취소는 조용히 무시(Google 팝업 취소와 동일하게 처리)

  const loader = document.getElementById('authLoading');
  if (loader) loader.style.display = 'block';
  try {
    const kakaoLoginFn = httpsCallable(functionsApp, 'kakaoLogin');
    const result = await kakaoLoginFn({ code, redirectUri: KAKAO_REDIRECT_URI });
    await signInWithCustomToken(auth, result.data.token);
  } catch (e) {
    console.error('카카오 로그인 실패', e); // v0.3.7: 원인 파악 쉽게 콘솔에도 남김
    showAuthScreen();
    const errEl = document.getElementById('authErr');
    if (errEl) errEl.textContent = '카카오 로그인에 실패했어요. 다시 시도해주세요';
  }
  if (loader) loader.style.display = 'none';
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
