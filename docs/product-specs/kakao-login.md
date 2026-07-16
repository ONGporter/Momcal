# 카카오 로그인

> **상태**: 🟡 코드 구현 + JavaScript 키 반영 완료 · Cloud Functions 배포 대기
> **관련 코드**: `js/auth.js`(`signInKakao()`), `js/firebase.js`(Functions SDK), `functions/index.js`(`kakaoLogin`), `index.html`(Kakao SDK 스크립트, 로그인 버튼), `css/auth.css`(`.btn-kakao`)

## 왜 Cloud Function이 필요한가

Kakao는 Firebase Auth가 기본 제공하는 로그인 provider(이메일, Google, Apple 등)에 포함돼 있지 않다. 그래서 Kakao 계정으로 로그인시키려면 직접 다리를 놔야 한다:

1. 클라이언트에서 **Kakao JS SDK**로 로그인 팝업을 띄워 Kakao access token을 받는다 (`Kakao.Auth.login()`)
2. 그 토큰을 **Cloud Function `kakaoLogin`**(`functions/index.js`)에 보낸다
3. 서버가 그 토큰으로 `kapi.kakao.com/v2/user/me`를 호출해 진짜 유효한 토큰인지 확인(=검증)하고, 카카오 회원번호를 얻는다
4. 그 회원번호로 Firebase Auth 사용자를 만들거나 갱신하고, **Firebase 커스텀 토큰**을 발급해서 클라이언트에 돌려준다
5. 클라이언트가 그 토큰으로 `signInWithCustomToken()`을 호출하면 로그인 완료 — 이후는 이메일/Google 로그인과 완전히 동일한 흐름을 탄다(`app.js`의 `onAuthStateChanged`가 그대로 처리함, 별도 분기 없음)

## Kakao.Auth.login() vs Kakao.Auth.authorize()

Kakao 공식 문서는 최근 `Kakao.Auth.authorize()`(리다이렉트 방식, OAuth 인가 코드를 서버로 넘겨받는 흐름)를 더 권장하지만, 이 프로젝트는 **`Kakao.Auth.login()`(팝업 방식)을 택함** — 이유:
- 번들러·라우터가 없는 순수 SPA 구조라, `authorize()`의 "페이지가 리다이렉트되고 `?code=`를 파싱해서 처리"하는 흐름을 넣으려면 상태 보존·URL 정리 등 부가 로직이 꽤 필요함
- `login()`은 Google의 `signInWithPopup()`과 UX가 거의 동일(팝업 → 완료)해서 기존 로그인 화면 구조에 그대로 끼워 넣을 수 있음
- `Kakao.Auth.login()`은 deprecated가 아니라 "클라이언트에서 모든 인증 처리를 하고 싶은 경우"를 위한 공식 지원 방식으로 남아있음(Kakao Developers "advanced-guide" 문서)

## uid 설계 — `kakao:{카카오 회원번호}`

기존 이메일/Google 로그인 사용자는 Firebase가 자동 생성하는 임의의 uid를 쓴다. 카카오 로그인 사용자는 `kakao:{id}` 형식의 uid를 써서 절대 겹치지 않게 분리했다. `functions/index.js`의 `kakaoLogin`이 이 uid로 Firebase Auth 사용자를 생성/갱신한 뒤 커스텀 토큰을 발급한다.

## ⚠️ 알려진 제약 — 이메일 미수집, 계정 연결 없음

- **이메일 동의항목을 아예 요청하지 않음** — 개인 개발자로 등록한 Kakao 앱은 이메일 제공이 기본적으로 막혀있고(비즈니스 앱 전환 심사가 별도로 필요), 설령 나중에 이메일을 받더라도 Firebase는 이메일을 유니크 키로 취급해서 이미 그 이메일로 가입된 기존 계정이 있으면 `auth/email-already-exists`로 충돌한다. 그래서 `kakaoLogin` 함수는 `displayName`(닉네임)·`photoURL`(프로필 사진)만 쓰고 email 필드는 아예 건드리지 않는다.
- **계정 연결(병합) 기능 없음** — 같은 사람이 이메일로 먼저 가입하고 나중에 카카오로도 로그인하면, 완전히 별개인 두 계정이 생긴다(데이터가 안 합쳐짐). 이 문제를 풀려면 "이미 로그인된 상태에서 카카오 계정 연결하기" 같은 별도 UI/로직이 필요한데, 아직 만들지 않았다 — 사용자가 실제로 이 문제를 겪는 사례가 나오면 그때 설계할 것.
- **로그인 화면에서 미리 안내하지 않음** — 위 제약을 로그인 화면에 문구로 안내할지는 아직 결정 안 함(UX 방해 vs 혼란 방지 트레이드오프, 옹짐꾼님과 논의 필요).

## 옹짐꾼님이 해야 하는 Kakao Developers 설정

코드는 다 준비됐지만, 아래는 Claude가 대신 할 수 없는 부분(Kakao 계정 소유자 인증이 필요함):

1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가하기
2. **앱 키 → JavaScript 키** 복사 → `js/auth.js`의 `KAKAO_JS_KEY` 상수에 반영 — ✅ 2026-07-16 완료
3. **플랫폼 → Web 플랫폼 등록** → 사이트 도메인에 `https://momcal.app` 추가
4. **카카오 로그인 → 활성화 설정 ON**
5. **동의항목** → 닉네임(필수 동의), 프로필 사진(선택 동의) — **이메일은 설정하지 않음**(위 "알려진 제약" 참고)

> ⚠️ 위 1·2번은 완료 확인됐지만, 3~5번(플랫폼 등록·로그인 활성화·동의항목)은 옹짐꾼님이 실제로 설정하셨는지 아직 별도로 확인 안 됨 — 로그인 시도 시 오류가 나면 이 부분부터 재확인할 것.

## 다음에 할 일

- [ ] **Cloud Functions 배포**(`cd functions && npm install && npm run deploy`) — `kakaoLogin` 함수가 새로 추가됐으므로 반드시 배포해야 동작함(아직 안 함)
- [ ] 배포 후 실제 로그인 테스트(팝업 뜨는지, 로그인 완료 후 홈 화면 진입하는지, 닉네임이 화면에 정상 표시되는지)
- [ ] 게스트 모드 데이터가 있는 상태에서 카카오로 로그인했을 때, 기존 이메일/Google 로그인과 동일하게 게스트 데이터 이전이 되는지 확인(별도 분기를 안 만들어서 될 것으로 예상되지만 실제 확인 필요)
- [ ] (선택) 계정 연결 기능 필요성 재검토
