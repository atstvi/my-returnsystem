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

---

## E. 배선 완료 (STAGE 5b — 실제 구현 내용)

콘솔 준비(버킷 `my-return-system.firebasestorage.app`, 소유자 한정 규칙 B-1 게시)가
끝나서 아래를 구현했습니다. 모두 **`index.html`** 안, 기존 미디어 스택에 얹는 얇고
추가적인 계층입니다.

1. **설정/SDK**: `DEFAULT_FB_CONFIG`에 `storageBucket` 추가, `initFirebase`가
   `firebase-storage-compat.js`(v10.12.0)를 로드하고 `fbStorage=firebase.storage()`를
   설정. Storage SDK 로드/초기화 실패는 **auth·firestore를 절대 막지 않도록** 별도
   try/catch로 격리.
2. **URL 맵(동기화 대상)**: `return_media_fb_v1` = `{ id → {path,url,type,size,at} }`.
   **바이트는 없고 다운로드 URL만** 담아서(항목당 수백 바이트) 기존 Firestore 블롭
   동기화에 그대로 실림 → 1MB 문서 한계에 한참 안 걸림.
3. **업로드** `returnStorageUpload(id,dataUrl,meta)`:
   dataURL→Blob→`users/<uid>/media/<id>.<ext>`에 `put()`→`getDownloadURL()`→맵 기록.
   `returnMediaStoreDataUrl`에서 **비차단(백그라운드)** 으로 호출. 실패/미설정/오프라인이면
   조용히 `null` → 기존 IndexedDB 사본이 그대로 durable copy.
4. **표시(해상)**: 해상 순서 = 표시가능 URL → IndexedDB(로컬·오프라인) →
   **이 URL 맵(기기 간, 대용량 사진)** → dedup 매니페스트(소용량) → 인라인 폴백.
   `return-media:<id>` 참조 계약은 그대로라 자료 보드·인박스·일기 호출부 변경 없음.
5. **삭제** `returnStorageDelete`: Storage 객체 + 맵 항목 best-effort 제거(실패 무시).
6. **백필** `returnStorageBackfill`: 로그인 후(약 6초 뒤) localStorage의 `return-media:`
   참조 중 아직 맵에 없는 것을 찾아 IndexedDB/매니페스트의 바이트를 **소량씩(1회 8개)**
   올려 기존 기기-로컬 이미지도 점진적으로 기기 간 공유되게 함. **멱등**(이미 올라간 id는
   건너뜀)이고, 실제로 새로 올린 게 있을 때만 다음 배치를 예약해 실패 시 무한 재시도 없음.
7. **문서화/테스트**: `RETURN_DATA_MAP`에 `mediaFbStorage` 항목 추가.
   `tests/fb-storage-media.test.js`가 URL 맵 왕복·de-dup과 **"Storage 미준비 시 전 경로가
   조용히 기존 IndexedDB 경로로 폴백(throw·write 없음)"** 안전 속성을 검증.

> ⚠️ 헤드리스(이 개발 환경)에서는 Firebase 네트워크가 막혀 **실제 업로드는 테스트 불가**.
> 폴백·비네트워크 로직만 자동 검증했고, **폰↔PC 실제 업로드/표시 확인은 기기에서** 필요합니다.
> 확인법: (기기 A) 자료 보드에 사진 추가 → 설정→Firebase 진단에서 `media:fb-uploaded` 로그
> 확인, 콘솔 Storage `users/<uid>/media/`에 파일 생성 확인 → (기기 B) 로그인 후 같은 보드에서
> 사진 표시 확인.
