/**
 * js/modal.js
 * 공통 모달 열기/닫기
 */

/** 모달 열기 */
export function showModal(title, bodyHTML) {
  document.getElementById('mT').textContent = title;
  document.getElementById('mB').innerHTML   = bodyHTML;
  document.getElementById('modal').classList.add('open');
}

/** 모달 닫기 */
export function cm() {
  document.getElementById('modal').classList.remove('open');
}

// 인라인 onclick 에서 사용 가능하도록 window에 노출
window.showModal = showModal;
window.cm        = cm;
