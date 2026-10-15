// The fixture is loopback-only and requires dev-config.enabled. Production must
// ignore the URL while retaining ordinary Load Game for real camp saves.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.DOOM_URL||'http://127.0.0.1:5198/',report={cases:[],errors:[]};
const publicBuild=process.env.DOOM_PUBLIC==='1',out=process.env.DOOM_OUT||'output/ranked-validation/shortcut';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const real=JSON.stringify({version:1,ceo:'amodei',hub:true,saved0:3,saved1:0,lost0:0,lost1:0,following0:0,following1:0});
try{
 for(const [query,door] of [['?safemode=1','hal-station'],['?safemode=1&level=five-prisons','five-prisons']]){
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.addInitScript(save=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('pdoom.campaign.v1',save);sessionStorage.setItem('seeded','1');}},real);
  await page.goto(url+query);
  if(publicBuild){
    await page.waitForFunction(()=>window.render_game_to_text);
    const s=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
    assert.equal(s.menu.page,'title');assert.equal(s.outside,null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')),real);
    await page.click('#title-enter');await page.click('#menu-load');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside?.active,{},{timeout:90000});
    const loaded=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(loaded.campaign.saved,2);assert.equal(loaded.outside.saved_visual,2);
    await page.screenshot({path:out+'/'+door+'-real-camp.png'});
    report.cases.push(`${query}: shortcut ignored; genuine two-survivor camp still loads`);await page.close();continue;
  }
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text?.()||'{}').outside?.saved_visual===10,{},{timeout:90000});
  const s=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  assert.equal(s.outside.currentLevel,door);assert.equal(s.campaign.saved,10);assert.equal(s.outside.future.wait,10);assert.equal(s.outside.future.mcp_blocks,8);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pdoom.campaign.v1')),real,'The real save is untouched');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pdoom.opening-complete.v1')),null,'The preview cannot unlock the real opening skip');
  report.cases.push(`${query}: SAFE MODE out of ${door}, ten saved, Wait 10, real save untouched`);
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e?.stack||e);}
finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));process.exit(report.passed?0:1);
