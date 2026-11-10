'use strict';
/* 이미 있는 할일을 프로젝트에 담기 — 할일 메뉴 '프로젝트로…'와 프로젝트 화면 '기존 할일 담기'가
   같은 taskSetProject를 쓴다. 예전 프로젝트 화면 연결 버튼은 리디자인 때 빠졌고(코드만 남음),
   그 코드는 projectId만 바꾸고 updatedAt을 안 올려 다른 기기 동기화에서 묻힐 수 있었다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('기존 할일 → 프로젝트에 담기');

const saved = [];
const ctx = {
  Date, String, Array, Object,
  projects: [{ id: 'p1', title: '논문' }, { id: 'p2', title: '이사', status: 'archived' }, { id: 'p3', title: '운동', goals: [{ id: 'g3' }] }],
  saveTaskData() { saved.push(1); },
  findGoal(id) { return id === 'g3' ? { goal: { id: 'g3' }, project: ctx.projects[2] } : (id === 'g1' ? { goal: { id: 'g1' }, project: ctx.projects[0] } : null); },
};
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, '/* 할일을 프로젝트에 담기/빼기', 'function taskActionMenu(task, at){'), ctx);

t.ok('고를 수 있는 프로젝트: 보관된 건 빼되, 지금 담긴 프로젝트면 보여 줌',
  ctx.taskProjectChoices('').map((p) => p.id).join() === 'p1,p3' && ctx.taskProjectChoices('p2').map((p) => p.id).join() === 'p1,p2,p3');
{
  const a = { id: 1, text: '자료 찾기', catId: 'work', updatedAt: 1 };
  t.ok('담기 → projectId + 카테고리 프로젝트 + updatedAt + 저장', ctx.taskSetProject(a, 'p1') === true && a.projectId === 'p1' && a.catId === 'project' && a._catBeforeProject === 'work' && a.updatedAt > 1 && saved.length === 1);
  t.ok('같은 프로젝트면 아무것도 안 함', ctx.taskSetProject(a, 'p1') === false && saved.length === 1);
  a.goalId = 'g1';
  ctx.taskSetProject(a, 'p3');
  t.ok('다른 프로젝트로 옮기면 원래 프로젝트의 목표는 풂', a.projectId === 'p3' && !('goalId' in a) && a._catBeforeProject === 'work');
  ctx.taskSetProject(a, '');
  t.ok('빼기 → 원래 카테고리로 되돌림', !('projectId' in a) && a.catId === 'work' && !('_catBeforeProject' in a));
}
{
  const b = { id: 2, text: 'x', catId: 'project', projectId: 'p3', goalId: 'g3' };
  ctx.taskSetProject(b, '');
  t.ok('원래 카테고리 기록이 없으면 기타로, 목표도 풂', b.catId === 'etc' && !('goalId' in b));
  const c = { id: 3, text: 'y', catId: 'etc', goalId: 'g3' };
  ctx.taskSetProject(c, 'p3');
  t.ok('같은 프로젝트의 목표는 유지', c.goalId === 'g3');
}

/* 배선 */
t.ok('할일 메뉴에 "프로젝트로…"(담겨 있으면 "프로젝트 · 이름")', /label:_tp\?\('프로젝트 · '[\s\S]{0,80}:'프로젝트로…',onClick:function\(\)\{ taskProjectPicker\(t,at\); \}/.test(html));
t.ok('프로젝트 고르기는 공용 액션 시트 + 빼기', /function taskProjectPicker\(task, at\)\{[\s\S]*?label:'프로젝트에서 빼기'[\s\S]*?rdsActionSheet\(\{title:'어느 프로젝트에 담을까요\?'/.test(html));
t.ok('프로젝트 화면: "기존 할일 담기" 버튼이 다시 보임', /id="pjt-section"><div class="project-section-head">'\+_sl\('feed','할일'\)\+'<div class="pjd-tl-acts"><button class="btn btn-ghost" id="project-link-task" type="button">기존 할일 담기<\/button>/.test(html) && /bind\('project-link-task',function\(\)\{openProjectTaskLinker\(p\);\}\)/.test(html));
t.ok('기존 할일 담기 창도 taskSetProject 사용', /openProjectTaskLinker=function\(project\)\{[\s\S]*?taskSetProject\(task, mine\?'':project\.id\)/.test(html));

t.done();
