/**
 * sw.js — 맘캘 서비스 워커 (Sprint 11: PWA 홈 화면 추가)
 *
 * 목적:
 *  1) 홈 화면 설치(Add to Home Screen)를 위해 브라우저가 요구하는 서비스 워커 등록
 *  2) 앱 셸(정적 파일)을 캐싱해서 오프라인/네트워크 불안정 시에도 앱이 열리도록 지원
 *
 * 전략: stale-while-revalidate (캐시 우선 응답 + 백그라운드에서 최신본으로 갱신)
 * Firebase 등 외부 도메인 요청(인증·데이터 동기화)은 건드리지 않고 그대로 통과시킵니다.
 */

// v0.0.18: 폴더 구조 정리(AGENTS.md/ARCHITECTURE.md/docs/) 작업 중 앱쉘 캐시 목록에서
// 누락된 js 모듈 8개(theme.js/fontSize.js/calFontSize.js/guestMode.js/familyShare.js/
// accountDelete.js/pwaInstall.js/adSlot.js) 발견 — 여러 버전에 걸쳐 계속 빠져있었음(오프라인
// 상태에서 다크모드·글자크기·가족공유 등 설정 탭 기능이 깨질 수 있었던 잠재 버그) — 추가하고 캐시 버전 상향
// v0.0.20: "AI스럽지 않은 실제 서비스 수준" 리디자인 — 아이콘 라이브러리 도입,
// 팔레트·반경·간격 토큰 변경으로 CSS/JS 다수 변경 — 캐시 버전 상향
// v0.0.21: 나머지 이모지 대부분을 아이콘으로 전환(캘린더 모달·체크리스트·정부지원·
// 성장·알림·가족공유·계정삭제·guide/ 육아정보 페이지 전체) — 정적 파일 대량 변경으로 캐시 버전 상향
// v0.0.22: Legend 트로피 아이콘, 그라디언트 완전 제거(.bpk), 체크리스트 사이드바 줄바꿈 정리,
// 종류 선택 아이콘 통일, 아이 성별 기반 성장단계 아이콘, 예방접종/정부지원 이모지 마커 제거(데이터 마이그레이션 포함)
// v0.0.23: 정부지원 사이드바 통일, 태아 성장 기록, 체크리스트 추천/비추천(도움돼요),
// 체크리스트 이미지 공유(html2canvas 신규 도입) 반영 — 캐시 버전 상향
// v0.0.39: 관리자 푸시 발송 기능 추가(admin.html/js/admin.js/css/admin.css) — 이 페이지들은
// APP_SHELL(오프라인 캐시 대상)에 넣지 않음(privacy.html 등 기존 독립 정책 페이지와 동일 취급).
// js/firebase.js에 Firestore 쿼리 함수(collection/addDoc/query 등) export가 추가되어
// 앱 본체가 쓰는 정적 파일 내용이 바뀌었으므로 캐시 버전은 올림.
// v0.0.40: 체크리스트 커스터마이징(탭 표시/캘린더 연동 설정, 준비물 팩, 사용자 정의 체크리스트)
// 추가 — 새 js/데이터 파일 캐시 목록에 반영, 캐시 버전 상향
// v0.0.41: 준비물 팩에 dd(상세 설명)·임신 단계용 팩 추가, 체크리스트 편집 UI 추가로
// js/checklistSettings.js·data/checklist-packs.js 내용이 바뀌어서 캐시 버전 다시 상향
// v0.0.42: 캘린더 연동 토글이 실제로 일정을 숨김/표시하도록 js/calendar.js·
// js/checklistCalendarLink.js 수정, 알림 통합으로 js/notifications.js·js/push.js·js/ui.js
// 변경 — 캐시 버전 다시 상향
// v0.0.43: CSS 버그 수정(가족 공유 버튼 글자색, 편집 모달 체크박스 겹침) + 체크리스트 탭
// 안내문 이동 + 팩 직접추가 항목 설정 연동으로 css/checklist.css·css/main.css·
// js/checklist.js·js/checklistSettings.js 변경
// v0.0.44: 커스텀 체크리스트 양방향 편집 완전 수정("내가 추가함" 배지 제거 포함) + 가족
// 나가기 버튼 테두리 제거 + 안내문 화살표 방향 수정
// v0.0.50: 캘린더 스티커에 자체 제작 이미지 카테고리("맘캘 육아" — 기저귀갈기/꿈나라가기/
// 놀이하기/목욕하기/뽀뽀하기/안아주기/양치하기/우유먹기/이유식먹기/책읽기 10종) 추가.
// js/calendar.js(stickerCats·ICON_STICKERS·stickerDisplay), css/calendar.css(.sticker-img) 변경 +
// icons/stickers/momcal-action/*.png 신규 정적 파일 — 캐시 버전 상향
// v0.0.51: 위 이미지 10종이 (1) 다른 이모지보다 작게 보이던 문제 — 원본 캔버스에 여백이 많이
// 남아있어서 생긴 문제, 실제 그림 영역만 타이트하게 크롭 후 재배치해서 시각적 크기를 맞춤.
// (2) 다크 모드에서 흰 배경 박스가 그대로 보이던 문제 — 원본 PNG가 알파채널은 있었지만
// 배경이 완전 불투명한 흰색으로 채워져 있었음(투명 처리가 안 돼 있었음), 캔버스 테두리에 붙은
// 흰 영역만 골라 투명화(캐릭터 몸통 내부의 흰색은 안 건드림)하는 방식으로 재처리 — 캐시 버전 상향
// v0.0.52: 캘린더 스티커 "꽃·자연" 카테고리를 기존 이모지 16종에서 자체 제작 이미지 25종으로
// 교체(momcal:flower_xxx 토큰 + ICON_STICKERS 매핑, 'momcal_action' 카테고리와 동일 패턴 재사용).
// "맘캘 육아" 10종도 새 원화로 전면 교체 — 8개는 기존 파일명과 같아서 캐시 재발을 막기 위해
// 전부 새 파일명(_v2)으로 저장하고 예전 PNG는 삭제. js/calendar.js(stickerCats·ICON_STICKERS)
// 변경 + icons/stickers/flower-nature/*.png 신규, icons/stickers/momcal-action/*_v2.png 교체 —
// 캐시 버전 상향
// v0.0.53: 아이 프로필 아바타(👦/👧/👶)와 육아 체크 성장 단계 아이콘(18~23·24~35·36~60개월,
// 👶/🧒/🧑)을 옹짐꾼님 제작 이미지로 교체 — 아바타는 캘린더 스티커와 동일 패턴(토큰 문자열을
// child.avatar에 저장, avatarDisplay()가 렌더링 시 <img>로 변환, 레거시 이모지 데이터는 폴백
// 유지). <select><option>·escapeHtml() 등 이미지가 안 되는 순수 텍스트 자리는 성별 기반
// 이모지 텍스트(avatarTextFallback)로 별도 처리. 성별 미정은 항상 남아 이미지가 기본값.
// js/utils.js(avatarDisplay·avatarToken·avatarTextFallback·growthStageIconImg 신규),
// js/ui.js·calendar.js·checklist.js·checklistSettings.js·growthChart.js·demoMode.js,
// scripts/build-guide.mjs(육아정보 페이지도 동일 이미지로, 성별 없어 남아 기본값) 변경 +
// icons/avatars/*.png 신규 정적 파일 — 캐시 버전 상향
// v0.0.54: 이미지가 아예 안 되는 순수 텍스트 자리(체크리스트·성장 탭의 "아이 선택" <select>,
// 준비물 팩 편집 모달 안내 문구)에 v0.0.53에서 넣었던 이모지 폴백(avatarTextFallback)을 빼고
// 아이 이름만 표시하도록 변경 — "이미지 되는 곳엔 이미지, 안 되는 곳엔 이모지"가 오히려
// 통일성이 없다는 피드백 반영. js/utils.js(avatarTextFallback 삭제)·growthChart.js·
// checklist.js·checklistSettings.js 변경 — 캐시 버전 상향
// v0.0.55: 캘린더 스티커 "이유식" 카테고리를 기존 이모지 30종에서 자체 제작 이미지 48종으로
// 교체(momcal:food_xxx 토큰, 다른 이미지 카테고리와 동일 패턴). 이 작업 중 캘린더 셀/주간 뷰
// 헤더의 이유식 스티커 표시가 stickerDisplay()를 거치지 않고 stickerEmoji()로 텍스트를 직접
// 찍던 것을 발견해 함께 수정(예전엔 이유식이 항상 순수 이모지였어서 문제가 안 드러났었음) —
// 안 고쳤으면 이미지 대신 'momcal:food_xxx' 토큰 글자가 그대로 보였을 버그. formatSticker()도
// 툴팁에 토큰 대신 사람이 읽을 라벨이 뜨도록 개선. js/calendar.js, css/calendar.css 변경 +
// icons/stickers/babyfood/*.png 신규 정적 파일 — 캐시 버전 상향
// v0.0.56: 커스텀 404 페이지 신규 추가(404.html) — privacy.html/terms.html/contact.html과
// 같은 성격의 독립 정책 페이지라 APP_SHELL(오프라인 캐시 대상)엔 안 넣음. index.html 하단
// 버전 표시 텍스트가 바뀌어서(APP_SHELL에 포함된 파일) 캐시 버전만 상향
// v0.0.57: (1) 스티커 고르는 화면(.sp-sticker)의 크기를 기존 대비 2배로 확대(1.45rem→2.9rem,
// 달력 안에 붙는 스티커 크기는 그대로 유지) (2) 이유식 스티커를 붙일 때 뜨는 g수 입력 prompt()가
// "momcal:food_barley 먹은 양을..."처럼 원본 토큰 문자열을 그대로 보여주던 버그 수정 —
// formatSticker()로 사람이 읽을 라벨("보리")을 쓰도록 변경. js/calendar.js, css/calendar.css
// 변경 — 캐시 버전 상향
// v0.0.58: 캘린더 스티커 "아기" 카테고리를 기존 이모지 16종에서 자체 제작 이미지 21종으로
// 교체(momcal:babyitem_xxx 토큰, 다른 이미지 카테고리와 동일 패턴). 새 파일명을 기존 스티커
// 폴더 전체(momcal-action/flower-nature/babyfood/avatars)와 대조해 충돌 없음을 확인 —
// 폴더가 달라 겹쳐도 실제로는 무해하지만(경로로 구분됨) 미리 점검함. js/calendar.js 변경 +
// icons/stickers/baby-items/*.png 신규 정적 파일 — 캐시 버전 상향
// v0.0.59: 캘린더 스티커 "하트"(28종)·"기념"(24종)·"건강"(24종) 카테고리를 기존 이모지에서
// 자체 제작 이미지로 교체 — 이번으로 스티커 전체 8개 카테고리가 모두 이미지 기반으로 전환
// 완료됨(momcal-action/flower-nature/babyfood/baby-items/heart/memorial/health).
// 파일명은 기존 폴더 전체와 대조해 충돌 없음 확인. js/calendar.js 변경 +
// icons/stickers/heart|memorial|health/*.png 신규 정적 파일 — 캐시 버전 상향
// v0.0.60: (1) 캘린더 스티커 "꽃·자연" 카테고리를 옹짐꾼님이 새로 주신 이미지 28종으로 전면
// 교체(기존 25종 icons/stickers/flower-nature/*.png는 삭제) — 예전 flower 토큰이 붙어있던
// 날짜는 이제 매핑이 없어서 원본 토큰 문자열이 그대로 보일 수 있음(감수하기로 함, 사용자가
// 명시적으로 기존 세트 삭제를 요청). (2) 체크리스트 성장 단계 0~1/2~3/4~5/6~8/9~11/12~17개월
// (m0~m12) 아이콘을 새싹/클로버/나뭇잎/나뭇가지/화분/나무 이미지로 교체 — m18~m36과 같은
// growthStageIconImg() 재사용, GROWTH_STAGE_FILES에 폴더별 dir 필드 추가해 avatars/flower-nature
// 두 폴더를 함께 지원하도록 구조 확장. js/utils.js, js/calendar.js, scripts/build-guide.mjs 변경
// — 캐시 버전 상향
// v0.0.61: 체크리스트 "이유식" 탭(6/8/10/12/24개월 — 초기1단계/초기2단계/중기/완료기/유아식)
// 이모지를 이미지로 교체 — m0~m36 성장 단계와 같은 growthStageIconImg()/applyGrowthStageGender()
// 재사용(GROWTH_STAGE_FILES에 f6~f24 항목 추가), 성별 무관이라 boy/girl에 같은 파일 등록.
// 앱(js/checklist.js)·육아정보 food.html(scripts/build-guide.mjs) 양쪽 다 반영 —
// icons/mealstage/*.png 신규 정적 파일. 캐시 버전 상향
// v0.1.0: index.html/css/calendar.css/js/calendar.js 수정(캘린더 하단 색상 범례 제거,
// "일정 색상" 스와치에 정부지원 추가) — 캐시 버전 상향
// v0.1.1: data/checklist-data.js 수정(예방접종 "9~11개월" 카테고리 유일 항목을 선택→필수로
// 변경 — 필수 항목이 없어서 항상 "Perfect 100%"로 보이던 버그 수정) — 캐시 버전 상향
// v0.2.2: js/checklist.js·js/ui.js 수정(커스텀 체크리스트 이름이 escapeHtml 없이 innerHTML에
// 삽입되던 4~5곳에 escapeHtml 적용 — 저장된 XSS 위험 보완) — 캐시 버전 상향
// v0.2.3: v0.2.2 회귀 버그 수정 — 예방접종/발달/이유식 카테고리 라벨(cat.label)에는
// applyGrowthStageGender()가 성장 단계 아이콘 <img> 태그를 일부러 심어두는데, v0.2.2에서
// 렌더링 시점마다 escapeHtml(cat.label)을 씌우는 바람에 그 아이콘까지 글자 그대로 깨져
// 보이던 문제 — 이스케이프 위치를 렌더링 시점 3곳에서 getCats()의 커스텀 체크리스트
// 분기 한 곳으로 옮겨서 해결(js/checklist.js) — 캐시 버전 상향
// v0.2.4: js/checklist.js·js/checklistSettings.js·js/calendar.js·js/govSupport.js·js/state.js·
// js/guestMode.js·js/utils.js 수정 — "출산 준비물" 항목 직접 추가 지원, 정부지원 커스텀 항목
// 추가 기능 신규, 캘린더 그리드 이벤트 제목 이스케이프 누락 수정 — 캐시 버전 상향
// v0.2.5: js/checklistSettings.js 수정 — 정부지원 항목 삭제 시 엉뚱한 모달이 뜨던 버그 수정,
// 설정 화면 정부지원 "공통" 그룹 제거 후 임산부용/육아용에 통합 — 캐시 버전 상향
// v0.3.0: js/checklistSettings.js 수정 — v0.2.5의 정부지원 삭제 버그 수정이 실제로는
// 불완전했던 것을 재수정(#govItemsList DOM 존재 여부 → #modal.open 클래스 여부로 판단 기준
// 변경) — 캐시 버전 상향
// v0.3.1: js/checklist.js·js/checklistSettings.js·js/state.js·data/checklist-data.js·
// data/checklist-packs.js 수정 — 정부지원 표시/숨김 독립화(gov_preg/gov_born 키 분리),
// "출산 준비물" 단일 카테고리를 팩 7종으로 세분화, 임신 주차별 항목 9개 보강 — 캐시 버전 상향
// v0.3.2: js/utils.js·js/checklist.js·scripts/build-guide.mjs 수정 — 임신 주차별(preg_w04~
// preg_w36) 카테고리 라벨의 이모지(🫐/🍇/🥝 등)를 태아 크기 비교 과일 이미지로 교체, m0~m36·
// f6~f24와 같은 growthStageIconImg()/applyGrowthStageGender() 재사용(GROWTH_STAGE_FILES에
// preg_w04~preg_w36 9개 항목 추가, 성별 무관이라 boy/girl에 같은 파일 등록) — 앱·육아정보
// pregnancy.html 양쪽 다 반영 — icons/pregstage/*.png 신규 정적 파일. 캐시 버전 상향
// v0.3.3: manifest.json 수정 — id·categories 필드 추가(플레이스토어 출시 준비 중 PWABuilder
// 분석 경고 해소, 기존 동작에 영향 없는 선택 필드 추가) — 캐시 버전 상향
// v0.3.4: .well-known/assetlinks.json 신규 추가 — PWABuilder가 생성해준 Android 서명 키
// SHA-256 지문을 담은 파일(Digital Asset Links), TWA 앱에서 주소창을 없애는 데 필요.
// sw.js 캐시 대상은 아님(ads.txt와 동일하게 독립 정적 파일 취급) — 버전 표시 갱신에 맞춰
// 캐시 버전만 상향
// v0.3.5: js/auth.js·js/firebase.js·index.html·css/auth.css·functions/index.js 수정 —
// 카카오 로그인 추가(Kakao access token → Cloud Function kakaoLogin → Firebase 커스텀 토큰
// 교환 방식, docs/product-specs/kakao-login.md 참고) — 캐시 버전 상향
// v0.3.6: js/auth.js 수정 — 옹짐꾼님이 발급받은 Kakao JavaScript 키를 KAKAO_JS_KEY에 반영
// (placeholder였던 값을 실제 키로 교체) — 캐시 버전 상향
// v0.3.7: js/auth.js·js/app.js·functions/index.js 수정 — 카카오 로그인 방식 전면 교체
// (Kakao.Auth.login()이 실제 SDK 버전엔 없다는 게 콘솔 에러로 확인돼서, Kakao.Auth.authorize()
// 리다이렉트 방식으로 다시 짬 — REST API 키·Redirect URI·Firebase Secret 필요,
// docs/product-specs/kakao-login.md 참고) — 캐시 버전 상향
// v0.3.8: functions/index.js 수정 — kakaoLogin의 에러 처리 개선, 카카오 토큰 교환/사용자
// 조회 실패 시 실제 원인을 서버 로그(console.error)에 남기도록 함(이전엔 클라이언트로 보내는
// 메시지를 뭉뚱그리면서 원인 정보까지 같이 사라져서 디버깅이 오래 걸렸음) — 캐시 버전 상향
// v0.3.9~v0.3.12: 체크리스트 탭바 UI 개선, privacy/terms/contact 정적 페이지 버전 동기화,
// 가족 그룹 생성/참여 실패 시 모달이 안 닫히던 버그 수정 등 — 자세한 내용은 CHANGELOG.md 참고
// v0.3.13: fetch 핸들러의 캐싱 전략 변경 — HTML/JS/CSS는 기존 stale-while-revalidate(캐시
// 우선 응답)에서 network-first로 전환. 예전 방식은 배포 직후 첫 새로고침에서 항상 예전
// 버전이 먼저 뜨는 구조적 문제가 있었음(옹짐꾼님이 "PC는 안 되고 시크릿 창은 된다"고 겪은
// 문제의 원인) — 아래 fetch 리스너의 v0.3.13 주석 참고. 캐시 버전 상향
// v0.3.14: js/push.js·js/notifications.js 수정(알림 권한 재요청 중복 호출 제거),
// js/familyShare.js 전면 개편("배우자와 함께 쓰기" 제거, "(베타)" 표기 제거, 초대장 보내기
// 신규) — 캐시 버전 상향
// v0.3.15: js/app.js 수정 — 서비스워커 등록 직후 update() 호출 + controllerchange 시
// 자동 새로고침 추가(PC에서 탭을 오래 켜두면 새 서비스워커가 있는지 브라우저가 한동안
// 확인을 안 해서 아주 오래된 코드가 계속 실행되던 구조적 문제 해결, "설정 탭 버튼이 하나도
// 안 눌린다"는 제보의 유력한 원인). js/notifications.js 수정 — 알림 권한 허용 직후
// Notification.permission이 짧게 'default'로 오독되는 레이스 컨디션 때문에 허용 팝업이
// 한 클릭에 2번 뜨고 "알림 켜짐"으로 안 바뀌던 문제 수정 — 캐시 버전 상향
// v0.3.16: js/state.js·js/app.js 수정 — 체크리스트 항목을 누르고(디바운스 저장 대기 중)
// 곧바로 다른 항목을 누르면 먼저 누른 게 화면에서 도로 풀리던 버그의 실제 원인을 발견·수정.
// 로컬에 아직 서버로 안 보낸 변경이 있는 동안 들어오는 onSnapshot을 applyData()가 그대로
// S에 덮어써버려서 생긴 문제였음(hasPendingLocalWrite() 신설, js/app.js의 onDataLoaded()가
// 이 상태인 동안 스냅샷을 통째로 무시하도록 변경) — 설정 탭 버튼이 처음엔 하나도 안
// 눌리던 v0.3.15의 그 버그도 사실 이게 근본 원인이었을 가능성이 높음(renderSettings()가
// 스냅샷마다 무조건 다시 그려져서 방금 누른 걸 되돌리는 것처럼 보였을 것) — 캐시 버전 상향
// v0.3.17: [임시 진단 빌드] "Legend 뱃지가 아주 빠르게 깜빡이고 무지개 진행률 바는 안
// 움직인다"는 제보(2026-07-17) — 화면이 아주 짧은 간격으로 계속 다시 그려지고 있다는
// 정황인데 원인 코드 경로를 못 찾아서, js/checklist.js의 renderClMain()·js/state.js의
// debounceSave()·js/app.js의 onDataLoaded()에 호출 횟수/간격을 콘솔에 남기는 진단 로그를
// 추가함(console.log, 화면엔 안 보임) — 캐시 버전 상향
// v0.3.18: [진짜 원인 발견·수정, v0.3.17 진단 로그는 제거] 옹짐꾼님이 보내주신 콘솔 캡처에
// Firestore의 "Write stream exhausted maximum allowed queued writes" 에러가 찍혀있어서
// 무한 저장 루프를 확인함 — js/push.js의 refreshTokenIfNeeded()가 앱이 데이터를 불러올
// 때마다(js/app.js의 onDataLoaded()) 무조건 FCM 토큰을 다시 저장했는데, updatedAt이 매번
// 새로 찍혀서 "문서가 바뀜"으로 처리돼 이 기기 자신의 onSnapshot을 다시 울리고, 그게
// onDataLoaded()를 다시 부르고, 그 안에서 refreshTokenIfNeeded()가 또 저장하는 무한
// 루프였음(js/state.js의 debounceSave()를 안 거치는 직접 저장이라 v0.3.16의
// hasPendingLocalWrite() 가드로도 못 막았음). 이 루프가 도는 동안 현재 화면이 계속 통째로
// 다시 그려져서 PC 설정 탭 버튼 먹통(v0.3.15/16)·모바일 Legend 뱃지 깜빡임(v0.3.17)이 둘 다
// 이게 근본 원인이었던 것으로 확인됨 — 토큰 값이 실제로 바뀌었거나 24시간이 지났을
// 때만 저장하도록 수정해서 무의미한 반복 쓰기 자체를 원천 차단(js/push.js) — 캐시 버전 상향
// v0.3.19: 모바일에서 알림 권한 팝업이 여전히 2번 뜨고 "알림 받기"에서 안 넘어가던 잔여
// 버그 수정 — js/notifications.js의 waitForGrantedPermission() 최대 대기 시간을 250ms→
// 2.5초로 늘리고, 그 안에도 Notification.permission이 'granted'로 확정 안 되면
// enablePushNotifications() 호출 자체를 건너뛰도록 함(Firebase getToken()이 또 권한을
// 요청해 팝업이 한 번 더 뜨고, 그마저 브라우저의 팝업 연타 방지에 걸려 조용히 실패하며
// 영영 'granted'로 안 넘어가던 문제 차단) — 캐시 버전 상향
// v0.3.20: v0.3.19 적용 후 팝업 중복은 없어졌는데, "허용"을 눌러도 화면이 "알림 켜짐"으로
// 안 바뀌는 기기가 있다는 재제보 — Notification.permission 라이브 값 자체가 일부 기기에서
// 2.5초를 기다려도 안 바뀌는 것으로 확인됨. js/notifications.js의
// renderNotificationSettings()가 forcedPerm(파라미터)을 받으면 라이브 값을 다시 안 읽고
// 그 값을 그대로 쓰도록 수정 → requestNotificationPermission()이 이미 확실히 아는
// result 값을 직접 넘겨서, 라이브 프로퍼티가 늦게 갱신되는 기기에서도 화면만큼은 즉시
// 정확하게 반영되도록 함(진짜 FCM 푸시 등록은 여전히 라이브 값이 확인된 경우에만 시도해서
// 팝업 중복은 그대로 안 남) — 캐시 버전 상향
// v0.3.21: 옹짐꾼님 재제보 2가지 — (1) 2.5초 대기가 체감상 너무 김: 화면 갱신이 그 대기를
// 기다린 "뒤에" 일어나도록 짜여 있어서 생긴 문제 → 화면은 즉시 갱신하고, 대기는 Firebase
// 이중 팝업 방지용 백그라운드 판단에만 쓰도록 재구성(js/notifications.js). (2) 하위 설정
// (오늘 일정 알림/정부지원 마감 알림/알림 받을 시간대)을 바꾸거나 "끄기"를 누르면 매번
// "알림 받기"로 되돌아감 → 일부 모바일 브라우저는 한 번 허용된 뒤에도
// Notification.permission 라이브 값을 계속 잘못(=여전히 'default') 보고하는 것으로 확인됨
// (v0.3.20의 forcedPerm은 그 순간 한 번만 임시로 덮어썼을 뿐이라, forcedPerm 없이 다시
// 그려지는 다른 모든 렌더 호출은 여전히 이 잘못된 라이브 값을 신뢰하고 있었음). "한 번이라도
// 확실히 허용된 걸 확인했다"는 사실을 로컬(localStorage)에 기억해두고, 라이브 값이
// granted/denied 둘 다 아닐 때는 그 기억을 우선 신뢰하는 effectivePermission() 도입 —
// 캐시 버전 상향
// v0.4.0: 캘린더 테마 선택 UI 삭제, 스티커 피커 아코디언+PC 가로 넘김, 날짜 재클릭 시
// 일정 추가 팝업 — index.html/CSS/JS 정적 리소스 변경으로 캐시 버전 상향
// v0.4.3: [버그 수정] 멀티데이 일정 이어지는 칸이 완전히 안 보이던 문제(빈 텍스트 줄
// 높이 0 붕괴) 수정 — index.html/CSS/JS 정적 리소스 변경으로 캐시 버전 상향
// v0.4.4: [버그 수정] 멀티데이 일정 진짜 원인(max-width:100%가 음수 마진을 막고 있었음)
// 수정 + 홈 위젯 팝업 오작동 수정 + 온보딩 튜토리얼 신규 추가 — 정적 리소스 변경으로
// 캐시 버전 상향
const CACHE_NAME = 'momcal-shell-v107';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/auth.css',
  './css/calendar.css',
  './css/checklist.css',
  './css/modal.css',
  './css/growth.css',
  './css/tutorial.css',
  './js/accountDelete.js',
  './js/adSlot.js',
  './js/app.js',
  './js/auth.js',
  './js/calendar.js',
  './js/calFontSize.js',
  './js/checklist.js',
  './js/checklistSettings.js',
  './js/checklistCalendarLink.js',
  './js/demoMode.js',
  './js/familyShare.js',
  './js/firebase.js',
  './js/fontSize.js',
  './js/govSupport.js',
  './js/growth.js',
  './js/growthChart.js',
  './js/guestMode.js',
  './js/homeWeekWidget.js',
  './js/modal.js',
  './js/notifications.js',
  './js/pwaInstall.js',
  './js/push.js',
  './js/splash.js',
  './js/state.js',
  './js/theme.js',
  './js/tutorial.js',
  './js/ui.js',
  './js/utils.js',
  './js/vaccineSeries.js',
  './data/checklist-data.js',
  './data/checklist-links.js',
  './data/checklist-packs.js',
  './data/government-support.js',
  './data/milestones.js',
  './data/pregnancy.js',
  './data/tips.js',
  './data/vaccine-series.js',
  './data/vaccines.js',
  './data/who-growth.js',
  './data/kr-holidays.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/logo-mark.png',
  './fonts/OwnglyphParkDahyun.ttf', // v0.0.3: 커스텀 폰트 추가 — 오프라인에서도 폰트가 깨지지 않도록 미리 캐싱
  './fonts/OmyuPretty.ttf', // v0.0.5: 세부 정보용 폰트 추가
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // 캐싱 실패해도 설치 자체는 진행 (일부 파일 누락 시 앱이 죽지 않도록)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 같은 출처(same-origin) 요청만 캐싱 대상 — Firebase Auth/Firestore, CDN 등은 그대로 네트워크로
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  // v0.3.13: HTML/JS/CSS(=코드가 들어있는 파일)는 network-first로 전환.
  //
  // 예전 stale-while-revalidate 방식은 "캐시가 있으면 일단 그걸 즉시 보여주고, 백그라운드로
  // 최신본을 받아서 캐시만 갱신"하는 구조라, 배포 직후 첫 새로고침에서는 항상 예전 버전이
  // 먼저 뜨고(캐시 우선 응답) 다음 새로고침에야 최신본이 보였음 — self.skipWaiting()/
  // clients.claim()으로 새 서비스워커가 즉시 활성화돼도 이 문제와는 무관했음(문제는 SW 교체
  // 시점이 아니라 fetch 전략 자체였음). 실제로 옹짐꾼님이 "PC는 안 되고 모바일은 되고,
  // 시크릿 창은 된다"고 겪은 문제가 바로 이거였음(시크릿 창=캐시 자체가 없어서 항상 네트워크로만 감).
  //
  // 아이콘·폰트처럼 자주 안 바뀌고 용량이 큰 파일은 그대로 캐시 우선(stale-while-revalidate)
  // 유지 — 오프라인 지원과 로딩 속도 이점을 살림. 코드 파일만 "온라인이면 무조건 최신,
  // 오프라인일 때만 캐시로 대체"로 바꿔서 이 클래스의 버그를 구조적으로 없앰.
  const isCodeFile = /\.(html|js|css)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

  if (isCodeFile) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request)) // 오프라인일 때만 캐시로 대체
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached); // 오프라인이면 캐시로 대체

      return cached || fetchPromise;
    })
  );
});

/**
 * v0.0.36: 진짜 FCM 푸시 수신 핸들러 — Sprint 29 때 만들어둔 뼈대를 실제로 연결함.
 *
 * "브링 유어 오운 서비스워커(Bring your own service worker)" 방식: Firebase의
 * firebase-messaging-sw.js(compat SDK) 없이, 이 sw.js가 직접 'push'/'notificationclick'을
 * 처리함 — js/push.js의 getToken() 호출 시 serviceWorkerRegistration으로 이 sw.js의
 * registration을 넘겨주면 Firebase가 이 핸들러로 알림을 전달해줌(공식 지원 방식).
 * firebase-messaging-sw.js를 별도로 안 두는 이유: 이미 앱쉘 캐싱용 sw.js가 있는 상태에서
 * 서비스워커를 2개 등록하면 스코프 충돌 위험이 있어서, Firebase 공식 문서도 기존
 * 서비스워커가 있으면 이 방식(직접 처리)을 권장함.
 *
 * 페이로드 형태: Firebase 콘솔의 "Cloud Messaging → 캠페인" 화면에서 보낸 메시지는
 * { notification: {title, body, icon}, data: {...} } 형태로 옴. data-only 메시지
 * (Admin SDK/서버에서 notification 필드 없이 보낸 경우)는 최상위에 바로 title/body가
 * 올 수도 있어서 두 형태 다 대응함.
 *
 * ⚠️ 이 핸들러는 "받는" 쪽만 담당함 — 실제로 언제·누구에게 보낼지는 Firebase 콘솔에서
 * 수동으로 캠페인을 만들어 보내거나(코드 불필요), "예방접종 하루 전"처럼 자동화하려면
 * 별도 서버 스케줄러(Cloud Functions + Cloud Scheduler, Blaze 요금제)가 필요함 —
 * docs/TODO.md "FCM 2단계(자동 발송)" 참고.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch (e) { payload = { notification: { title: '맘캘 MomCal', body: event.data.text() } }; }

  const n = payload.notification || payload; // notification 필드가 없으면 data-only 메시지로 간주
  const title = n.title || '맘캘 MomCal';
  const body  = n.body  || '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: n.icon || './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: payload.data || {},
    })
  );
});

/** 알림을 탭하면 앱 창을 포커스하거나 새로 열어줌 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
