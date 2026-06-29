require('dotenv').config();

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

    config.apiKey = extractHeader('apikey');
    config.appVersion = extractHeader('appversion');
    config.browserName = extractHeader('browsername') ;
    config.osName = extractHeader('osname') ;
    config.timezone = extractHeader('timezone');
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

    console.log("--- DEBUG INFO ---");
    console.log("Cookies parsed?", !!config.cookies);
    console.log("API Key parsed/defaulted?", !!config.apiKey);
    console.log("Auth header parsed?", !!config.authorization);
    console.log("------------------");
    
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

config.preferredCenter = process.env.PREFERRED_CENTER ? parseInt(process.env.PREFERRED_CENTER) : null;
config.preferredSlots = process.env.PREFERRED_SLOTS ? process.env.PREFERRED_SLOTS.split(',').map(s => s.trim()) : null;
config.preferredWorkouts = process.env.PREFERRED_WORKOUT ? process.env.PREFERRED_WORKOUT.split(',').map(w => w.trim()) : null;
config.enableWaitlist = process.env.ENABLE_WAITLIST !== 'false';

module.exports = config;
