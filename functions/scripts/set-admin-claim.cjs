/**
 * functions/scripts/set-admin-claim.cjs (v0.0.39)
 *
 * admin.html 접근 권한(관리자 여부)은 Firestore 필드가 아니라 Firebase Auth의
 * "커스텀 클레임"(request.auth.token.admin === true)으로 판별한다 — 이 값은
 * 브라우저나 Firestore 보안 규칙만으로는 절대 설정할 수 없고, Admin SDK가 있는
 * 서버/로컬 환경에서만 부여할 수 있어서 이 스크립트가 필요함(admin.html 자체를
 * 만드는 것과는 별개로, "누구를 관리자로 만들지"는 항상 이 스크립트로 수동 실행해야 함).
 *
 * 사용법 (functions/ 디렉터리에서 실행):
 *   node scripts/set-admin-claim.cjs <UID>            관리자 권한 부여
 *   node scripts/set-admin-claim.cjs <UID> --remove    관리자 권한 해제
 *   node scripts/set-admin-claim.cjs <UID> --check     현재 상태만 확인(변경 없음)
 *
 * UID 찾는 법: Firebase 콘솔 → Authentication → Users 목록에서 계정 이메일 옆의
 * "사용자 UID" 컬럼 값을 복사.
 *
 * 사전 준비(최초 1회, 로컬 환경에 이미 돼있다면 생략):
 *   gcloud auth application-default login
 *   (gcloud CLI가 없다면 https://cloud.google.com/sdk/docs/install 참고 —
 *    firebase-tools로 `firebase login`만 해둔 상태로는 Admin SDK 인증이 안 됨,
 *    별도로 gcloud ADC 로그인이 한 번 더 필요함)
 *
 * 실행 후 해당 계정은 "로그아웃 후 다시 로그인"해야 새 클레임이 적용됨
 * (Firebase는 커스텀 클레임을 ID 토큰 갱신 시점에만 반영함).
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const uid = process.argv[2];
const isRemove = process.argv.includes('--remove');
const isCheck = process.argv.includes('--check');

if (!uid) {
  console.error('사용법: node scripts/set-admin-claim.cjs <UID> [--remove|--check]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

async function main() {
  const auth = getAuth();
  const user = await auth.getUser(uid).catch((e) => {
    console.error(`❌ uid=${uid} 사용자를 찾을 수 없음:`, e.message);
    process.exit(1);
  });

  if (isCheck) {
    const isAdmin = user.customClaims?.admin === true;
    console.log(`${user.email || uid} — 관리자 여부: ${isAdmin ? '✅ admin' : '❌ 일반 사용자'}`);
    return;
  }

  const nextClaims = { ...(user.customClaims || {}) };
  if (isRemove) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(uid, nextClaims);
  console.log(
    `✅ ${user.email || uid} 관리자 권한 ${isRemove ? '해제' : '부여'} 완료 — ` +
    `해당 계정은 로그아웃 후 다시 로그인해야 admin.html 접근이 적용됩니다.`
  );
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
