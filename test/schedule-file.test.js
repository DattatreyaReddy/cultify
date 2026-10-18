"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ensureUserSchedule } = require('../scripts/ensure-user-schedule');
const { commentOutLegacyVars } = require('../scripts/migrate-env-schedule');

test('creates a personal schedule from the tracked template only when missing', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cultify-schedule-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const template = path.join(root, 'schedule.yml');
    const local = path.join(root, 'schedule.local.yml');
    fs.writeFileSync(template, 'config:\n  - workout: template\n');

    assert.equal(ensureUserSchedule(root, {}), local);
    assert.equal(fs.readFileSync(local, 'utf8'), fs.readFileSync(template, 'utf8'));

    fs.writeFileSync(local, 'config:\n  - workout: personal\n');
    assert.equal(ensureUserSchedule(root, {}), local);
    assert.match(fs.readFileSync(local, 'utf8'), /personal/);
});

test('does not create the default personal schedule when SCHEDULE_FILE is configured', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cultify-schedule-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'schedule.yml'), 'config: []\n');

    assert.equal(ensureUserSchedule(root, { SCHEDULE_FILE: 'custom.yml' }), null);
    assert.equal(fs.existsSync(path.join(root, 'schedule.local.yml')), false);
});

test('legacy schedule settings refer to the resolved personal schedule in migration notes', () => {
    const migrated = commentOutLegacyVars('PREFERRED_WORKOUT=HRX WORKOUT\n', '/repo/schedule.local.yml');

    assert.equal(migrated.touched, true);
    assert.match(migrated.text, /Migrated to schedule\.local\.yml/);
});
