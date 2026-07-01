# Changelog

## [Sprint 2] 2025-07-01 — 캘린더 고도화

### 추가 기능

- **일정 수정 Modal** — 이벤트 클릭 시 팝업 열림
  - 자동 이벤트: 권장일(읽기전용) + 실제 일정 / 병원명 / 메모 / 완료 여부
  - 커스텀 이벤트: 동일 + 삭제 버튼
  - 저장 시 Firebase(`eventMods`) 반영
- **완료 표시** — 완료 체크 시 캘린더 필에 ✅, 텍스트 취소선
- **데이 패널 수정 버튼** — 각 이벤트에 ✏️ 수정 버튼 추가, 병원·메모·권장일 표시
- **PC 드래그앤드롭** — 이벤트 필을 다른 날짜 셀로 드래그해서 이동
- **모바일 길게 눌러 이동** — 500ms 길게 누른 후 손가락으로 이동 (진동 피드백)
- **이벤트 이동 Firebase 저장** — 이동 후 자동 저장

### 데이터 구조 추가

- `S.eventMods` — `{ [eventKey]: { actualDate, hospital, memo, done } }`
- Firestore `users/{uid}` 문서에 `eventMods` 필드 추가 (기존 데이터 하위 호환)
- 자동 이벤트 키: `auto_{origDate}_{title}`, 커스텀 이벤트 키: `custom_{id}`

### 변경된 파일

- `js/state.js` — eventMods 추가 (emptyState, saveState, applyData)
- `js/calendar.js` — 전면 업데이트 (Modal, 드래그, 완료 표시, getAllEvs 모드 적용)
- `css/calendar.css` — ev-done, dp-done, drag-over, drag-ghost 스타일 추가

> 완료된 작업을 날짜와 함께 기록합니다.
> 최신 항목이 위에 옵니다.

---

## [Sprint 1] 2025-07-01 — 모듈 리팩터링

### 구조 변경

- 단일 `index.html` (1,512줄) → 모듈 구조 19개 파일로 분리
  - `css/` 5개: main, auth, calendar, checklist, modal
  - `js/` 9개: app, firebase, state, auth, ui, calendar, checklist, modal, utils
  - `data/` 4개: vaccines, pregnancy, milestones, checklist-data
- ES6 Module (`import/export`) 방식으로 전환
- `window.S = S` — 인라인 onclick 하위 호환성 유지
- 각 모듈 하단 `window.xxx = xxx` 노출 패턴 적용

### 버그 수정

- **Bug #6** — 체크박스 클릭 시 퍼센트 즉시 반영 안 되던 문제
  - `tgCk()` 에서 `renderClMain()` 먼저 호출 → 체크박스 즉시 시각 반영
  - 이후 `renderClSidebar()` 호출 → 사이드바 % 업데이트
- **Bug #7** — 스티커 여러 개 겹치던 문제
  - `position: absolute` 제거, `.sticker-row` flex 배치 적용
  - 최대 3개 표시 + 초과 시 `+N` 배지

### 유지된 기능

- Firebase Auth (Email/Password + Google) 동일 동작
- Firestore 저장 구조 (`users/{uid}`) 동일
- 기존 모든 기능 (캘린더, 체크리스트, 스티커, 테마, 등록) 정상 동작
