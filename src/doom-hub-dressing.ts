import * as THREE from 'three';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import {HUB_DOORS} from './doom-hub-doors';
import {FUTURE_DOORS} from './doom-hub-future';

/* Each structure as a desktop file come to life (Jonathan's picks, 2026-10-23, docs/SAFE-MODE-PROGRESSION.md §4).
 * Deliberately at odds with Bliss: Win95 grey and navy, hard edges. Everything here is added to the existing
 * Doom-walled buildings; their walls, doors, strips and READMEs are untouched.
 * - CONTROL.EXE: a program window (title bar, menu bar, status bar) and the Inferminator's watchtower (camera
 *   mast and beacon, CCTV on every corner tracking you, a 3 x 3 monitor wall, a red scanner). Cleared: "(Not
 *   Responding)", beacon dark, monitors "NO SIGNAL".
 * - HAL3000.SYS: the system file itself, a 21 m dog-eared page with a gear, and a real gear turning before it.
 *   Cleared: the gear stops and the page reads eye=off (the eye's own joke is in doom-hub-doors.ts).
 * - MEG3N.AVI: a Media Player window on the facade playing her feed, and a filmstrip frieze running. Cleared:
 *   paused on the sleep moon, nobody watching.
 * - AGENTIC.BAT: a line of identical suited agents on the parapet. Cleared: they've logged off.
 * All drawn here; no OS or film artwork. */

function canvasTexture(w:number,h:number,draw:(g:CanvasRenderingContext2D,w:number,h:number)=>void,nearest=false){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!,w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 if(nearest){t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;}else t.anisotropy=8;return t;
}
const basic=(o:THREE.MeshBasicMaterialParameters)=>new THREE.MeshBasicMaterial(o);
/** A door's own frame: x along the facade, +z out of the door, y up from the door's ground. */
function doorFrame(parent:THREE.Object3D,door:{x:number;z:number;yaw:number}){const g=new THREE.Group();g.position.set(door.x,groundY(door.x,door.z),door.z);g.rotation.y=door.yaw+Math.PI;parent.add(g);return g;}
function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material|THREE.Material[]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
function plane(parent:THREE.Object3D,w:number,h:number,x:number,y:number,z:number,mat:THREE.Material){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);parent.add(m);return m;}
function bevel(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,inset=false,t=3){g.fillStyle=inset?'#808080':'#fff';g.fillRect(x,y,w,t);g.fillRect(x,y,t,h);g.fillStyle=inset?'#fff':'#404040';g.fillRect(x,y+h-t,w,t);g.fillRect(x+w-t,y,t,h);}
/** A Win95-style title bar (drawn here: gradient, a little window icon, the three buttons). */
function titleBar(text:string,active=true){
 return canvasTexture(1024,96,(g,w,h)=>{
  const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,active?'#000080':'#808080');gr.addColorStop(1,active?'#1084d0':'#b5b5b5');g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.fillStyle='#c0c0c0';g.fillRect(14,18,60,60);bevel(g,14,18,60,60);g.fillStyle='#000080';g.fillRect(22,26,44,10);g.fillStyle='#fff';g.fillRect(22,38,44,32);
  g.fillStyle=active?'#fff':'#d4d0c8';g.font='bold 54px sans-serif';g.textBaseline='middle';g.fillText(text,92,50,w-330);
  ['_','□','×'].forEach((t,i)=>{const x=w-214+i*68;g.fillStyle='#c0c0c0';g.fillRect(x,16,60,62);bevel(g,x,16,60,62);g.fillStyle='#000';g.font='bold 44px sans-serif';g.textAlign='center';g.fillText(t,x+30,i?48:40);g.textAlign='left';});
 });
}
// The Win95 arrow cursor (our own 1-bit drawing), shared with the summit (doom-hub-future.ts draws its own copy).
const ARROW=['X','XX','XWX','XWWX','XWWWX','XWWWWX','XWWWWWX','XWWWWWWX','XWWWWWWWX','XWWWWWWWWX','XWWWWWXXXXX','XWWXWWX','XWX.XWWX','XX..XWWX','X....XWWX','.....XWWX','......XX'];
function arrowTexture(){return canvasTexture(16,20,g=>{ARROW.forEach((row,y)=>{for(let x=0;x<row.length;x++){if(row[x]==='.')continue;g.fillStyle=row[x]==='X'?'#000':'#fff';g.fillRect(x+2,y+1,1,1);}});},true);}

export async function makeHubDressing(scene:THREE.Scene){
 const root=new THREE.Group();root.name='hub-dressing';scene.add(root);
 const occluders:THREE.Object3D[]=[];
 const steel=basic({color:0x6d7378}),dark=basic({color:0x1b1d20}),beaconOn=new THREE.Color(0xff2a1a),beaconOff=new THREE.Color(0x3a1a18);

 /* ---- CONTROL.EXE ---- */
 const control=doorFrame(root,HUB_DOORS[0]);
 const titles=[titleBar('CONTROL.EXE'),titleBar('CONTROL.EXE (Not Responding)',false)];
 const titleMaterial=basic({map:titles[0]}),navy=basic({color:0x0a2a9a}),grey=basic({color:0xc0c0c0});
 occluders.push(box(control,18.7,1.5,16.7,0,7.75,-8,[navy,navy,grey,navy,titleMaterial,navy]));
 plane(control,18,.85,0,6.55,.07,basic({map:canvasTexture(1024,48,(g,w,h)=>{g.fillStyle='#c0c0c0';g.fillRect(0,0,w,h);g.fillStyle='#000';g.font='34px sans-serif';g.textBaseline='middle';let x=20;for(const t of ['File','Edit','View','Cameras','Help']){g.fillText(t,x,25);g.fillRect(x,40,g.measureText(t[0]).width,2);x+=g.measureText(t).width+44;}})}));
 const statusBar=(text:string)=>canvasTexture(512,48,(g,w,h)=>{g.fillStyle='#c0c0c0';g.fillRect(0,0,w,h);bevel(g,6,6,w-12,h-12,true,2);g.fillStyle='#000';g.font='28px sans-serif';g.textBaseline='middle';g.fillText(text,18,25);});
 const statusTextures=[[statusBar('Ready'),statusBar('9 cameras · 5 humans')],[statusBar('Not Responding'),statusBar('0 cameras · 0 humans')]];
 const statusLeft=basic({map:statusTextures[0][0]}),statusRight=basic({map:statusTextures[0][1]});
 plane(control,7.2,.7,-5.4,.35,.07,statusLeft);plane(control,7.2,.7,5.4,.35,.07,statusRight);
 for(const sx of [-1,1])for(const sz of [.05,-16.05])box(control,.4,7,.4,sx*9.05,3.5,sz,grey);
 // the hung program's cursor, hanging over the title bar once it's cleared
 const hung=plane(control,3.2,4,6.5,11.2,0,basic({map:arrowTexture(),transparent:true,alphaTest:.5,side:THREE.DoubleSide}));hung.visible=false;
 // the watchtower: a mast on the roof's north-east corner with a red beacon
 const mast=new THREE.Group();mast.position.set(-6,8.5,-2.9);control.add(mast);
 box(mast,.4,8,.4,0,4,0,steel);for(let y=1;y<8;y+=1.6)box(mast,1.2,.08,.08,0,y,0,steel);
 const beaconMaterial=basic({color:beaconOn});const beacon=new THREE.Mesh(new THREE.SphereGeometry(.55,16,10),beaconMaterial);beacon.position.y=8.4;mast.add(beacon);
 const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTexture(64,64,g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,60,40,.9)');r.addColorStop(1,'rgba(255,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);}),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
 halo.scale.set(4,4,1);halo.position.y=8.4;mast.add(halo);
 // CCTV: one on the mast and one on each roof corner; each turns to follow you
 const leds:THREE.MeshBasicMaterial[]=[];
 const camera=(parent:THREE.Object3D,x:number,y:number,z:number)=>{
  const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);box(pivot,.12,.5,.12,0,-.35,0,steel);
  const head=new THREE.Group();pivot.add(head);box(head,.55,.55,1.3,0,0,.4,basic({color:0xd9dadc}));box(head,.45,.45,.1,0,0,1.08,dark);
  const led=basic({color:0xff2a1a});leds.push(led);box(head,.12,.12,.04,.15,.15,1.14,led);return head;};
 const cams=[camera(mast,0,7,0),...[[-8.6,7.6,-.4],[8.6,7.6,-.4],[-8.6,7.6,-15.6],[8.6,7.6,-15.6]].map(([x,y,z])=>camera(control,x,y,z))];
 // the monitor wall: the level's nine cameras; two of them static
 const feedTexture=(i:number,off:boolean)=>canvasTexture(128,96,(g,w,h)=>{
  if(off){g.fillStyle='#0000a8';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 18px monospace';g.textAlign='center';g.fillText('NO SIGNAL',64,54);return;}
  g.fillStyle=i===4?'#300':'#111';g.fillRect(0,0,w,h);const img=g.getImageData(0,0,w,h);let s=i*977+13;
  for(let k=0;k<img.data.length;k+=4){s=(s*1664525+1013904223)>>>0;const n=(s/4294967296)*(i%3===1?200:60);img.data[k]+=n;img.data[k+1]+=n;img.data[k+2]+=n;}g.putImageData(img,0,0);
  if(i%3!==1){g.fillStyle='#8c8c84';g.fillRect(20,40,40,50);g.fillStyle='#665';g.fillRect(70,30,30,60);}
  if(i===4){g.fillStyle='#f22';g.beginPath();g.arc(64,48,16,0,7);g.fill();}
  g.fillStyle='#fff';g.font='14px monospace';g.fillText('CAM '+(i+1),6,14);g.fillStyle='#f33';g.fillText('● REC',74,90);});
 const feeds=Array.from({length:9},(_,i)=>[feedTexture(i,false),feedTexture(i,true)]);
 const screens=feeds.map((_,i)=>{const x=3.6+(i%3)*1.75,y=5.3-Math.floor(i/3)*1.3;box(control,1.6,1.15,.36,x,y,.18,basic({color:0xcfc8b4}));return plane(control,1.3,.9,x,y,.37,basic({map:feeds[i][0]}));});
 // the scanner: a red bar sweeping a slit window, west of the door
 plane(control,6,.7,-5.4,5.3,.06,dark);
 const scanner=plane(control,1.1,.45,-6.8,5.3,.08,basic({color:0xff3018}));
 const scanGlow=new THREE.Sprite((halo.material as THREE.SpriteMaterial).clone());scanGlow.scale.set(3,1.4,1);scanGlow.position.set(-6.8,5.3,.2);control.add(scanGlow);

 /* ---- HAL3000.SYS: the system file ---- */
 const hal=doorFrame(root,HUB_DOORS[1]);
 const pageTexture=(off:boolean)=>canvasTexture(512,672,(g,w,h)=>{
  g.fillStyle='#fbfbf6';g.fillRect(0,0,w,h);g.strokeStyle='#202020';g.lineWidth=8;g.strokeRect(4,4,w-8,h-8);
  g.fillStyle='#c9c9c2';g.beginPath();g.moveTo(w-128,0);g.lineTo(w,128);g.lineTo(w-128,128);g.fill();
  g.save();g.translate(w/2,180);g.fillStyle=off?'#a9adb2':'#5a5f66';for(let k=0;k<10;k++){g.rotate(Math.PI/5);g.fillRect(-18,-118,36,40);}g.beginPath();g.arc(0,0,92,0,7);g.fill();g.fillStyle='#fbfbf6';g.beginPath();g.arc(0,0,36,0,7);g.fill();g.restore();
  g.fillStyle='#1a1a1a';g.font='bold 36px monospace';['[386Enh]','device=hal3000.sys',off?'eye=off':'eye=always_on','users=5 ; keep','; do not remove'].forEach((t,i)=>g.fillText(t,30,370+i*54));
  if(off){g.fillStyle='#b3170f';g.fillText(';',30,370+2*54);}
 });
 const pages=[pageTexture(false),pageTexture(true)];
 const sheetShape=new THREE.Shape();sheetShape.moveTo(-8,0);sheetShape.lineTo(8,0);sheetShape.lineTo(8,17);sheetShape.lineTo(4,21);sheetShape.lineTo(-8,21);sheetShape.closePath();
 const sheetGeometry=new THREE.ShapeGeometry(sheetShape);{const uv=sheetGeometry.getAttribute('uv'),p=sheetGeometry.getAttribute('position');for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+8)/16,p.getY(i)/21);}
 const pageMaterial=basic({map:pages[0],side:THREE.DoubleSide});const sheet=new THREE.Mesh(sheetGeometry,pageMaterial);sheet.position.set(0,4.2,-18);hal.add(sheet);occluders.push(sheet);
 const gearShape=new THREE.Shape();for(let k=0;k<24;k++){const a=k/24*Math.PI*2,r=k%2?4.4:3.6;k?gearShape.lineTo(Math.cos(a)*r,Math.sin(a)*r):gearShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
 const hub=new THREE.Path();hub.absarc(0,0,1.3,0,Math.PI*2,true);gearShape.holes.push(hub);
 const gearGeometry=new THREE.ExtrudeGeometry(gearShape,{depth:1,bevelEnabled:false});gearGeometry.computeVertexNormals();
 const gear=new THREE.Mesh(gearGeometry,basic({color:0x7d838a}));gear.position.set(-8.5,10,-15.5);hal.add(gear);
 box(hal,.6,6,.6,-8.5,7.2,-16,steel);

 /* ---- MEG3N.AVI: the media player ---- */
 const meg=doorFrame(root,FUTURE_DOORS[0]);
 const PW=22,PH=13,PY=5.2;
 box(meg,PW+.6,PH+.6,.5,0,PY+PH/2,.5,grey);
 plane(meg,PW,1.2,0,PY+PH-.6,.77,basic({map:titleBar('MEG3N.AVI - Media Player')}));
 // her live feed: drawn at 8 frames a second into one small canvas
 const feedCanvas=document.createElement('canvas');feedCanvas.width=320;feedCanvas.height=180;const fg=feedCanvas.getContext('2d')!;
 const feed=new THREE.CanvasTexture(feedCanvas);feed.colorSpace=THREE.SRGBColorSpace;
 plane(meg,PW-.8,8.6,0,PY+PH-1.2-4.4,.77,basic({map:feed}));
 const transport=(paused:boolean)=>canvasTexture(1024,96,(g,W,H)=>{g.fillStyle='#c0c0c0';g.fillRect(0,0,W,H);
  ['▶','❚❚','■','◀◀','▶▶'].forEach((t,i)=>{const x=12+i*70,down=paused?i===1:i===0;g.fillStyle=down?'#a8a8a8':'#c0c0c0';g.fillRect(x,14,62,62);bevel(g,x,14,62,62,down);g.fillStyle='#000';g.font='30px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,x+31,46);});
  g.textAlign='left';g.fillStyle='#fff';g.fillRect(380,40,600,14);bevel(g,380,40,600,14,true,2);g.fillStyle='#c0c0c0';g.fillRect(410,28,26,38);bevel(g,410,28,26,38);g.fillStyle='#000';g.font='22px sans-serif';g.fillText(paused?'Paused':'00:04 / ∞',820,84);});
 const transports=[transport(false),transport(true)],transportMaterial=basic({map:transports[0]});plane(meg,PW-.8,2,0,PY+1.2,.77,transportMaterial);
 // the filmstrip frieze over the yellow band, running
 const film=canvasTexture(1024,96,(g,W,H)=>{g.fillStyle='#111';g.fillRect(0,0,W,H);g.fillStyle='#eee';for(let x=6;x<W;x+=26){g.fillRect(x,6,14,10);g.fillRect(x,H-16,14,10);}
  const c=['#ffb3d9','#8ae8f0','#ffe25e','#c7b3ff'];for(let i=0;i<10;i++){g.fillStyle=c[i%4];g.fillRect(10+i*102,24,92,48);g.fillStyle='#17181b';g.fillRect(44+i*102,30,24,36);g.fillStyle='#fff6e8';g.fillRect(49+i*102,44,4,2);g.fillRect(59+i*102,44,4,2);}});
 film.wrapS=THREE.RepeatWrapping;film.repeat.set(1,1);
 plane(meg,40.4,3.6,0,7.8,.08,basic({map:film}));
 let watching=5,heartsAt=0;
 function drawFeed(time:number,cleared:boolean,player:THREE.Vector3){
  const g=fg,W=320,H=180;
  if(cleared){g.fillStyle='#0b1440';g.fillRect(0,0,W,H);g.fillStyle='#f3e9b5';g.beginPath();g.arc(160,84,38,0,Math.PI*2);g.fill();g.fillStyle='#0b1440';g.beginPath();g.arc(178,72,34,0,Math.PI*2);g.fill();
   g.fillStyle='#c8cbe0';g.font='bold 16px sans-serif';g.fillText('0 watching',12,166);g.fillText('Zzz',220,60);feed.needsUpdate=true;return;}
  const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#ffb3d9');gr.addColorStop(1,'#8ae8f0');g.fillStyle=gr;g.fillRect(0,0,W,H);
  const sway=Math.sin(time*3)*6;g.save();g.translate(160+sway,96);g.rotate(Math.sin(time*3)*.06);
  g.fillStyle='#17181b';g.fillRect(-36,-72,72,136);g.fillStyle='#050608';g.fillRect(-30,-64,60,116);g.strokeStyle='#fff6e8';g.lineWidth=5;g.lineCap='round';
  const blink=time%3.4<.16;for(const x of [-12,12]){g.beginPath();if(blink){g.moveTo(x-7,-14);g.lineTo(x+7,-14);}else g.arc(x,-10,7,Math.PI*1.1,Math.PI*1.9);g.stroke();}
  g.beginPath();g.arc(0,2,15,Math.PI*.15,Math.PI*.85);g.stroke();g.restore();
  g.fillStyle='#e3302a';g.fillRect(10,10,48,20);g.fillStyle='#fff';g.font='bold 15px sans-serif';g.fillText('LIVE',17,25);
  // she's watching you: the counter climbs as you come closer
  const near=Math.hypot(player.x-meg.position.x,player.z-meg.position.z);watching=5+Math.max(0,Math.round((120-near)*40));
  g.fillStyle='#fff';g.font='bold 16px sans-serif';g.fillText(`${watching.toLocaleString()} watching`,12,166);g.fillText('Recommended for you ▸',150,26);
  for(let k=0;k<4;k++){const t=((time*.6+k*.25)%1),x=262+Math.sin(k*2.1+time)*12,y=170-t*120;g.globalAlpha=1-t;g.fillStyle='#ff3b6b';g.beginPath();g.moveTo(x,y+6);g.bezierCurveTo(x-10,y-4,x-4,y-12,x,y-5);g.bezierCurveTo(x+4,y-12,x+10,y-4,x,y+6);g.fill();g.globalAlpha=1;}
  feed.needsUpdate=true;
 }

 /* ---- AGENTIC.BAT: the agents on the parapet ---- */
 const ag=doorFrame(root,FUTURE_DOORS[1]);
 const agent=canvasTexture(48,96,g=>{g.fillStyle='#111317';g.fillRect(12,30,24,60);g.fillRect(8,34,32,30);g.fillStyle='#f2f2f2';g.fillRect(21,30,6,18);g.fillStyle='#1a1a1a';g.fillRect(23,32,2,16);
  g.fillStyle='#c79a7c';g.fillRect(16,8,16,22);g.fillStyle='#2a1c14';g.fillRect(16,6,16,5);g.fillStyle='#050505';g.fillRect(15,16,18,5);g.fillStyle='#9fd7ff';g.fillRect(17,17,3,1);g.fillStyle='#0b0c0f';g.fillRect(12,90,10,6);g.fillRect(26,90,10,6);
  g.fillStyle='#2b2b2b';g.fillRect(33,20,2,14);},true);
 const agents=new THREE.Group();ag.add(agents);const agentMaterial=new THREE.SpriteMaterial({map:agent,alphaTest:.5});
 for(let i=-6;i<=6;i++){if(!i)continue;const s=new THREE.Sprite(agentMaterial);s.center.set(.5,0);s.scale.set(1.1,2.2,1);s.position.set(i*1.9,6.3,-.8);agents.add(s);}
 for(let i=-5;i<=5;i+=2){const s=new THREE.Sprite(agentMaterial);s.center.set(.5,0);s.scale.set(1.1,2.2,1);s.position.set(i*1.9,6.3,-4);agents.add(s);}

 const cleared=[false,false,false,false];let visible=true;const look=new THREE.Vector3(),q=new THREE.Quaternion(),probe=new THREE.Object3D();root.add(probe);
 let feedAt=0;
 return {occluders,
  setVisible(value:boolean){visible=value;root.visible=value;},
  /** done: CONTROL.EXE, HAL3000.SYS, MEG3N.AVI, AGENTIC.BAT resolved. */
  update(dt:number,time:number,player:THREE.Vector3,done:boolean[],reduced:boolean){
   if(done[0]!==cleared[0]){const c=cleared[0]=done[0];titleMaterial.map=titles[c?1:0];statusLeft.map=statusTextures[+c][0];statusRight.map=statusTextures[+c][1];hung.visible=c;
    beaconMaterial.color.copy(c?beaconOff:beaconOn);halo.visible=!c;scanGlow.visible=!c;(scanner.material as THREE.MeshBasicMaterial).color.setHex(c?0x2a0c08:0xff3018);leds.forEach(l=>l.color.setHex(c?0x2a0c08:0xff2a1a));
    screens.forEach((s,i)=>{(s.material as THREE.MeshBasicMaterial).map=feeds[i][c?1:0];});}
   if(done[1]!==cleared[1]){cleared[1]=done[1];pageMaterial.map=pages[done[1]?1:0];}
   if(done[2]!==cleared[2]){cleared[2]=done[2];transportMaterial.map=transports[done[2]?1:0];feedAt=0;}
   if(done[3]!==cleared[3]){cleared[3]=done[3];agents.visible=!done[3];}
   if(!visible)return;
   const t=reduced?0:time;
   if(!cleared[0]){
    // beacon pulse, the scanner's sweep, every camera turning toward you (no faster than 40 deg/s)
    const pulse=.5+.5*Math.sin(t*4);beaconMaterial.color.copy(beaconOn).multiplyScalar(.55+.45*pulse);halo.material.opacity=.4+.6*pulse;
    const sweep=Math.sin(t*1.6)*2.6;scanner.position.x=-5.4+sweep;scanGlow.position.x=-5.4+sweep;
    look.set(player.x,player.y-.3,player.z);
    for(const head of cams){head.getWorldPosition(probe.position);probe.lookAt(look);head.parent!.getWorldQuaternion(q);q.invert().multiply(probe.quaternion);head.quaternion.rotateTowards(q,(reduced?0:.7)*dt);}
   }
   if(!cleared[1]&&!reduced)gear.rotation.z+=dt*.35;
   if(!cleared[2]&&!reduced)film.offset.x=(film.offset.x+dt*.08)%1;
   if(time>=feedAt){feedAt=cleared[2]?Infinity:time+(reduced?1e9:.125);drawFeed(t,cleared[2],player);}
  },
  getState:()=>({control:cleared[0]?'not responding':'watching',hal:cleared[1]?'eye=off':'eye=always_on',meg3n:cleared[2]?'paused':`live, ${watching} watching`,agentic_agents:agents.visible?agents.children.length:0}),
 };
}
