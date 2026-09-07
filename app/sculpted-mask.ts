import * as THREE from 'three';
/** Recessed, weathered features share one indexed surface and its material. */
export function sculptedMask(variant=0){
 const g=new THREE.SphereGeometry(1,40,28),p=g.getAttribute('position'),colors=new Float32Array(p.count*3);
 const clamp=THREE.MathUtils.clamp;
 const bell=(x:number,y:number,cx:number,cy:number,sx:number,sy:number)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 for(let i=0;i<p.count;i++){
  const u=p.getX(i),v=p.getY(i),w=p.getZ(i),front=Math.max(0,w),jaw=1-.19*smooth(.12,.90,-v);
  const eyes=bell(u,v,-.43,.15,.23,.13)+bell(u,v,.43,.13,.23,.13);
  const brows=bell(u,v,-.40,.33,.26,.075)+bell(u,v,.40,.31,.26,.075);
  const cheeks=bell(u,v,-.49,-.12,.23,.19)+bell(u,v,.49,-.12,.23,.19);
  const bridge=bell(u,v,0,.10,.105,.36),nose=bell(u,v,.018,-.14,.16,.115);
  const nostrils=bell(u,v,-.105,-.205,.052,.043)+bell(u,v,.105,-.205,.052,.043);
  const mouthY=-.45+.06*u+.08*u*u,mouth=Math.exp(-(((v-mouthY)/.027)**2+(u/.30)**4));
  const lips=bell(u,v,0,-.39,.30,.035)+bell(u,v,0,-.51,.25,.035);
  const crackX=-.45+.09*Math.sin(v*8+variant*.71),crack=Math.exp(-(((u-crackX)/.014)**2+((v-.10)/.53)**4));
  const stain=.5+.5*Math.sin(u*11+v*6+variant)*Math.sin(v*9-u*3);
  const relief=.011*brows+.008*cheeks+.023*bridge+.025*nose-.023*eyes-.010*nostrils-.017*mouth+.004*lips-.003*crack;
  p.setXYZ(i,.14*u*jaw,.23*v,w>0?clamp(.052*w+front*relief,0,.09*w):.09*w);
  const shade=clamp(.98-front*(.72*eyes+.54*mouth+.30*nostrils+.15*crack+.065*stain),.16,1);
  colors.set([shade,shade*(.965-.025*stain),shade*(.89-.035*stain)],i*3);
 }
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
