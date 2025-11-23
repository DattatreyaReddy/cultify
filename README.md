# Cultify

Automated Cult.fit class booking system using GitHub Actions.

## Overview

Cultify is an automation tool that books fitness classes at Cult.fit centers. It authenticates using browser session cookies and can be scheduled to run automatically via GitHub Actions, eliminating the need for manual booking.

## Features

- Automatic class booking based on preferences
- Configurable workout types, time slots, and centers
- Smart booking logic (skips if already booked)
- Waitlist support (joins queue when classes are full)
- GitHub Actions integration for automated scheduling
- Zero server costs (runs on GitHub infrastructure)
- Secure credential management via environment variables
- Local testing support

## How It Works

1. Extracts authentication from browser curl command
2. Fetches available classes via Cult.fit API
3. Filters by configured preferences (center, time, workout type)
4. Checks for existing bookings on target date
5. Books first available matching class
6. Logs results for monitoring

## Prerequisites

- Active Cult.fit membership
- GitHub account

## Quick Start (Recommended)

Get started in 3 simple steps - no installation or coding required!

### Step 1: Fork Repository

1. Click the "Fork" button at the top right of this repository
2. This creates your own copy of Cultify in your GitHub account

### Step 2: Get Authentication

You need a curl command containing your authentication cookies:

1. Navigate to https://www.cult.fit and login
2. Open browser Developer Tools (F12 or Cmd+Option+I on Mac)
3. Go to Network tab
4. Refresh page or navigate to any section
5. Select any API request to `cult.fit` domain
6. Right-click request → Copy → Copy as cURL (bash)

Your curl command should look like:

```bash
curl 'https://www.cult.fit/api/user/cities/v2' \
  -H 'accept: application/json' \
  -H 'apikey: 9d153009-e961-4718-a343-2a36b0a1d1fd' \
  -H 'appversion: 7' \
  -H 'browsername: Chrome' \
  -b 'deviceId=...; at=s%3ACFAPP%3A...; st=s%3ACFAPP%3A...; ...' \
  -H 'osname: browser' \
  -H 'timezone: Asia/Kolkata' \
  -H 'user-agent: Mozilla/5.0 ...' \
  -H 'referer: https://www.cult.fit/me/profile'
```

**Important:** Convert to single line by removing all backslashes and line breaks.

### Step 3: Configure GitHub Secrets

1. Go to your forked repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:

**Required:**
- Name: `CURL_COMMAND`
- Value: Your complete curl command (single line, no backslashes)

**Optional Secrets** (customize if needed):

| Secret Name | Description | Default | Example |
|-------------|-------------|---------|---------|
| `PREFERRED_CENTER` | Your gym center ID | 1515 | 151 |
| `PREFERRED_SLOTS` | Comma-separated time slots | 07:00:00,08:00:00,09:00:00 | 18:00:00,19:00:00 |
| `PREFERRED_WORKOUT` | Workout class name | HRX WORKOUT | DANCE FITNESS |
| `ENABLE_WAITLIST` | Join waitlist when full | true | false |

### Step 4: Enable GitHub Actions

1. Go to the **Actions** tab in your forked repository
2. Click "I understand my workflows, go ahead and enable them"
3. Select "Auto Book Cult Class" workflow
4. Click "Enable workflow" if needed

**That's it!** The workflow will automatically run daily at 10:05 AM UTC (3:35 PM IST) and book your class.

### Manual Trigger

You can trigger booking immediately without waiting:

1. Go to **Actions** tab
2. Select **"Auto Book Cult Class"** workflow
3. Click **"Run workflow"** button
4. Click **"Run workflow"** to confirm

### Monitor Bookings

Check if your class was booked:

1. Navigate to **Actions** tab
2. Select the latest workflow run
3. Click on the job to view logs
4. Look for success message: "✓ Class booked successfully!"

## Configuration Details

### Finding Your Center ID

If you want to use a specific gym center:

1. Keep the default configuration first
2. Run the workflow once (it will fail but show available centers)
3. Check the logs in Actions tab
4. Look for center IDs in the output:

```json
{
  "151": { "centerName": "Cult HSR Layout" },
  "634": { "centerName": "Cult Koramangala" }
}
```

5. Add `PREFERRED_CENTER` secret with your center ID

### Environment Variable Reference

#### CURL_COMMAND (Required)

Complete curl command from browser. Must be provided as single line (remove backslashes).

```bash
CURL_COMMAND=curl 'https://www.cult.fit/api/...' -H 'apikey: ...' -b '...' -H 'osname: browser'
```

#### PREFERRED_CENTER (Optional)

Numeric ID of your preferred Cult.fit center.

**Default:** 1515

**Example:**
```bash
PREFERRED_CENTER=151
```

#### PREFERRED_SLOTS (Optional)

Comma-separated time slots in 24-hour format (HH:MM:SS).

**Default:** 07:00:00,08:00:00,09:00:00

**Example:**
```bash
PREFERRED_SLOTS=07:00:00,08:00:00,09:00:00
```

Script attempts slots in order and books first available match.

**Common Time Slots:**
- Morning: 06:00:00, 07:00:00, 08:00:00, 09:00:00, 10:00:00
- Evening: 17:00:00, 18:00:00, 19:00:00, 20:00:00

#### PREFERRED_WORKOUT (Optional)

Exact name of workout class to book. Case-sensitive.

**Default:** HRX WORKOUT

**Example:**
```bash
PREFERRED_WORKOUT=HRX WORKOUT
```

**Available Workouts:**

| Workout Name | Category ID |
|--------------|-------------|
| HRX WORKOUT | 69 |
| ADIDAS STRENGTH+ | 69 |
| DANCE FITNESS | 56 |
| FUSION DANCE FITNESS | 56 |
| BOXING BAG WORKOUT | 8 |
| BURN | 66 |
| EVOLVE YOGA | 5 |

#### ENABLE_WAITLIST (Optional)

Enable or disable waitlist booking when classes are full.

**Default:** true

**Example:**
```bash
ENABLE_WAITLIST=true
```

**Behavior:**

When enabled (`true`):
- Books available classes normally
- Joins waitlist if class is full
- Logs waitlist position

When disabled (`false`):
- Only books classes with available seats
- Skips full classes
- Continues to next time slot

**Waitlist Information:**

When joining waitlist, output shows:
```
Found HRX WORKOUT class at 07:00:00 on 2025-11-26
Class ID: 7360552
Status: WAITLIST (5 people already waitlisted)
Action: Joining waitlist...
✓ Class booked successfully!
```

If you get a spot from waitlist, Cult.fit will notify you via app/email.

#### DEBUG (Optional)

Enable detailed logging to debug booking issues.

**Default:** false

**Example:**
```bash
DEBUG=true
```

**Debug Output:**

Shows all classes at each time slot:
```
[DEBUG] Slot 07:00:00: Found 2 classes at center
  - HRX WORKOUT: AVAILABLE, seats: 2, waitlist: 0
  - DANCE FITNESS: WAITLIST_AVAILABLE, seats: 0, waitlist: 29
[DEBUG] After filtering: 1 matching classes
```

Use debug mode to troubleshoot:
- Why no classes are found
- What classes exist at each time slot
- Waitlist information
- Filtering logic

## Usage

### Local Execution

#### Create .env File

```bash
CURL_COMMAND=curl 'https://www.cult.fit/api/...' -H 'apikey: ...' -b '...'
PREFERRED_CENTER=1515
PREFERRED_SLOTS=07:00:00,08:00:00,09:00:00
PREFERRED_WORKOUT=HRX WORKOUT
ENABLE_WAITLIST=true
```

**Important:** Remove all backslashes from curl command. It must be single line.

#### Run Script

```bash
node index.js
# or
bun index.js
```

#### Expected Output

**Available Class:**
```
Found HRX WORKOUT class at 07:00:00 on 2025-11-26
Class ID: 7360581
Status: Available (2 seats)
Class booked successfully!
```

**Waitlist:**
```
Found HRX WORKOUT class at 07:00:00 on 2025-11-26
Class ID: 7360552
Status: Waitlist (5 people waitlisted)
Class booked successfully!
```

**Already Booked:**
```
You already have a class booked on 2025-11-26. Skipping booking.
```

### GitHub Actions (Automated)

#### Setup Steps

1. **Push Code to GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/cultify.git
git push -u origin master
```

2. **Configure Repository Secrets**

Navigate to: Repository Settings → Secrets and variables → Actions

Add the following secrets:

**Required:**
- Name: `CURL_COMMAND`
- Value: Your complete curl command (single line, no backslashes)

**Optional:**
- Name: `PREFERRED_CENTER`
- Value: Your center ID (e.g., `1515`)

- Name: `PREFERRED_SLOTS`
- Value: Comma-separated slots (e.g., `07:00:00,08:00:00,09:00:00`)

- Name: `PREFERRED_WORKOUT`
- Value: Workout name (e.g., `HRX WORKOUT`)

- Name: `ENABLE_WAITLIST`
- Value: `true` or `false` (default: `true`)

3. **Enable GitHub Actions**

- Go to repository Actions tab
- Enable workflows if prompted

#### Default Schedule

The workflow runs at **10:05 AM UTC** daily.

To modify schedule, edit `.github/workflows/book-class.yml`:

```yaml
on:
  schedule:
    - cron: '5 10 * * *'  # minute hour day month weekday (UTC)
```

**Example Schedules:**

- `'35 4 * * *'` - 10:05 AM IST (4:35 AM UTC)
- `'0 0 * * *'` - 5:30 AM IST (midnight UTC)
- `'0 12 * * *'` - 5:30 PM IST (noon UTC)

#### Manual Trigger

Workflows can be triggered manually:

1. Go to Actions tab
2. Select "Auto Book Cult Class" workflow
3. Click "Run workflow" button
4. Confirm execution

#### Monitoring

Check workflow execution logs:

1. Navigate to Actions tab
2. Select workflow run
3. View logs for booking status and errors

## Configuration Examples

### Example 1: Default Morning HRX

```bash
CURL_COMMAND=curl '...'
```

Uses defaults: Center 1515, 7-9 AM slots, HRX WORKOUT

### Example 2: Evening Dance Classes

```bash
CURL_COMMAND=curl '...'
PREFERRED_SLOTS=18:00:00,19:00:00,20:00:00
PREFERRED_WORKOUT=DANCE FITNESS
```

### Example 3: Different Center

```bash
CURL_COMMAND=curl '...'
PREFERRED_CENTER=634
PREFERRED_WORKOUT=BURN
```

### Example 4: Disable Waitlist

```bash
CURL_COMMAND=curl '...'
ENABLE_WAITLIST=false
```

Only books classes with available seats. Skips full classes.

### Example 5: Full Customization

```bash
CURL_COMMAND=curl '...'
PREFERRED_CENTER=634
PREFERRED_SLOTS=17:00:00,18:00:00
PREFERRED_WORKOUT=BOXING BAG WORKOUT
ENABLE_WAITLIST=true
```

## Troubleshooting

### Authentication Errors

**Error Message:**
```
Login Required!
```

**Cause:** Session cookies expired

**Solution:**
1. Get fresh curl command from browser
2. Update CURL_COMMAND in .env or GitHub Secret
3. Retry

### No Classes Found

**Error Message:**
```
No HRX classes available between 7-9 AM on 2025-11-26
```

**Possible Causes:**
- No classes scheduled at configured times
- All classes full
- Wrong workout name
- Wrong center ID

**Solution:**
1. Verify class availability on Cult.fit website
2. Check PREFERRED_WORKOUT matches exactly
3. Confirm PREFERRED_CENTER is correct
4. Try different time slots

### Already Booked

**Message:**
```
You already have a class booked on 2025-11-26. Skipping booking.
```

**Explanation:** Script detected existing booking for target date. This is expected behavior to prevent double booking.

### Workflow Not Running

**Possible Causes:**
- GitHub Actions disabled
- Incorrect cron syntax
- Repository permissions

**Solution:**
1. Enable Actions in repository settings
2. Verify workflow file exists in `.github/workflows/`
3. Check cron syntax is valid
4. Ensure repository has Actions permissions

## Development

### Project Structure

```
cultify/
├── .github/
│   └── workflows/
│       └── book-class.yml    # GitHub Actions workflow
├── config.js                  # Configuration parser
├── index.js                   # Main booking script
├── package.json              # Dependencies
├── .env                      # Local configuration (gitignored)
├── .gitignore               # Git ignore rules
└── README.md                # Documentation
```

### Code Overview

**config.js**
- Parses curl command
- Extracts authentication headers
- Provides configuration to main script

**index.js**
- Defines workout types and preferences
- Fetches available classes
- Filters by preferences
- Handles booking logic

**book-class.yml**
- Defines GitHub Actions workflow
- Sets schedule
- Configures environment

### Adding New Workout Types

Edit `index.js` ActivityType object:

```javascript
ActivityType = {
    "newWorkout": {
        "id": XX,
        "name": "EXACT WORKOUT NAME",
        "displayText": "Display Name",
        "preference": 1
    }
}
```

Find workout ID and name from API response in logs.

### Modifying Booking Logic

Main booking flow in `index.js`:

```javascript
co(function* () {
    // 1. Fetch classes
    let classes = yield makeAPICall(...);
    
    // 2. Check existing bookings
    if (hasBookingForDate(...)) return;
    
    // 3. Try each time slot
    for (let slot of PREFERRED_SLOTS) {
        slots = getSlots(...);
        if (slots.length > 0) {
            // 4. Book first match
            yield bookClass(slots[0].id);
            break;
        }
    }
});
```

## API Details

### Endpoints Used

**Fetch Classes:**
```
GET /api/cult/classes/v2?productType=FITNESS
```

**Book Class:**
```
POST /api/cult/class/{classId}/book
```

### Required Headers

Automatically extracted from curl command:

- `apikey` - Public API key
- `appversion` - App version identifier
- `browsername` - Browser type
- `osname` - Operating system
- `timezone` - User timezone
- `Cookie` - Session cookies (at, st tokens)
- `user-agent` - Browser user agent
- `referer` - Referrer URL

## Security

### Safe Practices

- Never commit `.env` file (already in `.gitignore`)
- Store credentials only in GitHub Secrets
- Rotate cookies when they expire
- Use repository secrets for sensitive data

### What Gets Committed

Safe to commit:
- Source code (`index.js`, `config.js`)
- Workflow files
- Documentation
- Dependencies

Never commit:
- `.env` file
- Personal curl commands
- Session cookies
- Authentication tokens

### Token Expiration

Cult.fit session tokens typically expire after:
- 7-30 days of inactivity
- Password change
- Logout from all devices

When tokens expire, update CURL_COMMAND with fresh credentials.

## Limitations

- Single booking per day (by design)
- Requires valid Cult.fit membership
- Dependent on Cult.fit API availability
- Tokens require periodic refresh
- Waitlist position determined by Cult.fit (first-come-first-served)
- No guarantee of confirmation from waitlist

## Contributing

Contributions welcome. Areas for improvement:

- Waitlist monitoring and auto-rebooking when spot opens
- Notification integrations (email, Slack, etc.)
- Advanced scheduling strategies
- Multiple booking preferences with priority

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues for solutions
- Review troubleshooting section above

## Acknowledgments

Built for Cult.fit members who want automated booking. Not affiliated with or endorsed by Cult.fit.

## Inspired by:
https://medium.com/@nobrains/how-i-automated-booking-my-cult-classes-cbc568f05cc8
https://github.com/nobrains/CureFit