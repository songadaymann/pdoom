// The endgame hookup (docs/ENDGAME.md E0-E5, 2026-10-28), headless and muted:
// 1. The meadow after level 4 (?safemode=1&after=4: all 20 out, out of AGENTIC.BAT's door as level 4 leaves you)
//    starts the guide's meeting at the door; he calls, walking over starts his lines, and Space skips to the gate
//    with the floppy handed over, everyone following and the south edge open. Walking south through the gate
//    opens the endgame page (?m=finale), with the fixture's save in the URL.
// 2. That page (reloaded with &auto=1, as a click would start it): the walk in, its three Recognizer beats (shot
//    down by QA), the door opening once they're gone, and THE BOSS's intro once you're inside. The tower is a data
//    center (2026-10-30): its sign and turbines are up, its hum swells as you near it and the guide remarks on it,
//    the far Recognizer never shoots, and nothing on the walk talks about tennis.
// 3. A save marked done (endgame 2) loads (?play=1&load=1, the game's own handoff) into a meadow without the
//    column, and doesn't start the meeting again.
// 4. The fixture's finale, from its last part (&part=3, the trick shot steered by &autosteer=1) to black: a click
//    goes back to the fixture's meadow after the boss (&after=5, the column gone), and this browser's real save
//    is left as it was.
// PDOOM_ORIGIN (e.g. http://127.0.0.1:5238) points it at another server. Needs doom-web/endgame-proto/
// (node scripts/build-endgame-protos.mjs). Screenshots and report.json in output/endgame-hookup/. Takes about 4 minutes.
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
 assert.equal(s.currentLevel,'agentic-pods');assert.ok(Math.hypot(s.x-143.5,s.z-86.7)<5,`out of AGENTIC.BAT's door (at ${s.x}, ${s.z})`);
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
 await page.waitForURL(/endgame-proto\/play\.html\?m=finale&ceo=(altman|amodei)&safemode=1&saved=31,31,31,31$/,{timeout:15000});
 await page.keyboard.up('KeyW');
 report.cases.push(`Walking south through the gate opens ${new URL(page.url()).pathname}${new URL(page.url()).search}`);

 // 2. the walk in
 await page.goto(page.url()+'&auto=1');
 const eg=()=>page.evaluate(()=>window.__eg.state());
 s=await until(async()=>{const e=await page.evaluate(()=>window.__eg?.ready&&window.__eg.state());return e?.mode_state?.phase==='walk'&&e;},'the walk begins',60000);
 // every voice take the walk starts (a line with no take stays a subtitle)
 await page.evaluate(()=>{const v=window.__eg.ctx.voices,play=v.play.bind(v);window.__takes=[];v.play=(k,o)=>{window.__takes.push(k);return play(k,o);};});
 assert.ok(s.player.z>400,'you start far out on the Grid');assert.equal(s.mode_state.walk.door,false);
 assert.ok(s.dc.sign&&s.dc.turbines===10&&s.dc.leds>800,`the data center is dressed (${JSON.stringify(s.dc)})`);
 // every toast and hint the walk shows, to check nobody teaches tennis out here
 await page.evaluate(()=>{window.__said=[];const keep=id=>{const e=document.getElementById(id);new MutationObserver(()=>window.__said.push(e.textContent)).observe(e,{childList:true,subtree:true,characterData:true});window.__said.push(e.textContent);};keep('toast');keep('hint');});
 await sleep(1500);await page.screenshot({path:`${out}/3-walk.png`});
 assert.ok((await eg()).mode_state.walk.near<.4,'the hum is faint far out');
 // everyone in single file behind you
 const behind=await page.evaluate(()=>{const c=window.__eg.ctx,p=c.player.pos;return c.people.filter(q=>q.pos.z>p.z+2&&Math.abs(q.pos.x-p.x)<4).length;});
 assert.equal(behind,s.people,`the crowd follows behind you (${behind} of ${s.people})`);
 await page.evaluate(()=>window.__eg.look(Math.PI,-.1));await sleep(300);await page.screenshot({path:`${out}/3-behind.png`});await page.evaluate(()=>window.__eg.look(0,0));
 const shoot=()=>page.evaluate(()=>{const c=window.__eg.ctx;for(const r of c.recs)while(r.alive)c.hitRec(r);});
 for(const [z,beat] of [[230,1],[160,2],[100,3]]){
  await page.evaluate(z=>window.__eg.place(0,z),z);
  s=await until(async()=>{const e=await eg();return e.mode_state.walk.beat>=beat&&e.recs.length>0&&e;},`practice beat ${beat}`,45000);// each waits for the last one's lines
  if(beat===1){await sleep(2500);await page.screenshot({path:`${out}/4-recognizer.png`});}
  // the far one only circles: it can never charge a shot
  if(beat===2)assert.ok(await page.evaluate(()=>window.__eg.ctx.recs.filter(r=>r.alive&&r.style==='bolt').every(r=>r.fireCd===Infinity&&r.state!=='charge')),'the far one never charges');
  await shoot();
 }
 s=await eg();assert.ok(s.mode_state.walk.heard.includes('walk-hum'),'the guide hears the data center on the way in');assert.equal(s.mode_state.shots,0,'nothing shoots on the walk');
 await page.evaluate(()=>{window.__eg.place(0,200);window.__eg.lookAt(0,21,47);});await sleep(600);await page.screenshot({path:`${out}/3-sign.png`});
 await page.evaluate(()=>window.__eg.place(0,58));
 s=await until(async()=>{const e=await eg();return e.mode_state.walk.door&&e;},'the door opens once the way is clear and everyone has had their say',60000);
 assert.ok(s.mode_state.walk.near>.95,'the noise pours out of the open door');
 await page.evaluate(()=>window.__eg.lookAt(0,4,0));await sleep(1800);await page.screenshot({path:`${out}/5-door.png`});
 await page.evaluate(()=>window.__eg.place(0,40));
 s=await until(async()=>{const e=await eg();return e.mode_state.phase==='intro'&&e;},'inside: THE BOSS wakes',20000);
 assert.equal(s.mode_state.walk.on,false);assert.equal(s.people,20,"the fixture's save: everyone came");assert.equal(s.dc.sign,false,'the sign is outside only');
 const shown=await page.evaluate(()=>window.__said);
 assert.ok(shown.some(t=>/data center/i.test(t)),'the hum line is said');
 // 2026-10-30's walk takes are voiced (the guide here is Dario: the fixture plays Sam)
 const takes=await page.evaluate(()=>window.__takes);
 for(const k of ['guide-mario-end-keep','guide-mario-end-hum'])assert.ok(takes.includes(k),`${k} plays as a voice take (${takes.join(', ')})`);
 assert.ok(!takes.some(k=>k.endsWith('-end-rule')),'the old tennis take never plays');
 assert.equal(await page.evaluate(()=>window.__eg.ctx.voices.failed),0,'no take failed to load');
 const tennis=shown.filter(t=>/tennis|hit it back|swing|send it/i.test(t));assert.deepEqual(tennis,[],'nothing on the walk teaches tennis');
 report.cases.push('Finale page: the walk in past the data center (sign, turbines, the hum line), three Recognizer beats with no tennis, the door opens once they are down, THE BOSS intro inside; the keep and hum lines voiced');

 // 3. back to the meadow after it
 await page.evaluate(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,saved2:31,saved3:31,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0,ending3:0,endgame:2})));
 await page.goto(`${origin}?play=1&load=1`);
 s=await until(async()=>{const h=await hub();return h?.endgame?.state==='fallen'&&h;},'a finished save loads into the meadow, the column gone',120000);
 assert.equal(s.guide,null,'he does not meet you again');
 await view(80,170,Math.PI,.02);await sleep(500);await page.screenshot({path:`${out}/6-after.png`});
 report.cases.push('A finished save (endgame 2) loads into the meadow with the column gone and no meeting');

 // 4. the fixture's finale to black, and back to its meadow after the boss
 const real=JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:0,saved2:0,saved3:0,lost0:0,lost1:0,lost2:0,lost3:0,following0:0,following1:0,following2:0,following3:0,ending3:0,endgame:0});
 await page.evaluate(v=>localStorage.setItem('pdoom.campaign.v1',v),real);
 await page.goto(`${origin}endgame-proto/play.html?m=finale&ceo=altman&safemode=1&saved=31,31,31,31&auto=1&autosteer=1&part=3`);
 s=await until(async()=>{const e=await page.evaluate(()=>window.__eg?.ready&&window.__eg.state());return e?.mode_state?.phase==='trick'&&e.mode_state.marks?.length&&e;},'part 3',60000);
 await sleep(2600);const marks=(await eg()).mode_state.marks;
 await page.evaluate(m=>{window.__eg.lookAt(...m[0]);window.__eg.press(0);},marks);
 await until(async()=>(await eg()).phase==='down','the trick shot lands',60000);
 await until(async()=>(await eg()).mode_state.ending==='dialog','the MCP.EXE dialog',40000);await page.click('#dialog-close');
 await until(async()=>(await eg()).mode_state.ending==='black','black',40000);
 await until(()=>page.evaluate(()=>/MEADOW/.test(document.querySelector('#black small')?.textContent??'')),'the way back is offered',10000);
 await sleep(1700);await page.mouse.click(640,400);
 await page.waitForURL(/\?safemode=1&after=5&ceo=altman/,{timeout:15000});
 s=await until(async()=>{const h=await hub();return h?.endgame?.state==='fallen'&&h;},"the fixture's meadow after the boss, the column gone",120000);
 assert.equal(s.guide,null);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')),real,'the real save is untouched');
 await page.screenshot({path:`${out}/7-fixture-after.png`});
 report.cases.push("The fixture's finale ends back in its own meadow after the boss (&after=5), the real save untouched");
 assert.deepEqual(errors,[]);
 report.passed=true;
}catch(e){report.failure=String(e?.stack||e);}
finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
