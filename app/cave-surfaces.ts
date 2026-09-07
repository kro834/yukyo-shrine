import * as THREE from 'three';

// Cell coordinates are grid indices; wall coordinates are metres.
export type CaveCell = {x:number;z:number;h:number;kind:string};
export type CaveWall = {x:number;z:number;h:number;alongX:boolean;insideX:number;insideZ:number;kind?:string;twoSided?:boolean};
export type CaveOptions = {
  detail?:'low'|'high';
  tileMetres?:number;
  // Continuous world-space upper limit. Default: no upper deck.
  // The helper calls this at original wall planes as well as ceiling vertices.
  ceilingLimit?:(x:number,z:number)=>number;
};
type Run = {start:number;end:number;walls:CaveWall[]};
const CELL=4, HALF=2, SKIRT=-.16;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};

/** Continuous cap including an outward wall safety margin. No geometry can enter
 * the upper floor: the roof rises gradually only after leaving its footprint.
 * Use all SECOND_DECK.cells, not just cells directly above this cave.
 */
export function caveDeckLimit(deck:readonly {x:number;z:number}[], underside=4.5){
  const grid=new Set(deck.map(c=>c.x+','+c.z));
  return (x:number,z:number)=>{
    const cx=Math.round(x/CELL),cz=Math.round(z/CELL);
    let distance=Infinity;
    // 1.5m covers recession plus the Low mesh's 1m interpolation span. A
    // 7-cell square finds the entire
    // transition band (roof limit becomes >=10m beyond it).
    for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
      if(!grid.has((cx+dx)+','+(cz+dz)))continue;
      const ex=Math.max(0,Math.abs(x-(cx+dx)*CELL)-HALF-1.5);
      const ez=Math.max(0,Math.abs(z-(cz+dz)*CELL)-HALF-1.5);
      distance=Math.min(distance,Math.hypot(ex,ez));
    }
    return underside+distance*.8;
  };
}

/** Build indexed surfaces with authored metre-scaled UVs. This does not allocate
 * materials or scene objects and does not alter collision/navigation data.
 * Roofs are drawn from below; rock walls face the existing walkable cell.
 */
export function createCaveSurfaces(
  allCells:readonly CaveCell[],allWalls:readonly CaveWall[],seed:number,
  options:CaveOptions={},
){
  const cells=allCells.filter(c=>c.kind==='cave');
  const grid=new Map(cells.map(c=>[c.x+','+c.z,c]));
  const walls=allWalls.filter(w=>w.kind==='cave'&&!w.twoSided);
  const roofSegments=options.detail==='low'?4:6;
  const wallSegments=options.detail==='low'?4:6;
  const wallRows=options.detail==='low'?6:10;
  const uvScale=1/(options.tileMetres??2.7);
  const limit=options.ceilingLimit??(()=>Infinity);
  const nSeed=seed|0;
  const hash=(x:number,z:number)=>{
    let n=Math.imul(x|0,0x1f123bb5)^Math.imul(z|0,0x5f356495)^nSeed;
    n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const noise=(x:number,z:number)=>{
    const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
    const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
    return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
  };

  // Merge collinear segments into parameter domains: no 4m scallop reset.
  const lines=new Map<string,CaveWall[]>(), wallRuns=new Map<CaveWall,Run>();
  for(const w of walls){
    const key=(w.alongX?'x:':'z:')+(w.alongX?w.z:w.x)+':'+w.insideX+':'+w.insideZ;
    if(!lines.has(key))lines.set(key,[]);lines.get(key)!.push(w);
  }
  for(const line of lines.values()){
    line.sort((a,b)=>(a.alongX?a.x:a.z)-(b.alongX?b.x:b.z));
    let run:Run|undefined;
    for(const w of line){
      const t=w.alongX?w.x:w.z;
      if(!run||t-HALF>run.end+.001)run={start:t-HALF,end:t+HALF,walls:[]};
      run.end=t+HALF;run.walls.push(w);wallRuns.set(w,run);
    }
  }
  const runBins=new Map<string,Set<Run>>();
  for(const w of walls){const key=Math.floor(w.x/CELL)+','+Math.floor(w.z/CELL);
    if(!runBins.has(key))runBins.set(key,new Set());runBins.get(key)!.add(wallRuns.get(w)!);
  }
  // The roof extends .24m into the surrounding rock at real exterior walls.
  // Its parameter-domain border stays on the layout grid, so adjoining roof
  // cells still sample the same transformed edge. Run ends return to zero.
  const roofXZ=(x:number,z:number)=>{
    const bx=Math.floor(x/CELL),bz=Math.floor(z/CELL),visited=new Set<Run>();let ox=0,oz=0;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const run of runBins.get((bx+dx)+','+(bz+dz))??[]){
      if(visited.has(run))continue;visited.add(run);const w=run.walls[0];
      const t=w.alongX?x:z,d=(x-w.x)*w.insideX+(z-w.z)*w.insideZ;
      if(t<run.start||t>run.end||d<-.01||d>1.1)continue;
      const ends=smooth(Math.min(t-run.start,run.end-t)/.85);
      const depth=.24*ends*smooth(1-d/1.1);
      ox-=w.insideX*depth;oz-=w.insideZ*depth;
    }
    return [x+ox,z+oz];
  };

  // Boundaries include portals: the rock ceiling returns to a plain opening
  // edge at material transitions. Boundary distance is world-space, not per-cell.
  const boundaryBins=new Map<string,{x:number;z:number;alongX:boolean}[]>();
  for(const c of cells)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(grid.has((c.x+dx)+','+(c.z+dz)))continue;
    const edge={x:c.x*CELL+dx*HALF,z:c.z*CELL+dz*HALF,alongX:!!dz};
    const bx=Math.floor(edge.x/CELL),bz=Math.floor(edge.z/CELL),key=bx+','+bz;
    if(!boundaryBins.has(key))boundaryBins.set(key,[]);boundaryBins.get(key)!.push(edge);
  }
  const edgeDistance=(x:number,z:number)=>{
    const bx=Math.floor(x/CELL),bz=Math.floor(z/CELL);let d=3;
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(const e of boundaryBins.get((bx+dx)+','+(bz+dz))??[]){
      const a=e.alongX?Math.max(0,Math.abs(x-e.x)-HALF):Math.abs(x-e.x);
      const b=e.alongX?Math.abs(z-e.z):Math.max(0,Math.abs(z-e.z)-HALF);
      d=Math.min(d,Math.hypot(a,b));
    }
    return d;
  };
  const heights=new Map<string,number>();
  const heightAt=(x:number,z:number)=>{
    const key=x+','+z,cached=heights.get(key);if(cached!==undefined)return cached;
    const cx=Math.round(x/CELL),cz=Math.round(z/CELL);let base=-Infinity;
    // Upper envelope: adjacent cells of different heights share the same roof.
    // A taller bay lifts its neighbours smoothly instead of opening a vertical gap.
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      const c=grid.get((cx+dx)+','+(cz+dz));if(!c)continue;
      const ex=Math.max(0,Math.abs(x-c.x*CELL)-HALF),ez=Math.max(0,Math.abs(z-c.z*CELL)-HALF);
      const d=Math.hypot(ex,ez);
      if(d<3.5)base=Math.max(base,c.h-1.8*d);
    }
    if(!Number.isFinite(base))throw new Error('Cave height requested outside its surface domain');
    const edge=edgeDistance(x,z),vault=smooth(edge/2.1);
    // Boundary roof meets wall exactly; interior rises into a broad geological vault.
    const relief=vault*(.38+.28*noise(x*.14,z*.14)+.12*noise(x*.57+31,z*.57-47));
    const h=Math.min(base+relief,limit(x,z));heights.set(key,h);return h;
  };

  const makePatch=(nu:number,nv:number,at:(u:number,v:number)=>THREE.Vector3,
    uvAt:(u:number,v:number,p:THREE.Vector3)=>[number,number],reverse:boolean,
    metadata:Record<string,unknown>)=>{
    const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
    const du=new THREE.Vector3(),dv=new THREE.Vector3(),n=new THREE.Vector3();
    const epsilon=.0005;
    for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
      const s=u/nu,t=v/nv,p=at(s,t);
      du.subVectors(at(s+epsilon,t),at(s-epsilon,t));
      dv.subVectors(at(s,t+epsilon),at(s,t-epsilon));
      n.crossVectors(du,dv);
      // At a pinned run-end crown the vertical parameter has zero derivative.
      // Its one-sided limiting tangent preserves the real corner normal.
      if(n.lengthSq()<1e-20){dv.subVectors(p,at(s,t-epsilon));n.crossVectors(du,dv);}
      n.normalize();if(reverse)n.negate();
      positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push(...uvAt(s,t,p));
    }
    for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){
      const a=v*(nu+1)+u,b=a+1,c=a+nu+1,d=c+1;
      if(reverse)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
    geometry.userData={surfaceUV:'authored',caveSurface:true,...metadata};
    geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  };

  const roof=(c:CaveCell)=>{
    if(!grid.has(c.x+','+c.z))throw new Error('Cannot create cave roof for a non-cave cell');
    return makePatch(roofSegments,roofSegments,(u,v)=>{
      const x=c.x*CELL-HALF+u*CELL,z=c.z*CELL-HALF+v*CELL;
      const [px,pz]=roofXZ(x,z);return new THREE.Vector3(px,heightAt(x,z),pz);
    },(_u,_v,p)=>[p.x*uvScale,p.z*uvScale],false,{cavePart:'roof',cell:{...c}});
    // +X cross +Z = -Y: the visible front face is below the ceiling.
  };
  const wall=(w:CaveWall)=>{
    const run=wallRuns.get(w);if(!run)throw new Error('Only original exterior cave walls are supported');
    const center=w.alongX?w.x:w.z,plane=w.alongX?w.z:w.x;
    const at=(u:number,r:number)=>{
      const t=center-HALF+u*CELL,x=w.alongX?t:w.x,z=w.alongX?w.z:t;
      const top=heightAt(x,z),floorRow=1/wallRows;
      const q=(r-floorRow)/(1-floorRow);
      // The first row is buried, the second is exactly y=0. Remaining rows
      // approach the crown horizontally, making a rounded rock/roof junction.
      const y=r<=floorRow?SKIRT*(1-r/floorRow):top*(1-(1-q)*(1-q));
      // Flat, continuous buried skirt and a smooth return at real run ends close
      // every floor seam and perpendicular corner without a decorative extra box.
      const ends=smooth(Math.min(t-run.start,run.end-t)/.85);
      const floor=smooth(y/.38);
      const bedding=.5+.5*Math.sin(y*5.7+noise(t*.19,plane*.13)*1.3);
      const strata=.10+.22*noise(t*.34+plane*.11,y*.49)+.13*bedding+.07*noise(t*1.12-19,y*1.37);
      const crown=smooth(q/.7);
      const depth=ends*floor*(strata*(1-crown)+.24*crown+.12*Math.sin(Math.PI*clamp(q)));
      return new THREE.Vector3(x-w.insideX*depth,y,z-w.insideZ*depth);
    };
    // Along X: tangent cross up = +Z. Along Z: tangent cross up = -X.
    const reverse=w.alongX?w.insideZ<0:w.insideX>0;
    return makePatch(wallSegments,wallRows,at,(_u,_v,p)=>[
      (w.alongX?p.x:p.z)*uvScale,p.y*uvScale,
    ],reverse,{cavePart:'wall',wall:{...w}});
  };

  // Above a cave/non-cave opening, bridge the roof to the existing neighbouring
  // slab. This is a lintel above the original lower of the two ceiling heights,
  // never a hanging stalactite in the preserved passage volume. Call once from
  // the cave side only. It is deliberately two-sided by duplicated triangles.
  const portal=(c:CaveCell,n:CaveCell,dx:number,dz:number)=>{
    if(n.kind==='cave'||Math.abs(dx)+Math.abs(dz)!==1)return null;
    const alongX=!!dz,x=c.x*CELL+dx*HALF,z=c.z*CELL+dz*HALF;
    const other=(t:number)=>Math.min(n.h,limit(alongX?t:x,alongX?z:t));
    const roofH=(t:number)=>heightAt(alongX?t:x,alongX?z:t);
    const center=alongX?x:z;
    if(Array.from({length:wallSegments+1},(_,i)=>Math.abs(roofH(center-HALF+i*CELL/wallSegments)-other(center-HALF+i*CELL/wallSegments))).every(d=>d<.001))return null;
    const geometry=makePatch(wallSegments,1,(u,v)=>{
      const t=center-HALF+u*CELL,h=roofH(t),end=other(t);
      return new THREE.Vector3(alongX?t:x,Math.min(h,end)+Math.abs(end-h)*v,alongX?z:t);
    },(_u,_v,p)=>[(alongX?p.x:p.z)*uvScale,p.y*uvScale],false,{cavePart:'portal'});
    // A height transition can close to zero at one end. Keep fixed plane
    // normals there and omit zero-area triangles instead of normalizing zero.
    const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    for(let i=0;i<normal.count;i++)normal.setXYZ(i,alongX?0:-1,0,alongX?1:0);
    const kept:number[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c0=new THREE.Vector3();
    for(let i=0;i<geometry.index!.count;i+=3){
      const ia=geometry.index!.getX(i),ib=geometry.index!.getX(i+1),ic=geometry.index!.getX(i+2);
      a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c0.fromBufferAttribute(p,ic);
      if(b.sub(a).cross(c0.sub(a)).lengthSq()>1e-18)kept.push(ia,ib,ic);
    }
    geometry.setIndex(kept);
    // Use separate vertices/normals for back faces; no DoubleSide material clone.
    const positions=Array.from(geometry.getAttribute('position').array),normals=Array.from(geometry.getAttribute('normal').array),uvs=Array.from(geometry.getAttribute('uv').array);
    const count=positions.length/3,indices=Array.from(geometry.index!.array);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([...positions,...positions],3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute([...normals,...normals.map(n=>-n)],3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([...uvs,...uvs],2));
    for(let i=0,n=indices.length;i<n;i+=3)indices.push(indices[i]+count,indices[i+2]+count,indices[i+1]+count);
    geometry.setIndex(indices);return geometry;
  };
  return {roof,wall,portal,heightAt,roofSegments,wallSegments,wallRows};
}
