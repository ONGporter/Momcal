/**
 * js/utils.js
 * 공통 유틸리티 함수
 */

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (Sprint 30: 타임존 버그 수정)
 * ⚠️ 예전엔 `new Date().toISOString()`을 썼는데, toISOString()은 항상 UTC 기준이라
 * 한국시간(KST, UTC+9) 자정~오전 9시 사이에는 하루 전 날짜가 나오는 버그가 있었음
 * (예: 한국시간 7/4 새벽 1시반 → UTC로는 아직 7/3 16시반이라 "7월 3일"로 표시됨)
 * Intl.DateTimeFormat으로 기기 시간대와 무관하게 항상 한국(Asia/Seoul) 날짜를 계산하도록 수정
 */
export const today = () => {
  // en-CA 로케일은 YYYY-MM-DD 형식으로 포맷해줘서 별도 조합 없이 바로 쓸 수 있음
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
};

/**
 * 생년월일(문자열) → 생후 일수 (Sprint 30: 태어난 날을 1일로 계산하도록 변경)
 * - 기존엔 D+0(태어난 날 = 0일째) 방식이었는데, "태어난 날을 1일로 계산해달라"는
 *   요청에 맞춰 +1 — 태어난 날 당일에는 "1일째", 다음날부터 "2일째"로 표시됨
 * - 한국시간(KST) 자정 기준으로 날짜 차이를 계산해 시간대 오차 없이 정확한 날짜 수만 셈
 */
export const ageD = (b) => {
  if (!b) return 0;
  const diff = Math.floor((new Date(today() + 'T00:00:00+09:00') - new Date(b + 'T00:00:00+09:00')) / 86400000);
  return Math.max(0, diff) + 1;
};

/** 생년월일(문자열) → "N일 (M개월)" 형식 문자열 */
export function ageFmt(b) {
  if (!b) return '';
  const d = ageD(b);
  const m = Math.floor(d / 30.44);
  return m < 1 ? `${d}일` : `${d}일 (${m}개월)`;
}

/**
 * 기준 날짜 문자열(YYYY-MM-DD) → 오늘로부터 며칠 남았는지 (Sprint 20)
 * 지난 날짜면 음수 반환. dateStr이 없으면 null.
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86400000);
}

/**
 * 문자열 맨 앞의 이모지(+공백)를 제거해서 반환 (Sprint 21)
 * ⚠️ 화면 표시 전용 헬퍼입니다 — 실제 데이터(ev.title)는 절대 이 함수로 바꾸지 마세요.
 * eventMods의 키가 `auto_{날짜}_{title}` 형식이라 title 원본이 바뀌면
 * 기존 사용자가 저장해둔 병원명·메모·완료 여부가 전부 매칭 실패로 사라집니다.
 * 캘린더 필 등 "보여주기"에서만 이 함수의 반환값을 쓰세요.
 */
export function stripLeadingEmoji(str) {
  if (!str) return '';
  return str.replace(/^[\p{Extended_Pictographic}\u200d\uFE0F\s]+/u, '').trim();
}

/**
 * v0.0.20: 아이콘 렌더링 공용 헬퍼 — Material Symbols 아이콘 하나를 만들 때 항상 이 함수를 씀.
 * "아이콘 색은 훅 하나로 통일" 원칙 — 마크업·클래스 이름이 여기 한 곳에만 있어서,
 * 나중에 아이콘 라이브러리를 바꾸거나 스타일을 조정할 때 이 함수만 고치면 됨.
 * @param {string} name  Material Symbols 아이콘 이름(예: 'home', 'calendar_month')
 * @param {object} [opts]
 * @param {'sm'|'md'|'lg'} [opts.size='md']
 * @param {boolean} [opts.fill=false]  채워진 스타일 아이콘(활성 상태 표시 등에 사용)
 * @param {string} [opts.style='']     추가 인라인 스타일
 */
export function icon(name, opts = {}) {
  const { size = 'md', fill = false, style = '' } = opts;
  const sizeCls = size === 'sm' ? ' icon-sm' : size === 'lg' ? ' icon-lg' : '';
  const fillCls = fill ? ' icon-fill' : '';
  return `<span class="icon${sizeCls}${fillCls}" style="${style}" translate="no" aria-hidden="true">${name}</span>`;
}

/**
 * v0.0.53: 아이 프로필/월령별 성장 단계 아이콘 — 옹짐꾼님이 제작한 자체 일러스트(투명 배경 PNG)로 교체.
 * 캘린더 스티커(js/calendar.js의 ICON_STICKERS)와 동일한 설계 원칙:
 *  1) Firestore엔 이모지 대신 안정적인 토큰 문자열을 저장 (avatarToken)
 *  2) 렌더링 시에만 이 맵을 보고 <img>로 바꿔치기 (avatarDisplay) — 매핑에 없으면(레거시 데이터,
 *     예전에 저장된 순수 이모지 👦/👧/👶) 원래 값을 그대로 반환해 과거 데이터도 안 깨짐
 * 성별 미정('u' 또는 그 외 값)은 옹짐꾼님 요청대로 항상 "남아" 쪽을 기본값으로 씀.
 * v0.0.54: <select><option>·escapeHtml() 같은 "이미지가 아예 안 되는 순수 텍스트" 자리는
 * 처음엔 이모지로 대체(avatarTextFallback)했었는데, "이미지가 되는 곳엔 이미지, 안 되는 곳엔
 * 이모지"가 오히려 통일성이 없다는 피드백으로 그런 자리는 아이 이름만 표시하는 것으로 변경
 * (avatarTextFallback 삭제 — 필요해지면 다시 추가 가능).
 */
export const AVATAR_ICON_BASE = './icons/avatars/';

const AVATAR_ICONS = {
  'momcal:avatar_boy':  { file: 'boy.png',  label: '남아' },
  'momcal:avatar_girl': { file: 'girl.png', label: '여아' },
};

/** 아이 등록 시 성별에 맞는 avatar 토큰 반환(레지스트리 값, 그대로 Firestore에 저장) */
export function avatarToken(gender) {
  return gender === 'f' ? 'momcal:avatar_girl' : 'momcal:avatar_boy';
}

/** child.avatar 값을 화면에 그릴 HTML 반환 — 토큰이면 <img>, 아니면(레거시 이모지) 그대로 폴백 */
export function avatarDisplay(avatarValue, size) {
  const meta = AVATAR_ICONS[avatarValue];
  if (!meta) return avatarValue || '';
  return `<img class="avatar-img" src="${AVATAR_ICON_BASE}${meta.file}" alt="${meta.label}" style="width:${size};height:${size};object-fit:contain;vertical-align:middle" loading="lazy">`;
}

/**
 * 육아 체크 "아기→돌쟁이→어린이" 성장 단계별(월령 카테고리 m18/m24/m36) 아이콘 파일명.
 * m18(18~23개월)엔 아이 프로필과 같은 이미지(boy.png/girl.png)를 그대로 씀.
 */
const GROWTH_STAGE_FILES = {
  m18: { boy: 'boy.png',          girl: 'girl.png' },
  m24: { boy: 'boy_dol_baby.png', girl: 'girl_dol_baby.png' },
  m36: { boy: 'boy_child.png',    girl: 'girl_child.png' },
};

/**
 * 성장 단계 아이콘 <img> HTML 반환. base를 다르게 넘기면 앱(상대경로)·guide 정적 페이지(절대경로)
 * 양쪽에서 재사용 가능(scripts/build-guide.mjs 참고).
 */
export function growthStageIconImg(stageKey, gender, opts = {}) {
  const files = GROWTH_STAGE_FILES[stageKey];
  if (!files) return '';
  const { base = AVATAR_ICON_BASE, size = '1.1em' } = opts;
  const file = gender === 'f' ? files.girl : files.boy;
  return `<img class="avatar-img" src="${base}${file}" alt="" style="width:${size};height:${size};object-fit:contain;vertical-align:middle" loading="lazy">`;
}
