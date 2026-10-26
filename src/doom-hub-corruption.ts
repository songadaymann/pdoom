import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {IconObstacle} from './doom-icon-physics';
import {meadowUniforms} from './doom-meadow-shared';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import {TRON,TRON_GATE} from './doom-hub-traces';

/* SAFE MODE coming apart, the scenery half (the ground and sky are doom-hub-traces.ts and the meadow shaders).
 * One stage per level cleared after the first: each cleared structure's edges rez up in Tron light, and after the
 * fourth level the wallpaper sheds its pixels, which drift south toward the MCP column and the endgame's walk.
 * After one level nothing here shows: that first arrival is the approved look. */

function edgeTubes(box:IconObstacle,width:number){
 const parts:THREE.BufferGeometry[]=[],{hx,hy,hz}=box;
 for(const a of [-1,1])for(const b of [-1,1]){
  parts.push(new THREE.BoxGeometry(hx*2+width,width,width).translate(0,a*hy,b*hz));
  parts.push(new THREE.BoxGeometry(width,hy*2+width,width).translate(a*hx,0,b*hz));
  parts.push(new THREE.BoxGeometry(width,width,hz*2+width).translate(a*hx,b*hy,0));
 }
 return mergeGeometries(parts).rotateY(box.yaw||0).translate(box.x,box.y,box.z);
}
const PIXEL_COLOURS=[0x2f8f2a,0x3fae38,0x1d6d1a,0x58c24a,0x2a62d6,0x6f9df0,0xb9d4ff,0xffffff,TRON.line];
const PIXELS=420;

/** structures: each cleared structure's boxes (CONTROL.EXE, HAL3000.SYS, MEG3N.AVI, AGENTIC.BAT). */
export function makeHubCorruption(scene:THREE.Scene,structures:IconObstacle[][]){
 const U=meadowUniforms();
 const edges=structures.map(boxes=>{
  const material=new THREE.MeshBasicMaterial({color:TRON.line,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.Mesh(mergeGeometries(boxes.map(b=>edgeTubes(b,b.hy>20?.5:.22))),material);mesh.visible=false;mesh.renderOrder=6;scene.add(mesh);
  return {mesh,material};
 });
 // the wallpaper's own pixels, lifting off and drifting south
 const pixelMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
 const pixels=new THREE.InstancedMesh(new THREE.BoxGeometry(.8,.8,.8),pixelMaterial,PIXELS);pixels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);pixels.frustumCulled=false;pixels.count=0;scene.add(pixels);
 const colour=new THREE.Color();for(let i=0;i<PIXELS;i++)pixels.setColorAt(i,colour.setHex(PIXEL_COLOURS[i%PIXEL_COLOURS.length]));
 const state=Array.from({length:PIXELS},()=>({p:new THREE.Vector3(),v:new THREE.Vector3(),age:0,life:-1,spin:new THREE.Vector3()}));
 const dummy=new THREE.Object3D();let seed=7;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const cleared=[0,0,0,0];let corrupt=-1,shown=0;
 function spawn(s:typeof state[number],cam:THREE.Vector3){
  const a=rnd()*Math.PI*2,r=20+rnd()*150,x=THREE.MathUtils.clamp(cam.x+Math.cos(a)*r,-230,220),z=THREE.MathUtils.clamp(cam.z+Math.sin(a)*r,-250,175);
  s.p.set(x,groundY(x,z)+.2,z);s.v.set((TRON_GATE.x-x)*.003+(rnd()-.5)*.4,.6+rnd()*1.2,.5+rnd()*1.1);s.age=0;s.life=7+rnd()*9;s.spin.set(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(2.4);
 }
 return {
  /** done: the four structures resolved; instant skips the easing (a load, not an arrival). Returns the eased stage. */
  update(dt:number,time:number,cam:THREE.Vector3,done:boolean[],instant:boolean,reduced:boolean){
   const target=Math.max(0,done.filter(Boolean).length-1);
   if(instant||corrupt<0)corrupt=target;else corrupt+=THREE.MathUtils.clamp(target-corrupt,-dt*.5,dt*.35);
   done.forEach((d,i)=>{cleared[i]=instant?+d:THREE.MathUtils.clamp(cleared[i]+(d?dt:-dt)*.5,0,1);});
   U.uCorrupt.value=corrupt;U.uCleared.value.set(cleared[0],cleared[1],cleared[2],cleared[3]);U.uDusk.value=THREE.MathUtils.clamp(corrupt-2,0,1)*.8;U.uTronMotion.value=reduced?0:1;
   const c1=THREE.MathUtils.clamp(corrupt,0,1),c2=THREE.MathUtils.clamp(corrupt-1,0,1),c3=THREE.MathUtils.clamp(corrupt-2,0,1);
   edges.forEach((e,i)=>{const o=cleared[i]*c1*(.35+.3*c2+.35*c3)*(reduced?1:.85+.15*Math.sin(time*2.1+i));e.mesh.visible=o>.002;e.material.opacity=o;});
   const want=Math.round(PIXELS*c3+40*c2*(1-c3));
   for(let i=0;i<PIXELS;i++){
    const s=state[i];
    if(s.life<0||s.age>s.life){if(i<want)spawn(s,cam);else{s.life=-1;continue;}}
    if(!reduced){s.age+=dt;s.p.addScaledVector(s.v,dt);}
    const k=Math.min(1,s.age*2)*(1-THREE.MathUtils.smoothstep(s.age,s.life*.65,s.life));
    dummy.position.copy(s.p);dummy.rotation.set(s.spin.x*s.age,s.spin.y*s.age,s.spin.z*s.age);dummy.scale.setScalar(Math.max(.001,k));dummy.updateMatrix();pixels.setMatrixAt(i,dummy.matrix);
   }
   shown=want;pixels.count=want;pixels.instanceMatrix.needsUpdate=true;
   return corrupt;
  },
  setVisible(value:boolean){pixels.visible=value;for(const e of edges)e.mesh.visible=value&&e.material.opacity>.002;},
  getState:()=>({corrupt:+corrupt.toFixed(3),cleared:cleared.map(c=>+c.toFixed(2)),pixels:shown,edges:edges.map(e=>+e.material.opacity.toFixed(2))}),
 };
}
