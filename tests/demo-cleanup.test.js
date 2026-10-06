'use strict';
/* Regression test: returnDemoCleanupOnce() must remove exactly the hardcoded
   demo/sample items that were previously seeded and synced before the
   returnAllowSampleSeed gate was added.

   Contract (v2 — 재설치로 다시 퍼진 데모 정리, 사용자 데이터는 절대 안 건드림):
   - Runs only once per device (_demo_cleanup_v2 guard — device-local, NOT synced,
     so a reinstalled device cleans its own copy even after another device ran it).
   - Only runs after _fb_loaded_once is set (cloud has been loaded).
   - Removes tasks with integer id 1-10 AND exact demo text matches.
   - Removes hobby items with demo id AND exact demo text.
   - Removes the demo timetable only on its FULL signature (name + dates + all 5
     slots). A real '2026년 1학기' timetable with the user's own classes is kept.
   - Removes the demo timetable's class sessions (also orphans from another
     device's demo copy), tombstoned — but never sessions of a real timetable.
   - Removes demo routine habits only with exact title AND no check-in logs;
     demo bundles only when none of their habits is still alive.
   - Tombstones removed tasks (eid falls back to 't_'+id).
   - Marks the guard when done so subsequent calls are no-ops. */

const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();

/* Extract the block: returnAllowSampleSeed + DEMO_* constants + returnDemoCleanupOnce */
const block = sliceBlock(
  html,
  'function returnAllowSampleSeed(){',
  '\n/* Sample tasks */'
);

/* Build a sandbox that wires up all the dependencies returnDemoCleanupOnce needs. */
function makeCtx(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const hobbyStore = {};
  const saved = { tasks: null, hobby: null, timetables: null, routines: null };
  const tombstoned = [];
  const order = [];

  /* Allow pre-populating hobby_items_v2 in localStorage */
  if (opts.hobbyJson) store['hobby_items_v2'] = opts.hobbyJson;

  const sb = {
    /* localStorage shim */
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    /* setReturnStorageItem mock — captures hobby writes */
    setReturnStorageItem: (k, v) => { store[k] = String(v); return true; },
    /* Tombstone mock */
    returnTombstoneMarkMany: (eids, col) => { tombstoned.push({ eids, col }); return eids.length; },
    /* Save function mocks */
    saveTaskData: () => { order.push('tasks'); saved.tasks = JSON.stringify(sb.tasks); return true; },
    saveTimetables: () => { order.push('timetables'); saved.timetables = JSON.stringify(sb.timetables); return true; },
    saveRoutineData: () => { saved.routines = { habits: JSON.stringify(sb.routineHabits), bundles: JSON.stringify(sb.routineBundles) }; return true; },
    /* Global collection vars */
    tasks: opts.tasks ? opts.tasks.slice() : [],
    timetables: opts.timetables ? opts.timetables.slice() : [],
    routineHabits: opts.routineHabits ? opts.routineHabits.slice() : [],
    routineBundles: opts.routineBundles ? opts.routineBundles.slice() : [],
  };

  const ctx = vm.createContext(sb);
  vm.runInContext(block, ctx);
  return { ctx, sb, store, saved, tombstoned, order };
}

function run(opts) {
  const env = makeCtx(opts);
  vm.runInContext('returnDemoCleanupOnce()', env.ctx);
  return env;
}

const DEMO_TASKS = [
  { id: 1, text: '기말 보고서 최종 제출' },
  { id: 2, text: '주간 리뷰 작성' },
  { id: 3, text: '운동 30분' },
  { id: 4, text: '팀 미팅' },
  { id: 5, text: '참고문헌 최종 정리' },
  { id: 6, text: '독서 — 아토믹 해빗' },
  { id: 7, text: '발표 자료 준비' },
  { id: 8, text: '월별 지출 정리' },
  { id: 9, text: '수업 — 데이터베이스' },
  { id: 10, text: '수업 — 알고리즘' },
];
const DEMO_HOBBY = [
  { id: 'demo1', text: '수채화 연습' },
  { id: 'demo2', text: '알고리즘 문제 풀기' },
  { id: 'demo3', text: '영화 감상' },
];
const DEMO_SLOTS = [
  { title:'알고리즘', day:0, timeStart:'09:00', timeEnd:'10:30' },
  { title:'알고리즘', day:2, timeStart:'09:00', timeEnd:'10:30' },
  { title:'데이터베이스', day:1, timeStart:'13:00', timeEnd:'14:30' },
  { title:'데이터베이스', day:3, timeStart:'13:00', timeEnd:'14:30' },
  { title:'운영체제', day:4, timeStart:'11:00', timeEnd:'12:30' },
];
const DEMO_TIMETABLE = { id: 1790000000001, name: '2026년 1학기', startDate:'2026-03-03', endDate:'2026-06-20', slots: DEMO_SLOTS };
/* 2026-03-04 is a Wednesday → slot day 2 (월=0) → 알고리즘 09:00 */
function demoSession(ttId, extra){ return Object.assign({ id:'tt_x'+Math.random().toString(36).slice(2), _isTt:true, _ttId:String(ttId), text:'알고리즘', date:'2026-03-04', timeStart:'09:00', timeEnd:'10:30', note:'시간표 · 2026년 1학기' }, extra||{}); }
const DEMO_HABITS = [
  { id: 'rh_water', title: '물 한 컵' },
  { id: 'rh_stretch', title: '몸 깨우기' },
  { id: 'rh_plan', title: '오늘 보기' },
  { id: 'rh_journal', title: '마감 정리' },
];
const DEMO_BUNDLES = [
  { id: 'rb_morning', title: '아침 루틴' },
  { id: 'rb_night', title: '저녁 루틴' },
];

const r = runner('Demo data one-time cleanup (returnDemoCleanupOnce)');

/* ── Guard: does not run before cloud is loaded ── */
{
  const env = run({ tasks: DEMO_TASKS.slice() });
  r.ok('before cloud loaded → tasks untouched', env.sb.tasks.length === 10);
  r.ok('before cloud loaded → no guard written', env.store['_demo_cleanup_v2'] !== '1');
}

/* ── Guard: does not run twice ── */
{
  const env = run({
    store: { '_fb_loaded_once': '1', '_demo_cleanup_v2': '1' },
    tasks: DEMO_TASKS.slice(),
  });
  r.ok('already-ran guard → tasks untouched (no-op)', env.sb.tasks.length === 10);
}

/* ── Tasks: removes all 10 demo tasks ── */
{
  const env = run({ store: { '_fb_loaded_once': '1' }, tasks: DEMO_TASKS.slice() });
  r.ok('removes all 10 demo tasks', env.sb.tasks.length === 0);
  r.ok('guard written after cleanup', env.store['_demo_cleanup_v2'] === '1');
}

/* ── Tasks: preserves user task with same id but different text ── */
{
  const tasks = [
    { id: 1, text: '나만의 할일' }, /* same id, different text → keep */
    { id: 2, text: '주간 리뷰 작성' }, /* exact demo signature → remove */
  ];
  const env = run({ store: { '_fb_loaded_once': '1' }, tasks });
  r.ok('keeps user task with demo id but different text', env.sb.tasks.length === 1);
  r.ok('remaining task is the user one', env.sb.tasks[0] && env.sb.tasks[0].text === '나만의 할일');
}

/* ── Tasks: preserves user task with string id ── */
{
  const tasks = [
    { id: '1700000000001', text: '진짜 할일' }, /* string id → real user task */
    { id: 3, text: '운동 30분' }, /* demo */
  ];
  const env = run({ store: { '_fb_loaded_once': '1' }, tasks });
  r.ok('keeps user task with string id even if text matches demo', env.sb.tasks.length === 1);
}

/* ── Tasks: tombstones items that have _eid ── */
{
  const tasks = [
    { id: 1, text: '기말 보고서 최종 제출', _eid: 't_abc123' },
    { id: 11, text: '진짜 할일', _eid: 't_realuser' }, /* keep */
  ];
  const env = run({ store: { '_fb_loaded_once': '1' }, tasks });
  r.ok('tombstones the removed eid', env.tombstoned.some(function(t){ return t.eids.indexOf('t_abc123') >= 0; }));
  r.ok('does not tombstone the kept eid', !env.tombstoned.some(function(t){ return t.eids.indexOf('t_realuser') >= 0; }));
}

/* ── Hobby: removes demo items ── */
{
  const hobbyJson = JSON.stringify(DEMO_HOBBY.slice());
  const env = run({ store: { '_fb_loaded_once': '1' }, hobbyJson });
  const remaining = JSON.parse(env.store['hobby_items_v2'] || '[]');
  r.ok('removes all 3 demo hobby items', remaining.length === 0);
}

/* ── Hobby: preserves user hobby item ── */
{
  const hobby = [
    { id: 'demo1', text: '수채화 연습' }, /* demo */
    { id: 'user_hobby_1', text: '기타 연습' }, /* real */
  ];
  const env = run({ store: { '_fb_loaded_once': '1' }, hobbyJson: JSON.stringify(hobby) });
  const remaining = JSON.parse(env.store['hobby_items_v2'] || '[]');
  r.ok('keeps user hobby item', remaining.length === 1 && remaining[0].id === 'user_hobby_1');
}

/* ── Timetable: removes the demo timetable (full signature) + saves after tasks ── */
{
  const env = run({ store: { '_fb_loaded_once': '1' }, timetables: [DEMO_TIMETABLE] });
  r.ok('removes demo timetable (full signature)', env.sb.timetables.length === 0);
  r.ok('saves timetables after removal', env.saved.timetables === '[]');
}

/* ── Timetable: preserves user timetable with different name ── */
{
  const env = run({ store: { '_fb_loaded_once': '1' }, timetables: [
    DEMO_TIMETABLE,
    { id: 2, name: '2027년 1학기', slots: [] }, /* user's own */
  ]});
  r.ok('keeps user timetable with different name', env.sb.timetables.length === 1);
  r.ok('remaining timetable is the user one', env.sb.timetables[0] && env.sb.timetables[0].name === '2027년 1학기');
}

/* ── Timetable: a REAL '2026년 1학기' (same name, the user's own classes) is kept ── */
{
  const realTt = { id: 1770000000001, name: '2026년 1학기', startDate:'2026-03-02', endDate:'2026-06-19', slots:[
    { title:'일반화학', day:0, timeStart:'10:00', timeEnd:'11:15' } ] };
  const sameNameSameDates = { id: 1770000000002, name: '2026년 1학기', startDate:'2026-03-03', endDate:'2026-06-20', slots: DEMO_SLOTS.slice(0,4) };
  const realSession = demoSession(1770000000001, { text:'일반화학', date:'2026-03-02', timeStart:'10:00', timeEnd:'11:15', done:true });
  const env = run({ store: { '_fb_loaded_once': '1' }, timetables: [realTt, sameNameSameDates], tasks:[realSession] });
  r.ok('real same-name timetable kept', env.sb.timetables.length === 2, JSON.stringify(env.sb.timetables.map(function(t){return t.id;})));
  r.ok('real timetable session kept', env.sb.tasks.length === 1 && env.sb.tasks[0].text === '일반화학');
}

/* ── Timetable sessions: demo + orphan(other device's demo copy) removed & tombstoned;
      a session that looks like demo but belongs to a REAL timetable is kept ── */
{
  const realTt = { id: 1770000000009, name: '2026년 1학기', startDate:'2026-03-02', endDate:'2026-06-19', slots:[
    { title:'알고리즘', day:2, timeStart:'09:00', timeEnd:'10:30' } ] };
  const tasks = [
    demoSession(1790000000001, { id:'tt_demo1' }),           /* belongs to demo tt in list */
    demoSession(1790000000999, { id:'tt_orphan', done:true }), /* orphan demo session (signature) */
    demoSession(1770000000009, { id:'tt_real' }),             /* identical look, REAL timetable */
    demoSession(1790000000555, { id:'tt_outside', date:'2026-07-01' }), /* outside demo range → keep */
  ];
  const env = run({ store: { '_fb_loaded_once': '1' }, timetables: [DEMO_TIMETABLE, realTt], tasks });
  const ids = env.sb.tasks.map(function(t){ return t.id; });
  r.ok('demo session removed', ids.indexOf('tt_demo1') < 0, JSON.stringify(ids));
  r.ok('orphan demo session removed', ids.indexOf('tt_orphan') < 0, JSON.stringify(ids));
  r.ok('real timetable session kept', ids.indexOf('tt_real') >= 0, JSON.stringify(ids));
  r.ok('out-of-range session kept', ids.indexOf('tt_outside') >= 0, JSON.stringify(ids));
  const tomb = [].concat.apply([], env.tombstoned.map(function(t){ return t.eids; }));
  r.ok('removed sessions tombstoned (t_+id fallback)', tomb.indexOf('t_tt_demo1') >= 0 && tomb.indexOf('t_tt_orphan') >= 0, JSON.stringify(tomb));
  r.ok('kept sessions not tombstoned', tomb.indexOf('t_tt_real') < 0);
  r.ok('tasks saved BEFORE timetables (tombstones first)', env.order.indexOf('tasks') >= 0 && env.order.indexOf('tasks') < env.order.indexOf('timetables'), JSON.stringify(env.order));
}

/* ── Routines: removes demo habits and bundles ── */
{
  const env = run({
    store: { '_fb_loaded_once': '1' },
    routineHabits: DEMO_HABITS.slice(),
    routineBundles: DEMO_BUNDLES.slice(),
  });
  r.ok('removes all 4 demo routine habits', env.sb.routineHabits.length === 0);
  r.ok('removes all 2 demo routine bundles', env.sb.routineBundles.length === 0);
}

/* ── Routines: a demo habit the user actually checked is THEIR habit → kept ── */
{
  const env = run({
    store: { '_fb_loaded_once': '1', 'routine_logs_v1': JSON.stringify({ '2026-09-20': { rh_plan: { state:'done' } } }) },
    routineHabits: DEMO_HABITS.slice(),
    routineBundles: [{ id:'rb_morning', title:'아침 루틴', habitIds:['rh_water','rh_plan'] }, { id:'rb_night', title:'저녁 루틴', habitIds:['rh_journal'] }],
  });
  const hid = env.sb.routineHabits.map(function(h){ return h.id; });
  r.ok('used demo habit kept', hid.length === 1 && hid[0] === 'rh_plan', JSON.stringify(hid));
  const bid = env.sb.routineBundles.map(function(b){ return b.id; });
  r.ok('bundle with a live habit kept, empty demo bundle removed', bid.length === 1 && bid[0] === 'rb_morning', JSON.stringify(bid));
}

/* ── Routines: renamed demo habit (user customized the title) → kept ── */
{
  const env = run({ store: { '_fb_loaded_once': '1' }, routineHabits: [{ id:'rh_water', title:'물 2L 마시기' }], routineBundles: [] });
  r.ok('renamed demo habit kept', env.sb.routineHabits.length === 1);
}

/* ── Routines: preserves user habits ── */
{
  const env = run({
    store: { '_fb_loaded_once': '1' },
    routineHabits: [
      { id: 'rh_water', title: '물 한 컵' }, /* demo */
      { id: 'rh_myhabit', title: '내 루틴' }, /* user */
    ],
    routineBundles: [],
  });
  r.ok('keeps user routine habit', env.sb.routineHabits.length === 1);
  r.ok('remaining habit is the user one', env.sb.routineHabits[0] && env.sb.routineHabits[0].id === 'rh_myhabit');
}

/* ── Guard written even when nothing to remove (already clean) ── */
{
  const env = run({ store: { '_fb_loaded_once': '1' }, tasks: [], timetables: [], routineHabits: [], routineBundles: [] });
  r.ok('guard written when data is already clean', env.store['_demo_cleanup_v2'] === '1');
}

r.done();
