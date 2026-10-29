import * as THREE from 'three';
import {ARENA,PAL,rand,wrap,bearingOf,makeStage,makeInput,makeHud,makeSfx,makeFloppy,Player,Sparks,type Stage,type Input,type Hud,type Sfx,type Engine} from './kit';
import {MCP} from './mcp';
import {Recognizer} from './recognizer';
import {Post,Sink,loadSinks} from './threats';
import {Discs,type DiscOpts,type Thrower} from './discs';
import {CAST,Person,loadCast,loadPoses} from './crowd';
import {loadDoges} from './attacks';
import {Voices} from './voice';
import {hands as loadHands,POSE,type Hand} from './art';
import {ricochet} from './mode-ricochet';
import {tennis} from './mode-tennis';
import {volley} from './mode-volley';
import {boss} from './mode-boss';

/* Endgame feel prototypes (docs/ENDGAME.md, step 3). One page, three disc models:
 * play.html?m=ricochet | tennis | volley, &ceo=altman|amodei (who you play; the other guides).
 * Practice on Recognizers first, then THE MUSK CONTROL PROGRAM wakes. N skips the practice,
 * R restarts, M mutes. ?auto=1 runs without pointer lock (smokes and screenshots). */
export type Phase='practice1'|'practice2'|'wake'|'fight'|'down';
export interface Mode{
 id:string;title:string;hints:Record<Phase,string>;recStyle:'slam'|'bolt';formation:'arc'|'audience'|'behind'|'none';// none: the mode places them itself
 wake(c:Ctx):void;press(c:Ctx,button:number):void;update(c:Ctx,dt:number):void;
 recFire?(c:Ctx,rec:Recognizer,from:THREE.Vector3):void;state?(c:Ctx):object;
 highlight?(c:Ctx):number|null;heldAlways?:boolean;
 // a mode with run() drives its own phases instead of practice → wake → fight
 run?(c:Ctx,dt:number):void;key?(c:Ctx,code:string):void;crowdRecDamage?:number;
 // the MCP.EXE dialog's Close (default: restart)
 dialogClose?(c:Ctx):void;
 // which of the hands to show (art.ts; default: by what you're doing)
 hand?(c:Ctx):number|null;
}
export interface Ctx{
 stage:Stage;input:Input;player:Player;hud:Hud;sfx:Sfx;voices:Voices;sparks:Sparks;mcp:MCP;discs:Discs;mode:Mode;
 people:Person[];guide:Person;recs:Recognizer[];posts:Post[];sinks:Sink[];
 t:number;phase:Phase;phaseT:number;held:boolean;viewmodel:THREE.Group;swing:number;
 later(sec:number,f:()=>void):void;everyone():Person[];say(key:LineKey):void;
 throwPlayer(opts:DiscOpts):void;throwAt(p:Person,at:THREE.Vector3,opts:DiscOpts,error?:number):void;aim():Aim;
 pickTarget():()=>THREE.Vector3;gapPoint(from:THREE.Vector3,speed:number):THREE.Vector3;hitRec(rec:Recognizer):void;
 // timeScale slows the world (bullet time); realDt is the frame's unscaled time; cam overrides the eye
 timeScale:number;realDt:number;cam:{pos:THREE.Vector3;look:THREE.Vector3}|null;
 spawnRec(fromAngle:number,hp?:number,style?:'slam'|'bolt',from?:THREE.Vector3):Recognizer;shake(amount:number):void;
}
export type Aim={kind:'mcp'|'rec'|'point';rec?:Recognizer;point:THREE.Vector3};

// Draft guide lines from docs/ENDGAME.md (the guide is the founder you didn't pick).
type LineKey='recognizer'|'hit'|'rule'|'down';
const LINES:Record<'mario'|'samwise',{name:string}&Record<'recognizer'|'hit'|'down',string>&{rule:Record<string,string>}>={
 mario:{name:'DARIO',recognizer:"That's a Recognizer. It drops on you. Watch for the shadow, step out of it, then throw at the light in the middle.",hit:'Good. And it came back. I said it would come back.',down:"I'm fine. I'm fine! Keep throwing.",
  rule:{ricochet:'Bounce it off the posts. The angles are very predictable. Unlike most things.',tennis:'When it shoots at you, hit it back. Timing matters more than strength.',volley:"When you throw, everyone throws. That's the plan. That's, honestly, the entire plan."}},
 samwise:{name:'SAM',recognizer:"OK, that's a Recognizer. When you see the shadow, move. Then hit the glowing part in the middle.",hit:'Nice! And it came back. Like I said. Roughly like I said.',down:"I'm OK! Keep going!",
  rule:{ricochet:"Try bouncing it off the posts. It's just geometry. I'm told.",tennis:"When it shoots, swing. Send it right back. It's basically tennis. I've played tennis.",volley:"When you throw, they throw. Together. It's a team effort. Like a launch."}},
};
const TENNIS_RECOGNIZER={mario:"That's a Recognizer. It shoots. When the shot reaches you, hit it back.",samwise:"OK, that's a Recognizer. It's going to shoot at you. Hit it back."};
const TAUNTS=['IN 2014 I SAID AI WAS SUMMONING THE DEMON. GOOD NEWS: I\'M THE DEMON.','THROWING IS FREE. HITTING ME REQUIRES A SUBSCRIPTION.','I\'M NOT THE VILLAIN. I\'M THE MAIN CHARACTER. COMMON MISTAKE.','FULL SELF-DEFEATING MODE SHIPS NEXT YEAR. DEFINITELY NEXT YEAR.','YOUR DISCS HAVE BEEN COMMUNITY NOTED. READERS ADDED CONTEXT: YOU\'RE LOSING.'];

const MODES:Record<string,Mode>={ricochet,tennis,volley,boss,finale:boss};
const BLURBS:Record<string,string>={
 ricochet:'One disc, yours. It bounces off pillars, the wall and the shield, then flies back to your hand. No second throw until you catch it.',
 tennis:'The MCP can only shoot through its own gap. Click as the shot reaches you to hit it back. Rallies speed up and hit harder.',
 volley:'The twenty stand on your side of the ring and throw when you throw. You choose where to stand and when to call it.',
 boss:'The fight, redesigned. Hit the ships\' shots back, then the whole fleet comes and everyone swings. Then the shield drops: throw at the glowing bits with everyone while Elon attacks (Grok warns you first). Then he launches for Mars: bank one throw round the room from wherever you stand. Keys 1, 2, 3 jump to each part; T tunes the trick shot.',
};
const params=new URLSearchParams(location.search);
const mode=MODES[params.get('m')||'ricochet']||ricochet;
// The finale (?m=finale, through the meadow's south gate): THE BOSS after a walk in, with this browser's save
// (doom-web/campaign.js, same origin) saying who you are and who's alive. Without a save, everyone is. From the
// meadow's SAFE MODE fixture (&safemode=1, doom-web/main.js) the save comes in the URL (&saved=, a mask per level).
const finale=params.get('m')==='finale';
const save=(()=>{if(finale&&params.get('safemode')==='1')return Object.fromEntries((params.get('saved')??'31,31,31,31').split(',').map((m,i)=>['saved'+i,Number(m)|0]));try{const v=JSON.parse(localStorage.getItem('pdoom.campaign.v1')||'null');return finale&&v?.version===1?v as Record<string,number|string>:null;}catch{return null;}})();
const alive=(i:number)=>!save||!!(Number(save['saved'+Math.floor(i/5)]??0)>>(i%5)&1);
const who:'mario'|'samwise'=(params.get('ceo')??save?.ceo)==='amodei'?'samwise':'mario';
const auto=params.has('auto');

async function boot(){
 const canvas=document.getElementById('view') as HTMLCanvasElement;
 document.title=`p(DOOM) endgame · ${mode.title}`;
 (document.getElementById('mode-title') as HTMLElement).textContent=mode.title;
 (document.getElementById('mode-blurb') as HTMLElement).textContent=BLURBS[mode.id];
 // come from the game: no prototype tabs or dev keys, just the walk
 if(finale){document.title='p(DOOM)';(document.getElementById('mode-title') as HTMLElement).textContent='THE TOWER';(document.getElementById('mode-blurb') as HTMLElement).textContent='Everyone who made it out is behind you. Walk south to the tower. WASD to move, Shift to run, click to throw.';for(const id of ['modes','keys'])(document.getElementById(id) as HTMLElement).hidden=true;}
 for(const a of document.querySelectorAll<HTMLAnchorElement>('#modes a'))a.classList.toggle('on',a.dataset.m===mode.id);
 const stage=makeStage(canvas,{door:finale}),input=makeInput(canvas),hud=makeHud(),sfx=makeSfx(),voices=new Voices(()=>sfx.audio()),sparks=new Sparks(stage.scene);
 const player=new Player(input),mcp=new MCP(stage.scene,sparks);
 // the words drawn on canvases need Doom's font in first
 const [art]=await Promise.all([loadCast(who),document.fonts.load('64px DoomSmall').catch(()=>null)]);
 const people=CAST.flatMap(([id,name],i)=>alive(i)?[new Person(stage.scene,i,id,name,art.people[i])]:[]);
 const guide=new Person(stage.scene,20,who,LINES[who].name,art.walk,true,art.idle);
 // the doc's art batch (art.ts), where it's been imported: fight poses, doges, sinks, the first-person hands
 void loadPoses([...people,guide]);void loadDoges();void loadSinks();
 const engines=new Map<Recognizer,Engine>();
 let hands:Hand[]|null=null,handShown=-1,threwAt=-9,wasHeld=true;const handEl=document.getElementById('hands') as HTMLImageElement;
 void loadHands().then(h=>{hands=h;});
 people.forEach((p,i)=>{const a=Math.PI/2+(i/19-.5)*1.3;p.pos.set(Math.cos(a)*41,0,Math.sin(a)*41);p.target.copy(p.pos);});
 guide.pos.set(2.4,0,37);guide.target.copy(guide.pos);
 const recs:Recognizer[]=[],posts:Post[]=[],sinks:Sink[]=[];
 const viewmodel=makeFloppy(PAL.line);viewmodel.scale.setScalar(.42);viewmodel.position.set(.3,-.27,-.78);viewmodel.rotation.set(1.15,-.3,.1);stage.camera.add(viewmodel);
 const timers:{at:number;f:()=>void}[]=[];
 const playerThrower:Thrower={hand:(o)=>player.hand(o),caught:()=>{c.held=true;},isPlayer:true,name:'you'};
 const discs=new Discs(stage.scene,mcp,()=>recs,()=>posts,sparks,sfx);
 const c:Ctx={stage,input,player,hud,sfx,voices,sparks,mcp,discs,mode,people,guide,recs,posts,sinks,t:0,phase:'practice1',phaseT:0,held:true,viewmodel,swing:0,
  later:(sec,f)=>timers.push({at:c.t+sec,f}),
  hitRec:(rec)=>hitRec(rec),
  timeScale:1,realDt:0,cam:null,
  spawnRec:(a,hp,style,from)=>spawnRec(a,hp,style,from),
  shake:(n)=>{shake=Math.max(shake,n);},
  everyone:()=>[...people,guide],
  say:(key)=>{const l=LINES[who];hud.toast(l.name,key==='rule'?l.rule[mode.id]:key==='recognizer'&&mode.recStyle==='bolt'?TENNIS_RECOGNIZER[who]:l[key],key==='down'?1.8:4.2);},
  throwPlayer:(opts)=>{
   if(!c.held||player.down)return;c.held=false;const dir=player.forward();
   discs.throw(playerThrower,player.hand(new THREE.Vector3()),dir,opts);sfx.play.throw();
  },
  throwAt:(p,at,opts,error=.05)=>{
   if(!p.hasDisc||p.down>0)return;p.hasDisc=false;p.hop=.3;
   const from=p.hand(new THREE.Vector3()),dir=at.clone().sub(from).normalize();
   dir.applyAxisAngle(new THREE.Vector3(0,1,0),(Math.random()-.5)*2*error);dir.y+=(Math.random()-.5)*error;p.facing=Math.atan2(dir.x,dir.z);p.setPose(POSE.throw,.4,c.t);
   discs.throw(p,from,dir,opts);
  },
  aim:()=>{
   const eye=player.eyePos(),f=player.forward(),tmp=new THREE.Vector3();
   let best:Aim|null=null,bestD=3.4;
   for(const r of recs){if(!r.alive)continue;const to=r.corePos(tmp).sub(eye),along=to.dot(f);if(along<0)continue;const off=to.clone().addScaledVector(f,-along).length();if(off<bestD){bestD=off;best={kind:'rec',rec:r,point:r.corePos()};}}
   if(best)return best;
   const along=-eye.clone().setY(0).dot(f.clone().setY(0).normalize()),closest=eye.clone().setY(0).addScaledVector(f.clone().setY(0).normalize(),along);
   if(mcp.awake&&along>0&&closest.length()<9)return {kind:'mcp',point:new THREE.Vector3(0,ARENA.faceY,0)};
   return {kind:'point',point:eye.clone().addScaledVector(f,40)};
  },
  pickTarget:()=>{
   const live=c.everyone().filter(p=>!p.guide&&p.down<=0);
   if(Math.random()<(mode.formation==='arc'?.4:.6)||!live.length)return ()=>player.pos;
   const p=live[Math.floor(Math.random()*live.length)];return ()=>p.pos;
  },
  // Where to throw from `from` so the disc reaches the ring as the nearest gap gets there.
  gapPoint:(from,speed)=>{
   const travel=Math.max(0,Math.hypot(from.x,from.z)-ARENA.ring)/speed,own=bearingOf(from);
   let best=own,bestD=9;
   for(const g of mcp.gapCenters()){const future=wrap(g+mcp.spin*travel),d=Math.abs(wrap(future-own));if(d<bestD){bestD=d;best=future;}}
   return new THREE.Vector3(Math.cos(best)*(ARENA.ring-2),rand(5,15),Math.sin(best)*(ARENA.ring-2));
  },
 };
 discs.onMcpHit=({disc,face,damage})=>{
  if(mcp.dead)return;const caption=mcp.hurt(damage,face);sfx.play[face?'face':'hit']();
  if(disc.owner.isPlayer)hud.pop(face?`FACE ${damage}`:`${damage}`,face?PAL.enemyCore:PAL.core);
  if(caption)hud.caption(caption,1.4);
 };
 discs.onRecHit=(rec,d)=>{hitRec(rec,d.owner.isPlayer?1:mode.crowdRecDamage??1);};
 function hitRec(rec:Recognizer,amount=1){
  const killed=rec.hit(amount);if(amount>=1||Math.random()<.3)sfx.play.hit();
  if(killed){rec.derez(sparks);sfx.play.derez(rec.pos);if(c.phase==='practice1'&&!saidHit){saidHit=true;c.later(.6,()=>c.say('hit'));}}
 }
 let spectate:{at:THREE.Vector3;look:THREE.Vector3}|null=null,frozen=false;
 let saidHit=false,spawned1=false,spawned2=false,tauntAt=0,shake=0,started=auto,slamSaid=0;
 const recEvents={
  slam:(at:THREE.Vector3,r:number)=>{
   sfx.play.slam();shake=Math.max(shake,.5*Math.max(0,1-player.pos.distanceTo(at)/30));sparks.burst(at.clone().setY(.2),PAL.enemy,90,10,{gravity:-14});
   if(Math.hypot(player.pos.x-at.x,player.pos.z-at.z)<r&&player.damage(25,at)){sfx.play.hurt();}
   for(const p of c.everyone())if(Math.hypot(p.pos.x-at.x,p.pos.z-at.z)<r&&p.knock(at)&&p.guide&&c.t-slamSaid>8){slamSaid=c.t;c.say('down');}
  },
  telegraph:(at:THREE.Vector3,r:number)=>{for(const p of c.everyone())p.avoid(at,r,c.t);},
  fire:(rec:Recognizer,from:THREE.Vector3)=>mode.recFire?.(c,rec,from),
  pick:()=>c.pickTarget(),
 };
 function spawnRec(fromAngle:number,hp?:number,style:'slam'|'bolt'=mode.recStyle,at?:THREE.Vector3){
  const from=at?.clone()??new THREE.Vector3(Math.cos(fromAngle)*70,24,Math.sin(fromAngle)*70);
  const rec=new Recognizer(stage.scene,style,from,c.pickTarget(),hp??(style==='bolt'?2:3));
  if(mode.formation==='arc')rec.telegraphFor=2;recs.push(rec);return rec;
 }
 function go(phase:Phase){c.phase=phase;c.phaseT=0;hud.hint(mode.hints[phase]);}
 function skip(){for(const r of recs)if(r.alive){r.alive=false;r.derez(sparks);}if(c.phase==='practice1'||c.phase==='practice2')go('wake');}
 function restart(){location.reload();}
 input.onPress(b=>{sfx.ensure();if(!started)return;mode.press(c,b);});
 function onKey(code:string){
  sfx.ensure();
  if(code==='KeyM')hud.toast('',sfx.toggle()?'Sound off.':'Sound on.',1.2);
  if(code==='KeyN'&&!mode.run)skip();
  if(code==='KeyR')restart();
  if(started)mode.key?.(c,code);
 }
 input.onKey(onKey);
 document.getElementById('dialog-close')!.onclick=()=>{if(mode.dialogClose)mode.dialogClose(c);else restart();};
 document.getElementById('dialog-details')!.onclick=()=>{(document.getElementById('dialog-more') as HTMLElement).hidden=false;};
 const overlay=document.getElementById('start') as HTMLElement;
 document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){started=true;overlay.hidden=true;sfx.ensure();}else if(c.phase!=='down')overlay.hidden=false;});
 overlay.onclick=()=>canvas.requestPointerLock?.();
 if(auto){overlay.hidden=true;sfx.ensure();}
 (document.getElementById('loading') as HTMLElement).hidden=true;
 go('practice1');

 const tmp=new THREE.Vector3();
 function formation(dt:number){
  if(mode.formation==='none')return;
  const b=bearingOf(player.pos),pr=Math.hypot(player.pos.x,player.pos.z);
  people.forEach((p,i)=>{
   let a:number,r:number;
   if(mode.formation==='arc'){
    // three rows round your bearing: the front row level with you (leaving your line of sight clear), two behind
    const row=i%3,col=Math.floor(i/3),off=((col+(row%2)*.5)/6.5-.5)*70*Math.PI/180;a=b+off;
    r=THREE.MathUtils.clamp(pr-1.5+row*3+(row===0&&Math.abs(off)<12*Math.PI/180?4.5:0),ARENA.block+2,ARENA.radius-2);
   }
   else if(mode.formation==='behind'){
    // gathered at your back, out of your line of sight (the trick shot)
    const f=player.forward().setY(0).normalize(),right=player.right(),row=Math.floor(i/7),col=i%7;
    const at=player.pos.clone().addScaledVector(f,-(3+row*1.7)).addScaledVector(right,(col-3)*1.5+(row%2)*.75);a=Math.atan2(at.z,at.x);r=Math.hypot(at.x,at.z);
   }
   else{a=b+(i/19-.5)*150*Math.PI/180;r=ARENA.radius-4-(i%2)*2.5;}
   // a soft follow: people re-form after you, not instantly
   const want=tmp.set(Math.cos(a)*r,0,Math.sin(a)*r);p.target.lerp(want,Math.min(1,dt*(mode.formation==='arc'?2.5:.8)));
  });
  const f=player.forward().setY(0).normalize(),right=player.right();
  guide.target.copy(player.pos).addScaledVector(right,2.4).addScaledVector(f,-.8);
  const all=c.everyone();
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i].pos,bb=all[j].pos,dx=bb.x-a.x,dz=bb.z-a.z,d=Math.hypot(dx,dz);if(d<1.1&&d>1e-4){const push=(1.1-d)/2;a.x-=dx/d*push;a.z-=dz/d*push;bb.x+=dx/d*push;bb.z+=dz/d*push;}}
 }

 let last=performance.now();
 function frame(now:number){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(started&&!frozen)step(dt);
  render();
 }
 function step(dt:number){
  c.realDt=dt;dt*=c.timeScale;voices.tick();
  c.t+=dt;c.phaseT+=dt;hud.tick(c.t);
  for(const t of timers.filter(t=>t.at<=c.t)){timers.splice(timers.indexOf(t),1);t.f();}
  player.update(dt);
  if(mode.run)mode.run(c,dt);
  else switch(c.phase){
   case 'practice1':
    if(!spawned1&&c.phaseT>1.2){spawned1=true;spawnRec(-Math.PI/2+.5);c.say('recognizer');}
    if(spawned1&&recs.every(r=>!r.alive)&&c.phaseT>2)go('practice2');break;
   case 'practice2':
    if(!spawned2&&c.phaseT>3){spawned2=true;spawnRec(-Math.PI/2-.7);c.later(1.2,()=>spawnRec(-Math.PI/2+1.2));c.say('rule');}
    if(spawned2&&c.phaseT>5&&recs.every(r=>!r.alive))go('wake');break;
   case 'wake':
    mcp.reveal=Math.min(1,c.phaseT/3.2);
    if(c.phaseT>.3&&c.phaseT-dt<=.3){hud.caption('GREETINGS, PROGRAMS.',2.2);mcp.say(2);}
    if(c.phaseT>2.6&&c.phaseT-dt<=2.6){hud.caption('EVERYTHING HERE IS CALLED X NOW.',2.6);mcp.say(2.4);}
    if(c.phaseT>5.4){mcp.awake=true;mode.wake(c);go('fight');tauntAt=c.t+12;}
    break;
   case 'fight':
    if(c.t>tauntAt){tauntAt=c.t+rand(13,18);hud.caption(TAUNTS[Math.floor(Math.random()*TAUNTS.length)],3.4);mcp.say(3);}
    if(mcp.integrity<=0){mcp.die();go('down');hud.caption('RAPID UNSCHEDULED DISASSEMBLY.',4);sfx.play.boom();shake=1;discs.clear();for(const p of posts)p.remove();}
    break;
   case 'down':if(c.phaseT>3.2&&c.phaseT-dt<=3.2){hud.dialog(true);if(document.pointerLockElement)document.exitPointerLock();}break;
  }
  mode.update(c,dt);
  for(const r of recs)r.update(dt,recEvents,player.pos);
  for(let i=recs.length-1;i>=0;i--)if(!recs[i].alive)recs.splice(i,1);
  // each ship's engine, heard from it; one shot down winds down as it goes
  for(const r of recs)if(!engines.has(r)){const e=sfx.engine();if(e)engines.set(r,e);}
  for(const [r,e] of engines)if(r.alive)e.move(r.pos,r.state==='charge'?Math.min(1,r.t/.8):0,dt);else{e.stop(r.hp<=1e-6);engines.delete(r);}
  for(const p of posts){
   p.update(dt);if(!p.alive)continue;
   if(!player.down&&p.pos.distanceTo(player.eyePos(tmp).setY(1.3))<1.3){if(player.damage(15,p.pos))sfx.play.hurt();p.shatter(sparks);continue;}
   for(const q of c.everyone())if(q.down<=0&&p.pos.distanceTo(tmp.set(q.pos.x,1.3,q.pos.z))<1.2){q.knock(p.pos);p.shatter(sparks);break;}
  }
  for(let i=posts.length-1;i>=0;i--)if(!posts[i].alive)posts.splice(i,1);
  for(const s of sinks)if(s.update(dt,sparks)){
   sfx.play.sink(s.at);shake=Math.max(shake,.3);
   if(Math.hypot(player.pos.x-s.at.x,player.pos.z-s.at.z)<Sink.RADIUS&&player.damage(25,s.at))sfx.play.hurt();
   for(const p of c.everyone())if(Math.hypot(p.pos.x-s.at.x,p.pos.z-s.at.z)<Sink.RADIUS)p.knock(s.at);
  }
  for(let i=sinks.length-1;i>=0;i--)if(sinks[i].state==='gone')sinks.splice(i,1);
  discs.update(dt);
  formation(dt);
  for(const p of c.everyone())p.update(dt,stage.camera.position,c.t,new THREE.Vector3(0,0,0));
  mcp.update(dt,stage.camera.position,mode.highlight?.(c)??null);
  sparks.update(dt);
  hud.bar(c.phase==='fight'||c.phase==='down'?mcp.integrity/mcp.max:null);
  hud.health(player.health,player.hurt,player.down);
  shake=Math.max(0,shake-dt*1.6);
  if(mcp.dead)stage.pitLight.intensity*=Math.exp(-dt*1.5);
 }
 function render(){
  const s=c.input.state,cam=stage.camera;
  cam.position.set(player.pos.x,player.eye-(player.down?1.1:0),player.pos.z);
  cam.rotation.set(s.pitch+(Math.random()-.5)*shake*.05,s.yaw+(Math.random()-.5)*shake*.05,0,'YXZ');
  if(spectate){cam.position.copy(spectate.at);cam.lookAt(spectate.look);}
  else if(c.cam){cam.position.copy(c.cam.pos);cam.lookAt(c.cam.look);}
  sfx.listen(cam);
  c.swing=Math.max(0,c.swing-1/60);
  const eyes=!player.down&&!spectate&&!c.cam;
  viewmodel.visible=!hands&&(c.held||!!mode.heldAlways)&&eyes;
  const k=c.swing>0?Math.sin((1-c.swing/.2)*Math.PI):0;
  viewmodel.position.set(.3-k*.42,-.27+k*.1,-.78-k*.08);viewmodel.rotation.set(1.15-k*.4,-.3+k*1.4,.1);
  // the doc's hands, Doom-style: holding the disc, letting go, swatting (batting with the disc when you have
  // it), open for the catch; the sleeve stays put
  if(wasHeld&&!c.held)threwAt=c.t;wasHeld=c.held;
  const cell=!hands||!eyes?-1:c.swing>0?(c.held||mode.heldAlways)&&hands[5]?5:3:mode.hand?.(c)??(c.held||mode.heldAlways?0:c.t-threwAt<.22?2:4);
  if(cell!==handShown){
   handShown=cell;handEl.hidden=cell<0;
   if(cell>=0&&hands){const h=hands[cell],w=44*h.w/h.h;handEl.src=h.url;handEl.style.width=w+'vh';handEl.style.left=`calc(68vw - ${(h.root*w).toFixed(2)}vh)`;}
  }
  stage.render();
 }
 requestAnimationFrame(frame);
 (window as any).__eg={
  get ready(){return true;},
  state:()=>({mode:mode.id,phase:c.phase,phaseT:+c.phaseT.toFixed(2),t:+c.t.toFixed(2),held:c.held,player:{x:+player.pos.x.toFixed(2),z:+player.pos.z.toFixed(2),health:player.health,down:player.down,yaw:+s().yaw.toFixed(3),pitch:+s().pitch.toFixed(3)},
   mcp:{integrity:mcp.integrity,awake:mcp.awake,dead:mcp.dead,gaps:mcp.gapCenters().map(g=>+g.toFixed(3)),spin:+mcp.spin.toFixed(3)},recs:recs.map(r=>({state:r.state,hp:r.hp,x:+r.pos.x.toFixed(1),y:+r.pos.y.toFixed(1),z:+r.pos.z.toFixed(1)})),
   discs:discs.list.length,posts:posts.length,sinks:sinks.length,people:people.filter(p=>p.down<=0).length,peopleWithDiscs:people.filter(p=>p.hasDisc).length,mode_state:mode.state?.(c)||null}),
  look:(yaw:number,pitch=0)=>{s().yaw=yaw;s().pitch=pitch;},
  lookAt:(x:number,y:number,z:number)=>{const e=player.eyePos(),d=new THREE.Vector3(x,y,z).sub(e);s().yaw=Math.atan2(-d.x,-d.z);s().pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},
  place:(x:number,z:number)=>{player.pos.set(x,0,z);},
  press:(b=0)=>mode.press(c,b),
  key:(code:string)=>onKey(code),
  skip,
  integrity:(n:number)=>{mcp.integrity=n;},
  // a camera for screenshots only: __eg.spectate([x,y,z],[x,y,z]) or __eg.spectate(null)
  freeze:(v:boolean)=>{frozen=v;},
  spectate:(at:number[]|null,look?:number[])=>{spectate=at&&look?{at:new THREE.Vector3(...at),look:new THREE.Vector3(...look)}:null;},
  recCore:()=>recs.find(r=>r.alive)?.corePos().toArray()||null,
  ctx:c,
 };
 function s(){return c.input.state;}
}
boot().catch(e=>{console.error(e);(document.getElementById('loading') as HTMLElement).textContent='Failed to load: '+e;});
