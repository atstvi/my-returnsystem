'use strict';
/* 테마 동기화가 '옛 테마/옛 사진'으로 되돌아가던 문제 (사용자 리포트: 다른 기기에서 옛 테마로
   돌아감 · 테마 이미지·배너가 예전 사진으로 보임 · 다른 기기를 쓸 때 더 그럼).

   원인 1 — 비동기 사본 복구가 '시작할 때 잡은 상태'를 통째로 다시 씀
     themeStudioEnsureMediaFallbacks는 부팅 직후(클라우드 적용 전) 돌면서 테마 상태를 cur2로
     잡아 두고 IndexedDB 읽기·압축을 기다린 뒤 cur2를 통째로 저장 + fbSaveAll 했다. 그 사이
     클라우드에서 새 테마가 들어오면(_lastRemoteApplyMs 갱신) 옛 cur2가 그것을 덮고, 저장
     충돌 해결은 '적용 시각 이후 바뀐 로컬'로 보고 옛 테마를 방금 시각으로 올려 모든 기기를
     되돌렸다. 계약: 완료 시 지금 상태를 다시 읽고, 같은 이미지(ref) 칸에만 사본을 넣는다.

   원인 2 — 이미지를 바꿔도 옛 대체 사본(syncDataUrl)이 남음
     themeStudioSetMedia/아이콘/배너 적용이 새 이미지로 바꾸면서 옛 사본을 지우지 않아, 다른
     기기에서 새 이미지를 못 불러오면 옛 사진이 보였고, 사본이 있다고 여겨 새 사본도 안 만들었다.

   원인 3 — settings/main(테마 모드·색 등)을 키별 시각 없이 통째로 덮어씀
     로그인 때 한 번만 읽고, 켜 둔 다른 기기가 저장할 때마다 자기 옛 값을 다시 올렸다.
     계약: 이 기기가 실제로 바꾼 키만 올린다. 클라우드 설정을 아직 못 봤으면 올리지 않는다. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');
const html = readIndex();
const t = runner('테마 동기화: 옛 테마·옛 사진 되돌림 방지');

/* ── 1) 비동기 사본 복구가 새 테마를 덮지 않음 (실제 함수 실행) ── */
function makeRepairCtx() {
  const store = {};
  let resolveIdb;
  const ctx = {
    console: { warn() {}, log() {}, error() {} }, Promise, JSON, Object, String,
    THEME_STUDIO_STATE_KEY: 'return_theme_studio_state_v1', MEDIA_SYNC_ITEM_MAX: 220000,
    _themeStudioFallbackRepairRunning: false, fbDb: null, fbUser: null,
    store, writes: 0, saves: 0,
    themeStudioAssets: () => [], themeStudioSaveAssets() {},
    isReturnMediaRef: (u) => /^(return-media:|media:)/.test(String(u || '')),
    returnMediaRefId: (r) => String(r || '').replace(/^return-media:|^media:/, ''),
    mediaSyncResolve: () => '', mediaSyncPut() {},
    returnMediaResolveUrl: () => new Promise((res) => { resolveIdb = res; }),
    themeStudioCloudFallbackDataUrl: () => Promise.resolve('data:image/jpeg;base64,NEWFB'),
    themeStudioGet: () => JSON.parse(store.return_theme_studio_state_v1 || '{}'),
    themeStudioEnsureIconsState: (st) => { st.icons = st.icons || {}; return st.icons; },
    themeStudioEnsureSkinState: (st) => { st.componentSkins = st.componentSkins || { resources: { card: {} } }; return st.componentSkins.resources.card; },
    themeStudioWriteJSON(k, v) { store[k] = JSON.stringify(v); ctx.writes++; },
    themeStudioApply() {}, fbSaveAll() { ctx.saves++; },
  };
  vm.createContext(ctx);
  vm.runInContext(sliceBlock(html, 'function themeStudioEnsureMediaFallbacks(){', '\nfunction themeStudioAddMediaAssetRef('), ctx);
  return { ctx, store, idb: (v) => resolveIdb(v) };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  {
    const { ctx, store, idb } = makeRepairCtx();
    store.return_theme_studio_state_v1 = JSON.stringify({ colors: { accent: '#OLD111' }, banner: { image: 'return-media:b1' } });
    ctx.themeStudioEnsureMediaFallbacks();
    await flush();
    /* 그 사이 클라우드에서 새 테마 도착(같은 배너, 다른 색) */
    store.return_theme_studio_state_v1 = JSON.stringify({ colors: { accent: '#NEW222' }, banner: { image: 'return-media:b1' } });
    idb('data:image/png;base64,BYTES');
    await flush(); await flush(); await flush();
    const st = JSON.parse(store.return_theme_studio_state_v1);
    t.ok('복구가 끝나도 새 테마 색 유지(옛 cur2로 덮지 않음)', st.colors.accent === '#NEW222', st.colors.accent);
    t.ok('같은 배너 이미지면 사본은 지금 상태에 채움', st.banner.syncDataUrl === 'data:image/jpeg;base64,NEWFB');
    t.ok('저장·동기화 1회', ctx.writes === 1 && ctx.saves === 1, [ctx.writes, ctx.saves]);
  }
  {
    const { ctx, store, idb } = makeRepairCtx();
    store.return_theme_studio_state_v1 = JSON.stringify({ colors: { accent: '#OLD111' }, banner: { image: 'return-media:b1' } });
    ctx.themeStudioEnsureMediaFallbacks();
    await flush();
    /* 새 테마는 배너까지 바뀜 → 옛 배너용 사본을 넣으면 안 됨 */
    store.return_theme_studio_state_v1 = JSON.stringify({ colors: { accent: '#NEW222' }, banner: { image: 'return-media:b2' } });
    idb('data:image/png;base64,BYTES');
    await flush(); await flush(); await flush();
    const st = JSON.parse(store.return_theme_studio_state_v1);
    t.ok('배너가 바뀌었으면 옛 배너 사본을 넣지 않음', !st.banner.syncDataUrl && st.banner.image === 'return-media:b2');
    t.ok('바꿀 게 없으면 쓰지도·올리지도 않음', ctx.writes === 0 && ctx.saves === 0, [ctx.writes, ctx.saves]);
  }
  t.ok('옛 스냅숏(cur2) 통째 쓰기 제거', html.indexOf('themeStudioWriteJSON(THEME_STUDIO_STATE_KEY,cur2)') < 0);

  /* ── 2) 이미지가 바뀌면 옛 사본 제거 ── */
  {
    const ctx = { cur: null, set: 0, cleared: [] };
    ctx.themeStudioGet = () => JSON.parse(JSON.stringify(ctx.cur));
    ctx.themeStudioSet = (s) => { ctx.cur = s; ctx.set++; };
    ctx.themeStudioClearHomeBannerImage = () => ctx.cleared.push('home');
    ctx.themeStudioClearHobbyBannerImage = () => ctx.cleared.push('hobby');
    vm.createContext(ctx);
    vm.runInContext(sliceBlock(html, 'function themeStudioSetMedia(kind,url){', '\nfunction themeStudioStoreBannerMedia('), ctx);
    ctx.cur = { background: { image: 'return-media:a', syncDataUrl: 'OLDBG' }, banner: { image: 'return-media:h', syncDataUrl: 'OLDH', hobbyImage: 'return-media:y', hobbySyncDataUrl: 'OLDY' } };
    ctx.themeStudioSetMedia('banner', 'return-media:h2');
    t.ok('나 배너 이미지 변경 → 옛 사본 제거', ctx.cur.banner.image === 'return-media:h2' && !('syncDataUrl' in ctx.cur.banner));
    t.ok('취미 배너 사본은 그대로', ctx.cur.banner.hobbySyncDataUrl === 'OLDY');
    ctx.themeStudioSetMedia('hobbyBanner', 'return-media:y2');
    t.ok('취미 배너 이미지 변경 → 옛 사본 제거', !('hobbySyncDataUrl' in ctx.cur.banner));
    ctx.themeStudioSetMedia('background', 'return-media:a');
    t.ok('같은 이미지로 다시 설정하면 사본 유지', ctx.cur.background.syncDataUrl === 'OLDBG');
  }
  {
    const ctx = {
      isReturnDisplayableImageUrl: (u) => /^data:image/.test(String(u || '')),
      themeStudioEnsureIconsState: (st) => { st.icons = st.icons || {}; return st.icons; },
    };
    vm.createContext(ctx);
    vm.runInContext(sliceBlock(html, 'function themeStudioSetIconValue(state,key,value,fallback){', '\nfunction themeStudioSystemPresets('), ctx);
    const st = { icons: { avatar: 'return-media:old' }, iconFallbacks: { avatar: 'data:image/png;base64,OLD' } };
    ctx.themeStudioSetIconValue(st, 'avatar', 'return-media:new', '');
    t.ok('아이콘이 바뀌면(새 사본 없음) 옛 아이콘 사본 제거', !st.iconFallbacks.avatar);
    const st2 = { icons: { avatar: 'return-media:x' }, iconFallbacks: { avatar: 'data:image/png;base64,X' } };
    ctx.themeStudioSetIconValue(st2, 'avatar', 'return-media:x', '');
    t.ok('같은 아이콘이면 사본 유지', st2.iconFallbacks.avatar === 'data:image/png;base64,X');
    ctx.themeStudioSetIconValue(st2, 'avatar', 'return-media:y', 'data:image/png;base64,Y');
    t.ok('새 사본이 오면 그것으로', st2.iconFallbacks.avatar === 'data:image/png;base64,Y');
  }
  t.ok('나 배너 적용: 다른 이미지면 옛 사본 이어 쓰지 않음', /var _hbSame=\(hbState\.imgUrl===ref\);hbState\.imgUrl=ref;hbState\.syncDataUrl=\(state\.banner&&state\.banner\.syncDataUrl\)\|\|\(_hbSame\?hbState\.syncDataUrl:''\)/.test(html));
  t.ok('취미 배너 적용: 다른 이미지인데 새 사본 없으면 옛 사본 비움', /else if\(_prevHob!==ref&&localStorage\.getItem\('hobby_banner_sync_v1'\)\)setReturnStorageItem\('hobby_banner_sync_v1',''\);/.test(html));
  t.ok('테마에서 취미 배너 올리면 사본도 새 것으로', /setReturnStorageItem\('hobby_banner_sync_v1',String\(url\|\|''\)\.length<=HOME_BANNER_SYNC_MAX\?url:''\);/.test(html));

  /* ── 3) settings/main: 바꾼 키만 올림 ── */
  {
    const sets = [];
    const ctx = {
      Object, JSON,
      _fbCloudSettingsSeen: null, local: {},
      fbCollectCloudSettings: () => ({ updatedAtMs: 1, settings: Object.assign({}, ctx.local) }),
      MOVED_CLOUD_SETTING_KEYS: ['return_theme_studio_state_v1'],
      firebase: { firestore: { FieldValue: { delete: () => '__DEL__' } } },
    };
    const ref = { collection: () => ({ doc: () => ({ set: async (payload) => { sets.push(JSON.parse(JSON.stringify(payload))); } }) }) };
    vm.createContext(ctx);
    vm.runInContext(sliceBlock(html, 'async function fbSaveCloudSettings(ref,opts){', '\nfunction fbDocIdForKey('), ctx);
    ctx.local = { return_theme_mode: 'dark', return_theme_color: '#OLD111' };
    let r = await ctx.fbSaveCloudSettings(ref);
    t.ok('클라우드 설정을 아직 못 봤으면 올리지 않음(옛 값 덮기 방지)', r === false && sets.length === 0);
    ctx._fbCloudSettingsSeen = { return_theme_mode: 'dark', return_theme_color: '#OLD111' };
    r = await ctx.fbSaveCloudSettings(ref);
    t.ok('바뀐 게 없으면 쓰지 않음(켜 둔 옛 기기가 남의 변경을 되돌리지 않음)', r === false && sets.length === 0);
    ctx.local = { return_theme_mode: 'light', return_theme_color: '#OLD111' };
    r = await ctx.fbSaveCloudSettings(ref);
    const p = sets[0] && sets[0].settings;
    t.ok('바꾼 키만 올림', r === true && p && p.return_theme_mode === 'light' && !('return_theme_color' in p));
    t.ok('옮긴 키 정리(삭제 표시)는 계속', p && p.return_theme_studio_state_v1 === '__DEL__');
    t.ok('올린 뒤 기준값 갱신', ctx._fbCloudSettingsSeen.return_theme_mode === 'light');
    ctx._fbCloudSettingsSeen = null;
    r = await ctx.fbSaveCloudSettings(ref, { all: true });
    t.ok('첫 업로드(all)는 전부 올림', r === true && sets[1].settings.return_theme_color === '#OLD111' && sets[1].settings.return_theme_mode === 'light');
  }
  t.ok('클라우드 설정 적용 후 기준값 기록', /try\{ _fbCloudSettingsSeen=fbCollectCloudSettings\(\)\.settings; \}catch\(_se\)\{\}/.test(html));
  t.ok('설정 문서가 없으면 다음 저장 때 이 기기 값 업로드', /_fbCloudSettingsSeen=\{\}; \/\* 클라우드에 설정 문서가 없음/.test(html));

  t.done();
})();
