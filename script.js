const API_BASE = "https://typing-quest.onrender.com"; // Update if your backend URL differs

const ACHIEVEMENTS = [
  { name: "Beginner", minWPM: 0, maxWPM: 39, class: "beginner" },
  { name: "Pro", minWPM: 40, maxWPM: 69, class: "pro" },
  { name: "Advanced", minWPM: 70, maxWPM: Infinity, class: "advanced" }
];
const DEFAULT_TIME = 90;

// State variables
let duration = DEFAULT_TIME;
let timeLeft = duration;
let started = false;
let finished = false;
let timerId = null;

let chars = [];
let currentIndex = 0;
let correctCount = 0;
let keystrokes = 0;
let currentTextId = null;

// Elements
const promptEl = document.getElementById("prompt");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const accEl = document.getElementById("accuracy");
const achievementEl = document.getElementById("achievement");
const achievementBadgeEl = document.getElementById("achievementBadge");
const textAreaEl = document.getElementById("textArea");
const hiddenInput = document.getElementById("hiddenInput");
const timeChips = document.querySelectorAll(".time-chip");
const themeToggle = document.getElementById("themeToggle");
const restartBtn = document.getElementById("restartBtn");

// New: User name input element
const userNameInput = document.getElementById("userNameInput");

// Load/save user name from localStorage
function loadUserName() {
  if (userNameInput) {
    userNameInput.value = localStorage.getItem("typeflow-user-name") || "";
    userNameInput.addEventListener("input", () => {
      localStorage.setItem("typeflow-user-name", userNameInput.value.trim());
    });
  }
}
loadUserName();

// Leaderboard logic

const modalBg = document.getElementById("modalBg");
const showLeaderboard = document.getElementById("showLeaderboard");
const closeLeaderboard = document.getElementById("closeLeaderboard");
const leaderboardTable = document.getElementById("leaderboardTable");
const refreshLeaderboard = document.getElementById("refreshLeaderboard");
let leaderboardDuration = 60;

function fmtTime(iso){
  try{ return new Date(iso).toLocaleString(); }catch{ return iso; }
}

function renderLeaderboardRows(items){
  if(!items || items.length === 0)
    return `<div style="text-align:center; color:var(--muted);padding:21px;">No results yet. Complete a test to appear here.</div>`;
  return `<table style="width:100%;font-size:13.5px;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:4px 0;">#</th>
        <th>User</th>
        <th>WPM</th>
        <th>Acc</th>
        <th>Achiev.</th>
        <th style="font-weight:400;">Time</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((r, idx) => `
        <tr>
          <td style="text-align:center">${idx+1}</td>
          <td>${r.user_id || "unknown"}</td>
          <td style="font-weight:700">${r.wpm}</td>
          <td>${r.accuracy}%</td>
          <td><span class="ach ${r.achievement}" style="border-radius:13px;padding:2px 8px;border:1px solid var(--border);background:rgba(148,163,184,.10);">${r.achievement}</span></td>
          <td style="color:var(--muted);">${fmtTime(r.created_at)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

async function loadLeaderboardData(){
  leaderboardTable.innerHTML = "Loading…";
  try{
    const res = await fetch(`${API_BASE}/api/leaderboard?duration=${leaderboardDuration}&limit=15`, { cache:"no-store" });
    if(!res.ok) throw new Error(res.status);
    const data = await res.json();
    leaderboardTable.innerHTML = renderLeaderboardRows(data);
  }catch(e){
    leaderboardTable.innerHTML = `<div style="color:var(--error); text-align:center;">Failed to load leaderboard.</div>`;
  }
}

// Show/hide modal logic
showLeaderboard.onclick = () => {
  modalBg.style.display = "";
  loadLeaderboardData();
}
closeLeaderboard.onclick = () => { modalBg.style.display = "none"; }
refreshLeaderboard.onclick = loadLeaderboardData;

modalBg.addEventListener("click", e => {
  if(e.target === modalBg) modalBg.style.display = "none";
});

modalBg.querySelectorAll(".chip").forEach(btn => {
  btn.onclick = function(){
    modalBg.querySelectorAll(".chip").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    leaderboardDuration = parseInt(btn.dataset.d,10);
    loadLeaderboardData();
  };
});


// Theme
const loadTheme = () => {
  const saved = localStorage.getItem("typeflow-theme") || "dark";
  document.documentElement.classList.toggle("light", saved === "light");
  themeToggle.checked = saved !== "light";
};
const saveTheme = () => {
  const isDark = themeToggle.checked;
  localStorage.setItem("typeflow-theme", isDark ? "dark" : "light");
  document.documentElement.classList.toggle("light", !isDark);
};
themeToggle.addEventListener("change", saveTheme);
loadTheme();

async function fetchTextForDuration(d) {
  const res = await fetch(`${API_BASE}/api/texts?duration=${d}`, { cache: "no-store" });
  if (!res.ok) throw new Error("No text available for this duration");
  const data = await res.json();
  currentTextId = data.id;
  return data.content;
}

async function submitResult() {
  if (!currentTextId) return;
  const userName = userNameInput?.value?.trim() || null;
  const payload = {
    user_id: userName,
    duration,
    wpm: calcWPM(),
    accuracy: calcAccuracy(),
    correct_chars: correctCount,
    raw_keystrokes: keystrokes,
    text_id: currentTextId
  };
  try {
    await fetch(`${API_BASE}/api/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Result submit failed", e);
  }
}

function renderPrompt(text) {
  promptEl.innerHTML = "";
  chars = [];
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement("span");
    span.textContent = text[i];
    span.className = "char pending";
    chars.push(span);
    promptEl.appendChild(span);
  }
  if (chars.length) chars[0].classList.add("active");
}

function startTimer() {
  if (timerId) return;
  const endTime = performance.now() + duration * 1000;
  timerId = setInterval(() => {
    timeLeft = Math.max(0, Math.round((endTime - performance.now()) / 1000));
    timeEl.textContent = timeLeft;
    updateStats();
    if (timeLeft <= 0) finishTest();
  }, 200);
}
function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function calcWPM() {
  const elapsed = Math.max(1, duration - timeLeft);
  return Math.max(0, Math.round((correctCount / 5) / (elapsed / 60)));
}
function calcAccuracy() {
  return Math.round((correctCount / (keystrokes || 1)) * 100);
}
function updateAchievement(wpm) {
  const tier = ACHIEVEMENTS.find(a => wpm >= a.minWPM && wpm <= a.maxWPM);
  if (!tier) return;
  achievementEl.textContent = tier.name;
  achievementBadgeEl.textContent = tier.name;
  achievementBadgeEl.className = "badge " + tier.class;
  achievementBadgeEl.style.display = "inline-block";
}
function updateStats() {
  const wpm = calcWPM();
  const acc = calcAccuracy();
  wpmEl.textContent = wpm.toString();
  accEl.textContent = acc + "%";
  updateAchievement(wpm);
}

async function resetState() {
  stopTimer();
  started = false;
  finished = false;
  currentIndex = 0;
  correctCount = 0;
  keystrokes = 0;
  timeLeft = duration;
  timeEl.textContent = timeLeft.toString();
  wpmEl.textContent = "0";
  accEl.textContent = "100%";
  achievementEl.textContent = "-";
  achievementBadgeEl.style.display = "none";
  hiddenInput.value = "";

  try {
    const text = await fetchTextForDuration(duration);
    renderPrompt(text);
  } catch (err) {
    console.error(err);
    renderPrompt("No text available for this duration. Please add some texts in your backend.");
  }
}

async function finishTest() {
  finished = true;
  stopTimer();
  hiddenInput.blur();
  textAreaEl.blur();
  updateStats();
  await submitResult();
}

function handleInput(e) {
  if (finished) return;

  const val = e.data;
  const key = e.inputType;

  if (!started) {
    started = true;
    startTimer();
  }

  if (key === "insertText" && val?.length === 1) {
    const expected = chars[currentIndex]?.textContent;
    if (expected == null) return;

    keystrokes++;
    if (val === expected) {
      chars[currentIndex].className = "char correct";
      correctCount++;
    } else {
      chars[currentIndex].className = "char incorrect";
    }
    chars[currentIndex].classList.remove("active");
    currentIndex++;
    if (currentIndex < chars.length) {
      chars[currentIndex].classList.add("active");
    }
  } else if (key === "deleteContentBackward") {
    if (currentIndex > 0) {
      currentIndex--;
      chars[currentIndex].className = "char pending active";
      keystrokes++;
    }
  }

  hiddenInput.value = "";
  updateStats();

  if (currentIndex >= chars.length) {
    finishTest();
  }
}

function focusTyping() {
  hiddenInput.focus({ preventScroll: true });
}

textAreaEl.addEventListener("click", focusTyping);
textAreaEl.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    focusTyping();
  }
});
hiddenInput.addEventListener("beforeinput", handleInput);

timeChips.forEach((chip) => {
  chip.addEventListener("click", async () => {
    timeChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    duration = parseInt(chip.dataset.time, 10);
    await resetState();
  });
});

restartBtn.addEventListener("click", async () => {
  await resetState();
  focusTyping();
});

(async () => {
  await resetState();
  setTimeout(() => focusTyping(), 200);
})();

hiddenInput.addEventListener("paste", (e) => e.preventDefault());


