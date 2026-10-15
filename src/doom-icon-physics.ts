import RAPIER from '@dimforge/rapier3d-compat';
import {meadowGroundY as groundY} from './doom-meadow-ground';

export type IconObstacle={x:number;y:number;z:number;hx:number;hy:number;hz:number;yaw?:number};
export type ToySpec={id:string;x:number;z:number;hull:Float32Array;halfHeight:number;mass:number};
const STEP=1/60;
let ready:Promise<void>|undefined;

/** One small, disposable simulation for the meadow toys. The player keeps the
 * existing walking controller; its foot contact supplies an impulse at a point. */
export async function makeIconPhysics(specs:ToySpec[],obstacles:IconObstacle[]){
 await (ready??=RAPIER.init());
 const world=new RAPIER.World({x:0,y:-15,z:0}),events=new RAPIER.EventQueue(true);
 world.timestep=STEP;world.numSolverIterations=8;
 // Column-major heights: rows are z, columns are x. Two-metre samples track the
 // broad hills; the same height function drives both the visible grass and feet.
 const minX=-184,minZ=-224,width=388,depth=408,cols=194,rows=204;
 const heights=new Float32Array((cols+1)*(rows+1));
 for(let x=0;x<=cols;x++)for(let z=0;z<=rows;z++)heights[x*(rows+1)+z]=groundY(minX+x*2,minZ+z*2);
 const terrain=world.createCollider(RAPIER.ColliderDesc.heightfield(rows,cols,heights,{x:width,y:1,z:depth})
  .setTranslation(minX+width/2,0,minZ+depth/2).setFriction(.75).setRestitution(.12));
 const addBox=(o:IconObstacle)=>world.createCollider(RAPIER.ColliderDesc.cuboid(o.hx,o.hy,o.hz)
  .setTranslation(o.x,o.y,o.z).setRotation({x:0,y:Math.sin((o.yaw??0)/2),z:0,w:Math.cos((o.yaw??0)/2)})
  .setFriction(.65).setRestitution(.28));
 obstacles.forEach(addBox);
 // Invisible fences stay outside the player's existing walkable bounds.
 for(const o of [{x:-182,z:-20,hx:1,hz:206},{x:202,z:-20,hx:1,hz:206},
  {x:10,z:-222,hx:194,hz:1},{x:10,z:182,hx:194,hz:1}])addBox({...o,y:45,hy:65});
 const toys=specs.map(spec=>{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
   .setTranslation(spec.x,groundY(spec.x,spec.z)+spec.halfHeight+.06,spec.z)
   .setRotation({x:0,y:Math.sin(.22),z:0,w:Math.cos(.22)})
   .setLinearDamping(.22).setAngularDamping(.65).setCcdEnabled(true).setCanSleep(true));
  const shape=RAPIER.ColliderDesc.convexHull(spec.hull);
  if(!shape)throw Error(`Invalid desktop toy hull: ${spec.id}`);
  const collider=world.createCollider(shape.setMass(spec.mass).setFriction(.68).setRestitution(.38)
   .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(spec.mass*62.5),body);
  return {...spec,body,collider,kicks:0,lastKick:-9,lastBounce:-9};
 });
 const byCollider=new Map(toys.map(t=>[t.collider.handle,t]));
 let accumulator=0,elapsed=0,disposed=false,impacts=0;
 return {
  toys,
  update(dt:number,player:{x:number;y:number;z:number},velocity:{x:number;z:number},
   kick:(id:string,speed:number,distance:number)=>void,bounce:(strength:number,distance:number)=>void){
   if(disposed)return;
   const speed=Math.hypot(velocity.x,velocity.z),foot={x:player.x,y:groundY(player.x,player.z)+.4,z:player.z};
   if(speed>.15)for(const t of toys){
    if(elapsed-t.lastKick<.38)continue;
    const p=t.body.translation(),dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);
    if(d>1.8)continue;
    const contact=t.collider.projectPoint(foot,true);if(!contact)continue;
    const distance=Math.hypot(contact.point.x-foot.x,contact.point.y-foot.y,contact.point.z-foot.z);
    if(distance>.48||dx*velocity.x+dz*velocity.z<-.05)continue;
    const ux=dx/(d||1),uz=dz/(d||1),mass=t.body.mass(),hard=speed>.6;
    const push=hard?Math.min(12,3+speed*1.35):1.2,lift=hard?2.8+speed*.32:1.1;
    // A player's kick has a shared impulse, not an impulse proportional to the
    // toy's mass (which would cancel weight entirely). Light toys fly farther.
    // Bound launch speeds so the smallest toy stays playable at the faster pace.
    const kickMass=1.35,horizontalScale=Math.min(kickMass,26*mass/Math.max(1,push+speed*.25));
    t.body.applyImpulseAtPoint({x:(ux*push+velocity.x*.25)*horizontalScale,y:Math.min(lift*kickMass,9*mass),z:(uz*push+velocity.z*.25)*horizontalScale},contact.point,true);
    // The real contact creates angular momentum; cap only extreme corner hits.
    const a=t.body.angvel(),length=Math.hypot(a.x,a.y,a.z);
    if(length>12)t.body.setAngvel({x:a.x*12/length,y:a.y*12/length,z:a.z*12/length},true);
    t.lastKick=elapsed;t.kicks++;kick(t.id,speed,d);
   }
   accumulator+=Math.min(Math.max(dt,0),.1);
   while(accumulator>=STEP){
    world.step(events);accumulator-=STEP;elapsed+=STEP;
    events.drainContactForceEvents(event=>{
     const toy=byCollider.get(event.collider1())??byCollider.get(event.collider2());
     if(!toy||elapsed-toy.lastBounce<.12)return;
     const force=event.totalForceMagnitude(),strength=Math.min(7,force*STEP/Math.max(.1,toy.body.mass()));
     if(strength<.7)return;
     toy.lastBounce=elapsed;impacts++;const p=toy.body.translation();bounce(strength,Math.hypot(p.x-player.x,p.z-player.z));
    });
   }
  },
  getState:()=>({engine:'Rapier',step:STEP,bodies:toys.length,colliders:world.colliders.len(),ccd:toys.length,
   terrain:terrain.handle,impacts,elapsed:+elapsed.toFixed(3),sleeping:toys.filter(t=>t.body.isSleeping()).length}),
  dispose(){if(disposed)return;disposed=true;events.free();world.free();},
 };
}
