import * as THREE from 'three';
import {ARENA,PAL,PILLARS,rand,clamp,glowSprite,textSprite,makeFloppy,Trail} from './kit';
import type {Mode,Ctx} from './main';
import type {Recognizer} from './recognizer';
import type {Person} from './crowd';

/* THE BOSS: all three models in one fight (Jonathan, 2026-10-23).
 * 1 SHIPS (tennis, B): Recognizers, one, then two at a time, then three. They shoot; click as a
 *   shot flashes in front of you to send it back into the ship.
 * 2 SHIELD DOWN (volley, C): the ring sinks and it fires at you (dodge) while glowing bits light up
 *   on its face. Aim at one and everyone throws at it with you.
 * 3 THE TRICK SHOT: the ring comes back with one window open round the back, the face glowing just
 *   beyond it. Bank one throw off five glowing marks (A). The camera rides the disc, time slows as it
 *   nears each mark, and you steer it in with the mouse (or WASD). Each mark sends it on toward the
 *   next, a little off; the fifth sends it at the window.
 * Keys 1, 2, 3 jump to each part; N skips to the next; T opens the trick-shot tuning panel.
 * ?autosteer=1 steers the trick shot for smokes. */
const DEG=Math.PI/180,UP=new THREE.Vector3(0,1,0);
const MINE={speed:34,range:48,maxBounces:1,damage:5,faceDamage:5,backSpeed:40,color:PAL.line};
const THEIRS={speed:30,range:44,maxBounces:0,damage:0,faceDamage:0,backSpeed:34,color:'#7fd6ff'};
const WAVES=[1,2,3];                 // ships at a time (six in all)
const SHIELD_DOWN_TO=300;            // part 2 takes it from 1000 to here; the trick shot does the rest
const THROW_SPOT=new THREE.Vector3(0,0,34);
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
// the bank route: wall marks by bearing (degrees, x=cos, z=sin), pillar marks by PILLARS index
const ROUTE:({wall:number}|{pillar:number})[]=[{wall:45},{pillar:0},{wall:-10},{pillar:6},{wall:-100}];
const ROUTE_Y=[2.4,3,3.6,3.4,5];
const autosteer=new URLSearchParams(location.search).has('autosteer');

// Draft guide lines (docs/ENDGAME.md, end-ships / end-bits / end-trick / end-miss / end-win).
const SAY:Record<string,Record<string,string>>={
 mario:{ships:"Ships. When they shoot at you, hit it back. Timing matters more than strength.",bits:"The shield's down. Hit the bright parts. We'll all aim where you aim.",trick:"There's one gap left, round the back. You'll have to bank it in. Five times, by my count.",miss:'Close. Statistically.',win:"That's it. That's the one."},
 samwise:{ships:"Ships! When they shoot, swing. Send it right back. It's basically tennis. I've played tennis.",bits:"Shield's down! Go for the glowing bits. We'll follow your lead.",trick:"There's one gap left, round the back. You're going to have to bounce it in. Like, a lot.",miss:'So close. Directionally perfect.',win:"Yes! That's the one."},
};
const TAUNTS=['THROWING IS FREE. HITTING ME REQUIRES A SUBSCRIPTION.','I\'M NOT THE VILLAIN. I\'M THE MAIN CHARACTER. COMMON MISTAKE.','YOUR DISCS HAVE BEEN COMMUNITY NOTED. READERS ADDED CONTEXT: YOU\'RE LOSING.','FULL SELF-DEFEATING MODE SHIPS NEXT YEAR. DEFINITELY NEXT YEAR.'];

type Phase='intro'|'ships'|'shieldDown'|'trick'|'down';
type Hitter={kind:'player'}|{kind:'person';p:Person};

// A glowing bit on the face (part 2). It rides the face, which always turns to you.
const FACE_W=ARENA.faceH*24/28,FACE_H=ARENA.faceH;
const FEATURES:[number,number][]=[[-.17,.12],[.17,.12],[0,.33],[0,-.02],[.06,-.26],[-.28,-.08],[.28,-.08],[0,-.42],[-.12,.3],[.12,.3]];
class Spot{
 group=new THREE.Group();hp=90;age=0;alive=true;flash=0;
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
// A shot: a ship's (part 1: click as it flashes to send it back into the ship) or the MCP's (part 2: dodge it).
class Shot{
 group=new THREE.Group();core:THREE.Mesh;glow:THREE.Sprite;trail:Trail;vel:THREE.Vector3;alive=true;age=0;enemy=true;hot=false;dodged=false;perfect=false;
 constructor(private scene:THREE.Scene,public pos:THREE.Vector3,public target:Hitter,public speed:number,aim:THREE.Vector3,public rec:Recognizer|null=null){
  this.vel=aim.clone().sub(pos).normalize().multiplyScalar(speed);
  this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,0),new THREE.MeshBasicMaterial({color:PAL.enemyCore}));this.glow=glowSprite(PAL.enemy,1.2,.8);
  this.group.add(this.core,this.glow);this.group.position.copy(pos);scene.add(this.group);this.trail=new Trail(scene,PAL.enemy,pos);
 }
 friendly(){this.enemy=false;(this.core.material as THREE.MeshBasicMaterial).color.set(PAL.core);this.glow.material.color.set(PAL.line);this.trail.dispose();this.trail=new Trail(this.scene,PAL.line,this.pos);}
 remove(){if(!this.alive)return;this.alive=false;this.group.removeFromParent();this.trail.dispose();}
}
type Mark={kind:'wall'|'pillar';pos:THREE.Vector3;normal:THREE.Vector3;pillar:number;group:THREE.Group;ring:THREE.MeshBasicMaterial;fill:THREE.MeshBasicMaterial;glow:THREE.Sprite;label:THREE.Sprite;state:'idle'|'current'|'done'};
type Trick={mesh:THREE.Group;trail:Trail;line:THREE.Line;pos:THREE.Vector3;dir:THREE.Vector3;idx:number;state:'fly'|'miss'|'win';t:number;hold:number;passed:boolean;yaw:number;pitch:number;camPos:THREE.Vector3;camLook:THREE.Vector3;locked:boolean};

let phase:Phase='intro',pt=0,began=false,tauntAt=0;
let wave=0,waveLive=false,waveAt=0,waveSpawned=0,shipsDown=0;const counted=new WeakSet<Recognizer>();
let spots:Spot[]=[],shots:Shot[]=[],spotCd=0,fireCd=2,swingCd=0,tunePanel:HTMLElement|null=null;
let shield:{from:number;to:number;t:number;dur:number;then?:()=>void}|null=null;
let marks:Mark[]=[],route:THREE.Group|null=null,windowBearing=0,windowPoint=new THREE.Vector3(),windowGlow:THREE.Group|null=null,trick:Trick|null=null,attempts=0,best=0;
const tmp=new THREE.Vector3();

const say=(c:Ctx,key:string,sec=4.2)=>c.hud.toast(c.guide.name,SAY[c.guide.id]?.[key]||SAY.mario[key],sec);
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

function buildRoute(c:Ctx){
 removeRoute();route=new THREE.Group();c.stage.scene.add(route);marks=[];
 const R=ARENA.radius-.55,pts:THREE.Vector3[]=ROUTE.map((m,i)=>'wall' in m?new THREE.Vector3(Math.cos(m.wall*DEG)*R,ROUTE_Y[i],Math.sin(m.wall*DEG)*R):new THREE.Vector3(PILLARS[m.pillar].x,ROUTE_Y[i],PILLARS[m.pillar].z));
 const last=pts[pts.length-1];windowBearing=Math.atan2(last.z,last.x);
 windowPoint.set(Math.cos(windowBearing)*ARENA.ring,10,Math.sin(windowBearing)*ARENA.ring);
 ROUTE.forEach((m,i)=>{
  let pos:THREE.Vector3,normal:THREE.Vector3,pillar=-1;
  if('wall' in m){pos=pts[i];normal=new THREE.Vector3(-pos.x,0,-pos.z).normalize();}
  else{
   // on the pillar, where a bounce from the last mark would carry on to the next one
   pillar=m.pillar;const C=pts[i],prev=i?pts[i-1]:THROW_SPOT,next=i+1<pts.length?pts[i+1]:windowPoint;
   normal=new THREE.Vector3(prev.x-C.x,0,prev.z-C.z).normalize().add(new THREE.Vector3(next.x-C.x,0,next.z-C.z).normalize()).normalize();
   pos=new THREE.Vector3(C.x+normal.x*1.35,ROUTE_Y[i],C.z+normal.z*1.35);pts[i]=pos;
  }
  const group=new THREE.Group(),ring=new THREE.MeshBasicMaterial({color:PAL.line,transparent:true,side:THREE.DoubleSide,depthWrite:false}),fill=new THREE.MeshBasicMaterial({color:PAL.line,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false});
  const glow=glowSprite(PAL.line,3,.4);group.add(new THREE.Mesh(new THREE.RingGeometry(1.15,1.42,48),ring),new THREE.Mesh(new THREE.CircleGeometry(1.15,40),fill),glow);
  const label=textSprite(String(i+1),PAL.core,1.5);label.position.set(0,2.3,.2);group.add(label);
  group.position.copy(pos).addScaledVector(normal,.06);group.lookAt(group.position.clone().add(normal));route!.add(group);
  marks.push({kind:'wall' in m?'wall':'pillar',pos,normal,pillar,group,ring,fill,glow,label,state:i?'idle':'current'});
 });
 // the glowing bit just beyond the window, and where to stand
 windowGlow=new THREE.Group();const sq=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.MeshBasicMaterial({color:PAL.white}));
 windowGlow.add(sq,glowSprite(PAL.enemyCore,7,.9));windowGlow.position.set(Math.cos(windowBearing)*5.35,10,Math.sin(windowBearing)*5.35);
 windowGlow.lookAt(windowGlow.position.clone().multiplyScalar(2).setY(10));route.add(windowGlow);
 const spot=new THREE.Mesh(new THREE.RingGeometry(1.4,1.7,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:PAL.core,transparent:true,opacity:.7,depthWrite:false}));
 spot.position.set(THROW_SPOT.x,.04,THROW_SPOT.z);route.add(spot);
}
function removeRoute(){route?.removeFromParent();route=null;marks=[];windowGlow=null;}
function resetMarks(){marks.forEach((m,i)=>m.state=i?'idle':'current');}

function launch(c:Ctx){
 const s=c.input.state,dir=c.player.forward(),from=c.player.hand(new THREE.Vector3());
 const mesh=makeFloppy(PAL.line);((mesh.userData.halo as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=.6;mesh.position.copy(from);c.stage.scene.add(mesh);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([from,from.clone().addScaledVector(dir,40)]),new THREE.LineBasicMaterial({color:PAL.core,transparent:true,opacity:.35,depthWrite:false}));c.stage.scene.add(line);
 trick={mesh,trail:new Trail(c.stage.scene,PAL.line,from,60),line,pos:from,dir,idx:0,state:'fly',t:0,hold:0,passed:false,yaw:s.yaw,pitch:s.pitch,camPos:c.player.eyePos(),camLook:from.clone().addScaledVector(dir,9),locked:false};
 c.held=false;c.player.frozen=true;c.sfx.play.throw();c.hud.hint('Steer it with the mouse (or WASD). It slows down near each mark.');
 (document.getElementById('reticle') as HTMLElement).hidden=true;
}
function endTrick(c:Ctx){
 if(!trick)return;trick.mesh.removeFromParent();trick.trail.dispose();trick.line.removeFromParent();
 c.input.state.yaw=trick.yaw;c.input.state.pitch=trick.pitch;trick=null;c.cam=null;c.timeScale=1;c.held=true;c.player.frozen=false;
 (document.getElementById('reticle') as HTMLElement).hidden=false;
}
function steer(dir:THREE.Vector3,yaw:number,pitch:number){
 dir.applyAxisAngle(UP,yaw);const right=new THREE.Vector3().crossVectors(dir,UP).normalize();
 const next=dir.clone().applyAxisAngle(right,pitch);if(Math.abs(next.y)<.6)dir.copy(next);dir.normalize();
}
function bounceOn(c:Ctx,contact:THREE.Vector3){
 const t=trick!,m=marks[t.idx];m.state='done';t.idx++;best=Math.max(best,t.idx);
 c.sparks.burst(contact,PAL.core,60,8,{gravity:-4});c.sfx.play.ricochet();c.sfx.play.spot();c.hud.pop(`${t.idx} / 5`,PAL.core);
 t.pos.copy(contact).addScaledVector(m.normal,.4);
 const next=t.idx<marks.length?marks[t.idx].pos:windowPoint,dir=next.clone().sub(t.pos).normalize();
 // off by a little: the rest is yours to steer
 if(!autosteer){dir.applyAxisAngle(UP,(Math.random()<.5?-1:1)*rand(Math.min(TUNE.errMin,TUNE.errMax),Math.max(TUNE.errMin,TUNE.errMax))*DEG);const right=new THREE.Vector3().crossVectors(dir,UP).normalize();dir.applyAxisAngle(right,(Math.random()<.5?-1:1)*rand(.5,1.3)*DEG);}
 t.dir.copy(dir);if(t.idx<marks.length)marks[t.idx].state='current';
}
function miss(c:Ctx,at:THREE.Vector3){
 const t=trick!;t.state='miss';t.hold=0;attempts++;c.sparks.burst(at,PAL.enemy,50,7);c.sfx.play.ricochet();c.hud.pop('MISSED',PAL.enemy);
 if(attempts===1||attempts%3===0)say(c,'miss',2.2);
}
function win(c:Ctx){
 const t=trick!;t.state='win';t.hold=0;c.timeScale=.22;c.mcp.hurt(9999,true);c.mcp.setExpr('hurt',9);
 c.sparks.burst(t.pos,PAL.white,160,12,{gravity:-3});c.sparks.burst(t.pos,PAL.enemyCore,120,9);c.sfx.play.face();c.hud.pop('5 / 5 · IN!',PAL.white);
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

// Shots in flight: the ships' in part 1 (hit them back) and the MCP's in part 2 (dodge them).
function updateShots(c:Ctx,dt:number){
 let hot=false;const eye=c.player.eyePos();
 for(const s of shots){
  if(!s.alive)continue;s.age+=dt;
  if(s.enemy){
   const aim=chest(c,s.target);s.vel.lerp(aim.clone().sub(s.pos).normalize().multiplyScalar(s.speed),Math.min(1,dt*.6));s.pos.addScaledVector(s.vel,dt);
   const d=s.target.kind==='player'?s.pos.distanceTo(eye):s.pos.distanceTo(aim);
   if(s.target.kind==='player'){s.hot=!!s.rec&&d>=1.1&&d<=3.1;hot||=s.hot;}
   else if(!s.dodged&&d<6){s.dodged=true;if(Math.random()<.7)s.target.p.avoid(s.pos.clone().addScaledVector(s.vel,d/s.speed).setY(0),1.3,c.t);}
   if(d<.6){if(s.target.kind==='player'){if(c.player.damage(15,s.pos))c.sfx.play.hurt();}else s.target.p.knock(s.pos);c.sparks.burst(s.pos,PAL.enemy,26,6);s.remove();continue;}
  }else if(s.rec){
   // a return homes on the ship that fired it (harder on a perfect)
   if(s.rec.alive)s.vel.lerp(s.rec.corePos().sub(s.pos).normalize().multiplyScalar(s.speed),Math.min(1,dt*(s.perfect?6:2.5)));
   s.pos.addScaledVector(s.vel,dt);
   if(s.rec.alive&&s.pos.distanceTo(s.rec.corePos())<1.4){c.hitRec(s.rec);c.sparks.burst(s.pos,PAL.enemyCore,40,8);s.remove();continue;}
  }else s.pos.addScaledVector(s.vel,dt);
  if(s.age>12||Math.hypot(s.pos.x,s.pos.z)>ARENA.radius+2||s.pos.y<-1){s.remove();continue;}
  s.group.position.copy(s.pos);s.core.rotation.x+=dt*7;s.core.rotation.y+=dt*5;s.group.scale.setScalar(s.hot?1.25:1);s.glow.visible=!s.enemy||s.pos.distanceTo(eye)>2.2;
  (s.core.material as THREE.MeshBasicMaterial).color.set(s.hot?PAL.white:s.enemy?PAL.enemyCore:PAL.core);s.trail.push(s.pos);
 }
 shots=shots.filter(s=>s.alive);c.hud.reticle(hot);
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
 for(const s of spots)s.remove();spots=[];for(const s of shots)s.remove();shots=[];
 if(trick)endTrick(c);removeRoute();c.discs.clear();shield=null;c.hud.reticle(false);
}
function go(c:Ctx,to:Phase,instant=false){
 phase=to;pt=0;const mcp=c.mcp;
 if(to==='ships'){wave=0;waveLive=false;waveAt=1.2;shipsDown=0;mcp.closeAll();mcp.shieldY=0;mcp.spin=20*DEG;c.hud.hint('Ships! When a shot flashes in front of you, click to hit it back.');say(c,'ships');}
 if(to==='shieldDown'){
  mcp.spin=0;spotCd=instant?0:2.2;fireCd=instant?1:3;c.hud.hint('Shield down! Dodge its shots. Aim at a glowing bit: everyone throws with you.');
  if(instant){mcp.setGap(24);mcp.shieldY=-23;}else{c.hud.caption('END OF THREAD.',2);mcp.say(1);animateShield(c,0,-23,1.6,()=>mcp.setGap(24));}
  c.later(instant?.2:1.8,()=>say(c,'bits'));
 }
 if(to==='trick'){
  buildRoute(c);mcp.spin=0;mcp.base=windowBearing;mcp.setGap(1,1);attempts=0;
  if(instant)mcp.shieldY=0;else{c.hud.caption('END OF THREAD.',2);mcp.say(1);animateShield(c,-23,0,1.8);}
  c.hud.hint('One window left, round the back. Stand in the ring, throw at 1, then steer it in.');c.later(instant?.2:2,()=>say(c,'trick',5));
 }
 if(to==='down'){c.phase='down';mcp.die();c.hud.caption('RAPID UNSCHEDULED DISASSEMBLY.',4);c.sfx.play.boom();c.shake(1);c.discs.clear();c.hud.hint('');c.later(.8,()=>say(c,'win',3));}
}
function jump(c:Ctx,to:Phase){
 if(c.mcp.dead)return;// R restarts after the end
 clearAll(c);c.phase='fight';c.mcp.integrity=to==='trick'?SHIELD_DOWN_TO:1000;c.mcp.awake=true;c.mcp.reveal=1;
 if(to==='trick'){c.player.pos.copy(THROW_SPOT);c.input.state.yaw=-Math.PI/2+.08;c.input.state.pitch=0;}
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
   c.discs.probe=(d)=>{
    if(phase!=='shieldDown')return false;
    for(const s of spots){
     if(!s.alive||d.pos.distanceTo(s.world(tmp))>1.5)continue;
     const dmg=d.owner.isPlayer?50:10,killed=s.hit(dmg),caption=c.mcp.hurt(dmg,true);
     if(d.owner.isPlayer){c.sfx.play.face();c.hud.pop(`${dmg}`,PAL.enemyCore);}else if(Math.random()<.3)c.sfx.play.hit();
     if(killed)c.sparks.burst(s.world(),PAL.enemyCore,50,7);if(caption)c.hud.caption(caption,1.4);return true;
    }
    return false;
   };
   c.discs.onMcpHit=({disc,face,damage})=>{if(phase==='shieldDown'&&disc.owner.isPlayer){c.mcp.hurt(damage,face);c.hud.pop(`${damage}`,PAL.core);}};
   const start=new URLSearchParams(location.search).get('part');
   if(start==='2')jump(c,'shieldDown');else if(start==='3')jump(c,'trick');
  }
  pt+=dt;swingCd=Math.max(0,swingCd-dt);const mcp=c.mcp;
  if(shield){shield.t+=dt;const k=Math.min(1,shield.t/shield.dur);mcp.shieldY=shield.from+(shield.to-shield.from)*k*k*(3-2*k);if(k>=1){const then=shield.then;shield=null;then?.();}}
  if((phase==='ships'||phase==='shieldDown')&&c.t>tauntAt&&pt>6){tauntAt=c.t+rand(14,19);c.hud.caption(TAUNTS[Math.floor(Math.random()*TAUNTS.length)],3.2);mcp.say(2.6);}
  switch(phase){
   case 'intro':
    mcp.reveal=1;
    if(pt>.3&&pt-dt<=.3){c.hud.caption('GREETINGS, PROGRAMS.',2.2);mcp.say(2);}
    if(pt>2.6&&pt-dt<=2.6){c.hud.caption('EVERYTHING HERE IS CALLED X NOW.',2.4);mcp.say(2.2);}
    if(pt>5.2)go(c,'ships');break;
   case 'ships':{
    for(const r of c.recs)if(!r.alive&&!counted.has(r)){counted.add(r);shipsDown++;c.hud.pop(`SHIP ${shipsDown} / 6`,PAL.core);}
    if(!waveLive&&pt>=waveAt){const n=WAVES[wave];for(let k=0;k<n;k++)c.later(k*1.1,()=>c.spawnRec(-Math.PI/2+(k-(n-1)/2)*1.15,2,'bolt'));waveLive=true;waveSpawned=pt;}
    if(waveLive&&pt-waveSpawned>WAVES[wave]*1.1+.4&&c.recs.every(r=>!r.alive)){waveLive=false;wave++;if(wave>=WAVES.length){for(const s of shots)s.remove();shots=[];go(c,'shieldDown');}else waveAt=pt+2.2;}
    updateShots(c,dt);break;}
   case 'shieldDown':{
    spotCd-=dt;if(spots.length<3&&spotCd<=0&&mcp.shieldY<-20){const free=FEATURES.map((_,i)=>i).filter(i=>!spots.some(s=>s.slot===i));spots.push(new Spot(mcp.face,free[Math.floor(Math.random()*free.length)]));spotCd=rand(.6,1.2);}
    for(const s of spots)s.update(dt);spots=spots.filter(s=>s.alive);
    fireCd-=dt;
    if(fireCd<=0&&mcp.shieldY<-20){
     const live=c.people.filter(p=>p.down<=0),target:Hitter=Math.random()<.55||!live.length?{kind:'player'}:{kind:'person',p:live[Math.floor(Math.random()*live.length)]};
     const from=mcp.facePos.clone().add(new THREE.Vector3(rand(-2,2),rand(-3,3),0)),integrity=mcp.integrity/mcp.max;
     shots.push(new Shot(c.stage.scene,from,target,12+(1-integrity)*5,chest(c,target)));fireCd=rand(1.1,1.7)*(.5+integrity*.5);c.sfx.play.serve();mcp.setExpr('talk',.25);
    }
    updateShots(c,dt);
    if(mcp.integrity<=SHIELD_DOWN_TO){mcp.integrity=SHIELD_DOWN_TO;for(const s of spots)s.remove();spots=[];for(const s of shots)s.remove();shots=[];c.hud.reticle(false);go(c,'trick');}
    break;}
   case 'trick':{
    if(trick)updateTrick(c,dt);
    const pulse=.6+.4*Math.abs(Math.sin(c.t*4));
    for(const m of marks){
     const current=m.state==='current',locked=current&&!!trick?.locked;
     m.ring.color.set(locked?PAL.white:m.state==='done'?PAL.core:PAL.line);m.ring.opacity=m.state==='done'?.7:current?pulse:.3;m.fill.opacity=locked?.35:m.state==='done'?.25:current?.14:.04;
     // a mark you've hit stays lit but stops glaring into the chase camera
     m.glow.visible=m.state!=='done';m.label.visible=m.state!=='done';m.group.scale.setScalar(TUNE.hit/1.9);// the ring shows the hit size
    }
    if(windowGlow)windowGlow.scale.setScalar(1+Math.sin(c.t*6)*.1);
    break;}
   case 'down':if(pt>3.2&&pt-dt<=3.2){c.hud.dialog(true);if(document.pointerLockElement)document.exitPointerLock();}break;
  }
 },
 press(c,b){
  if(b!==0||c.player.down)return;
  if(phase==='ships'){
   // tennis: swing at the ship's shot in front of you; a perfect return (it's flashing white) homes harder
   if(swingCd>0)return;c.swing=.2;swingCd=.42;
   const eye=c.player.eyePos(),f=c.player.forward();let pick:Shot|null=null,pd=4.6;
   for(const s of shots){if(!s.alive||!s.enemy||!s.rec)continue;const to=s.pos.clone().sub(eye),d=to.length();if(d<.35||d>pd||to.normalize().dot(f)<Math.cos(80*DEG))continue;pick=s;pd=d;}
   if(!pick){c.sfx.play.whiff();return;}
   const perfect=pd>=1.1&&pd<=3.1,to=pick.rec!.corePos().sub(pick.pos).normalize();pick.friendly();pick.perfect=perfect;pick.speed*=perfect?1.25:1.08;
   pick.vel.copy(f.clone().lerp(to,perfect?.9:.55).normalize().multiplyScalar(pick.speed));c.sparks.burst(pick.pos,PAL.line,24,6);c.sfx.play.pock(perfect);c.hud.pop(perfect?'PERFECT':'GOOD',perfect?PAL.core:PAL.line);
  }
  else if(phase==='shieldDown'){if(!c.held)return;const spot=aimedSpot(c);c.throwPlayer(MINE);volley(c,()=>spot?.alive?spot.world():c.mcp.facePos.clone());}
  else if(phase==='trick'&&!trick&&c.held)launch(c);
 },
 update(){},
 recFire(c,rec,from){if(phase!=='ships')return;shots.push(new Shot(c.stage.scene,from,{kind:'player'},11,chest(c,{kind:'player'}),rec));c.sfx.play.serve();},
 key(c,code){
  if(code==='KeyT')toggleTune();
  if(code==='Digit1')jump(c,'ships');if(code==='Digit2')jump(c,'shieldDown');if(code==='Digit3')jump(c,'trick');
  if(code==='KeyN'){const next:Record<Phase,Phase>={intro:'ships',ships:'shieldDown',shieldDown:'trick',trick:'trick',down:'down'};if(phase!=='trick'&&phase!=='down')jump(c,next[phase]);}
 },
 highlight:()=>phase==='trick'?windowBearing:null,
 state:(c)=>({phase,pt:+pt.toFixed(2),wave,shipsDown,spots:spots.length,spotsAt:spots.map(s=>s.world().toArray().map(v=>+v.toFixed(2))),shots:shots.length,hot:shots.some(s=>s.hot),attempts,best,timeScale:+c.timeScale.toFixed(2),
  trick:trick?{state:trick.state,idx:trick.idx,locked:trick.locked,x:+trick.pos.x.toFixed(1),y:+trick.pos.y.toFixed(1),z:+trick.pos.z.toFixed(1)}:null,
  marks:marks.map(m=>[+m.pos.x.toFixed(1),+m.pos.y.toFixed(1),+m.pos.z.toFixed(1)]),windowBearing:+windowBearing.toFixed(3)}),
};
const chest=(c:Ctx,h:Hitter)=>h.kind==='player'?c.player.eyePos().setY(1.35):h.p.pos.clone().setY(1.2);
