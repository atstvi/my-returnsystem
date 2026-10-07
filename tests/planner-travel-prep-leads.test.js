'use strict';
/* 계획창에서도 나 탭 타임블록처럼 이동시간·준비물이 보여야 한다.
   1일 보기: 블록 위로 '이동'(travelMin) → 그 위 '준비'(prepMin, 기본 20분) 구간을 쌓고,
   남은 준비물 이름을 보여 주며 탭하면 체크리스트. 최소 높이로 짧아도 읽힌다. 블록을 끄는
   동안 함께 움직인다. 여러 날 보기: 같은 정보를 아이콘+수치 띠로. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('계획창 이동·준비 구간');

const block = sliceBlock(html, 'function _planLeadEls(o, START, SLOT_H, blockEl){', '\nfunction _planBindBlock(el,t,o,START,SLOT_H,rz){');
function fakeEl(tag){
  const e = { tag, className:'', style:{ setProperty(k,v){ this[k]=v; } }, children:[], attrs:{}, textContent:'', title:'', listeners:{},
    appendChild(c){ this.children.push(c); return c; }, setAttribute(k,v){ this.attrs[k]=v; }, addEventListener(k,f){ this.listeners[k]=f; } };
  return e;
}
const opened = [];
const ctx = {
  document: { createElement: fakeEl }, String, Math,
  taskPrepList: (x) => (x.prepItems || []).filter(p => p && p.text),
  taskEffectiveDone: (x) => !!x.done,
  twvCatColor: () => '#7766ff',
  openPrepChecklistEditor: (task, cb, opts) => opened.push({ id: task.id, opts }),
  _taskById: () => null, saveTaskData: () => {}, renderPlanner: () => {},
};
vm.createContext(ctx); vm.runInContext(block, ctx);
const SLOT = 48, START = 3;
const task = { id: 1, text:'발표', travelMin:30, prepItems:[{text:'노트북',done:false},{text:'충전기',done:true}] };
const o = { t: task, sm: 10*60, em: 11*60+30, col:0, cols:1 };
const bel = {};
const els = ctx._planLeadEls(o, START, SLOT, bel);
const travel = els.find(e => /travel/.test(e.className)), prep = els.find(e => /prep/.test(e.className));
const blockTop = (o.sm - START*60)/60*SLOT;
t.ok('이동 구간 생성', !!travel && /30분 이동/.test(travel.children[0].textContent));
t.ok('준비 구간 생성 + 진행/남은 준비물 이름', !!prep && /1\/2/.test(prep.children[0].textContent) && prep.children[1].textContent === '노트북');
t.ok('이동은 블록 바로 위', parseFloat(travel.style.top) + parseFloat(travel.style.height) + 2 === blockTop, [travel.style.top, travel.style.height, blockTop]);
t.ok('준비는 이동 위에 쌓임', parseFloat(prep.style.top) < parseFloat(travel.style.top));
t.ok('짧아도 최소 높이(준비 ≥ 18px)', parseFloat(prep.style.height) >= 18);
prep.listeners.click({ stopPropagation(){} });
t.ok('준비 구간 탭 → 체크리스트', opened.length === 1 && opened[0].id === 1 && opened[0].opts === undefined);
const tt = ctx._planLeadEls({ t:{ id:'tt_x', _isTt:true, text:'화학', prepItems:[{text:'교재',done:false}] }, sm:600, em:660, col:0, cols:1 }, START, SLOT, {});
tt[0].listeners.click({ stopPropagation(){} });
t.ok('시간표 수업 준비물은 체크만(원본은 시간표)', opened[1] && opened[1].opts && opened[1].opts.checkOnly === true);
o.sm = 14*60; bel._placeLeads();
t.ok('드래그 시 함께 이동(_placeLeads)', parseFloat(travel.style.top) + parseFloat(travel.style.height) + 2 === (o.sm - START*60)/60*SLOT);
t.ok('정보 없으면 구간 없음', ctx._planLeadEls({ t:{ id:2, text:'x' }, sm:600, em:660, col:0, cols:1 }, START, SLOT, {}).length === 0);
t.ok('목표 대표는 제외', ctx._planLeadEls({ t:{ id:3, _planGoalRep:true, travelMin:20 }, sm:600, em:660, col:0, cols:1 }, START, SLOT, {}).length === 0);
const allDone = ctx._planLeadEls({ t:{ id:4, prepItems:[{text:'a',done:true}] }, sm:600, em:660, col:0, cols:1 }, START, SLOT, {});
t.ok('준비물 다 챙겼으면 준비 구간 숨김(홈과 동일)', allDone.length === 0);

t.ok('1일 보기 배선', /var bel=_planBlockEl\(o,START,SLOT_H\); _planLeadEls\(o,START,SLOT_H,bel\)\.forEach/.test(html) && /if\(el\._placeLeads\)el\._placeLeads\(\);/.test(html));
t.ok('여러 날 보기 배선', /_lead\('travel', _tv, '🚶 '\+_tv\+'분'/.test(html) && /return leads\+'<div class="planm-block'/.test(html));
t.done();
