import * as THREE from 'three';
import {meadowGroundY,MEADOW_GROUND_GLSL} from './doom-meadow-ground';
import {meadowUniforms,MEADOW_COMMON_GLSL,OUT_GLSL} from './doom-meadow-shared';

/* The hills' continuous sward. Under the near blades it is the deep shadowed root
 * colour (the gaps between leaves); with distance it becomes the averaged look of
 * the blade tops: wind-combed streaks, velvet sheen at grazing angles, the same
 * colour patches, gust bands and cloud shadows the blades converge on, so the blade
 * field dissolves into it without a seam. Fine detail is footprint-filtered
 * (mipmapped noise) so the distant hills never shimmer.
 *
 * The grid's spacing grows with distance: ~0.6 m under foot, ~20 m at the 1.2 km
 * horizon. Heights come from the GLSL groundY (mirrored from meadowGroundY). */
export function makeMeadowTerrain():THREE.Mesh {
  const N=300,R=1200,cx=17,cz=-30;const pos=new Float32Array((N+1)*(N+1)*3);const idx:number[]=[];
  const warp=(u:number)=>R*u*(.075+.925*u*u);
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=cx+warp(i/N*2-1),z=cz+warp(j/N*2-1),k=(j*(N+1)+i)*3;pos[k]=x;pos[k+1]=meadowGroundY(x,z)-.028;pos[k+2]=z;}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setIndex(idx);geometry.computeVertexNormals();
  const U=meadowUniforms();
  const material=new THREE.ShaderMaterial({fog:false,uniforms:{...U},
    vertexShader:MEADOW_GROUND_GLSL+/* glsl */`
      varying vec3 vWorld;varying vec3 vNormal;
      void main(){vec3 p=vec3(position.x,groundY(position.xz)-.028,position.z);vWorld=p;vNormal=normal;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:MEADOW_COMMON_GLSL+OUT_GLSL+/* glsl */`
      varying vec3 vWorld;varying vec3 vNormal;
      void main(){
        vec2 p=vWorld.xz;vec3 n=reliefNormal(p,normalize(vNormal));
        vec3 V=uCam-vWorld;float d=length(V);V/=d;
        // beyond the blades' reach the hills' sky silhouettes get a fuzzy fringe of
        // blade tips: in the last few pixels before the surface turns away (grazing),
        // world-anchored noise tears the edge (its scale steps with distance so the
        // tips stay a few pixels wide)
        if(d>110.){
          float gz=dot(normalize(vNormal),V);
          if(gz<.06){
            float sc=.8*exp2(floor(log2(d/110.)));
            vec2 fp=vec2(dot(p,uWind),dot(p,vec2(-uWind.y,uWind.x)));
            float tip=nzL(fp/vec2(sc*2.2,sc)+vec2(1.3,7.9)).a;
            if(tip>.46+gz*9.-.04*smoothstep(110.,160.,d))discard;
          }
        }
        vec2 perp=vec2(-uWind.y,uWind.x);
        vec2 sp=vec2(dot(p,uWind),dot(p,perp));
        float fine=nzF(sp*vec2(1.3,7.5)).r;          // blade-scale streaks combed along the wind (mipmapped: they
                                                      // keep their velvet hair as far as the footprint resolves them)
        float mid=nzF(sp*vec2(.32,1.5)+vec2(3.,9.)).g; // tussocks
        vec4 big=nzF(p/30.+vec2(7.1,3.3));            // broad meadow patches (shared with the blades)
        float g=gustField(p),cs=cloudShadow(p)*bunkerShade(p);
        // tussocks calm down from ~25 m (no camouflage far away); the fine hair stays
        float streak=fine*.45+mix(mid,.5,smoothstep(25.,60.,d))*.55;
        float comb=combFar(nzF(sp*vec2(.11,.75)+vec2(2.3,5.1)).a*.65+nzF(sp*vec2(.05,.32)+vec2(7.7,1.3)).g*.35,d);
        vec2 lieN=nzF(p/9.+vec2(2.7,6.1)).rg;           // the lie of the grass (shared with the blades)
        float mPatch=mix(big.g,.5,.7*smoothstep(50.,160.,d)); // meadow patches calm down far away
        vec3 sward=swardLight(swardAlbedo(streak,comb,mPatch),n,V,cs)*napShade(lieN,V,d);
        float gfar=smoothstep(10.,40.,d);
        sward=mix(sward,G_SHEEN*cs,g*.16*gfar)*(1.+.06*g*gfar);
        // the gaps between near leaves: shaded mid-green (never black pits)
        vec3 under=mix(G_ROOT,G_BODY*.85,.35+.3*streak)*cs;
        // short trodden grass outside the door and the mown margin round the slab show
        // more of their lit tops
        float trod=1.-smoothstep(0.,1.5,length(max(abs(p-vec2(17.,-3.3))-vec2(1.7,2.5),0.)));
        vec2 fq=abs(p-vec2(17.,8.))-vec2(10.,9.);
        trod=max(trod,1.-smoothstep(0.,1.4,max(fq.x,fq.y)));
        under=mix(under,mix(G_BODY,G_TIP,.25)*.78*cs,trod*.7);
        // (the gaps only show between near leaves: by ~24 m the ground is the sward the
        // blades there converge on, so blades and ground share one value)
        vec3 col=mix(under,sward,smoothstep(3.,24.,d));
        col=atmosphere(col,d);
        gl_FragColor=meadowOut(col);
        #include <colorspace_fragment>
      }`});
  const terrain=new THREE.Mesh(geometry,material);terrain.name='meadow-hills';terrain.frustumCulled=false;
  return terrain;
}
