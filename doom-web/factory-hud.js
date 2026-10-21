import {updateDoomDialogue} from './doom-dialogue.js';
import {checkpointStatusBar,ensureStatusBar} from './checkpoint-hud.js';
const el=id=>document.getElementById(id);

// ?puzzle= names for the loopback development flag (CVar pdoom_factory_site, Factory.zs).
export const FACTORY_SITES=['zvi','victoria','max','paul','ajeya','breakroom','exit','walkout'];
export function factorySite(value){
  const name=String(value||'').toLowerCase(),number=Number(name);
  return Number.isInteger(number)&&number>=1&&number<=FACTORY_SITES.length?number:FACTORY_SITES.indexOf(name)+1;
}

export function configureFactory(){
  el('scenario').textContent="MEG3N’s Toy Factory · Spawning Vats";
  el('start').textContent='Enter the toy factory';
  el('controls').innerHTML='WASD move · Mouse or arrows look · Shift run<br>Space / E interact · Click / Ctrl swing wrench';
  el('status').textContent='Local preview · Five rescues';
  for(const id of ['new-campaign','replay-intro','ceo-pick','tool-button'])el(id).hidden=true;
  el('tool-button').dataset.code='KeyT';el('tool-button').textContent='Tool';
  el('other-level').textContent='Back to The Control Problem';el('other-level').href='?level=five-prisons';
  el('attack-button').textContent='Swing';
  document.querySelector('[data-code="KeyQ"]').hidden=true;
  // No leaderboard score here, but levels 1-2's HUD (2026-10-20): the Doom status bar
  // (SCRN for her screens in place of CAMS) and the campaign's text layout.
  el('stage').classList.add('checkpoint','factory-prototype');
  ensureStatusBar('meg3n-factory').setLevel('meg3n-factory');
}

// In the campaign (2026-10-20) the factory is walked into from SAFE MODE: while it is the level
// loaded, the stage keeps the checkpoint HUD and marks the factory's extras (.factory-prototype).
export function useFactoryHud(on){
  el('stage').classList.toggle('factory-prototype',on);el('stage').classList.add('checkpoint');
  const bar=document.querySelector('#hud .doom-statusbar');if(bar)bar.hidden=false;
  if(on){document.querySelector('[data-code="KeyQ"]').hidden=true;checkpointStatusBar()?.setLevel('meg3n-factory');}
}

// One short objective line, like the campaign levels' line on the status bar.
const GUARD_ACTIONS=['BLOCKING','SALUTING','STEPPING ASIDE'];
function objective(world,factory){
  if(world.health<=0)return 'CAUGHT BY MEG3N';
  // The way out: MEG3N parks on the exit until the break-room TV broadcasts her dance.
  if(factory?.exit_done)return 'OUT OF THE FACTORY';
  if(factory?.all_safe)return factory.on_air?'MEG3N IS WATCHING HERSELF · FOLLOW THE ARROWS OUT':`${factory.camped?'EVERYONE':'ALL FIVE'} SAFE · MEG3N IS GUARDING THE EXIT`;
  // People already at camp from an earlier visit are not in here any more.
  const freed=world.freed||0,sheltered=world.sheltered||0,left=5-(world.people||[]).filter(p=>p.camped).length;
  // The first person freed leads the way to the break room, as in levels 1-2.
  const guide=factory&&factory.guide>=0&&!factory.introduced?world.people?.[factory.guide]?.name:null;
  const line=!freed?(left<5?`FIND THE OTHER ${left}`:'FIND THE FIVE'):guide?`Follow ${guide.split(' ')[0]} to the break room`:freed>sheltered?'Bring them back to the break room':`Freed ${freed}/${left}`;
  // At Paul's guard the line becomes its state: what it is doing now, your rating of
  // this action and how far it has learned (levels 1-2 keep running state on this line;
  // the centre status line says what just happened). Kept to one row.
  const near=factory&&!factory.trained&&!factory.sycophant&&!world.people?.[3]?.released&&Math.hypot(world.x-factory.guard_x,world.y-factory.guard_y)<640;
  if(near){
    const rating=factory.guard_rated>0?' · REWARDED':factory.guard_rated<0?' · PUNISHED':'';
    return `GUARD: ${GUARD_ACTIONS[factory.guard_action]||''}${rating} · TRAINED ${Math.min(3,factory.learned||0)}/3`;
  }
  // In Ajeya's yard the line says what the camera means for the dolls.
  if(factory&&!world.people?.[4]?.released&&Math.hypot(world.x-3296,world.y+384)<640){
    return factory.good_key?'GOT THE REAL KEY · OPEN THE CASE':factory.camera_broken?'CAMERA DOWN · WHICH DOLL KEEPS WORKING?':'CAMERA: WATCHING THE DOLLS';
  }
  const parts=[line];
  // Max's pause letter, once it has a signature and until the line stops.
  if(factory&&!factory.line_paused&&factory.signatures>0)parts.push(`PAUSE LETTER ${Math.min(3,factory.signatures)}/3`);
  return parts.join(' · ');
}

// The level's exit text (Doom's end-of-episode screen; spec 06 section 8.3, viral ending).
// exit-text.js types it out on a later exit of a playthrough; the first exit shows none.
const EXIT_TEXT='MEG3N watched your every move, right up until she found something better to watch: herself. Five more humans walk out into the meadow, blinking. Somewhere inside, a ring light flickers over a view counter that never stops climbing. Recommended for you: not going back.';
const EXIT_CEO={altman:"She called you inspiring. You've heard that before.",amodei:'She said she read your whole essay. Nobody reads the whole essay.'};
export function factoryExitText(ceo){return EXIT_TEXT+'\n\n'+(EXIT_CEO[ceo]||EXIT_CEO.altman);}

// The Doom status bar's view of the factory (doom-statusbar.js, as levels 1-2): SCRN counts
// her smashed screens where they count cameras. People already at camp from an earlier visit
// count as freed and safe; the face flinches toward MEG3N when she hugs you.
function barWorld(world,factory){
  const people=(world.people||[]).map(p=>({...p,released:!!(p.released||p.camped),sheltered:!!(p.sheltered||p.camped),discovered:!!(p.released||p.camped)}));
  return {...world,people,freed:people.filter(p=>p.released).length,sheltered:people.filter(p=>p.sheltered).length,alive:world.health>0?6:5,
    cameras_total:world.screens_total||0,cameras_broken:world.screens||0,hunter_x:factory?.guardian_x,hunter_y:factory?.guardian_y};
}

export function updateFactory(world,factory,dialogue){
  if(!world)return;
  const ended=world.health<=0;
  el('hud').hidden=false;el('reticle').hidden=ended;
  el('people').textContent=objective(world,factory);
  const bar=barWorld(world,factory),total=bar.cameras_total,broken=Math.min(total,bar.cameras_broken);
  checkpointStatusBar()?.setLevel('meg3n-factory');
  checkpointStatusBar()?.update(bar,ended?'lost':'playing',{saved:factory?.exit_done?1:0});
  // The bar's text twins: read by screen readers and tests, shown if the bar art is missing.
  el('health').hidden=false;el('health').textContent=`${Math.max(0,world.health)}%`;
  el('camera-tally').hidden=false;el('camera-tally').textContent=`SCREENS ${broken}/${total}`;
  el('camera-tally').setAttribute('aria-label',`${broken} of ${total} MEG3N screens smashed`);
  el('camera-tally').classList.toggle('all-destroyed',total>0&&broken===total);
  el('group').textContent=`${bar.freed}/5 freed · ${bar.sheltered} sheltered`;
  el('prompt').textContent=ended?'':world.prompt||'';el('prompt').hidden=!el('prompt').textContent;
  // Status line (world feedback) and the speaker box (character lines), shared with levels 1-2.
  updateDoomDialogue(world,dialogue,ended);
  // Wrench or slingshot, as in levels 1-2 (T swaps; the slingshot draws while fire is held).
  const sling=world.tool===1&&!!world.gun;
  el('held-wrench').hidden=!world.wrench||ended||sling;
  el('held-gun').hidden=ended||!sling;
  el('held-gun').classList.toggle('firing',!!world.attacking);
  el('tool-button').hidden=!(world.gun&&world.wrench);
  el('attack-button').textContent=sling?'Sling':'Swing';
  const wrench=el('held-wrench');
  if(wrench.dataset.swings!==String(world.wrench_swings||0)){
    wrench.dataset.swings=String(world.wrench_swings||0);wrench.classList.remove('swinging');void wrench.offsetWidth;wrench.classList.add('swinging');
  }
  el('finish').hidden=true;
}

export function pauseFactory(paused){
  el('result').hidden=!paused;
  el('result').textContent='Paused · Esc resumes';
}
