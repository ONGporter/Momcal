/**
 * data/checklist-packs.js (v0.0.40)
 *
 * "준비물 체크리스트" — 예방접종/발달/이유식처럼 월령별로 잘게 나뉜(인덱싱된) 체크리스트가
 * 아니라, 특정 이벤트를 앞두고 한 번에 쭉 확인하는 플랫(flat) 리스트형 체크리스트임.
 * 앞으로 이런 종류의 체크리스트가 계속 늘어날 예정이라(외출 준비물, 100일 준비, 돌 준비,
 * 돌사진 준비 등) 별도 파일로 분리해뒀음 — 새 팩을 추가하려면 이 배열에 객체 하나만 더하면 됨.
 *
 * 항목 형식은 data/checklist-data.js와 동일(id/t/r[/d]) — js/checklist.js의 calcScore·
 * getCatItems·renderClMain이 어떤 카테고리든 동일하게 처리하므로 이 파일만 추가해도
 * 기존 렌더링 파이프라인을 그대로 탄다(신규 렌더 코드 불필요).
 *
 * id 접두어 규칙: 기존 체크리스트 항목은 `b0_1`처럼 월령 접두어를 쓰고, 사용자가 직접
 * 추가하는 항목은 `custom_`으로 시작함 — 이 파일의 항목은 `pk_`로 시작해서 겹치지 않게 함.
 *
 * icon 필드는 Material Symbols Outlined 아이콘 이름(js/ui.js 등에서 쓰는 것과 동일한 세트).
 */
export const clPacks = [
  {
    key: 'pack_outing',
    label: '외출 준비물',
    icon: 'stroller',
    items: [
      { id: 'pk_out_1', t: '기저귀 여유분',        r: true },
      { id: 'pk_out_2', t: '물티슈',                r: true },
      { id: 'pk_out_3', t: '여벌 옷 한 벌',          r: true },
      { id: 'pk_out_4', t: '분유/젖병 또는 이유식',  r: true },
      { id: 'pk_out_5', t: '손소독제',               r: true },
      { id: 'pk_out_6', t: '기저귀 교환용 매트',     r: false },
      { id: 'pk_out_7', t: '아기 담요·겉싸개',       r: false },
      { id: 'pk_out_8', t: '상비약(해열시럽 등)',    r: false },
      { id: 'pk_out_9', t: '좋아하는 장난감·애착인형', r: false },
    ],
  },
  {
    key: 'pack_100days',
    label: '100일 준비',
    icon: 'cake',
    items: [
      { id: 'pk_100_1', t: '100일 사진 촬영 스튜디오 예약', r: true },
      { id: 'pk_100_2', t: '100일상(백일상) 대여·구매',     r: true },
      { id: 'pk_100_3', t: '초대할 가족·지인 리스트 정리',  r: true },
      { id: 'pk_100_4', t: '답례떡·답례품 주문',            r: true },
      { id: 'pk_100_5', t: '아기 한복·드레스 준비',          r: false },
      { id: 'pk_100_6', t: '장소(집/스튜디오/식당) 예약',   r: false },
      { id: 'pk_100_7', t: '초대장(모바일) 제작·발송',       r: false },
    ],
  },
  {
    key: 'pack_firstbday',
    label: '돌 준비',
    icon: 'celebration',
    items: [
      { id: 'pk_1st_1', t: '돌잔치 장소 예약',              r: true },
      { id: 'pk_1st_2', t: '돌상·돌잡이 물품 준비',          r: true },
      { id: 'pk_1st_3', t: '초대장 제작·발송',               r: true },
      { id: 'pk_1st_4', t: '답례품 주문',                    r: true },
      { id: 'pk_1st_5', t: '아기 한복·드레스 준비',           r: false },
      { id: 'pk_1st_6', t: '사회자·행사 진행 순서 정하기',    r: false },
      { id: 'pk_1st_7', t: '돌잔치 영상·사진 슬라이드 준비',  r: false },
    ],
  },
  {
    key: 'pack_bdayphoto',
    label: '돌사진 준비',
    icon: 'photo_camera',
    items: [
      { id: 'pk_pho_1', t: '스튜디오 예약',                 r: true },
      { id: 'pk_pho_2', t: '촬영 컨셉·의상 콘셉트 정하기',   r: true },
      { id: 'pk_pho_3', t: '의상 대여·구매',                r: true },
      { id: 'pk_pho_4', t: '헤어·메이크업(부모) 예약',       r: false },
      { id: 'pk_pho_5', t: '소품 준비(생일 배너·풍선 등)',   r: false },
      { id: 'pk_pho_6', t: '촬영 시간대(아기 컨디션 좋은 때) 정하기', r: false },
    ],
  },
];
