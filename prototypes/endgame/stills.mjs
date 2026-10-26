// Staged screenshots of the endgame prototypes for review (headless, muted), saved to
// output/endgame-proto/stills/. Server up first: PDOOM_PORT=5228 node scripts/serve-doom.mjs
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const port=Number(process.env.PDOOM_PORT)||5228,out='output/endgame-proto/stills';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function open(mode){
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${port}/endgame-proto/play.html?m=${mode}&auto=1&mute=1`);
 await page.waitForFunction(()=>window.__eg?.ready,null,{timeout:60000});
 const ev=(f,a)=>page.evaluate(f,a),state=()=>ev(()=>window.__eg.state());
 const until=async(test,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){const s=await state();if(test(s))return s;await wait(60);}return null;};
 const shot=(name)=>page.screenshot({path:`${out}/${mode}-${name}.png`});
 return {page,ev,state,until,shot,errors};
}
const toFight=async(p)=>{await p.ev(()=>window.__eg.skip());await p.until(s=>s.phase==='fight');};
// throw when the gap will be facing you as the disc arrives
const throwOnGap=(p)=>p.ev(()=>new Promise(res=>{
 const eg=window.__eg,c=eg.ctx,wrap=a=>{a=(a+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI;};
 const id=setInterval(()=>{const f=c.mcp.facePos;eg.lookAt(f.x,f.y,f.z);const pb=Math.atan2(c.player.pos.z,c.player.pos.x),t=(Math.hypot(c.player.pos.x,c.player.pos.z)-10)/34;
  if(c.held&&c.mcp.gapCenters().some(g=>Math.abs(wrap(g+c.mcp.spin*t-pb))<5*Math.PI/180)){eg.press(0);clearInterval(id);res(true);}},10);
}));

{ // A. RICOCHET
 const p=await open('ricochet');
 await p.until(s=>s.recs.length>0);
 await p.ev(()=>{const c=window.__eg.ctx;c.recs[0].target=()=>c.player.pos;});
 await p.until(s=>s.recs[0]?.state==='telegraph',25000);await wait(700);
 await p.ev(()=>{const c=window.__eg.ctx,q=c.player.pos;window.__eg.spectate([q.x-9,3.2,q.z+11],[q.x,6.5,q.z]);});await p.shot('1-recognizer-shadow');
 await p.ev(()=>window.__eg.spectate(null));
 await toFight(p);
 await p.ev(()=>{window.__eg.place(0,36);window.__eg.lookAt(10.7,1.2,25.9);window.__eg.press(0);});await wait(420);
 await p.ev(()=>window.__eg.spectate([-5,13,47],[5,2,24]));await p.shot('2-bank-off-pillar');await p.ev(()=>window.__eg.spectate(null));
 await p.until(s=>s.held,8000);await wait(300);
 await throwOnGap(p);await wait(260);await p.shot('3-through-the-gap');
 console.log('ricochet',p.errors);await p.page.close();
}
{ // B. TENNIS
 const p=await open('tennis');
 await p.until(s=>s.recs.some(r=>r.state==='hover'));
 const aimRec=()=>p.ev(()=>{const core=window.__eg.recCore();if(core)window.__eg.lookAt(...core);});
 for(let i=0;i<60;i++){await aimRec();const s=await p.state();if(s.recs.some(r=>r.state==='charge'))break;await wait(80);}
 await wait(500);await p.shot('1-recognizer-charging');
 await toFight(p);
 await p.ev(()=>{window.__eg.place(0,34);});
 const face=()=>p.ev(()=>{const f=window.__eg.ctx.mcp.facePos;window.__eg.lookAt(f.x,f.y,f.z);});
 for(let i=0;i<200;i++){await face();const s=await p.state();if(s.mode_state.serve==='wind'&&s.mode_state.bolts.length===0)break;await wait(40);}
 await wait(250);await p.shot('2-it-serves');
 // freeze the moment the shot is in the sweet spot, then hit it back
 await p.ev(()=>new Promise(res=>{const eg=window.__eg;const id=setInterval(()=>{const f=eg.ctx.mcp.facePos;eg.lookAt(f.x,f.y,f.z);if(eg.state().mode_state.bolts.some(b=>b.enemy&&b.hot)){clearInterval(id);eg.freeze(true);res();}},2);}));
 await wait(120);await p.shot('3-sweet-spot');
 await p.ev(()=>{window.__eg.freeze(false);window.__eg.press(0);});await wait(420);await p.shot('4-return');
 console.log('tennis',p.errors);await p.page.close();
}
{ // C. CROWD VOLLEY
 const p=await open('volley');
 await p.until(s=>s.recs.length>0);await wait(4500);
 await p.ev(()=>{const core=window.__eg.recCore();if(core){window.__eg.lookAt(...core);window.__eg.press(0);}});await wait(520);
 await p.ev(()=>{const c=window.__eg.ctx,q=c.player.pos;window.__eg.spectate([q.x*1.25+6,7,q.z*1.25+4],[q.x*.5,6,q.z*.5]);});await p.shot('1-practice-everyone-throws');
 await p.ev(()=>window.__eg.spectate(null));
 await toFight(p);
 await p.ev(()=>window.__eg.place(0,31));await wait(2500);
 await throwOnGap(p);await wait(420);await p.shot('2-volley-first-person');
 await p.ev(()=>window.__eg.spectate([12,8,41],[0,9,4]));await wait(180);await p.shot('3-volley-from-behind');await p.ev(()=>window.__eg.spectate(null));
 await p.until(s=>s.sinks>0,20000);await wait(900);
 await p.ev(()=>{const q=window.__eg.ctx.player.pos;window.__eg.spectate([q.x*1.5,24,q.z*1.5+2],[q.x*.9,0,q.z*.9]);});await p.shot('4-sinks-incoming');
 console.log('volley',p.errors);await p.page.close();
}
await browser.close();
