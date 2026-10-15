// Fidelity capture for the status bar: boots the real game, drives it into a few
// states and saves, for each, the bar canvas at 1x (canvas.toDataURL), the bar as
// the browser actually painted it (screenshot crop) and the statusBar state JSON.
// scripts/statusbar-fidelity.py then rebuilds each expected bar independently from
// the WAD-derived patches with vanilla st_stuff.c/st_lib.c draw rules and diffs.
//   node scripts/statusbar-fidelity-capture.mjs [outDir]   (server on 5198, Chrome)
// Sessions load ?ceo=doomguy (the hidden QA face) so body 0 is Doomguy, as in vanilla.
import {startGame} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

const out=process.argv[2]||'output/doom-hud/fidelity';await fs.mkdir(out,{recursive:true});
const only=process.env.FIDELITY_CASES?.split(',');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
async function wait(p,test,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);if(s.mode==='error')throw Error(s.error);if(test(s))return s;await p.waitForTimeout(80);}throw Error(label);}
async function command(p,text){
 await p.keyboard.press('Backquote');await p.waitForTimeout(500);
 await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);
 await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);
}
async function face(p,angle){for(let i=0;i<16;i++){const {world:w}=await read(p),delta=((angle-w.angle+540)%360)-180;if(Math.abs(delta)<6)return;const key=delta>0?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await p.waitForTimeout(Math.min(700,Math.max(60,Math.abs(delta)*9)));await p.keyboard.up(key);await p.waitForTimeout(200);}}
async function warp(p,x,y,angle){await command(p,`warp ${x} ${y}`);await wait(p,s=>Math.hypot(s.world.x-x,s.world.y-y)<30,'warp');if(angle!==undefined)await face(p,angle);}
// One grab: the canvas pixels and the state that produced them, plus the bar as
// the browser painted it. Retried until the canvas is unchanged across the
// screenshot (the face can change between the two otherwise).
async function grab(p,name,{page=true,settle=120}={}){
 if(settle)await p.waitForTimeout(settle);
 const snap=()=>p.evaluate(()=>{const c=document.querySelector('.doom-statusbar canvas.statusbar');const s=JSON.parse(window.render_game_to_text());
  const r=c.getBoundingClientRect();return {png:c.toDataURL('image/png'),statusBar:s.statusBar,rect:{x:r.x,y:r.y,width:r.width,height:r.height},dpr:devicePixelRatio,
   view:document.querySelector('#canvas').getBoundingClientRect().toJSON(),viewport:{w:innerWidth,h:innerHeight}};});
 let g,stable=false;
 for(let attempt=0;attempt<8&&!stable;attempt++){
  g=await snap();
  await p.screenshot({path:`${out}/${name}-painted.png`,clip:{x:g.rect.x,y:g.rect.y,width:g.rect.width,height:g.rect.height}});
  if(page)await p.screenshot({path:`${out}/${name}-page.png`});
  stable=(await snap()).png===g.png;
 }
 await fs.writeFile(`${out}/${name}-canvas.png`,Buffer.from(g.png.split(',')[1],'base64'));
 const state={...g.statusBar,stable,rect:g.rect,dpr:g.dpr,view:g.view,viewport:g.viewport};
 await fs.writeFile(`${out}/${name}-state.json`,JSON.stringify(state,null,1));
 return state;
}
async function session(name,url,options,fn){
 if(only&&!only.some(o=>name.startsWith(o)))return;
 const c=await browser.newContext(options),p=await c.newPage();
 await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 try{await p.goto(url);await startGame(p);await wait(p,s=>s.mode==='playing'&&s.world.ticks>35&&s.statusBar?.ready&&s.statusBar.faceSetsLoaded.length===6,'boot',60000);await p.waitForTimeout(500);await fn(p);console.log(name,'ok');}
 catch(e){console.log(name,'FAILED',e.message);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 await c.close();
}
const base='http://127.0.0.1:5198/',desktop={viewport:{width:1280,height:800}};
const touch=viewport=>({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
try{
 await session('desktop',base+'?ceo=doomguy',desktop,async p=>{
  await grab(p,'desktop-start');
  await face(p,90);await p.keyboard.press('KeyE',{delay:80});await wait(p,s=>s.world.wrench===1,'wrench');
  await warp(p,1948,1144,90);await p.keyboard.press('Space',{delay:80});await wait(p,s=>s.world.cameras_broken===1,'camera');
  await warp(p,1936,1000,270);await p.keyboard.press('KeyE',{delay:80});await wait(p,s=>s.world.freed===1,'milo');
  await warp(p,1740,1168,90);await p.keyboard.press('KeyE',{delay:80});await wait(p,s=>s.world.gun===1&&s.world.tool===1,'gun');
  await wait(p,s=>s.statusBar.priority===0,'calm',6000);
  await grab(p,'desktop-gun');
  // A low-health turn toward the hunter: stand side-on where it finds you.
  await warp(p,-1104,1664);const w=(await read(p)).world;const toHunter=(Math.atan2(w.hunter_y-w.y,w.hunter_x-w.x)*180/Math.PI+360)%360;
  await face(p,(toHunter+270)%360);
  await wait(p,s=>/^STFT[LR]/.test(s.statusBar.drawnFace?.lump||''),'turn',30000);await grab(p,'desktop-turn',{settle:0});
 });
 await session('desktop-lowhealth',base+'?ceo=doomguy',desktop,async p=>{
  // Stand side-on where the hunter finds you until two hits leave 40% or less,
  // then catch the face turned toward its aim (pain level 2+).
  await warp(p,-1104,1664);const w=(await read(p)).world;const toHunter=(Math.atan2(w.hunter_y-w.y,w.hunter_x-w.x)*180/Math.PI+360)%360;
  await face(p,(toHunter+270)%360);
  const s=await wait(p,s=>{if(s.world.health<=0||s.mode==='lost')throw Error('died');return s.world.health<=40&&/^STFT[LR][2-4]0$/.test(s.statusBar.drawnFace?.lump||'');},'low-health turn',120000);
  await grab(p,'desktop-lowhealth-turn',{settle:0});
 });
 await session('transfer',base+'?ceo=doomguy&dev=end',desktop,async p=>{
  await grab(p,'transfer-gathered');
  for(let i=0;i<5;i++){
   const before=(await read(p)).world.controlled;
   await command(p,'kill');const s=await wait(p,s=>s.world.controlled!==before&&s.world.controlled>0||s.mode==='lost','transfer',8000);
   if(s.mode==='lost')break;
   const now=await wait(p,s=>s.statusBar.face!=='STFDEAD0'&&s.statusBar.drawnFace?.set===s.statusBar.faceSet,'face',6000);
   await grab(p,`transfer-${now.statusBar.faceSet}`);
  }
 });
 for(const [name,viewport]of [['touch-portrait',{width:390,height:844}],['touch-landscape',{width:844,height:390}]])
  await session(name,base+'?ceo=doomguy&dev=end',touch(viewport),async p=>{await grab(p,name);});
 // Phone-like pixel density (3x), normal start: the wrench picked up, the opening message gone.
 for(const [name,viewport]of [['phone-portrait',{width:390,height:844}],['phone-landscape',{width:844,height:390}]])
  await session(name,base+'?ceo=doomguy',{viewport,isMobile:true,hasTouch:true,deviceScaleFactor:3},async p=>{
   await face(p,90);await p.keyboard.press('KeyE',{delay:80});await wait(p,s=>s.world.wrench===1,'wrench');
   await p.waitForTimeout(6000);await grab(p,name);
  });
 for(const [name,viewport]of [['desktop-1440',{width:1440,height:900}],['desktop-1366',{width:1366,height:768}],['desktop-1920',{width:1920,height:1080}]])
  await session(name,base+'?ceo=doomguy',{viewport},async p=>{await grab(p,name);});
 await session('desktop-retina',base+'?ceo=doomguy',{viewport:{width:1280,height:800},deviceScaleFactor:2},async p=>{await grab(p,'desktop-retina');});
}finally{await browser.close();}
