'use strict';
/* 할일 메모(note)는 사용자 메모 전용. 예전엔 앱이 '홈 빠른 캡처', '시간표 · 이름', '반복 할일',
   '활성 규칙으로 자동 생성됨', '인박스에서 전환' 등 출처 표시를 메모에 써서 사용자 메모와 섞였다.
   계약: 생성기는 메모를 비우고 출처는 origin 필드에 둔다. 남은 문구는 재조정 때 걷어 내되
   사용자가 직접 쓴 메모는 그대로. 시간표 재조정은 수업 메모를 덮어쓰지 않는다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('할일 메모 ≠ 출처 태그');

const src = sliceBlock(html, 'var TASK_SYSTEM_NOTE_RE=', 'function generatedCanonicalType(t){');
const ctx = { String, Date, RegExp }; vm.createContext(ctx); vm.runInContext(src, ctx);

// 1) 시스템 문구 판별 — 정확히 그 문구일 때만
{
  ['홈 빠른 캡처', '홈 빠른 캡처 (AI)', '시간표 · 내 시간표', '반복 할일', '활성 규칙으로 자동 생성됨',
   '인박스에서 전환', '인박스에서 전환 · ♥3', '인박스 정리', '인박스에서 계획', '마감 준비 · 계획',
   '오늘 상황 · 연결 할일', '자연어 캡처 · 연결 할일', '체크인에서 담음']
    .forEach(n => t.ok('시스템 문구: ' + n, ctx.taskIsSystemNote(n)));
  ['홈 빠른 캡처로 넣은 거 나중에 확인', '반복 할일 정리하기', '실험복 챙기기', '', null]
    .forEach(n => t.ok('사용자 메모는 아님: ' + n, !ctx.taskIsSystemNote(n)));
  t.ok('clean: 시스템 문구 → 빈 메모', ctx.taskCleanSystemNote('반복 할일') === '');
  t.ok('clean: 사용자 메모 유지', ctx.taskCleanSystemNote('교재 p.30') === '교재 p.30');
}

// 2) 마이그레이션 — 시스템 문구만 지우고 origin/_ttName 보존
{
  const list = [
    { id: 1, note: '홈 빠른 캡처' },
    { id: 2, note: '인박스에서 전환 · ♥2' },
    { id: 3, note: '반복 할일', origin: 'custom' },
    { id: 4, note: '시간표 · 내 시간표', _isTt: true },
    { id: 5, note: '📅 시간표: 화학\n🎒 준비물: 실험복', _isTt: true },
    { id: 6, note: '📅 시간표: 화학' },
    { id: 7, note: '홈 빠른 캡처 보고 정리' },
    { id: 8, note: '' },
  ];
  const n = ctx.taskMigrateSystemNotes(list);
  const by = id => list.find(x => x.id === id);
  t.ok('바뀐 개수 5', n === 5, n);
  t.ok('캡처 문구 제거 + origin capture', by(1).note === '' && by(1).origin === 'capture' && by(1).updatedAt > 0);
  t.ok('인박스 문구 제거 + origin inbox', by(2).note === '' && by(2).origin === 'inbox');
  t.ok('기존 origin은 덮지 않음', by(3).note === '' && by(3).origin === 'custom');
  t.ok('시간표 이름은 _ttName으로 보존', by(4).note === '' && by(4)._ttName === '내 시간표' && by(4).origin === 'timetable');
  t.ok('옛 시간표 메모(📅) 제거(수업만)', by(5).note === '');
  t.ok('시간표가 아닌 할일의 📅 메모는 유지', by(6).note === '📅 시간표: 화학');
  t.ok('사용자 메모 유지', by(7).note === '홈 빠른 캡처 보고 정리' && !by(7).updatedAt);
  t.ok('두 번째 실행은 무변화(멱등)', ctx.taskMigrateSystemNotes(list) === 0);
}

// 3) 생성기들이 더 이상 메모에 출처를 쓰지 않음
{
  const writers = [
    "note:'홈 빠른 캡처'", "note:'홈 빠른 캡처 (AI)'", "note:'반복 할일'", "note:'인박스 정리'",
    "note:'인박스에서 계획'", "note:'마감 준비 · 계획'", "note:'오늘 상황 · 연결 할일'",
    "note:'자연어 캡처 · 연결 할일'", "note:'활성 규칙으로 자동 생성됨'", "note:'시간표 · '",
    "note:'인박스에서 전환",
  ];
  writers.forEach(w => t.ok('생성기 없음: ' + w, html.indexOf(w) < 0));
  t.ok('재조정에서 마이그레이션 호출', /changed\+=taskMigrateSystemNotes\(tasks\)/.test(html));
}

// 4) 시간표 재조정은 수업 메모를 덮어쓰지 않는다
{
  const i = html.indexOf("['text','catId','date','timeStart','timeEnd','priority','deadlineDate','deadlineId','travelMin'].forEach(function(prop){");
  t.ok('시간표 동기화 속성에 note 없음', i >= 0);
  t.ok("시간표 메타에 _ttName 포함", /\['_ttId','_ttName',/.test(html));
}

// 5) 데모 정리는 메모 서명 대신 _ttName으로도 식별
t.ok('데모 수업 식별에 _ttName', html.indexOf("String(t._ttName||'')!==DEMO_TT_NAME") >= 0);

t.done();
