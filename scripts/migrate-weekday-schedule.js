"use strict";

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
require('dotenv').config();

const SCHEDULE_PATH = process.env.SCHEDULE_FILE
    ? path.resolve(process.env.SCHEDULE_FILE)
    : path.join(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'schedule.local.yml'))
        ? 'schedule.local.yml'
        : 'schedule.yml');
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ALIASES = {
    sun: 'sunday', sunday: 'sunday',
    mon: 'monday', monday: 'monday',
    tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
    wed: 'wednesday', wednesday: 'wednesday',
    thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
    fri: 'friday', friday: 'friday',
    sat: 'saturday', saturday: 'saturday'
};

function convertWeekdaySchedule(raw) {
    if (raw == null) {
        return null;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('schedule.yml must contain a weekday mapping or a config list');
    }
    if (Object.prototype.hasOwnProperty.call(raw, 'config')) {
        return null;
    }

    const groupsByDay = new Map();
    for (const [key, value] of Object.entries(raw)) {
        const day = DAY_ALIASES[String(key).trim().toLowerCase()];
        if (!day) {
            throw new Error(`Unknown weekday "${key}" in schedule.yml`);
        }
        if (value == null) {
            continue;
        }
        const groups = Array.isArray(value) ? value : [value];
        groupsByDay.set(day, groups);
    }

    const entriesByPosition = new Map();
    for (const day of WEEKDAYS) {
        const groups = groupsByDay.get(day) || [];
        groups.forEach((group, index) => {
            if (group == null || typeof group !== 'object' || Array.isArray(group)) {
                throw new Error(`Invalid schedule.yml entry for ${day}: each item needs workout and slots`);
            }
            if (!entriesByPosition.has(index)) {
                entriesByPosition.set(index, new Map());
            }

            const entries = entriesByPosition.get(index);
            const signature = JSON.stringify(group);
            if (!entries.has(signature)) {
                entries.set(signature, { ...group, days: [] });
            }
            entries.get(signature).days.push(day);
        });
    }

    const config = [...entriesByPosition.entries()]
        .sort(([left], [right]) => left - right)
        .flatMap(([, entries]) => [...entries.values()]);
    return { config };
}

function main() {
    if (!fs.existsSync(SCHEDULE_PATH)) {
        console.log(`No schedule file found at ${SCHEDULE_PATH}; skipping schedule migration.`);
        return;
    }

    let raw;
    try {
        raw = yaml.load(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse ${SCHEDULE_PATH}: ${error.message}`);
    }

    const converted = convertWeekdaySchedule(raw);
    if (!converted) {
        console.log(`${path.basename(SCHEDULE_PATH)} already uses the config list format.`);
        return;
    }

    const backupPath = `${SCHEDULE_PATH}.pre-2.0.0`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(SCHEDULE_PATH, backupPath);
        console.log(`Backed up ${path.basename(SCHEDULE_PATH)} to ${backupPath}`);
    } else {
        console.log(`Keeping existing backup at ${backupPath}`);
    }

    const temporaryPath = `${SCHEDULE_PATH}.tmp`;
    fs.writeFileSync(temporaryPath, yaml.dump(converted, { lineWidth: -1, noRefs: true }));
    fs.renameSync(temporaryPath, SCHEDULE_PATH);
    console.log(`Converted ${path.basename(SCHEDULE_PATH)} to the config list format.`);
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { convertWeekdaySchedule };