'use strict';
/* 바탕 눌러 닫힘 방지 — 글자를 치지 않고 바꾼 것도 '작성 중'으로.
   위시 편집처럼 사진 추가·붙여넣기·삭제, 별점 누르기, 칸 추가처럼 input 이벤트가 없는 변경은 예전 가드가
   못 봐서 바탕을 누르면 그냥 닫혔다. 열 때마다 새로 붙는 창은 처음 손댈 때 상태를 찍어 두고 비교한다.
   - 상태 = 입력칸 값(빈 값 제외)·체크 + 사진(img) 개수. 빈 칸만 추가한 건 변경 아님.
   - 숨겨진(닫힌) 창의 기록은 버린다 → 다시 쓰는 창이 예전 열림과 비교돼 잘못 묻지 않게.
   - 열어 두고 재사용하는 창(body에 새로 붙지 않음)은 찍지 않는다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('바탕 닫힘 방지: 글자 없이 바꾼 것');

const g = sliceBlock(html, '(function rdsBackdropGuard(){', '\n})();');
const part = sliceBlock(g, '  function formState(root){', '  if(typeof MutationObserver===');

/* 아주 작은 가짜 DOM */
function el(tag, props) { return Object.assign({ tagName: tag.toUpperCase(), nodeType: 1, type: '', value: '', checked: false, children: [] }, props || {}); }
function root(kids, extra) {
  const r = el('div', Object.assign({ isConnected: true, _rdsBorn: true, children: kids, parentElement: null }, extra || {}));
  r.querySelectorAll = (sel) => sel === 'img' ? r.children.filter((k) => k.tagName === 'IMG') : r.children.filter((k) => /^(INPUT|TEXTAREA|SELECT)$/.test(k.tagName));
  r.querySelector = () => r.children.find((k) => k.tagName === 'INPUT' || k.tagName === 'TEXTAREA') || null;
  r.getBoundingClientRect = () => ({ width: r._hidden ? 0 : 400, height: r._hidden ? 0 : 600 });
  return r;
}
const body = { nodeType: 1 };
const ctx = { document: { body }, getComputedStyle: (x) => ({ display: x._hidden ? 'none' : 'block', visibility: 'visible', pointerEvents: 'auto', opacity: '1' }), parseFloat, String };
vm.createContext(ctx);
vm.runInContext(part + '\nthis.formState=formState; this.snapOn=snapOn; this.changedIn=changedIn;', ctx);
const attach = (r) => { r.parentElement = body; r.children.forEach((k) => { k.parentElement = r; }); return r; };

{
  const title = el('input', { type: 'text', value: '헤드폰' });
  const rate = el('input', { type: 'number', value: '' });
  const r = attach(root([title, rate, el('input', { type: 'file' })]));
  ctx.snapOn({ target: title });
  t.ok('손대기 전과 같으면 변경 아님', ctx.changedIn(r) === null);
  rate.value = '4';
  t.ok('별점처럼 코드가 채운 값도 변경', ctx.changedIn(r) === title);
  rate.value = '';
  r.children.push(el('img'));
  t.ok('사진 추가(img 개수) = 변경', ctx.changedIn(r) !== null);
  r.children.pop();
  r.children.push(el('input', { type: 'text', value: '' }));
  t.ok('빈 칸만 추가 = 변경 아님', ctx.changedIn(r) === null);
}
{
  const img = el('img'); const r = attach(root([el('input', { type: 'text', value: 'a' }), img]));
  ctx.snapOn({ target: img });
  r.children = r.children.filter((k) => k !== img);
  t.ok('사진 삭제 = 변경', ctx.changedIn(r) !== null);
}
{
  const cb = el('input', { type: 'checkbox', checked: false }); const r = attach(root([cb]));
  ctx.snapOn({ target: cb }); cb.checked = true;
  t.ok('체크 바꿈 = 변경', ctx.changedIn(r) !== null);
}
{
  const inp = el('input', { type: 'text', value: '첫 번째' }); const r = attach(root([inp], { _rdsBorn: false }));
  ctx.snapOn({ target: inp }); inp.value = '다른 값';
  t.ok('새로 붙지 않은(재사용) 창은 찍지 않음', ctx.changedIn(r) === null);
}
{
  const inp = el('input', { type: 'text', value: '첫 열림' }); const r = attach(root([inp]));
  ctx.snapOn({ target: inp });
  r._hidden = true; const other = attach(root([el('input')])); ctx.snapOn({ target: other }); /* 다른 곳을 누름 → 숨은 창 기록 정리 */
  r._hidden = false; inp.value = '두 번째 열림 내용';
  t.ok('닫혔다 다시 열린 창은 예전 기록과 비교 안 함', ctx.changedIn(r) === null);
  ctx.snapOn({ target: inp }); inp.value = '두 번째 열림 수정';
  t.ok('다시 열린 뒤 처음 손댄 상태부터 비교', ctx.changedIn(r) !== null);
}

/* 배선 */
t.ok('새로 붙는 창 표시(MutationObserver · body 바로 아래)', /_rdsMo\.observe\(document\.body,\{childList:true\}\)/.test(g) && /n\._rdsBorn=true/.test(g));
t.ok('처음 손댈 때 찍음(누름·키·끌어다 놓기·붙여넣기, 캡처 단계)', /\['pointerdown','keydown','dragenter','paste'\]\.forEach\(function\(t\)\{ window\.addEventListener\(t,snapOn,true\); \}\);/.test(g));
t.ok('바탕 판정에 글자 입력 + 바뀐 상태 둘 다', /\|\|changedIn\(topOf\(bd\)\)\|\|/.test(g));
t.ok('닫기를 고르면 기록 비움', /var tr=topOf\(bd\); if\(tr\)tr\._rdsSnap=null;/.test(g));
t.done();
