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
    console.log(`[DEBUG] Building preference list for workout name: ${name}. Matches found: ${matches.length}`);
    matches.forEach(m => {
        let cloned = Object.assign({}, m);
        cloned.preference = currentPreference++;
        PREFERRED_CLASSES_IN_ORDER.push(cloned);
        console.log(`[DEBUG] Added preferred class mapping: id=${cloned.id}, name=${cloned.name}, preference=${cloned.preference}`);
    });
});

console.log("[DEBUG] Script initialization complete");
console.log(`[DEBUG] Preferred slots: ${JSON.stringify(PREFERRED_SLOTS)}`);
console.log(`[DEBUG] Preferred center: ${PREFERRED_CENTER}`);
console.log(`[DEBUG] Preferred workouts from config: ${JSON.stringify(PREFERRED_WORKOUT_NAMES)}`);
console.log(`[DEBUG] Enable waitlist: ${ENABLE_WAITLIST}`);
console.log(`[DEBUG] Final ordered preferred classes: ${JSON.stringify(PREFERRED_CLASSES_IN_ORDER)}`);

function hasBookingForDate(classesForDay) {
    console.log("[DEBUG] Checking existing booking for preferred center on selected date");
    if (!classesForDay || !classesForDay.classByTimeList) {
        console.error("[DEBUG] Invalid classesForDay payload in hasBookingForDate");
        return false;
    }

    for (let timeSlot of classesForDay.classByTimeList) {
        console.log(`[DEBUG] Inspecting time slot for booked classes: ${timeSlot.id}`);
        for (let centerClass of timeSlot.centerWiseClasses) {
            if (centerClass.centerId === PREFERRED_CENTER) {
                console.log(`[DEBUG] Found preferred center ${PREFERRED_CENTER} in slot ${timeSlot.id}. Total classes: ${centerClass.classes.length}`);
                for (let classs of centerClass.classes) {
                    console.log(`[DEBUG] Existing class status check: classId=${classs.id}, workout=${classs.workoutName}, state=${classs.state}, isBooked=${classs.isBooked}`);
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
        console.log("[DEBUG] Starting main booking flow");
        let classes = await makeAPICall({}, CURE_FIT_HOST, URI.GET_CLASSES, HTTP_GET, commonHeaders);
        console.log(`[DEBUG] GET_CLASSES response keys: ${Object.keys(classes || {}).join(', ')}`);

        if (!classes || !classes.days || classes.days.length === 0) {
            console.error("[DEBUG] Invalid classes response: missing days");
            throw new Error("Invalid classes response: days not found");
        }

        let date = classes.days[classes.days.length - 1].id;
        
        console.log(`Booking for ${date}`);
        console.log(`[DEBUG] Selected target date index=${classes.days.length - 1}, date=${date}`);
        console.log(`[DEBUG] Total dates in response: ${classes.days.length}`);
        
        if (!classes.classByDateMap || !classes.classByDateMap[date]) {
            console.error(`[DEBUG] classByDateMap missing entry for date=${date}`);
            throw new Error(`Classes map not found for date ${date}`);
        }
        
        if (hasBookingForDate(classes.classByDateMap[date])) {
            console.log(`Already booked on ${date}. Skipping.`);
            console.log("[DEBUG] Exiting early due to existing booking");
            return;
        }
        
        let slots = [];
        console.log(`[DEBUG] Declared slots array for potential usage. Initial length=${slots.length}`);
        
        let booked = false;
        console.log("[DEBUG] Booking status initialized to false");
        
        for (let slot of PREFERRED_SLOTS) {
            console.log(`[DEBUG] Checking slot ${slot}`);
            let availableClassesInSlot = getSlots(classes.classByDateMap[date], slot, PREFERRED_CLASSES_IN_ORDER);
            console.log(`[DEBUG] Slot ${slot}: ${availableClassesInSlot.length} candidate classes after filtering`);
            
            for (let classInfo of availableClassesInSlot) {
                let waitlistCount = classInfo.waitlistInfo && classInfo.waitlistInfo.waitlistedUserCount || 0;
                console.log(`[DEBUG] Evaluating class: id=${classInfo.id}, workout=${classInfo.workoutName}, state=${classInfo.state}, availableSeats=${classInfo.availableSeats}, waitlistCount=${waitlistCount}, preference=${classInfo.preference}`);
                
                // If it's waitlist and >= 15 people are waiting, skip it and look for the next preferred class
                if (classInfo.state === 'WAITLIST_AVAILABLE' && waitlistCount >= 15) {
                    console.log(`Skipping ${classInfo.workoutName} at ${slot} (Waitlist too long: ${waitlistCount} ahead)`);
                    console.log(`[DEBUG] Skipped class due to waitlist threshold. classId=${classInfo.id}`);
                    continue; 
                }
                
                console.log(`Found ${classInfo.workoutName} at ${slot} on ${date}`);
                
                if (classInfo.state === 'WAITLIST_AVAILABLE') {
                    console.log(`Joining waitlist (${waitlistCount} people ahead)`);
                } else {
                    console.log(`Booking (${classInfo.availableSeats} seats available)`);
                }
                
                console.log(`[DEBUG] Attempting booking API call for classId=${classInfo.id}`);
                await bookClass(classInfo.id);
                console.log("Class booked successfully!");
                console.log(`[DEBUG] Booking flow succeeded for classId=${classInfo.id}`);
                booked = true;
                break; // Break inner loop (classes)
            }
            if (booked) {
                console.log(`[DEBUG] Exiting slot loop after successful booking at slot ${slot}`);
                break; // Break outer loop (slots)
            }

            console.log(`[DEBUG] No booking completed in slot ${slot}. Continuing to next preferred slot.`);
        }
        
        if (!booked) {
            console.log(`No matching classes (${PREFERRED_WORKOUT_NAMES.join(', ')}) with acceptable waitlist available on ${date}`);
            console.log("[DEBUG] Booking flow finished with no booking");
        } else {
            console.log("[DEBUG] Booking flow finished with success");
        }
    } catch (error) {
        console.error("[DEBUG] Error caught in main()", error);
        errorHandler(error);
    }
}

main();


async function bookClass(activityID) {
    console.log(`[DEBUG] bookClass invoked with activityID=${activityID}`);
    return await makeAPICall({}, CURE_FIT_HOST, "/api/cult/class/" + activityID + "/book", HTTP_POST, commonHeaders);
}

async function makeAPICall(request, host, path, method, headers) {
    console.log(`[DEBUG] makeAPICall called. method=${method}, host=${host}, path=${path}`);
    console.log(`[DEBUG] Request payload: ${JSON.stringify(request)}`);
    console.log(`[DEBUG] Initial header keys: ${Object.keys(headers || {}).join(', ')}`);

    if (config.userAgent) {
        headers['User-Agent'] = config.userAgent;
        console.log("[DEBUG] Injected User-Agent header from config");
    }
    if (config.referer) {
        headers['referer'] = config.referer;
        console.log("[DEBUG] Injected referer header from config");
    }
    if (config.authorization) {
        headers['authorization'] = config.authorization;
        console.log("[DEBUG] Injected authorization header from config");
    }

    const url = `https://${host}${path}`;
    console.log(`[DEBUG] Final request URL: ${url}`);
    const options = {
        method: method,
        headers: headers
    };

    if (method === 'POST') {
        options.body = JSON.stringify(request);
        console.log(`[DEBUG] Added POST body. Length=${options.body.length}`);
    }

    console.log(`[DEBUG] Fetch options prepared. method=${options.method}, hasBody=${Boolean(options.body)}`);
    const response = await fetch(url, options);
    console.log(`[DEBUG] Received response. status=${response.status}, ok=${response.ok}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] API call failed. status=${response.status}, errorText=${errorText}`);
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`[DEBUG] Response content-type: ${contentType}`);
    if (contentType && contentType.includes('application/json')) {
        console.log("[DEBUG] Parsing response as JSON");
        return await response.json();
    }

    console.log("[DEBUG] Parsing response as text");
    return await response.text();
}

function getSlots(classesForDay, slot, classTypes) {
    console.log(`[DEBUG] getSlots called for slot=${slot}, classTypesCount=${classTypes.length}`);
    if (!classesForDay || !classesForDay.classByTimeList) {
        console.error("[DEBUG] Invalid classesForDay payload in getSlots");
        return [];
    }
    
    let timeSlot = classesForDay.classByTimeList.filter(function (classByTime) {
        return classByTime.id == slot;
    })[0];
    console.log(`[DEBUG] Time slot lookup for ${slot}: ${timeSlot ? 'found' : 'not found'}`);
    
    if (!timeSlot) {
        console.log(`[DEBUG] No time slot data available for slot=${slot}`);
        return [];
    }
    
    let centerClasses = timeSlot.centerWiseClasses.filter(function (center) {
        return center.centerId == PREFERRED_CENTER;
    })[0];
    console.log(`[DEBUG] Center lookup in slot ${slot} for center=${PREFERRED_CENTER}: ${centerClasses ? 'found' : 'not found'}`);
    
    if (!centerClasses) {
        console.log(`[DEBUG] Preferred center ${PREFERRED_CENTER} has no classes in slot=${slot}`);
        return [];
    }

    console.log(`[DEBUG] Total classes at center ${PREFERRED_CENTER} for slot ${slot}: ${centerClasses.classes.length}`);
    
    let classIDs = centerClasses.classes.filter(function (classs) {
        let filterElement = classTypes.filter(function (classType) {
            return classType.id == classs.workoutId && classType.name == classs.workoutName
        })[0];
        if (!filterElement) {
            console.log(`[DEBUG] Rejected class (not preferred): classId=${classs.id}, workoutId=${classs.workoutId}, workoutName=${classs.workoutName}, state=${classs.state}`);
            return false;
        }
        classs.preference = filterElement.preference;
        console.log(`[DEBUG] Candidate class matched preference: classId=${classs.id}, workout=${classs.workoutName}, preference=${classs.preference}, state=${classs.state}`);
        
        if (ENABLE_WAITLIST) {
            let allowed = classs.state === 'AVAILABLE' || classs.state === 'WAITLIST_AVAILABLE';
            if (!allowed) {
                console.log(`[DEBUG] Rejected class due to state with waitlist enabled: classId=${classs.id}, state=${classs.state}`);
            }
            return allowed;
        } else {
            let allowed = classs.state === 'AVAILABLE';
            if (!allowed) {
                console.log(`[DEBUG] Rejected class due to state with waitlist disabled: classId=${classs.id}, state=${classs.state}`);
            }
            return allowed;
        }
    })
    .sort(function (class1, class2) {
        console.log(`[DEBUG] Sorting classes by preference: class1=${class1.id}(${class1.preference}), class2=${class2.id}(${class2.preference})`);
        return class1.preference - class2.preference;
    });

    console.log(`[DEBUG] getSlots result for slot=${slot}: ${classIDs.length} classes`);
    classIDs.forEach(function (classs, index) {
        console.log(`[DEBUG] Result[${index}] classId=${classs.id}, workout=${classs.workoutName}, state=${classs.state}, preference=${classs.preference}, seats=${classs.availableSeats}`);
    });
    
    return classIDs;
}

function errorHandler(error) {
    console.error("[DEBUG] errorHandler invoked");
    console.error("Booking failed:", error);
}