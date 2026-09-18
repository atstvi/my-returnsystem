'use strict';
/* 나탭 타임블록 '집중 기록' 열 — 기본은 숨김(할일 전체 폭), 헤더 '집중' 토글로 켜고 끈다.
   상태는 home_timeblock_prefs_v1.showFocus에 저장(getHomeTimeBlockPrefs가 라운드트립). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('타임블록 집중 기록 열 토글');

// ── 헬퍼 로직(순수) ──
const block = sliceBlock(html, 'function getHomeTimeBlockPrefs(){', 'function setHtbFocusColOn(on){ var p=getHomeTimeBlockPrefs(); p.showFocus=!!on; saveHomeTimeBlockPrefs(p); }') +
  'function setHtbFocusColOn(on){ var p=getHomeTimeBlockPrefs(); p.showFocus=!!on; saveHomeTimeBlockPrefs(p); }';
var storeVal='{}';
const ctx = { localStorage:{ getItem(){ return storeVal; }, setItem(){} },
  setReturnStorageItem(k,v){ storeVal=v; return true; }, JSON, parseInt, Math };
vm.createContext(ctx); vm.runInContext(block, ctx);
const { htbFocusColOn, setHtbFocusColOn } = ctx;

t.ok('기본은 숨김(showFocus=false)', htbFocusColOn() === false);
setHtbFocusColOn(true);
t.ok('켜면 showFocus=true 저장', htbFocusColOn() === true && /"showFocus":true/.test(storeVal));
t.ok('start/end/slotH도 함께 유지', /"start":/.test(storeVal) && /"slotH":/.test(storeVal));
setHtbFocusColOn(false);
t.ok('끄면 showFocus=false', htbFocusColOn() === false);

// ── 소스 배선 ──
t.ok('htbFocusColOn/setHtbFocusColOn 정의', /function htbFocusColOn\(\)\{ return !!getHomeTimeBlockPrefs\(\)\.showFocus; \}/.test(html) && /function setHtbFocusColOn\(on\)\{/.test(html));
t.ok('_htbSplit이 토글값을 읽음(기본 하드코딩 true 제거)', /var _htbSplit = htbFocusColOn\(\);/.test(html) && !/var _htbSplit = true;/.test(html));
t.ok('헤더에 집중 토글 버튼', /id="htb-focus-toggle"/.test(html));
t.ok('토글 클릭 → 저장 + 재렌더', /getElementById\('htb-focus-toggle'\)\.addEventListener\('click',function\(\)\{ setHtbFocusColOn\(!htbFocusColOn\(\)\); if\(typeof renderHomeTimeBlocks==='function'\)renderHomeTimeBlocks\(\);/.test(html));
t.ok('꺼지면 레인 헤더 숨김 + 버튼 상태', /_laneHead\)_laneHead\.style\.display=_htbSplit\?'':'none';[\s\S]*?_fTgl\.classList\.toggle\('on',_htbSplit\);/.test(html));
t.ok('토글 on 스타일 CSS', /#htb-focus-toggle\.on \{ color:var\(--accent\)/.test(html));

t.done();
