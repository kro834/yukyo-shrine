/** Shared occupancy for returning paths above lowered real-world landscapes. */
export type GridCell={x:number;z:number;h:number;kind:string};
export type SectorLike={id:string;x1:number;x2:number;z1:number;z2:number;kind:string;rotation:number};
export type RoomLike={x1:number;x2:number;z1:number;z2:number};
export const LANDSCAPES=['levee','riverside','underpass','greenway','floodgate','paddy'] as const;
export type Landscape=typeof LANDSCAPES[number];
export const LANDSCAPE_NAMES:Record<Landscape,string>={levee:'月見の土手',riverside:'水際の遊歩道',underpass:'終電後の高架下',greenway:'団地裏の緑道',floodgate:'旧水門の管理道',paddy:'夕暮れの農道'};
type P=readonly [number,number];type Region<T>={sectorId:string;identity:Landscape;cx:number;cz:number;rotation:number;removed:T[];routeCells:P[]};
const DIRS:readonly P[]=[[1,0],[-1,0],[0,1],[0,-1]];
const ROUTES:Record<Landscape,readonly (readonly P[])[]>={
 levee:[[[0,-8],[0,8]],[[-8,0],[8,0]],[[-6,-8],[-6,6],[0,6]],[[0,-6],[6,-6],[6,6],[0,6]]],
 riverside:[[[-8,0],[-2,0],[-2,-6],[6,-6],[6,0],[8,0]],[[0,-8],[0,-6]],[[0,8],[0,6],[-6,6],[-6,0],[-2,0]],[[0,6],[6,6],[6,0]]],
 underpass:[[[-8,0],[8,0]],[[0,-8],[0,-2],[-2,-2],[-2,2],[0,2],[0,8]],[[-6,0],[-6,6],[6,6],[6,0]]],
 greenway:[[[-8,0],[-2,0],[-2,-2],[2,-2],[2,0],[8,0]],[[0,-8],[0,-2]],[[0,8],[0,4],[-2,4],[-2,0]],[[2,0],[2,4],[0,4]]],
 floodgate:[[[-8,0],[-6,0],[-6,-6],[6,-6],[6,0],[8,0]],[[0,-8],[0,-6]],[[0,8],[0,6],[-6,6],[-6,0]],[[0,6],[6,6],[6,0]]],
 paddy:[[[0,-8],[0,8]],[[-8,0],[8,0]],[[-6,-6],[6,-6],[6,6],[-6,6],[-6,-6]],[[0,-6],[0,6]]],
};
const key=(x:number,z:number)=>x+','+z;

/** Removes optional landform leaves, then restores a shortest source-grid link
 * for any mandatory leaf (room halo, real external port, or protected deck).
 * That makes each retained landform route return to the wider walk graph. */
function closeLandformLeaves<T extends GridCell>(source:Map<string,T>,grid:Map<string,T>,sector:SectorLike,required:Set<string>){
 const inside=(x:number,z:number)=>x>=sector.x1&&x<=sector.x2&&z>=sector.z1&&z<=sector.z2;
 const degree=(k:string)=>{const c=grid.get(k)!;return DIRS.reduce((n,[dx,dz])=>n+(grid.has(key(c.x+dx,c.z+dz))?1:0),0);};
 const isField=(k:string)=>{const c=source.get(k);return !!c&&c.kind==='field'&&inside(c.x,c.z);};
 const queue:string[]=[];const queued=new Set<string>();
 const enqueue=(k:string)=>{if(isField(k)&&!required.has(k)&&grid.has(k)&&degree(k)<2&&!queued.has(k)){queued.add(k);queue.push(k);}};
 for(const k of grid.keys())enqueue(k);
 for(let i=0;i<queue.length;i++){
  const k=queue[i];queued.delete(k);const c=grid.get(k);if(!c||required.has(k)||degree(k)>=2)continue;
  grid.delete(k);
  for(const [dx,dz] of DIRS)enqueue(key(c.x+dx,c.z+dz));
 }
 // A required cell may be a leaf only because its authored route ended at a
 // closed sector side.  Join it through original field cells to a different
 // retained node; do not use its sole current neighbour as the target.
 const leaves=()=>[...required].filter(k=>grid.has(k)&&degree(k)<2);
 for(const start of leaves()){
  const startCell=grid.get(start)!;
  const forbidden=new Set(DIRS.map(([dx,dz])=>key(startCell.x+dx,startCell.z+dz)).filter(k=>grid.has(k)));
  const parent=new Map<string,string|null>([[start,null]]),queue=[start];let target:string|undefined;
  for(let i=0;i<queue.length&&!target;i++){
   const current=queue[i],c=source.get(current)!;
   for(const [dx,dz] of DIRS){
    const next=key(c.x+dx,c.z+dz);if(parent.has(next)||!source.has(next)||!inside(c.x+dx,c.z+dz))continue;
    // Only traverse cells that this planner is permitted to retain.  A path
    // may finish on a pre-existing non-field connector, but cannot cross it.
    const nextCell=source.get(next)!;
    if(next!==start&&grid.has(next)){
      if(!forbidden.has(next)){target=next;parent.set(next,current);break;}
      continue;
    }
    if(nextCell.kind!=='field')continue;
    parent.set(next,current);queue.push(next);
   }
  }
  if(!target)continue; // A pre-existing isolated source leaf is outside this plan's scope.
  for(let k: string|null=target;k;k=parent.get(k)??null){const c=source.get(k);if(c)grid.set(k,c);if(k===start)break;}
 }
 // Restored links can expose old optional leaves; prune them once more.  The
 // required set now has a second route, so it is never removed.
 queue.length=0;queued.clear();for(const k of grid.keys())enqueue(k);
 for(let i=0;i<queue.length;i++){
  const k=queue[i];queued.delete(k);const c=grid.get(k);if(!c||required.has(k)||degree(k)>=2)continue;
  grid.delete(k);for(const [dx,dz] of DIRS)enqueue(key(c.x+dx,c.z+dz));
 }
}

export function planOuterLandforms<T extends GridCell>(source:Map<string,T>,sectors:readonly SectorLike[],rooms:readonly RoomLike[],protectedCell:(cell:T)=>boolean=()=>false){
 const grid=new Map(source),regions:Region<T>[]=[];
 const cleanup:{sector:SectorLike;required:Set<string>}[]=[];
 const fields=sectors.filter(s=>s.kind==='field').sort((a,b)=>a.z1-b.z1||a.x1-b.x1);
 fields.forEach((s,index)=>{
  const identity=LANDSCAPES[index%LANDSCAPES.length],cx=(s.x1+s.x2)/2,cz=(s.z1+s.z2)/2,keep=new Set<string>(),required=new Set<string>(),routes:P[]=[];
  const add=(x:number,z:number,mandatory=false)=>{if(x<s.x1||x>s.x2||z<s.z1||z>s.z2)return;const k=key(x,z);if(source.has(k)){keep.add(k);if(mandatory)required.add(k);routes.push([x,z]);}};
  const local=([x,z]:P):P=>{for(let i=0;i<s.rotation;i++)[x,z]=[-z,x];return [cx+x,cz+z];};
  const line=(a:P,b:P,mandatory=false)=>{let [x,z]=a;add(x,z,mandatory);while(x!==b[0]){x+=Math.sign(b[0]-x);add(x,z,mandatory);}while(z!==b[1]){z+=Math.sign(b[1]-z);add(x,z,mandatory);}};
  for(const path of ROUTES[identity])for(let i=1;i<path.length;i++)line(local(path[i-1]),local(path[i]));
  for(const room of rooms.filter(r=>r.x1>=s.x1&&r.x2<=s.x2&&r.z1>=s.z1&&r.z2<=s.z2)){
   const mid:P=[Math.floor((room.x1+room.x2)/2),Math.floor((room.z1+room.z2)/2)],nearest=routes.reduce((a,b)=>Math.abs(a[0]-mid[0])+Math.abs(a[1]-mid[1])<=Math.abs(b[0]-mid[0])+Math.abs(b[1]-mid[1])?a:b);
   line(mid,nearest,true);for(let x=room.x1-1;x<=room.x2+1;x++)for(let z=room.z1-1;z<=room.z2+1;z++)add(x,z,true);
  }
  for(let x=s.x1;x<=s.x2;x++)for(let z=s.z1;z<=s.z2;z++){
   const c=source.get(key(x,z));if(!c)continue;
   const external=DIRS.some(([dx,dz])=>(x+dx<s.x1||x+dx>s.x2||z+dz<s.z1||z+dz>s.z2)&&source.has(key(x+dx,z+dz)));
   if(external||protectedCell(c)||c.kind!=='field'){
    const nearest=routes.reduce((a,b)=>Math.abs(a[0]-x)+Math.abs(a[1]-z)<=Math.abs(b[0]-x)+Math.abs(b[1]-z)?a:b);
    line([x,z],nearest,true);add(x,z,true);
   }
  }
  const removed:T[]=[];
  for(let x=s.x1;x<=s.x2;x++)for(let z=s.z1;z<=s.z2;z++){const k=key(x,z),c=source.get(k);if(c&&!keep.has(k)&&c.kind==='field'){grid.delete(k);removed.push(c);}}
  cleanup.push({sector:s,required});
  regions.push({sectorId:s.id,identity,cx,cz,rotation:s.rotation,removed,routeCells:routes});
 });
 // Deletions in a later field can turn a connector beside an earlier field into
 // a leaf.  Run after every field has been carved, with a second pass for links
 // restored by a neighbouring field's mandatory route.
 for(let pass=0;pass<2;pass++)for(const {sector,required} of cleanup)closeLandformLeaves(source,grid,sector,required);
 // Rendering and placement consume the final topology, including trimmed stubs
 // and restored loops, rather than the earlier authored route sketch.
 for(const r of regions){
  const s=fields.find(s=>s.id===r.sectorId)!;
  r.removed=[...source.values()].filter(c=>c.kind==='field'&&c.x>=s.x1&&c.x<=s.x2&&c.z>=s.z1&&c.z<=s.z2&&!grid.has(key(c.x,c.z)));
  r.routeCells=[...grid.values()].filter(c=>c.x>=s.x1&&c.x<=s.x2&&c.z>=s.z1&&c.z<=s.z2).map(c=>[c.x,c.z] as const);
 }
 return {grid,regions};
}

export function bankHeight(distance:number,depth=1.8,slopeWidth=4.8){const t=Math.max(0,Math.min(1,distance/slopeWidth));return -depth*t;}
