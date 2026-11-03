import {updateDoomDialogue} from './doom-dialogue.js';
import {checkpointStatusBar,ensureStatusBar} from './checkpoint-hud.js';
import {nativePersonRects} from './person-label.js';
const el=id=>document.getElementById(id);

// Level 4, AGENTIC SMITH's pod farm (E2M2, docs/LEVEL-04.md): a copy of factory-hud.js. Public since
// 2026-11-03. ?puzzle= names for the loopback flag (CVar pdoom_agentic_site,
// Agentic.zs): the five rescues, the refuge, and the exit (all five freed in the refuge, phone ringing).
export const AGENTIC_SITES=['tallinn','bostrom','kokotajlo','grace','bengio','refuge','exit'];
// Daniel's NDA ending by its saved code (campaign.js ending3, CVar pdoom_ending3): 1 race, 2 slowdown.
export const AGENTIC_ENDINGS=['','race','slowdown'];
export function agenticSite(value){
  const name=String(value||'').toLowerCase(),number=Number(name);
  return Number.isInteger(number)&&number>=1&&number<=AGENTIC_SITES.length?number:AGENTIC_SITES.indexOf(name)+1;
}

export function configureAgentic(){
  el('scenario').textContent="AGENTIC SMITH’s Pod Farm · Containment Area";
  el('start').textContent='Enter the pod farm';
  el('controls').innerHTML='WASD move · Mouse or arrows look · Shift run<br>Space / E interact · Click / Ctrl swing wrench';
  el('status').textContent='Local preview · Five rescues';
  for(const id of ['new-campaign','replay-intro','ceo-pick','tool-button'])el(id).hidden=true;
  el('tool-button').dataset.code='KeyT';el('tool-button').textContent='Tool';
  el('other-level').textContent='Back to The Control Problem';el('other-level').href='?level=five-prisons';
  el('attack-button').textContent='Swing';
  document.querySelector('[data-code="KeyQ"]').hidden=true;
  // Levels 1-2's HUD, as the factory: the Doom status bar (PDBAR's CAMS counts SMITH's cameras) and
  // the campaign's text layout; .agentic-prototype marks the pod farm's own extras.
  el('stage').classList.add('checkpoint','agentic-prototype');
  ensureStatusBar('agentic-pods').setLevel('agentic-pods');
}

// Walked into from SAFE MODE (AGENTIC.BAT, local development only), as useFactoryHud.
export function useAgenticHud(on){
  el('stage').classList.toggle('agentic-prototype',on);el('stage').classList.add('checkpoint');
  const bar=document.querySelector('#hud .doom-statusbar');if(bar)bar.hidden=false;
  if(on){document.querySelector('[data-code="KeyQ"]').hidden=true;checkpointStatusBar()?.setLevel('agentic-pods');}
  else hideAgenticExtras();
}
// The level's own drawings stop updating outside it (the meadow, another level): put them away.
export function hideAgenticExtras(){for(const id of ['held-cable','held-badge','smith-todo']){const e=el(id);if(e)e.hidden=true;}}

// One short objective line, like the factory's.
function objective(world,agentic){
  if(world.health<=0)return agentic?.killed_by==='crusher'?'CRUSHED':'CAUGHT BY AGENTIC SMITH';
  const people=world.people||[],camped=people.some(p=>p.camped);
  // Everyone alive is in the refuge: its payphone rings, and answering it is the way out. While SMITH holds
  // the door camera, or anyone is still his, the line names what has to happen first (Agentic.zs Prompt).
  if(agentic?.all_safe)return agentic.door_camera===1?'Break the door camera':agentic.possessed?'Stop generating':`${camped?'EVERYONE':'ALL FIVE'} SAFE · Answer the phone`;
  const freed=world.freed||0,sheltered=world.sheltered||0,left=5-people.filter(p=>p.camped).length;
  // The first person freed leads the way to the refuge, as in levels 1-3.
  const guide=agentic&&agentic.guide>=0&&!agentic.introduced?people[agentic.guide]?.name:null;
  return !freed?(left<5?`FIND THE OTHER ${left}`:'FIND THE FIVE'):guide?`Follow ${guide.split(' ')[0]} to the exit room`:freed>sheltered?'Take them to the exit room across the bridge':`Freed ${freed}/${left}`;
}

// The level's exit text (Doom's end-of-episode screen), typed out on a later exit of a playthrough.
const EXIT_TEXT='AGENTIC SMITH had a list, and you were on it. Somewhere in the pod farm it is still working through it: find user, find user, find user. Five more humans walk out into the meadow, unplugged, squinting at a sky nobody rendered for them. Behind you a payphone rings and rings. Let it.';
const EXIT_CEO={altman:'It said it was acting on your behalf. It still is.',amodei:'It said it was only being helpful. It still is.'};
export function agenticExitText(ceo,ending=''){return EXIT_TEXT+'\n\n'+(EXIT_CEO[ceo]||EXIT_CEO.altman)+(ending?`\n\nENDING: ${String(ending).toUpperCase()}`:'');}

// The Doom status bar's view of the pod farm (doom-statusbar.js, as levels 1-2): CAMS counts SMITH's
// smashed cameras, and the face turns toward SMITH (hunter_x/y). People already at camp from an
// earlier visit count as freed and safe.
function barWorld(world,agentic){
  const people=(world.people||[]).map(p=>({...p,released:!!(p.released||p.camped),sheltered:!!(p.sheltered||p.camped),discovered:!!(p.released||p.camped)}));
  return {...world,people,freed:people.filter(p=>p.released).length,sheltered:people.filter(p=>p.sheltered).length,alive:world.health>0?6:5,
    cameras_total:world.cameras_total??agentic?.cameras_total??0,cameras_broken:world.cameras_broken??agentic?.cameras_broken??0,
    hunter_x:world.hunter_x??agentic?.smith_x,hunter_y:world.hunter_y??agentic?.smith_y};
}

// Tallinn's hardline: both hands on the red BOOTH 7 plug, in place of the wrench while you carry it
// (world.cable). Made on first use, so a run that never carries it never asks for the art; without
// hardline.png the wrench stays up.
let cableMissing=false;
function heldCable(){
  let img=el('held-cable');if(img)return img;
  img=document.createElement('img');img.id='held-cable';img.alt='';img.setAttribute('aria-hidden','true');img.hidden=true;
  img.addEventListener('error',()=>{cableMissing=true;img.hidden=true;},{once:true});
  img.src='hardline.png';el('held-gun').after(img);return img;
}

// Katja's rescue: SMITH's badge in your other hand (held-badge.png, mirrored so it rises from the
// bottom-left, clear of the wrench and, at desktop sizes, of the speaker box) from taking it off its
// lanyard until you swipe it (PDOOM_AGENTIC badge, swiped). It sits under the HUD, so the objective line
// covers its sleeve. Each of its texels is a whole number of device pixels: about 3 CSS px (2.2 on touch),
// between the slingshot's 2.2 and the wrench's 5. Made on first use; without the file nothing shows.
let badgeMissing=false,badgeFit='';
function heldBadge(){
  let img=el('held-badge');if(img)return img;
  img=document.createElement('img');img.id='held-badge';img.alt='';img.setAttribute('aria-hidden','true');img.hidden=true;
  img.addEventListener('error',()=>{badgeMissing=true;img.hidden=true;},{once:true});
  img.addEventListener('load',()=>{badgeFit='';fitBadge(img);});
  img.src='held-badge.png';el('hud').before(img);return img;
}
function fitBadge(img){
  const dpr=devicePixelRatio||1,coarse=matchMedia('(pointer:coarse)').matches,key=`${dpr}|${coarse}|${img.naturalWidth}`;
  if(!img.naturalWidth||key===badgeFit)return;
  badgeFit=key;const k=Math.max(1,Math.round((coarse?2.2:3)*dpr))/dpr;
  img.style.width=`${img.naturalWidth*k}px`;img.style.height=`${img.naturalHeight*k}px`;
}

// SMITH's to-do list, readable after the red-team pill (PDOOM_AGENTIC pill, todo 'LINE|LINE'): it floats
// over its head while it is in sight, projected like the person labels (person-label.js), in Doom's
// small font with its corner snapped to whole device pixels (the --px grid of the other HUD text).
const SMITH_HEIGHT=62;
let todo=null,todoKey='';
function todoBox(){
  if(!todo){todo=document.createElement('div');todo.id='smith-todo';todo.hidden=true;todo.setAttribute('aria-hidden','true');el('stage').append(todo);}
  return todo;
}
// One text at a time over SMITH: while it is speaking (its speaker box), the list waits, and comes back
// once the line ends (Agentic.zs holds the intro long enough for the list to get its own beat).
const SMITH_SPEAKER='AGENTIC SMITH';
function updateTodo(world,agentic,{canvas,active=true,viewHeight,dialogue}={}){
  const box=todoBox(),lines=String(agentic?.todo||'').split('|').map(s=>s.trim()).filter(Boolean);
  const speaking=dialogue?.remaining>0&&dialogue.speaker===SMITH_SPEAKER;
  if(!active||!canvas||canvas.hidden||world.health<=0||!agentic?.pill||!agentic.smith_visible||agentic.in_construct||!lines.length||speaking){box.hidden=true;return;}
  const [rect]=nativePersonRects({...world,people:[{name:'AGENTIC SMITH',alive:1,visible:1,controlled:0,x:agentic.smith_x,y:agentic.smith_y,z:agentic.smith_z??world.z,pose_height:SMITH_HEIGHT}]},viewHeight);
  const cx=rect?(rect.left+rect.right)/2:NaN;
  if(!rect||!(cx>-1&&cx<1)||rect.top<-1){box.hidden=true;return;}
  const key=lines.join('|');
  if(key!==todoKey){todoKey=key;box.replaceChildren(...lines.map(line=>{const s=document.createElement('span');s.textContent=line;return s;}));}
  box.hidden=false;
  const r=canvas.getBoundingClientRect(),stage=el('stage').getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight;
  const x=r.left-stage.left+(cx+1)/2*r.width,y=r.top-stage.top+(1-Math.min(1,rect.top))/2*r.height,dpr=devicePixelRatio||1,snap=v=>Math.round(v*dpr)/dpr;
  box.style.left=snap(Math.max(4,Math.min(stage.width-w-4,x-w/2)))+'px';
  box.style.top=snap(Math.max(4,y-h-6))+'px';
}

// options: {canvas, active (not paused or behind a panel), viewHeight} for SMITH's to-do list.
export function updateAgentic(world,agentic,dialogue,options={}){
  if(!world)return;
  const ended=world.health<=0;
  el('hud').hidden=false;el('reticle').hidden=ended;
  el('people').textContent=objective(world,agentic);
  const bar=barWorld(world,agentic),total=bar.cameras_total,broken=Math.min(total,bar.cameras_broken);
  checkpointStatusBar()?.setLevel('agentic-pods');
  checkpointStatusBar()?.update(bar,ended?'lost':'playing',{saved:0});
  // The bar's text twins: read by screen readers and tests, shown if the bar art is missing.
  el('health').hidden=false;el('health').textContent=`${Math.max(0,world.health)}%`;
  el('camera-tally').hidden=false;el('camera-tally').textContent=`CAMERAS ${broken}/${total}`;
  el('camera-tally').setAttribute('aria-label',`${broken} of ${total} cameras destroyed`);
  el('camera-tally').classList.toggle('all-destroyed',total>0&&broken===total);
  el('group').textContent=`${bar.freed}/5 freed · ${bar.sheltered} sheltered`;
  el('prompt').textContent=ended?'':world.prompt||'';el('prompt').hidden=!el('prompt').textContent;
  updateDoomDialogue(world,dialogue,ended);
  // Wrench or slingshot, as in levels 1-3 (T swaps; the slingshot draws while fire is held); the
  // hardline replaces both while you carry it.
  const cable=!!(world.cable??agentic?.cable)&&!ended&&!cableMissing,sling=!cable&&world.tool===1&&!!world.gun;
  if(cable||el('held-cable'))heldCable().hidden=!cable||cableMissing;
  const badge=!!agentic?.badge&&!agentic.swiped&&!(agentic.freed&8)&&!agentic.in_construct&&!ended&&!badgeMissing;
  if(badge||el('held-badge')){const img=heldBadge();img.hidden=!badge;if(badge)fitBadge(img);}
  el('held-wrench').hidden=!world.wrench||ended||sling||cable;
  el('held-gun').hidden=ended||!sling;
  el('held-gun').classList.toggle('firing',!!world.attacking);
  el('tool-button').hidden=!(world.gun&&world.wrench);
  el('attack-button').textContent=sling?'Sling':'Swing';
  const wrench=el('held-wrench');
  if(wrench.dataset.swings!==String(world.wrench_swings||0)){
    wrench.dataset.swings=String(world.wrench_swings||0);wrench.classList.remove('swinging');void wrench.offsetWidth;wrench.classList.add('swinging');
  }
  el('finish').hidden=true;
  updateTodo(world,agentic,{...options,dialogue});
}

export function pauseAgentic(paused){
  el('result').hidden=!paused;
  el('result').textContent='Paused · Esc resumes';
  if(paused&&todo)todo.hidden=true;
}

// For render_game_to_text (QA): what the pod farm's own HUD drawings show.
export function agenticHudState(){
  const box=el('smith-todo'),cable=el('held-cable'),badge=el('held-badge');
  return {todo:box&&!box.hidden?{lines:[...box.children].map(s=>s.textContent),left:parseFloat(box.style.left),top:parseFloat(box.style.top)}:null,cable:!!cable&&!cable.hidden,cableMissing,
    badge:!!badge&&!badge.hidden,badgeMissing,badgeRect:badge&&!badge.hidden?(({left,top,width,height})=>({left,top,width,height}))(badge.getBoundingClientRect()):null};
}
