'use strict';
/* Twitter/X 작업 로그 feed — shared post renderer (projectXPostHtml).

   The product folds "기록" into project work-logs shown as an X feed, used in
   BOTH the project detail and the dashboard "전체 기록". This pins the post
   markup that makes that feed work:
   - opts.withPid stamps data-log-pid so a merged multi-project feed can resolve
     which project each post belongs to (the dashboard feed depends on it).
   - reply count surfaces in the reply action; author name + relative time show.
   - the avatar falls back to the first character of the project title.
*/
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var PJX_REPLY_SVG=', '\nfunction projectLogComposerHtml(');

function make() {
  const sb = {
    projectEsc: (v) => String(v == null ? '' : v),
    projectLogTime: () => '3분',
  };
  vm.createContext(sb);
  vm.runInContext(block + '\nthis.__post = projectXPostHtml; this.__avatar = projectXAvatar;', sb);
  return sb;
}

const t = runner('projectXPostHtml — shared X feed post');

const proj = { id: 'project_9', title: '음반 발매', color: '#BE727A' };

// ── 1. withPid stamps data-log-pid (dashboard feed can resolve project) ──────
{
  const sb = make();
  const out = sb.__post(proj, { id: 'log_1', text: '자켓 확정' }, { withPid: true });
  t.ok('withPid → data-log-pid present', out.includes('data-log-pid="project_9"'));
  t.ok('post carries data-log id', out.includes('data-log="log_1"'));
  t.ok('author name rendered', out.includes('음반 발매'));
  t.ok('relative time rendered', out.includes('· 3분'));
}

// ── 2. detail feed omits pid (resolved via active project) ───────────────────
{
  const sb = make();
  const out = sb.__post(proj, { id: 'log_2', text: 'hi' }, {});
  t.ok('no withPid → no data-log-pid', !out.includes('data-log-pid'));
}

// ── 3. reply count surfaces; threads render ─────────────────────────────────
{
  const sb = make();
  const out = sb.__post(proj, { id: 'log_3', text: 'x', replies: [{ id: 'r1', text: 'a' }, { id: 'r2', text: 'b' }] }, {});
  t.ok('reply count shows 2', /data-log-reply="log_3">.*<span>2<\/span>/s.test(out));
  t.ok('reply thread rendered', out.includes('data-reply="r1"') && out.includes('data-reply="r2"'));
  t.ok('no-title post omits pjx-title', !out.includes('pjx-title'));
}

// ── 4. avatar falls back to first char of title ─────────────────────────────
{
  const sb = make();
  t.ok('avatar = 음 (first char)', sb.__avatar(proj) === '음');
  t.ok('avatar uses icon when present', sb.__avatar({ title: 'x', icon: '🎵' }) === '🎵');
  t.ok('avatar fallback ·', sb.__avatar({}) === '·');
}

t.done();
