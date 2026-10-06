'use strict';
/* 자동 보관(_runTaskArchive) 무결성 — 정리가 데이터·관계를 깨면 안 된다.
   수정 전:
   1) 90일 지난 완료 시간표 수업을 보관(제거)하면 억제가 없어 재조정이 곧바로 '미완료'로
      다시 만들었다(시간표는 학기 전체·최대 365일 생성).
   2) 보관 쓰기 await 동안 사용자가 완료를 푼 할일도 처음 목록대로(id) 지웠다.
   3) 하위 할일이 남는 상위를 보관해 하위가 고아가 됐다.
   계약: 제거는 '지금' 상태로 재판정, 생성 회차는 억제, 남는 하위가 있는 상위는 보관 안 함. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('자동 보관 무결성');
const block = sliceBlock(html, 'async function _runTaskArchive(){', '\n/* Routine logs(');
const OLD = Date.now() - 200*86400000, NEW = Date.now();

function make(list, hooks){
  hooks = hooks || {};
  const calls = { suppressed: [], saved: 0, archived: [] };
  const ctx = {
    Date, String, console:{ log(){}, warn(){} },
    _archiveReady: true,
    _getArchiveCfg: () => ({ auto:true, taskDays:90 }),
    _archiveWrite: async (k, v) => { calls.archived.push(k); if (hooks.duringWrite) hooks.duringWrite(ctx, k); },
    _updateArchiveStatusUI: () => {},
    suppressGeneratedTasks: (l) => { calls.suppressed = calls.suppressed.concat(l.map(x => x.id)); return l.length; },
    saveTaskData: () => { calls.saved++; return true; },
    tasks: list,
  };
  ctx.taskChildren = (id) => ctx.tasks.filter(x => x && x.parentId != null && String(x.parentId) === String(id));
  ctx._taskById = (id) => ctx.tasks.find(x => x && String(x.id) === String(id)) || null;
  vm.createContext(ctx); vm.runInContext(block, ctx);
  return { ctx, calls };
}

(async () => {
  // 1) 생성 회차(시간표) 보관 시 억제
  {
    const e = make([
      { id:'tt_1', _isTt:true, done:true, date:'2026-03-04', updatedAt:OLD },
      { id:7, text:'옛 완료', done:true, updatedAt:OLD },
      { id:8, text:'최근 완료', done:true, updatedAt:NEW },
    ]);
    const n = await e.ctx._runTaskArchive();
    const ids = e.ctx.tasks.map(x => x.id);
    t.ok('오래된 완료 2개 보관', n === 2 && ids.join(',') === '8', ids.join(','));
    t.ok('보관한 항목 억제 호출(재생성 방지)', e.calls.suppressed.join(',') === 'tt_1,7', e.calls.suppressed.join(','));
  }
  // 2) await 동안 완료 해제 → 남김
  {
    const e = make([ { id:1, done:true, updatedAt:OLD }, { id:2, done:true, updatedAt:OLD } ], {
      duringWrite: (ctx, k) => { if (k === 'task:1') { const x = ctx._taskById(2); x.done = false; x.updatedAt = Date.now(); } },
    });
    await e.ctx._runTaskArchive();
    t.ok('도중에 완료 해제한 항목은 남김', e.ctx.tasks.map(x => x.id).join(',') === '2');
  }
  // 3) 남는 하위가 있는 상위는 보관 안 함
  {
    const e = make([
      { id:'P', done:true, updatedAt:OLD },
      { id:'K', parentId:'P', done:true, updatedAt:NEW },     // 최근 → 남음
      { id:'Q', done:true, updatedAt:OLD },
      { id:'QK', parentId:'Q', done:true, updatedAt:OLD },    // 같이 보관 → Q도 보관 가능
    ]);
    await e.ctx._runTaskArchive();
    const ids = e.ctx.tasks.map(x => x.id).join(',');
    t.ok('하위가 남는 상위(P)는 유지', /P/.test(ids) && /K/.test(ids), ids);
    t.ok('하위까지 함께 보관되는 상위(Q)는 보관', ids.split(',').indexOf('Q') < 0 && ids.split(',').indexOf('QK') < 0, ids);
  }
  // 4) 원격 적용으로 객체가 바뀌어도 id로 현재 객체를 찾아 제거
  {
    const e = make([ { id:5, done:true, updatedAt:OLD } ], {
      duringWrite: (ctx) => { ctx.tasks = [ { id:5, done:true, updatedAt:OLD }, { id:6, done:false, updatedAt:NEW } ]; },
    });
    await e.ctx._runTaskArchive();
    t.ok('교체된 배열에서도 정확히 제거', e.ctx.tasks.map(x => x.id).join(',') === '6');
  }
  t.done();
})();
