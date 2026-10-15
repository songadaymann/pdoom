import * as THREE from 'three';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import {makeIconToy} from './doom-icon-toy';
import {meadowUniforms} from './doom-meadow-shared';
import {makeIconPhysics,type IconObstacle} from './doom-icon-physics';

/* Nine chunky desktop toys. Pixel silhouettes have solid edges; Rapier owns all
 * positions and rotations. Only their separate, readable labels face the player. */

type Draw=(g:CanvasRenderingContext2D)=>void;
const px=(g:CanvasRenderingContext2D,c:string,x:number,y:number,w=1,h=1)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
const ART:Record<string,Draw>={
 computer:g=>{px(g,'#3d3a30',3,2,26,21);px(g,'#d8d2bc',4,3,24,19);px(g,'#f3efe0',4,3,24,1);px(g,'#9f9a86',27,3,1,19);px(g,'#2b2b2b',7,6,18,13);px(g,'#0f7f7f',8,7,16,11);px(g,'#7fd0d0',9,8,4,1);
  px(g,'#3d3a30',12,22,8,3);px(g,'#b5af98',13,22,6,2);px(g,'#3d3a30',2,25,28,5);px(g,'#d8d2bc',3,26,26,3);for(let x=5;x<27;x+=3)px(g,'#8f8a76',x,27,2,1);},
 winamp:g=>{px(g,'#14161a',3,3,26,26);px(g,'#8f969e',4,4,24,24);px(g,'#2a2e35',5,5,22,22);px(g,'#3b414a',5,5,22,2);
  g.fillStyle='#ffb11f';g.beginPath();g.moveTo(19,6);g.lineTo(9,18);g.lineTo(15,18);g.lineTo(11,27);g.lineTo(23,13);g.lineTo(17,13);g.lineTo(21,6);g.closePath();g.fill();
  g.fillStyle='#fff3b0';g.beginPath();g.moveTo(19,7);g.lineTo(12,16);g.lineTo(14,16);g.lineTo(19.5,8);g.fill();},
 mines:g=>{px(g,'#7b7b7b',3,3,26,26);px(g,'#c0c0c0',4,4,24,24);px(g,'#fff',4,4,24,2);px(g,'#fff',4,4,2,24);px(g,'#808080',4,26,24,2);px(g,'#808080',26,4,2,24);
  px(g,'#000',15,7,2,18);px(g,'#000',7,15,18,2);px(g,'#000',10,10,2,2);px(g,'#000',20,10,2,2);px(g,'#000',10,20,2,2);px(g,'#000',20,20,2,2);
  g.fillStyle='#000';g.beginPath();g.arc(16,16,6,0,Math.PI*2);g.fill();px(g,'#fff',13,13,2,2);},
 cards:g=>{px(g,'#1b1b1b',3,3,15,22);px(g,'#fff',4,4,13,20);px(g,'#2357b8',5,5,11,18);for(let y=6;y<23;y+=2)for(let x=6+(y%4?1:0);x<16;x+=2)px(g,'#5d8be0',x,y);
  px(g,'#1b1b1b',12,7,17,23);px(g,'#fff',13,8,15,21);px(g,'#c81d25',14,9,3,1);px(g,'#c81d25',14,10,1,3);px(g,'#c81d25',16,10,1,3);px(g,'#c81d25',15,11,1,1);
  g.fillStyle='#c81d25';g.beginPath();g.arc(18.5,17,2.5,0,Math.PI*2);g.arc(23.5,17,2.5,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(16,18);g.lineTo(26,18);g.lineTo(21,25);g.fill();},
 paint:g=>{g.fillStyle='#4a3a22';g.beginPath();g.ellipse(15,17,13,10,-.2,0,Math.PI*2);g.fill();g.fillStyle='#e9cf9f';g.beginPath();g.ellipse(15,17,12,9,-.2,0,Math.PI*2);g.fill();
  g.fillStyle='#d1c0a0';g.beginPath();g.arc(19,21,2.5,0,Math.PI*2);g.fill();
  for(const [c,x,y] of [['#e3262b',8,13],['#2a5bd7',13,10],['#f5cc19',19,11],['#2fa84f',8,19]] as const){g.fillStyle=c;g.beginPath();g.arc(x,y,2.4,0,Math.PI*2);g.fill();}
  g.strokeStyle='#7a4a1c';g.lineWidth=2.2;g.beginPath();g.moveTo(29,3);g.lineTo(18,17);g.stroke();px(g,'#1c1c1c',16,17,3,3);px(g,'#c9c9c9',18,15,2,2);},
 globe:g=>{g.fillStyle='#10306e';g.beginPath();g.arc(16,16,13,0,Math.PI*2);g.fill();g.fillStyle='#2f74d6';g.beginPath();g.arc(16,16,12,0,Math.PI*2);g.fill();
  g.fillStyle='#3cae4c';for(const [x,y,w,h] of [[8,8,7,5],[10,13,4,6],[18,9,6,4],[19,13,5,7],[13,21,6,3]])g.fillRect(x,y,w,h);
  g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=1;g.beginPath();g.ellipse(16,16,5,12,0,0,Math.PI*2);g.moveTo(4,16);g.lineTo(28,16);g.stroke();px(g,'#e9f4ff',10,7,2,2);},
 floppy:g=>{px(g,'#111',4,3,24,26);px(g,'#28457f',5,4,22,24);px(g,'#c9ced6',10,4,12,9);px(g,'#7f8792',17,5,3,7);px(g,'#f4f4ef',8,16,16,11);for(let y=18;y<26;y+=3)px(g,'#9fa7b8',9,y,14,1);px(g,'#1a1a1a',6,25,2,2);},
 recycle:g=>{g.fillStyle='#555c63';g.beginPath();g.moveTo(5,7);g.lineTo(27,7);g.lineTo(24,29);g.lineTo(8,29);g.fill();g.fillStyle='#cfd6dc';g.beginPath();g.moveTo(6,8);g.lineTo(26,8);g.lineTo(23,28);g.lineTo(9,28);g.fill();
  g.strokeStyle='#8c949c';g.lineWidth=1;for(let x=9;x<25;x+=3){g.beginPath();g.moveTo(x,8);g.lineTo(x-1+(x-16)*.12,28);g.stroke();}for(let y=12;y<28;y+=4){g.beginPath();g.moveTo(6+(y-8)*.15,y);g.lineTo(26-(y-8)*.15,y);g.stroke();}
  px(g,'#3a4046',4,6,24,2);px(g,'#fff',10,4,5,4);px(g,'#f1f1e8',15,3,6,5);px(g,'#ddd',20,5,4,3);},
 txt:g=>{px(g,'#222',7,2,18,28);px(g,'#fff',8,3,16,26);px(g,'#222',19,3,1,5);px(g,'#222',19,7,5,1);px(g,'#d9d9d9',20,3,4,4);for(let y=10;y<27;y+=3)px(g,'#7d8aa5',10,y,12,1);
  g.fillStyle='#c81d25';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText('?',16,24);},
};
export const DESKTOP_ICONS=[
 {id:'computer',mass:1.8,label:'My Computer',x:3,z:-13},{id:'recycle',mass:1.45,label:'Recycle Bin',x:31,z:-11},{id:'winamp',mass:1.0,label:'Winamp',x:-8,z:-24},
 {id:'mines',mass:1.2,label:'Minesweeper',x:40,z:-26},{id:'cards',mass:0.65,label:'Solitaire',x:24,z:-34},{id:'paint',mass:0.9,label:'Paint',x:-18,z:-8},
 {id:'globe',mass:1.05,label:'The Internet',x:52,z:-8},{id:'floppy',mass:0.7,label:'3½ Floppy (A:)',x:-4,z:-176},{id:'txt',mass:0.55,label:'SECRETS.TXT',x:-12,z:-186},
];
function labelTexture(label:string,selected:boolean){
 const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d')!;
 g.font='bold 28px sans-serif';g.textAlign='center';g.textBaseline='middle';const w=Math.min(252,g.measureText(label).width+18);
 if(selected){g.fillStyle='#000080';g.fillRect(128-w/2,9,w,42);g.strokeStyle='#ffffaa';g.setLineDash([2,2]);g.strokeRect(128-w/2+.5,9.5,w-1,41);}
 else{g.fillStyle='#000';g.fillText(label,130,34,248);}
 g.fillStyle='#fff';g.fillText(label,128,32,248);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;
}

export async function makeDesktopIcons(scene:THREE.Scene,audio:AudioContext,obstacles:IconObstacle[]){
 const root=new THREE.Group();scene.add(root);
 const bus=(audio as AudioContext&{pdoomBuses?:{sfx:GainNode}}).pdoomBuses?.sfx??audio.destination;
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
 {const g=shadowCanvas.getContext('2d')!,r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(.6,'rgba(0,0,0,.5)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);}
 const shadowMap=new THREE.CanvasTexture(shadowCanvas),shadowGeometry=new THREE.PlaneGeometry(1.9,1.4).rotateX(-Math.PI/2);
 const icons=DESKTOP_ICONS.map(spec=>{
  const toy=makeIconToy(ART[spec.id]);root.add(toy.mesh);
  const textures=[labelTexture(spec.label,false),labelTexture(spec.label,true)];
  const label=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.625),new THREE.MeshBasicMaterial({map:textures[0],transparent:true,alphaTest:.5,side:THREE.DoubleSide}));root.add(label);
  const shadow=new THREE.Mesh(shadowGeometry,new THREE.MeshBasicMaterial({map:shadowMap,color:0,transparent:true,opacity:.34,depthWrite:false}));shadow.renderOrder=5;root.add(shadow);
  return {...spec,...toy,textures,label,shadow,selected:false};
 });
 const physics=await makeIconPhysics(icons,obstacles),pressedGrass=meadowUniforms().uToys.value;
 function voice(kind:'kick'|'bounce'|'tune',strength:number,distance:number){
  const level=Math.min(.32,.05+strength*.035)*Math.max(0,1-distance/45);if(level<.004)return;
  const now=audio.currentTime,out=audio.createGain();out.gain.value=level;out.connect(bus);
  if(kind==='tune'){[523.25,659.25,783.99,1046.5].forEach((f,i)=>{const o=audio.createOscillator(),e=audio.createGain(),t=now+.06+i*.085;o.type='square';o.frequency.value=f;e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(.35,t+.01);e.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(e).connect(out);o.start(t);o.stop(t+.17);});}
  else{
   const body=audio.createOscillator(),e=audio.createGain();body.type='sine';body.frequency.setValueAtTime(kind==='kick'?170:120,now);body.frequency.exponentialRampToValueAtTime(55,now+.09);
   e.gain.setValueAtTime(1,now);e.gain.exponentialRampToValueAtTime(.001,now+(kind==='kick'?.16:.11));body.connect(e).connect(out);body.start(now);body.stop(now+.18);
   const n=audio.createBuffer(1,Math.ceil(audio.sampleRate*.06),audio.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
   const s=audio.createBufferSource(),f=audio.createBiquadFilter(),ng=audio.createGain();s.buffer=n;f.type='lowpass';f.frequency.value=kind==='kick'?1400:700;ng.gain.value=.55;s.connect(f).connect(ng).connect(out);s.start(now);
  }
  setTimeout(()=>out.disconnect(),800);
 }
 let visible=true,total=0,disposed=false;
 return {
  setVisible(value:boolean){visible=value;root.visible=value;if(!value)pressedGrass.forEach(v=>v.w=0);},
  update(dt:number,_time:number,player:THREE.Vector3,velocity:THREE.Vector3,paused:boolean){
   if(!visible||disposed)return;
   if(!paused)physics.update(dt,player,velocity,(id,speed,d)=>{total++;voice('kick',speed,d);if(id==='winamp'&&speed>.6)voice('tune',3,d);},(strength,d)=>voice('bounce',strength,d));
   let nearest=-1,best=3.2;
   for(let i=0;i<icons.length;i++){
    const p=physics.toys[i].body.translation(),d=Math.hypot(p.x-player.x,p.z-player.z);
    if(d<best){best=d;nearest=i;}
   }
   icons.forEach((icon,i)=>{
    const body=physics.toys[i].body,p=body.translation(),r=body.rotation();
    icon.mesh.position.set(p.x,p.y,p.z);icon.mesh.quaternion.set(r.x,r.y,r.z,r.w);
    const ground=groundY(p.x,p.z),air=Math.max(0,p.y-ground);
    const normalY=1-2*(r.x*r.x+r.z*r.z); // local up in world y
    pressedGrass[i].set(p.x,p.z,1.15,Math.max(0,Math.min(1,(1.15-air)*3))*(1-Math.abs(normalY)*.25));
    // Labels stay out of the player's face during a close kick or high bounce.
    icon.label.visible=Math.hypot(p.x-player.x,p.z-player.z)>2&&air<1.4;
    // Separate labels remain legible when the physical art lies on its side.
    icon.label.position.set(p.x,Math.max(ground+.65,p.y+1.2),p.z);
    icon.label.rotation.y=Math.atan2(player.x-p.x,player.z-p.z);
    icon.shadow.position.set(p.x,ground+.03,p.z);icon.shadow.scale.setScalar(1/(1+air*.3));(icon.shadow.material as THREE.MeshBasicMaterial).opacity=.34/(1+air*.5);
    const selected=i===nearest;if(selected!==icon.selected){icon.selected=selected;icon.label.material.map=icon.textures[selected?1:0];icon.material.color.setHex(selected?0xc4d4ff:0xffffff);}
   });
  },
  getState:()=>({visible,kicks:total,physics:physics.getState(),icons:icons.map((icon,i)=>{
   const toy=physics.toys[i],p=toy.body.translation(),q=toy.body.rotation(),v=toy.body.linvel(),a=toy.body.angvel();
   // air is clearance at the lowest point of the collision hull, not its centre.
   let lowest=Infinity;const vertex=new THREE.Vector3(),position=new THREE.Vector3(p.x,p.y,p.z),rotation=new THREE.Quaternion(q.x,q.y,q.z,q.w);
   for(let n=0;n<icon.hull.length;n+=3){vertex.fromArray(icon.hull,n).applyQuaternion(rotation).add(position);lowest=Math.min(lowest,vertex.y-groundY(vertex.x,vertex.z));}
   return {id:icon.id,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),air:+Math.max(0,lowest).toFixed(2),
    mass:toy.mass,kicks:toy.kicks,selected:icon.selected,sleeping:toy.body.isSleeping(),speed:+Math.hypot(v.x,v.y,v.z).toFixed(3),
    angular_speed:+Math.hypot(a.x,a.y,a.z).toFixed(3),rotation:{x:q.x,y:q.y,z:q.z,w:q.w}};
  })}),
  debug:{place(id:string,x:number,z:number,yaw=0,height=0,flat=false){
   const t=physics.toys.find(t=>t.id===id);if(!t)return;
   const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(flat?-Math.PI/2:0,yaw,0,'YXZ'));
   t.body.setTranslation({x,y:groundY(x,z)+(flat?.17:t.halfHeight)+.08+height,z},true);
   t.body.setRotation(q,true);t.body.setLinvel({x:0,y:0,z:0},true);t.body.setAngvel({x:0,y:0,z:0},true);
  }},
  dispose(){if(disposed)return;disposed=true;pressedGrass.forEach(v=>v.w=0);root.removeFromParent();physics.dispose();
   for(const icon of icons){icon.mesh.geometry.dispose();icon.material.dispose();icon.label.geometry.dispose();icon.label.material.dispose();icon.textures.forEach(t=>t.dispose());icon.shadow.material.dispose();}
   shadowGeometry.dispose();shadowMap.dispose();
  },
 };
}
