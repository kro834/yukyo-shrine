import * as THREE from 'three';

type Identity='levee'|'riverside'|'underpass'|'greenway'|'floodgate'|'paddy';
type Cell={x:number;z:number;kind:string};
type Region={sectorId:string;identity:Identity;cx:number;cz:number;rotation:number;removed:readonly Cell[]};
type Material='bank'|'concrete'|'water';
type Options={
 belowUpperDeck?:(minX:number,maxX:number,minZ:number,maxZ:number)=>boolean;
 /** 4 is recommended. 6 is accepted only if the full mesh remains below the cap. */
 subdivisions?:4|6;
 baseHeight?:number;
 triangleLimit?:number;
};
export const LANDFORM_DEPTH:Record<Identity,number>={levee:1.8,riverside:1.4,underpass:1.25,greenway:.65,floodgate:2.2,paddy:.8};
const WATER=new Set<Identity>(['levee','riverside','floodgate','paddy']);
const CELL=4,SLOPE=4.8,EPS=.025;
const key=(x:number,z:number)=>x+','+z;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
const boxDistance=(x:number,z:number,cx:number,cz:number,half:number)=>Math.hypot(Math.max(0,Math.abs(x-cx)-half),Math.max(0,Math.abs(z-cz)-half));

/** Physical landforms outside the y=0 walking grid. Grid/region units are cells;
 * public sample coordinates and geometry are WORLD METRES. Does not mutate layout.
 */
export function createOuterLandformSurfaces(grid:Map<string,Cell>,regions:readonly Region[],options:Options={}){
 const base=options.baseHeight??-2.6,limit=options.triangleLimit??80000;
 const tiles=new Map<string,{x:number;z:number;region:Region;removed:boolean}>();
 const regionAt=(x:number,z:number)=>{
  let best:Region|undefined,score=Infinity;
  for(const r of regions){const d=boxDistance(x,z,r.cx*4,r.cz*4,34);const s=d+Math.hypot(x-r.cx*4,z-r.cz*4)*1e-7;if(s<score){score=s;best=r;}}
  return best;
 };
 const excluded=(x:number,z:number)=>grid.has(key(x,z))||!!options.belowUpperDeck?.(x*4-2,x*4+2,z*4-2,z*4+2);
 const addTile=(x:number,z:number,removed=false)=>{
  if(excluded(x,z))return;
  const k=key(x,z),old=tiles.get(k);if(old){old.removed ||= removed;return;}
  const region=regionAt(x*4,z*4);if(region)tiles.set(k,{x,z,region,removed});
 };
 for(const r of regions)for(const c of r.removed)addTile(c.x,c.z,true);
 // Exactly two cells of exterior halo. This includes internal path edges; the map
 // removes duplicate tiles and leaves occupied paths and protected decks untouched.
 for(const c of grid.values())if(c.kind==='field')for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)addTile(c.x+dx,c.z+dz);

 // Blend depth only across the 8 m gap between neighbouring region footprints.
 // Within a sector each identity retains its authored depth. This sample is world
 // continuous even if two different identities share a terrain tile edge.
 const profileAt=(x:number,z:number)=>{
  if(!regions.length)return {depth:0,organic:0};
  const distances=regions.map(r=>boxDistance(x,z,r.cx*4,r.cz*4,34)),near=Math.min(...distances);
  let total=0,weight=0,organic=0;
  for(let i=0;i<regions.length;i++){const w=1-smooth((distances[i]-near)/8);total+=LANDFORM_DEPTH[regions[i].identity]*w;weight+=w;if(!['underpass','floodgate'].includes(regions[i].identity))organic+=w;}
  return {depth:total/weight,organic:organic/weight};
 };
 const distanceToWalk=(x:number,z:number)=>{
  const cx=Math.round(x/4),cz=Math.round(z/4);let d=SLOPE;
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(grid.has(key(cx+dx,cz+dz)))d=Math.min(d,boxDistance(x,z,(cx+dx)*4,(cz+dz)*4,2));
  return d;
 };
 const analyticalHeight=(x:number,z:number)=>{
  const d=distanceToWalk(x,z),profile=profileAt(x,z);
  // Broad erosion undulations, sampled continuously across tile/sector seams.
  // Fade to zero at the path edge and basin floor; concrete channels stay planar.
  const noise=Math.sin(x*.83+Math.sin(z*.31)*1.7)*Math.sin(z*.69+x*.19)*.12+Math.sin(x*.37-z*.47)*.055;
  const relief=noise*profile.organic*smooth(d/1.3)*(1-smooth((d-3.4)/1.4));
  return Math.min(0,-profile.depth*clamp(d/SLOPE)+relief);
 };
 const normalAt=(x:number,z:number)=>{
  const dx=(analyticalHeight(x+EPS,z)-analyticalHeight(x-EPS,z))/(2*EPS),dz=(analyticalHeight(x,z+EPS)-analyticalHeight(x,z-EPS))/(2*EPS);
  return new THREE.Vector3(-dx,1,-dz).normalize();
 };
 const boundaryCount=[...tiles.values()].reduce((n,t)=>n+[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>!tiles.has(key(t.x+dx,t.z+dz))&&!grid.has(key(t.x+dx,t.z+dz))).length,0);
 const waterCount=[...tiles.values()].filter(t=>WATER.has(t.region.identity)).length;
 // Every terrain tile is retained. Prefer 4 subdivisions if 6 would exceed budget.
 let segments=options.subdivisions??4;
 const estimate=(s:number)=>tiles.size*s*s*2+boundaryCount*s*2+waterCount*2;
 if(segments===6&&estimate(6)>limit)segments=4;
 if(estimate(segments)>limit)throw new Error(`Outer terrain budget exceeded: ${estimate(segments)} triangles for ${tiles.size} tiles`);
 const step=4/segments;
 const surfaces:{x:number;z:number;geometry:THREE.BufferGeometry;material:Material;regionId:string;identity:Identity;water:boolean}[]=[];
 const tilemetadata:{x:number;z:number;regionId:string;identity:Identity;removed:boolean;minY:number;maxY:number;waterY:number|null;segments:number;triangles:number}[]=[];
 const renderedPositions=new Map<string,THREE.BufferAttribute>();
 let triangleCount=0;
 for(const t of tiles.values()){
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  const x0=t.x*4-2,z0=t.z*4-2;
  let minY=Infinity,maxY=-Infinity;
  for(let iz=0;iz<=segments;iz++)for(let ix=0;ix<=segments;ix++){
   const x=x0+ix*step,z=z0+iz*step,y=analyticalHeight(x,z),n=normalAt(x,z);
   positions.push(x,y,z);normals.push(n.x,n.y,n.z);uvs.push(x/3,z/3);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  for(let iz=0;iz<segments;iz++)for(let ix=0;ix<segments;ix++){
   const a=iz*(segments+1)+ix,b=a+1,c=a+segments+1,d=c+1;
   indices.push(a,c,b,b,c,d);
  }
  // An outer skirt closes the visible mesh down to the global base. It uses its own
  // vertices/normals so hard perimeter faces cannot corrupt shared bank normals.
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   if(tiles.has(key(t.x+dx,t.z+dz))||grid.has(key(t.x+dx,t.z+dz)))continue;
   for(let i=0;i<segments;i++){
    let ax=x0+(dx>0?4:0),az=z0+(dz>0?4:0),bx=ax,bz=az;
    if(dx){az=z0+i*step;bz=az+step;}else{ax=x0+i*step;bx=ax+step;}
    const ay=analyticalHeight(ax,az),by=analyticalHeight(bx,bz),start=positions.length/3;
    positions.push(ax,ay,az,bx,by,bz,ax,base,az,bx,base,bz);
    for(let j=0;j<4;j++){normals.push(dx,0,dz);uvs.push(j%2*step/3,j<2?0:Math.abs(base-ay)/3);}
    if(dx>0||dz<0)indices.push(start,start+1,start+2,start+1,start+3,start+2);
    else indices.push(start,start+2,start+1,start+1,start+2,start+3);
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  renderedPositions.set(key(t.x,t.z),geometry.getAttribute('position') as THREE.BufferAttribute);
  const material=t.region.identity==='underpass'||t.region.identity==='floodgate'?'concrete':'bank';
  surfaces.push({x:t.x,z:t.z,geometry,material,regionId:t.region.sectorId,identity:t.region.identity,water:false});
  const waterY=WATER.has(t.region.identity)?-LANDFORM_DEPTH[t.region.identity]+.12:null;
  if(waterY!==null){
   const water=new THREE.PlaneGeometry(4,4);water.rotateX(-Math.PI/2);water.translate(t.x*4,waterY,t.z*4);
   surfaces.push({x:t.x,z:t.z,geometry:water,material:'water',regionId:t.region.sectorId,identity:t.region.identity,water:true});
  }
  const triangles=indices.length/3+(waterY===null?0:2);triangleCount+=triangles;
  tilemetadata.push({x:t.x,z:t.z,regionId:t.region.sectorId,identity:t.region.identity,removed:t.removed,minY,maxY,waterY,segments,triangles});
 }
 /** Exact barycentric interpolation on the rendered terrain triangles (including
  * float32 Y quantization); deliberately returns soil height rather than water Y.
  * Occupied walk tiles are y=0; points beyond the terrain halo use the global base.
  */
 const height=(x:number,z:number)=>{
  const cx=Math.round(x/4),cz=Math.round(z/4),tile=tiles.get(key(cx,cz));
  if(!tile)return grid.has(key(cx,cz))?0:base;
  const x0=cx*4-2,z0=cz*4-2,ux=(x-x0)/step,uz=(z-z0)/step;
  const ix=Math.max(0,Math.min(segments-1,Math.floor(ux))),iz=Math.max(0,Math.min(segments-1,Math.floor(uz)));
  const p=renderedPositions.get(key(cx,cz))!,ai=iz*(segments+1)+ix,bi=ai+1,ci=ai+segments+1,di=ci+1;
  const fx=(x-p.getX(ai))/(p.getX(bi)-p.getX(ai)),fz=(z-p.getZ(ai))/(p.getZ(ci)-p.getZ(ai));
  const a=p.getY(ai),b=p.getY(bi),c=p.getY(ci),d=p.getY(di);
  return fx+fz<=1?a*(1-fx-fz)+b*fx+c*fz:d*(fx+fz-1)+c*(1-fx)+b*(1-fz);
 };
 return {surfaces,tiles:tilemetadata,tilemetadata,height,regionAt,triangleCount,segments,analyticalHeight};
}
