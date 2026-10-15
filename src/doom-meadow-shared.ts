import * as THREE from 'three';
import {SUN_DIR} from './bliss';
import {noiseTexture,NOISE_TEX_GLSL} from './doom-meadow-noise';
import {groundTexture,GROUND_TEX,RELIEF_GLSL} from './doom-meadow-ground';

/** The meadow's wind: from the reference viewpoints (looking north-west at the hill)
 * the blades sweep to the left and slightly toward the camera. The old prototype keeps
 * bliss.ts's WIND_DIR; this one is the meadow's own. */
export const MEADOW_WIND=new THREE.Vector2(-.70,.71).normalize();

/** Shared state for every meadow shader (sky, sward, blades). One set of uniform
 * objects is referenced by all materials, so one write per frame updates them all. */
export type MeadowUniforms={
  uTime:{value:number};uGuidePath:{value:number};uCam:{value:THREE.Vector3};uWind:{value:THREE.Vector2};uSun:{value:THREE.Vector3};
  uNoise:{value:THREE.Texture};uGround:{value:THREE.Texture};uToys:{value:THREE.Vector4[]};
};
let uniforms:MeadowUniforms|null=null;

export function meadowUniforms():MeadowUniforms {
  if(!uniforms)uniforms={uTime:{value:0},uGuidePath:{value:0},uCam:{value:new THREE.Vector3()},uWind:{value:MEADOW_WIND.clone()},uSun:{value:SUN_DIR.clone()},
    uNoise:{value:noiseTexture()},uGround:{value:groundTexture()},uToys:{value:Array.from({length:9},()=>new THREE.Vector4(0,0,0,0))}};
  return uniforms;
}

const f=(n:number)=>n.toFixed(6);
/** Palette (authored in display space, 0..1 sRGB; meadowOut() converts). Tuned against
 * samples of Jonathan's reference clip: deep, pure green (hue ~117 deg), darkest gaps
 * ~rgb(5,90,3), lit tips ~rgb(55,165,45). */
export const MEADOW_COMMON_GLSL=NOISE_TEX_GLSL+RELIEF_GLSL+/* glsl */`
uniform sampler2D uGround;
uniform float uTime,uGuidePath;
uniform vec2 uWind;
uniform vec3 uSun,uCam;
const vec3 G_ROOT=vec3(.020,.360,.012);
const vec3 G_BODY=vec3(.080,.470,.060);
const vec3 G_TIP =vec3(.205,.730,.180);
const vec3 G_SHEEN=vec3(.330,.815,.290);
const vec3 HAZE=vec3(.40,.52,.72);
// height (x) and shading slope (y,z = d/dx, d/dz incl. relief) from the baked ground texture
vec3 groundAt(vec2 p){
  vec2 uv=(p-vec2(${f(GROUND_TEX.minX)},${f(GROUND_TEX.minZ)}))/${f(GROUND_TEX.size)};
  return textureLod(uGround,uv*${f((GROUND_TEX.n-1)/GROUND_TEX.n)}+${f(.5/GROUND_TEX.n)},0.).rgb;
}
// Broad, slow gust waves rolling downwind (~2-3 m/s), stretched across the wind so
// they read as travelling bands; a smaller, slower second layer breaks the rhythm.
// Thresholded so most of the field (~70 %) is calm at any moment. Every blade leans
// into these waves a little (each with its own lag) and shows a gentle sheen in them.
float gustField(vec2 p){
  vec2 perp=vec2(-uWind.y,uWind.x);
  float al=dot(p,uWind),ac=dot(p,perp);
  float g1=nzL(vec2((al-uTime*2.8)/8.,ac/15.)).g;
  float g2=nzL(vec2((al-uTime*2.1)/6.5,ac/11.)+vec2(5.3,1.7)).b;
  return smoothstep(.54,.74,g1*.7+g2*.3);
}
// The lie of the grass (velvet nap). lieN = two channels of a ~9 m world noise: r turns
// a patch's blades off the wind (lieAngle), g lays a patch flatter or stands it up. Seen
// from afar, patches combed toward the viewer or lying flatter read lighter, the others
// darker: soft combed swaths over the hill. Kept gentle (about +-7 %) so they never
// stain the hill; world-anchored, so they stay planted (they turn like velvet as you
// walk round them); beyond ~35 m they calm down into an even velvet.
float lieAngle(float r){return (smoothstep(.32,.68,r)-.5)*1.1;}
float lieFlat(float g){return smoothstep(.32,.68,g)-.5;}
float napShade(vec2 lieN,vec3 V,float d){
  float a=atan(uWind.y,uWind.x)+lieAngle(lieN.x);
  vec2 vh=normalize(V.xz+vec2(1e-4,0.));
  float k=.15*(dot(vec2(cos(a),sin(a)),vh)-.7*dot(uWind,vh))*smoothstep(6.,30.,d)  // view-dependent: only beyond the foreground
         +.15*lieFlat(lieN.y)*smoothstep(2.,12.,d);                                  // flatter / standing patches: fixed in the world
  return 1.+k*(1.-.8*smoothstep(35.,90.,d));
}
// Soft contact shade around the bunker: occlusion at the foot of the walls plus a short
// soft shadow on the side away from the sun (east / north-east). Walls: x 8..26, z .1..16.1.
float bunkerShade(vec2 p){
  vec2 q=abs(p-vec2(17.,8.1))-vec2(9.,8.);
  float dw=length(max(q,0.))+min(max(q.x,q.y),0.);
  vec2 s=abs(p+normalize(uSun.xz)*1.6-vec2(17.,8.1))-vec2(9.,8.);
  float ds=length(max(s,0.))+min(max(s.x,s.y),0.);
  return (1.-.20*(1.-smoothstep(.6,2.6,dw)))*(1.-.30*(1.-smoothstep(-.6,1.2,ds)));
}
// The sward seen from afar: averaged blade tops lit by the hill's own slope, with a
// velvet sheen at grazing angles (you see the lit sides of the leaves).
vec3 swardLight(vec3 c,vec3 n,vec3 V,float cs){
  float diff=clamp(dot(n,uSun)*.6+.4,0.,1.);
  float rim=pow(1.-clamp(dot(n,V),0.,1.),3.);
  return (c*(.48+.56*diff)+G_SHEEN*rim*.10)*cs;
}
// Wind-combed strokes across the sward: long along the wind, narrow across it, as in
// the reference hill's painterly texture. Shared by the far blades and the terrain.
// Beyond ~40 m they calm down (seen at grazing angles they would read as camouflage);
// the fine hair streaks carry the far texture instead.
float combStroke(vec2 p){
  vec2 sp=vec2(dot(p,uWind),dot(p,vec2(-uWind.y,uWind.x)));
  return nzL(sp*vec2(.11,.75)+vec2(2.3,5.1)).a*.65+nzL(sp*vec2(.05,.32)+vec2(7.7,1.3)).g*.35;
}
float combFar(float comb,float d){return mix(comb,.5,smoothstep(40.,110.,d));}
// The sward's albedo (shared by the terrain and by blades converging on it with distance).
vec3 swardAlbedo(float streak,float comb,float big){
  return mix(G_BODY,G_TIP,.22+.36*streak+.30*smoothstep(.30,.70,comb))*(.93+.30*(big-.5));
}
// Aerial perspective: the reference's distant grass is its near grass plus a
// neutral lift (~+22 per channel by the hill, a touch warm so the far sward keeps its
// pure green), then a faint blue haze to the horizon.
vec3 atmosLift(float d){return vec3(.088,.090,.080)*(1.-exp(-d/65.));}
float atmosHaze(float d){return (1.-exp(-d*.0009))*.42;}
vec3 atmosphere(vec3 c,float d){return mix(c+atmosLift(d),HAZE,atmosHaze(d));}
// Faint, slow cloud shadows over the hills (large, soft, at most ~9% darker), so the
// field never brightens or darkens as a whole.
float cloudShadow(vec2 p){
  vec2 q=p-vec2(.55,.83)*uTime*.8;
  float c=nzL(q/140.).a*.75+nzL(q/52.+vec2(3.1,7.7)).r*.25;
  return 1.-.09*smoothstep(.50,.66,c);
}
`;

/** Display-space colour -> what the framebuffer expects (pairs with <colorspace_fragment>). */
export const OUT_GLSL=/* glsl */`vec4 meadowOut(vec3 c){return vec4(pow(max(c,vec3(0.)),vec3(2.2)),1.);}`;
