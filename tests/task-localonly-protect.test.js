'use strict';
/* 미동기화(로컬 전용) 할일 보호 — 스테일 클라우드 블롭 apply의 세션-나이 게이트가
   아직 클라우드로 안 올라간 '사용자가 만든 할일'을 통째로 버리던 문제(특히 프로젝트
   할일이 갑자기 사라짐)를 막는다. 마감·특별·반복원본뿐 아니라 프로젝트·목표·평범한
   사용자 할일도 보호하고, 생성된 반복/규칙/시간표 occurrence는 게이트에 맡긴다.
   done 항목은 아카이브 대상이라 제외. 실제 삭제는 tombstone이 걸러내므로 안전. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('로컬 전용 할일 보호');

const block = sliceBlock(html, 'function returnTaskIsProtectedLocalOnly(t){', 'window.returnTaskIsProtectedLocalOnly=');
const ctx = { String: String };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const f = ctx.returnTaskIsProtectedLocalOnly;

t.ok('프로젝트 할일 보호(catId=project)', f({id:1,catId:'project',done:false})===true);
t.ok('프로젝트 할일 보호(projectId)', f({id:2,projectId:'p1',done:false})===true);
t.ok('목표 할일 보호', f({id:3,goalId:'g1',done:false})===true);
t.ok('평범한 사용자 할일 보호', f({id:4,catId:'etc',text:'장보기',done:false})===true);
t.ok('마감 할일 보호(기존)', f({id:5,deadlineDate:'2026-12-01',done:false})===true);
t.ok('특별 할일 보호(기존)', f({id:6,isSpecial:true,done:false})===true);
t.ok('완료 항목은 보호 안 함(아카이브 대상)', f({id:7,catId:'project',done:true})===false);
t.ok('생성된 반복 occurrence는 보호 안 함(재생성)', f({id:8,_repeatId:'ri_other',done:false})===false);
t.ok('생성된 규칙 occurrence는 보호 안 함', f({id:9,_ruleGen:true,activeRuleId:'r1',done:false})===false);
t.ok('시간표 생성 항목은 보호 안 함', f({id:10,_isTt:true,done:false})===false);
t.ok('반복 원본(ri_task_id)은 보호(기존)', f({id:11,_repeatId:'ri_task_11',done:false})===true);

// 소스 배선: 유니온-머지 세션-나이 게이트가 이 보호를 사용
t.ok('union-merge가 보호 함수를 게이트로 사용', /if\(k==='task_items_v1'&&typeof returnTaskIsProtectedLocalOnly==='function'&&returnTaskIsProtectedLocalOnly\(t\)\)return true;/.test(html));
t.ok('삭제된 항목은 tombstone 필터가 제거(되살아남 방지)', /returnEntityFilterTombstoned\(_ddArr\)/.test(html));

t.done();
