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
    if (process.argv.includes('--clipboard')) {
        const result = spawnSync('termux-clipboard-get', { encoding: 'utf8' });
        if (result.error || result.status !== 0) {
            throw new Error('Could not read the clipboard. Install Termux:API or paste a curl instead.');
        }
        return result.stdout || '';
    }

    const rest = process.argv.slice(2).filter(arg => arg !== '--maybe' && arg !== '--clipboard');
    if (rest.length > 0) {
        return rest.join(' ');
    }

    if (!process.stdin.isTTY) {
        return fs.readFileSync(0, 'utf8');
    }

    return '';
}

function main() {
    const maybe = process.argv.includes('--maybe');
    const payload = readPayload();

    if (maybe && !session.isSessionPayload(payload)) {
        process.exit(2);
    }

    if (!payload.trim()) {
        throw new Error('No session payload. Share from the bookmarklet, or paste a cult.fit curl / Cookie header.');
    }

    const imported = session.importSessionPayload(payload);
    const message = `Saved ${imported.keys.join(', ')} to .cultify-session`;
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
