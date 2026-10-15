import * as THREE from 'three';

/** A tileable 256x256 RGBA gradient-noise texture (four independent channels,
 * 16 noise cells across the tile). Every meadow shader samples this instead of
 * hashing value noise per pixel/vertex: one fetch per octave instead of four hashes.
 * Built procedurally on first use and shared by sky, terrain and grass. */
let shared:THREE.DataTexture|null=null;
export const NOISE_CELLS=16;

function perlinTile(size:number,period:number,seed:number):Float32Array {
  let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  const gx=new Float32Array(period*period),gy=new Float32Array(period*period);
  for(let i=0;i<period*period;i++){const a=rnd()*Math.PI*2;gx[i]=Math.cos(a);gy[i]=Math.sin(a);}
  const out=new Float32Array(size*size);
  const fade=(t:number)=>t*t*t*(t*(t*6-15)+10);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size*period,py=(y+.5)/size*period;
    const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    const g=(i:number,j:number,dx:number,dy:number)=>{const k=((j%period+period)%period)*period+((i%period+period)%period);return gx[k]*dx+gy[k]*dy;};
    const n00=g(ix,iy,fx,fy),n10=g(ix+1,iy,fx-1,fy),n01=g(ix,iy+1,fx,fy-1),n11=g(ix+1,iy+1,fx-1,fy-1);
    const u=fade(fx),v=fade(fy);
    out[y*size+x]=(n00*(1-u)+n10*u)*(1-v)+(n01*(1-u)+n11*u)*v;
  }
  return out;
}

export function noiseTexture():THREE.DataTexture {
  if(shared)return shared;
  const size=256,data=new Uint8Array(size*size*4);
  for(let c=0;c<4;c++){
    const n=perlinTile(size,NOISE_CELLS,9001+c*7919);
    for(let i=0;i<n.length;i++)data[i*4+c]=Math.max(0,Math.min(255,Math.round((n[i]*.72+.5)*255)));
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
  t.generateMipmaps=true;t.needsUpdate=true;shared=t;return t;
}

/** Sampling helpers: q is measured in noise cells (1 unit = 1 cell). */
export const NOISE_TEX_GLSL=/* glsl */`
uniform sampler2D uNoise;
vec4 nzL(vec2 q){return textureLod(uNoise,q*${(1/NOISE_CELLS).toFixed(4)},0.);}   // vertex-safe (base level)
vec4 nzF(vec2 q){return texture(uNoise,q*${(1/NOISE_CELLS).toFixed(4)});}         // filtered (fragment)
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
`;
