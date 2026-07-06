const ACTIVITIES_KEY = "timetrack.activities";
const DEFAULT_ACTIVITIES = ["Work", "Read", "Exercise", "Break"];

let accessToken = null;
let tokenClient = null;

let timer = {
  state: "idle", // idle | running | paused
  totalSeconds: 0,
  remainingSeconds: 0,
  activity: null,
  startedAt: null, // Date when the current run began (for logging real start time)
  intervalId: null,
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

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
