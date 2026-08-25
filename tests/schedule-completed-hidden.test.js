'use strict';
/* 완료된 일정은 "연결이 필요한 마감"에서 빠진다 — scheduleTargetCompleted.
   · 일정 자체 done → 완료
   · 연결 할일(정/역방향)이 하나라도 있고 전부 done → 완료(연결 후 그 일을 끝낸 경우)
   · 연결 할일이 아예 없으면 완료 아님(여전히 '연결 필요')
   · 일부만 done 이면 완료 아님. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function scheduleTargetCompleted(', '/* "다음 준비" 헬퍼');

const sandbox = { console, String, Array };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { scheduleTargetCompleted } = sandbox;

const t = runner('완료된 일정 → 연결 필요에서 제외');

const S = { id: 100, catId: 'schedule' };

// 1. 연결 할일 없음 → 완료 아님(진짜 연결 필요)
t.ok('연결 없음 → 미완료', scheduleTargetCompleted(S, [S]) === false);

// 2. 연결 할일(forward)이 있고 done → 완료
t.ok('연결 할일 done → 완료', scheduleTargetCompleted(S, [S, { id: 200, deadlineId: '100', done: true }]) === true);

// 3. 연결 할일이 열려 있음 → 완료 아님
t.ok('연결 할일 열림 → 미완료', scheduleTargetCompleted(S, [S, { id: 200, deadlineId: '100', done: false }]) === false);

// 4. 여러 연결 중 하나라도 열려 있으면 미완료
t.ok('일부만 done → 미완료', scheduleTargetCompleted(S, [S, { id: 200, deadlineId: '100', done: true }, { id: 201, deadlineId: '100', done: false }]) === false);

// 5. 전부 done → 완료
t.ok('전부 done → 완료', scheduleTargetCompleted(S, [S, { id: 200, deadlineId: '100', done: true }, { id: 201, deadlineId: '100', done: true }]) === true);

// 6. 역방향(일정→할일) 링크의 대상이 done → 완료
const Srev = { id: 100, catId: 'schedule', deadlineId: '200' };
t.ok('역방향 대상 done → 완료', scheduleTargetCompleted(Srev, [Srev, { id: 200, done: true }]) === true);
t.ok('역방향 대상 열림 → 미완료', scheduleTargetCompleted(Srev, [Srev, { id: 200, done: false }]) === false);

// 7. sourceTaskId / _ruleSourceId 로 연결된 생성 할일도 인정
t.ok('sourceTaskId done → 완료', scheduleTargetCompleted(S, [S, { id: 202, sourceTaskId: '100', done: true }]) === true);
t.ok('_ruleSourceId done → 완료', scheduleTargetCompleted(S, [S, { id: 203, _ruleSourceId: '100', done: true }]) === true);

// 8. 일정 자체가 done → 완료
t.ok('일정 자체 done → 완료', scheduleTargetCompleted({ id: 100, done: true }, [{ id: 100, done: true }]) === true);

// 9. _travelOnly 연결은 무시
t.ok('travelOnly 무시 → 미완료', scheduleTargetCompleted(S, [S, { id: 210, deadlineId: '100', done: true, _travelOnly: true }]) === false);

// 10. 방어
t.ok('null → false', scheduleTargetCompleted(null, []) === false);
t.ok('non-array → false', scheduleTargetCompleted(S, null) === false);
t.ok('숫자/문자 id 매칭', scheduleTargetCompleted({ id: 100 }, [{ id: 5, deadlineId: 100, done: true }]) === true);

t.done();
