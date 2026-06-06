'use strict';
/* Regression coverage for:
   1. Devices/browsers where Firebase popup login is blocked must fall back to
      redirect login and process the redirect result on boot.
   2. Theme Studio assets and page stickers must not keep duplicate syncDataUrl
      blobs once the shared media manifest can carry the image bytes. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const t = runner('Auth + Theme Studio storage regressions');

const authInitBlock = sliceBlock(html, 'var _fbInitOnce = false;', '\nsaveFbConfig=');
t.ok('Firebase auth tracks redirect result handling', /_fbRedirectHandled/.test(authInitBlock));
t.ok('initFirebase processes getRedirectResult', /getRedirectResult\(\)/.test(authInitBlock));
t.ok('calendar credential handling is shared', /function fbHandleCalendarCredential/.test(authInitBlock));

const loginBlock = sliceBlock(html, 'async function fbGoogleLogin(){', '\nfunction fbCollectData(){');
t.ok('Google login first tries popup', /signInWithPopup\(provider\)/.test(loginBlock));
t.ok('Google login falls back to redirect when popup is blocked', /signInWithRedirect\(provider\)/.test(loginBlock));
t.ok('popup fallback detects popup/blocked errors', /popup[\s\S]*blocked|blocked[\s\S]*popup/.test(loginBlock));

const assetBlock = sliceBlock(html, 'function themeStudioCompactAssetForStorage(asset){', '\nfunction themeStudioSaveAssets(list){');
const assetSb = {
  themeStudioClone: (x) => JSON.parse(JSON.stringify(x || {})),
  isReturnMediaRef: (v) => /^return-media:|^media:/.test(String(v || '')),
  returnMediaRefId: (v) => String(v || '').replace(/^return-media:|^media:/, ''),
  mediaSyncPut: (id, dataUrl) => { assetSb.manifest[id] = dataUrl; return true; },
  mediaSyncGet: (id) => assetSb.manifest[id] || '',
  manifest: {},
};
vm.createContext(assetSb);
vm.runInContext(assetBlock, assetSb);
const compactAsset = assetSb.themeStudioCompactAssetForStorage({
  id: 'asset_1',
  url: 'return-media:m1',
  syncDataUrl: 'data:image/png;base64,' + 'A'.repeat(100),
});
t.ok('asset compact registers syncDataUrl in media manifest', assetSb.manifest.m1 === compactAsset.syncDataUrl || !!assetSb.manifest.m1, assetSb.manifest);
t.ok('asset compact strips manifest-backed syncDataUrl from asset JSON', !compactAsset.syncDataUrl, compactAsset);

const stickerBlock = sliceBlock(html, 'function compactGlobalStickerStateForStorage(state){', '\nfunction saveGlobalStickers(){');
const stickerSb = {
  isReturnMediaRef: (v) => /^return-media:|^media:/.test(String(v || '')),
  returnMediaRefId: (v) => String(v || '').replace(/^return-media:|^media:/, ''),
  themeStudioMediaFallbackForUrl: () => '',
  mediaSyncPut: (id, dataUrl) => { stickerSb.manifest[id] = dataUrl; return true; },
  mediaSyncGet: (id) => stickerSb.manifest[id] || '',
  manifest: {},
};
vm.createContext(stickerSb);
vm.runInContext(stickerBlock, stickerSb);
const compactStickers = stickerSb.compactGlobalStickerStateForStorage({
  home: [{ id: 'gs_1', url: 'return-media:m2', syncDataUrl: 'data:image/png;base64,' + 'B'.repeat(100), x: 1 }],
});
t.ok('sticker compact registers syncDataUrl in media manifest', !!stickerSb.manifest.m2, stickerSb.manifest);
t.ok('sticker compact strips manifest-backed syncDataUrl from sticker JSON', !compactStickers.home[0].syncDataUrl, compactStickers);

t.done();
