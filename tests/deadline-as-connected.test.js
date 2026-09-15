'use strict';
/* '마감일=연결' 취급: 마감일이 있는 할일/일정은 달력에서 자기 마감과 화살표로 이어져
   보이므로 이미 '연결된' 것으로 본다.
   - scheduleTargetHasLinkedTask: target.deadlineDate가 있으면 true → '오늘 상황'의
     '연결 필요(연결 할일 만들기)' 목록에서 제외.
   - 할일 상세 '일정 연결': 다른 항목과의 명시적 연결이 없어도 마감일이 있으면
     '📅 마감일과 연결됨'으로 표시(‘연결 없음’ 혼란 제거). 마감·연결 둘 다 없을 때만 '연결 없음'. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('마감일=연결 취급');

t.ok('scheduleTargetHasLinkedTask: 마감일 있으면 연결로 간주', /function scheduleTargetHasLinkedTask\(target, taskList\)\{\s*if\(!target\)return false;[\s\S]*?if\(target\.deadlineDate\)return true;/.test(html));
t.ok('상세: 마감일 있으면 마감일과 연결됨 표시', /task\.deadlineDate \? '📅 마감일과 연결됨 · '\+task\.deadlineDate : '연결 없음'/.test(html));
t.ok('상세: 마감 또는 연결 있으면 empty 아님', /_linkVal\.className='mr-value'\+\(\(task\.deadlineId\|\|task\.deadlineDate\)\?'':' empty'\)/.test(html));
// 회귀 기준: 정/역방향 실제 링크 판정은 유지
t.ok('정/역방향 링크 판정 유지', /if\(String\(t\.deadlineId\|\|''\)===tid\|\|String\(t\.sourceTaskId\|\|''\)===tid\|\|String\(t\._ruleSourceId\|\|''\)===tid\)return true;/.test(html));

t.done();
