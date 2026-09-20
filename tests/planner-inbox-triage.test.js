'use strict';
/* 데이 플래너 트레이 — 인박스 항목을 탭하면 '정리 시트'로 ①바로 시행(오늘 지금 시간)
   ②그냥 할일 ③프로젝트 할일 ④프로젝트 자료(보드) 경로로 빠르게 분류한다. 처리한 항목은
   unread=false로 비운다(기록 유지). 프로젝트는 시트 안 목록에서 고른다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('플래너 인박스 정리 시트');

// ── _planInboxToBoard 순수 로직(노트+이미지 카드 생성) ──
const block = sliceBlock(html, 'function _planInboxToBoard(p,it){', 'function _planInboxTriage(id){');
const ctx = {
  Date, Math, Array, String, Object,
  projectBoardEnsure:function(p){ if(!p.board)p.board={items:[]}; if(!Array.isArray(p.board.items))p.board.items=[]; return p.board; },
  _boardDropPos:function(){ return {x:40,y:40}; },
  saveProjects:function(){ ctx.__saved=true; }
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

(function(){
  var p={id:'p1',title:'연구',board:{items:[]}};
  var it={text:'그림 자료', imgs:['ref1','ref2']};
  var ok=ctx._planInboxToBoard(p,it);
  var notes=p.board.items.filter(function(i){return i.type==='note';});
  var imgs=p.board.items.filter(function(i){return i.type==='image';});
  t.ok('보드 저장 성공', ok===true && ctx.__saved===true);
  t.ok('노트 카드에 인박스 텍스트', notes.length===1 && notes[0].text==='그림 자료');
  t.ok('이미지 레퍼런스마다 이미지 카드', imgs.length===2 && imgs[0].src==='ref1' && imgs[1].src==='ref2');
  t.ok('프로젝트 updatedAt 갱신', typeof p.updatedAt==='number');
})();
(function(){
  var p={id:'p2',title:'빈텍스트',board:{items:[]}};
  ctx._planInboxToBoard(p,{text:'   ', imgs:[]});
  t.ok('빈 텍스트면 노트 카드 없음', p.board.items.filter(function(i){return i.type==='note';}).length===0);
})();

// ── 소스 배선 ──
t.ok('인박스 탭 → 정리 시트 진입', /if\(kind==='inbox'\)\{ _planInboxTriage\(pid\); return; \}/.test(html));
t.ok('정리 시트 4경로 버튼', /opt\('pt-now'[\s\S]*?바로 시행[\s\S]*?opt\('pt-task'[\s\S]*?그냥 할일[\s\S]*?opt\('pt-ptask'[\s\S]*?프로젝트 할일[\s\S]*?opt\('pt-pmat'[\s\S]*?프로젝트 자료/.test(html));
t.ok('바로 시행: 오늘+현재 시간 배치', /var sm=Math\.min\(Math\.round\(\(now\.getHours\(\)\*60\+now\.getMinutes\(\)\)\/15\)\*15,1425\);[\s\S]*?mkTask\(\{date:_planToday\(\),timeStart:ts,timeEnd:te\}\)/.test(html));
t.ok('그냥 할일: 시간 미정 오늘 할일', /#pt-task'\)\.addEventListener\('click',function\(\)\{ tasks\.unshift\(mkTask\(\{\}\)\);/.test(html));
t.ok('프로젝트 할일: projectId+catId=project', /kind==='task'\)\{ tasks\.unshift\(mkTask\(\{catId:'project',projectId:String\(p\.id\)\}\)\);/.test(html));
t.ok('프로젝트 자료: 보드에 저장', /_planInboxToBoard\(p,it\)/.test(html));
t.ok('처리됨으로 비우기(unread=false, 기록 유지)', /function markProcessed\(\)\{ it\.unread=false; if\(typeof saveInboxItems==='function'\)saveInboxItems\(\); \}/.test(html));
t.ok('프로젝트는 시트 목록에서 선택', /function projPick\(kind\)\{[\s\S]*?data-pp="'\+esc\(String\(p\.id\)\)/.test(html));
t.ok('프로젝트 없으면 안내', /먼저 프로젝트를 하나 만들어 주세요/.test(html));
t.ok('뒤로 버튼으로 메뉴 복귀', /#pt-back'\)\.addEventListener\('click',menu\);/.test(html));
t.ok('인박스에서 열기 폴백 유지', /pt-open'\)\.addEventListener\('click',function\(\)\{ close\(\); if\(typeof openInboxItemFromHome/.test(html));

t.done();
