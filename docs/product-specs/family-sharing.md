# 가족 그룹 공유

> **상태**: ✅ 구현 완료 (v0.0.12) · ✅ 실사용 검증 완료 (v0.0.15, 실제 두 계정으로 테스트)
> **관련 코드**: `js/familyShare.js`, `js/state.js`(`createFamily`/`joinFamily`/`leaveFamily`/`dataDocRef`/`subscribeToUserData`)

각자 자기 계정으로 로그인한 채로 같은 데이터를 실시간 공동 편집할 수 있는 기능. 기존 `users/{uid}` 구조를 바꾸지 않고 **덧붙이는 방식**으로 구현함(`AGENTS.md` 최우선 원칙 3번 — 기존 필드명·구조 유지).

## 구조
- **`users/{uid}` 문서에 필드 추가**: `familyId` (string|null) — 가족 그룹에 속해있으면 그 그룹의 ID, 아니면 `null`/필드 없음
- **신규 컬렉션 `families/{familyId}`**: `users/{uid}`와 동일한 앱 데이터 스키마(`children`/`customEvs`/`dayStickers`/`checks`/`eventMods`/`growthRecords`/`evColors`/`theme`/`selC`) + `members`(uid 배열) + `createdAt`
- **데이터 읽기/쓰기 분기** (`js/state.js`의 `dataDocRef()`): `S.familyId`가 있으면 `families/{familyId}`를, 없으면 기존처럼 `users/{uid}`를 그대로 사용 — 가족 그룹에 참여하지 않은 기존 사용자는 동작이 이전과 100% 동일함
- **구독 구조** (`js/state.js`의 `subscribeToUserData()`): `users/{uid}`를 항상 구독해서 `familyId`를 확인하고, `familyId`가 있을 때만 `families/{familyId}`를 추가로 구독하는 2단계 구조

## 초대 코드
- 8자리 랜덤 코드(`O`/`0`/`I`/`1`처럼 헷갈리는 문자 제외) — `families/{familyId}`의 문서 ID로 그대로 사용
- 가족 그룹 생성 시 지금 내 데이터를 그대로 `families/{familyId}`로 복사(`createFamily()`), 참여 시 초대 코드로 기존 가족 문서에 내 uid를 `members`에 추가하고 내 `users/{uid}.familyId`를 그 코드로 연결(`joinFamily()`), 나가면 `familyId`를 지우고 원래 내 `users/{uid}` 데이터로 복귀(`leaveFamily()`, 예전 데이터는 지워지지 않고 그대로 남아있음)

## ⚠️ Firestore 보안 규칙 — 콘솔에서 직접 추가 필요
코드만으로는 실제 접근 권한까지 설정할 수 없어서, Firebase 콘솔 → Firestore Database → 규칙에 아래 내용을 **추가**해야 실제로 동작함(기존 `users/{uid}` 규칙은 그대로 두고 이 블록만 추가):
```
match /families/{familyId} {
  allow read, write: if request.auth != null;
}
```
초대 코드 자체를 "이 코드를 아는 사람 = 가족"으로 취급하는 단순한 모델(멤버 목록 기반 규칙은 "참여" 시점에 아직 멤버가 아닌 사람이 자기 uid를 추가해야 하는 구조적 문제가 있어 채택하지 않음) — 링크 공유와 비슷한 수준의 신뢰 모델.

✅ **v0.0.15에서 실제 두 계정으로 테스트 완료** — 초대 코드로 참여 후 양쪽 계정에서 캘린더·체크리스트가 실시간으로 함께 반영되는 것 확인됨(베타 딱지는 유지, `docs/TODO.md` "미완성" 목록에서는 제외).
