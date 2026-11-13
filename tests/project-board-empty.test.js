'use strict';
/* 프로젝트 자료 보드 빈 상태('자료 허브') — 칸반 보기에서 보드 밖으로 빠져 위 '할일 타임라인'
   위에 겹쳐 뜨던 문제. .pjb-empty는 position:absolute로 가운데 놓이는데, 칸반 칸(.pjb-kanban-wrap)에
   기준(position:relative)이 없어 더 바깥 조상 기준으로 놓였다. 자유(.pjb-view)는 relative,
   정리(.pjb-grid)는 static 덮어쓰기라 괜찮았다. 세 보기 모두 빈 상태를 자기 칸 안에 둔다. */
const { readIndex, runner } = require('./lib');
const html = readIndex();
const t = runner('프로젝트 자료 보드 빈 상태');

const rule = (sel) => {
  const re = new RegExp('(?:^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}', 'g');
  const out = []; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join(';');
};

t.ok('빈 상태는 칸 기준 가운데(absolute)', /position:absolute;left:50%;top:50%;transform:translate\(-50%,-50%\)/.test(rule('.pjb-empty')));
t.ok('칸반 칸에 기준 있음(position:relative)', /position:relative/.test(rule('.pjb-kanban-wrap')));
t.ok('자유 보기 칸에 기준 있음', /position:relative/.test(rule('.pjb-view')));
t.ok('정리 보기는 흐름 안에 둠(static)', /position:static/.test(rule('.pjb-grid .pjb-empty')));
t.ok('세 보기 모두 같은 빈 상태 사용', /\(kan\|\|PJB_EMPTY_HTML\)/.test(html) && /kanEl\.innerHTML=pjbKanbanHtml\(b\)\|\|PJB_EMPTY_HTML/.test(html));
t.ok('제목 색은 있는 토큰(--fg)', /\.pjb-empty-title\{[^}]*color:var\(--fg\)\}/.test(html));

t.done();
