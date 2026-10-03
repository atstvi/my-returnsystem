'use strict';
/* 계획창 종일 줄 두 가지:
   (1) 완료된 종일 할일도 보이고(완료 여부 표시: ✓·취소선), 안 사라진다.
   (2) 반복·규칙 생성 할일을 시간대에 끌어 배치하면 '이 항목만' 바뀌고 배치가 유지된다
       — reconcile이 시간을 규칙값('')으로 되돌리지 않게 userModifiedDate로 표시. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('계획창: 종일 완료 표시 + 반복 시간 배치(이 항목만)');

// (1) 종일 base가 더 이상 done을 제외하지 않는다(완료도 보임)
t.ok('종일 base가 done을 제외하지 않음(완료도 표시)',
  /var _adBase=dayTasks\.filter\(function\(t\)\{return t&&!t\._travelOnly && _untimed\(t\) && !_isSchedLike\(t\) && !_nested\(t\);\}\);/.test(html));
// 완료 판정 → ✓·done 클래스(기존 배선 유지)
t.ok('종일 칩 완료 시 ✓·done',
  /var _dqDone=\(typeof taskDayQuotaDone==='function'&&taskDayQuotaDone\(t,_planDate\)\)\|\|\(typeof taskEffectiveDone==='function'&&taskEffectiveDone\(t\)\);[\s\S]*?_dqDone\?'✓ ':'○ '/.test(html));

// (2) _planSchedule: 생성 항목은 시간 배치 시 이 항목만(userModifiedDate) 표시
t.ok("_planSchedule이 생성 항목을 '이 항목만'으로 표시",
  /if\(typeof isGeneratedTask==='function'&&isGeneratedTask\(t\)\)t\.userModifiedDate=true;\s*if\(typeof saveTaskData==='function'\)saveTaskData\(\);/.test(html));

// reconcileGeneratedTasks: manual(사용자 편집) occurrence는 필드(timeStart 등)를 규칙값으로 안 덮는다
t.ok('reconcile이 manual occurrence 필드를 보존',
  /if\(!isGeneratedManual\(t\)\)\{\s*\['text','catId','priority','deadlineDate','deadlineTime','deadlineId','timeStart','timeEnd'\]\.forEach/.test(html));
t.ok('isGeneratedManual = userModifiedDate', /function isGeneratedManual\(t\)\{return !!\(t&&t\.userModifiedDate\);\}/.test(html));

t.done();
