import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {meadowGroundY as groundY} from './doom-meadow-ground';
import {SUN_DIR} from './bliss';
import {loadTexture} from './doom-texture-load';
import type {IconObstacle} from './doom-icon-physics';
export const HUB_DOORS=[{id:'five-prisons',label:'CONTROL.EXE',x:17,z:.1,yaw:0},{id:'hal-station',label:'HAL3000.SYS',x:2.6,z:-200.1,yaw:-223*Math.PI/180}];

/* Every hub building sits in the meadow's light the same way (the bunker's technique):
 * each face is shaded by the sun, baked per vertex so it stays an unlit, cheap material,
 * and the foot of every wall darkens over its lowest metre or so where it meets the ground. */
export const faceShade=(n:THREE.Vector3)=>.70+.30*Math.max(0,n.dot(SUN_DIR))+.06*Math.max(0,n.y);
const footShade=(height:number)=>THREE.MathUtils.lerp(.52,1,Math.min(1,Math.pow(Math.max(0,height)/1.2,.7)));
/** Bake sun shading into vertex colours; y0 lifts geometry y to height above (flat) ground. */
export function shade(geometry:THREE.BufferGeometry,y0:number,ao:boolean){
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),c=new Float32Array(p.count*3),v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){const k=faceShade(v.fromBufferAttribute(n,i))*(ao?footShade(p.getY(i)+y0):1);c[i*3]=c[i*3+1]=c[i*3+2]=k;}
 geometry.setAttribute('color',new THREE.BufferAttribute(c,3));return geometry;
}
/** The same, for world-space geometry standing on the sloping meadow: the foot follows the real ground. */
export function shadeOnGround(geometry:THREE.BufferGeometry){
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),c=new Float32Array(p.count*3),v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){const k=faceShade(v.fromBufferAttribute(n,i))*footShade(p.getY(i)-groundY(p.getX(i),p.getZ(i)));c[i*3]=c[i*3+1]=c[i*3+2]=k;}
 geometry.setAttribute('color',new THREE.BufferAttribute(c,3));return geometry;
}
/** Doom art from the local IWAD (scripts/build-hub-assets.py): nearest-filtered up close, mipmapped far off. */
export async function wadTexture(loader:THREE.TextureLoader,file:string,repeat=true){
 const t=await loadTexture(loader,`local/outside/${file}`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;
 t.minFilter=repeat?THREE.NearestMipmapLinearFilter:THREE.NearestFilter;if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;else t.generateMipmaps=false;return t;
}

/* Torch trails. Doom's torches are a 4-frame flicker (4 tics each at 35 Hz), fullbright.
 * build-hub-assets.py writes one sheet per colour (TORCHES there): 28 x 97 px cells, each
 * frame aligned on the sprite's origin. Only HAL's blue trail exists now; another
 * facility's trail is the same call with 'green' (TGRN) or 'red' (TRED). */
export type TorchColour='blue'|'green'|'red';
const TORCH={cell:[28,97],origin:[15,93],fps:35/4,scale:1/32}; // Doom scale: 32 units a metre, so ~3 m tall
type Torches={update(time:number,still:boolean):void;blocked(x:number,z:number):boolean};
export async function makeTorchTrail(parent:THREE.Object3D,loader:THREE.TextureLoader,colour:TorchColour,from:{x:number,z:number},to:{x:number,z:number},spacing=11,offset=1.6):Promise<Torches>{
 const map=await wadTexture(loader,`torch-${colour}.png`,false);
 const length=Math.hypot(to.x-from.x,to.z-from.z),dx=(to.x-from.x)/length,dz=(to.z-from.z)/length,spots:{x:number,z:number}[]=[];
 // staggered either side of the walking line, so from a distance it reads as a lit path
 for(let i=0;i*spacing<=length+.01;i++){const side=i%2?1:-1;spots.push({x:from.x+dx*i*spacing-dz*side*offset,z:from.z+dz*i*spacing+dx*side*offset});}
 // One draw call for the whole trail: an instanced quad per torch, turned about its own
 // upright axis to face the camera (Doom's sprites never tilt), alpha-tested like a sprite.
 const [w,h]=TORCH.cell.map(v=>v*TORCH.scale),quad=new THREE.PlaneGeometry(w,h).translate(w*(.5-TORCH.origin[0]/TORCH.cell[0]),h*(.5-(TORCH.cell[1]-TORCH.origin[1])/TORCH.cell[1]),0);
 const geometry=new THREE.InstancedBufferGeometry().copy(quad as unknown as THREE.InstancedBufferGeometry);geometry.instanceCount=spots.length;
 geometry.setAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array(spots.flatMap(s=>[s.x,groundY(s.x,s.z)-.05,s.z])),3));
 // four phases, so neighbours don't flicker in lockstep (Doom randomises each torch's first tic)
 geometry.setAttribute('phase',new THREE.InstancedBufferAttribute(new Float32Array(spots.map((_,i)=>(i*3)%4)),1));
 const material=new THREE.ShaderMaterial({uniforms:{map:{value:map},uFrame:{value:0}},
  vertexShader:'attribute vec3 offset;attribute float phase;uniform float uFrame;varying vec2 vUv;void main(){vec3 to=cameraPosition-offset;to.y=0.;vec3 f=normalize(to+vec3(0.,0.,1e-4));vec3 right=vec3(f.z,0.,-f.x);vUv=vec2((uv.x+mod(uFrame+phase,4.))/4.,uv.y);gl_Position=projectionMatrix*viewMatrix*vec4(offset+right*position.x+vec3(0.,position.y,0.),1.);}',
  fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);if(c.a<.5)discard;gl_FragColor=vec4(c.rgb,1.);\n#include <colorspace_fragment>\n}'});
 const trail=new THREE.Mesh(geometry,material);trail.frustumCulled=false;parent.add(trail);
 return {
  update(time,still){material.uniforms.uFrame.value=still?0:Math.floor(time*TORCH.fps)%4;},
  blocked:(x,z)=>spots.some(s=>Math.hypot(x-s.x,z-s.z)<.35)
 };
}

/** One slowly breathing LED material shared by HAL's cornice and its eye: a wave runs along each row (per-vertex phase). */
function ledMaterial(){
 return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(0x45e3ee)}},
  vertexShader:'attribute float phase;uniform float uTime;varying float vGlow;void main(){vGlow=.5+.5*sin(uTime*1.35+phase);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uColor;varying float vGlow;void main(){gl_FragColor=vec4(uColor*(.38+.8*vGlow),1.);\n#include <colorspace_fragment>\n}'});
}
function withPhase(geometry:THREE.BufferGeometry,phase:number){const n=geometry.getAttribute('position').count;geometry.setAttribute('phase',new THREE.BufferAttribute(new Float32Array(n).fill(phase),1));return geometry;}
export function painted(geometry:THREE.BufferGeometry,hex:number){const c=new THREE.Color(hex),n=geometry.getAttribute('position').count,a=new Float32Array(n*3);for(let i=0;i<n;i++)c.toArray(a,i*3);geometry.setAttribute('color',new THREE.BufferAttribute(a,3));return geometry;}

/** README.TXT: a generic text window, drawn here in code (no OS artwork). The last `red` lines are drawn in alarm red. */
export function readmeTexture(lines:string[],red=0){
 const c=document.createElement('canvas');c.width=512;c.height=384;const g=c.getContext('2d')!;
 g.fillStyle='#bdbdb5';g.fillRect(0,0,512,384);
 g.fillStyle='#f4f4ee';g.fillRect(0,0,512,4);g.fillRect(0,0,4,384);g.fillStyle='#55554f';g.fillRect(0,380,512,4);g.fillRect(508,0,4,384);
 g.fillStyle='#173d74';g.fillRect(10,10,492,52);
 g.fillStyle='#f4f4ee';g.font='bold 34px monospace';g.textBaseline='middle';g.fillText('README.TXT',24,37);
 for(const [i,mark] of ['_','x'].entries()){const x=414+i*44;g.fillStyle='#bdbdb5';g.fillRect(x,18,36,36);g.fillStyle='#1d1d1a';g.font='bold 28px monospace';g.textAlign='center';g.fillText(mark,x+18,i?35:28);g.textAlign='left';}
 g.fillStyle='#fdfdf8';g.fillRect(12,72,488,300);g.fillStyle='#7b7b74';g.fillRect(12,72,488,3);g.fillRect(12,72,3,300);
 g.fillStyle='#16160f';g.font='bold 31px monospace';g.textBaseline='alphabetic';lines.forEach((line,i)=>{g.fillStyle=i>=lines.length-red?'#b3170f':'#16160f';g.fillText(line,30,124+i*56);});
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export type StripLight='saved'|'inside'|'lost';
export const STRIP_COLOURS:Record<StripLight,number>={saved:0x3cf06a,inside:0x0d1512,lost:0x777a76};
const IRIS={idle:0x45e3ee,near:0xffae2a,sees:0xff2b20};
const EYE={radius:6,height:70,orbit:15,period:90,near:110,sees:45,turn:20*Math.PI/180};

export async function makeHubDoors(scene:THREE.Scene,portal:THREE.Texture,loader:THREE.TextureLoader){
 const occluders:THREE.Object3D[]=[];
 // Everything belonging to the HAL station (hall, sign, sky eye, trail) can be hidden
 // during the first wake-up walk, so the meadow gives nothing away before CONTROL.EXE.
 const hal=new THREE.Group();
 function sign(text:string,x:number,z:number,yaw=0,parent:THREE.Object3D=scene){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#c3c3b3';ctx.fillRect(0,0,512,96);ctx.fillStyle='#162732';ctx.fillRect(8,8,496,80);ctx.fillStyle='#e8e8ce';ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.fillText(text,256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(6,1.12),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,groundY(x,z)+3.2,z);mesh.rotation.y=yaw;parent.add(mesh);
 }
 sign('CONTROL.EXE',17,-.04,Math.PI);scene.add(hal);
 const door=HUB_DOORS[1],y=groundY(door.x,door.z),heading=door.yaw+Math.PI;
 const normal=new THREE.Vector2(Math.sin(heading),Math.cos(heading)),side=new THREE.Vector2(Math.cos(heading),-Math.sin(heading));
 const [startan,comptall,tekwall,halStill]=await Promise.all(['hal-startan3.png','hal-comptall.png','hal-tekwall1.png','hal-doorway.png'].map((f,i)=>wadTexture(loader,f,i<3)));

 /* HAL3000.SYS (docs/spec/04-bliss-hub-world.md 2.3): a low, wide hall skinned in E1M7's
  * station walls, built in the door's own frame (x along the facade, z out of the door,
  * y up from the door's ground; the door at the origin, exactly where it always was).
  * STARTAN3 body on a TEKWALL1 plinth with TEKWALL1 corner piers, a COMPTALL band of
  * computer panels, and a pearl-white smart-speaker cornice with breathing status LEDs.
  * Walls run 3 m below the door's ground, so the hall sits into the slope of the valley.
  * The 36 x 22 m footprint is the spec's; the roofline (5.6 m over the door's ground) is
  * not: the valley is meant to hide the building from the south, and at 5.6 m it peeks over
  * the ridge no more than the old dome did (hidden from the bunker door). */
 const HW=18,DEPTH=22,TOP=4.75,BASE=-3,GAP=1.1,OPEN=2.6,BAND=[2.8,4.5];
 const toWorld=new THREE.Matrix4().makeTranslation(door.x,y,door.z).multiply(new THREE.Matrix4().makeRotationY(heading));
 const parts=new Map<THREE.Texture,THREE.BufferGeometry[]>([[startan,[]],[comptall,[]],[tekwall,[]]]);
 // world-scale UVs in the door frame: textures run on across pieces at one scale ([u,v] metres per tile)
 function slab(map:THREE.Texture,tile:[number,number],[x0,x1]:number[],[y0,y1]:number[],[z0,z1]:number[],vFrom=0){
  const w=x1-x0,h=y1-y0,d=z1-z0,g=new THREE.BoxGeometry(w,h,d,Math.ceil(w/4),Math.ceil(h/.8),Math.ceil(d/4)).toNonIndexed();
  g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
  for(let i=0;i<p.count;i++){
   const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
   const flat=Math.abs(ny)>.5,u=flat?px:Math.abs(nx)>.5?(nx>0?-pz:pz):(nz>0?px:-px),v=flat?pz:py-vFrom;
   uv.setXY(i,u/tile[0],v/tile[1]);
  }
  parts.get(map)!.push(g);
 }
 const STONE:[number,number]=[4,4],PANEL:[number,number]=[2*(BAND[1]-BAND[0]),BAND[1]-BAND[0]];  // COMPTALL keeps its 2:1
 slab(startan,STONE,[-HW,HW],[BASE,TOP],[-DEPTH,-.3]);                       // the hall
 slab(startan,STONE,[-HW,-GAP],[BASE,TOP],[-.3,0]);slab(startan,STONE,[GAP,HW],[BASE,TOP],[-.3,0]); // the facade, either side of the door
 slab(startan,STONE,[-GAP,GAP],[OPEN,TOP],[-.3,0]);                           // over the door
 slab(tekwall,STONE,[-HW-.12,-GAP],[BASE,.9],[-DEPTH-.12,.12]);slab(tekwall,STONE,[GAP,HW+.12],[BASE,.9],[-DEPTH-.12,.12]);slab(tekwall,STONE,[-GAP,GAP],[BASE,.9],[-DEPTH-.12,-.3]);
 for(const sx of [-1,1])for(const [z0,z1] of [[-.9,.2],[-DEPTH-.2,-DEPTH+.9]]){const x=sx*(HW-.35);slab(tekwall,STONE,[x-.55,x+.55].map(v=>v+sx*.2),[BASE,TOP],[z0,z1]);}
 slab(comptall,PANEL,[-HW+1.4,-3.4],BAND,[0,.1],BAND[0]);slab(comptall,PANEL,[3.4,HW-1.4],BAND,[0,.1],BAND[0]);
 slab(comptall,PANEL,[-HW+1.4,HW-1.4],BAND,[-DEPTH-.1,-DEPTH],BAND[0]);
 for(const sx of [-1,1])slab(comptall,PANEL,sx<0?[-HW-.1,-HW]:[HW,HW+.1],BAND,[-DEPTH+1.4,-1.4],BAND[0]);
 for(const [map,list] of parts){
  const g=shadeOnGround(mergeGeometries(list).applyMatrix4(toWorld));list.forEach(l=>l.dispose());
  hal.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({map,color:map===comptall?0xb4b4b4:map===tekwall?0xa2a2a2:0xa8a8a8,vertexColors:true})));
 }
 // the pearl cornice: a rounded slab capping the hall, like the top of a smart speaker
 const R=1.2,cx0=-HW-.35,cx1=HW+.35,cz0=-.35,cz1=DEPTH+.35,plan=new THREE.Shape();  // plan in (x, -z)
 plan.moveTo(cx0+R,cz0);plan.lineTo(cx1-R,cz0);plan.quadraticCurveTo(cx1,cz0,cx1,cz0+R);plan.lineTo(cx1,cz1-R);plan.quadraticCurveTo(cx1,cz1,cx1-R,cz1);
 plan.lineTo(cx0+R,cz1);plan.quadraticCurveTo(cx0,cz1,cx0,cz1-R);plan.lineTo(cx0,cz0+R);plan.quadraticCurveTo(cx0,cz0,cx0+R,cz0);
 const bevel=.18,cornice=new THREE.ExtrudeGeometry(plan,{depth:.5,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:5});
 cornice.rotateX(-Math.PI/2).translate(0,TOP+bevel,0).applyMatrix4(toWorld);cornice.computeVertexNormals();
 const pearl=new THREE.MeshBasicMaterial({color:0xf2f0e8,vertexColors:true});
 hal.add(new THREE.Mesh(shade(cornice,0,false),pearl));
 // its status LEDs: a row of soft pills round the three faces you can walk up to
 const leds=ledMaterial(),ledParts:THREE.BufferGeometry[]=[],ledY=TOP+bevel+.25,ledFace=.35+bevel+.02;
 for(let x=-HW+1;x<=HW-1+.01;x+=1.8)ledParts.push(withPhase(new THREE.PlaneGeometry(.75,.16).translate(x,ledY,ledFace),-x*.32));
 for(const sx of [-1,1])for(let z=-1.6;z>=-DEPTH+1;z-=1.8)ledParts.push(withPhase(new THREE.PlaneGeometry(.75,.16).rotateY(sx*Math.PI/2).translate(sx*(HW+ledFace),ledY,z),(-sx*HW+z*sx)*.32));
 const ledRow=new THREE.Mesh(mergeGeometries(ledParts).applyMatrix4(toWorld),leds);hal.add(ledRow);

 // A cheap stand-in for the hall in the people-label occlusion rays (the textured hull is ~3k triangles).
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(HW*2+.7,TOP-BASE+.9,DEPTH+.7).translate(0,(TOP+BASE+.9)/2,-DEPTH/2),new THREE.MeshBasicMaterial());
 proxy.visible=false;proxy.applyMatrix4(toWorld);hal.add(proxy);occluders.push(proxy);

 // The door: unchanged position, trim and entrance. Its face shows the live engine view only
 // while HAL is the level loaded; otherwise a still of E1M7's own corridor (never level 1's interior).
 const frame=new THREE.Group();frame.position.set(door.x,y,door.z);frame.rotation.y=heading;hal.add(frame);
 const trim=new THREE.MeshBasicMaterial({color:0x414c4b});
 for(const [w,h,d,x,cy,z] of [[.25,2.8,.5,-1.23,1.4,0],[.25,2.8,.5,1.23,1.4,0],[2.7,.25,.5,0,2.73,0],[2.7,.12,1.2,0,.035,.4]]){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trim);mesh.position.set(x,cy,z);frame.add(mesh);occluders.push(mesh);
 }
 const faceMaterial=new THREE.MeshBasicMaterial({map:halStill});
 const face=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.6),faceMaterial);face.position.set(0,1.3,.02);frame.add(face);sign('HAL3000.SYS',door.x+normal.x*.3,door.z+normal.y*.3,heading,hal);
 // the 5-light status strip over the door: green per person saved, dark per person inside, grey per person lost
 const stripParts=[painted(new THREE.BoxGeometry(3.1,.62,.14).translate(0,4.12,.07),0x1b2124)];
 for(let i=0;i<5;i++)stripParts.push(painted(new THREE.BoxGeometry(.38,.38,.06).translate((i-2)*.56,4.12,.16),STRIP_COLOURS.inside));
 const stripGeometry=mergeGeometries(stripParts),stripColour=stripGeometry.getAttribute('color') as THREE.BufferAttribute,perBox=stripParts[0].getAttribute('position').count;
 frame.add(new THREE.Mesh(stripGeometry,new THREE.MeshBasicMaterial({vertexColors:true})));
 let stripKey='';
 function setStrip(lights:StripLight[]){
  const key=lights.join();if(key===stripKey)return;stripKey=key;const c=new THREE.Color();
  // Nobody left inside: the level is beaten, and the README gloats instead of warning.
  readmeMaterial.map=lights.every(l=>l!=='inside')?readmeBeaten:readmeWarning;
  lights.forEach((state,i)=>{c.setHex(STRIP_COLOURS[state]);for(let v=0;v<perBox;v++)c.toArray(stripColour.array,((i+1)*perBox+v)*3);});stripColour.needsUpdate=true;
 }
 // README.TXT on the facade left of the door, at reading height. Until the level is beaten
 // it's HAL's own polite warning (Jonathan, 2026-10-13: the victory joke made HAL feel
 // already beaten before you'd gone in); afterwards, a cut of the episode's exit text.
 const readmeWarning=readmeTexture(["Hello. I'm HAL3000.",'Five humans are in my','care. They are safe.','They will never leave.','I can see you.'],1);
 const readmeBeaten=readmeTexture(['HAL3000 watched every','step and still never','saw you coming. It was','too busy being certain.']);
 const readmeMaterial=new THREE.MeshBasicMaterial({map:readmeWarning,color:0xe6e6e6});
 const readme=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.1),readmeMaterial);
 readme.position.set(-5.5,1.68,.17);frame.add(readme);

 /* The landmark: HAL3000's eye (spec 2.3, GAME-SPEC 6.1). A 12 m pearl-white sphere, one
  * camera iris in a ring of LEDs, a few trailing cables, floating 70 m over the hall on a
  * slow 15 m Lissajous orbit (90 s). Iris cyan when idle; amber when you're near the
  * station, while it turns to watch you (20 deg/s); red once it is looking right at you
  * up close. Five draw calls. Reduced motion stops its drift and sway and stills the LEDs and torches. */
 const centre=new THREE.Vector3(door.x-normal.x*DEPTH/2,y+EYE.height,door.z-normal.y*DEPTH/2);
 const eye=new THREE.Group();eye.position.copy(centre);hal.add(eye);
 eye.add(new THREE.Mesh(shade(new THREE.SphereGeometry(EYE.radius,28,18),0,false),new THREE.MeshBasicMaterial({color:0xf1efe7,vertexColors:true})));
 const gaze=new THREE.Group();eye.add(gaze);
 const cap=(r:number,angle:number,hex:number)=>painted(new THREE.SphereGeometry(r,32,3,0,Math.PI*2,0,angle).rotateX(Math.PI/2),hex);
 const glint=cap(EYE.radius+.1,.04,0xf6fbff).rotateY(-.1).rotateX(-.1);
 gaze.add(new THREE.Mesh(mergeGeometries([cap(EYE.radius+.03,.44,0x23292d),cap(EYE.radius+.09,.12,0x05080a),glint]),new THREE.MeshBasicMaterial({vertexColors:true})));
 const irisMaterial=new THREE.MeshBasicMaterial({color:IRIS.idle});gaze.add(new THREE.Mesh(cap(EYE.radius+.06,.29,0xffffff),irisMaterial));
 const ringParts:THREE.BufferGeometry[]=[];
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2,t=.365,dir=new THREE.Vector3(Math.sin(t)*Math.cos(a),Math.sin(t)*Math.sin(a),Math.cos(t));
  const dot=new THREE.BoxGeometry(.42,.42,.12);dot.lookAt(dir);dot.translate(dir.x*(EYE.radius+.07),dir.y*(EYE.radius+.07),dir.z*(EYE.radius+.07));ringParts.push(withPhase(dot,-a*2));}
 gaze.add(new THREE.Mesh(mergeGeometries(ringParts),leds));
 const cables=[[[-1.6,-5.7,1],[-2.4,-10,2.5],[-1.2,-14,4],[-2.6,-17.5,4.6]],[[1.8,-5.6,-.4],[3.4,-9.5,-1.2],[2.8,-12.5,-3.4]],[[.2,-5.9,-1.4],[.8,-11,-2.2],[-.6,-15,-1.6],[.4,-20,-.8],[1.6,-22.5,.4]]]
  .map(points=>painted(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x,y,z))),18,.17,5),0x2b3135));
 const cableBundle=new THREE.Mesh(mergeGeometries(cables),new THREE.MeshBasicMaterial({vertexColors:true}));eye.add(cableBundle);
 const torches=await makeTorchTrail(hal,loader,'blue',{x:16,z:-20},{x:door.x+normal.x*10+side.x*7,z:door.z+normal.y*10+side.y*7});

 let mood:keyof typeof IRIS='idle',orbit=0;
 const look=new THREE.Quaternion(),toward=new THREE.Vector3(),probe=new THREE.Object3D(),ledColour=leds.uniforms.uColor.value as THREE.Color;
 return {occluders,
  physicsBoxes:():IconObstacle[]=>[{x:door.x-normal.x*DEPTH/2,y:y+(TOP+BASE)/2,z:door.z-normal.y*DEPTH/2,
   hx:HW,hy:(TOP-BASE)/2,hz:DEPTH/2,yaw:heading}],
  setHalVisible:(visible:boolean)=>{hal.visible=visible;},
  /** Which picture HAL's doorway shows: the live engine view only while HAL is the loaded level. */
  setLevel:(id:string)=>{faceMaterial.map=id===door.id?portal:halStill;},
  blocked:(x:number,z:number)=>{
   if(!hal.visible)return false;const dx=x-door.x,dz=z-door.z,u=dx*side.x+dz*side.y,v=dx*normal.x+dz*normal.y;
   return Math.abs(u)<HW+.6&&v<.45&&v>-DEPTH-.6||torches.blocked(x,z);
  },
  update(dt:number,time:number,player:THREE.Vector3,reduced:boolean,lights:StripLight[]){
   setStrip(lights);if(!hal.visible)return;
   torches.update(time,reduced);
   leds.uniforms.uTime.value=reduced?Math.PI/2.7:time;
   if(!reduced)orbit+=dt;
   const w=orbit*Math.PI*2/EYE.period;
   eye.position.set(centre.x+EYE.orbit*Math.sin(w),centre.y+1.2*Math.sin(w*3),centre.z+EYE.orbit*.6*Math.sin(w*2));
   cableBundle.rotation.set(reduced?0:Math.sin(time*.5)*.05,0,reduced?0:Math.sin(time*.37)*.06);
   const range=Math.hypot(player.x-door.x,player.z-door.z),near=range<EYE.near;
   // idle, it surveys the valley; near, it turns to you, no faster than 20 deg/s
   if(near)toward.copy(player);else toward.set(eye.position.x+Math.sin(reduced?0:time*.05)*80,eye.position.y-25,eye.position.z+Math.cos(reduced?0:time*.05)*80);
   probe.position.copy(eye.position);probe.lookAt(toward);look.copy(probe.quaternion);
   gaze.quaternion.rotateTowards(look,EYE.turn*dt);
   mood=!near?'idle':range<EYE.sees&&gaze.quaternion.angleTo(look)<.1?'sees':'near';
   irisMaterial.color.setHex(IRIS[mood]);ledColour.setHex(IRIS[mood]);
  },
  getState:()=>({eye:mood==='idle'?'cyan':mood==='near'?'amber':'red',eye_at:eye.position.toArray().map(v=>+v.toFixed(2)),strip:stripKey})};
}
