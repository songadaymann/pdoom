// SAFE MODE after level 2 (2026-10-14): the MEG3N.AVI and AGENTIC.BAT doors (real doors since 2026-10-20 and
// 2026-11-03; not walked into here), the summit's Display Properties final door, the MCP face on the horizon,
// and kickable desktop icons. Loads a campaign with both levels cleared (ten saved), muted. Screenshots in
// output/hub-future/. By default it checks what mann.cool players see (dev-config.json served off);
// HUB_FUTURE_DEV=1 leaves dev-config.json alone. PDOOM_ORIGIN (e.g. http://127.0.0.1:5208) points it at another server.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/hub-future',url=process.env.DOOM_URL||(process.env.PDOOM_ORIGIN||'http://127.0.0.1:5198').replace(/\/?$/,'/');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={cases:[],errors:[],fps:{}};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)(report.notFound??=[]).push(r.status()+' '+r.url());});
page.on('console',m=>{if(m.type()==='error'||/THREE\.WebGLProgram|shader/i.test(m.text()))report.errors.push('console: '+m.text());});
if(process.env.HUB_FUTURE_DEV!=='1')await page.route('**/dev-config.json',r=>r.fulfill({json:{enabled:false}}));
await page.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0})));
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const view=(x,z,yaw,pitch=0)=>page.evaluate(([x,z,yaw,pitch])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,pitch),[x,z,yaw,pitch]);
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
const wait=async(test,label,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){const s=await read();if(test(s))return s;await page.waitForTimeout(100);}throw Error(label+': '+JSON.stringify((await read()).outside?.dialog??null));};
const fps=async()=>page.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2500)requestAnimationFrame(f);else r(Math.round(n/((performance.now()-t0)/1000)));};requestAnimationFrame(f);}));
const deg=d=>d*Math.PI/180;
let dev=false;
try{
 await page.goto(url+'?ceo=altman');await page.waitForFunction(()=>window.render_game_to_text);
 dev=await page.evaluate(()=>['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&fetch('dev-config.json').then(r=>r.json()).then(j=>j.enabled===true).catch(()=>false));report.dev=dev;await page.click('#title-enter');await page.click('#menu-load');
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.saved_visual===10,{},{timeout:60000});
 let s=await read();
 assert.equal(s.outside.future.visible,true);assert.equal(s.outside.future.wait,10,'Wait box counts the ten still out there');assert.equal(s.outside.future.mcp_blocks,8,'MCP face at 8 x 8 after two levels');
 assert.equal(s.outside.icons.visible,true);assert.equal(s.outside.icons.icons.length,45,'The nine desktop icons plus the first wave of detritus and its piles (after two levels)');
 report.cases.push('Both levels cleared: future structures and 45 toys visible, Wait 10, MCP face 8 x 8');
 // Views: the bunker exit, the look back south (AGENTIC, MCP), west to MEG3N, the summit.
 await view(17,-3,0);await page.waitForTimeout(900);await shot('01-bunker-exit-north');report.fps.bunker=await fps();
 await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(false));report.fps.bunker_without=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(true));
 await view(17,-20,Math.PI,.04);await page.waitForTimeout(600);await shot('02-look-back-south');
 await view(-14,-20,1.758,.05);await page.waitForTimeout(600);await shot('03-west-to-meg3n');
 await view(-127.6,-8.1,deg(115),.16);await page.waitForTimeout(800);await shot('04-meg3n');
 await view(126,56.4,deg(210),.42);await page.waitForTimeout(800);await shot('05-agentic');report.fps.agentic=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(false));report.fps.agentic_without=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(true));
 await view(100,20,-2.57,.55);await page.waitForTimeout(700);await shot('05b-agentic-top');
 await view(-19.8,-54.7,.593,.3);await page.waitForTimeout(800);await shot('06-summit-dialog');
 // MEG3N's door is a real door since 2026-10-20 (scripts/factory-hub-smoke.mjs walks in).
 await view(-147.5,1.23,deg(115),0);s=await wait(s=>s.outside.nearest_future==='meg3n','Prompt at the MEG3N door');assert.match(String(await page.locator('#hub-enter').textContent()),/Enter MEG3N\.AVI/);
 report.cases.push('MEG3N.AVI: SPACE enters the factory (no install dialog)');
 // AGENTIC.BAT is a real door since level 4's release (2026-11-03); scripts/agentic-*-smoke.mjs play the level, so it's not walked into here.
 await view(142,84.1,deg(210),.1);s=await wait(s=>s.outside.nearest_future==='agentic','Prompt at the AGENTIC door');assert.match(String(await page.locator('#hub-enter').textContent()),/Enter AGENTIC\.BAT/);
 assert.equal(s.outside.dialog,null,'No install dialog');assert.equal(s.outside.future.agentic.live,false,'Its doorway is a still while level 4 is not loaded');assert.equal(s.outside.future.agentic.strip,'inside,inside,inside,inside,inside');
 await page.waitForTimeout(400);await shot('07-agentic-live-door');report.cases.push('AGENTIC.BAT: SPACE enters the pod farm (no install dialog)');
 // The final door: Display Properties, Wait 10 people, Preview not available, OK closes.
 await view(-41.6,-87,.593,.05);await wait(s=>s.outside.nearest_future==='final','Prompt at the final door');await page.keyboard.press('Space');
 s=await wait(s=>s.outside.dialog?.id==='final','Display Properties dialog');assert.match(await page.locator('#hub-dialog .win95-text').textContent(),/Wait: 10 people/);await page.waitForTimeout(400);await shot('11-display-properties');
 await page.locator('#hub-dialog .win95-a').click();s=await wait(s=>/Preview is not available/.test(s.outside.dialog?.status||''),'Preview refuses');
 await page.keyboard.press('Space');await wait(s=>s.outside.dialog===null,'OK closes');report.cases.push('Final door: Display Properties, Wait: 10 people, Preview not available, OK closes');
 // Kick My Computer: walk straight into it.
 await view(3,-6.5,0,-.08);await page.waitForTimeout(300);const before=(await read()).outside.icons.icons.find(i=>i.id==='computer');
 await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');await page.waitForTimeout(250);await shot('12-kick');
 s=await wait(s=>s.outside.icons.icons.find(i=>i.id==='computer').kicks>0,'My Computer kicked');const after=s.outside.icons.icons.find(i=>i.id==='computer');
 await page.waitForTimeout(2200);const rest=(await read()).outside.icons.icons.find(i=>i.id==='computer');
 assert.ok(Math.hypot(rest.x-before.x,rest.z-before.z)>2,'It flew off: '+JSON.stringify([before,rest]));assert.ok(rest.air<.05,'And settled');
 report.kick={before,after,rest};report.cases.push(`Walking into My Computer kicks it ${Math.hypot(rest.x-before.x,rest.z-before.z).toFixed(1)} m`);
 await view(rest.x-2,rest.z+5,deg(20),-.05);await page.waitForTimeout(500);await shot('13-icons-close');
 // The phone booth rings in threes every 12 s.
 const rings=(await read()).outside.future.phone_rings;await view(140,83,deg(210));await wait(s=>s.outside.future.phone_rings>rings,'The phone booth rings',14000);report.cases.push('AGENTIC phone booth rings within 12 s when near');
 // The HAL exit view after level 2.
 await view(.55,-197.9,deg(-223));await page.waitForTimeout(700);await shot('14-hal-exit-view');
 report.final=await read();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e?.stack||e);report.final=await read().catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,fps:report.fps,errors:report.errors.slice(0,5),notFound:report.notFound?.slice(0,5),failure:report.failure?.slice(0,800)}));process.exit(report.passed?0:1);
