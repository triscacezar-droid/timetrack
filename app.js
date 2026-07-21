const ACTIVITIES_KEY = "timetrack.activities";
const ACTIVITY_COLOR_PALETTE = [
  "#5b8cff", "#ff6b6b", "#51cf66", "#fcc419", "#cc5de8",
  "#22b8cf", "#ff922b", "#94d82d", "#f06595", "#845ef7",
];
// targetMinutes: null means "not tracked" (no target set); 0 is a deliberate
// "should do none of this" target (e.g. Brainrot), distinct from null.
const DEFAULT_ACTIVITIES = [
  { name: "Work", targetMinutes: 240 },
  { name: "Read", targetMinutes: 30 },
  { name: "Exercise", targetMinutes: null },
  { name: "Break", targetMinutes: null },
  { name: "Meditate", targetMinutes: 60 },
  { name: "Brainrot", targetMinutes: 0 },
].map((a, i) => ({
  ...a,
  color: ACTIVITY_COLOR_PALETTE[i % ACTIVITY_COLOR_PALETTE.length],
}));

// ---------- Timezones ----------

const TIMEZONE_KEY = "timetrack.timezone";
const FALLBACK_TIMEZONES = [
  "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "America/Sao_Paulo", "America/Mexico_City", "America/Toronto",
  "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris",
  "Europe/Berlin", "Europe/Rome", "Europe/Amsterdam", "Europe/Warsaw", "Europe/Athens",
  "Europe/Bucharest", "Europe/Helsinki", "Europe/Moscow", "Europe/Istanbul",
  "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
  "Asia/Jerusalem", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
  "Asia/Bangkok", "Asia/Jakarta", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore",
  "Asia/Tokyo", "Asia/Seoul", "Asia/Manila", "Australia/Perth", "Australia/Adelaide",
  "Australia/Sydney", "Australia/Brisbane", "Pacific/Auckland", "Pacific/Honolulu",
];

function getTimezoneList() {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }
  return FALLBACK_TIMEZONES;
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getTzOffsetMinutes(timeZone, utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs)).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUTC - utcMs) / 60000;
}

// Converts a wall-clock date+time as experienced in `timeZone` into the
// absolute UTC instant it represents (correcting once for DST edge cases).
function zonedToUtc(dateStr, timeStr, timeZone) {
  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00Z`);
  const offset1 = getTzOffsetMinutes(timeZone, naiveMs);
  let utcMs = naiveMs - offset1 * 60000;
  const offset2 = getTzOffsetMinutes(timeZone, utcMs);
  if (offset2 !== offset1) {
    utcMs = naiveMs - offset2 * 60000;
  }
  return new Date(utcMs);
}

function utcToZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function initManualTimezone() {
  const select = document.getElementById("manual-timezone");
  const zones = getTimezoneList();
  for (const tz of zones) {
    const opt = document.createElement("option");
    opt.value = tz;
    opt.textContent = tz;
    select.appendChild(opt);
  }
  const saved = localStorage.getItem(TIMEZONE_KEY);
  const initial = saved && zones.includes(saved) ? saved : getBrowserTimezone();
  select.value = initial;
  select.onchange = () => {
    localStorage.setItem(TIMEZONE_KEY, select.value);
    syncManualTimeFields("start");
    renderTimeline();
    refreshCalendar();
    refreshToday();
  };
}

const THEME_KEY = "timetrack.theme";
const THEMES = [
  { id: "dark", label: "Dark (default)" },
  { id: "light", label: "Light" },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
  { id: "gruvbox-dark", label: "Gruvbox Dark" },
  { id: "gruvbox-light", label: "Gruvbox Light" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "solarized-light", label: "Solarized Light" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { id: "catppuccin-latte", label: "Catppuccin Latte" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "monokai", label: "Monokai" },
  { id: "rose-pine", label: "Rosé Pine" },
  { id: "github-light", label: "GitHub Light" },
  { id: "sepia", label: "Sepia" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "black-and-white", label: "Black & White" },
];

function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem(THEME_KEY, themeId);
}

function initTheme() {
  const select = document.getElementById("theme-select");
  for (const theme of THEMES) {
    const opt = document.createElement("option");
    opt.value = theme.id;
    opt.textContent = theme.label;
    select.appendChild(opt);
  }
  const saved = localStorage.getItem(THEME_KEY);
  const initial = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  select.value = initial;
  applyTheme(initial);
  select.onchange = () => applyTheme(select.value);
}

const BELL_PRESETS_KEY = "timetrack.bellPresets";
const SOUND_OPTIONS = [
  { id: "bell", label: "Bell" },
  { id: "chime", label: "Chime" },
  { id: "gong", label: "Gong" },
];
const DEFAULT_BELL_PRESETS = [
  {
    id: "preset-meditation-15",
    name: "Meditation (every 15 min, escalating)",
    rules: [{ start: 15, interval: 15, sound: "bell", escalate: true, count: 1 }],
  },
];

let accessToken = null;
let tokenClient = null;

let timer = {
  state: "idle", // idle | running | paused
  totalSeconds: 0,
  remainingSeconds: 0,
  activity: null,
  startedAt: null, // Date when the current run began (for logging real start time)
  intervalId: null,
  activeBellRules: [], // runtime copy of the selected preset's rules, with fire counters
  liveRowNumber: null, // sheet row created at Start, kept updated every minute until Stop/completion
  lastLiveUpdateMinute: 0,
};

// ---------- Activities (stored locally, purely for the dropdown UI) ----------

// Older versions stored activities as a plain array of name strings, then
// later as {name, color}; migrate those in place to {name, color,
// targetMinutes} on first load. Missing targetMinutes defaults to null
// ("not tracked"), not 0, so existing activities don't silently gain a
// "should do zero of this" target.
function normalizeActivities(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return clonePresets(DEFAULT_ACTIVITIES);
  return parsed.map((item, i) =>
    typeof item === "string"
      ? { name: item, color: ACTIVITY_COLOR_PALETTE[i % ACTIVITY_COLOR_PALETTE.length], targetMinutes: null }
      : {
          name: item.name,
          color: item.color || ACTIVITY_COLOR_PALETTE[i % ACTIVITY_COLOR_PALETTE.length],
          targetMinutes: item.targetMinutes === undefined ? null : item.targetMinutes,
        }
  );
}

function loadActivities() {
  const raw = localStorage.getItem(ACTIVITIES_KEY);
  if (!raw) return clonePresets(DEFAULT_ACTIVITIES);
  try {
    return normalizeActivities(JSON.parse(raw));
  } catch {
    return clonePresets(DEFAULT_ACTIVITIES);
  }
}

function saveActivities(list) {
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list));
}

// Stable fallback color for activity names that aren't in the local list
// (e.g. logged from another device, or since removed) — hashed so the same
// name always gets the same color instead of falling back to plain accent.
function hashColorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return ACTIVITY_COLOR_PALETTE[Math.abs(hash) % ACTIVITY_COLOR_PALETTE.length];
}

function getActivityColor(name) {
  const match = loadActivities().find((a) => a.name === name);
  return match ? match.color : hashColorForName(name || "");
}

function renderActivityOptions() {
  const activities = loadActivities();
  for (const select of [document.getElementById("activity-select"), document.getElementById("manual-activity")]) {
    const prev = select.value;
    select.innerHTML = "";
    for (const act of activities) {
      const opt = document.createElement("option");
      opt.value = act.name;
      opt.textContent = act.name;
      select.appendChild(opt);
    }
    if (activities.some((a) => a.name === prev)) select.value = prev;
  }
}

function renderManageModal() {
  const list = document.getElementById("activities-list");
  const activities = loadActivities();
  list.innerHTML = "";
  activities.forEach((act, idx) => {
    const li = document.createElement("li");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "activity-color-input";
    colorInput.value = act.color;
    colorInput.onchange = () => {
      act.color = colorInput.value;
      saveActivities(activities);
      refreshCalendar();
      refreshToday();
    };

    const span = document.createElement("span");
    span.textContent = act.name;
    span.className = "activity-name";

    const targetWrap = document.createElement("span");
    targetWrap.className = "activity-target-wrap";
    const targetInput = document.createElement("input");
    targetInput.type = "number";
    targetInput.min = "0";
    targetInput.className = "activity-target-input";
    targetInput.placeholder = "none";
    targetInput.title = "Daily target (minutes) — leave blank for no target";
    if (act.targetMinutes !== null && act.targetMinutes !== undefined) {
      targetInput.value = act.targetMinutes;
    }
    targetInput.onchange = () => {
      act.targetMinutes = targetInput.value === "" ? null : Math.max(0, parseInt(targetInput.value) || 0);
      saveActivities(activities);
      refreshToday();
    };
    const targetLabel = document.createElement("span");
    targetLabel.className = "hint";
    targetLabel.textContent = "min/day";
    targetWrap.append(targetInput, targetLabel);

    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.onclick = () => {
      const updated = activities.filter((_, i) => i !== idx);
      saveActivities(updated);
      renderManageModal();
      renderActivityOptions();
      refreshToday();
    };

    li.append(colorInput, span, targetWrap, btn);
    list.appendChild(li);
  });
}

// ---------- Bell presets (stored locally) ----------

function clonePresets(presets) {
  return JSON.parse(JSON.stringify(presets));
}

function loadBellPresets() {
  const raw = localStorage.getItem(BELL_PRESETS_KEY);
  if (!raw) return clonePresets(DEFAULT_BELL_PRESETS);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : clonePresets(DEFAULT_BELL_PRESETS);
  } catch {
    return clonePresets(DEFAULT_BELL_PRESETS);
  }
}

function saveBellPresets(list) {
  localStorage.setItem(BELL_PRESETS_KEY, JSON.stringify(list));
}

function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

function renderBellPresetOptions() {
  const select = document.getElementById("bell-preset-select");
  const presets = loadBellPresets();
  const prev = select.value;
  select.innerHTML = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "No bells";
  select.appendChild(noneOpt);
  for (const preset of presets) {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.name;
    select.appendChild(opt);
  }
  if ([...select.options].some((o) => o.value === prev)) select.value = prev;
}

function newRule() {
  return { start: 15, interval: 15, sound: "bell", escalate: true, count: 1 };
}

function renderPresetsModal() {
  const presets = loadBellPresets();
  const container = document.getElementById("presets-list");
  container.innerHTML = "";

  presets.forEach((preset) => {
    const block = document.createElement("div");
    block.className = "preset-block";

    const nameRow = document.createElement("div");
    nameRow.className = "preset-name-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = preset.name;
    nameInput.oninput = () => {
      preset.name = nameInput.value;
      saveBellPresets(presets);
      renderBellPresetOptions();
    };
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete preset";
    deleteBtn.onclick = () => {
      const idx = presets.findIndex((p) => p.id === preset.id);
      presets.splice(idx, 1);
      saveBellPresets(presets);
      renderPresetsModal();
      renderBellPresetOptions();
    };
    nameRow.appendChild(nameInput);
    nameRow.appendChild(deleteBtn);
    block.appendChild(nameRow);

    preset.rules.forEach((rule, ruleIdx) => {
      block.appendChild(renderRuleRow(preset, presets, rule, ruleIdx));
    });

    const addRuleBtn = document.createElement("button");
    addRuleBtn.className = "add-rule-btn";
    addRuleBtn.textContent = "+ Add rule";
    addRuleBtn.onclick = () => {
      preset.rules.push(newRule());
      saveBellPresets(presets);
      renderPresetsModal();
    };
    block.appendChild(addRuleBtn);

    container.appendChild(block);
  });
}

function renderRuleRow(preset, presets, rule, ruleIdx) {
  const row = document.createElement("div");
  row.className = "rule-row";

  const startField = document.createElement("div");
  startField.className = "field";
  const startLabel = document.createElement("label");
  startLabel.textContent = "Starts at (min)";
  const startInput = document.createElement("input");
  startInput.type = "number";
  startInput.min = "0";
  startInput.value = rule.start;
  startInput.oninput = () => {
    rule.start = parseFloat(startInput.value) || 0;
    saveBellPresets(presets);
  };
  startField.append(startLabel, startInput);

  const intervalField = document.createElement("div");
  intervalField.className = "field";
  const intervalLabel = document.createElement("label");
  intervalLabel.textContent = "Repeat every (min, 0=once)";
  const intervalInput = document.createElement("input");
  intervalInput.type = "number";
  intervalInput.min = "0";
  intervalInput.value = rule.interval;
  intervalInput.oninput = () => {
    rule.interval = parseFloat(intervalInput.value) || 0;
    saveBellPresets(presets);
  };
  intervalField.append(intervalLabel, intervalInput);

  const soundField = document.createElement("div");
  soundField.className = "field";
  const soundLabel = document.createElement("label");
  soundLabel.textContent = "Sound";
  const soundSelect = document.createElement("select");
  for (const opt of SOUND_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    soundSelect.appendChild(o);
  }
  soundSelect.value = rule.sound;
  soundSelect.onchange = () => {
    rule.sound = soundSelect.value;
    saveBellPresets(presets);
  };
  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.textContent = "▶ Preview";
  previewBtn.title = "Play this sound";
  previewBtn.onclick = () => ringBell(1, soundSelect.value);
  soundField.append(soundLabel, soundSelect, previewBtn);

  const escalateField = document.createElement("div");
  escalateField.className = "field";
  const escalateLabel = document.createElement("label");
  escalateLabel.textContent = "Ring count increases each time";
  const escalateCheckbox = document.createElement("input");
  escalateCheckbox.type = "checkbox";
  escalateCheckbox.checked = rule.escalate;
  escalateField.append(escalateCheckbox, escalateLabel);

  const countField = document.createElement("div");
  countField.className = "field fixed-count-field" + (rule.escalate ? " hidden" : "");
  const countLabel = document.createElement("label");
  countLabel.textContent = "Rings";
  const countInput = document.createElement("input");
  countInput.type = "number";
  countInput.min = "1";
  countInput.value = rule.count;
  countInput.oninput = () => {
    rule.count = Math.max(1, parseInt(countInput.value) || 1);
    saveBellPresets(presets);
  };
  countField.append(countLabel, countInput);

  escalateCheckbox.onchange = () => {
    rule.escalate = escalateCheckbox.checked;
    countField.classList.toggle("hidden", rule.escalate);
    saveBellPresets(presets);
  };

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-rule-btn";
  removeBtn.textContent = "Remove";
  removeBtn.onclick = () => {
    preset.rules.splice(ruleIdx, 1);
    saveBellPresets(presets);
    renderPresetsModal();
  };

  row.append(startField, intervalField, soundField, escalateField, countField, removeBtn);
  return row;
}

// ---------- Google auth ----------

function initGoogleAuth() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    setTimeout(initGoogleAuth, 200);
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: (resp) => {
      if (resp.error) {
        setStatus("Sign-in failed: " + resp.error);
        return;
      }
      accessToken = resp.access_token;
      onSignedIn();
    },
  });
}

function setSignedInUI(isSignedIn) {
  document.getElementById("app-main").classList.toggle("hidden", !isSignedIn);
  document.getElementById("signin-gate").classList.toggle("hidden", isSignedIn);
  document.getElementById("signin-btn").classList.toggle("hidden", isSignedIn);
  document.getElementById("signed-in").classList.toggle("hidden", !isSignedIn);
}

function onSignedIn() {
  setSignedInUI(true);
  document.getElementById("user-email").textContent = "Connected";
  refreshLog();
  refreshCalendar();
  refreshToday();
}

function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  setSignedInUI(false);
}

// ---------- Sheets API ----------

async function sheetsFetch(path, options = {}) {
  if (!accessToken) throw new Error("Not signed in");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  return res.json();
}

// Columns: Date, Activity, Start, End, Duration (min), Notes, Timezone, Quality.
// Date/Start/End are always stored in UTC. Timezone/Quality were added after
// Notes so pre-existing rows/headers stay valid — we only backfill the
// missing header cells rather than reordering anything.
const HEADER_ROW = ["Date", "Activity", "Start", "End", "Duration (min)", "Notes", "Timezone", "Quality"];

async function ensureHeaderRow() {
  const range = `${CONFIG.SHEET_NAME}!A1:H1`;
  const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  const row = (data.values && data.values[0]) || [];
  if (row.length === 0) {
    await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ range, values: [HEADER_ROW] }),
    });
  } else if (row.length < HEADER_ROW.length) {
    const missingRange = `${CONFIG.SHEET_NAME}!${String.fromCharCode(65 + row.length)}1:H1`;
    await sheetsFetch(`/values/${encodeURIComponent(missingRange)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ range: missingRange, values: [HEADER_ROW.slice(row.length)] }),
    });
  }
}

// Returns the row number the entry landed on (parsed from the Sheets API
// response), so a quality rating chosen after the fact can be patched in
// without re-sending the whole row.
async function appendEntry({ date, activity, start, end, durationMin, notes, timezone, quality }) {
  await ensureHeaderRow();
  const range = `${CONFIG.SHEET_NAME}!A:H`;
  const response = await sheetsFetch(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({
      range,
      values: [[date, activity, start, end, durationMin, notes || "", timezone || "", quality ?? ""]],
    }),
  });
  setStatus(`Logged "${activity}" — ${durationMin} min.`);
  refreshLog();
  const updatedRange = response && response.updates && response.updates.updatedRange;
  const match = updatedRange && updatedRange.match(/![A-Z]+(\d+):/);
  return { rowNumber: match ? parseInt(match[1]) : null };
}

async function updateEntryQuality(rowNumber, quality) {
  if (!rowNumber) return;
  const range = `${CONFIG.SHEET_NAME}!H${rowNumber}:H${rowNumber}`;
  await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range, values: [[quality]] }),
  });
}

let cachedSheetId = null;

async function getSheetId() {
  if (cachedSheetId !== null) return cachedSheetId;
  const data = await sheetsFetch(`?fields=${encodeURIComponent("sheets.properties")}`);
  const sheet = (data.sheets || []).find((s) => s.properties.title === CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Sheet tab "${CONFIG.SHEET_NAME}" not found`);
  cachedSheetId = sheet.properties.sheetId;
  return cachedSheetId;
}

async function deleteEntryRow(rowNumber) {
  const sheetId = await getSheetId();
  await sheetsFetch(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    }),
  });
}

async function fetchRecentEntries(limit = 50) {
  const range = `${CONFIG.SHEET_NAME}!A2:H`;
  const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  const rows = data.values || [];
  // Row 1 is the header, so data row i (0-based) lives on sheet row i+2.
  const withRowNumbers = rows.map((row, i) => ({ row, rowNumber: i + 2 }));
  return withRowNumbers.slice(-limit).reverse();
}

async function refreshLog() {
  const listEl = document.getElementById("log-list");
  if (!accessToken) return;
  try {
    const entries = await fetchRecentEntries();
    listEl.innerHTML = "";
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="status">No entries yet.</div>';
      return;
    }
    for (const { row, rowNumber } of entries) {
      const [date, activity, start, end, duration, notes, timezone, quality] = row;
      const tz = timezone || getBrowserTimezone();
      let displayDate = date, displayStart = start, displayEnd = end;
      try {
        const startUtc = new Date(`${date}T${start}:00Z`);
        const endUtc = new Date(startUtc.getTime() + Number(duration) * 60000);
        const localStart = utcToZonedParts(startUtc, tz);
        const localEnd = utcToZonedParts(endUtc, tz);
        displayDate = localStart.date;
        displayStart = localStart.time;
        displayEnd = localEnd.time + (localEnd.date !== localStart.date ? " (+1d)" : "");
      } catch {
        // fall back to raw stored values if parsing/timezone conversion fails
      }
      const div = document.createElement("div");
      div.className = "log-entry";
      div.dataset.rowNumber = String(rowNumber);

      const infoDiv = document.createElement("div");
      infoDiv.innerHTML = `
        <div class="activity"><span class="activity-dot" style="background:${escapeHtml(getActivityColor(activity))}"></span>${escapeHtml(activity || "")}</div>
        <div class="meta">${escapeHtml(displayDate || "")} · ${escapeHtml(displayStart || "")}–${escapeHtml(displayEnd || "")}${tz ? " · " + escapeHtml(tz) : ""}${notes ? " · " + escapeHtml(notes) : ""}</div>
      `;

      const rightDiv = document.createElement("div");
      rightDiv.className = "log-entry-right";
      const topRow = document.createElement("div");
      topRow.className = "log-entry-top-row";
      const durationSpan = document.createElement("div");
      durationSpan.className = "meta";
      durationSpan.textContent = `${duration || ""} min`;
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-entry-btn";
      deleteBtn.title = "Delete entry";
      deleteBtn.textContent = "🗑";
      deleteBtn.onclick = () => confirmDeleteEntry(rowNumber, activity);
      topRow.append(durationSpan, deleteBtn);
      const qualityRow = renderQualityMiniButtons(rowNumber, quality);
      rightDiv.append(topRow, qualityRow);

      div.append(infoDiv, rightDiv);
      listEl.appendChild(div);
    }
  } catch (err) {
    setStatus("Could not load log: " + err.message);
  }
}

async function confirmDeleteEntry(rowNumber, activity) {
  const ok = window.confirm(`Delete this "${activity || "entry"}" log? This can't be undone.`);
  if (!ok) return;
  try {
    await deleteEntryRow(rowNumber);
    setStatus("Entry deleted.");
    refreshLog();
    refreshCalendar();
    refreshToday();
  } catch (err) {
    setStatus("Failed to delete entry: " + err.message);
  }
}

function highlightLogEntry(rowNumber) {
  const el = document.querySelector(`.log-entry[data-row-number="${rowNumber}"]`);
  if (!el) {
    setStatus("That entry isn't in the Recent entries list (hit Refresh, or it's older than the last 10).");
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlighted");
  setTimeout(() => el.classList.remove("highlighted"), 2000);
}

function renderQualityMiniButtons(rowNumber, currentQuality) {
  const wrap = document.createElement("div");
  wrap.className = "quality-buttons mini";
  for (let i = 0; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(i);
    if (String(currentQuality) === String(i)) btn.classList.add("selected");
    btn.onclick = async () => {
      const newQuality = String(currentQuality) === String(i) ? "" : String(i);
      wrap.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      if (newQuality !== "") btn.classList.add("selected");
      try {
        await updateEntryQuality(rowNumber, newQuality);
      } catch (err) {
        setStatus("Failed to update quality: " + err.message);
      }
    };
    wrap.appendChild(btn);
  }
  return wrap;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Timer ----------

function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatHMS(timer.remainingSeconds);
}

function setTimerButtons() {
  const start = document.getElementById("start-btn");
  const pause = document.getElementById("pause-btn");
  const resume = document.getElementById("resume-btn");
  const stop = document.getElementById("stop-btn");
  start.classList.toggle("hidden", timer.state !== "idle");
  pause.classList.toggle("hidden", timer.state !== "running");
  resume.classList.toggle("hidden", timer.state !== "paused");
  stop.classList.toggle("hidden", timer.state === "idle");
}

function getDurationSeconds() {
  const hours = parseInt(document.getElementById("duration-hours").value) || 0;
  const minutes = parseInt(document.getElementById("duration-minutes").value) || 0;
  const seconds = parseInt(document.getElementById("duration-seconds").value) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function setDurationMinutes(minutes) {
  document.getElementById("duration-hours").value = Math.floor(minutes / 60);
  document.getElementById("duration-minutes").value = minutes % 60;
  document.getElementById("duration-seconds").value = 0;
}

// ---------- Screen wake lock (keeps the screen on while the timer runs) ----------

let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // e.g. denied, or tab not visible — non-fatal, timer still runs
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && timer.state === "running" && !wakeLock) {
    requestWakeLock();
  }
});

function startTimer() {
  const activity = document.getElementById("activity-select").value;
  const totalSeconds = getDurationSeconds();
  if (!activity) {
    setStatus("Pick an activity first.");
    return;
  }
  if (!totalSeconds || totalSeconds <= 0) {
    setStatus("Enter a valid countdown duration.");
    return;
  }
  timer.state = "running";
  timer.activity = activity;
  timer.totalSeconds = totalSeconds;
  timer.remainingSeconds = timer.totalSeconds;
  timer.startedAt = new Date();

  const presetId = document.getElementById("bell-preset-select").value;
  const preset = loadBellPresets().find((p) => p.id === presetId);
  timer.activeBellRules = preset
    ? preset.rules.map((r) => ({ ...r, lastFireCount: 0 }))
    : [];

  setStatus("");
  setTimerButtons();
  updateTimerDisplay();
  tick();
  requestWakeLock();
  beginLiveEntryPromise = beginLiveEntry();
}

// Stop/completion can happen before the Start write's round-trip finishes;
// finalizeLiveEntry awaits this so it always has the real row number instead
// of racing it and reporting a false "wasn't logged".
let beginLiveEntryPromise = null;

// Writes a row to the Sheet the instant the timer starts (0 min, end = start),
// so it shows up immediately instead of only once the timer finishes. Every
// minute that passes, that same row gets patched with the elapsed time so
// far; Stop/completion does one final patch with the exact end time.
async function beginLiveEntry() {
  timer.liveRowNumber = null;
  timer.lastLiveUpdateMinute = 0;
  const timezone = document.getElementById("manual-timezone").value || getBrowserTimezone();
  try {
    const { rowNumber } = await appendEntry({
      date: formatDate(timer.startedAt),
      activity: timer.activity,
      start: formatTime(timer.startedAt),
      end: formatTime(timer.startedAt),
      durationMin: 0,
      notes: "",
      timezone,
      quality: "",
    });
    timer.liveRowNumber = rowNumber;
    refreshCalendar();
    refreshToday();
  } catch (err) {
    setStatus("Failed to start live log: " + err.message);
  }
}

async function updateLiveEntryProgress(elapsedMin) {
  if (!timer.liveRowNumber) return;
  const end = new Date(timer.startedAt.getTime() + elapsedMin * 60000);
  const range = `${CONFIG.SHEET_NAME}!D${timer.liveRowNumber}:E${timer.liveRowNumber}`;
  try {
    await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ range, values: [[formatTime(end), elapsedMin]] }),
    });
    refreshCalendar();
    refreshToday();
  } catch {
    // transient failure (e.g. a momentarily expired token) — next minute's
    // update, or the final one on Stop/completion, will just try again.
  }
}

function tick() {
  clearInterval(timer.intervalId);
  timer.intervalId = setInterval(() => {
    if (timer.state !== "running") return;
    timer.remainingSeconds -= 1;
    updateTimerDisplay();
    checkBellRules();
    const elapsedMin = Math.floor((timer.totalSeconds - timer.remainingSeconds) / 60);
    if (elapsedMin > timer.lastLiveUpdateMinute) {
      timer.lastLiveUpdateMinute = elapsedMin;
      updateLiveEntryProgress(elapsedMin);
    }
    if (timer.remainingSeconds <= 0) {
      clearInterval(timer.intervalId);
      completeTimer();
    }
  }, 1000);
}

function pauseTimer() {
  timer.state = "paused";
  setTimerButtons();
  releaseWakeLock();
}

function resumeTimer() {
  timer.state = "running";
  setTimerButtons();
  requestWakeLock();
}

async function completeTimer() {
  const end = new Date();
  const durationMin = Math.round(timer.totalSeconds / 60);
  timer.state = "idle";
  setTimerButtons();
  updateTimerDisplay();
  releaseWakeLock();
  notifyDone();
  await finalizeLiveEntry(end, durationMin);
}

async function stopTimer() {
  const end = new Date();
  const elapsedSeconds = timer.totalSeconds - timer.remainingSeconds;
  const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
  clearInterval(timer.intervalId);
  timer.state = "idle";
  timer.remainingSeconds = 0;
  setTimerButtons();
  updateTimerDisplay();
  releaseWakeLock();
  await finalizeLiveEntry(end, durationMin);
}

let pendingQualityRow = null;

async function finalizeLiveEntry(end, durationMin) {
  if (beginLiveEntryPromise) {
    await beginLiveEntryPromise;
    beginLiveEntryPromise = null;
  }
  const activity = timer.activity;
  const rowNumber = timer.liveRowNumber;
  timer.activity = null;
  timer.startedAt = null;
  timer.liveRowNumber = null;
  pendingQualityRow = null;

  if (!rowNumber) {
    setStatus("Entry wasn't logged (the initial write at Start never succeeded).");
    return;
  }
  const range = `${CONFIG.SHEET_NAME}!D${rowNumber}:E${rowNumber}`;
  try {
    await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ range, values: [[formatTime(end), durationMin]] }),
    });
    setStatus(`Logged "${activity}" — ${durationMin} min.`);
    refreshLog();
    refreshCalendar();
    refreshToday();
    pendingQualityRow = rowNumber;
    document.getElementById("quality-picker").classList.remove("hidden");
  } catch (err) {
    setStatus("Failed to finalize entry: " + err.message);
  }
}

async function finalizeTimerEntry(quality) {
  document.getElementById("quality-picker").classList.add("hidden");
  const rowNumber = pendingQualityRow;
  pendingQualityRow = null;
  if (!rowNumber || quality === "") return;
  try {
    await updateEntryQuality(rowNumber, quality);
    refreshLog();
  } catch (err) {
    setStatus("Entry logged, but failed to save quality rating: " + err.message);
  }
}

const SOUND_PROFILES = {
  bell: { freq: 528, decay: 2.8, gap: 3.2 },
  chime: { freq: 1046, decay: 1.8, gap: 2.2 },
  gong: { freq: 220, decay: 4.5, gap: 5.0 },
};

function checkBellRules() {
  if (!timer.activeBellRules.length || timer.remainingSeconds <= 0) return;
  const elapsedMin = (timer.totalSeconds - timer.remainingSeconds) / 60;
  for (const rule of timer.activeBellRules) {
    if (elapsedMin < rule.start) continue;
    let occurrence;
    if (rule.interval > 0) {
      occurrence = Math.floor((elapsedMin - rule.start) / rule.interval) + 1;
    } else {
      occurrence = 1; // one-shot rule
    }
    if (occurrence > rule.lastFireCount) {
      rule.lastFireCount = occurrence;
      const ringCount = rule.escalate ? occurrence : rule.count;
      ringBell(ringCount, rule.sound);
    }
  }
}

function ringBell(times, soundId = "bell") {
  const profile = SOUND_PROFILES[soundId] || SOUND_PROFILES.bell;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const startTime = ctx.currentTime + i * profile.gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = profile.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + profile.decay);
      osc.start(startTime);
      osc.stop(startTime + profile.decay);
    }
  } catch {}
}

function notifyDone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), 300);
  } catch {}
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    new Notification("TimeTrack", { body: "Timer finished." });
  }
}

// ---------- Manual entry ----------

// Both always express the UTC instant, regardless of the browser's local timezone.
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function formatTime(d) {
  return d.toISOString().slice(11, 16);
}

const DAY_MINUTES = 1440;
let manualSelectedQuality = null;

function minutesOfDay(timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  mins = ((Math.round(mins) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Start, Duration, and End are three views of the same interval — editing
// any one recomputes the other two. `source` says which field the user just
// touched, so we know which pair to derive from.
function syncManualTimeFields(source) {
  const timezone = document.getElementById("manual-timezone").value || getBrowserTimezone();
  const date = document.getElementById("manual-date").value;
  const startInput = document.getElementById("manual-start");
  const durationInput = document.getElementById("manual-duration");
  const endInput = document.getElementById("manual-end");
  const badge = document.getElementById("manual-end-badge");

  if (!date || !startInput.value) return;

  if (source === "end") {
    const startUtc = zonedToUtc(date, startInput.value, timezone);
    let endUtc = zonedToUtc(date, endInput.value || startInput.value, timezone);
    if (endUtc <= startUtc) endUtc = new Date(endUtc.getTime() + 24 * 3600000);
    durationInput.value = Math.max(1, Math.round((endUtc - startUtc) / 60000));
  } else {
    // source is "start", "date", "duration", or a timeline drag — duration
    // is authoritative, recompute the end time from start + duration.
    const durationMin = parseInt(durationInput.value) || 0;
    const startUtc = zonedToUtc(date, startInput.value, timezone);
    const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
    const endLocal = utcToZonedParts(endUtc, timezone);
    endInput.value = endLocal.time;
  }

  // Recompute the +1 day badge from whatever the fields now settle on.
  const startUtc = zonedToUtc(date, startInput.value, timezone);
  const durationMin = parseInt(durationInput.value) || 0;
  const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
  const endLocal = utcToZonedParts(endUtc, timezone);
  badge.textContent = endLocal.date !== date ? `Ends next day, ${timezone}` : timezone;
}

function renderTimeline() {
  const startStr = document.getElementById("manual-start").value || "00:00";
  const durationMin = parseInt(document.getElementById("manual-duration").value) || 0;
  const startMin = minutesOfDay(startStr);

  const bar = document.getElementById("timeline-bar");
  const leftPct = (startMin / DAY_MINUTES) * 100;
  const visibleDuration = Math.max(Math.min(durationMin, DAY_MINUTES - startMin), 0);
  const widthPct = Math.max((visibleDuration / DAY_MINUTES) * 100, 0.6);
  bar.style.left = `${leftPct}%`;
  bar.style.width = `${widthPct}%`;

  const timezone = document.getElementById("manual-timezone").value || getBrowserTimezone();
  const nowMin = minutesOfDay(utcToZonedParts(new Date(), timezone).time);
  document.getElementById("timeline-now-marker").style.left = `${(nowMin / DAY_MINUTES) * 100}%`;
}

function renderTimelineHours() {
  const hoursEl = document.getElementById("timeline-hours");
  hoursEl.innerHTML = "";
  for (let h = 0; h <= 24; h += 3) {
    const span = document.createElement("span");
    span.textContent = String(h).padStart(2, "0");
    hoursEl.appendChild(span);
  }
}

// ---------- Calendar (past 7 days) ----------

const CALENDAR_HOURS = 24;
const CALENDAR_HOUR_PX = 32;

// Number of days back from today the visible 7-day window starts, in steps
// of 7. 0 = current week (ending today), 7 = previous week, etc. Also
// supports arbitrary day-granularity jumps via shiftCalendarByDays.
let calendarDayOffset = 0;

function addDaysToDateStr(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getCalendarDisplayTimezone() {
  return document.getElementById("manual-timezone").value || getBrowserTimezone();
}

function renderCalendarSkeleton() {
  const tz = getCalendarDisplayTimezone();
  const todayStr = utcToZonedParts(new Date(), tz).date;
  const windowEndStr = addDaysToDateStr(todayStr, -calendarDayOffset);
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDaysToDateStr(windowEndStr, -i));

  const headersEl = document.getElementById("calendar-day-headers");
  headersEl.innerHTML = "";
  headersEl.appendChild(document.createElement("div"));
  for (const dateStr of days) {
    const cell = document.createElement("div");
    const dObj = new Date(`${dateStr}T00:00:00Z`);
    cell.textContent = dObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" });
    if (dateStr === todayStr) cell.classList.add("today");
    headersEl.appendChild(cell);
  }

  const rangeLabelEl = document.getElementById("calendar-range-label");
  if (rangeLabelEl) {
    const startObj = new Date(`${days[0]}T00:00:00Z`);
    const endObj = new Date(`${days[days.length - 1]}T00:00:00Z`);
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
    rangeLabelEl.textContent = calendarDayOffset === 0 ? `${fmt(startObj)} – ${fmt(endObj)} (this week)` : `${fmt(startObj)} – ${fmt(endObj)}`;
  }

  const body = document.getElementById("calendar-body");
  body.innerHTML = "";
  body.style.gridTemplateRows = `repeat(${CALENDAR_HOURS}, ${CALENDAR_HOUR_PX}px)`;

  for (let h = 0; h < CALENDAR_HOURS; h++) {
    const label = document.createElement("div");
    label.className = "calendar-hour-label";
    label.style.gridRow = String(h + 1);
    label.style.gridColumn = "1";
    label.textContent = `${String(h).padStart(2, "0")}:00`;
    body.appendChild(label);
  }

  const dayCols = days.map((dateStr, idx) => {
    const col = document.createElement("div");
    col.className = "calendar-day-col";
    col.dataset.date = dateStr;
    col.style.gridRow = `1 / ${CALENDAR_HOURS + 1}`;
    col.style.gridColumn = String(idx + 2);
    body.appendChild(col);
    attachCalendarDragHandlers(col, dateStr);
    return col;
  });

  const todayIdx = days.indexOf(todayStr);
  if (todayIdx !== -1) {
    const nowMin = minutesOfDay(utcToZonedParts(new Date(), tz).time);
    const line = document.createElement("div");
    line.className = "calendar-now-line";
    line.style.top = `${(nowMin / DAY_MINUTES) * CALENDAR_HOUR_PX * CALENDAR_HOURS}px`;
    dayCols[todayIdx].appendChild(line);
  }

  return { days, dayCols };
}

// Splits a [startUtc, endUtc) interval into one segment per local calendar
// day it touches, each with the minute-of-day range for that day — so an
// overnight entry gets drawn as a block on each day it actually crosses,
// instead of being clipped to just its start day.
function splitIntoDaySegments(startUtc, endUtc, tz) {
  const segments = [];
  let cursor = startUtc;
  let guard = 0;
  while (cursor < endUtc && guard < 30) {
    guard++;
    const localCursor = utcToZonedParts(cursor, tz);
    const dayStartUtc = zonedToUtc(localCursor.date, "00:00", tz);
    const nextDayStartUtc = zonedToUtc(addDaysToDateStr(localCursor.date, 1), "00:00", tz);
    const segmentEndUtc = endUtc < nextDayStartUtc ? endUtc : nextDayStartUtc;
    segments.push({
      dateStr: localCursor.date,
      startMin: Math.round((cursor - dayStartUtc) / 60000),
      endMin: Math.round((segmentEndUtc - dayStartUtc) / 60000),
    });
    cursor = segmentEndUtc;
  }
  return segments;
}

// ---------- Today summary ----------

function formatMinutesShort(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function isSleepActivity(name) {
  return (name || "").trim().toLowerCase() === "sleep";
}

async function refreshToday() {
  if (!accessToken) return;
  const tz = getCalendarDisplayTimezone();
  const todayStr = utcToZonedParts(new Date(), tz).date;

  try {
    const range = `${CONFIG.SHEET_NAME}!A2:H`;
    const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
    const rows = data.values || [];

    const totals = {}; // activity name -> minutes logged today
    let lastSleep = null; // most recent sleep entry, any date

    for (const row of rows) {
      const [date, activity, start, , duration] = row;
      if (!date || !start) continue;
      const startUtc = new Date(`${date}T${start}:00Z`);
      if (Number.isNaN(startUtc.getTime())) continue;
      const durationMin = Number(duration) || 0;

      if (isSleepActivity(activity)) {
        if (!lastSleep || startUtc > lastSleep.startUtc) {
          lastSleep = { startUtc, durationMin };
        }
        continue; // sleep is never counted in today's activity totals
      }

      const localStart = utcToZonedParts(startUtc, tz);
      if (localStart.date === todayStr) {
        const key = activity || "(no activity)";
        totals[key] = (totals[key] || 0) + durationMin;
      }
    }

    renderTodaySummary(totals, lastSleep, tz);
  } catch (err) {
    setStatus("Could not load today's summary: " + err.message);
  }
}

function renderTodaySummary(totals, lastSleep, tz) {
  const container = document.getElementById("today-summary");
  container.innerHTML = "";

  const activities = loadActivities();
  const targetByName = Object.fromEntries(
    activities.filter((a) => a.targetMinutes !== null && a.targetMinutes !== undefined).map((a) => [a.name, a.targetMinutes])
  );
  // Targeted activities show even at 0 min today (so an unmet goal is
  // visible), in the user's configured order; anything else logged today
  // but without a target follows, busiest first.
  const targetedNames = activities.map((a) => a.name).filter((name) => name in targetByName);
  const extraNames = Object.keys(totals)
    .filter((name) => !(name in targetByName))
    .sort((a, b) => totals[b] - totals[a]);
  const orderedNames = [...targetedNames, ...extraNames];

  if (orderedNames.length === 0) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "Nothing logged yet today.";
    container.appendChild(empty);
  } else {
    const untargetedMax = Math.max(1, ...extraNames.map((n) => totals[n] || 0));
    for (const name of orderedNames) {
      const minutes = totals[name] || 0;
      const target = name in targetByName ? targetByName[name] : null;
      const color = getActivityColor(name);
      const row = document.createElement("div");
      row.className = "today-row";

      let pct, barColor, valueText;
      if (target === null) {
        pct = Math.round((minutes / untargetedMax) * 100);
        barColor = color;
        valueText = formatMinutesShort(minutes);
      } else if (target === 0) {
        pct = minutes > 0 ? 100 : 0;
        barColor = minutes > 0 ? "var(--danger)" : color;
        valueText = minutes > 0 ? `${formatMinutesShort(minutes)} (target: none)` : "0m (target: none)";
      } else {
        pct = Math.min(Math.round((minutes / target) * 100), 100);
        barColor = minutes > target ? "var(--danger)" : color;
        valueText = `${formatMinutesShort(minutes)} / ${formatMinutesShort(target)}`;
      }

      row.innerHTML = `
        <div class="today-row-label"><span class="activity-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(name)}</div>
        <div class="today-row-bar-wrap"><div class="today-row-bar" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="today-row-value">${escapeHtml(valueText)}</div>
      `;
      container.appendChild(row);
    }
  }

  const sleepEl = document.getElementById("today-last-sleep");
  if (lastSleep) {
    const localStart = utcToZonedParts(lastSleep.startUtc, tz);
    const localEnd = utcToZonedParts(new Date(lastSleep.startUtc.getTime() + lastSleep.durationMin * 60000), tz);
    sleepEl.textContent = `Last sleep: ${formatMinutesShort(lastSleep.durationMin)} (${localStart.date} ${localStart.time}–${localEnd.time})`;
  } else {
    sleepEl.textContent = 'Last sleep: no entries logged with an activity named "Sleep" yet.';
  }
}

function shiftCalendarByDays(deltaDays) {
  calendarDayOffset = Math.max(0, calendarDayOffset + deltaDays);
  refreshCalendar();
}

function jumpCalendarToThisWeek() {
  calendarDayOffset = 0;
  refreshCalendar();
}

async function refreshCalendar() {
  if (!accessToken) return;
  const tz = getCalendarDisplayTimezone();
  const { days, dayCols } = renderCalendarSkeleton();
  const dayIndex = Object.fromEntries(days.map((d, i) => [d, i]));
  const totalHeight = CALENDAR_HOUR_PX * CALENDAR_HOURS;

  try {
    const range = `${CONFIG.SHEET_NAME}!A2:H`;
    const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
    const rows = data.values || [];
    rows.forEach((row, i) => {
      const rowNumber = i + 2;
      const [date, activity, start, , duration, notes, , quality] = row;
      if (!date || !start) return;
      const startUtc = new Date(`${date}T${start}:00Z`);
      if (Number.isNaN(startUtc.getTime())) return;

      const durationMin = Number(duration) || 0;
      const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
      const localStart = utcToZonedParts(startUtc, tz);
      const localEnd = utcToZonedParts(endUtc, tz);
      const tooltip = [
        activity,
        `${localStart.time}–${localEnd.time}`,
        notes || "",
        quality !== undefined && quality !== "" ? `Quality: ${quality}` : "",
      ].filter(Boolean).join("\n");

      const segments = splitIntoDaySegments(startUtc, endUtc, tz);
      segments.forEach((seg, segIdx) => {
        const idx = dayIndex[seg.dateStr];
        if (idx === undefined) return;
        const top = (seg.startMin / DAY_MINUTES) * totalHeight;
        const height = Math.max(((seg.endMin - seg.startMin) / DAY_MINUTES) * totalHeight, 14);

        const block = document.createElement("div");
        block.className = "calendar-block";
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.background = getActivityColor(activity);
        block.dataset.rowNumber = String(rowNumber);
        const label = segIdx === 0 ? (activity || "") : `↳ ${activity || ""}`;
        block.innerHTML = `<div>${escapeHtml(label)}</div><div class="cb-time">${escapeHtml(localStart.time)}–${escapeHtml(localEnd.time)}</div>`;
        block.title = tooltip;
        block.addEventListener("pointerdown", (e) => e.stopPropagation());
        block.addEventListener("click", (e) => {
          e.stopPropagation();
          highlightLogEntry(rowNumber);
        });
        dayCols[idx].appendChild(block);
      });
    });
  } catch (err) {
    setStatus("Could not load calendar: " + err.message);
  }
}

function showCalendarTooltip(clientX, clientY, html) {
  const tip = document.getElementById("calendar-time-tooltip");
  tip.innerHTML = html;
  tip.style.left = `${clientX + 14}px`;
  tip.style.top = `${clientY + 14}px`;
  tip.classList.remove("hidden");
}

function hideCalendarTooltip() {
  document.getElementById("calendar-time-tooltip").classList.add("hidden");
}

function attachCalendarDragHandlers(col, dateStr) {
  const totalHeight = CALENDAR_HOUR_PX * CALENDAR_HOURS;
  let dragging = false;
  let startY = 0;
  let previewEl = null;

  function minutesFromClientY(clientY) {
    const rect = col.getBoundingClientRect();
    const pct = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return Math.round((pct * DAY_MINUTES) / 5) * 5;
  }

  function updatePreview(clientX, clientY) {
    const startMin = minutesFromClientY(startY);
    const curMin = minutesFromClientY(clientY);
    const from = Math.min(startMin, curMin);
    const to = Math.max(startMin, curMin, from + 15);
    previewEl.style.top = `${(from / DAY_MINUTES) * totalHeight}px`;
    previewEl.style.height = `${((to - from) / DAY_MINUTES) * totalHeight}px`;
    previewEl.dataset.from = from;
    previewEl.dataset.to = to;
    showCalendarTooltip(
      clientX,
      clientY,
      `${minutesToTimeStr(from)} – ${minutesToTimeStr(to)}<br><span class="hint">${to - from} min</span>`
    );
  }

  function onMove(e) {
    if (!dragging) return;
    updatePreview(e.clientX, e.clientY);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    hideCalendarTooltip();
    const from = parseInt(previewEl.dataset.from);
    const to = parseInt(previewEl.dataset.to);
    previewEl.remove();
    previewEl = null;
    applyCalendarSelection(dateStr, from, Math.max(to - from, 15));
  }

  col.addEventListener("pointerdown", (e) => {
    if (e.target !== col) return; // don't start a new drag on top of an existing block
    dragging = true;
    startY = e.clientY;
    previewEl = document.createElement("div");
    previewEl.className = "calendar-drag-preview";
    col.appendChild(previewEl);
    updatePreview(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  });

  col.addEventListener("pointermove", (e) => {
    if (dragging) return; // drag already shows its own start–end–duration tooltip
    const min = minutesFromClientY(e.clientY);
    showCalendarTooltip(e.clientX, e.clientY, minutesToTimeStr(min));
  });

  col.addEventListener("pointerleave", () => {
    if (!dragging) hideCalendarTooltip();
  });
}

function applyCalendarSelection(dateStr, startMin, durationMin) {
  document.getElementById("manual-date").value = dateStr;
  document.getElementById("manual-start").value = minutesToTimeStr(startMin);
  document.getElementById("manual-duration").value = durationMin;
  syncManualTimeFields("duration");
  renderTimeline();
  setStatus(`Manual entry set to ${minutesToTimeStr(startMin)}, ${durationMin} min — pick an activity below and hit Add entry.`);
}

function initTimelineDrag() {
  const track = document.getElementById("timeline-track");
  const bar = document.getElementById("timeline-bar");
  const handle = document.getElementById("timeline-handle-right");
  const startInput = document.getElementById("manual-start");
  const durationInput = document.getElementById("manual-duration");
  const endInput = document.getElementById("manual-end");

  let dragMode = null;
  let dragStartX = 0;
  let dragStartMinutes = 0;
  let dragStartDuration = 0;

  function onMove(e) {
    if (!dragMode) return;
    const rect = track.getBoundingClientRect();
    const deltaMin = ((e.clientX - dragStartX) / rect.width) * DAY_MINUTES;
    if (dragMode === "move") {
      const newStart = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(dragStartMinutes + deltaMin)));
      startInput.value = minutesToTimeStr(newStart);
      syncManualTimeFields("start");
    } else if (dragMode === "resize") {
      const newDuration = Math.max(5, Math.round(dragStartDuration + deltaMin));
      durationInput.value = newDuration;
      syncManualTimeFields("duration");
    }
    renderTimeline();
  }

  function onUp() {
    dragMode = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  bar.addEventListener("pointerdown", (e) => {
    if (e.target === handle) return;
    dragMode = "move";
    dragStartX = e.clientX;
    dragStartMinutes = minutesOfDay(startInput.value);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  });

  handle.addEventListener("pointerdown", (e) => {
    dragMode = "resize";
    dragStartX = e.clientX;
    dragStartDuration = parseInt(durationInput.value) || 30;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.stopPropagation();
    e.preventDefault();
  });

  track.addEventListener("pointerdown", (e) => {
    if (e.target !== track) return;
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    startInput.value = minutesToTimeStr(pct * DAY_MINUTES);
    syncManualTimeFields("start");
    renderTimeline();
  });

  startInput.addEventListener("input", () => { syncManualTimeFields("start"); renderTimeline(); });
  durationInput.addEventListener("input", () => { syncManualTimeFields("duration"); renderTimeline(); });
  endInput.addEventListener("input", () => { syncManualTimeFields("end"); renderTimeline(); });
  document.getElementById("manual-date").addEventListener("input", () => { syncManualTimeFields("start"); renderTimeline(); });
}

function buildQualityButtons(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (let i = 0; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(i);
    btn.dataset.value = String(i);
    container.appendChild(btn);
  }
}

function resetManualFormToDefaults() {
  const timezone = document.getElementById("manual-timezone").value || getBrowserTimezone();
  const nowParts = utcToZonedParts(new Date(), timezone);
  document.getElementById("manual-date").value = nowParts.date;
  document.getElementById("manual-start").value = nowParts.time;
  document.getElementById("manual-duration").value = 30;
  document.getElementById("manual-notes").value = "";
  manualSelectedQuality = null;
  document.querySelectorAll("#manual-quality-buttons button").forEach((b) => b.classList.remove("selected"));
  syncManualTimeFields("start");
  renderTimeline();
}

async function handleManualSubmit(e) {
  e.preventDefault();
  const activity = document.getElementById("manual-activity").value;
  const timezone = document.getElementById("manual-timezone").value || getBrowserTimezone();
  const date = document.getElementById("manual-date").value;
  const startStr = document.getElementById("manual-start").value;
  const durationMin = parseInt(document.getElementById("manual-duration").value) || 0;
  const notes = document.getElementById("manual-notes").value;

  if (!durationMin || durationMin <= 0) {
    setStatus("Enter a valid duration.");
    return;
  }
  if (!accessToken) {
    setStatus("Sign in with Google first.");
    return;
  }

  const startUtc = zonedToUtc(date, startStr, timezone);
  const endUtc = new Date(startUtc.getTime() + durationMin * 60000);

  try {
    await appendEntry({
      date: formatDate(startUtc),
      activity,
      start: formatTime(startUtc),
      end: formatTime(endUtc),
      durationMin,
      notes,
      timezone,
      quality: manualSelectedQuality ?? "",
    });
    resetManualFormToDefaults();
    refreshCalendar();
    refreshToday();
  } catch (err) {
    setStatus("Failed to log entry: " + err.message);
  }
}

// ---------- Misc UI ----------

function setStatus(msg) {
  document.getElementById("status-msg").textContent = msg;
}

function checkConfig() {
  const configured =
    CONFIG.CLIENT_ID && !CONFIG.CLIENT_ID.startsWith("YOUR_") &&
    CONFIG.SPREADSHEET_ID && !CONFIG.SPREADSHEET_ID.startsWith("YOUR_");
  document.getElementById("setup-banner").classList.toggle("hidden", configured);
  document.getElementById("signin-btn").disabled = !configured;
  document.getElementById("signin-gate-btn").disabled = !configured;
  return configured;
}

// ---------- Wire up ----------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderActivityOptions();
  renderBellPresetOptions();

  initManualTimezone();
  renderTimelineHours();
  initTimelineDrag();
  resetManualFormToDefaults();

  buildQualityButtons("quality-buttons");
  document.querySelectorAll("#quality-buttons button").forEach((btn) => {
    btn.onclick = () => finalizeTimerEntry(btn.dataset.value);
  });
  document.getElementById("quality-skip-btn").onclick = () => finalizeTimerEntry("");

  buildQualityButtons("manual-quality-buttons");
  document.querySelectorAll("#manual-quality-buttons button").forEach((btn) => {
    btn.onclick = () => {
      manualSelectedQuality = manualSelectedQuality === btn.dataset.value ? null : btn.dataset.value;
      document.querySelectorAll("#manual-quality-buttons button").forEach((b) =>
        b.classList.toggle("selected", b.dataset.value === manualSelectedQuality)
      );
    };
  });

  document.getElementById("manual-now-btn").onclick = resetManualFormToDefaults;

  updateTimerDisplay();
  setTimerButtons();

  setSignedInUI(false);
  const configured = checkConfig();
  if (configured) initGoogleAuth();

  const requestSignIn = () => tokenClient && tokenClient.requestAccessToken();
  document.getElementById("signin-btn").onclick = requestSignIn;
  document.getElementById("signin-gate-btn").onclick = requestSignIn;
  document.getElementById("signout-btn").onclick = signOut;
  document.getElementById("calendar-refresh-btn").onclick = refreshCalendar;
  document.getElementById("calendar-prev-day-btn").onclick = () => shiftCalendarByDays(1);
  document.getElementById("calendar-next-day-btn").onclick = () => shiftCalendarByDays(-1);
  document.getElementById("calendar-prev-week-btn").onclick = () => shiftCalendarByDays(7);
  document.getElementById("calendar-next-week-btn").onclick = () => shiftCalendarByDays(-7);
  document.getElementById("calendar-prev-month-btn").onclick = () => shiftCalendarByDays(30);
  document.getElementById("calendar-next-month-btn").onclick = () => shiftCalendarByDays(-30);
  document.getElementById("calendar-today-btn").onclick = jumpCalendarToThisWeek;
  document.getElementById("today-refresh-btn").onclick = refreshToday;

  document.getElementById("start-btn").onclick = startTimer;
  document.getElementById("pause-btn").onclick = pauseTimer;
  document.getElementById("resume-btn").onclick = resumeTimer;
  document.getElementById("stop-btn").onclick = stopTimer;

  document.querySelectorAll(".preset-buttons button").forEach((btn) => {
    btn.onclick = () => setDurationMinutes(parseInt(btn.dataset.min));
  });

  document.getElementById("manual-form").addEventListener("submit", handleManualSubmit);
  document.getElementById("refresh-log-btn").onclick = refreshLog;

  document.getElementById("manage-activities-btn").onclick = () => {
    renderManageModal();
    document.getElementById("manage-modal").classList.remove("hidden");
  };
  document.getElementById("close-modal-btn").onclick = () => {
    document.getElementById("manage-modal").classList.add("hidden");
  };
  document.getElementById("add-activity-btn").onclick = () => {
    const input = document.getElementById("new-activity-input");
    const name = input.value.trim();
    if (!name) return;
    const activities = loadActivities();
    if (!activities.some((a) => a.name === name)) {
      activities.push({
        name,
        color: ACTIVITY_COLOR_PALETTE[activities.length % ACTIVITY_COLOR_PALETTE.length],
        targetMinutes: null,
      });
    }
    saveActivities(activities);
    input.value = "";
    renderManageModal();
    renderActivityOptions();
  };

  document.getElementById("manage-presets-btn").onclick = () => {
    renderPresetsModal();
    document.getElementById("bell-presets-modal").classList.remove("hidden");
  };
  document.getElementById("close-presets-modal-btn").onclick = () => {
    document.getElementById("bell-presets-modal").classList.add("hidden");
    renderBellPresetOptions();
  };
  document.getElementById("add-preset-btn").onclick = () => {
    const presets = loadBellPresets();
    presets.push({ id: uid(), name: "New preset", rules: [newRule()] });
    saveBellPresets(presets);
    renderPresetsModal();
    renderBellPresetOptions();
  };

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
