// Recorded voice lines, heard from where the speaker is. Takes live in voice/<key>.mp3,
// listed by voice/manifest.json (scripts/import-voice-lines.py); a line nobody has
// recorded stays a subtitle. Engine sounds own the AudioListener, so voices are placed
// by hand from PDOOM_DIALOGUE: bearing -> pan, distance -> level and air loss, no line of
// sight -> muffled as if through a wall, plus a shared reverb. HAL is the station PA.
const BARKS={
 'RADIO: SECOND PLATOON, MOVING UP ON YOUR SIX.':'radio-platoon',
 'RADIO: SECTOR CLEAR. THE BLAST DOOR IS OPEN - MOVE UP.':'radio-clear',
 'RADIO: THIS IS IT. EVERYONE OUT INTO THE OPEN.':'radio-open',
 "RADIO: IT'S A TRAP. THEY'RE EVERYWHERE. THEY'RE":'radio-trap',
 'ED-404: PLEASE PUT DOWN YOUR WEAPON. YOU HAVE TWENTY SECONDS TO COMPLY.':'ed404-comply'
};
const MODES={you:'self',hal:'pa',inferminator:'machine',radio:'radio',ed404:'loud'};
const modeFor=key=>MODES[key.startsWith('you-')?'you':key.split('-')[0]]||'world';

// Seeded noise with an exponential tail: a facility room, or the station's long hall.
function impulse(ctx,seconds,shape,seed){
 const rate=ctx.sampleRate,length=Math.floor(rate*seconds),buffer=ctx.createBuffer(2,length,rate);
 for(let c=0;c<2;c++){const data=buffer.getChannelData(c);let s=seed+c*7919,low=0;
  for(let i=0;i<length;i++){s=(s*1664525+1013904223)>>>0;low+=((s/2147483648-1)-low)*.55;data[i]=low*Math.pow(1-i/length,shape);}}
 return buffer;
}

export function createVoiceOver(audio){
 let manifest={takes:{}},ctx=null,bus=null,room=null,hall=null,echo=null;
 let voice=null,serial=-1,bark='',played=[],missing=new Set();
 const buffers=new Map();
 fetch('voice/manifest.json').then(r=>r.ok?r.json():null).then(m=>{if(m?.takes)manifest=m;}).catch(()=>{});
 function setup(){
  if(bus||!audio.context?.pdoomBuses)return!!bus;
  ctx=audio.context;bus=ctx.createGain();bus.gain.value=1.1;bus.connect(ctx.pdoomBuses.sfx);
  room=ctx.createConvolver();room.buffer=impulse(ctx,1.3,3.2,4021);room.connect(bus);
  hall=ctx.createConvolver();hall.buffer=impulse(ctx,3.2,2.2,7177);hall.connect(bus);
  // The PA's slap off far walls, on top of the hall.
  echo=ctx.createDelay(1);echo.delayTime.value=.23;const back=ctx.createGain();back.gain.value=.28;
  echo.connect(back);back.connect(echo);back.connect(hall);
  return true;
 }
 function take(key){return key&&manifest.takes[key]?key:null;}
 async function load(key){
  if(!buffers.has(key))buffers.set(key,fetch('voice/'+manifest.takes[key].file).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).catch(e=>{console.warn('voice',key,e.message);return null;}));
  return buffers.get(key);
 }
 function stop(){if(!voice)return;try{voice.source?.stop();}catch{}voice.done=true;voice=null;audio.duckMusic?.(false);audio.duckEffects?.(false);}
 async function start(key,place){
  stop();if(!setup())return;
  const mode=modeFor(key),v={key,mode,place,offset:0,startedAt:0,source:null,done:false,paused:false};voice=v;
  // Per line: shape (mode colour) -> wall -> air -> pan -> dry, and pan -> reverb send.
  v.shape=ctx.createBiquadFilter();v.wall=ctx.createBiquadFilter();v.air=ctx.createBiquadFilter();
  v.pan=ctx.createStereoPanner();v.dry=ctx.createGain();v.send=ctx.createGain();
  v.wall.type=v.air.type='lowpass';v.wall.frequency.value=v.air.frequency.value=18000;
  if(mode==='pa'){v.shape.type='bandpass';v.shape.frequency.value=1500;v.shape.Q.value=.55;}
  else if(mode==='radio'){v.shape.type='bandpass';v.shape.frequency.value=1800;v.shape.Q.value=1.1;}
  else{v.shape.type='highpass';v.shape.frequency.value=mode==='machine'||mode==='loud'?140:70;}
  v.shape.connect(v.wall);v.wall.connect(v.air);v.air.connect(v.pan);v.pan.connect(v.dry);v.dry.connect(bus);v.pan.connect(v.send);
  v.send.connect(mode==='pa'?hall:room);if(mode==='pa')v.pan.connect(echo);
  v.send.gain.value=mode==='pa'?.55:mode==='loud'?.35:mode==='machine'?.25:mode==='self'||mode==='radio'?.04:.14;
  position(v,place,true);
  const buffer=await load(key);if(!buffer||v.done)return;
  v.buffer=buffer;play(v);audio.duckMusic?.(true);audio.duckEffects?.(true);played.push(key);if(played.length>20)played.shift();
 }
 function play(v){
  v.source=ctx.createBufferSource();v.source.buffer=v.buffer;v.source.connect(v.shape);
  v.source.onended=()=>{if(voice===v&&!v.paused)stop();};
  v.source.start(0,v.offset);v.startedAt=ctx.currentTime;
 }
 // Doom units and degrees: x east, y north, angle counter-clockwise from east.
 function position(v,p,now){
  const t=now?0:.08,at=ctx.currentTime,set=(param,value)=>now?param.setValueAtTime(value,at):param.setTargetAtTime(value,at,t);
  let pan=0,level=v.mode==='pa'?.85:1,air=18000,wall=18000,send=v.send.gain.value;
  if((v.mode==='world'||v.mode==='machine')&&p?.from){
   const dx=p.sx-p.x,dy=p.sy-p.y,distance=Math.hypot(dx,dy),rel=Math.atan2(dy,dx)-p.angle*Math.PI/180;
   pan=distance<24?0:Math.max(-.85,Math.min(.85,-Math.sin(rel)*.85));
   level=Math.max(.12,Math.min(1,160/(160+.9*Math.max(0,distance-160))));
   air=Math.max(2400,Math.min(18000,16000*Math.exp(-distance/1400)))*(Math.cos(rel)<-.3?.65:1);
   send=(v.mode==='machine'?.25:.14)+.18*Math.min(1,distance/1500);
   // No line of sight: through a wall or round a corner.
   if(!p.seen){wall=750;level*=.6;send*=1.6;}
  }
  set(v.pan.pan,pan);set(v.dry.gain,level);set(v.air.frequency,air);set(v.wall.frequency,wall);set(v.send.gain,send*Math.min(1,level+.35));
 }
 function pause(paused){
  const v=voice;if(!v?.buffer||v.paused===paused)return;v.paused=paused;
  if(paused){v.offset+=ctx.currentTime-v.startedAt;try{v.source.stop();}catch{}v.source=null;}
  else if(v.offset<v.buffer.duration)play(v);else stop();
 }
 return {
  // state: the latest render_game_to_text state; paused: menus, pause, hidden tab.
  update(state,{levelId,paused}={}){
   const d=state?.dialogue,w=state?.world;
   if(d&&d.serial!==serial){
    serial=d.serial;
    const key=take(d.voice)||(levelId==='hal-station'&&d.site>=0&&d.line?take('lead-'+d.line):null);
    if(key)start(key,{...d,x:w?.x,y:w?.y,angle:w?.angle});
    else{if(d.voice)missing.add(d.voice);if(d.remaining>0)stop();}
   }
   if(voice&&d&&w&&voice.place&&d.serial===serial){voice.place={...d,x:w.x,y:w.y,angle:w.angle};position(voice,voice.place,false);}
   const said=state?.prologue?.prompt||'';
   if(said!==bark){bark=said;const key=take(BARKS[said]);if(key)start(key,null);}
   pause(!!paused);
  },
  stop,
  getState:()=>({recorded:Object.keys(manifest.takes).length,playing:voice?{key:voice.key,mode:voice.mode,paused:voice.paused,pan:+voice.pan.pan.value.toFixed(2),level:+voice.dry.gain.value.toFixed(2),wall:Math.round(voice.wall.frequency.value)}:null,played:[...played],unrecorded:[...missing].slice(-10)})
 };
}
