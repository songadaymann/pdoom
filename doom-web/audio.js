import {applySpatial} from './spatial-audio.js';
// Playback bridge for the upstream worker's OpenAL audio messages.
export class DoomAudio {
  constructor(){this.context=null;this.sources=new Map();this.played=0;this.musicBuffer=null;this.musicSource=null;this.musicGain=null;this.musicOffset=0;this.musicStartedAt=0;this.entries=new Map();this.recent=[];this.spatialUpdates=0;this.cueBuffer=null;this.cuesPlayed=0;}
  unlock(){
    // effects = the engine's world sounds, under the SFX bus with the voices beside them,
    // so a spoken line can dip doors and footsteps without dipping itself.
    if(!this.context){this.context=new AudioContext();const music=this.context.createGain(),sfx=this.context.createGain(),effects=this.context.createGain();music.connect(this.context.destination);sfx.connect(this.context.destination);effects.connect(sfx);this.context.pdoomBuses={music,sfx,effects};this.setVolumes(this.volumes||{music:.7,sfx:.8});}
    // Browser autoplay may leave resume pending until the next user gesture.
    // Audio decoding/engine loading can proceed while the context is suspended.
    this.context.resume().catch(()=>{});return Promise.resolve();
  }
  setVolumes(d){this.volumes=d;if(this.context?.pdoomBuses){this.context.pdoomBuses.music.gain.value=d.music;this.context.pdoomBuses.sfx.gain.value=d.sfx;}}
  stopEffects(){for(const source of this.sources.values()){try{source.stop();}catch{}}}
  async prepareMusic(url){
    const response=await fetch(url);
    if(!response.ok)throw Error(`Could not load music (${response.status}).`);
    this.musicBuffer=await this.context.decodeAudioData(await response.arrayBuffer());this.musicUrl=url;
  }
  startMusic(){
    if(!this.musicBuffer||this.musicSource)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=this.musicBuffer;source.loop=true;gain.gain.value=0.25;
    source.connect(gain);gain.connect(this.context.pdoomBuses.music);source.start(0,this.musicOffset);
    this.musicSource=source;this.musicGain=gain;this.musicStartedAt=this.context.currentTime;
  }
  duckMusic(duck){if(this.musicGain){const t=this.context.currentTime;this.musicGain.gain.setTargetAtTime(duck ? 0.10 : 0.25,t,.12);}}
  // While a recorded line plays (voice-over.js): world sounds to 30%, quickly down, gently back.
  duckEffects(duck){const e=this.context?.pdoomBuses?.effects;if(e)e.gain.setTargetAtTime(duck?0.3:1,this.context.currentTime,duck?.05:.3);}
  pauseMusic(){
    if(!this.musicSource)return;
    this.musicOffset=(this.musicOffset+this.context.currentTime-this.musicStartedAt)%this.musicBuffer.duration;
    this.musicSource.stop();this.musicSource.disconnect();this.musicGain.disconnect();
    this.musicSource=null;this.musicGain=null;
  }
  scheduledTime(m){
    const ctx=this.context;
    if(!Number.isFinite(m.currentTime))return ctx.currentTime;
    // Worker and page performance clocks have different origins. The message
    // carries both the worker audio time and a shared-origin send timestamp.
    const transit=Number.isFinite(m.sentAt)?Math.max(0,(performance.timeOrigin+performance.now()-m.sentAt)/1000):0;
    const delay=(m.when||0)-m.currentTime-transit;
    return ctx.currentTime+Math.max(0,delay);
  }
  async prepareCue(url){const r=await fetch(url);if(!r.ok)throw Error('Success sound unavailable');this.cueBuffer=await this.context.decodeAudioData(await r.arrayBuffer());}
  playCue(){if(!this.cueBuffer)return;const s=this.context.createBufferSource(),g=this.context.createGain();s.buffer=this.cueBuffer;g.gain.value=.45;s.connect(g);g.connect(this.context.pdoomBuses.sfx);s.start();this.cuesPlayed++;s.onended=()=>{s.disconnect();g.disconnect();};}
  getState(){return {volumes:this.context?.pdoomBuses?{music:this.context.pdoomBuses.music.gain.value,sfx:this.context.pdoomBuses.sfx.gain.value,effects:+this.context.pdoomBuses.effects.gain.value.toFixed(3)}:null,cuesPlayed:this.cuesPlayed,spatialUpdates:this.spatialUpdates,active:[...this.entries.values()].map(e=>({sourceId:e.id,...e.spatial})),recent:this.recent};}
  accept(m){
    const ctx=this.context;if(!ctx)return;
    if(m.audio==='spatial-update'){for(const update of m.updates){const entry=this.entries.get(update.sourceId);if(entry){applySpatial(ctx,entry,update);this.spatialUpdates++;}}return;}
    if(m.audio==='stop'){
      const source=this.sources.get(m.sourceId);if(source){try{source.stop(this.scheduledTime(m));}catch{}}return;
    }
    if(m.audio!=='play'||!m.ch0?.length)return;
    const buffer=ctx.createBuffer(m.channels||1,m.ch0.length,m.sampleRate);
    buffer.copyToChannel(m.ch0,0);if(m.channels>1&&m.ch1)buffer.copyToChannel(m.ch1,1);
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
    source.playbackRate.value=m.playbackRate||1;source.loop=!!m.loop;
    source.loopStart=m.loopStart||0;source.loopEnd=m.loopEnd||0;
    gain.gain.value=Number.isFinite(m.gain)?m.gain:1;source.connect(gain);gain.connect(ctx.pdoomBuses?.effects||ctx.pdoomBuses?.sfx||ctx.destination);
    const entry={id:m.sourceId,source,gain};this.entries.set(m.sourceId,entry);if(m.spatial)applySpatial(ctx,entry,m.spatial);this.recent.push({sourceId:m.sourceId,frames:m.ch0.length,sampleRate:m.sampleRate,loop:m.loop,spatial:entry.spatial});if(this.recent.length>80)this.recent.shift();
    const when=this.scheduledTime(m),offset=m.offset||0;
    if(Number.isFinite(m.duration)&&m.duration>=0)source.start(when,offset,m.duration);
    else source.start(when,offset);
    this.played++;
    this.sources.set(m.sourceId,source);
    source.onended=()=>{source.disconnect();gain.disconnect();entry.panner?.disconnect();this.sources.delete(m.sourceId);this.entries.delete(m.sourceId);};
  }
}
