'use strict';
/* 시계 어긋남(clock skew) 내성 되돌림 방지.
   교차기기 LWW는 각 항목의 updatedAt(편집한 기기의 벽시계) 비교다. 다른 기기/데스크톱
   위젯의 시계가 조금이라도 '앞서' 있으면, 그 기기의 '낡은' 사본이 방금 이 기기에서 한
   편집보다 높은 updatedAt을 달고 있어 다음 동기화에서 내 변경을 조용히 롤백한다
   (사용자 리포트: "계획 취소했는데 다른 할일 드래그하면 되돌려짐").
   해결: updatedAt을 또 비교하지 않고, '이 기기가 이 항목을 방금(grace 창 안에) 편집했는지'를
   이 기기 자신의 시계로만 기억해, 그 창 동안은 클라우드 stamp가 뭐든 로컬을 유지한다.
   양쪽 다 같은(이 기기) 시계라 skew 무관, 에코 안전, 창 지나면 정상 LWW 복귀. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('시계 어긋남 내성 되돌림 방지');

// ── 배선(소스) ──
t.ok('grace 상수 정의(60s)', /var RETURN_RECENT_EDIT_GRACE_MS=60000;/.test(html));
t.ok('recent-edit 맵/헬퍼 정의',
  /var _returnRecentLocalEdits=\{\};[\s\S]*?function returnMarkRecentLocalEdit\(id\)\{[\s\S]*?function returnIsRecentLocalEdit\(id\)\{[\s\S]*?Date\.now\(\)-t\)<RETURN_RECENT_EDIT_GRACE_MS/.test(html));
t.ok('스탬프 시 recent-edit 기록(id + _eid)',
  /returnMarkRecentLocalEdit\(e\.id\); returnMarkRecentLocalEdit\(e\._eid\);/.test(html));
t.ok('fbApplyData 블롭 병합: recent면 로컬 유지',
  /var _recentA=\(typeof returnIsRecentLocalEdit==='function'\)&&\(returnIsRecentLocalEdit\(ct\.id\)\|\|returnIsRecentLocalEdit\(ct\._eid\)\);[\s\S]*?if\(_luA>_cuA\|\|_recentA\)\{ _lwwChanged=true; return lt; \}/.test(html));
t.ok('fbSaveNow 흡수 병합: recent면 로컬 유지',
  /if\(Number\(lt\.updatedAt\|\|0\)>Number\(ct\.updatedAt\|\|0\)\|\|\(\(typeof returnIsRecentLocalEdit==='function'\)&&\(returnIsRecentLocalEdit\(ct\.id\)\|\|returnIsRecentLocalEdit\(ct\._eid\)\)\)\)\{_snLwwChanged=true;return lt;\}/.test(html));
t.ok('엔티티 결정: recent면 로컬 유지(clock skew), tie는 여전히 cloud(수렴)',
  /if\(_recentE\)return L;\s*return cUpd>lUpd\?C\.payload:\(lUpd>cUpd\?L:\(C\.payload\|\|L\)\); \/\* tie → cloud \(deterministic\) \*\//.test(html));

// ── 런타임: 헬퍼 grace 동작 ──
const helperBlock = sliceBlock(html, 'var RETURN_RECENT_EDIT_GRACE_MS=60000;', 'function returnEntityStampChanged(collection, arr){');
const hctx = { Date, window: {} };
vm.createContext(hctx);
vm.runInContext(helperBlock, hctx);
t.ok('처음엔 recent 아님', hctx.returnIsRecentLocalEdit('x') === false);
hctx.returnMarkRecentLocalEdit('x');
t.ok('표시 직후 recent', hctx.returnIsRecentLocalEdit('x') === true);
t.ok('null id 안전', hctx.returnIsRecentLocalEdit(null) === false && hctx.returnIsRecentLocalEdit('') === false);

// ── 런타임: _returnEntityDecide가 skew 낡은 cloud보다 recent 로컬을 지킴 ──
const decideBlock = sliceBlock(html, 'function _returnEntityDecide(eid,L,C,tombstones,collection,conflicts){', 'function returnEntityMergeArray(localArr, cloudByEid, tombstones, collection){');
let recent = {};
const dctx = { Date, returnIsRecentLocalEdit(id){ return !!recent[String(id)]; } };
vm.createContext(dctx);
vm.runInContext(decideBlock, dctx);
const decide = dctx._returnEntityDecide;
// 로컬은 방금 취소(canceled=true), updatedAt은 낮음(내 시계). cloud는 낡은 un-canceled인데 위젯 시계가 앞서 updatedAt이 높음.
const L = { _eid: 't_1', id: 1, canceled: true, done: true, updatedAt: 1000 };
const C = { _eid: 't_1', payload: { _eid: 't_1', id: 1, canceled: false, done: false, updatedAt: 5000 }, updatedAt: 5000 };
recent = {}; // grace 밖
let w1 = decide('t_1', L, C, {}, 'tasks', []);
t.ok('grace 밖: 정상 LWW로 cloud(높은 stamp) 승 → 되돌려짐(회귀 확인용)', w1 && w1.canceled === false);
recent = { 't_1': true, '1': true }; // 방금 이 기기에서 편집
let w2 = decide('t_1', L, C, {}, 'tasks', []);
t.ok('grace 안: 낡은 cloud stamp가 높아도 로컬(취소) 유지 → 되돌림 없음', w2 && w2.canceled === true && w2 === L);

t.done();
