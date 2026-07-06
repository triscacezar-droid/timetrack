# TimeTrack

A browser-based countdown timer that logs how you spend your time — activity,
start, end, duration — straight into a Google Sheet you own, so you can
review it later. Also doubles as a flexible meditation bell timer.

No backend, no build step, no database — just static HTML/CSS/JS that talks
to the Google Sheets API directly from your browser. Free to host, free to
use, and free to copy: see [License](#license).

**Live demo:** https://triscacezar-droid.github.io/timetrack/
(you'll need to point it at your own Google Sheet — see setup below).

---

## Get your own copy

Click **[Use this template](../../generate)** on this repo (or the green
"Use this template" button at the top of the GitHub page) to create your own
copy under your own account, with a clean git history. Forking also works
fine if you'd rather keep a link back to this repo.

Then follow **Setup** below with your copy.

---

## Setup

### 1. Create a Google Sheet

1. Go to https://sheets.new to create a blank spreadsheet.
2. Name it whatever you like (e.g. "TimeTrack Log").
3. Copy the spreadsheet ID out of the URL — it's the long string between
   `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Note the sheet tab name at the bottom (default is `Sheet1`) — you'll need
   it in step 3.

### 2. Create a Google OAuth Client ID

This lets the app ask Google, in your browser, for permission to write to
*your* sheet. Nothing about this step costs money.

1. Go to https://console.cloud.google.com/ and create a new project (or
   reuse one you already have).
2. Enable the Sheets API: **APIs & Services → Library** → search
   "Google Sheets API" → **Enable**.
3. Set up the consent screen: **APIs & Services → OAuth consent screen**.
   - User type: **External** (or Internal if you're on Google Workspace).
   - Fill in the required app name/support email fields.
   - Under **Audience** (or **Test users**, depending on the Cloud Console
     version), add your own Google account as a test user — this lets you
     sign in without publishing/verifying the app.
   - You don't need to add scopes manually here; the app requests
     `https://www.googleapis.com/auth/spreadsheets` at sign-in time.
4. Create the credential: **APIs & Services → Credentials → Create
   Credentials → OAuth client ID** → Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add every origin (scheme +
     host, no path, no trailing slash) you'll open this app from, e.g.:
     - `http://localhost:8080` (for local testing)
     - `https://your-username.github.io` (if hosting on GitHub Pages)
   - Save, then copy the generated **Client ID**.

### 3. Configure the app for local use

```bash
cp config.example.js config.js
```

Edit `config.js` with the values from steps 1–2:

```js
const CONFIG = {
  CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com",
  SPREADSHEET_ID: "the-id-you-copied",
  SHEET_NAME: "Sheet1",
};
```

`config.js` is gitignored — your real credentials never get committed from
local edits.

### 4. Run it locally

Any static file server works:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080, click **Sign in with Google**, and start the
timer. The first time you log an entry, the app adds a header row
(`Date, Activity, Start, End, Duration (min), Notes`) to the sheet
automatically.

### 5. (Optional) Host it for free on GitHub Pages

This repo includes `.github/workflows/deploy.yml`, which builds `config.js`
from **repo secrets** at deploy time — so your real Client ID / Spreadsheet ID
never touch git history, even though the repo itself is public.

1. Add the repo secrets (**Settings → Secrets and variables → Actions → New
   repository secret**, or via the `gh` CLI):

   ```bash
   gh secret set TIMETRACK_CLIENT_ID --body "xxxxxxxx.apps.googleusercontent.com"
   gh secret set TIMETRACK_SPREADSHEET_ID --body "your-spreadsheet-id"
   # optional, defaults to "Sheet1":
   gh secret set TIMETRACK_SHEET_NAME --body "Sheet1"
   ```

2. Enable Pages once: **Settings → Pages → Build and deployment → Source →
   GitHub Actions**.

3. Push to `master` (or re-run the workflow from the **Actions** tab). The
   site goes live at `https://<your-username>.github.io/<repo-name>/`.

4. Go back to your OAuth client (step 2) and add that exact origin (e.g.
   `https://your-username.github.io`, no path) to **Authorized JavaScript
   origins** — otherwise sign-in fails with an origin-mismatch error.

---

## How to use it

### Countdown timer

1. Pick an **Activity** from the dropdown (or add your own — see below).
2. Set the countdown length using the **hours / minutes / seconds** fields,
   or one of the preset buttons (5m / 15m / 25m / 1h).
3. Optionally pick a **Bell preset** (see below) if you want bells during
   the countdown — handy for meditation.
4. Hit **Start**. You can **Pause**/**Resume**, or hit **Stop & Log** to end
   it early and log the elapsed time instead of the full duration.
5. When the timer reaches zero, it logs the full duration automatically and
   plays a sound.

Every completed or manually-stopped run appends one row to your Google
Sheet: date, activity, start time, end time, duration in minutes.

### Manual entry

Use the "Add entry manually" form to log a block of time you didn't run the
timer for — pick the activity, date, start/end time, and optional notes.

### Managing activities

Click the gear icon (⚙) next to the Activity dropdown to add or remove
activities. This list lives in your browser's `localStorage`, separate from
the logged data in the Sheet — so it's per-device.

### Bell presets (e.g. for meditation)

Click the gear icon (⚙) next to the Bell preset dropdown to open the presets
editor. Each **preset** is a named set of **rules**, and each rule defines:

- **Starts at** — how many minutes into the countdown the rule first fires.
- **Repeat every** — how often it re-fires after that (0 = fires once).
- **Sound** — bell, chime, or gong (use the **▶ Preview** button to hear it).
- **Ring count** — either escalating (1 ring the first time, 2 the second,
  3 the third, …) or a fixed number every time.

A built-in "Meditation (every 15 min, escalating)" preset reproduces the
classic meditation timing: one bell at 15 min, two at 30, three at 45, etc.
You can edit it or add as many other presets/rules as you like — e.g. a
gentle chime every 5 minutes plus a gong at the very end.

Pick "No bells" in the dropdown to run the countdown silently.

### Themes

Use the dropdown in the top-right to switch between 17 named color themes
(Dark, Light, Dracula, Nord, Gruvbox, Solarized, Catppuccin, Tokyo Night,
Monokai, Rosé Pine, GitHub Light, Sepia, Cyberpunk, Black & White). Your
choice is saved in `localStorage` and persists across visits.

### Installing on your phone (PWA)

The app has a web app manifest and service worker, so on Android you can use
Chrome's menu → **Add to Home screen** (or the automatic install banner) to
get it as a standalone app icon. On iOS, use Safari's Share → **Add to Home
Screen**.

### Recent entries

The "Recent entries" section shows the last 10 rows from your Sheet, so you
can sanity-check what got logged without leaving the app. Hit **Refresh** to
reload it.

---

## Notes

- All data lives in your Google Sheet — this app has no database of its own.
  Feel free to add charts/pivot tables directly in the Sheet.
- Sign-in uses Google Identity Services' implicit token flow entirely in the
  browser; the access token is kept in memory only (not persisted), so
  you'll sign in again each time you reload the page.
- Any static host works (GitHub Pages, Netlify, Vercel static, etc.) — just
  remember to add that exact origin to the OAuth client's Authorized
  JavaScript origins.

## License

MIT — see [LICENSE](LICENSE). Use it, copy it, modify it, host your own
instance, no attribution required (though it's appreciated).
