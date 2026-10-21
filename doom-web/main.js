import {createPreferences} from './preferences.js';
import {createPrologue} from './prologue.js';
import {createScreenMelt} from './screen-melt.js';
import {createExitText,levelExitText,EPISODE_ONE_FLAT} from './exit-text.js';
import {AssetLoader} from './asset-loader.js';
import {createOnboarding} from './onboarding.js';
import {isGameControl} from './game-controls.js';
import {nativePersonRects,createPersonLabel} from './person-label.js';
import {createStoryBeats} from './story-beats.js';
import {configureHalAnswers,updateHalHud} from './hal-hud.js';
import {Campaign,CAMPAIGN_KEY,OPENING_COMPLETE_KEY,campaignResumePoint,readCampaign} from './campaign.js';
import {updateLevelPolish} from './level-polish.js';
import {DoomAudio} from './audio.js';
import {createVoiceOver} from './voice-over.js';
import {updateIntakeHud,showIntakeResult} from './intake-hud.js';
import {configureCheckpointLauncher,updateCheckpointHud,showCheckpointResult,checkpointStatusBar} from './checkpoint-hud.js';
import {survivalEstimate} from './survival-estimate.js';
import {openingState} from './opening.js';
import {getLevel} from './levels.js';
import {RunTracker} from './run-score.js';
import {connectPlatform} from './platform.js';
import {createScoreView} from './score-view.js';
import {localDevelopmentEnabled} from './dev-capabilities.js';
import {configureFactory,updateFactory,pauseFactory,factorySite,FACTORY_SITES,factoryExitText,useFactoryHud} from './factory-hud.js';
import {browserStorage,resolveCeo,mountCeoPicker} from './ceo-pick.js';

const DEBUG_OPTIONS={logs:new URLSearchParams(location.search).has('debug')};
const requestedLevel=new URLSearchParams(location.search).get('level')||'five-prisons';
let LEVEL=getLevel(requestedLevel);
const CHECKPOINT=LEVEL?.scored===true;
const FACTORY=LEVEL?.id==='meg3n-factory';
const DEV_END=CHECKPOINT&&new URLSearchParams(location.search).get('dev')==='end';
// Loopback development flag: ?level=meg3n-factory&puzzle=zvi starts beside that puzzle (factory-hud.js).
const FACTORY_SITE=FACTORY?factorySite(new URLSearchParams(location.search).get('puzzle')):0;
// Keep links/saved hero selection; fresh onboarding starts with Samwise.
const realStorage=browserStorage(),CEO_CHOICE=resolveCeo({search:location.search,storage:realStorage,random:()=>0});
// Loopback development fixture only: pretend levels 1 and 2 were cleared (ten saved),
// out of HAL's door (add &level=five-prisons to come out of the bunker instead). It plays from an
// in-memory save, so a real save in this browser is left alone; the menu's own Load Game hand-off launches it.
const SAFE_MODE=CHECKPOINT&&new URLSearchParams(location.search).get('safemode')==='1'&&await localDevelopmentEnabled();
function campaignSandbox(storage,ceo){
 let save=JSON.stringify({version:1,ceo:['altman','amodei'].includes(ceo)?ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0}),openingComplete='1';
 return {getItem:k=>k===CAMPAIGN_KEY?save:k===OPENING_COMPLETE_KEY?openingComplete:storage?.getItem(k)??null,setItem:(k,v)=>{if(k===CAMPAIGN_KEY)save=String(v);else if(k===OPENING_COMPLETE_KEY)openingComplete=String(v);else storage?.setItem(k,v);},removeItem:k=>{if(k===CAMPAIGN_KEY)save=null;else if(k===OPENING_COMPLETE_KEY)openingComplete=null;else storage?.removeItem(k);}};
}
const ceoStorage=SAFE_MODE?campaignSandbox(realStorage,CEO_CHOICE.id):realStorage;
if(SAFE_MODE){
 const u=new URL(location.href);u.searchParams.set('play','1');u.searchParams.set('load','1');if(!u.searchParams.get('level'))u.searchParams.set('level','hal-station');history.replaceState(null,'',u);
 // no title click to unlock sound: the first click or key does it
 for(const type of ['pointerdown','keydown'])window.addEventListener(type,()=>audio.unlock(),{once:true,capture:true});
}
configureCheckpointLauncher(CHECKPOINT,LEVEL,CEO_CHOICE.id);
if(FACTORY)configureFactory();
const canvas=document.querySelector('#canvas'),launcher=document.querySelector('#launcher');
const start=document.querySelector('#start'),status=document.querySelector('#status');
const ceoPick=CHECKPOINT?mountCeoPicker(document.querySelector('#ceo-pick'),{choice:CEO_CHOICE,storage:ceoStorage,
  onChange:id=>{if(!worker)checkpointStatusBar()?.setCeo(id);},onEnter:()=>gamePause.heroNext()}):null;
const audio=new DoomAudio(),held=new Map(),voiceOver=createVoiceOver(audio);
const preferences=createPreferences(ceoStorage);
preferences.subscribe(d=>{audio.setVolumes(d);document.querySelector('#stage').classList.toggle('reduced-motion',d.reducedMotion);});
const personLabel=createPersonLabel(document.querySelector('#stage'));
const state={mode:'ready',engine:'GZDoom WebAssembly',mod:`p(DOOM): ${LEVEL?.title||'Unavailable'}`,clock:'real-time Doom ticks',frames:0,fps:0,world:null,events:[],error:null};
let yardMusic=false;const logs=[];let worker=null,timeout=null,outside=null,hub=null,outsideLoading=false,pendingWin=0;
let campaign=new Campaign(ceoStorage,CEO_CHOICE.id),runningCeo=null,bootResolve=null,bootReject=null,resumeHub=false,awaitingRun=false,nativeResume=null,openingCheckpointPending=false;
launcher.hidden=CHECKPOINT;
if(!CHECKPOINT)document.querySelector('#onboarding').hidden=true;
const run=new RunTracker(LEVEL),panels=new Set();let uiBlocked=false,meadowPanelPaused=false;
let nativePanelPaused=false,mouseAttack=false;
let factoryPaused=false;
// The save's SAFE MODE flag from just before this level's exit committed to it (levelExit()).
let hubBeforeCommit=null;
function nativePanelKey(open){const code=open?'F10':'F11',kc=open?121:122;for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code,key:code,keyCode:kc,which:kc,bubbles:true,cancelable:true}});}
function syncPanelPause(){
  if(outside||outsideLoading||!worker||state.mode!=='playing')return;
  if(uiBlocked&&!nativePanelPaused){nativePanelPaused=true;nativePanelKey(true);}
  else if(!uiBlocked&&nativePanelPaused){nativePanelPaused=false;nativePanelKey(false);}
}
function blockPanel(name,open){
  if(open)panels.add(name);else panels.delete(name);
  const blocked=panels.size>0;if(blocked===uiBlocked)return;uiBlocked=blocked;
  if(blocked){personLabel.hide();releaseKeys();audio.pauseMusic();audio.stopEffects();if(document.pointerLockElement)document.exitPointerLock();}
  send({type:'visibility',state:blocked||document.hidden?'hidden':'visible'});
  checkpointStatusBar()?.setPaused(blocked||document.hidden);
  syncPanelPause();
  if(outside){
    if(blocked&&!outside.getState().paused){outside.key('Escape',true);outside.key('Escape',false);meadowPanelPaused=true;}
    else if(!blocked&&meadowPanelPaused){outside.key('Escape',true);outside.key('Escape',false);meadowPanelPaused=false;}
  }
  if(!blocked){if(state.mode==='playing')audio.startMusic();(outside?document.querySelector('#outside-canvas'):canvas)?.focus();}
}
const assets=new AssetLoader(p=>gamePause.progress(p));
let scoreView=null;
const gamePause=CHECKPOINT?createOnboarding({stage:document.querySelector('#stage'),storage:ceoStorage,preferences,picker:ceoPick,block:blockPanel,warm:()=>assets.warm(),start:startEngine,validate:validateEngine,restart:()=>enterLevel(LEVEL.id,false,true),active:()=>worker?(outside?'outside':'native'):null,activeHero:()=>runningCeo,unlock:()=>audio.unlock(),fullscreen,savedResults:()=>scoreView?.savedCount()||0,openSavedResults:()=>scoreView?.openSaved()}):{isOpen:()=>false,isVisible:()=>false,close(){},toggle(){},getState:()=>null,progress(){},loading(){}};
// Leaving a level melts the last Doom frame away into Bliss, as Doom does between screens.
const screenMelt=createScreenMelt({stage:document.querySelector('#stage'),source:canvas,audio});
const exitText=createExitText({stage:document.querySelector('#stage')});
const prologue=createPrologue({stage:document.querySelector('#stage'),source:canvas,audio,skip:()=>{
 releaseKeys();
 for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code:'F3',key:'F3',keyCode:114,which:114,bubbles:true,cancelable:true}});
}});

const storyBeats=createStoryBeats(blockPanel,()=>audio.playCue());
const platform=LEVEL?await connectPlatform(LEVEL,{block:blockPanel}):null;
scoreView=CHECKPOINT?createScoreView({level:LEVEL,config:platform.config,block:blockPanel,openBoards:platform.openBoards,ceo:()=>ceoPick?.id,retry:()=>enterLevel(LEVEL.id,false,true),onPendingChange:()=>gamePause.refreshSavedResults?.()}):null;
gamePause.refreshSavedResults?.();
window.render_game_to_text=()=>JSON.stringify({...state,voiceOver:voiceOver.getState(),melt:screenMelt.getState(),exitText:exitText.getState(),levelId:LEVEL?.id,ceo:ceoPick?.id??null,ceoPick:ceoPick?.getState()??null,campaign:campaign.getState(),run:CHECKPOINT?run.getState():null,scoreView:scoreView?.getState()||null,uiBlocked,personLabel:personLabel.getState(),gamePaused:gamePause.isOpen()||factoryPaused,menu:gamePause.getState(),opening:openingState(),prologueUi:prologue.getState(),survivalEstimate:prologue.active?{doom:state.prologue?.pdoom,kind:'historical in-world estimate'}:CHECKPOINT?survivalEstimate(state.world,state.mode,state.escape):null,statusBar:(CHECKPOINT||FACTORY)&&!prologue.active?checkpointStatusBar()?.getState()??null:null,outside:outside?.getState()||null,audioBuffers:audio.played,sound:audio.getState(),audioState:audio.context?.state||'uninitialized',musicPlaying:!!audio.musicSource,coordinateSystem:'Native world: Doom units; x east, y north, z up. Outside: metres; x east, z south, y up.'});
window.__DOOM_DEBUG__={state,logs};

function send(message){worker?.postMessage(message);}
function fail(message){
  audio.pauseMusic();
  state.mode='error';state.error=String(message);clearTimeout(timeout);
  if(bootReject){const e=new Error(state.error);e.reload=!!worker;bootReject(e);bootReject=null;}else if(CHECKPOINT)gamePause.failed(state.error);
  launcher.hidden=false;status.textContent=state.error;start.textContent='Reload';start.disabled=false;
}
function onMessage(m){
  // Capture keeps native sound for Doom's own death (scream) before the upload takes over.
  if(m.audio){if(!outsideLoading&&!outside&&!uiBlocked&&(state.prologue?.phase!=='captured'||state.prologue.capture_ticks<40))audio.accept(m);return;}
  if(m.type==='frame-stats'){state.frames=m.totalFrames;state.fps=Math.round(m.win1s?.fps||0);return;}
  if(m.type==='abort'||m.type==='error'){fail(m.reason||m.message);worker?.terminate();return;}
  if(m.type!=='log')return;
  const clean=String(m.msg).replace(/\x1B(?:\[[0-?]*[ -/]*[@-~]|[78])/g,'').replace(/\[[=.]{10,}\]/g,'').trim();
  if(!clean)return;
  m={...m,msg:clean};
  logs.push(m.msg);if(logs.length>500)logs.shift();
  if(DEBUG_OPTIONS.logs)console.log('[Doom]',m.msg);
  const battlePos=m.msg.indexOf('PDOOM_PROLOGUE ');
  if(battlePos!==-1){
    try{
      const previous=state.prologue?.phase;
      state.prologue=JSON.parse(m.msg.slice(battlePos+15));state.world=state.prologue;state.mod='p(DOOM): The Last Stand';
      if(previous!=='captured'&&state.prologue.phase==='captured'){releaseKeys();audio.pauseMusic();audio.stopEffects();import('./outside/outside.js').catch(()=>{});}
      if(state.prologue.phase==='bliss'){
        state.mod='p(DOOM): SAFE MODE';
        if(!awaitingRun&&!outside&&!outsideLoading)enterOutside({intro:true});
        return;
      }
      // The yard springs the trap: At Doom's Gate.
      if(previous==='battle'&&state.prologue.phase==='battle'&&state.prologue.stage==='yard'&&!yardMusic){
        yardMusic=true;audio.pauseMusic();audio.musicOffset=0;audio.musicBuffer=null;
        audio.prepareMusic('local/intake-music.ogg').then(()=>{if(state.prologue?.phase==='battle'&&!uiBlocked)audio.startMusic();}).catch(error=>console.warn(error.message));
      }
      // Captured: Doom's dead face and 0% on the bar while we fall.
      prologue.update(state.prologue);voiceOver.update(state,{paused:uiBlocked||document.hidden});checkpointStatusBar()?.updateWar(state.prologue.phase==='captured'?{...state.prologue,health:0}:state.prologue);awaitingRun=false;
      if(state.mode==='loading'){
        state.mode='playing';clearTimeout(timeout);launcher.hidden=true;
        for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code:'F4',key:'F4',keyCode:115,which:115,bubbles:true,cancelable:true}});
        if(bootResolve){const resolve=bootResolve;bootResolve=null;bootReject=null;resolve();}
        else if(gamePause.getState()?.page==='loading')gamePause.close();
      }
    }catch(error){fail('Prologue state: '+error.message);}
  }
  for(const [marker,method]of [['PDOOM_RUN_START ','begin'],['PDOOM_RUN ','update']]){
    const i=m.msg.indexOf(marker);
    if(CHECKPOINT&&i!==-1){try{
      const payload=JSON.parse(m.msg.slice(i+marker.length));
      if(method==='begin'&&getLevel(payload.level_id)){LEVEL=getLevel(payload.level_id);run.level=LEVEL;scoreView.setLevel(LEVEL);state.mod=`p(DOOM): ${LEVEL.title}`;}
      run[method](payload);
      if(method==='begin'){
        playLevelMusic();
        state.prologue=null;awaitingRun=false;hubBeforeCommit=null;storyBeats.reset();scoreView.reset();if(!outside){state.mode='loading';state.world=null;}
        if(!run.practiceReason)scoreView.beginRun({runId:run.runId,levelId:LEVEL.id,levelVersion:LEVEL.version,scoreVersion:LEVEL.scoreVersion,boardVersion:LEVEL.boardVersion});
      }
      if(method==='begin'&&DEV_END)run.markPractice('Development ending selected.');
    }catch(error){console.error('Run tracking:',error);}}
  }
  for(const marker of ['PDOOM_EVENT ','PDOOM_RESULT ']){
    const i=m.msg.indexOf(marker);
    if(i!==-1){try{
      const event=JSON.parse(m.msg.slice(i+marker.length));state.events.push(event);
      if(marker==='PDOOM_RESULT '&&CHECKPOINT&&run.result)return;
      if(state.events.length>150)state.events.shift();
      if(event.type==='prisoner-discovered'&&!DEV_END)storyBeats.discover(state.world?.people[event.id-1]?.name);
      // PDOOM_ESCAPE only reports every 7 tics, but the exit that ends a run commits the camp in that same tic.
      // Record each exit as it happens so the meadow walks the last one out of the door instead of placing them in camp.
      if(event.type==='person-outside'&&state.escape?.saved_people)state.escape.saved_people[event.id-1]=1;
      if(event.type==='outside-reveal')levelExit();
      if(event.type==='factory-exit'&&LEVEL?.id==='meg3n-factory')factoryExit(event);
      if(marker==='PDOOM_RESULT '){
        state.mode=event.saved>0?'escaped':'lost';releaseKeys();
        if(CHECKPOINT&&event.saved>0){pendingWin=event.saved;outside?.showWin(event.saved);}else if(CHECKPOINT){checkpointStatusBar()?.update(state.world,state.mode,state.escape);showCheckpointResult(event);}else showIntakeResult(event);
        if(CHECKPOINT){const result=run.finish(event);scoreView.whenReady(result,()=>outside?.getState());window.dispatchEvent(new CustomEvent('pdoom:level-complete',{detail:{levelId:LEVEL.id,nextLevelId:LEVEL.nextLevelId,result}}));}
      }
    }catch(error){console.error('Native event:',error);}}
  }
  const campaignPos=m.msg.indexOf('PDOOM_CAMPAIGN ');
  if(campaignPos!==-1){try{const native=JSON.parse(m.msg.slice(campaignPos+15));hubBeforeCommit??=campaign.data.hub;campaign.commit(native);}catch{}}
  const environmentPos=m.msg.indexOf('PDOOM_ENVIRONMENT ');
  if(environmentPos!==-1){try{state.environment=JSON.parse(m.msg.slice(environmentPos+18));}catch{}}
  const signPos=m.msg.indexOf('PDOOM_SIGN ');
  if(signPos!==-1){try{state.evaluationSign=JSON.parse(m.msg.slice(signPos+11));}catch{}}
  const doorsPos=m.msg.indexOf('PDOOM_DOORS ');
  if(doorsPos!==-1){try{state.doors=JSON.parse(m.msg.slice(doorsPos+12));}catch{}}
  const halPos=m.msg.indexOf('PDOOM_HAL ');
  const factoryPos=m.msg.indexOf('PDOOM_FACTORY ');
  // Only while the factory is the level: its last reports can still arrive after a door is chosen.
  if(factoryPos!==-1&&LEVEL?.id==='meg3n-factory'){try{state.factory=JSON.parse(m.msg.slice(factoryPos+14));
    // MEG3N.AVI on air: her song plays in the engine until you leave, so the level's track waits.
    audio.holdMusic(!!state.factory.on_air);}catch{}}
  if(halPos!==-1){try{state.hal=JSON.parse(m.msg.slice(halPos+10));}catch{}}
  const livesPos=m.msg.indexOf('PDOOM_LIVES ');
  if(livesPos!==-1){try{state.lives=JSON.parse(m.msg.slice(livesPos+12));}catch{}}
  const polishPos=m.msg.indexOf('PDOOM_POLISH ');
  if(polishPos!==-1){try{state.polish=JSON.parse(m.msg.slice(polishPos+13));}catch{}}
  const escapePos=m.msg.indexOf('PDOOM_ESCAPE ');
  if(escapePos!==-1){try{state.escape=JSON.parse(m.msg.slice(escapePos+13));}catch{}}
  const dialoguePos=m.msg.indexOf('PDOOM_DIALOGUE ');
  if(dialoguePos!==-1){try{state.dialogue=JSON.parse(m.msg.slice(dialoguePos+15));audio.duckMusic(state.dialogue.remaining>0);}catch{}}
  const breachPos=m.msg.indexOf('PDOOM_BREACH ');
  if(breachPos!==-1){try{state.breach=JSON.parse(m.msg.slice(breachPos+13));}catch{}}
  const hollyPos=m.msg.indexOf('PDOOM_HOLLY ');
  if(hollyPos!==-1){try{state.holly=JSON.parse(m.msg.slice(hollyPos+12));}catch{}}
  const introPos=m.msg.indexOf('PDOOM_INTRO ');
  if(introPos!==-1){try{state.intro=JSON.parse(m.msg.slice(introPos+12));}catch{}}
  const samPos=m.msg.indexOf('PDOOM_SAM ');
  if(samPos!==-1){try{state.sam=JSON.parse(m.msg.slice(samPos+10));}catch{}}
  const combatPos=m.msg.indexOf('PDOOM_COMBAT ');
  if(combatPos!==-1){try{state.combat=JSON.parse(m.msg.slice(combatPos+13));}catch{}}
  const pos=m.msg.indexOf('PDOOM_STATE ');
  if(pos!==-1&&nativeResume){try{const w=JSON.parse(m.msg.slice(pos+12));if(w.ticks>=nativeResume.after){const done=nativeResume.resolve;nativeResume=null;done();}}catch{}}
  // MEG3N's factory has no scored run (no PDOOM_RUN_START): walked into from SAFE MODE, its map's
  // load line starts the level. (Its PDOOM_STATE cannot: a factory already loaded keeps reporting
  // until the map change, and the loading gate's release would go to that old map.)
  // Respawning after MEG3N catches you reloads E2M7, which holds at its loading gate again: release it.
  if(!awaitingRun&&LEVEL?.id==='meg3n-factory'&&state.mode==='playing'&&m.msg.includes('PDOOM_MOD_LOADED factory'))for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code:'F4',key:'F4',keyCode:115,which:115,bubbles:true,cancelable:true}});
  if(awaitingRun&&LEVEL?.id==='meg3n-factory'&&m.msg.includes('PDOOM_MOD_LOADED factory')){
    awaitingRun=false;hubBeforeCommit=null;state.prologue=null;storyBeats.reset();scoreView?.reset();state.mod=`p(DOOM): ${LEVEL.title}`;playLevelMusic();
  }
  if(pos!==-1&&!awaitingRun){
    try{state.world={...JSON.parse(m.msg.slice(pos+12)),...state.combat,...state.polish,...state.lives};}catch{state.world={raw:m.msg.slice(pos+12)};}
    if(state.mode==='loading'){
      prologue.reset();
      state.mode='playing';clearTimeout(timeout);launcher.hidden=true;
      if(openingCheckpointPending&&LEVEL.id==='five-prisons'){campaign.saveOpening('level-one');openingCheckpointPending=false;}
      document.querySelector('#restart').hidden=false;
      document.querySelector('#touch').hidden=!matchMedia('(pointer:coarse)').matches;
      canvas.focus();
      if(!uiBlocked)audio.startMusic();
      // The native loading gate reports state without ticking rescue gameplay.
      // Release it directly, avoiding a same-frame F10/F11 menu activation race.
      if(!resumeHub)for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code:'F4',key:'F4',keyCode:115,which:115,bubbles:true,cancelable:true}});
      if(bootResolve){const resolve=bootResolve;bootResolve=null;bootReject=null;resolve();}else if(gamePause.getState()?.page==='loading')gamePause.close();else syncPanelPause();
    }
    if(LEVEL?.id==='meg3n-factory'){if(outside||outsideLoading)voiceOver.stop();else{voiceOver.update(state,{levelId:LEVEL?.id,paused:uiBlocked||document.hidden||factoryPaused});updateFactory(state.world,state.factory,state.dialogue);updateLevelPolish(state.world);const prompt=document.querySelector('#prompt');if(prompt&&!prompt.hidden)prompt.textContent=preferences.prompt(prompt.textContent);personLabel.update(nativePersonRects(state.world),canvas,!uiBlocked&&state.mode==='playing'&&!factoryPaused);}}else if(CHECKPOINT){if(outside||outsideLoading)voiceOver.stop();else voiceOver.update(state,{levelId:LEVEL?.id,paused:uiBlocked||document.hidden});if(!outsideLoading&&!outside){updateCheckpointHud(state.world,state.mode,state.escape,state.dialogue,state.evaluationSign,LEVEL.id==='hal-station'?state.hal:null);updateLevelPolish(state.world);updateHalHud(state.world,LEVEL.id==='hal-station'?state.hal:null);const prompt=document.querySelector('#prompt');if(prompt&&!prompt.hidden)prompt.textContent=preferences.prompt(prompt.textContent);personLabel.update(nativePersonRects(state.world,state.escape?.view_height),canvas,!uiBlocked&&state.mode==='playing'&&!state.hal?.menu);}}else updateIntakeHud(state.world,state.mode);
  }
  if(/Script error|Execution could not continue|Unknown identifier|Unknown flag|VM execution aborted|virtual override not allowed/i.test(m.msg))fail(m.msg);
}

async function enterOutside({intro=false,melt=false}={}){
  if(outside||outsideLoading)return;
  // Leaving a level (2026-10-14): the last frame holds over the window while the meadow gets
  // ready behind it, then melts away (screen-melt.js). It used to be a straight cut.
  if(melt)screenMelt.capture();
  // The level's HUD stops updating out here: put its tools away (the factory's would stay drawn).
  if(CHECKPOINT)useFactoryHud(false);
  for(const id of ['held-wrench','held-gun'])document.getElementById(id).hidden=true;
  personLabel.hide();outsideLoading=true;state.mode='outside';releaseKeys();audio.pauseMusic();
  for(const source of audio.sources.values()){try{source.stop();}catch{}}
  if(document.pointerLockElement)document.exitPointerLock();
  try{
    if(hub){outside=hub;outside.setActive(true,LEVEL.id);}
    else{const {createOutside}=await import('./outside/outside.js');
      outside=hub=await createOutside({source:canvas,stage:document.querySelector('#stage'),audio:audio.context,read:()=>state,campaign:()=>campaign.getState(),enter:enterLevel,prompt:text=>preferences.prompt(text),readThis:()=>gamePause?.openRead?.(),labels:(rects,surface,active)=>personLabel.update(rects,surface,active&&!uiBlocked)});}
    outside.setActive(true,LEVEL.id);
    if(intro){await outside.startIntro(runningCeo);campaign.saveOpening('xp-intro');prologue.reset();document.querySelector('#reticle').hidden=true;}
    window.__DOOM_DEBUG__.outside=outside;document.querySelector('#hal-thaw').hidden=true;
    outsideLoading=false;document.querySelector('#threat-warning').hidden=true;document.querySelector('#status-line')?.setAttribute('hidden','');
    canvas.hidden=true;document.querySelector('#stage').classList.add('outside');checkpointStatusBar()?.setPaused(true);
    if(pendingWin)outside.showWin(pendingWin);
    if(uiBlocked&&!outside.getState().paused){outside.key('Escape',true);outside.key('Escape',false);meadowPanelPaused=true;}
    if(melt)screenMelt.play();
  }catch(error){screenMelt.cancel();fail(`The meadow could not load: ${error?.message||error?.type||error}`);}
}

// Level 3's way out (2026-10-19): E2M7's exit switch, pressed with all five, comes out of
// MEG3N.AVI's door into the meadow, as levels 1-2's outside-reveal does. The first exit of a
// playthrough melts straight into the meadow; a later one (this save has reached SAFE MODE
// before) types the exit text over a Doom flat first (spec 06 section 8.3).
// Walked in from SAFE MODE (2026-10-20, event.hub), the switch is also the retreat: event.saved
// says who came out with you, the native exit has already committed the save (PDOOM_CAMPAIGN), and
// anyone freed but left behind waits in the break room next time. A cold run from the episode menu
// commits natively too (event.committed); the ?level=meg3n-factory page records its clear here
// instead. The text screen shows only when this exit finishes the factory, on a save that had
// already reached SAFE MODE before this exit committed to it (levelExit()'s rule).
let factoryExiting=false;
async function factoryExit(event){
 if(factoryExiting)return;factoryExiting=true;
 const mask=Number.isInteger(event?.saved)?event.saved:31,out=[0,1,2,3,4].map(i=>mask>>i&1),count=out.filter(Boolean).length;
 const later=!!event?.hub||(hubBeforeCommit??campaign.data.hub);hubBeforeCommit=null;
 state.escape={saved_people:out,saved:count,outside:count};pendingWin=count;
 if(!event?.committed)campaign.commitFactory(mask);
 const text=later&&count>0&&campaign.data.saved2===31?exitText.prepare(factoryExitText(runningCeo)):null;
 await new Promise(resolve=>setTimeout(resolve,700));// the exit switch's clunk
 if(!text){await enterOutside({melt:true});return;}
 await exitThroughText(text);
}

// Levels 1-2's way out (2026-10-20), on the same rule: the first exit melts straight into the meadow;
// a later one that saved someone types the level's exit text over Doom's episode 1 flat first. The
// hub crank's exit commits to the campaign before its outside-reveal (RescueLives.zs), so "later"
// is the save's SAFE MODE flag from before that commit. Its result also arrives first, so a crank
// retreat that brings nobody out (everyone already camped, say) melts straight to the meadow.
function levelExit(){
 const later=hubBeforeCommit??campaign.data.hub;hubBeforeCommit=null;
 const text=later&&run.result?.savedFigures!==0?levelExitText(LEVEL?.id,runningCeo):null;
 if(!text||outside||outsideLoading){enterOutside({melt:true});return;}
 exitThroughText(exitText.prepare(text,{flatUrl:EPISODE_ONE_FLAT}));
}

// Doom: the level melts into the text screen; the text screen melts into the next one. The meadow
// gets ready behind the text, paused until the player moves on.
async function exitThroughText(prepared){
 screenMelt.capture();
 const meadow=enterOutside();blockPanel('exit-text',true);
 await prepared;
 const typed=exitText.open();
 await meadow;await screenMelt.play();await typed;
 screenMelt.capture([exitText.canvas]);exitText.close();blockPanel('exit-text',false);
 await screenMelt.play();
}

function validateEngine(id){
 if(!window.Worker||!canvas.transferControlToOffscreen||!WebAssembly.Suspending)throw Error('PLAY IN CURRENT CHROME OR EDGE — THIS ENGINE NEEDS WEBASSEMBLY JSPI.');
 if(!getLevel(id))throw Error('THIS LEVEL IS NOT AVAILABLE.');
}
async function startEngine(id,{load=false,prologue:playPrologue=false,skipOpening=false}={}){
  yardMusic=false;
 if(worker)throw Error('The engine is already running.');
 validateEngine(id);
 // The campaign page runs the scored levels and, from the episode menu, MEG3N's unscored factory.
 LEVEL=getLevel(id);if(!LEVEL||CHECKPOINT&&!LEVEL.scored&&LEVEL.id!=='meg3n-factory')throw Error('THIS LEVEL IS NOT AVAILABLE.');
 // The factory has no hero picker: it plays as the saved campaign's CEO, so its clear joins that save.
 runningCeo=ceoPick?.id||(FACTORY&&CEO_CHOICE.source!=='url'&&readCampaign(ceoStorage)?.ceo)||CEO_CHOICE.id;campaign=new Campaign(ceoStorage,runningCeo);run.level=LEVEL;scoreView?.setLevel(LEVEL);ceoPick?.lock();checkpointStatusBar()?.setCeo(runningCeo);
 // Started cold from the episode menu, the factory has its own HUD, as when walked in (enterLevel).
 if(CHECKPOINT&&LEVEL.id==='meg3n-factory'){useFactoryHud(true);state.mod=`p(DOOM): ${LEVEL.title}`;}
 const resume=load?campaignResumePoint(campaign.data):null;resumeHub=resume==='hub'||resume==='xp-intro';openingCheckpointPending=skipOpening;
 const ready=new Promise((resolve,reject)=>{bootResolve=resolve;bootReject=reject;});
 try{
    state.mode='loading';start.disabled=true;status.textContent='Loading Doom…';await audio.unlock();
    // Decode once before starting; live MIDI synthesis stalls the WASM loop.
    if(CHECKPOINT)try{await audio.prepareCue('local/ui/doom-success.wav');}catch(error){console.warn(error.message);}
    try{await audio.prepareMusic(playPrologue?'local/prologue-music.ogg':CHECKPOINT||FACTORY?levelMusic(LEVEL.id):'local/intake-music.ogg');}catch(error){console.warn(error.message);}
    const {files,wasm}=await assets.files();
    let development=false;
    if(DEV_END&&['127.0.0.1','localhost','[::1]'].includes(location.hostname)){
      try{const r=await fetch('dev-config.json');development=r.ok&&(await r.json()).enabled===true;}catch{}
    }
    state.developmentEnd=development;
    document.querySelector('#dev-badge').hidden=!development;
    const site=FACTORY_SITE&&await localDevelopmentEnabled()?FACTORY_SITE:0;
    if(site){const badge=document.querySelector('#dev-badge');badge.textContent=`Dev: start at ${FACTORY_SITES[site-1]} · `;const a=document.createElement('a');a.href='?level=meg3n-factory';a.textContent='Start normally';badge.append(a);badge.hidden=false;}
    const width=960,height=600;canvas.width=width;canvas.height=height;
    const offscreen=canvas.transferControlToOffscreen();
    worker=new Worker('engine/engine.worker.js');worker.onmessage=e=>onMessage(e.data);worker.onerror=e=>{fail(e.message);worker?.terminate();};
    timeout=setTimeout(()=>{fail('Doom did not finish starting. Reload to try again.');worker?.terminate();},45000);
    worker.postMessage({type:'boot',wasmBinary:wasm,canvas:offscreen,pinW:width,pinH:height,files,args:[
      '-iwad','DOOM.WAD','-file','pdoom.pk3','-exec','pdoom.cfg','-warp',String(LEVEL.episode),String(playPrologue?2:LEVEL.map),'-skill','3','-nomusic',
      ...campaign.bootArgs(skipOpening?{opening:'level-one'}:{}),'+set','pdoom_boot_hold','1','+set','pdoom_ceo',runningCeo==='amodei'?'1':'0','+set','pdoom_development',development?'1':'0','+set','pdoom_dev_end',development?'1':'0','+set','pdoom_factory_site',String(site),'+set','pdoom_factory_commit',CHECKPOINT?'1':'0',
      '+vid_rendermode','4','+vid_preferbackend','1','+vid_fullscreen','0',
      '+vid_defwidth',String(width),'+vid_defheight',String(height),'+win_w',String(width),'+win_h',String(height),
      '+vid_maxfps','120','+vid_vsync','0','+cl_capfps','0','+gl_texture_filter','0',
      '+set','screenblocks','12','+set','con_notifylines','0','+set','snd_mididevice','0','+set','snd_musicvolume','0.25',
      '+set','i_pauseinbackground','1','+set','cl_run','0',
      '+fov','90','+set','freelook','1','+set','mouse_sensitivity','1.0'
    ]},[offscreen,wasm.buffer,...Object.values(files).map(b=>b.buffer)]);
  await ready;
  if(resume==='hub'||resume==='xp-intro')await enterOutside({intro:resume==='xp-intro'});
 }catch(error){bootResolve=null;bootReject=null;if(worker)error.reload=true;throw error;}
}
start.addEventListener('click',()=>{if(CHECKPOINT)gamePause.heroNext();else startEngine(LEVEL.id).catch(e=>fail(e.message));});

function key(evType,code,keyValue,keyCode){
  if(FACTORY&&code==='Escape'){
    if(evType==='keydown'&&worker){factoryPaused=!factoryPaused;blockPanel('factory-pause',factoryPaused);pauseFactory(factoryPaused);}
    return;
  }
  if(code==='Escape'){if(evType==='keydown'&&worker&&(!uiBlocked||gamePause.isOpen()))gamePause.toggle();return;}
  if(!isGameControl(code)||uiBlocked)return;
  if(code==='F5'&&CHECKPOINT){if(evType==='keydown'&&worker)enterLevel(LEVEL.id,false,true);return;}
  if(outside){outside.key(code,evType==='keydown');return;}
  if(outsideLoading)return;
  const init={code,key:keyValue,keyCode,which:keyCode,charCode:0,bubbles:true,cancelable:true};
  if(evType==='keydown')held.set(code,init);else held.delete(code);
  syncAttackHeld();
  send({type:'input',target:'window',evType,init});
}
// Doom's rampage face watches the fire input itself (Ctrl, the touch Swing/Shoot
// button or mouse1), since the wrench and gun fire only once per press.
function syncAttackHeld(){const down=held.has('ControlLeft')||held.has('ControlRight')||mouseAttack;checkpointStatusBar()?.setAttackHeld(down);
  // The slingshot draws back while attack is held and fires on release.
  const sling=document.getElementById('held-gun');if(sling)sling.src=down&&!prologue.active?'slingshot-drawn.png':'slingshot.png';}
function releaseKeys(){outside?.release();for(const [code,init]of held){send({type:'input',target:'window',evType:'keyup',init});held.delete(code);}mouseAttack=false;syncAttackHeld();if(worker&&!outside)for(const button of [0,1,2])send({type:'input',target:'canvas',evType:'mouseup',init:{clientX:0,clientY:0,button,buttons:0,bubbles:true,cancelable:true}});}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('#stage').requestFullscreen();}catch{}}
// The key/keyCode SDL expects for an engine-bound code, whatever physical key was remapped to it.
function keyFields(code,e){return code==='Space'?[' ',32]:/^Control/.test(code)?['Control',17]:/^Shift/.test(code)?['Shift',16]:code.startsWith('Key')?[code.slice(3).toLowerCase(),code.charCodeAt(3)]:code.startsWith('Digit')?[code.slice(5),code.charCodeAt(5)]:[e?.key,e?.keyCode];}
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||gamePause.isVisible())return;
  if(e.code==='Escape'){if(worker&&!e.repeat){e.preventDefault();key('keydown',e.code,e.key,e.keyCode);}return;}
  if(uiBlocked)return;
  // Ctrl is Doom's fire key: let it, and game keys pressed while it is held,
  // through. Other Ctrl shortcuts stay with the browser.
  if(!worker||e.metaKey||e.altKey||e.ctrlKey&&!/^Control/.test(e.code)&&!isGameControl(preferences.map(e.code)||''))return;
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat)fullscreen();return;}
  const mapped=preferences.map(e.code);if(!mapped||!(isGameControl(mapped)||prologue.active&&['Digit4','Digit5'].includes(mapped))){e.preventDefault();return;}
  if(e.repeat)return;key('keydown',mapped,...keyFields(mapped,e));if(!/^F\d+$/.test(e.code))e.preventDefault();
});
window.addEventListener('keyup',e=>{if(worker){const mapped=preferences.map(e.code);if(mapped)key('keyup',mapped,...keyFields(mapped,e));e.preventDefault();}});
window.addEventListener('blur',()=>{audio.pauseMusic();releaseKeys();for(const button of [0,1,2])mouse('mouseup',{clientX:0,clientY:0,button,buttons:0});send({type:'input',target:'window',evType:'blur',init:{}});});
window.addEventListener('focus',()=>{if(state.mode==='playing'&&!uiBlocked)audio.startMusic();send({type:'input',target:'window',evType:'focus',init:{}});if(uiBlocked)send({type:'visibility',state:'hidden'});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden||uiBlocked){audio.pauseMusic();releaseKeys();}else if(state.mode==='playing')audio.startMusic();checkpointStatusBar()?.setPaused(document.hidden||uiBlocked);send({type:'visibility',state:uiBlocked?'hidden':document.visibilityState});});
document.addEventListener('pointerlockchange',()=>send({type:'pointerlock',locked:document.pointerLockElement===canvas}));
canvas.addEventListener('click',async()=>{if(worker&&!matchMedia('(pointer:coarse)').matches){try{await canvas.requestPointerLock();}catch{}audio.unlock();}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function mouse(type,e){
  if(type==='mouseup'&&!(e.button|0)&&mouseAttack){mouseAttack=false;syncAttackHeld();}
  if(uiBlocked||!worker||outsideLoading||outside)return;const r=canvas.getBoundingClientRect();
  if(type==='mousedown'&&!(e.button|0)){mouseAttack=true;syncAttackHeld();}
  send({type:'input',target:'canvas',evType:type,init:{clientX:(e.clientX-r.left)*960/r.width,clientY:(e.clientY-r.top)*600/r.height,movementX:(e.movementX||0)*preferences.data.sensitivity,movementY:(e.movementY||0)*preferences.data.sensitivity,button:e.button||0,buttons:e.buttons||0,bubbles:true,cancelable:true}});
}
for(const type of ['mousedown','mousemove'])canvas.addEventListener(type,e=>{
  // An unlocked mouse drag is look input; it must not spend a bullet.
  if(type==='mousedown'&&document.pointerLockElement!==canvas)return;
  if(type!=='mousemove'||!touchLook)mouse(type,e);
});
window.addEventListener('mouseup',e=>mouse('mouseup',e));
let touchLook=null;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||document.pointerLockElement!==canvas){canvas.setPointerCapture(e.pointerId);touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};send({type:'pointerlock',locked:true});}});
canvas.addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId){mouse('mousemove',{clientX:e.clientX,clientY:e.clientY,movementX:e.clientX-touchLook.x,movementY:e.clientY-touchLook.y});touchLook.x=e.clientX;touchLook.y=e.clientY;}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(touchLook?.id===e.pointerId){touchLook=null;send({type:'pointerlock',locked:document.pointerLockElement===canvas});}});
for(const button of document.querySelectorAll('[data-code]')){
  const code=button.dataset.code,[k,kc]=keyFields(code);
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);key('keydown',code,k,kc);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>key('keyup',code,k,kc));
}
document.querySelector('#touch-menu').addEventListener('click',()=>{key('keydown','Escape','Escape',27);setTimeout(()=>key('keyup','Escape','Escape',27),80);});
document.querySelector('#restart').addEventListener('click',()=>{if(worker)enterLevel(LEVEL.id,false,true);else ceoPick?ceoPick.restart():location.reload();});
document.querySelector('#finish').addEventListener('click',()=>{key('keydown','KeyR','r',82);setTimeout(()=>key('keyup','KeyR','r',82),80);});

// Each facility has its own Doom track: E1M4's for the Control Problem, E1M7's for the
// Computer Station (2026-10-13). A level start reloads only when the track differs.
function levelMusic(id){return id==='hal-station'?'local/station-music.ogg':id==='meg3n-factory'?'local/factory-music.ogg':'local/rescue-music.ogg';}
function playLevelMusic(){
 const url=levelMusic(LEVEL?.id);if(audio.musicUrl===url&&audio.musicBuffer)return;
 audio.pauseMusic();audio.musicOffset=0;audio.musicBuffer=null;audio.musicUrl=null;
 audio.prepareMusic(url).then(()=>{if(state.mode==='playing'&&!uiBlocked&&!outside)audio.startMusic();}).catch(error=>console.warn(error.message));
}
// The ?level=meg3n-factory page (cold start, ?puzzle= flags) has its own meadow after the exit:
// CONTROL.EXE and HAL3000.SYS there lead to the campaign page, resuming its SAFE MODE save.
function pageFor(id){
 const u=new URL(location.pathname,location.href);u.searchParams.set('level',id);
 const save=readCampaign(ceoStorage);
 if(id!=='meg3n-factory'&&save?.hub){u.searchParams.set('ceo',save.ceo);u.searchParams.set('play','1');u.searchParams.set('load','1');}
 return u.href;
}
async function enterLevel(id,replay=false,restart=false){
 if(!CHECKPOINT){if(FACTORY&&outside&&id!=='meg3n-factory')location.assign(pageFor(id));else location.reload();return;}
 if(!worker||(!restart&&!getLevel(id)))return;
 openingCheckpointPending=!restart&&id==='five-prisons'&&outside?.getState().intro===true;
 if(!restart&&!outside?.getState().intro){blockPanel('level-transition',true);try{await gamePause.levelFilm(id);}finally{blockPanel('level-transition',false);}}
 const pausedTic=nativePanelPaused?state.world?.ticks:null;
 resumeHub=false;gamePause.close();if(nativePanelPaused){nativePanelKey(false);nativePanelPaused=false;}personLabel.hide();storyBeats.reset();scoreView.reset();releaseKeys();if(document.pointerLockElement)document.exitPointerLock();
 if(hub)hub.setActive(false);outside=null;outsideLoading=false;pendingWin=0;nativePanelPaused=false;meadowPanelPaused=false;
 LEVEL=getLevel(id)||LEVEL;run.level=LEVEL;scoreView.setLevel(LEVEL);
 // MEG3N.AVI's door (2026-10-20): the factory, walked into from SAFE MODE, with its own HUD.
 useFactoryHud(LEVEL.id==='meg3n-factory');factoryExiting=false;state.factory=null;audio.holdMusic(false);
 awaitingRun=true;state.mode='loading';state.escape=null;state.dialogue=null;state.polish=null;state.lives=null;state.hal=null;state.doors=null;state.evaluationSign=null;state.world=null;
 gamePause.loading('ENTERING THE FACILITY');blockPanel('onboarding',true);clearTimeout(timeout);timeout=setTimeout(()=>fail('The facility did not finish loading. Reload to try again.'),45000);
 canvas.hidden=false;document.querySelector('#stage').classList.remove('outside');checkpointStatusBar()?.setPaused(false);
 document.querySelector('#result').hidden=true;document.querySelector('#reticle').hidden=false;
 for(const button of document.querySelectorAll('.action-pad button'))button.hidden=false;
 document.querySelector('[data-code="KeyQ"]').hidden=true;
 // Native menu closure is deferred by GZDoom. Wait for resumed ticks before
 // sending a map command, so that command cannot be swallowed by the old menu.
 if(pausedTic!=null){try{await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>{nativeResume=null;reject(Error('The paused facility could not resume. Reload to try again.'));},5000);nativeResume={after:pausedTic+14,resolve:()=>{clearTimeout(deadline);resolve();}};});}catch(error){fail(error.message);return;}}
 const code=restart?'F5':id==='meg3n-factory'?'F2':id==='hal-station'?(replay?'F9':'F7'):(replay?'F8':'F6'),kc={F2:113,F5:116,F6:117,F7:118,F8:119,F9:120}[code];
 for(const evType of ['keydown','keyup'])send({type:'input',target:'window',evType,init:{code,key:code,keyCode:kc,which:kc,bubbles:true,cancelable:true}});
 canvas.focus();
}

configureHalAnswers((code,value,kc)=>{key("keydown",code,value,kc);setTimeout(()=>key("keyup",code,value,kc),80);});
