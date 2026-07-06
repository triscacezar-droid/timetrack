const ACTIVITIES_KEY = "timetrack.activities";
const DEFAULT_ACTIVITIES = ["Work", "Read", "Exercise", "Break", "Meditate"];

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
};

// ---------- Activities (stored locally, purely for the dropdown UI) ----------

function loadActivities() {
  const raw = localStorage.getItem(ACTIVITIES_KEY);
  if (!raw) return [...DEFAULT_ACTIVITIES];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_ACTIVITIES];
  } catch {
    return [...DEFAULT_ACTIVITIES];
  }
}

function saveActivities(list) {
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list));
}

function renderActivityOptions() {
  const activities = loadActivities();
  for (const select of [document.getElementById("activity-select"), document.getElementById("manual-activity")]) {
    const prev = select.value;
    select.innerHTML = "";
    for (const act of activities) {
      const opt = document.createElement("option");
      opt.value = act;
      opt.textContent = act;
      select.appendChild(opt);
    }
    if (activities.includes(prev)) select.value = prev;
  }
}

function renderManageModal() {
  const list = document.getElementById("activities-list");
  const activities = loadActivities();
  list.innerHTML = "";
  activities.forEach((act, idx) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = act;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.onclick = () => {
      const updated = activities.filter((_, i) => i !== idx);
      saveActivities(updated);
      renderManageModal();
      renderActivityOptions();
    };
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ---------- Bell presets (stored locally) ----------

function loadBellPresets() {
  const raw = localStorage.getItem(BELL_PRESETS_KEY);
  if (!raw) return structuredClone(DEFAULT_BELL_PRESETS);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : structuredClone(DEFAULT_BELL_PRESETS);
  } catch {
    return structuredClone(DEFAULT_BELL_PRESETS);
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
  soundField.append(soundLabel, soundSelect);

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

function onSignedIn() {
  document.getElementById("signin-btn").classList.add("hidden");
  document.getElementById("signed-in").classList.remove("hidden");
  document.getElementById("user-email").textContent = "Connected";
  refreshLog();
}

function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  document.getElementById("signin-btn").classList.remove("hidden");
  document.getElementById("signed-in").classList.add("hidden");
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

async function ensureHeaderRow() {
  const range = `${CONFIG.SHEET_NAME}!A1:F1`;
  const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  if (!data.values || data.values.length === 0) {
    await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({
        range,
        values: [["Date", "Activity", "Start", "End", "Duration (min)", "Notes"]],
      }),
    });
  }
}

async function appendEntry({ date, activity, start, end, durationMin, notes }) {
  await ensureHeaderRow();
  const range = `${CONFIG.SHEET_NAME}!A:F`;
  await sheetsFetch(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({
      range,
      values: [[date, activity, start, end, durationMin, notes || ""]],
    }),
  });
  setStatus(`Logged "${activity}" — ${durationMin} min.`);
  refreshLog();
}

async function fetchRecentEntries(limit = 10) {
  const range = `${CONFIG.SHEET_NAME}!A2:F`;
  const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  const rows = data.values || [];
  return rows.slice(-limit).reverse();
}

async function refreshLog() {
  const listEl = document.getElementById("log-list");
  if (!accessToken) return;
  try {
    const rows = await fetchRecentEntries();
    listEl.innerHTML = "";
    if (rows.length === 0) {
      listEl.innerHTML = '<div class="status">No entries yet.</div>';
      return;
    }
    for (const [date, activity, start, end, duration, notes] of rows) {
      const div = document.createElement("div");
      div.className = "log-entry";
      div.innerHTML = `
        <div>
          <div class="activity">${escapeHtml(activity || "")}</div>
          <div class="meta">${escapeHtml(date || "")} · ${escapeHtml(start || "")}–${escapeHtml(end || "")}${notes ? " · " + escapeHtml(notes) : ""}</div>
        </div>
        <div class="meta">${escapeHtml(duration || "")} min</div>
      `;
      listEl.appendChild(div);
    }
  } catch (err) {
    setStatus("Could not load log: " + err.message);
  }
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

function startTimer() {
  const activity = document.getElementById("activity-select").value;
  const minutes = parseFloat(document.getElementById("duration-input").value);
  if (!activity) {
    setStatus("Pick an activity first.");
    return;
  }
  if (!minutes || minutes <= 0) {
    setStatus("Enter a valid number of minutes.");
    return;
  }
  timer.state = "running";
  timer.activity = activity;
  timer.totalSeconds = Math.round(minutes * 60);
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
}

function tick() {
  clearInterval(timer.intervalId);
  timer.intervalId = setInterval(() => {
    if (timer.state !== "running") return;
    timer.remainingSeconds -= 1;
    updateTimerDisplay();
    checkBellRules();
    if (timer.remainingSeconds <= 0) {
      clearInterval(timer.intervalId);
      completeTimer();
    }
  }, 1000);
}

function pauseTimer() {
  timer.state = "paused";
  setTimerButtons();
}

function resumeTimer() {
  timer.state = "running";
  setTimerButtons();
}

async function completeTimer() {
  const start = timer.startedAt;
  const end = new Date();
  const durationMin = Math.round(timer.totalSeconds / 60);
  timer.state = "idle";
  setTimerButtons();
  updateTimerDisplay();
  notifyDone();
  await logAndReset(start, end, durationMin);
}

async function stopTimer() {
  const start = timer.startedAt;
  const end = new Date();
  const elapsedSeconds = timer.totalSeconds - timer.remainingSeconds;
  const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
  clearInterval(timer.intervalId);
  timer.state = "idle";
  timer.remainingSeconds = 0;
  setTimerButtons();
  updateTimerDisplay();
  await logAndReset(start, end, durationMin);
}

async function logAndReset(start, end, durationMin) {
  const activity = timer.activity;
  timer.activity = null;
  timer.startedAt = null;
  if (!accessToken) {
    setStatus("Not signed in — entry not saved. Sign in with Google to log time.");
    return;
  }
  try {
    await appendEntry({
      date: formatDate(start),
      activity,
      start: formatTime(start),
      end: formatTime(end),
      durationMin,
      notes: "",
    });
  } catch (err) {
    setStatus("Failed to log entry: " + err.message);
  }
}

const SOUND_PROFILES = {
  bell: { freq: 528, decay: 1.0, gap: 1.2 },
  chime: { freq: 1046, decay: 0.6, gap: 0.8 },
  gong: { freq: 220, decay: 2.2, gap: 2.6 },
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

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function formatTime(d) {
  return d.toTimeString().slice(0, 5);
}

async function handleManualSubmit(e) {
  e.preventDefault();
  const activity = document.getElementById("manual-activity").value;
  const date = document.getElementById("manual-date").value;
  const startStr = document.getElementById("manual-start").value;
  const endStr = document.getElementById("manual-end").value;
  const notes = document.getElementById("manual-notes").value;

  const start = new Date(`${date}T${startStr}:00`);
  const end = new Date(`${date}T${endStr}:00`);
  let durationMin = Math.round((end - start) / 60000);
  if (durationMin < 0) durationMin += 24 * 60; // crossed midnight

  if (!accessToken) {
    setStatus("Sign in with Google first.");
    return;
  }
  try {
    await appendEntry({ date, activity, start: startStr, end: endStr, durationMin, notes });
    document.getElementById("manual-form").reset();
    document.getElementById("manual-date").value = date;
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
  return configured;
}

// ---------- Wire up ----------

document.addEventListener("DOMContentLoaded", () => {
  renderActivityOptions();
  renderBellPresetOptions();
  document.getElementById("manual-date").value = formatDate(new Date());
  updateTimerDisplay();
  setTimerButtons();

  const configured = checkConfig();
  if (configured) initGoogleAuth();

  document.getElementById("signin-btn").onclick = () => tokenClient && tokenClient.requestAccessToken();
  document.getElementById("signout-btn").onclick = signOut;

  document.getElementById("start-btn").onclick = startTimer;
  document.getElementById("pause-btn").onclick = pauseTimer;
  document.getElementById("resume-btn").onclick = resumeTimer;
  document.getElementById("stop-btn").onclick = stopTimer;

  document.querySelectorAll(".preset-buttons button").forEach((btn) => {
    btn.onclick = () => (document.getElementById("duration-input").value = btn.dataset.min);
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
    if (!activities.includes(name)) activities.push(name);
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
