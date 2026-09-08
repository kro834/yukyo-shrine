import * as THREE from 'three';

/** Angular reflector profile: a soft central lobe over a broad, weaker spill.
 * Distance attenuation and the outer cone still belong to the real spot light.
 * This is a linear light-transmission map, not a colour or surface texture. */
export function createFlashlightOptics(){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r2=u*u+v*v;
  const value=Math.round(255*(.68*Math.exp(-20*r2)+.32*Math.exp(-.9*r2))),offset=(y*size+x)*4;
  data[offset]=data[offset+1]=data[offset+2]=value;data[offset+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
 texture.name='flashlight-reflector-profile';texture.colorSpace=THREE.NoColorSpace;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.needsUpdate=true;
 return texture;
}
