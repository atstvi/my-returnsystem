'use strict';
/* 활성 규칙·반복 할일 '보관(archive)' + 목록 스크롤:
   - 안 쓰는 규칙/반복을 보관하면 목록에서 '보관됨' 접이 섹션으로 치워지고(삭제 아님, 복원 가능),
     자동 생성도 멈춘다(buildExpectedGeneratedMap·applyActiveTaskRules에서 archived 제외 →
     reconcile이 기존 생성분 정리).
   - ops 모달 목록이 카드 overflow:hidden 때문에 스크롤이 안 되던 것을 modal-body를 블록
     스크롤 컨테이너로, 카드를 overflow:visible로 바꿔 스크롤되게 함. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('활성 규칙/반복 보관 + 스크롤');

// 스크롤
t.ok('ops 모달 body 블록 스크롤', /\.ops-modal \.modal-body\{padding:[^}]*display:block;min-height:0\}/.test(html));
t.ok('ops 카드 overflow 해제(스크롤 클리핑 방지)', /\.ops-modal \.home-ops-card\{[^}]*overflow:visible\}/.test(html));

// 생성 제외
t.ok('보관 반복은 생성 대상 제외', /loadRepeatItems\(\)\.forEach\(function\(rep\)\{\s*if\(!rep\|\|!rep\.id\)return;\s*if\(rep\.archived\)return;/.test(html));
t.ok('보관 규칙은 생성 대상 제외', /loadTaskRules\(\)\.forEach\(function\(rule\)\{\s*if\(!rule\|\|!rule\.id\|\|!rule\.taskText\)return;\s*if\(rule\.archived\)return;/.test(html));
t.ok('applyActiveTaskRules도 보관 규칙 건너뜀', /rules\.forEach\(function\(rule\)\{\s*if\(!rule\.taskText\)return;\s*if\(rule\.archived\)return;/.test(html));

// 보관/복원 함수
t.ok('archiveHomeRule: archived=true + 대기 정리 + reconcile', /function archiveHomeRule\(id\)\{[\s\S]*?r\.archived=true;[\s\S]*?tasks=tasks\.filter\(function\(t\)\{return t\._ruleId!==id\|\|t\.done;\}\);[\s\S]*?reconcileGeneratedTasks/.test(html));
t.ok('restoreHomeRule: archived=false + 재적용', /function restoreHomeRule\(id\)\{[\s\S]*?r\.archived=false;[\s\S]*?applyActiveTaskRules\(\)/.test(html));
t.ok('archiveHomeRepeat/restoreHomeRepeat 정의', /function archiveHomeRepeat\(id\)\{[\s\S]*?r\.archived=true;/.test(html) && /function restoreHomeRepeat\(id\)\{[\s\S]*?r\.archived=false;/.test(html));

// 목록 렌더: 활성/보관 분리 + 보관 접이 섹션
t.ok('활성/보관 분리 필터', /var rules=allRules\.filter\(function\(r\)\{return !r\.archived;\}\);[\s\S]*?var archRules=allRules\.filter\(function\(r\)\{return r\.archived;\}\);/.test(html));
t.ok('활성 행에 보관 버튼', /\{kind:'archive',fn:function\(\)\{archiveHomeRule\(rule\.id\);\}\}/.test(html) && /\{kind:'archive',fn:function\(\)\{archiveHomeRepeat\(rep\.id\);\}\}/.test(html));
t.ok('보관됨 접이(details) 섹션 + 복원', /var det=document\.createElement\('details'\); det\.className='ops-archived';[\s\S]*?보관됨[\s\S]*?\{kind:'restore',fn:function\(\)\{restoreHomeRule\(rule\.id\);\}\}/.test(html));
t.ok('행 편집 없을 땐 편집 버튼 생략(보관행)', /if\(editFn\)actions\+='<button class="icon-btn" type="button" data-act="edit"/.test(html));

t.done();
