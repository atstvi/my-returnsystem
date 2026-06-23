# Return Widget (PC 데스크톱 위젯)

Return 웹앱의 **윈도우 바탕화면 위젯**. 브라우저(웹앱)가 열려 있지 않아도 바탕화면에
상주하며, 핀(📌)으로 항상-위(always-on-top) 고정이 가능하다. 설계 전문은
[`../docs/WIDGET_DESIGN.md`](../docs/WIDGET_DESIGN.md) 참고.

> **이건 별도 빌드 산출물이다.** 웹앱(루트 `index.html`)은 계속 단일 파일·무빌드·
> GitHub Pages를 유지한다. 위젯만 Tauri로 빌드한다. 리눅스 CI(`npm test`)는 이
> 폴더를 건드리지 않는다.

## 현재 상태: W3 (타임블록 위젯 — 해빗/타임블록 탭)

**앱을 따로 열지 않아도 윈도우 부팅 시 자동으로 위젯이 뜬다.** ×를 눌러도 종료가
아니라 트레이로 숨겨져 백그라운드에서 계속 돌고, 트레이 아이콘으로 다시 띄울 수 있다.
창 위치/크기도 기억한다. 로그인 후 **해빗 / 타임블록** 두 탭을 전환할 수 있다.

| Phase | 내용 |
|---|---|
| ~~W0~~ ✅ | Tauri 스캐폴드, 프레임리스/투명/핀 창 |
| ~~W1~~ ✅ | Firebase 로그인 + 해빗 위젯(읽기, onSnapshot) |
| ~~W2~~ ✅ | 위치 영속 · 트레이 · 자동시작 (백그라운드 상주) |
| **W3** ← 지금 | 타임블록 위젯(세로 타임라인, now-라인) |
| W4 | 타이머 위젯(+쓰기) |
| W5 | 웹앱 위젯 설정 패널 |
| W6 | 해빗 상태 쓰기 + 검증 |

### W3 동작
- 로그인 후 상단 **해빗 / 타임블록** 탭으로 전환.
- **타임블록**: 오늘 날짜에 시간(`timeStart`)이 있는 할일과 오늘 마감을 세로
  타임라인으로 표시(시간순 정렬). 지난 항목은 흐리게, 완료는 취소선, 오늘 마감은
  `마감` 태그. 현재 시각 위치에 빨간 **now-라인**이 들어가고 1분마다 갱신된다.
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
    index.html          loading/auth/habits/error 4-뷰
    styles.css
    app.js              핀/최소화/숨기기 + Firebase 인증 + 해빗 렌더 (window.__TAURI__)
  src-tauri/            Tauri(Rust) 셸
    tauri.conf.json     프레임리스/투명/창 옵션/번들
    Cargo.toml          + tauri-plugin-autostart, tauri-plugin-window-state
    build.rs
    src/main.rs · lib.rs   트레이 · 자동시작 · close→트레이 숨김 · 위치기억
    capabilities/default.json   창/트레이/자동시작 권한
    icons/icon.png      아이콘 소스 (npm run icon 으로 풀세트 생성)
```
