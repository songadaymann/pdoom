import {startGame} from './doom-qa-ui.mjs';
// Prepare the supplied local WAD music once, outside the live game loop.
// Requires the local Doom server, Chrome and ffmpeg. Derived files stay ignored.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const lump=process.argv[2]||'D_E1M1',name=process.argv[3]||'intake';
if(!/^D_[A-Z0-9_]{1,6}$/.test(lump)||! /^[a-z0-9-]+$/.test(name))throw Error('Use a Doom music lump and a lowercase output name.');
const output=`doom-web/local/${name}-music`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const page=await browser.newPage();
await page.route('**/main.js',async route=>{const source=await fs.readFile('doom-web/main.js','utf8');await route.fulfill({contentType:'text/javascript',body:source.replace(/await audio\.prepareMusic\([^;]+\);/,'')});});
await page.route('**/engine/engine.worker.js',async route=>{
 const original=await fs.readFile('doom-web/engine/engine.worker.js','utf8');
 const extra=`\nconst musicHandler=self.onmessage;self.onmessage=e=>{if(e.data.type==='export-music'){try{const pcm=self.Module.FS.readFile('/intake.wav');self.postMessage({type:'prepared-music',pcm},[pcm.buffer]);}catch(error){self.postMessage({type:'prepare-error',message:String(error)});}return;}musicHandler(e);};`;
 await route.fulfill({contentType:'text/javascript',body:original+extra});
});
await page.addInitScript(()=>{
 const W=window.Worker;window.Worker=class extends W{
  constructor(...args){super(...args);window.__MUSIC_WORKER__=this;window.__QA_WORKER__=this;this.addEventListener('message',e=>{if(e.data.type==='prepared-music')window.__MUSIC_PCM__=e.data.pcm;if(e.data.type==='prepare-error')window.__MUSIC_ERROR__=e.data.message;});}
  postMessage(m,...args){if(m.type==='boot')m.args.push('-nomusic','+set','opl_core','1');return super.postMessage(m,...args);}
 };
});
async function command(text){await page.evaluate(text=>{for(const key of text){const c=key.charCodeAt(0);window.__MUSIC_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:c,which:c,charCode:c,bubbles:true,cancelable:true}});}},text);await page.keyboard.press('Enter');}
try{
 await page.goto('http://127.0.0.1:5198/');await startGame(page);await page.waitForFunction(()=>window.__DOOM_DEBUG__?.state.mode==='playing',null,{timeout:45000});await page.keyboard.press('Backquote');await page.waitForTimeout(200);
 await command(`writewave ${lump} /intake.wav 0 22050 OPL 1`);
 await page.waitForTimeout(1000);await page.evaluate(()=>window.__MUSIC_WORKER__.postMessage({type:'export-music'}));
 await page.waitForFunction(()=>window.__MUSIC_PCM__||window.__MUSIC_ERROR__,null,{timeout:45000});if(await page.evaluate(()=>window.__MUSIC_ERROR__))throw Error(await page.evaluate(()=>window.__MUSIC_ERROR__));
 const base64=await page.evaluate(()=>{const pcm=window.__MUSIC_PCM__;let binary='';for(let i=0;i<pcm.length;i+=32768)binary+=String.fromCharCode(...pcm.subarray(i,i+32768));return btoa(binary);});
 await fs.writeFile(output+'.wav',Buffer.from(base64,'base64'));
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',output+'.wav','-c:a','libvorbis','-q:a','4',output+'.ogg']);
 const wad=await fs.readFile('doom-web/local/DOOM.WAD');const ogg=await fs.readFile(output+'.ogg');
 await fs.writeFile(output+'.json',JSON.stringify({source:'DOOM.WAD: '+lump,sourceSha256:createHash('sha256').update(wad).digest('hex'),renderer:'GZDoom writewave, OPL core 1',outputSha256:createHash('sha256').update(ogg).digest('hex'),outputBytes:ogg.length},null,2));
 console.log('Prepared local '+name+' music ('+ogg.length+' bytes).');
}catch(error){console.log(JSON.stringify({error:String(error),logs:await page.evaluate(()=>window.__DOOM_DEBUG__?.logs.slice(-20))}));throw error;}finally{await browser.close();}
