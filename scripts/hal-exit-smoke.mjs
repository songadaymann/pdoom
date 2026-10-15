import {chromium} from '@playwright/test';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';import {escapeHelpers} from './escape-browser-helpers.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.DOOM_OUT||'output/campaign-v2/hal-exit';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});const q=nativeQA(page),{read,wait,face,command,warp,press,hold}=q;
const shot=async(_,n)=>page.screenshot({path:out+'/'+n+'.png'});
async function crawlAxis(_,axis,target){await face(90);for(let i=0;i<65;i++){const w=(await read()).world,d=target-w[axis];if(Math.abs(d)<6)return;await hold(d>0?'KeyW':'KeyS',Math.min(450,Math.max(28,Math.abs(d)*9)));}throw Error('Crawl failed');}
const escape=escapeHelpers({read:()=>read(),command:(_,t)=>command(t),face:(_,a)=>face(a),warp:(_,x,y,d,a)=>warp(x,y,a),crawlAxis,shot});
// The Faraday Room's way out (2026-10-11): HAL locks the door, you pull its main breaker,
// and while it reboots (dark station, doors fail open, red route lights) you lead
// everyone through the pod bay to the original E1M7 exit.
const following=s=>s.world.people.filter(p=>p.alive&&p.released);
try{await page.goto('http://127.0.0.1:5198/?level=hal-station&dev=end&ceo=amodei');await startGame(page);await wait(s=>s.mode==='playing'&&s.world?.group_gathered,'HAL end fixture',55000);
await wait(s=>s.dialogue?.refuge_sealed===1&&(s.dialogue.voice==='hal-lockdown'||s.voiceOver.unrecorded.includes('hal-lockdown')||s.voiceOver.played.includes('hal-lockdown')),'HAL locks the Faraday Room',60000);assert.equal((await read()).hal.evacuating,0);report.cases.push('HAL announces the lockdown when everyone is in');
// The breaker sits in a BREAK GLASS case (2026-10-13): SPACE alone does nothing, two
// wrench swings crack then smash it, and only then does SPACE pull the breaker.
const swing=async()=>{await page.keyboard.down('Control');await page.waitForTimeout(250);await page.keyboard.up('Control');await page.waitForTimeout(700);};
// The shutter over the breaker opens once everyone is locked in (2026-10-14).
await warp(192,540,90);await command('centerview');await wait(s=>s.hal.breaker_shutter===1,'Shutter over the breaker opens after the lockdown');report.cases.push('Steel shutter opens on the breaker once HAL locks you in');
await wait(s=>/Smash the glass/.test(s.world.prompt),'Glass prompt facing the north wall');await page.waitForTimeout(1200);await shot(null,'breaker-glass');
await press('Space');await page.waitForTimeout(400);assert.equal((await read()).hal.evacuating,0,'SPACE cannot reach the breaker through the glass');
await swing();await wait(s=>s.hal.breaker_glass===1,'First wrench hit cracks the glass');await shot(null,'breaker-cracked');
await swing();await wait(s=>s.hal.breaker_glass===2&&/main breaker/.test(s.world.prompt),'Second hit smashes it; breaker prompt');await shot(null,'breaker-prompt');
report.cases.push('BREAK GLASS case: SPACE blocked, two wrench hits crack then smash it');
const pulledAt=Date.now();await press('Space');
let s=await wait(s=>s.hal.evacuating===1&&s.hal.reboot_remaining>0,'Breaker pulled');assert.equal(s.hal.levers,0);assert.ok(s.hal.reboot_remaining>2000,'About a minute to get out');report.cases.push('SPACE on the breaker: HAL off, station power 0, reboot timer runs');
assert.ok(s.hal.exit_lights>50,'Floor chevrons laid to the exit');report.cases.push(`${s.hal.exit_lights} floor chevrons pulse along the route to the exit`);
await page.waitForTimeout(600);await shot(null,'blackout-faraday-room');
await warp(208,200,270);await command('centerview');await page.waitForTimeout(300);await shot(null,'floor-lights-a');await page.waitForTimeout(100);await shot(null,'floor-lights-b');
await warp(1200,-2262,0);await command('centerview');await page.waitForTimeout(300);await shot(null,'floor-lights-east');
// Out of the Faraday Room first (they open its door themselves), then wait at the
// original exit: the group walks the whole dark route to you through the pod bay.
await warp(208,80,270);await wait(s=>following(s).every(p=>p.y<340),'Everyone leaves the Faraday Room',20000);report.leftRoomSeconds=Math.round((Date.now()-pulledAt)/100)/10;
await warp(1200,-2256,0);await shot(null,'route-pod-bay');await warp(1808,-2304,180);
// The exit room's original red switch ends the level (2026-10-14), and only once everyone is in.
await warp(1900,-2304,0);await command('centerview');s=await read();assert.equal(s.hal.exit_all_in,0,'The group is still on its way');
await press('Space');await page.waitForTimeout(300);s=await read();assert.equal(s.hal.exit_button,0,'The switch does nothing before everyone is in');assert.match(s.world.message,/Not everyone/);
report.cases.push("Exit switch pressed early: nothing, \"Not everyone's here yet.\"");
s=await wait(s=>s.hal.exit_all_in===1,'Everyone in the exit room',120000);
report.escortSeconds=Math.round((Date.now()-pulledAt)/100)/10;report.rebootLeftSeconds=Math.round(s.hal.reboot_remaining/35);
assert.ok(s.hal.reboot_remaining>0,'Reached the exit before HAL rebooted');report.cases.push(`Five companions followed through the dark station to the original exit in ${report.escortSeconds}s (${report.rebootLeftSeconds}s of reboot left)`);
await page.waitForTimeout(1500);s=await read();assert.equal(s.hal.exit_reached,0,'Reaching the exit room alone no longer ends the level');
await wait(s=>/press the button/.test(s.world.prompt),'Exit switch prompt once everyone is in');await shot(null,'exit-switch-ready');
await press('Space');await wait(s=>s.hal.exit_button===1,'Exit switch pressed');await wait(s=>s.hal.exit_reached===1,'Level ends after the switch');
report.cases.push('Everyone in, SPACE on the red exit switch ends the level');
// Doom's screen melt into Bliss, not a cut: the frozen last frame slides away in columns.
await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).melt.phase==='melting',{},{timeout:25000});
await page.waitForTimeout(450);await shot(null,'melt-a');await page.waitForTimeout(300);await shot(null,'melt-b');
await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).melt.phase==='idle',{},{timeout:5000});assert.equal(await page.evaluate(()=>document.querySelector('#screen-melt').hidden),true);
report.cases.push('Doom screen melt reveals Bliss, then clears');
await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside!==null,{},{timeout:25000});assert.equal((await read()).escape.outside,1);await shot(null,'meadow-reveal');
await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='escaped'&&s.outside.settled===s.world.people.filter(h=>h.alive).length;},{},{timeout:45000});
await wait(s=>s.campaign.saved1===31,'Five HAL figures committed');report.cases.push('Five native escorts emerge and join HAL camp');
const door={x:2.6,z:-200.1},yaw=-223*Math.PI/180,normal={x:-Math.sin(yaw),z:-Math.cos(yaw)};
let outside=(await read()).outside;const humans=outside.people.filter(p=>p.id>=5);
assert.equal(humans.length,5);for(const p of humans)assert.ok((p.x-door.x)*normal.x+(p.z-door.z)*normal.z>6,'Camp stays in front of station');
report.cases.push('All five HAL survivors settle in front of the hull');
async function view(x,z,heading,pitch=0){await page.evaluate(v=>window.__DOOM_DEBUG__.outside.debug.setView(...v),[x,z,heading,pitch]);await page.waitForTimeout(650);}
await view(door.x+normal.x*12,door.z+normal.z*12,yaw+Math.PI);await shot(null,'hal-visible-entrance-and-camp');
const before=(await read()).outside.people;await page.waitForTimeout(1200);const after=(await read()).outside.people;
assert.ok(after.every(p=>Math.hypot(p.x-before.find(b=>b.id===p.id).x,p.z-before.find(b=>b.id===p.id).z)>.005));
report.cases.push('Every settled survivor continues moving in the open meadow');
const side={x:Math.cos(yaw),z:-Math.sin(yaw)},vx=door.x+normal.x*9+side.x*8,vz=door.z+normal.z*9+side.z*8;
await view(vx,vz,Math.atan2(vx-door.x,vz-door.z));await shot(null,'hal-oblique-entrance');
await view(door.x+normal.x*2.8,door.z+normal.z*2.8,yaw+Math.PI);
await wait(s=>s.outside.nearestDoor==='hal-station','Reach framed station entrance');
const frames=(await read()).outside.portal_frames;await page.waitForTimeout(450);assert.ok((await read()).outside.portal_frames>frames);await shot(null,'hal-live-doorway');
report.cases.push('Framed HAL portal refreshes the native view when looked at');
const start=(await read()).outside;await hold('KeyS',500);const moved=(await read()).outside;assert.ok(Math.hypot(moved.x-start.x,moved.z-start.z)>.7);report.cases.push('Walk away from the entrance without hull trapping');
await view(door.x+normal.x*2.8,door.z+normal.z*2.8,yaw+Math.PI);await press('KeyE');await wait(s=>s.mode==='playing'&&s.levelId==='hal-station'&&s.world.entry_hub===1,'Re-enter completed HAL from the visible doorway',30000);
assert.equal((await read()).campaign.saved,5);assert.ok((await read()).world.people.every(p=>p.released&&p.x===0&&p.y===0));report.cases.push('Real doorway re-entry preserves five camped humans and leaves their cells empty');
report.final=await read();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);report.logs=await page.evaluate(()=>window.__DOOM_DEBUG__?.logs).catch(()=>null);await shot(null,'failure').catch(()=>{});}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
