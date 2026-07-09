/**
 * data/government-support.js — Sprint 6
 * 임신·출산·육아 단계별 정부지원 제도 일정 데이터
 *
 * 각 항목은 다음 정보를 포함합니다:
 *  - title      : 일정 제목
 *  - importance : 'req'(필수) | 'rec'(추천/해당자)
 *  - desc       : 상세 설명
 *  - link       : 관련 공식 기관 홈페이지 (구조상 항목마다 다른 딥링크로 교체 가능)
 *  - deadlineDay / deadlineWeek : 신청 마감일 계산용 오프셋 (있는 경우만)
 *  - deadlineNote : 정확한 날짜로 계산하기 어려운 마감 안내 문구 (지자체별 상이 등)
 *
 * ⚠️ 제도명·지원 대상·금액·마감 기한은 매년 변경될 수 있습니다.
 * 이 앱은 신청 시기를 놓치지 않도록 "알림" 목적으로만 안내하며, 실제 자격 요건과 금액은
 * 반드시 링크된 기관 홈페이지 또는 주민센터에서 다시 확인해야 합니다.
 *
 * Sprint 29: 사용자가 "제도가 계속 바뀌니 몇 년도 기준인지 적어달라"고 요청 —
 * GOV_INFO_BASIS를 이 데이터를 마지막으로 확인·정리한 시점으로 갱신하고,
 * 화면(육아정보 페이지·체크리스트 정부지원 탭)에 노출해 신뢰도를 높임.
 * ⚠️ 실제 제도 내용이 바뀔 때마다 이 값도 함께 갱신해야 함 (연 1회 이상 점검 권장 — docs/TODO.md 참고)
 */
export const GOV_INFO_BASIS = '2026년 7월 기준';

export const govSupportSchedule = {
  /** 임신 중 — 출산예정일(due) 기준 임신 주차(week)로 날짜 계산 */
  preg: [
    {
      key: 'infertility', title: '난임 지원 (해당자)', week: 4, importance: 'rec',
      desc: '난임 시술로 임신한 경우 시술비 지원 대상인지 확인해보세요.',
      deadlineNote: '시술 전·중 신청 필요 (임신 확인 후에는 해당 시술분 소급 어려움)',
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'happy-card', title: '국민행복카드 신청', week: 8, importance: 'req',
      desc: '임신·출산 진료비 바우처를 받기 위해 국민행복카드를 신청하세요. 산부인과 진료비·검사비 등에 사용할 수 있어요.',
      deadlineNote: '출산 전 신청 권장 (출산 후 1년까지도 신청 가능)',
      link: 'https://www.gov.kr',
    },
    {
      key: 'high-risk-preg', title: '고위험 임산부 의료비 지원', week: 12, importance: 'rec',
      desc: '전치태반·조기진통 등 고위험 임신 진단을 받은 경우 진료비 일부를 지원받을 수 있어요 (해당자만).',
      deadlineDay: null, deadlineNote: '분만 후 6개월 이내 신청',
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'maternal-newborn-care', title: '산모·신생아 건강관리 서비스 신청', week: 32, importance: 'req',
      desc: '출산 후 건강관리사가 가정에 방문해 산모 회복과 신생아 돌봄을 도와주는 바우처 서비스예요.',
      deadlineNote: '출산 예정일 40일 전 ~ 출산 후 30일 이내 신청',
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'first-meeting-voucher', title: '첫만남이용권 안내', week: 36, importance: 'rec',
      desc: '출생신고 후 국민행복카드로 자동 지급되는 200만원 바우처예요. 출산 전 미리 알아두면 좋아요.',
      deadlineNote: '출생 후 1년 이내 신청',
      link: 'https://www.gov.kr',
    },
    {
      key: 'birth-grant-info', title: '출산지원금 안내', week: 36, importance: 'rec',
      desc: '거주 지자체별로 지급하는 출산지원금 제도를 미리 확인해보세요 (지자체마다 금액·조건이 달라요).',
      deadlineNote: '지자체별 상이 — 출생신고 시 주민센터에서 함께 확인',
      link: 'https://www.gov.kr',
    },
  ],

  /** 출산 직후 — 출생일(birth) 기준 일수(day)로 날짜 계산 */
  postpartum: [
    {
      key: 'birth-report', title: '출생신고', day: 3, importance: 'req',
      desc: '아이의 출생을 관할 주민센터 또는 정부24에서 신고하세요. 이후 각종 지원 신청의 기준이 됩니다.',
      deadlineDay: 30,
      link: 'https://www.gov.kr',
    },
    {
      key: 'parental-benefit', title: '부모급여 신청', day: 5, importance: 'req',
      desc: '만 0~1세 아동을 양육하는 가정에 매월 지급되는 부모급여를 신청하세요.',
      deadlineDay: 60,
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'child-allowance', title: '아동수당 신청', day: 5, importance: 'req',
      desc: '만 8세 미만 아동에게 매월 지급되는 아동수당을 신청하세요.',
      deadlineDay: 60,
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'childcare-allowance', title: '양육수당 (해당자)', day: 7, importance: 'rec',
      desc: '어린이집·유치원을 이용하지 않고 가정에서 양육하는 경우 지급되는 수당이에요 (해당자만).',
      deadlineDay: 60,
      link: 'https://www.bokjiro.go.kr',
    },
    {
      key: 'parental-leave-info', title: '육아휴직 관련 안내', day: 10, importance: 'rec',
      desc: '육아휴직 급여·기간 등 회사에 신청하기 전 알아두면 좋은 제도예요.',
      deadlineNote: '휴직 시작 30일 전 회사에 신청 권장',
      link: 'https://www.gov.kr',
    },
    {
      key: 'vax-support-info', title: '예방접종 국가지원 안내', day: 10, importance: 'rec',
      desc: '국가필수예방접종(NIP)은 지정 의료기관에서 무료로 접종받을 수 있어요. 지정 의료기관을 미리 확인해두세요.',
      link: 'https://nip.kdca.go.kr',
    },
  ],

  /** 육아 — 출생일(birth) 기준 개월수(month)로 날짜 계산 */
  parenting: [
    {
      key: 'idolbom-apply', title: '아이돌봄서비스 신청', month: 4, importance: 'rec',
      desc: '양육 공백이 있는 가정에 돌보미가 방문해 아이를 돌봐주는 정부 지원 서비스예요.',
      link: 'https://www.idolbom.go.kr',
    },
    {
      key: 'infant-checkup-support', title: '영유아 건강검진 국가지원 예약', month: 4, importance: 'rec',
      desc: '국가건강검진 대상 시기가 되면 지정 병원에 미리 예약하세요 (검진비 무료).',
      link: 'https://www.nhis.or.kr',
    },
    {
      key: 'daycare-apply', title: '어린이집 입소 신청', month: 8, importance: 'rec',
      desc: '입소 대기가 긴 지역이 많아 아이사랑 포털에서 미리 대기 신청을 해두면 좋아요.',
      link: 'https://www.childcare.go.kr',
    },
    {
      key: 'kindergarten-apply', title: '유치원 입학 관련 일정', month: 34, importance: 'rec',
      desc: '만 3세부터 유치원 입학이 가능해요. 처음학교로 시스템에서 모집 일정을 확인하세요.',
      link: 'https://www.childcare.go.kr',
    },
  ],
};
