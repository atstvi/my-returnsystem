'use strict';
/* Shared test helpers for the stabilization sync suite.
   The app is a single ~30k-line index.html with all JS inline and no build
   step, so these tests load functions by slicing self-contained blocks out of
   the inline <script> (anchored on the Stage marker comments) and eval'ing them
   in a mocked environment. This keeps the merge/sync logic under regression
   protection without a bundler. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function readIndex() { return fs.readFileSync(INDEX, 'utf8'); }

/* Slice [startMarker, endMarker) out of index.html. Throws if either marker is
   missing so a refactor that moves the block fails loudly instead of silently
   testing nothing. */
function sliceBlock(html, startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  if (a < 0) throw new Error('start marker not found: ' + startMarker);
  const b = html.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw new Error('end marker not found: ' + endMarker);
  return html.slice(a, b);
}

/* A minimal localStorage shim backed by a plain object. */
function makeStore() {
  const store = {};
  return {
    store,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
}

/* Validate that every inline (non-src) <script> in index.html parses. */
function assertSyntaxOk() {
  const html = readIndex();
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, joined = '', n = 0;
  while ((m = re.exec(html))) { joined += '\n;{' + m[1] + '\n};'; n++; }
  new vm.Script(joined); // throws on syntax error
  return { blocks: n, chars: joined.length };
}

/* Tiny assertion harness shared by the test files. */
function runner(title) {
  let pass = 0, fail = 0;
  const fails = [];
  console.log('\n' + title);
  return {
    ok(name, cond, extra) {
      if (cond) { pass++; console.log('  ✓ ' + name); }
      else { fail++; fails.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
    },
    done() {
      const msg = fail ? `FAIL — ${pass} pass, ${fail} fail` : `ALL PASS — ${pass}/${pass}`;
      console.log('\n' + msg);
      if (fail) process.exitCode = 1;
      return { pass, fail, fails };
    },
  };
}

/* fbApplyData/fbSaveNow가 쓰는 모듈 수준 동기화 헬퍼(병합·fail-closed 쓰기·되돌림 감지) 원문.
   fbApplyData를 잘라 쓰는 테스트는 이걸 함께 실행해야 실제 병합 경로를 탄다 — 예전엔 헬퍼가 없으면
   병합 분기가 ReferenceError로 실패하고 '일반 덮어쓰기'로 흘러 테스트가 우연히 통과했다(그 fail-open이
   실제 데이터 롤백 원인이었다). */
function syncHelpersSource(html) {
  return [
    sliceBlock(html, 'function returnDedupById(arr){', 'window.returnDedupById=returnDedupById;'),
    sliceBlock(html, 'function returnSyncArrayMerge(cloudStr, localStr, opts){', 'window.returnSyncArrayMerge=returnSyncArrayMerge;'),
    sliceBlock(html, '/* ════════ 동기화 데이터 보호', 'function returnFbStaleEcho(k, data){'),
  ].join('\n');
}

module.exports = { readIndex, sliceBlock, makeStore, assertSyntaxOk, runner, INDEX, syncHelpersSource };
