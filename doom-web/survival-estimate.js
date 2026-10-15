// Authored, in-world outlook, explicitly distinct from the earlier Monte Carlo
// forecast. No future simulation, time horizon, or calibration is claimed.
export function survivalEstimate(world,mode,escape){
  if(!world)return null;
  if(mode==='lost')return {survival:0,doom:100,kind:'in-world estimate'};
  // One permanent survivor makes the event "nobody survives" impossible.
  if(escape?.saved>0)return {survival:100,doom:0,kind:'in-world estimate'};
  const people=world.people||[];
  const found=people.filter(p=>p.alive&&p.discovered).length;
  const freed=people.filter(p=>p.alive&&p.released).length;
  const sheltered=people.filter(p=>p.alive&&(p.sheltered||p.controlled&&world.in_refuge)).length;
  const losses=Math.max(0,6-(world.alive??6));
  const injury=Math.max(0,100-Math.max(0,world.health??100))*.12;
  const companionInjury=people.filter(p=>p.alive&&p.released&&!p.controlled)
    .reduce((n,p)=>n+Math.max(0,100-(p.health??100))*.025,0);
  const survival=Math.round(Math.max(1,Math.min(99,
    12+found*2+freed*8+sheltered*6+(world.refuge_known?4:0)
    +(world.group_gathered?2:0)+(escape?.opened?1:0)
    -losses*5-injury-companionInjury)));
  return {survival,doom:100-survival,kind:'in-world estimate'};
}

export function updateSurvivalHud(world,mode,escape){
  const outlook=survivalEstimate(world,mode,escape);
  if(!outlook)return;
  const el=id=>document.getElementById(id);
  el('survival').textContent=`${outlook.survival===100?'':'≈'}${outlook.survival}%`;
  el('doom-chance').textContent=`p(DOOM) ${outlook.doom===0?'':'≈'}${outlook.doom}%`;
  el('survival-fill').style.width=`${outlook.survival}%`;
  el('hud').dataset.outlook=outlook.survival<40?'low':outlook.survival<70?'uncertain':'strong';
  el('hud-face')?.classList.toggle('wounded',world.health<=30);
  const portrait=el('hud-portrait'),index=Math.max(0,(world.controlled||1)-1);
  const src=`outside-assets/person-${index}-0-0.png`;
  if(portrait.getAttribute('src')!==src)portrait.src=src;
  // Never reveal a captive's name before discovery.
  el('rescue-slots').replaceChildren(...(world.people||[]).map(p=>{
    const slot=document.createElement('span');
    const status=!p.alive?'lost':p.sheltered||p.controlled&&world.in_refuge?'sheltered':p.released?'freed':p.discovered?'found':'unknown';
    slot.className=`rescue-slot ${status}`;
    slot.textContent=status==='lost'?'×':status==='sheltered'?'✓':'•';
    slot.title=`${p.discovered?p.name:'Unknown'} · ${status}`;
    slot.setAttribute('aria-label',slot.title);
    return slot;
  }));
}
