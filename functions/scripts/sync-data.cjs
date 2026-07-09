/**
 * functions/scripts/sync-data.js
 *
 * Cloud Functions는 `functions/` 디렉터리만 배포 대상으로 올라가서, 앱 본체가 쓰는
 * `data/vaccines.js` 등을 그대로 import할 수 없음(배포 패키지 밖에 있음).
 * "단일 진실 공급원" 원칙(AGENTS.md)을 지키기 위해 이 스크립트가 배포 직전에
 * 루트 `data/`의 필요한 파일들을 `functions/data/`로 복사함 — 즉 `functions/data/*.js`는
 * 직접 수정하는 파일이 아니라 매번 새로 생성되는 산출물임(guide/*.html과 같은 성격).
 *
 * firebase.json의 "functions.predeploy"에 등록돼있어 `firebase deploy --only functions`
 * 실행 시 자동으로 먼저 실행됨. 수동 실행: `node functions/scripts/sync-data.cjs`
 * (확장자가 .cjs인 이유: functions/package.json이 "type":"module"이라 .js는 전부 ES모듈로
 * 해석되는데, 이 스크립트는 require/__dirname을 쓰는 CommonJS라 확장자로 명시적으로 구분함)
 *
 * 예방접종·정부지원 일정 계산 로직을 바꿀 때는(js/calendar.js의 getAutoEvs) 이 스크립트가
 * 복사하는 데이터 파일 목록도 같이 검토할 것 — 새 데이터 파일을 참조하게 되면 아래
 * FILES_TO_SYNC 배열에 추가해야 함.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FUNCTIONS_DATA_DIR = path.join(__dirname, '..', 'data');

// js/calendar.js의 getAutoEvs()가 실제로 참조하는 데이터 파일만 동기화 대상으로 삼음
// (functions/index.js의 computeAutoEvs가 이 목록과 정확히 같은 파일들을 import함)
const FILES_TO_SYNC = [
  'vaccines.js',
  'milestones.js',
  'pregnancy.js',
  'government-support.js',
];

fs.mkdirSync(FUNCTIONS_DATA_DIR, { recursive: true });

for (const file of FILES_TO_SYNC) {
  const src = path.join(ROOT_DATA_DIR, file);
  const dest = path.join(FUNCTIONS_DATA_DIR, file);
  fs.copyFileSync(src, dest);
  console.log(`synced: data/${file} -> functions/data/${file}`);
}
