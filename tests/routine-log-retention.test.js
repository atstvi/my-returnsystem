'use strict';
/* 루틴 체크 기록 보존 — 정리가 데이터 보존보다 앞서면 안 된다.
   수정 전: saveRoutineData()마다 pruneRoutineLogs()가 최근 90개 날짜만 남기고 나머지를
   영구 삭제(보관 없음). 보관 루틴(_runRoutineLogArchive)은 배열을 기대해 실제 객체 형식
   ({날짜:{습관:상태}})에선 한 번도 동작하지 않았다 → 스트릭·잔디밭·통계 기록 유실.
   계약: hot 기간(400일) 안은 절대 안 지움. 그보다 오래된 날짜는 IDB 아카이브에 쓴 뒤에만
   비움. 보관 실패 시 hot에 남김. 기존 보관분과 습관 단위로 병합. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('루틴 기록 보존(보관 후 비우기)');

const pruneBlock = sliceBlock(html, 'var ROUTINE_LOG_HOT_DAYS=400;', '\nfunction saveRoutineData(){');
const archBlock = sliceBlock(html, 'async function _runRoutineLogArchive(){', '\n/* Master boot runner');

function dk(daysAgo){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-daysAgo); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function makeCtx(opts){
  opts = opts || {};
  const ls = {}; const arch = Object.assign({}, opts.arch || {});
  const ctx = {
    Object, JSON, Date, String, console: { log(){}, warn(){} },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k,v) => { ls[k]=String(v); } },
    routineDateKey: (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
    _archiveReady: true,
    _getArchiveCfg: () => ({ auto:true, routineWeeks:16 }),
    _archiveRead: async (k) => (k in arch ? JSON.parse(arch[k]) : null),
    _archiveWrite: async (k, v) => { if (opts.failWrite && opts.failWrite(k)) throw new Error('idb fail'); arch[k] = JSON.stringify(v); },
    _updateArchiveStatusUI: () => {},
    setReturnStorageItem: (k,v) => { ls[k]=v; return true; },
    routineLogs: opts.logs || {},
  };
  ctx.saveRoutineData = () => { ctx.pruneRoutineLogs(); ls.routine_logs_v1 = JSON.stringify(ctx.routineLogs); return true; };
  vm.createContext(ctx); vm.runInContext(pruneBlock, ctx); vm.runInContext(archBlock, ctx);
  return { ctx, ls, arch };
}

(async () => {
  // 1) 저장 시 프루닝은 보관 안 된 날짜를 절대 지우지 않음(예전: 90개 초과분 삭제)
  {
    const logs = {}; for (let i = 0; i < 500; i++) logs[dk(i)] = { rh: { state:'done' } };
    const e = makeCtx({ logs });
    e.ctx.saveRoutineData();
    t.ok('보관 전에는 500일 기록 전부 유지', Object.keys(e.ctx.routineLogs).length === 500, Object.keys(e.ctx.routineLogs).length);
  }
  // 2) 보관 작업: 400일 넘은 날짜만 IDB로 → 기록 → 비움. 최근 400일은 그대로
  {
    const logs = {}; for (let i = 0; i < 450; i++) logs[dk(i)] = { rh: { state:'done' } };
    const e = makeCtx({ logs });
    const n = await e.ctx._runRoutineLogArchive();
    t.ok('400일 초과분만 보관', n === 49 || n === 50, n);
    t.ok('보관분은 IDB에 존재', !!e.arch['routinelog:'+dk(449)] && !e.arch['routinelog:'+dk(10)]);
    t.ok('최근 기록(10일 전·399일 전) 유지', !!e.ctx.routineLogs[dk(10)] && !!e.ctx.routineLogs[dk(399)]);
    t.ok('보관된 오래된 날짜는 hot에서 비움', !e.ctx.routineLogs[dk(449)]);
    t.ok('보관 기록(기기 로컬) 저장', !!JSON.parse(e.ls.routine_archive_log_v1 || '{}')[dk(449)]);
    t.ok('hot 저장소에 반영', !JSON.parse(e.ls.routine_logs_v1)[dk(449)]);
  }
  // 3) IDB 쓰기 실패한 날짜는 hot에 남음
  {
    const logs = { [dk(500)]: { a:{state:'done'} }, [dk(501)]: { a:{state:'done'} } };
    const e = makeCtx({ logs, failWrite: k => k === 'routinelog:'+dk(501) });
    await e.ctx._runRoutineLogArchive();
    t.ok('실패한 날짜는 남김', !!e.ctx.routineLogs[dk(501)] && !e.ctx.routineLogs[dk(500)]);
  }
  // 4) 다른 기기 병합으로 되돌아온 같은 날짜 → 기존 보관분과 습관 단위 병합
  {
    const old = dk(600);
    const e = makeCtx({ logs: { [old]: { b:{state:'skip'} } }, arch: { ['routinelog:'+old]: JSON.stringify({ a:{state:'done'} }) } });
    await e.ctx._runRoutineLogArchive();
    const v = JSON.parse(e.arch['routinelog:'+old]);
    t.ok('보관분 습관 단위 병합(덮어쓰기 아님)', v.a && v.a.state==='done' && v.b && v.b.state==='skip', JSON.stringify(v));
  }
  { const sb = {}; vm.createContext(sb); vm.runInContext(sliceBlock(html, 'function shouldFbSyncKey(k){', 'function fbConfig(){'), sb);
    t.ok('보관 기록 키는 동기화 대상 아님(기기 로컬)', sb.shouldFbSyncKey('routine_archive_log_v1') === false); }
  t.done();
})();
