'use strict';
/* Area — 프로젝트의 상위 '삶의 영역'. 프로젝트 탭(스튜디오 폴더 대시보드)을 Area로 묶어
   보여주고, 각 프로젝트는 areaId로 한 Area에 속한다(빈 값=미분류 가상 버킷). areas_v1은
   DATA_KEYS에 있어 blob 동기화된다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('Area 그룹');

// ── Area 헬퍼(순수 로직) ──
const block = sliceBlock(html, 'var areas=[];', 'function openAreaEditor(area){');
var lsStore={};
const ctx = {
  localStorage:{ getItem(k){ return (k in lsStore)?lsStore[k]:null; }, setItem(k,v){ lsStore[k]=String(v); } },
  setReturnStorageItem(k,v){ lsStore[k]=String(v); return true; },
  JSON, String, Date,
  projects:[
    {id:'p1', areaId:'a1'}, {id:'p2', areaId:'a1'}, {id:'p3', areaId:'a2'}, {id:'p4', areaId:''}, {id:'p5'}
  ]
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

lsStore['areas_v1']=JSON.stringify([
  {id:'a2', name:'커리어', order:1}, {id:'a1', name:'건강', order:0}
]);
ctx.loadAreas();
t.ok('loadAreas 파싱', Array.isArray(ctx.areas) && ctx.areas.length===2);
t.ok('areaById', ctx.areaById('a1').name==='건강' && ctx.areaById('a2').name==='커리어');
t.ok('areasSorted order 순', ctx.areasSorted()[0].id==='a1' && ctx.areasSorted()[1].id==='a2');
t.ok('projectsInArea 필터', ctx.projectsInArea('a1').length===2 && ctx.projectsInArea('a2').length===1);
t.ok('미분류(빈/없는 areaId) 집계', ctx.projectsInArea('').length===2);
// 접힘 상태 roundtrip
t.ok('기본 펼침', ctx.areaIsCollapsed('a1')===false);
ctx.setAreaCollapsed('a1', true);
t.ok('접기 저장', ctx.areaIsCollapsed('a1')===true);
ctx.setAreaCollapsed('a1', false);
t.ok('펼치기', ctx.areaIsCollapsed('a1')===false);
// saveAreas
ctx.areas.push({id:'a3', name:'취미', order:2});
ctx.saveAreas();
t.ok('saveAreas 저장', /"a3"/.test(lsStore['areas_v1']) && /취미/.test(lsStore['areas_v1']));

// ── 소스 배선 ──
t.ok('areas_v1 동기화 키에 포함', /'generated_task_suppressions_v1','projects_v1','areas_v1',/.test(html));
t.ok('프로젝트 편집에 Area 선택 필드', /\{key:'areaId',label:'Area \(삶의 영역\)',type:'select'/.test(html));
t.ok('저장 시 areaId 반영', /project\.areaId=data\.areaId\|\|'';/.test(html) && /areaId:data\.areaId\|\|'',status:'active'/.test(html));
t.ok('폴더 대시보드 Area 그룹 모드', /_pjFolderGroupMode==='area'|Area별로 묶어 보기/.test(html));
t.ok('Area 섹션(정렬된 Area + 미분류)', /areasSorted\(\)\.forEach\(function\(a\)\{ _secs\.push/.test(html) && /_secs\.push\(\{id:'_uncat',name:'미분류'/.test(html));
t.ok('그룹 토글 3단 순환(area→stage→flat)', /_pjFolderGroupMode==='area'\?'stage':\(_pjFolderGroupMode==='stage'\?'flat':'area'\)/.test(html));
t.ok('＋ Area 버튼 + Area 편집 액션', /id="pj-area-new"/.test(html) && /function openAreaActions\(area\)\{/.test(html));
t.ok('상세에 Area 칩 + 피커', /id="pjd-area"/.test(html) && /function openProjectAreaPicker\(project\)\{/.test(html));
t.ok('삭제 시 프로젝트는 미분류로(삭제 아님)', /function deleteAreaSafely\(area\)\{[\s\S]*?p\.areaId=''/.test(html));
t.ok('탭 이름 Area', /<span class="tab-label">Area<\/span>/.test(html));

t.done();
