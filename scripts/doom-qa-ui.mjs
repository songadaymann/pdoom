// Existing native smoke tests deliberately skip the narrative panels; the
// opening itself is exercised separately with real keyboard/touch navigation.
export async function startGame(page,{console:allowConsole=true}={}){
 // Private browser-test controls; the playable build has no console binding.
 const {readFile}=await import('node:fs/promises');
 const config=await readFile(new URL('../doom-web/controls.cfg',import.meta.url),'utf8');
 if(allowConsole)await page.route('**/controls.cfg',r=>r.fulfill({contentType:'text/plain',body:config+'\nbind ` \"toggleconsole\"\n'}));
 if(allowConsole)await page.evaluate(()=>{
  if(window.__QA_CONSOLE_KEYS__)return;window.__QA_CONSOLE_KEYS__=true;let open=false;
  for(const evType of ['keydown','keyup','keypress'])addEventListener(evType,e=>{
   if(!window.__QA_WORKER__)return;
   if(e.code==='Backquote'){
    if(evType==='keydown'&&!e.repeat)open=!open;
   }else if(!open)return;
   e.preventDefault();e.stopImmediatePropagation();
   window.__QA_WORKER__.postMessage({type:'input',target:'window',evType,init:{code:e.code,key:e.key,keyCode:e.keyCode,which:e.which,charCode:e.charCode,bubbles:true,cancelable:true}});
  },true);
 });
 // Existing gameplay tests opt out of films; the public onboarding smoke tests
 // exercise the first-visit film path. Seeded campaign fixtures use real Load.
 if(!await page.locator('#title-enter').count()||!await page.locator('#title-enter').isVisible()){await page.click('#start');return;}
 // Public New Game goes hero -> prologue; level tests keep the developer level select.
 const id=await page.evaluate(()=>{localStorage.setItem('pdoom.level-intros.v1',JSON.stringify(['five-prisons','hal-station','meg3n-factory']));localStorage.setItem('pdoom.level-select','1');return JSON.parse(window.render_game_to_text()).levelId;});
 await page.click('#title-enter');
 if(await page.locator('#menu-load').isEnabled()){
  await page.click('#menu-load');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.active&&!JSON.parse(window.render_game_to_text()).uiBlocked,{},{timeout:60000});
  await page.evaluate(id=>window.__DOOM_DEBUG__.outside.debug.setView(id==='hal-station'?1:17,id==='hal-station'?-202:-3,0,0),id);
  await page.waitForFunction(id=>JSON.parse(window.render_game_to_text()).outside?.nearestDoor===id,id);
  await page.keyboard.press('e');
 }else{
  await page.click('#menu-new');await page.click('#hero-next');await page.click('#level-'+id);
 }
 // New Game's prologue path opens with the founder's film (2026-10-12); skip it like a player.
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  if(await page.locator('#intro-video .iv-skip').count())await page.click('#intro-video .iv-skip').catch(()=>{});
  if(await page.evaluate(()=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='playing'&&!s.uiBlocked;}))return;
  await page.waitForTimeout(250);
 }
 throw Error('startGame: not playing after 60 s');
}
