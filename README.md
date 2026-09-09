# 5th Anniversary Quiz - Google Sheet Version

Questions are managed in Google Sheets.

## Google Sheet tabs

### Employees
Columns:
email | fullName | department

### Questions
Columns:
Question | Option A | Option B | Option C | Option D | Correct Answer | Round | Points | Active

Correct Answer: A/B/C/D (or 1/2/3/4)
Active: Yes/No
Points: normally 1

### QuizResults
Created automatically when the first participant submits.

## Deployment

1. Paste backend/Code.gs into Apps Script.
2. Deploy as Web App, Execute as Me, Who has access: Anyone.
3. js/config.js already contains the current Web App URL.
4. Upload the updated js files to GitHub Pages.

The participant page loads both employees and active questions from Apps Script.
