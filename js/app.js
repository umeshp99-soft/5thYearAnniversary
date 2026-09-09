let employees = [];
let QUESTIONS = [];
let currentPlayer = null;
let currentIndex = 0;
let score = 0;
let totalPoints = 0;
let answers = [];
let startedAt = null;
let questionStartedAt = null;
let timerHandle = null;
let secondsLeft = CONFIG.SECONDS_PER_QUESTION;

window.addEventListener("load", init);

async function init() {
  const select = document.getElementById("employeeSelect");
  select.disabled = true;
  document.getElementById("startBtn").disabled = true;

  try {
    const [employeeResponse, questionResponse] = await Promise.all([
      getEmployees(),
      getQuestions()
    ]);

    if (!employeeResponse.success) {
      throw new Error(employeeResponse.message || "Unable to load participants.");
    }

    if (!questionResponse.success) {
      throw new Error(questionResponse.message || "Unable to load questions.");
    }

    employees = employeeResponse.data || [];
    QUESTIONS = questionResponse.data || [];

    if (!QUESTIONS.length) {
      throw new Error("No active quiz questions were found in the Questions sheet.");
    }

    totalPoints = QUESTIONS.reduce((sum, q) => sum + Number(q.points || 1), 0);

    document.getElementById("totalQuestions").textContent = QUESTIONS.length;

    select.innerHTML = '<option value="">Select your name</option>';

    employees
      .slice()
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)))
      .forEach((emp, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = `${emp.fullName}${emp.department ? " (" + emp.department + ")" : ""}`;
        select.appendChild(option);
      });

    select.disabled = false;
    document.getElementById("startBtn").disabled = true;

  } catch (error) {
    select.innerHTML = '<option value="">Unable to load quiz</option>';
    showLoginError(error.message);
  }
}

document.getElementById("employeeSelect").addEventListener("change", () => {
  document.getElementById("startBtn").disabled =
    !document.getElementById("employeeSelect").value;
});

document.getElementById("startBtn").addEventListener("click", startQuiz);
document.getElementById("nextBtn").addEventListener("click", nextQuestion);

function showLoginError(message) {
  const el = document.getElementById("loginError");
  el.textContent = message;
  el.classList.remove("d-none");
}

function startQuiz() {
  const select = document.getElementById("employeeSelect");
  const emp = employees[Number(select.value)];
  if (!emp) return;

  currentPlayer = emp;
  currentIndex = 0;
  score = 0;
  answers = [];
  startedAt = Date.now();

  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("quizSection").classList.remove("d-none");
  document.getElementById("playerName").textContent = emp.fullName;

  renderQuestion();
}

function renderQuestion() {
  clearInterval(timerHandle);

  const question = QUESTIONS[currentIndex];
  questionStartedAt = Date.now();
  secondsLeft = CONFIG.SECONDS_PER_QUESTION;

  document.getElementById("questionNumber").textContent = currentIndex + 1;
  document.getElementById("roundLabel").textContent = question.round || "";
  document.getElementById("questionText").textContent = question.q;
  document.getElementById("timer").textContent = secondsLeft;

  document.getElementById("progressBar").style.width =
    `${((currentIndex + 1) / QUESTIONS.length) * 100}%`;

  const options = document.getElementById("options");
  options.innerHTML = "";

  question.options.forEach((text, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-dark btn-lg text-start option-btn";
    button.textContent = `${String.fromCharCode(65 + index)}. ${text}`;
    button.dataset.index = index;
    button.addEventListener("click", () => chooseAnswer(index));
    options.appendChild(button);
  });

  document.getElementById("nextBtn").disabled = true;

  timerHandle = setInterval(() => {
    secondsLeft -= 1;
    document.getElementById("timer").textContent = Math.max(0, secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(timerHandle);
      chooseAnswer(null);
    }
  }, 1000);
}

function chooseAnswer(selectedIndex) {
  clearInterval(timerHandle);

  const question = QUESTIONS[currentIndex];
  const elapsed = Date.now() - questionStartedAt;
  const correct = selectedIndex === question.correct;
  const points = Number(question.points || 1);

  if (correct) {
    score += points;
  }

  answers[currentIndex] = {
    questionIndex: currentIndex,
    selected: selectedIndex,
    correct,
    pointsAwarded: correct ? points : 0,
    responseMs: elapsed
  };

  document.querySelectorAll(".option-btn").forEach(btn => {
    btn.disabled = true;

    const idx = Number(btn.dataset.index);

    if (idx === question.correct) {
      btn.classList.add("correct-answer");
    }

    if (
      selectedIndex !== null &&
      idx === selectedIndex &&
      idx !== question.correct
    ) {
      btn.classList.add("wrong-answer");
    }
  });

  document.getElementById("nextBtn").disabled = false;

  document.getElementById("nextBtn").textContent =
    currentIndex === QUESTIONS.length - 1
      ? "Finish Quiz ✓"
      : "Next →";
}

function nextQuestion() {
  if (!answers[currentIndex]) return;

  if (currentIndex === QUESTIONS.length - 1) {
    finishQuiz();
    return;
  }

  currentIndex += 1;
  renderQuestion();
}

async function finishQuiz() {
  clearInterval(timerHandle);

  document.getElementById("quizSection").classList.add("d-none");
  document.getElementById("resultSection").classList.remove("d-none");

  document.getElementById("resultName").textContent =
    currentPlayer.fullName;

  document.getElementById("resultScore").textContent = score;
  document.getElementById("resultTotal").textContent = totalPoints;

  const status = document.getElementById("submissionStatus");
  status.innerHTML =
    '<span class="text-muted">Saving your score...</span>';

  const payload = {
    participantEmail: currentPlayer.email || "",
    participantName: currentPlayer.fullName || "",
    office: currentPlayer.department || "",
    score,
    total: totalPoints,
    durationMs: Date.now() - startedAt,
    answers
  };

  try {
    const response = await submitQuiz(payload);

    if (!response.success) {
      throw new Error(
        response.message || "Score submission failed."
      );
    }

    status.innerHTML =
      '<div class="alert alert-success">✅ Your score has been recorded!</div>';

  } catch (error) {

    status.innerHTML =
      '<div class="alert alert-warning">Your score is shown above, but the server could not save it. Please tell the host.</div>';
  }
}
