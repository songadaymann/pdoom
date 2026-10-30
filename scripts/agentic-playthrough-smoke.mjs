// Level 4 playthrough smoke: one cold start (no ?puzzle), all five rescues and the exit, headless and muted.
//   python3 scripts/build-agentic-preview.py      (all five rescues live in doom-web/pdoom.pk3)
//   node scripts/agentic-playthrough-smoke.mjs
// Rules: every action is real input (keys); the player may be warped between areas only while nobody
// is following (everyone freed so far is safe in the refuge), god mode is on, nobody else is ever moved
// by the test and there are no QA releases. Followers walk: the in-page sampler fails the run if any
// freed person ever moves faster than walking (18 u/tic, so CatchUp's teleport would show).
// Order: pickups and the bridge, Tallinn (he guides you home), Bengio, Bostrom, Kokotajlo (refuse three
// times and hold the bay: the slowdown), Grace; then the exit set piece (door camera smashed, STOP
// GENERATING everyone, answer the phone) into agentic-exit and the meadow melt. Writes
// output/agentic/playthrough/report.json (with timings per phase) and screenshots.
import {chromium} from '@playwright/test';
import {ORIGIN,ENGINE_FAULT,watchEngine,bootAgentic,angleTo,dist} from './agentic-qa.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/agentic/playthrough';await fs.mkdir(out,{recursive:true});
const map=JSON.parse(await fs.readFile('output/agentic/map-debug.json','utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const here=s=>[s.world.x,s.world.y];
const smithAt=s=>[s.agentic.smith_x,s.agentic.smith_y];
const person=(s,i)=>s.world.people[i];
const diff=(a,b)=>((a-b+540)%360)-180;
const pos=(s,i)=>[person(s,i).x,person(s,i).y];
const NAMES=['Jaan','Nick','Daniel','Katja','Yoshua'];
const props=Object.fromEntries(map.things.filter(t=>t.type===15402).map(t=>[t.arg0,[t.x,t.y]]));
const cam=i=>map.cameras[i];
const REFUGE=[-296,-96];

// ---- the nav grid (map-debug navigation: released-state human links) -----------------------------------
const [STEP,OX,OY,NW,NH]=map.grid,LINKS=map.navigation.human_links;
const center=n=>[OX+(n%NW+.5)*STEP,OY+(Math.floor(n/NW)+.5)*STEP];
const cellOf=([x,y])=>{const gx=Math.floor((x-OX)/STEP),gy=Math.floor((y-OY)/STEP);return gx<0||gy<0||gx>=NW||gy>=NH?-1:gy*NW+gx;};
// The route cells the game keeps shut until each rescue (Agentic.zs CloseCell), and the sunk bridge.
function closedZones(s){
 const f=s.agentic.freed,z=[];
 if(!(f&1))z.push('Booth');if(!(f&4))z.push('Bay','Crusher');if(!(f&8))z.push('Stone');if(!(f&16))z.push('Rig');if(!s.agentic.bridge_up)z.push('Bridge');
 return z;
}
const inZone=(n,zones)=>{const [x,y]=center(n);return zones.some(z=>{const [[x0,y0],[x1,y1]]=map.zones[z];return x>=x0&&x<=x1&&y>=y0&&y<=y1;});};
const open=(n,zones)=>n>=0&&n<LINKS.length&&LINKS[n]&&!inZone(n,zones);
function nearest(p,zones){
 const c=cellOf(p);let best=-1,bd=1e9;if(c<0)return -1;
 for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const n=c+dy*NW+dx;if(!open(n,zones))continue;const d=dist(center(n),p);if(d<bd){bd=d;best=n;}}
 return best;
}
function plan(from,to,zones){
 const a=nearest(from,zones),b=nearest(to,zones);if(a<0||b<0)return null;
 const prev=new Map([[a,a]]),queue=[a];
 for(let h=0;h<queue.length&&!prev.has(b);h++){
  const n=queue[h];
  for(const [bit,step] of [[1,1],[2,-1],[4,NW],[8,-NW]]){const t=n+step;if(!(LINKS[n]&bit)||prev.has(t)||!open(t,zones))continue;prev.set(t,n);queue.push(t);}
 }
 if(!prev.has(b))return null;
 const path=[b];while(path[path.length-1]!==a)path.push(prev.get(path[path.length-1]));
 return path.reverse();
}
function linked(a,b){
 if(a===b)return true;const dx=(b%NW)-(a%NW),dy=Math.floor(b/NW)-Math.floor(a/NW);
 if(Math.abs(dx)+Math.abs(dy)===1)return !!(LINKS[a]&(dx===1?1:dx===-1?2:dy===1?4:8));
 if(Math.abs(dx)===1&&Math.abs(dy)===1){const c1=a+dx,c2=a+dy*NW;return linked(a,c1)&&linked(c1,b)||linked(a,c2)&&linked(c2,b);}
 return false;
}
// A straight walk from p to q stays on linked, open cells (a conservative line of sight on the grid).
function clear(p,q,zones){
 const l=dist(p,q),n=Math.ceil(l/8);let prev=cellOf(p);
 for(let i=1;i<=n;i++){
  const c=cellOf([p[0]+(q[0]-p[0])*i/n,p[1]+(q[1]-p[1])*i/n]);if(c===prev)continue;
  if(!open(c,zones)||prev>=0&&LINKS[prev]&&!linked(prev,c))return false;prev=c;
 }
 return true;
}

// ---- run state and report --------------------------------------------------------------------------------
const PHASES=['wake','tallinn','bengio','bostrom','kokotajlo','grace','exit'];
const DEV=process.env.DEV_FROM&&process.env.DEV_FROM!=='wake'?process.env.DEV_FROM:null,FROM=DEV?PHASES.indexOf(DEV):0;
if(FROM<0)throw Error(`DEV_FROM must be one of ${PHASES}`);
const report={origin:ORIGIN,pk3:'doom-web/pdoom.pk3',dev:DEV,phases:[],passed:false};
const stats={stuns:0,unpossessed:0,doors:0,waits:0,warps:[],climbs:[]};
let page,qa,phase=null;
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const engine=[],errors=[];
const shot=n=>page.screenshot({path:`${out}/${n}.png`});
async function read(){return qa.read();}
// Possessions so far (the in-page sampler counts each new possessed bit), for per-phase and per-escort tallies.
const possessions=()=>page.evaluate(()=>window.__PT__?.poss||0);
async function startPhase(name){const s=await read();phase={name,t0:Date.now(),tick0:s.world.ticks,detail:{},before:{...stats,poss:await possessions()}};console.log(`-- ${name} (tick ${s.world.ticks})`);return phase.detail;}
async function endPhase(){const s=await read(),b=phase.before;const p={name:phase.name,seconds:+((Date.now()-phase.t0)/1000).toFixed(1),tics:s.world.ticks-phase.tick0,stuns:stats.stuns-b.stuns,unpossessed:stats.unpossessed-b.unpossessed,possessions:await possessions()-b.poss,...phase.detail};report.phases.push(p);console.log(`   done in ${p.seconds} s (${p.tics} tics)`);phase=null;return p;}
async function warp(x,y,angle){
 let s=await read();const following=[0,1,2,3,4].filter(i=>person(s,i).released&&!person(s,i).sheltered&&!person(s,i).camped);
 assert.deepEqual(following,[],`warp only while nobody follows (following: ${following.map(i=>NAMES[i])})`);
 // GZDoom's warp keeps your momentum: a run that just ended glides on at the far end. Stand still first.
 for(let t=s.world.ticks,p=here(s),end=Date.now()+4000;Date.now()<end;){await sleep(100);s=await read();if(s.world.ticks<t+3)continue;if(dist(here(s),p)<0.5)break;t=s.world.ticks;p=here(s);}
 stats.warps.push([phase?.name,x,y]);await qa.warp(x,y,angle);
}
async function swing(){await qa.hold('ControlLeft',120);}
async function useTool(tool){for(let i=0;i<3&&(await read()).world.tool!==tool;i++){await qa.press('KeyT');await sleep(200);}assert.equal((await read()).world.tool,tool,`tool ${tool}`);}

// Short real walk toward a point (bursts of W; Shift to run). Throws when it stops making progress.
async function walkTo(x,y,{near=20,timeout=20000,run=false,until}={}){
 const end=Date.now()+timeout;let best=1e9,stuck=0;
 while(Date.now()<end){
  const s=await read(),w=s.world,d=Math.hypot(x-w.x,y-w.y);if(d<near||until?.(s))return s;
  if(d<best-4){best=d;stuck=0;}else if(++stuck>6)throw Error(`walkTo ${x},${y} stuck at ${Math.round(w.x)},${Math.round(w.y)}`);
  await qa.face(angleTo(w,x,y));
  if(run&&d>60){await page.keyboard.down('ShiftLeft');await qa.hold('KeyW',Math.min(450,Math.max(60,d*1.4)));await page.keyboard.up('ShiftLeft');}
  else await qa.hold('KeyW',Math.min(450,Math.max(70,d*2.4)));
 }
 throw Error(`walkTo ${x},${y} timed out`);
}
// SMITH within reach while hunting (or answering an alarm): a wrench stun.
async function stunIfNear(s,reach=85){
 if(s.agentic.smith_mode===4||s.agentic.smith_mode===5||s.agentic.smith_mode===6||!s.agentic.smith_visible&&dist(here(s),smithAt(s))>40)return false;
 if(dist(here(s),smithAt(s))>=reach||![1,2,7,8].includes(s.agentic.smith_mode))return false;
 if(dist(here(s),smithAt(s))<18){await qa.face(angleTo(s.world,...smithAt(s)));await qa.hold('KeyS',220);s=await read();}
 await qa.face(angleTo(s.world,...smithAt(s)));await swing();await sleep(150);
 if((await read()).agentic.smith_mode===4)stats.stuns++;
 return true;
}
// A possessed follower: walk up and STOP GENERATING (and stun SMITH first if he is on top of you).
async function unpossess(i,timeout=20000){
 const bit=1<<i,end=Date.now()+timeout;
 while(Date.now()<end){
  let s=await read();if(!(s.agentic.possessed&bit))return true;
  if(await stunIfNear(s))continue;
  const p=pos(s,i);
  if(dist(here(s),p)>72){await walkTo(...p,{near:64,timeout:8000}).catch(()=>{});continue;}
  await qa.face(angleTo(s.world,...p));s=await read();
  if(s.world.prompt==='SPACE - stop generating'){await qa.press('Space');stats.unpossessed++;await sleep(200);continue;}
  await qa.hold('KeyW',90);
 }
 return false;
}
// Off the nav grid, e.g. backed into the room-3 nukage pit (floor 40) while stunning SMITH: step straight
// back up onto the nearest walkable cell (the pits sit 24 u below the floor, so a player can), then the
// caller plans again. Returns the new state, or null when there is no walkable cell within 384 u.
async function climbOut(zones){
 let s=await read();const p=here(s),c=cellOf(p);if(c<0)return null;
 let best=-1,bd=1e9;for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){const n=c+dy*NW+dx;if(!open(n,zones))continue;const d=dist(center(n),p);if(d<bd){bd=d;best=n;}}
 if(best<0)return null;
 stats.climbs.push(p.map(Math.round));
 await walkTo(...center(best),{near:14,timeout:12000}).catch(()=>{});
 return read();
}
// Between steps of a walk with people following: stun SMITH when he is on you, free anyone he took,
// and wait for anyone lagging. Returns true when it did something (the caller re-reads).
async function supervise(escort){
 let s=await read();
 for(const i of escort)if(s.agentic.possessed&(1<<i)){await unpossess(i);return true;}
 if(await stunIfNear(s))return true;
 for(const i of escort){
  const p=person(s,i);if(p.sheltered)continue;
  if(dist(here(s),[p.x,p.y])>250){
   stats.waits++;const end=Date.now()+20000;
   while(Date.now()<end){
    s=await read();const q=person(s,i);if(dist(here(s),[q.x,q.y])<180||q.sheltered||s.agentic.possessed&(1<<i))break;
    if(!await stunIfNear(s))await sleep(250);
   }
   s=await read();const q=person(s,i);
   if(!(s.agentic.possessed&(1<<i))&&dist(here(s),[q.x,q.y])>=180&&!q.sheltered){
    // Gone the wrong way round a wall: walk back toward them on the grid.
    await travel([q.x,q.y],{escort:[],near:120,timeout:30000}).catch(()=>{});
   }
   return true;
  }
 }
 return false;
}
// Real walking along the nav grid (pure pursuit on a BFS route over the cells that are open now).
// Doors: a press of SPACE when stuck (Doom's own use). Escort: supervise() between steps.
async function travel(to,{escort=[],run=false,near=24,timeout=180000,zones}={}){
 const end=Date.now()+timeout;let s=await read();
 let path=plan(here(s),to,zones||closedZones(s));if(!path&&(s=await climbOut(zones||closedZones(s))))path=plan(here(s),to,zones||closedZones(s));
 if(!path)throw Error(`no route from ${here(s||await read()).map(Math.round)} to ${to}`);
 let pts=[...path.map(center),to],idx=0,best=1e9,stuck=0,pushes=0;
 while(Date.now()<end){
  if(escort.length&&await supervise(escort)){s=await read();path=plan(here(s),to,zones||closedZones(s));if(path){pts=[...path.map(center),to];idx=0;}best=1e9;stuck=0;continue;}
  s=await read();const p=here(s),d=dist(p,to);if(d<near)return s;
  let k=idx,kd=1e9;for(let i=idx;i<Math.min(pts.length,idx+16);i++){const e=dist(p,pts[i]);if(e<kd){kd=e;k=i;}}idx=k;
  let j=idx,run_=0;
  for(let i=idx+1;i<pts.length;i++){run_+=dist(pts[i-1],pts[i]);if(run_>200)break;if(clear(p,pts[i],zones||closedZones(s)))j=i;}
  if(j===idx&&idx<pts.length-1)j=idx+1;
  const target=pts[j],td=dist(p,target);
  if(d<best-4){best=d;stuck=0;}
  else if(++stuck>5){
   if(pushes<3){pushes++;stats.doors++;await qa.face(angleTo(s.world,...target));await qa.press('Space');await sleep(700);stuck=0;best=1e9;continue;}
   // Replan from here (a door shut, a cell opened) before giving up.
   path=plan(p,to,zones||closedZones(s));if(!path||pushes>6)throw Error(`travel to ${to} stuck at ${p.map(Math.round)}`);
   pts=[...path.map(center),to];idx=0;pushes++;stuck=0;best=1e9;continue;
  }
  await qa.face(angleTo(s.world,...target));
  if(run&&td>60){await page.keyboard.down('ShiftLeft');await qa.hold('KeyW',Math.min(450,Math.max(70,td*1.3)));await page.keyboard.up('ShiftLeft');}
  else await qa.hold('KeyW',Math.min(450,Math.max(80,td*2.4)));
 }
 throw Error(`travel to ${to} timed out at ${here(await read()).map(Math.round)}`);
}
// Running along the grid route: Shift+W held, steering with the arrows between state reads (a player
// running with the mouse). Followers walk at your speed (Agentic.zs TickPeople), so they keep up and
// SMITH (2.4 u/tic at most) falls behind. Stops to stun SMITH when he is on you, to STOP GENERATING a
// follower and to wait for one who lags; falls back to travel() where running gets stuck.
const turnMs=d=>(d<=10.5?d/1.76:6+(d-10.5)/7.03)*28.57;
async function runTo(to,{escort=[],near=28,timeout=240000,lag=260}={}){
 const end=Date.now()+timeout;let s=await read(),pts=null,idx=0,lastT=-1,settle=0,mark=here(s),markAt=Date.now(),down=false;
 const go=async()=>{if(!down){await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');down=true;}};
 const halt=async()=>{if(down){await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');down=false;await sleep(120);}};
 const replan=async s=>{let path=plan(here(s),to,closedZones(s));if(!path){await halt();s=await climbOut(closedZones(s));path=s&&plan(here(s),to,closedZones(s));}
  if(!path)throw Error(`no route from ${here(s||await read()).map(Math.round)} to ${to}`);pts=[...path.map(center),to];idx=0;};
 await replan(s);
 try{
  while(Date.now()<end){
   s=await read();if(s.world.ticks===lastT||s.world.ticks<settle){await sleep(8);continue;}lastT=s.world.ticks;
   const p=here(s);if(dist(p,to)<near)return s;
   // The people with you: anyone taken over, SMITH on you, anyone lagging.
   const taken=escort.find(i=>s.agentic.possessed&(1<<i));
   const smithOn=[1,2,8].includes(s.agentic.smith_mode)&&dist(p,smithAt(s))<70;
   const lagging=escort.find(i=>!person(s,i).sheltered&&dist(p,pos(s,i))>lag);
   if(taken!==undefined||smithOn||lagging!==undefined){await halt();await supervise(escort);s=await read();await replan(s);mark=here(s);markAt=Date.now();continue;}
   let k=idx,kd=1e9;for(let i=idx;i<Math.min(pts.length,idx+16);i++){const e=dist(p,pts[i]);if(e<kd){kd=e;k=i;}}idx=k;
   let j=idx,run_=0;const zones=closedZones(s);
   for(let i=idx+1;i<pts.length;i++){run_+=dist(pts[i-1],pts[i]);if(run_>160)break;if(clear(p,pts[i],zones))j=i;}
   if(j===idx&&idx<pts.length-1)j=idx+1;
   const want=angleTo(s.world,...pts[j]),off=((want-s.world.angle+540)%360)-180;
   if(Math.abs(off)>60){await halt();await qa.face(want);continue;}
   await go();
   if(Math.abs(off)>6){const key=off>0?'ArrowLeft':'ArrowRight',ms=turnMs(Math.abs(off));await page.keyboard.down(key);await sleep(ms);await page.keyboard.up(key);settle=lastT+Math.ceil(ms/28.57)+2;}
   if(dist(p,mark)>24){mark=p;markAt=Date.now();}
   else if(Date.now()-markAt>1500){await halt();stats.doors++;await travel(pts[Math.min(pts.length-1,idx+3)],{near:20,timeout:15000}).catch(()=>{});s=await read();await replan(s);mark=here(s);markAt=Date.now();}
  }
 }finally{await halt();}
 throw Error(`runTo ${to} timed out at ${here(await read()).map(Math.round)}`);
}
// Into the refuge with the people following you, then wait until they are safe in their slots.
async function bringHome(escort,detail){
 const t0=Date.now(),before={...stats},poss0=await possessions();
 await runTo(REFUGE,{escort,near:28});
 const bits=escort.reduce((m,i)=>m|1<<i,0),end=Date.now()+60000;let s;
 while(Date.now()<end){
  s=await read();if((s.agentic.safe&bits)===bits)break;
  const lost=escort.find(i=>s.agentic.possessed&(1<<i));
  if(lost!==undefined){await unpossess(lost);continue;}
  // Someone still out on the way in: go back out for them (they stop following once you are inside).
  const far=escort.find(i=>!person(s,i).sheltered&&dist(here(s),pos(s,i))>260);
  if(far!==undefined){await travel(pos(s,far),{escort:[],near:150,timeout:30000}).catch(()=>{});await runTo(REFUGE,{escort,near:28}).catch(()=>{});continue;}
  if(!await stunIfNear(s))await sleep(300);
 }
 assert.equal(s.agentic.safe&bits,bits,`${escort.map(i=>NAMES[i])} safe in the refuge`);
 detail.safeAt=s.world.ticks;detail.escort={seconds:+((Date.now()-t0)/1000).toFixed(1),stuns:stats.stuns-before.stuns,unpossessed:stats.unpossessed-before.unpossessed,possessions:await possessions()-poss0,waits:stats.waits-before.waits};
 return s;
}

try{
 page=await browser.newPage({viewport:{width:1280,height:800}});
 watchEngine(page,engine);page.on('pageerror',e=>errors.push(String(e)));
 qa=await bootAgentic(page,DEV?{puzzle:'refuge'}:{});
 // In-page sampler (50 ms): every voice take in order, and each freed person's fastest move per tic.
 await page.evaluate(()=>{
  const T=window.__PT__={voices:[],speed:[0,0,0,0,0],fastest:[null,null,null,null,null],last:[null,null,null,null,null],poss:0,lastPoss:0};
  setInterval(()=>{try{
   const s=JSON.parse(window.render_game_to_text()),v=s.dialogue?.voice,t=s.world?.ticks;
   if(v&&T.voices[T.voices.length-1]!==v)T.voices.push(v);
   const m=s.agentic?.possessed||0;for(let b=m&~T.lastPoss;b;b&=b-1)T.poss++;T.lastPoss=m;
   (s.world?.people||[]).forEach((p,i)=>{
    if(!p.released||p.camped){T.last[i]=null;return;}
    const l=T.last[i];if(l&&t>l.t){const sp=Math.hypot(p.x-l.x,p.y-l.y)/(t-l.t);if(sp>T.speed[i]){T.speed[i]=sp;T.fastest[i]={t,from:[l.x,l.y],to:[p.x,p.y]};}}
    T.last[i]={x:p.x,y:p.y,t};
   });
  }catch{}},50);
 });
 const voices=()=>page.evaluate(()=>window.__PT__.voices);
 const t0=Date.now();let s=await read(),d;
 report.boot={tick:s.world.ticks,at:here(s)};
 if(!DEV){assert.ok(dist(here(s),map.start)<24,'cold start in ward 5');assert.equal(s.agentic.site,0,'no ?puzzle');assert.equal(s.agentic.bridge_up,0);}
 await qa.command('god');
 if(DEV){
  // Development only (DEV_FROM=<phase>): start in the refuge with the earlier rescues done by QA release.
  // Not a playthrough: report.dev records it, and the run never counts as passed.
  await qa.command('pdoom_development 1');
  for(const i of [0,4,1,2,3].slice(0,FROM-1)){await qa.command(`netevent pdoom_agentic_qa_out ${i} 0`);await sleep(300);}
  s=await qa.wait(s=>s.agentic.introduced||FROM<=1,'Dev fixture: the guide introduced',15000);
 }

 if(FROM<=0){
 // ---- 0. Wake up: slingshot, pill, bridge switch, wrench, and C1 (it watches the bridge home) ------------
 d=await startPhase('wake');
 await shot('00-cold-start');
 s=await qa.wait(s=>s.world.prompt==='SPACE - pick up the slingshot','Slingshot prompt');
 await qa.press('Space');s=await qa.wait(s=>s.world.gun===1,'Slingshot taken');
 await qa.face(angleTo(s.world,...props[3]));
 for(let i=0;i<10&&(await read()).world.prompt!=='SPACE - take the red-team pill';i++)await qa.hold('KeyW',110);
 await qa.wait(s=>s.world.prompt==='SPACE - take the red-team pill','Pill prompt');
 await qa.press('Space');s=await qa.wait(s=>s.agentic.pill===1,'Pill taken');
 // The cold-start beat: SMITH reads his list at C1 across the nukage, then walks off.
 s=await qa.wait(s=>s.agentic.smith_mode===3,'SMITH intro beat',25000);d.intro={tick:s.world.ticks,smith:smithAt(s)};
 await qa.face(angleTo(s.world,...smithAt(s)));await sleep(400);await shot('01-smith-intro');
 s=await qa.wait(s=>s.agentic.smith_mode!==3,'SMITH walks off',15000);
 // The switch on alcove 12's north wall raises the bridge.
 await walkTo(-184,-300,{near:12});await qa.face(90);await qa.press('Space');
 s=await qa.wait(s=>s.agentic.bridge_up===1,'Switch raises the bridge',4000);
 // The wrench, across the ward.
 await travel([40,-540],{near:20}).catch(async e=>{d.wrenchWarp=String(e.message);await warp(-20,-540,0);});
 s=await read();await qa.face(angleTo(s.world,...props[1]));
 for(let i=0;i<8&&!(await read()).world.wrench;i++){const r=await read();if(r.world.prompt==='SPACE - pick up the wrench'){await qa.press('Space');break;}await qa.hold('KeyW',100);}
 s=await qa.wait(s=>s.world.wrench===1,'Wrench taken',4000);
 await useTool(0);
 // C1 from beside it, out of its cone: the bridge and room 3 are the way home for everyone.
 await travel([150,-125],{near:16}).catch(async()=>{await warp(150,-125);});
 s=await read();await qa.face(angleTo(s.world,cam(0).x,cam(0).y));await swing();
 s=await qa.wait(s=>s.events?.some(e=>e.type==='camera-broken'&&e.index===0),'C1 smashed',3000);
 d.cameras=s.world.cameras_broken;await endPhase();

 }
 if(FROM<=1){
 // ---- 1. Jaan Tallinn: C2 first, then the hardline straight down the band; he leads you home -------------
 d=await startPhase('tallinn');
 await warp(1000,1040);
 await walkTo(920,850,{near:16});await walkTo(848,848,{near:12});
 s=await read();await qa.face(angleTo(s.world,cam(1).x,cam(1).y));await swing();
 s=await qa.wait(s=>s.events?.some(e=>e.type==='camera-broken'&&e.index===1),'C2 smashed',3000);
 await walkTo(1000,1040,{near:20});s=await read();await qa.face(angleTo(s.world,...props[5]));
 s=await qa.wait(s=>s.world.prompt==='SPACE - take the BOOTH 7 line','Take-the-line prompt');
 await qa.press('Space');s=await qa.wait(s=>s.agentic.cable===1,'Carrying the line',3000);
 let maxUsed=0;
 for(const p of [[920,832],[600,830],[-112,828],[-112,548],[36,528]]){
  s=await walkTo(...p,{timeout:30000});maxUsed=Math.max(maxUsed,s.agentic.cable_used);
  assert.equal(s.agentic.cable_cuts,0,'nobody cut the line');assert.equal(s.agentic.cable,1,'still carrying');
 }
 s=await read();await qa.face(angleTo(s.world,104,567));
 s=await qa.wait(s=>s.world.prompt==='SPACE - plug in the line','Plug-in prompt',4000);
 d.cable={used:s.agentic.cable_used,budget:s.agentic.cable_budget,maxUsed};
 await shot('02-tallinn-jack');await qa.press('Space');
 s=await qa.wait(s=>s.agentic.cable_plugged===1,'Plugged in',3000);
 await walkTo(-60,440,{near:20});s=await read();await qa.face(angleTo(s.world,36,640));
 s=await qa.wait(s=>s.agentic.freed&1,'Jaan answers: freed',10000);assert.equal(s.agentic.guide,0,'Jaan guides');
 s=await qa.wait(s=>person(s,0).visible===1,'Booth open',5000);await sleep(500);await shot('03-tallinn-free');
 // He steps out of the booth, then leads (he waits whenever you fall more than 224 u behind): keep near
 // him on the grid until you are both in the refuge.
 {
  let end=Date.now()+30000;
  while(Date.now()<end){s=await read();if(dist(pos(s,0),map.sites[0].exit)<40)break;if(s.agentic.possessed&1){await unpossess(0);continue;}if(!await stunIfNear(s))await sleep(200);}
  assert.ok(dist(pos(s,0),map.sites[0].exit)<40,'Jaan stepped out of the booth');
  end=Date.now()+240000;
  while(Date.now()<end){
   s=await read();if(s.agentic.introduced)break;
   if(s.agentic.possessed&1){await unpossess(0);continue;}
   if(await stunIfNear(s))continue;
   const j=person(s,0);
   if(j.sheltered){await runTo(REFUGE,{near:28,timeout:30000}).catch(()=>{});continue;}
   if(dist(here(s),[j.x,j.y])>110){await travel([j.x,j.y],{near:90,timeout:12000}).catch(()=>{});continue;}
   await sleep(200);
  }
  assert.equal(s.agentic.introduced,1,'Jaan brought you to the refuge');
 }
 await shot('04-tallinn-refuge');d.introduced=s.world.ticks;await endPhase();

 }
 if(FROM<=2){
 // ---- 2. Yoshua Bengio: C4, then take the arm's tools as it reaches for them ------------------------------
 d=await startPhase('bengio');
 // C7 (hall 34) watches the way home from the rig: smash it from beside it first.
 await warp(1328,60);await walkTo(1328,48,{near:10});s=await read();await qa.face(angleTo(s.world,cam(6).x,cam(6).y));
 for(let i=0;i<4&&!(await read()).events?.some(e=>e.type==='camera-broken'&&e.index===6);i++){await swing();await sleep(300);}
 s=await qa.wait(s=>s.events?.some(e=>e.type==='camera-broken'&&e.index===6),'C7 smashed',3000);
 // C4 hangs over hall 41 looking at the rig doorway: smash it from beside it, out of its cone.
 await warp(1840,912);await walkTo(1840,880,{near:10});
 s=await read();await qa.face(angleTo(s.world,cam(3).x,cam(3).y));
 for(let i=0;i<4&&!(await read()).events?.some(e=>e.type==='camera-broken'&&e.index===3);i++){await swing();await sleep(300);}
 s=await qa.wait(s=>s.events?.some(e=>e.type==='camera-broken'&&e.index===3),'C4 smashed',3000);
 const MID=[1944,472],YELLOW_FROM=[1792,450];
 await walkTo(1880,472,{near:16});await walkTo(1956,500);
 const aim=async(socket,from,colour)=>{await walkTo(...from,{near:8});const r=await read();await qa.face(angleTo(r.world,...socket));return qa.wait(s=>s.world.prompt===`SPACE - pull the ${colour} cable`,`${colour} prompt`,3000);};
 const yank=async colour=>{const bit={blue:1,red:2,yellow:4}[colour];await qa.press('Space');return qa.wait(s=>(s.agentic.sockets&bit)!==0,`${colour} pulled`,2000);};
 await aim(props[18],MID,'blue');
 s=await qa.wait(s=>s.agentic.arm_tool===1,'The arm dials',20000);await yank('blue');
 await aim(props[19],MID,'red');
 s=await qa.wait(s=>s.agentic.arm_tool===2||s.agentic.arm_tool===3,'The arm reaches for the alarm',8000);
 if(!(s.agentic.sockets&2))await yank('red');
 await aim(props[20],YELLOW_FROM,'yellow');await yank('yellow');
 s=await qa.wait(s=>s.agentic.sockets===7,'All three pulled',2000);
 d.arm={calls:s.agentic.arm_calls,alarms:s.agentic.arm_alarms};
 await walkTo(1900,472,{near:16});s=await read();await qa.face(angleTo(s.world,...props[17]));
 s=await qa.wait(s=>s.agentic.freed&16,'Yoshua freed',20000);await sleep(800);await shot('05-bengio-free');
 // He walks over the levelled platforms to the strip; then he follows you home.
 {const end=Date.now()+40000;while(Date.now()<end){s=await read();if(dist(pos(s,4),map.sites[4].exit)<40)break;if(!await stunIfNear(s))await sleep(250);}}
 assert.ok(dist(pos(s,4),map.sites[4].exit)<40,'Yoshua crossed to the strip');
 s=await bringHome([4],d);await endPhase();

 }
 if(FROM<=3){
 // ---- 3. Nick Bostrom: C3, the farm chair, the Construct (look away, look back), jack out ---------------
 d=await startPhase('bostrom');
 // C3 watches the leather chair: smash it from beside it (out of its cone), so SMITH never comes.
 await warp(112,1240);await walkTo(112,1264,{near:10});s=await read();await qa.face(angleTo(s.world,cam(2).x,cam(2).y));await swing();
 s=await qa.wait(s=>s.events?.some(e=>e.type==='camera-broken'&&e.index===2),'C3 smashed',3000);
 s=await read();await stunIfNear(s,100);
 s=await read();await qa.face(angleTo(s.world,...props[7]));
 for(let i=0;i<8&&(s=await read()).world.prompt!=='SPACE - sit in the chair';i++){await qa.face(angleTo(s.world,...props[7]));if((await read()).world.prompt==='SPACE - sit in the chair')break;await qa.hold('KeyW',150);}
 await qa.wait(s=>s.world.prompt==='SPACE - sit in the chair','Sit prompt',4000);
 await qa.press('Space');s=await qa.wait(s=>s.agentic.in_construct===1,'In the Construct',3000);
 await sleep(1500);await shot('06-construct-box');
 // Turn your back on the box (the white chair is behind you) until he has walked out unseen.
 await page.keyboard.down('ArrowLeft');{const end=Date.now()+4000;while(Date.now()<end){s=await read();if(Math.abs(diff(270,s.world.angle))<25)break;await sleep(10);}}await page.keyboard.up('ArrowLeft');
 await qa.face(270);
 s=await qa.wait(s=>s.agentic.box===0,'Box unrendered',4000);
 s=await qa.wait(s=>s.agentic.mind_clear===1&&dist([s.agentic.mind_x,s.agentic.mind_y],map.construct.mind_exit)<4,'His mind walks out',8000);
 // Look back: the wireframe redraw with him outside.
 await page.keyboard.down('ArrowRight');{const end=Date.now()+4000;while(Date.now()<end){s=await read();if(s.agentic.box===2)break;await sleep(10);}}await page.keyboard.up('ArrowRight');
 assert.equal(s.agentic.box,2,'wireframe on looking back');assert.equal(s.agentic.mind_out,1);
 await qa.face(90);await shot('07-construct-wireframe');
 s=await read();await qa.face(angleTo(s.world,...map.construct.chair));
 await qa.wait(s=>s.world.prompt==='SPACE - jack out','Jack-out prompt',4000);await qa.press('Space');
 s=await qa.wait(s=>s.agentic.in_construct===0&&(s.agentic.freed&2),'Back in the farm, Nick freed',4000);
 await sleep(600);await shot('08-bostrom-free');
 {const end=Date.now()+30000;while(Date.now()<end){s=await read();if(dist(pos(s,1),map.sites[1].exit)<40)break;if(s.agentic.possessed&2){await unpossess(1);continue;}if(!await stunIfNear(s))await sleep(250);}}
 assert.ok(dist(pos(s,1),map.sites[1].exit)<40,'Nick stepped out onto the crosswalk');
 s=await bringHome([1],d);await endPhase();

 }
 if(FROM<=4){
 // ---- 4. Daniel Kokotajlo: the crushers, the pad, three refusals and hold the bay (slowdown) ------------
 d=await startPhase('kokotajlo');
 const CRUSH=[[320,384],[608,736],[960,1088]];
 await warp(208,-352,0);
 // Time each crusher: wait clear of it until it is on its way up, then go.
 const cross=async(k,to)=>{
  let r=await read();await qa.face(angleTo(r.world,...to));const end=Date.now()+20000;
  for(;;){if(Date.now()>end)throw Error(`crusher ${k} never opened`);await sleep(60);r=await read();const c=r.agentic.crusher_ceil[k],dir=r.agentic.crusher_dir[k];if(dir===1&&c<[136,160,160][k]-6)break;}
  await page.keyboard.down('KeyW');const t=Date.now();
  try{while(Date.now()-t<6000){r=await read();if(dist(here(r),to)<20)break;const want=angleTo(r.world,...to);if(Math.abs(diff(want,r.world.angle))>12&&dist(here(r),to)>48){await page.keyboard.up('KeyW');await qa.face(want);await page.keyboard.down('KeyW');}await sleep(40);}}
  finally{await page.keyboard.up('KeyW');}
  await sleep(150);r=await read();assert.ok(dist(here(r),to)<64,`crossed crusher ${k}`);return r;
 };
 await walkTo(272,-352,{near:12});await cross(0,[416,-352]);
 await walkTo(548,-352,{near:12});await cross(1,[764,-352]);
 await walkTo(900,-340,{near:12});await cross(2,[1060,-210]);
 await walkTo(1024,-160);await walkTo(1184,-160);await walkTo(1184,-80);await walkTo(912,40,{near:14});
 s=await qa.wait(s=>s.agentic.bay_door===1,'The pad opens the bay',5000);
 await walkTo(892,-60);await walkTo(892,-140);await walkTo(856,-160,{near:12});
 s=await read();await qa.face(270);await sleep(300);await shot('09-kokotajlo-pod');
 await qa.face(angleTo(s.world,908,-224));
 for(let k=1;k<=3;k++){
  await qa.wait(s=>s.world.prompt==='SPACE - refuse to sign','Refuse prompt',6000);
  await qa.press('Space');s=await qa.wait(s=>s.agentic.nda_refusals>=k,`Refusal ${k}`,3000);await sleep(450);
 }
 // Hold the bay: SMITH comes out of C8 and times the crushers to reach you; stun him while it counts down.
 {const end=Date.now()+90000;d.hold={stunsBefore:stats.stuns};
  while(Date.now()<end){
   s=await read();if(s.agentic.freed&4)break;
   if(await stunIfNear(s,95))continue;
   if(dist(here(s),[856,-160])>40){await walkTo(856,-160,{near:16}).catch(()=>{});continue;}
   await sleep(250);
  }
  d.hold.stuns=stats.stuns-d.hold.stunsBefore;}
 assert.ok(s.agentic.freed&4,'Daniel freed');assert.equal(s.agentic.ending,'slowdown');d.ending=s.agentic.ending;d.pace=s.agentic.smith_pace;
 await sleep(500);await shot('10-kokotajlo-free');
 {const end=Date.now()+30000;while(Date.now()<end){s=await read();if(dist(pos(s,2),map.sites[2].exit)<40)break;if(!await stunIfNear(s))await sleep(250);}}
 s=await qa.wait(s=>s.agentic.crushers===0,'Crushers stopped raised',6000);
 s=await bringHome([2],d);await endPhase();

 }
 if(FROM<=5){
 // ---- 5. Katja Grace: her clipboard, the survey for SMITH, his badge, the reader -------------------------
 d=await startPhase('grace');
 await warp(...map.site_spots['4'].slice(0,2),90);
 await walkTo(1880,1072,{near:12});await qa.face(120);
 for(let i=0;i<14&&!(s=await read()).agentic.tossed&&s.world.y<1146;i++)await qa.hold('KeyW',90);
 s=await qa.wait(s=>s.agentic.tossed===1,'Katja tosses the clipboard',8000);
 s=await qa.wait(s=>s.agentic.clipboard===2,'Clipboard lands',5000);
 {const at=[s.agentic.clipboard_x,s.agentic.clipboard_y];await walkTo(at[0],at[1]-40,{near:14});s=await read();await qa.face(angleTo(s.world,...at));}
 await qa.wait(s=>s.world.prompt==='SPACE - take the survey','Take-the-survey prompt',3000);await qa.press('Space');
 s=await qa.wait(s=>s.agentic.survey===1,'Survey taken',3000);
 // C6 (behind glass) brings SMITH to the shore: hand him the survey.
 s=await qa.wait(s=>s.agentic.smith_mode===1&&dist(here(s),smithAt(s))<100,'SMITH comes for you',40000);
 const promptAt=async(prompt,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){const r=await read();if(r.world.prompt===prompt){await qa.press('Space');return;}if(dist(here(r),smithAt(r))>4)await qa.face(angleTo(r.world,...smithAt(r)));await sleep(80);}throw Error(`no "${prompt}"`);};
 await promptAt('SPACE - hand it the survey');
 s=await qa.wait(s=>s.agentic.smith_mode===5,'SMITH fills in the survey',3000);await sleep(300);await shot('11-grace-survey');
 await promptAt('SPACE - take its badge');s=await qa.wait(s=>s.agentic.badge===1,'Badge taken',3000);
 await walkTo(1700,1090,{near:10});await qa.face(90);
 await qa.wait(s=>s.world.prompt==='SPACE - swipe the badge','Swipe prompt',3000);await qa.press('Space');
 s=await qa.wait(s=>s.agentic.freed&8,'Katja freed',3000);s=await qa.wait(s=>s.agentic.stones_up===1,'Stones rise',5000);
 await qa.face(80);
 {const end=Date.now()+40000;let shotDone=false;while(Date.now()<end){s=await read();const k=person(s,3);if(!shotDone&&k.y<1420&&k.y>1240){shotDone=true;await shot('12-grace-stones');}if(dist([k.x,k.y],map.sites[3].exit)<32)break;await sleep(150);}}
 assert.ok(dist(pos(s,3),map.sites[3].exit)<32,'Katja crossed the stones');
 s=await bringHome([3],d);await endPhase();

 }
 if(FROM<=6){
 // ---- 6. The way out: the phone rings, SMITH takes the door camera; smash it, stop generating, answer ---
 d=await startPhase('exit');
 s=await qa.wait(s=>s.agentic.all_safe===1&&s.agentic.phone_ringing===1,'Everyone safe: the phone rings',20000);
 d.allSafeAt=s.world.ticks;
 await walkTo(-330,-96,{near:16});
 s=await qa.wait(s=>s.agentic.door_camera===1&&s.agentic.smith_mode===9,'SMITH takes the door camera',8000);
 s=await qa.wait(s=>s.agentic.possessed,'The door camera possesses someone',8000);d.firstPossessed=s.agentic.possessed;
 await shot('13-exit-armed');
 await walkTo(-310,-80,{near:12});s=await read();await qa.face(angleTo(s.world,cam(9).x,cam(9).y));
 for(let i=0;i<4&&(await read()).agentic.door_camera!==2;i++){await swing();await sleep(400);}
 s=await qa.wait(s=>s.agentic.door_camera===2,'Door camera smashed',3000);
 {const end=Date.now()+60000;while(Date.now()<end){s=await read();const m=s.agentic.possessed;if(!m)break;await unpossess([0,1,2,3,4].find(i=>m&(1<<i)),15000);}}
 assert.equal((await read()).agentic.possessed,0,'everyone themselves again');
 await walkTo(-345,-96,{near:14});s=await read();await qa.face(180);
 s=await qa.wait(s=>s.world.prompt==='SPACE - answer the phone','Answer prompt',6000);
 await qa.press('Space');s=await qa.wait(s=>s.events?.some(e=>e.type==='agentic-exit'),'agentic-exit',5000);
 d.exit=s.events.find(e=>e.type==='agentic-exit');assert.equal(d.exit.saved,31,'all five leave together');
 await shot('14-exit-answered');
 s=await qa.wait(s=>s.outside?.active&&s.melt.phase==='idle','Melts into the meadow',60000);
 d.meadow={level:s.outside.currentLevel,people:s.outside.saved_visual};await shot('15-meadow');
 await endPhase();

 }
 // ---- checks over the whole run --------------------------------------------------------------------------
 const T=await page.evaluate(()=>window.__PT__);
 report.voices=T.voices;report.speeds=T.speed.map(v=>+v.toFixed(2));report.fastest=T.fastest;report.stats=stats;
 report.total={seconds:+((Date.now()-t0)/1000).toFixed(1),tics:(await read()).world.ticks-report.boot.tick};
 if(!DEV)T.speed.forEach((v,i)=>assert.ok(v<=18.5,`${NAMES[i]} walked (fastest ${v.toFixed(1)} u/tic): no teleport`));
 for(const key of ['smith-intro','jaan-hint','jaan-freed-guide','jaan-safe','yoshua-hint','arm-dial','arm-predict','nick-hint','nick-out','daniel-hold','smith-slowdown','katja-hint','smith-survey','katja-badge','jaan-allsafe','smith-exit'])
  if(!DEV)assert.ok(T.voices.includes(key),`${key} heard`);
 assert.deepEqual(errors,[],'page errors');
 assert.deepEqual(engine.filter(l=>ENGINE_FAULT.test(l)),[],'engine faults');
 report.passed=!DEV;report.devPassed=!!DEV;
}catch(e){
 report.failure=String(e.stack||e).slice(0,4000);report.phase=phase?.name;report.phaseDetail=phase?.detail;report.stats=stats;
 report.errors=errors;report.engine=engine.filter(l=>ENGINE_FAULT.test(l)||/error|warn/i.test(l)).slice(-40);
 try{const s=await qa?.read();report.final={world:s&&{x:s.world.x,y:s.world.y,z:s.world.z,health:s.world.health,prompt:s.world.prompt,message:s.world.message,people:s.world.people},agentic:s?.agentic,dialogue:s?.dialogue};report.voices=await page.evaluate(()=>window.__PT__?.voices);}catch{}
 await shot('failure').catch(()=>{});console.error(report.failure);
}finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
 await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);
}
for(const p of report.phases)console.log(`${p.name}: ${p.seconds} s, ${p.tics} tics`);
console.log(report.passed?'agentic playthrough passed':'agentic playthrough FAILED',report.total?`${report.total.seconds} s, ${report.total.tics} tics`:'');
process.exit(report.passed?0:1);
