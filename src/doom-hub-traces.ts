import * as THREE from 'three';

/* SAFE MODE coming apart (2026-10-23, docs/SAFE-MODE-PROGRESSION.md). The wallpaper sits on the Grid: as the
 * structures fall, Tron circuit traces leak out of each cleared building and run south to where the endgame's
 * walk leaves the hill (the gate, x 20..160 at z 180), the hill cracks like a struck screen, and after the
 * fourth level whole patches of wallpaper peel away to show the Grid's floor. Palette and grid (4 m minor,
 * 16 m major, on world x/z = 0) are shared with the endgame lane so the corridor south picks the lines up. */
export const TRON={line:0x38f4ff,core:0xd8fdff,floor:0x02060a,mcp:0xff3b1f,mcpCore:0xffd2a0};
/** Where each structure's bus crosses the hill's south edge: on the Grid's 16 m major lines. */
export const TRON_GATE={x:64,z:180};
const SUMMIT={x:-45,z:-92};
// world -> trace texture (0.25 m a texel over the whole walkable desktop)
export const TRACE_TEX={minX:-256,minZ:-288,size:512,n:2048};

type P=[number,number];
// One bus per structure: from just outside its door, octilinear (45 degree) bends, ending past the gate.
const BUSES:{lanes:number;path:P[]}[]=[
 {lanes:5,path:[[17,-1],[17,-6],[23,-12],[36,-12],[44,-4],[44,40],[64,60],[64,200]]},                     // CONTROL.EXE
 {lanes:5,path:[[.6,-197.9],[18,-182],[30,-170],[30,-60],[52,-38],[52,44],[80,72],[80,200]]},           // HAL3000.SYS
 {lanes:5,path:[[-146,.5],[-132,14.5],[-10,14.5],[14,38.5],[34,38.5],[48,52.5],[48,200]]},               // MEG3N.AVI
 {lanes:5,path:[[141.5,83.2],[130,72],[112,90],[112,200]]},                                               // AGENTIC.BAT
];
// The structures' footprints (centre, half extents along the facade and away from the door, door yaw):
// pins stub out of their walls like a chip's legs.
const CHIPS:{x:number;z:number;yaw:number;hw:number;hd:number;door:P}[]=[
 {x:17,z:8.1,yaw:Math.PI,hw:9,hd:8,door:[17,.1]},
 {x:2.6+.682*11,z:-200.1-.731*11,yaw:-223*Math.PI/180+Math.PI,hw:18,hd:11,door:[2.6,-200.1]},
 {x:-150.2-.906*13,z:2.5+.423*13,yaw:-65*Math.PI/180+Math.PI,hw:20,hd:13,door:[-150.2,2.5]},
 {x:143.5+.5*13,z:86.7+.866*13,yaw:-330*Math.PI/180+Math.PI,hw:13,hd:13,door:[143.5,86.7]},
];

function rng(seed:number){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const px=(x:number)=>(x-TRACE_TEX.minX)/TRACE_TEX.size*TRACE_TEX.n,pz=(z:number)=>(z-TRACE_TEX.minZ)/TRACE_TEX.size*TRACE_TEX.n,m=TRACE_TEX.n/TRACE_TEX.size;

/** Parallel lanes of a polyline (mitred at each bend). */
function lanes(path:P[],count:number,spacing:number):P[][]{
 const out:P[][]=[];
 for(let k=0;k<count;k++){
  const off=(k-(count-1)/2)*spacing,lane:P[]=[];
  for(let i=0;i<path.length;i++){
   const a=path[Math.max(0,i-1)],b=path[i],c=path[Math.min(path.length-1,i+1)];
   const n1=norm(b[0]-a[0],b[1]-a[1]),n2=norm(c[0]-b[0],c[1]-b[1]);
   const d1:P=i?n1:n2,d2:P=i<path.length-1?n2:n1;
   let nx=-(d1[1]+d2[1]),nz=d1[0]+d2[0];const l=Math.hypot(nx,nz)||1;nx/=l;nz/=l;
   const miter=1/Math.max(.5,nx*-d1[1]+nz*d1[0]);
   lane.push([b[0]+nx*off*miter,b[1]+nz*off*miter]);
  }
  out.push(lane);
 }
 return out;
}
function norm(x:number,z:number):P{const l=Math.hypot(x,z)||1;return [x/l,z/l];}
function stroke(g:CanvasRenderingContext2D,line:P[],width:number){g.lineWidth=width*m;g.beginPath();line.forEach(([x,z],i)=>i?g.lineTo(px(x),pz(z)):g.moveTo(px(x),pz(z)));g.stroke();}
function via(g:CanvasRenderingContext2D,[x,z]:P,r:number){g.beginPath();g.arc(px(x),pz(z),r*m,0,Math.PI*2);g.fill();}

/** A trace: a soft halo under a crisp core. The shader reads the core by threshold and the halo as glow; a
 * trace drawn at strength .55 only shows once the threshold drops (after 3), a full-strength one from after 2. */
function trace(g:CanvasRenderingContext2D,line:P[],colour:string,strength=1){
 g.strokeStyle=g.fillStyle=colour;g.globalAlpha=.15*strength;stroke(g,line,1.5);g.globalAlpha=strength;stroke(g,line,.45);g.globalAlpha=1;
}
/** A bus: its middle lane from after 2, all of them from after 3. */
function bus(g:CanvasRenderingContext2D,i:number,colour:string){
 const b=BUSES[i];lanes(b.path,b.lanes,1.6).forEach((lane,k)=>{const strength=k===(b.lanes-1)>>1?1:.55;trace(g,lane,colour,strength);g.globalAlpha=strength;via(g,lane[0],.42);g.globalAlpha=1;});
}
function chip(g:CanvasRenderingContext2D,i:number,colour:string,seed:number){
 const c=CHIPS[i],r=rng(seed),side:P=[Math.cos(c.yaw),-Math.sin(c.yaw)],out:P=[Math.sin(c.yaw),Math.cos(c.yaw)];
 // pins along all four walls, each a short stub with a via, a few doglegged at 45 degrees
 // [along the wall, its half length, out of the wall, the wall's distance from the centre]
 for(const [ax,az,half,nx,nz,wall] of [[side[0],side[1],c.hw,out[0],out[1],c.hd],[side[0],side[1],c.hw,-out[0],-out[1],c.hd],[out[0],out[1],c.hd,side[0],side[1],c.hw],[out[0],out[1],c.hd,-side[0],-side[1],c.hw]]){
  for(let s=-half+1.5;s<=half-1.5;s+=2.2+r()*1.6){
   const x0=c.x+ax*s+nx*(wall+.4),z0=c.z+az*s+nz*(wall+.4);
   if(Math.hypot(x0-c.door[0],z0-c.door[1])<4)continue; // the doorway stays clear
   const len=2+r()*6,line:P[]=[[x0,z0],[x0+nx*len,z0+nz*len]];
   if(r()<.35){const t=r()<.5?1:-1,k=1.5+r()*3;line.push([line[1][0]+(nx+ax*t)*k*.707,line[1][1]+(nz+az*t)*k*.707]);}
   trace(g,line,colour);via(g,line[line.length-1],.38);
  }
 }
}
/** A struck-screen crack network out of one impact point: jagged rays that branch, plus broken rings near it. */
function cracks(g:CanvasRenderingContext2D,[cx,cz]:P,colour:string,seed:number,rays:number,reach:number,fan:[number,number]){
 const r=rng(seed);g.strokeStyle=colour;g.globalAlpha=1;g.lineCap='round';
 const ray=(x:number,z:number,a:number,len:number,w:number,depth:number)=>{
  let travelled=0;
  while(travelled<len){
   const seg=2.5+r()*6;a+=(r()-.5)*.7;const nx=x+Math.cos(a)*seg,nz=z+Math.sin(a)*seg;
   g.lineWidth=Math.max(.14,w*(1-travelled/len))*m;g.beginPath();g.moveTo(px(x),pz(z));g.lineTo(px(nx),pz(nz));g.stroke();
   if(depth<2&&r()<.09)ray(nx,nz,a+(r()<.5?1:-1)*(.5+r()*.6),(len-travelled)*(.3+r()*.4),w*.6,depth+1);
   x=nx;z=nz;travelled+=seg;
  }
 };
 for(let i=0;i<rays;i++){const a=fan[0]+(fan[1]-fan[0])*(i+.2+r()*.6)/rays;ray(cx,cz,a,reach*(.45+r()*.55),.62,0);}
 for(const ring of [7,15,27]){
  for(let a=0;a<Math.PI*2;){const span=.25+r()*.6,gap=.15+r()*.5;g.lineWidth=.3*m;g.beginPath();
   for(let t=0;t<=1;t+=.1){const rr=ring*(1+(r()-.5)*.06),aa=a+span*t;t?g.lineTo(px(cx+Math.cos(aa)*rr),pz(cz+Math.sin(aa)*rr)):g.moveTo(px(cx+Math.cos(aa)*rr),pz(cz+Math.sin(aa)*rr));}
   g.stroke();a+=span+gap;}
 }
}
function canvasLayer(draw:(g:CanvasRenderingContext2D)=>void){
 const c=document.createElement('canvas');c.width=c.height=TRACE_TEX.n;const g=c.getContext('2d')!;
 g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';draw(g);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
 t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;return t;
}
/** A: CONTROL.EXE, HAL3000.SYS, MEG3N.AVI traces in r, g, b. B: AGENTIC.BAT's in r, the summit's cracks in g,
 * the south's (out of the gate, where the MCP stands) in b. */
export function traceTextures(){
 const colours=['#f00','#0f0','#00f'];
 const a=canvasLayer(g=>{for(let i=0;i<3;i++){bus(g,i,colours[i]);chip(g,i,colours[i],101+i*17);}});
 const b=canvasLayer(g=>{bus(g,3,'#f00');chip(g,3,'#f00',152);
  cracks(g,[SUMMIT.x,SUMMIT.z],'#0f0',77,11,330,[0,Math.PI*2]);
  cracks(g,[TRON_GATE.x,TRON_GATE.z],'#00f',91,9,320,[-Math.PI*.92,-Math.PI*.08]);});
 return {a,b};
}

const f=(n:number)=>n.toFixed(4);
const rgb=(hex:number)=>{const c=new THREE.Color().setHex(hex,THREE.NoColorSpace);return `vec3(${f(c.r)},${f(c.g)},${f(c.b)})`;};
/** GLSL (needs NOISE_TEX_GLSL's nzL and uTime): tronField(p,lod) at world p, and tronFloor, the Grid's floor. */
export const TRON_GLSL=/* glsl */`
uniform sampler2D uTraceA,uTraceB;
uniform vec4 uCleared;  // per structure (CONTROL, HAL, MEG3N, AGENTIC): 0..1, eased in when it is cleared
uniform float uCorrupt; // levels cleared - 1: 0 (after 1, untouched) .. 3 (after 4), eased between stages
uniform float uTronMotion; // 0 with reduced motion: pulses and flicker hold still
const vec3 TRON_LINE=${rgb(TRON.line)};
const vec3 TRON_CORE=${rgb(TRON.core)};
const vec3 TRON_FLOOR=${rgb(TRON.floor)};
const vec2 TRON_GATE=vec2(${f(TRON_GATE.x)},${f(TRON_GATE.z)});
const vec2 TRON_SUMMIT=vec2(${f(SUMMIT.x)},${f(SUMMIT.z)});
struct Tron{
  float line;  // a trace's crisp core (the grass along it lights up)
  float glow;  // its light: core and halo, brighter each stage, pulsing south after 4
  float crack; // a crack in the wallpaper (the grass is gone along it)
  float peel;  // a 4 m tile of wallpaper gone: the Grid's floor shows
  float loose; // a tile about to go: it flickers
};
Tron tronField(vec2 p,float lod){
  Tron t=Tron(0.,0.,0.,0.,0.);
  if(uCorrupt<=.001)return t;
  vec2 uv=(p-vec2(${f(TRACE_TEX.minX)},${f(TRACE_TEX.minZ)}))/${f(TRACE_TEX.size)};
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return t;
  vec4 a=textureLod(uTraceA,uv,lod),b=textureLod(uTraceB,uv,lod);
  float c1=clamp(uCorrupt,0.,1.),c2=clamp(uCorrupt-1.,0.,1.),c3=clamp(uCorrupt-2.,0.,1.);
  float tr=max(max(a.r*uCleared.x,a.g*uCleared.y),max(a.b*uCleared.z,b.r*uCleared.w));
  float th=.84-.32*c2;
  t.line=smoothstep(th,th+.08,tr)*c1;
  float pulse=pow(fract(length(p-TRON_GATE)/26.+uTime*uTronMotion*.42),9.)*(c2*.5+c3*1.5);
  t.glow=(t.line+tr*.3)*(.55+.25*c2+.4*c3+pulse)*c1;
  // the hill cracks from the summit outward, then from the south (the gate) up to meet it
  float rs=32.*c1+88.*c2+300.*c3,rg=70.*c2+260.*c3;
  float crack=max(b.g*smoothstep(rs,rs-14.,length(p-TRON_SUMMIT)),b.b*smoothstep(rg,rg-14.,length(p-TRON_GATE)));
  t.crack=smoothstep(.35,.8,crack);
  // wallpaper tiles (the Grid's 4 m cells) fall out, more toward the south
  vec2 cell=floor(p/4.)+.5;
  float n=nzL(cell*4./30.+vec2(3.7,1.3)).g*.75+nzL(cell*.53+vec2(.3,5.1)).b*.25;
  float south=1.-smoothstep(0.,300.,length(p-TRON_GATE));
  float tp=1.05-.13*c2-.2*c3-.12*south*(c2+c3);
  t.peel=step(tp,n);t.loose=step(tp-.03,n)*(1.-t.peel)*c2;
  return t;
}
// a tile about to fall out blinks (per 4 m cell)
float tronFlicker(vec2 p){return step(.5,fract(sin(dot(floor(p/4.),vec2(12.9,78.2))+floor(uTime*uTronMotion*7.))*437.5));}
// The Grid under the wallpaper: near-black floor, 4 m minor and 16 m major lines (aw: line antialias width, m)
vec3 tronFloor(vec2 p,float aw){
  vec2 q4=abs(fract(p/4.+.5)-.5)*4.,q16=abs(fract(p/16.+.5)-.5)*16.;
  float minor=1.-smoothstep(.05,.05+aw,min(q4.x,q4.y)),major=1.-smoothstep(.09,.09+aw*1.5,min(q16.x,q16.y));
  return TRON_FLOOR+TRON_LINE*(minor*.55*(1.-smoothstep(.2,1.,aw))+major*.95);
}`;
