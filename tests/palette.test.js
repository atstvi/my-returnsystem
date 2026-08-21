'use strict';
/* 항목 라벨 팔레트 (프로젝트·목표·카테고리 색).

   색은 hex 대신 var(--pal-N) 문자열로 저장해, 라이트/다크(테마)에 따라 톤이
   자동으로 바뀌고 색상(hue)은 유지된다. 16색을 넘으면 명도를 달리해 자동 확장.
   기존 hex는 가장 가까운 팔레트 hue로 옮긴다. 순수 로직을 고정한다:

   - returnPaletteVar(i): 0..15 → var(--pal-i); 16+ → color-mix 링으로 자동 확장.
   - returnNearestPaletteIndex(hex): 가장 가까운 hue 인덱스, 회색이면 -1.
   - returnToPaletteValue: 이미 팔레트 값이면 그대로, hex면 가까운 팔레트로. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'var RETURN_PAL_N=16;', '\nwindow.returnPaletteVar=returnPaletteVar;');

const sb = { window: {}, console: { warn() {} }, Math, Number, String, parseInt };
vm.createContext(sb);
vm.runInContext(block, sb);

const t = runner('항목 라벨 팔레트');

// ── returnPaletteVar ────────────────────────────────────────────────────────
{
  t.ok('slot 0 → var(--pal-0)', sb.returnPaletteVar(0) === 'var(--pal-0)');
  t.ok('slot 15 → var(--pal-15)', sb.returnPaletteVar(15) === 'var(--pal-15)');
  t.ok('slot 16 wraps hue but stays distinct (color-mix)', /color-mix.*var\(--pal-0\)/.test(sb.returnPaletteVar(16)), sb.returnPaletteVar(16));
  t.ok('slot 17 uses hue 1 base', /var\(--pal-1\)/.test(sb.returnPaletteVar(17)), sb.returnPaletteVar(17));
  t.ok('ring 1 differs from base', sb.returnPaletteVar(16) !== sb.returnPaletteVar(0));
  t.ok('negative/garbage → slot 0', sb.returnPaletteVar(-3) === 'var(--pal-0)' && sb.returnPaletteVar('x') === 'var(--pal-0)');
}

// ── 16 distinct base swatches ───────────────────────────────────────────────
{
  const sw = sb.returnPaletteSwatches();
  t.ok('16 swatches', sw.length === 16, sw.length);
  t.ok('all unique', new Set(sw).size === 16);
}

// ── returnNearestPaletteIndex: hue mapping ──────────────────────────────────
{
  // pure red → hue 0deg → nearest is index 1 (hue 6) not rose(350)? 6 is closer to 0 than 350 (dist 6 vs 10)
  t.ok('#FF0000 red → index 1 (hue 6)', sb.returnNearestPaletteIndex('#FF0000') === 1, sb.returnNearestPaletteIndex('#FF0000'));
  // pure blue hue 240 → nearest 246 = index 12? hues: 220(12),246(13). 240 closer to 246 → 13
  t.ok('#0000FF blue → index 13 (hue 246)', sb.returnNearestPaletteIndex('#0000FF') === 13, sb.returnNearestPaletteIndex('#0000FF'));
  // pure green hue 120 → nearest 135(idx7) vs 85(idx6): 120→135 dist15, 120→85 dist35 → 7
  t.ok('#00FF00 green → index 7 (hue 135)', sb.returnNearestPaletteIndex('#00FF00') === 7, sb.returnNearestPaletteIndex('#00FF00'));
  // legacy rose #BE727A ~ hue 353 → nearest rose idx0(350)
  t.ok('#BE727A rose → index 0', sb.returnNearestPaletteIndex('#BE727A') === 0, sb.returnNearestPaletteIndex('#BE727A'));
  // 3-digit hex works
  t.ok('#0a0 short hex parses', sb.returnNearestPaletteIndex('#0a0') === 7, sb.returnNearestPaletteIndex('#0a0'));
}

// ── gray / invalid → no palette hue ─────────────────────────────────────────
{
  t.ok('gray #888888 → -1', sb.returnNearestPaletteIndex('#888888') === -1, sb.returnNearestPaletteIndex('#888888'));
  t.ok('not a hex → -1', sb.returnNearestPaletteIndex('var(--pal-3)') === -1);
}

// ── returnToPaletteValue ────────────────────────────────────────────────────
{
  t.ok('already palette var → unchanged', sb.returnToPaletteValue('var(--pal-5)') === 'var(--pal-5)');
  t.ok('color-mix ring → unchanged', /color-mix/.test(sb.returnToPaletteValue(sb.returnPaletteVar(16))));
  t.ok('hex rose → palette var', sb.returnToPaletteValue('#BE727A') === 'var(--pal-0)', sb.returnToPaletteValue('#BE727A'));
  t.ok('gray hex → kept as-is', sb.returnToPaletteValue('#888888') === '#888888');
}

t.done();
