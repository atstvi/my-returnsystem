'use strict';
/* 폰(안드로이드)·아이패드 작업대: 앱 안 창(PC 작업대와 같은 화면) + 폰 '아일랜드' 알약 +
   알림창·잠금화면 타이머(Media Session — 아주 작은 소리를 재생하는 동안 미디어 카드). */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('폰·아이패드 작업대 · 아일랜드 · 알림창 타이머');

const handlers = {}; const store = {}; let played = 0, paused = 0;
const ms = { metadata: null, playbackState: 'none', setActionHandler(k, f) { handlers[k] = f; }, pos: null, setPositionState(p) { this.pos = p || null; } };
const ctx = {
  Math, Date, String, Array, Object, Number, JSON, ArrayBuffer, DataView, Uint8Array,
  navigator: { mediaSession: ms, userAgent: 'Mozilla/5.0 (Linux; Android 14)' },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  URL: { createObjectURL: () => 'blob:x' }, Blob: function () {}, location: { href: 'https://x.app/index.html' },
  MediaMetadata: function (o) { Object.assign(this, o); },
  Audio: function () { this.paused = true; this.play = () => { this.paused = false; played++; return Promise.resolve(); }; this.pause = () => { this.paused = true; paused++; }; this.setAttribute = () => {}; },
  setInterval: () => 1, clearInterval: () => {}, window: {},
  focusTimerState: { running: true, elapsed: 0, targetMs: 25 * 60000, mode: 'pomodoro', linkedTaskId: '2' },
  focusTimerRemainingMs: () => 12 * 60000, focusTimerElapsedMs: () => 13 * 60000, focusTimerPhaseLabel: () => '집중',
  focusTimerPause() { ctx.focusTimerState.running = false; ctx.focusTimerState.elapsed = 1; }, focusTimerResume() { ctx.focusTimerState.running = true; },
  _wsPop: {}, gone: [],
};
ctx.URL = function (p, b) { this.href = b.replace(/[^/]*$/, '') + p; }; ctx.URL.createObjectURL = () => 'blob:x';
const T = { 1: { id: 1, text: '발표' }, 2: { id: 2, text: '목차 잡기', parentId: 1 }, 3: { id: 3, text: '초안', parentId: 1 } };
ctx.focusTimerLinkedTask = () => T[ctx.focusTimerState.linkedTaskId];
ctx._wsStepPos = (x) => (x && x.parentId ? (x.id === 2 ? '1/2' : '2/2') : '');
ctx._wsNextStep = (x) => (x && x.id === 2 ? T[3] : null);
ctx._wsGoTask = (id) => { ctx.gone.push(String(id)); ctx.focusTimerState.linkedTaskId = String(id); };
vm.createContext(ctx);
vm.runInContext(sliceBlock(html, 'var _wsMedia={on:false', 'window.wsMediaToggle=wsMediaToggle;'), ctx);

ctx.wsMediaToggle(true);
t.ok('켜면 작은 소리 재생 + 미디어 카드(할일 · 단계 · 남은 시간)', played === 1 && ms.metadata.title === '목차 잡기' && ms.metadata.artist === '1/2 단계 · 집중 · 남은 12분' && ms.metadata.album === 'Return 작업대' && ms.playbackState === 'playing');
t.ok('포모도로·카운트다운은 진행 막대(길이·위치)', ms.pos && ms.pos.duration === 1500 && ms.pos.position === 780);
t.ok('버튼: 재생·일시정지·다음·중지', ['play', 'pause', 'nexttrack', 'stop'].every((k) => typeof handlers[k] === 'function'));
t.ok('켜 둔 것은 기기에 기억', store.ws_media_on === '1' && ctx._wsMediaWanted() === true);
handlers.pause();
ctx._wsMediaSync(true);
t.ok('일시정지 → 카드 일시정지 · 소리 멈춤', ms.playbackState === 'paused' && paused >= 1 && /일시정지$/.test(ms.metadata.artist));
handlers.play(); ctx._wsMediaSync(true);
t.ok('재생 → 타이머 계속 · 소리 다시', ctx.focusTimerState.running === true && ms.playbackState === 'playing');
handlers.nexttrack(); ctx._wsMediaSync(true);
t.ok('다음 곡 → 다음 하위 할일', ctx.gone[0] === '3' && ms.metadata.title === '초안');
ctx.wsMediaToggle(false);
t.ok('끄면 카드 지움 · 소리 멈춤 · 기억 해제', ms.metadata === null && ms.playbackState === 'none' && store.ws_media_on === '0' && handlers.play === null);
t.ok('안드로이드는 "알림창", 그 밖(아이패드)은 "잠금화면"', ctx._wsIsAndroid() === true);

/* 배선 */
t.ok('터치 기기(폰·아이패드)는 앱 안 창', /var touch=!!\(window\.matchMedia&&matchMedia\('\(pointer:coarse\)'\)\.matches\);\s*if\(touch\)\{ _wsOpenInApp\(t\); return; \}/.test(html));
t.ok('앱 안 창 = PC와 같은 화면(공용 _wsPopInnerHtml) + 접기', /host\.innerHTML='<div class="wsp-inapp-bar">[\s\S]{0,400}data-ws="close"[\s\S]{0,200}\+_wsPopInnerHtml\(true\);/.test(html) && /d\.body\.innerHTML=_wsPopInnerHtml\(false\);/.test(html));
t.ok('폰 아일랜드: 타이머 돌면 표시 · 누르면 작업대 · 작업대 열림/타이머 화면에선 숨김', /function wsIslandRender\(\)\{/.test(html) && /body\.wsp-inapp-open \.ws-island,\.ws-island\[hidden\]\{display:none\}/.test(html) && /isl\.hidden=\(typeof _currentPage!=='undefined'&&_currentPage==='timer'\);/.test(html));
t.ok('타이머 줄·아일랜드를 누르면 연결된 할일의 작업대(터치)', /if\(lt&&window\.matchMedia&&matchMedia\('\(pointer:coarse\)'\)\.matches&&typeof openTaskWorkstation==='function'\)\{ openTaskWorkstation\(lt\.id\); return; \}/.test(html));
t.ok('타이머 상태가 바뀔 때마다 카드 갱신', /function syncWidgetTimerState\(\)\{\s*try\{ if\(typeof _wsMediaSync==='function'\)_wsMediaSync\(true\); \}catch\(_e\)\{\}/.test(html));
t.ok('창 배경은 있는 토큰(--bg-page) — 없는 --bg로 투명하던 것', !/var\(--bg\)/.test(html) && /\.wsp-inapp\{[^}]*background:var\(--bg-page\)/.test(html));
t.done();
