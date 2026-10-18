"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cleanupScript = path.join(__dirname, '..', 'termux', 'cleanup-session-share.sh');

function runCleanup(t, openerContent, previousContent) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cultify-share-cleanup-'));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const bin = path.join(home, 'bin');
    fs.mkdirSync(bin);
    const opener = path.join(bin, 'termux-url-opener');
    const previous = `${opener}.cultify-prev`;

    if (openerContent != null) {
        fs.writeFileSync(opener, openerContent);
    }
    if (previousContent != null) {
        fs.writeFileSync(previous, previousContent);
    }

    const result = spawnSync('bash', [cleanupScript], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home }
    });
    assert.equal(result.status, 0, result.stderr);

    return { opener, previous };
}

test('cleanup restores a share handler backed up by Cultify', t => {
    const { opener, previous } = runCleanup(
        t,
        '#!/bin/bash\n# cultify-url-opener\n',
        '#!/bin/bash\ncustom-handler\n'
    );

    assert.equal(fs.readFileSync(opener, 'utf8'), '#!/bin/bash\ncustom-handler\n');
    assert.equal(fs.existsSync(previous), false);
});

test('cleanup removes only the obsolete Cultify share handler', t => {
    const { opener, previous } = runCleanup(
        t,
        '#!/bin/bash\n# cultify-url-opener\n',
        null
    );

    assert.equal(fs.existsSync(opener), false);
    assert.equal(fs.existsSync(previous), false);
});

test('cleanup preserves an unrelated share handler', t => {
    const customHandler = '#!/bin/bash\ncustom-handler\n';
    const { opener } = runCleanup(t, customHandler, null);

    assert.equal(fs.readFileSync(opener, 'utf8'), customHandler);
});
