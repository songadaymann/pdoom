// Leaving a level for Bliss (2026-10-14): Doom's own screen melt (f_wipe.c) instead of a cut.
// capture() freezes the last Doom frame (view and status bar) over the whole window, so the
// meadow can get ready behind it; play() then slides it down in 160 ragged columns at Doom's
// 35 Hz tic rate and speeds, revealing Bliss, with a synthesised (original) whoosh. With
// reduced motion it fades instead.
const COLUMNS=160,ROWS=200,TIC=1000/35;

export function createScreenMelt({stage,source,audio}){
 const veil=document.createElement('canvas');veil.id='screen-melt';veil.hidden=true;veil.setAttribute('aria-hidden','true');stage.append(veil);
 const ctx=veil.getContext('2d');
 let frame=null,y=null,raf=0,tics=0,startedAt=0,phase='idle',plays=0;

 function capture(){
  cancel();
  const scale=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(innerWidth*scale)),h=Math.max(1,Math.round(innerHeight*scale));
  frame=document.createElement('canvas');frame.width=w;frame.height=h;
  const f=frame.getContext('2d');f.imageSmoothingEnabled=false;f.fillStyle='#000';f.fillRect(0,0,w,h);
  for(const el of [source,document.querySelector('#hud canvas.statusbar')]){
   const r=el?.getBoundingClientRect();if(!r?.width||!r.height)continue;
   try{f.drawImage(el,r.left*scale,r.top*scale,r.width*scale,r.height*scale);}catch{}
  }
  veil.width=w;veil.height=h;ctx.imageSmoothingEnabled=false;ctx.drawImage(frame,0,0);veil.style.opacity='';veil.hidden=false;
  // Doom: the first column waits 0-15 tics, each next one drifts by -1..1 from its neighbour.
  y=new Int16Array(COLUMNS);y[0]=-Math.floor(Math.random()*16);
  for(let i=1;i<COLUMNS;i++)y[i]=Math.max(-15,Math.min(0,y[i-1]+Math.floor(Math.random()*3)-1));
  tics=0;phase='holding';
 }

 // One Doom tic: waiting columns count up; moving ones accelerate, then fall 8 rows a tic.
 function tic(){
  let moving=false;
  for(let i=0;i<COLUMNS;i++){
   if(y[i]<0){y[i]++;moving=true;}
   else if(y[i]<ROWS){y[i]+=Math.min(y[i]<16?y[i]+1:8,ROWS-y[i]);moving=true;}
  }
  return moving;
 }

 function draw(){
  const w=veil.width,h=veil.height;ctx.clearRect(0,0,w,h);
  for(let i=0;i<COLUMNS;i++){
   const x0=Math.round(i*w/COLUMNS),x1=Math.round((i+1)*w/COLUMNS),drop=Math.round(Math.max(0,y[i])*h/ROWS);
   if(drop<h&&x1>x0)ctx.drawImage(frame,x0,0,x1-x0,h-drop,x0,drop,x1-x0,h-drop);
  }
 }

 function whoosh(){
  const ac=audio?.context,bus=ac?.pdoomBuses?.sfx;if(!ac||!bus)return;
  const now=ac.currentTime,length=1.3,noise=ac.createBuffer(1,Math.ceil(ac.sampleRate*length),ac.sampleRate),data=noise.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const src=ac.createBufferSource();src.buffer=noise;
  const band=ac.createBiquadFilter();band.type='bandpass';band.Q.value=1.4;band.frequency.setValueAtTime(1400,now);band.frequency.exponentialRampToValueAtTime(160,now+length);
  const gain=ac.createGain();gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.2,now+.18);gain.gain.exponentialRampToValueAtTime(.001,now+length);
  src.connect(band).connect(gain).connect(bus);src.start(now);src.stop(now+length);
  src.onended=()=>{src.disconnect();band.disconnect();gain.disconnect();};
 }

 function finish(){cancelAnimationFrame(raf);raf=0;veil.hidden=true;frame=null;phase='idle';}

 // Waits two frames so the meadow has drawn behind the veil, then melts.
 function play(){
  if(phase!=='holding')return Promise.resolve();
  phase='melting';plays++;
  return new Promise(resolve=>{
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   const step=now=>{
    if(phase!=='melting'){resolve();return;}
    const t=now-startedAt;
    if(reduced){veil.style.opacity=String(Math.max(0,1-t/400));if(t>=400){finish();resolve();return;}}
    else{let more=true;while(tics<Math.floor(t/TIC)&&more){more=tic();tics++;}draw();if(!more){finish();resolve();return;}}
    raf=requestAnimationFrame(step);
   };
   raf=requestAnimationFrame(()=>{raf=requestAnimationFrame(now=>{startedAt=now;if(!reduced)whoosh();step(now);});});
  });
 }

 function cancel(){if(phase!=='idle')finish();}
 function getState(){return {phase,plays,tics,columns_done:y?[...y].filter(v=>v>=ROWS).length:0};}
 return {capture,play,cancel,getState};
}
