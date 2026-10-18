"use strict";

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const generatorPath = path.join(__dirname, '..', 'scripts', 'print-bookmarklet.js');
const bookmarklet = execFileSync(process.execPath, [generatorPath], { encoding: 'utf8' })
    .trim()
    .replace(/^javascript:/, '');

function makeContext(userAgent, clipboard, share, cookies = 'at=access; st=session') {
    const alerts = [];
    const prompts = [];
    const context = {
        document: { cookie: cookies },
        localStorage: { getItem: () => null },
        sessionStorage: { getItem: () => null },
        navigator: { userAgent, clipboard, share },
        alert: message => alerts.push(message),
        prompt: (...args) => prompts.push(args)
    };
    return { context, alerts, prompts };
}

test('Firefox bookmarklet copies the payload instead of opening the share flow', async () => {
    let copiedPayload;
    let shared = false;
    const { context, alerts } = makeContext(
        'Mozilla/5.0 Firefox/140.0',
        { writeText: payload => {
            copiedPayload = payload;
            return Promise.resolve();
        } },
        () => {
            shared = true;
            return Promise.resolve();
        }
    );

    vm.runInNewContext(bookmarklet, context);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(shared, false);
    assert.match(copiedPayload, /^cultify-session:v1\n/);
    assert.match(copiedPayload, /at=access/);
    assert.match(copiedPayload, /st=session/);
    assert.match(alerts[0], /bash termux\/paste-session\.sh/);
});

test('other browsers keep the direct share flow', () => {
    let sharedPayload;
    const { context } = makeContext(
        'Mozilla/5.0 Chrome/140.0',
        { writeText: () => Promise.resolve() },
        payload => {
            sharedPayload = payload;
            return Promise.resolve();
        }
    );

    vm.runInNewContext(bookmarklet, context);

    assert.match(sharedPayload.text, /^cultify-session:v1\n/);
});

test('bookmarklet explains when the browser hides authentication cookies', () => {
    let copied = false;
    let shared = false;
    const { context, alerts, prompts } = makeContext(
        'Mozilla/5.0 Firefox/140.0',
        { writeText: () => {
            copied = true;
            return Promise.resolve();
        } },
        () => {
            shared = true;
            return Promise.resolve();
        },
        ''
    );

    vm.runInNewContext(bookmarklet, context);

    assert.equal(copied, false);
    assert.equal(shared, false);
    assert.deepEqual(prompts, []);
    assert.match(alerts[0], /required at\/st login cookies/);
    assert.match(alerts[0], /CURL_COMMAND/);
});
