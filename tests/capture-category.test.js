'use strict';
/* 빠르게 담기 카테고리 — 폰 빠르게 담기 시트도 PC 상단 빠른 추가처럼 담기 전에 카테고리를
   고를 수 있게(인박스 = 인박스 보드 칸, 할일 = 할일 카테고리). 두 입력이 같은 선택 상태
   (homeCaptureInboxCat / homeCaptureTaskCat)와 같은 칩(captureCatChipsHtml)을 쓰고,
   담을 곳 이름은 어디서나 '인박스 · 할일 · 작업 로그'로 통일. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('빠르게 담기 카테고리 · 이름 통일');

const ctx = {
  window: {}, String, Array, Object, Number, Date, JSON,
  CATS: [{ id: 'work', label: '작업', emoji: '💻' }, { id: 'health', label: '건강', emoji: '💪' }, { id: 'etc', label: '기타', emoji: '📌' }],
  INBOX_CATS: [], projects: [{ id: 1 }], loadProjects() {},
};
ctx.window.ib2Cats = () => [{ id: 'p:1', label: '논문', emoji: '📁' }, { id: '_uncat', label: '미분류' }];
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'var homeCaptureInboxCat = null;', '/* 상단 빠른 추가의 카테고리 줄'), ctx);

t.ok('자동이 기본(아무것도 안 고름)', ctx.captureSelectedCat('task') === null && ctx.captureSelectedCat('inbox') === null);
ctx.captureSetCat('task', 'health');
ctx.captureSetCat('inbox', 'p:1');
t.ok('할일·인박스 카테고리를 따로 기억', ctx.captureSelectedCat('task') === 'health' && ctx.captureSelectedCat('inbox') === 'p:1');
t.ok('작업 로그엔 카테고리 없음', ctx.captureCatChipsHtml('log', 'x') === '' && ctx.captureSelectedCat('log') === null);
{
  const h = ctx.captureCatChipsHtml('task', 'm-cap-cat');
  t.ok('할일 칩 = 자동 + 할일 카테고리, 고른 것만 켜짐',
    (h.match(/data-capcat=/g) || []).length === 4 && /class="m-cap-cat active on"[^>]*data-capcat="health"/.test(h) && /aria-checked="false" data-capcat=""/.test(h));
  const hi = ctx.captureCatChipsHtml('inbox', 'capture-cat');
  t.ok('인박스 칩 = 자동 + 인박스 보드 칸(프로젝트·미분류)', /data-capcat="p:1"/.test(hi) && /data-capcat="_uncat"/.test(hi) && /class="capture-cat active on"[^>]*data-capcat="p:1"/.test(hi));
}
ctx.captureSetCat('task', '');
t.ok('자동을 누르면 다시 자동', ctx.captureSelectedCat('task') === null);
ctx.captureSetCat('task', 'gone');
t.ok('지워진 카테고리를 골라 둔 상태면 자동으로 취급', ctx.captureSelectedCat('task') === null);
t.ok('라벨 찾기', ctx.captureCatLabel('task', 'work') === '작업' && ctx.captureCatLabel('inbox', '_uncat') === '미분류');
ctx.CATS.push({ id: '<b>', label: '<x>' });
t.ok('칩 글자는 이스케이프', !/<x>/.test(ctx.captureCatChipsHtml('task', 'c')) && /&lt;x&gt;/.test(ctx.captureCatChipsHtml('task', 'c')));
ctx.CATS.pop();

/* 할일 담기(로컬 파서 경로): 고른 카테고리로 저장 */
{
  const c2 = {
    window: {}, String, Array, Object, Number, Date, JSON, TK: '2026-11-04',
    CATS: ctx.CATS, INBOX_CATS: [], projects: [], loadProjects() {},
    tasks: [], toasts: [], learned: [],
    captureHasImgs: () => false, captureTakeImgs: () => [], getCatDefaultPriority: () => '',
    captureParseNL: (x) => ({ text: x }), _captureDefaultDate: () => '2026-11-04',
    saveTaskData() {}, renderHomeTasks() {},
    homeToast(m) { c2.toasts.push(m); },
    _captureCatMemoryGuess: () => 'work',
    _captureCatMemoryLearn(tx, id) { c2.learned.push(id); },
  };
  vm.createContext(c2);
  vm.runInContext(sliceBlock(html, 'var homeCaptureInboxCat = null;', '/* 상단 빠른 추가의 카테고리 줄'), c2);
  vm.runInContext(sliceBlock(html, 'function homeCapture(raw){', '\n/* Global quick-add'), c2);
  vm.runInContext('homeCaptureType="task";', c2);
  c2.homeCapture('운동 가기');
  t.ok('자동이면 고쳐 준 기억으로 추측', c2.tasks[0].catId === 'work' && c2.learned.length === 0);
  c2.captureSetCat('task', 'health');
  c2.homeCapture('병원');
  t.ok('고른 카테고리로 담고 기억에도 반영', c2.tasks[0].catId === 'health' && c2.learned[0] === 'health');
  t.ok('알림에 카테고리 표시', c2.toasts[1] === '할일 · 건강에 담았어요', c2.toasts.join('|'));
  c2._captureCatMemoryGuess = () => 'deleted_cat';
  c2.captureSetCat('task', null);
  c2.homeCapture('기타 일');
  t.ok('기억이 지운 카테고리를 가리키면 기타', c2.tasks[0].catId === 'etc');
}

/* 배선 */
t.ok('AI 미리보기도 골라 둔 카테고리가 우선', /var pickedCat = captureSelectedCat\('task'\);\s*if\(pickedCat && pickedCat!==parsed\.catId\)\{[^}]*parsed\.catId = pickedCat; \}/.test(html));
t.ok('폰 시트에 카테고리 줄', /<div id="m-cap-cats" class="m-cap-cats" role="radiogroup" aria-label="카테고리" hidden><\/div>/.test(html)
  && /function mCapRenderCats\(\)\{[\s\S]*?captureCatChipsHtml\(_mCapType,'m-cap-cat'\)[\s\S]*?captureSetCat\(_mCapType, b\.getAttribute\('data-capcat'\)\)/.test(html)
  && /mCapRenderCats\(\);\s*mCapPreview\(\);\s*\}/.test(html));
t.ok('PC 줄은 인박스·할일 모드 모두', /var type = \(homeCaptureType==='task'\) \? 'task' : 'inbox';\s*row\.innerHTML = '<span class="capture-cats-lbl">카테고리<\/span>' \+ captureCatChipsHtml\(type, 'capture-cat'\);/.test(html)
  && /\.capture-bar\.cap-task \.capture-inner:focus-within ~ \.capture-drop \.capture-cats \{ display:flex; \}/.test(html)
  && /bar\.classList\.toggle\('cap-task', homeCaptureType === 'task'\)/.test(html));
t.ok('카테고리 줄과 인식 미리보기가 한 패널(겹치지 않음)', /<div class="capture-drop">\s*<div class="capture-cats"[^>]*><\/div>\s*<div class="capture-preview"/.test(html));
t.ok('PC 이름: 인박스 · 할일 · 작업 로그', /id="capture-inbox-btn"[^>]*>인박스<\/button>\s*<button[^>]*id="capture-task-btn"[^>]*>할일<\/button>\s*<button[^>]*id="capture-log-btn"[^>]*>작업 로그<\/button>/.test(html)
  && !/>Inbox<\/button>|>Task<\/button>|>Log<\/button>/.test(html));
t.ok('폰 이름: 인박스 · 할일 · 작업 로그(같은 순서)', /data-mtype="inbox"[^>]*>인박스<\/button>\s*<button[^>]*data-mtype="task"[^>]*>할일<\/button>\s*<button[^>]*data-mtype="log"[^>]*>작업 로그<\/button>/.test(html));
t.ok('칩 터치 영역 44px', /#m-cap-sheet \.m-cap-cat::after\{[^}]*height:var\(--tap\)/.test(html) && /@media \(pointer:coarse\)\{ \.capture-cat\{[^}]*\} \.capture-cat::after\{[^}]*height:var\(--tap\)/.test(html));

t.done();
