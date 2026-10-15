// CHOOSE YOUR CEO in the real launcher and the real game: the menu, how a choice is
// made (mouse, keyboard, touch, ?ceo=), how it is kept (reload, Restart, storage that
// throws) and that your own body's status-bar face is that CEO's lump, pixel for pixel.
// Needs Chrome and the server on 5198.
//   npm run test:doom:statusbar          (unit tests, the status-bar suite, then this suite)
//   DOOM_CASES=launcher-desktop,touch-portrait node scripts/ceo-pick-browser-smoke.mjs
// Screenshots and report.json go to output/doom-hud/ceo-pick/ (DOOM_OUT to change).
import {startGame} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/doom-hud/ceo-pick',selected=process.env.DOOM_CASES?.split(',');await fs.mkdir(out,{recursive:true});
const CASES=['launcher-desktop','keyboard','altman-in-game-and-transfer','amodei-click-reload-and-restart','doomguy-qa','storage-throws','touch-portrait','touch-landscape','intake-has-no-picker'];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={suite:'ceo-pick-browser-smoke',modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],
 methodology:'Real Chrome and the real GZDoom WebAssembly game. Choices are made with real mouse clicks, keyboard presses and touch taps; transfers use the native console kill command on the local ?dev=end fixture, as the status-bar suite does. Math.random is pinned only where a test needs a known random preselection.'};
const NAMES={altman:'SAM ALTMAN',amodei:'DARIO AMODEI'},LINES={altman:'Shipped the future. Tested it live.',amodei:'Tested the future. Shipped it anyway.'};
const COMPANIONS=['liron','stuart','eliezer','hinton','holly'];
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
// main.js defines render_game_to_text after a top-level await, so it can lag the load event.
const ready=p=>p.waitForFunction(()=>typeof window.render_game_to_text==='function',null,{timeout:15000});
const reload=async p=>{await p.reload();await ready(p);};
async function wait(p,predicate,label,timeout=15000){
 const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(predicate(s))return s;await p.waitForTimeout(100);}
 const s=await read(p);throw Error(label+': '+JSON.stringify({mode:s.mode,ceo:s.ceo,ceoPick:s.ceoPick,statusBar:s.statusBar&&{ceo:s.statusBar.ceo,faceSet:s.statusBar.faceSet,face:s.statusBar.face,loaded:s.statusBar.faceSetsLoaded}}));
}
async function command(p,text){
 await p.keyboard.press('Backquote');await p.waitForTimeout(500);
 await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);
 await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);
}
async function boot(p){await startGame(p);return wait(p,s=>s.mode==='playing'&&s.world?.ticks>35&&s.statusBar?.ready&&s.statusBar.faceSetsLoaded.length===6,'Boot with every face set',60000);}
// The launcher at rest: no hover, no evil grin, fonts loaded.
async function settle(p){await p.mouse.move(1,1);await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>[...document.querySelectorAll('.ceo-face img')].every(i=>i.complete&&(i.hidden||/STFST01\.png$/.test(i.getAttribute('src')))),null,{timeout:4000});await p.waitForTimeout(150);}
async function shot(p,d,label,{bar=false}={}){
 const file=`${out}/${label}.png`;await p.screenshot({path:file});(d.screenshots??=[]).push(file);
 if(bar){const crop=`${out}/${label}-bar.png`;await p.locator('.doom-statusbar').screenshot({path:crop});d.screenshots.push(crop);}
}
async function launcher(p){
 return p.evaluate(()=>{
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,visible:st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0};};
  const group=document.querySelector('#ceo-pick [role="radiogroup"]');
  return {
   visible:box(document.querySelector('#ceo-pick'))?.visible&&!document.querySelector('#launcher').hidden,
   heading:document.querySelector('#ceo-heading')?.textContent.trim(),subtitle:document.querySelector('#ceo-subtitle')?.textContent.trim(),footer:document.querySelector('#ceo-footer')?.textContent.trim(),
   groupLabel:group&&document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
   options:[...document.querySelectorAll('#ceo-pick .ceo-option')].map(o=>{
    const input=o.querySelector('input[type=radio]'),img=o.querySelector('.ceo-face img'),cs=getComputedStyle(img);
    return {ceo:o.dataset.ceo,value:input.value,name:input.name,checked:input.checked,disabled:input.disabled,selectedClass:o.classList.contains('selected'),
     accessibleName:document.getElementById(input.getAttribute('aria-labelledby'))?.textContent.trim(),
     description:document.getElementById(input.getAttribute('aria-describedby'))?.textContent.replace(/\s+/g,' ').trim(),
     img:{src:img.getAttribute('src'),complete:img.complete,natural:[img.naturalWidth,img.naturalHeight],rendered:[img.getBoundingClientRect().width,img.getBoundingClientRect().height],rendering:cs.imageRendering,filter:cs.filter,hidden:img.hidden},
     well:{rendering:getComputedStyle(o.querySelector('.ceo-face')).imageRendering},box:box(o)};
   }),
   start:box(document.querySelector('#start')),focused:document.activeElement?.value||document.activeElement?.id||document.activeElement?.tagName,
   scroll:{launcher:[document.querySelector('#launcher').scrollHeight,document.querySelector('#launcher').clientHeight],page:[document.scrollingElement.scrollHeight,innerHeight],width:[document.scrollingElement.scrollWidth,innerWidth]},
   shell:(()=>{const root=document.querySelector('mann-cool-game-shell')?.shadowRoot;if(!root)return [];return [...root.querySelectorAll('button,a')].map(box).filter(b=>b&&b.visible);})(),
   viewport:{w:innerWidth,h:innerHeight},dpr:devicePixelRatio,storage:(()=>{try{return localStorage.getItem('pdoom-ceo-v1');}catch{return 'throws';}})()};
 });
}
function checkMenu(l){
 assert.equal(l.visible,true,'Picker visible');
 assert.equal(l.heading,'CHOOSE YOUR CEO');assert.equal(l.subtitle,'BOTH OF THEM DID THIS.');assert.equal(l.footer,'SAME RULES. DIFFERENT GUILT.');
 assert.equal(l.groupLabel,'CHOOSE YOUR CEO','Radio group labelled by the heading');
 assert.deepEqual(l.options.map(o=>o.ceo),['altman','amodei'],'Alphabetical');
 for(const o of l.options){
  assert.equal(o.name,'ceo');assert.equal(o.value,o.ceo);assert.equal(o.accessibleName,NAMES[o.ceo]);assert.equal(o.description,LINES[o.ceo]);
  assert.equal(o.img.complete,true);assert.deepEqual(o.img.natural,[24,29],o.ceo+' face loaded');assert.equal(o.img.hidden,false);
  assert.match(o.img.src,new RegExp(`^local/ui/faces/${o.ceo}/STF(ST01|EVL0)\\.png$`));
  const k=o.img.rendered[0]/24;assert.ok(Number.isInteger(k)&&k>=2&&o.img.rendered[1]===29*k,`${o.ceo} face at an integer scale (${o.img.rendered})`);
  assert.equal(o.img.rendering,'pixelated');assert.equal(o.well.rendering,'pixelated');
  assert.equal(o.selectedClass,o.checked,'Selected look follows the checked radio');
 }
 // Both entries are presented identically: same box size, same scale.
 const [a,b]=l.options;assert.ok(Math.abs(a.box.w-b.box.w)<1&&Math.abs(a.box.h-b.box.h)<1,'Entries the same size');assert.deepEqual(a.img.rendered,b.img.rendered);
 assert.ok(Math.abs(a.box.y-b.box.y)<1||Math.abs(a.box.x-b.box.x)<1,'Entries aligned');
}
const checked=l=>l.options.filter(o=>o.checked).map(o=>o.ceo);
// The selected entry's face, as painted, equals its PNG scaled up by nearest neighbour:
// every device pixel of every k x k block. A centred layout can put the image at a
// fractional CSS position, so the element crop may carry up to one CSS pixel extra;
// the image's own origin inside the crop is found by trying each offset.
async function launcherFacePixels(p,ceo){
 const img=p.locator(`.ceo-option[data-ceo="${ceo}"] .ceo-face img`),dpr=await p.evaluate(()=>devicePixelRatio);
 const shotPng=PNG.sync.read(await img.screenshot({animations:'disabled'})),src=PNG.sync.read(await fs.readFile(`doom-web/local/ui/faces/${ceo}/STFST01.png`));
 const css=await img.evaluate(e=>e.getBoundingClientRect().width),k=Math.round(css*dpr/src.width);
 assert.ok(Number.isInteger(css/src.width)&&k>=2,`Integer CSS scale (${css} px for ${src.width})`);
 const spare=[shotPng.width-k*src.width,shotPng.height-k*src.height];
 assert.ok(spare.every(n=>n>=0&&n<=Math.ceil(dpr)),`Painted face is ${k}x the lump (${shotPng.width}x${shotPng.height})`);
 let best=null;
 for(let oy=0;oy<=spare[1];oy++)for(let ox=0;ox<=spare[0];ox++){
  let opaque=0,mismatch=0;
  for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){
   const i=(y*src.width+x)*4;if(src.data[i+3]!==255)continue;opaque++;
   for(let dy=0;dy<k;dy++)for(let dx=0;dx<k;dx++){const j=((oy+y*k+dy)*shotPng.width+ox+x*k+dx)*4;if(shotPng.data[j]!==src.data[i]||shotPng.data[j+1]!==src.data[i+1]||shotPng.data[j+2]!==src.data[i+2])mismatch++;}
  }
  if(!best||mismatch<best.mismatch)best={ceo,scale:k,cssScale:css/src.width,offset:[ox,oy],opaque,mismatch,devicePixels:opaque*k*k};
 }
 assert.ok(best.opaque>300,'Face has pixels');assert.equal(best.mismatch,0,`${ceo} launcher face pixels: ${JSON.stringify(best)}`);
 return best;
}
// The face pixels on the bar canvas equal the face PNG it claims to draw (and, for
// Doomguy, the WAD's own STF* patch in local/ui/stbar/).
async function barFacePixels(p,expectSet){
 let r;
 for(let attempt=0;attempt<8;attempt++){
  r=await p.evaluate(async expectSet=>{
   const s=JSON.parse(window.render_game_to_text()).statusBar,f=s.drawnFace;if(!f)return {ok:false,reason:'nothing drawn'};
   const bar=document.querySelector('.doom-statusbar canvas.statusbar').getContext('2d').getImageData(0,0,320,32).data;
   const src=expectSet==='doomguy'?`local/ui/stbar/${f.lump}.png`:`local/ui/faces/${expectSet}/${f.lump}.png`,img=new Image();img.src=src;await img.decode();
   const g=new OffscreenCanvas(img.width,img.height).getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,img.width,img.height).data;
   let opaque=0,mismatch=0;
   for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
    const i=(y*img.width+x)*4,bx=f.x+x,by=f.y+y;if(!d[i+3]||bx<0||by<0||bx>=320||by>=32)continue;opaque++;
    const j=(by*320+bx)*4;if(bar[j]!==d[i]||bar[j+1]!==d[i+1]||bar[j+2]!==d[i+2])mismatch++;
   }
   return {ok:f.set===expectSet&&opaque>300&&mismatch===0,set:f.set,lump:f.lump,drawnSrc:f.src,reference:src,opaque,mismatch,stateSet:s.faceSet,stateCeo:s.ceo};
  },expectSet);
  if(r.ok)return r;await p.waitForTimeout(120);
 }
 throw Error('Status-bar face pixels: '+JSON.stringify(r));
}
// Restart reloads the page (or replaces it with a ?ceo= link): wait for the new launcher.
async function restart(p){
 await Promise.all([p.waitForEvent('load',{timeout:15000}),p.click('#restart')]);
 await p.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='ready',null,{timeout:15000});
}
async function run(name,url,options,test,{init}={}){
 if(selected&&!selected.includes(name))return;
 const d={name,url,passed:false,errors:[]},c=await browser.newContext(options),p=await c.newPage();const started=Date.now();
 try{
  p.on('pageerror',e=>d.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')d.errors.push(m.text());});
  await p.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...a){super(...a);window.__QA_WORKER__=this;}};});
  if(init)await p.addInitScript(init);
  await p.goto(url);await ready(p);await test(p,d,c);
  d.engineErrors=await p.evaluate(()=>window.__DOOM_DEBUG__.logs.filter(l=>/Script error|VM execution aborted|Unknown identifier|Execution could not continue/.test(l)));
  assert.deepEqual(d.errors,[]);assert.deepEqual(d.engineErrors,[]);d.passed=true;
 }catch(e){d.failure=String(e);d.final=await read(p).then(s=>({mode:s.mode,ceo:s.ceo,ceoPick:s.ceoPick,statusBar:s.statusBar&&{ceo:s.statusBar.ceo,faceSet:s.statusBar.faceSet,drawnFace:s.statusBar.drawnFace}})).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 d.seconds=Math.round((Date.now()-started)/1000);
 report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure)+` (${d.seconds}s)`);
}
const base='http://127.0.0.1:5198/',desktop={viewport:{width:1280,height:800}};
const touch=viewport=>({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:3});
const pinRandom=value=>`Math.random=()=>${value};`;
try{
 await run('launcher-desktop',base,desktop,async(p,d)=>{
  // Fresh profile, Math.random 0.1: Altman preselected at random; nothing is forced.
  await settle(p);let l=await launcher(p);checkMenu(l);d.initial=l;
  assert.deepEqual(checked(l),['altman']);let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.statusBar.ceo],['altman','random','altman']);
  assert.equal(l.storage,null,'Nothing remembered until a choice or a run');
  // What a screen reader gets (Chrome's accessibility tree): one radio group named by the
  // heading, two radios named and described once each; the visible copy is not read twice.
  const ax=(await (await p.context().newCDPSession(p)).send('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored);
  const prop=(n,k)=>n.properties?.find(x=>x.name===k)?.value?.value;
  d.accessibility=ax.filter(n=>['radiogroup','radio'].includes(n.role?.value)).map(n=>({role:n.role.value,name:n.name?.value,description:n.description?.value,checked:prop(n,'checked')}));
  assert.deepEqual(d.accessibility,[{role:'radiogroup',name:'CHOOSE YOUR CEO',description:'BOTH OF THEM DID THIS. SAME RULES. DIFFERENT GUILT.',checked:undefined},
   {role:'radio',name:NAMES.altman,description:LINES.altman,checked:'true'},{role:'radio',name:NAMES.amodei,description:LINES.amodei,checked:'false'}]);
  assert.equal(ax.filter(n=>n.role?.value==='StaticText'&&/^(SAM ALTMAN|DARIO AMODEI)$/.test(n.name?.value||'')).length,0,'Names are read once, as the radios');
  assert.ok(l.start.visible&&l.start.y+l.start.h<=l.viewport.h,'Start visible');assert.ok(l.scroll.launcher[0]<=l.scroll.launcher[1]&&l.scroll.page[0]<=l.scroll.page[1],'No scrolling');
  const amodeiDim=l.options.find(o=>o.ceo==='amodei').img.filter,altmanLit=l.options.find(o=>o.ceo==='altman').img.filter;
  assert.notEqual(amodeiDim,'none','Unselected face dimmed');assert.equal(altmanLit,'none','Selected face lit');
  d.facePixels=[await launcherFacePixels(p,'altman')];await shot(p,d,'launcher-desktop-altman');
  // Click: Amodei; the pick grins (Doom's weapon-pickup face) for 2 s, then rests.
  await p.click('.ceo-option[data-ceo="amodei"]');l=await launcher(p);assert.deepEqual(checked(l),['amodei']);
  assert.equal(l.options[1].img.src,'local/ui/faces/amodei/STFEVL0.png','Evil grin on the new pick');assert.equal(l.options[0].img.src,'local/ui/faces/altman/STFST01.png');
  // The grin lump is 24x30 (STFST01 is 24x29): drawn at the same integer scale, never squashed.
  const grin=await p.waitForFunction(()=>{const i=document.querySelector('.ceo-option[data-ceo="amodei"] .ceo-face img'),r=i.getBoundingClientRect();return i.complete&&i.naturalHeight===30&&{natural:[i.naturalWidth,i.naturalHeight],rendered:[r.width,r.height]};},null,{timeout:2000}).then(h=>h.jsonValue());
  const gk=grin.rendered[0]/24;assert.ok(Number.isInteger(gk)&&grin.rendered[1]===30*gk,`Grin face at an integer scale (${JSON.stringify(grin)})`);d.grin=grin;
  s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered,s.statusBar.ceo],['amodei','picked',true,'amodei']);assert.equal(l.storage,'amodei');
  assert.equal(l.options.find(o=>o.ceo==='altman').img.filter,amodeiDim,'Both entries dim the same way');
  await settle(p);d.facePixels.push(await launcherFacePixels(p,'amodei'));checkMenu(await launcher(p));await shot(p,d,'launcher-desktop-amodei');
  // And back: identical treatment the other way round.
  await p.click('.ceo-option[data-ceo="altman"] .ceo-name');assert.deepEqual(checked(await launcher(p)),['altman']);assert.equal((await read(p)).statusBar.ceo,'altman');
  // A different random draw preselects the other CEO in a fresh profile.
  const other=await p.context().browser().newContext(desktop),q=await other.newPage();await q.addInitScript(pinRandom(0.9));await q.goto(base);await ready(q);
  const drawn=await read(q);assert.deepEqual([drawn.ceo,drawn.ceoPick.source],['amodei','random']);await other.close();
 },{init:pinRandom(0.1)});
 await run('keyboard',base+'?ceo=doomguy',desktop,async(p,d)=>{
  // ?ceo=doomguy leaves both entries unchecked, so Tab lands on the first and Space picks it.
  let l=await launcher(p);assert.deepEqual(checked(l),[]);
  for(let i=0;i<12&&(await launcher(p)).focused!=='altman';i++)await p.keyboard.press('Tab');
  assert.equal((await launcher(p)).focused,'altman','Tab reaches the radio group');
  await p.keyboard.press('Space');l=await launcher(p);assert.deepEqual(checked(l),['altman'],'Space selects');assert.equal((await read(p)).statusBar.ceo,'altman');
  await p.keyboard.press('ArrowRight');l=await launcher(p);assert.deepEqual(checked(l),['amodei'],'Arrow moves the choice');assert.equal(l.focused,'amodei');
  await p.keyboard.press('ArrowDown');assert.deepEqual(checked(await launcher(p)),['altman'],'Arrows wrap like a radio group');
  await p.keyboard.press('ArrowUp');assert.deepEqual(checked(await launcher(p)),['amodei']);
  // Doom-menu cursor: arrows also work with focus elsewhere on the launcher.
  await p.locator('#start').focus();await p.keyboard.press('ArrowLeft');l=await launcher(p);assert.deepEqual(checked(l),['altman']);assert.equal(l.focused,'altman','Focus follows the cursor');
  await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('ArrowRight');assert.deepEqual(checked(await launcher(p)),['amodei']);
  assert.equal((await read(p)).statusBar.ceo,'amodei');await settle(p);
  // Shift+Tab leaves the group in one step; Tab comes back to the checked entry.
  await p.locator('input[value="amodei"]').focus();await p.keyboard.press('Tab');assert.equal((await launcher(p)).focused,'start','Tab goes on to Start');
  await p.keyboard.press('Shift+Tab');assert.equal((await launcher(p)).focused,'amodei','Shift+Tab returns to the checked entry');
  await shot(p,d,'launcher-keyboard-focus');
  // Enter picks the entry under the cursor and starts; the opening crawl stays on panel 1.
  await p.keyboard.press('Enter');const story=await wait(p,s=>s.mode==='story','Enter starts the run');
  assert.equal(story.opening.panel,1,'The Enter that started the run did not also skip a panel');assert.equal(story.ceoPick.locked,true);
  assert.deepEqual((await launcher(p)).options.map(o=>o.disabled),[true,true],'Choice fixed once the run starts');
  await p.click('#story-skip');const s=await wait(p,s=>s.mode==='playing'&&s.statusBar?.ready&&s.world?.ticks>35,'Boot',60000);
  assert.equal(s.statusBar.ceo,'amodei');d.bar=await barFacePixels(p,'amodei');
  // Arrow keys in play turn the player; they never reach the (hidden, locked) menu.
  await p.keyboard.press('ArrowLeft');assert.equal((await read(p)).ceo,'amodei');
 });
 await run('altman-in-game-and-transfer',base+'?ceo=altman&dev=end',desktop,async(p,d)=>{
  // A remembered Amodei loses to ?ceo=altman.
  await p.evaluate(()=>localStorage.setItem('pdoom-ceo-v1','amodei'));await reload(p);
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['altman','url']);assert.deepEqual(checked(await launcher(p)),['altman']);
  s=await boot(p);assert.equal(s.ceo,'altman');assert.equal(s.statusBar.ceo,'altman');assert.equal(s.statusBar.faceSet,'altman');
  assert.deepEqual(s.statusBar.faceSetsLoaded,['altman',...COMPANIONS]);
  d.own=await barFacePixels(p,'altman');assert.match(d.own.drawnSrc,/^local\/ui\/faces\/altman\/STF/);await shot(p,d,'ingame-altman',{bar:true});
  assert.equal((await read(p)).ceoPick.remembered,true,'The CEO you played is remembered');
  // Transfer: the CEO's own dead face first, then the companion's own set.
  await p.evaluate(()=>{window.__sb=[];window.__sbTimer=setInterval(()=>{const b=JSON.parse(window.render_game_to_text()).statusBar;window.__sb.push({face:b.face,set:b.faceSet,drawn:b.drawnFace?.set});},20);});
  await command(p,'kill');const moved=await wait(p,s=>s.world.alive===5&&s.world.controlled>0,'Body transfer');
  const id=COMPANIONS[moved.world.controlled-1];await wait(p,s=>s.statusBar.faceSet===id&&s.statusBar.face!=='STFDEAD0','Companion face set',6000);
  const trace=await p.evaluate(()=>{clearInterval(window.__sbTimer);return window.__sb;});
  assert.ok(trace.some(e=>e.face==='STFDEAD0'&&e.set==='altman'&&e.drawn==='altman'),'Altman\'s own dead face before the companion');
  d.companion=await barFacePixels(p,id);assert.equal((await read(p)).statusBar.ceo,'altman','Body 0 is still Altman');await shot(p,d,'ingame-altman-companion-'+id,{bar:true});
 });
 await run('amodei-click-reload-and-restart',base+'?dev=end',desktop,async(p,d)=>{
  // Amodei is the random preselection here (0.9); clicking the entry that is already
  // checked is still a choice, so it is remembered (no change event fires for it).
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered],['amodei','random',false]);
  await p.click('.ceo-option[data-ceo="amodei"]');s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered],['amodei','picked',true]);
  await reload(p);s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['amodei','stored'],'Reload keeps the choice');assert.deepEqual(checked(await launcher(p)),['amodei']);
  s=await boot(p);assert.deepEqual([s.statusBar.ceo,s.statusBar.faceSet],['amodei','amodei']);d.own=await barFacePixels(p,'amodei');await shot(p,d,'ingame-amodei',{bar:true});
  // Restart (a page reload) comes back with the same CEO, and the next run wears it too.
  await restart(p);assert.match(p.url(),/\/\?dev=end$/,'Plain reload: the URL is unchanged');
  s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['amodei','stored'],'Restart keeps the CEO');
  s=await boot(p);assert.equal(s.statusBar.ceo,'amodei');d.afterRestart=await barFacePixels(p,'amodei');
 },{init:pinRandom(0.9)});
 await run('doomguy-qa',base+'?ceo=doomguy',desktop,async(p,d)=>{
  // Hidden QA face: neither entry is checked, nothing is remembered, Doomguy wears body 0.
  const l=await launcher(p);checkMenu(l);assert.deepEqual(checked(l),[]);assert.ok(l.options.every(o=>!o.selectedClass));
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.statusBar.ceo],['doomguy','url','doomguy']);
  s=await boot(p);assert.equal(s.statusBar.faceSet,'doomguy');assert.deepEqual(s.statusBar.faceSetsLoaded,['doomguy',...COMPANIONS]);
  d.own=await barFacePixels(p,'doomguy');assert.equal(await p.evaluate(()=>localStorage.getItem('pdoom-ceo-v1')),null,'The QA face is never remembered');
  await shot(p,d,'ingame-doomguy-qa',{bar:true});
 });
 await run('storage-throws',base+'?dev=end',desktop,async(p,d)=>{
  // localStorage throws on every access: the menu still works and Restart keeps the CEO by URL.
  let l=await launcher(p);assert.equal(l.storage,'throws');checkMenu(l);assert.deepEqual(checked(l),['amodei'],'Random preselection (0.9)');
  await p.click('.ceo-option[data-ceo="altman"]');let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.remembered],['altman',false]);
  s=await boot(p);assert.equal(s.statusBar.ceo,'altman');d.own=await barFacePixels(p,'altman');
  await restart(p);
  d.restartUrl=p.url();assert.match(d.restartUrl,/\?dev=end&ceo=altman$/);
  s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['altman','url'],'Restart keeps the CEO without storage');
  // Changing the pick keeps the ?ceo= link in step, so a reload shows the new pick.
  await p.click('.ceo-option[data-ceo="amodei"]');assert.match(p.url(),/ceo=amodei/);await reload(p);assert.equal((await read(p)).ceo,'amodei');
  s=await boot(p);assert.equal(s.statusBar.ceo,'amodei');d.own2=await barFacePixels(p,'amodei');
 },{init:pinRandom(0.9)+`Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('The operation is insecure.','SecurityError');}});`});
 for(const [name,viewport]of [['touch-portrait',{width:390,height:844}],['touch-landscape',{width:844,height:390}]])await run(name,base,touch(viewport),async(p,d)=>{
  await settle(p);
  // The shell's corner buttons arrive from mann.cool; give them a moment to lay out.
  await p.waitForFunction(()=>document.querySelector('mann-cool-game-shell')?.shadowRoot?.querySelector('button'),null,{timeout:5000}).catch(()=>{});await p.waitForTimeout(300);
  for(const ceo of ['altman','amodei']){
   await p.tap(`.ceo-option[data-ceo="${ceo}"]`);await settle(p);const l=await launcher(p);d[ceo]=l;checkMenu(l);assert.deepEqual(checked(l),[ceo],'Tap selects '+ceo);
   assert.equal((await read(p)).statusBar.ceo,ceo);
   assert.ok(l.start.visible&&l.start.y>=0&&l.start.y+l.start.h<=viewport.height,'Start inside the viewport without scrolling');
   assert.ok(l.scroll.launcher[0]<=l.scroll.launcher[1]+1,'Launcher does not scroll');assert.ok(l.scroll.page[0]<=l.scroll.page[1]&&l.scroll.width[0]<=l.scroll.width[1],'No page scroll');
   for(const o of l.options){
    assert.ok(o.box.x>=0&&o.box.y>=0&&o.box.x+o.box.w<=viewport.width&&o.box.y+o.box.h<=l.start.y,`${o.ceo} entry fits above Start`);
    assert.ok(o.box.w>=44&&o.box.h>=44,'Touch target');
    for(const b of l.shell)assert.ok(o.box.x>=b.x+b.w||o.box.x+o.box.w<=b.x||o.box.y>=b.y+b.h||o.box.y+o.box.h<=b.y,`${o.ceo} entry clear of the shell buttons`);
   }
   for(const b of l.shell)assert.ok(l.start.x>=b.x+b.w||l.start.x+l.start.w<=b.x||l.start.y>=b.y+b.h||l.start.y+l.start.h<=b.y,'Start clear of the shell buttons');
   const [a,b]=l.options;assert.ok(a.box.x+a.box.w<=b.box.x||a.box.y+a.box.h<=b.box.y,'Entries do not overlap');
   (d.facePixels??=[]).push(await launcherFacePixels(p,ceo));
   await shot(p,d,`launcher-${name}-${ceo}`);
  }
  d.geometry={start:d.amodei.start,options:d.amodei.options.map(o=>o.box),shell:d.amodei.shell,scale:d.amodei.options[0].img.rendered[0]/24};
 });
 await run('intake-has-no-picker',base+'?level=intake',desktop,async(p,d)=>{
  const s=await read(p);assert.equal(s.ceo,null);assert.equal(await p.locator('#ceo-pick').isVisible(),false,'Intake has no status bar and no CEO menu');
 });
}finally{report.passed=report.cases.length===(selected?.length??CASES.length)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);console.log(JSON.stringify(report.cases.map(({name,passed,failure,seconds})=>({name,passed,failure,seconds}))));process.exit(report.passed?0:1);}
