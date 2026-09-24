'use strict';
/* 지속적(persistent) 되돌림 방지 — 클라우드가 내 편집을 반영할 때까지 로컬 유지.
   60초 in-memory 창은 '끈질긴 낡은 기록자'(오프라인이었다가 온라인 된 기기, 변경을
   못 받은 데스크톱 위젯)가 계속 옛 사본을 밀어넣으면 창이 지난 뒤 다시 진다. 그래서
   각 로컬 편집의 payload 해시를 localStorage(비동기화 __ 접두)에 남겨두고, 클라우드
   payload 해시가 그 해시와 같아질 때(=클라우드가 내 변경을 반영)까지 로컬을 지킨다.
   시계 비교가 전혀 없어 skew 무관, 새로고침 후에도 유지, 확인되면 즉시 해제, TTL로
   영구 정체 방지. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('지속 pending-edit 되돌림 방지');

// ── 배선 ──
t.ok('pending 키/TTL 상수', /var RETURN_PENDING_EDIT_KEY='__return_pending_edits_v1';/.test(html) && /var RETURN_PENDING_EDIT_TTL_MS=10\*60\*1000;/.test(html));
t.ok('스탬프 시 pending 기록(payload 해시)', /returnMarkPendingEdit\(e\.id, e\._eid, h\);/.test(html));
t.ok('엔티티 결정도 pending 검사', /\(\(typeof returnPendingEditUnconfirmed==='function'\)&&C&&returnPendingEditUnconfirmed\(C\.payload\|\|\{_eid:eid,id:\(L&&L\.id\)\}\)\)/.test(html));

// ── 런타임: 헬퍼 동작(_entityPayloadHash 스텁으로 결정적으로) ──
const block = sliceBlock(html, "var RETURN_PENDING_EDIT_KEY='__return_pending_edits_v1';", 'function returnEntityStampChanged(collection, arr){');
const store = {};
const ctx = {
  Date, JSON, Object, Array, String, Number, setTimeout: (fn)=>{ fn(); return 0; },
  localStorage: { getItem:(k)=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null, setItem:(k,v)=>{store[k]=String(v);} },
  // 결정적 해시 스텁: canceled/done만 반영(테스트가 제어)
  _entityPayloadHash: (o)=> 'h:'+(o&&o.canceled?'C':'-')+(o&&o.done?'D':'-')+(o&&o.text||''),
  window: {},
};
vm.createContext(ctx);
vm.runInContext(block, ctx);
const { returnMarkPendingEdit, returnPendingEditUnconfirmed, _returnPendingSave } = ctx;

// 취소한 A의 로컬 해시 기록(canceled+done) — 실제 흐름처럼 mark 후 pass 끝에서 1회 저장
const canceledHash = ctx._entityPayloadHash({ canceled:true, done:true, text:'A' });
returnMarkPendingEdit(1001, 't_1001', canceledHash);
_returnPendingSave();
t.ok('pending 저장됨(localStorage, 비동기화 키)', typeof store['__return_pending_edits_v1'] === 'string' && store['__return_pending_edits_v1'].indexOf('1001')>=0);

// 낡은 클라우드(A 미취소) → 아직 미확인 → 로컬 보호(true)
const staleCloud = { id:1001, _eid:'t_1001', canceled:false, done:false, text:'A' };
t.ok('낡은 클라우드는 미확인 → 로컬 보호', returnPendingEditUnconfirmed(staleCloud) === true);
t.ok('보호 후에도 pending 유지', store['__return_pending_edits_v1'].indexOf('1001')>=0);

// 클라우드가 취소를 반영 → 확인됨 → 보호 해제(false) + 항목 제거
const caughtUpCloud = { id:1001, _eid:'t_1001', canceled:true, done:true, text:'A' };
t.ok('클라우드가 반영하면 확인 → 보호 해제', returnPendingEditUnconfirmed(caughtUpCloud) === false);
t.ok('확인되면 pending에서 제거됨', store['__return_pending_edits_v1'].indexOf('1001') < 0);

// TTL 만료 → 보호 포기(정체 방지)
returnMarkPendingEdit(2002, 't_2002', 'h:CD'); _returnPendingSave();
// 강제로 오래된 것으로: 저장 내용 조작
const m = JSON.parse(store['__return_pending_edits_v1']); m['2002'].at = Date.now() - (11*60*1000); m['t_2002'].at = Date.now() - (11*60*1000); store['__return_pending_edits_v1']=JSON.stringify(m);
// 캐시 무효화를 위해 새 컨텍스트로 다시 로드
const ctx2 = Object.assign({}, ctx); vm.createContext(ctx2); vm.runInContext(block, ctx2);
t.ok('TTL 지난 pending은 미보호(정체 방지)', ctx2.returnPendingEditUnconfirmed({ id:2002, _eid:'t_2002', canceled:false, done:false }) === false);

t.done();
