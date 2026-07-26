// Fill these in — see README.md for step-by-step instructions.
const CONFIG = {
  // OAuth 2.0 Client ID from Google Cloud Console (Web application type).
  CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",

  // The ID of the Google Sheet to log entries into (from its URL:
  // https://docs.google.com/spreadsheets/d/THIS_PART/edit).
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID",

  // Name of the sheet/tab to write to. Must already exist in the spreadsheet
  // (the default tab in a new Google Sheet is named "Sheet1").
  SHEET_NAME: "Sheet1",

  // Optional: a second sheet/tab (e.g. written by an external automation)
  // whose entries are merged in read-only alongside SHEET_NAME everywhere
  // entries are displayed (Today, calendar, Recent entries). Editing quality
  // and deleting still work on these rows; leave blank/omit to disable.
  SECONDARY_SHEET_NAME: "",
};
