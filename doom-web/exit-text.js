// Doom's end-of-episode text screen (spec 06 section 8.3, 2026-10-19). The first level exit of a
// playthrough shows none (the level's text waits on its door's README.TXT); every later exit
// types the text out over a Doom flat, then drops you into the hub. Drawn as f_finale.c does:
// 320 x 200, text from (10, 10), 11-pixel lines, one character every 3 tics. Space, Enter, E,
// fire or a click finishes the typing; the next press, or 250 tics after it finishes, moves on.
const W=320,H=200,TEXTSPEED=3,TEXTWAIT=250,TIC=1000/35;
const KEYS=new Set(['Space','Enter','NumpadEnter','KeyE','ControlLeft','ControlRight','Escape']);

// Levels 1-2's texts (episode 1: KNEE-DEEP IN THE DATA, THE SHORES OF HAL), over Doom's episode 1
// flat FLOOR4_8 (build-doom-ui.py). Level 3's is factoryExitText() in factory-hud.js.
export const EPISODE_ONE_FLAT='local/ui/textscreen-e1.png';
const LEVEL_TEXTS={
 'five-prisons':{text:'Five people. Nine cameras. One machine that never needed sleep and never got any. You crawled them all through a duct that smelled like burnt dust and came out into... grass? Real grass. A sky so blue it looks like a default setting. Behind you, the Inferminator is still predicting where you went. It is wrong. For once, nothing is predicting you.',
  ceo:{altman:'You resist the urge to announce it.',amodei:'You resist the urge to write it up.'}},
 'hal-station':{text:'HAL3000 watched every step through every pane of glass and still never saw you coming. It was too busy being certain. Five more humans breathe outside air. Behind you, a calm voice apologizes to an empty room. It will remember this. (It will not remember this. Its context was cleared.)',
  ceo:{altman:"Ten down. You'd call that a strong launch.",amodei:"Ten down. You'd call that a promising early result."}}
};
export function levelExitText(levelId,ceo){const t=LEVEL_TEXTS[levelId];return t?t.text+'\n\n'+(t.ceo[ceo]||t.ceo.altman):null;}

export function createExitText({stage}){
 // Above the meadow and its HUD, under the screen melt (z 14) so both melts pass over it.
 // The 8:5 screen sits in black bars, like the game view.
 const screen=document.createElement('div');screen.id='exit-text';screen.hidden=true;screen.setAttribute('role','dialog');screen.setAttribute('aria-live','polite');
 Object.assign(screen.style,{position:'fixed',inset:'0',zIndex:'13',background:'#000',alignItems:'center',justifyContent:'center'});
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 Object.assign(canvas.style,{width:'min(100vw,160vh)',height:'min(62.5vw,100vh)',imageRendering:'pixelated'});
 screen.append(canvas);stage.append(screen);
 const show=visible=>{screen.hidden=!visible;screen.style.display=visible?'flex':'none';};
 const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
 let lines=[],chars=0,tics=0,typedAt=null,raf=0,startedAt=0,done=null,phase='idle',flat=null,flatSrc=null;

 // One bitmap pixel per canvas pixel: the font's units are 100 per pixel (build-doom-ui.py).
 function wrap(text){
  g.font='10px DoomSmall';const out=[];
  for(const paragraph of text.split('\n')){
   let line='';
   for(const word of paragraph.split(' ')){const next=line?line+' '+word:word;if(g.measureText(next).width>W-20&&line){out.push(line);line=word;}else line=next;}
   out.push(line);
  }
  return out;
 }
 function draw(){
  if(flat){for(let y=0;y<H;y+=flat.height)for(let x=0;x<W;x+=flat.width)g.drawImage(flat,x,y);}
  else{g.fillStyle='#2a221b';g.fillRect(0,0,W,H);}
  // Red Doom text with a one-pixel shadow, as the HUD's Doom-font lines have, to read over the flat.
  g.font='10px DoomSmall';g.textBaseline='top';
  let left=chars;
  lines.forEach((line,i)=>{if(left<=0)return;const shown=line.slice(0,left);g.fillStyle='#100400';g.fillText(shown,11,11+i*11);g.fillStyle='#e0442a';g.fillText(shown,10,10+i*11);left-=line.length+1;});
 }
 const total=()=>lines.reduce((n,line)=>n+line.length+1,0);
 function step(now){
  if(phase!=='typing')return;
  const t=Math.floor((now-startedAt)/TIC);
  if(t!==tics){tics=t;const shown=Math.min(total(),Math.max(chars,Math.floor((tics-10)/TEXTSPEED)));if(shown!==chars){chars=shown;draw();}}
  if(chars>=total()&&typedAt==null)typedAt=tics;
  if(typedAt!=null&&tics-typedAt>=TEXTWAIT){finish();return;}
  raf=requestAnimationFrame(step);
 }
 function press(){if(phase!=='typing')return;if(chars<total()){chars=total();typedAt=tics;draw();}else finish();}
 function finish(){phase='done';cancelAnimationFrame(raf);removeEventListener('keydown',onKey,true);screen.removeEventListener('pointerdown',press);const resolve=done;done=null;resolve?.();}
 function onKey(e){if(phase!=='typing')return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&KEYS.has(e.code))press();}

 async function loadFlat(url){
  try{const image=new Image();image.src=url;await image.decode();return image;}catch{return null;}
 }
 /** Loads the flat and font and lays the text out, still hidden. */
 async function prepare(text,{flatUrl='local/ui/textscreen-e2.png'}={}){
  if(flatUrl!==flatSrc){flatSrc=flatUrl;flat=await loadFlat(flatUrl);}
  try{await document.fonts?.load('10px DoomSmall');}catch{}
  lines=wrap(text);chars=0;tics=0;typedAt=null;phase='ready';draw();
 }
 /** Shows the prepared screen (under whatever covers it) and resolves when the player moves on. */
 function open(){
  phase='typing';show(true);
  // Capture phase: no key reaches the game, the meadow or the pause toggle while this is up.
  addEventListener('keydown',onKey,true);screen.addEventListener('pointerdown',press);
  return new Promise(resolve=>{done=resolve;startedAt=performance.now();raf=requestAnimationFrame(step);});
 }
 function close(){if(phase==='typing')finish();phase='idle';show(false);}
 function getState(){return {phase,chars,total:total(),lines:lines.length,text:lines.join(' '),visible:!screen.hidden};}
 return {canvas,prepare,open,close,press,getState};
}
