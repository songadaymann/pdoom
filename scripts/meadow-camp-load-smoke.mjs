import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/meadow-camp-load';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={cases:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>localStorage.setItem('pdoom.campaign.v1',JSON.stringify({version:1,ceo:'altman',hub:true,saved0:31,saved1:31,lost0:0,lost1:0,following0:0,following1:0})));
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 await page.goto('http://127.0.0.1:5198/?ceo=altman');await page.waitForFunction(()=>window.render_game_to_text);await page.click('#title-enter');await page.click('#menu-load');
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.saved_visual===10,{},{timeout:60000});
 let s=await read();assert.equal(s.outside.settled,10);assert.equal(s.campaign.saved,10);
 assert.ok(s.outside.people.filter(p=>p.id<5).every(p=>Math.abs(p.x-17)<4&&p.z<-6&&p.z>-10));
 const n={x:-Math.sin(-223*Math.PI/180),z:-Math.cos(-223*Math.PI/180)};
 assert.ok(s.outside.people.filter(p=>p.id>=5).every(p=>(p.x-2.6)*n.x+(p.z+200.1)*n.z>6));
 report.cases.push('Load places all ten saved humans directly at their own two camps');
 await page.evaluate(n=>window.__DOOM_DEBUG__.outside.debug.setView(2.6+n.x*12,-200.1+n.z*12,-43*Math.PI/180,0),n);await page.waitForTimeout(700);await page.screenshot({path:out+'/restored-hal-camp.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside.paused);const before=(await read()).outside.people;await page.waitForTimeout(500);assert.deepEqual((await read()).outside.people,before);await page.keyboard.press('Escape');await page.waitForTimeout(600);assert.notDeepEqual((await read()).outside.people,before);report.cases.push('Esc freezes and resumes camp idle movement');
 report.final=await read();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);report.final=await read().catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));process.exit(report.passed?0:1);
