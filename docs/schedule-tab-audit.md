# 시간표/Schedule — UI·UX 감사 (§7 playbook A+B, light-touch)

> 오너: **구조는 기본적으로 만족 → 크게 바꾸지 말고** 표면만 다듬는다. Home(§5.1)·Tasks(§5.2)·
> Routine(§5.3)에서 확립한 SVG 라인아이콘·팔레트 통일을 이 탭에도 적용. 기능 무손실(§6.0).

## A. 구조 · 기능 지도 (유지)

**셸**: `#page-schedule > .tt-page` = 3-pane.
- **좌 `.tt-left`** — 학기 목록: 제목 + `newTimetable()`(새 학기) + `#sem-list`(`renderSemList`,
  각 학기 카드 = 이름·기간·슬롯수·색 점, active tint).
- **중앙 `.tt-right`** — `#tt-toolbar`(이름/시작·종료일 input + `saveTt`/`generateTasks`/
  `deleteTimetable`) + `#tt-grid-wrap`(`.tt-empty` 빈상태 ｜ `#tt-grid-container` = 오늘 배너 +
  `.tt-grid` `renderGrid`: 시간축 + 월~일 요일·날짜 헤더 + 색상 수업 블록).
- **우 `.tt-slot-panel`** — 수업 추가 폼(`quickAddSlot`: 수업명·요일 select·시간대) + `#tt-slot-list`
  (과목별 색 점 팔레트 + 요일·시간 행 + × 삭제).

> 유지: `newTimetable`/`saveTt`/`generateTasks`/`deleteTimetable`/`quickAddSlot`/`selectTimetable`,
> `renderSemList`/`renderGrid`, 색 팔레트(`ttReadPalette`), 슬롯 CRUD, 할일 생성 연동. 리팩터 없음.

## B. UX 감사 (표면만, 심각도)

| # | 위치 | 문제 | 방향(§) | 상태 |
|---|---|---|---|---|
| S1 | 좌 제목·툴바·빈상태 | **이모지 크롬**(🗓️ 시간표 / 💾 저장 / ⚡ 할일 생성 / 🗓 빈상태) — 앱 SVG 라인아이콘 체계와 이질 | 크롬 → **SVG 라인아이콘**(§3.9) | ✅ |
| S2 | 툴바 `할일 생성` | `tb-btn-success` = **초록**(민트) — 로즈 앱에서 유일하게 뜨는 색, 통일감↓ | 이 탭의 **주 액션** → `tb-btn-accent`(로즈)로 승격 | ✅ |
| S3 | 우 슬롯 리스트 | 과목별 색 점 팔레트 · × 삭제 글리프 | 색 점은 사용자 콘텐츠라 유지; × 는 후속에 `.icon-btn` 통일 검토 | 유지 |
| S4 | 날짜/시간 input | 네이티브 date/time — 살짝 raw | 네이티브 접근성 유지가 나아 **보류** | 보류 |

## C. SHIPPED (1차, light-touch)

S1·S2만 반영 — 구조·기능 무손실. 좌 제목(캘린더 SVG+"시간표"), 툴바(저장=save/할일 생성=bolt/
삭제=trash 라인아이콘), 빈상태(캘린더 SVG). `할일 생성`을 로즈 accent로 승격해 팔레트 통일.
`.tb-btn svg`·`.tt-left-title svg`·`.tt-empty-icon svg` 스타일 추가. 헤드리스 0 pageerror.
