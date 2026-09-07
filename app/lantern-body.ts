import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared-batch proposal: 3 indexed geometries, no materials or scene objects.
 * shade -> a shared shaded emissive washi material with castShadow=false;
 * caps -> dark; ribs -> wood. Preserve authored UVs in the world add() adapter.
 * Translate the returned geometries to the existing fixture centre before add().
 */
export function lanternBody(large=false){
 const r=large?.42:.22,h=large?.95:.6,segments=24;
 const profile=[[-.5,.82],[-.4,.94],[-.2,1.015],[0,1.035],[.2,1.015],[.4,.94],[.5,.82]];
 const radius=(y:number)=>{
  const t=Math.max(-.5,Math.min(.5,y/h));
  for(let i=0;i<profile.length-1;i++)if(t<=profile[i+1][0]){
   const [a,ra]=profile[i],[b,rb]=profile[i+1];return r*(ra+(rb-ra)*(t-a)/(b-a));
  }
  return r*.82;
 };
 const lathe=(points:THREE.Vector2[],metres:number)=>{
  const g=new THREE.LatheGeometry(points,segments),uv=g.getAttribute('uv');
  let arc=0;for(let i=1;i<points.length;i++)arc+=points[i].distanceTo(points[i-1]);
  const maxRadius=Math.max(...points.map(p=>p.x));
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.PI*2*maxRadius/metres,uv.getY(i)*arc/metres);
  // Lathe centre poles produce redundant zero-area triangles. Drop those,
  // retaining indexed positions/normals/UVs for the existing merge pipeline.
  const p=g.getAttribute('position'),indices:number[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<g.index!.count;i+=3){const ia=g.index!.getX(i),ib=g.index!.getX(i+1),ic=g.index!.getX(i+2);
   a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
   if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)indices.push(ia,ib,ic);
  }
  g.setIndex(indices);g.normalizeNormals();g.userData.surfaceUV='authored';return g;
 };
 const shade=lathe(profile.map(([y,rad])=>new THREE.Vector2(rad*r,y*h)),.3);
 const capRadius=r*.88,capHeight=large?.065:.045;
 const cap=(y:number)=>lathe([
  new THREE.Vector2(0,y-capHeight/2),
  new THREE.Vector2(capRadius*.94,y-capHeight/2),
  new THREE.Vector2(capRadius,y-capHeight*.28),
  new THREE.Vector2(capRadius,y+capHeight*.28),
  new THREE.Vector2(capRadius*.94,y+capHeight/2),
  new THREE.Vector2(0,y+capHeight/2),
 ],2.6);
 const capParts=[cap(-h/2),cap(h/2)];
 const caps=mergeGeometries(capParts)!;capParts.forEach(g=>g.dispose());caps.userData.surfaceUV='authored';
 const parts:THREE.BufferGeometry[]=[];
 // Narrow bamboo tape follows the bowed shade rather than floating at one radius.
 for(let rib=0;rib<6;rib++){
  const angle=rib*Math.PI/3,halfAngle=.0045/r,p:number[]=[],n:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let j=0;j<profile.length;j++)for(const side of [-1,1]){
   const y=profile[j][0]*h,rad=radius(y)+.0025,a=angle+side*halfAngle;
   p.push(Math.sin(a)*rad,y,Math.cos(a)*rad);n.push(Math.sin(a),0,Math.cos(a));uv.push((side+1)*.015,(y+h/2)/.3);
  }
  for(let j=0;j<profile.length-1;j++){const a=j*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();parts.push(g);
 }
 // Three thin circular bindings, not thick cage hoops. Radius follows the shade.
 for(const f of [-.27,0,.27]){
  const y=f*h,width=.009;
  parts.push(lathe([new THREE.Vector2(radius(y-width/2)+.004,y-width/2),new THREE.Vector2(radius(y+width/2)+.004,y+width/2)],.3));
 }
 const ribs=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());ribs.userData.surfaceUV='authored';
 for(const g of [shade,caps,ribs]){g.computeBoundingBox();g.computeBoundingSphere();}
 return {shade,caps,ribs,top:h/2+capHeight/2,bottom:-h/2-capHeight/2};
}
