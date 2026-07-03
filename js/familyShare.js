/**
 * js/familyShare.js
 * 홈 탭 — 배우자/보호자와 함께 쓰기 링크 (Sprint 13)
 *
 * 맘캘은 현재 Firestore 문서가 users/{uid} 단위(1계정 = 1문서)로 저장되는 구조라,
 * "각자 로그인해도 같은 데이터를 실시간 공동 편집"하는 진짜 멀티 계정 가족 공유는
 * 아직 지원하지 않음 (계정 구조 변경이 필요한 큰 작업 — TODO.md 로드맵 항목).
 *
 * 대신 지금 당장 배우자와 함께 쓸 수 있도록: 같은 계정(이메일/비밀번호)으로
 * 로그인하면 onSnapshot 실시간 동기화로 두 사람 모두 같은 캘린더·체크리스트를
 * 보게 되므로, 그 안내 문구 + 앱 링크를 간편하게 공유하는 기능을 제공한다.
 */

import { showModal } from './modal.js';

const APP_URL = 'https://momcal.vercel.app';

function shareMessage() {
  return `맘캘로 우리 아이 육아 일정을 같이 관리해요 👨‍👩‍👧\n제 계정으로 로그인하면 같은 캘린더·체크리스트를 실시간으로 함께 볼 수 있어요!\n${APP_URL}`;
}

/** 홈 탭 "배우자와 함께 쓰기" 링크 렌더 */
export function renderFamilyShareLink() {
  const wrap = document.getElementById('familyShareWrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="install-link" onclick="shareWithFamily()">
      <span class="install-ico" style="background:var(--mnl)">👨‍👩‍👧</span>
      <div class="install-txt">
        <div class="install-title">배우자와 함께 쓰기</div>
        <div class="install-sub">같은 계정으로 로그인하면 실시간으로 공유돼요</div>
      </div>
      <span class="install-arrow">›</span>
    </div>`;
}

/** 공유 실행 — Web Share API 우선, 미지원 시 클립보드 복사로 폴백 */
async function shareWithFamily() {
  const text = shareMessage();

  if (navigator.share) {
    try {
      await navigator.share({ title: '맘캘 MomCal 👨‍👩‍👧', text, url: APP_URL });
    } catch (e) {
      // 사용자가 공유 시트를 취소한 경우 등 — 별도 처리 불필요
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showModal('👨‍👩‍👧 배우자와 함께 쓰기', `
      <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
        공유 문구가 클립보드에 복사됐어요!<br>
        카카오톡·문자 등에 붙여넣어 배우자에게 보내주세요 👨‍👩‍👧
      </p>
      <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인했어요</button>
    `);
  } catch (e) {
    // 클립보드 접근도 막힌 환경 — 직접 복사할 수 있도록 텍스트 노출
    showModal('👨‍👩‍👧 배우자와 함께 쓰기', `
      <p style="font-size:.86rem;font-weight:700;color:var(--tx);line-height:1.7">
        아래 문구를 배우자에게 직접 전달해주세요.
      </p>
      <textarea readonly onclick="this.select()" style="width:100%;margin-top:10px;padding:10px;
        border:1.5px solid #EEE0F0;border-radius:12px;font-family:inherit;font-size:.8rem;
        min-height:90px;color:var(--tx)">${text}</textarea>
      <button class="btn bpk" style="width:100%;margin-top:16px" onclick="cm()">확인했어요</button>
    `);
  }
}

window.shareWithFamily      = shareWithFamily;
window.renderFamilyShareLink = renderFamilyShareLink;
