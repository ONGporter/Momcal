# 게스트 모드 (로컬 저장)

> **상태**: ✅ 구현 완료 (Sprint 15)
> **관련 코드**: `js/guestMode.js`, `js/state.js`(`saveState()`), `js/app.js`(`onDataLoaded`)

로그인하지 않은 기본 상태는 **게스트 모드**입니다. Firebase 로그인 화면으로 막지 않고, 앱을 곧바로 실제로 사용할 수 있습니다.

- **저장 위치**: `localStorage` 키 `momcal_guest_v1` (기기·브라우저 단위 — 다른 기기에서는 보이지 않음)
- **저장 데이터 구성**: Firestore 문서 스키마와 동일 (`children`, `customEvs`, `dayStickers`, `checks`, `eventMods`, `growthRecords`, `theme`, `selC`)
- **저장 트리거**: 기존 코드 전체가 이미 `debounceSave()` → `saveState()`를 거치므로, `js/state.js`의 `saveState()` 한 곳에서 `S.isGuestMode` 여부로 Firestore/localStorage를 분기함 — 개별 기능 코드는 전혀 수정할 필요 없었음
- **로그인 진입점**: 상단 우측 "🔐 로그인" 칩(`#guestLoginChip`) → 로그인 화면이 게스트 화면 위에 열림(닫기 ✕ 가능, 강제 관문 아님)
- **로그인 시 데이터 이전 규칙** (`js/app.js`의 `onDataLoaded`):
  - Firestore에 문서가 없는 완전히 새 계정 + 이 기기에 게스트 데이터가 있으면 → 게스트 데이터를 그대로 계정으로 업로드하고 로컬 데이터는 정리
  - 이미 데이터가 있는 기존 계정으로 로그인하면 → 클라우드 데이터를 그대로 사용, 이 기기의 게스트 데이터는 덮어쓰지 않고 그대로 둠(자동 병합은 하지 않음)
- **"예시 데이터로 둘러보기"(`js/demoMode.js`, 구 "체험 모드")와의 차이**: 데모는 저장이 전혀 안 되는 미리 채워진 샘플 데이터 미리보기이고, 게스트 모드는 실제 사용자의 진짜 데이터가 로컬에 저장됨. 데모 시작 시 `S.isGuestMode`를 꺼서 샘플 데이터가 게스트의 실제 로컬 데이터를 덮어쓰지 않도록 안전장치가 있고, 데모 종료 시 게스트 화면(자신의 실제 데이터)으로 복귀함
