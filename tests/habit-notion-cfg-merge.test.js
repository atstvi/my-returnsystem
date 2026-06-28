'use strict';
/* Habit-Notion cloud-apply merge — habitNotionMergeCloudCfg: preserve the
   locally-chosen target page (pageId/pageTitle) when applying the cloud settings
   doc, so a stale/empty cloud value doesn't wipe the selection on refresh.
   Regression: "선택한 페이지" not remembered. Loads the real pure function out of
   index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function habitNotionMergeCloudCfg(', 'function fbCollectCloudSettings(');

const sandbox = { console, Object };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { habitNotionMergeCloudCfg } = sandbox;

const t = runner('habit-notion — cloud cfg merge');

const local = { dbId: 'db1', leftProp: '왼쪽', rightProp: '오른쪽', pageId: 'pg_123', pageTitle: '오늘 루틴' };

// 1. THE BUG: a cloud doc that predates the page pick (no pageId) must not wipe it
let r = habitNotionMergeCloudCfg({ dbId: 'db1', leftProp: '왼쪽', rightProp: '오른쪽' }, local);
t.ok('pageId preserved when cloud lacks it', r.pageId === 'pg_123', r.pageId);
t.ok('pageTitle preserved when cloud lacks it', r.pageTitle === '오늘 루틴', r.pageTitle);

// 2. Empty-string cloud fields also fall back to local
r = habitNotionMergeCloudCfg({ dbId: 'db1', pageId: '', pageTitle: '' }, local);
t.ok('empty cloud pageId → local kept', r.pageId === 'pg_123', r.pageId);

// 3. Cloud wins when it actually has a (newer) value — cross-device update applies
r = habitNotionMergeCloudCfg({ dbId: 'db1', leftProp: '왼쪽', rightProp: '오른쪽', pageId: 'pg_NEW', pageTitle: '새 페이지' }, local);
t.ok('cloud pageId wins when present', r.pageId === 'pg_NEW', r.pageId);
t.ok('cloud pageTitle wins when present', r.pageTitle === '새 페이지', r.pageTitle);

// 4. dbId/props also preserved when cloud blank
r = habitNotionMergeCloudCfg({}, local);
t.ok('all local fields preserved from empty cloud', r.dbId === 'db1' && r.leftProp === '왼쪽' && r.pageId === 'pg_123', JSON.stringify(r));

// 5. No local selection yet → cloud value adopted as-is
r = habitNotionMergeCloudCfg({ dbId: 'db2', pageId: 'pg_X', pageTitle: 'X' }, {});
t.ok('adopt cloud when no local', r.pageId === 'pg_X' && r.dbId === 'db2', JSON.stringify(r));

// 6. Null inputs stable; does not mutate the cloud arg
const c2 = { dbId: 'z' };
r = habitNotionMergeCloudCfg(null, null);
t.ok('null inputs → object', r && typeof r === 'object');
habitNotionMergeCloudCfg(c2, local);
t.ok('cloud arg not mutated', c2.pageId === undefined && Object.keys(c2).length === 1, JSON.stringify(c2));

t.done();
