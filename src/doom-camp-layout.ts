import {HUB_DOORS} from './doom-hub-doors';
import {FUTURE_DOORS} from './doom-hub-future';

// HAL's entrance faces diagonally. Gathering in world -z put people inside its
// shell; use the same outward direction as its doorway instead. The factory's
// five (ids 10-14) gather the same way outside MEG3N.AVI's door, the pod farm's (15-19) outside AGENTIC.BAT's.
export function meadowCampLayout(id:number){
 const group=Math.floor(id/5),door=group===3?FUTURE_DOORS[1]:group===2?FUTURE_DOORS[0]:HUB_DOORS[group?1:0],slot=id%5;
 const outward={x:-Math.sin(door.yaw),z:-Math.cos(door.yaw)};
 const side={x:Math.cos(door.yaw),z:-Math.sin(door.yaw)};
 const spread=(slot-2)*1.4,reach=7+(slot%2)*1.4;
 return {
  door,
  origin:{x:door.x+outward.x,z:door.z+outward.z},
  target:group?{x:door.x+outward.x*reach+side.x*spread,z:door.z+outward.z*reach+side.z*spread}:{x:17+spread,z:-reach}
 };
}

/* Where the rescued live once a later group has come out (Jonathan, 2026-10-23: "not just be still right outside
 * their level - maybe more spread out but generally up on top of the hill"). The newest group stays near its own
 * exit (meadowCampLayout's target); every earlier group has a 9 m zone below the summit to wander in, clear of the
 * final dialog's front, the Crest Trail and its spur, and HAL's torch trail (docs/SAFE-MODE-PROGRESSION.md section 5). */
// (on the dome's sunny south faces, so you see them up there from the bunker and the camp)
export const HILL_ZONES=[{x:-30,z:-72},{x:-58,z:-66},{x:-74,z:-82},{x:-28,z:-118}];
export const HILL_RADIUS=9,DOOR_WANDER=2.5,DOOR_CLEAR=5;
/** Is (x, z) a fine place for person id to stand while at their own door (never within 5 m of it, never behind it)? */
export function clearOfDoor(id:number,x:number,z:number){
 const {door}=meadowCampLayout(id),dx=x-door.x,dz=z-door.z;
 return Math.hypot(dx,dz)>=DOOR_CLEAR&&-Math.sin(door.yaw)*dx-Math.cos(door.yaw)*dz>=DOOR_CLEAR;
}
