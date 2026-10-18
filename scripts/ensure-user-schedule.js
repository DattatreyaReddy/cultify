"use strict";

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');

function ensureUserSchedule(root = ROOT, env = process.env) {
    if (env.SCHEDULE_FILE) {
        console.log(`Using custom schedule file from SCHEDULE_FILE: ${path.resolve(root, env.SCHEDULE_FILE)}`);
        return null;
    }

    const templatePath = path.join(root, 'schedule.yml');
    const userSchedulePath = path.join(root, 'schedule.local.yml');
    if (fs.existsSync(userSchedulePath)) {
        console.log(`Keeping existing user schedule at ${userSchedulePath}`);
        return userSchedulePath;
    }
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Schedule template not found: ${templatePath}`);
    }

    fs.copyFileSync(templatePath, userSchedulePath, fs.constants.COPYFILE_EXCL);
    console.log(`Created personal schedule at ${userSchedulePath}; edit this file to set your preferences.`);
    return userSchedulePath;
}

if (require.main === module) {
    try {
        ensureUserSchedule();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { ensureUserSchedule };
