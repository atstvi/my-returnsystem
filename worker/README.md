# Return 푸시 알림 워커 (Web Push)

앱을 **닫아도** 할일 시간 알림이 오게 하는 Cloudflare Worker입니다.
앱 → `/sync`(구독 + 리마인더 목록) → 워커 Cron(매 분) → 마감된 리마인더를 Web Push 발송
→ 서비스워커(`sw.js`)가 알림 표시.

> iOS는 **홈 화면에 PWA 설치 + 알림 허용**을 해야만 웹 푸시가 됩니다(브라우저 탭은 불가).
> Android/PC(설치형 PWA)는 바로 됩니다.

---

## 1) VAPID 키 생성 (한 번)

```bash
npx web-push generate-vapid-keys
```

출력의 **Public Key**(앱 설정에 붙여넣을 값)와 **Private Key**(워커 시크릿)를 메모.

## 2) 워커 준비

```bash
cd worker
npm install
npx wrangler login
```

## 3) KV 네임스페이스 생성

```bash
npx wrangler kv namespace create PUSH_KV
```

출력된 `id` 값을 `wrangler.toml`의 `REPLACE_WITH_KV_NAMESPACE_ID` 자리에 넣으세요.

## 4) 시크릿 등록

```bash
npx wrangler secret put VAPID_PUBLIC     # 위 Public Key
npx wrangler secret put VAPID_PRIVATE    # 위 Private Key
npx wrangler secret put VAPID_SUBJECT    # mailto:you@example.com
```

## 5) 배포

```bash
npx wrangler deploy
```

배포되면 `https://return-push.<계정>.workers.dev` 주소가 나옵니다.
`https://<주소>/health` 를 열어 `{"ok":true}` 가 보이면 정상.

## 6) 앱에 연결

앱 → **설정 → 알림 → 푸시 알림 (앱을 닫아도)**:
- **푸시 워커 URL**: 위 워커 주소
- **VAPID 공개키**: 1)의 Public Key
- **"할일 시간 알림"** 토글도 켜기(리마인더가 등록됨)
- **기기마다** "푸시 켜기"를 눌러 구독 (iOS는 설치형 PWA에서)

---

## 동작/설계 메모

- `/sync` 는 기기별로 구독 + 다가오는 48시간 리마인더(에폭 ms)를 KV에 저장. `sent` 맵으로 중복 발송 방지.
- Cron은 매 분 실행 → `atMs`가 지난 2분 이내인 미발송 리마인더만 보냄.
- 구독이 404/410(만료)면 KV에서 자동 삭제.
- 워커는 앱의 Firestore를 읽지 않습니다(서비스 계정 불필요) — 앱이 리마인더를 직접 보내는 구조라 단순하고 무료 티어로 충분.

## 참고 (라이브러리 API)

발송은 [`@block65/webcrypto-web-push`](https://www.npmjs.com/package/@block65/webcrypto-web-push)의
`buildPushPayload(message, subscription, vapid)` → `fetch(subscription.endpoint, req)` 패턴을 씁니다.
설치한 버전의 README와 시그니처가 다르면 `push-worker.js`의 `sendDue()`에서 그 부분만 맞춰주세요
(구독/ VAPID 객체 형태만 바꾸면 됩니다).
