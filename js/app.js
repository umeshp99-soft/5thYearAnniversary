let employees=[], QUESTIONS=[], currentPlayer=null, currentIndex=0, score=0, totalPoints=0, answers=[], startedAt=null, questionStartedAt=null, timerHandle=null, secondsLeft=CONFIG.SECONDS_PER_QUESTION, currentRound="Round 1";
window.addEventListener("load",init);

// Anti-copy protections apply to every quiz round. These deter normal copy/paste
// and context-menu based searching; they cannot prevent screenshots/photos.
document.addEventListener("contextmenu", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("selectstart", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("dragstart", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("copy", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("cut", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("paste", e => { if (document.body.classList.contains("quiz-page")) e.preventDefault(); });
document.addEventListener("keydown", e => {
  if (!document.body.classList.contains("quiz-page")) return;
  const k=String(e.key||"").toLowerCase();
  if ((e.ctrlKey||e.metaKey) && ["c","x","v","a","u","s","p"].includes(k)) e.preventDefault();
  if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(k))) e.preventDefault();
});

async function init(){
  const select=document.getElementById("employeeSelect"); select.disabled=true; document.getElementById("startBtn").disabled=true;
  try{
    const [er,rr]=await Promise.all([getEmployees(),getRounds()]);
    if(!er.success)throw Error(er.message); employees=er.data||[];
    if(rr.success) CONFIG.ROUNDS=rr.data;
    select.innerHTML='<option value="">Select your name</option>';
    employees.slice().sort((a,b)=>String(a.fullName).localeCompare(String(b.fullName))).forEach(emp=>{const o=document.createElement("option");o.value=emp.email;o.textContent=`${emp.fullName}${emp.department?" ("+emp.department+")":""}`;select.appendChild(o);});
    select.disabled=false;
  }catch(e){select.innerHTML='<option value="">Unable to load participants</option>';showLoginError(e.message||"Unable to load participants.");}
}
document.getElementById("employeeSelect").addEventListener("change",handleParticipantChange);
document.getElementById("startBtn").addEventListener("click",startRound);
document.getElementById("nextBtn").addEventListener("click",nextQuestion);
function showLoginError(m){const e=document.getElementById("loginError");e.textContent=m;e.classList.remove("d-none");}

async function handleParticipantChange(){
  const email=document.getElementById("employeeSelect").value, emp=employees.find(x=>String(x.email).toLowerCase()===String(email).toLowerCase());
  const btn=document.getElementById("startBtn"), st=document.getElementById("participantStatus"); btn.disabled=true;btn.textContent="🚀 Start Round";st.innerHTML="";currentPlayer=emp||null;if(!emp)return;
  try{
    const r=await getParticipantStatus(emp.email);if(!r.success)throw Error(r.message);const s=r.data;currentRound=s.currentRound;
    if(!s.eligible){btn.disabled=true;btn.textContent="Round Not Available";st.innerHTML=`<span class="text-muted">You have completed the available round(s). Please wait for the host.</span>`;return;}
    const roundInfo=CONFIG.ROUNDS.find(x=>x.name===currentRound)||{};btn.disabled=false;btn.textContent=`🚀 Start ${currentRound}`;
    st.innerHTML=`<span class="text-success fw-semibold">You are eligible for ${currentRound}!</span>${roundInfo.qualifiers?`<div class="text-muted mt-1">This round selects the top ${roundInfo.qualifiers}.</div>`:""}`;
  }catch(e){showLoginError(e.message||"Unable to check status.");}
}

async function startRound(){
  if(!currentPlayer)return;
  try{
    const r=await getQuestions(currentRound);if(!r.success)throw Error(r.message);QUESTIONS=r.data||[];if(!QUESTIONS.length)throw Error(`No active questions found for ${currentRound}.`);
    currentIndex=0;score=0;answers=[];startedAt=Date.now();totalPoints=QUESTIONS.reduce((s,q)=>s+Number(q.points||1),0);
    document.getElementById("loginSection").classList.add("d-none");document.getElementById("quizSection").classList.remove("d-none");document.getElementById("playerName").textContent=currentPlayer.fullName;document.getElementById("roundLabel").textContent=currentRound;document.getElementById("totalQuestions").textContent=QUESTIONS.length;renderQuestion();
  }catch(e){showLoginError(e.message||"Unable to start round.");}
}
function renderQuestion(){
  clearInterval(timerHandle);
  const original=QUESTIONS[currentIndex];
  questionStartedAt=Date.now();
  secondsLeft=CONFIG.SECONDS_PER_QUESTION;
  document.getElementById("questionNumber").textContent=currentIndex+1;
  document.getElementById("timer").textContent=secondsLeft;
  document.getElementById("progressBar").style.width=`${((currentIndex+1)/QUESTIONS.length)*100}%`;
  document.getElementById("questionText").textContent=original.q;

  // Randomize answer order for each question. Keep the correct answer aligned
  // with its shuffled position so participants cannot rely on a fixed option letter.
  const shuffled=original.options.map((text,index)=>({text,index}));
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const displayQuestion={...original, options:shuffled.map(x=>x.text), correct:shuffled.findIndex(x=>x.index===original.correct)};
  QUESTIONS[currentIndex]=displayQuestion;

  const opts=document.getElementById("options");
  opts.innerHTML="";
  displayQuestion.options.forEach((text,i)=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="btn btn-outline-dark btn-lg text-start option-btn no-copy";
    b.textContent=`${String.fromCharCode(65+i)}. ${text}`;
    b.dataset.index=i;
    b.onclick=()=>chooseAnswer(i,false);
    opts.appendChild(b);
  });
  const next=document.getElementById("nextBtn");
  next.disabled=true;
  next.textContent=currentIndex===QUESTIONS.length-1?"Finish ✓":"Next →";
  timerHandle=setInterval(()=>{
    secondsLeft--;
    document.getElementById("timer").textContent=Math.max(0,secondsLeft);
    if(secondsLeft<=0){clearInterval(timerHandle);chooseAnswer(null,true);}
  },1000);
}
function chooseAnswer(selected,timedOut){
  if(answers[currentIndex])return;clearInterval(timerHandle);const q=QUESTIONS[currentIndex],elapsed=Date.now()-questionStartedAt,correct=selected===q.correct,points=Number(q.points||1);if(correct)score+=points;
  answers[currentIndex]={questionIndex:currentIndex,selected,correct,pointsAwarded:correct?points:0,responseMs:elapsed,timedOut:!!timedOut};
  document.querySelectorAll(".option-btn").forEach(b=>{b.disabled=true;const i=Number(b.dataset.index);if(i===q.correct)b.classList.add("correct-answer");if(selected!==null&&i===selected&&i!==q.correct)b.classList.add("wrong-answer");});
  document.getElementById("nextBtn").disabled=false;
  if(timedOut){document.getElementById("timer").textContent="0";setTimeout(nextQuestion,350);}
}
function nextQuestion(){if(!answers[currentIndex])return;if(currentIndex===QUESTIONS.length-1){finishRound();return;}currentIndex++;renderQuestion();}

async function finishRound(){
  clearInterval(timerHandle);document.getElementById("quizSection").classList.add("d-none");document.getElementById("resultSection").classList.remove("d-none");document.getElementById("resultName").textContent=currentPlayer.fullName;document.getElementById("resultScore").textContent=score;document.getElementById("resultTotal").textContent=totalPoints;document.getElementById("resultRound").textContent=currentRound;
  const status=document.getElementById("submissionStatus");status.innerHTML='<span class="text-muted">Saving your score...</span>';
  try{const r=await submitQuiz({participantEmail:currentPlayer.email,participantName:currentPlayer.fullName,office:currentPlayer.department,round:currentRound,score,total:totalPoints,durationMs:Date.now()-startedAt,answers});if(!r.success)throw Error(r.message);status.innerHTML='<div class="alert alert-success">✅ Score recorded! Please wait for the host to announce the qualifiers.</div>';document.getElementById("resultActions").innerHTML="";}catch(e){status.innerHTML=`<div class="alert alert-warning">${escapeHtml(e.message||"Unable to save score.")} Please tell the host.</div>`;}
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
