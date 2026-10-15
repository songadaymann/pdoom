const hud=document.querySelector('#hud');
const people=document.querySelector('#people');
const equipment=document.querySelector('#equipment');
const prompt=document.querySelector('#prompt');
const message=document.querySelector('#message');
const result=document.querySelector('#result');
const finish=document.querySelector('#finish');

export function updateIntakeHud(world,mode){
  if(!world)return;
  const ended=mode==='escaped'||mode==='lost';
  hud.hidden=ended;
  document.querySelector('#reticle').hidden=ended;
  const saved=world.saved??0,remaining=world.remaining??6;
  people.textContent=`${saved} / 6 saved`;
  const gear=[world.hold?'Holding':'Following'];
  if(world.gun)gear.push(`${world.ammo??0} shots`);
  if(world.charge)gear.push('Charge');
  equipment.textContent=gear.join(' · ');
  document.querySelector('[data-code="KeyQ"]').textContent=world.hold?'Follow':'Hold';
  prompt.textContent=ended?'':world.prompt||'';
  prompt.hidden=!prompt.textContent;
  message.textContent=ended?'':world.message||'';
  message.hidden=!message.textContent;
  finish.hidden=ended||saved===0||remaining===0;
  finish.textContent=`Finish with ${saved} saved (R)`;
}

export function showIntakeResult(event){
  const saved=event.saved??0;
  result.textContent=saved>0?`${saved} of 6 made it. Restart to try for everyone.`:'Nobody made it. Restart to try again.';
  result.hidden=false;
  finish.hidden=true;
  prompt.hidden=true;
  message.hidden=true;
  hud.hidden=true;
  document.querySelector('#reticle').hidden=true;
}
