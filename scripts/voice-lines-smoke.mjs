// Recorded voice lines: the subtitle reads what the take says (PDVoiceData.Said), stays up
// for the whole take, and voice-over.js plays it. Needs node scripts/serve-doom.mjs on 5198.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {startGame} from './doom-qa-ui.mjs';import {nativeQA} from './native-qa-helpers.mjs';
const url=process.env.DOOM_URL||'http://127.0.0.1:5198/',manifest=JSON.parse(await fs.readFile('doom-web/voice/manifest.json','utf8')).takes;
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--autoplay-policy=no-user-gesture-required']}),report={cases:[],errors:[]};
async function level(query){
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
 await page.goto(url+query);await startGame(page);const q=nativeQA(page);await q.wait(s=>s.mode==='playing'&&s.world,'Native boot',55000);return q;
}
async function heard(q,key,timeout=20000){
 const take=manifest[key];assert.ok(take,key+' is recorded');
 const s=await q.wait(s=>s.dialogue?.voice===key&&s.dialogue.remaining>0,key+' subtitle',timeout);
 assert.equal(s.dialogue.text,take.text,key+' subtitle reads the take');
 assert.ok(s.dialogue.remaining>=Math.round(take.seconds*35)-35,key+' subtitle lasts the take');
 await q.wait(s=>s.voiceOver.played.includes(key),key+' take plays',8000);
 report.cases.push(`${key}: "${take.text}" (${take.seconds}s)`);
}
try{
 // Level 1: Liron calls once you are within earshot (take says "around", the script "round").
 let q=await level('?level=five-prisons&ceo=amodei');await q.warp(1948,1144,90);await heard(q,'liron-call');
 // World sounds (doors, footsteps) dip under a spoken line and come back after it (2026-10-12).
 await q.wait(s=>s.voiceOver.playing&&s.sound.volumes.effects<.4,'Effects ducked under the line',4000);
 await q.wait(s=>!s.voiceOver.playing&&s.sound.volumes.effects>.9,'Effects back after the line',8000);report.cases.push('Effects bus ducks to 30% under a voice and recovers');
 // Hints are called out on approach, like Liron's call (2026-10-12): Stuart, from outside his gallery.
 await q.command('god');await q.warp(-112,1872,90);await heard(q,'stuart-hint');
 // Level 2: Rob's freed line; his take adds "Now", which the shared script line does not have.
 q=await level('?level=hal-station&ceo=altman');
 await q.command('god');await q.warp(-438,-170,15);await q.press('KeyE');
 await q.wait(s=>s.world.people[0].released,'Rob released (label swap, robot presses STOP)',20000);await heard(q,'rob-freed-guide');
 await q.warp(-1424,-80,90);await heard(q,'dan-hint');
 assert.deepEqual(report.errors,[]);console.log('PASS voice-lines-smoke\n '+report.cases.join('\n '));
}catch(e){console.error('FAIL voice-lines-smoke',e.message.slice(0,1500),report);process.exitCode=1;}
finally{await browser.close();}
