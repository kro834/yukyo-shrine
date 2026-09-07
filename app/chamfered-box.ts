import * as THREE from 'three';
/** Flat timber faces plus twelve bevels: indexed, 44 triangles, merge-compatible. */
export function chamferedBox(w:number,h:number,d:number,r=Math.min(w,h,d)*.08){
 const half=[w/2,h/2,d/2],inner=half.map(v=>v-Math.min(r,...half)*.99);
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[];
 const polygon=(points:number[][],normal:number[])=>{
  const n=new THREE.Vector3(...normal).normalize(),a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points[1]),c=new THREE.Vector3(...points[2]);
  if(b.sub(a).cross(c.sub(a)).dot(n)<0)points.reverse();
  const base=positions.length/3;
  for(const p of points){positions.push(...p);normals.push(n.x,n.y,n.z);uv.push(0,0);}
  for(let i=1;i<points.length-1;i++)indices.push(base,base+i,base+i+1);
 };
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const cross=[0,1,2].filter(i=>i!==axis),normal=[0,0,0];normal[axis]=sign;
  polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(s=>{const p=[0,0,0];p[axis]=sign*half[axis];cross.forEach((a,i)=>p[a]=s[i]*inner[a]);return p;}),normal);
 }
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
  const c=3-a-b,normal=[0,0,0];normal[a]=sa;normal[b]=sb;
  polygon([[-1,0],[1,0],[1,1],[-1,1]].map(([end,edge])=>{const p=[0,0,0];p[c]=end*inner[c];p[a]=sa*(edge?inner[a]:half[a]);p[b]=sb*(edge?half[b]:inner[b]);return p;}),normal);
 }
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
  const signs=[sx,sy,sz];polygon([0,1,2].map(axis=>inner.map((v,i)=>signs[i]*(i===axis?half[i]:v))),signs);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
