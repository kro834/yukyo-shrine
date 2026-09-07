import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Shallow individual boards backed by the existing wall, inside its old facing.
 * Five front-facing quads per board; hidden backs need no geometry or draw call. */
export function wainscot(width:number,height:number,depth:number,variation=0){
 const count=Math.max(1,Math.round(width/.32)),pitch=width/count,gap=.003,bevel=.0025;
 const boards:THREE.BufferGeometry[]=[];
 for(let i=0;i<count;i++){
  const left=-width/2+i*pitch+gap/2,right=left+pitch-gap,bottom=-height/2,top=height/2;
  const rear=depth/2-bevel,front=depth/2;
  const corners=[[left,bottom,rear],[right,bottom,rear],[right,top,rear],[left,top,rear]];
  const inner=[[left+bevel,bottom+bevel,front],[right-bevel,bottom+bevel,front],[right-bevel,top-bevel,front],[left+bevel,top-bevel,front]];
  const positions:number[]=[],uv:number[]=[];
  const phase=(Math.sin((i+variation*13)*12.9898)*43758.5453)%1;
  const start=.06+Math.abs(phase)*.24,length=.55;
  const quad=(points:number[][])=>{for(const index of [0,1,2,0,2,3]){const p=points[index];positions.push(...p);
   // The photographed timber fibres run along U. Each board gets its own crop.
   uv.push(start+(p[1]/height+.5)*length,.765+(p[0]-left)/(pitch-gap)*.075);
  }};
  quad(inner);
  for(let e=0;e<4;e++){const n=(e+1)%4;quad([corners[e],corners[n],inner[n],inner[e]]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  // The static scene batch accepts indexed geometry throughout.
  g.setIndex(Array.from({length:positions.length/3},(_,index)=>index));boards.push(g);
 }
 const geometry=mergeGeometries(boards)!;boards.forEach(g=>g.dispose());geometry.userData.surfaceUV='authored';return geometry;
}
