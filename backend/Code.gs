// ============================================================
// 5TH ANNIVERSARY KNOCKOUT QUIZ - GOOGLE APPS SCRIPT BACKEND
// ============================================================

const SPREADSHEET_ID = "1CIEoUrmyZfKVu-O5JwnohLyZBqti8_K5y2b9fefaRuQ";

const EMPLOYEE_SHEET = "Employees";
const QUESTION_SHEET = "Questions";
const RESULT_SHEET = "QuizResults";
const ROUND_PARTICIPANT_SHEET = "RoundParticipants";

// IMPORTANT: This must match the PIN used on admin.html.
const ADMIN_PIN = "Test@1234";

const ROUNDS = [
  { name: "Round 1", qualifiers: 20 },
  { name: "Round 2", qualifiers: 9 },
  { name: "Round 3", qualifiers: 3 },
  { name: "Final", qualifiers: 1 }
];

// ============================================================
// WEB APP
// ============================================================

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const action = String(p.action || "").trim();

    if (action === "employees") {
      return response({ success: true, data: getEmployees() });
    }

    if (action === "rounds") {
      return response({ success: true, data: ROUNDS });
    }

    if (action === "questions") {
      return response({
        success: true,
        data: getQuestions(String(p.round || "Round 1"))
      });
    }

    if (action === "participantStatus") {
      return response(getParticipantStatus(String(p.email || "")));
    }

    if (action === "adminResults") {
      return response(getAdminResults(String(p.pin || ""), String(p.round || "Round 1")));
    }

    if (action === "activateRound") {
      const data = parseJson(p.data || "{}");
      return response(activateRound(data));
    }

    // Backward-compatible alias.
    if (action === "activateBonus") {
      const data = parseJson(p.data || "{}");
      if (!data.emails && p.participants) {
        data.emails = parseJson(p.participants);
      }
      return response(activateRound(data));
    }

    if (action === "quizSubmit") {
      return response(saveQuiz(parseJson(p.data || "{}")));
    }

    // Keep leaderboard private. It requires the same Admin PIN.
    if (action === "leaderboard") {
      return response(getAdminResults(String(p.pin || ""), String(p.round || "")));
    }

    return response({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    return response({
      success: false,
      message: String(err && err.message ? err.message : err)
    });
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error("Invalid JSON data.");
  }
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// EMPLOYEES
// ============================================================

function getEmployees() {
  const sh = getSheet(EMPLOYEE_SHEET);
  const values = getData(sh, 3);

  return values.map(function (r) {
    return {
      email: String(r[0] || "").trim().toLowerCase(),
      fullName: String(r[1] || "").trim(),
      department: String(r[2] || "").trim()
    };
  }).filter(function (x) {
    return x.email && x.fullName;
  });
}

// ============================================================
// QUESTIONS
// IMPORTANT: Correct answers are NEVER sent to the browser.
// ============================================================

function getQuestions(round) {
  round = normalizeRound(round) || "Round 1";

  const sh = getSheet(QUESTION_SHEET);
  const values = getData(sh, 9);
  const out = [];

  values.forEach(function (r, i) {
    const question = String(r[0] || "").trim();
    const qRound = normalizeRound(r[6]);
    if (!question || qRound !== round || !isActive(r[8])) return;

    const correct = normalizeAnswer(r[5]);
    if (correct < 0) return;

    out.push({
      id: i + 1,
      round: qRound,
      q: question,
      options: [
        String(r[1] || "").trim(),
        String(r[2] || "").trim(),
        String(r[3] || "").trim(),
        String(r[4] || "").trim()
      ],
      points: Number(r[7]) > 0 ? Number(r[7]) : 1
    });
  });

  return out;
}

// ============================================================
// PARTICIPANT STATUS
// ============================================================

function getParticipantStatus(email) {
  email = String(email || "").trim().toLowerCase();

  if (!email) return fail("Participant email is required.");

  const employee = findEmployee(email);
  if (!employee) return fail("Participant is not registered.");

  const completed = {};
  getResultRows(email).forEach(function (r) {
    const round = normalizeRound(r.round);
    if (round) completed[round] = true;
  });

  const eligibleRounds = getEligibleRounds(email);

  let currentRound = "Round 1";
  let eligible = false;

  if (!completed["Round 1"]) {
    currentRound = "Round 1";
    eligible = true;
  } else if (!completed["Round 2"]) {
    currentRound = "Round 2";
    eligible = eligibleRounds["Round 2"] === true;
  } else if (!completed["Round 3"]) {
    currentRound = "Round 3";
    eligible = eligibleRounds["Round 3"] === true;
  } else if (!completed["Final"]) {
    currentRound = "Final";
    eligible = eligibleRounds["Final"] === true;
  } else {
    currentRound = "Completed";
    eligible = false;
  }

  return {
    success: true,
    data: {
      registered: true,
      fullName: employee.fullName,
      currentRound: currentRound,
      eligible: eligible,
      completedRounds: completed
    }
  };
}

function getEligibleRounds(email) {
  const out = {};
  const sh = getSheetIfExists(ROUND_PARTICIPANT_SHEET);
  if (!sh || sh.getLastRow() < 2) return out;

  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    const rowEmail = String(r[0] || "").trim().toLowerCase();
    const round = normalizeRound(r[2]);
    if (rowEmail === email && round && isTruthy(r[3])) {
      out[round] = true;
    }
  });

  return out;
}

// ============================================================
// SAVE QUIZ
// Browser score is NOT trusted.
// The browser sends selectedOriginalIndex so shuffled choices
// can still be securely scored on the server.
// ============================================================

function saveQuiz(payload) {
  if (!payload) return fail("Invalid quiz submission.");

  const email = String(payload.participantEmail || "").trim().toLowerCase();
  const name = String(payload.participantName || "").trim();
  const round = normalizeRound(payload.round);
  const durationMs = Math.max(0, Number(payload.durationMs || 0));

  if (!email || !name || !round) {
    return fail("Participant, name and round are required.");
  }

  const employee = findEmployee(email);
  if (!employee) return fail("Participant is not registered.");

  const status = getParticipantStatus(email);
  if (!status.success) return status;

  if (status.data.currentRound !== round || !status.data.eligible) {
    return fail("You are not eligible for this round.");
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (hasResult(email, round)) {
      return fail("This participant has already submitted this round.");
    }

    const calculated = calculateScore(
      Array.isArray(payload.answers) ? payload.answers : [],
      round
    );

    const sh = getOrCreateResultSheet();

    sh.appendRow([
      new Date(),
      employee.email,
      employee.fullName,
      employee.department,
      round,
      calculated.score,
      calculated.total,
      durationMs,
      formatDuration(durationMs),
      JSON.stringify(payload.answers || [])
    ]);

    markRoundCompleted(email, round);

    return {
      success: true,
      message: "Score recorded successfully.",
      data: {
        name: employee.fullName,
        round: round,
        score: calculated.score,
        total: calculated.total,
        timeText: formatDuration(durationMs)
      }
    };

  } catch (err) {
    return fail("Unable to save result: " + err);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function calculateScore(answers, round) {
  const questions = getQuestionKeysFromSheet(round);
  const answerMap = {};

  (answers || []).forEach(function (a) {
    if (!a) return;
    const id = String(a.id != null ? a.id : "");
    if (id) answerMap[id] = a;
  });

  let score = 0;
  let total = 0;

  questions.forEach(function (q) {
    total += q.points;

    const submitted = answerMap[String(q.id)];
    if (!submitted) return;

    const selectedOriginalIndex = Number(submitted.selectedOriginalIndex);
    if (selectedOriginalIndex === q.correct) {
      score += q.points;
    }
  });

  return { score: score, total: total };
}

// Reads question answers only on the server.
function getQuestionKeysFromSheet(round) {
  const sh = getSheet(QUESTION_SHEET);
  const values = getData(sh, 9);
  const out = [];

  values.forEach(function (r, i) {
    const question = String(r[0] || "").trim();
    const qRound = normalizeRound(r[6]);

    if (!question || qRound !== round || !isActive(r[8])) return;

    const correct = normalizeAnswer(r[5]);
    if (correct < 0) return;

    let points = Number(r[7]);
    if (!isFinite(points) || points <= 0) points = 1;

    out.push({
      id: i + 1,
      correct: correct,
      points: points
    });
  });

  return out;
}

function markRoundCompleted(email, round) {
  const sh = getSheetIfExists(ROUND_PARTICIPANT_SHEET);
  if (!sh || sh.getLastRow() < 2) return;

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowEmail = String(values[i][0] || "").trim().toLowerCase();
    const rowRound = normalizeRound(values[i][2]);

    if (rowEmail === email && rowRound === round) {
      sh.getRange(i + 2, 5).setValue(true);
    }
  }
}

// ============================================================
// ADMIN RESULTS
// ============================================================

function getAdminResults(pin, round) {
  if (!isAdmin(pin)) return fail("Invalid organizer PIN.");

  const sh = getSheetIfExists(RESULT_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    return { success: true, data: [] };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();

  let rows = values.filter(function (r) {
    if (!r[1]) return false;
    if (!round) return true;
    return normalizeRound(r[4]) === normalizeRound(round);
  }).map(function (r) {
    return {
      email: String(r[1] || "").trim().toLowerCase(),
      name: String(r[2] || "").trim(),
      office: String(r[3] || "").trim(),
      round: normalizeRound(r[4]),
      score: Number(r[5] || 0),
      total: Number(r[6] || 0),
      durationMs: Number(r[7] || 0),
      timeText: String(r[8] || formatDuration(r[7]))
    };
  });

  rows.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.durationMs - b.durationMs;
  });

  rows = rows.map(function (r, i) {
    r.rank = i + 1;
    return r;
  });

  return { success: true, data: rows };
}

// ============================================================
// ACTIVATE QUALIFIERS
// ============================================================

function activateRound(payload) {
  if (!payload || !isAdmin(payload.pin)) {
    return fail("Invalid organizer PIN.");
  }

  const nextRound = normalizeRound(payload.nextRound);
  if (!nextRound) return fail("Invalid next round.");

  const nextIndex = ROUNDS.findIndex(function (r) {
    return r.name === nextRound;
  });

  if (nextIndex <= 0) {
    return fail("Round 1 does not need activation.");
  }

  const previousRound = ROUNDS[nextIndex - 1].name;
  const emails = Array.isArray(payload.emails)
    ? payload.emails.map(function (x) {
        return String(x || "").trim().toLowerCase();
      }).filter(Boolean)
    : [];

  if (!emails.length) return fail("Select at least one participant.");

  const resultRows = getAllResults();

  const completedEmails = {};
  resultRows.forEach(function (r) {
    if (r.round === previousRound) {
      completedEmails[r.email] = true;
    }
  });

  for (let i = 0; i < emails.length; i++) {
    if (!completedEmails[emails[i]]) {
      return fail("Participant " + emails[i] + " did not complete " + previousRound + ".");
    }
  }

  const sh = getOrCreateRoundParticipantSheet();
  const existing = {};

  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
      const key = String(r[0] || "").trim().toLowerCase() + "|" + normalizeRound(r[2]);
      existing[key] = true;
    });
  }

  const employeeMap = {};
  getEmployees().forEach(function (e) {
    employeeMap[e.email] = e;
  });

  emails.forEach(function (email) {
    const key = email + "|" + nextRound;

    if (!existing[key]) {
      sh.appendRow([
        email,
        employeeMap[email] ? employeeMap[email].fullName : "",
        nextRound,
        true,
        false
      ]);
    }
  });

  return {
    success: true,
    message: emails.length + " participant(s) qualified for " + nextRound + ".",
    round: nextRound,
    participants: emails
  };
}

// ============================================================
// SHEET HELPERS
// ============================================================

function getSheet(name) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sh) throw new Error("Sheet not found: " + name);
  return sh;
}

function getSheetIfExists(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function getData(sh, columns) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, columns).getValues();
}

function getOrCreateResultSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(RESULT_SHEET);

  if (!sh) {
    sh = ss.insertSheet(RESULT_SHEET);
    sh.appendRow([
      "Timestamp", "Email", "Name", "Office", "Round",
      "Score", "Total", "DurationMs", "Time", "AnswersJson"
    ]);
  }

  return sh;
}

function getOrCreateRoundParticipantSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(ROUND_PARTICIPANT_SHEET);

  if (!sh) {
    sh = ss.insertSheet(ROUND_PARTICIPANT_SHEET);
    sh.appendRow(["Email", "Name", "Round", "Eligible", "Completed"]);
  }

  return sh;
}

function getAllResults() {
  const sh = getSheetIfExists(RESULT_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];

  return sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues()
    .filter(function (r) { return r[1]; })
    .map(function (r) {
      return {
        email: String(r[1] || "").trim().toLowerCase(),
        name: String(r[2] || "").trim(),
        office: String(r[3] || "").trim(),
        round: normalizeRound(r[4]),
        score: Number(r[5] || 0),
        total: Number(r[6] || 0),
        durationMs: Number(r[7] || 0),
        timeText: String(r[8] || "")
      };
    });
}

function getResultRows(email) {
  return getAllResults().filter(function (r) {
    return r.email === email;
  });
}

function hasResult(email, round) {
  return getResultRows(email).some(function (r) {
    return r.round === round;
  });
}

function findEmployee(email) {
  email = String(email || "").trim().toLowerCase();
  return getEmployees().find(function (e) {
    return e.email === email;
  }) || null;
}

// ============================================================
// UTILITIES
// ============================================================

function normalizeRound(value) {
  const s = String(value || "").trim().toLowerCase();

  const found = ROUNDS.find(function (r) {
    return r.name.toLowerCase() === s;
  });

  return found ? found.name : "";
}

function normalizeAnswer(value) {
  const s = String(value || "").trim().toUpperCase();

  if (s === "A" || s === "1") return 0;
  if (s === "B" || s === "2") return 1;
  if (s === "C" || s === "3") return 2;
  if (s === "D" || s === "4") return 3;

  return -1;
}

function isActive(value) {
  const s = String(value || "").trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(s);
}

function isTruthy(value) {
  const s = String(value || "").trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(s);
}

function isAdmin(pin) {
  return String(pin || "") === ADMIN_PIN;
}

function fail(message) {
  return { success: false, message: String(message || "Unknown error.") };
}

function formatDuration(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return min + ":" + String(rem).padStart(2, "0");
}

// OPTIONAL: run manually in Apps Script if you want to clear old test data.
// Do NOT run during the actual event.
function resetQuiz() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  [RESULT_SHEET, ROUND_PARTICIPANT_SHEET].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
  });
}
