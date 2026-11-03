/* The fight's voice takes: synthetic Breeze takes of the doc "p(DOOM) Boss Fight: Lines and Sprites"
 * (2026-10-26), which scripts/import-endgame-assets.mjs levels into ignored
 * doom-web/local/endgame/voice/<key>.mp3, with manifest.json holding the words actually said and each
 * take's length; Elon's takes also carry how loud and how hissy they are every 40 ms, for his mouth. Takes
 * download in the background and decode when played. A line with no take stays a subtitle. Four buses:
 * Elon (a slapback off the arena), Grok (thin, like a chat app), the guide, and the crowd (panned to
 * where each shout comes from, and under everyone else). */
const BASE='../local/endgame/voice/';  // relative to endgame-proto/play.html
export type Bus='elon'|'grok'|'guide'|'crowd';
export const MOUTH_FPS=25;
type Chain={input:GainNode};

export class Voices{
 lines:Record<string,{text:string;sec:number;loud?:string;hiss?:string}>={};
 played=0;failed=0;
 private data=new Map<string,Promise<ArrayBuffer|null>>();
 private chains:Partial<Record<Bus,Chain>>={};
 private live:{src:AudioBufferSourceNode;bus:Bus;key:string;at:number}[]=[];
 constructor(private audio:()=>{ctx:AudioContext;out:AudioNode}|null){}
 async load(want:(key:string)=>boolean=()=>true){
  try{const r=await fetch(BASE+'manifest.json');if(r.ok)this.lines=(await r.json()).lines??{};}catch{/* no takes: subtitles */}
  const keys=Object.keys(this.lines).filter(want);let i=0;
  void Promise.all(Array.from({length:6},async()=>{while(i<keys.length)await this.get(keys[i++]);}));
 }
 has(key:string){return key in this.lines;}
 text(key:string){return this.lines[key]?.text;}
 sec(key:string){return this.lines[key]?.sec??0;}
 busy(bus:Bus){return this.live.filter(l=>l.bus===bus).length;}
 // anyone but the crowd
 talking(){return this.live.some(l=>l.bus!=='crowd');}
 private get(key:string){
  let p=this.data.get(key);
  if(!p){p=fetch(BASE+key+'.mp3').then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);this.data.set(key,p);}
  return p;
 }
 private chain(bus:Bus,ctx:AudioContext,out:AudioNode):Chain{
  let c=this.chains[bus];if(c)return c;
  const input=ctx.createGain();c={input};
  if(bus==='elon'){
   const delay=ctx.createDelay(1),back=ctx.createGain(),wet=ctx.createGain();delay.delayTime.value=.11;back.gain.value=.28;wet.gain.value=.2;
   input.connect(out);input.connect(delay).connect(wet).connect(out);delay.connect(back).connect(delay);input.gain.value=1.05;
  }else if(bus==='grok'){const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=320;input.connect(hp).connect(out);input.gain.value=.9;}
  else{input.connect(out);input.gain.value=bus==='crowd'?.8:1;}
  return this.chains[bus]=c;
 }
 // Plays a take; false if there's none. onend always comes, even when the audio can't play.
 play(key:string,{bus,gain=1,pan=0,onend}:{bus:Bus;gain?:number;pan?:number;onend?:()=>void}){
  if(!this.has(key))return false;
  const a=this.audio(),end=()=>onend?.();
  if(!a){setTimeout(end,this.sec(key)*1000);return true;}
  const {ctx,out}=a,ch=this.chain(bus,ctx,out);
  this.get(key).then(buf=>buf?ctx.decodeAudioData(buf.slice(0)):null).then(decoded=>{
   if(!decoded){this.failed++;end();return;}
   const src=ctx.createBufferSource(),g=ctx.createGain(),p=ctx.createStereoPanner();src.buffer=decoded;g.gain.value=gain;p.pan.value=Math.max(-1,Math.min(1,pan));
   const at=ctx.currentTime+.03,live={src,bus,key,at};src.connect(g).connect(p).connect(ch.input);this.live.push(live);this.played++;
   src.onended=()=>{this.live=this.live.filter(l=>l!==live);end();};src.start(at);
  }).catch(()=>{this.failed++;end();});
  return true;
 }
 // What Elon's take is doing at the moment you hear it: loudness and hiss, 0 to 1. Null when he's quiet.
 mouth():{loud:number;hiss:number}|null{
  const a=this.audio(),l=this.live.find(l=>l.bus==='elon');if(!a||!l)return null;
  const line=this.lines[l.key],ctx=a.ctx,heard=ctx.currentTime-l.at-(ctx.outputLatency||0)-(ctx.baseLatency||0);
  if(!line?.loud||heard<0)return {loud:0,hiss:0};
  const i=Math.floor(heard*MOUTH_FPS),d=(s:string)=>(s.charCodeAt(Math.min(i,s.length-1))-48)/9;
  return i>=line.loud.length?{loud:0,hiss:0}:{loud:d(line.loud),hiss:d(line.hiss??'')};
 }
 // the crowd drops under anyone talking
 tick(){
  const a=this.audio();if(!a)return;
  this.chains.crowd?.input.gain.setTargetAtTime(this.talking()?.4:.8,a.ctx.currentTime,.08);
 }
 stop(bus?:Bus){for(const l of this.live)if(!bus||l.bus===bus){l.src.onended=null;try{l.src.stop();}catch{/* never started */}}this.live=this.live.filter(l=>bus&&l.bus!==bus);}
}
