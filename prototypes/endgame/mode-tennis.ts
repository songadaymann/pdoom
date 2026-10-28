import * as THREE from 'three';
import {ARENA,PAL,bearingOf,wrap,glowSprite,Trail} from './kit';
import type {Mode,Ctx} from './main';
import type {Recognizer} from './recognizer';
import type {Person} from './crowd';

/* B. TENNIS: the MCP can only shoot through its own shield gap, so the gap swings round to find
 * its target, stops, winds up and serves. Click as the shot reaches you to hit it back; it flashes
 * white in the sweet spot (a PERFECT return goes straight at the face, faster). A return only
 * gets in through the gap it came out of, so stay where it served you. The MCP returns some of
 * your returns, faster each time; when it misses, the hit doubles with each exchange (50, 100,
 * 200, 400). Sometimes it serves to one of the twenty: they return about half (the guide most),
 * or you can step in and take it. */
const DEG=Math.PI/180;
type Hitter={kind:'player'}|{kind:'person';p:Person};
const MCP_RETURNS=[.6,.4,.25,.1,0];

class Bolt{
 group=new THREE.Group();core:THREE.Mesh;glow:THREE.Sprite;trail:Trail;pos:THREE.Vector3;vel:THREE.Vector3;alive=true;age=0;enemy=true;returns=0;hot=false;decided=false;
 constructor(scene:THREE.Scene,from:THREE.Vector3,public target:Hitter,public speed:number,public rec:Recognizer|null,aim:THREE.Vector3){
  this.pos=from.clone();this.vel=aim.clone().sub(from).normalize().multiplyScalar(speed);
  this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,0),new THREE.MeshBasicMaterial({color:PAL.enemyCore}));this.glow=glowSprite(PAL.enemy,1.1,.8);
  this.group.add(this.core,this.glow);this.group.position.copy(from);scene.add(this.group);this.trail=new Trail(scene,PAL.enemy,from);
 }
 friendly(){this.enemy=false;(this.core.material as THREE.MeshBasicMaterial).color.set(PAL.core);this.glow.material.color.set(PAL.line);this.trail.dispose();this.trail=new Trail(this.group.parent as THREE.Scene,PAL.line,this.pos);}
 remove(){this.alive=false;this.group.removeFromParent();this.trail.dispose();}
}

let bolts:Bolt[]=[],rally:Bolt|null=null,serve:{state:'seek'|'wind';target:Hitter;t:number}|null=null,serveCd=2,swingCd=0,best=0;
const chest=(c:Ctx,h:Hitter)=>h.kind==='player'?c.player.eyePos().setY(1.35):h.p.pos.clone().setY(1.2);
function endRally(c:Ctx,b:Bolt){if(rally===b){rally=null;serveCd=1;c.mcp.spin=50*DEG;}}
function returnBolt(c:Ctx,b:Bolt,by:Hitter,perfect:boolean){
 b.friendly();b.returns++;b.target=by;b.hot=false;
 const from=b.pos,dest=b.rec?b.rec.corePos():by.kind==='player'?c.mcp.facePos.clone():new THREE.Vector3(0,ARENA.faceY,0);
 const to=dest.sub(from).normalize(),aim=by.kind==='player'?c.player.forward():to.clone();
 b.speed*=perfect?1.22:1.06;b.vel.copy(aim.lerp(to,perfect?.92:.6).normalize().multiplyScalar(b.speed));
 c.sparks.burst(from,PAL.line,26,6);
}

export const tennis:Mode={
 id:'tennis',title:'B · TENNIS',recStyle:'bolt',formation:'audience',heldAlways:true,
 hints:{practice1:'Click as the shot reaches you to hit it back.',practice2:'Wait for it to flash white, then click: a perfect return.',wake:'',fight:'It shoots through its gap. Hit it back through the same gap. Long rallies hit harder.',down:''},
 wake(c){c.mcp.setGap(2,1);c.mcp.spin=50*DEG;serveCd=1.5;},
 recFire(c,rec,from){bolts.push(new Bolt(c.stage.scene,from,{kind:'player'},11,rec,chest(c,{kind:'player'})));c.sfx.play.serve();},
 press(c,b){
  if(b!==0||swingCd>0||c.player.down)return;
  c.swing=.2;swingCd=.42;
  const eye=c.player.eyePos(),f=c.player.forward();let pick:Bolt|null=null,pd=4.6;
  for(const bolt of bolts){if(!bolt.alive||!bolt.enemy)continue;const to=bolt.pos.clone().sub(eye),d=to.length();if(d<.35||d>pd)continue;if(to.normalize().dot(f)<Math.cos(80*DEG))continue;pick=bolt;pd=d;}
  if(!pick){c.sfx.play.whiff();return;}
  const perfect=pd>=1.1&&pd<=3.1;returnBolt(c,pick,{kind:'player'},perfect);c.sfx.play.pock(perfect);
  c.hud.pop((perfect?'PERFECT':'GOOD')+(pick.returns>1?` · RALLY ${pick.returns}`:''),perfect?PAL.core:PAL.line);
 },
 update(c,dt){
  swingCd=Math.max(0,swingCd-dt);
  const mcp=c.mcp,eye=c.player.eyePos();
  if(c.phase==='fight'){
   serveCd-=dt;
   if(!rally&&!serve&&serveCd<=0){
    const live=c.everyone().filter(p=>p.down<=0),toPerson=Math.random()<.3&&live.length;
    serve={state:'seek',t:0,target:toPerson||c.player.down?{kind:'person',p:live[Math.floor(Math.random()*live.length)]}:{kind:'player'}};mcp.spin=150*DEG;
   }
   if(serve){
    serve.t+=dt;const tb=bearingOf(chest(c,serve.target)),g=mcp.gapCenters()[0]??0,off=wrap(tb-g);
    if(serve.state==='seek'&&Math.abs(off)<6*DEG){serve.state='wind';serve.t=0;mcp.spin=0;mcp.setExpr('wind',.6);c.sfx.play.charge();}
    if(serve.state==='wind'){
     mcp.base=wrap(mcp.base+THREE.MathUtils.clamp(off,-30*DEG*dt,30*DEG*dt));// keeps aiming at you while it winds up
     if(serve.t>=.6){
      const from=new THREE.Vector3(Math.cos(tb)*7,ARENA.faceY-3,Math.sin(tb)*7),speed=13+(1-mcp.integrity/mcp.max)*5;
      rally=new Bolt(c.stage.scene,from,serve.target,speed,null,chest(c,serve.target));bolts.push(rally);serve=null;c.sfx.play.serve();mcp.say(.4);
     }
    }
   }
  }
  let hot=false;
  for(const b of bolts){
   if(!b.alive)continue;b.age+=dt;const prev=b.pos.clone();
   if(b.enemy){
    const aim=chest(c,b.target),want=aim.clone().sub(b.pos).normalize().multiplyScalar(b.speed);b.vel.lerp(want,Math.min(1,dt*1.2));
    b.pos.addScaledVector(b.vel,dt);
    const d=b.target.kind==='player'?b.pos.distanceTo(eye):b.pos.distanceTo(aim);
    if(b.target.kind==='player'){b.hot=d>=1.1&&d<=3.1;hot||=b.hot;}
    else{
     const pd=b.pos.distanceTo(eye);if(pd>=1.1&&pd<=3.1)hot=true;
     if(!b.decided&&d<1.9){b.decided=true;const p=b.target.p;if(p.down<=0&&Math.random()<(p.guide?.8:.5)){p.hop=.3;returnBolt(c,b,{kind:'person',p},false);c.sfx.play.pock(false);continue;}}
    }
    if(d<.6){
     if(b.target.kind==='player'){if(c.player.damage(15,b.pos))c.sfx.play.hurt();}else b.target.p.knock(b.pos);
     c.sparks.burst(b.pos,PAL.enemy,30,6);b.remove();endRally(c,b);continue;
    }
   }else if(b.rec){
    if(b.rec.alive){const want=b.rec.corePos().sub(b.pos).normalize().multiplyScalar(b.speed);b.vel.lerp(want,Math.min(1,dt*6));}
    b.pos.addScaledVector(b.vel,dt);
    if(b.rec.alive&&b.pos.distanceTo(b.rec.corePos())<1.4){c.hitRec(b.rec);c.sparks.burst(b.pos,PAL.enemyCore,40,8);b.remove();continue;}
   }else{
    b.pos.addScaledVector(b.vel,dt);
    const r=Math.hypot(b.pos.x,b.pos.z),pr=Math.hypot(prev.x,prev.z);
    if(pr>ARENA.ring&&r<=ARENA.ring&&!mcp.isGap(Math.atan2(b.pos.z,b.pos.x))){c.sparks.burst(b.pos,PAL.enemy,30,7);c.sfx.play.ricochet();c.hud.pop('BLOCKED',PAL.enemy);b.remove();endRally(c,b);continue;}
    if(r<=6.6&&!mcp.dead){
     if(Math.random()<MCP_RETURNS[Math.min(b.returns-1,4)]){
      // it hits it back, a little faster, at whoever hit it
      b.enemy=true;b.decided=false;b.speed*=1.12;(b.core.material as THREE.MeshBasicMaterial).color.set(PAL.enemyCore);b.glow.material.color.set(PAL.enemy);
      b.trail.dispose();b.trail=new Trail(c.stage.scene,PAL.enemy,b.pos);b.vel.copy(chest(c,b.target).sub(b.pos).normalize().multiplyScalar(b.speed));
      c.sfx.play.serve();mcp.setExpr('talk',.3);
     }else{
      const dmg=Math.min(400,50*2**(b.returns-1));best=Math.max(best,b.returns);const caption=mcp.hurt(dmg,true);c.sfx.play.face();
      c.hud.pop(`${dmg}`,PAL.enemyCore);if(caption)c.hud.caption(caption,1.4);c.sparks.burst(b.pos,PAL.enemyCore,60,10);b.remove();endRally(c,b);continue;
     }
    }
   }
   if(b.age>12||Math.hypot(b.pos.x,b.pos.z)>ARENA.radius+2||b.pos.y<-1){b.remove();endRally(c,b);continue;}
   b.group.position.copy(b.pos);b.core.rotation.x+=dt*7;b.core.rotation.y+=dt*5;
   // the sweet-spot cue: white and a touch bigger, never a screen-filling glare
   b.group.scale.setScalar(b.hot?1.25:1);b.glow.visible=b.pos.distanceTo(eye)>2.2||!b.enemy;(b.core.material as THREE.MeshBasicMaterial).color.set(b.hot?PAL.white:b.enemy?PAL.enemyCore:PAL.core);b.trail.push(b.pos);
  }
  bolts=bolts.filter(b=>b.alive);
  if(c.phase==='down'){for(const b of bolts)b.remove();bolts=[];rally=null;serve=null;}
  c.hud.reticle(hot);
 },
 highlight:(c)=>bearingOf(c.player.pos),
 state:()=>({bolts:bolts.map(b=>({enemy:b.enemy,returns:b.returns,hot:b.hot,d:+b.pos.length().toFixed(1)})),rally:!!rally,serve:serve?.state||null,best}),
};
