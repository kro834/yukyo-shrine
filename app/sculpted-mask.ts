import * as THREE from 'three';

type Point=[number,number];
type Opening={center:Point;points:Point[];depth:number};
const clamp=THREE.MathUtils.clamp;
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const bell=(x:number,y:number,cx:number,cy:number,sx:number,sy:number)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
const jaw=(y:number)=>1-.19*smooth(.12,.90,-y/.23);
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
let template:THREE.BufferGeometry|undefined;

/** Preserve aperture boundaries while removing long interior triangle fans.
 * Landmark insertion alone makes folded highlights on an otherwise curved face. */
function improveFaceTriangles(points:Point[],triangles:number[][]){
 for(let sweep=0;sweep<48;sweep++){
  const edges=new Map<string,{a:number;b:number;faces:number[]}>();
  triangles.forEach((t,i)=>{for(let j=0;j<3;j++){
   const a=Math.min(t[j],t[(j+1)%3]),b=Math.max(t[j],t[(j+1)%3]),key=a+':'+b;
   const edge=edges.get(key);if(edge)edge.faces.push(i);else edges.set(key,{a,b,faces:[i]});
  }});
  let flips=0;
  for(const edge of edges.values()){
   if(edge.faces.length!==2)continue;
   const [i,j]=edge.faces,one=triangles[i],two=triangles[j];let {a,b}=edge;
   if(!one.includes(a)||!one.includes(b)||!two.includes(a)||!two.includes(b))continue;
   const c=one.find(v=>v!==a&&v!==b)!,d=two.find(v=>v!==a&&v!==b)!;
   if(c===d||cross(points[c],points[d],points[a])*cross(points[c],points[d],points[b])>=-1e-18)continue;
   if(cross(points[a],points[b],points[c])<0)[a,b]=[b,a];
   const ax=points[a][0]-points[d][0],ay=points[a][1]-points[d][1],bx=points[b][0]-points[d][0],by=points[b][1]-points[d][1],cx=points[c][0]-points[d][0],cy=points[c][1]-points[d][1];
   const determinant=(ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx);
   if(determinant<=1e-15)continue;
   const oriented=(x:number,y:number,z:number)=>cross(points[x],points[y],points[z])>0?[x,y,z]:[y,x,z];
   triangles[i]=oriented(c,d,a);triangles[j]=oriented(d,c,b);flips++;
  }
  if(!flips)break;
 }
}

/** A carved front shell with actual apertures and inset, dark cavity linings.
 * Feature topology is shared by every variant so one frontal photographic map
 * fits all masks. UVs represent a 0.4 × 0.6 m image, including its outer margin.
 */
function buildMaskGeometry(){
 const contour:Point[]=Array.from({length:48},(_,i)=>{
  const a=i*Math.PI/24,y=Math.sin(a)*.23;return [Math.cos(a)*.14*jaw(y),y];
 });
 const almond=(cx:number,cy:number,w:number,h:number,count:number,cornerDrop=0):Point[]=>Array.from({length:count},(_,i)=>{
  const a=i*Math.PI*2/count,si=Math.sin(a),co=Math.cos(a);
  return [cx+w*co,cy+h*si*Math.abs(si)-cornerDrop*co*co];
 });
 const openings:Opening[]=[
  // These landmarks match ritual-mask-v60.png in its unwarped frontal projection.
  ...[-.0633,.059].map(x=>({center:[x,.0219] as Point,points:almond(x,.0219,.0305,.0055,20),depth:.024})),
  {center:[0,-.116],points:almond(0,-.116,.0395,.005,16,.0005),depth:.018},
  ...[-1,1].map(side=>({center:[side*.011,-.074] as Point,points:almond(side*.011,-.074,.0045,.0025,8),depth:.013})),
 ];
 const points=[...contour,...openings.flatMap(o=>o.points)];
 let triangles=THREE.ShapeUtils.triangulateShape(contour.map(p=>new THREE.Vector2(...p)),openings.map(o=>o.points.map(p=>new THREE.Vector2(...p))));
 triangles=triangles.map(([a,b,c])=>cross(points[a],points[b],points[c])>0?[a,b,c]:[a,c,b]);
 const pointKeys=new Set(points.map(p=>p.map(v=>Math.round(v*1e8)).join(',')));
 const rimTriangles=contour.length*2+openings.reduce((sum,o)=>sum+o.points.length*4+o.points.length-2,0);
 const addLandmark=(point:Point)=>{
  if(triangles.length+rimTriangles+2>2200)return;
  const key=point.map(v=>Math.round(v*1e8)).join(',');if(pointKeys.has(key))return;
  for(let i=0;i<triangles.length;i++){
   const triangle=triangles[i],a=points[triangle[0]],b=points[triangle[1]],c=points[triangle[2]],area=cross(a,b,c);
   const bary=[cross(b,c,point)/area,cross(c,a,point)/area,cross(a,b,point)/area];
   if(bary.some(v=>v< -1e-8))continue;
   if(bary.some(v=>v>1-1e-8))return;
   const edge=bary.findIndex(v=>Math.abs(v)<1e-8),id=points.length;
   if(edge>=0){
    const ea=triangle[(edge+1)%3],eb=triangle[(edge+2)%3];
    const neighbor=triangles.findIndex((t,j)=>j!==i&&t.includes(ea)&&t.includes(eb));
    // Keep every aperture and outer edge intact; only split shared interior edges.
    if(neighbor<0)return;
    const other=triangles[neighbor],opposite=other.find(v=>v!==ea&&v!==eb)!;
    const split=(a:number,b:number,c:number)=>cross(points[a],points[b],point)>0?[a,b,c]:[b,a,c];
    points.push(point);pointKeys.add(key);
    triangles[i]=split(triangle[edge],ea,id);triangles[neighbor]=split(opposite,eb,id);
    triangles.push(split(eb,triangle[edge],id),split(ea,opposite,id));
   }else{
    points.push(point);pointKeys.add(key);
    triangles[i]=[triangle[0],triangle[1],id];
    triangles.push([triangle[1],triangle[2],id],[triangle[2],triangle[0],id]);
   }
   return;
  }
 };
 // The bridge, tip and columella have real support vertices before the broad
 // face lattice. Extra samples under the nose and around the lips retain relief.
 for(const y of [-.088,-.079,-.070,-.060,-.050,-.029,.005,.030,.065,.080])addLandmark([0,y]);
 for(let iy=0;iy<=28;iy++)for(let ix=-3;ix<=3;ix++)addLandmark([ix*.008,-.090+iy*.006]);
 for(let iy=0;iy<=5;iy++)for(let ix=-7;ix<=7;ix++)addLandmark([ix*.006,-.132+iy*.006]);
 for(let iy=-14;iy<=14;iy++)for(let ix=-9;ix<=9;ix++)addLandmark([ix*.015,iy*.015]);
 improveFaceTriangles(points,triangles);

 const noseProfile=[[-.088,.045,.016],[-.079,.054,.019],[-.070,.071,.023],[-.060,.088,.021],[-.050,.087,.017],[-.029,.081,.012],[.005,.073,.010],[.030,.065,.010],[.065,.052,.014],[.080,.046,.018]];
 const faceHeight=(x:number,y:number)=>{
  const oval=Math.max(0,1-(x/(.14*jaw(y)))**2-(y/.23)**2);
  let z=.004+.049*Math.sqrt(oval);
  z+=.007*(bell(x,y,-.0633,.074,.034,.011)+bell(x,y,.059,.074,.034,.011));
  z+=.005*(bell(x,y,-.070,-.021,.029,.029)+bell(x,y,.070,-.021,.029,.029));
  z-=.004*(bell(x,y,-.0633,.0219,.036,.014)+bell(x,y,.059,.0219,.036,.014));
  const mouthY=-.116-.0005*(x/.0395)**2;
  z+=.0035*bell(x,y,0,mouthY+.008,.041,.004)+.004*bell(x,y,0,mouthY-.009,.039,.005);
  if(y>=noseProfile[0][0]&&y<=noseProfile.at(-1)![0]){
   let i=0;while(i<noseProfile.length-2&&y>noseProfile[i+1][0])i++;
   const a=noseProfile[i],b=noseProfile[i+1],t=smooth(a[0],b[0],y),ridge=a[1]+(b[1]-a[1])*t,width=a[2]+(b[2]-a[2])*t;
   const weight=Math.max(0,1-(Math.abs(x)/width)**2)**1.2;
   z+=Math.max(0,ridge-z)*weight;
  }
  return Math.min(.089,z);
 };
 const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
 const vertex=(x:number,y:number,z:number,shade:number)=>{
  const id=positions.length/3;positions.push(x,y,z);colors.push(shade,shade,shade);uvs.push(x/.4+.5,y/.6+.5);return id;
 };
 for(const [x,y] of points){
  // Photograph owns the facial shading. Only small, neutral edge wear varies.
  const edge=smooth(.74,1,Math.hypot(x/(.14*jaw(y)),y/.23));
  const shade=.985-edge*.015;
  vertex(x,y,faceHeight(x,y),shade);
 }
 for(const t of triangles)indices.push(...t);
 const quad=(a:number[],b:number[],c:number[],d:number[],toward:number[])=>{
  const av=new THREE.Vector3(...a),normal=new THREE.Vector3(...b).sub(av).cross(new THREE.Vector3(...c).sub(av));
  const ordered=normal.dot(new THREE.Vector3(...toward))>=0?[a,b,c,d]:[d,c,b,a];
  const base=positions.length/3;for(const [x,y,z,shade] of ordered)vertex(x,y,z,shade);
  indices.push(base,base+1,base+2,base,base+2,base+3);
 };
 for(let i=0;i<contour.length;i++){
  const a=contour[i],b=contour[(i+1)%contour.length],az=faceHeight(...a),bz=faceHeight(...b);
  quad([...a,az,.89],[...b,bz,.89],[...b,bz-.006,.60],[...a,az-.006,.60],[(a[0]+b[0])*.5,(a[1]+b[1])*.5,0]);
 }
 for(const opening of openings){
  const {points:loop,center}=opening,depth=Math.min(...loop.map(p=>faceHeight(...p)))-opening.depth;
  const inner=loop.map(([x,y])=>[center[0]+(x-center[0])*.90,center[1]+(y-center[1])*.83] as Point);
  for(let i=0;i<loop.length;i++){
   const next=(i+1)%loop.length,a=loop[i],b=loop[next],ia=inner[i],ib=inner[next],az=faceHeight(...a),bz=faceHeight(...b);
   const inward=[center[0]-(a[0]+b[0])*.5,center[1]-(a[1]+b[1])*.5,0];
   // A short bevel shows carved thickness; the deeper wall ends at a dark lining.
   quad([...a,az,.79],[...b,bz,.79],[...ib,bz-.005,.20],[...ia,az-.005,.20],[...inward.slice(0,2),.008]);
   quad([...ia,az-.005,.14],[...ib,bz-.005,.14],[...ib,depth,.024],[...ia,depth,.024],inward);
  }
  const lining=inner.map(p=>vertex(...p,depth,.018));
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(inner.map(p=>new THREE.Vector2(...p)),[])){
   if(cross(inner[a],inner[b],inner[c])>0)indices.push(lining[a],lining[b],lining[c]);else indices.push(lining[a],lining[c],lining[b]);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.surfaceUV='authored';geometry.userData.maskFaceTriangles=triangles.length;
 geometry.userData.maskApertures=openings.map(o=>({center:o.center,front:faceHeight(...o.center),lining:Math.min(...o.points.map(p=>faceHeight(...p)))-o.depth}));
 return geometry;
}

export function sculptedMask(variant=0){
 // Only the CPU template is cached; each actor owns its cloned GPU geometry.
 template??=buildMaskGeometry();
 const geometry=template.clone(),p=geometry.getAttribute('position'),colors=geometry.getAttribute('color');
 for(let i=0;i<p.count;i++)if(colors.getX(i)>.95){
  const shade=colors.getX(i)-.003*(.5+.5*Math.sin(p.getY(i)*61+p.getX(i)*37+variant*.79));
  colors.setXYZ(i,shade,shade,shade);
 }
 return geometry;
}
