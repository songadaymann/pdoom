import * as THREE from 'three';
import {ARENA,PAL,PILLARS,makeFloppy,Trail,type Sparks,type Sfx,WALK} from './kit';
import type {MCP} from './mcp';
import type {Recognizer} from './recognizer';
import type {Post} from './threats';

/* Thrown floppies (the spec's "1.44 megabytes of payback"). Out, they fly straight; they bounce off
 * the floor, the wall, pillars, a Recognizer's frame and the shield panels, pass only through a
 * gap, and turn for home after a hit, their range, or their bounce budget. Home, they fly back to
 * the thrower's hand and are caught. Any disc shatters a post it passes. */
export interface Thrower{hand(out:THREE.Vector3):THREE.Vector3;caught():void;isPlayer:boolean;name:string}
export type DiscOpts={speed:number;range:number;maxBounces:number;damage:number;faceDamage:number;backSpeed:number;color:string};
export type McpHit={disc:Disc;face:boolean;damage:number};

export class Disc{
 mesh:THREE.Group;trail:Trail;pos:THREE.Vector3;vel:THREE.Vector3;start:THREE.Vector3;state:'out'|'back'='out';age=0;bounces=0;passed=false;done=false;
 constructor(scene:THREE.Scene,public owner:Thrower,from:THREE.Vector3,dir:THREE.Vector3,public opts:DiscOpts){
  this.pos=from.clone();this.start=from.clone();this.vel=dir.clone().normalize().multiplyScalar(opts.speed);
  this.mesh=makeFloppy(opts.color);this.mesh.position.copy(from);(this.mesh.userData.halo as THREE.Mesh).material=((this.mesh.userData.halo as THREE.Mesh).material as THREE.Material).clone();
  ((this.mesh.userData.halo as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=.55;scene.add(this.mesh);this.trail=new Trail(scene,opts.color,from);
 }
 home(){if(this.state==='out'){this.state='back';}}
}

export class Discs{
 list:Disc[]=[];
 onMcpHit:(h:McpHit)=>void=()=>{};probe:(d:Disc)=>boolean=()=>false;onRecHit:(r:Recognizer,d:Disc)=>void=()=>{};onBounce:(d:Disc,what:string)=>void=()=>{};
 constructor(public scene:THREE.Scene,private mcp:MCP,private recs:()=>Recognizer[],private posts:()=>Post[],private sparks:Sparks,private sfx:Sfx){}
 throw(owner:Thrower,from:THREE.Vector3,dir:THREE.Vector3,opts:DiscOpts){const d=new Disc(this.scene,owner,from,dir,opts);this.list.push(d);return d;}
 private bounce(d:Disc,n:THREE.Vector3,what:string){
  if(d.vel.dot(n)<0)d.vel.reflect(n);d.bounces++;this.onBounce(d,what);
  this.sparks.burst(d.pos,what==='shield'||what==='rec'?PAL.enemy:d.opts.color,14,5);
  if(d.owner.isPlayer||Math.random()<.3)this.sfx.play.ricochet();
  if(d.bounces>d.opts.maxBounces)d.home();
 }
 update(dt:number){
  const hand=new THREE.Vector3(),prev=new THREE.Vector3(),n=new THREE.Vector3();
  for(const d of this.list){
   const steps=3,h=dt/steps;d.age+=dt;
   for(let s=0;s<steps&&!d.done;s++){
    prev.copy(d.pos);
    if(d.state==='back'){
     d.owner.hand(hand);const to=hand.sub(d.pos),dist=to.length();
     if(dist<1.4||d.age>8){d.done=true;d.owner.caught();if(d.owner.isPlayer)this.sfx.play.catch();break;}
     // a wide arc home, tightening at the end so it never orbits the hand
     d.vel.lerp(to.multiplyScalar(d.opts.backSpeed/dist),dist<8?1:Math.min(1,h*12));
    }
    d.pos.addScaledVector(d.vel,h);
    for(const p of this.posts())if(p.alive&&p.pos.distanceTo(d.pos)<1.4){p.shatter(this.sparks);this.sfx.play.shatter();}
    if(d.state==='back')continue;
    if(this.probe(d)){d.home();continue;}
    const r=Math.hypot(d.pos.x,d.pos.z),pr=Math.hypot(prev.x,prev.z);
    if(d.pos.y<.2&&d.vel.y<0){d.pos.y=.2;this.bounce(d,n.set(0,1,0),'floor');}
    if(r>ARENA.radius-.4&&!WALK.on){d.pos.multiplyScalar((ARENA.radius-.45)/r);this.bounce(d,n.set(-d.pos.x,0,-d.pos.z).normalize(),'wall');}
    if(d.pos.y<ARENA.pillarH)for(const q of PILLARS){const dx=d.pos.x-q.x,dz=d.pos.z-q.z,dist=Math.hypot(dx,dz);if(dist<ARENA.pillarSize+.3){d.pos.x=q.x+dx/dist*(ARENA.pillarSize+.32);d.pos.z=q.z+dz/dist*(ARENA.pillarSize+.32);this.bounce(d,n.set(dx/dist,0,dz/dist),'pillar');}}
    // the shield: inward through a gap only; from inside, out through a gap only
    if(d.pos.y>.5&&d.pos.y<ARENA.shieldTop&&!this.mcp.dead){
     const angle=Math.atan2(d.pos.z,d.pos.x),open=this.mcp.awake&&this.mcp.isGap(angle);
     if(pr>ARENA.ring&&r<=ARENA.ring){if(open)d.passed=true;else{d.pos.multiplyScalar((ARENA.ring+.06)/r);this.bounce(d,n.set(d.pos.x,0,d.pos.z).normalize(),'shield');}}
     else if(pr<=ARENA.ring&&r>ARENA.ring&&!open){d.pos.multiplyScalar((ARENA.ring-.06)/r);this.bounce(d,n.set(-d.pos.x,0,-d.pos.z).normalize(),'shield');}
    }
    if(r<=ARENA.column+.3&&d.pos.y<42&&!this.mcp.dead){
     if(d.passed&&this.mcp.awake){
      const f=this.mcp.facePos,face=d.owner.isPlayer&&Math.abs(d.pos.y-ARENA.faceY)<ARENA.faceH/2&&Math.hypot(d.pos.x-f.x,d.pos.z-f.z)<4.2;
      this.onMcpHit({disc:d,face,damage:face?d.opts.faceDamage:d.opts.damage});
      this.sparks.burst(d.pos,face?PAL.enemyCore:PAL.enemy,40,9);d.home();
     }else{d.pos.multiplyScalar((ARENA.column+.35)/Math.max(r,.01));this.bounce(d,n.set(d.pos.x,0,d.pos.z).normalize(),'column');d.home();}
    }
    for(const rec of this.recs()){
     if(!rec.alive)continue;
     if(rec.corePos(hand).distanceTo(d.pos)<1.35){this.onRecHit(rec,d);d.home();break;}
     const normal=rec.collide(d.pos);if(normal){d.pos.addScaledVector(normal,.3);this.bounce(d,normal,'rec');}
    }
    if(d.state==='out'&&d.pos.distanceTo(d.start)>d.opts.range)d.home();
   }
   d.mesh.position.copy(d.pos);d.mesh.rotation.y+=dt*24;d.trail.push(d.pos);
  }
  for(const d of this.list.filter(d=>d.done)){d.mesh.removeFromParent();d.trail.dispose();}
  this.list=this.list.filter(d=>!d.done);
 }
 clear(){for(const d of this.list){d.mesh.removeFromParent();d.trail.dispose();d.owner.caught();}this.list=[];}
}
