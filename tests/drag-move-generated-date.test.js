'use strict';
/* 드래그로 반복/규칙 생성 할일의 날짜를 옮길 때 '이 항목만' 이동으로 안전하게 처리:
   - 달력(setupCalDragDrop) 드롭이 markTaskDateManualChange를
     써서 원래 occurrence를 suppress하고 userModifiedDate/_repeatMoved를 세운다. 예전엔
     달력 드롭이 _repeatId만 suppress해 활성 규칙(_ruleId/_ruleGen) 항목이 어긋나며 오류가 났음.
   - markTaskDateManualChange는 반복(_repeatId)과 활성 규칙(_ruleId/_ruleGen/sourceType) 모두를
     처리하고 suppressGeneratedTask로 재생성/부활을 막는다.
   - 수정 범위(scope) 창은 띄우지 않고 그 항목만 옮긴다(사용자 요청). */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('드래그 날짜 이동(반복·규칙) 이 항목만');

/* markTaskDateManualChange가 반복·규칙 양쪽을 suppress + 표시 */
t.ok('markTaskDateManualChange: 반복·규칙 모두 처리', /function markTaskDateManualChange\(task,nextDate\)\{[\s\S]*?task\._repeatId\|\|task\.repeatRuleId\|\|task\._ruleGen\|\|task\._ruleId\|\|task\.sourceType==='repeat'\|\|task\.sourceType==='rule'\|\|task\.sourceType==='activeRule'[\s\S]*?suppressGeneratedTask\(task,'moved'\)[\s\S]*?task\.userModifiedDate=true;[\s\S]*?task\._repeatMoved=true;/.test(html));

/* 달력 드롭이 markTaskDateManualChange 사용 (스코프 창 없이 그 항목만 이동) */
t.ok('달력 드롭에서 markTaskDateManualChange 사용', /if\(typeof markTaskDateManualChange==='function'\)markTaskDateManualChange\(task,dk2\);[\s\S]*?task\.date=dk2;task\.updatedAt=Date\.now\(\);/.test(html));
t.ok('달력 드롭은 예전 _repeatId-만 suppress를 폴백으로만 남김', /else if\(task\._repeatId&&typeof suppressRepeatOccurrence==='function'\)\{suppressRepeatOccurrence\(task\);task\.userModifiedDate=true;task\._repeatMoved=true;\}/.test(html));
/* (할일탭 주간뷰(twv) 드롭 2경로는 계획창으로 대체되어 제거됨) */

/* 스코프 창(openRepeatEditScopeDialog)을 달력 드롭에서 호출하지 않음 — 그 항목만 이동 */
(function(){
  var m=html.match(/cell\.addEventListener\('drop',function\(e\)\{[\s\S]*?renderCal\(\);renderList\(\);\s*\}\);/);
  t.ok('달력 드롭 핸들러에 스코프 창 호출 없음', !!m && m[0].indexOf('openRepeatEditScopeDialog')<0);
})();

t.done();
