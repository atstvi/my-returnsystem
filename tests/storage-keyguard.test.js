'use strict';
/* Invalid-key guard in setReturnStorageItem. A caller passing an undefined/null
   key used to coerce to the literal "undefined"/"null" and create a junk key
   (a 131KB base64 image was found stored under "undefined"). The guard must
   reject such writes (return false, no junk write) while leaving valid writes
   working. Loads the real function from index.html with light stubs — the
   guard branch returns before the quota/IDB machinery is reached. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function setReturnStorageItem(key,value){', '\nvar HOME_BANNER_SYNC_MAX');

const store = {};
const ls = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
let lastHealth = null;
const sandbox = {
  window: {},
  console: { error() {}, warn() {}, log() {} },
  localStorage: ls,
  _rawSetItem: (k, v) => { store[k] = String(v); },
  _idbCache: {},
  _idbDelete: () => {},
  bannerDebugLog: () => {},
  __storageHealthRecord: (ev) => { lastHealth = ev; },
  __clearStaleQuota: () => {},
  shouldFbSyncKey: () => false,
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { setReturnStorageItem } = sandbox;

const t = runner('Storage invalid-key guard');

t.ok('rejects undefined key', setReturnStorageItem(undefined, 'data:image/png;base64,AAAA') === false);
t.ok('rejects null key', setReturnStorageItem(null, 'x') === false);
t.ok('rejects empty-string key', setReturnStorageItem('', 'x') === false);
t.ok('rejects literal "undefined" key', setReturnStorageItem('undefined', 'x') === false);
t.ok('rejects literal "null" key', setReturnStorageItem('null', 'x') === false);
t.ok('no junk key written to store', !('undefined' in store) && !('null' in store) && !('' in store));
t.ok('rejection recorded to health as invalid-key', lastHealth && lastHealth.mode === 'rejected' && lastHealth.error === 'invalid-key', lastHealth);

t.ok('valid key still writes', setReturnStorageItem('task_items_v1', '[]') === true && store.task_items_v1 === '[]');
t.ok('key "undefinedX" is allowed (only exact match rejected)', setReturnStorageItem('undefinedX', '1') === true && store.undefinedX === '1');

t.done();
