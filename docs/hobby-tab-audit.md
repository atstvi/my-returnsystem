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

## B. P1 — 디자인 시스템 정합 (선택 날짜 색 + 섹션 아이콘)

- **선택 날짜** `.hob-day.selected` 배경 `--n-700`(near-black) → **`--accent`**(로즈). §2.1.2 no-true-black.
- **우측 섹션 라벨** `취미 카테고리`/`이번 달 요약`에 §3.9 `.sec-ico` 라인 아이콘(4-그리드 / 3-바) 추가.
  `.hobby-right .right-section-label`만 flex+아이콘으로 스코프(다른 탭 `right-section-label` 불변).
- 검증: 선택 배경 `rgb(167,95,102)`, 라벨 아이콘 2개, pageerror 0. `npm test` 32스위트 통과. CSS/HTML만.

## C. P2 — 이번 달 요약 숫자 경량화

- `.stat-num` `text-xl`/`fw-bold`/`--fg` → `text-lg`/`fw-semibold`/`--fg-2` + `tabular-nums`. 무거운 볼드
  검정 숫자를 타 탭(타이머·태스크) 기정리 패턴으로 통일.
- 배너 세로 공간은 사용자 배경사진 기능(`hobby_banner_v1`, 루틴 탭과 동형)이라 의도된 영역 → 유지.
- 검증: pageerror 0, `npm test` 32스위트 통과. CSS만.

## D. 카테고리 카드 — 완료율 → 즐김 프레임 (오너 피드백)

오너: "카테고리 박스 안 정보(N개 항목·N개 완료)가 취미 할일 관리로서 무의미."
- **완료율 → 빈도·최근성**: `hobCatStatHtml(catItems)`가 `이번 달 N번 · 마지막 D일 전`을 렌더(각
  기록=한 번 즐긴 것; date≤오늘만 집계). 항목 없으면 `아직 즐긴 기록이 없어요`.
- **돌아오기 넛지**: 마지막 활동이 14일 이상 지난 취미엔 로즈 `돌아올 때가 됐어요` 알약(`.cat-stat-nudge`)
  — 앱의 Return/돌아오기 철학 + "의무 아닌 즐거움".
- 28일 활동 히트맵은 즐김 리듬(잔디)이라 취지에 맞아 유지.
- 검증: 게임=`이번 달 3번·마지막 오늘`(넛지X), 등산=`…20일 전`+넛지O. pageerror 0, `npm test` 32스위트 통과.

## E. 재정의 — 과거 즐김 → **다가올 즐거움 기대** (오너 취지 설명)

오너: "이 탭의 취지는 할일만 앞으로 쌓이면 살아갈 힘이 안 나니까, **앞으로 다가오는 날들의 이벤트를
'기대'**하려고 만든 것. 원형 체크도 할일 느낌." → D의 과거 지향(빈도/최근성)을 미래 지향으로 뒤집음.
- **카테고리 카드**: `hobCatStatHtml`가 이제 **다음 다가오는 일정 D-day**를 렌더 —
  `D-3 김환기 전시 외 1개` / `오늘 신작 출시일` / (다가올 것 없으면) `다가올 계획을 더해봐`(기록 있음) ·
  `다가올 즐거움을 그려봐`(빈 카테고리). `.cat-next-dday`(로즈 D-day 알약)/`.cat-next-text`/`.cat-upc-more`.
- 검증: 전시=`D-3 …외 1개`, 등산(과거만)=`다가올 계획을 더해봐`, 게임(오늘)=`오늘 …`. pageerror 0,
  `npm test` 32스위트 통과.
- (후속) 원형 체크박스 de-task-ify, 이번 달 요약의 완료 지표 재검토, 히트맵(과거) 위치 재고.

## F. 카드 히트맵(과거 동그라미 그리드) → 다가오는 일정 타임라인 (오너)

오너: "카드 안 히트맵 같은 동그라미 많은 게 할일 느낌." (직전 '체크' 지적은 이것, day-detail 체크박스 아님)
- 28일 **과거 활동 히트맵**(`.cat-heatmap`/`.hm-cell`, 완료 트래커처럼 보임) 제거.
- **다가오는 일정 타임라인**(`.cat-fwd-line`/`.cat-fwd-dot`)으로 교체: 오늘~+28일 얇은 3px 트랙 위에
  **다가오는 계획**마다 카테고리색 점을 D-day 위치에 배치. 다가올 게 없으면 라인 미표시.
- 검증: 히트맵 DOM 0, 전시=점3(D-3/10/21), 게임=점1(오늘), 등산(과거만)=라인 없음. pageerror 0,
  `npm test` 32스위트 통과.
