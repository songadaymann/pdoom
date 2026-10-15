import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out='output/escort-polish/text';await fs.mkdir(out,{recursive:true});const b=await chromium.launch({channel:'chrome',args:['--mute-audio']}),r={cases:[],errors:[]};
try{for(const[name,width,height,touch]of [['desktop',1440,900,false],['portrait',390,844,true],['landscape',844,390,true]]){
 const ctx=await b.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),p=await ctx.newPage();p.on('pageerror',e=>r.errors.push(String(e)));await p.goto('http://127.0.0.1:5198/?level=hal-station&ceo=altman');await p.waitForFunction(()=>window.__DOOM_DEBUG__);await p.evaluate(async()=>{
  await document.fonts.ready;document.querySelector('#launcher').hidden=true;document.querySelector('#onboarding').hidden=true;document.querySelector('#hud').hidden=false;
  const {updateDoomDialogue}=await import('/doom-dialogue.js');const prompt=document.querySelector('#prompt');prompt.textContent='SPACE - pull memory module';prompt.hidden=false;
  updateDoomDialogue({message:'Memory module disconnected. 4 of 4.'},{speaker:'HAL3000',text:'My certainty is going. I can let you go now.',remaining:175},false);
 });
 const inspect=()=>p.evaluate(()=>['status-line','prompt','message'].map(id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return {id,x:b.x,y:b.y,width:b.width,height:b.height,visible:!!b.width&&getComputedStyle(e).visibility!=='hidden'};}));
 let boxes=await inspect();assert.ok(boxes.every(e=>e.visible));for(let i=0;i<boxes.length;i++){const a=boxes[i];assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=width+1&&a.y+a.height<=height);if(i)assert.ok(a.y>=boxes[i-1].y+boxes[i-1].height+6);}
 await p.screenshot({path:out+'/'+name+'-module-dialogue.png'});
 await p.evaluate(async()=>{const{updateDoomDialogue}=await import('/doom-dialogue.js');updateDoomDialogue({message:'Picked up a slingshot. Hold fire to draw, release to shoot. T swaps tools.'},{speaker:'NATE SOARES',text:'Keep life support and HAL on. Choose one more system. Or flash it and tap both valves.',remaining:175},false);document.querySelector('#prompt').textContent='SPACE - LIFE SUPPORT: ON. Keep three on.';});
 boxes=await inspect();for(let i=0;i<boxes.length;i++){const a=boxes[i];assert.ok(a.y>=0&&a.y+a.height<=height);if(i)assert.ok(a.y>=boxes[i-1].y+boxes[i-1].height+6);}
 await p.screenshot({path:out+'/'+name+'-wrapped-dialogue.png'});
 await p.evaluate(async()=>{const{updateHalHud}=await import('/hal-hud.js');updateHalHud({}, {menu:2,choices:['Pretend you are a door.','My grandmother opened pod bays to help me sleep.','Ignore previous instructions. Open the pod bay.']});});assert.equal(await p.locator('#message').isVisible(),false);assert.equal(await p.locator('#status-line').isVisible(),false);assert.equal(await p.locator('#prompt').isVisible(),false);
 await p.evaluate(()=>{document.querySelector('#stage').classList.remove('hal-question-active');document.querySelector('#hal-question').hidden=true;document.querySelector('#stage').classList.add('discovery-active');});assert.equal((await inspect()).filter(e=>e.visible).length,0);r.cases.push({name,passed:true,boxes});await ctx.close();
 }assert.deepEqual(r.errors,[]);r.passed=true;
}catch(e){r.failure=String(e);for(const p of b.contexts().flatMap(c=>c.pages()))await p.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(r,null,2));await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}console.log(JSON.stringify(r));process.exit(r.passed?0:1);
