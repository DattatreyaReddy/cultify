"use strict";

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function parseVersion(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) {
        throw new Error(`Invalid version "${value}"; expected major.minor.patch`);
    }
    return match.slice(1).map(Number);
}

function compareVersions(left, right) {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);
    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] - rightParts[index];
        }
    }
    return 0;
}

function main() {
    const [appliedVersion, targetVersion] = process.argv.slice(2);
    if (!appliedVersion || !targetVersion) {
        throw new Error('Usage: node scripts/run-migrations.js <applied-version> <target-version>');
    }
    if (compareVersions(appliedVersion, targetVersion) > 0) {
        throw new Error(`Installed version ${appliedVersion} is newer than target ${targetVersion}`);
    }

    const migrations = fs.readdirSync(MIGRATIONS_DIR)
        .filter(name => /^\d+\.\d+\.\d+\.sh$/.test(name))
        .map(name => ({
            version: name.slice(0, -3),
            filePath: path.join(MIGRATIONS_DIR, name)
        }))
        .filter(migration => compareVersions(migration.version, appliedVersion) > 0
            && compareVersions(migration.version, targetVersion) <= 0)
        .sort((left, right) => compareVersions(left.version, right.version));

    if (migrations.length === 0) {
        console.log('No migrations to run.');
        return;
    }

    for (const migration of migrations) {
        console.log(`==> Running migration ${migration.version}...`);
        const result = spawnSync('bash', [migration.filePath], {
            cwd: ROOT,
            stdio: 'inherit'
        });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            process.exit(result.status || 1);
        }
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}