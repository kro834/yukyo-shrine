import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared recessed panels and dished pulls fit the collision and slide envelope. */
export const SLIDING_LEAF_ENVELOPE={minX:-1.505,maxX:1.505,minY:.015,maxY:2.965,minZ:-.074,maxZ:.074,travel:3.02} as const;
type P=[number,number,number];
type Rect={x1:number;x2:number;y1:number;y2:number};

function builder(){
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
 const polygon=(points:P[],expected:P,uv:(p:P)=>[number,number],color:(p:P)=>number=()=>1)=>{
  let p=[...points];const a=new THREE.Vector3(...p[0]),b=new THREE.Vector3(...p[1]),c=new THREE.Vector3(...p[2]);
  const normal=b.sub(a).cross(c.sub(a)).normalize();
  if(normal.dot(new THREE.Vector3(...expected))<0){p.reverse();normal.negate();}
  const start=positions.length/3;
  for(const v of p){positions.push(...v);normals.push(normal.x,normal.y,normal.z);uvs.push(...uv(v));const f=color(v);colors.push(f,f,f);}
  for(let i=1;i<p.length-1;i++)indices.push(start,start+i,start+i+1);
 };
 const finish=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.userData.surfaceUV='authored';g.computeBoundingBox();g.computeBoundingSphere();return g;};
 return {polygon,finish};
}

// Six broad faces, twelve narrow bevels, eight clipped corners: actual 2mm
// highlights rather than painted outlines. Each board authors its own grain.
function timberBox(x:number,y:number,z:number,w:number,h:number,d:number,tone=1){
 const b=builder(),half=[w/2,h/2,d/2],bevel=Math.min(.0025,w*.12,h*.12,d*.12),inner=half.map(v=>v-bevel);
 const along=w>h*2?0:1,cross=along===0?1:0,origin=[x,y,z],span=[w,h,d];
 const uv=(p:P):[number,number]=>[.055+(p[along]-origin[along]+span[along]/2)/span[along]*.89,.805+(p[cross]-origin[cross])*Math.min(1/1.5,.085/span[cross])];
 const emit=(points:number[][],normal:number[])=>b.polygon(points.map(p=>p.map((v,i)=>v+origin[i]) as P),normal as P,uv,()=>tone);
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const crossAxes=[0,1,2].filter(i=>i!==axis),normal=[0,0,0];normal[axis]=sign;
  emit([[-1,-1],[1,-1],[1,1],[-1,1]].map(s=>{const p=[0,0,0];p[axis]=sign*half[axis];crossAxes.forEach((a,i)=>p[a]=s[i]*inner[a]);return p;}),normal);
 }
 for(let a=0;a<3;a++)for(let bb=a+1;bb<3;bb++)for(const sa of [-1,1])for(const sb of [-1,1]){
  const c=3-a-bb,normal=[0,0,0];normal[a]=sa;normal[bb]=sb;
  emit([[-1,0],[1,0],[1,1],[-1,1]].map(([end,edge])=>{const p=[0,0,0];p[c]=end*inner[c];p[a]=sa*(edge?inner[a]:half[a]);p[bb]=sb*(edge?half[bb]:inner[bb]);return p;}),normal);
 }
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz];emit([0,1,2].map(axis=>inner.map((v,i)=>signs[i]*(i===axis?half[i]:v))),signs);}
 return b.finish();
}

// Repeated rectangular profiles join with real mitered corners. The inner edge
// meets the inset panel, so flashlight grazing angles reveal a continuous recess.
function moulding(rect:Rect,side:number,gothic:boolean){
 const b=builder(),profile=gothic?[[0,.055],[.008,.065],[.029,.058],[.052,.031]]:[[0,.054],[.007,.063],[.023,.05],[.036,.030]];
 const corners=(inset:number,z:number):P[]=>[[rect.x1+inset,rect.y1+inset,side*z],[rect.x2-inset,rect.y1+inset,side*z],[rect.x2-inset,rect.y2-inset,side*z],[rect.x1+inset,rect.y2-inset,side*z]];
 for(let j=0;j<profile.length-1;j++){
  const a=corners(...profile[j] as [number,number]),c=corners(...profile[j+1] as [number,number]);
  for(let edge=0;edge<4;edge++){
   const next=(edge+1)%4,horizontal=edge%2===0;
   b.polygon([a[edge],a[next],c[next],c[edge]],[0,0,side],p=>horizontal?[.055+(p[0]-rect.x1)/(rect.x2-rect.x1)*.89,.805+(p[1]-(edge===0?rect.y1:rect.y2))*.4]:[.055+(p[1]-rect.y1)/(rect.y2-rect.y1)*.89,.805+(p[0]-(edge===1?rect.x2:rect.x1))*.4],()=>j===0?.88:j===1?1:.79);
  }
 }
 return b.finish();
}

function paperPane(rect:Rect,side:number,phase:number){
 const b=builder(),nx=8,ny=12;
 const at=(i:number,j:number):P=>{const u=i/nx,v=j/ny;
  // Gently bowed paper is pinned along the frame. No loose torn edges
  // or holes that would disagree with the leaf's opaque collision volume.
  const warp=Math.sin(Math.PI*u)*Math.sin(Math.PI*v)*Math.sin(u*8+v*5+phase)*.0022;
  return [rect.x1+(rect.x2-rect.x1)*u,rect.y1+(rect.y2-rect.y1)*v,side*(.030+warp)];
 };
 const tone=(p:P)=>{const u=(p[0]-rect.x1)/(rect.x2-rect.x1),v=(p[1]-rect.y1)/(rect.y2-rect.y1),edge=Math.min(u,1-u,v,1-v);return .96-.07*Math.exp(-edge*22)-.045*Math.exp(-v*10)+.018*Math.sin(u*5+phase)*Math.sin(v*7);};
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)b.polygon([at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],[0,0,side],p=>[p[0]/1.7,p[1]/2.5],tone);
 return b.finish();
}

function oakPane(rect:Rect,side:number,phase:number){
 const b=builder(),count=3,w=(rect.x2-rect.x1)/count;
 for(let board=0;board<count;board++){
  const left=rect.x1+board*w+(board? .001:0),right=rect.x1+(board+1)*w-(board<count-1?.001:0),z=side*.031;
  b.polygon([[left,rect.y1,z],[right,rect.y1,z],[right,rect.y2,z],[left,rect.y2,z]],[0,0,side],p=>[.055+(p[1]-rect.y1)/(rect.y2-rect.y1)*.89,.782+(p[0]-(left+right)/2)*Math.min(.085/w,.65)],p=>.9+.055*Math.sin(board*2.1+phase)-.035*Math.exp(-(p[1]-rect.y1)*14));
 }
 return b.finish();
}

function recessedPull(gothic:boolean){
 const b=builder(),segments=24;
 // A turned lip, dark bowl and recessed base replace the solid painted disc.
 const profile=[[.073,.032,.6],[.074,.057,.79],[.065,.072,.94],[.053,.045,.43],[0,.034,.16]];
 for(const side of [-1,1])for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
  const [ra,za,ca]=profile[j],[rb,zb,cb]=profile[j+1],aa=i/segments*Math.PI*2,ab=(i+1)/segments*Math.PI*2;
  const point=(r:number,a:number,z:number):P=>[1.05+Math.cos(a)*r,1.3+Math.sin(a)*r*(gothic?1.4:1),side*z];
  const points=rb===0?[point(ra,aa,za),point(ra,ab,za),point(0,0,zb)]:[point(ra,aa,za),point(ra,ab,za),point(rb,ab,zb),point(rb,aa,zb)];
  b.polygon(points,[0,0,side],p=>[(p[0]-1.05)/.15,(p[1]-1.3)/.21],p=>Math.abs(p[2]-side*za)<1e-7?ca:cb);
 }
 return b.finish();
}

/** Three shared meshes exactly replace the original paper/leafWood/pull set. */
export function slidingDoorLeaf(gothic=false){
 const wood:THREE.BufferGeometry[]=[],panels:THREE.BufferGeometry[]=[];
 // Continuous opaque backer seals board joints and survives every sliding state.
 wood.push(timberBox(0,1.49,0,2.91,2.85,.04,.77));
 const stileWidth=gothic?.155:.11,stileX=1.505-stileWidth/2;
 for(const x of [-stileX,stileX])wood.push(timberBox(x,1.49,0,stileWidth,2.95,.13,.94));
 wood.push(timberBox(0,1.49,0,gothic?.13:.07,2.85,.125,.9));
 const rails=gothic?[[.065,.10],[1.015,.12],[1.935,.12],[2.915,.10]]:[[.065,.10],[.555,.10],[2.915,.10]];
 for(const [y,h] of rails)wood.push(timberBox(0,y,0,3.01-stileWidth*2,h,.13,.94));
 const inner=1.505-stileWidth,center=gothic?.065:.035;
 const rows=gothic?[[.12,.95],[1.08,1.87],[2.0,2.855]]:[[.61,2.855]];
 for(const sign of [-1,1])for(let row=0;row<rows.length;row++){
  const rect:Rect={x1:sign<0?-inner:center,x2:sign<0?-center:inner,y1:rows[row][0],y2:rows[row][1]};
  for(const side of [-1,1]){
   wood.push(moulding(rect,side,gothic));const inset=gothic?.052:.036;
   const inside={x1:rect.x1+inset,x2:rect.x2-inset,y1:rect.y1+inset,y2:rect.y2-inset};
   panels.push(gothic?oakPane(inside,side,row+sign*1.3):paperPane(inside,side,sign*1.4));
  }
 }
 if(!gothic){
  // Lower kickboards are independent upright boards, framed on both faces.
  for(const sign of [-1,1]){
   const rect={x1:sign<0?-inner:center,x2:sign<0?-center:inner,y1:.12,y2:.50};
   for(const side of [-1,1]){wood.push(moulding(rect,side,true));wood.push(oakPane({x1:rect.x1+.052,x2:rect.x2-.052,y1:.172,y2:.448},side,sign));}
  }
 }
 const merge=(parts:THREE.BufferGeometry[])=>{const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());g.userData.surfaceUV='authored';g.computeBoundingBox();g.computeBoundingSphere();return g;};
 return {paperGeometry:merge(panels),leafWoodGeometry:merge(wood),pullGeometry:recessedPull(gothic)};
}
