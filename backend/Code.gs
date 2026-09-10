// ============================================================
// 5TH ANNIVERSARY KNOCKOUT QUIZ - GOOGLE APPS SCRIPT BACKEND
// Round 1 -> Round 2 -> Round 3 -> Final
// ============================================================

const SPREADSHEET_ID = "1CIEoUrmyZfKVu-O5JwnohLyZBqti8_K5y2b9fefaRuQ";
const EMPLOYEE_SHEET = "Employees";
const QUESTION_SHEET = "Questions";
const RESULT_SHEET = "QuizResults";
const ROUND_PARTICIPANT_SHEET = "RoundParticipants";
const ADMIN_PIN = "CHANGE_ME_1234"; // CHANGE BEFORE EVENT

const ROUNDS = [
  { name: "Round 1", qualifiers: 20 },
  { name: "Round 2", qualifiers: 9 },
  { name: "Round 3", qualifiers: 3 },
  { name: "Final", qualifiers: 1 }
];

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : "";
    if (action === "employees") return createResponse({success:true,data:getEmployees()});
    if (action === "rounds") return createResponse({success:true,data:ROUNDS});
    if (action === "questions") return createResponse({success:true,data:getQuestions(String(e.parameter.round || "Round 1").trim())});
    if (action === "participantStatus") return createResponse(getParticipantStatus(String(e.parameter.email || "").trim().toLowerCase()));
    if (action === "adminResults") return createResponse(getAdminResults(String(e.parameter.pin || ""), String(e.parameter.round || "Round 1").trim()));
    if (action === "activateRound") {
      let p={}; try { p=JSON.parse(e.parameter.data || "{}"); } catch(err){ return createResponse({success:false,message:"Invalid activation data."}); }
      return createResponse(activateRound(p));
    }
    if (action === "quizSubmit") {
      let p={}; try { p=JSON.parse(e.parameter.data || "{}"); } catch(err){ return createResponse({success:false,message:"Invalid submission data."}); }
      return createResponse(saveQuiz(p));
    }
    if (action === "leaderboard") return createResponse({success:true,data:getLeaderboard(String(e.parameter.round || "").trim())});
    return createResponse({success:false,message:"Unknown action."});
  } catch(error) { return createResponse({success:false,message:error.toString()}); }
}

function createResponse(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}

function getEmployees(){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EMPLOYEE_SHEET);
  if(!sh) throw new Error("Employees sheet not found.");
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,3).getValues().map(r=>({email:String(r[0]||"").trim(),fullName:String(r[1]||"").trim(),department:String(r[2]||"").trim()})).filter(x=>x.email&&x.fullName);
}

function normalizeRound(r){
  const s=String(r||"").trim().toLowerCase();
  const found=ROUNDS.find(x=>x.name.toLowerCase()===s);
  return found ? found.name : "";
}

function getQuestions(round){
  round=normalizeRound(round)||"Round 1";
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(QUESTION_SHEET);
  if(!sh) throw new Error("Questions sheet not found. Create a sheet named 'Questions'.");
  if(sh.getLastRow()<2) return [];
  const vals=sh.getRange(2,1,sh.getLastRow()-1,9).getValues();
  const out=[];
  vals.forEach((r,i)=>{
    const q=String(r[0]||"").trim();
    const qRound=normalizeRound(r[6]);
    const active=String(r[8]||"").trim().toLowerCase();
    if(!q||qRound!==round||!["yes","y","true","1"].includes(active)) return;
    let correct=String(r[5]||"").trim().toUpperCase();
    if(["1","2","3","4"].includes(correct)) correct=String.fromCharCode(64+Number(correct));
    if(!["A","B","C","D"].includes(correct)) return;
    let points=Number(r[7]); if(!isFinite(points)||points<=0) points=1;
    out.push({id:i+1,round:qRound,q,options:[String(r[1]||""),String(r[2]||""),String(r[3]||""),String(r[4]||"")],correct:correct.charCodeAt(0)-65,points});
  });
  return out;
}

function ensureRoundParticipantSheet(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID); let sh=ss.getSheetByName(ROUND_PARTICIPANT_SHEET);
  if(!sh){sh=ss.insertSheet(ROUND_PARTICIPANT_SHEET);sh.appendRow(["Email","Name","Round","Eligible","Completed"]);}
  return sh;
}

function getRoundParticipants(){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ROUND_PARTICIPANT_SHEET);
  const map={}; if(!sh||sh.getLastRow()<2)return map;
  sh.getRange(2,1,sh.getLastRow()-1,5).getValues().forEach(r=>{
    const email=String(r[0]||"").trim().toLowerCase(); if(!email)return;
    map[email]={email,name:String(r[1]||""),round:normalizeRound(r[2]),eligible:truthy(r[3]),completed:truthy(r[4])};
  }); return map;
}
function truthy(v){return ["true","yes","y","1"].includes(String(v||"").trim().toLowerCase());}

function getParticipantStatus(email){
  if(!email)return {success:false,message:"Participant email is required."};
  const emp=getEmployees().find(e=>e.email.toLowerCase()===email); if(!emp)return {success:false,message:"Participant is not registered."};
  const results=getResultsForEmail(email);
  const rp=getRoundParticipants()[email];
  let currentRound="Round 1";
  if(rp&&rp.eligible&&!rp.completed) currentRound=rp.round;
  else if(rp&&rp.eligible&&rp.completed){
    const idx=ROUNDS.findIndex(x=>x.name===rp.round); if(idx>=0&&idx<ROUNDS.length-1) currentRound=ROUNDS[idx+1].name;
  }
  // Main rule: Round 1 is available only once. Later rounds require server-side qualification.
  if(!results["Round 1"] && !rp) currentRound="Round 1";
  const completedCurrent=!!results[currentRound];
  if(completedCurrent){
    const idx=ROUNDS.findIndex(x=>x.name===currentRound);
    if(idx<ROUNDS.length-1) currentRound=ROUNDS[idx+1].name;
  }
  const eligible=(currentRound==="Round 1" && !results["Round 1"] && !rp) || (rp&&rp.round===currentRound&&rp.eligible&&!results[currentRound]);
  return {success:true,data:{currentRound,eligible:!!eligible,completedRounds:Object.keys(results),isFinal:currentRound==="Final"}};
}

function getResultsForEmail(email){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET); const out={};
  if(!sh||sh.getLastRow()<2)return out;
  sh.getRange(2,1,sh.getLastRow()-1,9).getValues().forEach(r=>{if(String(r[1]||"").trim().toLowerCase()===email) out[normalizeRound(r[4])] = {score:Number(r[5]||0),total:Number(r[6]||0),durationMs:Number(r[7]||0)};});
  return out;
}

function saveQuiz(p){
  if(!p)return {success:false,message:"Invalid submission."};
  const email=String(p.participantEmail||"").trim().toLowerCase(), name=String(p.participantName||"").trim(), round=normalizeRound(p.round), score=Number(p.score), total=Number(p.total), durationMs=Number(p.durationMs||0);
  if(!email||!name||!round)return {success:false,message:"Participant, round and score are required."};
  if(!isFinite(score)||!isFinite(total)||total<=0||score<0||score>total)return {success:false,message:"Invalid score."};
  const emp=getEmployees().find(e=>e.email.toLowerCase()===email); if(!emp)return {success:false,message:"Participant is not registered."};
  const status=getParticipantStatus(email).data; if(status.currentRound!==round||!status.eligible)return {success:false,message:"You are not eligible for this round."};
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(30000); const ss=SpreadsheetApp.openById(SPREADSHEET_ID); let sh=ss.getSheetByName(RESULT_SHEET);
    if(!sh){sh=ss.insertSheet(RESULT_SHEET);sh.appendRow(["Timestamp","Email","Name","Office","Round","Score","Total","DurationMs","Time","AnswersJson"]);}
    const vals=sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,10).getValues();
    if(vals.some(r=>String(r[1]||"").trim().toLowerCase()===email&&normalizeRound(r[4])===round)) return {success:false,message:"This participant has already submitted this round."};
    sh.appendRow([new Date(),emp.email,emp.fullName,emp.department,round,score,total,durationMs,formatDuration(durationMs),JSON.stringify(p.answers||[])]);
    // Mark current round completed for any RoundParticipants row.
    const rpSh=ensureRoundParticipantSheet(); const rpVals=rpSh.getLastRow()<2?[]:rpSh.getRange(2,1,rpSh.getLastRow()-1,5).getValues();
    for(let i=0;i<rpVals.length;i++){if(String(rpVals[i][0]||"").trim().toLowerCase()===email&&normalizeRound(rpVals[i][2])===round){rpSh.getRange(i+2,5).setValue(true);}}
    return {success:true,message:"Score recorded successfully.",data:{name:emp.fullName,score,total,timeText:formatDuration(durationMs),round}};
  }catch(err){return {success:false,message:"Unable to save result: "+err.toString()};}finally{try{lock.releaseLock();}catch(e){}}
}

function getAdminResults(pin,round){
  if(pin!==ADMIN_PIN)return {success:false,message:"Invalid organizer PIN."};
  round=normalizeRound(round)||"Round 1"; const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET); if(!sh||sh.getLastRow()<2)return {success:true,data:[]};
  const vals=sh.getRange(2,1,sh.getLastRow()-1,10).getValues(); const rows=vals.filter(r=>normalizeRound(r[4])===round).map(r=>({email:String(r[1]||"").trim().toLowerCase(),name:String(r[2]||"").trim(),office:String(r[3]||"").trim(),round,score:Number(r[5]||0),total:Number(r[6]||0),durationMs:Number(r[7]||0),timeText:formatDuration(Number(r[7]||0))}));
  rows.sort((a,b)=>b.score-a.score||a.durationMs-b.durationMs); return {success:true,data:rows.map((r,i)=>({...r,rank:i+1}))};
}

function activateRound(p){
  if(!p||p.pin!==ADMIN_PIN)return {success:false,message:"Invalid organizer PIN."};
  const next=normalizeRound(p.nextRound); if(!next)return {success:false,message:"Invalid next round."};
  const emails=Array.isArray(p.emails)?p.emails.map(x=>String(x||"").trim().toLowerCase()).filter(Boolean):[];
  if(!emails.length)return {success:false,message:"Select at least one participant."};
  const idx=ROUNDS.findIndex(x=>x.name===next); if(idx<=0)return {success:false,message:"Round 1 does not need activation."};
  const prev=ROUNDS[idx-1].name; const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET); if(!sh||sh.getLastRow()<2)return {success:false,message:"No previous-round results found."};
  const vals=sh.getRange(2,1,sh.getLastRow()-1,10).getValues(); const eligibleResults=vals.filter(r=>normalizeRound(r[4])===prev&&emails.includes(String(r[1]||"").trim().toLowerCase()));
  if(eligibleResults.length!==emails.length)return {success:false,message:"One or more selected participants did not complete the previous round."};
  const rp=ensureRoundParticipantSheet(); const existing=rp.getLastRow()<2?[]:rp.getRange(2,1,rp.getLastRow()-1,5).getValues();
  const existingKeys=new Set(existing.map(r=>String(r[0]||"").trim().toLowerCase()+"|"+normalizeRound(r[2])));
  const empMap={}; getEmployees().forEach(e=>empMap[e.email.toLowerCase()]=e);
  emails.forEach(email=>{if(!existingKeys.has(email+"|"+next)){rp.appendRow([email,empMap[email]?empMap[email].fullName:"",next,true,false);}});
  return {success:true,message:emails.length+" participant(s) qualified for "+next+"."};
}

function getLeaderboard(round){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESULT_SHEET); if(!sh||sh.getLastRow()<2)return [];
  round=normalizeRound(round); const vals=sh.getRange(2,1,sh.getLastRow()-1,10).getValues(); const rows=vals.filter(r=>!round||normalizeRound(r[4])===round).map(r=>({name:String(r[2]||"").trim(),office:String(r[3]||"").trim(),round:normalizeRound(r[4]),score:Number(r[5]||0),total:Number(r[6]||0),durationMs:Number(r[7]||0),timeText:formatDuration(Number(r[7]||0))}));
  rows.sort((a,b)=>b.score-a.score||a.durationMs-b.durationMs); return rows.map((r,i)=>({...r,rank:i+1}));
}

function formatDuration(ms){ms=Math.max(0,Number(ms)||0);const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;return m+":"+String(s).padStart(2,"0");}

function resetQuiz(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID); [RESULT_SHEET,ROUND_PARTICIPANT_SHEET].forEach(n=>{const sh=ss.getSheetByName(n);if(sh)ss.deleteSheet(sh);});
}
