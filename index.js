"use strict";
const config = require('./config'),
    /*
    Maintaining a list of activities and my preference
    The id field is the workoutId which part of classes object as a response of `api/cult/classes/` API
    */

    ActivityType = {
        "hrx": {
            "id": 69,
            "name": "HRX WORKOUT",
            "displayText": "HRX WORKOUT",
            "preference": 1
        },
        "strength": {
            "id": 69,
            "name": "ADIDAS STRENGTH+",
            "displayText": "ADIDAS STRENGTH+",
            "preference": 2
        },
        "yoga": {
            "id": 5,
            "name": "EVOLVE YOGA",
            "displayText": "EVOLVE YOGA",
            "preference": 3
        },
        "dance": {
            "id": 56,
            "name": "DANCE FITNESS",
            "displayText": "DANCE FITNESS",
            "preference": 4
        },
        "burn": {
            "id": 66,
            "name": "BURN",
            "displayText": "BURN",
            "preference": 5
        },
        "boxing": {
            "id": 8,
            "name": "BOXING BAG WORKOUT",
            "displayText": "BOXING BAG WORKOUT",
            "preference": 6
        },
        "fusionDance": {
            "id": 56,
            "name": "FUSION DANCE FITNESS",
            "displayText": "FUSION DANCE FITNESS",
            "preference": 7
        }
    };

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
const CURE_FIT_HOST = "www.cult.fit";
const URI = {
    "GET_CLASSES": "/api/cult/classes/v2?productType=FITNESS",
    "BOOK_CLASS": "/api/cult/class/${activityID}/book"
};
const HTTP_POST = "POST",
    HTTP_GET = "GET";


const PREFERRED_SLOTS = config.preferredSlots || ['09:00:00'];
const PREFERRED_CENTER = config.preferredCenter || 1515;
const PREFERRED_WORKOUT_NAMES = config.preferredWorkouts || ["HRX WORKOUT"];
const ENABLE_WAITLIST = config.enableWaitlist !== false;

const PREFERRED_CLASSES_IN_ORDER = [];
let currentPreference = 1;
PREFERRED_WORKOUT_NAMES.forEach(name => {
    let matches = Object.values(ActivityType).filter(activity => activity.name === name);
    matches.forEach(m => {
        let cloned = Object.assign({}, m);
        cloned.preference = currentPreference++;
        PREFERRED_CLASSES_IN_ORDER.push(cloned);
    });
});

console.log(`[DEBUG] Preferred slots: ${JSON.stringify(PREFERRED_SLOTS)}`);
console.log(`[DEBUG] Preferred center: ${PREFERRED_CENTER}`);
console.log(`[DEBUG] Preferred workouts from config: ${JSON.stringify(PREFERRED_WORKOUT_NAMES)}`);
console.log(`[DEBUG] Enable waitlist: ${ENABLE_WAITLIST}`);
console.log(`[DEBUG] Final ordered preferred classes: ${JSON.stringify(PREFERRED_CLASSES_IN_ORDER)}`);

function getCenterName(centerInfoMap, centerId) {
    return centerInfoMap?.[centerId]?.centerName;
}

function logNearbyGyms(classesForDay, centerInfoMap) {
    if (!classesForDay?.classByTimeList) {
        console.error("[DEBUG] Invalid classesForDay payload in logNearbyGyms");
        return;
    }

    const seenIds = new Set();
    for (let timeSlot of classesForDay.classByTimeList) {
        for (let center of timeSlot.centerWiseClasses) {
            if (!seenIds.has(center.centerId)) {
                seenIds.add(center.centerId);
                console.log(`  - ${getCenterName(centerInfoMap, center.centerId) || 'Unknown'} (id=${center.centerId})`);
            }
        }
    }
}

function hasBookingForDate(classesForDay) {
    if (!classesForDay || !classesForDay.classByTimeList) {
        console.error("[DEBUG] Invalid classesForDay payload in hasBookingForDate");
        return false;
    }

    for (let timeSlot of classesForDay.classByTimeList) {
        for (let centerClass of timeSlot.centerWiseClasses) {
            if (centerClass.centerId === PREFERRED_CENTER) {
                for (let classs of centerClass.classes) {
                    if (classs.state === 'BOOKED' || classs.isBooked === true) {
                        console.log(`[DEBUG] Existing booking found: classId=${classs.id}, slot=${timeSlot.id}`);
                        return true;
                    }
                }
            }
        }
    }
    console.log("[DEBUG] No existing booking found for selected date and preferred center");
    return false;
}

async function main() {
    try {
        let classes = await makeAPICall({}, CURE_FIT_HOST, URI.GET_CLASSES, HTTP_GET, commonHeaders);

        if (!classes || !classes.days || classes.days.length === 0) {
            console.error("[DEBUG] Invalid classes response: missing days");
            throw new Error("Invalid classes response: days not found");
        }

        let date = classes.days[classes.days.length - 1].id;

        console.log(`Booking for ${date}`);

        if (!classes.classByDateMap || !classes.classByDateMap[date]) {
            console.error(`[DEBUG] classByDateMap missing entry for date=${date}`);
            throw new Error(`Classes map not found for date ${date}`);
        }

        const centerInfoMap = classes.centerInfoMap;
        console.log("Nearby gyms:");
        logNearbyGyms(classes.classByDateMap[date], centerInfoMap);

        if (hasBookingForDate(classes.classByDateMap[date])) {
            console.log(`Already booked on ${date}. Skipping.`);
            return { status: 'already_booked', date };
        }

        let booked = false;
        let bookedInfo = null;

        for (let slot of PREFERRED_SLOTS) {
            console.log(`[DEBUG] Checking slot ${slot}`);
            let availableClassesInSlot = getSlots(classes.classByDateMap[date], slot, PREFERRED_CLASSES_IN_ORDER, centerInfoMap);
            console.log(`[DEBUG] Slot ${slot}: ${availableClassesInSlot.length} candidate classes after filtering`);

            for (let classInfo of availableClassesInSlot) {
                let waitlistCount = classInfo.waitlistInfo && classInfo.waitlistInfo.waitlistedUserCount || 0;
                console.log(`[DEBUG] Evaluating class: id=${classInfo.id}, workout=${classInfo.workoutName}, state=${classInfo.state}, availableSeats=${classInfo.availableSeats}, waitlistCount=${waitlistCount}, preference=${classInfo.preference}`);

                // If it's waitlist and >= 15 people are waiting, skip it and look for the next preferred class
                if (classInfo.state === 'WAITLIST_AVAILABLE' && waitlistCount >= 15) {
                    console.log(`Skipping ${classInfo.workoutName} at ${slot} (Waitlist too long: ${waitlistCount} ahead)`);
                    continue;
                }

                console.log(`Found ${classInfo.workoutName} at ${slot} on ${date} at ${classInfo.centerName}`);

                if (classInfo.state === 'WAITLIST_AVAILABLE') {
                    console.log(`Joining waitlist (${waitlistCount} people ahead)`);
                } else {
                    console.log(`Booking (${classInfo.availableSeats} seats available)`);
                }

                let bookResponse = await bookClass(classInfo.id);
                console.log(`[DEBUG] Book response: ${JSON.stringify(bookResponse)}`);
                console.log(`Class booked successfully at ${classInfo.centerName}!`);
                booked = true;
                let actionUrl = (bookResponse && (bookResponse.action || bookResponse.cardAction?.url))
                    || classInfo.cardAction?.url;
                bookedInfo = { workout: classInfo.workoutName, slot, date, centerName: classInfo.centerName, actionUrl };
                break; // Break inner loop (classes)
            }
            if (booked) {
                break; // Break outer loop (slots)
            }
        }

        if (!booked) {
            console.log(`No matching classes (${PREFERRED_WORKOUT_NAMES.join(', ')}) with acceptable waitlist available on ${date}`);
            return { status: 'no_match', date };
        }

        return { status: 'booked', ...bookedInfo };
    } catch (error) {
        errorHandler(error);
        return { status: 'error', error: error.message };
    }
}

const RETRY_INTERVAL_MS = 15000;
const RETRY_MAX_DURATION_MS = 55000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Notifies via `termux-notification` when available (Termux/Android); silently
// no-ops elsewhere (e.g. GitHub Actions runners, local dev on a laptop).
function notify(title, message, actionUrl) {
    try {
        const { spawnSync } = require('node:child_process');
        const args = ['--title', title, '--content', message];
        if (actionUrl) {
            args.push('--action', `termux-open-url '${actionUrl}'`);
        }
        const result = spawnSync('termux-notification', args);
        if (result.error) {
            console.log("[DEBUG] termux-notification unavailable, skipping notification");
        }
    } catch (error) {
        console.log("[DEBUG] Notification skipped:", error.message);
    }
}

function buildNotification(result) {
    switch (result.status) {
        case 'booked':
            return { title: 'Cultify: Class booked!', message: `${result.workout} at ${result.centerName} on ${result.date} (${result.slot})`, actionUrl: result.actionUrl };
        case 'already_booked':
            return { title: 'Cultify: Already booked', message: `Existing booking found for ${result.date}` };
        case 'no_match':
            return { title: 'Cultify: No class booked', message: `No matching classes available on ${result.date}` };
        default:
            return { title: 'Cultify: Booking failed', message: result.error || 'Unknown error' };
    }
}

async function runWithRetry() {
    const startedAt = Date.now();
    let result;
    let attempt = 1;

    while (true) {
        console.log(`[DEBUG] Booking attempt #${attempt}`);
        result = await main();

        if (result.status === 'booked' || result.status === 'already_booked') {
            break;
        }
        if (Date.now() - startedAt >= RETRY_MAX_DURATION_MS) {
            console.log(`[DEBUG] Retry window exhausted after attempt #${attempt} (status=${result.status})`);
            break;
        }

        console.log(`[DEBUG] Retrying in ${RETRY_INTERVAL_MS}ms (status=${result.status})`);
        await sleep(RETRY_INTERVAL_MS);
        attempt++;
    }

    const { title, message, actionUrl } = buildNotification(result);
    notify(title, message, actionUrl);
    process.exitCode = (result.status === 'booked' || result.status === 'already_booked') ? 0 : 1;
}

runWithRetry();


async function bookClass(activityID) {
    return await makeAPICall({}, CURE_FIT_HOST, "/api/cult/class/" + activityID + "/book", HTTP_POST, commonHeaders);
}

async function makeAPICall(request, host, path, method, headers) {
    console.log(`[DEBUG] makeAPICall called. method=${method}, host=${host}, path=${path}`);

    if (config.userAgent) {
        headers['User-Agent'] = config.userAgent;
    }
    if (config.referer) {
        headers['referer'] = config.referer;
    }
    if (config.authorization) {
        headers['authorization'] = config.authorization;
    }

    const url = `https://${host}${path}`;
    const options = {
        method: method,
        headers: headers
    };

    if (method === 'POST') {
        options.body = JSON.stringify(request);
    }

    const response = await fetch(url, options);
    console.log(`[DEBUG] Received response. status=${response.status}, ok=${response.ok}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] API call failed. status=${response.status}, errorText=${errorText}`);
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }

    return await response.text();
}

function getSlots(classesForDay, slot, classTypes, centerInfoMap) {
    if (!classesForDay || !classesForDay.classByTimeList) {
        console.error("[DEBUG] Invalid classesForDay payload in getSlots");
        return [];
    }

    let timeSlot = classesForDay.classByTimeList.filter(function (classByTime) {
        return classByTime.id == slot;
    })[0];

    if (!timeSlot) {
        return [];
    }

    let centerClasses = timeSlot.centerWiseClasses.filter(function (center) {
        return center.centerId == PREFERRED_CENTER;
    })[0];

    if (!centerClasses) {
        return [];
    }

    let classIDs = centerClasses.classes.filter(function (classs) {
        let filterElement = classTypes.filter(function (classType) {
            return classType.id == classs.workoutId && classType.name == classs.workoutName
        })[0];
        if (!filterElement) {
            return false;
        }
        classs.preference = filterElement.preference;
        classs.centerName = getCenterName(centerInfoMap, classs.centerID) || 'Unknown';

        if (ENABLE_WAITLIST) {
            return classs.state === 'AVAILABLE' || classs.state === 'WAITLIST_AVAILABLE';
        } else {
            return classs.state === 'AVAILABLE';
        }
    })
    .sort(function (class1, class2) {
        return class1.preference - class2.preference;
    });

    classIDs.forEach(function (classs, index) {
        console.log(`[DEBUG] Result[${index}] classId=${classs.id}, workout=${classs.workoutName}, state=${classs.state}, preference=${classs.preference}, seats=${classs.availableSeats}`);
    });

    return classIDs;
}

function errorHandler(error) {
    console.error("Booking failed:", error);
}
