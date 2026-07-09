# 기능별 상세 스펙 — 목차

`docs/PROJECT_SPEC.md`에 한 파일로 몰려있던 기능별 설계 내용을 도메인별로 분리했습니다. 특정 기능만 확인하고 싶을 땐 아래에서 바로 찾으세요 — 전체를 다 읽을 필요 없습니다.

| 문서 | 다루는 내용 | 상태 |
|---|---|:---:|
| [`family-sharing.md`](./family-sharing.md) | 가족 그룹 공유 — Firestore 구조, 초대 코드, 보안 규칙 | ✅ 실사용 검증 완료 |
| [`guest-mode.md`](./guest-mode.md) | 게스트 모드 — 로그인 없이 로컬 저장, 계정 이전 규칙 | ✅ 구현 완료 |
| [`seo-content.md`](./seo-content.md) | 공개 육아정보 페이지(`guide/`) + 정책 페이지 + SEO 현황 | ✅ 구현 완료 |
| [`monetization.md`](./monetization.md) | 수익화 & 트래픽 전략, 광고 슬롯 | 🟡 준비 완료(AdSense 신청 전) |
| [`account-deletion.md`](./account-deletion.md) | 계정 영구 삭제(자체 탈퇴) 흐름 | ✅ 구현 완료 |
| [`push-notifications.md`](./push-notifications.md) | 진짜 FCM 푸시 알림 — 토큰 발급/저장/자동갱신, 서비스워커 수신, Cloud Functions 자동 발송 | 🟡 코드 구현 완료 · 배포·실기기 확인 대기 |

새 기능을 설계하고 이 목록에 넣을 만한 분량이 생기면, `docs/PROJECT_SPEC.md`에 이어붙이지 말고 여기에 새 파일을 추가하고 이 표에 한 줄을 더하세요.
