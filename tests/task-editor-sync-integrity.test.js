'use strict';
/* 편집창 ↔ 동기화/저장 상태 일관성.
   수정 전(Playwright 재현):
   A) 편집창이 열린 채 원격 적용(fbApplyData)이 오면 tasks가 새 객체로 통째 교체돼, 편집창
      클로저가 쥔 옛 객체(와 그 subs 배열)가 고아가 됨 → 그 뒤 체크리스트 체크가 저장 안 됨.
   B) 열려 있는 동안 같은 할일이 원격에서 바뀐 뒤 '닫기'(백드롭·ESC) → 열 때 스냅샷으로
      되돌려 원격 변경이 메모리에서 사라지고 다음 저장에 영구 반영.
   D) 동기화 없이도: 체크리스트 체크(즉시 저장) 후 닫기 → 스냅샷 되돌림이 메모리만 바꿔
      저장소와 어긋나고, 다음 저장에서 체크가 사라짐.
   계약: 재적재는 같은 id 객체(중첩 배열 포함)를 제자리 갱신. 닫기(취소)는 '저장소 값'으로
   되돌린다(=저장 안 된 편집창 변경만 취소). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('편집창 ↔ 동기화 상태 일관성');

const adoptBlock = sliceBlock(html, 'function returnAdoptValueInPlace(o, n){', '\nfunction taskParentOf(t){');
const ctx = { Array, Object, String }; vm.createContext(ctx); vm.runInContext(adoptBlock, ctx);

// 1) 같은 id 객체·중첩 배열 참조 유지 + 내용은 새 값과 동일
const X = { id: 11, text:'old', subs:[{text:'a',done:false},{text:'b',done:false}], gone:1 };
const Y = { id: 22, text:'y' };
const heldSubs = X.subs, heldSub0 = X.subs[0];
const remote = [ { id: 22, text:'y2', done:true }, { id: 11, text:'new', subs:[{text:'a',done:true},{text:'b',done:false},{text:'c',done:false}] }, { id: 33, text:'z' } ];
const out = ctx.returnAdoptTasksInPlace([X, Y], JSON.parse(JSON.stringify(remote)));
t.ok('같은 id는 기존 객체 재사용', out[1] === X && out[0] === Y);
t.ok('중첩 배열·원소 참조 유지(편집창 클로저)', X.subs === heldSubs && X.subs[0] === heldSub0);
t.ok('내용은 새 값과 동일(순서·구성 포함)', JSON.stringify(out) === JSON.stringify(remote), JSON.stringify(out));
t.ok('사라진 필드 제거', !('gone' in X));
t.ok('새 항목은 그대로 추가', out[2].id === 33);
heldSubs[1].done = true; // 편집창이 옛 참조로 체크
t.ok('옛 참조로 한 편집이 저장 대상 배열에 반영', out[1].subs[1].done === true);

// 2) 중복 id는 한 번만 재사용(두 번째는 새 객체)
const dupOut = ctx.returnAdoptTasksInPlace([X], [{ id: 11, text:'p' }, { id: 11, text:'q' }]);
t.ok('중복 id 안전', dupOut[0] === X && dupOut[1] !== X && dupOut[1].text === 'q');

// 3) 배선
t.ok('원격 적용 재적재가 제자리 갱신 사용', /tasks=returnAdoptTasksInPlace\(tasks, remoteTasks\);/.test(html));
t.ok('버전 복원·부팅 재수화도 동일', (html.match(/tasks=\(typeof returnAdoptTasksInPlace==='function'\)\?returnAdoptTasksInPlace\(tasks, rt\):rt;/g) || []).length === 2);
const closeFn = sliceBlock(html, 'function tasksCloseModal(){', '\nfunction closeModal(){');
t.ok('닫기(취소)는 저장소 값 기준으로 되돌림', /_persisted=\(JSON\.parse\(localStorage\.getItem\('task_items_v1'\)\|\|'\[\]'\)\|\|\[\]\)\.find\(/.test(closeFn) && /var _base=_persisted\|\|taskModalSnapshot/.test(closeFn));
t.ok('되돌림도 제자리(참조 유지)', /returnAdoptValueInPlace\(_live,_base\)/.test(closeFn));
t.ok('열 때 스냅샷을 그대로 덮어쓰지 않음', !/tasks\[idx\]=taskModalSnapshot;/.test(closeFn));
t.done();
