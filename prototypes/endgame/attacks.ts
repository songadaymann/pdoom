import * as THREE from 'three';
import {ARENA,PAL,PILLARS,TAU,rand,clamp,resolve,glowSprite,textSprite,edged} from './kit';
import type {Ctx} from './main';
import type {Person} from './crowd';
import type {Disc} from './discs';

/* Elon's attacks in part 2 of THE BOSS (docs/ENDGAME.md, 2026-10-26), each from his own world and each
 * warned by Grok first. Everything he sends glows red-orange; anything you send back turns cyan.
 * UPDATE: an over-the-air update. Arcs crawl up the base for 3 s while a progress bar fills, then a
 *   ring pulse sweeps the floor. Behind a pillar (the glowing strip) is out of signal.
 * STARLINK: a train of satellites spreads over the arena, a red dot lands on each target, and each
 *   satellite fires one ball. Hit it back (it kills the satellite) or step off the dot.
 * DOGES: Shiba Inus pour out of the pit and tackle people, stealing their discs. They chase any
 *   disc in flight, frisbee-style, and a disc that hits one sends it to the moon. */
export type Hitter={kind:'player'}|{kind:'person';p:Person};
// where a ball goes when it's hit back, and what it does when it gets there
export type Source={pos():THREE.Vector3|null;hit(byPlayer:boolean):void};
export interface Env{
 c:Ctx;
 fire(from:THREE.Vector3,target:Hitter,speed:number,src:Source):void;
 knock(p:Person,from:THREE.Vector3):void;
 hurtPlayer(n:number,from:THREE.Vector3):void;
 throwAt(p:Person,at:THREE.Vector3):void;
 event(name:string,arg?:unknown):void;
}
export interface Attack{kind:string;done:boolean;update(dt:number):void;dispose():void;}
export const hitterPos=(c:Ctx,h:Hitter)=>h.kind==='player'?c.player.pos:h.p.pos;

const CHARGE=3,SWEEP=.9,SAFE_W=1.7,STRIP0=ARENA.pillarR+1.2;
// out of signal: in the strip straight behind a pillar, as seen from the column
export function behindPillar(p:{x:number;z:number}){
 for(const q of PILLARS){const r=Math.hypot(q.x,q.z),ux=q.x/r,uz=q.z/r,along=p.x*ux+p.z*uz;if(along>STRIP0-.3&&Math.abs(p.x*uz-p.z*ux)<SAFE_W)return true;}
 return false;
}

export class Update implements Attack{
 kind='update';done=false;t=0;r=ARENA.block;swept=false;caught=0;caughtPlayer=false;
 arcs:THREE.Line[]=[];strips:THREE.Mesh[]=[];wave:THREE.Mesh;floor:THREE.Mesh;
 bar=document.getElementById('ota')!;fill=document.getElementById('ota-fill')!;label=document.getElementById('ota-text')!;
 constructor(private e:Env){
  const c=e.c,s=c.stage.scene,add=(m:THREE.MeshBasicMaterialParameters)=>new THREE.MeshBasicMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,...m});
  for(let i=0;i<8;i++){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:10},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:i%2?PAL.white:PAL.enemyCore,transparent:true,blending:THREE.AdditiveBlending}));s.add(l);this.arcs.push(l);}
  const len=ARENA.radius-.8-STRIP0;
  for(const q of PILLARS){
   const a=Math.atan2(q.z,q.x),m=new THREE.Mesh(new THREE.PlaneGeometry(len,SAFE_W*2).rotateX(-Math.PI/2),add({color:PAL.line,opacity:0,side:THREE.DoubleSide}));
   m.position.set(Math.cos(a)*(STRIP0+len/2),.05,Math.sin(a)*(STRIP0+len/2));m.rotation.y=-a;s.add(m);this.strips.push(m);
  }
  this.wave=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2.6,128,1,true).translate(0,1.3,0),add({color:PAL.enemy,opacity:.55,side:THREE.DoubleSide}));
  this.floor=new THREE.Mesh(new THREE.RingGeometry(.93,1,128).rotateX(-Math.PI/2),add({color:PAL.enemyCore,opacity:.9,side:THREE.DoubleSide}));
  this.wave.visible=this.floor.visible=false;s.add(this.wave,this.floor);
  this.bar.hidden=false;
  // the crowd runs for cover; a few are slow and won't make it
  for(const p of c.people){
   if(p.down>0)continue;let best=PILLARS[0],bd=1e9;
   for(const q of PILLARS){const d=Math.hypot(p.pos.x-q.x*1.15,p.pos.z-q.z*1.15);if(d<bd){bd=d;best=q;}}
   const r=Math.hypot(best.x,best.z),ux=best.x/r,uz=best.z/r,along=STRIP0+1.4+rand(0,7),side=rand(-1,1);
   const spot=new THREE.Vector3(ux*along-uz*side,0,uz*along+ux*side),slow=Math.random()<.22;
   c.later(slow?rand(2.2,3.4):rand(.3,1.1),()=>{if(this.done)return;p.override=spot;p.overrideUntil=c.t+CHARGE+SWEEP+.8;});
  }
 }
 update(dt:number){
  const c=this.e.c;this.t+=dt;
  if(this.t<CHARGE){
   const k=this.t/CHARGE;
   this.arcs.forEach((l,i)=>{
    const a=Math.floor(i/2)*TAU/4+TAU/8+(i%2)*.25,g=l.geometry.attributes.position as THREE.BufferAttribute;
    for(let j=0;j<10;j++){const f=j/9,r=7.6-2.4*f,y=1.6+f*(2+k*14);g.setXYZ(j,Math.cos(a)*r+(Math.random()-.5)*.9,y+(Math.random()-.5)*.7,Math.sin(a)*r+(Math.random()-.5)*.9);}
    g.needsUpdate=true;l.visible=Math.random()<.8;
   });
   for(const m of this.strips)(m.material as THREE.MeshBasicMaterial).opacity=.1+.14*k+.08*Math.sin(this.t*10);
   this.fill.style.width=(k*100).toFixed(0)+'%';this.label.textContent=`DOWNLOADING UPDATE 2026.10.26 · ${Math.floor(k*100)}%`;
   if(Math.random()<dt*16)c.sfx.play.zap();
   return;
  }
  if(!this.swept){this.swept=true;this.bar.hidden=true;for(const l of this.arcs)l.visible=false;this.wave.visible=this.floor.visible=true;c.sfx.play.pulse();c.shake(.5);}
  const prev=this.r;this.r=Math.min(ARENA.radius,ARENA.block+(this.t-CHARGE)/SWEEP*(ARENA.radius-ARENA.block));
  this.wave.scale.set(this.r,1,this.r);this.floor.scale.setScalar(this.r);(this.wave.material as THREE.MeshBasicMaterial).opacity=.55*(1-(this.r-ARENA.block)/(ARENA.radius-ARENA.block)*.6);
  for(const m of this.strips)(m.material as THREE.MeshBasicMaterial).opacity*=Math.exp(-dt*3);
  const crossed=(p:THREE.Vector3)=>{const r=Math.hypot(p.x,p.z);return prev<r&&r<=this.r&&!behindPillar(p);};
  if(!c.player.down&&crossed(c.player.pos)){this.caughtPlayer=true;this.e.hurtPlayer(30,new THREE.Vector3());this.e.event('static');}
  for(const p of c.everyone())if(p.down<=0&&crossed(p.pos)){this.caught++;this.e.knock(p,new THREE.Vector3());this.e.event('pulse-hit',p);}
  if(this.r>=ARENA.radius){this.e.event(this.caughtPlayer?'update-hit':this.caught?'update-some':'update-miss');this.dispose();}
 }
 dispose(){if(this.done)return;this.done=true;this.bar.hidden=true;for(const o of [...this.arcs,...this.strips,this.wave,this.floor])o.removeFromParent();for(const p of this.e.c.people)p.override=null;}
}

type Sat={g:THREE.Group;to:THREE.Vector3;start:number;fireAt:number;fired:boolean;alive:boolean;target:Hitter;dot:THREE.Mesh};
export class Starlink implements Attack{
 kind='starlink';done=false;t=0;sats:Sat[]=[];
 constructor(private e:Env){
  const c=e.c,s=c.stage.scene,live=c.people.filter(p=>p.down<=0).sort(()=>Math.random()-.5).slice(0,16);
  // three at you, spaced so each can be hit back; one at each of the others
  const targets:Hitter[]=[{kind:'player'},...live.map(p=>({kind:'person' as const,p})),{kind:'player'},{kind:'player'}];
  let mine=0;
  targets.forEach((target,i)=>{
   const g=new THREE.Group();g.add(edged(new THREE.BoxGeometry(.7,.16,.5),0x160404,PAL.enemy));
   for(const x of [-1.1,1.1])g.add(edged(new THREE.BoxGeometry(1.3,.04,.62).translate(x,0,0),0x0b0303,PAL.enemyCore,.8));
   g.add(glowSprite(PAL.enemy,2.2,.8));g.scale.setScalar(1.8);g.position.set(0,48,0);s.add(g);
   const at=hitterPos(c,target),to=new THREE.Vector3(at.x+rand(-7,7),rand(24,31),at.z+rand(-7,7));
   const dot=new THREE.Mesh(new THREE.RingGeometry(.42,.66,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:PAL.enemy,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));dot.visible=false;s.add(dot);
   const fireAt=target.kind==='player'?2.9+.75*mine++:rand(2.5,4.4);
   this.sats.push({g,to,start:i*.07,fireAt,fired:false,alive:true,target,dot});
  });
 }
 update(dt:number){
  const c=this.e.c;this.t+=dt;let left=0;
  for(const s of this.sats){
   if(!s.alive)continue;left++;
   // up out of the crown in a train, then out over the arena
   const k=clamp((this.t-s.start)/2.2,0,1),e=k*k*(3-2*k),a=1-e;
   if(!s.fired||this.t<s.fireAt+3)s.g.position.set(e*e*s.to.x,a*a*48+2*a*e*62+e*e*s.to.y,e*e*s.to.z);
   else{s.g.position.y+=dt*14;if(this.t>s.fireAt+5){s.alive=false;s.g.removeFromParent();s.dot.removeFromParent();}}
   s.g.rotation.y+=dt*.8;
   const at=hitterPos(c,s.target);s.dot.visible=!s.fired&&k>.55;s.dot.position.set(at.x,.05,at.z);s.dot.scale.setScalar(1+.25*Math.sin(this.t*12));
   if(!s.fired&&this.t>=s.fireAt){
    s.fired=true;s.dot.visible=false;
    this.e.fire(s.g.position.clone(),s.target,14,{pos:()=>s.alive?s.g.position.clone():null,hit:(byPlayer)=>this.kill(s,byPlayer)});
   }
  }
  if(!left||this.t>14)this.dispose();
 }
 kill(s:Sat,byPlayer:boolean){if(!s.alive)return;s.alive=false;this.e.c.sparks.burst(s.g.position,PAL.enemy,70,9);this.e.c.sfx.play.derez();s.g.removeFromParent();s.dot.removeFromParent();this.e.event('sat-down',byPlayer);}
 dispose(){if(this.done)return;this.done=true;for(const s of this.sats){s.g.removeFromParent();s.dot.removeFromParent();s.alive=false;}}
}

// A pixel Shiba, drawn in code until the doge sheet exists: two running frames, facing right and left.
let dogeFrames:THREE.Texture[]|null=null;
function dogeTextures(){
 if(dogeFrames)return dogeFrames;dogeFrames=[];
 for(const flip of [false,true])for(const step of [0,1]){
  const cv=document.createElement('canvas');cv.width=24;cv.height=16;const g=cv.getContext('2d')!;
  if(flip){g.translate(24,0);g.scale(-1,1);}
  const px=(c:string,x:number,y:number,w=1,h=1)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
  const tan='#d9973f',cream='#f6e3bd',dark='#2b1a0c';
  px(tan,2,3,3,4);px(cream,2,3,2,1);                        // the curled tail
  px(tan,5,6,12,6);px(cream,7,10,8,2);                      // body, belly
  px(tan,15,2,6,7);px(cream,16,6,3,2);px(cream,19,5,4,3);   // head, cheek, muzzle
  px(tan,15,0,2,2);px(tan,19,0,2,2);px(dark,16,1,1,1);px(dark,19,1,1,1);  // ears
  px(dark,19,3,1,1);px(dark,23,5,1,1);px('#ff7a8a',21,8,1,1);             // eye, nose, tongue
  for(const x of step?[8,13]:[6,15])px(tan,x,12,2,4);
  for(const x of step?[8,13]:[6,15])px(dark,x,15,2,1);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;dogeFrames.push(t);
 }
 return dogeFrames;
}
const WOW=['MUCH WOW','VERY ATTACK','SUCH SPEED','WOW'];
type Doge={sprite:THREE.Sprite;glow:THREE.Sprite;pos:THREE.Vector3;vel:THREE.Vector3;state:'run'|'carry'|'moon'|'leave'|'gone';target:Hitter|null;chase:Disc|null;chaseT:number;holding:Person|null;holdT:number;cool:number;vy:number};
export class Doges implements Attack{
 kind='doge';done=false;t=0;list:Doge[]=[];words:{s:THREE.Sprite;t:number}[]=[];cool=new Map<Person,number>();scan=0;
 constructor(private e:Env,n:number){
  const c=e.c,s=c.stage.scene;
  for(let i=0;i<n;i++){
   const a=rand(0,TAU),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dogeTextures()[0],transparent:true,alphaTest:.5}));sprite.center.set(.5,0);sprite.scale.set(1.5,1,1);
   const glow=glowSprite(PAL.enemy,1.8,.35);sprite.visible=glow.visible=false;s.add(sprite,glow);
   const d:Doge={sprite,glow,pos:new THREE.Vector3(Math.cos(a)*(ARENA.block+.8),0,Math.sin(a)*(ARENA.block+.8)),vel:new THREE.Vector3(),state:'run',target:null,chase:null,chaseT:0,holding:null,holdT:0,cool:i*.15,vy:0};
   this.list.push(d);
  }
  for(let i=0;i<3;i++){const w=textSprite(WOW[(i+Math.floor(rand(0,4)))%4],'#ffd75e',1.2,'700'),a=rand(0,TAU);w.position.set(Math.cos(a)*16,3+i,Math.sin(a)*16);s.add(w);this.words.push({s:w,t:-i*.5});}
  c.sfx.play.bark();c.later(.25,()=>c.sfx.play.bark());
 }
 // a target: whoever still has a disc, nearest first; sometimes you
 private pick(d:Doge):Hitter{
  const c=this.e.c;if(Math.random()<.25&&!c.player.down)return {kind:'player'};
  let best:Person|null=null,bd=1e9;for(const p of c.people){if(p.down>0||!p.hasDisc)continue;const dist=p.pos.distanceTo(d.pos)+rand(0,8);if(dist<bd){bd=dist;best=p;}}
  return best?{kind:'person',p:best}:{kind:'player'};
 }
 update(dt:number){
  const c=this.e.c;this.t+=dt;let live=0;
  const camRight=new THREE.Vector3().setFromMatrixColumn(c.stage.camera.matrixWorld,0);
  for(const d of this.list){
   if(d.state==='gone')continue;live++;
   d.cool-=dt;if(d.cool>0)continue;d.sprite.visible=d.glow.visible=true;
   let goal:THREE.Vector3|null=null,speed=8.5;
   if(d.state==='run'){
    if(this.t>16){d.state='leave';}
    // frisbee: chase any disc flying past
    if(!d.chase)for(const disc of c.discs.list)if(disc.state==='out'&&Math.hypot(disc.pos.x-d.pos.x,disc.pos.z-d.pos.z)<8){d.chase=disc;d.chaseT=0;break;}
    if(d.chase){d.chaseT+=dt;if(d.chase.state!=='out'||d.chase.done||d.chaseT>2.5)d.chase=null;else{goal=d.chase.pos.clone().setY(0);speed=11;}}
    if(!goal){
     const bad=!d.target||(d.target.kind==='person'&&(d.target.p.down>0||!d.target.p.hasDisc))||(d.target.kind==='player'&&c.player.down);
     if(bad)d.target=this.pick(d);goal=hitterPos(c,d.target!).clone();
     if(d.pos.distanceTo(goal)<1){
      if(d.target!.kind==='person'){const p=d.target!.p;this.e.knock(p,d.pos);if(p.hasDisc){p.hasDisc=false;d.holding=p;d.state='carry';d.holdT=0;this.e.event('disc-stolen',p);}}
      else{this.e.hurtPlayer(10,d.pos);d.cool=.6;}
      d.target=null;c.sfx.play.bark();
     }
    }
   }
   if(d.state==='carry'){d.holdT+=dt;speed=7;const a=Math.atan2(d.pos.z,d.pos.x);goal=new THREE.Vector3(Math.cos(a)*(ARENA.block+1),0,Math.sin(a)*(ARENA.block+1));if(d.holdT>8){this.release(d);d.state='run';}}
   if(d.state==='leave'){speed=10;const a=Math.atan2(d.pos.z,d.pos.x);goal=new THREE.Vector3(Math.cos(a)*ARENA.block,0,Math.sin(a)*ARENA.block);if(d.pos.distanceTo(goal)<1.2)this.vanish(d);}
   if(d.state==='moon'){d.vy+=14*dt;d.pos.y+=d.vy*dt;d.sprite.material.rotation+=dt*9;if(Math.random()<dt*40)c.sparks.burst(d.pos.clone().setY(d.pos.y-.3),'#ffd75e',3,2,{gravity:-2});if(d.pos.y>45)this.vanish(d);}
   else if(goal){const to=goal.sub(d.pos).setY(0),dist=to.length();if(dist>.05){d.vel.copy(to.multiplyScalar(Math.min(speed,dist/dt)/dist));d.pos.addScaledVector(d.vel,dt);}resolve(d.pos,.35);}
   const right=d.vel.dot(camRight)>=0,step=Math.floor(this.t*10+d.cool*7)%2;
   d.sprite.material.map=dogeTextures()[(right?0:2)+(d.state==='moon'?0:step)];
   d.sprite.position.set(d.pos.x,d.pos.y+(d.state==='moon'?0:Math.abs(Math.sin(this.t*14))*.12),d.pos.z);d.glow.position.set(d.pos.x,d.pos.y+.45,d.pos.z);
  }
  for(const w of this.words){w.t+=dt;w.s.position.y+=dt*.8;w.s.material.opacity=clamp(w.t<0?0:w.t<.3?w.t/.3:1-(w.t-1.6)/1.2,0,1);}
  // the crowd defends itself: bonk the nearest doge that's coming
  this.scan-=dt;
  if(this.scan<=0){
   this.scan=.35;
   for(const p of c.people){
    if(p.down>0||!p.hasDisc||(this.cool.get(p)??0)>c.t)continue;
    const near=this.list.filter(d=>d.state==='run'&&d.cool<=0&&d.pos.distanceTo(p.pos)<10).sort((a,b)=>a.pos.distanceTo(p.pos)-b.pos.distanceTo(p.pos))[0];
    if(near&&Math.random()<.5){this.cool.set(p,c.t+1.6);this.e.throwAt(p,near.pos.clone().addScaledVector(near.vel,.25).setY(.45));this.e.event('dog-spotted',p);}
   }
  }
  if(!live)this.dispose();
 }
 // a disc in flight that reaches a doge: off to the moon
 probe(disc:Disc){
  for(const d of this.list){
   if((d.state!=='run'&&d.state!=='carry')||d.cool>0||disc.pos.y>2.3||Math.hypot(disc.pos.x-d.pos.x,disc.pos.z-d.pos.z)>1.3)continue;
   this.release(d);d.state='moon';d.vy=8;this.e.c.sfx.play.bark();this.e.c.sparks.burst(d.pos.clone().setY(.6),'#ffd75e',50,7);this.e.event('bonk',disc.owner.isPlayer);return true;
  }
  return false;
 }
 get running(){return this.list.filter(d=>d.state==='run'||d.state==='carry').length;}
 private release(d:Doge){if(d.holding){d.holding.hasDisc=true;d.holding=null;}}
 private vanish(d:Doge){this.release(d);d.state='gone';d.sprite.removeFromParent();d.glow.removeFromParent();}
 dispose(){if(this.done)return;this.done=true;for(const d of this.list)this.vanish(d);for(const w of this.words)w.s.removeFromParent();}
}
