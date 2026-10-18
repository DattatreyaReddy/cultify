require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const session = require('./session');

function parseCurlCommand(curlString) {
    const config = {
        apiKey: "",
        appVersion: "",
        browserName: "",
        osName: "",
        timezone: "",
        cookies: "",
        userAgent: "",
        referer: "",
        authorization: ""
    };

    // Helper function to extract headers more robustly
    const extractHeader = (name) => {
        // Matches -H 'name: value' or --header "name: value"
        const regex = new RegExp(`(?:-H|--header)\\s+['"]?${name}:\\s*([^'"\\\\]+)`, 'i');
        const match = curlString.match(regex);
        return match ? match[1].trim() : "";
    };

    config.apiKey = extractHeader('apikey') || "9d153009-e961-4718-a343-2a36b0a1d1fd";
    config.appVersion = extractHeader('appversion') || "7";
    config.browserName = extractHeader('browsername') || "Chrome";
    config.osName = extractHeader('osname') || "browser";
    config.timezone = extractHeader('timezone') || "Asia/Kolkata";
    config.userAgent = extractHeader('user-agent');
    config.referer = extractHeader('referer');
    config.authorization = extractHeader('authorization');

    // Parse cookies from either -b flag or -H cookie: header
    const cookieMatchB = curlString.match(/-b\s+['"]([^'"]+)['"]/);
    const cookieMatchH = extractHeader('cookie');
    
    if (cookieMatchH) {
        config.cookies = cookieMatchH;
    } else if (cookieMatchB) {
        config.cookies = cookieMatchB[1];
    }
    
    // Inject city cookie if missing to prevent geolocation errors on GitHub Actions
    const preferredCity = process.env.PREFERRED_CITY || 'Hyderabad';
    if (config.cookies && !config.cookies.includes('city=')) {
        config.cookies += `; city=${preferredCity};`;
    }

    return config;
}

let config;

if (process.env.CURL_COMMAND) {
    config = parseCurlCommand(process.env.CURL_COMMAND);
} else if (process.env.COOKIES) {
    config = {
        apiKey: process.env.API_KEY || "9d153009-e961-4718-a343-2a36b0a1d1fd",
        appVersion: process.env.APP_VERSION || "7",
        browserName: process.env.BROWSER_NAME || "Chrome",
        osName: process.env.OS_NAME || "browser",
        timezone: process.env.TIMEZONE || "Asia/Kolkata",
        cookies: process.env.COOKIES
    };
} else {
    throw new Error(
        "No credentials found!\n\n" +
        "Please set CURL_COMMAND environment variable.\n" +
        "For GitHub Actions: Add it as a repository secret.\n" +
        "For local testing: export CURL_COMMAND='your curl command here'\n\n" +
        "See SETUP.md for instructions."
    );
}

const DAY_ALIASES = {
    sun: 'sunday', sunday: 'sunday',
    mon: 'monday', monday: 'monday',
    tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
    wed: 'wednesday', wednesday: 'wednesday',
    thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
    fri: 'friday', friday: 'friday',
    sat: 'saturday', saturday: 'saturday'
};

function formatHms(hour, minute, second) {
    if (hour > 23 || minute > 59 || second > 59) {
        throw new Error(`Invalid time: ${hour}:${minute}:${second}`);
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function parseTimeToken(token) {
    const raw = String(token).trim();
    if (!raw) {
        throw new Error('Empty time slot in schedule.yml');
    }

    const ampm = raw.match(/^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i);
    if (ampm) {
        let hour = parseInt(ampm[1], 10);
        const minute = parseInt(ampm[2] || '0', 10);
        const second = parseInt(ampm[3] || '0', 10);
        const meridiem = ampm[4].toLowerCase();
        if (hour < 1 || hour > 12) {
            throw new Error(`Invalid time slot: ${token}`);
        }
        if (hour === 12) {
            hour = meridiem === 'am' ? 0 : 12;
        } else if (meridiem === 'pm') {
            hour += 12;
        }
        return formatHms(hour, minute, second);
    }

    const hms = raw.match(/^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?$/);
    if (!hms) {
        throw new Error(`Invalid time slot: ${token}`);
    }
    return formatHms(parseInt(hms[1], 10), parseInt(hms[2] || '0', 10), parseInt(hms[3] || '0', 10));
}

function asList(value) {
    if (value == null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function normalizeGroup(group, day) {
    if (group == null || typeof group !== 'object' || Array.isArray(group)) {
        throw new Error(`Invalid schedule.yml entry for ${day}: each item needs workout and slots`);
    }

    const workouts = asList(group.workouts ?? group.workout)
        .map(name => String(name).trim())
        .filter(Boolean);
    const slots = asList(group.slots)
        .flatMap(slot => String(slot).split(','))
        .map(slot => slot.trim())
        .filter(Boolean)
        .map(parseTimeToken);

    if (workouts.length === 0) {
        throw new Error(`Missing workout name for ${day} in schedule.yml`);
    }
    if (slots.length === 0) {
        throw new Error(`Missing time slots for ${day} in schedule.yml`);
    }

    return { workouts, slots };
}

function normalizeSchedule(raw) {
    if (raw == null) {
        return {};
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('schedule.yml must be a mapping of weekdays to workout/slot lists');
    }

    const schedule = {};
    for (const [key, value] of Object.entries(raw)) {
        const day = DAY_ALIASES[String(key).trim().toLowerCase()];
        if (!day) {
            throw new Error(`Unknown weekday "${key}" in schedule.yml`);
        }
        if (value == null) {
            continue;
        }

        const groups = Array.isArray(value)
            ? value.map(group => normalizeGroup(group, day))
            : [normalizeGroup(value, day)];

        schedule[day] = groups;
    }

    return schedule;
}

function resolveSchedulePath() {
    if (process.env.SCHEDULE_FILE) {
        return path.resolve(process.env.SCHEDULE_FILE);
    }
    return path.join(__dirname, 'schedule.yml');
}

function loadPreferredSchedule() {
    const filePath = resolveSchedulePath();
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Schedule file not found: ${filePath}\n` +
            'Create schedule.yml in the repo root (see the example in the README).'
        );
    }

    let raw;
    try {
        raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${error.message}`);
    }

    console.log(`[DEBUG] Loaded schedule from ${filePath}`);
    return normalizeSchedule(raw);
}

if (process.env.PREFERRED_SCHEDULE || process.env.PREFERRED_SLOTS || process.env.PREFERRED_WORKOUT) {
    console.log('[DEBUG] PREFERRED_SCHEDULE / PREFERRED_SLOTS / PREFERRED_WORKOUT are no longer used. Edit schedule.yml instead.');
}

const savedSession = session.loadSession();
if (savedSession?.cookies) {
    config.cookies = savedSession.cookies;
    console.log(`[DEBUG] Using cookies from ${session.sessionFilePath()}`);
}
if (savedSession?.authorization) {
    config.authorization = savedSession.authorization;
}

const preferredCity = process.env.PREFERRED_CITY || 'Hyderabad';
config.cookies = session.injectCityCookie(config.cookies, preferredCity);

console.log("--- DEBUG INFO ---");
console.log("Cookies parsed?", !!config.cookies);
console.log("API Key parsed/defaulted?", !!config.apiKey);
console.log("Auth header parsed?", !!config.authorization);
console.log("Session file?", !!savedSession?.cookies);
console.log("------------------");

config.preferredCenter = process.env.PREFERRED_CENTER ? parseInt(process.env.PREFERRED_CENTER) : null;
config.preferredSchedule = loadPreferredSchedule();
config.enableWaitlist = process.env.ENABLE_WAITLIST !== 'false';

module.exports = config;
