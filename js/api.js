async function apiGet(action) {
  const response = await fetch(`${CONFIG.API_URL}?action=${encodeURIComponent(action)}`);
  return await response.json();
}

async function getEmployees() {
  return await apiGet("employees");
}

async function getQuestions() {
  return await apiGet("questions");
}

async function submitQuiz(request) {
  const url = `${CONFIG.API_URL}?action=quizSubmit&data=${encodeURIComponent(JSON.stringify(request))}`;
  const response = await fetch(url);
  return await response.json();
}

async function getLeaderboard() {
  return await apiGet("leaderboard");
}
