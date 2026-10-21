import {HUB_DOORS} from './doom-hub-doors';
import {FUTURE_DOORS} from './doom-hub-future';

// HAL's entrance faces diagonally. Gathering in world -z put people inside its
// shell; use the same outward direction as its doorway instead. The factory's
// five (ids 10-14) gather the same way outside MEG3N.AVI's door.
export function meadowCampLayout(id:number){
 const group=Math.floor(id/5),door=group===2?FUTURE_DOORS[0]:HUB_DOORS[group?1:0],slot=id%5;
 const outward={x:-Math.sin(door.yaw),z:-Math.cos(door.yaw)};
 const side={x:Math.cos(door.yaw),z:-Math.sin(door.yaw)};
 const spread=(slot-2)*1.4,reach=7+(slot%2)*1.4;
 return {
  door,
  origin:{x:door.x+outward.x,z:door.z+outward.z},
  target:group?{x:door.x+outward.x*reach+side.x*spread,z:door.z+outward.z*reach+side.z*spread}:{x:17+spread,z:-reach}
 };
}
