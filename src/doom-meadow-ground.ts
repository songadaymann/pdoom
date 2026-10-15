import * as THREE from 'three';
import {noiseTexture,NOISE_CELLS} from './doom-meadow-noise';

/* The meadow's own landform. The old Three.js prototype keeps bliss.ts's
 * groundY(); the meadow outside the Doom facility uses this one, fit to Jonathan's
 * reference clip: one round dome cresting left of centre from the reference view,
 * a long gentle shoulder falling away to the right, soft hills ringing the horizon.
 *
 * One HILLS list generates both meadowGroundY() (JS: player, people, props, the
 * baked height texture) and MEADOW_GROUND_GLSL (the terrain surface on the GPU),
 * so the two stay exactly mirrored. */

// Gaussian hills: [centreX, centreZ, height, spreadX, spreadZ] (metres; x east, z south).
const HILLS:[number,number,number,number,number][]=[
  [60,-30,2.4,1800,900],[-24,-40,1.2,1400,700],     // gentle swells in the play area
  [8,-20,-1.4,600,300],                              // a shallow hollow in front of the door, so the hill rises clear of the foreground
  [-55,-90,25.6,3180,3220],                          // the hill: a round dome (fit to the reference silhouette from the reference view)
  [93,-159,8.4,6270,3740],                           // its long, gentle shoulder falling away to the right
  [120,-235,26,7000,6000],                           // the hill behind, right
  // small soft hills around the horizon
  [-260,-420,22,9000,7000],[-60,-560,16,6000,5000],[260,-520,20,8000,6000],[480,-300,24,9000,9000],
  [-480,-180,18,9000,8000],[-420,260,20,10000,9000],[150,560,22,9000,8000],[520,250,16,8000,8000],
];
const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Ground height (metres). Mirrored exactly by MEADOW_GROUND_GLSL. */
export function meadowGroundY(x:number,z:number):number {
  if(z>=0&&z<34&&x>-4&&x<38)return 0; // the bunker sits on flat ground
  let h=0;for(const [cx,cz,a,sx,sz] of HILLS)h+=a*Math.exp(-((x-cx)**2/sx+(z-cz)**2/sz));
  return z<0?h*smooth(0,14,-z):h*smooth(34,60,z+Math.max(0,Math.abs(x-17)-21)*1.5);
}

// Float literal for GLSL that round-trips the JS number exactly.
const g=(n:number)=>{const s=String(n);return /[.e]/.test(s)?s:s+'.';};
export const MEADOW_GROUND_GLSL=/* glsl */`
float groundY(vec2 p){
  float x=p.x,z=p.y;
  if(z>=0.&&z<34.&&x>-4.&&x<38.)return 0.;
  float h=0.;
  ${HILLS.map(([cx,cz,a,sx,sz])=>`h+=${g(a)}*exp(-((x-(${g(cx)}))*(x-(${g(cx)}))/${g(sx)}+(z-(${g(cz)}))*(z-(${g(cz)}))/${g(sz)}));`).join('\n  ')}
  return z<0.?h*smoothstep(0.,14.,-z):h*smoothstep(34.,60.,z+max(0.,abs(x-17.)-21.)*1.5);
}`;

/* Ground baked for the blades: one half-float RGBA fetch per vertex gives the
 * height (r) and the shading slope (g,b = d/dx, d/dz), which already includes the
 * soft ~20 m relief swells the sward shader adds (reliefNormal), so blades and sward
 * are lit by the same normal. 1.5 m texels over the whole walkable area plus the
 * farthest blade reach; bilinear height error on these broad hills is < 1 cm. */
export const GROUND_TEX={minX:-370,minZ:-400,size:768,n:512};
const RELIEF={scale:22,offX:4.4,offZ:2.2,gain:.30,step:.08};

/** Bilinear sample of one channel of the shared noise texture (q in noise cells, repeat wrap). */
function noiseSampler(channel:number){
  const tex=noiseTexture(),N=tex.image.width,data=tex.image.data as Uint8Array;
  return (qx:number,qz:number)=>{
    const u=qx/NOISE_CELLS*N-.5,v=qz/NOISE_CELLS*N-.5,i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;
    const at=(a:number,b:number)=>data[((((b%N)+N)%N)*N+(((a%N)+N)%N))*4+channel]/255;
    return (at(i,j)*(1-fu)+at(i+1,j)*fu)*(1-fv)+(at(i,j+1)*(1-fu)+at(i+1,j+1)*fu)*fv;
  };
}

export function groundTexture():THREE.DataTexture {
  const {minX,minZ,size,n}=GROUND_TEX,step=size/(n-1),h=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)h[j*n+i]=meadowGroundY(minX+i*step,minZ+j*step);
  const relief=noiseSampler(2),data=new Uint16Array(n*n*4),half=THREE.DataUtils.toHalfFloat;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i,x=minX+i*step,z=minZ+j*step;
    const gx=(h[j*n+Math.min(n-1,i+1)]-h[j*n+Math.max(0,i-1)])/((Math.min(n-1,i+1)-Math.max(0,i-1))*step);
    const gz=(h[Math.min(n-1,j+1)*n+i]-h[Math.max(0,j-1)*n+i])/((Math.min(n-1,j+1)-Math.max(0,j-1))*step);
    const qx=x/RELIEF.scale+RELIEF.offX,qz=z/RELIEF.scale+RELIEF.offZ,c=relief(qx,qz);
    const rx=(relief(qx+RELIEF.step,qz)-c)/RELIEF.step,rz=(relief(qx,qz+RELIEF.step)-c)/RELIEF.step;
    data[k*4]=half(h[k]);data[k*4+1]=half(gx+rx*RELIEF.gain);data[k*4+2]=half(gz+rz*RELIEF.gain);data[k*4+3]=half(1);
  }
  const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat,THREE.HalfFloatType);
  t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.needsUpdate=true;
  return t;
}

/** GLSL: the same relief the ground texture bakes, for the sward fragment shader. */
export const RELIEF_GLSL=/* glsl */`
vec3 reliefNormal(vec2 p,vec3 n){
  vec2 q=p/${g(RELIEF.scale)}+vec2(${g(RELIEF.offX)},${g(RELIEF.offZ)});
  float c=nzL(q).b,cx=nzL(q+vec2(${g(RELIEF.step)},0.)).b,cz=nzL(q+vec2(0.,${g(RELIEF.step)})).b;
  vec2 gr=vec2(cx-c,cz-c)/${g(RELIEF.step)};
  return normalize(n+vec3(-gr.x,0.,-gr.y)*${g(RELIEF.gain)});
}`;
