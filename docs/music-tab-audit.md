# 음악(Music) 탭 재설계 노트

레퍼런스: (1) SOMPLAY·(3) ARCHIVE 형 창의적 CD/바이닐 플레이어, (2) 애플뮤직형 심플·직관 + 음악앱 표준 기능.
제약: **현재 기능 소실 금지**(조심히). 플레이북: design-system §7.

## 현황 (이해) — 이미 꽤 완성된 플레이어

- **데이터**: `musicLibrary = {songs[], playlists[]}` (`MUSIC_KEY`, Firebase 동기화). 노래=YouTube URL+cover+
  start/end/volume+태그·mood·useCase·artist, 플레이리스트=`songIds` 큐+coverImage+tags.
- **라이브러리 UI**: 상단 `전체 / 플레이리스트` 세그먼트 토글, 좌측 `지금 추천`(모드칩 Study/Routine/Planning/
  Rest/Focus)+`노래 관리`(접기)+`노래 추가`, 우측 `플레이리스트`(카드: 재생/+담기/관리)+`새 플레이리스트`.
- **재생 엔진**: YouTube IFrame API(숨은 `#music-youtube-frame`), 자동 다음곡, **광고 감지**, 구간재생·볼륨.
- **미니 플레이어**(하단) + **확장 플레이어**(`music-ep`: 회전 디스크·진행바·prev/play/next·shuffle/repeat·볼륨).
- **가져오기**: CSV, Notion 순서.
- ⚠️ **극도로 층이 많음**: 렌더 후 DOM을 재구성하는 V4(`musicApplyHierarchy`)→V5(카드 override/고스트패널)→
  V6(플레이어 바인딩)→V7(세그먼트 토글)→V8(노래 관리 섹션) 강화 층 + 대량 `!important`/인라인 스타일.
  **구조 재작성은 고위험** → 시각 재설계는 최종 렌더 클래스에 대한 **CSS 위주**로, 훅(`data-music-*`·id) 보존.

## 레퍼런스 대비 개선점
- 지금은 "하단 미니 + 확장 오버레이"라 **한 화면 Now Playing**(큰 커버/바이닐 + 트랙리스트 + UP NEXT)이 없음.
- 애플뮤직식 **깔끔한 트랙 테이블**·전송바 정돈, 1·3번의 **창의적 바이닐/톤암** 심미성 여지.
- 빈 커버가 밋밋한 회색, 좌/우 컬럼 불균형·하단 여백 등 라이브러리 랜딩 정돈 필요.

## 단계 (소PR, 재생엔진 무손상)
1. **라이브러리/랜딩 시각 재설계** (진행 중, CSS 위주) — 커버·카드·간격·세그먼트.
2. 전송바(하단 미니) 정돈.
3. Now Playing 뷰 — 회전 CD/바이닐 + 트랙리스트 + UP NEXT.

## A. 1단계-a — 빈 커버 음표 워터마크
- `.music-cover`에 로즈 음표 SVG 워터마크(background-image, 38% 중앙) + `--bg-raised` 베이스. `<img>` 있으면
  위에 덮여 자동으로 가려짐. 빈 커버가 "의도된 플레이스홀더"로 보임(밋밋한 회색 박스 해소).
- 검증: 플레이리스트 카드 커버에 워터마크 렌더, pageerror 0, `npm test` 32스위트 통과. CSS만, 훅 무손상.

## B. 1단계-b — 지금 추천 카드 정돈
- 라이브 추천 카드는 `.music-v9-reco`(V9). 커버 `.music-v9-reco-cover`가 빈 회색(`--bg-sunken`)이던 것을
  로즈 음표 워터마크로(52% 중앙), 이유 `.music-v9-reco-reason`은 2줄 클램프로 어색한 단어 줄바꿈 방지.
- 검증: 추천 커버 워터마크 렌더, pageerror 0, `npm test` 32스위트 통과. CSS만, 훅 무손상.

## C. 2단계-a — 전송바(확장 플레이어) 컨트롤 아이콘 정돈
- 확장 플레이어(`.music-ep-wrap`)의 컨트롤이 글리프/이모지(⇌ ⏮ ⏭ ↻ 🔍 🔈)라 세련도 낮고 §3.9 위반.
- **클린 SVG 라인 아이콘**으로 교체: 셔플·이전(skip-back)·다음(skip-fwd)·반복·볼륨(스피커). **재생 버튼은
  로즈 원형 primary라 ▶/Ⅱ 텍스트 유지**(JS가 textContent로 토글 → 무손상, refs의 filled-play+outline 패턴).
- 광고 진단 버튼(`music-ep-diag`)은 유틸이라 작게·흐리게(transport에서 분리, 기능 유지).
- 확장 커버 `.music-ep-cover-sm` 빈칸에 음표 워터마크.
- 훅 7/7 유지(shuffle/prev/play/next/repeat/ad-diag/vol-slider). 검증: 컨트롤 SVG 5개+볼륨 SVG,
  pageerror 0, `npm test` 32스위트 통과. HTML/CSS만.

## D. 2단계-b — 진행바 정돈
- `#music-mini-progress` hover 시 4→6px로 굵어지고, fill 끝(재생 위치)에 로즈 **썸**(`::after`, hover 노출)이
  나타나 모던 플레이어 느낌. `overflow:visible`로 썸이 잘리지 않게. 시크(role=slider) 기능 무손상.
- 검증: fill 42% + hover 시 썸 렌더, pageerror 0, `npm test` 32스위트 통과. CSS만.

## E. 2단계-c — 닫기 버튼 SVG + (디스크는 죽은 요소)
- 확장 패널 닫기 버튼 `—` 글리프 → 셰브론다운 SVG(`.music-ep-close-btn svg`). 플레이어의 마지막 글리프 제거.
- 참고: 접힘 디스크 `#music-disc-face`는 **v10 패치로 영구 `display:none!important`** → 다듬을 대상 아님.
  플레이어는 항상 확장 패널로 표시. 회전 CD/바이닐 심미는 3단계 Now Playing 뷰의 신규 영역.
- 검증: 닫기 SVG 렌더, pageerror 0, `npm test` 32스위트 통과. 2단계(전송바) 마무리.

## F. 3단계 — Now Playing 뷰 (회전 바이닐 + 트랙리스트 + UP NEXT)
- **재생 모델 매핑**(정규 오버라이드 10409~): `musicQueue`(song 배열)·`musicCurrentSongIndex`,
  `musicCurrentItem/Playlist()`, `musicPlayPlaylist(id,i)`/`musicPlaySong`/`musicNext/Prev/PlayPause`.
- **새 전체화면 오버레이 `#music-nowplaying`**(자체 완결, 재생 로직 0):
  - 좌: **회전 바이닐**(`.music-np-disc`, 그루브 radial-gradient + 커버 라벨, 재생 중 `.spinning`) + 제목/아티스트
    + 진행바/시간 + 전송(prev/play/next).
  - 우: **트랙리스트**(`musicQueue` 렌더, 현재곡 로즈 하이라이트, `다음 트랙` 구분자). 행 클릭 → 해당 인덱스 점프.
  - 진입: 확장 플레이어 헤더의 **전체화면 버튼**(`#music-np-open-btn`). 닫기: 셰브론/Esc.
  - 모든 조작은 기존 전역을 **클릭 시점 이름 호출**(나중 재정의에도 견고). 500ms 틱으로 진행바/시간/재생아이콘/
    바이닐 회전/트랙 하이라이트 동기화(musicPlayer 읽기 전용). `musicUpdateMini` 래핑으로 곡 변경 즉시 갱신.
- 검증: 시딩 큐(4곡, idx1)에서 오버레이 열림, 현재곡·트랙4·다음트랙 구분자·컨트롤 렌더, 데스크탑/모바일(스택)
  가로 오버플로 0, pageerror 0. 기존 플레이어 훅 무손상. `npm test` 32스위트 통과.

## G. 3단계-b — Now Playing에 셔플/반복/볼륨 추가 (오너)
- 확인: 셔플/반복/볼륨은 후속 층(39170~)이 `_ytPlayer` 정의 + `musicState`(shuffle/repeat off·all·one)를
  실제 재생에 소비 → **기능함**. 그래서 NP 컨트롤은 **정규 컨트롤에 프록시**(원칙13: 비작동 금지 준수).
- NP 셔플/반복 → `#music-shuffle-btn`/`#music-repeat-btn` `.click()` 위임(정규 토글·토스트·반복 3상태 그대로),
  NP 볼륨 → `#music-vol-slider`에 값 위임 후 `input` 디스패치. 상태는 `syncSecondary()`가 `musicState`/슬라이더에서
  미러링(NP 셔플 `.active`, 반복 `.active`+`.repeat-one` "1" 배지, 볼륨 값). renderNP·틱마다 동기화.
- 검증: NP 셔플→`musicState.shuffle=true`(정규 버튼도 active), NP 반복×2→`repeat='one'`(active+repeat-one),
  NP 볼륨 55→정규 슬라이더 55. pageerror 0, `npm test` 32스위트 통과.

## H. 3단계-c — 통상적 하단 전송 바 + 옛 플로팅 플레이어 은퇴 (오너 "안 보임/통상 음악앱 아님")
- **감사**: 기존 플레이어는 재생 중에도 숨김(`.active:not(.ep-open)` opacity:0)이고, hover-소환 CD 버튼 →
  좌하단 300px 플로팅 패널 → 작은 ⤢로만 Now Playing 진입 → 발견성 낮음, 통상적 음악앱 모델(항상 보이는
  하단 전송 바) 아님.
- **새 `#music-bar`**(자체 완결, 엔진 위임): 화면 하단 **전체폭 전송 바**, 큐가 로드되면 **항상 표시**.
  커버+제목/아티스트(탭→Now Playing) · prev/재생/next · 진행바+시간(클릭 시크 `musicPlayer.seekTo`) · ⤢.
  컨트롤은 전역을 클릭 시점 이름 호출, 500ms 틱으로 진행/시간/재생아이콘 동기화. 모바일은 하단 탭바 위
  (`bottom:56px`)·진행바 숨김·컴팩트.
- **옛 UI 은퇴**: `#music-mini-player`·`#music-sidebar-cd` `display:none`. 단, 내부 컨트롤은 DOM에 남아
  Now Playing 프록시(`.click()`/dispatch)가 계속 동작(셔플/반복/볼륨 유지).
- 검증: 데스크탑 바 전체폭·최하단, 모바일 탭바 위, 정보 탭→NP 열림, **NP 셔플 프록시 미니 숨김에도 동작**,
  옛 미니 `display:none`, 가로 오버플로 0, pageerror 0. 엔진 훅 5/5. `npm test` 32스위트 통과.

## I. 앨범/플레이리스트 상세 화면 (애플뮤직형, 오너 "무엇보다")
- 오너: "앨범을 눌렀을 때 앨범창으로 넘어가는 게 없어. 애플처럼 앨범화면도 있어야 할 듯." 기존엔 카드에
  인라인 ▶/담기/관리 버튼만 있고, **카드를 눌러 상세로 넘어가는 내비게이션이 없었음**.
- **새 오버레이 `#music-detail`**(자체 완결, 재생 로직 0): 상단 히어로(큰 커버 + `플레이리스트` 이브로우 +
  제목 + `mood·useCase·N곡` 서브 + 태그칩 + 설명 + **재생/셔플/관리** 액션) + 애플뮤직식 트랙 테이블
  (`#`/커버/제목·아티스트, hover 시 번호→▶, 현재곡 로즈 하이라이트+`♪`).
- **진입**: `.music-playlist-card`의 커버/제목/본문 클릭(위임) → `openDetail(id)`. 인라인 버튼/입력은
  `closest('button,a,input,…')` 가드로 제외해 기존 ▶/담기/관리 동작 무손상. 닫기: 셰브론/Esc.
- **위임**: 재생→`musicPlayPlaylist(id,0)`, 셔플→(셔플 off면 `#music-shuffle-btn` 클릭으로 켜고) 랜덤 시작,
  행 클릭→`musicPlayPlaylist(id,i)`, 관리→닫고 `musicManagePlaylist(id)`(기존 관리 패널 재사용). 모두
  클릭 시점 이름 호출. 600ms 틱으로 현재곡 하이라이트/재생 마커 동기화, `musicUpdateMini` 래핑으로 관리
  편집 후 즉시 갱신.
- 검증(데스크탑/모바일): 오버레이 열림, 제목·서브(`차분·작업·7곡`)·태그 3·트랙 7 렌더, 행2 클릭→
  `musicPlayPlaylist('pl1',2)`, 카드 커버 탭→상세 열림, 가로 오버플로 0, pageerror 0.
  `npm test` 32스위트 통과. HTML/CSS/JS 추가만(기존 카드 훅 무손상).

## J. 플레이리스트 관리창 UI 재설계 (오너 "관리창 ui가 별로")
- 기존 `musicShowManagePanel`의 인라인 패널은 라벨 없는 플레이스홀더 입력이 4열 폼에 눌려 있고 곡 행이
  `↑↓×` 글리프라 밀도 높고 정돈 안 됨.
- **재설계**(배치는 유지 — 우측 컬럼 플레이리스트 그리드 앞 삽입, 배치 테스트 통과): 패널에 `music-mng2`
  스코프 클래스 추가 후 마크업을 **2컬럼**으로:
  - **좌(정보)**: 로즈 아이콘 헤더 + 라벨 있는 필드(제목 / 분위기·용도 2열 / 태그 프리셋칩+직접입력 / 설명)
    + 전체폭 `정보 저장`.
  - **우(담긴 곡)**: `담긴 곡 [N]` 카운트 배지 헤더 + 트랙 리스트. 곡 행은 번호 + 커버 + 제목 + **SVG
    아이콘 버튼**(위/아래/빼기), hover 시 로즈. `≥900px`에서 2컬럼, 좁으면 스택.
- **훅 무손상**: 모든 id(`music-manage-title/mood/usecase/tags/desc/save-btn/list/del/close`)와
  `data-mpl-up/dn/rm`·`data-si`·`data-sid`, 프리셋칩 헬퍼 그대로. `rebind()`가 곡 카운트도 갱신.
  상세화면 `관리` 버튼(`musicManagePlaylist`)에서도 그대로 열림.
- 검증(데스크탑/모바일): 패널 렌더, 카운트 5·행 5·리오더버튼 13, 바디 가로 오버플로 0, pageerror 0.
  배치 테스트 7/7, `npm test` 32스위트 통과.

## K. "이어 듣기" 상단 바 역할 명확화 (오너 "기능이 애매해")
- 문제: `#music-v8-resume-bar`가 재생 중일 때 `지금 재생 중`/`⏸ 일시정지`를 띄워 **항상 보이는 하단
  전송 바와 기능이 겹침**(오너가 "애매하다"고 지적). 상단 바와 하단 바가 같은 "지금 재생 중"을 이중 표기.
- 재설계: 상단 바에 **단 하나의 역할** — *마지막 세션 이어 듣기*. `musicV8RenderResume`에 가드 추가:
  `musicQueue`가 로드돼 있으면(=하단 전송 바가 소유) **숨김**. 큐가 비어 있고(아직 아무것도 안 튼 상태)
  저장된 마지막 플레이리스트가 있을 때만 표시.
- 카피/비주얼: 라벨 `↻ 이어 듣기`(로즈), 제목=마지막 플레이리스트, 서브=`mood · useCase · N곡`,
  버튼 `▶ 이어서 재생`. 재생/일시정지 이중 상태 제거(하단 바가 담당). 클릭 시
  `musicPlayPlaylist(pl.id, itemIndex)`로 이어 재생.
- 검증: 큐 없음→바 표시(라벨 `이어 듣기`, 서브 `차분 · 작업 · 4곡`, 버튼 `이어서 재생`),
  큐 로드→바 숨김, pageerror 0, `npm test` 32스위트 통과.

## L. 전체 레이아웃 — 페이지 헤더 추가 (오너 "전체 레이아웃 별로")
- 문제: 음악 탭에 **제목/헤더가 없음**. `전체·플레이리스트` 세그먼트 토글만 상단 중앙에 떠 있어 페이지가
  "컨트롤을 위에 던져둔" 느낌. 타 탭은 모두 배너/헤더가 있음.
- 추가(재부모화만, 재생 로직 0): `.music-shell` 최상단에 **라이브러리 헤더** `#music-lib-head` 주입 —
  좌측 로즈 헤드폰 아이콘 + `음악` 제목 + `플레이리스트로 오늘의 몰입을 채워요` 부제, 우측 슬롯으로 기존
  `#music-view-toggle`(전체/플레이리스트)을 **이동**(id·핸들러 보존). 데스크탑 전체폭, 모바일은 랩(≤520px
  토글 좌측 정렬).
- `musicRender` 래핑 + 로드 시 `ensureHead()`(setTimeout 40/60ms, V8 레이아웃 주입 후)로 멱등 보장.
- 검증(데스크탑/모바일): 헤더 렌더(제목 `음악`), 토글이 헤더 안으로 이동(`toggleInHead`), 토글 클릭 →
  갤러리 모드 전환·좌측 컬럼 숨김 정상, 가로 오버플로 0, pageerror 0. 뷰모드 테스트 11/11,
  `npm test` 32스위트 통과.

## M. 상세 화면 인라인 곡 관리 (앨범창 완성도)
- 상세 화면(`#music-detail`)이 read-only라 곡 추가/삭제하려면 관리 패널로 나가야 했음 → 애플뮤직 앨범
  페이지처럼 **자체에서 트랙 관리** 가능하게.
- 트랙 행 hover 시 **빼기(✕)** 노출 → `musicRemoveSongFromPlaylist(_detId, songId)` 후 `renderDetail()`
  (기존 저장/렌더 재사용). 트랙리스트 하단 **`+ 노래 담기`** → 오버레이 뒤에 뜨는 피커 특성상 상세를 닫고
  `musicAddSongToPlaylistPrompt('', _detId)`(카드 `+ 담기`와 동일 플로우) 실행.
- 검증: 상세 5행→s2 빼기→4행·`songIds` 4·서브 `4곡`, `+ 노래 담기`→상세 닫힘+피커 패널 생성.
  pageerror 0, `npm test` 32스위트 통과. 기존 전역에 위임(추가형).

## N. 상세 화면 위에 재생 바 노출 (오너 "앨범 창 안에서 재생 바 안 보임")
- 문제: 하단 전송 바 `.music-bar`(z-index 650)가 앨범 상세 오버레이 `.music-detail-overlay`(690) **뒤에
  가려져** 앨범 창에서 지금 재생 중인 곡 바가 안 보임.
- 수정: `.music-bar` z-index 650→**695**(상세 690 위, Now Playing 700 아래). 상세 스크롤 하단 패딩이 바
  높이를 이미 확보(`calc(66px+40px)`)해 콘텐츠 안 가림.
- 검증: 상세 열림+큐 로드 시 barZ 695>detZ 690, 화면 하단 지점 최상위 요소가 `#music-bar`(재생 바가 위에
  그려짐), pageerror 0.

## O. 편집창(관리 창) 전면 재설계 — 균형·인터랙션 (오너 "raw·표 채우는 느낌·버튼/직관 인터랙션 없음")
- 히어로: **편집 가능한 커버**(호버 카메라, `data-cover-pl` 기존 훅 재사용) + `플레이리스트 편집` 이브로우 +
  큰 제목 + N곡 + 닫기. 폼만 나열하던 상단에 시각 앵커.
- 본문 2컬럼: 좌 `정보`(라벨 필드 제목/분위기·용도/태그칩/설명), 우 `담긴 곡 [N]`(+`드래그로 순서 변경` 힌트)
  트랙 리스트 + `+ 노래 담기`.
- **드래그 순서 변경**(직관 인터랙션): 각 행에 그립 핸들(⠿), **포인터 기반(마우스+터치)** 재정렬(루틴 습관
  드래그 패턴 차용, `touch-action:none`). `document`에 move/up 바인딩해 그립 밖으로 나가도 드롭 커밋. 드롭 시
  `songIds` 재정렬→저장→렌더. ↑↓ 버튼 제거.
- **푸터 액션 바**: 좌 `🗑 삭제`(호버 danger) · 우 `저장`(로즈 primary). 곡 수 배지 2곳 동기화(`.music-mng2-count`),
  hover 시 그립·빼기 노출.
- 훅 보존: 모든 id(title/mood/usecase/tags/desc/save-btn/list/close/del/add)·`data-mpl-rm`·프리셋칩·배치.
  배치 테스트 7/7 통과.
- 검증(데스크탑/모바일): 커버·푸터저장·담기·그립5 렌더, 드래그 s1↓2 → DOM=songIds `[s2,s3,s1,s4,s5]`(영속),
  빼기 → 4행·배지 4·`songIds` 4, 가로 오버플로 0, pageerror 0. `npm test` 32스위트 통과.

## P. 편집창 필드 — 아이콘 라벨 + 창의적 선택지 UI (오너 "글자 읽고 표 채우는 느낌")
- 디자인 시스템 재참조: §3.9 SVG 라인 아이콘, §3.3 칩(소프트 틴트+동일계열 잉크·`r-full`), §3.4 액센트 포커스.
- **모든 필드 라벨에 라인 아이콘**: 정보/제목/분위기(파형)/용도(타깃)/태그/설명/담긴 곡(목록) — "글자만 라벨" 탈피.
- **분위기·용도 = 프리셋 pill 셀렉터**(자유 텍스트 박스 대신): 분위기[차분·잔잔·설렘·신남·몽환·아늑],
  용도[공부·작업·휴식·운동·수면·산책] + `직접` 칩. 단일 선택, active=로즈 틴트+로즈 잉크(§3.3). `직접`
  누르면 커스텀 입력 노출. 값은 **숨은 입력**(id 유지)에 반영 → 저장 로직 무변경. 프리셋 아니면 `직접` active.
- 입력 **액센트 포커스**(border+box-shadow, §3.4).
- 검증: 프리셋 mood(차분)→해당 pill active·입력 숨김, 커스텀 useCase(몰입타임)→`직접` active·입력 노출,
  신남 클릭+용도 직접 입력('밤샘') 저장 → `mood='신남'·useCase='밤샘'`. 라벨 아이콘 5·pill 14, pageerror 0,
  배치 테스트 7/7, `npm test` 32스위트 통과.

## Q. 노래 관리 행 — 실제 음악앱형 리스트 (오너 "담기/수정 애매·선택 버튼이 사진 가림")
- 문제: 각 행 썸네일 위에 **벌크선택 체크박스**(`position:absolute;top2 left2` 흰 박스)와 `✎ 커버` 버튼이
  겹쳐 사진을 가리고, 항상 노출된 `▶ 담기 수정` 텍스트 버튼이 기능 애매.
- 재설계: `musicSongCard` 행을 [썸네일 | 제목·아티스트 | 액션]으로. **썸네일 깨끗**(오버레이 없음), hover 시
  중앙 **재생 오버레이**(▶) 노출. 액션은 hover-노출 **아이콘 버튼**: 선택 체크박스(썸네일 밖으로 이동)·
  `+`(플레이리스트 담기)·`✎`(곡 수정). 선택된 행은 체크 유지 노출(`:has`). 모바일은 항상 노출.
- `✎커버`는 44px 썸네일엔 과대 → 노래 행에서 숨김(썸네일=유튜브 커버). 플레이리스트 카드 커버 편집은 유지.
- 훅 보존: `data-music-song-play/add/edit/select`. 벌크선택 함수·테스트 무손상.
- 검증: play→s1·add→s2·edit→s3·체크박스→선택1, 썸네일 위 체크박스 없음, pageerror 0, `npm test`(벌크 24/24 포함) 32스위트 통과.

## R. 편집창 풀폭 — 좁고 몰림 해소 (오너 "편집창 작고 몰려있어 불편")
- 관리 패널이 우측 컬럼(~708px) 안이라 2컬럼 본문이 눌려 트랙 제목이 잘림.
- 수정: 관리 패널 열릴 때 `#page-music`에 `music-editing` 클래스 → 데스크탑에서 **좌측 레일(추천·노래관리)
  숨김 + 우측 풀폭**(≥1024px). 패널 폭 708→**1012px**, 트랙 제목 완전 표시. 닫으면(musicCloseEditPanel) 복원.
  song-edit 패널은 좌측이라 스코프 제외(관리 패널만).
- 검증: 관리 열기→`music-editing` set·좌측 display:none·패널 1012px, 닫기 복원, pageerror 0, `npm test` 32스위트 통과.
