let employees = [];
let QUESTIONS = [];
let currentPlayer = null;
let currentIndex = 0;
let totalPoints = 0;
let answers = [];
let startedAt = null;
let questionStartedAt = null;
let timerHandle = null;
let secondsLeft = CONFIG.SECONDS_PER_QUESTION;
let currentRound = "Round 1";

window.addEventListener("load", init);

// Anti-copy deterrents. Screenshots/photos cannot be prevented.
document.addEventListener("contextmenu", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("selectstart", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("dragstart", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("copy", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("cut", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("paste", e => {
  if (document.body.classList.contains("quiz-page")) e.preventDefault();
});
document.addEventListener("keydown", e => {
  if (!document.body.classList.contains("quiz-page")) return;

  const k = String(e.key || "").toLowerCase();

  if ((e.ctrlKey || e.metaKey) && ["c","x","v","a","u","s","p"].includes(k)) {
    e.preventDefault();
  }

  if (e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(k))) {
    e.preventDefault();
  }
});

async function init() {
  const select = document.getElementById("employeeSelect");

  select.disabled = true;
  document.getElementById("startBtn").disabled = true;

  try {
    const [er, rr] = await Promise.all([getEmployees(), getRounds()]);

    if (!er.success) throw Error(er.message);

    employees = er.data || [];

    if (rr.success && Array.isArray(rr.data)) {
      CONFIG.ROUNDS = rr.data;
    }

    select.innerHTML = '<option value="">Select your name</option>';

    employees
      .slice()
      .sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)))
      .forEach(emp => {
        const o = document.createElement("option");
        o.value = emp.email;
        o.textContent = `${emp.fullName}${emp.department ? " (" + emp.department + ")" : ""}`;
        select.appendChild(o);
      });

    select.disabled = false;

  } catch (e) {
    select.innerHTML = '<option value="">Unable to load participants</option>';
    showLoginError(e.message || "Unable to load participants.");
  }
}

document.getElementById("employeeSelect").addEventListener("change", handleParticipantChange);
document.getElementById("startBtn").addEventListener("click", startRound);
document.getElementById("nextBtn").addEventListener("click", nextQuestion);

function showLoginError(message) {
  const el = document.getElementById("loginError");
  el.textContent = message;
  el.classList.remove("d-none");
}

async function handleParticipantChange() {
  const email = document.getElementById("employeeSelect").value;
  const emp = employees.find(
    x => String(x.email).toLowerCase() === String(email).toLowerCase()
  );

  const btn = document.getElementById("startBtn");
  const st = document.getElementById("participantStatus");

  btn.disabled = true;
  btn.textContent = "🚀 Start Round";
  st.innerHTML = "";
  currentPlayer = emp || null;

  if (!emp) return;

  try {
    const r = await getParticipantStatus(emp.email);

    if (!r.success) throw Error(r.message);

    const s = r.data;
    currentRound = s.currentRound;

    if (!s.eligible) {
      btn.disabled = true;
      btn.textContent = "Round Not Available";
      st.innerHTML =
        '<span class="text-muted">This round is not available yet. Please wait for the host.</span>';
      return;
    }

    const roundInfo =
      CONFIG.ROUNDS.find(x => x.name === currentRound) || {};

    btn.disabled = false;
    btn.textContent = `🚀 Start ${currentRound}`;

    st.innerHTML =
      `<span class="text-success fw-semibold">You are eligible for ${currentRound}!</span>` +
      (roundInfo.qualifiers
        ? `<div class="text-muted mt-1">This round selects the top ${roundInfo.qualifiers}.</div>`
        : "");

  } catch (e) {
    showLoginError(e.message || "Unable to check participant status.");
  }
}

async function startRound() {
  if (!currentPlayer) return;

  try {
    const r = await getQuestions(currentRound);

    if (!r.success) throw Error(r.message);

    QUESTIONS = (r.data || []).map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options.slice() : []
    }));

    if (!QUESTIONS.length) {
      throw Error(`No active questions found for ${currentRound}.`);
    }

    currentIndex = 0;
    answers = [];
    startedAt = Date.now();

    totalPoints = QUESTIONS.reduce(
      (sum, q) => sum + Number(q.points || 1),
      0
    );

    document.getElementById("loginSection").classList.add("d-none");
    document.getElementById("quizSection").classList.remove("d-none");

    document.getElementById("playerName").textContent =
      currentPlayer.fullName;

    document.getElementById("roundLabel").textContent =
      currentRound;

    document.getElementById("totalQuestions").textContent =
      QUESTIONS.length;

    renderQuestion();

  } catch (e) {
    showLoginError(e.message || "Unable to start round.");
  }
}

function renderQuestion() {
  clearInterval(timerHandle);

  const original = QUESTIONS[currentIndex];

  questionStartedAt = Date.now();
  secondsLeft = CONFIG.SECONDS_PER_QUESTION;

  document.getElementById("questionNumber").textContent =
    currentIndex + 1;

  document.getElementById("timer").textContent =
    secondsLeft;

  document.getElementById("progressBar").style.width =
    `${((currentIndex + 1) / QUESTIONS.length) * 100}%`;

  document.getElementById("questionText").textContent =
    original.q;

  // Randomize display order, but retain each option's ORIGINAL index.
  const shuffled = original.options.map((text, index) => ({
    text,
    originalIndex: index
  }));

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const opts = document.getElementById("options");
  opts.innerHTML = "";

  shuffled.forEach((item, displayIndex) => {
    const b = document.createElement("button");

    b.type = "button";
    b.className =
      "btn btn-outline-dark btn-lg text-start option-btn no-copy";

    b.textContent =
      `${String.fromCharCode(65 + displayIndex)}. ${item.text}`;

    b.dataset.originalIndex = item.originalIndex;

    b.onclick = () =>
      chooseAnswer(item.originalIndex, false);

    opts.appendChild(b);
  });

  const next = document.getElementById("nextBtn");

  next.disabled = true;
  next.textContent =
    currentIndex === QUESTIONS.length - 1
      ? "Finish ✓"
      : "Next →";

  timerHandle = setInterval(() => {
    secondsLeft--;

    document.getElementById("timer").textContent =
      Math.max(0, secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(timerHandle);
      chooseAnswer(null, true);
    }
  }, 1000);
}

function chooseAnswer(selectedOriginalIndex, timedOut) {
  if (answers[currentIndex]) return;

  clearInterval(timerHandle);

  const q = QUESTIONS[currentIndex];
  const elapsed = Date.now() - questionStartedAt;

  answers[currentIndex] = {
    id: q.id,
    questionIndex: currentIndex,
    selectedOriginalIndex:
      selectedOriginalIndex == null
        ? -1
        : Number(selectedOriginalIndex),
    responseMs: elapsed,
    timedOut: !!timedOut
  };

  document.querySelectorAll(".option-btn").forEach(b => {
    b.disabled = true;

    const originalIndex = Number(b.dataset.originalIndex);

    if (selectedOriginalIndex !== null &&
        originalIndex === Number(selectedOriginalIndex)) {
      b.classList.add("border-primary");
    }
  });

  document.getElementById("nextBtn").disabled = false;

  if (timedOut) {
    document.getElementById("timer").textContent = "0";
    setTimeout(nextQuestion, 350);
  }
}

function nextQuestion() {
  if (!answers[currentIndex]) return;

  if (currentIndex === QUESTIONS.length - 1) {
    finishRound();
    return;
  }

  currentIndex++;
  renderQuestion();
}

async function finishRound() {
  clearInterval(timerHandle);

  document.getElementById("quizSection").classList.add("d-none");
  document.getElementById("resultSection").classList.remove("d-none");

  document.getElementById("resultName").textContent =
    currentPlayer.fullName;

  document.getElementById("resultScore").textContent =
    "…";

  document.getElementById("resultTotal").textContent =
    totalPoints;

  document.getElementById("resultRound").textContent =
    currentRound;

  const status =
    document.getElementById("submissionStatus");

  status.innerHTML =
    '<span class="text-muted">Saving your score...</span>';

  try {
    const r = await submitQuiz({
      participantEmail: currentPlayer.email,
      participantName: currentPlayer.fullName,
      office: currentPlayer.department,
      round: currentRound,
      durationMs: Date.now() - startedAt,
      answers: answers
    });

    if (!r.success) throw Error(r.message);

    document.getElementById("resultScore").textContent =
      r.data.score;

    document.getElementById("resultTotal").textContent =
      r.data.total;

    status.innerHTML =
      '<div class="alert alert-success">' +
      '✅ Score recorded! Please wait for the host to announce the qualifiers.' +
      '</div>';

    document.getElementById("resultActions").innerHTML = "";

  } catch (e) {
    status.innerHTML =
      `<div class="alert alert-warning">${escapeHtml(
        e.message || "Unable to save score."
      )} Please tell the host.</div>`;
  }
}

function clearIntervalSafe() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function escapeHtml(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[c])
  );
}
