import assert from 'node:assert/strict';
export function nativeQA(page){
 const read=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 // Deadlines are wall-clock, but a closed lid (clamshell sleep, DarkWake) freezes the
 // engine and this loop together. A long gap between polls is the host suspended, not
 // game time, so extend the deadline instead of failing on the last frozen frame (2026-10-17).
 async function wait(test,label,timeout=8000){let end=Date.now()+timeout,last=Date.now(),suspended=0;while(Date.now()<end){const s=await read();assert.notEqual(s.mode,'error',s.error);if(test(s))return s;await page.waitForTimeout(100);const now=Date.now(),gap=now-last-100;last=now;if(gap>2000){end+=gap;suspended+=gap;console.warn(`[native-qa] host suspended ${Math.round(gap/1000)} s during "${label}"; deadline extended`);}}throw Error(label+(suspended?` (host suspended ${Math.round(suspended/1000)} s)`:'')+': '+JSON.stringify(await read()));}
 async function face(angle){for(let i=0;i<20;i++){const s=await read(),d=((angle-s.world.angle+540)%360)-180;if(Math.abs(d)<5)return;const k=d>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(k);await page.waitForTimeout(Math.min(700,Math.max(40,Math.abs(d)*8)));await page.keyboard.up(k);await page.waitForTimeout(180);}throw Error('Facing '+angle);}
 async function rawKey(code,key,keyCode){await page.evaluate(({code,key,keyCode})=>{for(const evType of ['keydown','keyup'])window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code,key,keyCode,which:keyCode,bubbles:true,cancelable:true}});},{code,key,keyCode});}
 async function consoleKey(){await rawKey('Backquote','`',192);}
 async function command(text){await wait(s=>s.world?.ticks>35&&!s.uiBlocked,'Console warmup');await consoleKey();await page.waitForTimeout(250);await page.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);await rawKey('Enter','Enter',13);await page.waitForTimeout(250);if(text!=='kill')await consoleKey();await page.waitForTimeout(300);}
 async function warp(x,y,angle){await command(`warp ${x} ${y}`);await wait(s=>Math.hypot(s.world.x-x,s.world.y-y)<30,'Warp');if(angle!==undefined)await face(angle);}
 async function press(key){if(key!=='Escape')await wait(s=>!s.uiBlocked,"Cinematic finished");await page.keyboard.press(key,{delay:80});await page.waitForTimeout(240);}
 async function hold(key,ms){if(key!=='Escape')await wait(s=>!s.uiBlocked,"Cinematic finished");await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(200);}
 return {read,wait,face,command,warp,press,hold};
}
