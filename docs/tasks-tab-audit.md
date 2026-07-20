# 할일/Tasks — UI·UX 감사 (Step A+B of the §7 playbook)

> `design-system.md §7` 플레이북의 A(이해+기능감사)·B(UX감사) 산출물. Home(§5.1)을 레퍼런스로,
> §2~4 컴포넌트에 맞춰 정리한다. **구조는 유지**(카테고리/달력 사이드바·뷰 스위처·반복/규칙 — 사용자가
> refs보다 높게 평가, §5·§1 원칙1), **표면·아이콘·보조액션·상태**를 정리한다. 기능 제거는 먼저 묻는다(§6.0).

## A. 구조 · 기능 지도 (무손실 대상)

**셸**: `#page-tasks > .task-page` = 좌 `.cal-panel` + 우 `.list-panel`.

**좌 — 달력 패널**
- 월 네비: `cal-prev/cal-month/cal-next/cal-today` · 렌더 `renderCal`
- 컨트롤: `btn-cal-view`(콤팩트↔전체) `btn-dl-view`(마감 연결 뷰) `btn-tt-hide`(시간표) `btn-done-hide`(완료숨김)
- 카테고리 필터: `.cat-filter .cat-chip[data-cat]`(전체+카테고리+📌) · `renderTaskCatFilter`
- 달력 그리드 `#cal-days` + 마감연결 캔버스 `#dl-canvas`(`renderDlCanvas` — same/cross-row 링크선)

**우 — 목록 패널**
- 날짜 헤더 `list-date/list-date-sub` + 진행바 `progress-fill`
- 뷰 스위처 `.view-btn[data-view]`(목록/우선순위/마감/타임블록) · `renderList`/`renderTaskWeekView`
- 아이콘 버튼: `btn-sel-mode`(선택) `btn-task-search`(검색) `btn-add`(추가) `btn-more`(더보기)
- 검색/필터 행: `task-search-input` + scope/kind/from/to selects + `task-select-filtered`
- 대량작업 바 `#bulk-bar`: bulkDone/Undone/MoveDate/Delete/exitSelMode
- 빠른추가 `#add-wrap`: add-input + 우선순위/카테고리/마감 칩 + confirmAdd/closeAdd
- 카테고리 섹션 `#task-sections`(카테고리별 접이식 그룹, 헤더=이모지+이름+개수+`+`+접기)
- 활성 규칙·반복 할일 박스(`home-rule-btn`/`home-repeat-btn`), 더보기 메뉴 `#more-menu`(이름삭제/완료삭제/지난→오늘)
- 편집: `tasksOpenModal`/`saveModal`(Home에서 이미 통일된 모달 + 역방향 링크)

> 모든 `id`/`data-view`/`data-cat`/`onclick`은 유지 대상. 리디자인 후 `ui-inventory` diff 0 손실 확인.

## B. UX 감사 (Phase 3) — 심각도 P0→P2

| # | 위치 | 문제 | 방향(§참조) | 심각도 |
|---|---|---|---|---|
| T1 | 달력 컨트롤(콤팩트/마감뷰/시간표/완료숨김) | **이모지 아이콘**(📆🔗🎓) + 텍스트가 두 줄로 빽빽. 앱 SVG 라인아이콘 체계와 이질 | 크롬 아이콘 → **SVG 라인아이콘**(§3.9/§4.1). 토글류는 on/off 상태가 보이게(active tint) | **P0** |
| T2 | 목록 헤더 버튼(☑ ⌕ ＋ ⋯) | **글리프 아이콘**, 작고 의미 약함 | `.icon-btn` + **SVG**(선택/검색/추가/더보기) 통일 | **P0** |
| T3 | 카테고리 필터 칩 | **이모지만** 있는 칩 — 무슨 카테고리인지 색/텍스트 없이 파악 어려움 | 카테고리 **색 점(§2.1.5 muted) + 이모지/이름**, active=tint(§3.3 칩 패턴). 이모지는 사용자 콘텐츠라 유지하되 색으로 식별 보강 | P1 ✅ |
| T4 | 카테고리 섹션 헤더 | 이모지+이름+개수+`+`+접기 — 개수 0인 섹션도 전부 표시돼 빈 날 공허 | 빈 카테고리 섹션 **접기/흐리게**, 전부 빈 날은 **단일 프롬프트+추가 CTA**(Home C1 패턴, §3.8) | P1 ✅ |
| T5 | 카드 표면 | 섹션/규칙 박스가 **테두리 카드** — Home은 흰 캔버스+평탄 카드로 갔는데 여기는 아직 boxy | `.list-panel` 흰 캔버스 + **평탄 카드**(테두리 제거, elev-1)로 §5.1 정렬 | P1 ✅ |
| T6 | 보조액션 배치 | 헤더에 뷰스위처+4버튼이 몰림, 검색행은 항상 펼쳐져 밀도↑ | 뷰스위처(주)와 보조 아이콘 정리, 검색/필터는 **검색 버튼 눌렀을 때** 노출(현재 항상 보임) | P1 ✅(이미 해결: 인라인 검색행은 `display:none` 레거시, 검색은 `openTaskSearchModal` 모달로 대체됨) |
| T7 | 빠른추가 툴바 | 칩이 **이모지**(🔥🏷️📅), 홈 캡처바와 톤 다름 | 칩 아이콘 SVG화, §3.7 톤과 정렬(액센트 포커스 등) | P2 |
| T8 | 대량작업 바 | 버튼 이모지(✓↩📅🗑), 스타일 제각각 | `.btn`류로 통일, 삭제=danger(§3.1) | P2 |
| T9 | 빈/로딩 상태 | 카테고리 0개·검색결과 0·완료숨김 등 상태 편차 | §3.8 빈상태 패턴 일괄 | P1 ✅(빈 날=프롬프트+CTA, 빈 카테고리=흐리게; 검색결과 0은 모달 `.empty-state` 유지) |
| T10 | 파괴적 확인 | 이름삭제/완료삭제 등 일부 native `confirm()` | `openConfirmDialog`(§3.5) | P2 |

## C. 제안 진행 순서 (작은 PR, 피드백 반복 — §7 G)

1. **P0 아이콘 통일**(T1·T2): 달력 컨트롤 + 목록 헤더 글리프/이모지(크롬) → SVG 라인아이콘. 기능 무손실, 시각 임팩트 큼. **여기부터 시작 추천.**
2. **P1 표면 평탄화 + 빈상태**(T5·T4·T9): 흰 캔버스 + 평탄 카드, 빈 카테고리/빈 날 프롬프트.
3. **P1 카테고리 식별 + 보조액션 정리**(T3·T6): 필터 칩 색 점, 검색/필터 접기.
4. **P2 마무리**(T7·T8·T10): 빠른추가/대량작업 칩 통일, 남은 confirm.

> 카테고리 **이모지 자체는 사용자 콘텐츠**(getCat().emoji)라 유지 — 바꾸는 건 크롬/컨트롤 아이콘만.
> 뷰 스위처·달력·규칙 구조는 그대로(§5 keep).
