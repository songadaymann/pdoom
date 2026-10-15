// A small, continuous pace around a permanent meadow gathering spot. Fade
// from the arrival position so switching from escort to idle never snaps.
export function meadowHumanIdle(id:number,time:number,age:number){
 const phase=id*1.37,turn=age*.8+phase,weight=Math.min(1,Math.max(0,age)/1.5);
 return {
  x:Math.sin(turn)*.36*weight,z:Math.cos(turn)*.26*weight,
  width:1.8*(1-Math.sin(time*1.4+phase)*.008),
  height:1.8*(1+Math.sin(time*1.4+phase)*.018),
  frame:Math.floor(time*3+id)%4
 };
}
