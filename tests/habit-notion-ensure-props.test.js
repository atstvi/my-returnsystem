'use strict';
/* 해빗→Notion 전송이 계속 실패하던 흔한 원인: 대상 rich_text 속성(기본 왼쪽/오른쪽)이
   Notion DB에 없어서 페이지 PATCH가 400으로 조용히 실패. _habitNotionEnsureProps는
   DB 스키마를 확인해 없는 속성만 rich_text로 자동 생성하고(있으면 true), 이미 있는데
   타입이 다르면 명확한 오류를 던진다. 그 뒤 sync가 페이지 PATCH를 한 번 재시도한다. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'async function _habitNotionEnsureProps(', 'async function syncHabitStatusToNotion(');

function makeCtx(dbProps) {
  const calls = [];
  const sb = {
    console,
    _diaryNotionApi: async function (method, p, body) {
      calls.push({ method, p, body });
      if (method === 'GET' && /\/databases\//.test(p)) return { properties: JSON.parse(JSON.stringify(dbProps)) };
      if (method === 'PATCH' && /\/databases\//.test(p)) return {};
      return {};
    },
  };
  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  return { ctx, calls, run: (cfg) => vm.runInContext('_habitNotionEnsureProps(' + JSON.stringify(cfg) + ')', ctx) };
}

const cfg = { dbId: 'db1', leftProp: '왼쪽', rightProp: '오른쪽' };

(async () => {
  const r = runner('habit-notion — _habitNotionEnsureProps');

  /* 1. 둘 다 없음 → DB에 rich_text 2개 생성, true */
  {
    const m = makeCtx({ '이름': { type: 'title' } });
    const added = await m.run(cfg);
    const patch = m.calls.find(c => c.method === 'PATCH' && /\/databases\//.test(c.p));
    r.ok('returns true when props were created', added === true, 'added=' + added);
    r.ok('PATCHes the DB schema', !!patch, 'no db patch');
    r.ok('adds 왼쪽 as rich_text', !!(patch && patch.body.properties['왼쪽'] && patch.body.properties['왼쪽'].rich_text), JSON.stringify(patch && patch.body));
    r.ok('adds 오른쪽 as rich_text', !!(patch && patch.body.properties['오른쪽'] && patch.body.properties['오른쪽'].rich_text), JSON.stringify(patch && patch.body));
  }

  /* 2. 하나만 없음 → 그것만 생성 */
  {
    const m = makeCtx({ '이름': { type: 'title' }, '왼쪽': { type: 'rich_text' } });
    const added = await m.run(cfg);
    const patch = m.calls.find(c => c.method === 'PATCH' && /\/databases\//.test(c.p));
    r.ok('only-missing prop created (오른쪽)', added === true && patch && patch.body.properties['오른쪽'] && !patch.body.properties['왼쪽'],
      JSON.stringify(patch && patch.body));
  }

  /* 3. 둘 다 rich_text 로 이미 있음 → 아무것도 안 만들고 false, DB PATCH 없음 */
  {
    const m = makeCtx({ '이름': { type: 'title' }, '왼쪽': { type: 'rich_text' }, '오른쪽': { type: 'rich_text' } });
    const added = await m.run(cfg);
    const patch = m.calls.find(c => c.method === 'PATCH' && /\/databases\//.test(c.p));
    r.ok('returns false when nothing to add', added === false, 'added=' + added);
    r.ok('does not PATCH the DB when props exist', !patch, 'unexpected db patch');
  }

  /* 4. 타입 불일치(왼쪽이 select) → 명확한 오류 throw */
  {
    const m = makeCtx({ '이름': { type: 'title' }, '왼쪽': { type: 'select' }, '오른쪽': { type: 'rich_text' } });
    let threw = null;
    try { await m.run(cfg); } catch (e) { threw = e && e.message; }
    r.ok('throws on wrong-type property', !!threw && threw.indexOf('왼쪽') >= 0 && threw.indexOf('rich_text') >= 0, 'msg=' + threw);
  }

  r.done();
})();
