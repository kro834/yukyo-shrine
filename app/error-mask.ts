import {sculptedMask} from './sculpted-mask.ts';
import {upgradeBlenderGeometry} from './blender-geometry.ts';
/** Warp the carved shell and its cavity linings together; openings remain actual holes. */
export function errorMask(weep:boolean){
 const g=sculptedMask(weep?11:17),p=g.getAttribute('position'),colors=g.getAttribute('color');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  let py=y,px=x;
  if(weep){
   // A hanging jaw stretches the mouth aperture, never a flat painted black oval.
   const from=[-.23,-.121,-.111,.23],to=[-.286,-.164,-.082,.23];let j=0;while(j<2&&y>from[j+1])j++;
   py=to[j]+(y-from[j])/(from[j+1]-from[j])*(to[j+1]-to[j]);
   px=x*(1+.22*Math.exp(-(((y+.12)/.09)**2)));
  }else{
   px=x*(1+.075*Math.sin(y*13));py=y+.012*Math.sin(x*20);
  }
  p.setXYZ(i,px,py,z-.003*Math.sin(y*42+x*23));
  const tone=colors.getX(i),weather=.12*(.5+.5*Math.sin(x*73+y*47))**7;
  colors.setXYZ(i,tone*(1-weather),tone*(1-weather*1.5),tone*(1-weather*1.8));
 }
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.errorMask=weep?'哭面':'逆面';
 upgradeBlenderGeometry(g,weep?'/models/error/weeping.glb':'/models/error/inverse.glb');return g;
}
