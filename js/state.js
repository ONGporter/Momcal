/**
 * js/state.js
 * 앱 전체 상태(S) 관리 및 Firebase 저장/로드
 *
 * S는 단일 전역 객체입니다. 모든 모듈이 이 파일에서 import하여 사용합니다.
 * window.S 로도 노출되어 인라인 onclick 핸들러에서 직접 접근할 수 있습니다.
 */

import { auth, db, doc, getDoc, setDoc, onSnapshot } from './firebase.js';

/**
 * v0.0.22: 예방접종(💉)·정부지원(🟢) 자동 일정은 예전엔 제목 앞에 이모지를 붙여서
 * `S.eventMods`의 키(`auto_날짜_제목`)를 만들었음(js/calendar.js의 getEventKey()).
 * 이제 제목에서 이모지를 빼고 화면엔 아이콘으로 표시하도록 바꾸면서, 기존에 저장돼있던
 * 이모지 포함 키를 이모지 없는 새 키로 옮겨준다 — 이미 기록해둔 완료 체크·실접종일·메모 등
 * 사용자 데이터가 조용히 안 끊기게 하기 위한 1회성 자동 이전(멱등적이라 매번 실행해도 안전).
 */
function migrateEventModKeys(eventMods) {
  const MARKER_RE = /^auto_(\d{4}-\d{2}-\d{2})_(?:💉|🟢)\s*(.*)$/;
  let changed = false;
  const migrated = { ...eventMods };
  Object.keys(migrated).forEach(oldKey => {
    const m = oldKey.match(MARKER_RE);
    if (!m) return;
    const newKey = `auto_${m[1]}_${m[2]}`;
    if (!(newKey in migrated)) migrated[newKey] = migrated[oldKey];
    delete migrated[oldKey];
    changed = true;
  });
  return changed ? migrated : eventMods;
}

/**
 * v0.3.1: 정부지원 탭은 원래 임산부용/육아용이 같은 키(`gov`) 하나를 공유해서, 설정에서
 * 한쪽 표시/숨김을 누르면 다른 쪽도 같이 꺼지는 버그가 있었음(옹짐꾼님 제보) — 이제
 * `gov_preg`/`gov_born`으로 키를 분리해 독립적으로 켜고 끌 수 있게 함(js/checklist.js의
 * builtinTabDefs 참고). 이미 예전에 `hiddenTabs`에 레거시 키 `gov`를 저장해둔 사용자는
 * (당시 "정부지원 탭 숨김" 상태였던 것이므로) 두 새 키 모두 숨김 상태로 그대로 이어지도록
 * 1회성 이전 — 그 반대(가지고 있지 않던 사용자가 새로 숨겨지는 일)는 없음(멱등적).
 */
function migrateGovHiddenTabs(hiddenTabs) {
  if (!Array.isArray(hiddenTabs) || !hiddenTabs.includes('gov')) return hiddenTabs;
  const migrated = hiddenTabs.filter(k => k !== 'gov');
  if (!migrated.includes('gov_preg')) migrated.push('gov_preg');
  if (!migrated.includes('gov_born')) migrated.push('gov_born');
  return migrated;
}

/**
 * v0.3.9: 체크리스트 탭이 12개까지 늘어나면서 가독성이 떨어진다는 옹짐꾼님 피드백으로,
 * 아직 한 번도 탭 표시/숨김을 직접 건드리지 않은 사용자는 대표 탭 3개만 보이고 나머지는
 * 기본 숨김 상태로 시작하도록 함(설정 탭에서 언제든 다시 켤 수 있음, js/checklistSettings.js).
 *   - 육아용 대표 3개: 예방접종(vax)·발달(dev)·이유식(food) — 모든 준비물 팩은 기본 숨김
 *   - 임산부용 대표 3개: 임신 체크(preg)·정부지원(gov_preg)·출산가방(pack_hospitalbag) — 나머지
 *     준비물 팩(태명 정하기·태교여행·산후조리원·신생아 맞이 준비)은 기본 숨김
 * hiddenTabs가 비어있는(한 번도 손대지 않은) 상태에서만 1회 적용하고, 이후엔 clSettings에
 * defaultTabsApplied 플래그를 남겨서 — 사용자가 나중에 전부 다시 켜서 hiddenTabs를 빈 배열로
 * 되돌리더라도(=전부 표시하기로 한 의도적 선택) 이 로직이 다시 개입해 재적용하지 않게 함.
 *
 * v0.3.25: 옹짐꾼님 요청으로 육아용 정부지원(gov_born)도 기본 표시로 변경 — 이제 임신·육아
 * 두 단계 모두 정부지원 탭이 기본으로 보임(gov_preg는 원래부터 대표 탭이라 안 바뀜).
 * 이 변경은 앞으로 처음 시작하는 사용자에게만 적용되고, 이미 defaultTabsApplied가 true로
 * 저장된 기존 사용자의 hiddenTabs는 그대로 유지됨(원한다면 설정 탭에서 직접 켤 수 있음).
 */
const DEFAULT_HIDDEN_TABS = [
  'pack_outing', 'pack_100days', 'pack_firstbday', 'pack_bdayphoto',
  'pack_travel', 'pack_daycare', 'pack_medicine', 'pack_foodprep',
  'pack_babyname', 'pack_babymoon', 'pack_postpartumcare', 'pack_newbornwelcome',
];
function applyDefaultHiddenTabs(clSettings) {
  const hiddenTabs = clSettings.hiddenTabs || [];
  if (!clSettings.defaultTabsApplied && hiddenTabs.length === 0) {
    return { hiddenTabs: [...DEFAULT_HIDDEN_TABS], defaultTabsApplied: true };
  }
  return { hiddenTabs, defaultTabsApplied: true };
}

/* ── 기본 상태 팩토리 ── */
export function emptyState() {
  return {
    children:    [],   // 등록된 아이/임신 프로필
    customEvs:   [],   // 사용자가 직접 추가한 일정
    dayStickers: {},   // { 'YYYY-MM-DD': [emoji, ...] }
    checks:      {},   // { 'childId_catKey': { itemId: true } }
    customClItems: {}, // v0.0.14: { 'childId_catKey': [{ id, t, r }] } — 사용자가 직접 추가한 체크리스트 항목
    eventMods:   {},   // { 'eventKey': { actualDate, hospital, memo, done } }
    growthRecords: [], // [{ id, childId, date, height, weight, head, isFetal }] — 성장 기록 (Sprint 4, v0.0.23부터 태아 기록도 포함)
    itemFeedback: {},  // v0.0.23: { itemId: 'up'|'down' } — 체크리스트 항목 "도움돼요/아쉬워요" 개인 반응
    evColors:    {},   // { req, rec, food, vax, gov, custom } — 사용자 지정 일정 색상 (Sprint 21, 없으면 기본색)
    theme:       'rose',
    selC:        0,    // 현재 선택된 아이 인덱스
    // v0.0.40: 체크리스트 커스터마이징 — 준비물형(플랫) 체크리스트를 직접 만들고, 탭 표시 여부·
    // 캘린더 연동 여부를 고를 수 있게 함 (자세한 구조는 docs/product-specs/checklist-customization.md)
    customChecklists: [], // [{ id, key:'custom_'+id, label, icon, items:[{id,t,r}] }] — 사용자가 직접 만든 플랫 체크리스트
    clSettings:  { hiddenTabs: [], calendarSync: {} }, // hiddenTabs: 숨긴 탭 key 배열 / calendarSync: { [tabKey]: false } (명시적으로 끈 것만 저장, 기본 true)
    // v0.2.4: 정부지원 탭에 앱 기본 제공 항목 외에 사용자가 직접 추가하는 항목(지자체별 지원금 등).
    // stage('preg'|'born')로 임산부용/육아용을 구분하고, js/calendar.js의 getAutoEvs()가 이 배열을
    // 읽어서 캘린더·체크리스트 정부지원 탭에 기존 항목과 동일한 방식으로 섞어서 보여줌
    customGovItems: [], // [{ id, title, stage, date:'YYYY-MM-DD', imp:'req'|'rec', desc, link }]
  };
}

/* ── 전역 상태 객체 ── */
export const S = Object.assign(emptyState(), {
  // UI 상태 (Firebase에 저장하지 않음)
  gender:   'm',
  rStage:   'born',
  calY:     new Date().getFullYear(),
  calM:     new Date().getMonth(),
  calView:  'month',
  calWeekRef: null,      // v0.0.11: 주간 뷰 전용 기준일(YYYY-MM-DD) — calMove()가 7일 단위로 이동. v0.0.46부터 홈 화면 간소화 캘린더(js/homeWeekWidget.js)도 이 값을 그대로 공유해서 씀
  selDate:  null,
  selSCat:  0,           // 선택된 스티커 카테고리 인덱스
  clTab:    0,           // 체크리스트 탭 인덱스
  selClCat: 0,           // 체크리스트 선택된 사이드바 항목
  growthMetric: 'height', // 성장그래프 탭에서 선택된 지표 ('height'|'weight'|'head')
  isDemoMode: false,      // Sprint 8: 체험 모드 여부 (로그인 없이 샘플 데이터로 둘러보기)
  isGuestMode: false,     // Sprint 15: 게스트 모드 여부 (로그인 없이 실제 데이터를 로컬에 저장해 사용)
  calFilter: { food: false, vax: false, gov: false }, // Sprint 11: 캘린더 타입 필터 (전부 false = 전체 표시)
  familyId: null,         // v0.0.12: 가족 그룹 ID — 설정돼있으면 users/{uid} 대신 families/{familyId} 문서를 씀
});

// 인라인 onclick 에서 S.xxx 직접 접근 가능하도록 window에 노출
window.S = S;

/* ── 현재 로그인 사용자 ── */
let _currentUser = null;
export const getCurrentUser   = () => _currentUser;
export const setCurrentUser   = (u) => { _currentUser = u; };

/* ── Firestore 문서 레퍼런스 ── */
export function userDocRef() {
  return doc(db, 'users', _currentUser.uid);
}

/** v0.0.12: 가족 그룹 문서 레퍼런스 */
export function familyDocRef(familyId) {
  return doc(db, 'families', familyId);
}

/**
 * v0.0.12: 실제 앱 데이터(children/customEvs/checks 등)를 읽고 쓸 문서.
 * S.familyId가 설정돼있으면 가족 공유 문서(families/{familyId})를, 아니면
 * 기존처럼 내 계정 문서(users/{uid})를 그대로 씀 — 가족 그룹에 안 들어간
 * 기존 사용자는 이 함수의 동작이 이전과 완전히 동일함(하위 호환).
 */
export function dataDocRef() {
  return S.familyId ? familyDocRef(S.familyId) : userDocRef();
}

/* ── 저장 대기/진행 상태 추적 (v0.3.16) ──
 * 디바운스 타이머가 아직 안 끝났거나(로컬에 아직 서버로 안 보낸 변경이 있음) setDoc()
 * 자체가 서버로 가는 중일 때, 그 사이 들어오는 onSnapshot을 applyData()로 그대로 S에
 * 반영해버리면 "방금 로컬에서 바꾼 값"이 아직 그 변경을 모르는 더 오래된 원격 데이터로
 * 조용히 덮어써짐 — 체크리스트에서 항목 하나를 누르고(디바운스 대기 중) 곧바로 다른
 * 항목을 누르면 첫 번째 항목이 화면에서 도로 풀리던 버그의 원인으로 확인됨(옹짐꾼님
 * 제보, 2026-07-17). js/app.js의 onDataLoaded()가 이 값이 true인 동안엔 들어온 스냅샷을
 * 통째로 무시하도록 함(hasPendingWrites만으론 부족함 — 그 값은 "이 스냅샷이 내 저장의
 * 에코인지"만 알려줄 뿐, "그새 더 최신 로컬 변경이 쌓였는지"는 알려주지 않음) */
let _saveTimer = null;
let _saveInFlight = false;

export function hasPendingLocalWrite() {
  return _saveTimer !== null || _saveInFlight;
}

/* ── 상태 저장 ── */
export async function saveState() {
  _saveInFlight = true;
  try {
    // Sprint 15: 게스트 모드(로그인 안 함)는 로컬(localStorage)에 저장 — js/guestMode.js가 처리
    // (순환 import 방지를 위해 window 경유 호출 — 프로젝트 전반의 기존 패턴과 동일)
    if (S.isGuestMode) {
      window.saveGuestData?.();
      return;
    }
    if (!_currentUser) return;
    try {
      // v0.0.12: dataDocRef() — 가족 그룹에 속해있으면 families/{familyId}에,
      // 아니면 기존처럼 users/{uid}에 저장. merge:true로 저장해서 가족 문서의
      // members 배열이나 familyId 포인터 필드가 매번 자동저장 때마다 지워지지 않게 함.
      await setDoc(dataDocRef(), {
        children:    S.children,
        customEvs:   S.customEvs,
        dayStickers: S.dayStickers,
        checks:      S.checks,
        customClItems: S.customClItems || {},
        eventMods:   S.eventMods || {},
        growthRecords: S.growthRecords || [],
        itemFeedback: S.itemFeedback || {},
        evColors:    S.evColors || {},
        theme:       S.theme,
        selC:        S.selC,
        customChecklists: S.customChecklists || [],
        clSettings:  S.clSettings || { hiddenTabs: [], calendarSync: {} },
        customGovItems: S.customGovItems || [],
        updatedAt:   Date.now(),
      }, { merge: true });
      flashSave();
    } catch (e) {
      console.error('저장 실패', e);
    }
  } finally {
    _saveInFlight = false;
  }
}

/* ── 디바운스 저장 (600ms) ── */
export function debounceSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveState();
  }, 600);
}

/**
 * v0.0.36: 아이가 둘 이상일 때 마지막으로 선택한 아이를 유지하기 위한 단일 진입점.
 * 기존엔 홈/캘린더/체크리스트/성장 화면 각각 인라인 onclick에서 "S.selC=${i}"만 하고
 * 저장은 안 해서, 그 상태에서 아무것도 수정하지 않고 새로고침하면 항상 0번(첫째)로
 * 돌아가버렸음(다른 데이터 변경 때 debounceSave()가 "우연히" 같이 저장해줄 때만 유지됨).
 * 이제 아이를 선택하는 모든 곳(홈 카드, 캘린더 상단 pill, 체크리스트/성장 드롭다운)이
 * 이 함수 하나만 거치도록 해서, 선택 즉시 debounceSave()로 저장까지 되게 한다.
 */
export function selectChild(i) {
  const idx = +i;
  if (Number.isNaN(idx) || idx === S.selC) return;
  S.selC = idx;
  debounceSave();
}
window.selectChild = selectChild;

/* ── 저장 완료 배지 표시 ── */
export function flashSave() {
  const el = document.getElementById('saveBadge');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

/* ── Firebase 실시간 구독 ── */
let _userUnsub    = null; // users/{uid} 문서 구독 (familyId 포인터 확인용, 항상 켜져있음)
let _familyUnsub  = null; // families/{familyId} 문서 구독 (가족 그룹에 속해있을 때만)
let _subscribedFamilyId; // 마지막으로 _familyUnsub을 건 familyId (undefined = 아직 없음)

/**
 * 로그인 후 Firestore 실시간 구독 시작
 *
 * v0.0.12: 가족 그룹 공유를 위해 2단계 구독으로 확장.
 * 1) users/{uid} 문서를 항상 구독 — 이 문서의 `familyId` 필드로 "지금 가족 그룹에
 *    속해있는지"를 판단한다 (가족 그룹에 안 속해있으면 이 문서 자체가 곧 앱 데이터라
 *    기존과 완전히 동일하게 동작함 — 하위 호환).
 * 2) familyId가 있으면 families/{familyId} 문서를 별도로 구독해서, 실제 앱 데이터
 *    (children/customEvs/checks 등)는 그 문서에서 가져온다. familyId가 바뀌면
 *    (가족 그룹 참여/탈퇴) 기존 구독을 끊고 새로 구독한다.
 *
 * v0.0.9 버그 수정 — 체크리스트 배지가 두 번 깜빡이던 버그 재발 원인:
 * debounceSave()로 setDoc()을 호출하면(=우리 기기 자신의 저장), Firestore가 서버 응답 전에
 * 로컬 캐시로 먼저 onSnapshot을 "낙관적으로" 한 번 더 쏴준다(snap.metadata.hasPendingWrites
 * === true). 체크 클릭 시 이미 tgCk()가 화면을 1회 그렸는데, 약 600ms 뒤 debounceSave()
 * 저장이 실행되며 "내가 방금 쓴 내용"이 onSnapshot으로 그대로 되돌아와 app.js가 또 한 번
 * 사이드바/메인을 다시 그렸음 — 그래서 배지 애니메이션이 두 번 재생됨.
 * (이전 Sprint 7에서 고친 건 tgCk() 내부에서 같은 클릭에 renderClMain()이 중복 호출되던
 * 것이었고, 이후 다른 기기와의 실시간 동기화를 위해 app.js가 onSnapshot마다
 * renderClSidebar()를 다시 호출하는 코드가 추가되면서 이 새로운 경로로 버그가 재발함)
 * 해결: snap.metadata.hasPendingWrites를 onData의 두 번째 인자로 함께 넘겨서 "내 기기가
 * 방금 쓴 내용의 로컬 에코"인지 "실제로 다른 기기/탭에서 바뀐 내용"인지 구분함(app.js에서 사용).
 */
export function subscribeToUserData(onData) {
  unsubscribeUserData();
  _userUnsub = onSnapshot(
    userDocRef(),
    (userSnap) => {
      const userData = userSnap.exists() ? userSnap.data() : null;
      const familyId = userData?.familyId || null;
      S.familyId = familyId;

      if (familyId) {
        // 가족 그룹 모드 — 실제 앱 데이터는 families/{familyId}에서 옴
        if (_subscribedFamilyId !== familyId) {
          _subscribedFamilyId = familyId;
          if (_familyUnsub) { _familyUnsub(); _familyUnsub = null; }
          _familyUnsub = onSnapshot(
            familyDocRef(familyId),
            (famSnap) => onData(famSnap.exists() ? famSnap.data() : null, famSnap.metadata.hasPendingWrites),
            (err) => console.error('가족 데이터 구독 오류', err),
          );
        }
        // familyId가 그대로면 이미 걸려있는 _familyUnsub이 알아서 계속 갱신해줌
      } else {
        // 솔로 모드 — users/{uid} 문서 자체가 곧 앱 데이터 (기존과 동일)
        if (_familyUnsub) { _familyUnsub(); _familyUnsub = null; }
        _subscribedFamilyId = null;
        onData(userData, userSnap.metadata.hasPendingWrites);
      }
    },
    (err) => console.error('구독 오류', err),
  );
}

/** 로그아웃 시 구독 해제 */
export function unsubscribeUserData() {
  if (_userUnsub)   { _userUnsub();   _userUnsub   = null; }
  if (_familyUnsub) { _familyUnsub(); _familyUnsub = null; }
  _subscribedFamilyId = undefined;
}

/* ── v0.0.12: 가족 그룹 생성·참여·탈퇴 ──
 * 보안 규칙: families/{familyId} 문서는 "초대 코드(=familyId)를 아는 로그인 사용자면
 * 누구나 읽고 쓸 수 있음" 모델을 씀 (멤버 목록 기반 규칙은 "참여" 시점에 아직 멤버가
 * 아닌 사람이 자기 uid를 추가해야 하는 닭-달걀 문제가 생겨서, 대신 초대 코드 자체를
 * "이 코드를 아는 사람=가족"으로 보는 단순한 모델을 택함 — 링크 공유와 비슷한 신뢰 수준).
 * Firebase 콘솔의 Firestore 보안 규칙에 아래 내용을 추가해야 실제로 동작합니다:
 *
 *   match /families/{familyId} {
 *     allow read, write: if request.auth != null;
 *   }
 *
 * (기존 users/{uid} 규칙은 그대로 두고, 위 블록만 추가하면 됩니다)
 */

/** 8자리 초대 코드 생성 (O/0/I/1처럼 헷갈리는 문자는 제외) */
function generateFamilyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 새 가족 그룹 생성 — 지금 내 데이터를 그대로 가족 문서로 옮기고, 내 계정을 그 그룹에 연결 */
export async function createFamily() {
  if (!_currentUser) throw new Error('로그인이 필요해요');
  const familyId = generateFamilyCode();
  await setDoc(familyDocRef(familyId), {
    children:    S.children,
    customEvs:   S.customEvs,
    dayStickers: S.dayStickers,
    checks:      S.checks,
    customClItems: S.customClItems || {},
    eventMods:   S.eventMods || {},
    growthRecords: S.growthRecords || [],
    itemFeedback: S.itemFeedback || {},
    evColors:    S.evColors || {},
    theme:       S.theme,
    selC:        S.selC,
    customChecklists: S.customChecklists || [],
    clSettings:  S.clSettings || { hiddenTabs: [], calendarSync: {} },
    customGovItems: S.customGovItems || [],
    members:     [_currentUser.uid],
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
  });
  await setDoc(userDocRef(), { familyId }, { merge: true });
  return familyId;
}

/** 초대 코드로 기존 가족 그룹에 참여 — 지금 내 계정 데이터 대신 가족 데이터를 보게 됨 */
export async function joinFamily(code) {
  if (!_currentUser) throw new Error('로그인이 필요해요');
  const famRef = familyDocRef(code);
  const snap = await getDoc(famRef);
  if (!snap.exists()) throw new Error('존재하지 않는 초대 코드예요. 코드를 다시 확인해주세요');
  const members = snap.data().members || [];
  if (!members.includes(_currentUser.uid)) {
    await setDoc(famRef, { members: [...members, _currentUser.uid] }, { merge: true });
  }
  await setDoc(userDocRef(), { familyId: code }, { merge: true });
}

/** 가족 그룹 나가기 — 나간 뒤엔 원래 내 계정(users/{uid}) 데이터로 돌아감 */
export async function leaveFamily() {
  if (!_currentUser || !S.familyId) return;
  try {
    const famRef = familyDocRef(S.familyId);
    const snap = await getDoc(famRef);
    if (snap.exists()) {
      const members = (snap.data().members || []).filter((m) => m !== _currentUser.uid);
      await setDoc(famRef, { members }, { merge: true });
    }
  } catch (e) {
    console.error('가족 그룹 멤버 정리 실패', e);
  }
  await setDoc(userDocRef(), { familyId: null }, { merge: true });
}

/**
 * Firestore에서 불러온 데이터를 S에 적용
 * @param {Object|null} data
 */
export function applyData(data) {
  const fresh = data || emptyState();
  S.children    = fresh.children    || [];
  S.customEvs   = fresh.customEvs   || [];
  S.dayStickers = fresh.dayStickers || {};
  S.checks      = fresh.checks      || {};
  S.customClItems = fresh.customClItems || {};
  S.eventMods   = migrateEventModKeys(fresh.eventMods || {});
  S.growthRecords = fresh.growthRecords || [];
  S.itemFeedback = fresh.itemFeedback || {};
  S.evColors    = fresh.evColors    || {};
  S.theme       = fresh.theme       || 'rose';
  S.customChecklists = fresh.customChecklists || [];
  {
    const migratedHidden = migrateGovHiddenTabs(fresh.clSettings?.hiddenTabs || []);
    const withDefaults = applyDefaultHiddenTabs({ hiddenTabs: migratedHidden, defaultTabsApplied: fresh.clSettings?.defaultTabsApplied });
    S.clSettings = {
      hiddenTabs:   withDefaults.hiddenTabs,
      calendarSync: fresh.clSettings?.calendarSync || {},
      defaultTabsApplied: withDefaults.defaultTabsApplied,
    };
  }
  S.customGovItems = fresh.customGovItems || [];
  // selC 범위 보정
  S.selC = Math.max(0, Math.min(fresh.selC || 0, S.children.length - 1));
}
