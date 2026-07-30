# Firebase Storage 설정 가이드 (자료 이미지 파이프라인 · 로드맵 5단계)

이미지 **원본 바이트는 Firebase Storage**에 올리고, 앱 데이터에는 **참조(경로/URL)만** 저장·동기화하기
위한 콘솔 설정과 보안 규칙입니다. 이 문서의 콘솔 작업을 마치고 **버킷 이름 + 내 UID**를 알려주시면 코드
배선(업로드/참조/표시)을 진행합니다.

> 왜 필요한가: 현재 이미지는 IndexedDB `return_media_store_v1`(기기 로컬) + 동기화 매니페스트로만
> 관리돼서, **대량·대용량 이미지는 기기 간 공유가 사실상 안 되고** Firestore 문서(1MB)·localStorage(5MB)
> 한계에 걸립니다. Storage는 파일당 GB 단위까지 안전하게 담고, 앱은 가벼운 참조만 동기화합니다.

이 앱의 실제 구성(코드 기준):
- Firebase 프로젝트: **`my-return-system`** (`authDomain: my-return-system.firebaseapp.com`)
- 로그인: **Google 로그인**(`GoogleAuthProvider` / `signInWithPopup`) — 사실상 1인 사용자
- Firestore 데이터 경로: **`users/{uid}`** (사용자별 문서) → Storage도 같은 `users/{uid}/…`로 맞춥니다
- SDK: compat **v10.12.0** 동적 로드. Storage용 `firebase-storage-compat.js`가 배선 단계에서 추가됩니다

---

## A. 콘솔 단계 (약 5분)

1. **Firebase 콘솔 접속** → https://console.firebase.google.com → 프로젝트 **`my-return-system`** 선택.
2. 왼쪽 메뉴 **빌드(Build) → Storage** 클릭 → **시작하기(Get started)**.
3. **보안 규칙 시작 모드**: “프로덕션 모드에서 시작”을 선택(잠금 상태로 시작 → 아래 B의 규칙으로 교체).
   - “테스트 모드”는 30일 뒤 전체 공개가 만료되며 위험하니 사용하지 마세요.
4. **위치(location) 선택**: 한 번 정하면 **변경 불가**입니다. 한국 사용이면 **`asia-northeast3`(서울)** 권장.
   - ⚠️ Firestore 위치가 이미 정해져 있다면 되도록 같은 리전을 고르세요(지연·비용 이점).
5. 생성이 끝나면 상단에 **버킷 이름**이 보입니다. 형식은 둘 중 하나:
   - `my-return-system.appspot.com` (예전 프로젝트) 또는
   - `my-return-system.firebasestorage.app` (2024-10 이후 생성 프로젝트)
   - **이 정확한 문자열을 복사**해 두세요(코드의 `storageBucket`에 넣습니다).
6. **Storage → 규칙(Rules)** 탭 → 아래 **B의 규칙**을 붙여넣고 **게시(Publish)**.
7. **내 UID 확인**: 앱 → **설정 → 동기화/Firebase 진단**(로그인 상태에서 UID가 표시됨). 이 UID를
   B 규칙의 `PASTE_YOUR_UID_HERE`에 넣습니다. (UID는 비밀은 아니지만 개인 식별자이므로 **깃 저장소에는
   커밋하지 말고 콘솔 규칙에만** 넣어주세요.)

---

## B. 보안 규칙 (Storage Rules)

Storage 규칙 메서드는 `read` / `write`만 있습니다(생성·수정·삭제 세분화는 없음). 삭제 시엔
`request.resource`가 `null`이라, 업로드일 때만 용량·형식을 검사하도록 아래처럼 작성합니다.

### B-1. 권장 — 소유자 한정(1인용) 잠금

본인 UID만 `users/{uid}/…` 전체를 읽고 쓰게 합니다. 개인용 앱에 가장 안전합니다.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 이 앱의 유일한 소유자만 허용
    function isOwner() {
      return request.auth != null
          && request.auth.uid == 'PASTE_YOUR_UID_HERE';
    }
    match /users/{uid}/{allPaths=**} {
      allow read: if isOwner();
      allow write: if isOwner() && (
        // 삭제(신규 리소스 없음)는 그대로 허용
        request.resource == null ||
        // 업로드/교체는 이미지 + 20MB 이하만
        ( request.resource.size < 20 * 1024 * 1024
          && request.resource.contentType.matches('image/.*') )
      );
    }
  }
}
```

### B-2. 대안 — 로그인한 사용자별(멀티유저 대비)

나중에 다른 계정도 쓸 여지를 두려면, “로그인한 사용자는 **자기 UID 폴더만**” 접근하게 합니다.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid && (
        request.resource == null ||
        ( request.resource.size < 20 * 1024 * 1024
          && request.resource.contentType.matches('image/.*') )
      );
    }
  }
}
```

- 용량 상한(20MB)·형식(`image/*`)은 취향에 맞게 조정 가능. 사진 원본이 크면 25~50MB로 올려도 됩니다.
- **App Check**(선택): 봇/무단 사용 차단 하드닝. 개인용이면 생략 가능하나, 원하면 나중에 추가 안내드립니다.

---

## C. CORS (대개 불필요)

- 앱은 `getDownloadURL()`로 받은 토큰 URL을 `<img src>`에 그대로 표시합니다 → **CORS 설정 불필요**.
- 만약 캔버스 색추출(자료 보드 accent)처럼 **이미지 픽셀을 읽어야** 하면 교차출처 제약이 생깁니다.
  - 1순위: 색추출은 업로드 **직전 로컬 파일(blob)**에서 수행 → 업로드 후 URL은 표시에만 사용(제약 회피).
  - 그래도 필요하면 버킷에 CORS를 여는 방법을 별도 안내드립니다(`gsutil cors set`).

---

## D. 배선 단계에서 바뀌는 코드 (참고 — 콘솔 작업엔 불필요)

콘솔 준비가 끝나면 제가 다음을 구현합니다(작고 안전한 슬라이스로):

1. **SDK/설정**: `firebase-storage-compat.js`(v10.12.0) 동적 로드 추가 + Firebase config에
   `storageBucket: '<복사한 버킷명>'` 추가(`initFirebase`).
2. **업로드 헬퍼** `returnUploadImage(file)`:
   - `users/{uid}/media/<id>.<ext>` 경로에 `put()` → `getDownloadURL()`.
   - 반환 참조 `{k:'fbstorage', path, url, w, h, size, type}`을 아이템에 저장.
   - 실패 시 **기존 MediaStore(IndexedDB) 경로로 폴백** → 오프라인/미설정에서도 동작.
3. **표시**: 자료 보드 이미지 아이템·인박스 이미지가 참조의 `url`을 우선 사용, 없으면 기존 `return-media:<id>`.
4. **정리/삭제**: 아이템 삭제 시 Storage 객체도 best-effort 삭제(툼스톤과 별개, 실패 무시).
5. **동기화**: Firestore에는 **참조만** 실림(바이트 없음) → 문서 1MB 한계·기기 간 대량 이미지 문제 해소.

### 제가 받아야 할 것
- ✅ **버킷 이름**(A-5에서 복사한 정확한 문자열)
- ✅ **내 UID**(A-7 — B-1 규칙에 직접 넣으셨다면 “넣었음”만 알려주셔도 됩니다)
- ✅ 규칙은 **B-1(소유자 한정)** vs **B-2(사용자별)** 중 어느 쪽으로 게시했는지
