// Opt-in prototype UI: the explicit skip, a fading title, Doom-style messages and the
// capture transition. Health, ammo, arms and p(DOOM) are on the real Doom status bar
// (doom-statusbar.js war mode). It never writes a rescue run, score or campaign save.
//
// Capture: the native side plays Doom's own death (scream, gun dropping, view sinking
// to the floor, turning to the killer). After UPLOAD_AT the last frame is snapshotted
// and we are visibly uploaded: the picture tears and glitches, then dissolves into
// rising green code, and burns out to white, which spreads from the engine view to the
// whole window. An UPLOADING CONSCIOUSNESS bar fills as it goes, then reads UPLOAD COMPLETE /
// BOOTING SAFE MODE on the white, so Bliss reads as the next place, not the end of the game.
// The white holds until the meadow is ready (reset), then fades into Bliss. The sound is synthesised
// here (original: data chatter, a rising sweep, then a bright arrival chord).
const UPLOAD_AT=1.3,DIGITISE_AT=2.4,WHITE_AT=4.7,WHITE_FULL=5.3;
const GLYPHS='01#%&*+=<>/\\|{}[]0123456789ABCDEF';

export function createPrologue({stage,skip,source,audio}){
 const panel=document.createElement('section');panel.id='prologue-hud';panel.hidden=true;
 panel.setAttribute('aria-label','The last stand');
 panel.innerHTML='<p class="war-title">THE LAST STAND</p><p class="war-objective" aria-live="polite"></p><button type="button" class="war-skip">SKIP PROLOGUE</button>';
 const veil=document.createElement('canvas');veil.id='prologue-transition';veil.hidden=true;veil.setAttribute('aria-hidden','true');
 // The white burn spreads from the engine view's box to the whole window (Bliss is full screen).
 const whiteout=document.createElement('div');whiteout.id='prologue-whiteout';whiteout.hidden=true;whiteout.setAttribute('aria-hidden','true');
 const label=document.createElement('p');label.id='prologue-upload-label';label.hidden=true;label.setAttribute('role','status');
 label.innerHTML='<span class="upload-title"></span><span class="upload-bar"><span></span></span><span class="upload-pct"></span>';
 const [labelTitle,labelBar,labelPct]=[label.querySelector('.upload-title'),label.querySelector('.upload-bar span'),label.querySelector('.upload-pct')];
 stage.append(panel,veil,whiteout,label);panel.querySelector('button').onclick=skip;
 const ctx=veil.getContext('2d');
 const frame=document.createElement('canvas'),frameCtx=frame.getContext('2d');
 let active=false,capturedAt=null,raf=0,snapshot=false,columns=[],sound=null,fadeOut=null;

 function update(s){
  active=true;stage.classList.add('prologue');panel.hidden=false;
  document.getElementById('reticle').hidden=s.phase!=='battle';
  for(const id of ['people','held-wrench','held-gun','message','prompt','doom-dialogue','threat-warning','status-line','hal-thaw','result'])document.getElementById(id)?.setAttribute('hidden','');
  // Like a Doom level name: up for the first few seconds, then gone.
  panel.querySelector('.war-title').style.opacity=s.clock<140?'1':'0';
  panel.querySelector('.war-objective').textContent=s.prompt||(s.clock>5250?'THEY KEEP COMING.':s.clock>3150?'NO RESPONSE FROM THE OTHER SQUADS.':s.clock<175?'HOLD THE LINE.':'');
  if(s.phase==='battle'){document.getElementById('hud')?.removeAttribute('hidden');return;}
  panel.hidden=true;
  if(capturedAt===null)beginCapture();
 }
 const elapsed=()=>capturedAt===null?0:(performance.now()-capturedAt)/1000;
 function beginCapture(){
  capturedAt=performance.now();snapshot=false;fadeOut=null;
  veil.hidden=false;veil.style.opacity='1';ctx.clearRect(0,0,veil.width,veil.height);
  cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
 }
 // The overlay sits exactly over the engine view (CSS); drawn at half resolution, pixelated.
 function size(){
  const w=480,h=300;
  if(veil.width!==w||veil.height!==h){veil.width=w;veil.height=h;}
  return [w,h];
 }
 function takeSnapshot(w,h){
  frame.width=w;frame.height=h;
  try{frameCtx.drawImage(source,0,0,w,h);}catch{frameCtx.fillStyle='#200';frameCtx.fillRect(0,0,w,h);}
  // The Doom status bar (with the dead face) is its own canvas over the view: include it.
  const bar=document.querySelector('#hud canvas'),view=source.getBoundingClientRect();
  if(bar&&view.width){
   const r=bar.getBoundingClientRect();
   try{frameCtx.drawImage(bar,(r.left-view.left)*w/view.width,(r.top-view.top)*h/view.height,r.width*w/view.width,r.height*h/view.height);}catch{}
  }
  // Columns of code that eat the picture from the bottom up as we are read out.
  columns=Array.from({length:Math.ceil(w/9)},(_,i)=>({x:i*9,y:h+Math.random()*h*.6,speed:.6+Math.random()*1.4,delay:Math.random()*.9}));
  snapshot=true;
 }
 function draw(){
  const t=elapsed(),[w,h]=size();
  if(t<UPLOAD_AT){ctx.clearRect(0,0,w,h);raf=requestAnimationFrame(draw);return;}   // Doom's own death plays underneath
  if(!snapshot){takeSnapshot(w,h);startSound();}
  ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  const glitch=Math.min(1,(t-UPLOAD_AT)/(DIGITISE_AT-UPLOAD_AT));
  const digit=Math.max(0,Math.min(1,(t-DIGITISE_AT)/(WHITE_AT-DIGITISE_AT)));
  // 1. The frame tears: horizontal slices jump sideways, the colour channels split.
  ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const slice=Math.max(3,Math.round(h/48));
  for(let y=0;y<h;y+=slice){
   const jump=Math.random()<.18+glitch*.4?(Math.random()-.5)*w*.12*(glitch+digit):0;
   ctx.drawImage(frame,0,y,w,slice,jump,y,w,slice);
  }
  if(glitch>.15){
   ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35*glitch;
   ctx.drawImage(frame,Math.round(4+glitch*6),0,w,h);ctx.drawImage(frame,-Math.round(3+glitch*5),0,w,h);
   ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }
  // 2. Digitised: the picture drains to green, and code climbs up out of it.
  if(digit>0){
   ctx.globalCompositeOperation='color';ctx.fillStyle=`rgba(40,255,110,${Math.min(1,digit*1.6)})`;ctx.fillRect(0,0,w,h);
   ctx.globalCompositeOperation='source-over';
   ctx.fillStyle=`rgba(0,0,0,${digit*.55})`;ctx.fillRect(0,0,w,h);
   ctx.font='bold 10px monospace';ctx.textBaseline='top';
   for(const c of columns){
    const k=Math.max(0,digit-c.delay*.5);if(!k)continue;
    c.y-=c.speed*(2+k*9);if(c.y<-80)c.y=h+Math.random()*40;
    const top=Math.max(0,c.y),bottom=Math.min(h,h-(1-k)*h*.15);
    for(let y=top,i=0;y<bottom&&i<40;y+=11,i++){
     const fresh=i===0;ctx.fillStyle=fresh?'#eaffea':`rgba(80,255,120,${Math.max(.15,1-i/22)})`;
     ctx.fillText(GLYPHS[(Math.random()*GLYPHS.length)|0],c.x,y);
    }
   }
   // Pixels lift off the picture and float up in blocks.
   for(let n=0;n<digit*60;n++){
    const bx=(Math.random()*w)|0,by=(Math.random()*h)|0,bs=2+((Math.random()*4)|0);
    ctx.fillStyle=`rgba(160,255,170,${.25+Math.random()*.5})`;ctx.fillRect(bx,by-digit*30*Math.random(),bs,bs);
   }
  }
  // Scanlines over everything.
  ctx.fillStyle='rgba(0,0,0,.22)';for(let y=0;y<h;y+=3)ctx.fillRect(0,y,w,1);
  // 3. Burn out to white.
  const white=Math.max(0,Math.min(1,(t-WHITE_AT)/(WHITE_FULL-WHITE_AT)));
  if(white>0){ctx.fillStyle=`rgba(255,255,255,${white})`;ctx.fillRect(0,0,w,h);}
  if(white>0){
   const v=source.getBoundingClientRect(),s=stage.getBoundingClientRect(),g=Math.min(1,(t-WHITE_AT)/(WHITE_FULL+.6-WHITE_AT)),e=g*g*(3-2*g);
   whiteout.hidden=false;whiteout.style.left=`${(v.left-s.left)*(1-e)}px`;whiteout.style.top=`${(v.top-s.top)*(1-e)}px`;
   whiteout.style.width=`${v.width+(s.width-v.width)*e}px`;whiteout.style.height=`${v.height+(s.height-v.height)*e}px`;
   if(fadeOut===null)whiteout.style.opacity=String(white);
   // Spread and solid: the full-window white alone carries on (no double white in the middle).
   if(e>=1&&white>=1)veil.style.opacity='0';
  }
  // The bar fills from the first code to full white, then the white says where we are going.
  if(t>=DIGITISE_AT){
   const pct=Math.round(Math.min(1,(t-DIGITISE_AT)/(WHITE_FULL-DIGITISE_AT))*100),done=pct>=100;
   label.hidden=false;label.classList.toggle('on-white',white>=.6);
   labelTitle.textContent=!done?'UPLOADING CONSCIOUSNESS':t<WHITE_FULL+1.4?'UPLOAD COMPLETE':'BOOTING SAFE MODE'+'.'.repeat(1+Math.floor((t-WHITE_FULL)*2.5)%3);
   labelBar.style.width=pct+'%';labelPct.textContent=pct+'%';
  }
  if(fadeOut!==null){
   const f=Math.min(1,(performance.now()-fadeOut)/1400);whiteout.style.opacity=String(1-f);label.style.opacity=String(1-Math.min(1,f*2));
   veil.style.opacity=whiteout.hidden?String(1-f):'0';
   if(f>=1){finish();return;}
  }
  raf=requestAnimationFrame(draw);
 }
 // Original upload sound: rising data chatter and sweep, then a bright arrival chord.
 function startSound(){
  const ac=audio?.context,bus=ac?.pdoomBuses?.sfx;if(!ac||!bus||sound)return;
  const now=ac.currentTime,end=now+(WHITE_AT-UPLOAD_AT),out=ac.createGain();out.gain.value=.9;out.connect(bus);
  const nodes=[];const keep=n=>{nodes.push(n);return n;};
  // A low engine that climbs.
  const saw=keep(ac.createOscillator());saw.type='sawtooth';saw.frequency.setValueAtTime(55,now);saw.frequency.exponentialRampToValueAtTime(220,end);
  const lp=keep(ac.createBiquadFilter());lp.type='lowpass';lp.frequency.setValueAtTime(160,now);lp.frequency.exponentialRampToValueAtTime(4200,end);lp.Q.value=6;
  const sg=keep(ac.createGain());sg.gain.setValueAtTime(0,now);sg.gain.linearRampToValueAtTime(.18,now+.4);sg.gain.linearRampToValueAtTime(.3,end);sg.gain.linearRampToValueAtTime(0,end+.35);
  saw.connect(lp).connect(sg).connect(out);saw.start(now);saw.stop(end+.4);
  // A thin rising tone on top.
  const sine=keep(ac.createOscillator());sine.type='sine';sine.frequency.setValueAtTime(220,now);sine.frequency.exponentialRampToValueAtTime(1760,end);
  const tg=keep(ac.createGain());tg.gain.setValueAtTime(0,now);tg.gain.linearRampToValueAtTime(.06,end-.3);tg.gain.linearRampToValueAtTime(0,end+.2);
  sine.connect(tg).connect(out);sine.start(now);sine.stop(end+.25);
  // Data chatter: short square blips, sparse at first, then a torrent.
  const span=end-now;
  for(let at=0;at<span;){
   const dense=at/span,f=700+Math.random()*3200,o=keep(ac.createOscillator()),g=keep(ac.createGain()),p=keep(ac.createStereoPanner());
   o.type='square';o.frequency.value=f;p.pan.value=Math.random()*1.6-.8;
   g.gain.setValueAtTime(0,now+at);g.gain.linearRampToValueAtTime(.035+dense*.03,now+at+.004);g.gain.linearRampToValueAtTime(0,now+at+.03);
   o.connect(g).connect(p).connect(out);o.start(now+at);o.stop(now+at+.04);
   at+=.16-dense*.135+Math.random()*.03;
  }
  // Static that swells.
  const noise=ac.createBuffer(1,ac.sampleRate*Math.ceil(span+1),ac.sampleRate),data=noise.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const ns=keep(ac.createBufferSource());ns.buffer=noise;
  const bp=keep(ac.createBiquadFilter());bp.type='bandpass';bp.frequency.setValueAtTime(600,now);bp.frequency.exponentialRampToValueAtTime(6000,end);bp.Q.value=1.2;
  const ng=keep(ac.createGain());ng.gain.setValueAtTime(0,now);ng.gain.linearRampToValueAtTime(.12,end);ng.gain.linearRampToValueAtTime(0,end+.25);
  ns.connect(bp).connect(ng).connect(out);ns.start(now);ns.stop(end+.3);
  // Arrival: a bright, open chord that rings on into the meadow.
  for(const [i,hz] of [523.25,659.25,783.99,1046.5,1567.98].entries()){
   const o=keep(ac.createOscillator()),g=keep(ac.createGain());o.type=i%2?'triangle':'sine';o.frequency.value=hz;
   g.gain.setValueAtTime(0,end);g.gain.linearRampToValueAtTime(.07,end+.25);g.gain.exponentialRampToValueAtTime(.0005,end+4.2);
   o.connect(g).connect(out);o.start(end);o.stop(end+4.3);
  }
  sound={out,nodes,stopAt:end+4.4};
 }
 function stopSound(){if(!sound)return;for(const n of sound.nodes){try{n.stop?.();}catch{}try{n.disconnect();}catch{}}try{sound.out.disconnect();}catch{}sound=null;}
 function finish(){
  cancelAnimationFrame(raf);veil.hidden=true;whiteout.hidden=true;label.hidden=true;label.style.opacity='';capturedAt=null;snapshot=false;fadeOut=null;
  setTimeout(()=>{if(sound&&audio?.context&&audio.context.currentTime>sound.stopAt)stopSound();},5000);
 }
 function reset(){
  if(!active)return;active=false;panel.hidden=true;stage.classList.remove('prologue');
  document.getElementById('reticle').hidden=false;
  // The meadow is ready under the white: let it come through.
  if(capturedAt!==null&&!veil.hidden)fadeOut=performance.now();
  else{veil.hidden=true;whiteout.hidden=true;label.hidden=true;}
 }
 return{update,reset,get active(){return active;},getState:()=>({capturing:capturedAt!==null,t:+elapsed().toFixed(2),snapshot,sound:!!sound,upload:label.hidden?null:labelTitle.textContent,whiteout:whiteout.hidden?0:+(whiteout.getBoundingClientRect().width/Math.max(1,stage.getBoundingClientRect().width)).toFixed(2)})};
}
