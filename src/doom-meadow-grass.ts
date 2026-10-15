import * as THREE from 'three';
import {meadowGroundY} from './doom-meadow-ground';
import {meadowUniforms,MEADOW_COMMON_GLSL,OUT_GLSL} from './doom-meadow-shared';

/* The meadow's blades live in world-anchored square tiles (so they never slide
 * with the camera) at three tile sizes. Every tile of a level draws a prefix of
 * one shared, rank-sorted blade table, so a far tile's blades are always a subset
 * of the same tile's blades seen up close: walking forward only ever ADDS blades
 * (they widen in from nothing). Blade height never depends on camera distance, so
 * nothing shrinks, flattens or rings around the player.
 *
 * Target density falls with distance as rho(d)=RHO_MAX*min(1,D0/d)^K. Each level
 * owns one horizontal slice of that curve: level A (fine blades) the dense part
 * near the player, B the middle, C (2-segment blades) the thin far part out to the
 * crest. Because C's slice is present everywhere inside its radius, near ⊇ far holds
 * across levels too. Thinned blades get wider so coverage stays even, and their
 * colour converges on the terrain sward with distance, so the field melts into the
 * hill with no seam.
 *
 * Drawing: one instanced draw per level. An instance is a chunk of CHUNK blades of
 * one tile (many blades per instance; tiny instances are slow on Apple/ANGLE). Each
 * frame the CPU frustum-culls the tiles, sorts them near-first and writes one
 * (tile origin, first blade) entry per chunk; the vertex shader fetches its blade
 * from the level's table texture. */

type Level={tile:number;segs:number;chunk:number;radius:number;fadeStart:number;fadeEnd:number;width:number};
type Density={rhoMax:number;d0:number;k:number};
const TABLE_W=256;

/** CHUNK copies of one blade: position = (side -1..1, t 0..1 along the leaf, slot in chunk). */
function chunkGeometry(segs:number,chunk:number):{position:THREE.BufferAttribute;index:THREE.BufferAttribute} {
  const pos:number[]=[],idx:number[]=[];
  const nv=segs*2+1;
  for(let k=0;k<chunk;k++){
    const o=k*nv;
    for(let i=0;i<segs;i++){const t=i/segs;pos.push(-1,t,k,1,t,k);}
    pos.push(0,1,k);
    for(let i=0;i<segs-1;i++){const a=o+i*2;idx.push(a,a+1,a+2,a+2,a+1,a+3);}
    idx.push(o+(segs-1)*2,o+(segs-1)*2+1,o+segs*2);
  }
  return {position:new THREE.Float32BufferAttribute(pos,3),index:new THREE.Uint16BufferAttribute(idx,1)};
}

/** Clumped blade positions in one tile, sorted by a random rank so any prefix is
 * an even random subset. x,z in [0,1) tile units, z = rank, w = random seed. */
function bladeTable(count:number,tile:number,seed:number):THREE.DataTexture {
  let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  const rows:[number,number,number,number][]=[];
  while(rows.length<count){
    const cx=rnd()*tile,cz=rnd()*tile,n=1+Math.floor(rnd()*6),spread=.04+rnd()*.09;
    for(let k=0;k<n&&rows.length<count;k++){
      const a=rnd()*Math.PI*2,r=spread*Math.sqrt(rnd());
      const x=((cx+Math.cos(a)*r)%tile+tile)%tile,z=((cz+Math.sin(a)*r)%tile+tile)%tile;
      rows.push([x/tile,z/tile,rnd(),rnd()]);
    }
  }
  rows.sort((a,b)=>a[2]-b[2]);
  const h=Math.ceil(count/TABLE_W),data=new Float32Array(TABLE_W*h*4);
  rows.forEach((r,i)=>{data[i*4]=r[0];data[i*4+1]=r[1];data[i*4+2]=(i+.5)/count;data[i*4+3]=r[3];});
  const t=new THREE.DataTexture(data,TABLE_W,h,THREE.RGBAFormat,THREE.FloatType);
  t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;
  return t;
}

const BLADE_VERTEX=/* glsl */`
attribute vec3 aChunk;               // tile origin x,z; index of the chunk's first blade
uniform highp sampler2D uTable;
uniform vec4 uToys[9]; // world x/z, footprint radius, ground contact
uniform int uCount;
uniform float uTile,uRhoHi,uRhoLo,uFadeStart,uFadeEnd,uWidth,uRhoMax,uD0,uK;
varying vec3 vBase,vN,vGlow,vAdd,vK;
varying vec4 vNG;
varying float vSd;
vec2 symm(vec2 p,float h){ // one of the 8 symmetries of the unit square, per tile
  if(h<.5)p=p.yx;
  if(fract(h*2.)>.5)p.x=1.-p.x;
  if(fract(h*4.)>.5)p.y=1.-p.y;
  return p;
}
void hide(){gl_Position=vec4(0.,0.,2.,1.);vBase=vN=vGlow=vAdd=vK=vec3(0.);vNG=vec4(0.);vSd=0.;}
// Tufts: blades gather toward world tuft centres ~0.46 m apart (jittered centres on a
// grid turned off the world axes) and fan out from them a little, so neighbours never
// lean quite the same way while the field still reads as one combed sweep.
const float TUFT=.46;
const mat2 TUFT_R=mat2(.8,.6,-.6,.8);
void main(){
  int idx=int(aChunk.z+.5)+int(position.z+.5);
  if(idx>=uCount){hide();return;}
  vec4 B=texelFetch(uTable,ivec2(idx&${TABLE_W-1},idx>>${Math.log2(TABLE_W)}),0);
  vec2 origin=aChunk.xy;
  vec2 tid=floor(origin/uTile+.5);
  vec2 lp=fract(symm(B.xy,hash12(tid*1.37+.5))+vec2(hash12(tid+17.31),hash12(tid+41.7)));
  vec2 base=origin+lp*uTile;
  // nearest of the four jittered centres around this point (a cheap Voronoi), so
  // tuft outlines are organic and never line up into rows
  vec2 tq=TUFT_R*base/TUFT,tc=floor(tq),sq=sign(fract(tq)-.5);
  vec2 ctr=vec2(0.),cell=tc;float best=9.;
  for(int k=0;k<4;k++){
    vec2 cc=tc+vec2(k==1||k==3?sq.x:0.,k>=2?sq.y:0.);
    vec2 cp=cc+.5+(vec2(hash12(cc+3.7),hash12(cc+11.9))-.5)*.8;
    float dd=dot(tq-cp,tq-cp);if(dd<best){best=dd;ctr=cp;cell=cc;}
  }
  // (no tufting on the short trodden apron outside the door: short grass can't hide the gaps)
  float trod0=1.-smoothstep(0.,1.5,length(max(abs(base-vec2(17.,-3.3))-vec2(1.7,2.5),0.)));
  vec2 toff=(tq-ctr)*mix(.90,1.,trod0);
  base=(ctr+toff)*TUFT_R*TUFT;                      // (row-vector product = inverse rotation)
  vec2 offW=(toff*TUFT_R)*TUFT;                       // offset from the tuft centre, world metres
  float rim=clamp(length(toff)/.45,0.,1.);            // 0 at the tuft core, 1 at its rim
  float d=length(base-uCam.xz);
  float rho=uRhoMax*pow(min(1.,uD0/max(d,.001)),uK)*(1.-smoothstep(uFadeStart,uFadeEnd,d));
  float f=(rho-uRhoLo)/(uRhoHi-uRhoLo);
  float u=B.z;
  // density thinning: this blade exists while its rank is under the local density;
  // at the frontier it widens in from zero width (height is never touched).
  float vis=clamp((f-u)/(.35*u+.003),0.,1.);
  // the bunker and its foundation slab stay clear; the grass grows right up to the
  // slab with a ragged, soft margin (never a ruler-straight cut)
  vec2 fq=abs(base-vec2(17.,8.))-vec2(10.,9.);
  float edge=max(fq.x,fq.y);
  if(edge<1.2)vis*=smoothstep(0.,.8,edge+(nzL(base*1.3).r-.5)*.6-.1);
  if(vis<=0.){hide();return;}

  float r=B.w;
  float r2=hash11(r*713.1+1.3),r3=hash11(r*291.7+4.1),r4=hash11(r*937.3+7.7),r5=hash11(r*113.9+2.9),r6=hash11(r*57.3+9.1);
  float tufty=hash12(cell+23.1);
  vec4 nMid=nzL(base/2.6);                  // clump-scale variation
  vec4 nBig=nzL(base/30.+vec2(7.1,3.3));     // broad meadow patches (shared with the sward)
  vec3 G=groundAt(base);
  float h0=G.x;
  vec3 nG=normalize(vec3(-G.y,1.,-G.z));
  vec3 V=uCam-vec3(base.x,h0+.3,base.y);float dv=length(V);V/=dv;

  // grass right against the slab is a little shorter, and spills over its edge
  float mow=mix(.52,1.,smoothstep(0.,1.8,edge));
  // a trodden apron outside the door keeps the foundation and the live portal readable
  vec2 pp=max(abs(base-vec2(17.,-3.3))-vec2(1.7,2.5),0.);
  float trod=1.-smoothstep(0.,1.5,length(pp));
  // Only during the opening walk: a narrow worn track keeps the guide's body
  // readable without thinning the surrounding Windows meadow.
  float guidePath=uGuidePath*(1.-smoothstep(0.,.7,length(max(abs(base-vec2(17.,-17.))-vec2(1.1,12.),0.))));
  trod=max(trod,guidePath);mow*=1.-.45*guidePath;
  // ...and a lightly trampled patch where the rescued people gather (sprites stay readable)
  float gather=1.-smoothstep(.55,1.,length((base-vec2(17.,-7.7))/vec2(4.1,2.0)));
  // HAL's diagonal entrance and front gathering patch. Keep the surrounding
  // meadow lush; shorten only this worn approach so feet and doorway read.
  vec2 halDelta=base-vec2(2.6,-200.1);
  vec2 halLocal=vec2(dot(halDelta,vec2(-.731354,-.681998)),dot(halDelta,vec2(-.681998,.731354)));
  trod=max(trod,1.-smoothstep(0.,1.2,length(max(abs(halLocal-vec2(0.,2.))-vec2(1.5,2.),0.))));
  float halGather=1.-smoothstep(.6,1.,length((halLocal-vec2(0.,7.7))/vec2(4.1,2.2)));
  gather=max(gather,halGather);mow*=1.-.4*halGather;
  // silhouettes (crests, the far horizon line): the surviving blades there get chunkier
  // (width only; a blade's length never depends on where the camera is)
  float sil=(1.-smoothstep(.03,.16,dot(nG,V)))*smoothstep(18.,48.,d);
  float L=mix(.46,.92,r2*r2*.55+r2*.45)*(.90+.16*nBig.r)*(.86+.28*tufty)*mow*(1.-.52*trod)*(1.-.28*gather);
  // A solid toy presses down blades beneath its footprint. This follows the toy,
  // never the camera; full grass returns as soon as it leaves the ground.
  float pressed=0.;
  for(int toy=0;toy<9;toy++){
   vec2 delta=(base-uToys[toy].xy)/max(.1,uToys[toy].z);
   pressed=max(pressed,(1.-smoothstep(.50,1.,dot(delta,delta)))*uToys[toy].w);
  }
  L*=mix(1.,.12,pressed);
  float comp=clamp(pow(uRhoMax/max(rho,.01),.42),1.,2.5+3.5*sil);
  float w=uWidth*(.72+.56*r3)*comp*vis;

  // wind-combed: every leaf is laid over from the root along the wind (each with its
  // own azimuth, a little per clump, a gentle fan within the tuft) and the lie of the
  // grass (~9 m world patches combed slightly off the wind; world-anchored)
  float windA=atan(uWind.y,uWind.x);
  vec4 nLie=nzL(base/9.+vec2(2.7,6.1));
  float az=windA+(r4-.5)*.9+(nMid.g-.5)*.5+lieAngle(nLie.r)*.6;
  vec2 lv=vec2(cos(az),sin(az))+offW/TUFT*.45*(1.-trod);
  az=atan(lv.y,lv.x);
  // wind: broad, slow gust waves (~2-3 m/s) roll through the whole field; each blade
  // feels them with its own lag, so a wave is soft-edged and neighbours never move in
  // lockstep. Small independent per-blade flutter never stops.
  float g=gustField(base-uWind*(r3*1.6+tufty*1.0));
  float stir=.20+.80*g;                       // flutter is livelier inside a gust
  az+=(sin(uTime*(1.1+1.7*r3)+r*41.)*.026+sin(uTime*(2.6+2.1*r6)+r6*17.)*.009)*stir;
  vec2 lean=vec2(cos(az),sin(az));
  float flutter=(sin(uTime*(1.2+2.3*r2)+r*63.)*.032+sin(uTime*(3.0+2.6*r5)+r5*29.)*.011)*stir;
  // root tilt (the whole leaf is laid over) and a gentler bend toward the tip
  float beta=max(0.,.12+.62*r5*r5+.12*r5+lieFlat(nLie.g)*.45+.06*g+trod*.15+gather*.10-(1.-rim)*.08);
  float theta=clamp(.60+(r2-.5)*.50+(nMid.b-.5)*.40+.22*g+flutter,.06,max(.06,1.50-beta));
  // the leaf is a ribbon: its width lies in the bend plane (a sabre that sweeps over),
  // twisted about the spine by phi
  float phi=(r6-.5)*2.0;
  vec2 perpL=vec2(-lean.y,lean.x);

  float t=position.y,sd=position.x;
  float a=beta+theta*t;
  float ca=cos(a),sa=sin(a);
  float bx=L*(cos(beta)-ca)/theta,by=L*(sa-sin(beta))/theta;
  vec3 T=vec3(lean.x*sa,ca,lean.y*sa);
  vec3 W=cos(phi)*vec3(lean.x*ca,-sa,lean.y*ca)+sin(phi)*vec3(perpL.x,0.,perpL.y);
  float wt=w*sqrt(max(0.,1.-pow(t,1.35)));
  vec3 world=vec3(base.x,h0-.02,base.y)+vec3(lean.x*bx,by,lean.y*bx)+W*sd*wt;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);

  // stylised shading: dark root -> bright tip, per-blade and per-tuft value, a rounded
  // (cupped) leaf lit per pixel, ground-normal (dome volume) light, backlit glow
  vec3 N0=normalize(cross(W,T));
  vN=N0-W*sd*.62;                             // rounded across the leaf: the midrib faces N0
  float diffG=clamp(dot(nG,uSun)*.6+.4,0.,1.);
  float back=clamp(-dot(V,uSun),0.,1.);back*=back;
  float keep=1.-smoothstep(8.,30.,d);         // per-blade value variation: foreground only
  float own=1.-smoothstep(10.,25.,d);         // the leaf's own structure: dark root, occlusion, leaf body
  float mPatch=mix(nBig.g,.5,.7*smoothstep(50.,160.,d));
  float tint=mix(1.,(.84+.28*r4)*(.92+.16*tufty),keep)*clamp(1.+(mPatch-.5)*.3,.92,1.06);
  vec3 c=mix(G_ROOT,G_BODY,smoothstep(0.,.8,t));
  c=mix(c,G_TIP,smoothstep(.35,1.,t)*mix(.85,.66+.38*r2,keep));
  c*=tint;
  // a gust flips the leaves: a soft sheen travels with the wave (gentler up close)
  float gfar=smoothstep(10.,40.,d);
  float gk=g*t*(.85+.15*gfar);
  c=mix(c,G_SHEEN,gk*.42)*(1.+.10*gk);
  vec2 lieN=nLie.rg;
  float nap=napShade(lieN,V,d);
  c*=nap;
  // occlusion: roots and tuft cores sit in the canopy's shade (only while the leaf is
  // still drawn as a leaf)
  float ao=mix(.78,1.,smoothstep(0.,.8,t))*(1.-.12*(1.-rim)*(1.-t));
  c*=mix(1.,ao,own);
  float cs=cloudShadow(base)*(edge<4.?bunkerShade(base):1.);
  vBase=c*cs*mix(1.,.88,smoothstep(.1,.6,t)*own);
  // with distance a blade converges on exactly the sward's colour at its root (the same
  // albedo, light, nap, gust and cloud shade as the terrain there), so the blade field
  // and the hill under it have the same value: no band, no ring
  float conv=smoothstep(10.,32.,d);
  vec3 sw=vec3(0.);
  if(conv>0.){
    vec2 sp=vec2(dot(base,uWind),dot(base,vec2(-uWind.y,uWind.x)));
    float streak=.225+.55*mix(nzL(sp*vec2(.32,1.5)+vec2(3.,9.)).g,.5,smoothstep(25.,60.,d));
    sw=swardLight(swardAlbedo(streak,combFar(combStroke(base),d),mPatch),nG,V,cs)*nap;
    sw=mix(sw,G_SHEEN*cs,g*.16*gfar)*(1.+.06*g*gfar);
    sw*=.95+.10*t;                            // a hint of tip light keeps the far fur alive
  }
  float hz=atmosHaze(d);
  vGlow=(G_TIP*.26+vec3(.09,.06,0.))*back*t*cs; // sun behind the blades: glowing tips
  vAdd=(sw*conv+atmosLift(d))*(1.-hz)+HAZE*hz;
  vK=vec3((1.-conv)*(1.-hz),.53+.40*diffG,(.12+.88*back)*t*own);
  // leaves are lit more and more like the sward they melt into
  vNG=vec4(nG,smoothstep(8.,28.,d));
  vSd=sd*own;
}`;

const BLADE_FRAGMENT=/* glsl */`
uniform vec3 uSun;
varying vec3 vBase,vN,vGlow,vAdd,vK;
varying vec4 vNG;
varying float vSd;
void main(){
  vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;
  N=normalize(mix(N,vNG.xyz,vNG.w));
  float ndl=dot(N,uSun);
  float diff=clamp(ndl*.6+.4,0.,1.);
  // two-sided: a leaf lit from behind glows yellow-green through its body
  float trans=clamp(-ndl,0.,1.)*vK.z;
  // (with distance a leaf is lit exactly like the sward it melts into)
  vec3 lit=vBase*mix(vK.y+.36*diff+vec3(.42,.50,.12)*trans,vec3(.48+.56*diff),vNG.w)*(1.-.18*vSd*vSd)+vGlow;
  gl_FragColor=meadowOut(lit*vK.x+vAdd);
  #include <colorspace_fragment>
}`;

export type MeadowGrass={meshes:THREE.Mesh[];blades:number;group:THREE.Group;update:(camera:THREE.PerspectiveCamera)=>void;stats:()=>{chunks:number[];blades:number[]}};

export function makeMeadowGrass(coarse:boolean):MeadowGrass {
  const U=meadowUniforms();
  const density:Density=coarse?{rhoMax:340,d0:2.5,k:1.25}:{rhoMax:640,d0:2.5,k:1.25};
  const rho=(d:number)=>density.rhoMax*Math.pow(Math.min(1,density.d0/Math.max(d,1e-3)),density.k);
  const levels:Level[]=coarse?[
    {tile:4,segs:5,chunk:32,radius:13,fadeStart:1e5,fadeEnd:2e5,width:.030},
    {tile:12,segs:3,chunk:64,radius:46,fadeStart:1e5,fadeEnd:2e5,width:.030},
    {tile:32,segs:2,chunk:128,radius:170,fadeStart:122,fadeEnd:170,width:.030},
  ]:[
    {tile:4,segs:6,chunk:32,radius:16,fadeStart:1e5,fadeEnd:2e5,width:.035},
    {tile:12,segs:3,chunk:64,radius:60,fadeStart:1e5,fadeEnd:2e5,width:.035},
    {tile:32,segs:2,chunk:128,radius:175,fadeStart:120,fadeEnd:175,width:.035},
  ];
  const group=new THREE.Group();group.name='meadow-grass';
  const meshes:THREE.Mesh[]=[];
  const updaters:((frustum:THREE.Frustum,cam:THREE.Vector3)=>void)[]=[];
  const drawn:number[]=[],drawnBlades:number[]=[];
  let total=0;
  const box=new THREE.Box3();
  levels.forEach((lv,li)=>{
    const last=li===levels.length-1;
    const hi=li===0?density.rhoMax:rho(levels[li-1].radius),lo=last?0:rho(lv.radius);
    const count=Math.ceil((hi-lo)*lv.tile*lv.tile/lv.chunk)*lv.chunk;total+=count;
    const src=chunkGeometry(lv.segs,lv.chunk);
    const g=new THREE.InstancedBufferGeometry();g.setIndex(src.index);g.setAttribute('position',src.position);
    // Upper bound on chunks in flight: every tile in reach at its nearest-distance count.
    const K=Math.ceil(lv.radius/lv.tile)+1,side=2*K+1;
    const reach=last?lv.fadeEnd:lv.radius;
    const fOf=(d:number)=>{const r=rho(d)*(1-THREE.MathUtils.smoothstep(d,lv.fadeStart,lv.fadeEnd));return (r-lo)/(hi-lo);};
    const tileCount=(dmin:number)=>{if(dmin>reach)return 0;const f=fOf(dmin);return f<=0?0:Math.min(count,Math.ceil(count*Math.min(1,f))+8);};
    let cap=0;
    for(const [px,pz] of [[0,0],[.5,.5],[.01,.99]]){
      let c=0;
      for(let dj=-K;dj<=K;dj++)for(let di=-K;di<=K;di++){
        const dx=Math.max(di*lv.tile-px*lv.tile,0,px*lv.tile-(di+1)*lv.tile),dz=Math.max(dj*lv.tile-pz*lv.tile,0,pz*lv.tile-(dj+1)*lv.tile);
        c+=Math.ceil(tileCount(Math.hypot(dx,dz))/lv.chunk);
      }
      cap=Math.max(cap,c);
    }
    const chunks=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);chunks.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aChunk',chunks);g.instanceCount=0;
    const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,fog:false,
      uniforms:{...U,uTable:{value:bladeTable(count,lv.tile,7331+li*101)},uCount:{value:count},uTile:{value:lv.tile},uRhoHi:{value:hi},uRhoLo:{value:lo},
        uFadeStart:{value:lv.fadeStart},uFadeEnd:{value:lv.fadeEnd},uWidth:{value:lv.width},uRhoMax:{value:density.rhoMax},uD0:{value:density.d0},uK:{value:density.k}},
      vertexShader:MEADOW_COMMON_GLSL+BLADE_VERTEX,
      fragmentShader:OUT_GLSL+BLADE_FRAGMENT});
    const mesh=new THREE.Mesh(g,mat);mesh.name=`meadow-grass-${'ABC'[li]}`;mesh.frustumCulled=false;mesh.renderOrder=li;mesh.visible=false;
    group.add(mesh);meshes.push(mesh);drawn.push(0);drawnBlades.push(0);
    const order:number[]=[],near=new Float32Array(side*side),cnt=new Int32Array(side*side);
    updaters.push((frustum,cam)=>{
      const ci=Math.floor(cam.x/lv.tile),cj=Math.floor(cam.z/lv.tile),T=lv.tile;
      order.length=0;
      for(let dj=-K,n=0;dj<=K;dj++)for(let di=-K;di<=K;di++,n++){
        const ox=(ci+di)*T,oz=(cj+dj)*T,bx=ox+T,bz=oz+T;
        if(ox>7.2&&bx<26.8&&oz>-.8&&bz<16.8)continue; // wholly inside the bunker slab (blades reach at most .2 m onto it)
        const dmin=Math.hypot(Math.max(ox-cam.x,0,cam.x-bx),Math.max(oz-cam.z,0,cam.z-bz));
        const c=tileCount(dmin);if(c<=0)continue;
        const h0=meadowGroundY(ox,oz),h1=meadowGroundY(bx,oz),h2=meadowGroundY(ox,bz),h3=meadowGroundY(bx,bz),h4=meadowGroundY(ox+T/2,oz+T/2);
        const pad=.02*T*T/8+.3;
        box.min.set(ox-1.2,Math.min(h0,h1,h2,h3,h4)-pad,oz-1.2);box.max.set(bx+1.2,Math.max(h0,h1,h2,h3,h4)+1.1+pad,bz+1.2);
        if(!frustum.intersectsBox(box))continue;
        near[n]=dmin;cnt[n]=c;order.push(n);
      }
      order.sort((a,b)=>near[a]-near[b]);
      const arr=chunks.array as Float32Array;let m=0,blades=0;
      for(const n of order){
        const di=n%side-K,dj=Math.floor(n/side)-K,ox=(ci+di)*T,oz=(cj+dj)*T;
        for(let s=0;s<cnt[n]&&m<cap;s+=lv.chunk,m++){arr[m*3]=ox;arr[m*3+1]=oz;arr[m*3+2]=s;}
        blades+=cnt[n];
      }
      chunks.clearUpdateRanges();chunks.addUpdateRange(0,Math.max(3,m*3));chunks.needsUpdate=true;
      g.instanceCount=m;mesh.visible=m>0;drawn[li]=m;drawnBlades[li]=blades;
    });
  });
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  return {meshes,blades:total,group,
    update(camera){
      camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
      for(const u of updaters)u(frustum,camera.position);
    },
    stats:()=>({chunks:drawn.slice(),blades:drawnBlades.slice()})};
}
