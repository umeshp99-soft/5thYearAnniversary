/*
  Google Apps Script backend for the 5th Anniversary Quiz.

  SETUP:
  1. Create a Google Sheet.
  2. Create a sheet named Employees with columns:
       email | fullName | department
  3. In Apps Script, paste this file.
  4. Replace SPREADSHEET_ID below.
  5. Deploy as Web App:
       Execute as: Me
       Who has access: Anyone
  6. Copy the /exec URL into js/config.js.
*/

const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const EMPLOYEE_SHEET = "Employees";
const RESULT_SHEET = "QuizResults";

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  try {
    if (action === "employees") return json({success:true, data:getEmployees()});
    if (action === "leaderboard") return json({success:true, data:getLeaderboard()});
    if (action === "quizSubmit") {
      const raw = e.parameter.data || "{}";
      const payload = JSON.parse(raw);
      return json(saveQuiz(payload));
    }
    return json({success:false, message:"Unknown action"});
  } catch (err) {
    return json({success:false, message:String(err)});
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getEmployees() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EMPLOYEE_SHEET);
  if (!sheet) throw new Error("Employees sheet not found.");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({email:String(r[0]), fullName:String(r[1]), department:String(r[2] || "")}));
}

function saveQuiz(p) {
  if (!p.participantName) return {success:false, message:"Participant name is required."};
  if (typeof p.score !== "number" || typeof p.total !== "number") {
    return {success:false, message:"Invalid score."};
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(RESULT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RESULT_SHEET);
    sheet.appendRow(["Timestamp","Email","Name","Office","Score","Total","DurationMs","AnswersJson"]);
  }

  const existing = sheet.getDataRange().getValues();
  const email = String(p.participantEmail || "").toLowerCase();
  if (email && existing.slice(1).some(r => String(r[1]).toLowerCase() === email)) {
    return {success:false, message:"This participant has already submitted the quiz."};
  }

  sheet.appendRow([
    new Date(),
    p.participantEmail || "",
    p.participantName,
    p.office || "",
    p.score,
    p.total,
    p.durationMs || 0,
    JSON.stringify(p.answers || [])
  ]);

  return {success:true, message:"Score recorded."};
}

function getLeaderboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESULT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[2])
    .map(r => ({
      name:String(r[2]),
      office:String(r[3] || ""),
      score:Number(r[4] || 0),
      total:Number(r[5] || 0),
      durationMs:Number(r[6] || 0),
      timeText:formatDuration(Number(r[6] || 0))
    }));

  rows.sort((a,b) => b.score - a.score || a.durationMs - b.durationMs);
  return rows.map((r, i) => ({rank:i+1, ...r}));
}

function formatDuration(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return min + ":" + String(rem).padStart(2, "0");
}
