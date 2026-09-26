'use strict';
/* 날짜별 목록에서 하위 할일은 '그날' 것만 상위 아래에 보인다(목표처럼).
   - 다른 날짜 하위 할일이 그날 목록에 전부 뜨지 않는다.
   - 대신 상위 할일은 '그날' 후손이 있으면 자기 날짜가 아니어도 그날 목록에 나타난다
     (그 아래엔 그날 하위만) → 각 하위가 자기 날짜에서 상위와 함께 보임(유실 없음).
   - 검색/전체(scope!=='current') 뷰에선 하위 전부 보여준다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('날짜별 목록 하위 할일 필터');

// ── 런타임: visibleTasks가 그날 후손 가진 상위를 올리고, 다른날짜 하위는 안 올린다 ──
const block = sliceBlock(html, 'function visibleTasks(){', 'function _taskIsLinkPrep(t){');
function mk(taskList, sel){
  const ctx = {
    tasks: taskList, selDate: sel, activeCat: 'all',
    _taskCatMatch: function(){ return true; },
    _taskById: function(id){ return taskList.find(function(x){return String(x.id)===String(id);})||null; },
    taskIsNested: function(x){ return !!(x&&x.parentId); },
    String, Number,
  };
  vm.createContext(ctx); vm.runInContext(block, ctx);
  return ctx.visibleTasks().map(function(x){return x.id;});
}

// P(부모, D1) + C1(자식, D1) + C2(자식, D2)
const P={id:1, date:'2026-11-04'};
const C1={id:2, parentId:1, date:'2026-11-04'};
const C2={id:3, parentId:1, date:'2026-11-03'};
const list=[P,C1,C2];

// D1(11-04): P(자기날짜) + C1(자기날짜). C2는 다른 날짜라 없음.
var d1=mk(list, '2026-11-04');
t.ok('그날(D1): 상위 + 그날 하위만 (다른날짜 하위 제외)', d1.indexOf(1)>=0 && d1.indexOf(2)>=0 && d1.indexOf(3)<0, d1);

// D2(11-03): C2(자기날짜) + P(그날 후손 있어 올라옴). C1은 다른 날짜라 없음.
var d2=mk(list, '2026-11-03');
t.ok('다른날(D2): 그날 하위(C2) + 상위 P가 함께 올라옴', d2.indexOf(3)>=0 && d2.indexOf(1)>=0, d2);
t.ok('다른날(D2): 다른날짜 하위 C1은 안 보임', d2.indexOf(2)<0, d2);

// 후손 없는 날(11-01): 아무것도 없음
var d0=mk(list, '2026-11-01');
t.ok('후손 없는 날: 목록 비어 있음', d0.length===0, d0);

// ── 소스 배선: buildTaskEl이 그날 하위만 + subs는 상위 날짜에서만 ──
t.ok('buildTaskEl: 기본(current) 뷰에서 그날 하위만', /var _dayScoped=\(typeof taskSearchScope==='undefined'\|\|!taskSearchScope\|\|taskSearchScope==='current'\);\s*if\(_dayScoped && typeof selDate!=='undefined'\)\{\s*_kidRows=_kidRows\.filter\(function\(row\)\{ return row\.t && row\.t\.date===selDate; \}\);/.test(html));
t.ok('buildTaskEl: legacy subs는 상위 자기 날짜에서만', /var _showSubs=\(!_dayScoped\)\|\|\(typeof selDate==='undefined'\)\|\|\(task\.date===selDate\);/.test(html));
t.ok('visibleTasks: 그날 후손 가진 최상위 상위 포함', /if\(t\.id!=null && _ancHasSel\[String\(t\.id\)\] && !\(typeof taskIsNested==='function'&&taskIsNested\(t\)\)\)return true;/.test(html));

t.done();
