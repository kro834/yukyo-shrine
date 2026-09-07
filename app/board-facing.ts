import * as THREE from 'three';

/** Upright timber facing, centred on the former panel with its visible face at +Z.
 * The existing wall closes the hidden back and the narrow board joints. All
 * positions remain inside width × height × depth; this adds no collision shape.
 */
export function boardFacing(width=3.7,height=2.15,depth=.055,variation=0){
 const count=Math.max(1,Math.round(width/.23)),pitch=width/count;
 const gap=Math.min(.0025,pitch*.04),bevel=Math.min(.0015,pitch*.02,height*.02,depth*.1);
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
 const phase=(n:number)=>{const v=Math.sin(n*12.9898+variation*17.713)*43758.5453;return v-Math.floor(v);};
 for(let board=0;board<count;board++){
  // Leave no half-joint along the outside perimeter beneath the existing frame.
  const left=-width/2+board*pitch+(board?gap/2:0);
  const right=-width/2+(board+1)*pitch-(board<count-1?gap/2:0);
  const bottom=-height/2,top=height/2;
  const front=depth/2-(board?phase(board+13)*Math.min(.00045,depth*.02):0);
  const edgeZ=front-bevel,rearZ=-depth/2;
  const edge=[[left,bottom,edgeZ],[right,bottom,edgeZ],[right,top,edgeZ],[left,top,edgeZ]];
  const face=[[left+bevel,bottom+bevel,front],[right-bevel,bottom+bevel,front],[right-bevel,top-bevel,front],[left+bevel,top-bevel,front]];
  const rear=edge.map(([x,y])=>[x,y,rearZ]);
  const start=.045+phase(board+1)*.225,length=.635+phase(board+3)*.04;
  const crossStart=.768+phase(board+5)*.01,crossWidth=.063+phase(board+7)*.006;
  const quad=(points:number[][])=>{
   const base=positions.length/3,a=new THREE.Vector3(...points[0]);
   const n=new THREE.Vector3(...points[1]).sub(a).cross(new THREE.Vector3(...points[2]).sub(a)).normalize();
   for(const [x,y,z] of points){
    positions.push(x,y,z);normals.push(n.x,n.y,n.z);
    // Photo fibres run along U. Each physical board receives a different crop
    // at approximately the same metre scale, clear of photographed end seams.
    uvs.push(start+(y/height+.5)*length,crossStart+(x-left)/(right-left)*crossWidth);
   }
   indices.push(base,base+1,base+2,base,base+2,base+3);
  };
  quad(face);
  for(let e=0;e<4;e++){
   const next=(e+1)%4;
   quad([edge[e],edge[next],face[next],face[e]]);
   quad([rear[e],rear[next],edge[next],edge[e]]);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.surfaceUV='authored';geometry.userData.boardCount=count;
 return geometry;
}
