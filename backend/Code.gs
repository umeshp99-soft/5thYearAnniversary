/*
============================================================
5TH ANNIVERSARY QUIZ - GOOGLE APPS SCRIPT BACKEND
============================================================

GOOGLE SHEET TABS

1. Employees
   Row 1:
   email | fullName | department

2. Questions
   Row 1:
   Question | Option A | Option B | Option C | Option D |
   Correct Answer | Round | Points | Active

Example:
Which anniversary are we celebrating? | 3rd | 4th | 5th | 10th |
C | Round 1 - Our Journey | 1 | Yes

Correct Answer can be:
A / B / C / D
or
1 / 2 / 3 / 4

Active can be:
Yes / No

The QuizResults sheet is created automatically.

============================================================
*/


const SPREADSHEET_ID =
  "1CIEoUrmyZfKVu-O5JwnohLyZBqti8_K5y2b9fefaRuQ";

const EMPLOYEE_SHEET = "Employees";
const QUESTION_SHEET = "Questions";
const RESULT_SHEET = "QuizResults";


function doGet(e) {

  try {

    var action = "";

    if (e && e.parameter && e.parameter.action) {
      action = e.parameter.action;
    }


    if (action === "employees") {

      return createResponse({
        success: true,
        data: getEmployees()
      });

    }


    if (action === "questions") {

      return createResponse({
        success: true,
        data: getQuestions()
      });

    }


    if (action === "leaderboard") {

      return createResponse({
        success: true,
        data: getLeaderboard()
      });

    }


    if (action === "quizSubmit") {

      var rawData = "{}";

      if (e && e.parameter && e.parameter.data) {
        rawData = e.parameter.data;
      }

      var payload;

      try {
        payload = JSON.parse(rawData);
      } catch (error) {

        return createResponse({
          success: false,
          message: "Invalid submission data."
        });

      }

      return createResponse(
        saveQuiz(payload)
      );

    }


    return createResponse({
      success: false,
      message: "Unknown action."
    });


  } catch (error) {

    return createResponse({
      success: false,
      message: error.toString()
    });

  }

}


function createResponse(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


function getEmployees() {

  var spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  var sheet =
    spreadsheet.getSheetByName(
      EMPLOYEE_SHEET
    );

  if (!sheet) {
    throw new Error(
      "Employees sheet not found."
    );
  }

  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        3
      )
      .getValues();

  var employees = [];

  for (var i = 0; i < values.length; i++) {

    var email =
      String(values[i][0] || "").trim();

    var fullName =
      String(values[i][1] || "").trim();

    var department =
      String(values[i][2] || "").trim();

    if (email !== "" && fullName !== "") {

      employees.push({
        email: email,
        fullName: fullName,
        department: department
      });

    }

  }

  return employees;

}


function getQuestions() {

  var spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  var sheet =
    spreadsheet.getSheetByName(
      QUESTION_SHEET
    );

  if (!sheet) {
    throw new Error(
      "Questions sheet not found. Please create a sheet named 'Questions'."
    );
  }

  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        9
      )
      .getValues();

  var questions = [];

  for (var i = 0; i < values.length; i++) {

    var question =
      String(values[i][0] || "").trim();

    var optionA =
      String(values[i][1] || "").trim();

    var optionB =
      String(values[i][2] || "").trim();

    var optionC =
      String(values[i][3] || "").trim();

    var optionD =
      String(values[i][4] || "").trim();

    var correctAnswer =
      String(values[i][5] || "")
        .trim()
        .toUpperCase();

    var round =
      String(values[i][6] || "").trim();

    var points =
      Number(values[i][7] || 1);

    var active =
      String(values[i][8] || "Yes")
        .trim()
        .toLowerCase();


    if (
      question === "" ||
      optionA === "" ||
      optionB === "" ||
      optionC === "" ||
      optionD === ""
    ) {
      continue;
    }


    if (
      active !== "yes" &&
      active !== "y" &&
      active !== "true" &&
      active !== "1"
    ) {
      continue;
    }


    var correctIndex = -1;


    if (correctAnswer === "A" || correctAnswer === "1") {
      correctIndex = 0;
    }

    if (correctAnswer === "B" || correctAnswer === "2") {
      correctIndex = 1;
    }

    if (correctAnswer === "C" || correctAnswer === "3") {
      correctIndex = 2;
    }

    if (correctAnswer === "D" || correctAnswer === "4") {
      correctIndex = 3;
    }


    if (correctIndex === -1) {
      continue;
    }


    if (!isFinite(points) || points <= 0) {
      points = 1;
    }


    questions.push({

      id: "q" + (i + 1),

      round: round || "Quiz",

      q: question,

      options: [
        optionA,
        optionB,
        optionC,
        optionD
      ],

      correct: correctIndex,

      points: points

    });

  }


  return questions;

}


function saveQuiz(payload) {

  if (!payload) {

    return {
      success: false,
      message: "Invalid quiz submission."
    };

  }


  var participantName =
    String(
      payload.participantName || ""
    ).trim();


  var participantEmail =
    String(
      payload.participantEmail || ""
    )
      .trim()
      .toLowerCase();


  var score =
    Number(payload.score);


  var total =
    Number(payload.total);


  var durationMs =
    Number(payload.durationMs || 0);


  if (participantName === "") {

    return {
      success: false,
      message: "Participant name is required."
    };

  }


  if (participantEmail === "") {

    return {
      success: false,
      message: "Participant email is required."
    };

  }


  if (
    isNaN(score) ||
    isNaN(total)
  ) {

    return {
      success: false,
      message: "Invalid score."
    };

  }


  if (
    total <= 0 ||
    score < 0 ||
    score > total
  ) {

    return {
      success: false,
      message: "Invalid score range."
    };

  }


  var spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  var employeeSheet =
    spreadsheet.getSheetByName(
      EMPLOYEE_SHEET
    );


  if (!employeeSheet) {

    return {
      success: false,
      message: "Employees sheet not found."
    };

  }


  var employeeLastRow =
    employeeSheet.getLastRow();


  if (employeeLastRow < 2) {

    return {
      success: false,
      message: "No employees found."
    };

  }


  var employeeData =
    employeeSheet
      .getRange(
        2,
        1,
        employeeLastRow - 1,
        3
      )
      .getValues();


  var employee = null;


  for (
    var i = 0;
    i < employeeData.length;
    i++
  ) {

    var email =
      String(
        employeeData[i][0] || ""
      )
        .trim()
        .toLowerCase();


    if (email === participantEmail) {

      employee = {

        email: email,

        fullName:
          String(
            employeeData[i][1] || ""
          ).trim(),

        department:
          String(
            employeeData[i][2] || ""
          ).trim()

      };

      break;

    }

  }


  if (!employee) {

    return {
      success: false,
      message:
        "Participant is not registered in the Employees sheet."
    };

  }


  var resultSheet =
    spreadsheet.getSheetByName(
      RESULT_SHEET
    );


  if (!resultSheet) {

    resultSheet =
      spreadsheet.insertSheet(
        RESULT_SHEET
      );


    resultSheet.appendRow([

      "Timestamp",
      "Email",
      "Name",
      "Office",
      "Score",
      "Total",
      "DurationMs",
      "Time",
      "AnswersJson"

    ]);

  }


  var lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(30000);


    var lastRow =
      resultSheet.getLastRow();


    if (lastRow >= 2) {

      var existingEmails =
        resultSheet
          .getRange(
            2,
            2,
            lastRow - 1,
            1
          )
          .getValues();


      for (
        var j = 0;
        j < existingEmails.length;
        j++
      ) {

        var existingEmail =
          String(
            existingEmails[j][0] || ""
          )
            .trim()
            .toLowerCase();


        if (
          existingEmail === participantEmail
        ) {

          return {

            success: false,

            message:
              "This participant has already submitted the quiz."

          };

        }

      }

    }


    var timeText =
      formatDuration(
        durationMs
      );


    resultSheet.appendRow([

      new Date(),

      employee.email,

      employee.fullName,

      employee.department,

      score,

      total,

      durationMs,

      timeText,

      JSON.stringify(
        payload.answers || []
      )

    ]);


    return {

      success: true,

      message:
        "Score recorded successfully.",

      data: {

        name:
          employee.fullName,

        score:
          score,

        total:
          total,

        timeText:
          timeText

      }

    };


  } catch (error) {

    return {

      success: false,

      message:
        "Unable to save result: " +
        error.toString()

    };


  } finally {

    try {
      lock.releaseLock();
    } catch (error) {
      // Ignore
    }

  }

}


function getLeaderboard() {

  var spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  var sheet =
    spreadsheet.getSheetByName(
      RESULT_SHEET
    );


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return [];

  }


  var lastRow =
    sheet.getLastRow();


  var values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        8
      )
      .getValues();


  var results = [];


  for (
    var i = 0;
    i < values.length;
    i++
  ) {

    var name =
      String(
        values[i][2] || ""
      ).trim();


    if (name === "") {
      continue;
    }


    var office =
      String(
        values[i][3] || ""
      ).trim();


    var score =
      Number(
        values[i][4] || 0
      );


    var total =
      Number(
        values[i][5] || 0
      );


    var durationMs =
      Number(
        values[i][6] || 0
      );


    results.push({

      name: name,

      office: office,

      score: score,

      total: total,

      durationMs: durationMs,

      timeText:
        formatDuration(
          durationMs
        )

    });

  }


  results.sort(
    function(a, b) {

      if (
        b.score !== a.score
      ) {

        return b.score - a.score;

      }

      return (
        a.durationMs -
        b.durationMs
      );

    }
  );


  var leaderboard = [];


  for (
    var i = 0;
    i < results.length;
    i++
  ) {

    leaderboard.push({

      rank: i + 1,

      name: results[i].name,

      office: results[i].office,

      score: results[i].score,

      total: results[i].total,

      durationMs: results[i].durationMs,

      timeText: results[i].timeText

    });

  }


  return leaderboard;

}


function formatDuration(ms) {

  var milliseconds =
    Math.max(
      0,
      Number(ms || 0)
    );


  var seconds =
    Math.round(
      milliseconds / 1000
    );


  var minutes =
    Math.floor(
      seconds / 60
    );


  var remainingSeconds =
    seconds % 60;


  return (
    minutes +
    ":" +
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )
  );

}


function resetQuizResults() {

  var spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  var sheet =
    spreadsheet.getSheetByName(
      RESULT_SHEET
    );


  if (sheet) {

    spreadsheet.deleteSheet(
      sheet
    );

  }


  sheet =
    spreadsheet.insertSheet(
      RESULT_SHEET
    );


  sheet.appendRow([

    "Timestamp",
    "Email",
    "Name",
    "Office",
    "Score",
    "Total",
    "DurationMs",
    "Time",
    "AnswersJson"

  ]);

}
