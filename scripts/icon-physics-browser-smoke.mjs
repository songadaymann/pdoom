// Real-input integration and visual inspection of the chunky SAFE MODE toys.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/icon-physics/browser',url=process.env.DOOM_URL||'http://127.0.0.1:5198/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()).outside);
const view=(p,x,z,yaw=0,pitch=-.12)=>p.evaluate(([x,z,yaw,pitch])=>window.__DOOM_DEBUG__.outside.debug.setView(x,z,yaw,pitch),[x,z,yaw,pitch]);
const place=(p,id,x,z,yaw=0,height=0,flat=false)=>p.evaluate(a=>window.__DOOM_DEBUG__.outside.debug.icons.place(...a),[id,x,z,yaw,height,flat]);
const icon=(s,id='computer')=>s.icons.icons.find(i=>i.id===id);
const shot=(p,name)=>p.screenshot({path:`${out}/${name}.png`});
async function load(options){
 const p=await browser.newPage(options);p.on('pageerror',e=>report.errors.push(String(e)));
 p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await p.goto(url+'?safemode=1&level=five-prisons');
 await p.waitForFunction(()=>window.__DOOM_DEBUG__?.outside?.getState().saved_visual===10,{},{timeout:90000});return p;
}
try{
 const p=await load({viewport:{width:1280,height:800}});
 const start=await read(p);assert.equal(start.icons.physics.engine,'Rapier');
 assert.equal(new Set(start.icons.icons.map(i=>i.mass)).size,9,'Every toy has an authored weight');
 assert.ok(icon(start,'txt').mass<icon(start,'cards').mass&&icon(start,'cards').mass<icon(start).mass);
 report.cases.push('All nine real toy bodies expose distinct weights, with paper and cards lighter than the computer');
 await view(p,3,-6.5,0,-.08);await place(p,'computer',3,-13,.5);
 await place(p,'winamp',-.6,-13.7,.6);await place(p,'paint',6.8,-15,-.45);
 await p.waitForTimeout(100);await shot(p,'01-chunky-icons');
 const before=icon(await read(p));
 await p.keyboard.down('Shift');await p.keyboard.down('KeyW');await p.waitForTimeout(800);
 await shot(p,'02-kick-in-flight');await p.waitForTimeout(350);await p.keyboard.up('KeyW');await p.keyboard.up('Shift');
 let s=await read(p);assert.ok(icon(s).kicks>before.kicks,'Sprint kicks the icon');
 const flying=icon(s);await p.waitForTimeout(4000);s=await read(p);
 const rest=icon(s);assert.ok(Math.hypot(rest.x-before.x,rest.z-before.z)>2);assert.ok(rest.air<.08);assert.ok(rest.speed<.2);
 report.kick={before,flying,rest};report.cases.push('Real sprint input kicks, rotates, travels, lands and settles');
 await view(p,rest.x+1.4,rest.z+3.5,.38,-.28);await p.waitForTimeout(150);await shot(p,'03-fallen-toy');
 // Pause freezes physics; moving the camera cannot billboard the physical toy.
 await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__DOOM_DEBUG__.outside.getState().paused);
 const paused=(await read(p)).icons;await p.waitForTimeout(750);
 assert.deepEqual((await read(p)).icons,paused);
 await view(p,rest.x-3,rest.z,Math.PI/2,-.2);await p.waitForTimeout(150);
 assert.deepEqual(icon(await read(p)).rotation,icon({icons:paused}).rotation);
 await p.keyboard.press('Escape');report.cases.push('Pause freezes physics; camera movement never turns the physical art');
 // Drop a toy on the hillside and inspect its contact with the real ground.
 await view(p,-50,-64,.5,-.2);await place(p,'globe',-55,-70,.6,3);
 await p.waitForTimeout(800);await shot(p,'04-hill-bounce');await p.waitForTimeout(4000);
 const slope=icon(await read(p),'globe');assert.ok(slope.air<.12);assert.ok(Math.hypot(slope.x+55,slope.z+70)>.2);
 report.slope=slope;report.cases.push('A dropped toy bounces and moves downhill');
 // The silhouette edge should be visible before a kick, including a narrow side view.
 await place(p,'floppy',4,-9,.8);await view(p,4,-4,0,-.1);await p.waitForTimeout(120);await shot(p,'05-pixel-edges');
 report.fps=await p.evaluate(()=>new Promise(resolve=>{let n=0;const start=performance.now();function frame(){n++;if(performance.now()-start<2000)requestAnimationFrame(frame);else resolve(Math.round(n*1000/(performance.now()-start)));}requestAnimationFrame(frame);}));
 await p.close();
 const m=await load({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await view(m,3,-6.5,0,-.08);await place(m,'computer',3,-13,.4);await m.waitForTimeout(200);
 const mobileBefore=icon(await read(m));const forward=m.locator('.move-pad [data-code="KeyW"]');
 const bounds=await forward.boundingBox();assert.ok(bounds,'Mobile movement control visible');
 const touch=await m.context().newCDPSession(m);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}]});
 await m.waitForTimeout(1850);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await m.waitForTimeout(500);report.mobile=await read(m);assert.ok(icon(report.mobile).kicks>mobileBefore.kicks,'Touch movement kicks');
 await shot(m,'06-mobile-touch-kick');report.cases.push('Mobile touch movement kicks the same physical toys');await m.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));process.exit(report.passed?0:1);
