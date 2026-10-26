import * as THREE from 'three';
import {ARENA,PAL,rand,wrap,bearingOf} from './kit';
import {Post} from './threats';
import type {Mode} from './main';

/* A. RICOCHET: one disc, yours. It bounces (floor, pillars, wall, shield panels, a Recognizer's
 * frame) up to four times, then flies home; you can't throw again until you catch it. Right-click
 * calls it back early. The twenty throw on their own when a gap comes round to them. */
const DEG=Math.PI/180;
const MINE={speed:34,range:52,maxBounces:4,damage:40,faceDamage:70,backSpeed:42,color:PAL.line};
const THEIRS={speed:30,range:40,maxBounces:0,damage:5,faceDamage:5,backSpeed:34,color:'#7fd6ff'};
let postAt=0;
export const ricochet:Mode={
 id:'ricochet',title:'A · RICOCHET',recStyle:'slam',formation:'audience',
 hints:{practice1:'Click throws. Step out of its shadow, then hit the light under the bar.',practice2:'It bounces. Bank it off a pillar or the wall.',wake:'',fight:'Throw through the gap. The face takes double. Right-click calls your disc back.',down:''},
 wake(c){c.mcp.setGap(3,1);c.mcp.spin=45*DEG;postAt=c.t+4;},
 press(c,b){
  if(b===2){for(const d of c.discs.list)if(d.owner.isPlayer)d.home();return;}
  if(b===0)c.throwPlayer(MINE);
 },
 update(c,dt){
  if(c.phase!=='fight')return;
  if(c.t>postAt){
   postAt=c.t+5;
   for(let i=0;i<2;i++){
    const target=Math.random()<.6?()=>c.player.eyePos():(()=>{const live=c.people.filter(p=>p.down<=0);const p=live[Math.floor(Math.random()*live.length)];return p?()=>p.pos:()=>c.player.eyePos();})();
    const a=bearingOf(target())+rand(-.3,.3);c.posts.push(new Post(c.stage.scene,new THREE.Vector3(Math.cos(a)*(ARENA.ring+1.2),rand(5,9),Math.sin(a)*(ARENA.ring+1.2)),target));
   }
  }
  // The twenty throw on their own, only when a gap will be facing them as their disc arrives.
  for(const p of c.people){
   p.nextThrow-=dt;if(p.nextThrow>0||!p.hasDisc||p.down>0)continue;
   const at=c.gapPoint(p.pos,THEIRS.speed);
   if(Math.abs(wrap(bearingOf(at)-bearingOf(p.pos)))<22*DEG){c.throwAt(p,at,THEIRS,.04);p.nextThrow=rand(6,11);}else p.nextThrow=.3;
  }
 },
 highlight:(c)=>bearingOf(c.player.pos),
};
