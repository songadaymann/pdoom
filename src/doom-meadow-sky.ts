import * as THREE from 'three';
import {meadowUniforms} from './doom-meadow-shared';
import {NOISE_TEX_GLSL} from './doom-meadow-noise';

/** The meadow sky, art-directed against the reference: deep ultramarine overhead
 * easing through a saturated mid blue into a broad pale, hazy band that reaches
 * 10-15 degrees up from the horizon. High soft cotton wisps (a lazily warped
 * fbm with soft thresholds: translucent blue-grey veils with off-white, never
 * glaring, cores and no hard edges) cover well under a quarter of the sky, banked
 * behind the hill. Soft cumulus heaps rest on the horizon: one billowy fbm density
 * per heap with a lumpy, eroded outline, lit crowns and blue-grey bellies, their
 * lower 40 % melting into the haze. Everything runs on the shared noise texture, so
 * it stays cheap at Retina resolution. `cheap` (phones) drops one octave in each
 * cloud layer and the self-shadow taps. Drawn last (renderOrder 10) so only uncovered
 * pixels pay for it. */
export function makeMeadowSky(cheap=false):THREE.Mesh {
  const U=meadowUniforms();
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,defines:cheap?{CHEAP_SKY:1}:{},
    uniforms:{uTime:U.uTime,uSun:U.uSun,uNoise:U.uNoise},
    vertexShader:'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader:NOISE_TEX_GLSL+/* glsl */`
      varying vec3 vDir;uniform float uTime;uniform vec3 uSun;
      const vec3 HOR=vec3(.42,.53,.73);
      const mat2 OCT=mat2(1.6,1.2,-1.2,1.6);
      float fbm3(vec2 p){float s=nzF(p).r*.5;p=OCT*p+vec2(3.1,1.7);s+=nzF(p).g*.25;p=OCT*p+vec2(1.3,5.9);s+=nzF(p).b*.125;return s/.875;}
      float fbm2(vec2 p){float s=nzF(p).r*.5;p=OCT*p+vec2(3.1,1.7);s+=nzF(p).g*.25;return s/.75;}
      void main(){
        vec3 d=normalize(vDir);float h=max(d.y,0.);
        // deep ultramarine overhead -> saturated mid blue -> a broad pale haze band
        vec3 col=mix(vec3(.055,.100,.430),vec3(.088,.168,.540),exp(-2.5*h));
        float hb=h/.25;
        col=mix(col,HOR,exp(-hb*hb));
        vec2 dh=normalize(d.xz+vec2(1e-5,0.));
        vec2 sunH=normalize(uSun.xz);
        // where the clouds gather: banked up behind the hill (north-west of the door),
        // sparse overhead and over the opposite (south-east) sky
        float toward=dot(dh,vec2(-.57,-.82));
        float bias=.10*smoothstep(-.2,.9,toward)-.06*smoothstep(.45,.95,h);

        // ---- soft cotton wisps on a high deck (slow time-lapse drift) ----
        // (a gentle projection: features keep their size toward the horizon instead
        // of smearing into radial streaks)
        vec2 pl=d.xz/(h+.5)*1.7+vec2(.8,.3)*uTime*.003;
        vec2 w1=vec2(fbm2(pl*.21+vec2(1.7,9.2)),fbm2(pl*.21+vec2(8.3,2.8)))-.5;
        vec2 q=pl+w1*1.4;
        q+=(vec2(nzF(q*.55+vec2(4.1,.3)).g,nzF(q*.55+vec2(.6,7.4)).b)-.5)*.6; // a milder curl
        float env=fbm3(q*.42+vec2(2.,4.))+bias;
        float wa=smoothstep(.02,.20,h);
        if(env>.38&&wa>0.){
          // soft cotton detail
          vec2 fq=mat2(.83,-.55,.55,.83)*q;
          float det=nzF(fq*2.3+vec2(.3,.9)).r*.50+nzF(fq*4.9+vec2(6.1,2.9)).a*.32;
          #ifndef CHEAP_SKY
          det+=nzF(fq*8.7+vec2(3.3,1.1)).g*.18;
          #else
          det+=.09;
          #endif
          float S=env+(det-.5)*.62;
          float D=smoothstep(.55,.79,S);
          if(D>0.){
            #ifndef CHEAP_SKY
            float shade=clamp((fbm3((q-sunH*.25)*.42+vec2(2.,4.))+bias-env)*4.,-.4,.4);
            #else
            float shade=0.;
            #endif
            // thin parts translucent blue-grey, thick cores off-white, the side away
            // from the sun a touch shadowed
            float lit=clamp(smoothstep(.62,.90,S)-shade*.45,0.,1.);
            vec3 wc=mix(vec3(.52,.60,.82),vec3(.88,.90,.96),lit);
            col=mix(col,wc,D*.84*wa);
          }
        }

        // ---- soft cumulus heaps resting on the horizon, tallest behind the hill ----
        if(h<.30&&d.y>-.03){
          float az=atan(d.x,-d.z);
          float prof=nzF(dh*1.9+vec2(.3,.7)).g*.60+nzF(dh*4.6+vec2(3.3,1.1)).b*.30+nzF(dh*11.+vec2(7.1,2.2)).a*.10;
          prof+=.26*smoothstep(.3,.95,toward)+.20*smoothstep(.80,.98,toward); // a tall bank behind the hill
          float H=min(max(prof-.46,0.)*.74,.25);
          // gently separate heaps (16 slow cells round the horizon: seamless, and broad
          // enough that a heap's flanks always slope, never stand as walls)
          H*=.28+.72*smoothstep(.28,.68,nzF(vec2(az*(16./6.2831853),14.1)).r);
          if(H>.012){
            float baseH=max(nzF(dh*3.3+vec2(5.,5.)).r-.56,0.)*.04; // some heaps float a little above the haze
            float vert=clamp((h-baseH)/H,0.,1.5);
            // billows in (azimuth, elevation): the noise tile repeats 16 cells, so 96
            // cells round the horizon are seamless; one cell ~ 3.75 degrees either way
            vec2 cq=vec2(az*(96./6.2831853),h*15.3)+vec2(0.,uTime*.01);
            float n=nzF(cq).g*.55+nzF(cq*2.+vec2(3.7,1.9)).b*.28;
            #ifndef CHEAP_SKY
            n+=nzF(cq*4.+vec2(1.3,8.1)).a*.10;
            #else
            n+=.05;
            #endif
            // density: full at the base, thinning to nothing at the heap's height; the
            // billow noise makes a lumpy, eroded outline (rounded heads, never pills)
            float dens=(1.-vert*vert)*.95+(n-.5)*1.35-.10;
            // (a heap fades out where the bank gets low, so its ends thin away, never cut)
            float bd=smoothstep(0.,.22,dens)*smoothstep(-.03,.004,d.y)*smoothstep(.012,.06,H);
            if(bd>0.){
              // light: crowns toward the sun lit, bellies blue-grey
              float sunAz=atan(uSun.x,-uSun.z);
              vec2 so=vec2(sin(sunAz-az)*.35,.55)*.35;
              #ifndef CHEAP_SKY
              float n2=nzF(cq+so).g*.55+nzF((cq+so)*2.+vec2(3.7,1.9)).b*.28+.05;
              #else
              float n2=nzF(cq+so).g*.55+.19;
              #endif
              float lit=clamp(.50+(n2-n)*-2.2+.45*vert+.25*smoothstep(0.,.5,dens),0.,1.);
              vec3 bc=mix(vec3(.50,.58,.80),vec3(.90,.92,.97),smoothstep(.15,1.,lit));
              // the lower 40 % melts into the haze
              float low=1.-smoothstep(0.,.4,vert);
              bc=mix(bc,HOR*1.12,low*.65);
              col=mix(col,bc,bd*(1.-.45*low)*.95);
            }
          }
        }
        // ---- sun glow ----
        float sd=max(dot(d,uSun),0.);col+=vec3(1.,.97,.88)*(pow(sd,64.)*.25+pow(sd,6.)*.06);
        gl_FragColor=vec4(pow(col,vec3(2.2)),1.);
        #include <colorspace_fragment>
      }`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),mat);sky.frustumCulled=false;sky.renderOrder=10;sky.name='meadow-sky';
  return sky;
}
