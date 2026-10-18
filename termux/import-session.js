"use strict";

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const session = require('../session');

function notify(title, message) {
    try {
        const result = spawnSync('termux-notification', ['--title', title, '--content', message]);
        if (result.error) {
            console.log('[DEBUG] termux-notification unavailable, skipping notification');
        }
    } catch (error) {
        console.log('[DEBUG] Notification skipped:', error.message);
    }
}

function readPayload() {
    const rest = process.argv.slice(2);
    if (rest.length > 0) {
        return rest.join(' ');
    }

    if (!process.stdin.isTTY) {
        return fs.readFileSync(0, 'utf8');
    }

    return '';
}

function main() {
    const payload = readPayload();

    if (!payload.trim()) {
        throw new Error('No session payload. Paste a Cult.fit cURL command or Cookie header.');
    }

    const imported = session.importSessionPayload(payload);
    const message = `Saved ${imported.keys.join(', ')} to ${session.sessionFilePath()}`;
    console.log(message);
    notify('Cultify: Session saved', 'Cookies updated. The next booking run will use them.');
}

try {
    main();
} catch (error) {
    console.error(error.message);
    notify('Cultify: Session import failed', error.message);
    process.exit(1);
}
