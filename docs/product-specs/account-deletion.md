# 계정 영구 삭제 (자체 탈퇴)

> **상태**: ✅ 구현 완료 (Sprint 17)
> **관련 코드**: `js/accountDelete.js`

사용자 메뉴(우측 상단 프로필 클릭) → "계정 영구 삭제"에서 로그인 계정을 스스로 탈퇴할 수 있음.

- **삭제 대상**: Firestore 문서(`users/{uid}`, 아이 프로필·캘린더·체크리스트·성장 기록 전부) + Firebase Auth 계정 자체
- **삭제 순서**: Firestore 문서 삭제 → Auth 계정 삭제 (Firestore 문서가 이미 없어도 에러 없이 무시하고 계속 진행하도록 처리)
- **오조작 방지**: 되돌릴 수 없는 파괴적 동작이라, "삭제"라는 문구를 정확히 입력해야만 삭제 버튼이 활성화되는 확인 모달을 거침
- **재인증 처리**: Firebase는 로그인한 지 오래된 세션에서는 보안상 계정 삭제를 거부하고 `auth/requires-recent-login` 에러를 던짐 — 이 경우 로그인 방식에 맞춰 자동으로 재인증을 요청한 뒤 삭제를 재시도함
  - 이메일/비밀번호 로그인 → 비밀번호 재입력 모달
  - Google 로그인 → Google 재인증 팝업(`reauthenticateWithPopup`)
- 삭제 완료 후에는 `onAuthStateChanged`가 자동으로 게스트 모드로 전환함 (`docs/product-specs/guest-mode.md` 로직 재사용, 별도 처리 불필요)
