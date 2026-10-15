import {updateSurvivalHud} from './survival-estimate.js';
import {updateDoomDialogue} from './doom-dialogue.js';
import {createStatusBar} from './doom-statusbar.js';
import {renderHowToPlay} from './how-to-play.js';
const el=id=>document.getElementById(id);
let statusBar=null;
// The Doom status bar canvas; the DOM text beside it stays for screen readers/tests.
export function checkpointStatusBar(){return statusBar;}

// ceo: the launcher's CEO choice, whose face your own body wears in the status bar.
export function configureCheckpointLauncher(checkpoint,level,ceo){
  el('stage').classList.toggle('checkpoint',checkpoint);
  if(checkpoint&&!statusBar)statusBar=createStatusBar(document.querySelector('#hud .doom-statusbar'),{ceo,level:level?.id});
  el('ceo-pick').hidden=!checkpoint;
  el('replay-intro').hidden=!checkpoint;
  el('scenario').textContent=checkpoint?`${level?.title||'Five Prisons'}${level?.subtitle?' · '+level.subtitle:''}`:'Intake';
  el('start').textContent=checkpoint?'Enter the facility':'Enter Intake';
  el('status').textContent=checkpoint?'Explore the facility. Find the others.':'Get six people out.';
  el('controls').classList.toggle('controls',!checkpoint);
  if(checkpoint)renderHowToPlay(el('controls'));
  else el('controls').innerHTML='WASD move · Click or drag to look · Shift run<br>Space interact · Click / Ctrl shoot<br>Q follow / hold · G give gun<br>Arrows turn · Esc menu · F fullscreen';
  el('other-level').textContent=checkpoint?'Play the previous Intake test':'Play Five Prisons';
  el('other-level').href=checkpoint?'?level=intake':'?level=rescue';
  // Low ducts crouch you automatically; the touch Crouch button stays hidden.
  el('crouch-button').hidden=true;
  const tool=el('tool-button');tool.dataset.code=checkpoint?'KeyT':'KeyG';
  tool.textContent=checkpoint?'Tool':'Give';
  el('attack-button').textContent=checkpoint?'Swing':'Shoot';
  document.querySelector('[data-code="KeyQ"]').hidden=checkpoint;
}

export function updateCheckpointHud(world,mode,escape,dialogue,sign,hal=null){
  if(!world)return;
  const ended=mode==='lost';
  // Like Doom, the bar stays up after the last body falls, showing the dead face.
  el('hud').hidden=false;el('people').hidden=ended;el('reticle').hidden=ended;
  const people=world.people||[];
  el('health').hidden=false;
  el('health').textContent=`${Math.max(0,world.health)}%`;
  statusBar?.setLevel(world.map==='E1M7'?'hal-station':'five-prisons');
  statusBar?.update(world,mode,escape);
  el('people').textContent=escape?.opened?'Follow the service passage':hal?.evacuating?'Get everyone to the EXIT past the pod bay':world.group_gathered?'Survivors gathered':!world.refuge_known&&world.freed?(world.guide?`Follow ${people[world.guide-1]?.name||'your guide'} to the Faraday Room`:'Find the refuge off the east hall'):world.freed?`Freed ${world.freed}/5`:people.some(p=>p.discovered)?'Someone is here':'FIND THE FIVE';
  el('group').textContent=`${world.freed||0}/5 freed · ${world.sheltered||0} sheltered · ${world.alive} alive`;
  updateSurvivalHud(world,mode,escape);
  const gear=[];
  if(world.tool===1&&world.gun)gear.push(`Gun · ${world.ammo} shots`);
  else if(world.wrench)gear.push('Wrench');
  else gear.push('Empty hands');
  if(world.key)gear.push('Maintenance key');
  if(world.charge)gear.push('Charge');
  el('equipment').textContent=gear.join(' · ');
  const cameras=Math.max(0,world.cameras_total||0),destroyed=Math.min(cameras,Math.max(0,world.cameras_broken||0));
  el('camera-tally').hidden=false;
  el('camera-tally').textContent=`CAMERAS ${destroyed}/${cameras}`;
  el('camera-tally').setAttribute('aria-label',`${destroyed} of ${cameras} cameras destroyed`);
  el('camera-tally').classList.toggle('all-destroyed',cameras>0&&destroyed===cameras);
  el('attack-button').textContent=world.tool===1?'Sling':'Swing';
  el('tool-button').hidden=!world.gun;
  document.querySelector('[data-code="KeyQ"]').hidden=true;
  el('prompt').textContent=ended?'':world.prompt||'';el('prompt').hidden=!el('prompt').textContent;
  updateDoomDialogue(world,dialogue,ended);
  el('finish').hidden=true;
  el('held-wrench').hidden=ended||!!sign?.carried||!world.wrench||world.tool===1;
  const wrench=el('held-wrench');
  if(wrench.dataset.swings!==String(world.wrench_swings||0)){
    wrench.dataset.swings=String(world.wrench_swings||0);wrench.classList.remove('swinging');void wrench.offsetWidth;wrench.classList.add('swinging');
  }
  el('held-wrench').classList.toggle('working',!!escape?.work_tics);
  el('held-gun').hidden=ended||!!sign?.carried||world.tool!==1||!world.gun;
  el('held-gun').classList.toggle('firing',!!world.attacking);
}

export function showCheckpointResult(){
  el('result').textContent='Nobody remains free. Restart to try another approach.';
  el('result').hidden=false;
  for(const id of ['people','reticle','prompt','message','held-wrench','held-gun','finish'])el(id).hidden=true;
}
