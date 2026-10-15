import * as THREE from 'three';
import {loadTexture} from './doom-texture-load';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import LINES from './doom-bliss-guide-lines.json';

// Owns only the first wake-up walk. No rescued roster or save mutation.
//
// The player wakes low on the far side of the big dome, facing away. The other
// founder stands on the slope above, in plain view; CONTROL.EXE is hidden behind
// the hill. Walking over starts the talk; the founder then leads over the crest,
// where the bunker comes into view, and down to its door. Spoken lines are spaced
// by the walk itself: each waits for the previous one, a minimum gap and a point
// on the route, and nothing advances while the player is out of earshot. He keeps
// walking the whole way, a little slower while talking.
export const INTRO_START={x:-45,z:-150,yaw:0};
const POST={x:-45,z:-120};                          // where the founder waits
const ROUTE=[[-45,-120],[-36,-104],[-6,-52],[13.5,-7]] as const; // over the crest, down to the door's side
const DOOR={x:17,z:.1};
// Once he has walked us over he potters about in front of the bunker (never into it:
// its walls run x 7.6..26.4 from z -.4) instead of standing like a statue.
const HOME={x:13.5,z:-7},WANDER={radius:4.5,speed:1.15,minX:6,maxX:25,maxZ:-3};
const SPEED=3.1,TALK_SPEED=2.5,GREET_RANGE=7,EARSHOT=12,FALL_BEHIND=10;

type Line={key:string;text:string;handoff?:number};   // handoff: seconds into the take of "Take this"
type Guide={name:string;lines:Line[]};
type Voice={file:string;duration?:number};
type Cue={key:string;after?:number;gap:number;progress?:number};
// progress = metres walked along ROUTE before the line may start (the crest reveal is at ~18 m)
const CUES:Cue[]=[
 {key:'greet',gap:0},{key:'follow',gap:.5},
 {key:'recap',gap:1.2,progress:2},
 {key:'fault',gap:.8},
 {key:'situation',gap:1.5,progress:36},            // after the crest, once the bunker is in view
 {key:'mirror',gap:.6},
];
const ROUTE_LENGTH=ROUTE.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-ROUTE[i][0],p[1]-ROUTE[i][1]),0);

export async function makeBlissGuide(scene:THREE.Scene,stage:HTMLElement,audio:AudioContext){
 const loader=new THREE.TextureLoader();
 const frames=await Promise.all(['mario','samwise'].map(id=>Promise.all(Array.from({length:16},async(_,n)=>{
  const t=await loadTexture(loader,`outside-assets/guide-${id}-${Math.floor(n/8)}-${n%8}.png`);
  t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;
 }))));
 const idleFrames=await Promise.all(['mario','samwise'].map(id=>Promise.all(Array.from({length:8},async(_,n)=>{
  const t=await loadTexture(loader,`outside-assets/guide-${id}-idle-${n}.png`);
  t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;
 }))));
 // Voices are optional. Drop recordings in as outside-assets/voice/guide-<mario|samwise>-<key>.mp3
 // (or list other files in guide-voices.json); each line is timed from its own audio.
 // Without a file the walk still runs on subtitles alone.
 let voices:Record<string,Record<string,Voice>>={};
 try{voices=await (await fetch('outside-assets/voice/guide-voices.json')).json();}catch{voices={};}
 const buffers=new Map<string,AudioBuffer|null>();
 const fileFor=(key:string)=>voices[who]?.[key]?.file||`outside-assets/voice/guide-${who}-${key}.mp3`;
 async function buffer(file:string){
  if(!buffers.has(file)){
   buffers.set(file,null);
   try{const r=await fetch(file);if(r.ok)buffers.set(file,await audio.decodeAudioData(await r.arrayBuffer()));}catch{}
  }
  return buffers.get(file)||null;
 }
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:frames[0][0],transparent:true,alphaTest:.5,color:0xffffff}));
 sprite.center.set(.5,0);sprite.scale.set(1.9,1.9,1);sprite.visible=false;scene.add(sprite);
 const ui=document.createElement('section');ui.id='bliss-guide';ui.hidden=true;ui.setAttribute('aria-label','Your guide');
 const speaker=document.createElement('p'),line=document.createElement('p'),skip=document.createElement('button');
 speaker.className='guide-speaker';line.className='guide-line';line.setAttribute('aria-live','polite');
 skip.textContent='SPACE — SKIP WALK';skip.type='button';skip.className='guide-skip';ui.append(speaker,line,skip);stage.append(ui);
 // He is placed in 3D (HRTF): a shout from behind sounds behind. Far away he is quieter,
 // duller (air) and wetter (a light outdoor reverb off the hills); close, he is dry.
 const out=audio.createGain(),air=audio.createBiquadFilter(),panner=audio.createPanner(),wet=audio.createGain(),hills=audio.createConvolver();
 air.type='lowpass';air.frequency.value=18000;
 Object.assign(panner,{panningModel:'HRTF',distanceModel:'inverse',refDistance:6,rolloffFactor:.5,maxDistance:10000});
 hills.buffer=(()=>{const rate=audio.sampleRate,n=Math.floor(rate*1.6),b=audio.createBuffer(2,n,rate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);let s=911+c*331,low=0;for(let i=0;i<n;i++){s=(s*1664525+1013904223)>>>0;low+=((s/2147483648-1)-low)*.35;d[i]=low*Math.pow(1-i/n,4)*(i<rate*.06?.2:1);}}return b;})();
 out.connect(air).connect(panner).connect(audio.destination);panner.connect(wet).connect(hills).connect(audio.destination);

 let active=false,ready=false,who:'mario'|'samwise'='mario',guide:Guide=LINES.mario as Guide;
 let phase:'waiting'|'leading'|'arrived'='waiting',walked=0,moving=false,facing=0,time=0,clock=0;
 let cue=0,lastEnd=-99,called=0,greeted=false,arrivedLine=false;
 let roam:{x:number,z:number}|null=null,rest=0;
 // "Take this. It's dangerous to go alone." The wrench flies from his hand to us. With
 // handoff frames (outside-assets/guide-<who>-handoff-<0..3>.png, see
 // art/bliss-guide-v1/HANDOFF.md) he also acts it out; without them the wrench alone does.
 let handoffAt=-1,handoffStart=-1,handedOver=false;
 const wrench=new THREE.Sprite(new THREE.SpriteMaterial({map:await (async()=>{const t=await loadTexture(loader,'wrench.png');t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;})(),transparent:true,alphaTest:.5,depthTest:false}));
 wrench.center.set(.5,.5);wrench.scale.set(.22,.33,1);wrench.visible=false;wrench.renderOrder=10;scene.add(wrench);
 const handoffFrames:Record<string,THREE.Texture[]>={};
 for(const id of ['mario','samwise']){
  const got:THREE.Texture[]=[];
  for(let i=0;i<4;i++){try{const t=await loader.loadAsync(`outside-assets/guide-${id}-handoff-${i}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;got.push(t);}catch{break;}}
  if(got.length===4)handoffFrames[id]=got;
 }
 function clank(){
  // An original metallic clink: two bright partials and a click, fast decay.
  const now=audio.currentTime,g=audio.createGain();g.gain.setValueAtTime(.32,now);g.gain.exponentialRampToValueAtTime(.001,now+.45);g.connect(audio.destination);
  for(const hz of [1310,2870,4120]){const o=audio.createOscillator();o.type='sine';o.frequency.value=hz;o.connect(g);o.start(now);o.stop(now+.5);}
 }
 let speaking:{key:string;text:string;until:number;source:AudioBufferSourceNode|null;started:number;offset:number;buffer:AudioBuffer|null}|null=null;
 let onSkip:(()=>void)|null=null;

 function text(key:string){return guide.lines.find(l=>l.key===key)?.text||'';}
 function say(key:string){
  const words=text(key);if(!words)return;
  // Buffers are decoded when the walk starts, so a line's length is its recording's.
  const b=buffers.get(fileFor(key))||null;
  const seconds=b?b.duration:Math.max(2.4,words.split(/\s+/).length/2.6);
  speaking={key,text:words,until:clock+seconds+.35,source:null,started:clock,offset:0,buffer:b};
  if(b)play(speaking,0);
  const at=guide.lines.find(l=>l.key===key)?.handoff;
  if(at!==undefined&&!handedOver){
   // Subtitles only: place it by the words' position in the line.
   const words=text(key).split(/\s+/),i=words.findIndex(w=>/^take$/i.test(w));
   handoffAt=clock+(b?at:Math.max(0,i)/Math.max(1,words.length)*seconds);
  }
 }
 function play(s:NonNullable<typeof speaking>,offset:number){
  if(!s.buffer)return;
  const src=audio.createBufferSource();src.buffer=s.buffer;src.connect(out);src.start(0,Math.min(offset,s.buffer.duration));
  s.source=src;s.offset=offset;s.started=clock;
 }
 function silence(){if(speaking?.source){try{speaking.source.stop();}catch{}}speaking=null;}
 function pause(paused:boolean){
  // Esc freezes the walk; the line resumes from where it stopped.
  if(!speaking?.buffer)return;
  if(paused&&speaking.source){speaking.offset+=clock-speaking.started;try{speaking.source.stop();}catch{}speaking.source=null;}
  else if(!paused&&!speaking.source&&clock<speaking.until)play(speaking,speaking.offset);
 }
 function routePoint(distance:number){
  let left=distance;
  for(let i=1;i<ROUTE.length;i++){
   const [ax,az]=ROUTE[i-1],[bx,bz]=ROUTE[i],d=Math.hypot(bx-ax,bz-az);
   if(left<=d)return {x:ax+(bx-ax)*left/d,z:az+(bz-az)*left/d,heading:Math.atan2(bx-ax,bz-az)};
   left-=d;
  }
  const [x,z]=ROUTE[ROUTE.length-1];return {x,z,heading:0};
 }
 function updateUi(){
  speaker.textContent=guide.name;line.textContent=speaking&&clock<speaking.until?speaking.text:'';
  ui.hidden=!active||!line.textContent;skip.hidden=ready;
 }
 function finish(){
  // Skip lands both founders at the door, so the entrance still has to be found and used.
  if(!active||ready)return;silence();
  walked=ROUTE_LENGTH;phase='arrived';ready=true;cue=CUES.length;greeted=true;arrivedLine=true;
  if(!handedOver&&handoffStart<0)handoffAt=clock;   // skipping still hands it over
  const end=routePoint(walked);sprite.position.set(end.x,groundY(end.x,end.z),end.z);
  onSkip?.();updateUi();
 }
 skip.onclick=finish;
 function start(ceo:string){
  who=ceo==='amodei'?'samwise':'mario';guide=LINES[who] as Guide;
  // Only recorded takes: extra shouts (call2, call3) are used once Jonathan records them.
 for(const l of guide.lines)if(voices[who]?.[l.key]||!/^call\d/.test(l.key))buffer(fileFor(l.key));
  active=true;ready=false;phase='waiting';walked=0;moving=false;time=0;clock=0;cue=0;lastEnd=-99;called=0;greeted=false;arrivedLine=false;roam=null;rest=0;silence();
  handoffAt=-1;handoffStart=-1;handedOver=false;wrench.visible=false;
  // Facing the view from the crest, back to the player: they have to look around to find him.
  facing=Math.atan2(17-POST.x,0-POST.z);sprite.visible=true;sprite.position.set(POST.x,groundY(POST.x,POST.z),POST.z);updateUi();
 }
 function stop(){active=false;sprite.visible=false;ui.hidden=true;silence();}
 function tick(dt:number,pos:THREE.Vector3,paused:boolean,yaw:number){
  if(!active)return;
  pause(paused);
  if(paused){updateUi();return;}
  clock+=dt;time+=dt;
  const dx=pos.x-sprite.position.x,dz=pos.z-sprite.position.z,distance=Math.hypot(dx,dz);
  const toPlayer=Math.atan2(dx,dz);
  // Voice comes from the founder's mouth; the listener is our eyes (Bliss owns the
  // listener: engine sounds are not played outside).
  const now=audio.currentTime,l=audio.listener,ease=(param:AudioParam,v:number,t=.05)=>param.setTargetAtTime(v,now,t);
  ease(l.positionX,pos.x);ease(l.positionY,pos.y);ease(l.positionZ,pos.z);
  ease(l.forwardX,-Math.sin(yaw));ease(l.forwardY,0);ease(l.forwardZ,-Math.cos(yaw));ease(l.upX,0);ease(l.upY,1);ease(l.upZ,0);
  ease(panner.positionX,sprite.position.x);ease(panner.positionY,sprite.position.y+1.6);ease(panner.positionZ,sprite.position.z);
  ease(air.frequency,THREE.MathUtils.clamp(18000*Math.exp(-distance/38),2600,18000),.1);
  ease(wet.gain,.1+.32*Math.min(1,distance/45),.1);ease(out.gain,1.25,.1);
  const talking=!!speaking&&clock<speaking.until;
  if(speaking&&!talking){lastEnd=clock;speaking=null;}
  moving=false;
  if(phase==='waiting'){
   // He shouts almost as soon as we wake, and keeps calling until we come over,
   // rotating through the shouts that have been recorded.
   if(!greeted&&distance>GREET_RANGE+6&&!talking&&called<8&&time>2.5+called*7){
    const shouts=['call','call2','call3'].filter(k=>k==='call'||voices[who]?.[k]);called++;say(shouts[(called-1)%shouts.length]);
   }
   if(distance<GREET_RANGE&&!greeted&&!talking){greeted=true;cue=0;}
   if(greeted){facing=toPlayer;if(cue>=2&&!talking)phase='leading';}
   else if(distance<EARSHOT)facing=toPlayer;
  }
  if(phase==='leading'){
   if(distance>FALL_BEHIND){facing=toPlayer;}
   else{
    walked=Math.min(ROUTE_LENGTH,walked+(talking?TALK_SPEED:SPEED)*dt*(distance<4?1.12:1));const p=routePoint(walked);
    sprite.position.x=p.x;sprite.position.z=p.z;facing=p.heading;moving=true;
    if(walked>=ROUTE_LENGTH)phase='arrived';
   }
  }
  if(phase==='arrived'){
   if(!ready||talking||distance<3.2){facing=toPlayer;roam=null;}
   else if(roam){
    const rx=roam.x-sprite.position.x,rz=roam.z-sprite.position.z,left=Math.hypot(rx,rz),step=WANDER.speed*dt;
    if(left<=step){sprite.position.x=roam.x;sprite.position.z=roam.z;roam=null;rest=time+1.5+Math.random()*3;if(Math.random()<.5)facing=toPlayer;}
    else{sprite.position.x+=rx/left*step;sprite.position.z+=rz/left*step;facing=Math.atan2(rx,rz);moving=true;}
   }
   else if(time>=rest){
    const a=Math.random()*Math.PI*2,r=1.5+Math.random()*(WANDER.radius-1.5);
    roam={x:THREE.MathUtils.clamp(HOME.x+Math.cos(a)*r,WANDER.minX,WANDER.maxX),z:Math.min(WANDER.maxZ,HOME.z+Math.sin(a)*r)};
   }
   if(!arrivedLine&&cue>=CUES.length&&!talking&&distance<9&&clock-lastEnd>1){arrivedLine=true;say('inside');}
   if(arrivedLine&&!talking&&!ready)ready=true;
  }
  // Ordered lines: previous finished, minimum gap, far enough along, player in earshot.
  if(greeted&&cue<CUES.length&&!talking&&distance<EARSHOT){
   const c=CUES[cue];
   // A founder may not have every beat (Sam has no Black Mirror line).
   if(!text(c.key))cue++;
   else if(clock-lastEnd>=c.gap&&walked>=(c.progress||0)){cue++;say(c.key);}
  }
  sprite.position.y=groundY(sprite.position.x,sprite.position.z)+Math.sin(time*2)*.012;
  const angle=((toPlayer-facing)*180/Math.PI+360)%360;
  const character=who==='mario'?0:1,rotation=Math.round(angle/45)%8;
  (sprite.material as THREE.SpriteMaterial).map=moving?frames[character][Math.floor(time*5)%2*8+rotation]:idleFrames[character][rotation];
  // The handoff: held out in his hand for a beat, then an arc into our hands (lower right).
  if(handoffAt>=0&&!handedOver&&clock>=handoffAt){
   if(handoffStart<0){handoffStart=clock;roam=null;facing=toPlayer;}
   const k=(clock-handoffStart)/1.3,toward=new THREE.Vector3(dx,0,dz).normalize();
   const hand=new THREE.Vector3(sprite.position.x,sprite.position.y+1.05,sprite.position.z).addScaledVector(toward,.35);
   const dest=new THREE.Vector3(pos.x-Math.sin(yaw)*.7+Math.cos(yaw)*.18,pos.y-.32,pos.z-Math.cos(yaw)*.7-Math.sin(yaw)*.18);
   wrench.visible=true;
   if(k<.35)wrench.position.copy(hand);
   else{const f=Math.min(1,(k-.35)/.65),e=f*f*(3-2*f);wrench.position.lerpVectors(hand,dest,e);wrench.position.y+=Math.sin(e*Math.PI)*.35;}
   const acting=handoffFrames[who];if(acting)(sprite.material as THREE.SpriteMaterial).map=acting[Math.min(3,Math.floor(k*4))];
   if(k>=1){wrench.visible=false;handedOver=true;clank();}
  }
  updateUi();
 }
 return{start,stop,tick,skip:finish,set onSkip(f:(()=>void)|null){onSkip=f;},door:DOOR,
  get active(){return active;},get ready(){return ready;},
  getState:()=>active?{name:guide.name,character:who,phase,ready,clock:+clock.toFixed(2),walked:+walked.toFixed(1),route:+ROUTE_LENGTH.toFixed(1),moving,cue,called,
   speaking:speaking?.key||null,text:line.textContent,voiced:!!speaking?.buffer,handoff:handedOver?'done':handoffStart>=0?'flying':handoffAt>=0?'due':'none',actedOut:!!handoffFrames[who],x:+sprite.position.x.toFixed(2),z:+sprite.position.z.toFixed(2)}:null};
}
