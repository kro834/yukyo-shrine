import * as THREE from 'three';

/** Keep curved surfaces continuous and timber grain aligned before batching. */
export function surfaceUV(g:THREE.BufferGeometry,scale:number,grain?:'timber'|'floor'){
 const uv=g.getAttribute('uv');if(!uv)return;
 if(g instanceof THREE.CylinderGeometry){
  const {height,radialSegments,heightSegments,thetaLength}=g.parameters;
  const radiusTop=g instanceof THREE.ConeGeometry?0:g.parameters.radiusTop,radiusBottom=g instanceof THREE.ConeGeometry?g.parameters.radius:g.parameters.radiusBottom;
  const sideVertices=(radialSegments+1)*(heightSegments+1),radius=(radiusTop+radiusBottom)/2;
  for(let i=0;i<uv.count;i++){
   if(i<sideVertices)uv.setXY(i,uv.getX(i)*thetaLength*radius*scale,uv.getY(i)*height*scale);
   else uv.setXY(i,(uv.getX(i)-.5)*2*Math.max(radiusTop,radiusBottom)*scale,(uv.getY(i)-.5)*2*Math.max(radiusTop,radiusBottom)*scale);
  }
  return;
 }
 if(g instanceof THREE.TubeGeometry){
  const {path,radius}=g.parameters,length=path.getLength();
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*length*scale,uv.getY(i)*2*Math.PI*radius*scale);
  return;
 }
 const p=g.getAttribute('position'),n=g.getAttribute('normal');if(!p||!n)return;
 g.computeBoundingBox();const bounds=g.boundingBox!,size=bounds.getSize(new THREE.Vector3()).toArray(),center=bounds.getCenter(new THREE.Vector3()).toArray();
 const axes=[0,1,2].sort((a,b)=>size[b]-size[a]);
 // A broad wall panel has upright boards; a beam's fibres follow its length.
 const along=grain==='timber'&&size[axes[0]]>=2.5*size[axes[1]]?axes[0]:1;
 for(let i=0;i<p.count;i++){
  const normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],point=[p.getX(i),p.getY(i),p.getZ(i)];
  const face=normal[1]>Math.max(normal[0],normal[2])?1:normal[0]>normal[2]?0:2;
  if(grain==='timber'){
   const cross=[0,1,2].find(axis=>axis!==face&&axis!==along)??0;
   const lengthAxis=face===along?[0,1,2].find(axis=>axis!==face&&axis!==cross)!:along;
   uv.setXY(i,.45+(point[cross]-center[cross])*.30,point[lengthAxis]/2.5);
  }else if(grain==='floor'&&face===1)uv.setXY(i,point[2]*scale,point[0]*scale);
  else uv.setXY(i,point[face===0?2:0]*scale,point[face===1?2:1]*scale);
 }
}
