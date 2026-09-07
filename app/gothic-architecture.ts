import * as THREE from 'three';

export type GothicMaterial='stone'|'dark'|'gold'|'red'|'black';
export type GothicWall={x:number;z:number;h:number;alongX:boolean;insideX:number;insideZ:number;twoSided?:boolean};
export type GothicAdd=(g:THREE.BufferGeometry,material:GothicMaterial)=>void;
export type GothicBox=(x:number,y:number,z:number,w:number,h:number,d:number,material:GothicMaterial)=>void;
type P=[number,number];

// Two circular arcs, not a bent semicircle or a triangular lintel. Shallow
// arches move the circle centres down so the whole curve remains monotonic.
function pointed(a:number,spring:number,crown:number,steps:number):P[]{
 const rise=crown-spring,cx=Math.max(a*.55,(rise*rise-a*a)/(2*a));
 const cy=Math.min(0,(rise*rise-a*a-2*a*cx)/(2*rise)),radius=Math.hypot(a+cx,cy);
 const start=Math.atan2(Math.max(0,-cy),-a-cx),end=Math.atan2(rise-cy,-cx),left:P[]=[];
 for(let i=0;i<=steps;i++){const t=start+(end-start)*i/steps;left.push([cx+Math.cos(t)*radius,spring+cy+Math.sin(t)*radius]);}
 left[0]=[-a,spring];left[steps]=[0,crown];
 return [...left,...left.slice(0,-1).reverse().map(([x,y]):P=>[-x,y])];
}

// Rectangular stone moulding with shared mitered joints. Each quad has its own
// vertices so the small rib keeps crisp edges; author UVs in metres per face.
function rib(path:P[],halfWidth:number,halfDepth:number,closed=false){
 const n=path.length,frames:P[]=[],arc=[0];
 for(let i=0;i<n;i++){
  const p=path[i],before=path[i===0?(closed?n-1:0):i-1],after=path[i===n-1?(closed?0:n-1):i+1];
  const a=new THREE.Vector2(p[0]-before[0],p[1]-before[1]),b=new THREE.Vector2(after[0]-p[0],after[1]-p[1]);
  if(a.lengthSq()===0)a.copy(b);if(b.lengthSq()===0)b.copy(a);a.normalize();b.normalize();
  const na=new THREE.Vector2(-a.y,a.x),nb=new THREE.Vector2(-b.y,b.x),m=na.clone().add(nb).normalize();
  const scale=Math.min(2,1/Math.max(.01,m.dot(na)))*halfWidth;frames.push([m.x*scale,m.y*scale]);
  if(i)arc.push(arc[i-1]+Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1]));
 }
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const corners=(i:number)=>{const [x,y]=path[i],[nx,ny]=frames[i];return [[x+nx,y+ny,-halfDepth],[x-nx,y-ny,-halfDepth],[x-nx,y-ny,halfDepth],[x+nx,y+ny,halfDepth]];};
 const quad=(a:number[],b:number[],c:number[],d:number[],length:number,width:number)=>{
  const offset=positions.length/3;positions.push(...a,...b,...c,...d);uv.push(0,0,width/2.7,0,width/2.7,length/2.7,0,length/2.7);indices.push(offset,offset+2,offset+1,offset,offset+3,offset+2);
 };
 for(let i=0;i<(closed?n:n-1);i++){
  const next=(i+1)%n,a=corners(i),b=corners(next),length=Math.hypot(path[next][0]-path[i][0],path[next][1]-path[i][1]);
  for(let face=0;face<4;face++){const j=(face+1)%4;quad(a[face],a[j],b[j],b[face],length,face%2?halfDepth*2:halfWidth*2);}
 }
 if(!closed){const a=corners(0),b=corners(n-1);quad(a[3],a[2],a[1],a[0],halfDepth*2,halfWidth*2);quad(b[0],b[1],b[2],b[3],halfDepth*2,halfWidth*2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceUV='authored';return g;
}

function place(g:THREE.BufferGeometry,x:number,z:number,alongX:boolean,nx:number,nz:number,depth=0){
 const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(alongX?1:0,0,alongX?0:1),new THREE.Vector3(0,1,0),new THREE.Vector3(nx,0,nz));
 matrix.setPosition(x+nx*depth,0,z+nz*depth);g.applyMatrix4(matrix);
 if(matrix.determinant()<0){const index=g.index!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** Across a passage: every vertex stays above 2.8m and below top-.12m.
 * width is the full available span; no posts or collision objects are added.
 * alongX=true spans world X, otherwise world Z. 132 triangles per arch.
 */
export function gothicArch(x:number,z:number,alongX:boolean,width:number,top:number,add:GothicAdd){
 if(width<.6||top<3.25)return;
 const g=rib(pointed(width/2-.055,2.86,top-.2,8),.035,.055);
 add(place(g,x,z,alongX,alongX?0:1,alongX?1:0),'stone');
}

/** Decorates one existing 4m solid wall segment; the root supplies its backing.
 * All decoration lies at inward depth <=.18m. No transparent opening, light,
 * text, collision change, or resource allocation beyond indexed geometries.
 * Supply h=min(w.h,4.5) where the root applies the existing upper-deck cap.
 */
export function buildGothicWall(w:GothicWall,add:GothicAdd,box:GothicBox){
 if(w.h<3.25)return;
 const {x,z,alongX,insideX:nx,insideZ:nz}=w;
 const local=(t:number,y:number,d:number,width:number,h:number,depth:number,m:GothicMaterial)=>box(x+(alongX?t:0)+nx*d,y,z+(alongX?0:t)+nz*d,alongX?width:depth,h,alongX?depth:width,m);
 const archTop=w.h-.25,spring=Math.max(2.86,archTop-1.65),crown=archTop-.2;
 if(crown<=spring+.05)return;
 const a=1.04,bottom=1.08,path=pointed(a,spring,crown,4);
 // A black blind panel is visibly behind the stone moulding, backed by the
 // root's actual wall. It is opaque and cannot become an escape route.
 const outline:P[]=[[-a,bottom],...path,[a,bottom]],positions=[0,(bottom+spring)/2,0],uv=[0,(bottom+spring)/5.4],indices:number[]=[];
 for(const [t,y] of outline){positions.push(t,y,0);uv.push(t/2.7,y/2.7);}
 for(let i=0;i<outline.length;i++)indices.push(0,1+(i+1)%outline.length,1+i);
 const panel=new THREE.BufferGeometry();panel.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));panel.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));panel.setIndex(indices);panel.computeVertexNormals();panel.userData.surfaceUV='authored';
 add(place(panel,x,z,alongX,nx,nz,.153),'black');
 add(place(rib(path,.038,.012),x,z,alongX,nx,nz,.165),'stone');
 for(const side of [-1,1]){
  // Narrow pilasters and capitals: existing wall thickness already supports them.
  local(side*1.83,(w.h-.18)/2,.155,.15,w.h-.18,.045,'stone');
  local(side*1.83,w.h-.24,.157,.27,.13,.04,'dark');
  local(side*a,(bottom+spring)/2,.16,.076,spring-bottom,.034,'stone');
 }
 local(0,bottom-.045,.15,2.27,.09,.06,'dark');
 const fork=spring-.28;
 local(0,(bottom+fork)/2,.166,.035,fork-bottom,.018,'stone');
 // The fork and small quatrefoil-like lozenge read as tracery without pipes.
 for(const side of [-1,1])add(place(rib([[0,fork],[side*.44,spring+.22]],.018,.009),x,z,alongX,nx,nz,.168),'stone');
 const cy=spring+(crown-spring)*.61,ry=Math.min(.26,(crown-spring)*.22);
 add(place(rib([[0,cy-ry],[.21,cy],[0,cy+ry],[-.21,cy]],.013,.009,true),x,z,alongX,nx,nz,.168),'dark');
}
