'use strict';
/* 할일 삭제/저장/기기간 동기화 안정성 — Stage 6d 보강.
   배경: tasks는 생성(reconcile) churn 때문에 자동 tombstone에서 빠져 있어, '진짜
   사용자 삭제'가 tombstone으로 안 남았다. 그 결과 (1) union-merge가 클라우드 블롭에
   남은 삭제분을 되살리고, (2) 미동기화된 오래 사는 항목(생일·기념일·마감)은 세션-나이
   게이트로 유실됐다. 이 테스트는:
   - user 삭제 choke point(noteGeneratedTaskDeleted)와 나머지 삭제 지점이 tombstone을 남김
   - 보호 예외(returnTaskIsProtectedLocalOnly) 로직
   - union-merge 게이트 예외 + _eid 백필 배선
   - heal이 tombstone(삭제)보다 우선하지 않도록 가드
   를 회귀로 고정한다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('할일 삭제 tombstone / 보호 예외');

// ── returnTaskIsProtectedLocalOnly 로직(순수) ──
const block = sliceBlock(
  html,
  'function returnTaskIsProtectedLocalOnly(t){',
  'window.returnTaskIsProtectedLocalOnly=returnTaskIsProtectedLocalOnly;'
);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block, ctx);
const prot = ctx.returnTaskIsProtectedLocalOnly;

t.ok('마감(deadlineDate) 있는 미완료 → 보호', prot({ id: 1, deadlineDate: '2026-12-01' }) === true);
t.ok('특별(isSpecial) → 보호', prot({ id: 2, isSpecial: true }) === true);
t.ok('반복 원본(ri_task_+id) → 보호', prot({ id: 3, _repeatId: 'ri_task_3' }) === true);
t.ok('반복 생성본(다른 규칙 id) → 보호 아님', prot({ id: 9.5, _repeatId: 'ri_task_3', occurrenceDate: '2027-01-01' }) === false);
t.ok('완료(done)된 항목 → 보호 아님(아카이브 대상)', prot({ id: 4, deadlineDate: '2026-12-01', done: true }) === false);
t.ok('평범한 미완료 할일 → 보호 아님(기존 세션-나이 게이트 유지)', prot({ id: 5, text: '메모' }) === false);
t.ok('null 방어', prot(null) === false);

// ── 소스 배선 ──
// user 삭제 중앙 훅이 tombstone 마킹
t.ok('noteGeneratedTaskDeleted가 tombstone 마킹',
  /if\(typeof returnTombstoneMark==='function'\)\{[\s\S]{0,160}returnTombstoneMark\(_eid,'tasks'\)/.test(html));
t.ok('_eid는 결정적 t_+id 폴백',
  /task\._eid\|\|\(task\.id!=null&&String\(task\.id\)!==''\?\('t_'\+String\(task\.id\)\):''\)/.test(html));

// 반복 시리즈 삭제도 tombstone
t.ok('deleteHomeRepeat가 지운 항목 tombstone',
  /_rmRep\.forEach\(function\(t\)\{ if\(typeof returnTombstoneMark==='function'\)\{ try\{ returnTombstoneMark\(t\._eid\|\|\('t_'\+String\(t\.id\)\),'tasks'\)/.test(html));
// 프로젝트 캐스케이드 삭제도 tombstone
t.ok('프로젝트 삭제 캐스케이드 tombstone',
  /프로젝트 삭제로 함께 지워지는 할일도 tombstone/.test(html));
// 완료 일괄 삭제도 tombstone
t.ok('clearDone가 지운 완료 항목 tombstone',
  /removed\.forEach\(function\(t\)\{ try\{ returnTombstoneMark\(t\._eid\|\|\('t_'\+String\(t\.id\)\),'tasks'\)/.test(html));

// union-merge 게이트 예외 + 백필
t.ok('게이트: 보호 항목은 세션-나이와 무관하게 보존',
  /if\(k==='task_items_v1'&&typeof returnTaskIsProtectedLocalOnly==='function'&&returnTaskIsProtectedLocalOnly\(t\)\)return true;/.test(html));
t.ok('merge 전 tasks _eid 결정적 백필',
  /if\(k==='task_items_v1'&&typeof returnEntityBackfillIds==='function'\)\{ try\{ returnEntityBackfillIds\(_ddArr,'t_'\);/.test(html));

// heal이 tombstone(삭제)보다 우선하지 않게
t.ok('heal 전 원본 tombstone 확인',
  /var _srcTomb=\(typeof returnTombstoneIsActive==='function'\)&&returnTombstoneIsActive\(t\._eid\|\|\('t_'\+String\(t\.id\)\),t\.updatedAt\);/.test(html));
t.ok('삭제가 최신이면 heal 안 함',
  /if\(repeatTaskIsHealableSource\(t\)&&!_srcTomb\)\{/.test(html));

// 반복 원본 삭제 시 규칙도 제거(생성본 재생성으로 '되살아남' 방지)
t.ok('원본 삭제 시 규칙 제거 배선',
  /if\(task\._repeatId && String\(task\._repeatId\)==='ri_task_'\+String\(task\.id\) && typeof loadRepeatItems==='function'\)\{/.test(html));
t.ok('규칙 제거는 setReturnStorageItem 직접(재진입 회피)',
  /setReturnStorageItem\('repeat_items_v1', JSON\.stringify\(_next\)\);/.test(html));

// 진단 수단
t.ok('returnTaskSyncReport 진단 노출',
  /window\.returnTaskSyncReport=returnTaskSyncReport;/.test(html));

t.done();
