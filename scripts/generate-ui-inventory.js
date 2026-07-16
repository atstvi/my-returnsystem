#!/usr/bin/env node
/*
 * UI Function Inventory generator.
 *
 * index.html has no build step and no component boundaries: markup, CSS and
 * ~30k lines of JS all live in one file, and many controls are rendered at
 * runtime from JS template strings (not present in the static markup at all).
 * This script walks both regions and produces a control -> handler-function
 * map, grouped by page/module, so a redesign pass has a checklist to verify
 * against instead of relying on memory.
 *
 * Usage: node scripts/generate-ui-inventory.js
 * Outputs: docs/ui-inventory.json, docs/UI_FUNCTION_INVENTORY.md
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function lineOf(idx) {
  return html.slice(0, idx).split('\n').length;
}

// ---- locate the three <script> regions (head interceptor / main app / tiny footer) ----
const scriptOpens = [...html.matchAll(/<script[^>]*>/g)].map(m => ({ idx: m.index, end: m.index + m[0].length }));
const scriptCloses = [...html.matchAll(/<\/script>/g)].map(m => m.index);
if (scriptOpens.length < 2 || scriptCloses.length < 2) throw new Error('unexpected <script> layout');

const headScriptEnd = scriptCloses[0];       // end of head OAuth interceptor
const mainScriptStart = scriptOpens[1].end;  // start of ~30k line app script
const mainScriptEnd = scriptCloses[scriptCloses.length - 2]; // close of main script (footer script is tiny, last one)

const MARKUP_START = headScriptEnd;
const MARKUP_END = scriptOpens[1].idx;
const markup = html.slice(MARKUP_START, MARKUP_END);
const js = html.slice(mainScriptStart, mainScriptEnd);

console.error(`markup region: lines ${lineOf(MARKUP_START)}-${lineOf(MARKUP_END)} (${markup.length} chars)`);
console.error(`js region:     lines ${lineOf(mainScriptStart)}-${lineOf(mainScriptEnd)} (${js.length} chars)`);

// ---- find the matching closing tag for a <TAG ...> that starts at `openIdx` (index into `markup`) ----
// Tracks tag open/close depth via a single regex pass; ignores everything else (text, other
// tags, attribute values) since we only match literal "<tag" / "</tag" tokens.
function findTagEnd(tagName, openIdx) {
  const TOKEN = new RegExp(`<(\\/)?${tagName}\\b`, 'gi');
  TOKEN.lastIndex = openIdx;
  let depth = 0;
  let m;
  while ((m = TOKEN.exec(markup))) {
    if (m[1]) { // closing
      depth--;
      if (depth === 0) {
        const gt = markup.indexOf('>', m.index);
        return gt + 1;
      }
    } else { // opening
      depth++;
    }
  }
  throw new Error(`unbalanced <${tagName}> starting at ${openIdx}`);
}
const findDivEnd = (openIdx) => findTagEnd('div', openIdx);

// ---- locate every id="page-XXX" landmark (div or main) and its bounds ----
const PAGE_LANDMARK = /<(div|main)\b[^>]*\bid="page-([a-zA-Z0-9_-]+)"[^>]*>/g;
const pages = [];
let pm;
while ((pm = PAGE_LANDMARK.exec(markup))) {
  const tag = pm[1];
  const openIdx = pm.index;
  const endIdx = findTagEnd(tag, openIdx);
  pages.push({
    slug: pm[2],
    tag,
    startLine: lineOf(MARKUP_START + openIdx),
    endLine: lineOf(MARKUP_START + endIdx),
    startIdx: openIdx,
    endIdx,
    body: markup.slice(openIdx, endIdx),
  });
}
console.error(`found ${pages.length} page landmarks:`, pages.map(p => `${p.slug}<${p.tag}>(${p.startLine}-${p.endLine})`).join(', '));

// ---- generic opening-tag scanner: <TAG attr="v" attr2='v2' data-x="y" ...> ----
// Deliberately simple (no nested-quote/HTML-comment handling beyond what this file needs);
// good enough because the codebase's own markup is machine-generated-consistent (double-quoted
// attrs, no attribute-value angle brackets).
const OPEN_TAG = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:=(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:=(?:"([^"]*)"|'([^']*)'))?/g;

function parseAttrs(attrStr) {
  const attrs = {};
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(attrStr))) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : true);
  }
  return attrs;
}

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);

// Extract every control (interactive tag, OR any tag carrying onclick/data-*) inside `body`
// (a markup substring). `baseIdx` is body's offset within `markup`, for accurate line numbers.
function extractControls(body, baseIdx) {
  const controls = [];
  let m;
  OPEN_TAG.lastIndex = 0;
  while ((m = OPEN_TAG.exec(body))) {
    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    const hasOnclick = 'onclick' in attrs;
    const dataKeys = Object.keys(attrs).filter(k => k.startsWith('data-'));
    if (!INTERACTIVE_TAGS.has(tag) && !hasOnclick && dataKeys.length === 0) continue;
    // grab a label: text immediately following the tag, up to the next '<'
    const afterTag = body.slice(m.index + m[0].length);
    const textMatch = afterTag.match(/^([^<]*)/);
    const label = textMatch ? textMatch[1].replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    controls.push({
      tag,
      id: attrs.id || null,
      onclick: hasOnclick ? attrs.onclick : null,
      dataAttrs: dataKeys.reduce((o, k) => (o[k] = attrs[k], o), {}),
      className: attrs.class || null,
      type: attrs.type || null,
      label,
      line: lineOf(MARKUP_START + baseIdx + m.index),
    });
  }
  return controls;
}

// ---- top-level function declarations (column 0 => real top-level scope, not nested helpers) ----
const TOP_FN = /^function ([A-Za-z0-9_$]+)\s*\(/gm;
const topFunctions = [];
{
  let m;
  while ((m = TOP_FN.exec(js))) {
    topFunctions.push({ name: m[1], idx: m.index, line: lineOf(mainScriptStart + m.index) });
  }
  topFunctions.sort((a, b) => a.idx - b.idx);
  for (let i = 0; i < topFunctions.length; i++) {
    topFunctions[i].endIdx = i + 1 < topFunctions.length ? topFunctions[i + 1].idx : js.length;
  }
}
console.error(`found ${topFunctions.length} top-level function declarations`);

// given a char index into `js`, return the name of the top-level function containing it (or null)
function enclosingFunction(idx) {
  // binary search for last function with idx <= given idx
  let lo = 0, hi = topFunctions.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (topFunctions[mid].idx <= idx) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (ans === -1) return null;
  const fn = topFunctions[ans];
  return idx < fn.endIdx ? fn.name : null;
}

// ---- data-* hook vocabulary: every distinct data-XXX token used anywhere in the JS region,  ----
// ---- whether as a generated HTML attribute, a querySelector(All) selector, or a .dataset read ----
// Buttons for dynamic (JS-template-rendered) content don't exist in static markup at all, so this
// is the only way to discover them. We don't try to machine-distinguish producer vs. consumer;
// the enclosing function names (already following a Render/Bind/action naming convention in this
// codebase) make that legible to a human reader.
const DATA_TOKEN = /data-([a-z][a-z0-9-]*)/gi;
const dataHooks = new Map(); // name -> [{line, fn}]
{
  let m;
  while ((m = DATA_TOKEN.exec(js))) {
    const name = 'data-' + m[1].toLowerCase();
    const fn = enclosingFunction(m.index);
    if (!dataHooks.has(name)) dataHooks.set(name, []);
    const line = lineOf(mainScriptStart + m.index);
    const arr = dataHooks.get(name);
    if (!arr.some(e => e.fn === fn)) arr.push({ line, fn });
  }
}
console.error(`found ${dataHooks.size} distinct data-* hook names`);

// ---- getElementById('X') bindings: capture id + a short context snippet so a human can see ----
// ---- whether it's wired via addEventListener/.onclick and to which handler ----
const GET_BY_ID = /getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;
const idBindings = new Map(); // id -> [{line, fn, snippet}]
{
  let m;
  while ((m = GET_BY_ID.exec(js))) {
    const id = m[1];
    const fn = enclosingFunction(m.index);
    const line = lineOf(mainScriptStart + m.index);
    const snippet = js.slice(m.index, m.index + 160).replace(/\s+/g, ' ');
    if (!idBindings.has(id)) idBindings.set(id, []);
    idBindings.get(id).push({ line, fn, snippet });
  }
}
console.error(`found getElementById references to ${idBindings.size} distinct ids`);

// ---- dynamic id lookups: getElementById('prefix_'+var) — common for the diary's per-section ----
// ---- fields (SECTIONS.map(...)) where the literal id never appears as a whole string ----
const DYNAMIC_ID_PREFIX = /getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\+/g;
const dynamicIdPrefixes = []; // [{prefix, fn, line}]
{
  let m;
  while ((m = DYNAMIC_ID_PREFIX.exec(js))) {
    dynamicIdPrefixes.push({
      prefix: m[1],
      fn: enclosingFunction(m.index),
      line: lineOf(mainScriptStart + m.index),
    });
  }
}
console.error(`found ${dynamicIdPrefixes.length} dynamic-id-prefix getElementById(...) call sites`);

// ---- bare property-assignment bindings: X.onclick = ... (not chained off getElementById) ----
const ONCLICK_PROP = /\b([A-Za-z_$][A-Za-z0-9_$]*)\.onclick\s*=/g;
const onclickPropBindings = [];
{
  let m;
  while ((m = ONCLICK_PROP.exec(js))) {
    onclickPropBindings.push({
      varName: m[1],
      fn: enclosingFunction(m.index),
      line: lineOf(mainScriptStart + m.index),
      snippet: js.slice(m.index, m.index + 160).replace(/\s+/g, ' '),
    });
  }
}
console.error(`found ${onclickPropBindings.length} bare ".onclick =" property assignments`);

// ---- best-effort module classification for every top-level function ----
// This is a documentation aid, not a static-analysis guarantee: it groups functions by the
// naming convention already in use in this file (e.g. musicXxx, twvXxx, _ftMiniXxx) so a reader
// can find "everything touching the Music page" without reading all 1140 declarations. Verify
// the actual call graph for anything load-bearing before relying on the grouping.
const ABBREV_MODULES = {
  twv: 'schedule (timetable weekly view)',
  tt: 'schedule (timetable)',
  hob: 'hobby',
  ft: 'focus-timer widget',
  fte: 'focus-timer widget',
  rc: 'recharge',
  fb: 'firebase sync',
  gcal: 'google-calendar sync',
  notif: 'notifications',
  ap: 'notion auto-push trace',
  chk: 'recharge (check-in)',
  rec: 'records',
};
// ordered longest-first so e.g. "timetable" wins over "time", "notification" over "notif"
const KEYWORDS = [
  ['timetable', 'schedule (timetable)'], ['schedule', 'schedule (timetable)'],
  ['notification', 'notifications'], ['notion', 'notion sync'],
  ['firebase', 'firebase sync'], ['gcal', 'google-calendar sync'], ['google', 'google-calendar sync'],
  ['theme', 'theme studio'], ['sticker', 'theme studio'], ['banner', 'theme studio'],
  ['music', 'music'], ['routine', 'routine'], ['diary', 'diary'], ['project', 'projects'],
  ['hobby', 'hobby'], ['recharge', 'recharge'], ['records', 'records'], ['memo', 'records'],
  ['insight', 'records'], ['value', 'records'], ['inbox', 'inbox'], ['home', 'home'],
  ['widget', 'home widgets'], ['board', 'home widgets'], ['timer', 'focus-timer widget'],
  ['auth', 'auth'], ['storage', 'storage/sync core'], ['idb', 'storage/sync core'],
  ['quota', 'storage/sync core'], ['sync', 'storage/sync core'], ['media', 'storage/sync core'],
  ['modal', 'shared modal'], ['archive', 'diary archive'], ['repeat', 'tasks (recurring rules)'],
  ['rule', 'tasks (recurring rules)'], ['generatedtask', 'tasks (recurring rules)'],
  ['task', 'tasks'], ['capture', 'inbox capture'], ['settings', 'settings'],
  ['api', 'ai/api'], [' ai', 'ai/api'], ['return', 'core/diagnostics'], ['check', 'recharge (check-in)'],
  ['focus', 'focus-timer widget'], ['notification', 'notifications'], ['notif', 'notifications'],
  ['push', 'notifications'], ['metric', 'records'],
];

function classifyModule(name) {
  const stripped = name.replace(/^_+/, '');
  const abbrevMatch = stripped.match(/^[a-z]+/);
  if (abbrevMatch && ABBREV_MODULES[abbrevMatch[0]]) return ABBREV_MODULES[abbrevMatch[0]];
  const lower = name.toLowerCase();
  for (const [kw, mod] of KEYWORDS) {
    if (lower.includes(kw)) return mod;
  }
  return 'misc/util';
}

const functionsByModule = new Map();
for (const fn of topFunctions) {
  const mod = classifyModule(fn.name);
  if (!functionsByModule.has(mod)) functionsByModule.set(mod, []);
  functionsByModule.get(mod).push(fn);
}

// ---- page metadata: nav slug -> Korean label + owning module bucket(s) ----
// Sourced from CLAUDE.md's page list + bottom-nav data-page values found in markup.
const PAGE_META = [
  { slug: 'home', label: '나 / Home', modules: ['home', 'home widgets'] },
  { slug: 'inbox', label: '인박스 / Inbox', modules: ['inbox', 'inbox capture'] },
  { slug: 'diary', label: '일기 / Diary', modules: ['diary', 'diary archive', 'notion sync'] },
  { slug: 'routine', label: '루틴 / Routine', modules: ['routine'] },
  { slug: 'tasks', label: '할일 / Tasks', modules: ['tasks', 'tasks (recurring rules)', 'google-calendar sync'] },
  { slug: 'projects', label: '프로젝트 / Projects', modules: ['projects'] },
  { slug: 'schedule', label: '시간표 / Schedule', modules: ['schedule (timetable)', 'schedule (timetable weekly view)'] },
  { slug: 'hobby', label: '취미 / Hobby', modules: ['hobby'] },
  { slug: 'music', label: '음악 / Music', modules: ['music'] },
  { slug: 'recharge', label: '충전과 체크 / Recharge & Check', modules: ['recharge', 'recharge (check-in)'] },
  { slug: 'records', label: '기록 / Records', modules: ['records'] },
  { slug: 'timer', label: '집중 타이머 / Focus timer overlay', modules: ['focus-timer widget'] },
  {
    slug: 'settings', label: '설정 / Settings',
    modules: ['settings', 'theme studio', 'ai/api', 'notifications', 'firebase sync', 'notion sync',
      'google-calendar sync', 'auth', 'notion auto-push trace'],
  },
];
const SHARED_MODULES = ['shared modal', 'storage/sync core', 'core/diagnostics'];

function resolveIdBinding(id) {
  const direct = idBindings.get(id);
  if (direct) return direct;
  const dynMatches = dynamicIdPrefixes.filter(d => id.startsWith(d.prefix));
  if (dynMatches.length) {
    return dynMatches.map(d => ({ line: d.line, fn: d.fn, dynamic: true, prefix: d.prefix }));
  }
  return null;
}

function buildPageReport(meta) {
  const pageLandmark = pages.find(p => p.slug === meta.slug);
  const staticControls = pageLandmark ? extractControls(pageLandmark.body, pageLandmark.startIdx) : [];
  for (const c of staticControls) {
    c.jsBindings = c.id ? resolveIdBinding(c.id) : null;
  }
  const moduleFns = {};
  for (const mod of meta.modules) {
    moduleFns[mod] = (functionsByModule.get(mod) || []).map(f => ({ name: f.name, line: f.line }));
  }
  const moduleFnNameSet = new Set(Object.values(moduleFns).flat().map(f => f.name));
  const relatedDataHooks = [];
  for (const [hook, occurrences] of dataHooks) {
    if (occurrences.some(o => moduleFnNameSet.has(o.fn))) {
      relatedDataHooks.push({ hook, occurrences: occurrences.filter(o => moduleFnNameSet.has(o.fn)) });
    }
  }
  return {
    slug: meta.slug,
    label: meta.label,
    landmarkLines: pageLandmark ? [pageLandmark.startLine, pageLandmark.endLine] : null,
    staticControls,
    moduleFns,
    relatedDataHooks,
  };
}

const pageReports = PAGE_META.map(buildPageReport);
const sharedModuleFns = {};
for (const mod of SHARED_MODULES) {
  sharedModuleFns[mod] = (functionsByModule.get(mod) || []).map(f => ({ name: f.name, line: f.line }));
}
const miscFns = (functionsByModule.get('misc/util') || []).map(f => ({ name: f.name, line: f.line }));

// ---- output writers (only run when invoked directly, not when required by tests/other tools) ----
function writeOutputs() {
  const jsonPath = path.join(ROOT, 'docs', 'ui-inventory.json');
  const mdPath = path.join(ROOT, 'docs', 'UI_FUNCTION_INVENTORY.md');

  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    sourceLines: html.split('\n').length,
    topFunctionCount: topFunctions.length,
    pages: pageReports,
    sharedModules: sharedModuleFns,
    miscFunctions: miscFns,
  }, null, 1) + '\n');

  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# UI ↔ Function Inventory');
  push();
  push('**Auto-generated. Do not hand-edit — run `node scripts/generate-ui-inventory.js` to refresh.**');
  push();
  push('Maps every page/control in `index.html` to the JS function(s) that render or handle it, so a');
  push('visual redesign has a checklist to verify against instead of relying on memory. See');
  push('"How to use this for a redesign" at the bottom for the verification workflow.');
  push();
  push(`Generated from a ${html.split('\n').length.toLocaleString()}-line \`index.html\` containing`);
  push(`${topFunctions.length.toLocaleString()} top-level functions.`);
  push();
  push('**Known limitations of this scan** — treat "unbound in static scan" as "grep it," not "dead":');
  push('- Elements bound only by class-selector event delegation (e.g. `querySelectorAll(\'.task-check\')`');
  push('  from a parent container) aren\'t resolved to a handler — only `id`, `onclick=`, and `data-*`');
  push('  hooks are traced. The element still shows up in the table so it isn\'t lost, just unresolved.');
  push('- Module grouping is by naming convention (e.g. `musicXxx` → music), not a call graph — a few');
  push('  functions may be filed under the wrong page; treat it as a starting index, not ground truth.');
  push('- Some markup rows are static demo/placeholder content (see `tests/sample-seed-gate.test.js`,');
  push('  `demo-cleanup.test.js`) that gets replaced once real data renders — expected, not a bug.');
  push();
  push('## Pages');
  push();

  function fnListBlock(fnArr) {
    const sorted = [...fnArr].sort((a, b) => a.line - b.line);
    return sorted.map(f => `\`${f.name}\`(${f.line})`).join(', ');
  }

  for (const p of pageReports) {
    push(`### ${p.label} — \`${p.slug}\``);
    push();
    if (p.landmarkLines) {
      push(`Markup landmark: \`index.html:${p.landmarkLines[0]}-${p.landmarkLines[1]}\``);
    } else {
      push('_No static `id="page-' + p.slug + '"` landmark found — page is likely a dynamically-injected overlay._');
    }
    push();

    if (p.staticControls.length) {
      push('**Static controls** (present in the markup as written, not generated by JS):');
      push();
      push('| Element | Label | Handler | Line |');
      push('|---|---|---|---|');
      for (const c of p.staticControls) {
        const elDesc = `<${c.tag}${c.id ? ` id="${c.id}"` : ''}${c.type ? ` type="${c.type}"` : ''}>`;
        const label = c.label || (c.className ? `.${c.className.split(/\s+/)[0]}` : '');
        let handler = '';
        if (c.onclick) {
          handler = `onclick=\`${c.onclick}\``;
        } else if (c.jsBindings && c.jsBindings.length) {
          const seen = new Set();
          const uniq = c.jsBindings.filter(b => {
            const key = `${b.fn}@${b.line}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          handler = uniq.map(b => b.dynamic
            ? `\`${b.fn}\`(${b.line}, via \`'${b.prefix}'+key\`)`
            : `\`${b.fn}\`(${b.line})`).join(', ');
        } else if (Object.keys(c.dataAttrs).length) {
          handler = Object.keys(c.dataAttrs).join(', ') + ' (see data-hooks below)';
        } else {
          handler = '_unbound in static scan — search `' + (c.id || c.className || c.tag) + '` in index.html_';
        }
        push(`| \`${elDesc}\` | ${label.replace(/\|/g, '\\|')} | ${handler.replace(/\|/g, '\\|')} | ${c.line} |`);
      }
      push();
    }

    if (p.relatedDataHooks.length) {
      push('**Dynamic controls** (rendered from JS template strings via `data-*` hook attributes):');
      push();
      push('| `data-*` hook | Touched by | Lines |');
      push('|---|---|---|');
      for (const h of p.relatedDataHooks.sort((a, b) => a.hook.localeCompare(b.hook))) {
        const fns = [...new Set(h.occurrences.map(o => o.fn))];
        const lns = h.occurrences.map(o => o.line).join(', ');
        push(`| \`${h.hook}\` | ${fns.map(f => `\`${f}\``).join(', ')} | ${lns} |`);
      }
      push();
    }

    push('**All module functions** (best-effort grouping by naming convention — the full surface');
    push('area to check when touching this page):');
    push();
    for (const [mod, fns] of Object.entries(p.moduleFns)) {
      if (!fns.length) continue;
      push(`- _${mod}_ (${fns.length}): ${fnListBlock(fns)}`);
    }
    push();
  }

  push('## Shared / cross-page modules');
  push();
  push('These aren\'t owned by one page but are touched from many — check them whenever a redesign');
  push('changes how/when a page mounts, unmounts, or re-renders.');
  push();
  for (const [mod, fns] of Object.entries(sharedModuleFns)) {
    push(`- _${mod}_ (${fns.length}): ${fnListBlock(fns)}`);
  }
  push();

  push('## Uncategorized (misc/util)');
  push();
  push(`${miscFns.length} top-level functions didn't match a known module keyword by naming`);
  push('convention (generic helpers like date/escaping utilities, or module-specific functions named');
  push('without their module\'s usual prefix). Grep for these by name before assuming they\'re safe to');
  push('leave alone during a redesign pass:');
  push();
  push(fnListBlock(miscFns));
  push();

  push('## How to use this for a redesign');
  push();
  push('1. **Before starting**, this file + `docs/ui-inventory.json` are the baseline. Commit them.');
  push('2. **Redesign one page at a time** (strangler-fig, not a big-bang rewrite) — pick a page');
  push('   section above, and treat every row in its tables as a checklist item: every static');
  push('   control\'s handler, every `data-*` hook, every module function must still exist and be');
  push('   reachable after the visual rewrite, even if the markup around it is completely new.');
  push('3. **Keep the binding contract stable.** Static controls are wired by `id` (`getElementById`)');
  push('   or `onclick="fn()"`; dynamic controls are wired by `data-*` attribute name. As long as a');
  push('   redesigned element keeps the same `id` or `data-*` attribute, the JS behind it does not');
  push('   need to change at all — only the surrounding HTML/CSS does.');
  push('4. **Re-run this generator after the pass**: `node scripts/generate-ui-inventory.js`, then');
  push('   `git diff docs/ui-inventory.json`. A hook or function that silently disappeared from a');
  push('   page\'s section (and didn\'t move to another page on purpose) is a regression — a button');
  push('   that quietly lost its wiring during the visual rewrite.');
  push('5. **Run `npm test`** — several suites load real functions out of `index.html` via');
  push('   `tests/lib.js`\'s `sliceBlock`, anchored on literal text. If a redesign pass moves or');
  push('   renames a function this inventory lists, the matching test breaks loudly, which is the');
  push('   intended safety net, not a bug to silence (see CLAUDE.md).');
  push();

  fs.writeFileSync(mdPath, lines.join('\n'));
  console.error(`wrote ${jsonPath}`);
  console.error(`wrote ${mdPath}`);
}

if (require.main === module) {
  writeOutputs();
}

module.exports = {
  html, markup, js, MARKUP_START, mainScriptStart, lineOf, pages,
  findDivEnd, findTagEnd, extractControls, parseAttrs,
  topFunctions, enclosingFunction,
  dataHooks, idBindings, onclickPropBindings,
  classifyModule, functionsByModule,
  PAGE_META, SHARED_MODULES, pageReports, sharedModuleFns, miscFns,
  writeOutputs,
};
