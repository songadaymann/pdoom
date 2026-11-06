import * as THREE from 'three';
import {PAL,WALK,rand,clamp,edged,glowSprite} from './kit';
import type {Disc} from './discs';
import type {Attack,Env} from './attacks';

/* The Cybertruck, on the walk in (Jonathan, 2026-11-06: after the first ship "we fight a few more but also the
 * cyber trucks"). His armour-glass truck as a Tron wedge in his red-orange, its light bar across the front. Two
 * come up the edges of the walk from behind you, overtake, and skid round. Each then revs at the end of a red lane
 * drawn through where you stand (2 s: step out of it) and charges down it. It stops at the far end, turns, and
 * does it again. A disc that hits it cracks a window (the first: "...ROOM FOR IMPROVEMENT."); three wreck it. It
 * hurts and knocks people down, but nobody dies out here. The lanes stay on the Grid: across the walk between
 * the turbine rows (|x| 26) and north of the wall. */
export const TRUCK={len:6,wide:2.1,hp:3,rev:2,speed:28,damage:30,half:1.75,x:22.5,zMin:50};
const UP=new THREE.Vector3(0,1,0);
type State='arrive'|'idle'|'rev'|'charge'|'stop'|'gone';
// a pane of its glass: a corner, its two sides and their lengths (cracks are drawn in it)
type Pane={o:THREE.Vector3;u:THREE.Vector3;v:THREE.Vector3;w:number;h:number};

function wedge(){
 // its side, rear to front: the tailgate, the one straight roofline to the apex, the hood down to the light bar
 const s=new THREE.Shape(),P:[number,number][]=[[-3,.45],[-3,1.22],[.35,1.95],[2.98,1.08],[3,.72],[2.72,.45]];
 s.moveTo(...P[0]);for(const p of P.slice(1))s.lineTo(...p);s.closePath();
 return new THREE.ExtrudeGeometry(s,{depth:TRUCK.wide,bevelEnabled:false}).translate(0,0,-TRUCK.wide/2);
}
function quad(pts:THREE.Vector3[]){
 const g=new THREE.BufferGeometry().setFromPoints(pts);g.setIndex(pts.length===4?[0,1,2,0,2,3]:[0,1,2,0,2,3,0,3,4]);return g;
}

export class Truck implements Attack{
 kind='truck';done=false;state:State='arrive';t=0;hp=TRUCK.hp;charges=0;cracks=0;
 group=new THREE.Group();pos:THREE.Vector3;dir=new THREE.Vector3(0,0,-1);heading=-Math.PI/2;want=-Math.PI/2;speed=30;
 private lineMats:THREE.LineBasicMaterial[]=[];private wheels:THREE.Group[]=[];private bar:THREE.MeshBasicMaterial;private lamps:THREE.Sprite[]=[];
 private panes:Pane[]=[];private crackLines:THREE.LineSegments[]=[];private flash=0;
 private lane:THREE.Group|null=null;private laneFill:THREE.MeshBasicMaterial|null=null;private laneEdge:THREE.LineBasicMaterial|null=null;
 private from=new THREE.Vector3();private to=new THREE.Vector3();private hitThisRun=new Set<object>();private stopAt=new THREE.Vector3();
 private engine:ReturnType<Env['c']['sfx']['engine']>;private idleFor=0;
 constructor(private e:Env,public side:1|-1,delay:number){
  const c=e.c,s=c.stage.scene,steel=0x160404;
  const shell=edged(wedge(),steel,PAL.enemy);this.group.add(shell);
  for(const o of shell.children)if(o instanceof THREE.LineSegments)this.lineMats.push(o.material as THREE.LineBasicMaterial);
  // the glass: two side windows and the windshield, dark, edged in white
  const glass=new THREE.MeshBasicMaterial({color:0x1a242c,side:THREE.DoubleSide}),edge=new THREE.LineBasicMaterial({color:PAL.white,transparent:true,opacity:.7});
  for(const z of [-1,1]){
   const zz=z*(TRUCK.wide/2+.015),pts=[[-1,1.32],[1.4,1.32],[1.25,1.58],[.3,1.86],[-1,1.6]].map(([x,y])=>new THREE.Vector3(x,y,zz));
   this.group.add(new THREE.Mesh(quad(pts),glass),new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),edge));
   this.panes.push({o:new THREE.Vector3(-1,1.32,zz+z*.01),u:new THREE.Vector3(1,0,0),v:new THREE.Vector3(0,1,0),w:2.3,h:.42});
  }
  const n=new THREE.Vector3(.87,2.63,0).normalize().multiplyScalar(.03),a=new THREE.Vector3(.48,1.91,0).add(n),b=new THREE.Vector3(1.55,1.555,0).add(n);
  const ws=[a.clone().setZ(-.9),a.clone().setZ(.9),b.clone().setZ(.9),b.clone().setZ(-.9)];
  this.group.add(new THREE.Mesh(quad(ws),glass),new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ws),edge));
  this.panes.push({o:ws[0].clone().add(n),u:new THREE.Vector3(0,0,1),v:b.clone().sub(a).normalize(),w:1.8,h:b.distanceTo(a)});
  // the light bar right across the front, and a red one across the tailgate
  this.bar=new THREE.MeshBasicMaterial({color:PAL.white});
  this.group.add(new THREE.Mesh(new THREE.BoxGeometry(.06,.07,TRUCK.wide-.1).translate(2.99,1.07,0),this.bar));
  this.group.add(new THREE.Mesh(new THREE.BoxGeometry(.06,.06,TRUCK.wide-.1).translate(-3.01,1.2,0),new THREE.MeshBasicMaterial({color:'#ff2a12'})));
  for(const z of [-.85,.85]){const l=glowSprite(PAL.white,1.6,.0);l.position.set(3.2,1.07,z);this.group.add(l);this.lamps.push(l);}
  for(const x of [-2.05,2.05])for(const z of [-.98,.98]){
   const w=edged(new THREE.CylinderGeometry(.5,.5,.34,14).rotateX(Math.PI/2),0x050505,PAL.enemy,.9);w.position.set(x,.5,z);this.group.add(w);this.wheels.push(w);
   for(const o of w.children)if(o instanceof THREE.LineSegments)this.lineMats.push(o.material as THREE.LineBasicMaterial);
  }
  // up the edge of the walk from behind you, to a stop ahead
  const z=c.player.pos.z;this.pos=new THREE.Vector3(side*TRUCK.x,0,Math.min(z+110+delay*30,WALK.far+60));
  this.stopAt.set(side*TRUCK.x,0,clamp(z-16-delay*8,TRUCK.zMin+4,WALK.far));
  this.group.position.copy(this.pos);this.group.rotation.y=-this.heading;s.add(this.group);
  this.engine=c.sfx.engine();
 }
 get alive(){return this.state!=='gone';}
 info(){return {state:this.state,hp:this.hp,cracks:this.cracks,charges:this.charges,x:+this.pos.x.toFixed(1),z:+this.pos.z.toFixed(1),lane:this.lane?{from:this.from.toArray().map(v=>+v.toFixed(1)),to:this.to.toArray().map(v=>+v.toFixed(1))}:null};}
 private face(a:number){this.want=a;}
 update(dt:number){
  if(!this.alive)return;const c=this.e.c;this.t+=dt;this.flash=Math.max(0,this.flash-dt*4);
  // turn toward where it wants to point (a skid round, fast)
  this.heading+=Math.atan2(Math.sin(this.want-this.heading),Math.cos(this.want-this.heading))*Math.min(1,dt*7);
  let rev=0,v=0;
  switch(this.state){
   case 'arrive':{
    const d=this.stopAt.z-this.pos.z,dist=Math.abs(d);this.face(-Math.PI/2);
    v=Math.min(this.speed,Math.sqrt(2*30*dist));this.pos.z+=Math.sign(d)*Math.min(dist,v*dt);
    if(dist<.05){this.state='idle';this.t=0;this.idleFor=.4;c.sfx.play.screech(this.pos);this.face(this.side>0?Math.PI:0);}
    break;}
   case 'idle':if(this.t>=this.idleFor)this.startRev();break;
   case 'rev':{
    rev=Math.min(1,this.t/TRUCK.rev);const k=.05+.17*rev;
    if(this.laneFill)this.laneFill.opacity=k*(.75+.25*Math.sin(this.t*18));
    if(this.laneEdge)this.laneEdge.opacity=.5+.5*Math.abs(Math.sin(this.t*10));
    this.group.position.y=Math.abs(Math.sin(this.t*31))*.05*rev;
    if(this.t>=TRUCK.rev){this.state='charge';this.t=0;this.speed=0;this.hitThisRun.clear();c.sfx.play.launch(this.pos);this.e.event('truck-charge',this);}
    break;}
   case 'charge':{
    const left=this.to.clone().sub(this.pos).dot(this.dir);
    this.speed=Math.min(TRUCK.speed,this.speed+dt*60,Math.sqrt(Math.max(0,2*60*left)));v=this.speed;
    this.pos.addScaledVector(this.dir,Math.min(Math.max(left,0),v*dt));this.ram();
    if(this.laneFill)this.laneFill.opacity*=Math.exp(-dt*2);
    if(left<.05){this.state='stop';this.t=0;this.idleFor=rand(1,2.2);this.charges++;this.clearLane();c.sfx.play.screech(this.pos);this.e.event('truck-stop',this);}
    break;}
   case 'stop':if(this.t>=this.idleFor){this.state='idle';this.t=0;this.idleFor=0;}break;
  }
  this.group.position.x=this.pos.x;this.group.position.z=this.pos.z;if(this.state!=='rev')this.group.position.y=0;
  this.group.rotation.y=-this.heading;
  for(const w of this.wheels)w.rotation.z-=v*dt/.5;
  const hot=this.flash>.5;for(const m of this.lineMats)m.color.set(hot?PAL.white:PAL.enemy);
  this.bar.color.set(rev>0||this.state==='charge'?PAL.white:'#9fb4c0');
  for(const l of this.lamps)l.material.opacity=this.state==='charge'?.9:rev*(.6+.4*Math.random());
  this.engine?.move(this.group.position.clone().setY(1),this.state==='rev'?rev:this.state==='charge'?.7:.15,dt);
 }
 // the lane: from here, through where you stand, as far as the Grid lets it go
 private startRev(){
  const c=this.e.c,p=c.player.pos;this.from.copy(this.pos);
  let dir=new THREE.Vector3(p.x-this.pos.x,0,p.z-this.pos.z);if(dir.lengthSq()<1)dir.set(-Math.sign(this.pos.x)||1,0,0);dir.normalize();
  let len=this.reach(dir);
  if(len<12){dir=new THREE.Vector3(-Math.sign(this.pos.x)||1,0,0);len=this.reach(dir);}
  this.dir.copy(dir);this.to.copy(this.pos).addScaledVector(dir,len);this.face(Math.atan2(dir.z,dir.x));
  this.state='rev';this.t=0;this.drawLane(len);c.sfx.play.rev(this.pos);
  // whoever's in it gets out of the way (after their reaction time)
  for(const q of c.everyone())q.avoid(this.closest(q.pos),TRUCK.half+.3,c.t);
  this.e.event('truck-rev',this);
 }
 private reach(dir:THREE.Vector3){
  const X=TRUCK.x,lim=(o:number,d:number,lo:number,hi:number)=>d>1e-6?(hi-o)/d:d<-1e-6?(lo-o)/d:Infinity;
  return Math.max(0,Math.min(lim(this.pos.x,dir.x,-X,X),lim(this.pos.z,dir.z,TRUCK.zMin,WALK.far+20)));
 }
 closest(p:THREE.Vector3){const k=clamp(p.clone().sub(this.from).dot(this.dir),0,this.from.distanceTo(this.to));return this.from.clone().addScaledVector(this.dir,k).setY(0);}
 inLane(p:THREE.Vector3,pad=0){if(!this.lane)return false;return Math.hypot(p.x-this.closest(p).x,p.z-this.closest(p).z)<TRUCK.half+pad;}
 private drawLane(len:number){
  this.clearLane();const s=this.e.c.stage.scene,L=len+TRUCK.len,hw=TRUCK.half;
  const g=new THREE.Group();g.position.copy(this.from).setY(.05);g.rotation.y=-Math.atan2(this.dir.z,this.dir.x);
  this.laneFill=new THREE.MeshBasicMaterial({color:PAL.enemy,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  this.laneEdge=new THREE.LineBasicMaterial({color:PAL.enemyCore,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false});
  const x0=-TRUCK.len/2,x1=x0+L;
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(L,hw*2).rotateX(-Math.PI/2).translate(x0+L/2,0,0),this.laneFill));
  const pts:THREE.Vector3[]=[new THREE.Vector3(x0,0,-hw),new THREE.Vector3(x1,0,-hw),new THREE.Vector3(x0,0,hw),new THREE.Vector3(x1,0,hw)];
  // chevrons down its length, pointing the way it'll come
  for(let x=x0+5;x<x1-1;x+=3.5)pts.push(new THREE.Vector3(x-1,0,-hw*.6),new THREE.Vector3(x,0,0),new THREE.Vector3(x,0,0),new THREE.Vector3(x-1,0,hw*.6));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),this.laneEdge));
  s.add(g);this.lane=g;
 }
 private clearLane(){if(this.lane){this.lane.removeFromParent();this.lane=null;this.laneFill=null;this.laneEdge=null;}}
 // charging: whoever it reaches, once a run
 private ram(){
  const c=this.e.c,perp=new THREE.Vector3(-this.dir.z,0,this.dir.x);
  const test=(p:THREE.Vector3,r:number)=>{const d=p.clone().sub(this.pos).setY(0),along=d.dot(this.dir),side=d.dot(perp);return Math.abs(along)<TRUCK.len/2+r&&Math.abs(side)<TRUCK.wide/2+r?this.pos.clone().addScaledVector(this.dir,along).setY(0):null;};
  if(!c.player.down&&!this.hitThisRun.has(c.player)){const at=test(c.player.pos,.45);if(at){this.hitThisRun.add(c.player);this.e.hurtPlayer(TRUCK.damage,at);c.shake(.6);c.sfx.play.slam();}}
  for(const q of c.everyone()){if(q.down>0||this.hitThisRun.has(q))continue;const at=test(q.pos,.4);if(at){this.hitThisRun.add(q);this.e.knock(q,at);}}
 }
 // a disc that reaches it: a crack in the glass, and three wreck it
 probe(d:Disc){
  if(!this.alive||this.state==='arrive')return false;
  const l=d.pos.clone().sub(this.group.position).applyAxisAngle(UP,this.heading);
  if(Math.abs(l.x)>TRUCK.len/2+.3||Math.abs(l.z)>TRUCK.wide/2+.3||l.y<.2||l.y>2.2)return false;
  this.hit(d.owner.isPlayer);return true;
 }
 hit(byPlayer=true){
  if(!this.alive)return;const c=this.e.c;this.hp--;this.flash=1;this.crack();c.sfx.play.shatter();c.sfx.play.hit();
  c.sparks.burst(this.group.position.clone().setY(1.6),PAL.white,40,7,{gravity:-8});
  this.e.event('truck-crack',{truck:this,byPlayer});
  if(this.hp<=0)this.wreck();
 }
 // a spider-web in one of its panes
 private crack(){
  const pane=this.panes[this.cracks%this.panes.length],cu=rand(.35,.65),cv=rand(.3,.7),r=Math.min(pane.w,pane.h);
  const at=(u:number,v:number)=>pane.o.clone().addScaledVector(pane.u,clamp(u,.04,.96)*pane.w).addScaledVector(pane.v,clamp(v,.04,.9)*pane.h);
  const pts:THREE.Vector3[]=[],rays=7+Math.floor(rand(0,3)),ring:THREE.Vector3[]=[];
  for(let i=0;i<rays;i++){
   const a=i/rays*Math.PI*2+rand(-.2,.2),len=r*rand(.35,.75),du=Math.cos(a)*len/pane.w,dv=Math.sin(a)*len/pane.h;
   pts.push(at(cu,cv),at(cu+du*.5+rand(-.03,.03),cv+dv*.5),at(cu+du*.5,cv+dv*.5),at(cu+du,cv+dv));ring.push(at(cu+du*.35,cv+dv*.35));
  }
  for(let i=0;i<ring.length;i++)pts.push(ring[i],ring[(i+1)%ring.length]);
  const l=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:PAL.white}));
  this.group.add(l);this.crackLines.push(l);this.cracks++;
 }
 wreck(){
  if(!this.alive)return;const c=this.e.c,tmp=new THREE.Vector3();
  for(let i=0;i<260;i++){tmp.set(rand(-3,3),rand(.4,1.9),rand(-1.05,1.05)).applyAxisAngle(UP,-this.heading).add(this.group.position);c.sparks.burst(tmp,i%3?PAL.enemy:PAL.white,1,3,{gravity:-6,life:1.6});}
  c.sfx.play.derez(this.pos);c.sfx.play.slam();c.shake(.4);
  this.state='gone';this.clearLane();this.group.removeFromParent();this.engine?.stop(true);this.engine=null;this.e.event('truck-wreck',this);this.done=true;
 }
 dispose(){if(this.state==='gone'&&!this.group.parent)return;this.state='gone';this.done=true;this.clearLane();this.group.removeFromParent();this.engine?.stop(false);this.engine=null;}
}
