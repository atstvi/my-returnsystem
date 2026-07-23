# 타이머/Timer — UI·UX 감사 + 리디자인 (§7 playbook, 큰 리디자인)

> 오너: **"리디자인이 좀 크게 필요할듯"** — 시간표(표면만)와 달리 타이머는 구조 개편 승인.
> 레퍼런스(과목 스톱워치 + 색점 기록 리스트 + 시간대 타임라인)를 Return 로즈/MZ 팔레트로 옮김.
> 방향 승인(AskUserQuestion): **① 한 화면 통합(시안대로) · ② 할일 연결 유지**(과목/카테고리 개념 도입 안 함).
> 기능 무손실(§6.0/§6.4).

## A. 구조 · 기능 지도 (유지 — 하나도 안 빠짐)

**셸**: `#page-timer > .focus-timer-page > #focus-timer-root`, `renderFocusTimer()`가 전부 그림.
- **모드** 3종 — 포모도로/카운트다운/스톱워치 (`data-focus-mode`). 상태: `focusTimerState`,
  설정: `focusTimerCfg`(localStorage, device-local).
- **컨트롤** — ↺ 초기화(`#focus-timer-reset`) · ▶/⏸(`#focus-timer-toggle`) · ■ 중단
  (`#focus-timer-stop`) ｜ 🔔 알림(`#focus-timer-noti`) · 포모도로 건너뛰기(`#focus-timer-skip`).
- **소리** 5종 — 없음/백색소음/갈색소음/빗소리/바이노럴 (`data-focus-sound`) + 소리 크기 슬라이더.
- **할일 연결** — `#focus-timer-task-btn`(`focusTimerShowTaskPicker`), 링크 시 `linkedTaskId`.
- **설정 접기** — `#ft-settings-toggle`/`#ft-settings-body`(집중/휴식 분·주기·자동전환·볼륨).
- **집중 기록** — 주간 시간대 그리드(`focusLogHtml`/`focusWeekAggregate`), 직접추가
  (`focusTimerManualAdd`), 탭 삭제(`focusTimerDeleteRecord`), 상단 세그먼트(`data-ft-view`).
- **미니창** — `renderFocusTimerMini`(드래그 이동, `focus_timer_log_v1`은 device-local, 위젯 동기화).

## B. UX 감사 (심각도)

| # | 위치 | 문제 | 방향 | 상태 |
|---|---|---|---|---|
| T1 | 상단 탭 | 타이머 콘솔과 집중 기록이 **두 화면으로 분리** — 돌리면서 오늘 쌓이는 걸 못 봄 | 레퍼런스처럼 **한 화면 통합**(콘솔 + 오늘의 집중) | ✅ |
| T2 | 시계 | 큰 디지털 + 밑에 **납작한 진행 막대** — raw, 정보 밀도 낮음 | 시계를 **진행 링(progress ring)** 안에 배치, 남은 시간이 원형으로 참 | ✅ |
| T3 | 기록 표현 | 모드 색이 주간 그리드에만 있고 **오늘 요약이 없음** | **오늘 총합·세션·평균·포모 + 시간대 타임라인 + 최근 기록 리스트**(모드 색점) | ✅ |
| T4 | 팔레트 | 모드 색(#F2784B/#38B2AC/#8B84FF)이 앱 로즈와 살짝 튐 | 채도 낮춘 **#E08A5B(포모)/#4FB0A6(카운트다운)/#9B8CF0(스톱워치)** 로 통일 | ✅ |

## C. SHIPPED (큰 리디자인, strangler-fig)

**한 화면 통합** — 상단 세그먼트를 `오늘`/`주간 기록`으로 재구성(`data-ft-view` 훅 유지). `오늘`은
2컬럼 `.ftu-grid`: **좌 = 타이머 콘솔**(기존 전부 유지) + **우 = 오늘의 집중** 카드(`focusTodayHtml`).
`주간 기록`은 기존 주간 그리드 그대로.

**진행 링** — 납작한 막대(`.focus-timer-progress`)를 시계를 감싸는 SVG 링(`.ftu-ringwrap`/
`#focus-timer-ring`)으로 교체. `focusTimerTick`이 `stroke-dashoffset`를 라이브 갱신(막대 갱신 코드도
방어적으로 유지). 스톱워치(무목표)는 트랙만 표시. 링 색은 모드색(휴식 단계는 로즈).

**오늘의 집중 패널** — `focusTodayAggregate`(순수 함수, 오늘 로컬 하루로 세션 귀속 → 총합/세션/평균/
모드카운트 + 위치 블록 + 시간대 fit). 패널: 총합 헤드 · 미니 통계 3칸 · **시간대 타임라인**(축 + 시간선 +
모드색 블록) · **최근 기록 6개**(모드 색점 + 이름 + 완료시각 + 시간) · 범례. 블록·기록 탭 → 삭제 확인
(`focusTimerDeleteRecord`), `+ 직접 추가`(`#ft-today-add`) → `focusTimerManualAdd`.

**팔레트 통일** — `_ftModeColor` 3색을 채도 낮춘 값으로 교체(주간·오늘·기록 리스트 일관). CSS 변수
`--pom/--cd/--sw`를 `#focus-timer-root`에 정의.

## D. 검증

헤드리스 데스크탑(라이트/다크)·모바일·빈상태 렌더 — **0 pageerror**, 가로 오버플로 없음. 인터랙션 스모크:
시작(카운트다운 + 링 라이브)·일시정지·모드전환(스톱워치 링 제거)·주간↔오늘 전환·기록 삭제 모두 정상.
`npm test` green(전 스위트), UI 인벤토리 diff는 **라인번호 이동 노이즈만**(기능 훅 손실 0 —
`data-ft-view`/`data-focus-mode`/`data-focus-sound`/`renderFocusTimer` 모두 유지).

## E. 레이아웃·밀도 패스 (오너 피드백)

- **헤더 재배치** — 상단 중앙에 떠 있던 `오늘/주간` 세그먼트를 **페이지 헤더**로: 왼쪽 `⏱ 타이머`
  제목(SVG) + 오른쪽 세그먼트(`.ftu-header`/`.ftu-page-title`). 두 뷰 공통.
- **화면 활용** — `#focus-timer-root` max-width 1040→**1320**, `.focus-timer-page` 좌우 패딩↑,
  `.ftu-grid` 컬럼 `460px + 1fr`·gap `--sp-6`. 콘솔 링·시계·패딩 키움.
- **타임라인 전체 24시간 + 스크롤** — 오늘/주간 모두 fit-range를 버리고 **00–24 전체**를 그리며,
  `wireFocusToday`/`wireFocusLog`가 첫 세션 시각으로 **자동 스크롤**(`data-scrollhour`/`data-slot`).
  행 높이 오늘 34→**56px**, 주간 34→**52px**, 블록 최소 높이↑ → 짧은 세션도 읽힘. 오늘 타임라인은
  테두리+`--bg-sunken` 박스로 감싸 여백 확보. (오늘 flex-축 압축 버그: `.ftu-tl-hour{flex-shrink:0}`.)
- **밀도** — 오늘 카드 패딩 `--sp-7/6`, 통계 타일 `--r-lg`+패딩↑, 기록 행 여백↑. 주간 뷰를
  `.ftl-wrap` **카드**(elev-1·패딩)로 감싸고 통계 타일을 중첩표면 규칙대로 그림자 제거(§3.2).

## F. 구역형 전환 — 할일 탭 패턴 (오너 피드백: "카드형 말고 구역을 나눠서")

떠 있는 두 카드 대신 **할일 탭(`.task-page`/`.list-panel`)처럼 전면(全面) 평면 표면을 분할선으로 나눈다.**
- `.focus-timer-page`는 `height:100%;overflow:hidden`, `#focus-timer-root`가 **bg-card 표면**을 꽉 채움.
- **상단 바** `.ftu-topbar`(제목 + 오늘/주간 세그먼트, `border-bottom` 한 줄).
- **오늘** = `.ftu-body`(flex row): **콘솔 존**(`.ftu-console-zone`, 세로 중앙, `border-right` 분할선) ｜
  **오늘의 집중 존**(`.ftu-today-zone`, `flex:1`, 스크롤). 각 존은 카드 크롬 제거(그림자·라운드·테두리 없음),
  분할선으로만 구분. **주간** = `.ftu-body-week` 단일 스크롤 표면.
- 콘솔/오늘/주간 내부 요소는 그대로 유지하되 감싸던 카드(`box-shadow`/`border`/`radius`/`padding`)만 벗김.
- <900px에서는 존이 세로로 쌓이고 분할선이 `border-bottom`으로 전환.

## G. 타이틀 바 제거 + 토글 재배치 + 밀도 재감사 (오너 피드백)

- **타이틀 밴드 제거** — `⏱ 타이머` 제목 바(`.ftu-topbar`)는 사이드바가 이미 탭 이름을 주므로 중복 → 삭제.
- **오늘/주간 토글 재배치** — 밴드 대신 각 뷰의 **헤더 행 우측**으로 이동(`focusViewTabs()`):
  오늘 = `오늘의 집중` 헤더 오른쪽, 주간 = 주간 바 오른쪽(+기록추가 옆). 두 뷰 모두 **우측 상단**으로 통일.
- **타임라인 폭 제한** — 전면 존에서 하루 타임라인이 끝까지 늘어져 성겨 보이던 걸, `.ftu-today` **max-width 760** 중앙정렬로 편안한 가독 폭 확보.
- **통계 타일 평탄화** — 테두리 제거(§3.2 중첩표면), `--bg-raised` 채움만. 카드 같은 인상 완화.
- **구역 구분선** — 타임라인과 `기록` 섹션 사이 `border-top` 분할선 추가.
