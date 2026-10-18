"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const session = require('../session');

test('imports allowlisted cookies from a curl Cookie header', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cultify-session-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, '.cultify-session');
    const curl = [
        "curl 'https://next.cult.fit/listings-api/search?slug=gyms-in-bangalore'",
        "  --compressed",
        "  -H 'User-Agent: test-browser'",
        "  -H 'Cookie: cf_clearance=ignored; deviceId=device-1; st=CFAPP%3Astate-1; at=CFAPP%3Aaccess-1; cityId=bangalore; userId=user-1; janus_session=session-1'"
    ].join(' \\\n');

    const imported = session.importSessionPayload(curl, filePath);

    assert.deepEqual(imported.keys, ['at', 'st', 'deviceId', 'userId', 'cityId', 'janus_session']);
    assert.equal(imported.cookies.includes('cf_clearance'), false);
    assert.deepEqual(session.loadSession(filePath), { cookies: imported.cookies, authorization: '' });
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
    }
});

test('rejects curl payloads without both authentication cookies', () => {
    assert.throws(
        () => session.importSessionPayload("curl 'https://next.cult.fit/' -H 'Cookie: at=access-only'"),
        /missing at\/st cookies/
    );
});

test('an imported session overrides bootstrap cookies and authorization', () => {
    const bootstrap = { cookies: 'at=old; st=old', authorization: 'old-auth', apiKey: 'keep' };
    const imported = { cookies: 'at=new; st=new', authorization: 'new-auth' };

    assert.deepEqual(session.overlaySavedSession(bootstrap, imported), {
        cookies: 'at=new; st=new',
        authorization: 'new-auth',
        apiKey: 'keep'
    });
    assert.deepEqual(session.overlaySavedSession(bootstrap, { cookies: 'at=new; st=new' }), {
        cookies: 'at=new; st=new',
        authorization: '',
        apiKey: 'keep'
    });
    assert.deepEqual(session.overlaySavedSession(bootstrap, null), bootstrap);
});
