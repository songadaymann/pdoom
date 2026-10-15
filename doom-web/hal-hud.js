const stage=document.querySelector('#stage');
const thawTimer=document.createElement('p');thawTimer.id='hal-thaw';thawTimer.hidden=true;document.querySelector('#game-text').prepend(thawTimer);
const questionPanel=document.createElement('section');questionPanel.id='hal-question';questionPanel.hidden=true;questionPanel.setAttribute('aria-label','HAL terminal');
const heading=document.createElement('h2'),question=document.createElement('p'),answers=document.createElement('div'),comment=document.createElement('p'),help=document.createElement('p');
question.className='hal-question-text';answers.className='hal-choices';comment.className='hal-comment';comment.setAttribute('aria-live','polite');help.className='hal-question-help';help.textContent='1 / 2 / 3 to choose. Look away to leave.';
questionPanel.append(heading,question,answers,comment,help);stage.append(questionPanel);
const answerButtons=[];
let wasActive=false;
export function configureHalAnswers(sendKey){
 for(let i=0;i<3;i++){
  const b=document.createElement('button'),number=document.createElement('span'),label=document.createElement('span');
  b.type='button';b.dataset.code='Digit'+(i+1);number.className='hal-choice-number';number.textContent=String(i+1);label.className='hal-choice-label';b.append(number,label);
  b.onclick=()=>sendKey(b.dataset.code,String(i+1),49+i);answers.append(b);answerButtons.push({b,label});
  b.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();});
 }
}
export function updateHalHud(world,hal){
 const active=!!hal?.menu;
 if(active&&!wasActive&&document.pointerLockElement?.id==='canvas')document.exitPointerLock();
 wasActive=active;
 stage.classList.toggle('hal-question-active',active);questionPanel.hidden=!active;
 document.querySelector('mann-cool-game-shell')?.toggleAttribute('data-hal-question',active);
 thawTimer.hidden=!hal?.manual_remaining||active||stage.classList.contains('outside');
 if(!thawTimer.hidden){const valves=Number(!!(hal.valves&1))+Number(!!(hal.valves&2));thawTimer.textContent=`THAW OVERRIDE: ${Math.ceil(hal.manual_remaining/35)}s - VALVES ${valves}/2`;}
 if(!active)return;
 heading.textContent=hal.question_title||'HAL terminal';question.textContent=hal.question||'Choose your answer.';
 answerButtons.forEach(({b,label},i)=>{label.textContent=hal.choices?.[i]||String(i+1);b.setAttribute('aria-label',`${i+1}: ${label.textContent}`);});
 comment.textContent=hal.comment||'';comment.hidden=!comment.textContent;
}
