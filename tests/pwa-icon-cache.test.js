'use strict';
/* 설치된 PWA 아이콘이 테마를 따라가려면, 테마 매니페스트/아이콘을 'SW가 실제로 서빙하는
   캐시'에 써야 한다. 예전엔 항상 return-v1에 썼는데 sw.js의 CACHE는 return-v2였고(activate가
   그 외 return-* 캐시를 삭제) → 테마 자산이 엉뚱한 캐시에 쓰여 곧 지워지고 SW가 못 읽었다.
   returnSwCacheName()이 활성 return-v* 캐시(가장 높은 버전)를 동적으로 찾아 이 불일치를 없앤다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const html = readIndex();
const block = sliceBlock(html, 'function returnSwCacheName(){', '\nwindow.returnSwCacheName=returnSwCacheName;');
const t = runner('PWA 아이콘 캐시 정합');

function run(keys) {
  const ctx = {
    Promise, caches: (keys === null ? undefined : { keys: () => Promise.resolve(keys) }),
    parseInt,
  };
  vm.createContext(ctx);
  vm.runInContext(block + '\n;globalThis.__r = returnSwCacheName();', ctx);
  return ctx.__r;
}

(async () => {
  t.ok('여러 return-v* → 최신(높은 버전) 선택',
    (await run(['return-v1', 'return-v2'])) === 'return-v2');
  t.ok('return-v10 vs return-v2 → 숫자 비교로 v10',
    (await run(['return-v2', 'return-v10'])) === 'return-v10');
  t.ok('활성 캐시 하나 → 그것',
    (await run(['return-v2'])) === 'return-v2');
  t.ok('무관 캐시만 → return-v2 폴백',
    (await run(['sw-precache', 'misc'])) === 'return-v2');
  t.ok('빈 목록 → return-v2 폴백',
    (await run([])) === 'return-v2');
  t.ok('caches 없음 → return-v2 폴백',
    (await run(null)) === 'return-v2');

  // 소스 배선: 테마 매니페스트 쓰기/진단이 하드코딩 캐시가 아니라 returnSwCacheName 사용
  t.ok('themeStudioApplyPwaManifest가 활성 캐시에 씀',
    /returnSwCacheName\(\)\.then\(function\(cn\)\{ return caches\.open\(cn\); \}\)\.then\(function\(c\)\{\s*return Promise\.all\(\[\s*c\.put\(base\+'themed-icon-192/.test(html));
  t.ok('returnPwaIconStatus도 활성 캐시 조회',
    /return returnSwCacheName\(\)\.then\(function\(cn\)\{ return caches\.open\(cn\); \}\)\.then\(function\(c\)\{\s*return Promise\.all\(\[c\.match\(base\+'manifest\.json'\)/.test(html));

  // sw.js가 삭제하지 않는 캐시(= 서빙 캐시)와 쓰기 대상이 어긋나지 않게: index엔 하드코딩 return-v1 쓰기 없음
  t.ok("하드코딩 caches.open('return-v1') 쓰기 없음", html.indexOf("caches.open('return-v1')") < 0);

  // sw.js: 테마 매니페스트/아이콘을 ignoreSearch로 서빙, CACHE는 return-v*
  const sw = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
  t.ok('sw.js CACHE가 return-v* 형식', /const CACHE\s*=\s*'return-v\d+'/.test(sw), sw.match(/const CACHE[^\n]*/));
  t.ok('sw.js가 themed-icon/manifest를 ignoreSearch로 캐시 서빙',
    /themed-icon-\(\?:192\|512\)/.test(sw) && /ignoreSearch:\s*true/.test(sw));

  t.done();
})();
