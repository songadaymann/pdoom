import * as THREE from 'three';
import {ARENA,PAL,TAU,wrap,glowSprite,type Sparks} from './kit';

/* THE MUSK CONTROL PROGRAM, staged after spec 05 §4.1: a faceted steel column over a pit of light,
 * an X crown, four engine bells, a waist ring of 24 shield panels whose gap is missing panels,
 * and a face that always turns to look at you. The face here is a PLACEHOLDER pixel mosaic of
 * nobody in particular, drawn in code; the real one is a pixel-mosaic Musk caricature in the
 * HUD-mugshot style (an art task), never a photo. It "downloads" like a progressive JPEG. */
const FW=24,FH=28;
type Expr='idle'|'talk'|'hurt'|'rage'|'wind';
const COLOURS=['#000000','#2a0500','#7a1405','#d8340e','#ff6a2a','#ffa86a','#ffe2c0'];
const hash=(x:number,y:number)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};

function shade(x:number,y:number,expr:Expr,mouthOpen:boolean):number{
 const u=(x+.5-12)/11.5,v=(y+.5-14)/13.5,au=Math.abs(u);
 let hw=v<.35?.9*Math.sqrt(Math.max(0,1-((v-.35)/1.35)**2)):.9-(v-.35)*.75;
 if(v>-.18&&v<.2)hw+=.07;                                   // ears
 if(au>hw||v<-1||v>1)return 0;
 const hairline=-.5-.2*Math.min(1,Math.max(0,(au-.18)/.4));
 if(v<hairline||(au>hw-.13&&v<-.08))return hash(x,y)>.6?2:1;
 let b=.6+.28*(1-au/Math.max(hw,.01))-.16*Math.max(0,-v)+(hash(x,y)-.5)*.16;
 if(v>.72)b-=.18;
 // brows
 const browY=expr==='wind'?8:9,inner=au<.34;
 if(au>.15&&au<.66&&(y===browY+(expr==='rage'&&inner?1:0)))return 1;
 // eyes
 if(au>.2&&au<.6&&(y===11||y===12)){
  if(expr==='hurt')return y===11?1:3;
  if(au>.32&&au<.46)return 1;
  return y===11?6:4;
 }
 // nose
 if((x===11||x===12)&&y>=12&&y<=16)return x===12?5:4;
 if(y===17&&(x===10||x===13))return 2;
 if(y===17&&(x===11||x===12))return 5;
 // mouth
 if(expr==='hurt'&&y>=20&&y<=21&&x>=8&&x<=15)return y===20?6:1;
 if((expr==='talk'&&mouthOpen||expr==='wind')&&y>=20&&y<=22&&x>=9&&x<=14)return y===20?1:y===21?2:1;
 if(expr==='rage'){if(y===21&&x>=8&&x<=15)return 1;if(y===22&&(x===8||x===15))return 1;}
 else if(y===20&&x>=8&&x<=15)return 1;
 if(expr!=='rage'&&y===19&&x===16)return 1;                 // the smirk
 return b>.93?6:b>.78?5:b>.6?4:b>.42?3:2;
}

export class MCP{
 root=new THREE.Group();column=new THREE.Group();crown=new THREE.Group();
 faceCanvas=document.createElement('canvas');faceTex:THREE.CanvasTexture;faceMat:THREE.MeshBasicMaterial;face:THREE.Mesh;
 panels:THREE.Mesh[]=[];edges:THREE.LineBasicMaterial[]=[];panelMats:THREE.MeshStandardMaterial[]=[];
 static N=24;step=TAU/24;base=0;spin=0;missing=new Set<number>();
 integrity=1000;max=1000;awake=false;shieldY=0;reveal=0;expr:Expr='idle';exprUntil=0;talkUntil=0;t=0;flash=0;dead=false;deadT=0;lastCaption=-9;
 facePos=new THREE.Vector3(0,ARENA.faceY,6);beam!:THREE.Mesh;private drawn='';private debris:{m:THREE.Mesh;v:THREE.Vector3;s:THREE.Vector3}[]=[];
 constructor(scene:THREE.Scene,private sparks:Sparks){
  scene.add(this.root);this.root.add(this.column);
  const colGeo=new THREE.CylinderGeometry(4.4,5.4,42,8,6).translate(0,21,0).toNonIndexed();colGeo.computeVertexNormals();
  this.column.add(new THREE.Mesh(colGeo,new THREE.MeshStandardMaterial({color:0x5d656c,metalness:.7,roughness:.32,flatShading:true})));
  this.column.add(new THREE.LineSegments(new THREE.EdgesGeometry(colGeo,10),new THREE.LineBasicMaterial({color:PAL.enemy})));
  for(const y of [1,8,30,36,41.8]){const r=5.4-(y/42)*1.0+.04,pts=Array.from({length:9},(_,i)=>new THREE.Vector3(Math.cos(i/8*TAU+Math.PI/8)*r,y,Math.sin(i/8*TAU+Math.PI/8)*r));
   this.column.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:PAL.enemyCore})));}
  // the X crown
  const bar=new THREE.BoxGeometry(9,1.1,1.1);const xm=new THREE.MeshBasicMaterial({color:PAL.enemyCore});
  for(const s of [1,-1]){const m=new THREE.Mesh(bar,xm);m.rotation.z=s*Math.PI/4;this.crown.add(m);}
  this.crown.position.y=48;this.root.add(this.crown);
  // four engine bells in the pit, and the pit's faint column of light
  for(let i=0;i<4;i++){const a=i*TAU/4+TAU/8,bell=new THREE.Mesh(new THREE.CylinderGeometry(1,2.2,2.6,14,1,true),new THREE.MeshBasicMaterial({color:PAL.enemy,side:THREE.DoubleSide}));
   bell.position.set(Math.cos(a)*7.6,1.6,Math.sin(a)*7.6);this.root.add(bell);const g=glowSprite(PAL.enemyCore,5,.8);g.position.copy(bell.position).setY(1);this.root.add(g);}
  this.root.add(this.beam=new THREE.Mesh(new THREE.CylinderGeometry(5.9,5.9,34,24,1,true).translate(0,17,0),new THREE.MeshBasicMaterial({color:PAL.enemy,transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})));
  // the waist ring
  const panelGeo=new THREE.BoxGeometry(2.5,20,.35),panelEdges=new THREE.EdgesGeometry(panelGeo);
  for(let i=0;i<MCP.N;i++){
   const mat=new THREE.MeshStandardMaterial({color:0x1a2630,metalness:.5,roughness:.45,transparent:true,opacity:.5,depthWrite:false});
   const m=new THREE.Mesh(panelGeo,mat),e=new THREE.LineBasicMaterial({color:PAL.enemy});m.add(new THREE.LineSegments(panelEdges,e));
   this.panels.push(m);this.panelMats.push(mat);this.edges.push(e);this.root.add(m);
  }
  this.faceCanvas.width=FW;this.faceCanvas.height=FH;
  this.faceTex=new THREE.CanvasTexture(this.faceCanvas);this.faceTex.colorSpace=THREE.SRGBColorSpace;this.faceTex.magFilter=this.faceTex.minFilter=THREE.NearestFilter;
  this.faceMat=new THREE.MeshBasicMaterial({map:this.faceTex,transparent:true,alphaTest:.5});
  this.face=new THREE.Mesh(new THREE.PlaneGeometry(ARENA.faceH*FW/FH,ARENA.faceH),this.faceMat);this.root.add(this.face);
  this.drawFace();
 }
 // gaps: `count` gaps of `width` panels, evenly spaced
 setGap(width:number,count=1){this.missing.clear();for(let g=0;g<count;g++){const start=Math.round(g*MCP.N/count);for(let k=0;k<width;k++)this.missing.add((start+k)%MCP.N);}this.apply();}
 closeAll(){this.missing.clear();this.apply();}
 private apply(){this.panels.forEach((p,i)=>p.visible=!this.missing.has(i)&&!this.dead);}
 panelAngle(i:number){return this.base+i*this.step;}
 isGap(angle:number){for(const i of this.missing)if(Math.abs(wrap(angle-this.panelAngle(i)))<=this.step/2+.01)return true;return false;}
 gapCenters(){
  // walk the ring once from a panel that is there, so every run of missing panels closes
  const out:number[]=[],N=MCP.N;let start=0;while(start<N&&this.missing.has(start))start++;if(start>=N||!this.missing.size)return out;
  let run=0,first=0;
  for(let k=1;k<=N;k++){const i=(start+k)%N;if(this.missing.has(i)){if(!run)first=i;run++;}else if(run){out.push(wrap(this.panelAngle(first)+(run-1)/2*this.step));run=0;}}
  return out;
 }
 say(sec:number){this.talkUntil=this.t+sec;}
 setExpr(e:Expr,sec:number){this.expr=e;this.exprUntil=this.t+sec;}
 hurt(n:number,face:boolean){
  if(this.dead)return '';
  this.integrity=Math.max(0,this.integrity-n);this.flash=face?1.4:.8;this.setExpr('hurt',.45);
  if(this.t-this.lastCaption>2.4){this.lastCaption=this.t;return ['CONCERNING.','INTERESTING.','!!'][Math.floor(Math.random()*3)];}
  return '';
 }
 die(){
  this.dead=true;this.deadT=0;this.setExpr('hurt',99);
  for(const [i,p] of this.panels.entries()){if(!p.visible)continue;const a=this.panelAngle(i);this.debris.push({m:p,v:new THREE.Vector3(Math.cos(a)*9,6+Math.random()*8,Math.sin(a)*9),s:new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(4)});}
 }
 private drawFace(){
  const t=this.t,mouth=Math.floor(t/.14)%2===0,expr=this.dead?'hurt':this.t<this.exprUntil?this.expr:this.t<this.talkUntil?'talk':'idle';
  const block=this.reveal<.3?6:this.reveal<.55?4:this.reveal<.8?2:1,dim=this.awake||this.reveal>0?1:.3;
  const key=`${expr}${mouth&&expr==='talk'}${block}${dim}`;if(key===this.drawn)return;this.drawn=key;
  const g=this.faceCanvas.getContext('2d')!,img=g.createImageData(FW,FH);
  for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
   const bx=Math.min(FW-1,Math.floor(x/block)*block+Math.floor(block/2)),by=Math.min(FH-1,Math.floor(y/block)*block+Math.floor(block/2));
   const k=shade(bx,by,expr as Expr,mouth),c=new THREE.Color(COLOURS[k]),o=(y*FW+x)*4;
   img.data[o]=c.r*255*dim;img.data[o+1]=c.g*255*dim;img.data[o+2]=c.b*255*dim;img.data[o+3]=k?255:0;
  }
  g.putImageData(img,0,0);this.faceTex.needsUpdate=true;
 }
 update(dt:number,cam:THREE.Vector3,highlight:number|null){
  this.t+=dt;this.base=wrap(this.base+this.spin*dt);
  this.column.rotation.y+=dt*TAU/40;this.crown.rotation.y+=dt*.6;this.crown.scale.setScalar(1+Math.sin(this.t*3)*.06);
  const gaps=highlight===null?[]:this.gapCenters().filter(g=>Math.abs(wrap(g-highlight))<25*Math.PI/180);
  for(const [i,p] of this.panels.entries()){
   const a=this.panelAngle(i);p.position.set(Math.cos(a)*ARENA.ring,11+this.shieldY,Math.sin(a)*ARENA.ring);p.rotation.y=-(a+Math.PI/2);
   const near=gaps.some(g=>Math.abs(wrap(a-g))<this.step*2.6);
   this.edges[i].color.set(near?PAL.white:PAL.enemy);this.panelMats[i].emissive.set(near?0x334455:0x000000);
  }
  const d=new THREE.Vector2(cam.x,cam.z).normalize();
  this.face.position.set(d.x*6.1,ARENA.faceY,d.y*6.1);this.face.rotation.y=Math.atan2(d.x,d.y);this.facePos.copy(this.face.position);
  this.flash=Math.max(0,this.flash-dt*4);this.faceMat.color.setScalar(1+this.flash*2.2);
  if(this.dead){
   this.deadT+=dt;this.column.position.y=-Math.pow(this.deadT,2)*1.4;this.column.rotation.y+=dt*this.deadT*2;this.face.position.y-=Math.pow(this.deadT,2)*1.4;
   for(const b of this.debris){b.v.y-=9*dt;b.m.position.addScaledVector(b.v,dt);b.m.rotation.x+=b.s.x*dt;b.m.rotation.z+=b.s.z*dt;if(b.m.position.y<-2&&b.m.visible){b.m.visible=false;this.sparks.burst(b.m.position.clone().setY(.5),PAL.enemy,40,4);}}
   if(this.deadT<2.4&&Math.random()<dt*30){const p=this.facePos.clone().add(new THREE.Vector3((Math.random()-.5)*8,(Math.random()-.5)*10,0));this.sparks.burst(p,PAL.enemyCore,6,3,{gravity:6,up:7,life:2.2});}
   if(this.deadT>1.6)this.face.visible=false;
   this.beam.visible=this.deadT<.8;
  }
  this.drawFace();
 }
}
