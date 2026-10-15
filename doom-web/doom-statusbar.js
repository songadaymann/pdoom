import {castForLevel} from './cast-art.js';
import {ceoFaceId} from './ceo-pick.js';
// The original Doom status bar (st_stuff.c / st_lib.c), drawn from the patches
// that scripts/build-doom-statusbar.py extracts from the local DOOM.WAD into
// local/ui/stbar/, carrying p(DOOM) data instead of ammo and armor:
//   AMMO     gun rounds while the gun is in hand, blank with the wrench (fist)
//   HEALTH   the controlled body's health
//   FREED    prisoners 1-5 in the arms grid: yellow freed, grey captive, red lost;
//            the sixth cell marks the refuge once known (yellow while you are inside)
//   face     the mugshot of whoever you control, with Doom's face logic: your own
//            body wears the chosen CEO's face (altman/amodei; doomguy for QA)
//   P(DOOM)  the in-world p(DOOM) (100 - survival estimate); pulses hot at >= 90
//   keys     wrench (steel, skull-key cell) / maintenance key (STKEYS1) / charge
//   table    CAMS, FREE, SAFE and LIVE tallies in the small cur/max digits
// 320x32 logical pixels; CSS scales the canvas with nearest-neighbour filtering.
import {survivalEstimate} from './survival-estimate.js';

export const TICRATE=35;
const BASE='local/ui/stbar/';
export const FACE_SETS=['doomguy',...castForLevel('five-prisons')];// PDOOM_STATE "controlled" (Doomguy as body 0)
export const CEO_FACE_SETS=['altman','amodei'];
// Face set per PDOOM_STATE "controlled": 0 is your own body (the chosen CEO, or
// Doomguy for QA), 1-5 the companions in CheckpointMap site order.
export function bodyFaceSets(ceo,level='five-prisons'){return [CEO_FACE_SETS.includes(ceo)?ceoFaceId(ceo):'doomguy',...castForLevel(level)];}

// st_stuff.c widget positions with ST_Y (168) subtracted.
const ST={ammo:[44,3],health:[90,3],armsBg:[104,0],arms:[111,4],armsSpace:[12,10],face:[143,0],armor:[221,3],
  keys:[239,[3,13,23]],tallyCur:288,tallyMax:314,tallyY:[5,11,17,23]};

// Mugshot constants (st_stuff.c).
const NUMPAINFACES=5,FACESTRIDE=8,TURNOFFSET=3,OUCHOFFSET=5,EVILGRINOFFSET=6,RAMPAGEOFFSET=7;
const GODFACE=NUMPAINFACES*FACESTRIDE,DEADFACE=GODFACE+1;
const EVILGRINCOUNT=2*TICRATE,STRAIGHTFACECOUNT=Math.floor(TICRATE/2),TURNCOUNT=TICRATE,RAMPAGEDELAY=2*TICRATE,MUCHPAIN=20;
export const FACE_LUMPS=[];
for(let i=0;i<NUMPAINFACES;i++)FACE_LUMPS.push(`STFST${i}0`,`STFST${i}1`,`STFST${i}2`,`STFTR${i}0`,`STFTL${i}0`,`STFOUCH${i}`,`STFEVL${i}`,`STFKILL${i}`);
FACE_LUMPS.push('STFGOD0','STFDEAD0');

const DEATH_HOLD=Math.round(1.5*TICRATE);// a lost body's dead face before control moves on
const BONUSADD=6;                         // Doom's pickup flash: how long a grin may wait
const CAMERA_WAIT=TURNCOUNT;              // a camera rampage may wait out a grin this long
const ATTACK_MEMORY=24;                   // tics an observed swing/shot counts as "fire held"
const CLOCK_LEAD=10;                      // local face clock may run this far past the engine
const ALARM=90;                           // p(DOOM) at or above this flashes hot

const angleTo=(from,to)=>Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
// Signed difference in degrees, positive = counter-clockwise (to the player's left).
export const angleDiff=(target,facing)=>((target-facing)%360+540)%360-180;

// ST_updateFaceWidget, one call per 35 Hz tic. Input fields:
//   health, god, attackdown, attackerDiff (degrees to the attacker or null),
//   aimDiff (degrees to a hunter aiming at you, or null).
// Events: hit(amount, hasAttacker), grin(), camera(), die(holdTics).
export class FaceWidget{
  constructor(seed=0x9e3779b9){this.seed=seed>>>0||1;this.reset(100);}
  reset(health){
    this.priority=0;this.index=0;this.count=0;this.lastattackdown=-1;this.oldhealth=health;
    this.damagecount=0;this.attacker=false;this.pendingGrin=0;this.pendingCamera=0;this.deadHold=0;
    this.painHealth=-1;this.painCalc=0;
  }
  random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed&255;}// M_Random range
  painOffset(health){
    const h=Math.max(0,Math.min(100,health|0));
    if(h!==this.painHealth){this.painCalc=FACESTRIDE*Math.floor((100-h)*NUMPAINFACES/101);this.painHealth=h;}
    return this.painCalc;
  }
  hit(amount,attacker){this.damagecount=Math.min(100,this.damagecount+Math.max(0,amount|0));this.attacker=!!attacker;}
  grin(){this.pendingGrin=BONUSADD;}
  camera(){this.pendingCamera=CAMERA_WAIT;}
  die(hold){this.deadHold=Math.max(this.deadHold,hold);}
  tick(input){
    const random=this.random(),health=input.health,pain=()=>this.painOffset(health);
    // dead
    if(this.priority<10&&(health<=0||this.deadHold>0)){this.priority=9;this.index=DEADFACE;this.count=1;}
    // evil grin: picking up a weapon (here: a rescue or a new tool)
    if(this.priority<9&&this.pendingGrin){this.priority=8;this.count=EVILGRINCOUNT;this.index=pain()+EVILGRINOFFSET;this.pendingGrin=0;}
    // being attacked. The big-hit test is the intended one (vanilla's sign is
    // inverted so "ouch" never shows); like the community fix it holds at 8.
    if(this.priority<8&&this.damagecount&&this.attacker){
      if(this.oldhealth-health>MUCHPAIN){this.priority=8;this.count=TURNCOUNT;this.index=pain()+OUCHOFFSET;}
      else{
        this.priority=7;this.count=TURNCOUNT;const diff=input.attackerDiff;
        this.index=pain()+(diff==null||Math.abs(diff)<45?RAMPAGEOFFSET:diff<0?TURNOFFSET:TURNOFFSET+1);
      }
    }
    // p(DOOM) addition: look toward a hunter that is aiming at you from the side.
    if(this.priority<7&&input.aimDiff!=null&&Math.abs(input.aimDiff)>=45){
      this.priority=6.5;this.count=STRAIGHTFACECOUNT;this.index=pain()+(input.aimDiff<0?TURNOFFSET:TURNOFFSET+1);
    }
    // getting hurt without an attacker
    if(this.priority<7&&this.damagecount){
      if(this.oldhealth-health>MUCHPAIN){this.priority=8;this.count=TURNCOUNT;this.index=pain()+OUCHOFFSET;}
      else{this.priority=6;this.count=TURNCOUNT;this.index=pain()+RAMPAGEOFFSET;}
    }
    // p(DOOM) addition: a brief rampage face after a camera is destroyed.
    if(this.priority<6&&this.pendingCamera){this.priority=6;this.count=TURNCOUNT;this.index=pain()+RAMPAGEOFFSET;this.pendingCamera=0;}
    // rapid firing
    if(this.priority<6){
      if(input.attackdown){
        if(this.lastattackdown===-1)this.lastattackdown=RAMPAGEDELAY;
        else if(!--this.lastattackdown){this.priority=5;this.index=pain()+RAMPAGEOFFSET;this.count=1;this.lastattackdown=1;}
      }else this.lastattackdown=-1;
    }
    // invulnerability
    if(this.priority<5&&input.god){this.priority=4;this.index=GODFACE;this.count=1;}
    // look left / centre / right when the count runs out
    if(!this.count){this.index=pain()+random%3;this.count=STRAIGHTFACECOUNT;this.priority=0;}
    this.count--;
    this.oldhealth=health;
    if(this.damagecount>0)this.damagecount--;
    if(this.deadHold>0)this.deadHold--;
    if(this.pendingGrin>0)this.pendingGrin--;
    if(this.pendingCamera>0)this.pendingCamera--;
  }
  get lump(){return FACE_LUMPS[this.index]||FACE_LUMPS[1];}
}

function loadImage(src){
  return new Promise(resolve=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});
}

export function createStatusBar(container,options={}){
  const base=options.base||BASE;
  let canvas=container.querySelector('canvas.statusbar');
  if(!canvas){canvas=document.createElement('canvas');canvas.className='statusbar';container.prepend(canvas);}
  canvas.width=320;canvas.height=32;canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  const face=new FaceWidget(options.seed);
  const images=new Map(),meta=new Map(),faceSets=new Map();
  let manifest=null,ready=false,error=null,last=null,values=null,tic=null,engineTic=0,acc=0,lastNow=0,paused=false;
  let lastAttackTic=-1e9,attackHeld=false,aimDiff=null,deadSet=null,drawnKey='',frame=0,running=true,drawnFace=null,drawnHealth=null,drawnHot=false;
  const loadedSets=new Set(),bodies=bodyFaceSets(options.ceo,options.level);

  const setFor=controlled=>bodies[controlled|0]||bodies[0];
  async function loadLumps(names,path,table){
    let count=0;
    await Promise.all(names.map(async name=>{
      if(!table[name])return;
      const img=await loadImage(path+name+'.png');
      if(img){images.set(path+name,img);count++;}
    }));
    return count;
  }
  async function loadFaceSet(id){
    if(faceSets.has(id))return faceSets.get(id);
    const entry=manifest?.faces?.[id];
    const promise=entry?loadLumps(FACE_LUMPS,entry.path,entry.lumps).then(count=>{
      if(count===FACE_LUMPS.length)loadedSets.add(id);
      drawnKey='';// redraw: a face that fell back to Doomguy can now use its own set
      return entry;
    }):Promise.resolve(null);
    faceSets.set(id,promise);return promise;
  }
  (async()=>{
    try{
      const response=await fetch(base+'manifest.json',{cache:'no-store'});
      if(!response.ok)throw Error(`status bar manifest ${response.status}`);
      manifest=await response.json();
      for(const [name,m] of Object.entries(manifest.lumps))meta.set(name,m);
      const needed=['PDBAR','PDWBAR','STARMS','PDARMS','STTPRCNT','STTMINUS','PDHPRCNT','PDREFUG0','PDREFUG1','STKEYS1','PDWRENCH','PDCHARGE','PDARMG','PDARMB'];
      for(let i=0;i<10;i++)needed.push(`STTNUM${i}`,`PDHNUM${i}`,`STYSNUM${i}`,`STGNUM${i}`,`PDRSNUM${i}`);
      await loadLumps(needed,base,manifest.lumps);
      if(!images.has(base+'PDBAR'))throw Error('status bar patches missing');
      // Your own face first, and Doomguy's, the fallback for any missing set.
      await Promise.all([loadFaceSet(bodies[0]),loadFaceSet('doomguy')]);
      ready=true;container.classList.add('statusbar-ready');drawnKey='';
      // Warm the companions' faces so a body transfer never shows an empty box.
      for(const id of bodies)await loadFaceSet(id);
    }catch(e){error=String(e.message||e);container.classList.add('statusbar-unavailable');}
  })();

  function patchImage(name){return images.get(base+name);}
  function draw(name,x,y){
    const img=patchImage(name),m=meta.get(name);
    if(img&&m)ctx.drawImage(img,x-m.x,y-m.y);
  }
  // STlib_drawNum: right-aligned at x, digit width taken from the 0 patch.
  function drawNum(num,x,y,digits,prefix){
    const w=meta.get(prefix+'0')?.w||0;let neg=num<0;
    if(neg){if(digits===2&&num<-9)num=-9;else if(digits===3&&num<-99)num=-99;num=-num;}
    if(!num)draw(prefix+'0',x-w,y);
    while(num&&digits--){x-=w;draw(prefix+(num%10),x,y);num=Math.floor(num/10);}
    if(neg)draw('STTMINUS',x-8,y);
  }
  // The controlled body's own face set; Doomguy's (then the bar's own patches)
  // if that set is missing or not loaded yet.
  function faceImage(setId,lump){
    for(const id of [setId,'doomguy']){
      const entry=manifest?.faces?.[id];
      const img=entry&&images.get(entry.path+lump);
      if(img)return {img,m:entry.lumps[lump],set:id};
    }
    const img=patchImage(lump),m=meta.get(lump);
    return img&&m?{img,m,set:'doomguy'}:null;
  }
  // A dead face while the body you now control is alive belongs to the body just
  // lost (the hold, and the one tic after it before the idle face takes over).
  function currentFaceSet(){return deadSet&&(face.deadHold>0||face.lump==='STFDEAD0'&&!values?.dead)?deadSet:setFor(last?.controlled);}
  // Alarm: at p(DOOM) >= 90 the number pulses onto Doom's fire ramp about once a
  // second (steady hot digits when the viewer asks for reduced motion).
  const steady=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hot(){return !!values&&values.pdoom>=ALARM&&(steady||Math.floor((tic||0)/16)%2===0);}
  function render(){
    if(!ready||!values)return;
    const set=currentFaceSet(),lump=face.lump,flash=hot();
    // The dead face always shows a dead body: HEALTH reads 0% with it (also while
    // a lost body's dead face is held before the next person's face).
    const health=lump==='STFDEAD0'?0:values.health;
    const key=JSON.stringify([values,set,lump,flash,health]);
    if(key===drawnKey)return;
    drawnKey=key;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,320,32);
    draw(values.war?'PDWBAR':'PDBAR',0,0);
    draw(values.war?'STARMS':'PDARMS',ST.armsBg[0],ST.armsBg[1]);
    if(values.ammo!=null)drawNum(values.ammo,ST.ammo[0],ST.ammo[1],3,'STTNUM');
    drawNum(health,ST.health[0],ST.health[1],3,'STTNUM');draw('STTPRCNT',ST.health[0],ST.health[1]);
    // The combat prologue: Doom's own ARMS grid (2-7, yellow when owned).
    if(values.war)values.arms.forEach((owned,i)=>draw((owned?'STYSNUM':'STGNUM')+(i+2),ST.arms[0]+(i%3)*ST.armsSpace[0],ST.arms[1]+Math.floor(i/3)*ST.armsSpace[1]));
    else values.freed.forEach((status,i)=>{
      const prefix=status==='freed'?'STYSNUM':status==='lost'?'PDRSNUM':'STGNUM';
      draw(prefix+(i+1),ST.arms[0]+(i%3)*ST.armsSpace[0],ST.arms[1]+Math.floor(i/3)*ST.armsSpace[1]);
    });
    if(!values.war&&values.refuge!=null)draw(values.refuge?'PDREFUG1':'PDREFUG0',ST.arms[0]+2*ST.armsSpace[0],ST.arms[1]+ST.armsSpace[1]);
    const f=faceImage(set,lump);
    if(f)ctx.drawImage(f.img,ST.face[0]-f.m.x,ST.face[1]-f.m.y);
    drawnFace=f?{set:f.set,lump,src:f.img.getAttribute('src'),x:ST.face[0]-f.m.x,y:ST.face[1]-f.m.y}:null;drawnHealth=health;drawnHot=flash;
    drawNum(values.pdoom,ST.armor[0],ST.armor[1],3,flash?'PDHNUM':'STTNUM');draw(flash?'PDHPRCNT':'STTPRCNT',ST.armor[0],ST.armor[1]);
    if(!values.war)['PDWRENCH','STKEYS1','PDCHARGE'].forEach((name,i)=>{if(values.items[i])draw(name,ST.keys[0],ST.keys[1][i]);});
    // The combat prologue's armor gauge in the key boxes, filling upward: one chest plate per
    // third of the armor's maximum (green armor 100, blue 200).
    else for(let i=0;i<values.armorPips;i++)draw(values.armorBlue?'PDARMB':'PDARMG',ST.keys[0],ST.keys[1][2-i]);
    values.tallies.forEach(([cur,max],i)=>{
      drawNum(cur,ST.tallyCur,ST.tallyY[i],3,'STYSNUM');
      drawNum(max,ST.tallyMax,ST.tallyY[i],3,'STYSNUM');
    });
  }

  function faceInput(){
    const w=last||{};
    const attackerDiff=w.hunter_x!=null?angleDiff(angleTo(w,{x:w.hunter_x,y:w.hunter_y}),w.angle||0):null;
    // attackdown: the fire input is held (Doom's own test), or swings/shots keep
    // coming (the wrench and gun fire once per press).
    return {health:values?.dead?0:values?.health??100,god:false,attackdown:attackHeld||tic-lastAttackTic<ATTACK_MEMORY,attackerDiff,aimDiff};
  }
  function step(){face.tick(faceInput());tic++;}
  function loop(now){
    if(!running)return;
    const dt=Math.min(250,Math.max(0,now-(lastNow||now)));lastNow=now;
    if(!paused&&tic!=null){
      acc+=dt*TICRATE/1000;
      while(acc>=1){if(tic>=engineTic+CLOCK_LEAD){acc=0;break;}step();acc-=1;}
    }
    if(++frame%2===0||!drawnKey)render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Is the hunter's current aim probably at you? It takes the nearest visible
  // human outside the refuge; line of sight is not reported, so distance decides.
  function aimedAtYou(w){
    if(!(w.hunter_aim>0)||w.in_refuge)return false;
    const hunter={x:w.hunter_x,y:w.hunter_y},mine=Math.hypot(w.x-hunter.x,w.y-hunter.y);
    if(mine>1000)return false;
    return !(w.people||[]).some(p=>p.alive&&p.released&&!p.controlled&&!p.sheltered&&Math.hypot(p.x-hunter.x,p.y-hunter.y)<mine);
  }

  // The Last Stand: health, current ammo, owned weapons, BULL/SHEL/RCKT/CELL and
  // the climbing p(DOOM) in the armor slot. Same face logic as the rescue.
  function armorPips(armor,save){return armor<=0?0:Math.min(3,Math.ceil(armor*3/(save>=50?200:100)));}
  function updateWar(p){
    if(!p)return;
    const prev=last;last={...p,controlled:0};
    const ammoFor={Pistol:p.bullets,Chaingun:p.bullets,Shotgun:p.shells,RocketLauncher:p.rockets,PlasmaRifle:p.cells,BFG9000:p.cells};
    values={war:true,ammo:p.weapon in ammoFor?Math.max(0,ammoFor[p.weapon]|0):null,
      health:Math.max(0,p.health|0),dead:p.health<=0,arms:(p.arms||[1,1,0,0,0,0]).map(Boolean),pdoom:p.pdoom|0,
      armorPips:armorPips(p.armor|0,p.armor_save|0),armorBlue:(p.armor_save|0)>=50,
      tallies:[[p.bullets|0,200],[p.shells|0,50],[p.rockets|0,50],[p.cells|0,300]]};
    if(Number.isFinite(p.ticks)){engineTic=p.ticks;if(tic==null||tic<engineTic-TICRATE||tic>engineTic+TICRATE){tic=engineTic;acc=0;}}
    aimDiff=null;
    if(!prev||!prev.arms){face.reset(values.health);return;}
    const damage=(prev.health|0)-(p.health|0);
    if(damage>0)face.hit(damage,false);
    if((p.arms||[]).some((owned,i)=>owned&&!(prev.arms||[])[i]))face.grin();
    const spent=['bullets','shells','rockets','cells'].some(k=>(p[k]|0)<(prev[k]|0));
    if(spent||(p.kills|0)>(prev.kills|0))lastAttackTic=tic??0;
  }
  function update(world,mode,escape){
    if(!world||world.raw)return;
    const prev=last;last=world;
    const lost=mode==='lost';
    const outlook=survivalEstimate(world,mode,escape);
    const people=world.people||[];
    const camerasTotal=Math.max(0,world.cameras_total||0);
    values={
      ammo:world.tool===1&&world.gun?Math.max(0,world.ammo|0):null,
      health:lost?0:Math.max(0,world.health|0),dead:lost||world.health<=0,
      freed:[0,1,2,3,4].map(i=>{const p=people[i];return !p?'captive':!p.alive?'lost':p.released?'freed':'captive';}),
      refuge:world.refuge_known?(world.in_refuge&&!lost?1:0):null,// yellow only while a living body is inside
      pdoom:outlook?outlook.doom:0,
      items:[!!world.wrench,!!world.key,!!world.charge],
      tallies:[[Math.min(camerasTotal,Math.max(0,world.cameras_broken|0)),camerasTotal],[world.freed|0,5],[world.sheltered|0,5],[Math.max(0,world.alive|0),6]]
    };
    // A dead body shows the dead face at once, even if the face clock is paused
    // (the lost screen's panel pauses it in the same moment).
    if(values.dead&&face.index!==DEADFACE){face.priority=9;face.index=DEADFACE;face.count=1;}
    if(Number.isFinite(world.ticks)){
      engineTic=world.ticks;
      if(tic==null||tic<engineTic-TICRATE||tic>engineTic+TICRATE){tic=engineTic;acc=0;}
    }
    aimDiff=aimedAtYou(world)?angleDiff(angleTo(world,{x:world.hunter_x,y:world.hunter_y}),world.angle||0):null;
    // A new map's clock restarts below the last one (handled above); coming from the
    // prologue's war bar (it has arms) the face starts afresh, not on the fall's dead face.
    if(!prev||prev.arms){face.reset(values.health);deadSet=null;return;}
    if((prev.controlled|0)!==(world.controlled|0)){
      // Control moved to another body. A lost body shows its dead face first.
      const died=(world.alive|0)<(prev.alive|0)||prev.health<=0;
      const hold=died?DEATH_HOLD:0;
      deadSet=setFor(prev.controlled);
      face.reset(values.health);
      if(hold)face.die(hold);
      loadFaceSet(setFor(world.controlled));
      return;
    }
    const damage=(prev.health|0)-(world.health|0);
    if(damage>0)face.hit(damage,(world.hunter_lasers|0)>(prev.hunter_lasers|0));
    const pickedUp=['wrench','gun','key','charge'].some(k=>!prev[k]&&world[k]);
    if((world.freed|0)>(prev.freed|0)||pickedUp)face.grin();
    if((world.cameras_broken|0)>(prev.cameras_broken|0))face.camera();
    if(world.attacking||(world.wrench_swings|0)>(prev.wrench_swings|0)||(world.gun&&prev.gun&&(world.ammo|0)<(prev.ammo|0)))lastAttackTic=tic??0;
  }

  return {
    canvas,update,updateWar,
    // The launcher's CEO choice: your own body's face set (before the run starts).
    setCeo(ceo){
      const id=bodyFaceSets(ceo)[0];if(id===bodies[0])return;
      bodies[0]=id;drawnKey='';if(manifest)loadFaceSet(id);
    },
    setLevel(level){
      const next=castForLevel(level);if(next.every((id,i)=>bodies[i+1]===id))return;
      bodies.splice(1,5,...next);deadSet=null;drawnKey='';if(manifest)for(const id of next)loadFaceSet(id);
    },
    setPaused(value){paused=!!value;if(!paused)lastNow=0;},
    setAttackHeld(value){attackHeld=!!value;},
    stop(){running=false;},
    getState(){
      return {ready,error,paused,tic,engineTic,ceo:bodies[0],faceSet:currentFaceSet(),face:face.lump,faceIndex:face.index,
        priority:face.priority,painLevel:Math.floor(face.painOffset(values?.health??100)/FACESTRIDE),
        faceCount:face.count,attackHeld,aimDiff,alarm:!!values&&values.pdoom>=ALARM,
        faceSetsLoaded:bodies.filter(id=>loadedSets.has(id)),drawnFace,drawnHealth,drawnHot,values};
    }
  };
}
