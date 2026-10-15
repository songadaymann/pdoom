import * as THREE from 'three';

// A meadow image that fails to download gets one more try; if it still fails, the
// error names the file. (A raw image error event has no message: it surfaced to
// players as "The meadow could not load: undefined".)
export async function loadTexture(loader:THREE.TextureLoader,url:string):Promise<THREE.Texture>{
 for(let attempt=0;;attempt++){
  try{return await loader.loadAsync(url);}
  catch{
   if(attempt>=1)throw new Error(`could not download ${url}`);
   await new Promise(resolve=>setTimeout(resolve,700));
  }
 }
}
