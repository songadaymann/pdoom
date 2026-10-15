/** The booth is a local world sound. Keep its gain and listener live throughout
 * the whole three-ring sequence, rather than baking distance/pan at its start. */
export const PHONE_RANGE=36;
type Point={x:number;y:number;z:number};
type Batch={nodes:AudioNode[];sources:Set<OscillatorNode>};
export function makePhoneAudio(audio:AudioContext,position:Point){
 const bus=(audio as AudioContext&{pdoomBuses?:{sfx:GainNode}}).pdoomBuses?.sfx??audio.destination;
 const volume=audio.createGain(),panner=audio.createPanner();volume.gain.value=0;
 Object.assign(panner,{panningModel:'HRTF',distanceModel:'inverse',refDistance:6,maxDistance:PHONE_RANGE,rolloffFactor:.8});
 panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;
 volume.connect(panner).connect(bus);
 const batches=new Set<Batch>();
 let enabled=true,distance=Infinity,gain=0,rings=0;
 function cleanup(batch:Batch){if(!batches.delete(batch))return;for(const node of batch.nodes)node.disconnect();}
 function stop(){
  volume.gain.cancelScheduledValues(audio.currentTime);volume.gain.setValueAtTime(0,audio.currentTime);gain=0;
  for(const batch of batches){for(const source of batch.sources){try{source.stop();}catch{}}cleanup(batch);}
 }
 return {
  setActive(value:boolean){enabled=value;if(!value)stop();},
  update(player:Point,yaw:number,pitch:number,active:boolean){
   const now=audio.currentTime;
   distance=Math.hypot(position.x-player.x,position.y-player.y,position.z-player.z);
   if(!enabled||!active){stop();return;}
   // The meadow owns the listener while outside; native engine spatial updates
   // are already suppressed there. HRTF supplies front/back as well as left/right.
   const l=audio.listener,cp=Math.cos(pitch),sp=Math.sin(pitch),sy=Math.sin(yaw),cy=Math.cos(yaw);
   for(const [param,value] of [[l.positionX,player.x],[l.positionY,player.y],[l.positionZ,player.z],
    [l.forwardX,-sy*cp],[l.forwardY,sp],[l.forwardZ,-cy*cp],[l.upX,sy*sp],[l.upY,cp],[l.upZ,cy*sp]] as const)
    param.setValueAtTime(value,now);
   const t=Math.min(1,Math.max(0,(distance-6)/(PHONE_RANGE-6)));
   gain=.24*(1-t*t*(3-2*t));
   volume.gain.cancelScheduledValues(now);
   if(distance>=PHONE_RANGE)volume.gain.setValueAtTime(0,now);
   else volume.gain.setTargetAtTime(gain,now,.025);
  },
  ring(){
   if(!enabled||gain===0)return;
   const now=audio.currentTime,batch:Batch={nodes:[],sources:new Set()};batches.add(batch);
   const node=<T extends AudioNode>(n:T)=>{batch.nodes.push(n);return n;};
   const oscillator=(frequency:number,t:number,type:OscillatorType)=>{
    const o=node(audio.createOscillator());o.type=type;o.frequency.value=frequency;batch.sources.add(o);
    o.onended=()=>{batch.sources.delete(o);if(!batch.sources.size)cleanup(batch);};o.start(t);o.stop(t+.4);return o;
   };
   // Three double brr-brr rings, using the existing synthesized bell timbre.
   for(let r=0;r<3;r++)for(let b=0;b<2;b++){
    const t=now+r*1.7+b*.5,env=node(audio.createGain());env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(1,t+.02);
    env.gain.setValueAtTime(1,t+.34);env.gain.linearRampToValueAtTime(0,t+.38);env.connect(volume);
    const trem=node(audio.createGain());trem.gain.value=.5;trem.connect(env);
    const depth=node(audio.createGain());depth.gain.value=.5;depth.connect(trem.gain);oscillator(22,t,'sine').connect(depth);
    for(const f of [1180,1460])oscillator(f,t,'triangle').connect(trem);
   }
   rings++;
  },
  getState:()=>({range:PHONE_RANGE,distance:Number.isFinite(distance)?+distance.toFixed(2):null,gain:+gain.toFixed(4),
   spatial:'HRTF',position,active:enabled,rings,playing:batches.size>0}),
  dispose(){stop();volume.disconnect();panner.disconnect();},
 };
}
