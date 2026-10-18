"use strict";

const fs = require('node:fs');
const path = require('node:path');

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

function parseEnvFile(raw) {
    const vars = {};
    for (const line of String(raw).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            continue;
        }
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        vars[key] = value;
    }
    return vars;
}

function yamlQuote(value) {
    return JSON.stringify(String(value));
}

function buildScheduleYaml(workouts, slots) {
    const workoutBlock = workouts.length === 1
        ? `    - workout: ${yamlQuote(workouts[0])}\n      slots: [${slots.map(yamlQuote).join(', ')}]\n`
        : `    - workouts:\n${workouts.map(w => `        - ${yamlQuote(w)}`).join('\n')}\n      slots: [${slots.map(yamlQuote).join(', ')}]\n`;

    let yaml = '# Migrated from PREFERRED_WORKOUT / PREFERRED_SLOTS by termux/upgrade.sh (1.1.0).\n';
    yaml += '# Edit per weekday as needed. Days you omit are skipped.\n\n';
    for (const day of WEEKDAYS) {
        yaml += `${day}:\n${workoutBlock}\n`;
    }
    return yaml;
}

function commentOutLegacyVars(raw, schedulePath) {
    const keys = new Set(['PREFERRED_SLOTS', 'PREFERRED_WORKOUT', 'PREFERRED_SCHEDULE']);
    let touched = false;
    const lines = String(raw).split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            return line;
        }
        const key = trimmed.split('=')[0].trim();
        if (keys.has(key)) {
            touched = true;
            return `# Migrated to ${path.basename(schedulePath)} (1.1.0)\n# ${line}`;
        }
        return line;
    });
    return { text: lines.join('\n'), touched };
}

function main() {
    if (!fs.existsSync(ENV_PATH)) {
        console.log('No .env found; skipping schedule migration.');
        return;
    }

    const envRaw = fs.readFileSync(ENV_PATH, 'utf8');
    const vars = parseEnvFile(envRaw);
    const SCHEDULE_PATH = vars.SCHEDULE_FILE
        ? path.resolve(ROOT, vars.SCHEDULE_FILE)
        : path.join(ROOT, 'schedule.local.yml');
    const slots = (vars.PREFERRED_SLOTS || '').split(',').map(s => s.trim()).filter(Boolean);
    const workouts = (vars.PREFERRED_WORKOUT || '').split(',').map(s => s.trim()).filter(Boolean);

    if (slots.length === 0 && workouts.length === 0) {
        console.log(`No PREFERRED_SLOTS / PREFERRED_WORKOUT in .env; leaving ${path.basename(SCHEDULE_PATH)} as-is.`);
        return;
    }

    const resolvedSlots = slots.length ? slots : ['07:00:00', '08:00:00', '09:00:00'];
    const resolvedWorkouts = workouts.length ? workouts : ['HRX WORKOUT'];

    if (fs.existsSync(SCHEDULE_PATH)) {
        fs.copyFileSync(SCHEDULE_PATH, `${SCHEDULE_PATH}.pre-1.1.0`);
        console.log(`Backed up ${path.basename(SCHEDULE_PATH)} to ${path.basename(SCHEDULE_PATH)}.pre-1.1.0`);
    }
    fs.writeFileSync(SCHEDULE_PATH, buildScheduleYaml(resolvedWorkouts, resolvedSlots));
    console.log(`Wrote ${path.basename(SCHEDULE_PATH)} from .env (${resolvedWorkouts.join(', ')} @ ${resolvedSlots.join(', ')}) for every weekday.`);

    const commented = commentOutLegacyVars(envRaw, SCHEDULE_PATH);
    if (commented.touched) {
        fs.copyFileSync(ENV_PATH, `${ENV_PATH}.pre-1.1.0`);
        fs.writeFileSync(ENV_PATH, commented.text);
        console.log('Commented out PREFERRED_SLOTS / PREFERRED_WORKOUT in .env (backup: .env.pre-1.1.0).');
    }
}

if (require.main === module) {
    main();
}

module.exports = { commentOutLegacyVars };
