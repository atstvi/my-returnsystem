'use strict';
/* GCal token auto-refresh hardening — gcalIsRefreshRevoked: a failed refresh must
   only drop the stored refresh_token when Google says invalid_grant (truly
   revoked), NOT on transient errors (network/5xx/rate-limit). Otherwise a brief
   blip forces a full manual re-login (the recurring "토큰 만료" nag). Loads the
   real pure function out of index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function gcalIsRefreshRevoked(', 'async function gcalRefreshAccessToken(');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { gcalIsRefreshRevoked } = sandbox;

const t = runner('gcal — gcalIsRefreshRevoked');

// Revoked: Google returns invalid_grant → drop the token
t.ok('invalid_grant → revoked', gcalIsRefreshRevoked(400, '{"error":"invalid_grant"}') === true);
t.ok('invalid_grant (text) → revoked', gcalIsRefreshRevoked(400, 'error=invalid_grant&...') === true);
t.ok('invalid_grant case-insensitive', gcalIsRefreshRevoked(401, 'Invalid_Grant') === true);

// Transient: must NOT revoke (token stays for the next silent attempt)
t.ok('500 server error → keep', gcalIsRefreshRevoked(500, 'Internal Server Error') === false);
t.ok('503 → keep', gcalIsRefreshRevoked(503, '{"error":"unavailable"}') === false);
t.ok('429 rate-limit → keep', gcalIsRefreshRevoked(429, 'rateLimitExceeded') === false);
t.ok('empty body → keep', gcalIsRefreshRevoked(0, '') === false);
t.ok('null body → keep', gcalIsRefreshRevoked(500, null) === false);
t.ok('other oauth error (invalid_scope) → keep', gcalIsRefreshRevoked(400, '{"error":"invalid_scope"}') === false);

t.done();
