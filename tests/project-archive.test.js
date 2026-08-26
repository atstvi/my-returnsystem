'use strict';
/* 프로젝트 보관 파일(단독 HTML) 생성·복원 고정.
   - projectBuildArchiveHtml(bundle): 사람이 볼 수 있는 스냅샷 + 되살리기용 JSON 임베드.
   - projectParseArchive(text): 그 JSON을 다시 뽑아 번들 복원(라운드트립). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function _pjaEsc(v){', '\nfunction projectImportFromFile(');

const sb = { window: {}, console: { warn() {} }, JSON, Date, String, Number, Array, Object, Math, isNaN, Promise, RegExp };
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('프로젝트 보관 · 파일 생성/복원');

const bundle = {
  v: 1, type: 'return-project-archive', exportedAt: '2026-08-25T00:00:00Z',
  project: {
    id: 'p1', title: '테스트 프로젝트', icon: '🚀', stage: 'completed',
    goals: [{ id: 'g1', title: '목표A', dateRanges: [{ start: '2026-01-01', end: '2026-02-01' }] }],
    logs: [{ title: '로그1', text: '첫 줄\n둘째 줄', createdAt: 1735689600000, replies: [{ text: '답글' }] }],
    board: { items: [
      { type: 'link', url: 'https://example.com/ref', title: '참고 링크' },
      { type: 'note', text: '메모 내용 · 위험 </script> 삽입' },
      { type: 'image', src: 'data:image/png;base64,AAAA' },
    ] },
  },
  tasks: [
    { id: 't1', text: '할일 하나', goalId: 'g1', done: true, date: '2026-01-05', url: 'https://buy.example/x' },
    { id: 't2', text: '할일 둘', done: false, deadlineDate: '2026-01-20' },
  ],
};

const out = sb.projectBuildArchiveHtml(bundle);

// ── 스냅샷(사람이 보는 뷰) ────────────────────────────────────────────────────
{
  t.ok('제목 노출', out.indexOf('테스트 프로젝트') >= 0);
  t.ok('목표 노출', out.indexOf('목표A') >= 0);
  t.ok('목표 소속 할일', out.indexOf('할일 하나') >= 0);
  t.ok('작업 로그', out.indexOf('로그1') >= 0 && out.indexOf('답글') >= 0);
  t.ok('보드 링크 클릭 가능', /href="https:\/\/example\.com\/ref"/.test(out));
  t.ok('보드 메모', out.indexOf('메모 내용') >= 0);
  t.ok('보드 이미지 임베드(data URL)', out.indexOf('data:image/png;base64,AAAA') >= 0);
  t.ok('할일 링크 접근', /href="https:\/\/buy\.example\/x"/.test(out));
  t.ok('되살리기 안내 문구', out.indexOf('불러오기') >= 0);
  t.ok('임베드 데이터 스크립트', /id="return-archive-data"/.test(out));
  t.ok('임베드 JSON의 </script> 이스케이프', out.indexOf('<\\/script>') >= 0);
}

// ── 라운드트립 복원 ──────────────────────────────────────────────────────────
{
  const back = sb.projectParseArchive(out);
  t.ok('복원 성공', !!back && back.type === 'return-project-archive');
  t.ok('프로젝트 id', back.project.id === 'p1');
  t.ok('프로젝트 제목', back.project.title === '테스트 프로젝트');
  t.ok('목표 보존', back.project.goals[0].title === '목표A');
  t.ok('보드 항목 3', back.project.board.items.length === 3);
  t.ok('할일 2개', back.tasks.length === 2 && back.tasks[0].id === 't1');
  t.ok('할일 링크 보존', back.tasks[0].url === 'https://buy.example/x');
}

// ── 방어: 보관 파일이 아니면 null ────────────────────────────────────────────
{
  t.ok('일반 HTML → null', sb.projectParseArchive('<html><body>hi</body></html>') === null);
  t.ok('빈 문자열 → null', sb.projectParseArchive('') === null);
  t.ok('잘못된 JSON → null', sb.projectParseArchive('<script id="return-archive-data" type="application/json">{bad</script>') === null);
}

t.done();
