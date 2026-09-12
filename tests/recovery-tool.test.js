'use strict';
/* 데이터 복구 도구: quota-overflow 역전파로 사라진 할일·반복을 아직 남아있는 소스에서
   되살린다. returnRecoveryScan()은 소스별(메모리·IDB overflow·아카이브·클라우드) 잔존량을
   읽기 전용으로 보고하고, returnRecoveryRestore(src)는 '없는 항목만' 병합 복원한다(삭제 없음,
   dryRun 미리보기 지원). 콘솔에서 사용자가 명시적으로 실행. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('데이터 복구 도구');

t.ok('returnRecoveryScan 정의+노출', /async function returnRecoveryScan\(opts\)\{/.test(html) && /window\.returnRecoveryScan=returnRecoveryScan;/.test(html));
t.ok('returnRecoveryRestore 정의+노출', /async function returnRecoveryRestore\(source, opts\)\{/.test(html) && /window\.returnRecoveryRestore=returnRecoveryRestore;/.test(html));

// 소스 4종
t.ok('소스: memory', /if\(source==='memory'\) return \{ tasks:/.test(html));
t.ok('소스: idbOverflow(_idbCache)', /if\(source==='idbOverflow'\|\|source==='idb'\) return \{ tasks:_recoveryParseArr\(typeof _idbCache/.test(html));
t.ok('소스: archive(_archiveListKeys/_archiveRead)', /if\(source==='archive'\)\{[\s\S]*?_archiveListKeys[\s\S]*?_archiveRead/.test(html));
t.ok('소스: cloud(fbReadSplitData)', /if\(source==='cloud'\)\{[\s\S]*?fbReadSplitData\(ref\)/.test(html));

// 스캔: 카테고리별 집계 + 가장 완전한 소스 판정
t.ok('카테고리별 집계', /function _recoveryByCat\(arr\)\{ var m=\{\}; arr\.forEach/.test(html));
t.ok('가장 많은 소스 판정', /out\.richestSource=best;/.test(html));

// 복원: 없는 항목만 병합(삭제 없음) + dryRun
t.ok('현재에 없는 할일만 추가', /var addTasks=\(src\.tasks\|\|\[\]\)\.filter\(function\(t\)\{ return t&&t\.id!=null&&!curIds\[String\(t\.id\)\]; \}\)/.test(html));
t.ok('현재에 없는 반복규칙만 추가', /var addReps=\(src\.repeats\|\|\[\]\)\.filter\(function\(r\)\{ return r&&r\.id!=null&&!curReps\[String\(r\.id\)\]; \}\)/.test(html));
t.ok('dryRun 미리보기(변경 없음)', /if\(opts\.dryRun\)\{[\s\S]*?wouldAddTasks:addTasks\.length[\s\S]*?dryRun:true \}/.test(html));
t.ok('복원 후 저장(삭제 아님, push는 안내)', /addTasks\.forEach\(function\(t\)\{ tasks\.push\(t\); \}\);[\s\S]*?saveTaskData\(\)/.test(html));
t.ok('force-push는 사용자 안내', /설정 → 동기화 → ⬆ 지금 올리기/.test(html));

t.done();
