"use strict";

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const SESSION_FILE = path.join(__dirname, '.cultify-session');
const SESSION_COOKIE_KEYS = [
    'at',
    'st',
    'deviceId',
    'userId',
    'cityId',
    'janus_session',
    'janus_preferred_city_id',
    'janus_browse_location_lat',
    'janus_browse_location_lon'
];

function sessionFilePath() {
    return SESSION_FILE;
}

function parseCookieString(raw) {
    const map = new Map();
    if (!raw) {
        return map;
    }
    String(raw).split(';').forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) {
            return;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            return;
        }
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (key) {
            map.set(key, value);
        }
    });
    return map;
}

function cookieMapToString(map) {
    return [...map.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function extractSessionCookies(map) {
    const out = new Map();
    for (const key of SESSION_COOKIE_KEYS) {
        if (map.has(key) && map.get(key)) {
            out.set(key, map.get(key));
        }
    }
    return out;
}

function hasAtAndSt(map) {
    return Boolean(map.get('at') && map.get('st'));
}

function extractHeader(curlString, name) {
    const regex = new RegExp(`(?:-H|--header)\\s+['"]?${name}:\\s*([^'"\\\\]+)`, 'i');
    const match = String(curlString).match(regex);
    return match ? match[1].trim() : '';
}

function extractCookiesFromCurl(curlString) {
    const fromHeader = extractHeader(curlString, 'cookie');
    if (fromHeader) {
        return fromHeader;
    }
    const cookieMatchB = String(curlString).match(/-b\s+['"]([^'"]+)['"]/);
    return cookieMatchB ? cookieMatchB[1] : '';
}

function stripPayloadPrefix(text) {
    return String(text || '').replace(/^\s*cultify-session:v1\s*/i, '').trim();
}

function cookiesFromPayload(text) {
    let raw = stripPayloadPrefix(text);
    if (!raw) {
        return new Map();
    }

    if (/^\s*curl\s+/i.test(raw) || /https?:\/\/[^\s]*cult\.fit/i.test(raw)) {
        const fromCurl = extractCookiesFromCurl(raw);
        if (fromCurl) {
            raw = fromCurl;
        }
    }

    raw = raw.replace(/^(?:Cookie|cookie)\s*:\s*/i, '').trim();
    return parseCookieString(raw);
}

function isSessionPayload(text) {
    const raw = String(text || '').trim();
    if (!raw) {
        return false;
    }
    if (/^cultify-session:v1/i.test(raw)) {
        return true;
    }
    if (/^\s*curl\s+/i.test(raw) && /cult\.fit/i.test(raw)) {
        return true;
    }
    return /\bat=/i.test(raw) && /\bst=/i.test(raw);
}

function loadSession(filePath = SESSION_FILE) {
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw new Error(`Unable to read session file ${filePath}: ${error.message}`, { cause: error });
    }

    if (!raw) {
        throw new Error(`Session file ${filePath} is empty. Import a fresh session from next.cult.fit.`);
    }

    if (raw.startsWith('{')) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new Error(`Session file ${filePath} contains invalid JSON: ${error.message}`, { cause: error });
        }
        if (!parsed || typeof parsed.cookies !== 'string' || !parsed.cookies.trim()) {
            throw new Error(`Session file ${filePath} has an invalid cookies field. Import a fresh session from next.cult.fit.`);
        }
        if (parsed.authorization != null && typeof parsed.authorization !== 'string') {
            throw new Error(`Session file ${filePath} has an invalid authorization field.`);
        }
        return { cookies: parsed.cookies, authorization: parsed.authorization || '' };
    }

    const line = raw.match(/^cookies=(.*)$/im);
    const cookies = line ? line[1].trim() : raw;
    if (!cookies) {
        throw new Error(`Session file ${filePath} contains no cookies. Import a fresh session from next.cult.fit.`);
    }
    return { cookies, authorization: '' };
}

function saveSession({ cookies, authorization }, filePath = SESSION_FILE) {
    const payload = {
        cookies,
        updatedAt: new Date().toISOString()
    };
    if (authorization) {
        payload.authorization = authorization;
    }
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2) + '\n', {
            encoding: 'utf8',
            flag: 'wx',
            mode: 0o600
        });
        fs.renameSync(temporaryPath, filePath);
    } catch (error) {
        try {
            fs.unlinkSync(temporaryPath);
        } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
                throw new AggregateError([error, cleanupError], `Unable to save or clean up session file ${filePath}`);
            }
        }
        throw new Error(`Unable to save session file ${filePath}: ${error.message}`, { cause: error });
    }
}

function importSessionPayload(text, filePath = SESSION_FILE) {
    const map = extractSessionCookies(cookiesFromPayload(text));
    if (!hasAtAndSt(map)) {
        throw new Error('Session payload is missing at/st cookies. Log in on next.cult.fit and share or paste a curl / Cookie header.');
    }
    const cookies = cookieMapToString(map);
    saveSession({ cookies }, filePath);
    return {
        cookies,
        keys: [...map.keys()]
    };
}

function injectCityCookie(cookies, preferredCity) {
    if (!cookies) {
        return cookies;
    }
    if (!cookies.includes('city=')) {
        return `${cookies}; city=${preferredCity || 'Hyderabad'};`;
    }
    return cookies;
}

function overlaySavedSession(config, savedSession) {
    if (!savedSession?.cookies) {
        return config;
    }
    return {
        ...config,
        cookies: savedSession.cookies,
        authorization: savedSession.authorization || ''
    };
}

module.exports = {
    SESSION_FILE,
    sessionFilePath,
    parseCookieString,
    cookieMapToString,
    extractSessionCookies,
    hasAtAndSt,
    extractCookiesFromCurl,
    cookiesFromPayload,
    isSessionPayload,
    loadSession,
    saveSession,
    importSessionPayload,
    injectCityCookie,
    overlaySavedSession
};
