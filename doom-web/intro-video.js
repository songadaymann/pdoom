// Plays the rendered opening cut-scene for the chosen CEO. Resolves 'ended',
// 'skipped' or 'unavailable' (no local video), so callers can fall back to
// the text story panels. The films are built from the local WAD by
// scripts/build-intro-cutscene.py into the git-ignored local/intro/ folder.
const ALIASES={samwise:'samwise',altman:'samwise',mario:'mario',amodei:'mario'};
const KEY_GRACE_MS=600;// the Enter that started the run must not skip the film
let state=null;

// The video fills the overlay box and letterboxes inside it (a grid item at width:100% kept its
// 16:10 height and ran off the bottom of wider windows, 2026-10-13).
const CSS=`
#intro-video{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#000;opacity:1;transition:opacity .25s}
#intro-video.closing{opacity:0}
#intro-video video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;background:#000}
#intro-video .iv-button{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));padding:8px 16px;
  font:normal 16px/1.5 DoomSmall,monospace;
  color:#f6e7c6;background:#241a13e6;border:2px solid;border-color:#9b8466 #1a120c #1a120c #9b8466;cursor:pointer;text-shadow:none}
#intro-video .iv-skip{right:max(18px,env(safe-area-inset-right))}
#intro-video .iv-sound{left:max(18px,env(safe-area-inset-left))}
#intro-video .iv-button:focus-visible{outline:2px solid #e7b45a;outline-offset:2px}
#intro-video .iv-caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

function styles(){
  if(document.getElementById('intro-video-style'))return;
  const tag=document.createElement('style');tag.id='intro-video-style';tag.textContent=CSS;document.head.append(tag);
}

export function introVideoState(){
  if(!state)return null;
  const v=state.video;
  return {ceo:state.ceo,t:+(v.currentTime||0).toFixed(2),duration:+(v.duration||0).toFixed(2),paused:v.paused,muted:v.muted,caption:state.caption};
}

export async function playIntroVideo(ceo,{base='local/intro/',entry:provided,volume=.7,sound:withSound=true}={}){
  const id=ALIASES[ceo]||'samwise';
  let entry=provided;
  if(!entry){
  try{
    const response=await fetch(base+'manifest.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return 'unavailable';
    const manifest=await response.json();
    entry=manifest[id]||manifest.ceos?.[id];
  }catch{return 'unavailable';}}
  if(!entry?.file)return 'unavailable';
  styles();
  const overlay=document.createElement('div');overlay.id='intro-video';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Opening story');
  // The renderer writes paths relative to local/ ("intro/intro-x.mp4"); bare
  // file names are relative to the manifest's own folder.
  const root=base.replace(/[^/]+\/$/,'');
  const url=file=>file.includes('/')?root+file:base+file;
  const video=document.createElement('video');
  video.src=url(entry.file);video.playsInline=true;video.preload='auto';
  video.volume=volume;video.muted=!withSound;
  if(entry.poster)video.poster=url(entry.poster);
  const caption=document.createElement('p');caption.className='iv-caption';caption.setAttribute('aria-live','polite');
  const skip=document.createElement('button');skip.className='iv-button iv-skip';skip.type='button';skip.textContent='Skip ▸';
  const sound=document.createElement('button');sound.className='iv-button iv-sound';sound.type='button';sound.textContent='Sound on';sound.hidden=true;
  overlay.append(video,caption,skip,sound);document.body.append(overlay);
  const captions=(entry.captions||[]).slice().sort((a,b)=>a.t_ms-b.t_ms);
  const started=performance.now();
  state={ceo:id,video,caption:''};
  return new Promise(resolve=>{
    let done=false,played=false;
    const loadTimeout=setTimeout(()=>{if(!played)finish('unavailable');},10000);
    function finish(result){
      if(done)return;done=true;
      clearTimeout(loadTimeout);
      removeEventListener('keydown',onKey,true);document.removeEventListener('visibilitychange',onVisibility);
      video.pause();overlay.classList.add('closing');state=null;
      setTimeout(()=>{overlay.remove();resolve(result);},260);
    }
    function onKey(e){
      if(e.code==='Tab'||['Shift','Control','Alt','Meta'].includes(e.key)||e.metaKey||e.ctrlKey||e.altKey)return;
      e.preventDefault();e.stopPropagation();
      if(e.repeat||performance.now()-started<KEY_GRACE_MS)return;
      finish('skipped');
    }
    function onVisibility(){if(document.hidden)video.pause();else if(!done)video.play().catch(()=>{});}
    addEventListener('keydown',onKey,true);document.addEventListener('visibilitychange',onVisibility);
    skip.addEventListener('click',()=>finish('skipped'));
    sound.addEventListener('click',()=>{video.muted=false;sound.hidden=true;video.play().catch(()=>{});skip.focus();});
    video.addEventListener('playing',()=>{played=true;});
    video.addEventListener('ended',()=>finish('ended'));
    video.addEventListener('error',()=>finish(played?'ended':'unavailable'));
    video.addEventListener('timeupdate',()=>{
      const ms=video.currentTime*1000;
      const text=captions.filter(c=>c.t_ms<=ms&&(c.end_ms==null||ms<c.end_ms)).map(c=>c.text).join(' ');
      if(state&&text!==state.caption){state.caption=text;caption.textContent=text;}
    });
    video.play().catch(()=>{
      // Autoplay with sound was refused: play muted and offer sound.
      video.muted=true;sound.hidden=false;
      video.play().catch(()=>finish('unavailable'));
    });
    skip.focus();
  });
}
