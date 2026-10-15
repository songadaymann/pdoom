import * as THREE from 'three';

/** The outside, aimed at Jonathan's reference clip: an ultramarine sky with
 * wind-swept wisps and a bright cloud bank on the horizon, one smooth hill
 * cresting left of centre, little soft hills ringing the horizon, and saturated
 * lime grass whose long blades all lean and roll with the wind — right up to the
 * crest silhouette. Everything is procedural (no Microsoft image data).
 * Shaders write linear colour and end with <colorspace_fragment>, so they look the
 * same straight to the canvas (outside, full-res) or through the low-res Doom target. */

export const SUN_DIR=new THREE.Vector3(-.62,.58,.45).normalize();
export const WIND_DIR=new THREE.Vector2(.82,-.57).normalize();

// Gaussian hills: [centreX, centreZ, height, spreadX, spreadZ]. One list drives
// both the JS height (for people/props) and the generated GLSL (for terrain/grass).
const HILLS:[number,number,number,number,number][]=[
  [42,-18,2.2,1800,700],[-12,-24,1.4,1400,600],     // gentle swells in the play area
  [-45,-92,30,14000,2100],                           // the hill
  [120,-235,26,7000,6000],                           // the hill behind, right
  // small soft hills around the horizon
  [-260,-420,22,9000,7000],[-60,-560,16,6000,5000],[260,-520,20,8000,6000],[480,-300,24,9000,9000],
  [-480,-180,18,9000,8000],[-420,260,20,10000,9000],[150,560,22,9000,8000],[520,250,16,8000,8000],
];
const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Ground height (metres). Mirrored exactly by GROUND_GLSL below. */
export function groundY(x:number,z:number):number {
  if(z>=0&&z<34&&x>-4&&x<38)return 0; // the bunker sits on flat ground
  let h=0;for(const [cx,cz,a,sx,sz] of HILLS)h+=a*Math.exp(-((x-cx)**2/sx+(z-cz)**2/sz));
  return z<0?h*smooth(0,14,-z):h*smooth(34,60,z+Math.max(0,Math.abs(x-17)-21)*1.5);
}
const f=(n:number)=>n.toFixed(1);
const GROUND_GLSL=/* glsl */`
float groundY(vec2 p){
  float x=p.x,z=p.y;
  if(z>=0.&&z<34.&&x>-4.&&x<38.)return 0.;
  float h=0.;
  ${HILLS.map(([cx,cz,a,sx,sz])=>`h+=${f(a)}*exp(-((x-(${f(cx)}))*(x-(${f(cx)}))/${f(sx)}+(z-(${f(cz)}))*(z-(${f(cz)}))/${f(sz)}));`).join('\n  ')}
  return z<0.?h*smoothstep(0.,14.,-z):h*smoothstep(34.,60.,z+max(0.,abs(x-17.)-21.)*1.5);
}`;

const NOISE_GLSL=/* glsl */`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),u.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.1,3.7);a*=.5;}return s/.97;}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vnoise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.1,3.7);a*=.5;}return s/.875;}
`;

/** Shared grass palette and wind (authored sRGB-ish, converted at output). */
const MEADOW_GLSL=/* glsl */`
uniform vec2 uWind;
uniform float uTime;
const vec3 ROOT=vec3(.07,.36,.03),BODY=vec3(.19,.67,.06),TIP=vec3(.46,.90,.12),SHEEN=vec3(.70,.98,.36);
float gustAt(vec2 p){ // bands of wind sweeping across the field
  vec2 perp=vec2(-uWind.y,uWind.x);
  return vnoise(vec2(dot(p,uWind)*.06-uTime*.9,dot(p,perp)*.025))*.7+vnoise(p*.14-uWind*uTime*1.8)*.3;
}
float patchAt(vec2 p){return fbm3(p*.012);} // broad lighter/darker patches
`;

export function makeSky():THREE.Mesh {
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{uTime:{value:0},uSun:{value:SUN_DIR},uWind:{value:WIND_DIR}},
    vertexShader:'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader:NOISE_GLSL+/* glsl */`
      varying vec3 vDir;uniform float uTime;uniform vec3 uSun;uniform vec2 uWind;
      void main(){
        vec3 d=normalize(vDir);float h=max(d.y,0.);
        // deep ultramarine overhead, paler toward the horizon
        vec3 top=vec3(.03,.08,.52),mid=vec3(.10,.27,.76),hor=vec3(.62,.74,.92);
        vec3 col=mix(hor,mid,smoothstep(0.,.2,h));col=mix(col,top,smoothstep(.15,.85,h));
        float t=uTime;
        if(d.y>-.02){
          // ---- high wind-swept wisps (time-lapse drift and slow churn) ----
          vec2 uv=d.xz/(h+.35)*1.6+uWind*t*.035;
          vec2 q=uv+.9*vec2(fbm3(uv*.55+vec2(0.,t*.03)),fbm3(uv*.55+vec2(5.2,-t*.03)))-.45;
          vec2 s=mat2(.8,-.6,.6,.8)*q*vec2(1.,1.7); // stretch into streaks
          float w=fbm(s);
          float detail=fbm(q*4.+3.);
          float wisp=smoothstep(.56,.86,w)*smoothstep(.35,.75,detail)*1.25;
          wisp*=smoothstep(.0,.12,h)*(1.-smoothstep(.75,1.,h)*.4);
          vec3 wc=mix(vec3(.72,.80,.95),vec3(1.),smoothstep(.2,.8,detail));
          col=mix(col,wc,clamp(wisp,0.,1.)*.9);
          // ---- bright puffy cloud bank sitting on the horizon ----
          // project onto a low, distant cloud deck (seamless all the way round)
          vec2 b=d.xz/(h+.045)*.32+uWind*t*.02;
          float bank=fbm(b)+fbm3(b*2.3+7.)*.35;
          float hfall=1.-smoothstep(.02,.3,h);
          float dens=smoothstep(.62,.9,bank*.85+hfall*.55);
          float lit=fbm(b+uSun.xz*.25)-fbm(b);
          vec3 bc=mix(vec3(.76,.83,.95),vec3(1.,1.,1.),clamp(.7-lit*2.5,0.,1.));
          col=mix(col,bc,dens*smoothstep(-.02,.01,d.y));
        }
        float sd=max(dot(d,uSun),0.);col+=vec3(1.,.97,.88)*(pow(sd,48.)*.18+pow(sd,6.)*.05);
        gl_FragColor=vec4(pow(col,vec3(2.2)),1.);
        #include <colorspace_fragment>
      }`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),mat);sky.frustumCulled=false;sky.renderOrder=-10;sky.name='bliss-sky';
  return sky;
}

export function makeTerrain():THREE.Mesh {
  // Grid whose spacing grows with distance: ~0.6 m under foot, ~20 m at the 1.2 km horizon.
  const N=300,R=1200,cx=17,cz=-30;const pos=new Float32Array((N+1)*(N+1)*3);const idx:number[]=[];
  const warp=(u:number)=>R*u*(.075+.925*u*u);
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=cx+warp(i/N*2-1),z=cz+warp(j/N*2-1),k=(j*(N+1)+i)*3;pos[k]=x;pos[k+1]=groundY(x,z)-.028;pos[k+2]=z;}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const mat=new THREE.ShaderMaterial({fog:false,
    uniforms:{uTime:{value:0},uSun:{value:SUN_DIR},uWind:{value:WIND_DIR},uCam:{value:new THREE.Vector3()},uFar:{value:110}},
    vertexShader:'varying vec3 vWorld;varying vec3 vNormal;void main(){vWorld=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:NOISE_GLSL+MEADOW_GLSL+/* glsl */`
      varying vec3 vWorld;varying vec3 vNormal;uniform vec3 uSun,uCam;uniform float uFar;
      void main(){
        vec2 p=vWorld.xz;vec3 n=normalize(vNormal);
        float d=length(vWorld-uCam);
        float g=gustAt(p),pt=patchAt(p);
        // Under the blades the ground is mostly shadowed root colour; past the blade
        // field it stands in for the whole sward, with wind-aligned blade streaks.
        vec2 perp=vec2(-uWind.y,uWind.x);
        float streak=vnoise(vec2(dot(p,uWind)*1.2,dot(p,perp)*9.))*.6+vnoise(vec2(dot(p,uWind)*.4,dot(p,perp)*3.))*.4;
        vec3 sward=mix(BODY,TIP,.42+.3*streak+.2*pt);
        sward=mix(sward,SHEEN,smoothstep(.5,.9,g)*.45);
        vec3 c=mix(mix(ROOT,BODY,.45),sward,smoothstep(uFar*.55,uFar*.95,d));
        float diff=clamp(dot(n,uSun),0.,1.);
        vec3 lit=c*(.62+.55*diff);
        vec3 haze=vec3(.62,.76,.92);
        lit=mix(lit,haze,(1.-exp(-d*.0011))*.75);
        gl_FragColor=vec4(pow(lit,vec3(2.2)),1.);
        #include <colorspace_fragment>
      }`});
  const land=new THREE.Mesh(g,mat);land.name='bliss-hills';land.frustumCulled=false;return land;
}

/** Wind-blown blades in a square patch that wraps around the camera on the GPU,
 * so blades stay put in the world while the patch follows the player. Two of
 * these run at once: a dense near field and a coarser far field reaching the crest. */
export function makeGrass(count:number,patch:number,o:{hole:number;height:[number,number];width:number}):THREE.Mesh {
  const blade=new THREE.BufferGeometry();
  // x = side (-1..1), y = height fraction: a long leaf that tapers to a point.
  blade.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0, 1,0,0, -.9,.3,0, .9,.3,0, -.65,.62,0, .65,.62,0, 0,1,0],3));
  blade.setIndex([0,1,2,2,1,3,2,3,4,4,3,5,4,5,6]);
  const g=new THREE.InstancedBufferGeometry();g.index=blade.index;g.setAttribute('position',blade.getAttribute('position'));g.instanceCount=count;
  const data=new Float32Array(count*4);const side=Math.ceil(Math.sqrt(count));
  let seed=1234567+count;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){data[i*4]=((i%side)+rnd())/side*patch;data[i*4+1]=(Math.floor(i/side)+rnd())/side*patch;data[i*4+2]=rnd();data[i*4+3]=rnd();}
  g.setAttribute('aBlade',new THREE.InstancedBufferAttribute(data,4));
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,fog:false,
    uniforms:{uTime:{value:0},uCam:{value:new THREE.Vector3()},uPatch:{value:patch},uHole:{value:o.hole},uH:{value:new THREE.Vector2(...o.height)},uW:{value:o.width},uWind:{value:WIND_DIR},uSun:{value:SUN_DIR}},
    vertexShader:NOISE_GLSL+GROUND_GLSL+MEADOW_GLSL+/* glsl */`
      attribute vec4 aBlade;uniform vec3 uCam,uSun;uniform float uPatch,uHole,uW;uniform vec2 uH;
      varying vec3 vCol;
      void main(){
        vec2 base=uCam.xz+mod(aBlade.xy-uCam.xz+uPatch*.5,uPatch)-uPatch*.5;
        float dist=length(base-uCam.xz);
        float fade=(1.-smoothstep(uPatch*.36,uPatch*.5,dist))*smoothstep(uHole*.8,uHole*1.15,dist);
        // keep clear of the bunker and the relay pad
        float clear=(1.-step(-1.15,base.y)*step(-4.,base.x)*step(base.x,38.)*step(base.y,34.))*(1.-step(abs(base.x-22.),1.25)*step(abs(base.y+10.),1.05));
        float r1=aBlade.z,r2=aBlade.w;
        float pt=patchAt(base);
        float h=mix(uH.x,uH.y,r1*r1)*(.8+.4*pt)*fade*clear;
        // leaves face mostly across the wind so the lean reads as a sweep
        float ang=atan(uWind.y,uWind.x)+1.5708+(r2-.5)*2.2;vec2 face=vec2(cos(ang),sin(ang));
        float t=position.y;float width=uW*(.7+.6*r2)*(1.-t*.85);
        float gust=gustAt(base);
        float sway=sin(uTime*2.6+r1*6.28+dot(base,uWind)*.5)*.12+sin(uTime*4.1+r2*9.)*.05;
        float lean=(.35+gust*.85+sway+(r1-.5)*.3)*t*t;   // everything leans downwind, gusts flatten it
        vec3 world=vec3(base.x+face.x*position.x*width,groundY(base)+t*h*(1.-lean*.35),base.y+face.y*position.x*width);
        world.xz+=uWind*lean*h*1.1;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
        vec3 c=mix(ROOT,BODY,smoothstep(0.,.45,t));c=mix(c,TIP,smoothstep(.45,1.,t)*(.55+.45*pt));
        c=mix(c,SHEEN,t*smoothstep(.45,.9,gust)*.6); // wind flashes the bent blades
        c*=.94+.12*r2;
        float diff=clamp(dot(normalize(vec3(uWind.x*lean,1.,uWind.y*lean)),uSun),0.,1.);
        vCol=c*(.7+.45*diff);
      }`,
    fragmentShader:/* glsl */`varying vec3 vCol;void main(){gl_FragColor=vec4(pow(vCol,vec3(2.2)),1.);
      #include <colorspace_fragment>
    }`});
  const grass=new THREE.Mesh(g,mat);grass.frustumCulled=false;grass.name='bliss-grass';return grass;
}
