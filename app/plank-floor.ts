import * as THREE from 'three';

/** World-aligned 250 mm boards, staggered 2 m lengths. Tile cuts are not joints:
 * clipping a board at a scene-cell boundary must retain its height and grain. */
export function plankFloor(x:number,z:number,width:number,depth:number,y:number){
 const pitch=.25,length=2,gap=.002,bevel=.0015,drop=.0025;
 const minX=x-width/2,maxX=x+width/2,minZ=z-depth/2,maxZ=z+depth/2;
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let row=Math.floor(minX/pitch);row<Math.ceil(maxX/pitch);row++){
  const left=row*pitch+gap/2,right=(row+1)*pitch-gap/2;
  const a=Math.max(minX,left),b=Math.min(maxX,right);if(b<=a)continue;
  const phase=((row%3)+3)%3*length/3;
  for(let joint=Math.floor((minZ-phase)/length);joint<Math.ceil((maxZ-phase)/length);joint++){
   const start=joint*length+phase+gap/2,end=start+length-gap;
   const c=Math.max(minZ,start),d=Math.min(maxZ,end);if(d<=c)continue;
   const ia=Math.max(a,left+bevel),ib=Math.min(b,right-bevel),ic=Math.max(c,start+bevel),id=Math.min(d,end-bevel);
   if(ib<=ia||id<=ic)continue;
   const top=[[ia,y,ic],[ia,y,id],[ib,y,id],[ib,y,ic]];
   // Do not lower a clipped end of a continuous board.
   const outer=[[a,c],[a,d],[b,d],[b,c]].map(([px,pz])=>[px,y-((px===left||px===right||pz===start||pz===end)?drop:0),pz]);
   const flip=((row+joint)%2+2)%2===0;
   const hash=Math.sin(row*12.9898+joint*78.233)*43758.5453;
   const crop=.015+.24*(hash-Math.floor(hash));
   const quad=(points:number[][])=>{
    const base=positions.length/3;
    for(const p of points){positions.push(...p);const u=(p[2]-start)/(length-gap);uv.push(crop+.70*(flip?1-u:u),.765+.075*(p[0]-left)/(pitch-gap));}
    indices.push(base,base+1,base+2,base,base+2,base+3);
   };
   quad(top);
   for(let edge=0;edge<4;edge++){
    const next=(edge+1)%4;
    if(top[edge][0]===outer[edge][0]&&top[edge][2]===outer[edge][2]&&top[next][0]===outer[next][0]&&top[next][2]===outer[next][2])continue;
    quad([outer[edge],outer[next],top[next],top[edge]]);
   }
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceUV='authored';return g;
}
