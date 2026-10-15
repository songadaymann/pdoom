// Shared native QA for the Last Stand gauntlet (scripts/gauntlet.json -> output/prologue/map.json).
// Positioning is private QA (console warps, a section-scoped clear netevent); seals, doors, airlock
// crossings and waves are the real native handler.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function gauntletMeta(){return JSON.parse(await fs.readFile(new URL('../output/prologue/map.json',import.meta.url),'utf8'));}

export function gauntletQA(page,q,meta){
 const exitLock=k=>meta.airlocks.find(a=>a.pair===k&&a.role==='exit');
 const entranceLock=k=>meta.airlocks.find(a=>a.pair===k&&a.role==='entrance');
 // A console command that closes the console itself (kill) can leave it reopened: never stay paused.
 async function unpause(){const c0=(await q.read()).prologue.clock;await page.waitForTimeout(500);if((await q.read()).prologue.clock===c0){await page.evaluate(()=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code:'Backquote',key:'`',keyCode:192,which:192,bubbles:true,cancelable:true}});});await page.waitForTimeout(400);}}
 // Stand inside section k, just in front of its sealed exit, facing it.
 async function faceExit(k){
  const x=exitLock(k),rad=x.facing*Math.PI/180,back=112+40;
  await q.warp(Math.round(x.center[0]-Math.cos(rad)*back),Math.round(x.center[1]-Math.sin(rad)*back),x.facing);
 }
 async function clearSection(k){
  // `kill monsters` would also kill every later section's squad.
  await q.command('netevent pdoom_prologue_clear');await unpause();
  await q.wait(s=>s.prologue.section===k+1&&s.prologue.secured===1,`Section ${k+1} secured`,15000);
 }
 // Walk into the open exit airlock; returns once the player is in section k+2's entrance airlock.
 async function cross(k,{before,after}={}){
  // Turn to face the airlock before stepping in: the crossing can happen within a few tics, and a
  // turn still in progress would carry on in the new airlock's frame.
  const x=exitLock(k);await faceExit(k);
  await q.warp(x.center[0],x.center[1]);
  // A door that had barely begun to open shuts (and the move happens) between two 7-tic reports.
  const shutting=await q.wait(s=>s.prologue.transit===1||s.prologue.section===k+2,'Door shutting behind',8000);
  if(before&&shutting.prologue.transit===1)await before();
  await q.wait(s=>s.prologue.section===k+2,`Crossed to section ${k+2}`,8000);
  if(after)await after();
  const s=await q.read(),y=entranceLock(k);
  assert.ok(Math.hypot(s.world.x-y.center[0],s.world.y-y.center[1])<120,'Arrives in the entrance airlock');
  return s;
 }
 // Through every route section to the finale's entrance airlock (door ahead opening).
 async function toFinale({shots}={}){
  for(let k=0;k<meta.sections.length-1;k++){
   if(shots)await shots('arrive',k);
   await clearSection(k);await cross(k);
  }
  await q.wait(s=>s.prologue.transit===2&&s.prologue.stage==='open','Finale airlock',5000);
 }
 // Out of the finale airlock: walk forward until the trap springs.
 async function stepOut(){
  await page.waitForTimeout(900);await q.face(entranceLock(meta.sections.length-2).facing);
  for(let i=0;i<6&&(await q.read()).prologue.stage!=='yard';i++)await q.hold('w',500);
  await q.wait(s=>s.prologue.stage==='yard','Finale springs',8000);
 }
 return {exitLock,entranceLock,unpause,faceExit,clearSection,cross,toFinale,stepOut};
}
