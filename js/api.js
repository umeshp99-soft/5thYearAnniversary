async function apiGet(action, params = {}) {
  const q = new URLSearchParams({ action, ...params });
  const r = await fetch(`${CONFIG.API_URL}?${q.toString()}`);
  return await r.json();
}

async function getEmployees() {
  return apiGet("employees");
}

async function getRounds() {
  return apiGet("rounds");
}

async function getQuestions(round) {
  return apiGet("questions", { round });
}

async function getParticipantStatus(email) {
  return apiGet("participantStatus", { email });
}

async function submitQuiz(data) {
  const u = `${CONFIG.API_URL}?action=quizSubmit&data=${encodeURIComponent(JSON.stringify(data))}`;
  const r = await fetch(u);
  return await r.json();
}

async function getAdminResults(pin, round) {
  return apiGet("adminResults", { pin, round });
}

async function activateRound(emails, pin, nextRound) {
  const data = { emails, pin, nextRound };
  const u = `${CONFIG.API_URL}?action=activateRound&data=${encodeURIComponent(JSON.stringify(data))}`;
  const r = await fetch(u);
  return await r.json();
}
