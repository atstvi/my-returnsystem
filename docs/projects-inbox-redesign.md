# 인박스 · 프로젝트 재설계 노트

키워드: #생산성 #sns(x)st #mz20대여성st #세련 #깔끔 · 로즈 액센트/디자인 토큰 정합.
목업(클릭 가능): 세션 아티팩트로 공유(인박스 · 프로젝트 대시보드/상세).

## 확정된 구조 (오너 결정)

- **일기 탭 제거** — 일기/기록은 다른 앱으로. 트위터형 "기록"은 **프로젝트별 작업 로그**로 흡수.
- 만드는 탭 = **인박스 · 프로젝트** 둘.
- **프로젝트 탭 = 대시보드**: ① 프로젝트 **폴더** 그리드(각 프로젝트로 진입) · ② **전체 타임라인**(기본 묶음 +
  프로젝트별 토글 그룹) · ③ **전체 기록**(프로젝트별 작업 로그 모아보기).
- **프로젝트 상세**: 작업 로그(트위터형, 이 프로젝트 전용) · 처리할 인박스 · 할일 타임라인(의존성·하위항목) ·
  자료 보드(freeform: 프레임·스티키체크·색추출·연결선·즐겨찾기).
- **인박스**: 좌 카톡형 빠른 담기 + 우 칸반(카테고리 박스 밑 바로 추가). 처리 필요 항목은 오늘 상황에 노출.

## 연결(핵심) 기능 — 유지/대책 필수 (오너)
- **앱 내 퀵 추가**(어디서든 ＋ → 인박스/프로젝트/로그).
- **처리 → 오늘 상황 노출**(needsAction → 홈/체크인/오늘 할 일).
- **프로젝트 = 할일 탭 카테고리** 자동 연동(이미 `task.projectId` 링크 존재).
- **이미지 = Firebase Storage** 원본 저장 + 참조만 동기화(대량 자료 안정성). ← 구현 단계에서 콘솔 설정 필요.

## 기존 코드 자산 (재사용)
- 프로젝트: `projects_v1`(loadProjects/saveProjects, Stage6 툼스톤 동기화·dedup), `renderProjects`는
  **project-studio** 오버라이드가 최종(히어로 + 할일 타임라인 `projectTaskTimelineHtml` + **프로젝트 로그**
  `p.logs`/`openProjectLogEditor`/`projectLogsStudioHtml` + 기록 링크 + 참고 자료 `p.resources`).
- 할일↔프로젝트: `task.projectId`, `projectTaskItems`, `projectProgress`.
- 인박스: `inboxItems`/`saveInboxItems`/`renderInboxBoard`.
- 미디어: MediaStore(Stage5) — IndexedDB `return_media_store_v1` + 동기화 매니페스트. Firebase Storage 미설정.

## 구현 로드맵 (소PR, 안정성 우선)
1. **프로젝트 폴더 대시보드 랜딩 + 색상** ← 이 PR. (스튜디오 상세는 그대로, 앞단만 폴더 그리드로)
2. 대시보드 서브탭: **전체 타임라인**(기본 묶음 + 프로젝트 토글) · **전체 기록**(로그 모아보기).
3. 프로젝트 상세 **작업 로그 X화**(답글/스레드) + 자료 보드 **freeform** 1차.
4. **인박스** 재설계(카톡 캡처 + 칸반) + 처리→오늘 노출.
5. **Firebase Storage** 이미지 파이프라인(원본 Storage + ref 동기화) — 콘솔 설정 후.
6. 퀵 추가(＋) 전역 캡처.

## A. 1단계 — 프로젝트 폴더 대시보드 랜딩 + 색상
- 프로젝트 모델에 **`color`** 추가(편집 다이얼로그 색상 select: 로즈/블루/그린/오렌지/플럼/슬레이트, 기본 로즈).
- `#page-projects` 앞에 **폴더 그리드 랜딩**(`#pj-landing`) 주입: 각 프로젝트 = 색 폴더 타일(폴더 아이콘 +
  제목 + `할일 N · pct% · 마감` + 최근 로그) + `새 프로젝트` 점선 폴더. 보관(archived)은 숨김.
- 폴더 클릭 → `pj-detail-mode`로 전환, **기존 project-studio 상세를 그대로 렌더**(무손상), 상단 `← 전체` 뒤로.
  기존 `renderProjects`를 캡처해 상세는 위임 → 스튜디오 기능(할일/로그/기록/자료) 전부 보존.
- 검증(헤드리스): 랜딩 표시·활성 프로젝트 2·색상 rgb(190,114,122)·새폴더, 폴더 클릭→상세 모드·스튜디오 표시·
  히어로 제목·뒤로 버튼, 뒤로→대시보드. pageerror 0, `npm test` 32스위트 통과.

## B. 2단계-a — 대시보드 서브탭 + 전체 기록(작업 로그 모아보기)
- 랜딩에 서브세그 **[폴더 · 전체 기록]** 추가(둘 다 기능함 · 원칙13 준수). 전체 타임라인은 다음 슬라이스.
- **전체 기록**: 모든 프로젝트의 `p.logs`를 합쳐 최신순 피드로. 각 카드 = 프로젝트 칩(색 점+이름) + 날짜 +
  제목 + 내용 미리보기(4줄 클램프). 클릭 → 해당 로그 `openProjectLogEditor(p,l)`. 비었으면 안내.
- 검증: 프로젝트 2·로그 3 합산·최신순(자켓 확정 t=200 최상단)·프로젝트 칩, 서브탭 전환(폴더↔기록), pageerror 0,
  `npm test` 32스위트 통과.

## C. 2단계-b — 전체 타임라인(주간 · 기본 묶음 + 프로젝트 토글)
- 서브세그에 **[전체 타임라인]** 추가(3버튼: 폴더 · 전체 타임라인 · 전체 기록).
- **주 단위 스트립**(일요일 시작): 상단에 요일·날짜 헤더(오늘 하이라이트) + `‹ / 오늘 / ›` 주 이동 네비.
- **그룹 = 토글**: 최상단 **기본 · 할일 탭**(projectId 없는 할일) + 활성 프로젝트별 그룹(색 점·이름·개수).
  캐럿 클릭으로 접기/펴기(상태 `_pjTlOpen` 유지). 보관 프로젝트 제외.
- **막대(bar)**: `t.date`부터 (`t.deadlineDate`≥date면 그날까지, 아니면 하루) 범위를 이번 주에 클램프해
  7열 그리드에 배치(`grid-column`). 마감까지 이어지면 `→` 표시. 완료 할일은 취소선+흐림. 클릭→`tasksOpenModal(t)`.
  `_travelOnly`·날짜 없는 할일은 제외.
- 검증(헤드리스): 서브세그 3버튼, 타임라인 표시, 7일·오늘 1개 하이라이트, 그룹 3(기본+활성2, 보관 제외)·
  개수(2/1/1), 막대 배치(오늘~+2 span=3, → 표시)·완료 취소선, 주 이동(7/26–8/1 → 8/2–8/8)·토글 동작,
  pageerror 0, `npm test` 32스위트 통과.

## D. 3단계-a — 프로젝트 상세 작업 로그 X화(답글/스레드)
- `projectLogsStudioHtml`를 **X형 피드**로 교체: 각 로그 = 포스트(프로젝트 색 아바타 + 이름 + 상대시간
  `projectLogTime`(7일 내 `timeAgo`, 이후 날짜) + 제목/본문 + 액션행). 액션 = 💬답글(개수)·편집·삭제.
- **답글/스레드**: `log.replies=[{id:'rep_'+ts,text,createdAt}]`(하위 호환·선택 필드). 포스트 아래 들여쓴
  스레드로 표시(작은 아바타 + 본문 + 시간·삭제). `openProjectLogReply(p,log)`(모달 1필드),
  `deleteProjectLogReply(p,log,replyId)`.
- 스튜디오 렌더 바인딩 갱신: `data-log-reply/edit/del`·`data-reply-del` 위임(카드 클릭은 액션 버튼 제외 시
  편집). 3개 renderProjects 정의(2개 사망) 모두 일괄 갱신 → 일관성 유지.
- 검증(헤드리스): 상세 진입, 포스트 2·제목/본문, 답글 1(“믹싱은 주말에”)·삭제버튼, 아바타색 rgb(190,114,122),
  답글 모달(openFormDialog) 오픈, pageerror 0, `npm test` 32스위트 통과.

## E. 3단계-b — 자료 보드 freeform (PureRef/Freeform형 캔버스)
- 프로젝트 상세 “참고 자료” 그리드를 **freeform 보드**로 교체(전폭 `grid-column:1/-1`).
- **데이터**: `project.board={view:{tx,ty,scale}, items:[{id,type,x,y,w,h,fav,accent,...}]}`.
  타입 = `note`(text)·`check`(title,list[{text,done}])·`frame`(label)·`link`(title,url)·`image`(src,title).
- **레거시 이관**: `projectBoardEnsure`가 기존 `project.resources`를 1회만 board.items로 이관
  (`_boardMigrated` 가드) 후 **즉시 saveProjects로 영속화**(재이관·id 중복·크로스디바이스 유실 방지).
  resources는 백업으로 보존. → `tests/project-board-migrate.test.js`(이관 매핑·멱등·이미 이관됨 보존).
- **조작(마우스·터치·펜, Pointer Events)**: 빈 곳 드래그=패닝, 항목 드래그=이동(그립/본문), 2손가락=핀치 줌,
  휠=커서 기준 줌(scale 0.3~3). 제스처 종료 시 저장.
- **항목 CRUD**: 툴바(＋메모/체크/프레임/링크/이미지, ★즐겨찾기 필터, 맞춤=뷰 리셋). 항목별 ★즐겨찾기·✎편집·×삭제,
  체크 토글, 링크 열기. 편집/추가는 openFormDialog 재사용.
- **색 추출**: 이미지 추가 시 `projectBoardExtractColor`(캔버스 평균색)로 accent 지정(항목 상단 보더·즐겨찾기 링).
  ※ 외부(교차출처) 이미지는 캔버스 오염 시 추출 실패→기본 accent(예외 안전).
- 버그 수정: 링크 항목 래퍼 클래스 `pjb-link`가 스킵 셀렉터의 `.pjb-link`와 충돌 → 드래그 불가. 스킵에서
  `.pjb-link` 제거(앵커는 `a`/`[data-bd-ctl]`로 이미 커버).
- **다음(2차)**: **연결선(커넥터)** — 항목 간 엣지 저장 + pan/zoom 추종 SVG 렌더(이번엔 보류).
- 검증(헤드리스): 이관 2항목(link/note)·툴바 5·이관 영속화, 그립 드래그 이동 저장(40→140/120),
  휠 줌 transform·즐겨찾기 토글+필터, 5종 항목 전폭 렌더, pageerror 0, `npm test` 33스위트 통과.

## F. 4단계 — 인박스 재설계(좌 카톡형 캡처 + 우 칸반)
- 데이터·동기화 계층(`inboxItems`/`saveInboxItems`/`INBOX_CATS`, Stage6 `returnEntityPrepareForSave`)은
  **그대로 두고** `renderFeed`를 오버라이드해 앞단만 2-pane로 교체(구 `.inbox-page` 숨김). 모든
  `saveInboxItems(); renderFeed();` 호출이 새 UI를 갱신.
- **좌: 빠른 담기(카톡형)** — 시간순 말풍선 스레드(최근 60개, 최신 하단) + 하단 컴포저(카테고리 칩 +
  textarea + 전송). Enter=담기. 항목 shape는 기존 sendItem과 동일(`{id,text,cat,ts,done,unread,imgs,links}`).
- **우: 정리 보드(칸반)** — `INBOX_CATS`별 컬럼(이모지·라벨·미완료 개수), 컬럼 하단 **“＋ 여기에 바로 추가”**
  인풋(해당 카테고리로 즉시 추가). 카드 = 완료 체크 + 텍스트 + 그립 + ●(처리 필요 토글) + ×(삭제).
- **카테고리 이동** — 그립 pointer 드래그(마우스·터치·펜), `elementFromPoint`로 대상 컬럼 히트테스트 +
  드롭 하이라이트, 드롭 시 `item.cat` 변경·저장. 그립만 `touch-action:none`(컬럼 세로 스크롤 보존).
- **처리 → 오늘 노출** — 기존 홈 서페이싱(`!done && unread`, line~11880/27743)을 그대로 사용. 새 캡처는
  `unread:true`, 완료 토글 시 `unread=false`. 칸반 헤더에 “처리 필요 N” 배지.
- 검증(헤드리스): 2-pane·구페이지 숨김·말풍선 4·컬럼 5(라벨)·처리 필요 2·컴포저 캡처(idea, unread)·
  컬럼 퀵추가(buy)·완료/처리필요 토글·그립 드래그 task→idea(드롭 하이라이트), pageerror 0,
  `npm test` 33스위트 통과.
- **보강(구현됨)**: 카테고리 추가/이름변경/삭제 UI(＋카테고리 · 컬럼 ✎ · 삭제 시 첫 카테고리로 이관),
  컴포저 이미지 첨부(📎 → 압축 → MediaStore/Storage, 썸네일·말풍선·카드 표시), 키워드 자동분류(✨ 자동),
  스레드 말풍선 → 정리 보드 카드 점프(스크롤+하이라이트). *(헤드리스 상호작용 검증: 자동분류 buy, 카테고리
  추가 5→6·영속, pageerror 0.)*
- **다음(보강)**: LLM 기반 자동분류(현재는 키워드 휴리스틱), 카테고리 순서 변경.

## G. 6단계 — 전역 퀵 추가(＋) 로그 타깃
- “어디서든 ＋” = 상단바 상시 캡처(`capture-inp`, Inbox/Task 모드)가 이미 모든 페이지에 노출(헤더는
  `.page-stack` 밖). 여기에 **Log 모드** 추가 → 프로젝트 작업 로그로 바로 담기. (floating global-capture는
  DOM 미생성 dead code라 상단바 캡처가 실질 전역 입력구.)
- HTML: `capture-modes`에 `#capture-log-btn`(Log) 추가. `setHomeCaptureType`가 'log' 허용·토글.
- `homeCapture`에 log 분기 → `quickAddLog(text)`. `homeCaptureAI`는 비-task를 이미 `homeCapture`로 위임하므로
  Log 모드도 그대로 흐름.
- `quickAddLog`: `loadProjects` 후 활성(archived 제외) 프로젝트 대상. **열린 프로젝트(activeProjectId) 우선**,
  없고 1개면 자동, 여러 개면 `openFormDialog` 프로젝트 선택. 로그 shape/저장은 openProjectLogEditor와 동일
  (`{id:'log_'+ts,title:'',text,createdAt,updatedAt}` unshift → saveProjects → renderProjects). 프로젝트 없으면 안내 토스트.
- 연결성: 프로젝트 로그 X형 피드(D단계)·전체 기록(B단계)·전체 타임라인(C단계)과 같은 `p.logs` 데이터를 공유 →
  ＋로 담은 로그가 상세 피드·전체 기록에 즉시 반영.
- 검증(헤드리스): Log 버튼 토글(type='log'), 활성=p2 직접 담기(p2 로그 1·p1 0), 비활성+다중→선택 다이얼로그
  (“어느 프로젝트 로그에?” 옵션 2)·p1 선택 저장, pageerror 0, `npm test` 33스위트 통과.
