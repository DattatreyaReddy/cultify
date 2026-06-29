const config = require('./config');
const fs = require('fs');

const commonHeaders = {
    "accept": "application/json",
    "apikey": config.apiKey,
    "appversion": config.appVersion,
    "browsername": config.browserName,
    "osname": config.osName,
    "timezone": config.timezone,
    "content-type": "application/json",
    "Cookie": config.cookies
};

async function main() {
    const url = "https://www.cult.fit/api/cult/classes/v2?productType=FITNESS";
    const response = await fetch(url, { headers: commonHeaders });
    const data = await response.json();
    fs.writeFileSync('response.json', JSON.stringify(data, null, 2));
    console.log("Response saved to response.json");
}
main();
