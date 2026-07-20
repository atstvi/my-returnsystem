# 루틴/Routine — UI·UX 감사 + 구조 리디자인 제안 (§7 playbook A+B, then structure)

> Routine 탭은 색·아이콘 수준이 아니라 **구조 리디자인**이 필요하다는 오너 지시. Home(§5.1)·
> Tasks(§5.2)를 레퍼런스로, design-system §1 원칙 + north-star(#생산성·SNS(X)-앱st·MZ 20대
> 여성st·세련·깔끔)에 맞춘다. 기능은 무손실(§6.0) — 구조만 재배치.

## A. 구조 · 기능 지도 (무손실 대상)

**셸**: `#page-routine > .routine-page > .routine-shell`.

- **히어로** `.routine-hero`: 제목 "루틴" + 긴 설명 + 액션 3개 — `routine-reset-today`(오늘 초기화)
  `routine-new-bundle`(+묶음) `routine-new-habit`(+습관).
- **강도(condition)** `#routine-condition-row`: Mini / Plus / Max 3택 (`routineCondition`,
  `renderRoutineConditions`) — **현재 `hidden`이라 거의 안 보임**.
- **오늘 루틴** `#routine-bundles` (`renderRoutineBundles`): 묶음 카드들. 각 묶음 헤드 = 아이콘+이름 ·
  슬롯 · done/total · `↑↓`(순서) · `▶`(타이머 시작) · `+습관` · `편집` · `삭제`. 각 습관 행 =
  아이콘+제목 + plan + **`선택 ▼` 상태 드롭다운(done/skip/rest)** + `×`.
- **습관 보관함** `#routine-habit-list` (`renderRoutineLibrary`): 재사용 습관 목록. 행마다 아이콘+제목 ·
  Mini/Plus/Max 칩 · `편집` · `삭제`.
- **주간 달성 현황** `#routine-stats` + `#routine-week-grid` (`renderRoutineStats`): 스탯 타일 3개
  (오늘 완료 / 쉼 / 강도) + 최근 7일 점-그리드.
- **타이머/재생 모드**: `▶` → 묶음 습관을 순서대로 타이머로 안내(`renderRoutineTimerToast`, 난이도·
  상태 컨트롤, 다음 습관, 종료 예상 시각). 홈 빠른 루틴(`renderHomeRoutineQuick`)·Notion 습관 동기화
  (`queueHabitNotionSave`)가 같은 데이터를 읽음 — **전부 유지**.

> 유지 대상 hooks: `routine-reset-today`/`-new-bundle`/`-new-habit`, `data-routine-condition`,
> `data-routine-bundle`/`-habit`/`-state`/`-edit-bundle`/`-delete-bundle`/`-edit-habit`/
> `-delete-habit`, 타이머 컨트롤 ids, `renderRoutine*`. 리디자인 후 inventory diff 0 손실 확인.

## B. UX 감사 — 왜 "심각하게 못생김"인가

| # | 문제 | 원인 | 방향 |
|---|---|---|---|
| R1 | **관리자 스프레드시트 느낌** | 행마다 텍스트 버튼(편집·삭제·선택▼·×·+습관·↑↓·▶)이 빽빽 | 일상 "실행" 화면으로. 관리 액션은 `⋯` 오버플로우/모달로 숨김 |
| R2 | **완료 체크가 `선택 ▼` 드롭다운** | 상태를 드롭다운으로 고름 — 느리고 안 예쁨 | Tasks처럼 **원형 체크(탭=완료)**, 건너뜀/쉼은 보조 제스처(길게/스와이프/작은 메뉴) |
| R3 | **완료 피드백 없음** | "0/3 완료" 텍스트뿐, 링/바 없음 | 묶음마다 **진행 링**, 상단 오늘 전체 진행 요약 |
| R4 | **강도(Mini/Plus/Max)가 숨겨짐** | 핵심 개념인데 `hidden` + 체크 시 plan이 안 보임 | 오늘 강도를 **상단 세그먼트로 노출**, 체크 행에 선택된 강도의 plan을 부제로 |
| R5 | **습관 보관함이 상시 2번째 컬럼** | 관리용인데 매일 화면을 반 차지, Mini/Plus/Max 칩이 비인터랙티브 | 관리 영역은 **접기/모달**로(오늘 실행이 주인공) |
| R6 | **삭제 빨강 버튼 산재** | 파괴적 액션 인라인 노출 | `openConfirmDialog` + 오버플로우 메뉴로 격리(§3.5) |
| R7 | **크롬이 이모지/글리프** | ↑↓ ▶ × ▼ 등 | SVG 라인아이콘(§3.9). 습관 아이콘 이모지는 사용자 콘텐츠라 유지 |
| R8 | **주간 그리드가 밋밋** | 단순 점 그리드 | 세련된 히트맵/스트릭(습관별 7일 or 캘린더 히트맵) |

## C. 제안하는 새 구조 ("오늘 실행" 우선)

1. **오늘 헤더 (do-first)** — 날짜 + **오늘 전체 진행 링/바** ("오늘 3/4") + **강도 세그먼트
   (Mini · Plus · Max)** 를 크게. 관리 버튼(+습관/+묶음/초기화)은 `⋯` 메뉴로.
2. **묶음 카드 = 실행 카드** — 헤드: 아이콘+이름 · 슬롯 · **진행 링** · **▶ 루틴 시작** · `⋯`(편집/
   순서/삭제). 습관 행: **원형 체크** + 제목 + (선택 강도의 plan 부제). 완료 시 체크 채워지고 줄 그어짐.
   건너뜀/쉼은 체크 롱프레스 or 행 우측 작은 상태 토글로.
3. **습관 보관함 → 접이식/모달** — 기본 접힘 or "습관 관리" 버튼으로 모달(Tasks 활성규칙 패턴 재사용).
4. **주간 달성 → 히트맵** — 습관별 7일 도트 라인 또는 요일 히트맵, 스트릭 강조. 세련·깔끔.

> 이 방향은 Home 오늘 습관 카드(§5.1 미니 스트릭)·Tasks 카드/모달 언어와 통일. 타이머/재생·CRUD·
> 강도·로그·Notion·홈 연동은 모두 보존.

## D. 구현 완료 (SHIPPED)

오너 확정(오늘 실행 우선 + 탭 체크) 후 §C 그대로 구현. 최종 render 오버라이드
(`renderRoutineHeader/Conditions/Bundles/Stats/Routine`)로 기존 헬퍼 전부 재사용 →
타이머·CRUD·강도·로그·Notion·홈 연동 보존. 헤드리스 검증: 진행 링(3/4=75%), 탭 체크 토글,
상태(건너뜀/쉼) 팝오버, 강도 세그먼트, 묶음 `⋯` 메뉴, 습관 보관함 모달, 주간 히트맵 — 0 pageerror.
`npm test` green, inventory 기능 hook 0 손실(라벨 3개만 메뉴로 이동). design-system §5.3 기록.
