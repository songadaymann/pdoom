// The endgame hookup (docs/ENDGAME.md E0-E5, 2026-10-28), headless and muted:
// 1. The meadow after level 4 (?safemode=1&after=4: all 20 out) starts the guide's meeting at the door; he calls,
//    walking over starts his lines, and Space skips to the gate with the floppy handed over, everyone following
//    and the south edge open. Walking south through the gate opens the endgame page (?m=finale).
// 2. That page (reloaded with &auto=1, as a click would start it): the walk in, its three Recognizer beats (shot
//    down by QA), the door opening once they're gone, and THE BOSS's intro once you're inside.
// 3. A save marked done (endgame 2) loads (?play=1&load=1, the game's own handoff) into a meadow without the
//    column, and doesn't start the meeting again.
// PDOOM_ORIGIN (e.g. http://127.0.0.1:5238) points it at another server. Needs doom-web/endgame-proto/
// (node scripts/build-endgame-protos.mjs). Screenshots and report.json in output/endgame-hookup/.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin=(process.env.PDOOM_ORIGIN||'http://127.0.0.1:5198').replace(/\/?$/,'/'),out=process.env.DOOM_OUT||'output/endgame-hookup';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--autoplay-policy=no-user-gesture-required']}),report={cases:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label,ms=20000){const end=Date.now()+ms;let last;while(Date.now()<end){try{last=await f();if(last)return last;}catch{}await sleep(150);}throw new Error(`Timed out: ${label}`);}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 const hub=()=>page.evaluate(()=>window.__DOOM_DEBUG__?.outside?.getState()??null);
 const view=(x,z,yaw,pitch=0)=>page.evaluate(([x,z,yaw,pitch])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,pitch),[x,z,yaw,pitch]);

 // 1. the meeting at the door
 await page.goto(`${origin}?safemode=1&after=4`);
 let s=await until(async()=>{const h=await hub();return h?.endgame?.state==='door'&&h.guide?.scene==='endgame'&&h;},'the guide meets you at the door',120000);
 assert.equal(s.guide.phase,'waiting');assert.equal(s.endgame.gateOpen,false);assert.equal(s.endgame.following,false);
 s=await until(async()=>{const h=await hub();return /over here/i.test(h.guide.text)&&h;},'he calls you over');
 await view(s.guide.x,s.guide.z+4,Math.PI*0,0);// beside him, facing him
 s=await until(async()=>{const h=await hub();return /twenty/i.test(h.guide.text)&&h.guide.speaking==='end-saved'&&h;},'walking over starts his lines: all twenty');
 await page.screenshot({path:`${out}/1-door.png`});
 await page.keyboard.press('Space');
 s=await until(async()=>{const h=await hub();return h.endgame.gateOpen&&h.endgame.following&&h.guide.ready&&h.guide.handoff==='done'&&h;},'Space: the floppy handed over, everyone following, the gate open');
 const got=await page.locator('#hub-got').textContent();assert.match(got,/FLOPPY DISK/);
 assert.ok(Math.hypot(s.x-s.endgame.gate.x,s.z-(s.endgame.gate.z-9))<2.5,`the skip lands you at the gate (at ${s.x}, ${s.z}; guide ${s.guide.x}, ${s.guide.z})`);
 const far=p=>Math.hypot(p.x-s.x,p.z-s.z),before=s.people.map(far);await sleep(3000);
 const now=(await hub()).people.map(far),closer=now.filter((d,i)=>d<before[i]-3).length;
 assert.ok(closer>=15,`everyone falls in (${closer} of ${now.length} closing in)`);
 await view(s.endgame.gate.x+1.5,s.endgame.gate.z-12,Math.PI,.05);await sleep(400);await page.screenshot({path:`${out}/2-gate.png`});
 report.cases.push(`After 4: the guide calls you over, says all twenty, hands over the floppy; ${closer}/20 fall in and the gate opens`);
 // through it, on foot
 await view(s.endgame.gate.x+1.5,s.endgame.gate.z-4,Math.PI,0);
 await page.keyboard.down('KeyW');
 await page.waitForURL(/endgame-proto\/play\.html\?m=finale&ceo=(altman|amodei)/,{timeout:15000});
 await page.keyboard.up('KeyW');
 report.cases.push(`Walking south through the gate opens ${new URL(page.url()).pathname}${new URL(page.url()).search}`);

 // 2. the walk in
 await page.goto(page.url()+'&auto=1');
 const eg=()=>page.evaluate(()=>window.__eg.state());
 s=await until(async()=>{const e=await page.evaluate(()=>window.__eg?.ready&&window.__eg.state());return e?.mode_state?.phase==='walk'&&e;},'the walk begins',60000);
 assert.ok(s.player.z>250,'you start far out on the Grid');assert.equal(s.mode_state.walk.door,false);
 await sleep(1500);await page.screenshot({path:`${out}/3-walk.png`});
 // everyone in single file behind you
 const behind=await page.evaluate(()=>{const c=window.__eg.ctx,p=c.player.pos;return c.people.filter(q=>q.pos.z>p.z+2&&Math.abs(q.pos.x-p.x)<4).length;});
 assert.equal(behind,s.people,`the crowd follows behind you (${behind} of ${s.people})`);
 await page.evaluate(()=>window.__eg.look(Math.PI,-.1));await sleep(300);await page.screenshot({path:`${out}/3-behind.png`});await page.evaluate(()=>window.__eg.look(0,0));
 const shoot=()=>page.evaluate(()=>{const c=window.__eg.ctx;for(const r of c.recs)while(r.alive)c.hitRec(r);});
 for(const [z,beat] of [[230,1],[160,2],[100,3]]){
  await page.evaluate(z=>window.__eg.place(0,z),z);
  s=await until(async()=>{const e=await eg();return e.mode_state.walk.beat>=beat&&e.recs.length>0&&e;},`practice beat ${beat}`);
  if(beat===1){await sleep(2500);await page.screenshot({path:`${out}/4-recognizer.png`});}
  await shoot();
 }
 await page.evaluate(()=>window.__eg.place(0,58));
 s=await until(async()=>{const e=await eg();return e.mode_state.walk.door&&e;},'the door opens once the way is clear');
 await page.evaluate(()=>window.__eg.lookAt(0,4,0));await sleep(1800);await page.screenshot({path:`${out}/5-door.png`});
 await page.evaluate(()=>window.__eg.place(0,40));
 s=await until(async()=>{const e=await eg();return e.mode_state.phase==='intro'&&e;},'inside: THE BOSS wakes',20000);
 assert.equal(s.mode_state.walk.on,false);assert.equal(s.people,20,'no save in this browser: everyone came');
 report.cases.push('Finale page: the walk in, three Recognizer beats, the door opens once they are down, THE BOSS intro inside');

 // 3. back to the meadow after it
 await page.evaluate(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,saved2:31,saved3:31,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0,ending3:0,endgame:2})));
 await page.goto(`${origin}?play=1&load=1`);
 s=await until(async()=>{const h=await hub();return h?.endgame?.state==='fallen'&&h;},'a finished save loads into the meadow, the column gone',120000);
 assert.equal(s.guide,null,'he does not meet you again');
 await view(80,170,Math.PI,.02);await sleep(500);await page.screenshot({path:`${out}/6-after.png`});
 report.cases.push('A finished save (endgame 2) loads into the meadow with the column gone and no meeting');
 assert.deepEqual(errors,[]);
 report.passed=true;
}catch(e){report.failure=String(e?.stack||e);}
finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
