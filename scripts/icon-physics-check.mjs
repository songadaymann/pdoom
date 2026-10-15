// Deterministic checks against the real physics world, not a mock integration.
import {build} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await build({configFile:false,logLevel:'error',build:{outDir:'output/icon-physics/module',emptyOutDir:true,
 lib:{entry:'src/doom-icon-physics.ts',formats:['es'],fileName:()=> 'physics.mjs'}}});
const {makeIconPhysics}=await import('../output/icon-physics/module/physics.mjs');
const hull=new Float32Array([-0.8,-.8,-.17,-.8,-.8,.17,-.8,.8,-.17,-.8,.8,.17,.8,-.8,-.17,.8,-.8,.17,.8,.8,-.17,.8,.8,.17]);
const spec=(id,x,z,mass=1.6)=>({id,x,z,hull,halfHeight:.8,mass});
const viewer={x:-100,y:2,z:100},still={x:0,z:0};
let kicked=0,bounces=0;
const step=(world,n,dt=1/60,player=viewer,velocity=still)=>{for(let i=0;i<n;i++)world.update(dt,player,velocity,()=>kicked++,()=>bounces++);};
const cases=[];
let w=await makeIconPhysics([spec('kick',17,-8)],[]);
step(w,60);
const toy=w.toys[0],before={...toy.body.translation()};
step(w,1,1/60,{x:before.x,y:before.y+1,z:before.z+.65},{x:0,z:-6});
assert.equal(kicked,1,'Walking contact kicks a real body');
assert.ok(Math.hypot(...Object.values(toy.body.angvel()))>.1,'Contact creates angular momentum');
step(w,360);
assert.ok(Math.hypot(toy.body.translation().x-before.x,toy.body.translation().z-before.z)>2,'Kick travels');
assert.ok(toy.body.isSleeping(),'Toy comes to rest');
cases.push('Sprint kick creates angular momentum, travels and sleeps');w.dispose();w.dispose();
// Equal kicks against equal shapes must produce genuinely different flights.
const weights=[];
for(const mass of [1.8,1,.55]){
 w=await makeIconPhysics([spec('weight',17,20,mass)],[]);step(w,90);
 const t=w.toys[0],start={...t.body.translation()};
 step(w,1,1/60,{x:start.x,y:start.y+1,z:start.z+.65},{x:0,z:-3.6});
 assert.equal(t.kicks,1);const launch=Math.hypot(...Object.values(t.body.linvel()));
 step(w,360);const p=t.body.translation(),travel=Math.hypot(p.x-start.x,p.z-start.z);
 weights.push({mass,launch,travel});w.dispose();
}
assert.ok(weights[1].launch>weights[0].launch*1.3&&weights[2].launch>weights[1].launch*1.3,'Lighter toys launch faster from the same contact');
assert.ok(weights[1].travel>weights[0].travel*1.3&&weights[2].travel>weights[1].travel*1.3,'Lighter toys travel farther');
cases.push('Equal kicks send medium and light toys progressively farther than heavy toys');
// A dropped object on the hill picks up horizontal motion from the sloping ground.
w=await makeIconPhysics([spec('slope',-55,-70)],[]);
w.toys[0].body.setTranslation({x:-55,y:34,z:-70},true);step(w,240);
assert.ok(Math.hypot(w.toys[0].body.translation().x+55,w.toys[0].body.translation().z+70)>.3,'Slope redirects fall');
cases.push('A fall onto the hillside produces downhill motion');w.dispose();
// CCD must stop a very fast body at a thin building face.
w=await makeIconPhysics([spec('fast',17,-8)],[{x:17,y:4,z:-15,hx:4,hy:6,hz:.15}]);
w.toys[0].body.setLinvel({x:0,y:0,z:-95},true);step(w,20);
assert.ok(w.toys[0].body.translation().z>-15,'No tunneling through a thin wall');
cases.push('CCD prevents tunneling into a thin wall at 95 m/s');w.dispose();
// A moving toy must transfer momentum to another toy rather than pass through it.
w=await makeIconPhysics([spec('a',17,10),spec('b',17,7.2)],[]);step(w,120);
w.toys[0].body.setLinvel({x:0,y:0,z:-12},true);step(w,45);
assert.ok(Math.abs(w.toys[1].body.translation().z-7.2)>.5,'Second toy receives momentum');
cases.push('Toy-to-toy collision transfers momentum');w.dispose();
// Equivalent elapsed time at different display rates runs the same fixed steps.
const snapshots=[];
for(const hz of [120,60,20]){
 w=await makeIconPhysics([spec('rate',17,-8)],[]);
 w.toys[0].body.setLinvel({x:2,y:4,z:-6},true);step(w,hz*3,1/hz);
 snapshots.push({...w.toys[0].body.translation()});w.dispose();
}
for(const p of snapshots)assert.ok(Math.hypot(p.x-snapshots[0].x,p.y-snapshots[0].y,p.z-snapshots[0].z)<.05,'Display rate does not alter physics');
cases.push('120/60/20 FPS display timing gives matching trajectories');
// Physical thickness supports a stable pile instead of interpenetrating planes.
w=await makeIconPhysics([spec('low',17,10),spec('mid',17,10),spec('high',17,10)],[]);
w.toys.forEach((t,i)=>{t.body.setRotation({x:-Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2},true);
 t.body.setTranslation({x:17+i*.02,y:.19+i*.36,z:10},true);});
step(w,480);
const pile=w.toys.map(t=>t.body.translation().y).sort((a,b)=>a-b);
assert.ok(pile[1]-pile[0]>.30&&pile[2]-pile[1]>.30,'Chunky bodies stack without sinking through each other');
assert.ok(w.toys.every(t=>t.body.isSleeping()),'The pile sleeps');
cases.push('Physical thickness supports a stable sleeping pile');w.dispose();
w=await makeIconPhysics([spec('spike',17,10)],[]);step(w,1,.75);
assert.ok(w.getState().elapsed<=.101,'A long frame uses at most six fixed steps');
assert.ok(Number.isFinite(w.toys[0].body.translation().y));w.dispose();
cases.push('Long frame spikes remain bounded and finite');
w=await makeIconPhysics([spec('reset',17,-8)],[]);assert.equal(w.toys[0].kicks,0);assert.equal(w.getState().bodies,1);
w.dispose();cases.push('Fresh world resets bodies and double disposal is safe');
await fs.writeFile('output/icon-physics/simulation-report.json',JSON.stringify({passed:true,cases,kicked,bounces,snapshots,weights},null,2));
console.log(JSON.stringify({passed:true,cases,kicked,bounces,weights}));
