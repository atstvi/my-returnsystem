# 위젯 자동 업데이트 설정 (한 번만)

새 위젯 버전을 릴리스하면 설치된 위젯이 **스스로 확인 → 내려받아 설치 → 재시작**
합니다. 그러려면 아래 **한 번만** 해두면 됩니다 (서명 키 만들기 + 저장소 시크릿 등록).

> 이건 안전을 위한 서명 절차예요. 개인키로 서명한 업데이트만 위젯이 받아들여서,
> 누가 가짜 업데이트를 밀어넣지 못하게 합니다.

---

## 1) 서명 키 만들기
`worker` 말고 **`widget` 폴더**에서 PowerShell 열고:

```powershell
cd widget
npm install
npx tauri signer generate -w return-widget.key
```

- 비밀번호를 물어보면 **하나 정해서 입력**(꼭 기억!).
- 끝나면 두 값이 생겨요:
  - **공개키(Public key)**: 화면에 출력되고 `return-widget.key.pub` 파일에도 저장됨
  - **개인키(Private key)**: `return-widget.key` 파일 (⚠️ 절대 공개 X, 잃어버리면 안 됨)

---

## 2) 공개키를 설정 파일에 넣기
`widget/src-tauri/tauri.conf.json` 을 메모장으로 열고, 이 줄을 찾아:

```json
"pubkey": "REPLACE_WITH_TAURI_PUBLIC_KEY"
```

`REPLACE_WITH_TAURI_PUBLIC_KEY` 를 **1)의 공개키**로 바꾸고 저장 → 커밋(GitHub에 반영).

> 💡 편하게 하려면: 1)의 **공개키(Public key)만** 저한테 붙여주세요. 제가 이 파일에
> 넣어서 커밋해드릴게요. (공개키는 공개돼도 안전해요.)

---

## 3) GitHub 저장소에 시크릿 2개 등록
GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**:

1. 이름 `TAURI_SIGNING_PRIVATE_KEY` → 값: **`return-widget.key` 파일 안의 내용 전체**
   (메모장으로 그 파일 열어 전부 복사해서 붙여넣기)
2. 이름 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` → 값: **1)에서 정한 비밀번호**

> ⚠️ `return-widget.key` 파일과 비밀번호는 안전하게 보관하세요. 잃어버리면 기존 설치본이
> 받아줄 새 업데이트를 더 이상 못 만듭니다(새 키로 다시 배포해야 함).

---

## 4) 새 버전 릴리스 (자동 업데이트 켜지는 첫 버전)
GitHub → **Actions → "Release Widget (.msi)" → Run workflow** → tag 에 `widget-v0.9.7` 입력 → 실행.
→ 서명된 `.msi` + `latest.json` 이 Releases 에 올라와요.

**이 버전(0.9.7)은 딱 한 번 직접 설치**하세요 (이 버전부터 자동 업데이트 기능이 들어있음).
그다음부터 새 버전을 릴리스하면 **위젯이 알아서 업데이트**합니다. 🎉

---

## 동작 방식 (참고)
- 위젯이 켜질 때 `latest.json`(항상 최신 릴리스의 것)을 확인 → 설치본보다 새 버전이면 내려받아 설치 후 재시작.
- 설정 위치: `tauri.conf.json` 의 `plugins.updater.endpoints`(=latest.json 주소) + `pubkey`, `bundle.createUpdaterArtifacts`.
- 서명/배포/latest.json 생성은 `.github/workflows/widget-release.yml`(tauri-action)이 처리.
