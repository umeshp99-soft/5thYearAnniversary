# 5th Anniversary Knockout Quiz

## Format
- Round 1: 50 participants -> top 20
- Round 2: 20 -> top 9
- Round 3: 9 -> top 3
- Final: 3 -> 1 winner
- Timer: 20 seconds per question
- Timeout: 0 points and automatic move to next question
- Ranking: highest score, then fastest round completion time

## Google Sheet
Keep `Employees` as:
`email | fullName | department`

Create `Questions` with:
`Question | Option A | Option B | Option C | Option D | Correct Answer | Round | Points | Active`

Use Round values exactly: `Round 1`, `Round 2`, `Round 3`, `Final`.

Recommended question counts:
- Round 1: 10
- Round 2: 7
- Round 3: 5
- Final: 5

Create `RoundParticipants` with:
`Email | Name | Round | Eligible | Completed`

The backend can create this sheet automatically when the first participant is advanced.

## Apps Script
Replace Code.gs with `backend/Code.gs`.
Change:
`const ADMIN_PIN = "CHANGE_ME_1234";`
to your private organizer PIN.

Deploy as a Web App and use the resulting `/exec` URL in `js/config.js` if it changes.

## Event operation
1. Start Round 1. Everyone selects their name and plays.
2. Open `admin.html`, enter PIN, choose Round 1, review ranking.
3. Select exactly 20 and click Activate Selected for Next Round.
4. Announce that Round 2 is open. Selected people reopen the same quiz website and select their name.
5. Repeat: Round 2 -> top 9 -> Round 3 -> top 3 -> Final -> winner.

Participants only see their own score after submitting. Organizer can use `leaderboard.html` for display.

## Important
Before the event, test the complete flow with 2-3 dummy employees. For 20/9/3/1 selection, the organizer controls the qualification count through the Admin page.
