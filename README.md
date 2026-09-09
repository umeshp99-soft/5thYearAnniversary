# 5th Anniversary Quiz

This project converts the old OfficeFunAwards flow into a mobile-friendly quiz hosted on GitHub Pages.

## Flow

Participant selects their name → Start Quiz → 20 questions → score saved to Google Sheets → live leaderboard.

## Files

- `index.html` — participant quiz
- `leaderboard.html` — host screen; auto-refreshes every 5 seconds
- `js/questions.js` — editable question bank
- `js/app.js` — quiz/timer/scoring
- `js/api.js` — backend calls
- `js/config.js` — backend URL
- `backend/Code.gs` — Google Apps Script backend
- `css/style.css` — styling

## Backend setup

Create a Google Sheet with an `Employees` tab:

| email | fullName | department |
|---|---|---|
| person1@company.com | Person One | Pune |
| person2@company.com | Person Two | Mumbai |

Open Extensions → Apps Script, paste `backend/Code.gs`, set `SPREADSHEET_ID`, then Deploy → New deployment → Web app. Execute as you; access for anyone.

Copy the Web App `/exec` URL into `js/config.js`.

## GitHub Pages

Upload the project files to the repository. In GitHub:
Settings → Pages → Deploy from branch → main → root.

Participant URL:
`https://YOUR-USER.github.io/YOUR-REPO/`

Host leaderboard:
`https://YOUR-USER.github.io/YOUR-REPO/leaderboard.html`

## Event setup

1. Open `leaderboard.html` on the laptop connected to the projector/Zoom.
2. Share that browser window in Zoom.
3. Display the participant URL as a QR code.
4. Participants use their phones.
5. Leaderboard refreshes automatically.

## Important

The current question bank contains generic sample questions. Replace `js/questions.js` with your actual 5th-anniversary questions before the event.
