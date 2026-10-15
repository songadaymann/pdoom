// Doom's message font is a 7-8 pixel bitmap built at 10px of font-size per glyph
// pixel. --px (one glyph pixel) follows the 8:5 game view and is snapped to whole
// device pixels, so the lettering stays as crisp as Doom's own messages.
const stage=document.querySelector('#stage');
function snapFont(){
 const dpr=devicePixelRatio||1,view=Math.min(innerWidth,innerHeight*1.6),target=Math.max(1.25,view/560);
 const snap=css=>`${Math.max(1,Math.round(css*dpr))/dpr}px`;
 stage.style.setProperty('--px',snap(target));stage.style.setProperty('--px-s',snap(target*.75));
}
let dprWatch=null;
function watchDpr(){dprWatch?.removeEventListener('change',onDpr);dprWatch=matchMedia(`(resolution: ${devicePixelRatio}dppx)`);dprWatch.addEventListener('change',onDpr);}
function onDpr(){snapFont();watchDpr();}
snapFont();watchDpr();addEventListener('resize',snapFont);
const warning=document.createElement('div');warning.id='threat-warning';warning.hidden=true;stage.append(warning);
export function updateLevelPolish(world){
 const progress=world.aim_target===world.controlled?Number(world.aim_progress)||0:0;
 const seen=world.seen_remaining>0;
 warning.hidden=!progress&&!seen;
 warning.textContent=progress?`LOCKED ${Math.round(progress*100)}%`: 'SEEN';
 warning.classList.toggle('locked',progress>0);warning.style.setProperty('--charge',progress);
}
