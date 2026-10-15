// Check actual rendered stereo audio as well as the running booth's locality.
import {build} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DOOM_OUT||'output/phone-audio',url=process.env.DOOM_URL||'http://127.0.0.1:5198/';await fs.mkdir(out,{recursive:true});
await build({configFile:false,logLevel:'error',build:{outDir:out+'/module',emptyOutDir:true,
 lib:{entry:'src/doom-phone-audio.ts',formats:['es'],fileName:()=> 'phone.mjs'}}});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),page=await browser.newPage(),report={cases:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
await page.route('**/__qa_phone_audio.mjs',r=>r.fulfill({path:out+'/module/phone.mjs',contentType:'text/javascript'}));
try{
 await page.goto(url+'?safemode=1&level=five-prisons');
 await page.waitForFunction(()=>window.__DOOM_DEBUG__?.outside?.getState().saved_visual===10,{},{timeout:90000});
 const view=(x,z,yaw=0)=>page.evaluate(a=>window.__DOOM_DEBUG__.outside.debug.setView(...a),[x,z,yaw,0]);
 const phone=()=>page.evaluate(()=>window.__DOOM_DEBUG__.outside.getState().future.phone_audio);
 await view(17,-3);await page.waitForTimeout(150);let s=await phone();assert.equal(s.gain,0);assert.ok(s.distance>36);
 report.far=s;report.cases.push('Booth is completely silent from the bunker');
 await view(137,72);await page.waitForTimeout(150);s=await phone();assert.ok(s.gain>.15);assert.equal(s.spatial,'HRTF');
 await page.waitForFunction(()=>window.__DOOM_DEBUG__.outside.getState().future.phone_audio.playing,{},{timeout:14000});
 report.near=await phone();report.cases.push('Approaching the booth makes the scheduled bell audible');
 await view(17,-3);await page.waitForTimeout(100);assert.equal((await phone()).gain,0);
 report.cases.push('Walking away mutes an already scheduled ring sequence');
 await page.keyboard.press('Escape');await page.waitForTimeout(100);s=await phone();assert.equal(s.gain,0);assert.equal(s.playing,false);
 await page.keyboard.press('Escape');report.cases.push('Pause cancels ringing and all scheduled remaining bells');
 await page.evaluate(()=>window.__DOOM_DEBUG__.outside.setActive(false));s=await phone();
 assert.equal(s.active,false);assert.equal(s.gain,0);assert.equal(s.playing,false);
 await page.evaluate(()=>window.__DOOM_DEBUG__.outside.setActive(true,'five-prisons'));
 report.cases.push('Leaving the meadow disables the booth audio; returning restores its locality gate');
 report.rendered=await page.evaluate(async()=>{
  const {makePhoneAudio}=await import('/__qa_phone_audio.mjs');
  async function render(yaw,move=false,far=false){
   const context=new OfflineAudioContext(2,44100*2.5,44100),phone=makePhoneAudio(context,{x:7,y:1.6,z:-4});
   phone.update({x:far?100:0,y:1.6,z:0},yaw,0,true);phone.ring();
   if(move)context.suspend(.75).then(()=>{phone.update({x:100,y:1.6,z:0},yaw,0,true);context.resume();});
   const buffer=await context.startRendering();
   const energy=(channel,start,end)=>{const a=buffer.getChannelData(channel);let sum=0;for(let i=Math.floor(start*44100);i<Math.floor(end*44100);i++)sum+=a[i]*a[i];return Math.sqrt(sum/((end-start)*44100));};
   const result={left:energy(0,.1,.35),right:energy(1,.1,.35),lateLeft:energy(0,1.8,2.05),lateRight:energy(1,1.8,2.05)};phone.dispose();return result;
  }
  return {right:await render(0),turned:await render(Math.PI),far:await render(0,false,true),walkedAway:await render(0,true)};
 });
 const r=report.rendered;assert.ok(r.right.right>r.right.left*1.3,'Booth to right is louder in right ear');
 assert.ok(r.turned.left>r.turned.right*1.3,'Turning reverses the perceived side');
 assert.equal(r.far.left+r.far.right+r.far.lateLeft+r.far.lateRight,0,'No distant sound or initial click');
 assert.ok(r.walkedAway.right>.001);assert.ok(r.walkedAway.lateLeft+r.walkedAway.lateRight<.00001,'Remaining scheduled rings are silent after walking away');
 report.cases.push('Rendered HRTF audio switches ears when turning; distant and walked-away bells render silent');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
console.log(JSON.stringify(report));process.exit(report.passed?0:1);
