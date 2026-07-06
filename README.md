# TimeTrack

A tiny browser-based countdown timer that logs how you spend your time
(activity, start, end, duration) straight into a Google Sheet, so you can
review it later. No backend, no build step — just static HTML/CSS/JS.

## 1. Create a Google Sheet

1. Go to https://sheets.new to create a blank spreadsheet.
2. Name it whatever you like (e.g. "TimeTrack Log").
3. Copy the spreadsheet ID out of the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Note the tab name at the bottom (default is `Sheet1`).

## 2. Create an OAuth Client ID

1. Go to https://console.cloud.google.com/ and create a new project (or reuse one).
2. Enable the **Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable.
3. Configure the OAuth consent screen (APIs & Services → OAuth consent screen):
   - User type: External (or Internal if you have Workspace).
   - Add your own Google account as a test user.
   - Scopes: you don't need to add any here manually, the app requests
     `https://www.googleapis.com/auth/spreadsheets` at sign-in time.
4. Create credentials: APIs & Services → Credentials → Create Credentials →
   OAuth client ID → Application type: **Web application**.
   - Authorized JavaScript origins: add the URL you'll serve this app from,
     e.g. `http://localhost:8080` (for local testing) and/or your deployed
     URL (e.g. a GitHub Pages URL).
   - Save, then copy the generated **Client ID**.

## 3. Configure the app

Copy the example config and fill in your own values — `config.js` is
gitignored so your Client ID / Spreadsheet ID never get committed:

```bash
cp config.example.js config.js
```

Edit `config.js`:

```js
const CONFIG = {
  CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com",
  SPREADSHEET_ID: "the-id-you-copied",
  SHEET_NAME: "Sheet1",
};
```

## 4. Run it

Any static file server works, e.g.:

```bash
cd timetrack
python3 -m http.server 8080
```

Open http://localhost:8080, click "Sign in with Google", and start the timer.
The first time you log an entry the app will add a header row
(`Date, Activity, Start, End, Duration (min), Notes`) automatically.

## Usage

- **Countdown timer**: pick an activity, set the minutes (or use a preset),
  hit Start. When it reaches zero it logs the full duration automatically
  and plays a sound. You can also hit "Stop & Log" early to log the elapsed
  time instead.
- **Manual entry**: fill in activity/date/start/end directly if you forgot
  to start the timer, or want to backfill a block of time.
- **Manage activities** (gear icon): add/remove activities in the dropdown.
  This list is stored locally in your browser (`localStorage`), separate
  from the logged data in the Sheet.
- **Recent entries**: shows the last 10 rows from the Sheet so you can sanity
  check what was logged without leaving the app.

## Notes

- All data is authoritative in the Google Sheet — this app has no database
  of its own. Feel free to add charts/pivot tables in the Sheet itself.
- Sign-in uses Google Identity Services' implicit token flow entirely in the
  browser; your access token is kept in memory only (not persisted), so
  you'll sign in again each time you reload the page.
- Deploying: since it's static files, GitHub Pages, Netlify, Vercel (static),
  or any static host works — just remember to add that origin to the OAuth
  client's Authorized JavaScript origins.
