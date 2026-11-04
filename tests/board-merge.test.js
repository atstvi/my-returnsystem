'use strict';
/* 자료 보드 카드 단위 병합 — 아이패드 공유로 저장한 링크가 다른 기기에도, 저장한 기기에도
   없어지던 문제. 프로젝트는 통째로 LWW(updatedAt 큰 쪽 + 60초 최근 편집 유예)로 고르는데
   보드가 그 안에 있어, 한 기기에서 링크를 담는 사이 다른 기기가 같은 프로젝트를 고치면 한쪽
   카드가 통째로 사라졌다(가짜 Firestore 두 기기 재현: 예전 코드는 클라우드·PC에 링크 없음).
   계약: 이긴 프로젝트는 그대로 두고 보드 카드·연결선만 id로 합친다. 삭제는 board.del로 전한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('자료 보드 카드 단위 병합');

const ctx = { Date, Object, Number, String, Array, window: {} };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'var RETURN_BOARD_MERGE_SINCE=', '\nfunction returnSyncArrayMerge('), ctx);
const NEW = Date.UTC(2026, 10, 5);         // (RETURN_BOARD_MERGE_SINCE = 2026-11-04)         // 병합 기록 시작 이후에 만든 카드
const OLD = Date.UTC(2026, 0, 1);          // 그 전에 만든 카드
const card = (ms, x, extra) => Object.assign({ id: 'bd_' + ms + '_' + x, type: 'note', text: x }, extra || {});
const proj = (items, extra) => Object.assign({ id: 'p1', title: 'P', board: { view: {}, items: items, edges: [] } }, extra || {});
const ids = (p) => p.board.items.map((i) => i.text).join(',');

{
  const win = proj([card(OLD, 'old'), card(NEW, 'A메모')]);
  const other = proj([card(OLD, 'old'), card(NEW + 5, '공유링크')]);
  const ch = ctx.returnBoardMergeInto(win, other);
  t.ok('다른 쪽에만 있는 새 카드를 더함(공유 링크가 살아남음)', ch === true && ids(win) === 'old,A메모,공유링크', ids(win));
}
{
  const win = proj([card(OLD, 'old')]);
  const other = proj([card(OLD, 'old'), card(OLD + 1, '예전카드')]);
  const ch = ctx.returnBoardMergeInto(win, other);
  t.ok('기록 시작 전에 만든 카드는 다른 쪽에만 있어도 더하지 않음(옛 삭제 부활 방지)', ch === false && ids(win) === 'old');
}
{
  const gone = card(NEW, '지운링크');
  const win = proj([card(OLD, 'old'), gone]);             // 이긴 쪽(스테일)에 아직 남아 있음
  const other = proj([card(OLD, 'old')]); other.board.del = { [gone.id]: Date.now() };
  const ch = ctx.returnBoardMergeInto(win, other);
  t.ok('다른 기기에서 지운 카드는 이긴 쪽에서도 뺌', ch === true && ids(win) === 'old' && win.board.del[gone.id] > 0);
}
{
  const gone = card(NEW, '지운링크');
  const win = proj([card(OLD, 'old')]); win.board.del = { [gone.id]: Date.now() };
  const other = proj([card(OLD, 'old'), gone]);           // 다른 쪽(스테일)이 아직 가짐
  ctx.returnBoardMergeInto(win, other);
  t.ok('지운 카드는 다른 쪽 사본으로 되살아나지 않음', ids(win) === 'old');
}
{
  const a = card(NEW, 'a'), c = card(NEW + 1, 'c');
  const win = proj([a]);
  const other = proj([a, c]); other.board.edges = [{ id: 'ed_' + (NEW + 2) + '_1', from: a.id, to: c.id }, { id: 'ed_' + (NEW + 3) + '_2', from: a.id, to: 'bd_gone' }];
  ctx.returnBoardMergeInto(win, other);
  t.ok('연결선도 합치되 양 끝 카드가 있는 것만', win.board.edges.length === 1 && win.board.edges[0].to === c.id);
}
{
  const win = proj([card(OLD, 'old')]); const other = proj([card(OLD, 'old')]);
  t.ok('같은 보드면 바꾸지 않음', ctx.returnBoardMergeInto(win, other) === false && !('del' in win.board));
  const w2 = proj([card(OLD, 'x')]); w2.board.del = { bd_1: Date.now() - 91 * 86400000 };
  ctx.returnBoardMergeInto(w2, proj([card(OLD, 'x')]));
  t.ok('90일 지난 삭제 기록은 정리', !w2.board.del || !w2.board.del.bd_1);
}
{
  const win = { id: 'p1', title: 'P' };                   // 보드가 없는 쪽이 이김
  ctx.returnBoardMergeInto(win, proj([card(NEW, '새')]));
  t.ok('이긴 쪽에 보드가 없어도 다른 쪽 새 카드를 받음', win.board && ids(win) === '새');
}

/* 배선 */
t.ok('받을 때(fbApplyData): 로컬이 이기면 클라우드 카드 합침, 클라우드가 이기면 로컬 카드 합침', /if\(_luA>_cuA\|\|_recentA\)\{ _lwwChanged=true; if\(k==='projects_v1'\)returnBoardMergeInto\(lt,ct\); return lt; \}/.test(html) && /if\(k==='projects_v1'&&returnBoardMergeInto\(ct,lt\)\)_lwwChanged=true;/.test(html));
t.ok('올릴 때(fbSaveNow absorb)도 같은 병합', /_snLwwChanged=true;if\(k==='projects_v1'\)returnBoardMergeInto\(lt,ct\);return lt;\}/.test(html) && /if\(k==='projects_v1'&&returnBoardMergeInto\(ct,lt\)\)_snLwwChanged=true;/.test(html));
t.ok('카드 삭제 시 삭제 기록(카드 + 딸린 연결선)', /function doDel\(\)\{ b\.del=b\.del\|\|\{\}; b\.del\[String\(id\)\]=Date\.now\(\);/.test(html));
t.ok('연결선 삭제 시 삭제 기록', /var run=function\(\)\{ b\.del=b\.del\|\|\{\}; b\.del\[String\(eid\)\]=Date\.now\(\); b\.edges=/.test(html));
t.ok('링크 저장 창: 로그인 안 된 창이면 이 브라우저에만 저장된다고 알림', /이 창은 로그인되어 있지 않아 <b>이 브라우저에만<\/b> 저장돼요/.test(html));

t.done();
