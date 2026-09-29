'use strict';
/* 반복 규칙(repeat_items_v1) 크로스기기 union-merge.
   버그: repeat_items_v1는 동기화 컬렉션인데 union-merge 목록(task_items_v1 등)에서
   빠져 있어, 스테일 클라우드 블롭이 로컬의 최근 규칙 편집(격주 요일·주기·기간)을 통째로
   덮었다 → '격주 요일이 풀리거나(요일 유실) 생성이 안 되던' 문제.
   수정: fbApplyData(인바운드)·fbSaveAll(아웃바운드 absorb) 양쪽에 repeat_items_v1
   per-item LWW(updatedAt) union-merge 추가 + 규칙 편집 시 updatedAt 스탬프. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('반복 규칙 union-merge(격주 요일 유실 방지)');

// repeat_items_v1 union-merge 브랜치가 인바운드/아웃바운드 양쪽에 있다
var rpBranches = (html.match(/if\(k==='repeat_items_v1'\)\{/g) || []).length;
t.ok('repeat_items_v1 union-merge가 두 경로(apply+save)에 있음', rpBranches===2, rpBranches);

// 인바운드(fbApplyData): 로컬이 더 최신이면 유지 + 세션-신규 로컬 전용 보존
t.ok('fbApplyData: per-item LWW(updatedAt) 유지',
  /if\(k==='repeat_items_v1'\)\{[\s\S]*?if\(Number\(lt\.updatedAt\|\|0\)>Number\(ct\.updatedAt\|\|0\)\)\{_rpChangedA=true;return lt;\}[\s\S]*?_returnSessionLoadMs/.test(html));

// 아웃바운드(fbSaveAll absorb): 로컬 최신 유지 + baseline 이후 로컬 전용 보존
t.ok('fbSaveAll: per-item LWW(updatedAt) 유지',
  /if\(k==='repeat_items_v1'\)\{[\s\S]*?if\(Number\(lt\.updatedAt\|\|0\)>Number\(ct\.updatedAt\|\|0\)\)\{_rpChangedB=true;return lt;\}[\s\S]*?localApplyBaseline/.test(html));

// ── updatedAt 스탬프(편집 시각이 있어야 LWW가 동작) ──
t.ok('규칙 생성 시 updatedAt 스탬프',
  /var entry=\{id:returnNewId\('ri_'\)[\s\S]*?createdAt:Date\.now\(\),updatedAt:Date\.now\(\)\};/.test(html));
t.ok('규칙 편집 저장 시 updatedAt 스탬프', /r\.updatedAt=Date\.now\(\); \/\* 규칙 편집 시각/.test(html));
t.ok('syncTaskRepeatItem에서 updatedAt 스탬프', /item\.updatedAt=Date\.now\(\); \/\* 크로스기기 union-merge LWW 기준/.test(html));

// ── 병합 로직 단위 재현: 로컬(요일 편집, 최신) vs 스테일 클라우드(요일 빔, 과거) ──
function mergeInbound(cloudArr, localArr, sessionLoadMs){
  var cloudIds={}; cloudArr.forEach(function(x){if(x&&x.id!=null)cloudIds[String(x.id)]=true;});
  var localById={}; localArr.forEach(function(x){if(x&&x.id!=null)localById[String(x.id)]=x;});
  var lww=cloudArr.map(function(ct){
    if(!ct||ct.id==null)return ct;
    var lt=localById[String(ct.id)];
    if(!lt)return ct;
    if(Number(lt.updatedAt||0)>Number(ct.updatedAt||0))return lt;
    return ct;
  });
  var localOnly=localArr.filter(function(x){
    if(!x||x.id==null||cloudIds[String(x.id)])return false;
    return Number(x.createdAt||x.updatedAt||0)>sessionLoadMs;
  });
  return lww.concat(localOnly);
}
var local=[{id:'ri_bi',freq:'biweekly',weekdays:'2,4',updatedAt:2000}];
var cloud=[{id:'ri_bi',freq:'biweekly',weekdays:'',updatedAt:1000}];
var merged=mergeInbound(cloud, local, 100);
t.ok('로컬 요일 편집이 스테일 클라우드를 이김', merged[0].weekdays==='2,4', JSON.stringify(merged));

// 반대로 클라우드가 더 최신이면 클라우드 채택
var local2=[{id:'ri_bi',weekdays:'2,4',updatedAt:1000}];
var cloud2=[{id:'ri_bi',weekdays:'1',updatedAt:3000}];
t.ok('클라우드가 더 최신이면 클라우드 채택', mergeInbound(cloud2, local2, 100)[0].weekdays==='1');

// 세션에서 새로 만든 로컬 전용 규칙은 보존
var merged3=mergeInbound([], [{id:'ri_new',weekdays:'3',createdAt:5000}], 100);
t.ok('세션-신규 로컬 전용 규칙 보존', merged3.length===1 && merged3[0].id==='ri_new', JSON.stringify(merged3));

t.done();
