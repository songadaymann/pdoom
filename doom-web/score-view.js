import {formatTime} from './run-score.js';
import {nextLevel,getLevel} from './levels.js';
import {LeaderboardSubmission,stablePlayer} from './leaderboard-client.js';
import {RankedRuns} from './ranked-runs.js';

export function createScoreView({level,config,block,openBoards,ceo=()=>null,retry=()=>{},onPendingChange=()=>{}}){
  let storage;try{storage=localStorage;}catch{}
  const ranked=new RankedRuns({endpoint:config.mode==='public'?config.runEndpoint||'https://mann.cool/api/v1/pdoom/runs':null,storage});
  const dialog=document.createElement('dialog');dialog.id='score-dialog';
  dialog.innerHTML=`<div class="score-card"><button type="button" class="score-close" aria-label="Close results">×</button>
    <p class="score-kicker"></p><h2 id="score-title">Rescue complete</h2><p id="score-level"></p>
    <dl class="score-stats"></dl><dl class="score-points"></dl><p class="score-total"></p>
    <form id="score-submit"><label for="score-name">Your name</label><div class="score-name-row"><input id="score-name" name="name" maxlength="32" required autocomplete="nickname"><button id="submit-score">Submit score</button></div></form>
    <p id="score-status" role="status"></p><div class="score-actions"><button type="button" id="view-boards">Leaderboards</button><button type="button" id="next-level" hidden>Next level</button><button type="button" id="retry-run" hidden>Retry level</button><button type="button" id="back-meadow">Look around</button></div></div>`;
  document.querySelector('#stage').append(dialog);
  const reopen=document.createElement('button');reopen.id='show-score';reopen.textContent='Results';reopen.hidden=true;document.querySelector('#stage').append(reopen);
  let result=null,submission=null,showing=false,pending=null;
  const el=selector=>dialog.querySelector(selector);
  const close=()=>{dialog.close();showing=false;block('score',false);};
  const open=()=>{if(!result)return;reopen.classList.remove('score-unread');block('score',true);dialog.showModal();showing=true;};
  reopen.addEventListener('click',open);
  el('.score-close').addEventListener('click',close);el('#back-meadow').addEventListener('click',close);
  el('#retry-run').addEventListener('click',()=>{close();retry();});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  el('#view-boards').addEventListener('click',()=>{close();openBoards();});
  el('#next-level').addEventListener('click',()=>{const next=nextLevel(level);if(next)location.href=`?level=${encodeURIComponent(next.id)}`;});
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
    beginRun(value){ranked.ticket(value).catch(()=>{});},
    savedCount(){return ranked.pending().length;},
    openSaved(){const saved=ranked.pending()[0];onPendingChange();if(saved)this.show(saved.result,{saved});},
    setLevel(value){level=value;},
    show(value,{automatic=true,saved}={}){
      result=value;const pendingRun=saved||ranked.save(result,ceo());onPendingChange();
      submission=new LeaderboardSubmission(result,{endpoint:config.endpoint,playerId:stablePlayer(storage),ceo:pendingRun?.ceo??ceo(),state:pendingRun,
        ticket:()=>ranked.ticket(value),onProgress:state=>ranked.progress(value.runId,state)});
      // On mann.cool, score as the shell's player (it can be saved to an email and follow you
      // to other browsers); the local random ID stays the fallback.
      const current=submission;window.mannCool?.player?.getId?.().then(id=>{if(id&&!current.bodies)current.playerId=id;}).catch(()=>{});
      el('.score-kicker').textContent=config.mode==='local'?'Local leaderboard':'p(DOOM)';
      el('#score-title').textContent=result.outcome==='escaped'?'Rescue complete':'Nobody escaped';el('#score-level').textContent=(getLevel(result.levelId)||level).title;
      const stats=el('.score-stats'),points=el('.score-points');stats.replaceChildren();points.replaceChildren();
      const scored=getLevel(result.levelId)||level;// level 3 counts MEG3N's screens where levels 1-2 count cameras
      row(stats,'People saved',`${result.saved}/${result.total}`);row(stats,scored.camerasLabel||'Cameras destroyed',`${result.camerasDestroyed}/${result.camerasTotal}`);row(stats,'Active time',formatTime(result.activeMs));
      row(stats,'p(DOOM) before escape',result.pDoomAtCoverOpen===null?'—':`≈${result.pDoomAtCoverOpen}%`);
      for(const [label,key]of [['Rescue points','rescue'],['CEO conscious (others are worth more)','ceo'],[scored.camerasPoints||'Camera points','cameras'],['Speed bonus','speed'],['Outlook bonus','outlook']])row(points,label,(result.breakdown[key]||0).toLocaleString());
      el('.score-total').textContent=`TOTAL ${result.totalScore.toLocaleString()}`;
      const enabled=result.eligible&&config.enabled;
      el('#score-submit').hidden=!enabled;el('#score-name').disabled=!!submission.bodies;if(submission.bodies)el('#score-name').value=submission.bodies[0].name;el('#submit-score').disabled=false;el('#submit-score').textContent='Submit score';
      el('#score-status').textContent=result.practiceReason?`Practice run — ${result.practiceReason}`:result.outcome==='lost'?'Try again to save the survivors.':!config.enabled?'Leaderboards are not connected yet.':config.mode==='local'?'Scores here stay on this computer.':'Submit your total score.';
      el('#next-level').hidden=true;el('#retry-run').hidden=result.outcome!=='lost';el('#back-meadow').textContent=result.outcome==='escaped'?'Look around':'Close';
      reopen.hidden=false;
      if(automatic)open();else reopen.classList.add('score-unread');
    },
    whenReady(value,readOutside){
      ranked.save(value,ceo());onPendingChange();
      pending=value;
      const ready=()=>{
        if(pending!==value)return;
        const outside=readOutside();
        if(value.outcome==='lost'||outside&&outside.settled>=value.saved-1){pending=null;this.show(value,{automatic:value.outcome==='lost'});}
        else requestAnimationFrame(ready);
      };
      ready();
    },
    reset(){pending=null;if(showing)close();result=null;submission=null;reopen.hidden=true;reopen.classList.remove('score-unread');},
    getState(){return {open:showing,available:!!result,unread:reopen.classList.contains('score-unread'),accepted:submission?[...submission.accepted]:[],scope:config.mode};}
  };
}
