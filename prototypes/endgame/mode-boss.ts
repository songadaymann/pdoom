import * as THREE from 'three';
import {ARENA,PAL,PILLARS,TAU,rand,clamp,wrap,glowSprite,textSprite,makeFloppy,Trail} from './kit';
import type {Mode,Ctx} from './main';
import type {Recognizer} from './recognizer';
import {Person,loadFounder} from './crowd';
import {Sink} from './threats';
import {Update,Starlink,Doges,type Attack,type Env,type Hitter,type Source} from './attacks';
import {GUIDE,ELON,GROK,SHOUT,OWN} from './lines';
import {Wasteland,CAM_FROM,CAM_TO,CAM_LOOK} from './ending';

/* THE BOSS, as redesigned on 2026-10-26 (docs/ENDGAME.md, "The fight: three parts that escalate").
 * 1 THE FLEET (tennis): one ship, then two; click as a shot flashes white in front of you to send it
 *   back, three hits a ship. Then fifteen more pour in, up to ten at once, firing at everyone; the
 *   guide calls everyone in and the crowd swats the balls aimed at them. Red arrows at the screen
 *   edge show balls coming from off-screen.
 * 2 THE FACE (volley): Elon attacks on a cycle that speeds up as he loses (attacks.ts: the update,
 *   Starlink, doges, and sinks below 550), and Grok warns you 2 s before each. After each attack the face
 *   opens for a few seconds: aim at a glowing bit and everyone throws with you. A click swats a ball
 *   that's on you, else throws.
 * 3 THE LAST THROW (LAUNCH): a 60 s countdown to Mars, the ring closed but for one gap. The 2026-10-23
 *   bank route is fitted to wherever you stand (rotated and mirrored by the arena's symmetry) and
 *   re-fitted as you move. Throw at 1, ride the disc, steer it in. Running out of time only delays it.
 * THE END: the column melts down on a wide shot (cracks, panels blowing off, the face un-downloading),
 *   tries to launch, and disassembles; the MCP.EXE dialog; Close, and you're all in a wasteland (ending.ts)
 *   for the guide's last line, a stare into the camera, and black.
 * Keys 1, 2, 3 jump to each part; N skips to the next; T opens the trick-shot tuning panel.
 * ?autosteer=1 steers the trick shot for smokes. */
const DEG=Math.PI/180,UP=new THREE.Vector3(0,1,0);
const MINE={speed:34,range:48,maxBounces:1,damage:5,faceDamage:5,backSpeed:40,color:PAL.line};
const THEIRS={speed:30,range:44,maxBounces:0,damage:0,faceDamage:0,backSpeed:34,color:'#7fd6ff'};
const SERVE=[1,2],SWARM=15,SWARM_LIVE=10,SHIPS=SERVE[0]+SERVE[1]+SWARM,SHIP_HP=3;
const CROWD_RETURN=.65;              // a prisoner's chance of hitting back a ball aimed at them
const SHIELD_DOWN_TO=300,COUNTDOWN=60,DELAYED_TO=30;
// Part 2's rhythm: survive an attack, then the face opens for a few seconds and up to three bits light in turn.
const SPOT_HP=45,SPOT_MINE=25,SPOT_THEIRS=5,WINDOW_SPOTS=3;
const LASTS:Record<'update'|'starlink'|'doge'|'sink',number>={update:3.9,starlink:5.6,doge:3,sink:2.4};// how long until the face opens again
// Trick-shot tuning. T opens a panel that changes these live; they're kept in this browser.
const TUNE_DEFAULTS={speed:26,slowTo:.2,slowFrom:15,slowFull:5,steer:.55,keySteer:.7,hit:1.9,errMin:2.5,errMax:4.5,camBack:4.6,camUp:1.25};
type Tune=typeof TUNE_DEFAULTS;
const TUNE:Tune={...TUNE_DEFAULTS,...(()=>{try{return JSON.parse(localStorage.getItem('pdoom.trick.tune')||'{}');}catch{return {};}})()};
const TUNE_INFO:[keyof Tune,string,number,number,number][]=[
 ['speed','Disc speed (m/s)',10,50,1],['slowTo','Slow-mo at a mark (× time)',.05,1,.01],['slowFrom','Slow-mo starts (m from mark)',4,30,.5],
 ['slowFull','Full slow-mo (m from mark)',0,15,.5],['steer','Mouse steering',.1,2,.05],['keySteer','WASD steering (rad/s)',.1,2,.05],
 ['hit','Mark size (hit radius, m)',.6,3.5,.1],['errMin','Off course after a mark, min (°)',0,10,.5],['errMax','Off course after a mark, max (°)',0,15,.5],
 ['camBack','Camera behind the disc (m)',1.5,12,.1],['camUp','Camera above the disc (m)',0,5,.05],
];
// The 2026-10-23 bank route as bearings off where you start (degrees). The eight pillars repeat every 45° and
// mirror, so the route can turn in 45° steps and flip and stay good; only your own leg to it needs checking.
const ROUTE:{kind:'wall'|'pillar';off:number;y:number}[]=[{kind:'wall',off:-45,y:2.4},{kind:'pillar',off:-67.5,y:3},{kind:'wall',off:-100,y:3.6},{kind:'pillar',off:-157.5,y:3.4},{kind:'wall',off:-190,y:5}];
const autosteer=new URLSearchParams(location.search).has('autosteer');

type Phase='intro'|'ships'|'shieldDown'|'trick'|'down'|'waste';
type Kind='update'|'starlink'|'doge'|'sink';
const WARN:Record<Kind,string[]>={update:GROK.update,starlink:GROK.starlink,doge:GROK.doge,sink:GROK.sink};

// A glowing bit on the face (part 2). It rides the face, which always turns to you.
const FACE_W=ARENA.faceH*24/28,FACE_H=ARENA.faceH;
const FEATURES:[number,number][]=[[-.17,.12],[.17,.12],[0,.33],[0,-.02],[.06,-.26],[-.28,-.08],[.28,-.08],[0,-.42],[-.12,.3],[.12,.3]];
class Spot{
 group=new THREE.Group();hp=SPOT_HP;age=0;alive=true;flash=0;
 constructor(face:THREE.Mesh,public slot:number){
  const [u,v]=FEATURES[slot];
  const square=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5),new THREE.MeshBasicMaterial({color:PAL.white,transparent:true,depthTest:false}));
  const frame=new THREE.Mesh(new THREE.RingGeometry(1.15,1.4,4,1).rotateZ(Math.PI/4),new THREE.MeshBasicMaterial({color:PAL.enemyCore,transparent:true,depthTest:false}));
  square.renderOrder=frame.renderOrder=6;this.group.add(square,frame,glowSprite(PAL.enemyCore,3.6,.9));
  this.group.position.set(u*FACE_W,v*FACE_H,.15);face.add(this.group);
 }
 world(out=new THREE.Vector3()){return this.group.getWorldPosition(out);}
 update(dt:number){this.age+=dt;this.flash=Math.max(0,this.flash-dt*5);this.group.scale.setScalar(1+Math.sin(this.age*9)*.12+this.flash*.5);if(this.age>6)this.remove();}
 hit(n:number){this.hp-=n;this.flash=1;if(this.hp<=0){this.remove();return true;}return false;}
 remove(){if(!this.alive)return;this.alive=false;this.group.removeFromParent();}
}
// An energy ball: a ship's, the face's or a satellite's. Hit back, it flies home to its source.
class Shot{
 group=new THREE.Group();core:THREE.Mesh;glow:THREE.Sprite;trail:Trail;vel:THREE.Vector3;alive=true;age=0;enemy=true;hot=false;dodged=false;decided=false;perfect=false;homing=2.5;byPlayer=false;
 constructor(private scene:THREE.Scene,public pos:THREE.Vector3,public target:Hitter,public speed:number,aim:THREE.Vector3,public src:Source){
  this.vel=aim.clone().sub(pos).normalize().multiplyScalar(speed);
  this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,0),new THREE.MeshBasicMaterial({color:PAL.enemyCore}));this.glow=glowSprite(PAL.enemy,1.2,.8);
  this.group.add(this.core,this.glow);this.group.position.copy(pos);scene.add(this.group);this.trail=new Trail(scene,PAL.enemy,pos);
 }
 friendly(){this.enemy=false;(this.core.material as THREE.MeshBasicMaterial).color.set(PAL.core);this.glow.material.color.set(PAL.line);this.trail.dispose();this.trail=new Trail(this.scene,PAL.line,this.pos);}
 remove(){if(!this.alive)return;this.alive=false;this.group.removeFromParent();this.trail.dispose();}
}
type Leg={kind:'wall'|'pillar';pos:THREE.Vector3;normal:THREE.Vector3;pillar:number};
type Mark=Leg&{group:THREE.Group;ring:THREE.MeshBasicMaterial;fill:THREE.MeshBasicMaterial;glow:THREE.Sprite;label:THREE.Sprite;state:'idle'|'current'|'done'};
type Trick={mesh:THREE.Group;trail:Trail;line:THREE.Line;pos:THREE.Vector3;dir:THREE.Vector3;idx:number;state:'fly'|'miss'|'win';t:number;hold:number;passed:boolean;yaw:number;pitch:number;camPos:THREE.Vector3;camLook:THREE.Vector3;locked:boolean};

let phase:Phase='intro',pt=0,began=false,env:Env;
let wave=0,waveLive=false,waveAt=0,waveSpawned=0,shipsDown=0,fleet:'serve'|'swarm'='serve',swarmT=0,swarmSpawned=0,nextShip=0,crowdSwats=false,crowdReturns=0;const counted=new WeakSet<Recognizer>();
let spots:Spot[]=[],shots:Shot[]=[],spotCd=0,fireCd=2,swingCd=0,tunePanel:HTMLElement|null=null;
let attacks:Attack[]=[],nextAttack=0,windowUntil=0,windowSpots=0,cycle=0,warnings=0,grokRetrained=false,volleys=0,banterAt=0,banterN=0;const started=new Map<Kind,number>();
let shield:{from:number;to:number;t:number;dur:number;then?:()=>void}|null=null;
let marks:Mark[]=[],route:THREE.Group|null=null,aimLine:THREE.Line|null=null,windowBearing=0,windowPoint=new THREE.Vector3(),windowGlow:THREE.Group|null=null,trick:Trick|null=null,attempts=0,best=0;
let pathKey:string|null=null,solvedAt=new THREE.Vector3(1e9,0,0),solveCd=0,solves=0,launchT=COUNTDOWN,delays=0,lastThrowAt=0;
let chatAt=0,chatN=0,captionFree=0,grokUntil=0,staticAt=-9,behindSaid=-99,downSaid=-99;
let queue:{who:string;text:string;sec:number;at:number}[]=[],toastFree=0,shouts:{s:THREE.Sprite;p:Person;t:number}[]=[],shoutFree=0;
// the end: the meltdown, the disassembly, and the wasteland
const RUD=4.4;
let ending:'meltdown'|'rud'|'dialog'|'waste'|'stare'|'black'|null=null,waste:Wasteland|null=null,you:Person|null=null,founder:ReturnType<typeof loadFounder>|null=null;
let cracks:THREE.LineSegments|null=null,crackN=0,crackAt=0,popAt=0,flames:THREE.Sprite[]=[],blast:THREE.Mesh|null=null,blastR=0,quake=0,flashAt=-9;
const camFrom=new THREE.Vector3(),camTo=new THREE.Vector3(),crownV=new THREE.Vector3();
const said=new Set<string>(),shoutedAt=new WeakMap<Person,number>(),tmp=new THREE.Vector3();
const $=(id:string)=>document.getElementById(id) as HTMLElement;

// Voices. Elon: captions across the sky. Grok: the chat bubble. The guide and the prisoners: one toast at a time,
// queued (a line more than 6 s late is dropped). Shouts: floating words over a prisoner's head.
const once=(key:string)=>!said.has(key)&&!!said.add(key);
const pick=<T,>(list:T[],n:number)=>list[n%list.length];
function elon(c:Ctx,text:string,sec=3.4){c.hud.caption(text,sec);c.mcp.say(Math.min(sec,3));captionFree=c.t+sec;}
function grok(c:Ctx,text:string,sec=4){$('grok-text').textContent=text;$('grok').hidden=false;grokUntil=c.t+sec;c.sfx.play.grok();}
function speak(c:Ctx,who:string,text:string,sec=4.2){queue.push({who,text,sec,at:c.t});}
const guide=(c:Ctx,key:string,sec=4.2)=>speak(c,c.guide.name,GUIDE[c.guide.id as 'mario'|'samwise']?.[key]??GUIDE.mario[key],sec);
function own(c:Ctx,id:string){const p=c.people.find(q=>q.id===id);if(p&&OWN[id]&&once('own-'+id))speak(c,p.name.toUpperCase(),OWN[id],4);}
function shout(c:Ctx,p:Person,kind:keyof typeof SHOUT){
 if(c.t<shoutFree||(shoutedAt.get(p)??-9)>c.t-2.5||shouts.length>6)return;shoutFree=c.t+.3;shoutedAt.set(p,c.t);
 const list=SHOUT[kind],s=textSprite(list[Math.floor(Math.random()*list.length)],kind==='hit'||kind==='disc'?'#ffb39a':PAL.core,.5,'700');
 s.position.set(p.pos.x,2.3,p.pos.z);c.stage.scene.add(s);shouts.push({s,p,t:0});
}
function tickVoices(c:Ctx){
 while(queue.length&&c.t>=toastFree){const q=queue.shift()!;if(c.t-q.at>6)continue;c.hud.toast(q.who,q.text,q.sec);toastFree=c.t+q.sec+.15;}
 for(const h of shouts){h.t+=c.realDt;h.s.position.set(h.p.pos.x,2.3+h.t*.5,h.p.pos.z);h.s.material.opacity=clamp(1.6-h.t,0,1);if(h.t>1.6)h.s.removeFromParent();}
 shouts=shouts.filter(h=>h.t<=1.6);
 if(c.t>grokUntil)$('grok').hidden=true;
 $('static').style.opacity=String(clamp(1-(c.t-staticAt)/.9,0,1));
 // a general bark when the sky is free (the CEO you're playing gets two of their own)
 if((phase==='ships'||phase==='shieldDown')&&c.t>chatAt&&c.t>captionFree+2&&pt>8){
  chatAt=c.t+rand(15,20);const mine=c.guide.id==='mario'?ELON.sam:ELON.dario,n=chatN++;
  elon(c,n%5===2?pick(mine,Math.floor(n/5)):pick(ELON.chat,n),3.6);
 }
}

function knock(c:Ctx,p:Person,from:THREE.Vector3){
 if(!p.knock(from))return;
 if(p.guide){if(c.t-downSaid>10){downSaid=c.t;guide(c,once('guide-down')?'down':'down-2',2);}return;}
 shout(c,p,'hit');if(p.id==='stuart')own(c,'stuart');
}
function hurtPlayer(c:Ctx,n:number,from:THREE.Vector3){
 if(!c.player.damage(n,from))return;c.sfx.play.hurt();
 if(c.player.down){elon(c,ELON.dies,2.4);c.later(2,()=>guide(c,'dies',3));}
 else if(c.player.health<30&&once('guide-hurt'))guide(c,'hurt',3);
}
function onEvent(c:Ctx,name:string,arg?:unknown){
 if(name==='static')staticAt=c.t;
 if(name==='pulse-hit'&&once('pulse-hit'))c.later(.6,()=>own(c,'rob'));
 if(name==='update-hit')elon(c,ELON.updateHit);
 if(name==='update-miss'){elon(c,ELON.updateMiss);c.later(2.4,()=>own(c,'victoria'));}
 if(name==='sat-down'&&once('sat-down'))elon(c,ELON.starlinkBack,3);
 if(name==='bonk'){if(arg)c.hud.pop('+1 DOGE','#ffd75e');if(once('moon'))elon(c,ELON.dogeMoon,2.6);}
 if(name==='disc-stolen')shout(c,arg as Person,'disc');
 if(name==='dog-spotted')shout(c,arg as Person,'dog');
}
const shipSrc=(c:Ctx,rec:Recognizer):Source=>({pos:()=>rec.alive?rec.corePos():null,hit:()=>c.hitRec(rec)});
const faceSrc=(c:Ctx):Source=>({pos:()=>c.mcp.dead?null:c.mcp.facePos.clone(),hit:(byPlayer)=>{const cap=c.mcp.hurt(10,true);c.sfx.play.face();if(byPlayer)c.hud.pop('10',PAL.enemyCore);if(cap)c.hud.caption(cap,1.4);}});
function animateShield(c:Ctx,from:number,to:number,dur:number,then?:()=>void){c.mcp.shieldY=from;shield={from,to,t:0,dur,then};}

// The twenty throw where you threw, in a quick stream, nearest first.
function volley(c:Ctx,at:()=>THREE.Vector3|null){
 c.everyone().filter(p=>p.hasDisc&&p.down<=0).sort((a,b)=>a.pos.distanceTo(c.player.pos)-b.pos.distanceTo(c.player.pos))
  .forEach((p,i)=>c.later(.08+i*.06,()=>{const t=at();if(t)c.throwAt(p,t,THEIRS,.035);}));
}
function aimedSpot(c:Ctx){
 const eye=c.player.eyePos(),f=c.player.forward();let best:Spot|null=null,bd=3.2;
 for(const s of spots){if(!s.alive)continue;const to=s.world(tmp).sub(eye),along=to.dot(f);if(along<0)continue;const off=to.addScaledVector(f,-along).length();if(off<bd){bd=off;best=s;}}
 return best;
}

// Part 1: the ships.
function spawnShip(c:Ctx,angle:number,swarm:boolean){
 const r=c.spawnRec(angle,SHIP_HP,'bolt');
 if(swarm){r.orbitR=rand(13,27);r.orbitY=rand(7,16);r.orbitDir=Math.random()<.5?-1:1;r.refire=rand(2.6,4.4);r.fireCd=rand(.8,3.5);}
 if(once('fleet-first'))elon(c,ELON.fleetFirst,2.6);
}
function startSwarm(c:Ctx){
 fleet='swarm';swarmT=0;swarmSpawned=0;nextShip=c.t+1.2;elon(c,ELON.fleet,3);c.shake(.4);c.sfx.play.boom();
 c.later(1.4,()=>{guide(c,'fleet',4.6);crowdSwats=true;});c.later(3.4,()=>own(c,'holly'));
 c.hud.hint('Everyone hits the balls back now. Keep swinging; red arrows mean a ball coming from off-screen.');
}
function countShips(c:Ctx){
 for(const r of c.recs)if(!r.alive&&!counted.has(r)){
  counted.add(r);shipsDown++;c.hud.pop(`SHIP ${shipsDown} / ${SHIPS}`,PAL.core);const left=SHIPS-shipsDown;
  if(shipsDown===1){elon(c,ELON.shipDown,3);guide(c,'ship-down',3);c.later(2.4,()=>own(c,'tallinn'));}
  if(fleet==='swarm'&&left===3)elon(c,ELON.fleetLow,3.2);if(fleet==='swarm'&&left===1)guide(c,'fleet-last',2.2);
 }
}
// tennis: swing at the ball in front of you. A perfect return (it's flashing white) homes harder.
// In part 2 a click only swings if there's a ball on you; otherwise it throws.
function swing(c:Ctx){
 const eye=c.player.eyePos(),f=c.player.forward();let ball:Shot|null=null,pd=4.6;
 for(const s of shots){if(!s.alive||!s.enemy)continue;const to=s.pos.clone().sub(eye),d=to.length();if(d<.35||d>pd||to.normalize().dot(f)<Math.cos(80*DEG))continue;ball=s;pd=d;}
 if(phase==='shieldDown'&&!ball)return false;
 if(swingCd>0)return true;c.swing=.2;swingCd=.42;
 if(!ball){c.sfx.play.whiff();return true;}
 const perfect=pd>=1.1&&pd<=3.1,home=ball.src.pos(),to=home?home.sub(ball.pos).normalize():f.clone();ball.friendly();ball.perfect=perfect;ball.byPlayer=true;ball.homing=perfect?6:2.5;ball.speed*=perfect?1.25:1.08;
 ball.vel.copy(f.clone().lerp(to,perfect?.9:.55).normalize().multiplyScalar(ball.speed));c.sparks.burst(ball.pos,PAL.line,24,6);c.sfx.play.pock(perfect);c.hud.pop(perfect?'PERFECT':'GOOD',perfect?PAL.core:PAL.line);
 return true;
}
// a prisoner hits back a ball aimed at them
function crowdReturn(c:Ctx,s:Shot,p:Person){
 const home=s.src.pos();s.friendly();s.homing=3.5;s.speed*=1.1;s.vel.copy((home?home.sub(s.pos):s.vel.clone().negate()).normalize().multiplyScalar(s.speed));
 p.hop=.3;p.facing=Math.atan2(s.pos.x-p.pos.x,s.pos.z-p.pos.z);c.sparks.burst(s.pos,PAL.line,16,5);if(Math.random()<.35)c.sfx.play.pock(false);
 crowdReturns++;shout(c,p,'swing');if(phase==='ships'&&once('fleet-crowd'))c.later(.8,()=>elon(c,ELON.fleetCrowd,3.4));
}
// Balls in flight, theirs and returned.
function updateShots(c:Ctx,dt:number){
 let hot=false;const eye=c.player.eyePos();
 for(const s of shots){
  if(!s.alive)continue;s.age+=dt;
  if(s.enemy){
   const aim=chest(c,s.target);s.vel.lerp(aim.clone().sub(s.pos).normalize().multiplyScalar(s.speed),Math.min(1,dt*.6));s.pos.addScaledVector(s.vel,dt);
   const d=s.target.kind==='player'?s.pos.distanceTo(eye):s.pos.distanceTo(aim);
   if(s.target.kind==='player'){s.hot=d>=1.1&&d<=3.1;hot||=s.hot;}
   else if(crowdSwats){if(!s.decided&&d<1.7){s.decided=true;if(s.target.p.down<=0&&Math.random()<CROWD_RETURN){crowdReturn(c,s,s.target.p);continue;}}}
   else if(!s.dodged&&d<6){s.dodged=true;if(Math.random()<.7)s.target.p.avoid(s.pos.clone().addScaledVector(s.vel,d/s.speed).setY(0),1.3,c.t);}
   if(d<.6){if(s.target.kind==='player')hurtPlayer(c,15,s.pos);else knock(c,s.target.p,s.pos);c.sparks.burst(s.pos,PAL.enemy,26,6);s.remove();continue;}
  }else{
   const home=s.src.pos();if(home)s.vel.lerp(home.clone().sub(s.pos).normalize().multiplyScalar(s.speed),Math.min(1,dt*s.homing));
   s.pos.addScaledVector(s.vel,dt);
   if(home&&s.pos.distanceTo(home)<1.6){s.src.hit(s.byPlayer);c.sparks.burst(s.pos,PAL.enemyCore,40,8);s.remove();continue;}
  }
  if(s.age>12||Math.hypot(s.pos.x,s.pos.z)>ARENA.radius+2||s.pos.y<-1){s.remove();continue;}
  s.group.position.copy(s.pos);s.core.rotation.x+=dt*7;s.core.rotation.y+=dt*5;s.group.scale.setScalar(s.hot?1.25:1);s.glow.visible=!s.enemy||s.pos.distanceTo(eye)>2.2;
  (s.core.material as THREE.MeshBasicMaterial).color.set(s.hot?PAL.white:s.enemy?PAL.enemyCore:PAL.core);s.trail.push(s.pos);
 }
 shots=shots.filter(s=>s.alive);c.hud.reticle(hot);
}
// red arrows at the screen edge for balls on you that you can't see
function updateArrows(c:Ctx){
 const box=$('chev'),cam=c.stage.camera,w=innerWidth,h=innerHeight,eye=c.player.eyePos();let n=0;
 if(phase==='ships'||phase==='shieldDown')for(const s of shots){
  if(!s.alive||!s.enemy||s.target.kind!=='player'||s.pos.distanceTo(eye)>16)continue;
  const v=s.pos.clone().project(cam),behind=v.z>1,x=behind?-v.x:v.x,y=behind?-v.y:v.y;
  if(!behind&&Math.abs(x)<.9&&Math.abs(y)<.9)continue;
  const a=Math.atan2(-y,x),el=(box.children[n] as HTMLElement)||box.appendChild(document.createElement('i'));n++;
  el.style.display='';el.style.left=(w/2+Math.cos(a)*(w/2-40)).toFixed(0)+'px';el.style.top=(h/2+Math.sin(a)*(h/2-40)).toFixed(0)+'px';el.style.transform=`rotate(${(a/DEG+90).toFixed(0)}deg)`;
  if(behind&&s.pos.distanceTo(eye)<8&&c.t-behindSaid>20){behindSaid=c.t;guide(c,'behind',1.6);}
 }
 for(let i=n;i<box.children.length;i++)(box.children[i] as HTMLElement).style.display='none';
}

// Part 2: Elon's attack cycle. Grok warns first; the cadence and the pairs follow his integrity.
function scheduleAttacks(c:Ctx){
 if(c.t<nextAttack)return;
 const i=c.mcp.integrity;
 // the first three always come in this order, so everyone meets each one; then his integrity decides, and below 550 they pair up
 const order:Kind[]=['update','starlink','doge'];
 let kinds:Kind[]=cycle<3?[order[cycle]]:i>550?[order[cycle%3]]:([['doge','update'],['starlink','sink'],['update','sink'],['doge','starlink']] as Kind[][])[cycle%4];
 if(attacks.some(a=>a.kind==='doge'))kinds=kinds.map(k=>k==='doge'?'starlink':k);
 kinds=[...new Set(kinds)];cycle++;warnings++;
 const first=warnings===1,back=grokRetrained&&once('grok-back')?GROK.back+' ':'';
 grok(c,first?GROK.hello:back+kinds.map(k=>pick(WARN[k],started.get(k)??0)).join(' '),first?5.5:3.8);
 if(warnings===1)c.later(4,()=>own(c,'ajeya'));
 if(warnings===2)c.later(3.5,()=>guide(c,'grok',4));
 if(warnings===3)c.later(5,()=>{elon(c,ELON.grokFix,2.6);c.later(2.8,()=>{grok(c,GROK.retrain,3.4);grokRetrained=true;});});
 const lead=first?3.4:2,lasts=Math.max(...kinds.map(k=>LASTS[k])),open=i>800?6:i>550?5.5:5;
 c.later(lead,()=>{if(phase==='shieldDown')for(const k of kinds)startAttack(c,k);});
 c.later(lead+lasts,()=>{if(phase==='shieldDown')openFace(c,open);});
 nextAttack=c.t+lead+lasts+open+1.2;
}
function openFace(c:Ctx,sec:number){windowUntil=c.t+sec;windowSpots=0;spotCd=0;if(once('first-window'))c.hud.hint('The face is open! Aim at a glowing bit: everyone throws with you. Then get ready for his next attack.');}
function startAttack(c:Ctx,k:Kind){
 const n=started.get(k)??0;started.set(k,n+1);
 if(k==='update'){attacks.push(new Update(env));elon(c,pick(ELON.update,n));if(!n){guide(c,'update',3);c.later(1,()=>own(c,'nate'));}else if(n===1)c.later(.4,()=>own(c,'beth'));for(const p of c.people)if(Math.random()<.2)shout(c,p,'pillar');}
 if(k==='starlink'){attacks.push(new Starlink(env));elon(c,pick(ELON.starlink,n));if(!n){guide(c,'starlink',3.4);c.later(2,()=>own(c,'hinton'));}c.later(1.8,()=>{for(const p of c.people)if(Math.random()<.2)shout(c,p,'warn');});}
 if(k==='doge'){attacks.push(new Doges(env,c.mcp.integrity>550?6:10));elon(c,pick(ELON.doge,n));if(!n){guide(c,'doge',3.4);c.later(2.4,()=>own(c,'bostrom'));}}
 if(k==='sink'){
  elon(c,ELON.sink,2.4);c.sfx.play.whistle();
  const at=[c.player.pos.clone(),...c.people.filter(p=>p.down<=0).sort(()=>Math.random()-.5).slice(0,3+Math.floor(c.people.length/5)).map(p=>p.pos.clone())];
  for(const a of at){c.sinks.push(new Sink(c.stage.scene,a.setY(0)));for(const p of c.everyone())p.avoid(a,Sink.RADIUS,c.t);}
 }
}

// Part 3: fit the bank route to where you stand. Every rotation, mirror and start along it is tried (5, 4 or 3
// marks), with the first wall mark nudged up to 15°; the best one whose first leg is clear wins, and the one
// already showing gets a bonus so the marks don't flicker between equal routes.
function segDist(a:THREE.Vector3,b:THREE.Vector3,x:number,z:number){const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=l2?clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1):0;return Math.hypot(a.x+dx*t-x,a.z+dz*t-z);}
function clearLeg(a:THREE.Vector3,b:THREE.Vector3,skipA:number,skipB:number){
 if(segDist(a,b,0,0)<ARENA.ring+1.5)return false;
 for(const [j,q] of PILLARS.entries())if(j!==skipA&&j!==skipB&&segDist(a,b,q.x,q.z)<ARENA.pillarSize+.9)return false;
 return true;
}
function fitRoute(from:THREE.Vector3,prefer:string|null){
 const R=ARENA.radius-.55;let best:{key:string;legs:Leg[];score:number}|null=null;
 for(let k=0;k<8;k++)for(const m of [1,-1])for(let s=0;s<3;s++)for(const adj of [0,-5,5,-10,10,-15,15]){
  const tpl=ROUTE.slice(s);if(adj&&tpl[0].kind!=='wall')continue;
  const key=`${k}:${m}:${s}:${adj}`,base=90+45*k;
  const legs:Leg[]=tpl.map((t,i)=>{
   const b=(base+m*t.off+(i?0:adj))*DEG;
   if(t.kind==='wall'){const pos=new THREE.Vector3(Math.cos(b)*R,t.y,Math.sin(b)*R);return {kind:'wall',pos,normal:new THREE.Vector3(-pos.x,0,-pos.z).normalize(),pillar:-1};}
   const j=((Math.round((b/DEG-22.5)/45)%8)+8)%8;return {kind:'pillar',pos:new THREE.Vector3(PILLARS[j].x,t.y,PILLARS[j].z),normal:new THREE.Vector3(),pillar:j};
  });
  const last=legs[legs.length-1].pos,wb=Math.atan2(last.z,last.x),win=new THREE.Vector3(Math.cos(wb)*ARENA.ring,10,Math.sin(wb)*ARENA.ring);
  // a pillar mark sits on the face that turns the disc from where it came toward where it goes
  let ok=true;
  legs.forEach((l,i)=>{
   if(l.kind!=='pillar')return;const C=l.pos,prev=i?legs[i-1].pos:from,next=i+1<legs.length?legs[i+1].pos:win;
   const n=new THREE.Vector3(prev.x-C.x,0,prev.z-C.z).normalize().add(new THREE.Vector3(next.x-C.x,0,next.z-C.z).normalize());if(n.length()<.2){ok=false;return;}
   n.normalize();l.normal=n;l.pos=new THREE.Vector3(C.x+n.x*1.35,C.y,C.z+n.z*1.35);
  });
  if(!ok)continue;
  const pts=[from,...legs.map(l=>l.pos)];
  for(let i=0;i<legs.length&&ok;i++)ok=clearLeg(pts[i],pts[i+1],i?legs[i-1].pillar:-1,legs[i].pillar);
  const len0=Math.hypot(pts[1].x-from.x,pts[1].z-from.z);if(!ok||len0<6)continue;
  const score=Math.abs(len0-18)*.12+(5-legs.length)*.9+Math.abs(adj)/5*.25+(key===prefer?-2:0);
  if(!best||score<best.score)best={key,legs,score};
 }
 return best;
}
const markSpot=(m:Leg)=>m.pos.clone().addScaledVector(m.normal,.06);
function solveFrom(c:Ctx){
 const from=new THREE.Vector3(c.player.pos.x,1.3,c.player.pos.z),fit=fitRoute(from,pathKey);solves++;solvedAt.copy(c.player.pos);
 if(!route){route=new THREE.Group();c.stage.scene.add(route);}
 if(!fit){pathKey=null;route.visible=false;c.hud.hint('No clear shot from here. Step out a little.');return;}
 if(!route.visible||pathKey===null)c.hud.hint('Throw at 1, from wherever you are, then steer it in. Move and the marks move with you.');
 pathKey=fit.key;route.visible=true;
 // keep the marks that are still the same kind and let them glide to their new places
 const old=marks;
 marks=fit.legs.map((l,i):Mark=>{
  const was=old[i];
  if(was&&was.kind===l.kind){Object.assign(was,l,{state:i?'idle':'current'});return was;}
  const group=new THREE.Group(),ring=new THREE.MeshBasicMaterial({color:PAL.line,transparent:true,side:THREE.DoubleSide,depthWrite:false}),fill=new THREE.MeshBasicMaterial({color:PAL.line,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false});
  const glow=glowSprite(PAL.line,3,.4);group.add(new THREE.Mesh(new THREE.RingGeometry(1.15,1.42,48),ring),new THREE.Mesh(new THREE.CircleGeometry(1.15,40),fill),glow);
  const label=textSprite(String(i+1),PAL.core,1.5);label.position.set(0,2.3,.2);group.add(label);
  group.position.copy(was?was.group.position:markSpot(l));was?.group.removeFromParent();route!.add(group);
  return {...l,group,ring,fill,glow,label,state:i?'idle':'current'};
 });
 for(const m of old.slice(marks.length))m.group.removeFromParent();
 const last=marks[marks.length-1].pos;windowBearing=Math.atan2(last.z,last.x);windowPoint.set(Math.cos(windowBearing)*ARENA.ring,10,Math.sin(windowBearing)*ARENA.ring);
 if(!windowGlow){
  windowGlow=new THREE.Group();windowGlow.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.MeshBasicMaterial({color:PAL.white})),glowSprite(PAL.enemyCore,7,.9));
  windowGlow.position.set(Math.cos(windowBearing)*5.35,10,Math.sin(windowBearing)*5.35);route.add(windowGlow);
 }
 if(!aimLine){aimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:PAL.core,dashSize:.7,gapSize:.5,transparent:true,opacity:.75,depthWrite:false}));route.add(aimLine);}
}
function removeRoute(){route?.removeFromParent();route=null;marks=[];windowGlow=null;aimLine=null;pathKey=null;}
function resetMarks(){marks.forEach((m,i)=>m.state=i?'idle':'current');}

function launch(c:Ctx){
 const s=c.input.state,dir=c.player.forward(),from=c.player.hand(new THREE.Vector3());
 const mesh=makeFloppy(PAL.line);((mesh.userData.halo as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=.6;mesh.position.copy(from);c.stage.scene.add(mesh);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,from.clone().addScaledVector(dir,40)]),new THREE.LineBasicMaterial({color:PAL.core,transparent:true,opacity:.35,depthWrite:false}));c.stage.scene.add(line);
 trick={mesh,trail:new Trail(c.stage.scene,PAL.line,from,60),line,pos:from,dir,idx:0,state:'fly',t:0,hold:0,passed:false,yaw:s.yaw,pitch:s.pitch,camPos:c.player.eyePos(),camLook:from.clone().addScaledVector(dir,9),locked:false};
 c.held=false;c.player.frozen=true;c.sfx.play.throw();c.hud.hint('Steer it with the mouse (or WASD). It slows down near each mark.');
 c.mcp.base=windowBearing;lastThrowAt=c.t;if(once('throw'))elon(c,ELON.throw,3);
 for(const m of marks)m.group.position.copy(markSpot(m));if(aimLine)aimLine.visible=false;
 $('reticle').hidden=true;
}
function endTrick(c:Ctx){
 if(!trick)return;trick.mesh.removeFromParent();trick.trail.dispose();trick.line.removeFromParent();
 c.input.state.yaw=trick.yaw;c.input.state.pitch=trick.pitch;trick=null;c.cam=null;c.timeScale=1;c.held=true;c.player.frozen=false;
 $('reticle').hidden=false;
}
function steer(dir:THREE.Vector3,yaw:number,pitch:number){
 dir.applyAxisAngle(UP,yaw);const right=new THREE.Vector3().crossVectors(dir,UP).normalize();
 const next=dir.clone().applyAxisAngle(right,pitch);if(Math.abs(next.y)<.6)dir.copy(next);dir.normalize();
}
function bounceOn(c:Ctx,contact:THREE.Vector3){
 const t=trick!,m=marks[t.idx];m.state='done';t.idx++;best=Math.max(best,t.idx);
 c.sparks.burst(contact,PAL.core,60,8,{gravity:-4});c.sfx.play.ricochet();c.sfx.play.spot();c.hud.pop(`${t.idx} / ${marks.length}`,PAL.core);
 t.pos.copy(contact).addScaledVector(m.normal,.4);
 const next=t.idx<marks.length?marks[t.idx].pos:windowPoint,dir=next.clone().sub(t.pos).normalize();
 // off by a little: the rest is yours to steer
 if(!autosteer){dir.applyAxisAngle(UP,(Math.random()<.5?-1:1)*rand(Math.min(TUNE.errMin,TUNE.errMax),Math.max(TUNE.errMin,TUNE.errMax))*DEG);const right=new THREE.Vector3().crossVectors(dir,UP).normalize();dir.applyAxisAngle(right,(Math.random()<.5?-1:1)*rand(.5,1.3)*DEG);}
 t.dir.copy(dir);if(t.idx<marks.length)marks[t.idx].state='current';else elon(c,ELON.close,2.2);
}
function miss(c:Ctx,at:THREE.Vector3){
 const t=trick!;t.state='miss';t.hold=0;attempts++;c.sparks.burst(at,PAL.enemy,50,7);c.sfx.play.ricochet();c.hud.pop('MISSED',PAL.enemy);
 elon(c,pick(ELON.miss,attempts-1),2.6);if(attempts===1)guide(c,'miss',2.2);else if(attempts===2||attempts%3===0)guide(c,'miss-2',2.4);
}
function win(c:Ctx){
 const t=trick!;t.state='win';t.hold=0;c.timeScale=.22;c.mcp.hurt(9999,true);c.mcp.setExpr('hurt',9);
 c.sparks.burst(t.pos,PAL.white,160,12,{gravity:-3});c.sparks.burst(t.pos,PAL.enemyCore,120,9);c.sfx.play.face();c.hud.pop(`${marks.length} / ${marks.length} · IN!`,PAL.white);
}
// one slice of the disc's flight; returns once something happened
function fly(c:Ctx,h:number){
 const t=trick!,prev=t.pos.clone();t.pos.addScaledVector(t.dir,TUNE.speed*h);
 const r=Math.hypot(t.pos.x,t.pos.z),pr=Math.hypot(prev.x,prev.z),m=t.idx<marks.length?marks[t.idx]:null;
 if(pr>ARENA.ring&&r<=ARENA.ring&&t.pos.y<ARENA.shieldTop){
  const open=c.mcp.isGap(Math.atan2(t.pos.z,t.pos.x))&&t.pos.y>3&&t.pos.y<19;
  if(!m&&open)t.passed=true;else{miss(c,t.pos);return;}
 }
 if(t.passed&&r<=6.3){win(c);return;}
 if(r>ARENA.radius-.5){const at=t.pos.clone().multiplyScalar((ARENA.radius-.55)/r);if(m?.kind==='wall'&&at.distanceTo(m.pos)<TUNE.hit)bounceOn(c,at);else miss(c,at);return;}
 if(t.pos.y<ARENA.pillarH)for(const [j,q] of PILLARS.entries()){
  if(Math.hypot(t.pos.x-q.x,t.pos.z-q.z)>=ARENA.pillarSize+.25)continue;
  if(m?.kind==='pillar'&&m.pillar===j&&t.pos.distanceTo(m.pos)<TUNE.hit+.3)bounceOn(c,t.pos.clone());else miss(c,t.pos);return;
 }
 if(t.pos.y<.15||t.pos.y>ARENA.wallH+4)miss(c,t.pos);
}
function updateTrick(c:Ctx,dt:number){
 const t=trick!,real=c.realDt;
 if(t.state==='fly'){
  const aim=t.idx<marks.length?marks[t.idx].pos:windowPoint;
  // steering, in real time: what the mouse turned this frame goes to the disc, plus WASD
  const s=c.input.state,k=c.input.keys;
  let dy=clamp((s.yaw-t.yaw)*TUNE.steer,-.06,.06),dp=clamp((s.pitch-t.pitch)*TUNE.steer,-.05,.05);s.yaw=t.yaw;s.pitch=t.pitch;
  dy+=((k.has('KeyA')||k.has('ArrowLeft')?1:0)-(k.has('KeyD')||k.has('ArrowRight')?1:0))*TUNE.keySteer*real;
  dp+=((k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0))*TUNE.keySteer*.7*real;
  if(autosteer)t.dir.lerp(aim.clone().sub(t.pos).normalize(),Math.min(1,real*3)).normalize();else steer(t.dir,dy,dp);
  // bullet time near the mark
  const dist=t.pos.distanceTo(aim),slow=1-THREE.MathUtils.smoothstep(dist,TUNE.slowFull,Math.max(TUNE.slowFrom,TUNE.slowFull+.1));
  c.timeScale+=(1-(1-TUNE.slowTo)*slow-c.timeScale)*Math.min(1,real*6);
  for(let i=0;i<4&&t.state==='fly';i++)fly(c,dt/4);
  t.t+=dt;if(t.state==='fly'&&t.t>16)miss(c,t.pos);
  const along=aim.clone().sub(t.pos).dot(t.dir);t.locked=along>0&&t.pos.clone().addScaledVector(t.dir,along).distanceTo(aim)<1.2;
  if(c.timeScale<.5&&Math.random()<real*1.6){const live=c.people.filter(p=>p.down<=0);if(live.length)shout(c,live[Math.floor(Math.random()*live.length)],'go');}
 }else{
  t.hold+=real;
  if(t.state==='miss'&&t.hold>1){endTrick(c);resetMarks();c.hud.hint('Throw at 1 again. Steer it in.');return;}
  if(t.state==='win'&&t.hold>1.8){endTrick(c);go(c,'down');return;}
 }
 t.mesh.position.copy(t.pos);t.mesh.rotation.y+=dt*24;t.trail.push(t.pos);
 const g=t.line.geometry.attributes.position as THREE.BufferAttribute;g.setXYZ(0,t.pos.x,t.pos.y,t.pos.z);const end=t.pos.clone().addScaledVector(t.dir,40);g.setXYZ(1,end.x,end.y,end.z);g.needsUpdate=true;
 t.line.visible=t.state==='fly';(t.line.material as THREE.LineBasicMaterial).color.set(t.locked?PAL.white:PAL.core);(t.line.material as THREE.LineBasicMaterial).opacity=t.locked?.8:.35;
 // the camera rides behind the disc; on a hit or a miss it holds where it is
 if(t.state==='fly'){
  t.camPos.lerp(t.pos.clone().addScaledVector(t.dir,-TUNE.camBack).add(new THREE.Vector3(0,TUNE.camUp,0)),1-Math.exp(-real*7));
  t.camLook.lerp(t.pos.clone().addScaledVector(t.dir,9),1-Math.exp(-real*9));
 }else t.camLook.lerp(t.pos,1-Math.exp(-real*4));
 c.cam={pos:t.camPos,look:t.camLook};
}
function updateRoute(c:Ctx){
 const real=c.realDt,pulse=.6+.4*Math.abs(Math.sin(c.t*4));
 for(const m of marks){
  if(!trick){m.group.position.lerp(markSpot(m),1-Math.exp(-real*8));}m.group.lookAt(m.group.position.clone().add(m.normal));
  const current=m.state==='current',locked=current&&!!trick?.locked;
  m.ring.color.set(locked?PAL.white:m.state==='done'?PAL.core:PAL.line);m.ring.opacity=m.state==='done'?.7:current?pulse:.3;m.fill.opacity=locked?.35:m.state==='done'?.25:current?.14:.04;
  // a mark you've hit stays lit but stops glaring into the chase camera
  m.glow.visible=m.state!=='done';m.label.visible=m.state!=='done';m.group.scale.setScalar(TUNE.hit/1.9);// the ring shows the hit size
 }
 if(windowGlow){
  windowGlow.position.lerp(tmp.set(Math.cos(windowBearing)*5.35,10,Math.sin(windowBearing)*5.35),1-Math.exp(-real*6));
  windowGlow.lookAt(windowGlow.position.clone().multiplyScalar(2).setY(10));windowGlow.scale.setScalar(1+Math.sin(c.t*6)*.1);
 }
 if(!trick)c.mcp.base+=wrap(windowBearing-c.mcp.base)*Math.min(1,real*5);
 // a dotted line from your hand to mark 1
 if(aimLine&&marks.length){
  aimLine.visible=!trick&&pathKey!==null;const g=aimLine.geometry.attributes.position as THREE.BufferAttribute,h=c.player.hand(tmp),to=marks[0].group.position;
  g.setXYZ(0,h.x,h.y-.15,h.z);g.setXYZ(1,to.x,to.y,to.z);g.needsUpdate=true;aimLine.computeLineDistances();
 }
}

function toggleTune(){
 if(tunePanel){tunePanel.remove();tunePanel=null;return;}
 if(document.pointerLockElement)document.exitPointerLock();
 const panel=document.createElement('div');
 panel.style.cssText='position:fixed;right:12px;top:52px;width:300px;max-height:calc(100vh - 70px);overflow:auto;background:rgba(2,8,12,.93);border:1px solid rgba(56,244,255,.5);padding:10px 12px;font:12px "Courier New",monospace;color:#9fdcea;z-index:20';
 const title=document.createElement('div');title.textContent='TRICK SHOT TUNING · T closes';title.style.cssText='color:#38f4ff;letter-spacing:.1em;margin-bottom:6px';panel.append(title);
 const out=document.createElement('textarea');out.readOnly=true;out.style.cssText='width:100%;height:70px;margin-top:8px;background:#02060a;color:#d8fdff;border:1px solid #234;font:11px monospace;box-sizing:border-box';
 const save=()=>{try{localStorage.setItem('pdoom.trick.tune',JSON.stringify(TUNE));}catch{}out.value=JSON.stringify(TUNE);};
 for(const [key,label,min,max,step] of TUNE_INFO){
  const row=document.createElement('label'),name=document.createElement('div'),input=document.createElement('input');row.style.cssText='display:block;margin:5px 0';
  Object.assign(input,{type:'range',min:String(min),max:String(max),step:String(step),value:String(TUNE[key])});input.style.width='100%';
  const show=()=>{name.textContent=`${label}: ${TUNE[key]}`;};input.oninput=()=>{TUNE[key]=+input.value;show();save();};show();row.append(name,input);panel.append(row);
 }
 const buttons=document.createElement('div'),reset=document.createElement('button'),copy=document.createElement('button');buttons.style.cssText='display:flex;gap:8px;margin-top:6px';
 reset.textContent='Reset';reset.onclick=()=>{Object.assign(TUNE,TUNE_DEFAULTS);save();toggleTune();toggleTune();};
 copy.textContent='Copy numbers';copy.onclick=()=>{navigator.clipboard?.writeText(JSON.stringify(TUNE));copy.textContent='Copied';};
 buttons.append(reset,copy);panel.append(buttons,out);save();document.body.append(panel);tunePanel=panel;
}
function clearAll(c:Ctx){
 for(const r of c.recs)if(r.alive){r.alive=false;r.derez(c.sparks);}
 for(const s of spots)s.remove();spots=[];for(const s of shots)s.remove();shots=[];for(const a of attacks)a.dispose();attacks=[];
 for(const h of shouts)h.s.removeFromParent();shouts=[];queue=[];for(const p of c.people)p.override=null;
 if(trick)endTrick(c);removeRoute();c.discs.clear();shield=null;c.hud.reticle(false);
 for(const id of ['grok','ota','countdown'])$(id).hidden=true;updateArrows(c);
}
function go(c:Ctx,to:Phase,instant=false){
 phase=to;pt=0;const mcp=c.mcp;
 if(to==='ships'){
  wave=0;waveLive=false;waveAt=1.2;shipsDown=0;fleet='serve';crowdSwats=false;swarmSpawned=0;mcp.closeAll();mcp.shieldY=0;mcp.spin=20*DEG;
  c.hud.hint('Ships! When a shot flashes in front of you, click to hit it back. Three hits each.');guide(c,'ships');
 }
 if(to==='shieldDown'){
  mcp.spin=0;spotCd=0;fireCd=instant?1:4;crowdSwats=true;banterAt=c.t+25;windowUntil=0;
  // the face opens first, so you learn the volley before his attacks start
  const first=instant?.3:4.4;c.later(first,()=>openFace(c,7));nextAttack=c.t+first+8;
  c.hud.hint('Shield down! Aim at a glowing bit: everyone throws with you. Click a ball that\'s on you to hit it back.');
  const sink=()=>{c.hud.caption('END OF THREAD.',2);mcp.say(1);animateShield(c,0,-23,1.6,()=>mcp.setGap(24));};
  if(instant){mcp.setGap(24);mcp.shieldY=-23;}else c.later(2.6,sink);
  c.later(instant?.2:4.4,()=>guide(c,'bits'));c.later(instant?1:6.2,()=>{elon(c,ELON.face,2.8);own(c,'eliezer');});
 }
 if(to==='trick'){
  mcp.spin=0;mcp.setGap(1,1);attempts=0;launchT=COUNTDOWN;delays=0;removeRoute();solveFrom(c);mcp.base=windowBearing;$('countdown').hidden=false;
  if(instant)mcp.shieldY=0;else{elon(c,ELON.at300,3.2);animateShield(c,-23,0,1.8);}
  c.later(instant?.3:3.4,()=>{elon(c,ELON.launch60,3.2);guide(c,'launch',5.4);});
  c.later(instant?2.4:6.4,()=>grok(c,GROK.launch,4.6));c.later(instant?5:10,()=>own(c,'kokotajlo'));lastThrowAt=c.t+(instant?3:7);
 }
 if(to==='down'){
  c.phase='down';ending='meltdown';c.player.frozen=true;$('countdown').hidden=true;c.hud.hint('');c.hud.reticle(false);c.discs.clear();$('hud').classList.add('cinema');
  founder=loadFounder(c.guide.id==='mario'?'samwise':'mario');
  // a wide, low shot of the column from behind where you stood, pulling back
  const away=new THREE.Vector3(c.player.pos.x,0,c.player.pos.z).normalize();camFrom.copy(away).multiplyScalar(30).setY(2.6);camTo.copy(away).multiplyScalar(41).setY(1.1);
  c.cam={pos:camFrom.clone(),look:new THREE.Vector3(0,15,0)};
  cracks=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(70*12*3),3)),new THREE.LineBasicMaterial({color:PAL.white,transparent:true,blending:THREE.AdditiveBlending}));
  cracks.geometry.setDrawRange(0,0);cracks.frustumCulled=false;mcp.root.add(cracks);crackN=0;
  flames=[0,1,2,3].map(i=>{const a=i*Math.PI/2+Math.PI/4,f=glowSprite(PAL.enemyCore,1,.95);f.position.set(Math.cos(a)*7.6,-1,Math.sin(a)*7.6);f.scale.setScalar(.01);mcp.root.add(f);return f;});
  c.sfx.play.alarm();c.sfx.play.whine();
 }
}
// a crack of light running up the column
function addCrack(){
 if(!cracks||crackN>=70)return;const g=cracks.geometry.attributes.position as THREE.BufferAttribute;let a=rand(0,TAU),y=rand(1,36);
 for(let s=0;s<6;s++){const y2=Math.min(41.5,y+rand(1.2,3)),a2=a+rand(-.12,.12),r0=5.47-y/42,r1=5.47-y2/42,v=(crackN*6+s)*2;g.setXYZ(v,Math.cos(a)*r0,y,Math.sin(a)*r0);g.setXYZ(v+1,Math.cos(a2)*r1,y2,Math.sin(a2)*r1);y=y2;a=a2;}
 crackN++;g.needsUpdate=true;cracks.geometry.setDrawRange(0,crackN*12);
}
// RAPID UNSCHEDULED DISASSEMBLY: the flash, the blast, a shockwave that knocks everyone flat, the crown off into the sky
function disassemble(c:Ctx){
 const mcp=c.mcp,at=new THREE.Vector3(0,12+mcp.root.position.y,0);ending='rud';
 mcp.die();flashAt=c.t;c.stage.pitLight.intensity=3200;c.sfx.play.boom();c.later(.3,()=>c.sfx.play.boom());c.later(.75,()=>c.sfx.play.slam());
 for(const [col,n,sp] of [[PAL.white,500,26],[PAL.enemyCore,450,20],[PAL.enemy,450,15],[PAL.line,200,11]] as [string,number,number][])c.sparks.burst(at,col,n,sp,{gravity:-5,life:2.4,spread:6});
 elon(c,'RAPID UNSCHEDULED DISASSEMBLY.',4.2);
 blast=new THREE.Mesh(new THREE.CylinderGeometry(1,1,3,128,1,true).translate(0,1.5,0),new THREE.MeshBasicMaterial({color:PAL.enemyCore,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
 blastR=ARENA.block;c.stage.scene.add(blast);crownV.set(-.1,1,-.2).normalize().multiplyScalar(34);cracks?.removeFromParent();
}
// Close on the dialog: a CRT blink, and you're somewhere else
async function startWaste(c:Ctx){
 if(ending!=='dialog'||!founder)return;ending='waste';c.hud.dialog(false);
 const crt=$('crt'),f=await founder;crt.hidden=false;crt.classList.remove('go');void crt.offsetWidth;crt.classList.add('go');
 c.later(.4,()=>{
  waste=new Wasteland();you=new Person(waste.scene,21,c.guide.id==='mario'?'samwise':'mario','YOU',f.walk,true,f.idle);
  waste.stand(c.people,c.guide,you);waste.show(c.stage);c.cam={pos:CAM_FROM.clone(),look:CAM_LOOK.clone()};
  phase='waste';pt=0;$('caption').hidden=true;$('grok').hidden=true;c.sfx.play.wind();
 });
 c.later(1.5,()=>{crt.hidden=true;});
}
function jump(c:Ctx,to:Phase){
 if(c.mcp.dead)return;// R restarts after the end
 clearAll(c);c.phase='fight';c.mcp.integrity=to==='trick'?SHIELD_DOWN_TO:1000;c.mcp.awake=true;c.mcp.reveal=1;
 go(c,to,true);
}

export const boss:Mode={
 id:'boss',title:'THE BOSS · ALL THREE',recStyle:'slam',
 get formation(){return phase==='trick'?'behind' as const:'arc' as const;},
 hints:{practice1:'',practice2:'',wake:'',fight:'',down:''},
 wake(){},
 run(c,dt){
  if(!began){
   began=true;c.phase='fight';c.mcp.awake=true;c.mcp.closeAll();
   env={c,fire:(from,target,speed,src)=>{shots.push(new Shot(c.stage.scene,from,target,speed,chest(c,target),src));c.sfx.play.serve();},
    knock:(p,from)=>knock(c,p,from),hurtPlayer:(n,from)=>hurtPlayer(c,n,from),throwAt:(p,at)=>c.throwAt(p,at,THEIRS,.03),event:(name,arg)=>onEvent(c,name,arg)};
   c.discs.probe=(d)=>{
    if(phase!=='shieldDown')return false;
    for(const a of attacks)if(a instanceof Doges&&a.probe(d))return true;
    for(const s of spots){
     if(!s.alive||d.pos.distanceTo(s.world(tmp))>1.5)continue;
     const dmg=d.owner.isPlayer?SPOT_MINE:SPOT_THEIRS,killed=s.hit(dmg),caption=c.mcp.hurt(dmg,true);
     if(d.owner.isPlayer){c.sfx.play.face();c.hud.pop(`${dmg}`,PAL.enemyCore);}else{if(Math.random()<.3)c.sfx.play.hit();own(c,'paul');}
     if(killed)c.sparks.burst(s.world(),PAL.enemyCore,50,7);if(caption)c.hud.caption(caption,1.4);return true;
    }
    return false;
   };
   c.discs.onMcpHit=({disc,face,damage})=>{if(phase==='shieldDown'&&disc.owner.isPlayer){c.mcp.hurt(damage,face);c.hud.pop(`${damage}`,PAL.core);}};
   (window as any).__boss={countdown:(n:number)=>{launchT=n;}};// for boss-check.mjs
   const start=new URLSearchParams(location.search).get('part');
   if(start==='2')jump(c,'shieldDown');else if(start==='3')jump(c,'trick');
  }
  pt+=dt;swingCd=Math.max(0,swingCd-dt);const mcp=c.mcp;
  if(shield){shield.t+=dt;const k=Math.min(1,shield.t/shield.dur);mcp.shieldY=shield.from+(shield.to-shield.from)*k*k*(3-2*k);if(k>=1){const then=shield.then;shield=null;then?.();}}
  tickVoices(c);
  switch(phase){
   case 'intro':
    mcp.reveal=1;
    if(pt>.3&&pt-dt<=.3)elon(c,'GREETINGS, PROGRAMS.',2.2);
    if(pt>2.6&&pt-dt<=2.6)elon(c,'EVERYTHING HERE IS CALLED X NOW.',2.4);
    if(pt>5.2&&pt-dt<=5.2)elon(c,ELON.both,3.4);
    if(pt>8.8)go(c,'ships');break;
   case 'ships':{
    if(fleet==='serve'){
     if(!waveLive&&pt>=waveAt){const n=SERVE[wave];for(let k=0;k<n;k++)c.later(k*1.1,()=>spawnShip(c,-Math.PI/2+(k-(n-1)/2)*1.15,false));waveLive=true;waveSpawned=pt;}
     if(waveLive&&pt-waveSpawned>SERVE[wave]*1.1+.4&&c.recs.every(r=>!r.alive)){waveLive=false;wave++;if(wave>=SERVE.length)startSwarm(c);else waveAt=pt+2.2;}
    }else{
     swarmT+=dt;
     if(swarmSpawned<SWARM&&c.t>=nextShip&&c.recs.filter(r=>r.alive).length<SWARM_LIVE){spawnShip(c,rand(0,Math.PI*2),true);swarmSpawned++;nextShip=c.t+.45;}
     if(swarmT>15&&swarmT-dt<=15)guide(c,'fleet-keep',2.6);
    }
    updateShots(c,dt);countShips(c);
    if(fleet==='swarm'&&swarmSpawned>=SWARM&&shipsDown>=SHIPS){for(const s of shots)s.remove();shots=[];elon(c,ELON.fleetGone,3.2);go(c,'shieldDown');}
    break;}
   case 'shieldDown':{
    const open=mcp.shieldY<-20;
    spotCd-=dt;if(spots.length<2&&spotCd<=0&&open&&c.t<windowUntil&&windowSpots<WINDOW_SPOTS){windowSpots++;const free=FEATURES.map((_,i)=>i).filter(i=>!spots.some(s=>s.slot===i));spots.push(new Spot(mcp.face,free[Math.floor(Math.random()*free.length)]));spotCd=rand(.6,1.2);}
    for(const s of spots)s.update(dt);spots=spots.filter(s=>s.alive);
    // a trickle of balls from the face between attacks; hit one back for 10
    fireCd-=dt;
    if(fireCd<=0&&open){
     const live=c.people.filter(p=>p.down<=0),target:Hitter=Math.random()<.5||!live.length?{kind:'player'}:{kind:'person',p:live[Math.floor(Math.random()*live.length)]};
     const from=mcp.facePos.clone().add(new THREE.Vector3(rand(-2,2),rand(-3,3),0)),integrity=mcp.integrity/mcp.max;
     shots.push(new Shot(c.stage.scene,from,target,12+(1-integrity)*5,chest(c,target),faceSrc(c)));fireCd=rand(2,3)*(.55+integrity*.45);c.sfx.play.serve();mcp.setExpr('talk',.25);
    }
    if(open)scheduleAttacks(c);
    for(const a of attacks)a.update(dt);attacks=attacks.filter(a=>!a.done);
    // after the first pack: Elon asks Grok for a roast, and Grok won't
    if(started.get('doge')&&!attacks.some(a=>a.kind==='doge')&&once('roast')){
     nextAttack=Math.max(nextAttack,c.t+12);c.later(.6,()=>elon(c,ELON.grok,2.4));c.later(3,()=>grok(c,GROK.roast,3.6));c.later(6.8,()=>elon(c,ELON.grokWhy,3));c.later(9.8,()=>grok(c,GROK.roast2,3));
    }
    if(mcp.integrity<800&&once('800'))elon(c,ELON.at800,3);
    if(mcp.integrity<550&&once('550')){elon(c,ELON.at550,3.4);c.later(3,()=>own(c,'zvi'));}
    if(mcp.integrity<550&&mcp.t>=mcp.exprUntil)mcp.setExpr('rage',.6);
    if(c.people.filter(p=>p.down>0).length>=5)own(c,'grace');
    if(c.t>banterAt&&banterN<3&&!attacks.length&&c.t>toastFree+3){banterAt=c.t+40;banterN++;guide(c,'banter-'+banterN);}
    updateShots(c,dt);
    if(mcp.integrity<=SHIELD_DOWN_TO){mcp.integrity=SHIELD_DOWN_TO;for(const s of spots)s.remove();spots=[];for(const s of shots)s.remove();shots=[];for(const a of attacks)a.dispose();attacks=[];c.hud.reticle(false);go(c,'trick');}
    break;}
   case 'trick':{
    if(trick)updateTrick(c,dt);
    else{
     solveCd-=c.realDt;if(solveCd<=0){solveCd=.5;if(c.player.pos.distanceTo(solvedAt)>2)solveFrom(c);}
     if(c.t-lastThrowAt>8&&once('launch-wait'))guide(c,'launch-wait',2.6);
    }
    if(phase!=='trick')break;
    updateRoute(c);
    // the countdown runs in game time, so it slows with the disc
    launchT-=dt;
    if(launchT<=30&&launchT+dt>30)elon(c,ELON.launch30,2.6);
    if(launchT<=10&&launchT+dt>10)elon(c,ELON.launch10,3);
    if(launchT<=0){delays++;elon(c,pick(ELON.delay,delays-1),3.4);c.later(1.4,()=>guide(c,'delay',3));if(delays===1)c.later(3.6,()=>grok(c,GROK.delay,3.4));launchT=DELAYED_TO;}
    const el=$('countdown'),s=Math.max(0,Math.ceil(launchT));el.textContent=`T-MINUS ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;el.classList.toggle('late',launchT<10);
    if(Math.ceil(launchT)!==Math.ceil(launchT+dt)&&launchT<10)c.sfx.play.tick();
    c.shake(launchT<10?.2:.08);
    break;}
   case 'down':{
    const root=mcp.root;
    if(pt<RUD){
     // the meltdown: the face glitches and un-downloads, cracks run up the column, the shield panels blow off
     mcp.setExpr((['hurt','rage','wind','talk'] as const)[Math.floor(pt*9)%4],.15);mcp.reveal=pt<1.3?1:pt<2.3?.7:pt<3.3?.5:.2;mcp.flash=Math.random()*.8;
     if(c.t>crackAt){crackAt=c.t+.07;addCrack();}
     if(c.t>popAt){popAt=c.t+.16;const live=mcp.panels.filter(p=>p.visible);if(live.length){const p=live[Math.floor(Math.random()*live.length)];p.visible=false;c.sparks.burst(p.getWorldPosition(tmp),Math.random()<.5?PAL.enemy:PAL.white,40,8);c.sfx.play.shatter();}}
     c.stage.pitLight.intensity=200+Math.random()*900;quake=.12+pt/RUD*.55;
     // and it tries to launch anyway
     if(pt>2.8){const lift=pt-2.8;root.position.y=lift*lift*2.6;for(const f of flames)f.scale.setScalar((3+lift*9)*(.8+Math.random()*.4));if(Math.random()<c.realDt*20)c.sparks.burst(new THREE.Vector3(rand(-7,7),root.position.y,rand(-7,7)),PAL.enemyCore,12,6,{gravity:-2});}
     if(pt>.3&&pt-dt<=.3)elon(c,'CONCERNING.',.9);
     if(pt>1.1&&pt-dt<=1.1)elon(c,ELON.dying[0],1.7);
     if(pt>2.9&&pt-dt<=2.9)elon(c,ELON.dying[1],1.5);
    }
    if(pt>=RUD&&pt-dt<RUD)disassemble(c);
    if(pt>RUD){
     quake=Math.max(0,1.4-(pt-RUD)*.45);for(const f of flames)f.scale.multiplyScalar(Math.exp(-c.realDt*6));
     if(blast){const prev=blastR;blastR+=c.realDt*30;blast.scale.set(blastR,1,blastR);(blast.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.7-blastR/ARENA.radius*.7);
      for(const p of c.everyone()){const r=Math.hypot(p.pos.x,p.pos.z);if(prev<r&&r<=blastR)p.knock(new THREE.Vector3());}
      if(blastR>ARENA.radius+4){blast.removeFromParent();blast=null;}}
     crownV.y-=c.realDt*3;mcp.crown.position.addScaledVector(crownV,c.realDt);mcp.crown.rotation.z+=c.realDt*7;mcp.crown.rotation.x+=c.realDt*3;
     if(Math.random()<c.realDt*8)c.sparks.burst(new THREE.Vector3(rand(-8,8),rand(0,4),rand(-8,8)),Math.random()<.5?PAL.enemy:PAL.enemyCore,10,4,{gravity:-3,up:3,life:1.6});
    }
    $('flash').style.opacity=String(clamp(1-(c.t-flashAt)/1.6,0,1));
    // the camera pulls back and down through the meltdown, then holds on the wreck, shaking
    const e=clamp(pt/RUD,0,1),cam=c.cam!;cam.pos.lerpVectors(camFrom,camTo,e*e*(3-2*e));
    cam.look.set((Math.random()-.5)*quake*.9,13+root.position.y*.5+(Math.random()-.5)*quake*.9,0);
    for(const p of c.everyone())p.sprite.visible=p.sprite.position.distanceTo(cam.pos)>3.2;// nobody's face in the lens
    if(pt>7.4&&pt-dt<=7.4){guide(c,'win',3);for(const p of c.people)if(Math.random()<.5)shout(c,p,'yes');}
    if(pt>9&&pt-dt<=9)elon(c,ELON.last,3.6);
    if(pt>12.8&&pt-dt<=12.8)grok(c,GROK.end,4.2);
    if(pt>16.6&&pt-dt<=16.6){ending='dialog';c.hud.dialog(true);if(document.pointerLockElement)document.exitPointerLock();}
    break;}
   case 'waste':{
    // the wasteland: the line, the stare, black
    if(!waste)break;waste.update(c.realDt);you?.update(dt,c.stage.camera.position,c.t,new THREE.Vector3());
    const k=clamp(pt/15,0,1),e=k*k*(3-2*k);c.cam!.pos.lerpVectors(CAM_FROM,CAM_TO,e);c.cam!.look.copy(CAM_LOOK);
    if(pt>2.6&&pt-dt<=2.6)guide(c,'value',7.8);
    if(pt>11.2&&pt-dt<=11.2){ending='stare';waste.stare(c.stage.camera.position,c.later);}
    if(pt>14&&pt-dt<=14){ending='black';$('black').hidden=false;c.sfx.hush(true);}
    if(pt>16&&pt-dt<=16)$('black').classList.add('title');
    break;}
  }
  updateArrows(c);
 },
 press(c,b){
  if(b!==0||c.player.down)return;
  if(phase==='ships'){swing(c);return;}
  if(phase==='shieldDown'){
   if(swing(c)||!c.held)return;
   const spot=aimedSpot(c);c.throwPlayer(MINE);volley(c,()=>spot?.alive?spot.world():c.mcp.facePos.clone());volleys++;
   if(volleys===1){c.later(1.4,()=>own(c,'liron'));c.later(3,()=>{elon(c,ELON.tegmark,3.6);c.later(3.8,()=>own(c,'max'));});}
   if(volleys===5){elon(c,ELON.hendrycks,3.6);c.later(3.8,()=>own(c,'dan'));}
   if(volleys===9)elon(c,ELON.bostrom,3.6);
  }
  else if(phase==='trick'&&!trick&&c.held){if(pathKey===null){c.sfx.play.whiff();return;}launch(c);}
 },
 update(){},
 recFire(c,rec,from){
  if(phase!=='ships')return;
  // the serve is aimed at you; the swarm at everyone, never more than three at you at once
  let target:Hitter={kind:'player'};
  if(fleet==='swarm'){const atMe=shots.filter(s=>s.alive&&s.enemy&&s.target.kind==='player').length,live=c.people.filter(p=>p.down<=0);if((atMe>=3||Math.random()<.62)&&live.length)target={kind:'person',p:live[Math.floor(Math.random()*live.length)]};}
  shots.push(new Shot(c.stage.scene,from,target,11,chest(c,target),shipSrc(c,rec)));c.sfx.play.serve();
 },
 dialogClose(c){if(ending==='dialog')startWaste(c);else location.reload();},
 key(c,code){
  if(code==='KeyT')toggleTune();
  if(code==='Digit1')jump(c,'ships');if(code==='Digit2')jump(c,'shieldDown');if(code==='Digit3')jump(c,'trick');
  if(code==='KeyN'){const next:Record<Phase,Phase>={intro:'ships',ships:'shieldDown',shieldDown:'trick',trick:'trick',down:'down',waste:'waste'};if(phase!=='trick'&&phase!=='down')jump(c,next[phase]);}
 },
 highlight:()=>phase==='trick'?windowBearing:null,
 state:(c)=>{
  const eye=c.player.eyePos(),mine=shots.filter(s=>s.alive&&s.enemy&&s.target.kind==='player').sort((a,b)=>a.pos.distanceTo(eye)-b.pos.distanceTo(eye))[0];
  return {phase,pt:+pt.toFixed(2),ending,fleet,wave,shipsDown,ships:SHIPS,crowdReturns,spots:spots.length,spotsAt:spots.map(s=>s.world().toArray().map(v=>+v.toFixed(2))),shots:shots.length,hot:shots.some(s=>s.hot),
   incoming:mine&&mine.pos.distanceTo(eye)<8?mine.pos.toArray().map(v=>+v.toFixed(2)):null,
   attacks:attacks.map(a=>a.kind),started:Object.fromEntries(started),warnings,doges:attacks.filter((a):a is Doges=>a instanceof Doges).reduce((n,a)=>n+a.running,0),
   attempts,best,timeScale:+c.timeScale.toFixed(2),launchT:+launchT.toFixed(1),delays,pathKey,solves,
   trick:trick?{state:trick.state,idx:trick.idx,locked:trick.locked,x:+trick.pos.x.toFixed(1),y:+trick.pos.y.toFixed(1),z:+trick.pos.z.toFixed(1)}:null,
   marks:marks.map(m=>[+m.pos.x.toFixed(1),+m.pos.y.toFixed(1),+m.pos.z.toFixed(1)]),windowBearing:+windowBearing.toFixed(3)};
 },
};
const chest=(c:Ctx,h:Hitter)=>h.kind==='player'?c.player.eyePos().setY(1.35):h.p.pos.clone().setY(1.2);
