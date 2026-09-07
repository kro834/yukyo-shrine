/** Pure candidate extraction. All public positions/bounds use WORLD METRES.
 * Cell and region centres use grid units, as in the current Site layout.
 * Never build a continuous side wall from these candidates: use wallSegments only.
 */
type Cell={x:number;z:number;kind:string};
type Region={sectorId:string;identity:string;cx:number;cz:number};
type Room={x1:number;x2:number;z1:number;z2:number};
type Door={x:number;z:number;alongX:boolean};
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
type Axis='x'|'z';
type Options={rooms:readonly Room[];doors:readonly Door[];stairs:readonly Bounds[];highStairs:readonly Bounds[];secondDeckCells:readonly {x:number;z:number}[];count?:number;clearance?:number;width?:4|8;allowBelowDeck?:boolean};
export type LandmarkCandidate={
 sectorId:string;identity:string;x:number;z:number;axis:Axis;yaw:number;
 footprint:Bounds;axisClearance:Bounds;score:number;enclosedSides:number;requiresSideOpenings:boolean;belowDeck:boolean;maxStructureHeight:number|null;
 /** One entry per 4 m longitudinal section. Branch=true prohibits both wall AND pier there. */
 sides:{side:-1|1;offset:number;branch:boolean}[];
 /** Trimmed solid side sections in local coordinates: lateral u, longitudinal v. */
 wallSegments:{side:-1|1;u:number;v1:number;v2:number}[];
 /** Uprights preserve the clear axis; at width8 they must be outside the walking grid. */
 supports:{x:number;z:number;size:number}[];
};
const key=(x:number,z:number)=>x+','+z;
const intersects=(a:Bounds,b:Bounds,pad=0)=>a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&a.minZ<b.maxZ+pad&&a.maxZ>b.minZ-pad;
export function outerLandmarkCandidates(grid:Map<string,Cell>,regions:readonly Region[],options:Options){
 const margin=options.clearance??.25,width=options.width??4,halfWidth=width/2,sideU=width*.4625,axisHalfWidth=width===4?.8:2.4;
 const deckBounds=options.secondDeckCells.map(c=>({minX:c.x*4-2,maxX:c.x*4+2,minZ:c.z*4-2,maxZ:c.z*4+2}));
 const protectedBounds:Bounds[]=[
  ...options.rooms.map(r=>({minX:r.x1*4-2,maxX:r.x2*4+2,minZ:r.z1*4-2,maxZ:r.z2*4+2})),
  ...options.doors.map(d=>({minX:d.x-(d.alongX?2:.4),maxX:d.x+(d.alongX?2:.4),minZ:d.z-(d.alongX?.4:2),maxZ:d.z+(d.alongX?.4:2)})),
  ...[...options.stairs,...options.highStairs].map(s=>({minX:s.minX-1,maxX:s.maxX+1,minZ:s.minZ-1.5,maxZ:s.maxZ+1.5})),
  ...(options.allowBelowDeck?[]:deckBounds),
 ];
 const candidateGroups=regions.map(r=>{
  const candidates:LandmarkCandidate[]=[];
  for(const c of grid.values()){
   if(c.kind!=='field'||Math.abs(c.x-r.cx)>8||Math.abs(c.z-r.cz)>8)continue;
   for(const axis of ['x','z'] as const){
    const dx=axis==='x'?1:0,dz=axis==='z'?1:0,px=dz,pz=-dx;
    const centres=[-1,0,1].map(t=>({x:c.x+dx*t,z:c.z+dz*t}));
    if(centres.some(p=>grid.get(key(p.x,p.z))?.kind!=='field'||Math.abs(p.x-r.cx)>8||Math.abs(p.z-r.cz)>8))continue;
    const x=c.x*4,z=c.z*4,footprint={minX:x-(axis==='x'?6:halfWidth),maxX:x+(axis==='x'?6:halfWidth),minZ:z-(axis==='z'?6:halfWidth),maxZ:z+(axis==='z'?6:halfWidth)};
    if(protectedBounds.some(b=>intersects(footprint,b,margin)))continue;
    const sides:LandmarkCandidate['sides']=[],wallSegments:LandmarkCandidate['wallSegments']=[],supports:LandmarkCandidate['supports']=[];
    for(const side of [-1,1] as const)for(const t of [-1,0,1]){
     // ANY occupied neighbour is a potential crossing, including a non-field lane.
     const branch=grid.has(key(c.x+dx*t+px*side,c.z+dz*t+pz*side));
     sides.push({side,offset:t*4,branch});
     if(!branch)wallSegments.push({side,u:side*sideU,v1:t*4-1.35,v2:t*4+1.35});
    }
    const toWorld=(u:number,v:number)=>axis==='z'?{x:x+u,z:z+v}:{x:x+v,z:z-u};
    // Supports are never placed at boundaries between sections, where a perpendicular
    // route could squeeze around the end of a wall. Each support is centered in a
    // side section and rejected against ALL occupied tile footprints plus 0.65 m.
    for(const side of sides.filter(s=>!s.branch)){
     const p=toWorld(side.side*sideU,side.offset),size=width===4?.21:.42,b={minX:p.x-size/2,maxX:p.x+size/2,minZ:p.z-size/2,maxZ:p.z+size/2};
     let occupied=false;
     for(let gx=Math.floor((b.minX-.65+2)/4);gx<=Math.floor((b.maxX+.65+2)/4);gx++)for(let gz=Math.floor((b.minZ-.65+2)/4);gz<=Math.floor((b.maxZ+.65+2)/4);gz++)if(grid.has(key(gx,gz)))occupied=true;
     if(!occupied||width===4&&Math.abs(sideU)-size/2>axisHalfWidth+.42)supports.push({...p,size});
    }
    const enclosedSides=[-1,1].filter(side=>sides.filter(s=>s.side===side).every(s=>!s.branch)).length;
    const clearSections=sides.filter(s=>!s.branch).length;
    const score=enclosedSides*100+clearSections*10+supports.length-Math.hypot(c.x-r.cx,c.z-r.cz)*.2;
    const belowDeck=deckBounds.some(b=>intersects(footprint,b,margin));
    candidates.push({sectorId:r.sectorId,identity:r.identity,x,z,axis,yaw:axis==='z'?0:Math.PI/2,footprint,requiresSideOpenings:enclosedSides<2,belowDeck,maxStructureHeight:belowDeck?4.45:null,
     axisClearance:{minX:x-(axis==='x'?6:axisHalfWidth),maxX:x+(axis==='x'?6:axisHalfWidth),minZ:z-(axis==='z'?6:axisHalfWidth),maxZ:z+(axis==='z'?6:axisHalfWidth)},score,enclosedSides,sides,wallSegments,supports});
   }
  }
  candidates.sort((a,b)=>b.score-a.score||a.z-b.z||a.x-b.x||a.axis.localeCompare(b.axis));
  const selected:LandmarkCandidate[]=[];
  for(const c of candidates){if(selected.length>=(options.count??3))break;if(selected.some(s=>intersects(c.footprint,s.footprint,1)))continue;selected.push(c);}
  return {sectorId:r.sectorId,identity:r.identity,selected,candidates};
 });
 return candidateGroups;
}
