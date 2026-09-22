'use strict';
/* 데이 플래너 트레이 — 인박스 항목을 탭하면 '정리 시트'로 ①바로 시행(오늘 지금 시간)
   ②그냥 할일 ③프로젝트 할일 ④프로젝트 로그 ⑤프로젝트 자료(보드) 경로로 빠르게 분류한다.
   처리한 항목은 unread=false로 비운다(기록 유지). 프로젝트는 시트 안 목록에서 고른다.
   프로젝트 할일: 프로젝트를 고른 뒤 그 프로젝트의 목표(있으면)도 선택할 수 있고,
   기본으로 '지금 시간·오늘'에 배치해 이후 날짜/시간 조정이 쉽게 한다. */
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
t.ok('정리 시트 5경로 버튼', /opt\('pt-now'[\s\S]*?바로 시행[\s\S]*?opt\('pt-task'[\s\S]*?그냥 할일[\s\S]*?opt\('pt-ptask'[\s\S]*?프로젝트 할일[\s\S]*?opt\('pt-plog'[\s\S]*?프로젝트 로그[\s\S]*?opt\('pt-pmat'[\s\S]*?프로젝트 자료/.test(html));
t.ok('프로젝트 로그: p.logs에 기록(quickAddLog 모양)', /function _planInboxToLog\(p,it\)\{[\s\S]*?p\.logs\.unshift\(\{ id:'log_'[\s\S]*?text:txt[\s\S]*?\}\);/.test(html) && /ov\.querySelector\('#pt-plog'\)\.addEventListener\('click',function\(\)\{ projPick\('log'\); \}\);/.test(html));
t.ok('로그 선택 분기: _planInboxToLog 호출', /else if\(kind==='log'\)\{ var okL=_planInboxToLog\(p,it\);/.test(html));
t.ok('바로 시행: 오늘+현재 시간 배치', /var sm=Math\.min\(Math\.round\(\(now\.getHours\(\)\*60\+now\.getMinutes\(\)\)\/15\)\*15,1425\);[\s\S]*?mkTask\(\{date:_planToday\(\),timeStart:ts,timeEnd:te\}\)/.test(html));
t.ok('그냥 할일: 시간 미정 오늘 할일', /#pt-task'\)\.addEventListener\('click',function\(\)\{ tasks\.unshift\(mkTask\(\{\}\)\);/.test(html));
t.ok('프로젝트 할일 → 목표 선택 단계로', /if\(kind==='task'\)\{ goalPick\(p\); \}/.test(html));
t.ok('목표 선택: 목표 없이 + 각 목표 옵션', /function goalPick\(p\)\{[\s\S]*?data-gg="_none"[\s\S]*?목표 없이 추가[\s\S]*?gs\.map\(function\(g\)\{[\s\S]*?data-gg="'\+esc\(String\(g\.id\)\)/.test(html));
t.ok('목표 없이 선택시 goalId 비움', /_projTaskCreate\(p, ?gid==='_none'\?'':gid\)/.test(html));
t.ok('프로젝트 할일: projectId+catId=project+현재시간+오늘', /function _projTaskCreate\(p,goalId\)\{[\s\S]*?catId:'project', ?projectId:String\(p\.id\), ?date:_planToday\(\), ?timeStart:slot\.ts, ?timeEnd:slot\.te[\s\S]*?tasks\.unshift\(mkTask\(extra\)\)/.test(html));
t.ok('현재 시간 슬롯 계산(15분 스냅)', /function _nowSlot\(\)\{ var now=new Date\(\); var sm=Math\.min\(Math\.round\(\(now\.getHours\(\)\*60\+now\.getMinutes\(\)\)\/15\)\*15,1425\);/.test(html));
t.ok('목표 선택시 goalId 반영', /if\(goalId\)\{ extra\.goalId=String\(goalId\); \}/.test(html));
t.ok('프로젝트 자료: 보드에 저장', /_planInboxToBoard\(p,it\)/.test(html));
t.ok('처리됨으로 비우기(unread=false, 기록 유지)', /function markProcessed\(\)\{ it\.unread=false; if\(typeof saveInboxItems==='function'\)saveInboxItems\(\); \}/.test(html));
t.ok('프로젝트는 시트 목록에서 선택', /function projPick\(kind\)\{[\s\S]*?data-pp="'\+esc\(String\(p\.id\)\)/.test(html));
t.ok('프로젝트 없으면 안내', /먼저 프로젝트를 하나 만들어 주세요/.test(html));
t.ok('뒤로 버튼으로 메뉴 복귀', /#pt-back'\)\.addEventListener\('click',menu\);/.test(html));
t.ok('인박스에서 열기 폴백 유지', /pt-open'\)\.addEventListener\('click',function\(\)\{ close\(\); if\(typeof openInboxItemFromHome/.test(html));

t.done();
