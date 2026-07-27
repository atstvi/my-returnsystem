# 취미(Hobby) 탭 재설계 노트

키워드: #생산성 #sns(x)st #mz20대여성st #세련 #깔끔 · 로즈 액센트/디자인 토큰 정합.
플레이북: design-system §7 (이해 → 감사 → §2~4 타깃 → strangler-fig → 상태설계 → 헤드리스 검증 → 소PR).

## 현황 (이해)

- **구조**: `#page-hobby` → `.hobby-page`
  - `.hobby-banner`: `🎨 취미` + "의무가 아닌 즐거움의 공간" + 배너 이미지 편집/위치(`btn-banner`/`btn-banner-pos`).
  - `.hobby-body`(2단 grid `1fr 340px`):
    - `.hobby-left`: 월 네비(`hob-month-label`·prev/next·오늘·풀뷰) + 달력(`hob-days`) + 날짜 상세(`hob-detail-*`·`hob-items-list`·`openItemModal`).
    - `.hobby-right`: 취미 카테고리(`cat-cards`·`hobOpenCatModal`) + 이번 달 요약(`summary-stats`).
- **데이터**: `hobby_cats_v2`(id/name/icon/color), `hobby_items_v2`(id/text/catId/type(event|todo)/date/timeStart/timeEnd/note/done). 상태 `cats`/`items`/`hobMonth`/`hobSelDate`/`filterCatId`/`hobFullView`. 렌더 `hobRenderCal`/`hobRenderCats`/`hobBuildItemEl`, 요약, `_initHobby`.

## 감사 (심각도순)

### P0 — 모바일 레이아웃 붕괴 (버그)
`.hobby-body`의 2단 grid(`display:grid;grid-template-columns:1fr 340px`, index.html:3727)가 모바일 미디어쿼리
(`@media(max-width:639px)`, 1737~1749의 `display:flex`/`grid-template-columns:1fr`)보다 **소스 뒤**라
동일 특이도에서 뒤가 이겨 **모바일에서도 2단 유지**. 390px에서 234+340=574px → 우측 카테고리/요약이 화면
밖으로 잘리고 달력이 찌그러짐. (측정: `display=grid`, `grid-template-columns: 233.5px 340px`.)
`.hobby-left`의 `border-right`도 같은 소스순 문제로 모바일에서 안 사라짐.
→ **수정 방향**: 모바일 퍼스트로 베이스를 단일 컬럼, `@media(min-width:…)`에서 2단.

### P1 — 디자인 시스템 위반
- **선택 날짜가 검정** 하이라이트(§2.1.2 "no true black" 위반) → 로즈 액센트.
- 배너 제목 이모지 `🎨`, 우측 라벨 `취미 카테고리`/`이번 달 요약` plain → §3.9 `.sec-ico` 라인 아이콘.
- 배너 편집 버튼 이모지 `🖼`/`↔` → 라인 아이콘.
- 토요일 파랑(`--p-400`)·일요일 빨강 → 로즈 팔레트와 충돌(완화 검토).

### P2 — 레이아웃/UX
- 배너가 빈 그라데이션 밴드로 세로 낭비(충전 히어로와 동형 문제).
- 이번 달 요약 숫자가 무겁게 큼 → tabular-nums·경량화(타 탭 기정리 패턴).
- 카테고리 카드 우측 컬러바+점이 다소 산만.

## A. P0 — 모바일 단일 컬럼 (버그 수정)
(구현 기록은 이 아래에 추가)

- **수정**: 베이스 `.hobby-body`를 모바일 퍼스트 단일 컬럼(`grid-template-columns:1fr`)으로, 2단은
  `@media(min-width:820px){grid-template-columns:1fr 340px}`로 옵트인. `.hobby-left` `border-right`도
  같은 min-width 쿼리로 이동(모바일 하이라인 제거).
- **검증**: 390=`1fr`(stacked), 768=`1fr`(stacked), 1440=`1fr 340px`(2단). 세 폭 모두 가로 오버플로 0,
  pageerror 0. `npm test` 32스위트 통과. 훅/JS 미변경(CSS만).
