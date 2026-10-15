import {HUB_DOORS} from './doom-hub-doors';

// HAL's entrance faces diagonally. Gathering in world -z put people inside its
// shell; use the same outward direction as its doorway instead.
export function meadowCampLayout(id:number){
 const hal=id>=5,door=HUB_DOORS[hal?1:0],slot=id%5;
 const outward={x:-Math.sin(door.yaw),z:-Math.cos(door.yaw)};
 const side={x:Math.cos(door.yaw),z:-Math.sin(door.yaw)};
 const spread=(slot-2)*1.4,reach=7+(slot%2)*1.4;
 return {
  door,
  origin:{x:door.x+outward.x,z:door.z+outward.z},
  target:hal?{x:door.x+outward.x*reach+side.x*spread,z:door.z+outward.z*reach+side.z*spread}:{x:17+spread,z:-reach}
 };
}
