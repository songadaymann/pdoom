// Preserve the native OpenAL source graph without shipping PCM again when
// its gain, position, listener or playback rate changes.
self.PDSpatialAudio=(()=>{
 const active=new Map();
 const values=(node,names)=>Object.fromEntries(names.map(k=>[k,node[k]?.value??node[k]]));
 function snapshot(source){
  let gain=1,panner=null,node=source._connectedTo;
  while(node){if(node.gain)gain*=node.gain.value;if(node._kind==='panner')panner=node;node=node._connectedTo;}
  return {sourceId:source._id,gain,playbackRate:source.playbackRate.value,
   panner:panner?values(panner,['positionX','positionY','positionZ','orientationX','orientationY','orientationZ','panningModel','distanceModel','refDistance','maxDistance','rolloffFactor','coneInnerAngle','coneOuterAngle','coneOuterGain']):null,
   listener:panner?values(panner._listener,['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ']):null};
 }
 function track(source,when,offset,duration){
  const seconds=duration===undefined?source.buffer.duration-(offset||0):duration;
  active.set(source._id,{source,end:source.loop?Infinity:Math.max(when||0,performance.now()/1000-_audioCtxStartWall)+seconds/source.playbackRate.value+.2,last:''});
 }
 setInterval(()=>{
  const now=performance.now()/1000-_audioCtxStartWall,updates=[];
  for(const[id,item]of active){
   if(now>item.end){active.delete(id);continue;}
   const state=snapshot(item.source),key=JSON.stringify(state);
   if(key!==item.last){item.last=key;updates.push(state);}
  }
  if(updates.length)self.postMessage({audio:'spatial-update',updates});
 },50);
 return {snapshot,track,stop:id=>active.delete(id)};
})();
