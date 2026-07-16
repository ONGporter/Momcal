# 기능별 상세 스펙 — 목차

`docs/PROJECT_SPEC.md`에 한 파일로 몰려있던 기능별 설계 내용을 도메인별로 분리했습니다. 특정 기능만 확인하고 싶을 땐 아래에서 바로 찾으세요 — 전체를 다 읽을 필요 없습니다.

| 문서 | 다루는 내용 | 상태 |
|---|---|:---:|
| [`family-sharing.md`](./family-sharing.md) | 가족 그룹 공유 — Firestore 구조, 초대 코드, 보안 규칙 | ✅ 실사용 검증 완료 |
| [`guest-mode.md`](./guest-mode.md) | 게스트 모드 — 로그인 없이 로컬 저장, 계정 이전 규칙 | ✅ 구현 완료 |
| [`seo-content.md`](./seo-content.md) | 공개 육아정보 페이지(`guide/`) + 정책 페이지 + SEO 현황 | ✅ 구현 완료 |
| [`monetization.md`](./monetization.md) | 수익화 & 트래픽 전략, 광고 슬롯 | 🟡 AdSense 심사 신청 완료 · 승인 대기 중 |
| [`account-deletion.md`](./account-deletion.md) | 계정 영구 삭제(자체 탈퇴) 흐름 | ✅ 구현 완료 |
| [`push-notifications.md`](./push-notifications.md) | 진짜 FCM 푸시 알림 — 토큰 발급/저장/자동갱신, 서비스워커 수신, Cloud Functions 자동 발송 | ✅ 배포·테스트 완료 |
| [`admin-push.md`](./admin-push.md) | 관리자 전용 푸시 발송(`admin.html`) — 커스텀 클레임 접근 제어, 대상별 발송, 예약 발송, 발송 이력 | 🟡 코드 구현 완료 · Firestore 규칙·관리자 클레임 설정 대기 |
| [`checklist-customization.md`](./checklist-customization.md) | 체크리스트 커스터마이징 — 준비물형(플랫) 체크리스트, 사용자 정의 체크리스트, 탭 표시/캘린더 연동 설정 | ✅ 코드 완료 · 실기기 확인 대기 |
| [`play-store-launch.md`](./play-store-launch.md) | 플레이스토어 출시 — PWA를 TWA로 패키징, 서명 키, Android 개발자 인증, 비공개 테스트 요건, 스토어 등록정보 | 🟡 진행 중 — 1~6단계 완료, 7단계(스토어 등록정보) 진행 중 |
| [`kakao-login.md`](./kakao-login.md) | 카카오 로그인 — Cloud Function으로 Kakao 인가 코드를 Firebase 커스텀 토큰으로 교환(authorize 리다이렉트 방식), uid 네임스페이스 설계, 알려진 제약(이메일 미수집·계정 미연결) | ✅ 실사용 검증 완료 |

새 기능을 설계하고 이 목록에 넣을 만한 분량이 생기면, `docs/PROJECT_SPEC.md`에 이어붙이지 말고 여기에 새 파일을 추가하고 이 표에 한 줄을 더하세요.
