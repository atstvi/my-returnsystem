'use strict';
/* 나 탭 타임블록이 '06:00 한 칸 + 시간 계획 없음'으로 텅 비던 버그.
   원인: 범위 설정에서 끝 시각에 자정 넘긴 시각(예: 1시)을 넣으면 '시작+1시간'으로 잘려 저장 →
   타임블록이 한 시간만 그리고 그 밖의 할일은 전부 안 보임.
   계약: (1) 3시간 미만 범위는 자정까지로 복구 (2) 끝<=시작 입력은 자정까지 (3) 오늘 할일이
   범위 밖이면 보이는 범위를 넓힘(설정은 그대로) (4) 지금 위치 스크롤도 넓힌 범위 기준. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('나 탭 타임블록 범위 — 할일이 안 보이던 버그');

const block = sliceBlock(html, 'function getHomeTimeBlockPrefs(){', '\nfunction saveHomeTimeBlockPrefs(pref){');
function prefs(stored){
  const ls = { home_timeblock_prefs_v1: stored == null ? null : JSON.stringify(stored) };
  const ctx = { Math, JSON, Object, parseInt, localStorage: { getItem: k => ls[k] == null ? null : ls[k] } };
  vm.createContext(ctx); vm.runInContext(block, ctx); return ctx.getHomeTimeBlockPrefs();
}
t.ok('기본 0~24', JSON.stringify([prefs(null).start, prefs(null).end]) === '[0,24]');
t.ok('잘려 저장된 6~7시 → 6~24시로 복구', prefs({ start:6, end:7 }).end === 24);
t.ok('6~8시(2시간)도 복구', prefs({ start:6, end:8 }).end === 24);
t.ok('정상 범위(6~22시)는 그대로', prefs({ start:6, end:22 }).end === 22);
t.ok('끝 25(자정 넘김)는 24로', prefs({ start:6, end:25 }).end === 24);

t.ok('범위 창: 끝<=시작이면 자정까지(시작+1시간으로 자르지 않음)', /if\(next\.end<=next\.start\|\|next\.end>24\)\{ next\.end=24;/.test(html) && !/if\(next\.end<=next\.start\)next\.end=next\.start\+1;/.test(html));
t.ok('오늘 시간 할일·수업이 범위 밖이면 보이는 범위 확장', /homeTodayTasks\(true\)\.forEach\(_consider\);/.test(html) && /if\(_lo!=null&&Math\.floor\(_lo\/60\)<START\)START=Math\.floor\(_lo\/60\);/.test(html) && /window\._htbRange=\{start:START,end:END,slotH:SLOT_H\};/.test(html));
t.ok('지금 위치 스크롤도 넓힌 범위 기준', /var pref=window\._htbRange\|\|getHomeTimeBlockPrefs\(\);/.test(html));
t.done();
