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

export function makeStage(canvas:HTMLCanvasElement){
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
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(600,600).rotateX(-Math.PI/2),new THREE.ShaderMaterial({
  uniforms:{uLine:{value:new THREE.Color(PAL.line)},uBase:{value:new THREE.Color(PAL.floor)},uPit:{value:new THREE.Color(PAL.enemy)},uR:{value:ARENA.radius},uPitGlow:{value:1}},
  vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`uniform vec3 uLine,uBase,uPit;uniform float uR,uPitGlow;varying vec3 vW;
   float grid(vec2 p,float s,float w){vec2 q=p/s;vec2 g=abs(fract(q-.5)-.5)/(fwidth(q)*w);return 1.-min(min(g.x,g.y),1.);}
   void main(){vec2 p=vW.xz;float r=length(p),d=length(vW.xz-cameraPosition.xz);
    float inside=1.-smoothstep(uR-1.,uR+.5,r)*.85;
    float fade=mix(.3,1.,exp(-d/70.));
    vec3 c=uBase+uLine*(grid(p,4.,1.2)*.16+grid(p,16.,1.8)*.7)*fade*inside;
    c+=uPit*exp(-max(r-5.,0.)/3.5)*.5*uPitGlow;
    gl_FragColor=vec4(c,1.);}`,
 }));
 scene.add(floor);
 const ring=(r:number,y:number,color:string,n=128)=>{const pts=Array.from({length:n+1},(_,i)=>new THREE.Vector3(Math.cos(i/n*TAU)*r,y,Math.sin(i/n*TAU)*r));return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color}));};
 // The arena wall: dark, ruled with cyan, one bright band at hip height.
 const R=ARENA.radius,H=ARENA.wallH;
 scene.add(new THREE.Mesh(new THREE.CylinderGeometry(R,R,H,128,1,true).translate(0,H/2,0),new THREE.MeshBasicMaterial({color:0x03090e,side:THREE.BackSide})));
 for(const y of [.03,H*.55,H])scene.add(ring(R-.02,y,PAL.line));
 scene.add(new THREE.Mesh(new THREE.CylinderGeometry(R-.05,R-.05,.12,128,1,true).translate(0,1.3,0),new THREE.MeshBasicMaterial({color:PAL.line,side:THREE.BackSide})));
 const ribs:THREE.Vector3[]=[];for(let i=0;i<72;i++){const a=i/72*TAU;ribs.push(new THREE.Vector3(Math.cos(a)*(R-.03),0,Math.sin(a)*(R-.03)),new THREE.Vector3(Math.cos(a)*(R-.03),H,Math.sin(a)*(R-.03)));}
 scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ribs),new THREE.LineBasicMaterial({color:PAL.line,transparent:true,opacity:.18})));
 // Eight data pillars (cover), the dais round the pit, and Mars: a red dot high in the void.
 for(const p of PILLARS){const s=ARENA.pillarSize*1.45,pillar=edged(new THREE.BoxGeometry(s,ARENA.pillarH,s).translate(0,ARENA.pillarH/2,0),0x050c12,PAL.line,.55);pillar.position.set(p.x,0,p.z);pillar.rotation.y=-Math.atan2(p.z,p.x);scene.add(pillar);}
 const dais=new THREE.Mesh(new THREE.CylinderGeometry(ARENA.block-.5,ARENA.block,.5,96).translate(0,.25,0),new THREE.MeshBasicMaterial({color:0x07040a}));scene.add(dais);
 scene.add(ring(ARENA.block-.5,.52,PAL.enemy),ring(ARENA.block,.02,PAL.enemy));
 const mars=glowSprite(PAL.enemy,26);mars.position.set(-60,320,-620);scene.add(mars);
 const marsCore=new THREE.Mesh(new THREE.SphereGeometry(3.2,16,12),new THREE.MeshBasicMaterial({color:'#ff6a3a',fog:false}));marsCore.position.copy(mars.position);scene.add(marsCore);
 return {renderer,scene,camera,composer,pitLight,floor,render:()=>composer.render()};
}
export type Stage=ReturnType<typeof makeStage>;

export function makeInput(canvas:HTMLCanvasElement){
 const keys=new Set<string>(),state={yaw:0,pitch:0,locked:false};
 const press:((b:number)=>void)[]=[],key:((c:string)=>void)[]=[];
 canvas.addEventListener('mousedown',e=>{if(!state.locked){canvas.requestPointerLock?.();return;}press.forEach(f=>f(e.button));});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;});
 document.addEventListener('mousemove',e=>{if(!state.locked)return;state.yaw-=e.movementX*.0022;state.pitch=clamp(state.pitch-e.movementY*.0022,-1.25,1.25);});
 addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;keys.add(e.code);key.forEach(f=>f(e.code));});
 addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
 return {keys,state,onPress:(f:(b:number)=>void)=>press.push(f),onKey:(f:(c:string)=>void)=>key.push(f)};
}
export type Input=ReturnType<typeof makeInput>;

// Keeps a walker on the arena floor: inside the wall, outside the dais, out of the pillars.
export function resolve(p:THREE.Vector3,rad:number){
 const r=Math.hypot(p.x,p.z),max=ARENA.radius-.6-rad,min=ARENA.block+rad;
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

// Original synth sounds only, quiet; M mutes. Nothing plays until the first click.
export function makeSfx(){
 let ctx:AudioContext|null=null,master:GainNode|null=null,muted=new URLSearchParams(location.search).has('mute');
 function ensure(){
  if(!ctx){
   ctx=new AudioContext();master=ctx.createGain();master.gain.value=muted?0:.55;master.connect(ctx.destination);
   const hum=ctx.createGain(),lp=ctx.createBiquadFilter();hum.gain.value=.035;lp.type='lowpass';lp.frequency.value=260;hum.connect(lp).connect(master);
   for(const hz of [55,55.4,110.3]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(hum);o.start();}
  }
  if(ctx.state==='suspended')ctx.resume();
 }
 function tone(hz:number,dur:number,type:OscillatorType='sine',vol=.2,slide=0,delay=0){
  if(!ctx||!master)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(hz,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,hz+slide),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g).connect(master);o.start(t);o.stop(t+dur+.02);
 }
 function noise(dur:number,vol:number,hz:number,q=1,sweep=0,delay=0){
  if(!ctx||!master)return;const t=ctx.currentTime+delay,n=Math.floor(ctx.sampleRate*dur),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(hz,t);
  if(sweep)f.frequency.exponentialRampToValueAtTime(Math.max(60,hz+sweep),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(f).connect(g).connect(master);s.start(t);
 }
 const play={
  throw(){noise(.28,.22,900,1.4,2200);tone(420,.16,'triangle',.06,380);},
  catch(){tone(1500,.05,'square',.04);tone(2200,.04,'sine',.04,0,.03);},
  ricochet(){tone(2600,.22,'triangle',.08,-1300);tone(3900,.12,'sine',.04);},
  hit(){tone(150,.4,'sawtooth',.22,-100);noise(.25,.25,700,.8);},
  face(){tone(90,.6,'sawtooth',.28,-50);noise(.35,.3,500,.7);tone(620,.18,'square',.06,-400);},
  slam(){tone(62,.7,'sine',.5,-30);noise(.55,.35,240,.6);},
  derez(){for(let i=0;i<6;i++)tone(1400-i*190,.09,'square',.05,0,i*.05);noise(.4,.12,3000,.8,-2400);},
  pock(perfect:boolean){tone(perfect?1320:880,.08,'sine',.32);noise(.05,.3,perfect?5200:3200,1.2);if(perfect)tone(1980,.12,'triangle',.08,0,.02);},
  whiff(){noise(.16,.1,1400,1,-800);},
  charge(){tone(260,.75,'sawtooth',.05,700);},
  serve(){tone(520,.28,'sawtooth',.09,260);noise(.2,.12,1800,1.2);},
  hurt(){tone(240,.3,'square',.13,-140);},
  shatter(){noise(.16,.2,5200,2);tone(1900,.09,'square',.04,-900);},
  whistle(){tone(2100,1.6,'sine',.05,-1500);},
  boom(){tone(45,1.6,'sine',.6,-15);noise(1.4,.45,180,.5);for(let i=0;i<5;i++)noise(.3,.2,400+i*300,.8,0,.25*i);},
  spot(){tone(990,.08,'square',.05);tone(1320,.1,'square',.05,0,.09);},
  bark(){tone(780,.07,'square',.08,-260);tone(640,.09,'square',.07,-200,.11);},
  zap(){noise(.07,.1,4200,3);tone(2600+Math.random()*2200,.05,'sawtooth',.025,-1500);},
  pulse(){tone(70,1.1,'sawtooth',.3,160);noise(.9,.3,500,.6,2600);},
  grok(){tone(660,.07,'sine',.07);tone(990,.09,'sine',.06,0,.08);},
  tick(){tone(1760,.05,'square',.04);},
 };
 return {ensure,play,toggle(){muted=!muted;if(master)master.gain.value=muted?0:.55;return muted;},get muted(){return muted;}};
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

export function textSprite(text:string,color:string,height=1,weight='900'){
 const c=document.createElement('canvas'),g=c.getContext('2d')!,font=`${weight} 64px "Courier New", monospace`;g.font=font;
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
 x.fillStyle='#0b1d26';x.fillRect(0,0,128,64);x.strokeStyle=color;x.lineWidth=3;x.strokeRect(4,4,120,56);x.fillStyle=color;x.font='bold 22px "Courier New", monospace';x.fillText('1.44 MB',18,40);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.42,.21).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:tex}));label.position.set(0,.027,.13);g.add(label);
 const halo=new THREE.Mesh(new THREE.RingGeometry(.4,.47,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
 g.add(halo);g.userData.halo=halo;return g;
}
