/** The outdoor mix owns its music clock; facility music stays in DoomAudio. */
export function createBlissAudio(context:AudioContext,url='music/bliss.mp3'){
 const buses=(context as AudioContext & {pdoomBuses?:{music:GainNode;sfx:GainNode}}).pdoomBuses;
 // Wind over the hills: two decorrelated noise beds (left/right), each breathing in slow
 // gusts with its own phase, and a faint whistle that rises on the strongest gusts.
 const windGain=context.createGain();windGain.gain.value=0;windGain.connect(buses?.sfx??context.destination);
 const merge=context.createChannelMerger(2);merge.connect(windGain);
 const lfo=(hz:number,depth:number,target:AudioParam,phase=0)=>{const o=context.createOscillator(),g=context.createGain();o.frequency.value=hz;g.gain.value=depth;o.connect(g);g.connect(target);o.start(context.currentTime+phase);};
 for(const side of [0,1]){
  const bed=context.createBuffer(1,context.sampleRate*6,context.sampleRate),data=bed.getChannelData(0);let seed=98761+side*40503;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
  const noise=context.createBufferSource(),body=context.createBiquadFilter(),gust=context.createGain();
  noise.buffer=bed;noise.loop=true;body.type='lowpass';body.frequency.value=520;body.Q.value=.6;gust.gain.value=.75;
  noise.connect(body);body.connect(gust);gust.connect(merge,0,side);
  lfo(.07+side*.023,.35,gust.gain,side*3.1);lfo(.19+side*.04,.12,gust.gain,side*1.7);lfo(.05+side*.017,260,body.frequency,side*2.3);
  const whistle=context.createBiquadFilter(),air=context.createGain();whistle.type='bandpass';whistle.frequency.value=1650+side*240;whistle.Q.value=9;air.gain.value=.02;
  noise.connect(whistle);whistle.connect(air);air.connect(merge,0,side);lfo(.07+side*.023,.02,air.gain,side*3.1);lfo(.031,140,whistle.frequency,side*4);
  noise.start();
 }
 let active=false,buffer:AudioBuffer|null=null,source:AudioBufferSourceNode|null=null,gain:GainNode|null=null;
 let offset=0,startedAt=0,error:string|null=null,starts=0;
 const position=()=>buffer?(offset+(source?context.currentTime-startedAt:0))%buffer.duration:0;
 function sync(){
  windGain.gain.setTargetAtTime(active?.16:0,context.currentTime,.8);
  if(active&&buffer&&!source){
   source=context.createBufferSource();gain=context.createGain();source.buffer=buffer;source.loop=true;
   gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(.25,context.currentTime+1.5);
   source.connect(gain);gain.connect(buses?.music??context.destination);source.start(0,offset);startedAt=context.currentTime;starts++;
  }else if(!active&&source){
   offset=position();source.stop();source.disconnect();gain!.disconnect();source=null;gain=null;
  }
 }
 const ready=(async()=>{
  try{
   const response=await fetch(url);if(!response.ok)throw Error(`Bliss music could not load (${response.status}).`);
   buffer=await context.decodeAudioData(await response.arrayBuffer());sync();
  }catch(reason){error=reason instanceof Error?reason.message:String(reason);console.warn(error);}
 })();
 return {
  ready,
  setActive(value:boolean){active=value;sync();},
  getState(){return {track:url,loaded:!!buffer,playing:!!source,loop:true,starts,
   position:+position().toFixed(3),duration:buffer?+buffer.duration.toFixed(3):0,
   volume:gain?+gain.gain.value.toFixed(3):0,windVolume:windGain.gain.value,context:context.state,error};}
 };
}
