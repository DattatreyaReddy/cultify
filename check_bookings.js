const config = require('./config');

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
    try {
        const url = "https://www.cult.fit/api/cult/classes/v2?productType=FITNESS";
        const response = await fetch(url, { headers: commonHeaders });
        const classes = await response.json();
        
        let bookedClasses = [];
        let waitlistedClasses = [];
        
        // Loop through all dates
        for (let date of classes.days) {
            let dateStr = date.id;
            let classesForDay = classes.classByDateMap[dateStr];
            
            if (!classesForDay || !classesForDay.classByTimeList) continue;
            
            for (let timeSlot of classesForDay.classByTimeList) {
                for (let centerClass of timeSlot.centerWiseClasses) {
                    let centerName = "Unknown Center";
                    if (classes.centerInfoMap && classes.centerInfoMap[centerClass.centerId]) {
                        centerName = classes.centerInfoMap[centerClass.centerId].centerName;
                    }
                    
                    for (let c of centerClass.classes) {
                        if (c.state === 'BOOKED' || c.isBooked === true) {
                            bookedClasses.push(`${c.workoutName} at ${timeSlot.id} on ${dateStr} (${centerName.trim()})`);
                        } else if (c.state === 'WAITLISTED' || (c.waitlistInfo && c.waitlistInfo.isUserWaitlisted)) {
                            let pos = c.waitlistInfo && c.waitlistInfo.waitlistNumber ? `(Position: ${c.waitlistInfo.waitlistNumber})` : "";
                            waitlistedClasses.push(`${c.workoutName} at ${timeSlot.id} on ${dateStr} ${pos} (${centerName.trim()})`);
                        }
                    }
                }
            }
        }
        
        console.log("--- YOUR BOOKINGS ---");
        if (bookedClasses.length > 0) {
            bookedClasses.forEach(b => console.log("✅ " + b));
        } else {
            console.log("No confirmed bookings found for upcoming days.");
        }
        
        if (waitlistedClasses.length > 0) {
            console.log("\n--- YOUR WAITLISTS ---");
            waitlistedClasses.forEach(w => console.log("⏳ " + w));
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
