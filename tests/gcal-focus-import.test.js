'use strict';
/* 구글 캘린더 → 집중 기록 가져오기 (공부 앱 통합).

   공부 전용 앱이 세션을 구글 캘린더 이벤트로 남기면, 그 캘린더를 읽어 이 앱의
   집중 기록으로 통합한다. 네트워크와 무관한 순수 변환/병합 로직을 고정한다:

   gcalEventToFocusRecord(ev,opts):
   - 시간 이벤트(start/end.dateTime)만 세션으로 변환, 종일 이벤트는 제외
   - end<=start·너무 짧음(minMinutes)·비정상적으로 김(maxHours)은 제외
   - 이 앱이 밀어넣은 이벤트(extendedProperties.private.returnSyncSource==='return') 제외
   - 제목 키워드 필터(opts.keyword)
   - 이벤트 id로 안정적 id(gcalimp_<id>) → 재가져오기해도 중복 안 됨
   - 출처 라벨/색(categoryName/categoryColor)으로 직접 잰 기록과 구분

   gcalMergeFocusImports(events,log,opts):
   - 기존 로그에 없는 것만 added, 시간·길이 바뀐 것은 제자리 갱신(updated)
   - 같은 이벤트가 두 번 와도 한 번만 */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(
  html,
  'function gcalEventToFocusRecord(ev,opts){',
  '\nasync function gcalImportFocus('
);

const sb = { window: {}, console: { log() {}, warn() {} }, String, Array, Object, Number, Math, Date };
vm.createContext(sb);
vm.runInContext(block, sb);
const toRec = sb.gcalEventToFocusRecord;
const merge = sb.gcalMergeFocusImports;

const t = runner('gcal → focus import (study-app integration)');

t.ok('exposes gcalEventToFocusRecord', typeof toRec === 'function');
t.ok('exposes gcalMergeFocusImports', typeof merge === 'function');

const ev = (over) => Object.assign({
  id: 'evt1',
  summary: '수학 공부',
  start: { dateTime: '2026-08-21T09:00:00+09:00' },
  end: { dateTime: '2026-08-21T10:30:00+09:00' },
}, over || {});

// ── 1. a normal timed event → focus record ─────────────────────────────────
{
  const r = toRec(ev(), { label: '공부앱', color: '#5B8DEF' });
  t.ok('record created', !!r);
  t.ok('stable id from event id', r.id === 'gcalimp_evt1', r && r.id);
  t.ok('duration = 90 min', r.durationMs === 90 * 60000, r && r.durationMs);
  t.ok('taskText = summary', r.taskText === '수학 공부');
  t.ok('source = gcal', r.source === 'gcal');
  t.ok('carries source label', r.categoryName === '공부앱');
  t.ok('carries source color', r.categoryColor === '#5B8DEF');
  t.ok('completedAt = end time', r.completedAt === Date.parse('2026-08-21T10:30:00+09:00'));
}

// ── 2. all-day event (date only) → skipped ─────────────────────────────────
{
  const r = toRec(ev({ start: { date: '2026-08-21' }, end: { date: '2026-08-22' } }));
  t.ok('all-day → null', r === null);
}

// ── 3. this app's own pushed event → skipped ───────────────────────────────
{
  const r = toRec(ev({ extendedProperties: { private: { returnSyncSource: 'return' } } }));
  t.ok('own task push → null', r === null);
}

// ── 4. too-short / zero / reversed durations → skipped ─────────────────────
{
  t.ok('zero duration → null', toRec(ev({ end: { dateTime: '2026-08-21T09:00:00+09:00' } })) === null);
  t.ok('reversed → null', toRec(ev({ end: { dateTime: '2026-08-21T08:00:00+09:00' } })) === null);
  const short = ev({ end: { dateTime: '2026-08-21T09:00:30+09:00' } }); // 30s
  t.ok('under minMinutes → null', toRec(short, { minMinutes: 1 }) === null);
}

// ── 5. keyword filter ──────────────────────────────────────────────────────
{
  t.ok('keyword miss → null', toRec(ev({ summary: '점심 약속' }), { keyword: '공부' }) === null);
  t.ok('keyword hit → record', !!toRec(ev({ summary: '영어 공부' }), { keyword: '공부' }));
}

// ── 6. cancelled event → skipped ───────────────────────────────────────────
{
  t.ok('cancelled → null', toRec(ev({ status: 'cancelled' })) === null);
}

// ── 7. merge: dedup + update + skip ────────────────────────────────────────
{
  const log = [{ id: 'gcalimp_evt1', durationMs: 60 * 60000, completedAt: 1, taskText: '수학 공부', source: 'gcal' }];
  const events = [
    ev(),                                   // existing id, but 90min now → update
    ev({ id: 'evt2', summary: '영어' }),     // new → added
    ev(),                                   // duplicate of evt1 in same batch → seen once
    ev({ start: { date: '2026-08-21' }, end: { date: '2026-08-22' } }), // all-day → skipped
  ];
  const res = merge(events, log, { label: '공부앱', color: '#5B8DEF' });
  t.ok('one added (evt2)', res.added.length === 1 && res.added[0].id === 'gcalimp_evt2', JSON.stringify(res.added.map((x) => x.id)));
  t.ok('one updated (evt1 duration)', res.updated === 1, res.updated);
  t.ok('existing record updated in place', log[0].durationMs === 90 * 60000, log[0].durationMs);
  t.ok('all-day skipped counted', res.skipped >= 1, res.skipped);
}

// ── 8. re-import is idempotent (no dup, no update the 2nd time) ─────────────
{
  const log = [];
  const events = [ev(), ev({ id: 'evt2' })];
  const first = merge(events, log, {});
  first.added.forEach((r) => log.push(r));
  const second = merge(events, log, {});
  t.ok('first import adds 2', first.added.length === 2);
  t.ok('second import adds 0', second.added.length === 0, second.added.length);
  t.ok('second import updates 0', second.updated === 0, second.updated);
}

t.done();
