import * as THREE from 'three';
import {ARENA,PAL,TURBINES,edged,glowSprite,rand} from './kit';

/* The tower is a data center (Jonathan, 2026-10-30: "The elon tron building should be a data center!!! it doesn't
 * have to change that much but, the sound is sort of already there"). Outside, for the walk in (?m=finale): his sign
 * over the door, our Community Note under it in cyan, a GPU count over the door that only goes up, and gas turbines
 * either side of the approach, all hidden once you're in. Inside: the eight pillars are server racks, with blinking
 * lights and a fan on top. The lights are white and green, never cyan (the trick shot's marks) or red (his attacks),
 * and dim for the trick shot. Every word is DoomSmall with a hard drop shadow, so this is made after the font loads. */
type Row=[text:string,color:string,px:number];
function board(rows:Row[],w:number,h:number,bg:string,edge:string){
 const cv=document.createElement('canvas');cv.width=2048;cv.height=Math.round(2048*h/w);const g=cv.getContext('2d')!;
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
 const draw=(list:Row[])=>{
  g.fillStyle=bg;g.fillRect(0,0,cv.width,cv.height);g.textAlign='center';g.textBaseline='middle';let y=(cv.height-list.reduce((s,[,,px])=>s+px*1.2,0))/2;
  for(const [t,col,px] of list){g.font=`${px}px DoomSmall, monospace`;const k=Math.min(1,(cv.width-80)/g.measureText(t).width),d=Math.max(3,Math.round(px/16));g.save();g.translate(cv.width/2,y+px*.6);g.scale(k,1);g.fillStyle='#000';g.fillText(t,d,d);g.fillStyle=col;g.fillText(t,0,0);g.restore();y+=px*1.2;}
  tex.needsUpdate=true;
 };
 draw(rows);const m=edged(new THREE.PlaneGeometry(w,h),0,edge);(m.children[0] as THREE.Mesh).material=new THREE.MeshBasicMaterial({map:tex});
 return {group:m,draw};
}
// a rack's front: 2U servers, vent holes, a handle each side; dark, so the pillar's cyan edges still read
function rackTexture(){
 const cv=document.createElement('canvas');cv.width=128;cv.height=256;const g=cv.getContext('2d')!;
 g.fillStyle='#050c12';g.fillRect(0,0,128,256);
 for(let y=0;y<256;y+=32){g.fillStyle='#0f2430';g.fillRect(0,y,128,2);g.fillStyle='#0b1a24';for(let x=22;x<106;x+=6)for(const dy of [10,16,22])g.fillRect(x,y+dy,3,3);g.fillStyle='#1a3442';g.fillRect(6,y+8,4,18);g.fillRect(118,y+8,4,18);}
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,4);return tex;
}
export function makeDatacenter(scene:THREE.Scene,{outside,pillars}:{outside:boolean;pillars:THREE.Group[]}){
 const R=ARENA.radius,H=ARENA.wallH,out:THREE.Object3D[]=[];
 // the racks: every side of a pillar but its top and bottom
 const rack=new THREE.MeshBasicMaterial({map:rackTexture()}),plain=new THREE.MeshBasicMaterial({color:0x050c12});
 for(const p of pillars)(p.children[0] as THREE.Mesh).material=[rack,rack,plain,plain,rack,rack];
 // the lights: one Points, 14 rows of two on each face of each pillar, each blinking at its own rate
 const pos:number[]=[],col:number[]=[],blink:number[]=[],v=new THREE.Vector3(),white=new THREE.Color(PAL.white),green=new THREE.Color('#5dff9a'),half=ARENA.pillarSize*1.45/2+.02;
 for(const p of pillars){
  p.updateMatrixWorld();
  for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]])for(const u of [-.55,.55])for(let r=0;r<14;r++){
   v.set(nx*half+(nz?u:0),1+r*.48,nz*half+(nx?u:0)).applyMatrix4(p.matrixWorld);pos.push(v.x,v.y,v.z);
   const c=Math.random()<.15?green:white;col.push(c.r,c.g,c.b);blink.push(Math.random(),Math.random()<.3?rand(4,9):rand(.3,1.4));
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('aCol',new THREE.Float32BufferAttribute(col,3));geo.setAttribute('aBlink',new THREE.Float32BufferAttribute(blink,2));
 const ledMat=new THREE.ShaderMaterial({uniforms:{uT:{value:0},uOn:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:'attribute vec3 aCol;attribute vec2 aBlink;uniform float uT,uOn;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vC=aCol*mix(.12,1.,step(.35,fract(uT*aBlink.y+aBlink.x)))*uOn;gl_PointSize=clamp(90./-mv.z,1.,4.);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.);}'});
 const leds=new THREE.Points(geo,ledMat);leds.frustumCulled=false;scene.add(leds);
 // a fan on top of each, behind a grille, matching the fan heard in each pillar (kit.ts bed())
 const grille=new THREE.MeshBasicMaterial({color:PAL.line,transparent:true,opacity:.5,side:THREE.DoubleSide}),blade=new THREE.MeshBasicMaterial({color:'#2c5566'});
 const fans=pillars.map(p=>{
  const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.85,32).rotateX(-Math.PI/2),grille),rotor=new THREE.Group();
  for(let k=0;k<3;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(1.3,.04,.22),blade);b.rotation.y=k*Math.PI/3;rotor.add(b);}
  ring.position.set(p.position.x,ARENA.pillarH+.05,p.position.z);rotor.position.copy(ring.position);scene.add(ring,rotor);return {rotor,speed:rand(8,14)};
 });
 let fanK=1,ledK=1,quietK=1,down:{t:number;sec:number}|null=null,gpus=1048576,gpuAt=0,inside=true;
 const heat:THREE.Sprite[]=[];let ticker:ReturnType<typeof board>|null=null,sign:THREE.Group|null=null;
 if(outside){
  // his sign, high over the door so the face still shows over the wall, on two struts
  sign=board([['COLOSSUS X',PAL.enemyCore,230],["THE WORLD'S BIGGEST DATA CENTER",PAL.enemy,90]],40,8.5,'#0a0304',PAL.enemy).group;sign.position.set(0,H+9.25,R+.9);out.push(sign);
  for(const x of [-15,15]){const strut=edged(new THREE.BoxGeometry(.5,H+13.5,.5).translate(0,(H+13.5)/2,0),0x0a0304,PAL.enemy,.8);strut.position.set(x,0,R+.6);out.push(strut);}
  // under it, ours: colour is the tell
  const note=board([['READERS ADDED CONTEXT: HE MEASURED IT HIMSELF.',PAL.line,84]],34,2,'#02090d',PAL.line).group;note.position.set(0,H+3.6,R+1);out.push(note);
  // over the door, the count
  ticker=board([['GPUS ONLINE: 1,048,576 AND COUNTING',PAL.white,104]],18,1.3,'#020406',PAL.enemy);ticker.group.position.set(0,H-1.1,R+1.2);out.push(ticker.group);
  // the turbines: lying along the approach, a stack each, heat off the top, TEMPORARY on the side you pass
  const cv=document.createElement('canvas');cv.width=512;cv.height=96;const g=cv.getContext('2d')!;g.font='72px DoomSmall, monospace';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#000';g.fillText('TEMPORARY',260,52);g.fillStyle=PAL.enemy;g.fillText('TEMPORARY',256,48);
  const stencilTex=new THREE.CanvasTexture(cv);stencilTex.colorSpace=THREE.SRGBColorSpace;const stencil=new THREE.MeshBasicMaterial({map:stencilTex,transparent:true,depthWrite:false});
  for(const t of TURBINES){
   const side=Math.sign(t.x),body=edged(new THREE.CylinderGeometry(1.5,1.5,7,12).rotateX(Math.PI/2),0x0a0d10,PAL.enemy,.6);body.position.set(t.x,2.1,t.z);
   const stack=edged(new THREE.BoxGeometry(.9,3.2,.9),0x0a0d10,PAL.enemy,.6);stack.position.set(t.x,4.4,t.z+2.6);
   const hot=glowSprite(PAL.enemyCore,3,.35);hot.position.set(t.x,6.4,t.z+2.6);heat.push(hot);
   const label=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.68),stencil);label.position.set(t.x-side*1.53,2.1,t.z);label.rotation.y=-side*Math.PI/2;
   out.push(body,stack,hot,label);
  }
  scene.add(...out);
 }
 const show=()=>{for(const o of out)o.visible=!inside;};show();
 return {
  // true once you're in (and before the walk starts): nothing of the outside floats over the wall in the fight
  inside(on:boolean){inside=on;show();},
  // dimmer lights while you line up the trick shot
  quiet(on:boolean){quietK=on?.25:1;},
  // the meltdown: fans and lights wind down over `sec`, the turbines' heat goes out
  powerDown(sec:number){down={t:0,sec};},
  tick(t:number,dt:number){
   if(down){down.t+=dt;const k=Math.max(0,1-down.t/down.sec);fanK=k*k;ledK=k;for(const h of heat)h.visible=false;}
   for(const f of fans)f.rotor.rotation.y+=f.speed*fanK*dt;
   ledMat.uniforms.uT.value=t;ledMat.uniforms.uOn.value+=(ledK*quietK-ledMat.uniforms.uOn.value)*Math.min(1,dt*4);
   if(!inside){for(const h of heat)h.material.opacity=.25+Math.random()*.2;if(ticker&&t>gpuAt){gpuAt=t+.5;gpus+=Math.floor(rand(1,90));ticker.draw([[`GPUS ONLINE: ${gpus.toLocaleString('en-US')} AND COUNTING`,PAL.white,104]]);}}
  },
  get state(){return {sign:!!sign&&sign.visible,turbines:heat.length,leds:pos.length/3,fan:+(fanK).toFixed(2),gpus};},
 };
}
export type Datacenter=ReturnType<typeof makeDatacenter>;
