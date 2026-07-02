/**
 * data/checklist-links.js — Sprint 11
 * 체크리스트 항목 ↔ 캘린더 자동 이벤트(예방접종·건강검진) 연결 매핑
 *
 * 체크리스트의 개별 항목(예: "DTaP 1차")과 캘린더의 자동 생성 이벤트(예: "💉 DTaP 1차")는
 * 서로 다른 저장소(S.checks / S.eventMods)에 독립적으로 완료 여부를 저장하고 있었습니다.
 * 이 파일은 실제로 "같은 일"을 가리키는 항목들을 연결해서, 한쪽에서 체크하면
 * 다른 쪽도 함께 완료로 표시되도록 합니다 (js/checklistCalendarLink.js 에서 사용).
 *
 * - itemId  : data/checklist-data.js 의 항목 id
 * - catKey  : 그 항목이 속한 카테고리 key (S.checks 키 조합에 필요: `${childId}_${catKey}`)
 * - type    : 'vax'(예방접종, 캘린더 제목에 "💉 " 접두어 붙음) | 'checkup'(건강검진 등, 접두어 없음)
 * - calTitle: 캘린더에 표시되는 정확한 제목 (접두어 제외)
 *
 * 정확히 대응하는 캘린더 일정이 없는 체크리스트 항목(모호한 요약 항목 등)은 매핑하지 않습니다.
 */
export const checklistCalendarLinks = [
  // 0~1개월
  { itemId: 'b0_1', catKey: 'm0', type: 'vax',     calTitle: 'B형 간염 1차' },
  { itemId: 'b0_2', catKey: 'm0', type: 'vax',     calTitle: 'BCG (결핵)' },
  { itemId: 'b0_9', catKey: 'm0', type: 'checkup', calTitle: '영유아 건강검진 1차' },

  // 2~3개월
  { itemId: 'b2_1', catKey: 'm2', type: 'vax', calTitle: 'DTaP 1차' },
  { itemId: 'b2_2', catKey: 'm2', type: 'vax', calTitle: 'IPV 1차' },
  { itemId: 'b2_3', catKey: 'm2', type: 'vax', calTitle: 'Hib 1차' },
  { itemId: 'b2_4', catKey: 'm2', type: 'vax', calTitle: '폐구균 1차' },
  { itemId: 'b2_5', catKey: 'm2', type: 'vax', calTitle: '로타바이러스 1차' },

  // 4~5개월
  { itemId: 'b4_1', catKey: 'm4', type: 'vax',     calTitle: 'DTaP 2차' },
  { itemId: 'b4_2', catKey: 'm4', type: 'vax',     calTitle: 'IPV 2차' },
  { itemId: 'b4_3', catKey: 'm4', type: 'vax',     calTitle: 'Hib 2차' },
  { itemId: 'b4_4', catKey: 'm4', type: 'vax',     calTitle: '폐구균 2차' },
  { itemId: 'b4_5', catKey: 'm4', type: 'vax',     calTitle: '로타바이러스 2차' },
  { itemId: 'b4_6', catKey: 'm4', type: 'checkup', calTitle: '영유아 건강검진 2차' },

  // 6~8개월
  { itemId: 'b6_1', catKey: 'm6', type: 'vax',     calTitle: 'DTaP 3차' },
  { itemId: 'b6_2', catKey: 'm6', type: 'vax',     calTitle: 'B형 간염 3차' },
  { itemId: 'b6_3', catKey: 'm6', type: 'vax',     calTitle: '폐구균 3차' },
  { itemId: 'b6_6', catKey: 'm6', type: 'vax',     calTitle: '독감 예방접종' },
  { itemId: 'b6_7', catKey: 'm6', type: 'checkup', calTitle: '영유아 건강검진 3차' },

  // 9~11개월
  { itemId: 'b9_1', catKey: 'm9', type: 'checkup', calTitle: '영유아 건강검진 4차' },

  // 12~17개월
  { itemId: 'b12_1', catKey: 'm12', type: 'vax',     calTitle: 'MMR 1차' },
  { itemId: 'b12_2', catKey: 'm12', type: 'vax',     calTitle: '수두 1차' },
  { itemId: 'b12_3', catKey: 'm12', type: 'vax',     calTitle: 'A형 간염 1차' },
  { itemId: 'b12_5', catKey: 'm12', type: 'checkup', calTitle: '돌 건강검진 (5차)' },

  // 18~23개월
  { itemId: 'b18_1', catKey: 'm18', type: 'vax',     calTitle: 'DTaP 4차' },
  { itemId: 'b18_2', catKey: 'm18', type: 'vax',     calTitle: 'A형 간염 2차' },
  { itemId: 'b18_3', catKey: 'm18', type: 'checkup', calTitle: '영유아 건강검진 6차' },

  // 24~35개월
  { itemId: 'b24_1', catKey: 'm24', type: 'vax',     calTitle: '일본뇌염 1·2차' },
  { itemId: 'b24_2', catKey: 'm24', type: 'checkup', calTitle: '영유아 건강검진 7차' },

  // 36~60개월
  { itemId: 'b36_2', catKey: 'm36', type: 'checkup', calTitle: '영유아 건강검진 8차' },
];
