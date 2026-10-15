import fs from 'node:fs/promises';
// Native QA follows authored wall positions instead of obsolete floating props.
export async function wallApproaches(level='hal'){
 const map=JSON.parse(await fs.readFile(`output/${level}/map-debug.json`,'utf8'));
 function approach(p,d=48,lateral=0){
  const a=p.angle*Math.PI/180;
  return [Math.round(p.x+Math.cos(a)*d-Math.sin(a)*lateral),Math.round(p.y+Math.sin(a)*d+Math.cos(a)*lateral),(p.angle+180)%360];
 }
 return {map,approach,terminal:k=>approach(map.wall_mounts.find(p=>p.type===15122&&p.kind===k))};
}
