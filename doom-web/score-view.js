import {LeaderboardSubmission,stablePlayer} from './leaderboard-client.js';
import {RankedRuns} from './ranked-runs.js';
import {SPEEDRUN,SPLITS,SPLIT_LABELS,formatRunTime} from './speedrun.js';

// The results card. Since 2026-11-07 there is one, at the end of the game: the speedrun's time, its splits and
// name entry for the one leaderboard (speedrun.js). The levels no longer have score cards of their own.
export function createScoreView({config,block,openBoards,ceo=()=>null,onPendingChange=()=>{}}){
  let storage;try{storage=localStorage;}catch{}
  const ranked=new RankedRuns({endpoint:config.mode==='public'?config.runEndpoint||'https://mann.cool/api/v1/pdoom/runs':null,storage});
  // Results saved before the speedrun (the per-level rescue boards) have no board any more.
  const pendingRuns=()=>ranked.pending().filter(saved=>saved.result?.scoreVersion===SPEEDRUN.scoreVersion);
  const dialog=document.createElement('dialog');dialog.id='score-dialog';
  dialog.innerHTML=`<div class="score-card"><button type="button" class="score-close" aria-label="Close results">×</button>
    <p class="score-kicker"></p><h2 id="score-title">p(DOOM) beaten</h2><p id="score-level"></p>
    <dl class="score-stats"></dl><dl class="score-points"></dl><p class="score-total"></p>
    <form id="score-submit"><label for="score-name">Your name</label><div class="score-name-row"><input id="score-name" name="name" maxlength="32" required autocomplete="nickname"><button id="submit-score">Submit time</button></div></form>
    <p id="score-status" role="status"></p><div class="score-actions"><button type="button" id="view-boards">Leaderboard</button><button type="button" id="back-meadow">Look around</button></div></div>`;
  document.querySelector('#stage').append(dialog);
  const reopen=document.createElement('button');reopen.id='show-score';reopen.textContent='Results';reopen.hidden=true;document.querySelector('#stage').append(reopen);
  let result=null,submission=null,showing=false;
  const el=selector=>dialog.querySelector(selector);
  const close=()=>{dialog.close();showing=false;block('score',false);};
  const open=()=>{if(!result)return;reopen.classList.remove('score-unread');block('score',true);dialog.showModal();showing=true;};
  reopen.addEventListener('click',open);
  el('.score-close').addEventListener('click',close);el('#back-meadow').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  el('#view-boards').addEventListener('click',()=>{close();openBoards();});
  let remembered='';try{remembered=localStorage.getItem('pdoom-name-v1')||'';}catch{}
  el('#score-name').value=remembered;
  el('#score-submit').addEventListener('submit',async event=>{
    event.preventDefault();if(!submission||!result.eligible)return;
    const button=el('#submit-score'),name=el('#score-name');
    if(!name.reportValidity())return;
    button.disabled=true;el('#score-status').textContent='Submitting…';
    const current=submission,completed=result;
    try{
      const promise=current.submit(name.value);name.disabled=true;
      const outcome=await promise;
      ranked.complete(completed.runId);onPendingChange();if(submission!==current)return;
      el('#score-status').textContent=outcome.held.length?'Received. This run is held for review before it appears on the leaderboard.'
        :`Saved to the leaderboard${config.mode==='local'?' on this computer':''}.`;
      button.textContent='Submitted';try{localStorage.setItem('pdoom-name-v1',name.value.trim());}catch{}
    }catch(error){if(submission!==current)return;el('#score-status').textContent=error.message;button.textContent='Retry submission';button.disabled=false;if(!current.bodies)name.disabled=false;}
  });
  function row(list,label,value){const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;list.append(term,detail);}
  return {
    // The run's ticket, asked for when the run starts (and again at each level, until one arrives), so the
    // server can tell how much real time has passed since.
    beginRun(descriptor){ranked.ticket(descriptor).catch(()=>{});},
    submitted(runId){return ranked.submitted(runId);},
    savedCount(){return pendingRuns().length;},
    openSaved(){const saved=pendingRuns()[0];onPendingChange();if(saved)this.show(saved.result,{saved});},
    show(value,{automatic=true,saved}={}){
      result=value;const pendingRun=saved||ranked.save(result,ceo());onPendingChange();
      submission=new LeaderboardSubmission(result,{endpoint:config.endpoint,playerId:stablePlayer(storage),ceo:pendingRun?.ceo??result.ceo??ceo(),state:pendingRun,
        ticket:()=>ranked.ticket(value),onProgress:state=>ranked.progress(value.runId,state)});
      // On mann.cool, submit as the shell's player (it can be saved to an email and follow you to other
      // browsers); the local random ID stays the fallback.
      const current=submission;window.mannCool?.player?.getId?.().then(id=>{if(id&&!current.bodies)current.playerId=id;}).catch(()=>{});
      el('.score-kicker').textContent=config.mode==='local'?'Local leaderboard':'p(DOOM) speedrun';
      el('#score-title').textContent='p(DOOM) beaten';
      el('#score-level').textContent=`${result.saved}/${result.total} people home`;
      const stats=el('.score-stats'),points=el('.score-points');stats.replaceChildren();points.replaceChildren();
      for(const key of SPLITS)row(stats,SPLIT_LABELS[key],formatRunTime(result.splits[key]||0));
      row(points,'Restarts',String(result.restarts));
      // the Doom numbers font has digits only: the label is in the text font
      const label=document.createElement('span');label.className='score-total-label';label.textContent='TIME ';el('.score-total').replaceChildren(label,formatRunTime(result.activeMs));
      const already=ranked.submitted(result.runId),enabled=result.eligible&&config.enabled&&!already;
      el('#score-submit').hidden=!enabled;el('#score-name').disabled=!!submission.bodies;if(submission.bodies)el('#score-name').value=submission.bodies[0].name;el('#submit-score').disabled=false;el('#submit-score').textContent='Submit time';
      el('#score-status').textContent=result.practiceReason?`Practice run — ${result.practiceReason}`:already?'This run is already submitted.'
        :!config.enabled?'The leaderboard is not connected yet.':config.mode==='local'?'Times here stay on this computer.':'Submit your time.';
      reopen.hidden=false;
      if(automatic)open();else reopen.classList.add('score-unread');
    },
    reset(){if(showing)close();result=null;submission=null;reopen.hidden=true;reopen.classList.remove('score-unread');},
    getState(){return {open:showing,available:!!result,unread:reopen.classList.contains('score-unread'),accepted:submission?[...submission.accepted]:[],scope:config.mode,
      result:result?{activeMs:result.activeMs,eligible:result.eligible,practiceReason:result.practiceReason}:null};}
  };
}
