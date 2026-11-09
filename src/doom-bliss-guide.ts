import * as THREE from 'three';
import {loadTexture} from './doom-texture-load';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import LINES from './doom-bliss-guide-lines.json';

// The other founder in the meadow: the first wake-up walk, and the endgame's meeting at the door
// (docs/ENDGAME.md E1-E3). No rescued roster or save mutation; the meadow reacts to his cues.
//
// The player wakes low on the far side of the big dome, facing away. The other
// founder stands on the slope above, in plain view; CONTROL.EXE is hidden behind
// the hill. Walking over starts the talk; the founder then leads over the crest,
// where the bunker comes into view, and down to its door. Spoken lines are spaced
// by the walk itself: each waits for the previous one, a minimum gap and a point
// on the route, and nothing advances while the player is out of earshot. He keeps
// walking the whole way, a little slower while talking.
export const INTRO_START={x:-45,z:-150,yaw:0};
const DOOR={x:17,z:.1};
const GREET_RANGE=7,EARSHOT=12,FALL_BEHIND=10;

type Line={key:string;text:string;handoff?:number};   // handoff: seconds into the take of "Take this"
type Guide={name:string;lines:Line[]};
type Voice={file:string;duration?:number};
type Cue={key:string;after?:number;gap:number;progress?:number};
// progress = metres walked along ROUTE before the line may start (the crest reveal is at ~18 m)
// A walk with him: where he waits, the route he leads you along (the first point is where he waits), his
// calls until you come over, his lines in order (he sets off once `leadAfter` of them have started), the
// line he says on arrival, what he hands you ("Take this"), and how he spends the time after.
type Scene={id:'intro'|'endgame';route:[number,number][];calls:string[];cues:Cue[];leadAfter:number;arrived:string;
 speed:number;talkSpeed:number;item:'wrench'|'floppy';skipLabel:string;faceFrom:{x:number;z:number};
 wander:{home:{x:number;z:number};radius:number;speed:number;minX:number;maxX:number;maxZ:number}|null};
const INTRO:Scene={id:'intro',
 route:[[-45,-120],[-36,-104],[-6,-52],[13.5,-7]],  // over the crest, down to the door's side
 calls:['call','call2','call3'],
 cues:[
  {key:'greet',gap:0},{key:'follow',gap:.5},
  {key:'recap',gap:1.2,progress:2},
  {key:'fault',gap:.8},
  {key:'situation',gap:1.5,progress:36},            // after the crest, once the bunker is in view
  {key:'mirror',gap:.6},
 ],leadAfter:2,arrived:'inside',speed:3.1,talkSpeed:2.5,item:'wrench',skipLabel:'SPACE — SKIP WALK',
 // facing the view from the crest, back to the player: they have to look around to find him
 faceFrom:{x:17,z:0},
 // Once he has walked us over he potters about in front of the bunker (never into it:
 // its walls run x 7.6..26.4 from z -.4) instead of standing like a statue.
 wander:{home:{x:13.5,z:-7},radius:4.5,speed:1.15,minX:6,maxX:25,maxZ:-3}};
// The endgame (all 20 resolved): he runs up to whichever door you came out of, says what happened, hands you
// a floppy, and once everyone is with you leads south to the gate in the meadow's edge, where he waits. With
// anyone lost, end-saved-some replaces end-saved.
export function endgameScene(at:{x:number;z:number;yaw:number},gate:{x:number;z:number},anyLost:boolean):Scene{
 // far enough ahead that he calls you over (calls start past GREET_RANGE+6)
 const post={x:at.x-Math.sin(at.yaw)*18,z:at.z-Math.cos(at.yaw)*18};
 return {id:'endgame',route:[[post.x,post.z],[gate.x,gate.z-14],[gate.x,gate.z-2]],calls:['end-call'],
  cues:[{key:anyLost?'end-saved-some':'end-saved',gap:0},{key:'end-boss',gap:.6},{key:'end-why',gap:.6},
   {key:'end-discs',gap:.8},{key:'end-everyone',gap:.8},{key:'end-go',gap:.6}],
  leadAfter:6,arrived:'end-edge',speed:4.6,talkSpeed:4,item:'floppy',skipLabel:'SPACE — SKIP',faceFrom:{x:at.x,z:at.z},wander:null};
}
const routeLength=(route:[number,number][])=>route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);

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
 // The skip (2026-11-09): its own button at the bottom right, there the whole time the walk can be skipped. It sat
 // inside the subtitle box, placed off the top of the window, so nobody ever saw it. SPACE, or a click or tap.
 skip.type='button';skip.id='guide-skip';skip.hidden=true;ui.append(speaker,line);stage.append(ui,skip);
 const coarse=matchMedia('(pointer:coarse)').matches;
 // He is placed in 3D (HRTF): a shout from behind sounds behind. Far away he is quieter,
 // duller (air) and wetter (a light outdoor reverb off the hills); close, he is dry.
 const out=audio.createGain(),air=audio.createBiquadFilter(),panner=audio.createPanner(),wet=audio.createGain(),hills=audio.createConvolver();
 air.type='lowpass';air.frequency.value=18000;
 Object.assign(panner,{panningModel:'HRTF',distanceModel:'inverse',refDistance:6,rolloffFactor:.5,maxDistance:10000});
 hills.buffer=(()=>{const rate=audio.sampleRate,n=Math.floor(rate*1.6),b=audio.createBuffer(2,n,rate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);let s=911+c*331,low=0;for(let i=0;i<n;i++){s=(s*1664525+1013904223)>>>0;low+=((s/2147483648-1)-low)*.35;d[i]=low*Math.pow(1-i/n,4)*(i<rate*.06?.2:1);}}return b;})();
 out.connect(air).connect(panner).connect(audio.destination);panner.connect(wet).connect(hills).connect(audio.destination);

 let active=false,ready=false,who:'mario'|'samwise'='mario',guide:Guide=LINES.mario as Guide,walkScene:Scene=INTRO,ROUTE=INTRO.route,ROUTE_LENGTH=routeLength(ROUTE),CUES=INTRO.cues;
 let phase:'waiting'|'leading'|'arrived'='waiting',walked=0,moving=false,facing=0,time=0,clock=0;
 let cue=0,lastEnd=-99,called=0,greeted=false,arrivedLine=false;
 let roam:{x:number,z:number}|null=null,rest=0;
 // the meadow listens: each line as it starts (and, on a skip, every line it skipped), and the handoff landing
 let onCue:((key:string)=>void)|null=null,onHandoff:(()=>void)|null=null;
 // "Take this. It's dangerous to go alone." The wrench flies from his hand to us. With
 // handoff frames (outside-assets/guide-<who>-handoff-<0..3>.png, see
 // art/bliss-guide-v1/HANDOFF.md) he also acts it out; without them the wrench alone does.
 let handoffAt=-1,handoffStart=-1,handedOver=false;
 const wrench=new THREE.Sprite(new THREE.SpriteMaterial({map:await (async()=>{const t=await loadTexture(loader,'wrench.png');t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;})(),transparent:true,alphaTest:.5,depthTest:false}));
 wrench.center.set(.5,.5);wrench.scale.set(.22,.33,1);wrench.visible=false;wrench.renderOrder=10;scene.add(wrench);
 const wrenchTexture=wrench.material.map,floppyTexture=(()=>{
  // a glowing cyan 3.5" floppy, shutter and label, drawn once
  const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d')!;
  g.fillStyle='#19d3e6';g.fillRect(1,1,14,14);g.fillStyle='#0a6f7a';g.fillRect(1,14,14,1);g.fillRect(14,1,1,14);
  g.fillStyle='#b9c2c8';g.fillRect(4,1,8,5);g.fillStyle='#38424a';g.fillRect(9,2,2,3);g.fillStyle='#f2f2ea';g.fillRect(3,8,10,6);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;return t;})();
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
  onCue?.(key);
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
  ui.hidden=!active||!line.textContent;skip.hidden=!active||ready;
 }
 function finish(){
  // Skip lands both founders at the door, so the entrance still has to be found and used.
  if(!active||ready)return;silence();
  for(let i=cue;i<CUES.length;i++)onCue?.(CUES[i].key);
  walked=ROUTE_LENGTH;phase='arrived';ready=true;cue=CUES.length;greeted=true;arrivedLine=true;
  if(!handedOver&&handoffStart<0)handoffAt=clock;   // skipping still hands it over
  const end=routePoint(walked);sprite.position.set(end.x,groundY(end.x,end.z),end.z);
  onSkip?.();updateUi();
 }
 skip.onclick=()=>{finish();skip.blur();};
 function start(ceo:string,walk:Scene=INTRO){
  who=ceo==='amodei'?'samwise':'mario';guide=LINES[who] as Guide;
  walkScene=walk;ROUTE=walk.route;ROUTE_LENGTH=routeLength(ROUTE);CUES=walk.cues;skip.textContent=coarse?walk.skipLabel.replace(/^SPACE — /,'TAP — '):walk.skipLabel;
  wrench.material.map=walk.item==='floppy'?floppyTexture:wrenchTexture;wrench.scale.set(walk.item==='floppy'?.3:.22,walk.item==='floppy'?.3:.33,1);
  // This walk's own lines (the endgame's are end-*, voiced 2026-10-28). Extra shouts (call2, call3) and the
  // endgame's lines are used only once they're recorded and listed in guide-voices.json.
  for(const l of guide.lines)if(/^end-/.test(l.key)===(walk.id!=='intro')&&(voices[who]?.[l.key]||!/^call\d|^end-/.test(l.key)))buffer(fileFor(l.key));
  active=true;ready=false;phase='waiting';walked=0;moving=false;time=0;clock=0;cue=0;lastEnd=-99;called=0;greeted=false;arrivedLine=false;roam=null;rest=0;silence();
  handoffAt=-1;handoffStart=-1;handedOver=false;wrench.visible=false;
  const [px,pz]=ROUTE[0];facing=Math.atan2(walk.faceFrom.x-px,walk.faceFrom.z-pz);sprite.visible=true;sprite.position.set(px,groundY(px,pz),pz);updateUi();
 }
 function stop(){active=false;sprite.visible=false;ui.hidden=true;skip.hidden=true;silence();}
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
    const shouts=walkScene.calls.filter((k,i)=>i===0||voices[who]?.[k]);called++;say(shouts[(called-1)%shouts.length]);
   }
   if(distance<GREET_RANGE&&!greeted&&!talking){greeted=true;cue=0;}
   if(greeted){facing=toPlayer;if(cue>=walkScene.leadAfter&&!talking)phase='leading';}
   else if(distance<EARSHOT)facing=toPlayer;
  }
  if(phase==='leading'){
   if(distance>FALL_BEHIND){facing=toPlayer;}
   else{
    walked=Math.min(ROUTE_LENGTH,walked+(talking?walkScene.talkSpeed:walkScene.speed)*dt*(distance<4?1.12:1));const p=routePoint(walked);
    sprite.position.x=p.x;sprite.position.z=p.z;facing=p.heading;moving=true;
    if(walked>=ROUTE_LENGTH)phase='arrived';
   }
  }
  if(phase==='arrived'){
   const WANDER=walkScene.wander;
   if(!ready||talking||distance<3.2||!WANDER){facing=toPlayer;roam=null;}
   else if(roam){
    const rx=roam.x-sprite.position.x,rz=roam.z-sprite.position.z,left=Math.hypot(rx,rz),step=WANDER.speed*dt;
    if(left<=step){sprite.position.x=roam.x;sprite.position.z=roam.z;roam=null;rest=time+1.5+Math.random()*3;if(Math.random()<.5)facing=toPlayer;}
    else{sprite.position.x+=rx/left*step;sprite.position.z+=rz/left*step;facing=Math.atan2(rx,rz);moving=true;}
   }
   else if(time>=rest){
    const a=Math.random()*Math.PI*2,r=1.5+Math.random()*(WANDER.radius-1.5);
    roam={x:THREE.MathUtils.clamp(WANDER.home.x+Math.cos(a)*r,WANDER.minX,WANDER.maxX),z:Math.min(WANDER.maxZ,WANDER.home.z+Math.sin(a)*r)};
   }
   if(!arrivedLine&&cue>=CUES.length&&!talking&&distance<9&&clock-lastEnd>1){arrivedLine=true;say(walkScene.arrived);}
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
   if(k>=1){wrench.visible=false;handedOver=true;clank();onHandoff?.();}
  }
  updateUi();
 }
 return{start,stop,tick,skip:finish,set onSkip(f:(()=>void)|null){onSkip=f;},set onCue(f:((key:string)=>void)|null){onCue=f;},set onHandoff(f:(()=>void)|null){onHandoff=f;},door:DOOR,
  get scene(){return walkScene.id;},get end(){const [x,z]=ROUTE[ROUTE.length-1];return {x,z};},
  get active(){return active;},get ready(){return ready;},
  getState:()=>active?{name:guide.name,character:who,scene:walkScene.id,phase,ready,clock:+clock.toFixed(2),walked:+walked.toFixed(1),route:+ROUTE_LENGTH.toFixed(1),moving,cue,called,
   speaking:speaking?.key||null,text:line.textContent,voiced:!!speaking?.buffer,handoff:handedOver?'done':handoffStart>=0?'flying':handoffAt>=0?'due':'none',actedOut:!!handoffFrames[who],x:+sprite.position.x.toFixed(2),z:+sprite.position.z.toFixed(2)}:null};
}
