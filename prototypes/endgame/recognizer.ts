import * as THREE from 'three';
import {PAL,glowSprite,type Sparks} from './kit';

/* A Recognizer: the flying lower-case "n" gantry from Tron. Original geometry: a crossbar on two
 * legs with a head under the middle of the bar and a glowing core beneath it (the weak spot).
 * 'slam' style hunts a target, hovers over it while its shadow grows, then drops; 'bolt' style
 * (the tennis prototype) keeps its distance and fires shots you can hit back. Three hits. */
const S=.75,HOVER=13,GROUND=6.08,SLAM_RADIUS=3.6;
type Box={c:THREE.Vector3;h:THREE.Vector3};
type Events={slam:(at:THREE.Vector3,r:number,rec:Recognizer)=>void;telegraph:(at:THREE.Vector3,r:number,dur:number)=>void;fire:(rec:Recognizer,from:THREE.Vector3)=>void;pick:()=>(()=>THREE.Vector3)};

export class Recognizer{
 group=new THREE.Group();core:THREE.Mesh;coreGlow:THREE.Sprite;shadow=new THREE.Group();shadowFill:THREE.MeshBasicMaterial;shadowRing:THREE.MeshBasicMaterial;
 state:'enter'|'hunt'|'telegraph'|'slam'|'ground'|'rise'|'hover'|'charge'='enter';t=0;hp=3;alive=true;
 target:()=>THREE.Vector3;lockAt=new THREE.Vector3();vel=new THREE.Vector3();heading=0;flash=0;fireCd=2.2;orbit=0;telegraphFor=1.7;
 orbitR=18;orbitY=9.5;orbitDir=1;refire=3.2;// 'bolt': how far off, how high, which way round, how often
 boxes:Box[]=[];lineMats:THREE.LineBasicMaterial[]=[];
 constructor(scene:THREE.Scene,public style:'slam'|'bolt',from:THREE.Vector3,target:()=>THREE.Vector3,hp=3){
  this.target=target;this.hp=hp;
  const part=(w:number,h:number,d:number,x:number,y:number,z:number,collide=true)=>{
   const geo=new THREE.BoxGeometry(w*S,h*S,d*S).translate(x*S,y*S,z*S),m=new THREE.LineBasicMaterial({color:PAL.enemy});
   this.group.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x160404})),new THREE.LineSegments(new THREE.EdgesGeometry(geo),m));this.lineMats.push(m);
   if(collide)this.boxes.push({c:new THREE.Vector3(x*S,y*S,z*S),h:new THREE.Vector3(w*S/2,h*S/2,d*S/2)});
  };
  part(12,1.8,2.6,0,.9,0);part(1.5,7.5,2.6,-5.25,-3.75,0);part(1.5,7.5,2.6,5.25,-3.75,0);
  part(2.4,.6,3.2,-5.25,-7.8,0,false);part(2.4,.6,3.2,5.25,-7.8,0,false);part(2.4,1.8,2.2,0,-.9,1,false);
  // the glowing stripes along its top, Tron-style
  for(const z of [-.9,.9]){const geo=new THREE.BoxGeometry(11.6*S,.12,.12).translate(0,1.85*S,z*S);this.group.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:PAL.enemyCore})));}
  this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,0),new THREE.MeshBasicMaterial({color:PAL.enemyCore}));this.core.position.set(0,-2.1*S,.2);
  this.coreGlow=glowSprite(PAL.enemy,3.2);this.coreGlow.position.copy(this.core.position);this.group.add(this.core,this.coreGlow);
  this.group.position.copy(from);scene.add(this.group);
  this.shadowFill=new THREE.MeshBasicMaterial({color:PAL.enemy,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  this.shadowRing=new THREE.MeshBasicMaterial({color:PAL.enemyCore,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  this.shadow.add(new THREE.Mesh(new THREE.CircleGeometry(SLAM_RADIUS,40).rotateX(-Math.PI/2),this.shadowFill),new THREE.Mesh(new THREE.RingGeometry(SLAM_RADIUS-.18,SLAM_RADIUS,48).rotateX(-Math.PI/2),this.shadowRing));
  this.shadow.position.y=.04;this.shadow.visible=false;scene.add(this.shadow);
 }
 corePos(out=new THREE.Vector3()){return this.core.getWorldPosition(out);}
 get pos(){return this.group.position;}
 // the normal of the box face a point is inside, if any (for discs that hit its frame)
 collide(p:THREE.Vector3):THREE.Vector3|null{
  if(!this.alive)return null;
  const l=p.clone().sub(this.group.position).applyAxisAngle(new THREE.Vector3(0,1,0),-this.heading);
  for(const b of this.boxes){
   const d=l.clone().sub(b.c),px=b.h.x+.2-Math.abs(d.x),py=b.h.y+.2-Math.abs(d.y),pz=b.h.z+.2-Math.abs(d.z);
   if(px>0&&py>0&&pz>0){const n=px<py&&px<pz?new THREE.Vector3(Math.sign(d.x),0,0):py<pz?new THREE.Vector3(0,Math.sign(d.y),0):new THREE.Vector3(0,0,Math.sign(d.z));return n.applyAxisAngle(new THREE.Vector3(0,1,0),this.heading);}
  }
  return null;
 }
 hit(amount=1){if(!this.alive)return false;this.hp-=amount;this.flash=Math.max(this.flash,amount>=1?1:.6);if(this.hp<=1e-6){this.alive=false;return true;}return false;}
 derez(sparks:Sparks){
  const tmp=new THREE.Vector3();
  for(const b of this.boxes)for(let i=0;i<70;i++){tmp.set(b.c.x+(Math.random()*2-1)*b.h.x,b.c.y+(Math.random()*2-1)*b.h.y,b.c.z+(Math.random()*2-1)*b.h.z).applyAxisAngle(new THREE.Vector3(0,1,0),this.heading).add(this.group.position);sparks.burst(tmp,i%3?PAL.enemy:PAL.enemyCore,1,2.5,{gravity:-5,life:1.6});}
  this.group.removeFromParent();this.shadow.removeFromParent();
 }
 private face(dx:number,dz:number,dt:number,rate=3){if(Math.hypot(dx,dz)<.01)return;const want=Math.atan2(dx,dz);this.heading+=Math.atan2(Math.sin(want-this.heading),Math.cos(want-this.heading))*Math.min(1,dt*rate);}
 update(dt:number,ev:Events,player:THREE.Vector3){
  if(!this.alive)return;this.t+=dt;
  this.flash=Math.max(0,this.flash-dt*3);
  const p=this.group.position,goal=this.target();
  const coreHot=this.state==='ground'||this.state==='charge';
  (this.core.material as THREE.MeshBasicMaterial).color.set(this.flash>0?PAL.white:PAL.enemyCore);
  this.core.scale.setScalar((coreHot?1.35:1)+this.flash*.6+(this.state==='charge'?Math.min(1,this.t/.8)*.5:0));this.coreGlow.scale.setScalar(coreHot?5:3.2);
  for(const m of this.lineMats)m.color.set(this.flash>.5?PAL.white:PAL.enemy);
  const flyTo=(x:number,y:number,z:number,speed:number)=>{
   const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,speed*dt);
   if(d>.01){p.x+=dx/d*step;p.z+=dz/d*step;this.face(dx,dz,dt);}p.y+=(y-p.y)*Math.min(1,dt*2);return d;
  };
  if(this.style==='bolt'){
   // Keep orbitR off (18 m), drift round you, face you, charge and fire; stay clear of the column and inside the wall.
   const away=new THREE.Vector2(p.x-player.x,p.z-player.z);if(away.lengthSq()<.01)away.set(0,1);away.normalize();
   this.orbit+=dt*.14;const a=Math.atan2(away.y,away.x)+dt*.14*this.orbitDir;let tx=player.x+Math.cos(a)*this.orbitR,tz=player.z+Math.sin(a)*this.orbitR;
   const tr=Math.hypot(tx,tz),fit=tr<15?15/tr:tr>42?42/tr:1;tx*=fit;tz*=fit;
   const speed=this.state==='enter'?16:5;flyTo(tx,this.orbitY,tz,speed);this.face(player.x-p.x,player.z-p.z,dt,5);
   if(this.state==='enter'&&Math.hypot(p.x-tx,p.z-tz)<3){this.state='hover';this.t=0;}
   if(this.state==='hover'){this.fireCd-=dt;if(this.fireCd<=0){this.state='charge';this.t=0;}}
   if(this.state==='charge'&&this.t>=.8){this.state='hover';this.t=0;this.fireCd=this.refire;ev.fire(this,this.corePos());}
   return;
  }
  switch(this.state){
   case 'enter':if(flyTo(goal.x,HOVER,goal.z,16)<22){this.state='hunt';this.t=0;}break;
   case 'hunt':if(flyTo(goal.x,HOVER,goal.z,8.5)<1.2||this.t>7){this.state='telegraph';this.t=0;this.lockAt.set(goal.x,0,goal.z);ev.telegraph(this.lockAt,SLAM_RADIUS,this.telegraphFor);}break;
   case 'telegraph':{
    flyTo(this.lockAt.x,HOVER+1.2,this.lockAt.z,6);const k=Math.min(1,this.t/this.telegraphFor);
    this.shadow.visible=true;this.shadow.position.set(this.lockAt.x,.04,this.lockAt.z);this.shadow.scale.setScalar(1.25-.25*k);
    this.shadowFill.opacity=.08+.3*k;this.shadowRing.opacity=.5+.5*Math.abs(Math.sin(this.t*10));
    if(this.t>=this.telegraphFor){this.state='slam';this.t=0;}
    break;}
   case 'slam':{const k=Math.min(1,this.t/.28);p.y=HOVER+1.2+(GROUND-HOVER-1.2)*k*k;this.shadowFill.opacity=.45;if(k>=1){this.state='ground';this.t=0;this.shadow.visible=false;ev.slam(this.lockAt,SLAM_RADIUS,this);}break;}
   case 'ground':if(this.t>=2){this.state='rise';this.t=0;}break;
   case 'rise':p.y+=(HOVER-p.y)*Math.min(1,dt*2.5);if(this.t>=1){this.state='hunt';this.t=0;this.target=ev.pick();}break;
  }
 }
}
