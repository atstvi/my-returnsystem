# Return Widget (PC 데스크톱 위젯)

Return 웹앱의 **윈도우 바탕화면 위젯**. 브라우저(웹앱)가 열려 있지 않아도 바탕화면에
상주하며, 핀(📌)으로 항상-위(always-on-top) 고정이 가능하다. 설계 전문은
[`../docs/WIDGET_DESIGN.md`](../docs/WIDGET_DESIGN.md) 참고.

> **이건 별도 빌드 산출물이다.** 웹앱(루트 `index.html`)은 계속 단일 파일·무빌드·
> GitHub Pages를 유지한다. 위젯만 Tauri로 빌드한다. 리눅스 CI(`npm test`)는 이
> 폴더를 건드리지 않는다.

## 현재 상태: W6 (해빗 상태 위젯에서 쓰기 — 기본 OFF 게이트)

**앱을 따로 열지 않아도 윈도우 부팅 시 위젯들이 자동으로 뜬다.** ×를 눌러도 종료가
아니라 트레이로 숨겨져 백그라운드에서 계속 돌고, 트레이 아이콘으로 다시 띄울 수 있다.
창 위치/크기도 각각 기억한다. **기능당 창 하나씩** — 해빗 · 타임블록 · 타이머 창이 분리된다.

| Phase | 내용 |
|---|---|
| ~~W0~~ ✅ | Tauri 스캐폴드, 프레임리스/투명/핀 창 |
| ~~W1~~ ✅ | Firebase 로그인 + 해빗 위젯(읽기, onSnapshot) |
| ~~W2~~ ✅ | 위치 영속 · 트레이 · 자동시작 (백그라운드 상주) |
| ~~W3~~ ✅ | 멀티창 + 블록형 타임블록 위젯 |
| ~~W4~~ ✅ | 타이머 위젯(포모도로/카운트다운/스톱워치) + 세션 기록(append-only) |
| ~~W4b~~ ✅ | 메인 웹앱이 위젯 세션을 타이머 기록(`focus_timer_log_v1`)에 합치기 |
| ~~W5~~ ✅ | 웹앱 위젯 설정 패널(`widget_prefs_v1`) + 위젯이 읽어 반영 |
| **W6** ← 지금 | 해빗 상태 위젯에서 직접 쓰기(기본 OFF 게이트) + 2-기기 검증 |

### W6 동작 — 해빗 쓰기 (기본 OFF, ⚠️ 검증 후 사용)
- 해빗 위젯 푸터의 **✎(쓰기 모드)** 버튼으로 켠다. **기본은 꺼짐**(읽기 전용) —
  기기-로컬 `widget_writeback_enabled`. 켜면 해빗 행을 탭할 때마다 상태가 순환
  (없음 → 완료 → 건너뜀 → 쉼 → 없음).
- **쓰기 경로(안전 설계).** `routine_logs_v1`은 엔티티(LWW) 모델이 아니라 **blob 동기화
  + 날짜별 union merge**(같은 (날짜,습관)은 cloud 우선; index.html `fbApplyData`)다.
  그래서 위젯은:
  1. **cloud를 fresh-read**(스냅샷 캐시가 아니라 최신 클라우드)해서,
  2. 오늘 그 습관 **하나만** 토글해 클로버 창을 최소화하고,
  3. 웹앱과 **같은 결정적 문서 id**(`encodeURIComponent(key)`)로 `data/routine_logs_v1`
     문서를 쓴 뒤,
  4. 사용자 문서 헤더(`updatedAtMs`/`clientId`)를 **merge로 bump**해 웹앱 onSnapshot을
     깨운다(서브컬렉션 쓰기만으론 부모 doc 스냅샷이 안 뜨므로).
  - `clientId`는 웹앱과 **다른 위젯 전용 id**라 웹앱이 self-echo로 무시하지 않고 흡수한다.
  - 이 머지의 동시-수정 의미(같은 (날짜,습관) cloud 우선)는 **웹앱 두 기기 사이에 이미
    존재하는 동작과 동일**하다 — 위젯은 "또 하나의 기기"로 합류할 뿐 새 위험군을 만들지 않는다.

> **⚠️ 켜기 전에 2-기기 검증(`docs/WIDGET_DESIGN.md §6.1`).** 핵심 데이터라 다음을
> 직접 확인한 뒤 일상 사용을 권장한다:
> 1. 위젯에서 해빗 체크 → 웹앱(다른 기기)에 반영, 롤백 없음
> 2. 웹앱에서 체크 → 위젯에 반영(self-echo 손실 없음)
> 3. 위젯·웹앱 **동시** 다른 습관 수정 → 둘 다 보존(서로 안 지움)
> 4. 오프라인 위젯 → 재연결 시 정상 머지(부활/유실 없음)
>
> 문제가 보이면 ✎를 끄면 즉시 읽기 전용으로 되돌아간다(쓰기 자체가 멈춤).

### W5 동작
- **웹앱 설정 → "위젯" 패널**: 메인 앱(설정 탭)에서 위젯 표시 방식을 정하고
  **`widget_prefs_v1`**(클라우드 동기화 키)에 저장 → 위젯이 읽어 반영한다.
  - **타임블록 시간 범위**(시작/끝 시) → 타임블록 위젯 그리드에 적용
  - **해빗 표시 개수**(0=전체) → 해빗 위젯 행 수 제한
  - **앱 강조색 따라가기** → 위젯 `--w-accent`를 앱 테마색(`return_theme_color`)에 맞춤
  - 위젯 **다운로드 링크**(Releases) + 사용법 안내
- 위젯은 `applyWidgetPrefs()`로 세 창 모두에 적용(클램핑: 끝>시작, 0~50개 등).
  설정 변경은 다음 동기화(onSnapshot/하이드레이션) 때 위젯에 반영된다.

### W4 동작
- **타이머 위젯(`timer` 창)**: 해빗/타임블록과 독립된 세 번째 창. 항상-위 고정·트레이
  숨기기 동일.
- **세 가지 모드**: 🍅 **포모도로**(집중/짧은 휴식/긴 휴식 자동 순환 + 사이클 점) ·
  ⏱ **카운트다운**(분 단위) · ⏲ **스톱워치**(올라가는 시간, 완료 시 기록).
  - 모드별 시간은 **−/+** 스텝퍼로 조절(기기-로컬 저장, `widget_timer_cfg`).
  - 진행 중에는 모드/설정이 잠긴다. **시작 · 일시정지 · 계속 · 완료 · ↺(초기화)**.
  - 단계 완료 시 **데스크톱 알림**(권한 허용 시).
- **세션 기록(쓰기, append-only)**: 한 세션이 끝날 때마다(1초 이상) Firestore의
  `users/{uid}/widget_focus_sessions/{id}` 에 **개별 불변 문서**로 append한다. 각 세션이
  자기 문서(고유 id)라 두 기기가 같은 문서를 건드리지 않아 **배열 머지 충돌이 없다.**
  - 문서 형태: `{id, mode, phase, durationMs, taskId:"", taskText:"", completedAt, source:"widget"}`
  - 메인 웹앱이 이걸 읽어 타이머 기록(`focus_timer_log_v1`)에 합치는 건 **W4b(별도 PR)**.
    그때까지 이 쓰기는 무해하게 쌓이기만 한다(읽는 쪽이 없을 뿐 손상 없음).
- **트레이 메뉴**: 창별 토글 ("↩ 해빗 위젯" / "⏱ 타임블록 위젯" / "⏲ 타이머 위젯")

### W3 동작
- **두 개의 독립 창**: 해빗 위젯(`habits` 창)과 타임블록 위젯(`timeline` 창)이 분리됨.
  각 창은 독립적으로 이동·크기 조절·트레이 숨기기 가능.
- **해빗 위젯**: 로그인 후 오늘의 해빗을 번들별로 표시. 탭 없음, 해빗만.
- **타임블록 위젯**: 오늘 날짜에 `timeStart`가 있는 할일을 **블록형**(사각형, 지속시간에
  비례한 높이)으로 표시. `timeEnd`가 없으면 1시간으로 가정. 겹치는 블록은 나란히 배치.
  - 지난 블록: 흐리게, 완료 블록: 취소선, 현재 진행 중: 강조
  - 현재 시각에 빨간 **now-라인** (1분마다 갱신), 시작 시 자동 스크롤
  - 오늘 마감(`deadlineDate`)도 표시
- **트레이 메뉴**: 각 창 개별 토글 ("↩ 해빗 위젯" / "⏱ 타임블록 위젯")
- 읽기 전용(`task_items_v1`을 onSnapshot로 함께 읽음). 위젯에서 직접 쓰기는 W6.

### W2 동작
- **자동 시작**: 첫 실행 시 Windows 로그인 자동 실행이 켜진다(이후 트레이 메뉴에서
  on/off 토글 가능 — 사용자가 끄면 그 선택을 유지).
- **시스템 트레이**: 작업표시줄 우측 트레이에 아이콘이 생긴다.
  - 좌클릭 → 위젯 보이기(포커스)
  - 우클릭 → 메뉴(위젯 보기/숨기기 · 자동 실행 토글 · 종료)
- **× = 트레이로 숨기기**: ×를 눌러도 프로세스는 살아 있고 트레이에서 다시 띄울 수
  있다. **완전 종료는 트레이 우클릭 → 종료.**
- **창 위치/크기 기억**: 다음 실행 때 마지막 위치·크기로 복원(보임/숨김 상태는
  기억하지 않음 — 숨긴 채 종료해도 다음 실행 땐 정상적으로 보인다).

## 빌드/실행 (Windows)

> ⚠️ Windows 타깃 앱이라 **윈도우 머신에서** 빌드·실행해야 한다. 리눅스 컨테이너/CI에선
> 빌드하지 않는다.

### 사전 요구사항
1. **Rust** — https://www.rust-lang.org/tools/install (`rustup`)
2. **Node.js** 18+ (Tauri CLI 실행용)
3. **WebView2 런타임** — Windows 11엔 기본 내장, Windows 10이면
   https://developer.microsoft.com/microsoft-edge/webview2/ 에서 설치
4. **Microsoft C++ Build Tools** (MSVC) — Visual Studio Installer의 "Desktop development with C++"

### 개발 실행
```bash
cd widget
npm install
npm run dev      # = tauri dev (핫리로드로 위젯 창 실행)
```

### 배포 빌드 (.msi 설치파일)
```bash
cd widget
npm install
npm run build    # = tauri build → src-tauri/target/release/bundle/msi/ 에 설치파일
```

> 아이콘 세트(`src-tauri/icons/` 의 `.ico`·`.png`)는 repo에 **이미 커밋**돼 있어 별도 생성이
> 필요 없다. 아이콘을 바꾸려면 `src-tauri/icons/icon.png`(512px)를 교체하고 `npm run icon` 으로
> 재생성하면 된다.

생성된 `.msi`를 실행해 설치하면 바탕화면 위젯 앱이 된다.

### 릴리스 (.msi 자동 배포)

`widget-v*` 태그를 푸시하면 **GitHub Releases**에 `.msi`가 자동 첨부된다
(`.github/workflows/widget-release.yml`). 매번 Actions 아티팩트를 뒤질 필요 없이
**Releases 페이지에서 바로 다운로드**하면 된다.

```bash
# tauri.conf.json 의 version 과 맞춰 태그를 단다
git tag widget-v0.5.0
git push origin widget-v0.5.0
```

> GitHub UI에서 "Draft a new release → 새 태그 입력(`widget-v0.2.0`) → Publish"로
> 만들어도 동일하게 동작한다(태그 push가 워크플로를 트리거). 빌드가 끝나면 해당
> 릴리스에 `.msi`가 붙는다(릴리스 노트는 자동 생성). 일반 `widget/**` 변경 푸시는
> 기존대로 `widget-build.yml`이 아티팩트만 올린다(릴리스 X).

## 로그인 설정 (최초 1회)

위젯 로그인은 **시스템 브라우저(크롬 등)** 에서 진행된다. Tauri WebView2 안에서는
Firebase 로그인이 구조적으로 완료될 수 없기 때문이다(아래 "인증 구조 메모" 참고).
그래서 데스크톱 표준 OAuth 흐름(시스템 브라우저 + 로컬백 리디렉션)을 쓰며, Google
OAuth 클라이언트가 하나 필요하다. **메인 웹앱의 Google Calendar 연동용 OAuth
클라이언트를 그대로 재활용**하면 된다(설정 → 통합 → Google Calendar의 클라이언트
ID/시크릿).

1. **Google Cloud Console** → 해당 OAuth 클라이언트 → **승인된 리디렉션 URI**에
   다음을 추가:
   ```
   http://127.0.0.1:14317/oauth2callback
   ```
2. 위젯 로그인 화면에서 **"OAuth 설정"** 을 펼쳐 **클라이언트 ID**(와 Desktop 앱
   유형이면 **시크릿**)를 붙여넣는다. (입력값은 이 기기에만 로컬 저장된다.)
3. **Google로 로그인** → 시스템 브라우저가 열리고 → 로그인하면 "로그인 완료" 페이지가
   뜬다 → 위젯이 자동으로 토큰을 받아 해빗 화면으로 넘어간다.

> 그 클라이언트가 메인 웹앱과 **같은 Firebase/GCP 프로젝트**(`my-return-system`)에
> 속해 있어야 Firebase가 해당 id_token을 받아들인다. (gcal 클라이언트는 같은
> 프로젝트라 그대로 동작.)

## 동작 확인 (W1)
- 첫 실행 시 **Google로 로그인** 버튼과 **OAuth 설정** 입력칸이 표시된다.
  - 위 "로그인 설정"대로 클라이언트 ID를 넣고 로그인하면 인증된다.
  - 인증 정보는 로컬 IndexedDB에 저장돼 다음 실행부터 자동 로그인된다(클라이언트 ID
    재입력 불필요).
  - 막힐 경우 로그인 화면의 **"진단 로그"** 를 펼치면 흐름이 단계별로 찍힌다.

> **인증 구조 메모 (왜 시스템 브라우저인가).** 위젯 프론트엔드는 바이너리에 내장된
> 초소형 HTTP 서버로 **`http://localhost:14317`** 에 서빙된다. 하지만 Firebase의
> WebView 내장 로그인(`signInWithPopup`/`signInWithRedirect`)은 자격증명을
> `firebaseapp.com` origin에 저장하고 **숨은 iframe + cross-origin postMessage**로
> 가져오는데, 이 postMessage가 WebView2에서 차단된다(팝업 차단과 같은 근본 원인 —
> 진단 로그로 `getRedirectResult`가 항상 null로 확인됨). 그래서 위젯은 OAuth를
> **시스템 브라우저**에서 돌리고, 로컬백(`/oauth2callback`)으로 인가 코드를 받아
> PKCE로 id_token을 교환한 뒤 **`signInWithCredential`** 로 Firebase에 직접 넣는다.
> 이 경로는 iframe/postMessage가 전혀 없어 WebView 제약을 우회한다(`src/lib.rs`의
> `/oauth2callback`·`/oauth2result` 서버 라우트, `src/app.js`의 OAuth 흐름,
> `tauri-plugin-opener` 로 시스템 브라우저 열기).
- 로그인 후 Firestore에서 오늘의 해빗 데이터를 불러와 번들(루틴 묶음)별로 표시한다.
- 웹앱에서 해빗 상태를 바꾸면 **위젯에 실시간 반영**된다(onSnapshot).
- 상단 바를 **드래그**하면 창이 이동한다.
- **📌** 누르면 다른 창 위로 고정(다시 누르면 해제), 버튼이 강조된다.
- **—** 최소화, **×** 트레이로 숨기기(종료 아님).
- 오른쪽 하단 **⇱** 버튼으로 로그아웃 가능.
- `src/index.html`을 일반 브라우저로 열면 로그인 UI가 나타나고 Firebase 인증도 작동한다
  (Tauri 없이도 브라우저에서 동작 확인 가능).

## 구조
```
widget/
  src/                  프론트엔드 (무빌드 HTML/CSS/JS, 웹앱과 같은 방식)
    index.html          loading/auth/habits/timeline/timer/error 6-뷰
    styles.css
    app.js              핀/최소화/숨기기 + Firebase 인증 + 해빗·타임블록·타이머 렌더
                        (VIEW_MODE = ?view= 쿼리로 창별 분기; window.__TAURI__)
  src-tauri/            Tauri(Rust) 셸
    tauri.conf.json     프레임리스/투명/창 옵션/번들 (habits·timeline·timer 3창)
    Cargo.toml          + tauri-plugin-autostart, tauri-plugin-window-state
    build.rs
    src/main.rs · lib.rs   트레이(3창 토글) · 자동시작 · close→트레이 숨김 · 위치기억
    capabilities/default.json   창/트레이/자동시작 권한
    icons/icon.png      아이콘 소스 (npm run icon 으로 풀세트 생성)
```
