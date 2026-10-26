import * as THREE from 'three';
import {PAL,textSprite,glowSprite,edged,type Sparks} from './kit';

/* The MCP's two Phase 1 threats from spec 05 §4.4.4: POSTS, slow one-word bars that drift
 * toward a human (a disc shatters them), and LET THAT SINK IN, a pixel kitchen sink that drops
 * on a shadow after 2 s. */
const WORDS=['WOW','!!','CONCERNING','INTERESTING','LOL','TRUE','100%'];

export class Post{
 group=new THREE.Group();pos:THREE.Vector3;vel:THREE.Vector3;age=0;alive=true;
 constructor(scene:THREE.Scene,from:THREE.Vector3,public target:()=>THREE.Vector3|null){
  this.pos=from.clone();const word=WORDS[Math.floor(Math.random()*WORDS.length)];
  this.group.add(textSprite(word,PAL.enemy,.9),glowSprite(PAL.enemy,2.2,.5));this.group.position.copy(this.pos);scene.add(this.group);
  const t=target();this.vel=(t?t.clone().sub(from):new THREE.Vector3(0,0,1)).normalize().multiplyScalar(3.6);
 }
 update(dt:number){
  this.age+=dt;const t=this.target();
  if(t){const want=t.clone().setY(1.3).sub(this.pos).normalize().multiplyScalar(3.6);this.vel.lerp(want,Math.min(1,dt*.9));}
  this.pos.addScaledVector(this.vel,dt);this.group.position.copy(this.pos).add(new THREE.Vector3(0,Math.sin(this.age*3)*.15,0));
  if(this.age>16)this.remove();
 }
 shatter(sparks:Sparks){if(!this.alive)return;sparks.burst(this.pos,PAL.enemy,60,7,{gravity:-6});this.remove();}
 remove(){this.alive=false;this.group.removeFromParent();}
}

export class Sink{
 t=0;state:'shadow'|'fall'|'stay'|'gone'='shadow';group=new THREE.Group();shadow=new THREE.Group();ringMat:THREE.MeshBasicMaterial;fillMat:THREE.MeshBasicMaterial;
 static RADIUS=2.4;static WARN=2;
 constructor(scene:THREE.Scene,public at:THREE.Vector3){
  this.ringMat=new THREE.MeshBasicMaterial({color:PAL.white,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false});
  this.fillMat=new THREE.MeshBasicMaterial({color:PAL.white,transparent:true,opacity:.05,blending:THREE.AdditiveBlending,depthWrite:false});
  this.shadow.add(new THREE.Mesh(new THREE.RingGeometry(Sink.RADIUS-.16,Sink.RADIUS,48).rotateX(-Math.PI/2),this.ringMat),new THREE.Mesh(new THREE.CircleGeometry(Sink.RADIUS,40).rotateX(-Math.PI/2),this.fillMat));
  this.shadow.position.set(at.x,.05,at.z);scene.add(this.shadow);
  // a kitchen sink in glowing white lines: basin, rim, tap
  const basin=edged(new THREE.BoxGeometry(2.4,.9,1.7).translate(0,.45,0),0x0b0f14,PAL.white);
  const tap=edged(new THREE.BoxGeometry(.2,.9,.2).translate(0,1.3,-.7),0x0b0f14,PAL.white),spout=edged(new THREE.BoxGeometry(.2,.18,.7).translate(0,1.72,-.4),0x0b0f14,PAL.white);
  this.group.add(basin,tap,spout);this.group.position.set(at.x,22,at.z);this.group.rotation.y=Math.random()*Math.PI;this.group.visible=false;scene.add(this.group);
 }
 // returns true on the frame it lands
 update(dt:number,sparks:Sparks){
  this.t+=dt;
  if(this.state==='shadow'){const k=Math.min(1,this.t/Sink.WARN);this.fillMat.opacity=.05+.25*k;this.ringMat.opacity=.5+.5*Math.abs(Math.sin(this.t*9));this.shadow.scale.setScalar(1.3-.3*k);if(this.t>=Sink.WARN){this.state='fall';this.t=0;this.group.visible=true;}}
  else if(this.state==='fall'){this.group.position.y=Math.max(0,22-this.t*this.t*140);if(this.group.position.y<=0){this.state='stay';this.t=0;this.shadow.visible=false;sparks.burst(this.at.clone().setY(.3),PAL.white,80,8,{gravity:-12});return true;}}
  else if(this.state==='stay'&&this.t>5){this.state='gone';sparks.burst(this.at.clone().setY(.8),PAL.white,90,2.5,{gravity:-3,life:1.4});this.group.removeFromParent();this.shadow.removeFromParent();}
  return false;
 }
}
