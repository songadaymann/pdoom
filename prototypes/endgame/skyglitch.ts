import * as THREE from 'three';
import {pixels} from './art';

/* The sky glitch on the walk in (docs/ENDGAME.md `end-sky`; built 2026-11-06, Jonathan: "i never see anything
 * happening in the sky at that point"). For a few seconds the void over the Grid breaks up: blocky patches of the
 * meadow's Bliss sky flicker through the black, as if the old world is bleeding in; rows of it tear sideways; and
 * his face (the doc's 48 x 56 smug face, art.ts; the tower's canvas is still in coarse blocks on the walk) smears across the southern sky in huge jittering
 * blocks, downloading onto it like a progressive JPEG, then gone. The Grid's lines stutter with it (kit.ts floor
 * uGlitch). It starts a beat before the guide's line, so the line is a reaction. Drawn in code: no new art. */
const GLSL_HASH=`float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){return vn(p)*.5+vn(p*2.03+7.1)*.3+vn(p*4.1+3.3)*.2;}`;
export const SKY_GLITCH_SEC=6;
export class SkyGlitch{
 mesh:THREE.Mesh;t=-1;played=0;private mat:THREE.ShaderMaterial;
 constructor(scene:THREE.Scene,face:THREE.Texture,private floor:THREE.ShaderMaterial){
  this.mat=new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,fog:false,
   uniforms:{uT:{value:0},uK:{value:0},uFaceK:{value:0},uBlock:{value:8},uFace:{value:face},uF:{value:new THREE.Vector3(0,.38,-1).normalize()}},
   vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:GLSL_HASH+`
    varying vec3 vDir;uniform float uT,uK,uFaceK,uBlock;uniform sampler2D uFace;uniform vec3 uF;
    // the meadow's sky, roughly: ultramarine overhead, a pale haze band, soft white clouds
    vec3 bliss(vec3 d){float h=max(d.y,0.);vec3 c=mix(vec3(.055,.10,.43),vec3(.09,.17,.54),exp(-2.5*h));c=mix(c,vec3(.42,.53,.73),exp(-pow(h/.25,2.)));
     vec2 p=d.xz/(h+.35)*1.6;float cl=smoothstep(.55,.8,fbm(p*.9+vec2(uT*.02,0.)));return mix(c,vec3(.62,.67,.78),cl*.8);}
    void main(){
     vec3 d=normalize(vDir);float tq=floor(uT*14.);
     float az=atan(d.x,-d.z),el=d.y;
     // rows of sky tearing sideways
     float band=floor(el*46.),tear=step(.82,h1(vec2(band,tq)))*(h1(vec2(band+3.,tq))-.5)*.5*uK;az+=tear;
     d=normalize(vec3(sin(az)*sqrt(max(0.,1.-el*el)),el,-cos(az)*sqrt(max(0.,1.-el*el))));
     vec4 col=vec4(0.);
     // blocky patches of the old sky bleeding through
     vec2 cell=floor(vec2(az*14.,el*22.));float n=h1(cell+tq*.37);
     if(el>-.02&&n>1.-.26*uK){vec3 b=bliss(d);col=vec4(b*(.62+.18*h1(cell+5.)),1.);}
     // his face across the southern sky, pixelated to uBlock x uBlock*56/48, with a colour split
     vec3 r=normalize(cross(uF,vec3(0,1,0))),u=cross(r,uF);float fz=dot(d,uF);
     if(fz>.2&&uFaceK>0.){
      vec2 g=vec2(dot(d,r),dot(d,u))/fz,uv=vec2(g.x/.5+.5,g.y/.58+.5);
      float row=floor(uv.y*uBlock*1.17);uv.x+=(h1(vec2(row,tq))-.5)*.08*step(.6,h1(vec2(row+9.,tq)));
      vec2 q=(floor(uv*vec2(uBlock,uBlock*1.17))+.5)/vec2(uBlock,uBlock*1.17);
      if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){
       vec4 f=texture2D(uFace,q);float split=.006*uK;
       vec3 fc=vec3(texture2D(uFace,q+vec2(split,0.)).r,f.g,texture2D(uFace,q-vec2(split,0.)).b);
       float a=step(.5,f.a)*uFaceK*step(.03,h1(floor(q*vec2(uBlock,uBlock*1.17))+tq*.11));
       col=mix(col,vec4(fc*.5,1.),a);
      }
     }
     // a scanline over all of it
     col.rgb*=.82+.18*step(.5,fract(gl_FragCoord.y*.5));
     gl_FragColor=vec4(col.rgb,col.a*uK);
    }`});
  // the face sheet's smug cell, black keyed out as on the tower (mcp.ts); until it loads, the tower's own canvas
  void pixels('mcp-face.png',4,2).then(cells=>{
   const cell=cells?.[0];if(!cell)return;const cv=document.createElement('canvas');cv.width=cell.width;cv.height=cell.height;
   const d=cell.data;for(let i=0;i<d.length;i+=4)d[i+3]=d[i]+d[i+1]+d[i+2]>0?255:0;cv.getContext('2d')!.putImageData(cell,0,0);
   const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;this.mat.uniforms.uFace.value=tex;
  });
  this.mesh=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),this.mat);this.mesh.renderOrder=-1;this.mesh.visible=false;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 start(){this.t=0;this.played++;this.mesh.visible=true;}
 get on(){return this.t>=0;}
 update(dt:number,cam:THREE.Vector3,sfx?:{play:{glitch():void}}){
  if(this.t<0)return;const was=this.t;this.t+=dt;const t=this.t,u=this.mat.uniforms,f=this.floor.uniforms;
  this.mesh.position.copy(cam);
  if(t>=SKY_GLITCH_SEC){this.t=-1;this.mesh.visible=false;u.uK.value=0;u.uFaceK.value=0;f.uGlitch.value=0;return;}
  // in hard, three surges with dropouts between, and out; the face downloads in steps from 1.1 s (whole by 2.6 s)
  // and breaks up from 4.6 s
  const surge=Math.max(0,Math.sin(t*2.3))**.5,env=Math.min(1,t/.25)*Math.min(1,(SKY_GLITCH_SEC-t)/.8);
  const k=env*(.35+.65*surge)*(Math.random()<.08?.2:1);
  u.uK.value=k;u.uT.value=t;f.uGlitch.value=k;f.uGT.value=Math.floor(t*12)/12;
  const steps=[6,12,24,48],at=Math.floor((t-1.1)/.5);
  u.uBlock.value=steps[Math.max(0,Math.min(steps.length-1,at))];
  u.uFaceK.value=t<1.1?0:t<4.6?1:Math.max(0,1-(t-4.6)/1.2)*(Math.random()<.5?1:0);
  // the noise of it: a stutter of bits at each surge
  if(sfx)for(const at of [.05,1.4,2.75,4.1])if(was<at&&t>=at)sfx.play.glitch();
 }
 // cut it short (the walk skipped or over)
 stop(){if(this.t<0)return;this.t=-1;this.mesh.visible=false;this.mat.uniforms.uK.value=0;this.mat.uniforms.uFaceK.value=0;this.floor.uniforms.uGlitch.value=0;}
}
