import * as THREE from 'three';

export const TOY_SIZE=1.8,TOY_DEPTH=.34;

/** Opaque pixel faces and exposed, shaded edges. The collision hull is deliberately
 * simpler than the drawing: one convex silhouette, not a collider for every pixel. */
export function makeIconToy(draw:(g:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const g=canvas.getContext('2d')!;draw(g);
 const pixels=g.getImageData(0,0,32,32).data,step=TOY_SIZE/32;
 const occupied=(x:number,y:number)=>x>=0&&x<32&&y>=0&&y<32&&pixels[(y*32+x)*4+3]>=128;
 const positions:number[]=[],colors:number[]=[],hull:number[]=[];
 const colour=new THREE.Color();
 let minY=Infinity,maxY=-Infinity;
 function face(points:number[][],shade:number){
  for(const i of [0,1,2,0,2,3]){positions.push(...points[i]);colors.push(colour.r*shade,colour.g*shade,colour.b*shade);}
 }
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  if(!occupied(x,y))continue;
  const k=(y*32+x)*4,x0=(x-16)*step,x1=x0+step,y1=(16-y)*step,y0=y1-step,z=TOY_DEPTH/2;
  colour.setRGB(pixels[k]/255,pixels[k+1]/255,pixels[k+2]/255,THREE.SRGBColorSpace);
  face([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],1);
  // Pixel colours continue on the back as well.
  face([[x1,y0,-z],[x0,y0,-z],[x0,y1,-z],[x1,y1,-z]],.86);
  if(!occupied(x-1,y))face([[x0,y0,-z],[x0,y0,z],[x0,y1,z],[x0,y1,-z]],.55);
  if(!occupied(x+1,y))face([[x1,y0,z],[x1,y0,-z],[x1,y1,-z],[x1,y1,z]],.70);
  if(!occupied(x,y-1))face([[x0,y1,z],[x1,y1,z],[x1,y1,-z],[x0,y1,-z]],1.12);
  if(!occupied(x,y+1))face([[x0,y0,-z],[x1,y0,-z],[x1,y0,z],[x0,y0,z]],.42);
  minY=Math.min(minY,y0);maxY=Math.max(maxY,y1);
  // Boundary corners alone define the convex hull; omit interior pixels.
  if(!occupied(x-1,y)||!occupied(x+1,y)||!occupied(x,y-1)||!occupied(x,y+1))
   for(const xx of [x0,x1])for(const yy of [y0,y1])for(const zz of [-z,z])hull.push(xx,yy,zz);
 }
 const centerY=(minY+maxY)/2;
 for(let i=1;i<positions.length;i+=3)positions[i]-=centerY;
 for(let i=1;i<hull.length;i+=3)hull[i]-=centerY;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const material=new THREE.MeshBasicMaterial({vertexColors:true});
 return {mesh:new THREE.Mesh(geometry,material),material,hull:new Float32Array(hull),halfHeight:(maxY-minY)/2};
}
