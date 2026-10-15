// SAFE MODE after level 2 (2026-10-14): levels 3 and 4 as locked structures with install dialogs,
// the summit's Display Properties final door, the MCP face on the horizon, and kickable desktop icons.
// Loads a campaign with both levels cleared (ten saved), muted. Screenshots in output/hub-future/.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/hub-future',url=process.env.DOOM_URL||'http://127.0.0.1:5198/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={cases:[],errors:[],fps:{}};
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'||/THREE\.WebGLProgram|shader/i.test(m.text()))report.errors.push('console: '+m.text());});
await page.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0})));
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const view=(x,z,yaw,pitch=0)=>page.evaluate(([x,z,yaw,pitch])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,pitch),[x,z,yaw,pitch]);
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
const wait=async(test,label,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){const s=await read();if(test(s))return s;await page.waitForTimeout(100);}throw Error(label+': '+JSON.stringify((await read()).outside?.dialog??null));};
const fps=async()=>page.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2500)requestAnimationFrame(f);else r(Math.round(n/((performance.now()-t0)/1000)));};requestAnimationFrame(f);}));
const deg=d=>d*Math.PI/180;
try{
 await page.goto(url+'?ceo=altman');await page.waitForFunction(()=>window.render_game_to_text);await page.click('#title-enter');await page.click('#menu-load');
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.saved_visual===10,{},{timeout:60000});
 let s=await read();
 assert.equal(s.outside.future.visible,true);assert.equal(s.outside.future.wait,10,'Wait box counts the ten still out there');assert.equal(s.outside.future.mcp_blocks,8,'MCP face at 8 x 8 after two levels');
 assert.equal(s.outside.icons.visible,true);assert.equal(s.outside.icons.icons.length,9);
 report.cases.push('Both levels cleared: future structures and nine icons visible, Wait 10, MCP face 8 x 8');
 // Views: the bunker exit, the look back south (AGENTIC, MCP), west to MEG3N, the summit.
 await view(17,-3,0);await page.waitForTimeout(900);await shot('01-bunker-exit-north');report.fps.bunker=await fps();
 await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(false));report.fps.bunker_without=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(true));
 await view(17,-20,Math.PI,.04);await page.waitForTimeout(600);await shot('02-look-back-south');
 await view(-14,-20,1.758,.05);await page.waitForTimeout(600);await shot('03-west-to-meg3n');
 await view(-127.6,-8.1,deg(115),.16);await page.waitForTimeout(800);await shot('04-meg3n');
 await view(126,56.4,deg(210),.42);await page.waitForTimeout(800);await shot('05-agentic');report.fps.agentic=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(false));report.fps.agentic_without=await fps();await page.evaluate(()=>window.__DOOM_DEBUG__.outside.debug.setFuture(true));
 await view(100,20,-2.57,.55);await page.waitForTimeout(700);await shot('05b-agentic-top');
 await view(-19.8,-54.7,.593,.3);await page.waitForTimeout(800);await shot('06-summit-dialog');
 // MEG3N's door: Space opens the install dialog; Space is Cancel, which isn't available; R opens READ THIS!.
 await view(-147.5,1.23,deg(115),0);s=await wait(s=>s.outside.nearest_future==='meg3n','Prompt at the MEG3N door');assert.match(s.outside.future?String(await page.locator('#hub-enter').textContent()):'',/Open MEG3N\.AVI/);
 await page.keyboard.press('Space');s=await wait(s=>s.outside.dialog?.id==='meg3n','Install dialog opens');assert.match(s.outside.dialog.title,/Installing MEG3N\.AVI/);assert.match(s.outside.dialog.status,/Copying /);
 await page.waitForTimeout(500);await shot('07-meg3n-install-dialog');
 await page.keyboard.press('Space');s=await wait(s=>/Cancel is not available/.test(s.outside.dialog?.status||''),'Cancel refuses');await shot('08-cancel-not-available');
 report.cases.push('MEG3N.AVI: SPACE opens "Installing MEG3N.AVI", Cancel is not available');
 await page.keyboard.press('KeyR');await page.waitForFunction(()=>!document.querySelector('[data-view=read]').hidden,{},{timeout:5000});s=await read();assert.equal(s.outside.dialog,null,'Dialog closes for READ THIS!');await shot('09-read-this');
 await page.keyboard.press('Escape');await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).outside.paused,{},{timeout:5000});
 report.cases.push('R in the install dialog opens READ THIS!; Esc twice returns to SAFE MODE');
 // AGENTIC's door; walking away closes the dialog.
 await view(142,84.1,deg(210),.1);await wait(s=>s.outside.nearest_future==='agentic','Prompt at the AGENTIC door');await page.keyboard.press('Space');
 s=await wait(s=>s.outside.dialog?.id==='agentic','AGENTIC install dialog');assert.match(s.outside.dialog.title,/Installing AGENTIC\.BAT/);await page.waitForTimeout(400);await shot('10-agentic-install-dialog');
 await view(120,60,deg(210));await wait(s=>s.outside.dialog===null,'Walking away closes the dialog');report.cases.push('AGENTIC.BAT: install dialog, closes when you walk away');
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
console.log(JSON.stringify({passed:report.passed,cases:report.cases,fps:report.fps,errors:report.errors.slice(0,5),failure:report.failure?.slice(0,800)}));process.exit(report.passed?0:1);
