import {LeaderboardSubmission,stablePlayer,cleanVideoLink} from './leaderboard-client.js';
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
    <form id="score-submit"><label for="score-name">Your name</label><div class="score-name-row"><input id="score-name" name="name" maxlength="32" required autocomplete="nickname"><button id="submit-score">Submit time</button></div>
      <div class="score-video"><label for="score-video">Video of your run (optional)</label><input id="score-video" name="video" type="url" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…"></div></form>
    <p id="score-signin" hidden><span></span> <button type="button" id="score-signin-button">Sign in</button></p>
    <form id="score-video-form" hidden><label for="score-video-later">Video of your run</label><div class="score-name-row"><input id="score-video-later" type="url" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…"><button id="save-video">Save link</button></div></form>
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
    const current=submission,completed=result,video=el('#score-video');
    try{
      const promise=current.submit(name.value,{videoUrl:ranked.enabled?video.value:''});name.disabled=true;video.disabled=true;
      const outcome=await promise,sent=current.bodies?.[0]?.videoUrl||'';
      ranked.complete(completed.runId,{videoUrl:sent});onPendingChange();if(submission!==current)return;
      // Every top-ten time is checked by a person first (2026-11-09), so a video link is what gets it on the board.
      el('#score-status').textContent=!outcome.held.length?`Saved to the leaderboard${config.mode==='local'?' on this computer':''}.`
        :outcome.review?.includes('top-ten')?`Received. Top-ten times are checked before they appear on the leaderboard${sent?'.':': add a link to your recording below.'}`
        :'Received. This run is held for review before it appears on the leaderboard.';
      button.textContent='Submitted';try{localStorage.setItem('pdoom-name-v1',name.value.trim());}catch{}
      showVideoForm(completed.runId);
    }catch(error){if(submission!==current)return;el('#score-status').textContent=error.message;button.textContent='Retry submission';button.disabled=false;if(!current.bodies){name.disabled=false;video.disabled=false;}}
  });
  // After the time is in: add, change or clear the link to its recording (ranked-runs.js attachVideo).
  // Once the time is in, the link lives in its own small form (the one in the submit form goes).
  function showVideoForm(runId){const form=el('#score-video-form');form.hidden=!ranked.enabled||!ranked.submitted(runId);if(!form.hidden){el('#score-video-later').value=ranked.video(runId);el('.score-video').hidden=true;}}
  el('#score-video-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!result)return;
    const input=el('#score-video-later'),button=el('#save-video'),runId=result.runId;
    let link;try{link=cleanVideoLink(input.value);}catch(error){el('#score-status').textContent=error.message;return;}
    button.disabled=true;el('#score-status').textContent='Saving…';
    try{const saved=await ranked.attachVideo(runId,link);if(result?.runId!==runId)return;input.value=saved.videoUrl||'';
      el('#score-status').textContent=saved.videoUrl?(saved.held?'Video link saved. It goes with your run when it is checked.':'Video link saved. It shows on the leaderboard.'):'Video link removed.';}
    catch(error){if(result?.runId===runId)el('#score-status').textContent=error.message;}
    finally{button.disabled=false;}
  });
  // Signing in (the shell's email code) makes a time count for Jonathan's challenge, and can come later: the board
  // checks it when it's read (2026-11-09). The card is a modal dialog, so it steps aside for the shell's panel and
  // comes back once you're signed in.
  const signin=el('#score-signin'),signinText=signin.querySelector('span'),signinButton=el('#score-signin-button');let backAfterSignIn=false;
  async function syncSignIn(){
    const player=window.mannCool?.player;
    if(config.mode!=='public'||!player?.get||!result?.eligible){signin.hidden=true;return;}
    try{const me=await player.get();signin.hidden=false;signinButton.hidden=me.linked;
      signinText.textContent=me.linked?`Signed in as ${me.emailHint}: your time counts for the challenge.`:'Sign in with your email to count your time for the challenge.';}
    catch{signin.hidden=true;}
  }
  signinButton.addEventListener('click',()=>{const player=window.mannCool?.player;if(!player?.openSave)return;backAfterSignIn=true;close();player.openSave();});
  addEventListener('mann-cool:player',event=>{void syncSignIn();if(backAfterSignIn&&event.detail?.linked){backAfterSignIn=false;open();}});
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
        ticket:()=>ranked.ticket(value),onProgress:state=>ranked.progress(value.runId,state),
        credential:()=>config.mode==='public'?window.mannCool?.player?.credential?.():null});
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
      void syncSignIn();el('.score-video').hidden=!ranked.enabled||already;el('#score-video').disabled=!!submission.bodies;el('#score-video').value=submission.bodies?.[0]?.videoUrl||'';showVideoForm(result.runId);
      el('#score-status').textContent=result.practiceReason?`Practice run — ${result.practiceReason}`:already?'This run is already submitted.'
        :!config.enabled?'The leaderboard is not connected yet.':config.mode==='local'?'Times here stay on this computer.':'Submit your time.';
      reopen.hidden=false;
      if(automatic)open();else reopen.classList.add('score-unread');
    },
    reset(){if(showing)close();result=null;submission=null;reopen.hidden=true;reopen.classList.remove('score-unread');},
    getState(){return {open:showing,available:!!result,unread:reopen.classList.contains('score-unread'),accepted:submission?[...submission.accepted]:[],scope:config.mode,
      result:result?{activeMs:result.activeMs,eligible:result.eligible,practiceReason:result.practiceReason}:null,
      video:result?{field:!el('.score-video').hidden&&!el('#score-submit').hidden,later:!el('#score-video-form').hidden,link:ranked.video(result.runId)}:null,
      signin:signin.hidden?null:{text:signinText.textContent,button:!signinButton.hidden}};}
  };
}
