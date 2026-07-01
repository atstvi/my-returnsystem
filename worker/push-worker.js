/* ══════════════════════════════════════════════════════════════════════════
   Return — Web Push worker (Cloudflare Workers)

   앱(index.html)이 각 기기의 푸시 구독 + 다가오는 할일 리마인더 목록을 /sync 로
   보내면, Cron(매 분)이 마감된 리마인더를 찾아 Web Push 로 발송한다. 앱이 닫혀 있어도
   서비스워커(sw.js)의 push 핸들러가 알림을 띄운다.

   설정/배포는 worker/README.md 참고.
   ────────────────────────────────────────────────────────────────────────── */
import { buildPushPayload } from '@block65/webcrypto-web-push';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const KV_TTL = 60 * 60 * 24 * 14; /* 2주 — 오래 안 열린 기기 자동 정리 */

/* 구독 endpoint → 안정적인 KV 키. */
function subKey(endpoint) {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) { h = (h * 31 + endpoint.charCodeAt(i)) >>> 0; }
  return 'sub:' + h.toString(36) + ':' + endpoint.length;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return json({ ok: true }, 200);

    try {
      if (url.pathname === '/sync' && request.method === 'POST') {
        const body = await request.json();
        const sub = body && body.subscription;
        const reminders = (body && Array.isArray(body.reminders)) ? body.reminders : [];
        if (!sub || !sub.endpoint) return json({ error: 'no subscription' }, 400);
        const key = subKey(sub.endpoint);
        const prev = (await env.PUSH_KV.get(key, 'json')) || {};
        await env.PUSH_KV.put(key, JSON.stringify({
          subscription: sub,
          reminders: reminders,
          sent: prev.sent || {},   /* 이미 보낸 리마인더 id → 중복 방지 유지 */
          updated: Date.now(),
        }), { expirationTtl: KV_TTL });
        return json({ ok: true, count: reminders.length }, 200);
      }
      if (url.pathname === '/unsync' && request.method === 'POST') {
        const body = await request.json();
        if (body && body.endpoint) await env.PUSH_KV.delete(subKey(body.endpoint));
        return json({ ok: true }, 200);
      }
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
    return json({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env));
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function sendDue(env) {
  const now = Date.now();
  const vapid = {
    subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey: env.VAPID_PUBLIC,
    privateKey: env.VAPID_PRIVATE,
  };
  if (!vapid.publicKey || !vapid.privateKey) { console.log('[push] VAPID secrets missing'); return; }

  let cursor;
  do {
    const listing = await env.PUSH_KV.list({ prefix: 'sub:', cursor });
    cursor = listing.list_complete ? undefined : listing.cursor;
    for (const entry of listing.keys) {
      const rec = await env.PUSH_KV.get(entry.name, 'json');
      if (!rec || !rec.subscription) continue;
      const sent = rec.sent || {};
      let changed = false;
      let dead = false;

      for (const r of (rec.reminders || [])) {
        if (!r || !r.id || sent[r.id]) continue;
        /* 마감됐고(≤now) 아직 2분 이내인 리마인더만 발송(중복/폭주 방지). */
        if (r.atMs <= now && r.atMs >= now - 2 * 60000) {
          const payload = {
            title: '⏰ ' + (r.title || '할일'),
            body: (r.evTime ? (r.evTime + ' 시작') : '시작할 시간이에요'),
            tag: 'return-task-' + r.id,
            url: './',
          };
          try {
            const req = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 300 } }, rec.subscription, vapid);
            const res = await fetch(rec.subscription.endpoint, req);
            if (res.status === 404 || res.status === 410) { dead = true; break; } /* 구독 만료 */
            sent[r.id] = now;
            changed = true;
          } catch (e) {
            console.log('[push] send failed', String((e && e.message) || e));
          }
        }
      }

      if (dead) { await env.PUSH_KV.delete(entry.name); continue; }
      if (changed) {
        /* 지난 리마인더 정리(6시간 이전) + sent 갱신 후 저장. */
        const pruned = (rec.reminders || []).filter((r) => r && r.atMs > now - 6 * 3600000);
        await env.PUSH_KV.put(entry.name, JSON.stringify({ ...rec, reminders: pruned, sent }), { expirationTtl: KV_TTL });
      }
    }
  } while (cursor);
}
