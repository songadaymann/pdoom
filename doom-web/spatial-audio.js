// Use the browser's actual PannerNode and AudioListener for Doom world sounds.
export function localityGain(state){
 const p=state.panner,l=state.listener;
 if(!p||!l||p.rolloffFactor===0)return 1;
 const d=Math.hypot((p.positionX||0)-(l.positionX||0),(p.positionY||0)-(l.positionY||0),(p.positionZ||0)-(l.positionZ||0));
 const ref=Math.max(32,p.refDistance||128),t=Math.max(0,Math.min(1,(d-ref*1.5)/(ref*3.5)));
 return 1-t*t*(3-2*t);
}
export function applySpatial(ctx,entry,state){
 const time=ctx.currentTime;
 if(state.listener)for(const[k,v]of Object.entries(state.listener))if(Number.isFinite(v)&&ctx.listener[k])ctx.listener[k].setValueAtTime(v,time);
 if(state.panner){
  if(!entry.panner){entry.panner=ctx.createPanner();entry.gain.disconnect();entry.gain.connect(entry.panner);entry.panner.connect(ctx.pdoomBuses?.effects||ctx.destination);}
  for(const[k,v]of Object.entries(state.panner)){
   if(entry.panner[k]?.setValueAtTime&&Number.isFinite(v))entry.panner[k].setValueAtTime(v,time);
   else if(typeof v==='string'||Number.isFinite(v))entry.panner[k]=typeof v==='number'?Math.min(v,1e12):v;
  }
 }
 const audibleGain=(Number.isFinite(state.gain)?state.gain:1)*localityGain(state);
 if(entry.spatial)entry.gain.gain.setTargetAtTime(audibleGain,time,.015);
 else entry.gain.gain.setValueAtTime(audibleGain,time);
 if(Number.isFinite(state.playbackRate))entry.source.playbackRate.setValueAtTime(state.playbackRate,time);
 entry.spatial={...state,audibleGain};
}
