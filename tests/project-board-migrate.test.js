'use strict';
/* Freeform 자료 보드 — projectBoardEnsure migration (project detail).

   projectBoardEnsure(project) lazily builds project.board from legacy
   project.resources ONCE (guarded by project._boardMigrated), then persists
   the migration via saveProjects so it survives reloads and does not
   re-migrate (which would duplicate items / mint new ids each load).

   Tests:
   1. Fresh project with resources → board.items mirror them by type
      (image→image, url→link, else→note); _boardMigrated set; saveProjects
      called exactly once.
   2. Second call is a no-op: no new items, no extra saveProjects.
   3. Project already migrated (has board, _boardMigrated) is left intact and
      does not re-read resources. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const src = sliceBlock(html,
  'function projectBoardEnsure(project){',
  'function projectBoardExtractColor(');

function makeSandbox() {
  let saveCalls = 0;
  const sb = {
    console: { log() {}, warn() {}, error() {} },
    Date: Date,
    Object: Object,
    Array: Array,
    saveProjects: () => { saveCalls++; },
    get saveCalls() { return saveCalls; },
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return sb;
}

const t = runner('projectBoardEnsure — legacy resource migration');

{
  const sb = makeSandbox();
  const p = { id: 'p1', resources: [
    { id: 'r1', title: '무드', image: 'data:img', note: '' },
    { id: 'r2', title: '레퍼런스', url: 'https://youtube.com/x', note: '' },
    { id: 'r3', title: '아이디어', url: '', image: '', note: '파스텔' },
  ] };
  const board = sb.projectBoardEnsure(p);

  t.ok('board object created', !!board && Array.isArray(board.items), board && typeof board);
  t.ok('view defaults present', board.view && board.view.scale === 1);
  t.ok('_boardMigrated flag set', p._boardMigrated === true);
  t.ok('3 items migrated', board.items.length === 3, board.items.length);
  t.ok('image resource → image item', board.items[0].type === 'image' && board.items[0].src === 'data:img', board.items[0]);
  t.ok('url resource → link item', board.items[1].type === 'link' && board.items[1].url === 'https://youtube.com/x', board.items[1]);
  t.ok('plain resource → note item', board.items[2].type === 'note' && /파스텔/.test(board.items[2].text), board.items[2]);
  t.ok('items carry geometry', board.items.every((i) => typeof i.x === 'number' && typeof i.y === 'number' && i.w > 0), board.items.map((i) => [i.x, i.y, i.w]));
  t.ok('saveProjects called once on migration', sb.saveCalls === 1, sb.saveCalls);

  // 2. idempotent
  const before = board.items.length, saves = sb.saveCalls;
  const board2 = sb.projectBoardEnsure(p);
  t.ok('second call returns same board', board2 === board);
  t.ok('no new items on re-ensure', board2.items.length === before, board2.items.length);
  t.ok('no extra saveProjects on re-ensure', sb.saveCalls === saves, sb.saveCalls);
}

{
  // 3. already-migrated project: keep its items, do not read resources
  const sb = makeSandbox();
  const p = {
    id: 'p2', _boardMigrated: true,
    resources: [{ id: 'rX', url: 'https://should-not-appear.example', note: '' }],
    board: { view: { tx: 5, ty: 6, scale: 1.5 }, items: [{ id: 'bd_keep', type: 'note', x: 1, y: 2, w: 3, h: 4, text: 'keep' }] },
  };
  const board = sb.projectBoardEnsure(p);
  t.ok('existing items preserved', board.items.length === 1 && board.items[0].id === 'bd_keep', board.items.length);
  t.ok('did not migrate resources', !board.items.some((i) => /should-not-appear/.test(i.url || '')));
  t.ok('existing view preserved', board.view.scale === 1.5 && board.view.tx === 5);
  t.ok('no saveProjects for already-migrated', sb.saveCalls === 0, sb.saveCalls);
}

t.done();
