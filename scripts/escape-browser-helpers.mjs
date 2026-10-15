import assert from 'node:assert/strict';

export function escapeHelpers({read,warp,command,face,crawlAxis,shot}) {
async function aim(p,index){
 const hal=(await read(p)).levelId==='hal-station',cy=hal?607:957;
 const x=hal?(index%2===0?166:218):(index%2===0?806:858),z=index<2?56:32;
 for(let i=0;i<75;i++){
  const s=await read(p),w=s.world;
  if(s.escape.aim_bolt===index)return;
  const angle=Math.atan2(cy-w.y,x-w.x)*180/Math.PI,delta=((angle-w.angle+540)%360)-180;
  const pitch=Math.atan2(w.z+s.escape.view_height-z,Math.hypot(x-w.x,cy-w.y))*180/Math.PI,vertical=pitch-w.pitch;
  const key=Math.abs(delta)>1.5?(delta>0?'ArrowLeft':'ArrowRight'):(vertical>0?'PageDown':'PageUp');
  const error=Math.abs(delta)>1.5?Math.abs(delta):Math.abs(vertical);
  await p.keyboard.down(key);await p.waitForTimeout(Math.min(90,Math.max(18,error*7)));await p.keyboard.up(key);await p.waitForTimeout(140);
 }
 throw Error('Could not aim bolt '+index+': '+JSON.stringify(await read(p)));
}
async function bolts(p,d){
 d.aims=[];
 for(let i=0;i<4;i++){
  await aim(p,i);d.aims.push(await read(p));await p.keyboard.down('KeyE');await p.waitForTimeout(1350);await p.keyboard.up('KeyE');await p.waitForTimeout(200);
  assert.equal((await read(p)).escape.bolts,i+1,'Actually loosened one aimed bolt');await shot(p,'bolt-'+(i+1));
 }
 assert.equal((await read(p)).escape.opened,1);await p.keyboard.press('KeyQ',{delay:80});await p.waitForTimeout(300);assert.ok((await read(p)).world.people.filter(h=>h.alive&&!h.controlled).every(h=>h.holding===0),'Escape commitment gives clear feedback without reversing NPC orders');assert.equal((await read(p)).world.order_target,-1);await shot(p,'cover-open');
}
async function toMeadow(p,d){
 const hal=(await read(p)).levelId==='hal-station';
 await warp(p,hal?192:832,hal?568:918,d,90);await command(p,'centerview');
 // Walking (no C) into the low duct ducks you automatically.
 await p.keyboard.down('KeyW');await p.waitForTimeout(900);await p.keyboard.up('KeyW');await p.waitForTimeout(200);d.walkIn=await read(p);assert.ok(d.walkIn.world.y>(hal?596:946),'Walking enters the low duct at y='+d.walkIn.world.y);assert.ok(d.walkIn.world.crouch<.75,'Auto-crouched in the duct: '+d.walkIn.world.crouch);assert.equal(d.walkIn.escape.outside,0);
 await p.keyboard.down('KeyC');await p.waitForTimeout(300);
 d.ductTrace=[];
 for(const[axis,target]of(hal?[['y',688]]:[['y',1024],['x',720],['y',1160]])){await crawlAxis(p,axis,target);d.ductTrace.push(await read(p));await shot(p,'duct-'+axis+'-'+target);assert.equal((await read(p)).escape.outside,0,'No reveal before final duct bend');}
 const melts=(await read(p)).melt?.plays??0;
 await face(p,90);await p.keyboard.down('KeyW');await p.waitForTimeout(1000);await p.keyboard.up('KeyW');await p.keyboard.up('KeyC');
 // Doom's screen melt into Bliss (2026-10-14), not a cut.
 await p.waitForFunction(m=>JSON.parse(window.render_game_to_text()).melt.plays>m,melts,{timeout:25000});if((await read(p)).melt.phase==='melting'){await p.waitForTimeout(450);await shot(p,'melt');}
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).melt.phase==='idle',{},{timeout:5000});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).outside!==null,{},{timeout:25000});d.reveal=await read(p);assert.equal(d.reveal.escape.outside,1);await shot(p,'meadow-reveal');
 // Every living rescued person settles in camp, including a body you escaped in (the hub view is the CEO's).
 await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.mode==='escaped'&&s.outside.settled===s.world.people.filter(h=>h.alive).length;},{},{timeout:45000});
 // Bliss stays uninterrupted. Scores remain available on explicit request.
 if(await p.locator('#score-dialog').count()){
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).scoreView?.available,{},{timeout:5000});
  d.scoreReady=await read(p);assert.equal(d.scoreReady.scoreView.open,false);assert.equal(d.scoreReady.uiBlocked,false);
  assert.equal(await p.locator('#show-score').isVisible(),true);assert.equal(await p.locator('#show-score').evaluate(b=>b.classList.contains('score-unread')),true);
  await shot(p,'uninterrupted-bliss');
 }
 d.won=await read(p);assert.equal(d.won.escape.saved,d.won.world.alive);await shot(p,'meadow-gathered');
}

return {aim,bolts,toMeadow};
}
