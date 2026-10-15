import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original temporary prototype art. No Doom, Microsoft, or film asset data.
 * Shared articulated adult rig; body proportions, skin, and hair vary by seed.
 * Technical art budget: <300 calls, <150k visible triangles, <30 textures,
 * DPR <=1.5, zero post passes, one bounded shadow map. This is prototype art.
 */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitSphere = new THREE.SphereGeometry(1, 12, 9);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const unitCapsule = new THREE.CapsuleGeometry(1, 1, 3, 8);
const scratch = new THREE.Matrix4();
const quat = new THREE.Quaternion();
export function hash(n: number): number { const a = Math.sin(n * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); }
export const colors = { signal: 0xeaba65, danger: 0xef4736, reward: 0x96dbe5, grass: 0x65a526 };
export function mesh(g: THREE.BufferGeometry, m: THREE.Material, x=0, y=0, z=0, sx=1, sy=1, sz=1): THREE.Mesh {
  const a = new THREE.Mesh(g, m); a.position.set(x,y,z); a.scale.set(sx,sy,sz); a.castShadow=true; a.receiveShadow=true; return a;
}
export function box(m: THREE.Material, x=0,y=0,z=0,sx=1,sy=1,sz=1): THREE.Mesh { return mesh(unitBox,m,x,y,z,sx,sy,sz); }
export function sphere(m: THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1): THREE.Mesh { return mesh(unitSphere,m,x,y,z,sx,sy,sz); }
export function cylinder(m: THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1): THREE.Mesh { return mesh(unitCylinder,m,x,y,z,sx,sy,sz); }
function merge(parts: THREE.Mesh[], material: THREE.Material): THREE.Mesh {
  const geometries = parts.map(p => { p.updateMatrix(); return p.geometry.clone().applyMatrix4(p.matrix); });
  const g = mergeGeometries(geometries, false); geometries.forEach(a=>a.dispose());
  const m = new THREE.Mesh(g,material); m.castShadow=true; m.receiveShadow=true; return m;
}
type RGB=[number,number,number];
const clamp255=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
/** Doom-style texel art: small power-of-two bitmaps, chunky stepped noise, hard edges. */
function pixelTexture(w:number,h:number,fn:(x:number,y:number)=>RGB,after?:(c:CanvasRenderingContext2D)=>void):THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d')!;const img=c.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,b]=fn(x,y),i=(y*w+x)*4;img.data[i]=clamp255(r);img.data[i+1]=clamp255(g);img.data[i+2]=clamp255(b);img.data[i+3]=255;}
  c.putImageData(img,0,0);after?.(c);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapNearestFilter;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}
// Stepped noise (4 levels) reads like a 256-colour palette ramp rather than smooth grain.
const grit=(x:number,y:number,seed:number,amount=.22)=>1-amount/2+Math.floor(hash(x*7.31+y*131.7+seed)*4)/3*amount;
const mul=(c:RGB,k:number):RGB=>[c[0]*k,c[1]*k,c[2]*k];
function bevel(x:number,y:number,x0:number,y0:number,w:number,h:number):number { // +1 lit edge, -1 shadow edge, 0 face
  if(x===x0||y===y0)return 1;if(x===x0+w-1||y===y0+h-1)return -1;return 0;
}
export function canvasTexture(kind:'tech'|'brick'|'floor'|'metal'|'wood'|'grass'|'crack'|'door'):THREE.CanvasTexture {
  if(kind==='tech') return pixelTexture(64,128,(x,y)=>{ // tan tech panelling with a dark service band
    const base:RGB=[146,118,80];let k=grit(x,y,1);const px=x%32,py=y%64;
    if(y>=86&&y<100){const b=bevel(x,y,0,86,64,14);if(b)return b>0?[176,150,106]:[56,44,30];if(y>=90&&y<96&&(px>=10&&px<22))return (x+y)%2?[210,176,96]:[180,140,70];return mul([92,74,50],grit(x,y,9,.15));}
    if(y>=120)return mul([84,68,46],k);
    if(px===0||py===0)return [60,46,32];if(px===31||py===63)return [184,158,114];if(px===1||py===1)return [168,140,98];
    if((px===4||px===27)&&(py===4||py===59))return [214,196,150];
    return mul(base,k);
  });
  if(kind==='brick'||kind==='crack') return pixelTexture(64,128,(x,y)=>{ // grey stone blocks
    const row=Math.floor(y/16),off=(row%2)*16,bx=Math.floor((x+off)/32),lx=(x+off)%32,ly=y%16;
    if(lx===0||ly===0)return [44,42,40];const tone=.82+hash(row*17+bx*3+(kind==='crack'?40:0))*.3;
    const base:RGB=kind==='crack'?[112,114,98]:[118,116,110];
    if(lx===1||ly===1)return mul(base,tone*1.25);if(lx===31||ly===15)return mul(base,tone*.68);
    return mul(base,tone*grit(x,y,2,.24));
  },kind==='crack'?c=>{c.strokeStyle='#121410';c.lineWidth=2;c.beginPath();c.moveTo(36,0);c.lineTo(28,22);c.lineTo(34,40);c.lineTo(20,62);c.lineTo(32,80);c.lineTo(25,104);c.lineTo(31,128);c.moveTo(34,40);c.lineTo(50,52);c.lineTo(62,50);c.moveTo(20,62);c.lineTo(5,74);c.moveTo(32,80);c.lineTo(46,92);c.stroke();c.fillStyle='#d8c060';c.fillRect(2,2,8,4);c.fillRect(54,118,8,4);}:undefined);
  if(kind==='floor') return pixelTexture(64,64,(x,y)=>{ // worn brown floor tiles
    const tx=x%32,ty=y%32,id=Math.floor(x/32)+Math.floor(y/32)*2;const base:RGB=id%3===0?[104,92,70]:[92,84,68];
    const b=bevel(tx,ty,0,0,32,32);if(b)return b>0?mul(base,1.3):mul(base,.55);
    const dirt=hash(Math.floor(x/3)*13+Math.floor(y/3)*71)>.86?.78:1;return mul(base,grit(x,y,3,.26)*dirt);
  });
  if(kind==='metal') return pixelTexture(64,64,(x,y)=>{ // ceiling: grey plates with a square light panel
    const tx=x%32,ty=y%32;const base:RGB=[78,80,78];
    if(x>=20&&x<44&&y>=20&&y<44){const b=bevel(x,y,20,20,24,24);if(b)return b>0?[150,150,140]:[40,40,40];return (x+y)%4===0?[200,198,170]:[226,224,196];}
    const b=bevel(tx,ty,0,0,32,32);if(b)return b>0?[108,110,106]:[40,42,40];return mul(base,grit(x,y,4,.2));
  });
  if(kind==='door') return pixelTexture(64,128,(x,y)=>{ // grey blast door, hazard stripes top and bottom
    if(y<10||y>=118)return (Math.floor((x+y)/6)%2)?[30,26,18]:[214,178,40];
    if(x===31||x===32)return [34,34,38];if(y%24===10)return [62,62,68];if(y%24===11)return [150,150,158];
    const b=bevel(x,y,0,10,64,108);if(b)return b>0?[150,150,156]:[48,48,52];
    return mul([112,112,120],grit(x,y,5,.18));
  });
  if(kind==='wood') return pixelTexture(64,64,(x,y)=>{ // crate: dark frame around planks
    if(x<5||x>58||y<5||y>58){const b=bevel(x,y,0,0,64,64);if(b)return b>0?[170,128,74]:[44,30,16];return mul([96,68,36],grit(x,y,6,.2));}
    if((y-5)%9===0)return [70,48,24];const grain=Math.sin(x*.45+Math.floor((y-5)/9)*3)>.85?.82:1;return mul([158,116,64],grit(x,y,7,.18)*grain);
  });
  // grass: unchanged meadow texture (outdoor pass is separate)
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#477f24';c.fillRect(0,0,128,128);
  for(let i=0;i<2200;i++){const v=Math.floor(hash(i+5*124)*55);c.fillStyle=`rgba(${v},${v},${v},${0.05+hash(i+55)*.22})`;c.fillRect(Math.floor(hash(i+84)*128),Math.floor(hash(i+148)*128),1+Math.floor(hash(i+27)*4),1+Math.floor(hash(i+92)*3));}
  for(let i=0;i<1800;i++){const x=hash(i+980)*128,y=hash(i+618)*128;c.strokeStyle=i%3?'rgba(83,134,29,.8)':'rgba(25,71,13,.5)';c.beginPath();c.moveTo(x,y);c.lineTo(x+hash(i)*2,y-2-hash(i+883)*3);c.stroke();}
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapNearestFilter;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}
/** World surfaces are unlit like Doom sectors (brightness comes from per-cell
 * instance colour plus black distance fog). Figures and props use flat-shaded
 * Lambert so they keep a chunky faceted read at low resolution. */
const basic=(kind:Parameters<typeof canvasTexture>[0])=>new THREE.MeshBasicMaterial({map:canvasTexture(kind)});
const flat=(o:THREE.MeshLambertMaterialParameters)=>new THREE.MeshLambertMaterial({flatShading:true,...o});
export class Materials {
  tech = basic('tech');
  stone = basic('brick');
  floor = basic('floor');
  metal = basic('metal');
  door = basic('door');
  wood = basic('wood');
  grass = new THREE.MeshStandardMaterial({map:canvasTexture('grass'),roughness:1,vertexColors:true});
  cracked = basic('crack');
  trim = flat({color:0x3a3a3a});
  chrome = new THREE.MeshStandardMaterial({color:0xc5d3d6,metalness:1,roughness:.3,envMapIntensity:1.4,flatShading:true});
  dark = flat({color:0x161616});
  rubber = flat({color:0x303030});
  white = flat({color:0xe6ddbc});
  yellow = flat({color:0xc8a030});
  blue = flat({color:0x77b3c0});
  red = flat({color:0x7a1c10,emissive:0xe02010,emissiveIntensity:1.2});
  green = flat({color:0x1c4622,emissive:0x40e060,emissiveIntensity:1.2});
  lamp = new THREE.MeshBasicMaterial({color:0xfff0c0});
  shadow: THREE.MeshBasicMaterial;
  constructor(){
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(0,0,0,.4)');g.addColorStop(.45,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    this.shadow=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,toneMapped:false});
    this.grass.map!.repeat.set(110,110);
  }
}
export interface Figure { root:THREE.Group; arms:THREE.Group[]; elbows:THREE.Group[]; legs:THREE.Group[]; knees:THREE.Group[]; gun:THREE.Group; eye?:THREE.Mesh; skin?:THREE.Material; lastX:number;lastZ:number;phase:number; }
export const hairPalette=[0x332c26,0x8b5b38,0xb8b5a7,0x202127,0x695847,0x76604a];
export const skinPalette=[0xd8a37e,0x895938,0xe3ba96,0x6e4834,0xbc8058,0xdda98f];
export function makeRifle(m:Materials, heavy=false): THREE.Group {
  const r=new THREE.Group();r.name=heavy?'hunter-rifle':'salvaged-rifle';
  r.add(box(m.trim,0,0,0,.16,.17,.43),box(m.rubber,0,-.075,.27,.12,.20,.19),box(m.rubber,0,-.14,.02,.08,.19,.12),box(m.chrome,0,.1,-.16,.08,.07,.20));
  const barrel=cylinder(m.chrome,0,.015,-.42,heavy?.055:.026,.47,heavy?.055:.026);barrel.rotation.x=Math.PI/2;r.add(barrel);
  r.add(box(m.dark,0,-.01,-.69,heavy?.12:.05,heavy?.1:.05,.08));
  return r;
}
export function makeHuman(id:number,m:Materials): Figure {
  const root=new THREE.Group();root.name=`adult-human-${id}`;
  const skin=new THREE.MeshLambertMaterial({color:skinPalette[id%skinPalette.length],flatShading:true});
  const hair=new THREE.MeshLambertMaterial({color:hairPalette[id%6],flatShading:true});
  const torsoWidth=[.25,.22,.32,.27,.21,.28][id%6], waist=[.23,.2,.32,.26,.2,.3][id%6];
  const feminine=id%3===1;
  const body=[sphere(skin,0,1.24,.02,torsoWidth,.32,.145),sphere(skin,0,1.04,.035,waist,.24,waist*.72),sphere(skin,0,.89,.045,.205,.17,.15),sphere(skin,-.09,.87,.13,.125,.13,.08),sphere(skin,.09,.87,.13,.125,.13,.08),cylinder(skin,0,1.53,0,.075,.16,.075),sphere(skin,0,1.72,0,.13,.18,.12),sphere(skin,0,1.69,-.122,.034,.055,.042),sphere(skin,-.13,1.7,0,.025,.045,.024),sphere(skin,.13,1.7,0,.025,.045,.024)];
  if(feminine) body.push(sphere(skin,-.104,1.30,-.105,.095,.084,.085),sphere(skin,.104,1.30,-.105,.095,.084,.085));
  else body.push(sphere(skin,0,.84,-.108,.035,.055,.033));
  root.add(merge(body,skin));
  const detail=new THREE.MeshLambertMaterial({color:new THREE.Color(skinPalette[id%6]).multiplyScalar(.48)});
  const details=[sphere(detail,0,1.02,-waist*.58,.012,.015,.008),sphere(detail,-.113,1.305,feminine?-.185:-.132,.012,.012,.006),sphere(detail,.113,1.305,feminine?-.185:-.132,.012,.012,.006)];
  root.add(merge(details,detail));
  // Hairline, moustache/beard, wrinkles, and adult proportions keep the crowd adult.
  const hairParts=[sphere(hair,0,1.836,.013,.129,.055,.12),sphere(hair,-.115,1.75,.012,.031,.085,.09),sphere(hair,.115,1.75,.012,.031,.085,.09)];
  if(id%2===0) hairParts.push(sphere(hair,0,1.622,-.045,.088,.045,.08),box(hair,0,1.653,-.118,.075,.017,.014));
  if(feminine)hairParts.push(sphere(hair,0,1.703,.103,.115,.20,.062));
  root.add(merge(hairParts,hair));
  root.add(merge([sphere(m.white,-.049,1.733,-.104,.037,.025,.021),sphere(m.white,.049,1.733,-.104,.037,.025,.021)],m.white));
  root.add(merge([sphere(m.dark,-.05,1.732,-.124,.013,.017,.006),sphere(m.dark,.05,1.732,-.124,.013,.017,.006),box(m.dark,-.052,1.77,-.104,.055,.012,.017),box(m.dark,.052,1.77,-.104,.055,.012,.017),sphere(m.dark,0,1.631,-.112,.025,.014,.007)],m.dark));
  const arms:THREE.Group[]=[],elbows:THREE.Group[]=[],legs:THREE.Group[]=[],knees:THREE.Group[]=[];
  for(const side of [-1,1]) {
    const arm=new THREE.Group();arm.position.set(side*(torsoWidth*.83+.046),1.42,.015);
    const upper=mesh(unitCapsule,skin,0,-.15,0,.075,.12,.075);arm.add(upper);
    const elbow=new THREE.Group();elbow.position.y=-.29;elbow.add(mesh(unitCapsule,skin,0,-.13,0,.06,.106,.06),sphere(skin,0,-.30,-.014,.069,.085,.039));arm.add(elbow);root.add(arm);arms.push(arm);elbows.push(elbow);
    const leg=new THREE.Group();leg.position.set(side*.113,.90,.04);leg.add(mesh(unitCapsule,skin,0,-.19,0,.096,.15,.099));
    const knee=new THREE.Group();knee.position.y=-.40;knee.add(mesh(unitCapsule,skin,0,-.17,0,.070,.134,.072),sphere(skin,0,-.44,-.04,.082,.066,.146));leg.add(knee);root.add(leg);legs.push(leg);knees.push(knee);
  }
  const gun=makeRifle(m);gun.position.set(.02,-.27,-.23);gun.rotation.x=-1.55;elbows[1].add(gun);gun.visible=false;
  const h=[1,1.015,.96,1.045,.985,1.03][id%6];root.scale.set(1,h,1);
  return {root,arms,elbows,legs,knees,gun,skin,lastX:NaN,lastZ:NaN,phase:id*1.37};
}
export function makeHunter(m:Materials):Figure {
  const root=new THREE.Group();root.name='original-chrome-hunter';
  root.add(merge([box(m.chrome,0,1.43,0,.52,.42,.29),box(m.chrome,0,1.12,0,.23,.3,.18),box(m.chrome,0,.95,0,.36,.15,.22),sphere(m.chrome,0,1.92,0,.155,.19,.13),box(m.chrome,0,1.80,-.071,.25,.13,.16),cylinder(m.chrome,0,1.70,0,.07,.17,.07)],m.chrome));
  root.add(merge([box(m.dark,0,1.4,-.151,.31,.25,.018),box(m.dark,0,1.929,-.123,.255,.055,.021),box(m.dark,0,1.795,-.156,.13,.033,.012)],m.dark));
  const eye=merge([box(m.red,-.07,1.93,-.139,.063,.021,.014),box(m.red,.07,1.93,-.139,.063,.021,.014)],m.red);root.add(eye);
  const arms:THREE.Group[]=[],elbows:THREE.Group[]=[],legs:THREE.Group[]=[],knees:THREE.Group[]=[];
  for(const side of [-1,1]) {
    const a=new THREE.Group();a.position.set(side*.34,1.62,0);a.add(sphere(m.chrome,0,0,0,.125,.125,.13),cylinder(m.chrome,0,-.18,0,.06,.34,.06));
    const e=new THREE.Group();e.position.y=-.34;e.add(sphere(m.dark,0,0,0,.077,.076,.077),box(m.chrome,0,-.14,0,.13,.27,.13),box(m.chrome,0,-.31,-.025,.11,.09,.15));a.add(e);root.add(a);arms.push(a);elbows.push(e);
    const l=new THREE.Group();l.position.set(side*.16,.94,0);l.add(box(m.chrome,0,-.20,0,.17,.34,.19));const k=new THREE.Group();k.position.y=-.40;k.add(sphere(m.dark,0,0,0,.08,.07,.08),box(m.chrome,0,-.21,0,.12,.39,.12),box(m.chrome,0,-.46,-.06,.19,.10,.34));l.add(k);root.add(l);legs.push(l);knees.push(k);
  }
  const gun=makeRifle(m,true);gun.scale.setScalar(1.4);gun.position.set(0,-.30,-.16);gun.rotation.x=-Math.PI/2;elbows[1].add(gun);
  return{root,arms,elbows,legs,knees,gun,eye,lastX:NaN,lastZ:NaN,phase:0};
}
export function animateFigure(f:Figure,person:any,time:number,hunter=false):void {
  const moved=Number.isFinite(f.lastX)?Math.hypot(person.x-f.lastX,person.z-f.lastZ):0;
  f.phase+=Math.min(moved,.3)*(hunter?5:8);
  const s=Math.sin(f.phase),stride=moved>.0004?1:0;
  f.root.position.set(person.x,0,person.z);f.root.rotation.set(0,person.heading||0,0);
  if(!hunter && !person.alive) {f.root.rotation.x=-Math.PI/2;f.root.position.y=.15;f.legs.forEach(p=>p.rotation.x=0);f.arms[0].rotation.z=.9;f.arms[1].rotation.z=-.9;}
  else {
    f.root.position.y=Math.abs(Math.sin(f.phase*2))*.023*stride;
    f.legs[0].rotation.x=s*.53*stride;f.legs[1].rotation.x=-s*.53*stride;
    f.knees[0].rotation.x=Math.max(0,-s)*.55*stride;f.knees[1].rotation.x=Math.max(0,s)*.55*stride;
    f.arms[0].rotation.set(-s*.6*stride+(hunter?1.05:0),0,hunter?.13:.15);
    f.arms[1].rotation.set(s*.6*stride+(hunter?1.05:0),0,hunter?-.13:-.15);
    f.elbows[0].rotation.x=hunter?.5:-.25;f.elbows[1].rotation.x=hunter?.5:-.25;
    if(person.armed&&!hunter){f.arms[1].rotation.x=1.1;f.elbows[1].rotation.x=.45;}
    if(hunter&&person.stun>0){f.root.rotation.z=Math.sin(time*16)*.05;f.arms[0].rotation.x=.25;}
  }
  if(!hunter)f.gun.visible=!!person.armed;
  f.lastX=person.x;f.lastZ=person.z;
}
export function makeObject(kind:string,m:Materials):THREE.Group {
  const r=new THREE.Group();r.name=kind;
  if(kind==='camera') {
    r.add(box(m.trim,0,2.4,.20,.11,.12,.48),box(m.white,0,2.30,-.03,.32,.23,.55),box(m.dark,0,2.3,-.312,.21,.15,.024));
    const lens=cylinder(m.red,0,2.3,-.335,.056,.032,.056);lens.rotation.x=Math.PI/2;lens.name='signal';r.add(lens);
  } else if(kind==='crate') {
    r.add(box(m.wood,0,.68,0,1.6,1.36,1.55));
    const strips=[];for(const x of [-.67,.67])strips.push(box(m.trim,x,.68,0,.07,1.38,1.58));
    strips.push(box(m.trim,0,.22,0,1.62,.07,1.58),box(m.trim,0,1.10,0,1.62,.07,1.58));r.add(merge(strips,m.trim));
  } else if(kind==='bomb') {
    for(const x of [-.15,0,.15]){const pipe=cylinder(m.yellow,x,.20,0,.077,.48,.077);pipe.rotation.x=Math.PI/2;r.add(pipe);}
    r.add(box(m.trim,0,.22,0,.52,.18,.17),box(m.dark,0,.332,0,.22,.026,.12),box(m.red,0,.348,0,.12,.015,.052));
  } else if(kind==='weapon') {
    const rifle=makeRifle(m);rifle.position.y=.37;rifle.rotation.z=Math.PI/2;rifle.rotation.x=.1;r.add(rifle);
  } else if(kind==='wall') {
    const leaf=box(m.cracked,0,1.6,0,1.99,3.2,1.98);leaf.name='leaf';r.add(leaf);
  } else if(kind==='hatch'||kind==='gate') {
    const out=kind==='gate',width=out?3.5:2;
    r.add(merge([box(out?m.white:m.trim,-width/2,1.65,0,.22,3.3,.43),box(out?m.white:m.trim,width/2,1.65,0,.22,3.3,.43),box(out?m.white:m.trim,0,3.18,0,width+.22,.27,.43)],out?m.white:m.trim));
    const leaf=new THREE.Group();leaf.name='leaf';leaf.add(box(m.door,0,1.5,0,width-.22,3,.22));
    leaf.add(box(m.yellow,0,.47,-.125,width-.22,.1,.025),box(m.yellow,0,2.45,-.125,width-.22,.1,.025),box(m.chrome,width*.25,1.4,-.2,.06,.35,.1));r.add(leaf);
    const signal=box(m.green,0,3.19,-.226,.65,.08,.01);signal.name='signal';r.add(signal);
  } else if(kind==='relay') {
    r.add(box(m.floor,0,.11,0,2.2,.22,1.8),box(m.trim,0,1.05,0,.85,1.85,.6),box(m.white,0,1.16,-.323,.72,1.5,.05),box(m.dark,0,1.45,-.36,.52,.35,.025));
    const screen=box(m.green,0,1.45,-.38,.43,.25,.02);screen.name='signal';r.add(screen);
    r.add(box(m.yellow,0,.65,-.369,.45,.21,.04),cylinder(m.chrome,0,2.5,.05,.035,1.4,.035));
    const dish=cylinder(m.white,0,3.12,.05,.29,.065,.29);dish.rotation.x=.6;r.add(dish);
    r.add(box(m.dark,.62,.6,0,.07,1.05,.1),box(m.dark,.45,1.1,0,.33,.06,.1));
  }
  return r;
}
export function makeCloudTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d')!;
  // One connected silhouette, then clipped broad shading: overlapping puff rims
  // would read as a stack of circles rather than a cloud.
  ctx.filter='blur(1.2px)';ctx.fillStyle='#ffffff';
  for(let i=0;i<35;i++) {
    const x=35+i*13,y=116-32*Math.sin(i/34*Math.PI)+hash(i+77)*13,r=19+20*Math.sin(i/34*Math.PI)+hash(i+61)*9;
    ctx.beginPath();ctx.ellipse(x,y,r,r*.83,0,0,Math.PI*2);ctx.fill();
    if(i>3&&i<30){ctx.beginPath();ctx.ellipse(x,118,24,22,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.filter='none';ctx.globalCompositeOperation='source-atop';const shade=ctx.createLinearGradient(0,48,0,153);shade.addColorStop(0,'#ffffff');shade.addColorStop(.46,'#ffffff');shade.addColorStop(.8,'#e1ecf8');shade.addColorStop(1,'#bbcfe5');ctx.fillStyle=shade;ctx.fillRect(0,0,512,192);
  for(let i=0;i<12;i++){const x=80+hash(i+74)*340,y=104+hash(i+73)*30,r=25+hash(i+89)*35;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(164,188,215,.10)');g.addColorStop(1,'rgba(210,227,245,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
export function instanceBoxes(transforms:{x:number;y:number;z:number;sx?:number;sy?:number;sz?:number}[],mat:THREE.Material):THREE.InstancedMesh {
  const r=new THREE.InstancedMesh(unitBox,mat,transforms.length);
  transforms.forEach((a,i)=>{scratch.compose(new THREE.Vector3(a.x,a.y,a.z),quat,new THREE.Vector3(a.sx??1,a.sy??1,a.sz??1));r.setMatrixAt(i,scratch);});r.instanceMatrix.needsUpdate=true;r.computeBoundingSphere();r.receiveShadow=true;return r;
}
