import * as THREE from 'three';
type FieldCell=(x:number,z:number)=>boolean;
const SEGMENTS=6;
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** A shared world-height sampler keeps adjacent tiles and other floor finishes flush. */
export function fieldGroundHeight(x:number,z:number,seed:number,isField:FieldCell){
 const cx=Math.round(x/4),cz=Math.round(z/4);if(!isField(cx,cz))return 0;
 let edge=1;
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(!isField(cx+dx,cz+dz)){
  const gapX=Math.max(0,Math.abs(x-(cx+dx)*4)-2),gapZ=Math.max(0,Math.abs(z-(cz+dz)*4)-2);
  edge=Math.min(edge,smooth(Math.hypot(gapX,gapZ)/.65));
 }
 const phase=(seed>>>0)%971*.031;
 const broad=Math.sin(x*.81+phase)*Math.cos(z*.67-phase),grain=Math.sin(x*2.3+z*1.7+phase);
 return edge*(.007+.0047*broad+.0023*grain);
}
export function fieldGround(x:number,z:number,seed:number,isField:FieldCell){
 const g=new THREE.PlaneGeometry(4,4,SEGMENTS,SEGMENTS);g.rotateX(-Math.PI/2);g.translate(x,0,z);
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);p.setY(i,fieldGroundHeight(x,z,seed,isField));
  const dx=(fieldGroundHeight(x+.025,z,seed,isField)-fieldGroundHeight(x-.025,z,seed,isField))/.05;
  const dz=(fieldGroundHeight(x,z+.025,seed,isField)-fieldGroundHeight(x,z-.025,seed,isField))/.05;
  v.set(-dx,1,-dz).normalize();n.setXYZ(i,v.x,v.y,v.z);
 }
 return g;
}
/** Sample the rendered triangles, so planted geometry cannot float above a curved height field. */
export function fieldSurfaceHeight(x:number,z:number,seed:number,isField:FieldCell){
 const startX=Math.round(x/4)*4-2,startZ=Math.round(z/4)*4-2,step=4/SEGMENTS;
 const ux=(x-startX)/step,uz=(z-startZ)/step,ix=Math.min(SEGMENTS-1,Math.floor(ux)),iz=Math.min(SEGMENTS-1,Math.floor(uz));
 const fx=ux-ix,fz=uz-iz,x0=startX+ix*step,z0=startZ+iz*step;
 const h00=fieldGroundHeight(x0,z0,seed,isField),h10=fieldGroundHeight(x0+step,z0,seed,isField),h01=fieldGroundHeight(x0,z0+step,seed,isField),h11=fieldGroundHeight(x0+step,z0+step,seed,isField);
 return fx+fz<=1?h00*(1-fx-fz)+h10*fx+h01*fz:h11*(fx+fz-1)+h01*(1-fx)+h10*(1-fz);
}
