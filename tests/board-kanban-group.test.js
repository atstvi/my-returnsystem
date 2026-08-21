'use strict';
/* 자료 보드 칸반 뷰 — 그룹핑 로직(날짜 / 프레임).

   칸반의 두 축을 뒷받침하는 순수 함수들을 고정한다:
   - _pjbItemFrame: 카드 '소속 프레임'을 별도 상태 없이 중심점의 기하 포함으로
     판정한다(→ 칸반에서 프레임 칸으로 옮기면 좌표만 바뀌어 자유 보드와 양방향).
   - _pjbItemTime / _pjbDateKey: 카드의 '추가·수정 날짜'를 updatedAt > createdAt >
     id 안 타임스탬프 순으로 뽑아 날짜 키로 만든다.

   pjbKanbanHtml 등 렌더 함수는 projectBoardItemHtml/projectEsc에 의존하므로 여기선
   슬라이스에 포함만 하고(로드 시 실행 안 됨) 순수 헬퍼만 호출해 검증한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function pjbKanbanGroup(){', '\nfunction projectGroupTasksByDate(');

const sb = {
  window: {},
  console: { log() {}, warn() {}, error() {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  // frames = board items of type 'frame' (the real predicate)
  _boardFrames: (b) => (b && Array.isArray(b.items) ? b.items : []).filter((it) => it && it.type === 'frame'),
  projectEsc: (v) => String(v == null ? '' : v),
  projectBoardItemHtml: () => '',
  Date, String, Array, Object, Number, Math, isNaN,
};
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('board kanban — grouping helpers');

// ── frame containment (기하 포함) ────────────────────────────────────────────
{
  const board = { items: [
    { id: 'f1', type: 'frame', x: 0, y: 0, w: 300, h: 200, label: 'A' },
    { id: 'f2', type: 'frame', x: 400, y: 0, w: 300, h: 200, label: 'B' },
  ] };
  // center inside f1
  const inA = { id: 'c1', type: 'note', x: 40, y: 40, w: 100, h: 60 }; // center (90,70)
  // center inside f2
  const inB = { id: 'c2', type: 'note', x: 440, y: 40, w: 100, h: 60 }; // center (490,70)
  // center outside both
  const out = { id: 'c3', type: 'note', x: 800, y: 40, w: 100, h: 60 }; // center (850,70)
  t.ok('card in frame A', (sb._pjbItemFrame(board, inA) || {}).id === 'f1');
  t.ok('card in frame B', (sb._pjbItemFrame(board, inB) || {}).id === 'f2');
  t.ok('card outside → null', sb._pjbItemFrame(board, out) === null);
  t.ok('a frame itself is not classified', sb._pjbItemFrame(board, board.items[0]) === null);
}

// ── item time precedence: updatedAt > createdAt > id timestamp ───────────────
{
  t.ok('updatedAt wins', sb._pjbItemTime({ id: 'bd_1000', createdAt: 2000, updatedAt: 5000 }) === 5000);
  t.ok('createdAt when no updatedAt', sb._pjbItemTime({ id: 'bd_1000', createdAt: 2000 }) === 2000);
  t.ok('id timestamp fallback', sb._pjbItemTime({ id: 'bd_1737400000000_42' }) === 1737400000000);
  t.ok('no time → 0', sb._pjbItemTime({ id: 'x' }) === 0);
}

// ── date key format (local YYYY-MM-DD) ───────────────────────────────────────
{
  const ts = new Date(2026, 7, 21, 15, 30).getTime(); // 2026-08-21 local
  t.ok('date key = 2026-08-21', sb._pjbDateKey(ts) === '2026-08-21', sb._pjbDateKey(ts));
  t.ok('zero ts → empty', sb._pjbDateKey(0) === '');
}

// ── free spot for 미분류 sits outside every frame ─────────────────────────────
{
  const board = { items: [
    { id: 'f1', type: 'frame', x: 0, y: 0, w: 300, h: 200 },
    { id: 'f2', type: 'frame', x: 400, y: 0, w: 300, h: 200 },
  ] };
  const spot = sb._pjbFreeSpot(board);
  const probe = { id: 'p', type: 'note', x: spot.x, y: spot.y, w: 100, h: 60 };
  t.ok('free spot is outside all frames', sb._pjbItemFrame(board, probe) === null,
    JSON.stringify(spot));
}

t.done();
