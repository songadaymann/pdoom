// CHOOSE YOUR HERO in the real title menu and the real game: the menu's hero page
// (doom-web/onboarding.js, doom-web/ceo-pick.js), how a choice is made (mouse, keyboard,
// touch, ?ceo=), how it is kept (reload, Restart, New Game, storage that throws) and that
// your own body's status-bar face is that CEO's lump, pixel for pixel (Altman wears
// Samwise's face set and Amodei Mario's; ceoFaceId). Levels start from the developer level
// select (?levels=1), as the other level smokes do. Needs Chrome and the server on 5198.
//   npm run test:doom:statusbar          (unit tests, the status-bar suite, then this suite)
//   DOOM_CASES=hero-desktop,touch-portrait node scripts/ceo-pick-browser-smoke.mjs
// Screenshots and report.json go to output/doom-hud/ceo-pick/ (DOOM_OUT to change).
import {qaConsole} from './doom-qa-ui.mjs';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const out=process.env.DOOM_OUT||'output/doom-hud/ceo-pick',selected=process.env.DOOM_CASES?.split(',');await fs.mkdir(out,{recursive:true});
const CASES=['hero-desktop','keyboard','altman-in-game-and-transfer','amodei-reload-and-restart','doomguy-qa','storage-throws','touch-portrait','touch-landscape','pages-without-picker'];
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={suite:'ceo-pick-browser-smoke',modSha256:createHash('sha256').update(await fs.readFile('doom-web/pdoom.pk3')).digest('hex'),cases:[],
 methodology:'Real Chrome and the real GZDoom WebAssembly game. The title menu and its hero page are driven with real mouse clicks, keyboard presses and touch taps; levels start from the developer level select. Transfers use the native console kill command on the local ?dev=end fixture, as the status-bar suite does. Math.random is pinned only to show that it no longer picks the hero.'};
const NAMES={altman:'SAM ALTMAN',amodei:'DARIO AMODEI'},LINES={altman:'Shipped the future. Tested it live.',amodei:'Tested the future. Shipped it anyway.'};
// The status bar's face set for your own body (doom-statusbar.js bodyFaceSets).
const FACES={altman:'samwise',amodei:'mario',doomguy:'doomguy'};
const COMPANIONS=['liron','stuart','eliezer','hinton','holly'];
const read=async p=>JSON.parse(await p.evaluate(()=>window.render_game_to_text()));
// main.js defines render_game_to_text after a top-level await, so it can lag the load event.
const ready=p=>p.waitForFunction(()=>typeof window.render_game_to_text==='function',null,{timeout:15000});
const reload=async p=>{await p.reload();await ready(p);};
async function wait(p,predicate,label,timeout=15000){
 const end=Date.now()+timeout;while(Date.now()<end){const s=await read(p);assert.notEqual(s.mode,'error',s.error);if(predicate(s))return s;await p.waitForTimeout(100);}
 const s=await read(p);throw Error(label+': '+JSON.stringify({mode:s.mode,menu:s.menu?.page,ceo:s.ceo,ceoPick:s.ceoPick,statusBar:s.statusBar&&{ceo:s.statusBar.ceo,faceSet:s.statusBar.faceSet,face:s.statusBar.face,loaded:s.statusBar.faceSetsLoaded}}));
}
const menu=(p,page)=>wait(p,s=>s.menu?.page===page,'Menu page '+page);
// A menu page focuses its first choice a moment after it opens.
const focusOn=(p,id,label)=>p.waitForFunction(id=>(document.activeElement?.value||document.activeElement?.id)===id,id,{timeout:2000}).catch(async()=>{throw Error(`${label}: focus on ${(await hero(p)).focused}`);});
async function command(p,text){
 await wait(p,s=>s.mode==='playing'&&!s.uiBlocked,'Game running before the console');await p.keyboard.press('Backquote');await p.waitForTimeout(500);
 await p.evaluate(text=>{for(const key of text){const code=key.charCodeAt(0);window.__QA_WORKER__.postMessage({type:'input',target:'window',evType:'keypress',init:{key,keyCode:code,which:code,charCode:code,bubbles:true,cancelable:true}});}},text);
 await p.keyboard.press('Enter');await p.waitForTimeout(300);if(text!=='kill')await p.keyboard.press('Backquote');await p.waitForTimeout(500);
}
// Title, then NEW GAME: the hero page, by mouse or touch.
async function openHero(p,{tap=false}={}){
 const press=selector=>tap?p.tap(selector):p.click(selector);
 await press('#title-enter');await menu(p,'main');await press('#menu-new');return menu(p,'hero');
}
// From the hero page: CONTINUE, then the level select's first level; past the level film
// (skipped as a player would) into the running level with every face set loaded.
async function startLevel(p){
 await p.click('#hero-next');await menu(p,'levels');await p.click('#level-five-prisons');
 if((await read(p)).menu.page==='confirm')await p.click('#menu-confirm');
 return playing(p);
}
async function playing(p){
 const end=Date.now()+60000;
 while(Date.now()<end){
  const s=await read(p);assert.notEqual(s.mode,'error',s.error);
  if(s.mode==='playing'&&!s.uiBlocked&&s.world?.ticks>35&&s.statusBar?.ready&&s.statusBar.faceSetsLoaded.length===6)return s;
  const skip=p.locator('#intro-video .iv-skip, #intro-video .iv-fallback button');if(await skip.count())await skip.first().click().catch(()=>{});
  await p.waitForTimeout(150);
 }
 return wait(p,()=>false,'Level with every face set',0);
}
// The hero page at rest: no hover, no evil grin, fonts loaded.
async function settle(p){await p.mouse.move(1,1);await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>[...document.querySelectorAll('.ceo-face img')].every(i=>i.complete&&(i.hidden||/STFST01\.png$/.test(i.getAttribute('src')))),null,{timeout:4000});await p.waitForTimeout(150);}
async function shot(p,d,label,{bar=false}={}){
 const file=`${out}/${label}.png`;await p.screenshot({path:file});(d.screenshots??=[]).push(file);
 if(bar){const crop=`${out}/${label}-bar.png`;await p.locator('.doom-statusbar').screenshot({path:crop});d.screenshots.push(crop);}
}
async function hero(p){
 return p.evaluate(()=>{
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,visible:st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0};};
  const root=document.querySelector('#onboarding'),view=root.querySelector('[data-view="hero"]'),group=document.querySelector('#ceo-pick [role="radiogroup"]');
  return {
   visible:!root.hidden&&!view.hidden&&view.contains(document.querySelector('#ceo-pick'))&&box(document.querySelector('#ceo-pick')).visible,
   heading:view.querySelector(':scope > h2')?.textContent.trim(),subtitle:document.querySelector('#ceo-subtitle')?.textContent.trim(),footer:document.querySelector('#ceo-footer')?.textContent.trim(),
   groupLabel:group&&document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
   options:[...document.querySelectorAll('#ceo-pick .ceo-option')].map(o=>{
    const input=o.querySelector('input[type=radio]'),img=o.querySelector('.ceo-face img'),cs=getComputedStyle(img);
    return {ceo:o.dataset.ceo,value:input.value,name:input.name,checked:input.checked,disabled:input.disabled,selectedClass:o.classList.contains('selected'),
     accessibleName:document.getElementById(input.getAttribute('aria-labelledby'))?.textContent.trim(),
     description:document.getElementById(input.getAttribute('aria-describedby'))?.textContent.replace(/\s+/g,' ').trim(),
     img:{src:img.getAttribute('src'),complete:img.complete,natural:[img.naturalWidth,img.naturalHeight],rendered:[img.getBoundingClientRect().width,img.getBoundingClientRect().height],rendering:cs.imageRendering,filter:cs.filter,hidden:img.hidden},
     well:{rendering:getComputedStyle(o.querySelector('.ceo-face')).imageRendering},box:box(o)};
   }),
   next:box(document.querySelector('#hero-next')),focused:document.activeElement?.value||document.activeElement?.id||document.activeElement?.tagName,
   scroll:{menu:[root.scrollHeight,root.clientHeight],page:[document.scrollingElement.scrollHeight,innerHeight],width:[document.scrollingElement.scrollWidth,innerWidth]},
   shell:(()=>{const shadow=document.querySelector('mann-cool-game-shell')?.shadowRoot;if(!shadow)return [];return [...shadow.querySelectorAll('button,a')].map(box).filter(b=>b&&b.visible);})(),
   viewport:{w:innerWidth,h:innerHeight},dpr:devicePixelRatio,storage:(()=>{try{return localStorage.getItem('pdoom-ceo-v1');}catch{return 'throws';}})()};
 });
}
function checkMenu(l){
 assert.equal(l.visible,true,'Hero page visible');
 assert.equal(l.heading,'CHOOSE YOUR HERO');assert.equal(l.subtitle,'BOTH OF THEM DID THIS.');assert.equal(l.footer,'SAME RULES. DIFFERENT GUILT.');
 assert.equal(l.groupLabel,'CHOOSE YOUR CEO','Radio group labelled by the picker heading');
 assert.deepEqual(l.options.map(o=>o.ceo),['altman','amodei'],'Alphabetical');
 for(const o of l.options){
  assert.equal(o.name,'ceo');assert.equal(o.value,o.ceo);assert.equal(o.accessibleName,NAMES[o.ceo]);assert.equal(o.description,LINES[o.ceo]);
  assert.equal(o.img.complete,true);assert.deepEqual(o.img.natural,[33,30],o.ceo+' face loaded');assert.equal(o.img.hidden,false);
  assert.match(o.img.src,new RegExp(`^local/ui/faces/${FACES[o.ceo]}/STF(ST01|EVL0)\\.png$`));
  // A whole number of CSS pixels per lump pixel, and at least two device pixels.
  const k=o.img.rendered[0]/33;assert.ok(Number.isInteger(k)&&k*l.dpr>=2&&o.img.rendered[1]===30*k,`${o.ceo} face at an integer scale (${o.img.rendered})`);
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
async function heroFacePixels(p,ceo){
 const img=p.locator(`.ceo-option[data-ceo="${ceo}"] .ceo-face img`),dpr=await p.evaluate(()=>devicePixelRatio);
 const shotPng=PNG.sync.read(await img.screenshot({animations:'disabled'})),src=PNG.sync.read(await fs.readFile(`doom-web/local/ui/faces/${FACES[ceo]}/STFST01.png`));
 const css=await img.evaluate(e=>e.getBoundingClientRect().width),k=Math.round(css*dpr/src.width);
 assert.ok(Number.isInteger(css/src.width)&&k>=2,`Integer scale (${css} CSS px at ${dpr}x for ${src.width})`);
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
 assert.ok(best.opaque>300,'Face has pixels');assert.equal(best.mismatch,0,`${ceo} hero face pixels: ${JSON.stringify(best)}`);
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
// The in-game Restart button restarts the level in the running engine: a new run, same page.
async function restartRun(p){
 const before=await read(p);await p.evaluate(()=>{window.__QA_SAME_PAGE__=true;});await p.click('#restart');
 const s=await wait(p,s=>s.mode==='playing'&&!s.uiBlocked&&s.run?.runId&&s.run.runId!==before.run.runId&&s.world?.ticks>35,'Restarted run',30000);
 assert.equal(await p.evaluate(()=>window.__QA_SAME_PAGE__),true,'Restart keeps the page');return s;
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
 }catch(e){d.failure=String(e);d.final=await read(p).then(s=>({mode:s.mode,menu:s.menu?.page,ceo:s.ceo,ceoPick:s.ceoPick,statusBar:s.statusBar&&{ceo:s.statusBar.ceo,faceSet:s.statusBar.faceSet,drawnFace:s.statusBar.drawnFace}})).catch(()=>null);await p.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});}
 d.seconds=Math.round((Date.now()-started)/1000);
 report.cases.push(d);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await c.close();console.log(name+': '+(d.passed?'PASS':d.failure)+` (${d.seconds}s)`);
}
const base='http://127.0.0.1:5198/',desktop={viewport:{width:1280,height:800}};
const touch=viewport=>({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:3});
const pinRandom=value=>`Math.random=()=>${value};`;
// Level films already watched, so a level starts straight away (the storage-throws case skips its film).
const filmsSeen=`try{localStorage.setItem('pdoom.level-intros.v1','["five-prisons","hal-station","meg3n-factory"]');}catch{}`;
try{
 await run('hero-desktop',base,desktop,async(p,d)=>{
  // A fresh profile starts with Altman whatever Math.random says (main.js resolves the
  // first visit to the first entry); nothing is remembered until a choice or a run.
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered,s.statusBar.ceo,s.menu.page],['altman','random',false,FACES.altman,'title']);
  await openHero(p);await settle(p);let l=await hero(p);checkMenu(l);d.initial=l;
  assert.deepEqual(checked(l),['altman']);assert.equal(l.storage,null,'Nothing remembered until a choice or a run');
  // What a screen reader gets (Chrome's accessibility tree): one radio group, two radios
  // named and described once each; the visible copy is not read twice.
  const ax=(await (await p.context().newCDPSession(p)).send('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored);
  const prop=(n,k)=>n.properties?.find(x=>x.name===k)?.value?.value;
  d.accessibility=ax.filter(n=>['radiogroup','radio'].includes(n.role?.value)).map(n=>({role:n.role.value,name:n.name?.value,description:n.description?.value,checked:prop(n,'checked')}));
  assert.deepEqual(d.accessibility,[{role:'radiogroup',name:'CHOOSE YOUR CEO',description:'BOTH OF THEM DID THIS. SAME RULES. DIFFERENT GUILT.',checked:undefined},
   {role:'radio',name:NAMES.altman,description:LINES.altman,checked:'true'},{role:'radio',name:NAMES.amodei,description:LINES.amodei,checked:'false'}]);
  assert.equal(ax.filter(n=>n.role?.value==='StaticText'&&/^(SAM ALTMAN|DARIO AMODEI)$/.test(n.name?.value||'')).length,0,'Names are read once, as the radios');
  assert.ok(ax.some(n=>n.role?.value==='heading'&&n.name?.value==='CHOOSE YOUR HERO'),'The page heading');
  assert.ok(l.next.visible&&l.next.y+l.next.h<=l.viewport.h,'Continue visible');assert.ok(l.scroll.menu[0]<=l.scroll.menu[1]&&l.scroll.page[0]<=l.scroll.page[1],'No scrolling');
  const amodeiDim=l.options.find(o=>o.ceo==='amodei').img.filter,altmanLit=l.options.find(o=>o.ceo==='altman').img.filter;
  assert.notEqual(amodeiDim,'none','Unselected face dimmed');assert.equal(altmanLit,'none','Selected face lit');
  d.facePixels=[await heroFacePixels(p,'altman')];await shot(p,d,'hero-desktop-altman');
  // Click: Amodei; the pick grins (Doom's weapon-pickup face) for 2 s, then rests.
  await p.click('.ceo-option[data-ceo="amodei"]');l=await hero(p);assert.deepEqual(checked(l),['amodei']);
  assert.equal(l.options[1].img.src,`local/ui/faces/${FACES.amodei}/STFEVL0.png`,'Evil grin on the new pick');assert.equal(l.options[0].img.src,`local/ui/faces/${FACES.altman}/STFST01.png`);
  const grin=await p.waitForFunction(()=>{const i=document.querySelector('.ceo-option[data-ceo="amodei"] .ceo-face img'),r=i.getBoundingClientRect();return i.complete&&/STFEVL0\.png$/.test(i.src)&&i.naturalWidth>0&&{natural:[i.naturalWidth,i.naturalHeight],rendered:[r.width,r.height]};},null,{timeout:2000}).then(h=>h.jsonValue());
  const gk=grin.rendered[0]/grin.natural[0];assert.ok(Number.isInteger(gk)&&grin.rendered[1]===grin.natural[1]*gk,`Grin face at an integer scale (${JSON.stringify(grin)})`);d.grin=grin;
  s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered,s.statusBar.ceo],['amodei','picked',true,FACES.amodei]);assert.equal(l.storage,'amodei');
  assert.equal(l.options.find(o=>o.ceo==='altman').img.filter,amodeiDim,'Both entries dim the same way');
  await settle(p);d.facePixels.push(await heroFacePixels(p,'amodei'));checkMenu(await hero(p));await shot(p,d,'hero-desktop-amodei');
  // And back: identical treatment the other way round.
  await p.click('.ceo-option[data-ceo="altman"] .ceo-name');assert.deepEqual(checked(await hero(p)),['altman']);assert.equal((await read(p)).statusBar.ceo,FACES.altman);
  // BACK and NEW GAME again: the page comes back with the same pick.
  await p.click('[data-view="hero"] button:last-of-type');await menu(p,'main');await p.click('#menu-new');await menu(p,'hero');assert.deepEqual(checked(await hero(p)),['altman']);
 },{init:pinRandom(0.9)});
 await run('keyboard',base+'?ceo=doomguy&levels=1',desktop,async(p,d)=>{
  // Title to hero page by keyboard alone. ?ceo=doomguy leaves both entries unchecked.
  await p.keyboard.press('Enter');await menu(p,'main');await p.keyboard.press('ArrowDown');assert.equal((await hero(p)).focused,'menu-new','Arrow moves the menu cursor');
  await p.keyboard.press('Enter');await menu(p,'hero');await focusOn(p,'altman','Focus starts on the radio group');let l=await hero(p);assert.deepEqual(checked(l),[]);
  await p.keyboard.press('Space');l=await hero(p);assert.deepEqual(checked(l),['altman'],'Space selects');assert.equal((await read(p)).statusBar.ceo,FACES.altman);
  await p.keyboard.press('ArrowRight');l=await hero(p);assert.deepEqual(checked(l),['amodei'],'Arrow moves the choice');assert.equal(l.focused,'amodei');
  await p.keyboard.press('ArrowDown');assert.deepEqual(checked(await hero(p)),['altman'],'Arrows wrap like a radio group');
  await p.keyboard.press('ArrowUp');assert.deepEqual(checked(await hero(p)),['amodei']);
  // Tab leaves the group in one step; Shift+Tab comes back to the checked entry.
  await p.keyboard.press('Tab');assert.equal((await hero(p)).focused,'hero-next','Tab goes on to Continue');
  await p.keyboard.press('Shift+Tab');assert.equal((await hero(p)).focused,'amodei','Shift+Tab returns to the checked entry');
  // Doom-menu cursor (onboarding.js): with nothing focused, Down puts the cursor on the first
  // entry without picking it; Space then picks it.
  await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('ArrowDown');l=await hero(p);assert.equal(l.focused,'altman','Cursor on the first entry');assert.deepEqual(checked(l),['amodei'],'The cursor alone does not pick');
  await p.keyboard.press('Space');assert.deepEqual(checked(await hero(p)),['altman']);assert.equal((await read(p)).statusBar.ceo,FACES.altman);await settle(p);await shot(p,d,'hero-keyboard-focus');
  // Up from Continue puts the cursor on Amodei without picking him; Enter picks the entry
  // under the cursor and continues, one step only: the level list, nothing started.
  await p.locator('#hero-next').focus();await p.keyboard.press('ArrowUp');l=await hero(p);assert.equal(l.focused,'amodei','Up from Continue');assert.deepEqual(checked(l),['altman'],'The cursor alone does not pick');
  await p.keyboard.press('Enter');let s=await menu(p,'levels');assert.deepEqual([s.ceo,s.ceoPick.source,s.statusBar.ceo],['amodei','picked',FACES.amodei],'Enter picks the entry under the cursor');
  await focusOn(p,'level-five-prisons','Focus on the first level');s=await read(p);
  assert.deepEqual([s.menu.page,s.mode],['levels','ready'],'The Enter that picked did not also start a level');
  await p.keyboard.press('Enter');s=await playing(p);
  assert.equal(s.ceoPick.locked,true);assert.deepEqual((await hero(p)).options.map(o=>o.disabled),[true,true],'Choice fixed once the run starts');
  assert.equal(s.statusBar.ceo,FACES.amodei);d.bar=await barFacePixels(p,FACES.amodei);
  // Arrow keys in play turn the player; they never reach the (hidden, locked) menu.
  const angle=s.world.angle;await p.keyboard.down('ArrowLeft');await p.waitForTimeout(250);await p.keyboard.up('ArrowLeft');
  s=await wait(p,s=>s.world.angle!==angle,'Arrow turns the player',3000);assert.equal(s.ceo,'amodei');assert.deepEqual(checked(await hero(p)),['amodei']);
 },{init:filmsSeen});
 await run('altman-in-game-and-transfer',base+'?ceo=altman&dev=end&levels=1',desktop,async(p,d)=>{
  // A remembered Amodei loses to ?ceo=altman.
  await p.evaluate(()=>localStorage.setItem('pdoom-ceo-v1','amodei'));await reload(p);
  // The console binding must be in place before the title menu warms the engine's files.
  await qaConsole(p);let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['altman','url']);await openHero(p);assert.deepEqual(checked(await hero(p)),['altman']);
  s=await startLevel(p);assert.equal(s.ceo,'altman');assert.equal(s.statusBar.ceo,FACES.altman);assert.equal(s.statusBar.faceSet,FACES.altman);
  assert.deepEqual(s.statusBar.faceSetsLoaded,[FACES.altman,...COMPANIONS]);
  d.own=await barFacePixels(p,FACES.altman);assert.match(d.own.drawnSrc,new RegExp(`^local/ui/faces/${FACES.altman}/STF`));await shot(p,d,'ingame-altman',{bar:true});
  assert.equal((await read(p)).ceoPick.remembered,true,'The CEO you played is remembered');
  // Transfer: the CEO's own dead face first, then the companion's own set.
  await p.evaluate(()=>{window.__sb=[];window.__sbTimer=setInterval(()=>{const b=JSON.parse(window.render_game_to_text()).statusBar;window.__sb.push({face:b.face,set:b.faceSet,drawn:b.drawnFace?.set});},20);});
  await command(p,'kill');const moved=await wait(p,s=>s.world.alive===5&&s.world.controlled>0,'Body transfer');
  const id=COMPANIONS[moved.world.controlled-1];await wait(p,s=>s.statusBar.faceSet===id&&s.statusBar.face!=='STFDEAD0','Companion face set',6000);
  const trace=await p.evaluate(()=>{clearInterval(window.__sbTimer);return window.__sb;});
  assert.ok(trace.some(e=>e.face==='STFDEAD0'&&e.set===FACES.altman&&e.drawn===FACES.altman),'Altman\'s own dead face before the companion');
  d.companion=await barFacePixels(p,id);assert.equal((await read(p)).statusBar.ceo,FACES.altman,'Body 0 is still Altman');await shot(p,d,'ingame-altman-companion-'+id,{bar:true});
 },{init:filmsSeen});
 await run('amodei-reload-and-restart',base+'?dev=end&levels=1',desktop,async(p,d)=>{
  // Clicking the entry that is already checked (the first-visit Altman) is still a choice,
  // so it is remembered (no change event fires for it).
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered],['altman','random',false]);
  await openHero(p);await p.click('.ceo-option[data-ceo="altman"]');s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.ceoPick.remembered],['altman','picked',true]);
  await p.click('.ceo-option[data-ceo="amodei"]');assert.equal((await hero(p)).storage,'amodei');
  await reload(p);s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['amodei','stored'],'Reload keeps the choice');
  await openHero(p);assert.deepEqual(checked(await hero(p)),['amodei']);
  s=await startLevel(p);assert.deepEqual([s.statusBar.ceo,s.statusBar.faceSet],[FACES.amodei,FACES.amodei]);d.own=await barFacePixels(p,FACES.amodei);await shot(p,d,'ingame-amodei',{bar:true});
  // Restart starts a new run in the same engine, still wearing Amodei's face.
  s=await restartRun(p);assert.match(p.url(),/\/\?dev=end&levels=1$/,'The URL is unchanged');assert.deepEqual([s.ceo,s.statusBar.ceo],['amodei',FACES.amodei]);
  d.afterRestart=await barFacePixels(p,FACES.amodei);
  // Reloading mid-run comes back to the title with the same CEO, and the hero page shows him.
  await reload(p);s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.statusBar.ceo],['amodei','stored',FACES.amodei],'Reload after a run keeps the CEO');
  await openHero(p);assert.deepEqual(checked(await hero(p)),['amodei']);
 },{init:filmsSeen});
 await run('doomguy-qa',base+'?ceo=doomguy&dev=end&levels=1',desktop,async(p,d)=>{
  // Hidden QA face: neither entry is checked, nothing is remembered, Doomguy wears body 0.
  let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source,s.statusBar.ceo],['doomguy','url','doomguy']);
  await openHero(p);const l=await hero(p);checkMenu(l);assert.deepEqual(checked(l),[]);assert.ok(l.options.every(o=>!o.selectedClass));
  s=await startLevel(p);assert.equal(s.statusBar.faceSet,'doomguy');assert.deepEqual(s.statusBar.faceSetsLoaded,['doomguy',...COMPANIONS]);
  d.own=await barFacePixels(p,'doomguy');assert.equal(await p.evaluate(()=>localStorage.getItem('pdoom-ceo-v1')),null,'The QA face is never remembered');
  await shot(p,d,'ingame-doomguy-qa',{bar:true});
 },{init:filmsSeen});
 await run('storage-throws',base+'?dev=end&levels=1',desktop,async(p,d)=>{
  // localStorage throws on every access: the menu still works, the level film plays each
  // time (skipped), and a new game carries the CEO in the URL instead.
  await openHero(p);let l=await hero(p);assert.equal(l.storage,'throws');checkMenu(l);assert.deepEqual(checked(l),['altman']);
  await p.click('.ceo-option[data-ceo="amodei"]');let s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.remembered],['amodei',false]);
  s=await startLevel(p);assert.equal(s.statusBar.ceo,FACES.amodei);d.own=await barFacePixels(p,FACES.amodei);
  s=await restartRun(p);assert.equal(s.statusBar.ceo,FACES.amodei,'Restart keeps the CEO without storage');
  // NEW GAME from the running level: the hero page still shows Amodei; pick Altman. The
  // confirmed new game reloads the page and starts it from the URL.
  await p.keyboard.press('Escape');await menu(p,'main');await p.click('#menu-new');await menu(p,'hero');l=await hero(p);assert.deepEqual(checked(l),['amodei']);assert.ok(l.options.every(o=>!o.disabled));
  await p.click('.ceo-option[data-ceo="altman"]');await p.click('#hero-next');await menu(p,'levels');await p.click('#level-five-prisons');await menu(p,'confirm');
  await Promise.all([p.waitForEvent('load',{timeout:15000}),p.click('#menu-confirm')]);await ready(p);
  d.newGameUrl=p.url();assert.match(d.newGameUrl,/[?&]ceo=altman(&|$)/);
  s=await playing(p);assert.doesNotMatch(p.url(),/[?&]play=1/,'The hand-off flag is consumed');assert.deepEqual([s.ceo,s.statusBar.ceo],['altman',FACES.altman]);
  d.own2=await barFacePixels(p,FACES.altman);
  // Reload keeps it, and changing the pick keeps the ?ceo= link in step.
  await reload(p);s=await read(p);assert.deepEqual([s.ceo,s.ceoPick.source],['altman','url'],'Reload keeps the CEO from the URL');await openHero(p);await p.click('.ceo-option[data-ceo="amodei"]');assert.match(p.url(),/ceo=amodei/);
  await reload(p);s=await read(p);assert.deepEqual([s.ceo,s.statusBar.ceo],['amodei',FACES.amodei]);
 },{init:`Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('The operation is insecure.','SecurityError');}});`});
 for(const [name,viewport]of [['touch-portrait',{width:390,height:844}],['touch-landscape',{width:844,height:390}]])await run(name,base+'?levels=1',touch(viewport),async(p,d)=>{
  await openHero(p,{tap:true});await settle(p);
  // The shell's corner buttons arrive from mann.cool; give them a moment to lay out.
  await p.waitForFunction(()=>document.querySelector('mann-cool-game-shell')?.shadowRoot?.querySelector('button'),null,{timeout:5000}).catch(()=>{});await p.waitForTimeout(300);
  for(const ceo of ['amodei','altman']){
   await p.tap(`.ceo-option[data-ceo="${ceo}"]`);await settle(p);const l=await hero(p);d[ceo]=l;checkMenu(l);assert.deepEqual(checked(l),[ceo],'Tap selects '+ceo);
   assert.equal((await read(p)).statusBar.ceo,FACES[ceo]);
   assert.ok(l.next.visible&&l.next.y>=0&&l.next.y+l.next.h<=viewport.height,'Continue inside the viewport without scrolling');
   assert.ok(l.scroll.menu[0]<=l.scroll.menu[1]+1,'Menu does not scroll');assert.ok(l.scroll.page[0]<=l.scroll.page[1]&&l.scroll.width[0]<=l.scroll.width[1],'No page scroll');
   for(const o of l.options){
    assert.ok(o.box.x>=0&&o.box.y>=0&&o.box.x+o.box.w<=viewport.width&&o.box.y+o.box.h<=l.next.y,`${o.ceo} entry fits above Continue`);
    assert.ok(o.box.w>=44&&o.box.h>=44,'Touch target');
    for(const b of l.shell)assert.ok(o.box.x>=b.x+b.w||o.box.x+o.box.w<=b.x||o.box.y>=b.y+b.h||o.box.y+o.box.h<=b.y,`${o.ceo} entry clear of the shell buttons`);
   }
   for(const b of l.shell)assert.ok(l.next.x>=b.x+b.w||l.next.x+l.next.w<=b.x||l.next.y>=b.y+b.h||l.next.y+l.next.h<=b.y,'Continue clear of the shell buttons');
   const [a,b]=l.options;assert.ok(a.box.x+a.box.w<=b.box.x||a.box.y+a.box.h<=b.box.y,'Entries do not overlap');
   (d.facePixels??=[]).push(await heroFacePixels(p,ceo));
   await shot(p,d,`hero-${name}-${ceo}`);
  }
  d.geometry={next:d.altman.next,options:d.altman.options.map(o=>o.box),shell:d.altman.shell,scale:d.altman.options[0].img.rendered[0]/33};
  // A tap on Continue moves on with the choice.
  await p.tap('#hero-next');const s=await menu(p,'levels');assert.equal(s.ceo,'altman');
 });
 await run('pages-without-picker',base+'?level=intake',desktop,async(p,d)=>{
  // Intake and the factory's own practice page have no status-bar CEO and no hero menu.
  for(const level of ['intake','meg3n-factory']){
   if(level!=='intake'){await p.goto(base+'?level='+level);await ready(p);}
   const s=await read(p);assert.equal(s.ceo,null,level);assert.equal(await p.locator('#ceo-pick').isVisible(),false,level+' has no CEO menu');
   assert.equal(await p.locator('#onboarding').isVisible(),false,level+' has no title menu');
  }
 });
}finally{report.passed=report.cases.length===(selected?.length??CASES.length)&&report.cases.every(c=>c.passed);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);console.log(JSON.stringify(report.cases.map(({name,passed,failure,seconds})=>({name,passed,failure,seconds}))));process.exit(report.passed?0:1);}
