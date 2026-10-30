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
// One bus per structure: from just outside its door, octilinear (45 degree) bends, ending past the gate. Where two run
// side by side their middle lanes stay 8 m+ apart (2026-10-30: HAL's and MEG3N's diagonals used to interleave with
// CONTROL's lanes, so cores merged and one bus's light took the other's arc length).
const BUSES:{lanes:number;path:P[]}[]=[
 {lanes:5,path:[[17,-1],[17,-6],[23,-12],[36,-12],[44,-4],[44,40],[64,60],[64,200]]},                     // CONTROL.EXE
 {lanes:5,path:[[.6,-197.9],[18,-182],[30,-170],[30,-60],[52,-38],[52,36],[80,64],[80,200]]},             // HAL3000.SYS
 {lanes:5,path:[[-146,.5],[-132,14.5],[-10,14.5],[14,38.5],[30,38.5],[48,56.5],[48,200]]},               // MEG3N.AVI
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
const N=TRACE_TEX.n,HALO=1.05; // HALO: how far a trace's light reaches past its core's edge (m)
const ARC_PAD=5; // the arc record reaches this much further, so a far mip's blur of the mask still finds its own bus's (m)
/** The masks hold a distance-like profile, not a painted stroke (2026-10-30: a thresholded stroke read as jagged teal
 * paint). By distance past a core's edge (m): rising to 1 by .25 m inside the edge, .7 at the edge on a straight ramp (so the shader can
 * cut a crisp antialiased core at any range), then a soft glow falling off to 0 at HALO. */
const profile=(e:number)=>e<=-.25?1:e<=.15?.7-e*1.2:e<HALO?.52*((HALO-e)/(HALO-.15))**2:0;
// near, arc: the bus being drawn's nearest piece per texel (1/32 m) and its record; traceTextures merges them bus by bus
type Masks={a:Uint8Array;b:Uint8Array;near:Uint8Array;arc:Uint16Array;hit:Int32Array;hits:number};
type Arc={s0:number;s1?:number;late:boolean};
/** One straight piece of trace (a=b: a via's dot), core half width h, max-blended into a mask channel. With arc, the
 * texels it is nearest to (out to ARC_PAD past its light) also record its arc length from the door (s0 at a, s1 at b,
 * 1/32 m) and whether it is late: a side lane or a pin, which shows only from after 3. */
function piece(M:Masks,mask:Uint8Array,ch:number,a:P,b:P,h:number,arc?:Arc){
 const r=h+HALO,R=arc?r+ARC_PAD:r,dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,len=Math.sqrt(l2);
 const i0=Math.max(0,Math.floor(px(Math.min(a[0],b[0])-R))),i1=Math.min(N-1,Math.ceil(px(Math.max(a[0],b[0])+R)));
 const j0=Math.max(0,Math.floor(pz(Math.min(a[1],b[1])-R))),j1=Math.min(N-1,Math.ceil(pz(Math.max(a[1],b[1])+R)));
 for(let j=j0;j<=j1;j++){const z=TRACE_TEX.minZ+(j+.5)/m;
  for(let i=i0;i<=i1;i++){const x=TRACE_TEX.minX+(i+.5)/m;
   const u=l2?Math.min(1,Math.max(0,((x-a[0])*dx+(z-a[1])*dz)/l2)):0,ex=x-a[0]-u*dx,ez=z-a[1]-u*dz,d=Math.sqrt(ex*ex+ez*ez);
   if(d>=R)continue;
   const k=j*N+i,q=Math.round(d*32);
   if(d<r){const v=Math.round(profile(d-h)*255);if(v>mask[k*4+ch])mask[k*4+ch]=v;}
   if(arc&&q<M.near[k]){if(M.near[k]===255)M.hit[M.hits++]=k;M.near[k]=q;M.arc[k]=Math.min(32766,Math.round((arc.s0+u*((arc.s1??arc.s0+len)-arc.s0))*32))|(arc.late?32768:0);}
  }
 }
}
/** Arc length at each vertex of a polyline. */
const arcs=(path:P[])=>path.reduce((a:number[],p,i)=>[...a,i?a[i-1]+Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1]):0],[]);
const pathLength=(path:P[])=>arcs(path)[path.length-1];
/** A polyline of pieces, arc length s at its vertices (a bus's lanes all take its centre line's, so the rez-in front and
 * the packets run abreast instead of the outer lanes lagging round the bends). Returns the arc length at its end. */
function trace(M:Masks,ch:number,line:P[],h:number,late:boolean,s=arcs(line)){
 for(let i=1;i<line.length;i++)piece(M,M.a,ch,line[i-1],line[i],h,{s0:s[i-1],s1:s[i],late});
 return s[line.length-1];
}
/** Each bus's middle lane, door to past the gate (m): how far its rez-in runs. */
export const BUS_LEN=BUSES.map(b=>pathLength(b.path));
/** A bus: its middle lane from after 2, all of them from after 3, each with a via at the door end. */
function bus(M:Masks,i:number){
 const b=BUSES[i];lanes(b.path,b.lanes,1.6).forEach((lane,k)=>{const late=k!==(b.lanes-1)>>1;piece(M,M.a,i,lane[0],lane[0],.34,{s0:0,late});trace(M,i,lane,.18,late,arcs(b.path));});
}
function chip(M:Masks,i:number,seed:number){
 const c=CHIPS[i],r=rng(seed),side:P=[Math.cos(c.yaw),-Math.sin(c.yaw)],out:P=[Math.sin(c.yaw),Math.cos(c.yaw)];
 // pins along all four walls, each a short stub with a via, a few doglegged at 45 degrees
 // [along the wall, its half length, out of the wall, the wall's distance from the centre]
 for(const [ax,az,half,nx,nz,wall] of [[side[0],side[1],c.hw,out[0],out[1],c.hd],[side[0],side[1],c.hw,-out[0],-out[1],c.hd],[out[0],out[1],c.hd,side[0],side[1],c.hw],[out[0],out[1],c.hd,-side[0],-side[1],c.hw]]){
  for(let s=-half+1.5;s<=half-1.5;s+=2.2+r()*1.6){
   const x0=c.x+ax*s+nx*(wall+.4),z0=c.z+az*s+nz*(wall+.4);
   if(Math.hypot(x0-c.door[0],z0-c.door[1])<4)continue; // the doorway stays clear
   const len=2+r()*6,line:P[]=[[x0,z0],[x0+nx*len,z0+nz*len]];
   if(r()<.35){const t=r()<.5?1:-1,k=1.5+r()*3;line.push([line[1][0]+(nx+ax*t)*k*.707,line[1][1]+(nz+az*t)*k*.707]);}
   const end=trace(M,i,line,.17,true);piece(M,M.a,i,line[line.length-1],line[line.length-1],.32,{s0:end,late:true});
  }
 }
}
/** A struck-screen crack network out of one impact point: jagged rays that branch, plus broken rings near it. */
function cracks(M:Masks,ch:number,[cx,cz]:P,seed:number,rays:number,reach:number,fan:[number,number]){
 const r=rng(seed);
 const ray=(x:number,z:number,a:number,len:number,w:number,depth:number)=>{
  let travelled=0;
  while(travelled<len){
   const seg=2.5+r()*6;a+=(r()-.5)*.7;const nx=x+Math.cos(a)*seg,nz=z+Math.sin(a)*seg;
   piece(M,M.b,ch,[x,z],[nx,nz],Math.max(.07,w*(1-travelled/len)*.4));
   if(depth<2&&r()<.09)ray(nx,nz,a+(r()<.5?1:-1)*(.5+r()*.6),(len-travelled)*(.3+r()*.4),w*.6,depth+1);
   x=nx;z=nz;travelled+=seg;
  }
 };
 for(let i=0;i<rays;i++){const a=fan[0]+(fan[1]-fan[0])*(i+.2+r()*.6)/rays;ray(cx,cz,a,reach*(.45+r()*.55),.62,0);}
 for(const ring of [7,15,27]){
  for(let a=0;a<Math.PI*2;){const span=.25+r()*.6,gap=.15+r()*.5;let last:P|null=null;
   for(let t=0;t<=1;t+=.1){const rr=ring*(1+(r()-.5)*.06),aa=a+span*t,p:P=[cx+Math.cos(aa)*rr,cz+Math.sin(aa)*rr];if(last)piece(M,M.b,ch,last,p,.08);last=p;}
   a+=span+gap;}
 }
}
function maskTexture(data:Uint8Array){
 const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat,THREE.UnsignedByteType);t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
 t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;
}
/** A: the CONTROL.EXE, HAL3000.SYS, MEG3N.AVI and AGENTIC.BAT traces in r, g, b, a. B: the summit's cracks in r, the
 * south's (out of the gate, where the MCP stands) in g, and in b,a an arc record (read unfiltered): the arc length and
 * late flag of the bus whose light is brightest there (nearest, where none lights it), 0x7fff where no bus reaches. */
export function traceTextures(){
 const M:Masks={a:new Uint8Array(N*N*4),b:new Uint8Array(N*N*4),near:new Uint8Array(N*N).fill(255),arc:new Uint16Array(N*N),hit:new Int32Array(N*N),hits:0};
 const win=new Uint8Array(N*N).fill(4),best=new Uint8Array(N*N).fill(255);
 for(let k=0;k<N*N;k++){M.b[k*4+2]=127;M.b[k*4+3]=255;}
 for(let i=0;i<4;i++){bus(M,i);chip(M,i,[101,118,135,152][i]);
  // one record per bus first, then per texel the bus that lights it most (a shared nearest-piece record let a bus
  // beside another take its arc length and late flag, cutting the other's halo and running its packets out of phase)
  for(let h=0;h<M.hits;h++){const k=M.hit[h],q=M.near[k];M.near[k]=255;
   const v=M.a[k*4+i],w=win[k]<4?M.a[k*4+win[k]]:-1;
   if(v>w||(v===w&&q<best[k])){win[k]=i;best[k]=q;M.b[k*4+2]=M.arc[k]>>8;M.b[k*4+3]=M.arc[k]&255;}}
  M.hits=0;
 }
 cracks(M,0,[SUMMIT.x,SUMMIT.z],77,11,330,[0,Math.PI*2]);
 cracks(M,1,[TRON_GATE.x,TRON_GATE.z],91,9,320,[-Math.PI*.92,-Math.PI*.08]);
 return {a:maskTexture(M.a),b:maskTexture(M.b)};
}

/** OUT_GLSL's dusk tint (doom-meadow-shared.ts), which the terrain and grass undo on the Tron light: keep the two in step. */
export const TRON_DUSK_GLSL='const vec3 TRON_DUSK=vec3(.70,.74,.92);';
const f=(n:number)=>n.toFixed(4);
const rgb=(hex:number)=>{const c=new THREE.Color().setHex(hex,THREE.NoColorSpace);return `vec3(${f(c.r)},${f(c.g)},${f(c.b)})`;};
/** GLSL (needs NOISE_TEX_GLSL's nzL and uTime): tronField(p,dx,dy,aa) at world p (dx, dy: a pixel's footprint in
 * metres; aa: the core's antialias width in mask units), tronEmit (the light it gives off) and tronFloor, the Grid. */
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
const vec4 TRON_BUS_LEN=vec4(${BUS_LEN.map(f).join(',')});
${TRON_DUSK_GLSL}
struct Tron{
  float line;  // a trace's crisp core (burns white)
  float halo;  // its light falling off round it: the mask's profile, 0..1 (the grass is mown short in it)
  float glow;  // how bright it burns: more each stage, and after 4 packets run down each bus to the gate
  float crack; // a crack's core (the grass is gone along it)
  float crackGlow; // how bright the cracks burn
  float peel;  // a 4 m tile of wallpaper gone: the Grid's floor shows
  float loose; // a tile about to go: it flickers
  float tr,cr,far; // raw trace and crack masks; 0..1 as they blur with distance
};
// the cores from the raw masks (cut at .7, the cores' edge; a core under ~.35 m would bead at 45 degrees on the
// .25 m texels); the terrain calls it again with fwidth for a 1 px edge
void tronEdges(inout Tron t,float aaT,float aaC){
  t.line=mix(smoothstep(.7-aaT,.7+aaT,t.tr),t.tr*.45,t.far);
  t.crack=mix(smoothstep(.6-aaC,.78+aaC,t.cr),t.cr*.45,t.far); // (softer: thin cracks taper below .35 m)
}
Tron tronField(vec2 p,vec2 dx,vec2 dy,float aa){
  Tron t=Tron(0.,0.,0.,0.,0.,0.,0.,0.,0.,0.);
  if(uCorrupt<=.001)return t;
  vec2 uv=(p-vec2(${f(TRACE_TEX.minX)},${f(TRACE_TEX.minZ)}))/${f(TRACE_TEX.size)};
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return t;
  // gradient sampling keeps the anisotropic filter, so a trace seen at a grazing angle stays a line
  vec2 gx=dx/${f(TRACE_TEX.size)},gy=dy/${f(TRACE_TEX.size)};
  vec4 a=textureGrad(uTraceA,uv,gx,gy);vec2 b=textureGrad(uTraceB,uv,gx,gy).rg;
  float lx=length(dx),ly=length(dy),lmax=max(lx,ly);
  t.far=smoothstep(.5,2.,log2(lmax/min(lmax/max(min(lx,ly),1e-5),8.)/.25));
  float c1=clamp(uCorrupt,0.,1.),c2=clamp(uCorrupt-1.,0.,1.),c3=clamp(uCorrupt-2.,0.,1.);
  // the nearest trace texel: its arc length from the door, and whether it shows only from after 3
  vec2 sb=floor(texelFetch(uTraceB,ivec2(min(uv*${f(TRACE_TEX.n)},${f(TRACE_TEX.n-1)})),0).ba*255.+.5);
  float late=step(128.,sb.x),code=(sb.x-late*128.)*256.+sb.y,none=step(32766.5,code),s=code/32.;
  // each bus draws itself out of its door as its structure clears (2026-10-30), its head burning brighter; a texel no
  // record reaches (a far mip's blur) shows only once its bus is fully drawn, with no head or packets
  vec4 sv=mix(vec4(s),mix(vec4(1e4),vec4(-1e4),step(vec4(.999),uCleared)),none);
  vec4 front=uCleared*(TRON_BUS_LEN+12.)-6.;
  vec4 on=a*step(.001,uCleared)*(1.-smoothstep(front-4.,front,sv));
  vec4 head=on*(1.-smoothstep(0.,14.,front-sv))*step(uCleared,vec4(.999));
  // late (side lanes, pins) stay out until after 3 at any range; far off the middle lane's blur takes in its dark
  // neighbours' texels, so it is dimmed a little instead
  t.tr=max(max(on.r,on.g),max(on.b,on.a))*mix(1.,c2,late)*mix(1.,.6,t.far*(1.-c2))*c1;
  t.halo=t.tr*t.tr;
  float pulse=pow(fract(s/26.-uTime*uTronMotion*.42),12.)*(c2*.3+c3*1.5)*(1.-none);
  float bright=(.6+.25*c2+.45*c3)*c1;
  t.glow=bright+pulse*c1+max(max(head.r,head.g),max(head.b,head.a))*1.5;
  // the hill cracks from the summit outward, then from the south (the gate) up to meet it
  float rs=32.*c1+88.*c2+300.*c3,rg=70.*c2+260.*c3;
  t.cr=max(b.r*(1.-smoothstep(rs-14.,rs,length(p-TRON_SUMMIT))),b.g*(1.-smoothstep(rg-14.,rg,length(p-TRON_GATE))));
  t.crackGlow=bright;
  tronEdges(t,aa,aa);
  // wallpaper tiles (the Grid's 4 m cells) fall out, more toward the south
  vec2 cell=floor(p/4.)+.5;
  float n=nzL(cell*4./30.+vec2(3.7,1.3)).g*.75+nzL(cell*.53+vec2(.3,5.1)).b*.25;
  float south=1.-smoothstep(0.,300.,length(p-TRON_GATE));
  float tp=1.05-.13*c2-.2*c3-.12*south*(c2+c3);
  t.peel=step(tp,n);t.loose=step(tp-.03,n)*(1.-t.peel)*c2;
  return t;
}
// The light a trace or crack gives off, before tronLight: a cyan halo and a core that burns toward white.
vec3 tronEmit(Tron t){
  float hot=mix(smoothstep(.6,1.,t.tr),1.,t.far),hotC=mix(smoothstep(.6,1.,t.cr),1.,t.far); // the cores' white-hot middles (a wide window: a narrow one bands on 45 degree runs)
  return TRON_LINE*(t.halo*t.glow*.75+t.line*t.glow*.9+t.cr*t.cr*t.crackGlow*.8+t.crack*t.crackGlow*.7)+TRON_CORE*(t.line*(.55+.45*hot)*t.glow*1.3+t.crack*(.55+.45*hotC)*t.crackGlow*1.1);
}
// soft clip: a bright core saturates to white, the halo falls off smoothly (no bloom: the meadow has none)
vec3 tronLight(vec3 e){return (1.-exp(-e*1.6))*1.15;}
// a tile about to fall out blinks (per 4 m cell)
float tronFlicker(vec2 p){return step(.5,fract(sin(dot(floor(p/4.),vec2(12.9,78.2))+floor(uTime*uTronMotion*7.))*437.5));}
// The Grid under the wallpaper: near-black floor, 4 m minor and 16 m major lines (aw: line antialias width, m)
vec3 tronFloor(vec2 p,float aw){
  vec2 q4=abs(fract(p/4.+.5)-.5)*4.,q16=abs(fract(p/16.+.5)-.5)*16.;
  float minor=1.-smoothstep(.05,.05+aw,min(q4.x,q4.y)),major=1.-smoothstep(.09,.09+aw*1.5,min(q16.x,q16.y));
  return TRON_FLOOR+TRON_LINE*(minor*.55*(1.-smoothstep(.2,1.,aw))+major*.95);
}`;
