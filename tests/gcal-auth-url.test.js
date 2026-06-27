'use strict';
/* GCal OAuth URL builder — gcalBuildAuthUrl: shared by the desktop popup flow and
   the mobile/PWA same-window redirect flow. Verifies the PKCE (code) vs implicit
   (token) parameter sets and proper encoding. Loads the real pure function out of
   index.html. */
const { readIndex, sliceBlock, runner } = require('./lib');
const vm = require('vm');

const html = readIndex();
const block = sliceBlock(html, 'function gcalBuildAuthUrl(', 'function _gcalUseRedirectAuthFlow(');

const sandbox = { console, encodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(block, sandbox);
const { gcalBuildAuthUrl } = sandbox;

const t = runner('gcal — gcalBuildAuthUrl');

// PKCE / Authorization Code mode (Desktop-app client + secret → refresh_token)
let u = gcalBuildAuthUrl({ clientId: 'cid.apps', redirect: 'https://a.io/app/', state: 'st1', mode: 'code', codeChallenge: 'CH' });
t.ok('code: authorize endpoint', u.indexOf('https://accounts.google.com/o/oauth2/v2/auth?') === 0, u);
t.ok('code: response_type=code', u.indexOf('response_type=code') >= 0, u);
t.ok('code: access_type=offline (→ refresh_token)', u.indexOf('access_type=offline') >= 0, u);
t.ok('code: prompt=consent (force refresh_token)', u.indexOf('prompt=consent') >= 0, u);
t.ok('code: PKCE challenge + method', u.indexOf('code_challenge=CH') >= 0 && u.indexOf('code_challenge_method=S256') >= 0, u);
t.ok('code: NOT implicit', u.indexOf('response_type=token') < 0, u);
t.ok('code: client_id present', u.indexOf('client_id=cid.apps') >= 0, u);
t.ok('code: redirect_uri encoded', u.indexOf('redirect_uri=https%3A%2F%2Fa.io%2Fapp%2F') >= 0, u);
t.ok('code: state present', u.indexOf('state=st1') >= 0, u);
t.ok('code: scope encoded', u.indexOf('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events') >= 0, u);

// Implicit / token mode (no secret → ~1h, no refresh)
u = gcalBuildAuthUrl({ clientId: 'cid', redirect: 'https://a.io/', state: 'st2', mode: 'token' });
t.ok('token: response_type=token', u.indexOf('response_type=token') >= 0, u);
t.ok('token: include_granted_scopes', u.indexOf('include_granted_scopes=true') >= 0, u);
t.ok('token: no access_type', u.indexOf('access_type') < 0, u);
t.ok('token: no prompt=consent', u.indexOf('prompt=consent') < 0, u);
t.ok('token: no code_challenge', u.indexOf('code_challenge') < 0, u);

// Defaults: missing mode → implicit; missing fields don't throw
u = gcalBuildAuthUrl({});
t.ok('no mode → token', u.indexOf('response_type=token') >= 0, u);
t.ok('empty args safe', u.indexOf('client_id=') >= 0 && u.indexOf('state=') >= 0, u);
u = gcalBuildAuthUrl();
t.ok('no args safe', typeof u === 'string' && u.indexOf('oauth2/v2/auth') >= 0, u);

t.done();
