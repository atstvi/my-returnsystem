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
