# 카카오 로그인

> **상태**: 🟡 코드 구현 완료(v0.3.7, authorize 리다이렉트 방식) · Redirect URI 등록·REST API 키·Firebase Secret 설정 대기
> **관련 코드**: `js/auth.js`(`signInKakao()`, `handleKakaoRedirectIfNeeded()`), `js/app.js`(앱 시작 시 리다이렉트 복귀 처리 호출), `js/firebase.js`(Functions SDK), `functions/index.js`(`kakaoLogin`), `index.html`(Kakao SDK 스크립트, 로그인 버튼), `css/auth.css`(`.btn-kakao`)

## ⚠️ v0.3.5 → v0.3.7: 팝업 방식에서 리다이렉트 방식으로 전면 교체함

**처음(v0.3.5)엔 `Kakao.Auth.login()`(팝업 방식)으로 만들었는데, 실제 배포 후 테스트하니 브라우저 콘솔에 `TypeError: Kakao.Auth.login is not a function` 에러가 떴다.** 확인해보니 예전 카카오 문서(일부 블로그·"advanced-guide" 문서)엔 남아있지만, 현재 카카오 JS SDK 버전(2.8.0)에는 이 함수가 없다 — 카카오가 실질적으로 `Kakao.Auth.authorize()`(리다이렉트 방식)만 지원하는 쪽으로 정리한 것으로 보인다. v0.3.7에서 전체 흐름을 리다이렉트 방식으로 다시 짰다.

**교훈**: 외부 SDK 연동은 문서보다 실제 로드된 SDK 버전에서 함수가 존재하는지가 우선이다 — 다음에 비슷한 걸 붙일 땐 브라우저 콘솔에서 `typeof Kakao.Auth.login`처럼 직접 확인하고 시작할 것.

## 왜 Cloud Function이 필요한가

Kakao는 Firebase Auth가 기본 제공하는 로그인 provider(이메일, Google, Apple 등)에 포함돼 있지 않다. 그래서 Kakao 계정으로 로그인시키려면 직접 다리를 놔야 한다.

## 전체 흐름 (v0.3.7, authorize 리다이렉트 방식)

1. 사용자가 "카카오로 계속하기" 버튼 클릭 → `signInKakao()`가 `Kakao.Auth.authorize({ redirectUri, scope })` 호출 → **브라우저가 카카오 로그인 페이지로 이동**(페이지 이탈 발생, Google 팝업과 달리 화면이 바뀜)
2. 사용자가 카카오 계정으로 로그인하고 동의 항목에 동의
3. 카카오가 `KAKAO_REDIRECT_URI`(`https://momcal.app/`)로 **`?code=인가코드`를 붙여서 되돌려줌** → 앱이 다시 로드됨
4. `js/app.js`가 시작하면서 `handleKakaoRedirectIfNeeded()`를 호출 → URL에서 `code`를 발견하면:
   a. URL을 즉시 정리(`history.replaceState`)해서 새로고침해도 code가 재사용되지 않게 함
   b. Cloud Function `kakaoLogin`에 `{ code, redirectUri }`를 보냄
5. `kakaoLogin`(서버)이:
   a. `kauth.kakao.com/oauth/token`에 code를 보내 **access token으로 교환**(이때 REST API 키가 필요함 — JavaScript 키와는 다른 값, Firebase Secret Manager로 관리)
   b. 그 access token으로 `kapi.kakao.com/v2/user/me`를 호출해 사용자 정보(닉네임·프로필사진·회원번호) 조회
   c. `kakao:{회원번호}` uid로 Firebase Auth 사용자 생성/갱신
   d. Firebase 커스텀 토큰 발급해서 반환
6. 클라이언트가 그 토큰으로 `signInWithCustomToken()` 호출 → 로그인 완료 — 이후는 이메일/Google 로그인과 완전히 동일한 흐름을 탄다(`app.js`의 `onAuthStateChanged`가 그대로 처리함, 별도 분기 없음)

## Kakao 키 2종 — 헷갈리지 말 것

| 키 종류 | 어디서 쓰나 | 노출돼도 되는가 |
|---|---|---|
| **JavaScript 키** | 클라이언트(`js/auth.js`의 `KAKAO_JS_KEY`) — `Kakao.init()`에 사용 | 됨(공개 키) |
| **REST API 키** | 서버(`functions/index.js`, Firebase Secret `KAKAO_REST_API_KEY`) — 인가 코드를 access token으로 교환할 때 `client_id`로 사용 | **안 됨** — 클라이언트 코드에 절대 넣지 말 것 |

## Redirect URI — 정확히 일치해야 함

`KAKAO_REDIRECT_URI`는 `js/auth.js`에 `https://momcal.app/`로 고정 하드코딩돼 있다(동적으로 `location.origin + location.pathname`을 쓰지 않은 이유: 브라우저 직접 접속/PWA 설치/TWA 등 진입 경로에 따라 실제 경로가 `/`, `/index.html` 등으로 달라질 수 있어서, 하나로 고정하는 게 안전함). **Kakao Developers의 "카카오 로그인 > Redirect URI" 설정에 이 값을 정확히 똑같이 등록해야** 로그인이 동작한다(한 글자라도 다르면 카카오가 리다이렉트 자체를 거부함).

## uid 설계 — `kakao:{카카오 회원번호}`

기존 이메일/Google 로그인 사용자는 Firebase가 자동 생성하는 임의의 uid를 쓴다. 카카오 로그인 사용자는 `kakao:{id}` 형식의 uid를 써서 절대 겹치지 않게 분리했다.

## ⚠️ 알려진 제약 — 이메일 미수집, 계정 연결 없음

- **이메일 동의항목을 아예 요청하지 않음** — 개인 개발자로 등록한 Kakao 앱은 이메일 제공이 기본적으로 막혀있고(비즈니스 앱 전환 심사가 별도로 필요), 설령 나중에 이메일을 받더라도 Firebase는 이메일을 유니크 키로 취급해서 이미 그 이메일로 가입된 기존 계정이 있으면 `auth/email-already-exists`로 충돌한다. 그래서 `kakaoLogin` 함수는 `displayName`(닉네임)·`photoURL`(프로필 사진)만 쓰고 email 필드는 아예 건드리지 않는다.
- **계정 연결(병합) 기능 없음** — 같은 사람이 이메일로 먼저 가입하고 나중에 카카오로도 로그인하면, 완전히 별개인 두 계정이 생긴다(데이터가 안 합쳐짐). 이 문제를 풀려면 "이미 로그인된 상태에서 카카오 계정 연결하기" 같은 별도 UI/로직이 필요한데, 아직 만들지 않았다 — 사용자가 실제로 이 문제를 겪는 사례가 나오면 그때 설계할 것.
- **리다이렉트 방식이라 로그인 중 페이지가 한 번 바뀜** — Google 팝업 로그인과 달리 화면이 카카오 로그인 페이지로 넘어갔다가 돌아오는 UX. TWA(플레이스토어 앱) 안에서도 Custom Tabs로 정상 동작할 것으로 예상되지만, 플레이스토어 출시 후 실기기로 별도 확인 필요.

## 옹짐꾼님이 해야 하는 Kakao Developers + Firebase 설정

**완료된 것**: JavaScript 키 발급 및 반영(v0.3.6)

**아직 안 된 것**:
1. **Kakao Developers → 앱 키 → REST API 키** 복사(JavaScript 키와 다른 값)
2. **Kakao Developers → 카카오 로그인 → Redirect URI** 등록 → `https://momcal.app/` 정확히 그대로 추가
3. **Firebase Secret 설정** — 터미널에서(`functions` 폴더 안, 배포 전에):
   ```
   firebase functions:secrets:set KAKAO_REST_API_KEY
   ```
   실행하면 값을 붙여넣으라고 나옴 → 위 1번에서 복사한 REST API 키 붙여넣기
4. **재배포**: `npm run deploy`

## 다음에 할 일

- [ ] 위 4단계(REST API 키 → Redirect URI 등록 → Secret 설정 → 재배포) 완료 후 실제 로그인 테스트
- [ ] 게스트 모드 데이터가 있는 상태에서 카카오로 로그인했을 때, 기존 이메일/Google 로그인과 동일하게 게스트 데이터 이전이 되는지 확인
- [ ] 플레이스토어 출시 후 TWA(Custom Tabs) 안에서 리다이렉트 로그인이 정상 동작하는지 실기기 확인
- [ ] (선택) 계정 연결 기능 필요성 재검토
