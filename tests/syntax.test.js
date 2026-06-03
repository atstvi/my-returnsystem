'use strict';
/* Guards against shipping a syntax error in the single-file app. */
const { assertSyntaxOk } = require('./lib');

const r = assertSyntaxOk();
console.log(`\nSYNTAX OK — ${r.blocks} inline script block(s), ${r.chars} chars`);
