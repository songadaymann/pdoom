import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

/* Shared pieces for the endgame feel prototypes (docs/ENDGAME.md): the Grid, first-person
 * movement, the HUD, a few synth sounds, sparks and trails. Metres; x east, z south, y up; the
 * MCP stands at the origin. Colours match the hub lane's Tron traces (cyan #38f4ff on #02060a);
 * the MCP and its machines are red-orange. */
export const PAL={line:'#38f4ff',core:'#d8fdff',floor:'#02060a',enemy:'#ff3b1f',enemyCore:'#ffd2a0',white:'#f4f8ff'};
// the spec's GRID01 in metres (32 Doom units a metre, rounded): ring = the shield's radius, block = how close you can walk
export const ARENA={radius:46,ring:10,column:5.6,block:12.5,pillarR:28,pillarSize:1.5,pillarH:8,wallH:12,faceY:12,faceH:12,shieldTop:22};
export const TAU=Math.PI*2;
export const wrap=(a:number)=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};
export const rand=(a:number,b:number)=>a+Math.random()*(b-a);
export const clamp=THREE.MathUtils.clamp;
export const bearingOf=(p:{x:number;z:number})=>Math.atan2(p.z,p.x);
export const PILLARS=Array.from({length:8},(_,i)=>{const a=(i*45+22.5)*Math.PI/180;return {x:Math.cos(a)*ARENA.pillarR,z:Math.sin(a)*ARENA.pillarR};});
// the data center's gas turbines (datacenter.ts), two rows either side of the walk's approach, outside its |x| 18
export const TURBINES=Array.from({length:10},(_,i)=>({x:(i%2?1:-1)*(26+((i>>1)%2)*3),z:54+(i>>1)*12}));

function lines(geo:THREE.BufferGeometry,color:string,opacity=1){
 return new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
}
export function edged(geo:THREE.BufferGeometry,fill:number|string,line:string,opacity=1){
 const g=new THREE.Group();g.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:fill})),lines(geo,line,opacity));return g;
}
let glowTexture:THREE.Texture|null=null;
export function glow(){
 if(glowTexture)return glowTexture;
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;
 const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=r;g.fillRect(0,0,64,64);glowTexture=new THREE.CanvasTexture(c);return glowTexture;
}
export function glowSprite(color:string,size:number,opacity=1){
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow(),color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(size);return s;
}

export function makeStage(canvas:HTMLCanvasElement,{door=false}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new THREE.Scene();scene.background=new THREE.Color(PAL.floor);scene.fog=new THREE.FogExp2(PAL.floor,.003);
 const camera=new THREE.PerspectiveCamera(74,1,.05,1500);scene.add(camera);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.72,.35,.42);composer.addPass(bloom);composer.addPass(new OutputPass());
 function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
 resize();addEventListener('resize',resize);
 scene.add(new THREE.AmbientLight(0x5a7c8c,1.1));
 const pitLight=new THREE.PointLight(PAL.enemy,260,70,1.5);pitLight.position.set(0,4,0);scene.add(pitLight);

 // The floor: black with a cyan grid, 4 m minor and 16 m major lines on world x/z (the hub's traces land on them).
 // 1200 m across, so the walk in (WALK.far) starts on it
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200).rotateX(-Math.PI/2),new THREE.ShaderMaterial({
  uniforms:{uLine:{value:new THREE.Color(PAL.line)},uBase:{value:new THREE.Color(PAL.floor)},uPit:{value:new THREE.Color(PAL.enemy)},uR:{value:ARENA.radius},uPitGlow:{value:1},uGlitch:{value:0},uGT:{value:0}},
  vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`uniform vec3 uLine,uBase,uPit;uniform float uR,uPitGlow,uGlitch,uGT;varying vec3 vW;
   float grid(vec2 p,float s,float w){vec2 q=p/s;vec2 g=abs(fract(q-.5)-.5)/(fwidth(q)*w);return 1.-min(min(g.x,g.y),1.);}
   float hh(float x){return fract(sin(x*91.7+uGT*13.1)*43758.5453);}
   void main(){vec2 p=vW.xz;float r=length(p),d=length(vW.xz-cameraPosition.xz);
    float inside=1.-smoothstep(uR-1.,uR+.5,r)*.85;
    float fade=mix(.3,1.,exp(-d/70.));
    // the sky glitch (skyglitch.ts): rows of the Grid slip sideways and some lines flash white or red
    vec3 line=uLine;
    if(uGlitch>0.){float b=floor(p.y/6.);p.x+=step(.72,hh(b))*(hh(b+7.)-.5)*9.*uGlitch;float f=hh(floor(p.y/3.)+3.);line=mix(line,f>.5?vec3(1.):vec3(1.,.25,.12),step(.86,f)*uGlitch);}
    vec3 c=uBase+line*(grid(p,4.,1.2)*.16+grid(p,16.,1.8)*.7)*fade*inside;
    c+=uPit*exp(-max(r-5.,0.)/3.5)*.5*uPitGlow;
    gl_FragColor=vec4(c,1.);}`,
 }));
 scene.add(floor);
 const ring=(r:number,y:number,color:string,n=128)=>{const pts=Array.from({length:n+1},(_,i)=>new THREE.Vector3(Math.cos(i/n*TAU)*r,y,Math.sin(i/n*TAU)*r));return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color}));};
 // The arena wall: dark, ruled with cyan, one bright band at hip height.
 const R=ARENA.radius,H=ARENA.wallH;
 // with a door (the finale's walk in), a gap at +z, and the wall is seen from outside too
 const gap=door?DOOR_HALF*2/R:0,around=(r:number,h:number,y:number)=>new THREE.CylinderGeometry(r,r,h,128,1,true,gap/2,TAU-gap).translate(0,y,0);
 scene.add(new THREE.Mesh(around(R,H,H/2),new THREE.MeshBasicMaterial({color:0x03090e,side:door?THREE.DoubleSide:THREE.BackSide})));
 for(const y of [.03,H*.55,H])scene.add(ring(R-.02,y,PAL.line));
 scene.add(new THREE.Mesh(around(R-.05,.12,1.3),new THREE.MeshBasicMaterial({color:PAL.line,side:door?THREE.DoubleSide:THREE.BackSide})));
 const ribs:THREE.Vector3[]=[];for(let i=0;i<72;i++){const a=i/72*TAU;ribs.push(new THREE.Vector3(Math.cos(a)*(R-.03),0,Math.sin(a)*(R-.03)),new THREE.Vector3(Math.cos(a)*(R-.03),H,Math.sin(a)*(R-.03)));}
 scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ribs),new THREE.LineBasicMaterial({color:PAL.line,transparent:true,opacity:.18})));
 // Eight data pillars (cover; server racks, datacenter.ts), the dais round the pit, and Mars: a red dot high in the void.
 const pillars:THREE.Group[]=[];
 for(const p of PILLARS){const s=ARENA.pillarSize*1.45,pillar=edged(new THREE.BoxGeometry(s,ARENA.pillarH,s).translate(0,ARENA.pillarH/2,0),0x050c12,PAL.line,.55);pillar.position.set(p.x,0,p.z);pillar.rotation.y=-Math.atan2(p.z,p.x);scene.add(pillar);pillars.push(pillar);}
 const dais=new THREE.Mesh(new THREE.CylinderGeometry(ARENA.block-.5,ARENA.block,.5,96).translate(0,.25,0),new THREE.MeshBasicMaterial({color:0x07040a}));scene.add(dais);
 scene.add(ring(ARENA.block-.5,.52,PAL.enemy),ring(ARENA.block,.02,PAL.enemy));
 const mars=glowSprite(PAL.enemy,26);mars.position.set(-60,320,-620);scene.add(mars);
 const marsCore=new THREE.Mesh(new THREE.SphereGeometry(3.2,16,12),new THREE.MeshBasicMaterial({color:'#ff6a3a',fog:false}));marsCore.position.copy(mars.position);scene.add(marsCore);
 // the door: a slab in the gap that slides up into the wall (open(0..1)), cyan jambs either side
 let doorSlab:THREE.Object3D|null=null;
 if(door){
  doorSlab=edged(new THREE.BoxGeometry(DOOR_HALF*2,H,.4).translate(0,H/2,0),0x03090e,PAL.core,.9);doorSlab.position.set(0,0,R);scene.add(doorSlab);
  for(const x of [-DOOR_HALF,DOOR_HALF]){const jamb=new THREE.Mesh(new THREE.BoxGeometry(.3,H,.6),new THREE.MeshBasicMaterial({color:PAL.line}));jamb.position.set(x,H/2,Math.sqrt(R*R-x*x));scene.add(jamb);}
 }
 return {renderer,scene,camera,composer,pitLight,floor,pillars,render:()=>composer.render(),
  openDoor(k:number){if(doorSlab)doorSlab.position.y=THREE.MathUtils.clamp(k,0,1)*(H-.4);}};
}
export type Stage=ReturnType<typeof makeStage>;

// requestPointerLock can reject (the page is navigating away, the user pressed Esc): nothing to do, the next click retries.
export function lock(canvas:HTMLCanvasElement){try{(canvas.requestPointerLock?.() as unknown as Promise<void>|undefined)?.catch?.(()=>{});}catch{/* no pointer lock here */}}
export function makeInput(canvas:HTMLCanvasElement){
 const keys=new Set<string>(),state={yaw:0,pitch:0,locked:false};
 const press:((b:number)=>void)[]=[],key:((c:string)=>void)[]=[];
 canvas.addEventListener('mousedown',e=>{if(!state.locked){lock(canvas);return;}press.forEach(f=>f(e.button));});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;});
 document.addEventListener('mousemove',e=>{if(!state.locked)return;state.yaw-=e.movementX*.0022;state.pitch=clamp(state.pitch-e.movementY*.0022,-1.25,1.25);});
 addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;keys.add(e.code);key.forEach(f=>f(e.code));});
 addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
 return {keys,state,onPress:(f:(b:number)=>void)=>press.push(f),onKey:(f:(c:string)=>void)=>key.push(f)};
}
export type Input=ReturnType<typeof makeInput>;

// Keeps a walker on the arena floor: inside the wall, outside the dais, out of the pillars.
// The walk in (?m=finale, docs/ENDGAME.md E4-E5): outside the wall there's a corridor running north from the
// door, which sits on the wall at +z (DOOR_HALF either side of x 0); the wall is solid until the door opens.
export const WALK={on:false,door:false,far:450};// 450 since 2026-10-30, to fit the hum line
export const DOOR_HALF=3.4;
export function resolve(p:THREE.Vector3,rad:number){
 const r=Math.hypot(p.x,p.z),max=ARENA.radius-.6-rad,min=ARENA.block+rad;
 if(WALK.on){
  const doorway=WALK.door&&p.z>0&&Math.abs(p.x)<DOOR_HALF-rad;
  if(r>ARENA.radius||doorway){
   p.x=THREE.MathUtils.clamp(p.x,-18,18);p.z=Math.min(p.z,WALK.far+6);
   const out=ARENA.radius+.6+rad,r2=Math.hypot(p.x,p.z);if(!doorway&&r2<out){p.x*=out/r2;p.z*=out/r2;}
   return;
  }
 }
 if(r>max){p.x*=max/r;p.z*=max/r;}else if(r<min&&r>1e-6){p.x*=min/r;p.z*=min/r;}
 for(const q of PILLARS){const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz),m=ARENA.pillarSize+rad;if(d<m&&d>1e-6){p.x=q.x+dx/d*m;p.z=q.z+dz/d*m;}}
}

export class Player{
 pos=new THREE.Vector3(0,0,36);knock=new THREE.Vector3();health=100;hurt=0;downFor=0;eye=1.6;invuln=0;frozen=false;
 constructor(public input:Input){}
 forward(out=new THREE.Vector3()){const {yaw,pitch}=this.input.state;return out.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
 right(out=new THREE.Vector3()){const {yaw}=this.input.state;return out.set(Math.cos(yaw),0,-Math.sin(yaw));}
 eyePos(out=new THREE.Vector3()){return out.set(this.pos.x,this.eye,this.pos.z);}
 hand(out=new THREE.Vector3()){const f=this.forward(),r=this.right();return this.eyePos(out).addScaledVector(r,.3).addScaledVector(f,.5).add(new THREE.Vector3(0,-.28,0));}
 get down(){return this.downFor>0;}
 update(dt:number){
  const k=this.input.keys,s=this.input.state;
  this.hurt=Math.max(0,this.hurt-dt*2.5);this.invuln=Math.max(0,this.invuln-dt);
  if(this.downFor>0){this.downFor-=dt;if(this.downFor<=0){this.health=100;this.pos.set(0,0,36);s.yaw=0;s.pitch=0;this.invuln=2;}return;}
  if(this.frozen)return;// the trick shot borrows the controls to steer the disc
  if(k.has('ArrowLeft'))s.yaw+=dt*2.4;if(k.has('ArrowRight'))s.yaw-=dt*2.4;
  const f=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),st=(k.has('KeyD')?1:0)-(k.has('KeyA')?1:0);
  const speed=k.has('ShiftLeft')||k.has('ShiftRight')?10:6,fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),rx=Math.cos(s.yaw),rz=-Math.sin(s.yaw);
  let mx=fx*f+rx*st,mz=fz*f+rz*st;const m=Math.hypot(mx,mz);if(m>0){mx/=m;mz/=m;}
  this.pos.x+=(mx*speed+this.knock.x)*dt;this.pos.z+=(mz*speed+this.knock.z)*dt;this.knock.multiplyScalar(Math.exp(-dt*6));
  resolve(this.pos,.45);
 }
 damage(n:number,from:THREE.Vector3){
  if(this.down||this.invuln>0)return false;
  this.health=Math.max(0,this.health-n);this.hurt=1;const away=new THREE.Vector3(this.pos.x-from.x,0,this.pos.z-from.z);
  if(away.lengthSq()<1e-4)away.set(0,0,1);this.knock.copy(away.normalize().multiplyScalar(11));
  if(this.health<=0)this.downFor=2.4;return true;
 }
}

export function makeHud(){
 const $=(id:string)=>document.getElementById(id)!;
 const until:Record<string,number>={};let clock=0;
 const show=(id:string,text:string,sec:number)=>{const e=$(id);e.textContent=text;e.hidden=!text;until[id]=clock+sec;};
 return{
  hint(t:string){$('hint').textContent=t;$('hint').hidden=!t;},
  toast(who:string,t:string,sec=3.4){const e=$('toast');e.innerHTML='';if(who){const b=document.createElement('b');b.textContent=who+': ';e.append(b);}e.append(t);e.hidden=false;until.toast=clock+sec;},
  caption(t:string,sec=3.2){show('caption',t,sec);},
  pop(t:string,color=PAL.core){const e=$('pop');e.style.color=color;show('pop',t,.7);e.classList.remove('go');void e.offsetWidth;e.classList.add('go');},
  bar(frac:number|null){const e=$('boss');e.hidden=frac===null;if(frac!==null)($('boss-fill') as HTMLElement).style.width=(Math.max(0,frac)*100).toFixed(1)+'%';},
  health(h:number,hurt:number,down:boolean){($('health-fill') as HTMLElement).style.width=h+'%';($('vignette') as HTMLElement).style.opacity=String(down?.85:hurt*.7);$('down').hidden=!down;},
  reticle(hot:boolean){$('reticle').classList.toggle('hot',hot);},
  dialog(show:boolean){$('dialog').hidden=!show;},
  tick(t:number){clock=t;for(const id of ['toast','caption','pop'])if(until[id]!==undefined&&clock>until[id]){$(id).hidden=true;delete until[id];}},
 };
}
export type Hud=ReturnType<typeof makeHud>;

// Original synth sounds, quiet, and Doom's own tracks for THE BOSS; M mutes. Nothing plays until the first click.
// A sound given a place (`at`) is heard from there. Two kinds run all the time: the arena's own noise, the
// inside of a data center (bed), and each ship's engine (engine).
export type Engine={move(p:THREE.Vector3,charge:number,dt:number):void;stop(dying:boolean):void};
export function makeSfx(){
 let ctx:AudioContext|null=null,master:GainNode|null=null,muted=new URLSearchParams(location.search).has('mute');
 // the music has a bus of its own, which the cut to silence leaves alone and which dips while anyone talks
 let songBus:GainNode|null=null,duckBus:GainNode|null=null,song:{src:AudioBufferSourceNode;gain:GainNode}|null=null,want:string|null=null;
 // where tone() and noise() go: master, or the panner of a sound from somewhere
 let out:AudioNode|null=null;
 const ear=new THREE.Vector3(),look=new THREE.Vector3();
 function ensure(){
  if(!ctx){
   ctx=new AudioContext();master=ctx.createGain();master.gain.value=muted?0:.55;master.connect(ctx.destination);
   songBus=ctx.createGain();songBus.gain.value=muted?0:1;duckBus=ctx.createGain();duckBus.connect(songBus).connect(ctx.destination);
   bed();void loadClips();
  }
  if(ctx.state==='suspended')ctx.resume();
 }
 function tone(hz:number,dur:number,type:OscillatorType='sine',vol=.2,slide=0,delay=0){
  if(!ctx||!master)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(hz,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,hz+slide),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g).connect(out??master);o.start(t);o.stop(t+dur+.02);
 }
 function noise(dur:number,vol:number,hz:number,q=1,sweep=0,delay=0){
  if(!ctx||!master)return;const t=ctx.currentTime+delay,n=Math.floor(ctx.sampleRate*dur),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(hz,t);
  if(sweep)f.frequency.exponentialRampToValueAtTime(Math.max(60,hz+sweep),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(f).connect(g).connect(out??master);s.start(t);
 }
 // one dog's bark: a buzz bent up then down, through two mouth resonances, with breath on the front
 function yap(f0:number,vol:number,delay=0){
  if(!ctx||!master)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain(),m1=ctx.createBiquadFilter(),m2=ctx.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(f0*.75,t);o.frequency.linearRampToValueAtTime(f0*1.2,t+.03);o.frequency.exponentialRampToValueAtTime(f0*.55,t+.15);
  m1.type=m2.type='bandpass';m1.frequency.value=f0*1.9;m1.Q.value=3;m2.frequency.value=f0*4.1;m2.Q.value=4;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.17);
  o.connect(m1).connect(g);o.connect(m2).connect(g);g.connect(out??master);o.start(t);o.stop(t+.2);noise(.05,vol*.25,f0*3,1.2,0,delay);
 }
 // a panner at a place in the arena; `ref` is how far off it's heard at full strength
 function panner(at:{x:number;y:number;z:number},ref:number,to:AudioNode,model:PanningModelType='HRTF'){
  const n=ctx!.createPanner();n.panningModel=model;n.distanceModel='inverse';n.refDistance=ref;n.rolloffFactor=1;
  n.positionX.value=at.x;n.positionY.value=at.y;n.positionZ.value=at.z;n.connect(to);return n;
 }
 // what f() plays, heard from `at` (or from everywhere, without one)
 function from(at:THREE.Vector3|undefined,f:()=>void,ref=8){
  if(!at||!ctx||!master)return f();const pan=panner(at,ref,master);out=pan;try{f();}finally{out=null;}setTimeout(()=>pan.disconnect(),6000);
 }
 // four seconds of white noise, looped by everything that hisses or roars, each from its own point in it
 let hissBuf:AudioBuffer|null=null;
 function hiss(){
  const c=ctx!;if(!hissBuf){const n=c.sampleRate*4,d=(hissBuf=c.createBuffer(1,n,c.sampleRate)).getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}
  const s=c.createBufferSource();s.buffer=hissBuf;s.loop=true;s.start(0,rand(0,3.9));return s;
 }
 // a slow swing on a setting: `depth` either side of where it is, `hz` times a second
 function wobble(p:AudioParam,hz:number,depth:number){const o=ctx!.createOscillator(),g=ctx!.createGain();o.frequency.value=hz;g.gain.value=depth;o.connect(g).connect(p);o.start();return o;}
 // Recorded effects, where scripts/generate-endgame-sfx.py has made them (doom-web/local/endgame/sfx/):
 // a few takes a name, one picked at random and its speed nudged. A name with none stays synthesized.
 const clips=new Map<string,AudioBuffer[]>();
 async function loadClips(){
  try{
   const r=await fetch('../local/endgame/sfx/manifest.json');if(!r.ok)return;const m=await r.json() as {clips:Record<string,string[]>};
   for(const [name,files] of Object.entries(m.clips)){
    const takes=await Promise.all(files.map(f=>fetch('../local/endgame/sfx/'+f).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>ctx!.decodeAudioData(b)).catch(()=>null)));
    clips.set(name,takes.filter((b):b is AudioBuffer=>!!b));
   }
  }catch{/* none made: the synth */}
 }
 function clip(name:string,vol=1,delay=0){
  const takes=clips.get(name);if(!takes?.length||!ctx||!master)return false;
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=takes[Math.floor(Math.random()*takes.length)];s.playbackRate.value=rand(.94,1.06);g.gain.value=vol;
  s.connect(g).connect(out??master);s.start(ctx.currentTime+delay);return true;
 }

 // The arena is the inside of a data center: mains hum, the roar of the room's air, a fan in each pillar,
 // each drifting in speed, and now and then a hard disk seeking in one of them. ?bed=0 leaves it out.
 // On the walk in it swells as you get nearer (near()), and pours out when the door opens (2026-10-30).
 let bedBus:GainNode|null=null,turbBus:GainNode|null=null,nearK=1,seekAt=0,seekBuf:AudioBuffer|null=null;const spin:OscillatorNode[]=[],fanBands:BiquadFilterNode[]=[],fanPans:PannerNode[]=[];
 function bed(){
  const c=ctx!,q=new URLSearchParams(location.search);if(q.get('bed')==='0')return;
  bedBus=c.createGain();bedBus.gain.value=nearK;bedBus.connect(master!);
  const hum=c.createGain();hum.connect(bedBus);wobble(hum.gain,.13,.15);
  for(const [hz,v] of [[60,.012],[120,.03],[180,.01],[240,.008],[360,.004]]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=hz;g.gain.value=v;o.connect(g).connect(hum);o.start();spin.push(o);}
  const lp=c.createBiquadFilter(),air=c.createGain();lp.type='lowpass';lp.frequency.value=190;air.gain.value=.4;hiss().connect(lp).connect(air).connect(bedBus);fanBands.push(lp);
  for(const p of PILLARS){
   const k=rand(.85,1.2),pan=panner({x:p.x,y:ARENA.pillarH*.6,z:p.z},10,bedBus),bp=c.createBiquadFilter(),g=c.createGain(),blade=c.createOscillator(),bg=c.createGain();
   bp.type='bandpass';bp.frequency.value=720*k;bp.Q.value=.8;g.gain.value=.25;hiss().connect(bp).connect(g).connect(pan);
   blade.type='triangle';blade.frequency.value=185*k;bg.gain.value=.015;blade.connect(bg).connect(pan);blade.start();
   wobble(blade.frequency,rand(.03,.08),7*k);wobble(bp.frequency,rand(.03,.08),80);wobble(g.gain,rand(4,7),.04);
   spin.push(blade);fanBands.push(bp);fanPans.push(pan);
  }
  const n=Math.floor(c.sampleRate*.012),d=(seekBuf=c.createBuffer(1,n,c.sampleRate)).getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(n/6))+Math.sin(i/c.sampleRate*TAU*2900)*Math.exp(-i/(n/3))*.5;
  // the finale's gas turbines outside (TURBINES): a roar and a whine from each row, on a bus of their own that near() leaves alone
  if(q.get('m')!=='finale')return;
  turbBus=c.createGain();turbBus.connect(master!);
  for(const side of [-1,1]){
   const pan=panner({x:side*27.5,y:2.1,z:78},18,turbBus,'equalpower'),lp=c.createBiquadFilter(),rg=c.createGain(),bp=c.createBiquadFilter(),wg=c.createGain();
   lp.type='lowpass';lp.frequency.value=160;rg.gain.value=.3;hiss().connect(lp).connect(rg).connect(pan);
   bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=6;wg.gain.value=.04;hiss().connect(bp).connect(wg).connect(pan);wobble(bp.frequency,rand(.05,.1),90);
   fanBands.push(lp,bp);
  }
 }
 // a hard disk seeking: a little run of clicks from one of the pillars
 function seek(){
  const c=ctx!;let t=c.currentTime;const pan=fanPans[Math.floor(Math.random()*fanPans.length)];
  for(let i=0,n=3+Math.floor(rand(0,10));i<n;i++){t+=rand(.02,.09);const s=c.createBufferSource(),g=c.createGain();s.buffer=seekBuf;s.playbackRate.value=rand(.8,1.25);g.gain.value=rand(.05,.11);s.connect(g).connect(pan);s.start(t);}
 }
 // the power failing (the meltdown): fans and hum wind down two octaves over `sec`, then nothing
 function powerDown(sec:number){
  if(!ctx||!bedBus)return;const t=ctx.currentTime;
  for(const o of spin)o.detune.setTargetAtTime(-2400,t,sec/3);for(const f of fanBands)f.frequency.setTargetAtTime(60,t,sec/3);
  bedBus.gain.setTargetAtTime(0,t+sec*.35,sec/5);turbBus?.gain.setTargetAtTime(0,t+sec*.35,sec/5);seekAt=Infinity;
 }

 // A ship's engine: detuned saws growling through a resonant filter that throbs, a rumble under it, and a
 // whine that climbs as it charges a shot. It's heard from the ship, its pitch bent as it comes and goes.
 function engine():Engine|null{
  if(!ctx||!master)return null;const c=ctx,t=c.currentTime,base=rand(36,47);
  const pan=panner({x:0,y:-50,z:0},12,master),g=c.createGain(),lp=c.createBiquadFilter();
  lp.type='lowpass';lp.frequency.value=380;lp.Q.value=7;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+1.2);lp.connect(g).connect(pan);
  const oscs=([['sawtooth',1,.5],['sawtooth',1.012,.5],['square',2.003,.16]] as [OscillatorType,number,number][]).map(([type,k,v])=>{const o=c.createOscillator(),og=c.createGain();o.type=type;o.frequency.value=base*k;og.gain.value=v;o.connect(og).connect(lp);o.start();return o;});
  const throb=wobble(lp.frequency,rand(4.5,7),150),rumble=hiss(),rb=c.createBiquadFilter(),rg=c.createGain();rb.type='bandpass';rb.frequency.value=110;rb.Q.value=.7;rg.gain.value=3;rumble.connect(rb).connect(rg).connect(g);
  const whine=c.createOscillator(),wg=c.createGain();whine.frequency.value=880;wg.gain.value=.01;whine.connect(wg).connect(g);whine.start();
  let last=-1;
  return {
   move(p,charge,dt){
    const now=c.currentTime,d=p.distanceTo(ear);
    if(last<0){pan.positionX.value=p.x;pan.positionY.value=p.y;pan.positionZ.value=p.z;}
    else{pan.positionX.setTargetAtTime(p.x,now,.03);pan.positionY.setTargetAtTime(p.y,now,.03);pan.positionZ.setTargetAtTime(p.z,now,.03);}
    // Doppler, overdone: sound at 110 m/s, not 343
    const bend=last<0||dt<=0?1:clamp(1/(1+(d-last)/dt/110),.7,1.4);last=d;
    for(const o of oscs)o.detune.setTargetAtTime(1200*Math.log2(bend),now,.08);
    whine.frequency.setTargetAtTime((880+charge*1800)*bend,now,.05);wg.gain.setTargetAtTime(.01+charge*.035,now,.05);lp.frequency.setTargetAtTime(380+charge*900,now,.05);
   },
   stop(dying){
    const now=c.currentTime,end=now+(dying?1:.5);
    for(const o of [...oscs,whine])o.detune.setTargetAtTime(dying?-2400:0,now,.25);g.gain.setTargetAtTime(0,now,dying?.25:.12);
    for(const o of [...oscs,whine,throb,rumble])o.stop(end);setTimeout(()=>pan.disconnect(),(end-now+.3)*1000);
   },
  };
 }
 const play={
  throw(){noise(.28,.22,900,1.4,2200);tone(420,.16,'triangle',.06,380);},
  catch(){tone(1500,.05,'square',.04);tone(2200,.04,'sine',.04,0,.03);},
  ricochet(){tone(2600,.22,'triangle',.08,-1300);tone(3900,.12,'sine',.04);},
  hit(){tone(150,.4,'sawtooth',.22,-100);noise(.25,.25,700,.8);},
  face(){tone(90,.6,'sawtooth',.28,-50);noise(.35,.3,500,.7);tone(620,.18,'square',.06,-400);},
  slam(){tone(62,.7,'sine',.5,-30);noise(.55,.35,240,.6);},
  // a sink landing: the slam, and porcelain smashing
  sink(at?:THREE.Vector3){from(at,()=>{tone(62,.7,'sine',.5,-30);if(!clip('sink',.8))noise(.55,.35,240,.6);},14);},
  derez(at?:THREE.Vector3){from(at,()=>{for(let i=0;i<6;i++)tone(1400-i*190,.09,'square',.05,0,i*.05);noise(.4,.12,3000,.8,-2400);},14);},
  pock(perfect:boolean){tone(perfect?1320:880,.08,'sine',.32);noise(.05,.3,perfect?5200:3200,1.2);if(perfect)tone(1980,.12,'triangle',.08,0,.02);},
  whiff(){noise(.16,.1,1400,1,-800);},
  charge(){tone(260,.75,'sawtooth',.05,700);},
  serve(at?:THREE.Vector3){from(at,()=>{tone(520,.28,'sawtooth',.09,260);noise(.2,.12,1800,1.2);},16);},
  hurt(){tone(240,.3,'square',.13,-140);},
  shatter(){noise(.16,.2,5200,2);tone(1900,.09,'square',.04,-900);},
  whistle(){tone(2100,1.6,'sine',.05,-1500);},
  boom(){tone(45,1.6,'sine',.6,-15);if(clip('blast',.9))return;noise(1.4,.45,180,.5);for(let i=0;i<5;i++)noise(.3,.2,400+i*300,.8,0,.25*i);},
  spot(){tone(990,.08,'square',.05);tone(1320,.1,'square',.05,0,.09);},
  // a doge: "ruff ruff", or once, higher
  bark(at?:THREE.Vector3,twice=true){from(at,()=>{if(clip('bark',.6))return;const f=rand(480,640);yap(f,.5);if(twice)yap(f*rand(.9,1),.42,rand(.16,.22));},6);},
  // a doge on the tackle
  growl(at?:THREE.Vector3){from(at,()=>{if(!clip('growl',.6))yap(rand(330,400),.45);},6);},
  // a bonked doge, off to the moon: a yelp, and the rocket lighting under it
  yelp(at?:THREE.Vector3){from(at,()=>{if(!clip('yelp',.6)){yap(rand(900,1100),.45);yap(rand(1100,1300),.35,.13);}if(!clip('rocket',.5,.2))noise(1.4,.2,400,.7,3000,.2);},6);},
  zap(at?:THREE.Vector3){from(at,()=>{noise(.07,.1,4200,3);tone(2600+Math.random()*2200,.05,'sawtooth',.025,-1500);},10);},
  pulse(){tone(70,1.1,'sawtooth',.3,160);noise(.9,.3,500,.6,2600);},
  grok(){tone(660,.07,'sine',.07);tone(990,.09,'sine',.06,0,.08);},
  tick(){tone(1760,.05,'square',.04);},
  whine(){tone(180,4.4,'sawtooth',.07,1900);tone(183,4.4,'square',.03,1880);},
  alarm(){for(let i=0;i<8;i++){tone(i%2?620:880,.24,'square',.045,0,i*.26);}},
  wind(){noise(18,.16,260,.4,-80);noise(18,.07,900,.8,300,1);},
  warp(at?:THREE.Vector3){from(at,()=>{noise(1.1,.22,3400,1,-3000);tone(1500,.9,'sawtooth',.05,-1300);},24);},
  portal(at?:THREE.Vector3){from(at,()=>{tone(48,2.6,'sawtooth',.22,30);tone(97,2.6,'square',.06,60);noise(2.4,.25,260,.5,1400);},40);},
  // the Cybertruck (cybertruck.ts): revving at the end of its lane (an electric whine it doesn't need, and a
  // growl it doesn't have), launching down it, and its tyres on the Grid
  rev(at?:THREE.Vector3){from(at,()=>{tone(52,2,'sawtooth',.2,90);tone(104,2,'square',.06,200);tone(700,2,'sine',.03,2100);noise(2,.12,260,.7,700);},16);},
  launch(at?:THREE.Vector3){from(at,()=>{tone(150,.9,'sawtooth',.18,-90);noise(.9,.3,900,.8,-600);tone(2800,.7,'sine',.04,-2000);},18);},
  // the sky glitching (skyglitch.ts): a stutter of corrupted bits
  glitch(){for(let i=0;i<12;i++){const d=i*.06+Math.random()*.03;tone(160+Math.random()*2400,.045,'square',.05,0,d);if(i%3===0)noise(.05,.1,2500+Math.random()*4000,2.5,0,d);}},
  screech(at?:THREE.Vector3){from(at,()=>{noise(.55,.18,2900,7,-700);noise(.4,.08,1700,5,300,.05);},14);},
 };
 // Doom's tracks (scripts/prepare-doom-music.mjs renders them into ignored doom-web/local/): one at a time,
 // fading across; null fades out. A missing file is silence.
 async function music(url:string|null,{vol=.4,fade=1.5}={}){
  if(!ctx||!duckBus||want===url)return;want=url;
  const t=ctx.currentTime,old=song;song=null;
  if(old){old.gain.gain.cancelScheduledValues(t);old.gain.gain.setValueAtTime(old.gain.gain.value,t);old.gain.gain.linearRampToValueAtTime(0,t+fade);old.src.stop(t+fade+.05);}
  if(!url)return;
  try{
   const r=await fetch(url);if(!r.ok)return;const buf=await ctx.decodeAudioData(await r.arrayBuffer());if(want!==url)return;// another track was asked for meanwhile
   const src=ctx.createBufferSource(),gain=ctx.createGain(),now=ctx.currentTime;src.buffer=buf;src.loop=true;
   gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(vol,now+fade);src.connect(gain).connect(duckBus);src.start(now);song={src,gain};
  }catch{/* no track: silence */}
 }
 return {ensure,play,music,engine,powerDown,
  // every frame: hear from the camera, and let a disk seek now and then
  listen(cam:THREE.Camera){
   if(!ctx)return;const l=ctx.listener,t=ctx.currentTime;cam.getWorldPosition(ear);cam.getWorldDirection(look);
   l.positionX.setTargetAtTime(ear.x,t,.02);l.positionY.setTargetAtTime(ear.y,t,.02);l.positionZ.setTargetAtTime(ear.z,t,.02);
   l.forwardX.setTargetAtTime(look.x,t,.02);l.forwardY.setTargetAtTime(look.y,t,.02);l.forwardZ.setTargetAtTime(look.z,t,.02);
   if(fanPans.length&&t>seekAt){if(seekAt)seek();seekAt=t+rand(2.5,8);}
  },
  toggle(){muted=!muted;if(master)master.gain.value=muted?0:.55;if(songBus)songBus.gain.value=muted?0:1;return muted;},get muted(){return muted;},
  get track(){return want;},
  // how much of the bed you hear, 0..1 (the walk in turns it up as you near the door)
  near(k:number){nearK=k;if(ctx&&bedBus)bedBus.gain.setTargetAtTime(k,ctx.currentTime,.4);},get nearness(){return nearK;},
  // which effects have recorded takes loaded
  get recorded(){return [...clips].filter(([,t])=>t.length).map(([n])=>n);},
  duck(on:boolean){if(ctx&&duckBus)duckBus.gain.setTargetAtTime(on?.6:1,ctx.currentTime,.15);},
  // for the voice takes (voice.ts), which share the mute and the cut to silence
  audio(){return ctx&&master?{ctx,out:master as AudioNode}:null;},
  // a hard cut to silence (the ending's cut to black), and back
  hush(on:boolean){if(ctx&&master)master.gain.setTargetAtTime(on||muted?0:.55,ctx.currentTime,.015);}};
}
export type Sfx=ReturnType<typeof makeSfx>;

// Square additive points: derez pixels, sparks, shatter.
export class Sparks{
 max=5000;cursor=0;pos=new Float32Array(this.max*3);vel=new Float32Array(this.max*3);life=new Float32Array(this.max);span=new Float32Array(this.max);base=new Float32Array(this.max*3);col=new Float32Array(this.max*3);grav=new Float32Array(this.max);
 geo=new THREE.BufferGeometry();points:THREE.Points;
 constructor(scene:THREE.Scene){
  this.pos.fill(-1e4);this.geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));this.geo.setAttribute('color',new THREE.BufferAttribute(this.col,3));
  this.points=new THREE.Points(this.geo,new THREE.PointsMaterial({size:.15,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  this.points.frustumCulled=false;scene.add(this.points);
 }
 burst(p:THREE.Vector3,color:string,count:number,speed:number,{gravity=-9,up=0,spread=0,life=.9}={}){
  const c=new THREE.Color(color);
  for(let n=0;n<count;n++){
   const i=this.cursor++%this.max,u=Math.random()*2-1,a=Math.random()*TAU,s=Math.sqrt(1-u*u),v=speed*(.35+Math.random()*.65);
   this.pos[i*3]=p.x+(Math.random()-.5)*spread;this.pos[i*3+1]=p.y+(Math.random()-.5)*spread;this.pos[i*3+2]=p.z+(Math.random()-.5)*spread;
   this.vel[i*3]=Math.cos(a)*s*v;this.vel[i*3+1]=u*v+up;this.vel[i*3+2]=Math.sin(a)*s*v;
   this.life[i]=this.span[i]=life*(.6+Math.random()*.6);this.grav[i]=gravity;this.base[i*3]=c.r;this.base[i*3+1]=c.g;this.base[i*3+2]=c.b;
  }
 }
 update(dt:number){
  for(let i=0;i<this.max;i++){
   if(this.life[i]<=0)continue;this.life[i]-=dt;
   if(this.life[i]<=0){this.pos[i*3+1]=-1e4;this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0;continue;}
   this.vel[i*3+1]+=this.grav[i]*dt;for(let k=0;k<3;k++)this.pos[i*3+k]+=this.vel[i*3+k]*dt;
   if(this.pos[i*3+1]<.02){this.pos[i*3+1]=.02;this.vel[i*3+1]*=-.25;this.vel[i*3]*=.6;this.vel[i*3+2]*=.6;}
   const f=Math.min(1,this.life[i]/this.span[i]*1.6);for(let k=0;k<3;k++)this.col[i*3+k]=this.base[i*3+k]*f;
  }
  this.geo.attributes.position.needsUpdate=true;this.geo.attributes.color.needsUpdate=true;
 }
}

export class Trail{
 pos:Float32Array;line:THREE.Line;
 constructor(scene:THREE.Scene,color:string,at:THREE.Vector3,public n=22){
  this.pos=new Float32Array(this.n*3);const col=new Float32Array(this.n*3),c=new THREE.Color(color);
  for(let i=0;i<this.n;i++){const f=Math.pow(1-i/this.n,1.6);col[i*3]=c.r*f;col[i*3+1]=c.g*f;col[i*3+2]=c.b*f;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  this.line=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.line.frustumCulled=false;
  scene.add(this.line);this.reset(at);
 }
 reset(p:THREE.Vector3){for(let i=0;i<this.n;i++){this.pos[i*3]=p.x;this.pos[i*3+1]=p.y;this.pos[i*3+2]=p.z;}this.line.geometry.attributes.position.needsUpdate=true;}
 push(p:THREE.Vector3){this.pos.copyWithin(3,0,(this.n-1)*3);this.pos[0]=p.x;this.pos[1]=p.y;this.pos[2]=p.z;this.line.geometry.attributes.position.needsUpdate=true;}
 dispose(){this.line.removeFromParent();this.line.geometry.dispose();}
}

export function textSprite(text:string,color:string,height=1){
 const c=document.createElement('canvas'),g=c.getContext('2d')!,font='64px DoomSmall, monospace';g.font=font;
 const w=Math.ceil(g.measureText(text).width)+28;c.width=w;c.height=92;g.font=font;g.textBaseline='middle';
 g.shadowColor=color;g.shadowBlur=16;g.fillStyle=color;g.fillText(text,14,48);g.shadowBlur=0;g.fillStyle='rgba(255,255,255,.55)';g.fillText(text,14,48);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));s.scale.set(height*w/92,height,1);return s;
}

// A 3.5-inch floppy, flat on its back: dark body, glowing edges, the metal shutter, a label.
export function makeFloppy(color:string){
 const g=new THREE.Group(),bodyGeo=new THREE.BoxGeometry(.56,.05,.58);
 g.add(new THREE.Mesh(bodyGeo,new THREE.MeshBasicMaterial({color:0x07131b})),lines(bodyGeo,color));
 const shutterGeo=new THREE.BoxGeometry(.27,.058,.21).translate(.02,0,-.185);
 g.add(new THREE.Mesh(shutterGeo,new THREE.MeshBasicMaterial({color:0x33434b})),lines(shutterGeo,PAL.core,.7));
 const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d')!;
 x.fillStyle='#0b1d26';x.fillRect(0,0,128,64);x.strokeStyle=color;x.lineWidth=3;x.strokeRect(4,4,120,56);x.fillStyle=color;x.font='22px DoomSmall, monospace';x.fillText('1.44 MB',18,40);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.42,.21).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:tex}));label.position.set(0,.027,.13);g.add(label);
 const halo=new THREE.Mesh(new THREE.RingGeometry(.4,.47,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
 g.add(halo);g.userData.halo=halo;return g;
}
