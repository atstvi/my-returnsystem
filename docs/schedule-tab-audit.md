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
| S3 | 우 슬롯 리스트 | 과목별 색 점 팔레트 · × 삭제 **글리프** | 색 점=사용자 콘텐츠 유지; × → **SVG 라인 ×** | ✅ |
| S4 | 날짜/시간 input | 네이티브 date/time — 다크 picker 인디케이터가 raw, `<select>` 화살표 없음 | 네이티브 유지하되 인디케이터 opacity↓·hover, focus ring, `<select>` **커스텀 chevron** | ✅ |

## C. SHIPPED (light-touch)

**S1·S2** — 좌 제목(캘린더 SVG+"시간표"), 툴바(저장=save/할일 생성=bolt/삭제=trash 라인아이콘),
빈상태(캘린더 SVG). `할일 생성`을 로즈 accent로 승격. `.tb-btn svg`·`.tt-left-title svg`·
`.tt-empty-icon svg` 추가.
**S3** — 세션 행 `×` → SVG 라인 아이콘(`.session-del svg`).
**S4** — 네이티브 date/time picker 인디케이터 `opacity .4→hover .68`, `.tt-date-inp`/`.qa-inp`/
`.qa-select` focus ring, `.qa-select` 커스텀 chevron(배경 SVG). 네이티브 접근성·동작 유지.

## D. 그리드 버그 수정 (오너 리포트)

- **B1 — 과목 블록 아래 구분선 없는 흰 칸**: 원인은 `.tt-cell{height:48px}` 고정 높이가 `grid-row:
  span N` 블록에도 적용돼, 블록이 첫 행(48px)만 채우고 나머지 span 영역이 빈 채로 남아 테두리 없는
  흰 구멍이 생김. `renderGrid`에서 블록 셀에 `height:auto`를 줘 span 전체를 채우게 수정(측정:
  블록 96px, 아래 셀과 gap 0). 겸사겸사 모든 셀·헤더·시간축·블록에 **명시적 `grid-column`/
  `grid-row`** 부여해 auto-placement 드리프트 여지 제거.
- **B2 — hover ＋가 기능 없음**: 빈 칸 클릭이 우측 폼만 조용히 채우던 걸, 클릭 시 해당 요일·시간이
  미리 채워진 **수업 추가 모달**(`openNewSlotModal` → 기존 `saveSlotModal` new 모드)로 열리게 연결.

구조·기능 무손실, 헤드리스 0 pageerror, `npm test` green.
