# Return Widget (PC 데스크톱 위젯)

Return 웹앱의 **윈도우 바탕화면 위젯**. 브라우저(웹앱)가 열려 있지 않아도 바탕화면에
상주하며, 핀(📌)으로 항상-위(always-on-top) 고정이 가능하다. 설계 전문은
[`../docs/WIDGET_DESIGN.md`](../docs/WIDGET_DESIGN.md) 참고.

> **이건 별도 빌드 산출물이다.** 웹앱(루트 `index.html`)은 계속 단일 파일·무빌드·
> GitHub Pages를 유지한다. 위젯만 Tauri로 빌드한다. 리눅스 CI(`npm test`)는 이
> 폴더를 건드리지 않는다.

## 현재 상태: W1 (Firebase 로그인 + 해빗 읽기)

Google 로그인 → Firestore에서 오늘의 루틴·해빗 데이터를 실시간으로 읽어 표시.
웹앱에서 해빗을 체크하면 위젯에도 즉시 반영된다(onSnapshot). 쓰기는 W6에서.

| Phase | 내용 |
|---|---|
| ~~W0~~ ✅ | Tauri 스캐폴드, 프레임리스/투명/핀 창 |
| **W1** ← 지금 | Firebase 로그인 + 해빗 위젯(읽기, onSnapshot) |
| W2 | 위치 영속·트레이·자동시작 |
| W3 | 타임블록 위젯 |
| W4 | 타이머 위젯(+쓰기) |
| W5 | 웹앱 위젯 설정 패널 |
| W6 | 해빗 상태 쓰기 + 검증 |

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

## 동작 확인 (W1)
- 첫 실행 시 **Google로 로그인** 버튼이 표시된다.
  - 로그인 팝업이 뜨고, Google 계정으로 인증하면 된다.
  - 인증 정보는 로컬 IndexedDB에 저장돼 다음 실행부터 자동 로그인된다.
- 로그인 후 Firestore에서 오늘의 해빗 데이터를 불러와 번들(루틴 묶음)별로 표시한다.
- 웹앱에서 해빗 상태를 바꾸면 **위젯에 실시간 반영**된다(onSnapshot).
- 상단 바를 **드래그**하면 창이 이동한다.
- **📌** 누르면 다른 창 위로 고정(다시 누르면 해제), 버튼이 강조된다.
- **—** 최소화, **×** 닫기.
- 오른쪽 하단 **⇱** 버튼으로 로그아웃 가능.
- `src/index.html`을 일반 브라우저로 열면 로그인 UI가 나타나고 Firebase 인증도 작동한다
  (Tauri 없이도 브라우저에서 동작 확인 가능).

## 구조
```
widget/
  src/                  프론트엔드 (무빌드 HTML/CSS/JS, 웹앱과 같은 방식)
    index.html
    styles.css
    app.js              핀/최소화/닫기 (window.__TAURI__ 글로벌 API)
  src-tauri/            Tauri(Rust) 셸
    tauri.conf.json     프레임리스/투명/창 옵션/번들
    Cargo.toml
    build.rs
    src/main.rs · lib.rs
    capabilities/default.json   창 권한(드래그/항상위/리사이즈/최소화/닫기)
    icons/icon.png      아이콘 소스 (npm run icon 으로 풀세트 생성)
```
