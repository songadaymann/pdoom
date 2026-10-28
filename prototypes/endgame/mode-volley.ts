import * as THREE from 'three';
import {ARENA,PAL,rand,wrap,bearingOf} from './kit';
import {Post,Sink} from './threats';
import type {Mode,Ctx} from './main';

/* C. CROWD VOLLEY: the spec's model (05 §4.4). The twenty stand in an arc on your side of the
 * ring and throw when you throw, in a staggered stream, each aiming where the gap will be. Your
 * job is where you stand (they follow your bearing) and when you call it. Panels by the gap turn
 * white as it comes round to face your group; Rob Miles calls "NOW!". Posts and sinks come at the
 * crowd, who dodge on their own reaction times. */
const DEG=Math.PI/180;
const MINE={speed:34,range:46,maxBounces:1,damage:20,faceDamage:40,backSpeed:40,color:PAL.line};
const THEIRS={speed:30,range:42,maxBounces:0,damage:6,faceDamage:6,backSpeed:34,color:'#7fd6ff'};
let postAt=0,sinkAt=0,spotLap=-1,firstSink=true;
function callVolley(c:Ctx){
 const aim=c.aim();
 const order=c.everyone().filter(p=>p.hasDisc&&p.down<=0).sort((a,b)=>a.pos.distanceTo(c.player.pos)-b.pos.distanceTo(c.player.pos));
 order.forEach((p,i)=>c.later(.08+i*.06,()=>{
  if(aim.kind==='mcp')c.throwAt(p,c.gapPoint(p.pos,THEIRS.speed),THEIRS,.05);
  else if(aim.kind==='rec'&&aim.rec?.alive){const lead=aim.rec.corePos().addScaledVector(aim.rec.vel,.3);c.throwAt(p,lead,THEIRS,.04);}
  else c.throwAt(p,aim.point,THEIRS,.06);
 }));
}
export const volley:Mode={
 id:'volley',title:'C · CROWD VOLLEY',recStyle:'slam',formation:'arc',
 hints:{practice1:'Click throws. Step out of its shadow, then hit the light under the bar.',practice2:'When you throw, everyone throws at what you aim at.',wake:'',fight:'They throw when you do. Walk the ring to move them; throw when the gap turns white.',down:''},
 wake(c){c.mcp.setGap(3,1);c.mcp.spin=45*DEG;postAt=c.t+5;sinkAt=c.t+9;},
 press(c,b){if(b!==0||!c.held||c.player.down)return;c.throwPlayer(MINE);callVolley(c);},
 update(c,dt){
  if(c.phase!=='fight')return;
  const group=bearingOf(c.player.pos),N=c.people.filter(p=>p.down<=0).length;
  // the Spotter: once per lap, half a second before the gap faces your group
  for(const g of c.mcp.gapCenters()){
   const soon=wrap(g+c.mcp.spin*.6-group),lap=Math.floor(c.t/8);
   if(Math.abs(soon)<8*DEG&&spotLap!==lap){spotLap=lap;c.hud.toast('ROB MILES','NOW!',1);c.sfx.play.spot();}
  }
  if(c.t>postAt){
   postAt=c.t+6;
   for(let i=0;i<2+Math.floor(N/5);i++){
    const live=c.people.filter(p=>p.down<=0),p=live[Math.floor(Math.random()*live.length)],target=Math.random()<.3||!p?()=>c.player.eyePos():()=>p.pos;
    const a=bearingOf(target())+rand(-.25,.25);c.posts.push(new Post(c.stage.scene,new THREE.Vector3(Math.cos(a)*(ARENA.ring+1.2),rand(5,9),Math.sin(a)*(ARENA.ring+1.2)),target));
   }
  }
  if(c.t>sinkAt){
   sinkAt=c.t+12;if(firstSink){firstSink=false;c.hud.caption('LET THAT SINK IN.',2.2);c.mcp.say(1.6);}
   c.sfx.play.whistle();
   const live=c.people.filter(p=>p.down<=0).sort(()=>Math.random()-.5).slice(0,3);
   for(const p of live){const at=p.pos.clone().setY(0);c.sinks.push(new Sink(c.stage.scene,at));for(const q of c.everyone())q.avoid(at,Sink.RADIUS,c.t);}
  }
 },
 highlight:(c)=>bearingOf(c.player.pos),
};
