import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import type {IconObstacle} from './doom-icon-physics';
import {makePhoneAudio} from './doom-phone-audio';
import {shade,shadeOnGround,wadTexture,painted,readmeTexture,STRIP_COLOURS} from './doom-hub-doors';
import {meadowUniforms,MEADOW_COMMON_GLSL,OUT_GLSL} from './doom-meadow-shared';

/* What's still to come, as places you can walk up to (2026-10-14; docs/spec/04-bliss-hub-world.md
 * 2.2-2.6). Levels 3 and 4 aren't built yet: MEG3N.AVI's toy factory under its selfie-stick tower
 * and AGENTIC.BAT's black tower raining dingbats each stand where the spec puts them, five dark
 * lights over a locked door that only opens an install dialog (doom-outside.ts). The summit holds
 * the final door, a giant Display Properties dialog whose Wait box counts the people still out
 * there, under a giant hourglass. On the far south horizon the MCP column's face "downloads"
 * like a progressive JPEG over dial-up, one step per level cleared, too coarse to recognise. */

export type FutureId='meg3n'|'agentic'|'final';
export const FUTURE_DOORS=[
 {id:'meg3n' as const,label:'MEG3N.AVI',episode:'INFERENCE',x:-150.2,z:2.5,yaw:-65*Math.PI/180,
  files:['friendship.dll','infinite_feed.sys','hug.exe','recommended_for_you.dat','dance.avi'],
  readme:["Hi bestie! I'm MEG3N.",'Five humans are my','best friends now.','Friends never leave.','Recommended for you.']},
 {id:'agentic' as const,label:'AGENTIC.BAT',episode:'THY FLESH COMPUTED',x:143.5,z:86.7,yaw:-330*Math.PI/180,
  files:['find_user.bat','todo.txt','jack_in.vxd','pods.cab','human_compute.dll'],
  readme:['AGENTIC SMITH v0.9','Five humans in pods.','TODO:','1. FIND USER','2. FIND USER']},
];
export const FINAL={x:-45,z:-92,label:'Display Properties'};
const MCP={x:60,z:1000},MCP_TOP=420;

type Frame={y:number;heading:number;normal:THREE.Vector2;side:THREE.Vector2;toWorld:THREE.Matrix4};
// x along the facade, z out of the door, y up from the door's ground (HAL's construction frame)
function frameOf(door:{x:number;z:number;yaw:number}):Frame{
 const y=groundY(door.x,door.z),heading=door.yaw+Math.PI;
 return {y,heading,normal:new THREE.Vector2(Math.sin(heading),Math.cos(heading)),side:new THREE.Vector2(Math.cos(heading),-Math.sin(heading)),
  toWorld:new THREE.Matrix4().makeTranslation(door.x,y,door.z).multiply(new THREE.Matrix4().makeRotationY(heading))};
}
// world-scale UVs: textures run on across pieces at one scale ([u,v] metres per tile)
function slab(list:THREE.BufferGeometry[],tile:[number,number],[x0,x1]:number[],[y0,y1]:number[],[z0,z1]:number[],vFrom=0){
 const w=x1-x0,h=y1-y0,d=z1-z0,g=new THREE.BoxGeometry(w,h,d,Math.ceil(w/4),Math.ceil(h/.8),Math.ceil(d/4)).toNonIndexed();
 g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
  const flat=Math.abs(ny)>.5,u=flat?px:Math.abs(nx)>.5?(nx>0?-pz:pz):(nz>0?px:-px),v=flat?pz:py-vFrom;
  uv.setXY(i,u/tile[0],v/tile[1]);
 }
 list.push(g);
}
/** Sun-shaded vertex colour times a paint colour, for untextured parts standing on the meadow. */
function tinted(g:THREE.BufferGeometry,hex:number){
 shadeOnGround(g);const c=new THREE.Color(hex),a=g.getAttribute('color') as THREE.BufferAttribute;
 for(let i=0;i<a.count;i++)a.setXYZ(i,a.getX(i)*c.r,a.getY(i)*c.g,a.getZ(i)*c.b);return g;
}
function canvasTexture(w:number,h:number,draw:(g:CanvasRenderingContext2D)=>void,nearest=false){
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;draw(g);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(nearest){t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;}else t.anisotropy=4;return t;
}
function labelSign(text:string){
 return canvasTexture(512,96,g=>{g.fillStyle='#c3c3b3';g.fillRect(0,0,512,96);g.fillStyle='#162732';g.fillRect(8,8,496,80);g.fillStyle='#e8e8ce';g.font='bold 44px monospace';g.textAlign='center';g.fillText(text,256,64);});
}
/** One sawtooth running front to back (z0 -> z1): the slope rises from x0 to x0+w and the glazing
 * drops vertically at x0+w, so the facade's top edge is the factory's zigzag silhouette. */
function tooth(x0:number,w:number,z0:number,z1:number,yb:number,yt:number){
 const x1=x0+w,P=[[x0,yb,z0],[x1,yb,z0],[x1,yt,z0],[x0,yb,z1],[x1,yb,z1],[x1,yt,z1]];
 const tri=(a:number,b:number,c:number)=>[...P[a],...P[b],...P[c]];
 const geometry=(list:number[])=>{const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(list,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(list.length/3*2).fill(0),2));g.computeVertexNormals();return g;};
 return {slope:geometry([...tri(0,2,5),...tri(0,5,3)]),glass:geometry([...tri(1,4,5),...tri(1,5,2)]),gable:geometry([...tri(0,1,2),...tri(3,5,4)])};
}
/** The door everyone shares: trim, a closed metal door, the label over it, five dark lights, and its README.TXT. */
function lockedDoor(frame:THREE.Group,label:string,door:THREE.Texture,readme:string[],signY:number,stripY:number,occluders:THREE.Object3D[]){
 const trim=new THREE.MeshBasicMaterial({color:0x414c4b});
 for(const [w,h,d,x,cy,z] of [[.25,2.8,.5,-1.23,1.4,0],[.25,2.8,.5,1.23,1.4,0],[2.7,.25,.5,0,2.73,0],[2.7,.12,1.2,0,.035,.4]]){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trim);mesh.position.set(x,cy,z);frame.add(mesh);occluders.push(mesh);
 }
 const face=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.6),new THREE.MeshBasicMaterial({map:door,color:0xb8b8b8}));face.position.set(0,1.3,.02);frame.add(face);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(6,1.12),new THREE.MeshBasicMaterial({map:labelSign(label)}));sign.position.set(0,signY,.32);frame.add(sign);
 const parts=[painted(new THREE.BoxGeometry(3.1,.62,.14).translate(0,stripY,.07),0x1b2124)];
 for(let i=0;i<5;i++)parts.push(painted(new THREE.BoxGeometry(.38,.38,.06).translate((i-2)*.56,stripY,.16),STRIP_COLOURS.inside));
 frame.add(new THREE.Mesh(mergeGeometries(parts),new THREE.MeshBasicMaterial({vertexColors:true})));
 const notice=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.1),new THREE.MeshBasicMaterial({map:readmeTexture(readme,1),color:0xe6e6e6}));notice.position.set(-5.5,1.68,.17);frame.add(notice);
}

/* 16 dingbats of our own (8 x 8, not the Wingdings font, not film glyphs): smiley, plane, phone,
 * envelope, floppy, hourglass, scissors, bell, star, heart, clock, mouse, pencil, book, flag, tick. */
const DINGBATS=[
 '.XXXXXX.X......XX.X..X.XX......XX.X..X.XX..XX..X.X....X..XXXXXX.','...X.......XX...XXXXXXXXXXXXXXXX...XX......X.X.....XXX..........',
 '.XX..XX.XXXXXXXXXX....XX...XX.....XXXX....XXXX...XXXXXX..XXXXXX.','........XXXXXXXXXX....XXX.X..X.XX..XX..XX......XXXXXXXXX........',
 'XXXXXXX.X.X..X.XX.XXXX.XX......XX.XXXX.XX.X..X.XX.XXXX.XXXXXXXXX','XXXXXXXX.X....X...XXXX.....XX......XX.....X..X...X.XX.X.XXXXXXXX',
 'XX....XXXX...XX..XX.XX.....XX......XX.....XXXX...XX..XX.XX....XX','...XX.....XXXX....XXXX...XXXXXX..XXXXXX.XXXXXXXX...XX......XX...',
 '...X.......X....XXXXXXX..XXXXX....XXX....XX.XX..XX...XX.........','.XX..XX.XXXXXXXXXXXXXXXX.XXXXXX...XXXX.....XX..................',
 '..XXXX...X....X.X..X...XX..X...XX..XXX.XX......X.X....X...XXXX..','..XXXX..XX.X..XXXX.X..XXXXXXXXXXX......XX......X.X....X...XXXX..',
 '......XX.....XXX....XXX....XXX....XXX....XXX....XXX....XX.......','XXXXXXXXX..X...XX..X.X.XX..X...XX..X.X.XX..X...XX..X...XXXXXXXXX',
 'X.......XXXXX...XXXXXXX.XXXXX...X.......X.......X.......X.......','.......X......XX.....XX.X...XX.XX.XX...XXXX.....XX..............',
];
function dingbatAtlas(){
 return canvasTexture(32,32,g=>{g.fillStyle='#000';g.fillRect(0,0,32,32);g.fillStyle='#fff';
  DINGBATS.forEach((rows,k)=>{for(let i=0;i<64;i++)if(rows[i]==='X')g.fillRect((k%4)*8+i%8,Math.floor(k/4)*8+Math.floor(i/8),1,1);});},true);
}
/** AGENTIC's glass: green dingbat rain falling down every face, a head and a fading trail per column. */
function rainMaterial(atlas:THREE.Texture,width:number,height:number){
 atlas.colorSpace=THREE.NoColorSpace;
 return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uGlyphs:{value:atlas},uSize:{value:new THREE.Vector2(width,height)},uRain:{value:1}},
  vertexShader:'attribute float face;varying vec2 vUv;varying float vFace;void main(){vUv=uv;vFace=face;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:/* glsl */`uniform float uTime,uRain;uniform sampler2D uGlyphs;uniform vec2 uSize;varying vec2 vUv;varying float vFace;
   float h(float n){return fract(sin(n)*43758.5453);}
   void main(){
    vec2 m=vUv*uSize/.9,cell=floor(m),f=fract(m);
    float col=cell.x+vFace*37.,rows=uSize.y/.9;
    float head=mod(uTime*(2.5+h(col*1.7)*4.5)+h(col)*rows*3.,rows+26.);
    float dist=head-(rows-cell.y);
    float glow=(dist<0.||dist>24.)?0.:exp(-dist*.15)*uRain;
    float g=floor(h(cell.x*7.31+cell.y*13.17+vFace*3.1+floor(uTime*(1.2+h(cell.y*.7+col)*2.5)))*16.);
    vec2 at=vec2(mod(g,4.),floor(g/4.));
    float ink=texture2D(uGlyphs,vec2((at.x+f.x)/4.,1.-(at.y+1.-f.y)/4.)).r;
    vec3 glass=vec3(.012,.02,.026)+vec3(.01,.025,.035)*vUv.y;
    vec3 rain=mix(vec3(.08,.85,.28),vec3(.75,1.,.82),step(dist,1.))*glow;
    gl_FragColor=vec4(glass+rain*ink,1.);
    #include <colorspace_fragment>
   }`});
}
/** Far-off parts get the meadow's own aerial perspective, then extra haze: the MCP is a pale ghost at 900 m. */
function hazed(map:THREE.Texture|null,extra:number){
 return new THREE.ShaderMaterial({uniforms:{...meadowUniforms(),uMap:{value:map},uExtra:{value:extra}},defines:map?{USE_FACE:''}:{},
  vertexShader:'attribute vec3 tint;varying vec3 vTint;varying vec3 vWorld;varying vec2 vUv;void main(){vTint=tint;vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:MEADOW_COMMON_GLSL+OUT_GLSL+/* glsl */`uniform sampler2D uMap;uniform float uExtra;varying vec3 vTint;varying vec3 vWorld;varying vec2 vUv;
   void main(){
    vec3 c=vTint;
    #ifdef USE_FACE
    c*=texture2D(uMap,vUv).rgb;
    #endif
    c=mix(atmosphere(c,length(uCam-vWorld)),HAZE,uExtra);
    gl_FragColor=meadowOut(c);
    #include <colorspace_fragment>
   }`});
}
function tint(g:THREE.BufferGeometry,hex:number,shaded=true){
 const c=new THREE.Color(hex),n=g.getAttribute('normal'),v=new THREE.Vector3(),a=new Float32Array(g.getAttribute('position').count*3);
 for(let i=0;i<a.length/3;i++){const k=shaded&&n?.7+.3*Math.max(0,v.fromBufferAttribute(n,i).dot(new THREE.Vector3(.35,.6,-.7).normalize()))+.08:1;a[i*3]=c.r*k;a[i*3+1]=c.g*k;a[i*3+2]=c.b*k;}
 g.setAttribute('tint',new THREE.BufferAttribute(a,3));return g;
}
/* The MCP's face: an original, generic face (nobody in particular), shown only as coarse blocks.
 * 2 x 2 before any level is cleared, 4 x 4 after one, 8 x 8 after two (the spec's progressive JPEG). */
function faceSource(){
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;
 g.fillStyle='#1b2433';g.fillRect(0,0,64,64);g.fillStyle='#16161a';g.fillRect(10,50,44,14);
 g.fillStyle='#d6a585';g.beginPath();g.ellipse(32,31,15,19,0,0,Math.PI*2);g.fill();g.fillRect(27,46,10,8);
 g.fillStyle='#3c2c22';g.beginPath();g.ellipse(32,17,16,9,0,Math.PI,0);g.fill();g.fillRect(16,15,4,10);g.fillRect(44,15,4,10);
 g.fillStyle='#f2efe9';g.fillRect(23,28,7,4);g.fillRect(35,28,7,4);g.fillStyle='#2a2b33';g.fillRect(25,28,3,4);g.fillRect(37,28,3,4);
 g.fillStyle='#3c2c22';g.fillRect(22,25,9,2);g.fillRect(34,25,9,2);g.fillStyle='#b98366';g.fillRect(30,33,4,7);
 g.fillStyle='#8c4b3f';g.fillRect(26,43,12,2);g.fillStyle='#c48f72';g.fillRect(17,30,3,8);g.fillRect(44,30,3,8);
 return c;
}

export async function makeFutureHub(scene:THREE.Scene,loader:THREE.TextureLoader,audio:AudioContext){
 const root=new THREE.Group();scene.add(root);
 const occluders:THREE.Object3D[]=[];
 const [shawn,graytall,compohso,crate,bigdoor]=await Promise.all(['meg-shawn2.png','meg-graytall.png','meg-compohso.png','agentic-crate1.png','door-bigdoor2.png'].map(f=>wadTexture(loader,f,true)));
 const STONE:[number,number]=[4,4],GAP=1.1,OPEN=2.6,BASE=-3;
 function textured(list:Map<THREE.Texture,THREE.BufferGeometry[]>,frame:Frame,colour:number){
  for(const [map,parts] of list){if(!parts.length)continue;const g=shadeOnGround(mergeGeometries(parts).applyMatrix4(frame.toWorld));parts.forEach(p=>p.dispose());root.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({map,color:colour,vertexColors:true})));}
 }
 function paintedParts(parts:[THREE.BufferGeometry,number][],frame:Frame){
  const g=mergeGeometries(parts.map(([p,hex])=>tinted(p.toNonIndexed().applyMatrix4(frame.toWorld),hex)));root.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true})));
 }
 function proxy(frame:Frame,w:number,h:number,d:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d).translate(0,h/2+BASE,-d/2),new THREE.MeshBasicMaterial());m.visible=false;m.applyMatrix4(frame.toWorld);root.add(m);occluders.push(m);}
 function doorGroup(frame:Frame,door:{x:number;z:number}){const g=new THREE.Group();g.position.set(door.x,frame.y,door.z);g.rotation.y=frame.heading;root.add(g);return g;}

 /* MEG3N.AVI (spec 2.3): a sawtooth-roofed toy factory. The lower walls are E2M7's own (SHAWN2 body,
  * GRAYTALL piers, a COMPOHSO trim band); above them, raincoat yellow under pink and cyan roof teeth.
  * A candy-striped chimney puffs pink smoke rings. 40 x 26 m, 14 m to the ridge. */
 const meg=FUTURE_DOORS[0],megFrame=frameOf(meg),MW=20,MD=26;
 {
  const walls=new Map<THREE.Texture,THREE.BufferGeometry[]>([[shawn,[]],[graytall,[]],[compohso,[]]]);
  const TALL:[number,number]=[2,4]; // SHAWN2 is 64 x 128: 2 x 4 m at Doom's 32 px a metre
  slab(walls.get(shawn)!,TALL,[-MW,MW],[BASE,6],[-MD,-.3]);
  slab(walls.get(shawn)!,TALL,[-MW,-GAP],[BASE,6],[-.3,0]);slab(walls.get(shawn)!,TALL,[GAP,MW],[BASE,6],[-.3,0]);slab(walls.get(shawn)!,TALL,[-GAP,GAP],[OPEN,6],[-.3,0]);
  for(const sx of [-1,1])for(const [z0,z1] of [[-.9,.2],[-MD-.2,-MD+.9]]){const x=sx*(MW-.35);slab(walls.get(graytall)!,STONE,[x-.6,x+.6].map(v=>v+sx*.2),[BASE,6.4],[z0,z1]);}
  slab(walls.get(compohso)!,[1,1],[-MW-.12,MW+.12],[5.3,6.1],[-MD-.12,.12],5.3);
  textured(walls,megFrame,0xb0b0b0);
  const parts:[THREE.BufferGeometry,number][]=[[new THREE.BoxGeometry(MW*2,3.6,MD).translate(0,6+1.8,-MD/2),0xffe25e]];
  for(let k=0;k<5;k++){const t=tooth(-MW+k*MW*2/5,MW*2/5,0,-MD,9.6,14.6);parts.push([t.slope,k%2?0x8ae8f0:0xffa6cf],[t.glass,0xdff4f6],[t.gable,0xffe25e]);}
  paintedParts(parts,megFrame);
  // the chimney, with its smoke rings, behind the roof's second tooth
  const stripes=canvasTexture(64,64,g=>{g.fillStyle='#fbf3f3';g.fillRect(0,0,64,64);g.fillStyle='#e0425d';for(let i=-64;i<64;i+=16){g.beginPath();g.moveTo(i,64);g.lineTo(i+8,64);g.lineTo(i+72,0);g.lineTo(i+64,0);g.fill();}});
  stripes.wrapS=stripes.wrapT=THREE.RepeatWrapping;stripes.repeat.set(3,5);
  const chimneyAt=new THREE.Vector3(13,0,-9).applyMatrix4(megFrame.toWorld);
  const chimney=new THREE.Mesh(shade(new THREE.CylinderGeometry(1.3,1.5,13,16,1,true).translate(0,9.5+6.5,0),0,false),new THREE.MeshBasicMaterial({map:stripes,vertexColors:true}));
  chimney.position.set(chimneyAt.x,megFrame.y,chimneyAt.z);root.add(chimney);
  proxy(megFrame,MW*2+.7,14-BASE+.5,MD+.7);
  lockedDoor(doorGroup(megFrame,meg),meg.label,bigdoor,meg.readme,3.2,4.12,occluders);
 }
 const smokeTop=new THREE.Vector3(13,0,-9).applyMatrix4(megFrame.toWorld).setY(megFrame.y+22.4);
 const smokeMaterial=new THREE.MeshBasicMaterial({color:0xf7b6d2,transparent:true,depthWrite:false});
 const rings=Array.from({length:3},()=>{const m=new THREE.Mesh(new THREE.TorusGeometry(1.5,.42,8,20).rotateX(Math.PI/2),smokeMaterial.clone());root.add(m);return m;});

 /* The selfie-stick tower (spec 2.3): a 35 m pole holding a black phone in a ring light. Its screen
  * loops an emoji smile and blinks; a red notification badge counts up forever. Within 200 m the
  * phone turns to watch you. */
 const stick=new THREE.Group();stick.position.set(-178,groundY(-178,22),22);root.add(stick);
 stick.add(new THREE.Mesh(shade(new THREE.CylinderGeometry(.28,.36,33,10).translate(0,16.5,0),0,false),new THREE.MeshBasicMaterial({color:0xc9ced4,vertexColors:true})));
 const phone=new THREE.Group();phone.position.y=36.8;stick.add(phone);
 phone.add(new THREE.Mesh(shade(new THREE.BoxGeometry(3.7,6.8,.5),0,false),new THREE.MeshBasicMaterial({color:0x17181b,vertexColors:true})));
 const smile=(blink:boolean)=>canvasTexture(192,352,g=>{
  g.fillStyle='#050608';g.fillRect(0,0,192,352);g.fillStyle='#232733';g.fillRect(70,14,52,8);
  g.strokeStyle='#fff6e8';g.lineWidth=13;g.lineCap='round';
  for(const x of [62,130]){g.beginPath();if(blink){g.moveTo(x-16,150);g.lineTo(x+16,150);}else g.arc(x,158,17,Math.PI*1.1,Math.PI*1.9);g.stroke();}
  g.beginPath();g.arc(96,190,46,Math.PI*.15,Math.PI*.85);g.stroke();
  g.fillStyle='rgba(255,120,170,.75)';for(const x of [40,152]){g.beginPath();g.ellipse(x,196,15,9,0,0,Math.PI*2);g.fill();}
 });
 const screens=[smile(false),smile(true)];
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.3,6.1),new THREE.MeshBasicMaterial({map:screens[0]}));screen.position.z=.26;phone.add(screen);
 phone.add(new THREE.Mesh(new THREE.TorusGeometry(4.7,.4,10,48),new THREE.MeshBasicMaterial({color:0xfff9ee})));
 const badgeCanvas=document.createElement('canvas');badgeCanvas.width=256;badgeCanvas.height=128;const badgeContext=badgeCanvas.getContext('2d')!;
 const badgeTexture=new THREE.CanvasTexture(badgeCanvas);badgeTexture.colorSpace=THREE.SRGBColorSpace;
 const badge=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.1),new THREE.MeshBasicMaterial({map:badgeTexture,transparent:true,alphaTest:.5}));badge.position.set(1.75,3.3,.32);phone.add(badge);
 let badgeCount=3,badgeAt=0,badgeShown=-1;
 function drawBadge(){
  const text=String(badgeCount);badgeContext.clearRect(0,0,256,128);badgeContext.font='bold 78px sans-serif';
  const w=Math.min(250,Math.max(118,badgeContext.measureText(text).width+56)),x=(256-w)/2;
  badgeContext.fillStyle='#e3302a';badgeContext.beginPath();badgeContext.roundRect(x,6,w,116,58);badgeContext.fill();
  badgeContext.fillStyle='#fff';badgeContext.textAlign='center';badgeContext.textBaseline='middle';badgeContext.fillText(text,128,68,w-30);badgeTexture.needsUpdate=true;badgeShown=badgeCount;
 }
 for(const sx of [-.7,.6])phone.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[sx,-3.3,0],[sx+.3,-5,.2],[sx-.4,-6.5,-.2],[sx+.5,-7.6,.3],[sx,-9,0]].map(([x,y,z])=>new THREE.Vector3(x,y,z))),20,.09,5),new THREE.MeshBasicMaterial({color:0x101114})));
 occluders.push(stick);

 /* AGENTIC.BAT (spec 2.3): a 60 m black-glass tower on a plinth of E2M2's CRATE1 with a SHAWN2 band.
  * Its glass streams green dingbat rain; on top a "thinking..." spinner of eight beige dots chases
  * itself over a floating to-do list. Its red phone booth rings in threes every 12 s. */
 const ag=FUTURE_DOORS[1],agFrame=frameOf(ag),AW=13,AD=26,TOWER=[-8,8,-21,-5],TOP=60;
 {
  const walls=new Map<THREE.Texture,THREE.BufferGeometry[]>([[crate,[]],[shawn,[]]]);
  slab(walls.get(crate)!,[2,4],[-AW,AW],[BASE,6],[-AD,-.3]);
  slab(walls.get(crate)!,[2,4],[-AW,-GAP],[BASE,6],[-.3,0]);slab(walls.get(crate)!,[2,4],[GAP,AW],[BASE,6],[-.3,0]);slab(walls.get(crate)!,[2,4],[-GAP,GAP],[OPEN,6],[-.3,0]);
  slab(walls.get(shawn)!,[2,4],[-AW-.12,AW+.12],[5.4,6.3],[-AD-.12,.12],5.4);
  textured(walls,agFrame,0xa8a8a8);
  proxy(agFrame,AW*2+.7,TOP-BASE,AD+.7);
  lockedDoor(doorGroup(agFrame,ag),ag.label,bigdoor,ag.readme,3.4,4.5,occluders);
 }
 const [tx0,tx1,tz0,tz1]=TOWER,tw=tx1-tx0,th=TOP-6;
 const glassGeometry=new THREE.BoxGeometry(tw,th,tz1-tz0).translate((tx0+tx1)/2,6+th/2,(tz0+tz1)/2);
 glassGeometry.setAttribute('face',new THREE.BufferAttribute(new Float32Array(glassGeometry.getAttribute('position').count).map((_,i)=>Math.floor(i/4)),1));
 const rain=rainMaterial(dingbatAtlas(),tw,th);
 const glass=new THREE.Mesh(glassGeometry.applyMatrix4(agFrame.toWorld),rain);root.add(glass);
 paintedParts([[new THREE.BoxGeometry(tw+.6,.7,tz1-tz0+.6).translate((tx0+tx1)/2,TOP+.35,(tz0+tz1)/2),0x101214]],agFrame);
 const towerTop=new THREE.Vector3((tx0+tx1)/2,0,(tz0+tz1)/2).applyMatrix4(agFrame.toWorld);
 const spinner=new THREE.Group();spinner.position.set(towerTop.x,agFrame.y+TOP+10.5,towerTop.z);root.add(spinner);
 const dots=Array.from({length:8},(_,i)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(.95,20),new THREE.MeshBasicMaterial({color:0xe8dcc0,side:THREE.DoubleSide}));const a=i/8*Math.PI*2;m.position.set(Math.sin(a)*4.1,Math.cos(a)*4.1,0);spinner.add(m);return m;});
 const todo=new THREE.Mesh(new THREE.PlaneGeometry(11,4.6),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  map:canvasTexture(512,214,g=>{g.fillStyle='rgba(60,255,120,.10)';g.fillRect(0,0,512,214);g.fillStyle='#66ff9a';g.font='bold 46px monospace';['1. FIND USER','2. FIND USER','3. FIND USER'].forEach((l,i)=>g.fillText(l,34,62+i*62));g.fillStyle='rgba(0,0,0,.35)';for(let y=0;y<214;y+=4)g.fillRect(0,y,512,2);})}));
 // floating just off the front glass near the top (the roof edge hides anything above the roof from the ground)
 const todoAt=new THREE.Vector3((tx0+tx1)/2,0,tz1+1.2).applyMatrix4(agFrame.toWorld);todo.position.set(todoAt.x,agFrame.y+TOP-5,todoAt.z);root.add(todo);
 const booth=new THREE.Group();booth.position.set(137,groundY(137,79),79);booth.rotation.y=Math.atan2(143.5-137,86.7-79)+Math.PI/2;root.add(booth);
 const pane=canvasTexture(128,256,g=>{g.fillStyle='#b81c22';g.fillRect(0,0,128,256);g.fillStyle='#16161a';g.fillRect(10,10,108,26);g.fillStyle='#f4f1e8';g.font='bold 17px sans-serif';g.textAlign='center';g.fillText('TELEPHONE',64,29);
  for(let r=0;r<6;r++)for(let c=0;c<3;c++){g.fillStyle='#c6d6dc';g.fillRect(16+c*33,48+r*31,28,26);}});
 const boothRed=new THREE.MeshBasicMaterial({color:0xb81c22}),boothSide=new THREE.MeshBasicMaterial({map:pane,color:0xd8d8d8});
 booth.add(new THREE.Mesh(new THREE.BoxGeometry(1.3,2.7,1.3).translate(0,1.35,0),[boothSide,boothSide,boothRed,boothRed,boothSide,boothSide]));
 booth.add(new THREE.Mesh(new THREE.BoxGeometry(1.45,.22,1.45).translate(0,2.8,0),boothRed));
 occluders.push(booth);
 const phoneAudio=makePhoneAudio(audio,{x:booth.position.x,y:booth.position.y+1.6,z:booth.position.z});
 let nextRing=4;

 /* The final door (spec 2.5): a giant Display Properties dialog on the summit, facing the bunker.
  * Screen Saver: 3D Maze; its Wait box counts the people still out there. A 9 m hourglass cursor
  * floats over it, flipping. */
 const finalGroup=new THREE.Group(),toBunker=Math.atan2(17-FINAL.x,0-FINAL.z);root.add(finalGroup);
 const along=new THREE.Vector2(Math.cos(toBunker),-Math.sin(toBunker));
 let low=Infinity;for(let s=-7;s<=7;s+=1)low=Math.min(low,groundY(FINAL.x+along.x*s,FINAL.z+along.y*s));
 finalGroup.position.set(FINAL.x,low-.5,FINAL.z);finalGroup.rotation.y=toBunker;
 const dialogCanvas=document.createElement('canvas');dialogCanvas.width=1024;dialogCanvas.height=732;const dg=dialogCanvas.getContext('2d')!;
 const dialogTexture=new THREE.CanvasTexture(dialogCanvas);dialogTexture.colorSpace=THREE.SRGBColorSpace;dialogTexture.anisotropy=4;
 let waitShown=-1;
 function drawDialog(wait:number){
  waitShown=wait;const g=dg,bevel=(x:number,y:number,w:number,h:number,inset=false)=>{g.fillStyle=inset?'#808080':'#fff';g.fillRect(x,y,w,3);g.fillRect(x,y,3,h);g.fillStyle=inset?'#fff':'#404040';g.fillRect(x,y+h-3,w,3);g.fillRect(x+w-3,y,3,h);};
  g.fillStyle='#c0c0c0';g.fillRect(0,0,1024,732);bevel(0,0,1024,732);
  g.fillStyle='#000080';g.fillRect(8,8,1008,54);g.fillStyle='#fff';g.font='bold 34px sans-serif';g.textBaseline='middle';g.fillText('Display Properties',24,36);
  for(const [i,mark] of ['?','×'].entries()){const x=900+i*54;g.fillStyle='#c0c0c0';g.fillRect(x,16,44,38);bevel(x,16,44,38);g.fillStyle='#000';g.textAlign='center';g.fillText(mark,x+22,36);g.textAlign='left';}
  g.font='26px sans-serif';['Background','Screen Saver','Appearance','Settings'].forEach((t,i)=>{const x=24+i*178;g.fillStyle='#c0c0c0';g.fillRect(x,78,170,46);bevel(x,78,170,i===1?48:46);g.fillStyle='#000';g.fillText(t,x+16,102);});
  bevel(18,124,988,524);
  // the monitor preview: a beige CRT showing a corridor of the 3D maze
  g.fillStyle='#d8d2bf';g.fillRect(300,148,424,300);bevel(300,148,424,300);g.fillStyle='#0d0d0d';g.fillRect(332,172,360,232);
  const cx=512,cy=288;g.fillStyle='#6b2416';g.beginPath();g.moveTo(332,172);g.lineTo(cx-60,cy-40);g.lineTo(cx-60,cy+40);g.lineTo(332,404);g.fill();g.beginPath();g.moveTo(692,172);g.lineTo(cx+60,cy-40);g.lineTo(cx+60,cy+40);g.lineTo(692,404);g.fill();
  g.fillStyle='#8a3220';g.fillRect(cx-60,cy-40,120,80);g.fillStyle='#4a4a4a';g.beginPath();g.moveTo(332,404);g.lineTo(cx-60,cy+40);g.lineTo(cx+60,cy+40);g.lineTo(692,404);g.fill();
  g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=2;for(let k=0;k<4;k++){const y=cy-40+k*20;g.beginPath();g.moveTo(cx-60,y);g.lineTo(cx+60,y);g.stroke();}
  g.fillStyle='#b9b29d';g.fillRect(440,448,144,22);g.fillRect(400,470,224,14);
  g.fillStyle='#000';g.font='28px sans-serif';g.fillText('Screen Saver',48,530);
  g.fillStyle='#fff';g.fillRect(48,556,330,50);bevel(48,556,330,50,true);g.fillStyle='#000';g.fillText('3D Maze',62,582);g.fillStyle='#c0c0c0';g.fillRect(338,560,36,42);bevel(338,560,36,42);g.fillStyle='#000';g.fillText('▾',346,582);
  for(const [i,t] of ['Settings...','Preview'].entries()){const x=402+i*190;g.fillStyle='#c0c0c0';g.fillRect(x,556,176,50);bevel(x,556,176,50);g.fillStyle=i?'#808080':'#000';g.textAlign='center';g.fillText(t,x+88,582);g.textAlign='left';}
  g.fillStyle='#000';g.fillText('Wait:',790,582);g.fillStyle='#fff';g.fillRect(860,556,74,50);bevel(860,556,74,50,true);g.fillStyle='#000';g.textAlign='center';g.font='bold 30px sans-serif';g.fillText(String(wait),897,582);g.font='28px sans-serif';g.textAlign='left';
  g.fillText('people',944,582);
  for(const [i,t] of ['OK','Cancel','Apply'].entries()){const x=600+i*136;g.fillStyle='#c0c0c0';g.fillRect(x,664,124,50);bevel(x,664,124,50);g.fillStyle=i===2?'#808080':'#000';g.textAlign='center';g.fillText(t,x+62,690);g.textAlign='left';}
  dialogTexture.needsUpdate=true;
 }
 const grey=new THREE.MeshBasicMaterial({color:0xa9a9a9});
 const face=new THREE.MeshBasicMaterial({map:dialogTexture});
 const panel=new THREE.Mesh(new THREE.BoxGeometry(14,10,.5).translate(0,5,0),[grey,grey,grey,grey,face,face]);finalGroup.add(panel);occluders.push(panel);
 const hourglass=new THREE.Mesh(new THREE.PlaneGeometry(5.4,9),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.5,side:THREE.DoubleSide,
  map:canvasTexture(24,40,g=>{
   const rows=['XXXXXXXXXXXXXXXXXXXXXXXX','XWWWWWWWWWWWWWWWWWWWWWWX','XXXXXXXXXXXXXXXXXXXXXXXX','..XWWWWWWWWWWWWWWWWWWX..','..XWSSSSSSSSSSSSSSSSWX..','..XWWSSSSSSSSSSSSSSWWX..','...XWWSSSSSSSSSSSSWWX...','....XWWSSSSSSSSSSWWX....','.....XWWSSSSSSSSWWX.....','......XWWSSSSSSWWX......','.......XWWSSSSWWX.......','........XWWSSWWX........','.........XWSSWX.........','..........XWWX..........','.........XWSSWX.........','........XWWSSWWX........','.......XWWWSSWWWX.......','......XWWWWSSWWWWX......','.....XWWWWWSSWWWWWX.....','....XWWWWWSSSSWWWWWX....','...XWWWWSSSSSSSSWWWWX...','..XWWSSSSSSSSSSSSSSWWX..','..XWSSSSSSSSSSSSSSSSWX..','..XWWWWWWWWWWWWWWWWWWX..','XXXXXXXXXXXXXXXXXXXXXXXX','XWWWWWWWWWWWWWWWWWWWWWWX','XXXXXXXXXXXXXXXXXXXXXXXX'];
   const at=Math.floor((40-rows.length)/2);rows.forEach((r,y)=>{for(let x=0;x<24;x++){const k=r[x];if(k==='.')continue;g.fillStyle=k==='X'?'#000':k==='S'?'#d9b34a':'#fff';g.fillRect(x,y+at,1,1);}});
  },true)}));
 hourglass.rotation.order='YXZ';hourglass.position.set(FINAL.x,low+10+25,FINAL.z);root.add(hourglass);

 /* The MCP column (spec 2.6): 900 m south, behind you as you leave the bunker. A faceted
  * stainless column under an X crown, rocket bells at its foot, and the face band. */
 const mcp=new THREE.Group();mcp.position.set(MCP.x,groundY(MCP.x,MCP.z),MCP.z);mcp.rotation.y=Math.atan2(17-MCP.x,0-MCP.z);root.add(mcp);
 const steel=hazed(null,.42);
 mcp.add(new THREE.Mesh(mergeGeometries([
  tint(new THREE.CylinderGeometry(22,28,MCP_TOP,6).translate(0,MCP_TOP/2,0).toNonIndexed(),0xc9d0d6),
  tint(new THREE.CylinderGeometry(40,22,26,6).translate(0,MCP_TOP+13,0).toNonIndexed(),0xb9c2ca),
  tint(new THREE.BoxGeometry(62,15,10).rotateZ(Math.PI/4).translate(0,MCP_TOP+52,0).toNonIndexed(),0xaab4bd),tint(new THREE.BoxGeometry(62,15,10).rotateZ(-Math.PI/4).translate(0,MCP_TOP+52,0).toNonIndexed(),0xaab4bd),
  ...[-1,0,1].map(k=>tint(new THREE.ConeGeometry(14,22,12,1,true).translate(k*32,11,k?8:20).toNonIndexed(),0x5b6168)),
 ]),steel));
 const faceCanvas=document.createElement('canvas');faceCanvas.width=faceCanvas.height=8;const faceContext=faceCanvas.getContext('2d')!;
 const faceTexture=new THREE.CanvasTexture(faceCanvas);faceTexture.colorSpace=THREE.NoColorSpace;faceTexture.magFilter=faceTexture.minFilter=THREE.NearestFilter;faceTexture.generateMipmaps=false;
 const faceBand=new THREE.Mesh(tint(new THREE.PlaneGeometry(66,66),0xffffff,false),hazed(faceTexture,.34));faceBand.position.set(0,MCP_TOP-72,27);mcp.add(faceBand);
 const source=faceSource();let blocksShown=-1;
 function drawFace(levels:number){
  const n=2**Math.min(5,levels+1);blocksShown=n;faceCanvas.width=faceCanvas.height=n;faceContext.imageSmoothingEnabled=true;faceContext.imageSmoothingQuality='high';faceContext.drawImage(source,0,0,n,n);faceTexture.dispose();faceTexture.image=faceCanvas;faceTexture.needsUpdate=true;
 }

 let visible=true,audioEnabled=true;const look=new THREE.Vector3();
 return {occluders,
  physicsBoxes:():IconObstacle[]=>[
   ...([{door:meg,frame:megFrame,hw:MW,depth:MD,top:14.6},
    {door:ag,frame:agFrame,hw:AW,depth:AD,top:6.3}]).map(({door,frame,hw,depth,top})=>({
     x:door.x-frame.normal.x*depth/2,y:frame.y+(top+BASE)/2,z:door.z-frame.normal.y*depth/2,
     hx:hw,hy:(top-BASE)/2,hz:depth/2,yaw:frame.heading,
    })),
   {x:towerTop.x,y:agFrame.y+(TOP+6)/2,z:towerTop.z,hx:tw/2,hy:(TOP-6)/2,hz:(tz1-tz0)/2,yaw:agFrame.heading},
   {x:stick.position.x,y:stick.position.y+17,z:stick.position.z,hx:.36,hy:17,hz:.36},
   {x:booth.position.x,y:booth.position.y+1.8,z:booth.position.z,hx:1,hy:1.8,hz:1,yaw:booth.rotation.y},
   {x:FINAL.x,y:finalGroup.position.y+5,z:FINAL.z,hx:7,hy:5,hz:.3,yaw:toBunker},
  ],
  setVisible(value:boolean){visible=value;root.visible=value;phoneAudio.setActive(audioEnabled&&visible);},
  setAudioActive(value:boolean){audioEnabled=value;phoneAudio.setActive(audioEnabled&&visible);},
  blocked(x:number,z:number){
   if(!visible)return false;
   for(const [door,frame,hw,depth] of [[meg,megFrame,MW,MD],[ag,agFrame,AW,AD]] as const){const dx=x-door.x,dz=z-door.z,u=dx*frame.side.x+dz*frame.side.y,v=dx*frame.normal.x+dz*frame.normal.y;if(Math.abs(u)<hw+.6&&v<.45&&v>-depth-.6)return true;}
   if(Math.hypot(x-stick.position.x,z-stick.position.z)<.8||Math.abs(x-booth.position.x)<1.1&&Math.abs(z-booth.position.z)<1.1)return true;
   const dx=x-FINAL.x,dz=z-FINAL.z,u=dx*along.x+dz*along.y,v=dx*Math.sin(toBunker)+dz*Math.cos(toBunker);
   return Math.abs(u)<7.4&&Math.abs(v)<.8;
  },
  /** The locked door or dialog you are standing at, if any. */
  nearest(x:number,z:number):FutureId|null{
   if(!visible)return null;
   for(const [door,frame] of [[meg,megFrame],[ag,agFrame]] as const){const dx=x-door.x,dz=z-door.z;if(Math.hypot(dx,dz)<4.5&&dx*frame.normal.x+dz*frame.normal.y>-.5)return door.id;}
   const dx=x-FINAL.x,dz=z-FINAL.z;return Math.hypot(dx,dz)<10&&dx*Math.sin(toBunker)+dz*Math.cos(toBunker)>0?'final':null;
  },
  distanceTo(id:FutureId,x:number,z:number){const t=id==='final'?FINAL:FUTURE_DOORS.find(d=>d.id===id)!;return Math.hypot(x-t.x,z-t.z);},
  update(dt:number,time:number,player:THREE.Vector3,yaw:number,reduced:boolean,paused:boolean,progress:{unresolved:number;levels:number},pitch=0){
   if(progress.unresolved!==waitShown)drawDialog(progress.unresolved);
   if(Math.min(5,progress.levels+1)!==Math.log2(Math.max(1,blocksShown)))drawFace(progress.levels);
   if(!visible)return;
   const t=reduced?0:time;
   rain.uniforms.uTime.value=t;rain.uniforms.uRain.value=reduced?.55:1;
   // the spinner chases itself; both it and the to-do list turn to face you
   const lead=Math.floor(t*9)%8;
   dots.forEach((dot,i)=>{const k=(lead-i+8)%8,s=1.3-k*.1;dot.scale.setScalar(s);(dot.material as THREE.MeshBasicMaterial).color.setRGB(.91-k*.08,.86-k*.08,.75-k*.07);});
   for(const o of [spinner,todo])o.rotation.y=Math.atan2(player.x-o.position.x,player.z-o.position.z);
   hourglass.rotation.y=Math.atan2(player.x-hourglass.position.x,player.z-hourglass.position.z);
   const flip=reduced?0:Math.min(1,((time%3.2)-2.8)/.4);hourglass.rotation.z=flip>0?Math.PI*flip*flip*(3-2*flip):0;
   // MEG3N's phone: blinks, counts notifications, watches you within 200 m
   (screen.material as THREE.MeshBasicMaterial).map=screens[!reduced&&time%3.4<.16?1:0];
   if(!paused&&time>=badgeAt){badgeCount+=1+Math.floor(Math.random()*3);badgeAt=time+.5+Math.random()*1.1;}
   if(badgeCount!==badgeShown)drawBadge();
   const range=Math.hypot(player.x-stick.position.x,player.z-stick.position.z);
   look.set(player.x,0,player.z);const want=range<200?Math.atan2(look.x-stick.position.x,look.z-stick.position.z):Math.sin(reduced?0:time*.2)*.6+Math.atan2(17-stick.position.x,-stick.position.z);
   phone.rotation.y+=Math.atan2(Math.sin(want-phone.rotation.y),Math.cos(want-phone.rotation.y))*Math.min(1,dt*1.5);
   // pink smoke rings rising off the chimney
   rings.forEach((r,i)=>{const p=reduced?.3+i*.2:((time/6+i/3)%1);r.position.set(smokeTop.x+Math.sin(p*5+i)*.8,smokeTop.y+p*13,smokeTop.z);r.scale.setScalar(.8+p*1.6);(r.material as THREE.MeshBasicMaterial).opacity=.85*(1-p);});
   // Update the listener and locality gate even during a scheduled ring.
   phoneAudio.update(player,yaw,pitch,!paused);
   if(!paused&&time>=nextRing){nextRing=time+12;phoneAudio.ring();}
  },
  dispose(){phoneAudio.dispose();},
  getState:()=>({visible,wait:waitShown,mcp_blocks:blocksShown,badge:badgeCount,phone_rings:phoneAudio.getState().rings,phone_audio:phoneAudio.getState(),doors:FUTURE_DOORS.map(d=>d.id)}),
 };
}
