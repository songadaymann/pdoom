import * as THREE from 'three';

/** A gentle lens vignette over the whole frame (sky, sward, blades, bunker and
 * people alike), deepening the corners a touch the way the reference's lens does.
 * One multiply-blended triangle drawn after everything else. */
export function makeMeadowVignette():THREE.Mesh {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
  const mat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,fog:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.ZeroFactor,blendDst:THREE.SrcColorFactor,
    vertexShader:'varying vec2 vP;void main(){vP=position.xy;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:/* glsl */`varying vec2 vP;
      void main(){
        vec2 p=vP*vec2(1.,.82);
        float v=1.-.17*smoothstep(.35,1.9,dot(p,p));
        gl_FragColor=vec4(vec3(v),1.);
      }`});
  const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=1000;m.name='meadow-vignette';
  return m;
}
