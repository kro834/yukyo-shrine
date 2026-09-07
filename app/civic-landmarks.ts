/**
 * Geometry-only civic landmark kit. It deliberately has no dependency on the Site.
 *
 * Local convention: +Y is up, Z is the 12 m route direction, and X is the 8 m
 * cross-route direction. The ground-level strip x=-1.6..1.6 is empty in every
 * module. `parts` are grouped by material before emission so the caller can feed
 * them directly into its existing merge/instancing batches.
 */
export type CivicMaterial =
  | 'wood' | 'planks' | 'concrete' | 'steel' | 'rust' | 'dark'
  | 'black' | 'glass' | 'light' | 'coolLight' | 'stone';

export type BoxGeometry = {
  kind: 'box'; x: number; y: number; z: number; w: number; h: number; d: number;
};
export type CylinderGeometry = {
  kind: 'cylinder'; x: number; y: number; z: number; r: number; h: number;
  rb: number; segments: number;
};
/** Same 44-triangle topology as app/chamfered-box.ts. */
export type BeveledBoxGeometry = {
  kind: 'beveledBox'; x: number; y: number; z: number; w: number; h: number;
  d: number; radius: number; yaw?: number;
};
/** Open-ended cylinder aligned from `from` to `to`; 2*segments triangles. */
export type TubeGeometry = {
  kind: 'tube'; from: readonly [number, number, number];
  to: readonly [number, number, number]; radius: number; segments: number;
};
export type CivicGeometry = BoxGeometry | CylinderGeometry | BeveledBoxGeometry | TubeGeometry;
export type CivicPart = CivicGeometry & { material: CivicMaterial };
export type CivicCollider = {
  id: string; minX: number; maxX: number; minZ: number; maxZ: number;
  minY?: number; maxY?: number;
};
export type CivicFoundation = {
  id: string; minX: number; maxX: number; minZ: number; maxZ: number; topY: number;
};
export type CivicLandmarkId =
  | 'weathered-bus-shelter'
  | 'railway-underpass-bay'
  | 'closed-floodgate-mechanism'
  | 'apartment-service-facade';
export type CivicLandmark = {
  id: CivicLandmarkId;
  envelope: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  clearances: { mainAxisMinX: -1.6; mainAxisMaxX: 1.6; endOpening: number; doorway: number };
  parts: CivicPart[];
  colliders: CivicCollider[];
  foundations: CivicFoundation[];
};
export type CivicBuilder = {
  box: (x: number, y: number, z: number, w: number, h: number, d: number, material: CivicMaterial) => void;
  cylinder: (x: number, y: number, z: number, r: number, h: number, material: CivicMaterial, rb?: number, segments?: number) => void;
  add: (geometry: BeveledBoxGeometry | TubeGeometry, material: CivicMaterial) => void;
};
export type CivicPlacement = { x?: number; y?: number; z?: number; quarterTurns?: 0 | 1 | 2 | 3 };

const CLEAR = { mainAxisMinX: -1.6, mainAxisMaxX: 1.6, endOpening: 3.2, doorway: 3.4 } as const;

function kit(id: CivicLandmarkId) {
  const parts: CivicPart[] = [], colliders: CivicCollider[] = [], foundations:CivicFoundation[]=[];
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,material:CivicMaterial) =>
    parts.push({kind:'box',x,y,z,w,h,d,material});
  const cylinder = (x:number,y:number,z:number,r:number,h:number,material:CivicMaterial,rb=r,segments=12) =>
    parts.push({kind:'cylinder',x,y,z,r,h,rb,segments,material});
  const bevel = (x:number,y:number,z:number,w:number,h:number,d:number,radius:number,material:CivicMaterial,yaw=0) =>
    parts.push({kind:'beveledBox',x,y,z,w,h,d,radius,material,yaw});
  const tube = (from:readonly[number,number,number],to:readonly[number,number,number],radius:number,material:CivicMaterial,segments=8) =>
    parts.push({kind:'tube',from,to,radius,segments,material});
  const collide = (id:string,x:number,z:number,w:number,d:number,maxY:number,minY=0) => {
    const footprint={id,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2};
    colliders.push({...footprint,minY,maxY});
    // Ground-connected solids get an exact extrusion footprint. The integrator can
    // sample lowered bank terrain under each rectangle and extrude it up to topY=0.
    if(minY===0)foundations.push({...footprint,topY:0});
  };
  // Thin shared pavement establishes the exact 8 x 12 m envelope but is not a collider.
  box(0,.04,0,8,.08,12,'stone');
  return {id,parts,colliders,foundations,box,cylinder,bevel,tube,collide};
}

function busShelter(): CivicLandmark {
  const k=kit('weathered-bus-shelter'),{box,cylinder,bevel,tube,collide}=k;
  // Patched curb and tactile edge, both kept outside the walking axis.
  bevel(3.74,.14,0,.52,.20,11.6,.055,'concrete');
  for(let z=-5.55;z<=5.56;z+=.46)box(3.43,.255,z,.25,.035,.28,z/.46%3===0?'rust':'stone');
  // Four rounded shelter posts and a deep rear beam.
  for(const x of [2.02,3.72])for(const z of [-4.42,4.42]){
    cylinder(x,1.55,z,.085,3.02,'steel',.10,12); cylinder(x,.095,z,.16,.19,'concrete',.14,12);
    collide(`shelter-post-${x}-${z}`,x,z,.26,.26,3.1);
  }
  bevel(2.86,3.12,0,2.16,.16,9.62,.045,'steel');
  // Corrugated roof sheet: a dark backer plus separate raised longitudinal ribs.
  box(2.86,3.22,0,2.28,.08,9.82,'dark');
  for(let x=1.76;x<=3.97;x+=.17)box(x,3.29,0,.055,.075,9.78,x<1.93||x>3.8?'rust':'steel');
  for(const z of [-4.9,4.9])bevel(2.86,3.27,z,2.28,.17,.13,.035,'steel');
  // Dirt-streaked glass is segmented by real steel mullions; the south bay stays open.
  for(const z of [-3.25,-1.25,.75,2.75]){
    box(3.76,1.74,z,.035,2.50,1.72,'glass');
    box(3.72,1.74,z-.88,.09,2.62,.08,'steel');
  }
  box(3.72,1.74,3.63,.09,2.62,.08,'steel');
  collide('rear-glazing',3.75,-.25,.16,8.65,3.05,.35);
  // Slatted bench, end brackets, under-seat stretcher and small fasteners.
  for(let i=0;i<5;i++)box(3.12,.52,-2.85+i*1.42,1.42,.065,1.29,'planks');
  for(let i=0;i<4;i++)box(3.48,.77+i*.13,0,.075,.09,7.18,'planks');
  for(const z of [-3.4,0,3.4]){
    bevel(3.18,.29,z,1.22,.54,.10,.025,'steel');
    box(3.46,.89,z,.08,.78,.10,'steel'); cylinder(2.62,.54,z,.055,.11,'rust',.055,10);
  }
  box(3.12,.24,0,.09,.09,6.95,'steel');
  collide('bench',3.13,0,1.55,7.35,1.31);
  // Blank timetable cabinet: layered frame and glass, intentionally no typography.
  bevel(-3.48,1.62,-2.75,.18,2.35,1.55,.035,'steel');
  box(-3.36,1.62,-2.75,.045,2.11,1.30,'glass');
  for(const y of [.57,2.67])box(-3.30,y,-2.75,.06,.08,1.42,'rust');
  for(const z of [-3.40,-2.10])box(-3.30,1.62,z,.06,2.18,.08,'rust');
  collide('blank-cabinet',-3.48,-2.75,.26,1.58,2.8,.4);
  // Downpipe, offset elbows, gutter hangers and loose-but-attached service cables.
  cylinder(3.61,1.49,4.67,.055,2.72,'rust',.062,10);
  tube([3.61,2.84,4.67],[3.82,3.08,4.67],.052,'rust');
  tube([3.82,3.08,4.67],[3.82,3.20,4.36],.052,'rust');
  for(const z of [-3.8,-1.9,0,1.9,3.8])tube([3.91,3.10,z],[3.91,3.30,z],.018,'black',6);
  tube([3.66,2.78,-4.6],[3.58,2.02,-3.65],.018,'black',6);
  return finish(k);
}

function underpass(): CivicLandmark {
  const k=kit('railway-underpass-bay'),{box,cylinder,bevel,tube,collide}=k;
  // Continuous side walls leave a 7.0 m clear bore. Beveled piers conceal repeating seams.
  for(const side of [-1,1]){
    box(side*3.82,2.08,0,.36,4.16,12,'concrete');
    collide(`underpass-wall-${side}`,side*3.82,0,.36,12,4.16);
    for(const z of [-5,-2.5,0,2.5,5])bevel(side*3.48,2.02,z,.34,4.04,.62,.065,'concrete');
    for(const z of [-4.87,-2.37,.13,2.63])box(side*3.625,2.05,z,.035,3.62,2.22,'dark');
    // Open grated drains and raised curb stones.
    bevel(side*3.36,.14,0,.34,.20,11.82,.045,'concrete');
    for(let z=-5.7;z<=5.71;z+=.38)box(side*3.12,.095,z,.30,.035,.055,'steel');
    collide(`underpass-curb-${side}`,side*3.36,0,.34,11.82,.25);
  }
  box(0,4.24,0,8,.24,12,'concrete');
  for(const z of [-5.45,-3.65,-1.85,-.05,1.75,3.55,5.35])bevel(0,4.10,z,7.55,.34,.28,.055,'concrete');
  // Cable trays and exposed utilities run above shoulder level.
  for(const side of [-1,1]){
    box(side*3.25,3.46,0,.32,.055,11.1,'steel');
    for(let z=-5.35;z<=5.36;z+=.55)box(side*3.25,3.31,z,.36,.30,.035,'steel');
    for(const x of [side*3.17,side*3.26,side*3.35])tube([x,3.46,-5.45],[x,3.46,5.45],.022,x===side*3.26?'rust':'black',6);
    cylinder(side*3.48,2.02,5.30,.065,3.72,'rust',.075,10);
    tube([side*3.48,3.83,5.30],[side*3.20,4.02,5.30],.06,'rust');
  }
  // Recessed blank service bay with genuinely modeled horizontal louvers.
  box(3.59,1.68,-2.65,.10,2.30,2.15,'black');
  bevel(3.48,1.68,-2.65,.16,2.52,2.38,.035,'steel');
  for(let y=.68;y<=2.67;y+=.16)box(3.35,y,-2.65,.08,.07,2.14,y<.82?'rust':'dark');
  // Impact guards and wall-wash fixtures are real volumes, not decals.
  for(const side of [-1,1])for(const z of [-4.1,4.1]){
    cylinder(side*3.05,.55,z,.12,1.10,'steel',.15,10);
    collide(`impact-post-${side}-${z}`,side*3.05,z,.3,.3,1.1);
  }
  for(const side of [-1,1])for(const z of [-3.2,0,3.2]){
    bevel(side*3.39,2.78,z,.18,.34,.72,.035,'dark');
    box(side*3.28,2.78,z,.035,.22,.51,side===1&&z===0?'coolLight':'glass');
  }
  return finish(k);
}

function floodgate(): CivicLandmark {
  const k=kit('closed-floodgate-mechanism'),{box,cylinder,bevel,tube,collide}=k;
  // Side-channel trough. The playable central lane remains dry and unobstructed.
  bevel(3.10,.16,0,1.78,.24,11.75,.055,'concrete');
  box(3.10,.035,0,1.42,.045,11.42,'dark');
  for(const z of [-5.72,5.72])box(3.10,.22,z,1.75,.20,.25,'concrete');
  collide('channel-east-wall',3.86,0,.28,11.75,.45);
  collide('channel-west-lip',2.20,0,.24,11.75,.34);
  // Two shouldered piers and the closed gate leaf between them, wholly east of x=1.6.
  for(const z of [-2.72,2.72]){
    bevel(2.48,1.50,z,.62,3.0,.74,.10,'concrete');
    bevel(3.68,1.50,z,.62,3.0,.74,.10,'concrete');
    collide(`gate-pier-inner-${z}`,2.48,z,.62,.74,3);
    collide(`gate-pier-outer-${z}`,3.68,z,.62,.74,3);
  }
  box(3.08,1.18,0,1.78,2.04,.24,'steel');
  for(let y=.29;y<=2.08;y+=.22)box(3.08,y,-.15,1.68,.065,.12,y<.55?'rust':'dark');
  for(const x of [2.28,2.64,3,3.36,3.72])box(x,1.18,-.17,.075,2.08,.10,'steel');
  collide('closed-gate-leaf',3.08,0,1.82,.32,2.2,.12);
  // Crosshead, rack, gearbox, worm shaft and handwheel.
  bevel(3.08,3.22,0,1.80,.26,.54,.055,'steel');
  box(3.08,3.66,0,.24,.82,.24,'steel');
  for(let y=2.25;y<=4.02;y+=.18)box(3.22,y,-.16,.22,.075,.08,'rust');
  bevel(3.08,4.08,0,1.05,.56,.72,.10,'dark');
  cylinder(3.08,4.39,0,.11,.12,'rust',.11,12);
  // Handwheel in the X/Y plane, assembled from short tubes around a steel hub.
  const wheelZ=-.45,wheelX=3.08,wheelY=3.93,r=.42;
  const ring:Array<readonly[number,number,number]>=Array.from({length:16},(_,i)=>{
    const a=i*Math.PI/8;return [wheelX+Math.cos(a)*r,wheelY+Math.sin(a)*r,wheelZ] as const;
  });
  ring.forEach((p,i)=>tube(p,ring[(i+1)%ring.length],.032,'steel',6));
  for(let i=0;i<8;i++)tube([wheelX,wheelY,wheelZ],ring[i*2],.018,'steel',6);
  tube([wheelX,wheelY,wheelZ],[wheelX,wheelY,-.08],.065,'rust',10);
  // Railings, kick plates and bridge drainpipe.
  for(const x of [-3.70,-2.15])for(const z of [-5.15,0,5.15]){
    cylinder(x,.62,z,.045,1.24,'steel',.055,8);collide(`west-rail-post-${x}-${z}`,x,z,.15,.15,1.24);
  }
  for(const x of [-3.70,-2.15])for(const y of [.42,1.14])tube([x,y,-5.15],[x,y,5.15],.035,'steel',8);
  box(-2.93,.09,0,1.72,.18,11.32,'concrete');
  cylinder(3.77,1.54,4.55,.06,2.76,'rust',.07,10);
  return finish(k);
}

function apartmentFacade(): CivicLandmark {
  const k=kit('apartment-service-facade'),{box,cylinder,bevel,tube,collide}=k;
  // Opposing service walls define a broad alley. Both end openings remain 7.1 m wide.
  for(const side of [-1,1]){
    for(const [z,d] of [[-4.0,4.0],[4.0,4.0]] as const){
      box(side*3.80,2.72,z,.40,5.44,d,'concrete');
      collide(`facade-${side}-${z}`,side*3.80,z,.40,d,5.44);
    }
    // A 3.4 m-wide recessed service opening between wall leaves.
    box(side*3.94,1.42,0,.12,2.84,3.40,'dark');
    bevel(side*3.62,4.74,0,.20,1.40,3.52,.045,'concrete');
    for(const z of [-1.76,1.76])bevel(side*3.61,1.42,z,.22,2.84,.18,.04,'steel');
    for(let y=.26;y<=2.60;y+=.19)box(side*3.49,y,0,.07,.075,3.22,y<.65?'rust':'steel');
    collide(`recess-back-${side}`,side*3.94,0,.12,3.40,2.84);
  }
  // East: drain stacks, meters, cable trunking and a deep louvered mechanical panel.
  for(const z of [-4.95,4.95]){
    cylinder(3.48,2.38,z,.075,4.72,'rust',.088,10);
    for(const y of [.72,2.31,4.06])box(3.43,y,z,.16,.055,.23,'steel');
  }
  for(const z of [-4.20,-3.35,3.35,4.20]){
    bevel(3.48,1.42,z,.28,.74,.62,.055,'dark');
    box(3.30,1.42,z,.055,.53,.43,'glass');
    cylinder(3.24,1.42,z,.035,.06,'steel',.035,10);
  }
  bevel(3.47,3.12,3.72,.30,1.12,2.10,.055,'steel');
  for(let y=2.65;y<=3.61;y+=.12)box(3.28,y,3.72,.055,.055,1.88,'dark');
  box(3.39,4.38,0,.15,.15,10.55,'black');
  for(const z of [-4.4,-2.2,0,2.2,4.4])tube([3.40,4.37,z],[3.06,4.17,z+.22],.022,'black',6);
  // West: paired condenser units on plinths, protected by slatted cages.
  for(const z of [-3.92,3.92]){
    bevel(-3.33,.19,z,1.02,.30,1.52,.055,'concrete');
    bevel(-3.37,.82,z,.92,.96,1.25,.075,'concrete');
    cylinder(-3.10,.82,z,.34,.08,'dark',.34,16);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      tube([-3.05,.82,z],[-3.05,.82+Math.sin(a)*.28,z+Math.cos(a)*.28],.018,'steel',6);
    }
    for(const dz of [-.68,.68])box(-2.75,.90,z+dz,.08,1.52,.08,'steel');
    for(const y of [.22,1.57])box(-2.75,y,z,.08,.08,1.44,'steel');
    collide(`condenser-${z}`,-3.31,z,1.16,1.62,1.65);
  }
  // Fire escape balcony is overhead; ground supports stay well outside the clear axis.
  box(-3.16,3.18,0,1.62,.18,3.82,'steel');
  for(let z=-1.72;z<=1.73;z+=.31)box(-3.16,3.30,z,1.52,.055,.085,'dark');
  for(const z of [-1.82,1.82])for(const x of [-3.86,-2.46]){
    cylinder(x,3.82,z,.045,1.20,'steel',.045,8);
    tube([x,4.36,z],[x,4.36,z<0?-1.72:1.72],.035,'steel',8);
  }
  for(const x of [-3.86,-2.46])box(x,4.36,0,.07,.07,3.66,'steel');
  // Pipe bridges and valve details are mounted above head height.
  tube([-3.48,2.30,-5.20],[-3.48,2.30,5.20],.045,'rust',8);
  for(const z of [-4.6,-1.95,1.95,4.6]){
    tube([-3.48,2.30,z],[-3.18,2.58,z],.038,'rust',8);
    cylinder(-3.10,2.60,z,.075,.08,'steel',.075,10);
  }
  return finish(k);
}

function bounds(part:CivicPart){
  if(part.kind==='box'||part.kind==='beveledBox'){
    const yaw=part.kind==='beveledBox'?(part.yaw??0):0,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
    const hx=(part.w*c+part.d*s)/2,hz=(part.w*s+part.d*c)/2;
    return {minX:part.x-hx,maxX:part.x+hx,minY:part.y-part.h/2,maxY:part.y+part.h/2,minZ:part.z-hz,maxZ:part.z+hz};
  }
  if(part.kind==='cylinder'){
    const r=Math.max(part.r,part.rb);
    return {minX:part.x-r,maxX:part.x+r,minY:part.y-part.h/2,maxY:part.y+part.h/2,minZ:part.z-r,maxZ:part.z+r};
  }
  return {
    minX:Math.min(part.from[0],part.to[0])-part.radius,maxX:Math.max(part.from[0],part.to[0])+part.radius,
    minY:Math.min(part.from[1],part.to[1])-part.radius,maxY:Math.max(part.from[1],part.to[1])+part.radius,
    minZ:Math.min(part.from[2],part.to[2])-part.radius,maxZ:Math.max(part.from[2],part.to[2])+part.radius,
  };
}

function finish(k:ReturnType<typeof kit>):CivicLandmark {
  // Stable material ordering reduces draw batches and makes audits deterministic.
  const order:CivicMaterial[]=['concrete','stone','steel','rust','dark','black','wood','planks','glass','light','coolLight'];
  k.parts.sort((a,b)=>order.indexOf(a.material)-order.indexOf(b.material));
  const clean=(n:number)=>Math.round(n*1e6)/1e6;
  const raw=k.parts.map(bounds).reduce((a,b)=>({minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY),minZ:Math.min(a.minZ,b.minZ),maxZ:Math.max(a.maxZ,b.maxZ)}));
  const bb={minX:clean(raw.minX),maxX:clean(raw.maxX),minY:clean(raw.minY),maxY:clean(raw.maxY),minZ:clean(raw.minZ),maxZ:clean(raw.maxZ)};
  return {id:k.id,envelope:bb,clearances:{...CLEAR},parts:k.parts,colliders:k.colliders,foundations:k.foundations};
}

export function createCivicLandmark(id:CivicLandmarkId):CivicLandmark {
  if(id==='weathered-bus-shelter')return busShelter();
  if(id==='railway-underpass-bay')return underpass();
  if(id==='closed-floodgate-mechanism')return floodgate();
  return apartmentFacade();
}

export const CIVIC_LANDMARK_IDS:readonly CivicLandmarkId[]=[
  'weathered-bus-shelter','railway-underpass-bay','closed-floodgate-mechanism','apartment-service-facade',
];

/** Emits local parts with an optional cardinal rotation and translation. */
export function buildCivicLandmark(id:CivicLandmarkId,b:CivicBuilder,p:CivicPlacement={}){
  const landmark=createCivicLandmark(id),q=p.quarterTurns??0,angle=q*Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle);
  const ox=p.x??0,oy=p.y??0,oz=p.z??0;
  const point=(x:number,y:number,z:number):[number,number,number]=>[ox+x*cs-z*sn,oy+y,oz+x*sn+z*cs];
  for(const part of landmark.parts){
    if(part.kind==='box'){
      const [x,y,z]=point(part.x,part.y,part.z),swap=q%2===1;
      b.box(x,y,z,swap?part.d:part.w,part.h,swap?part.w:part.d,part.material);
    }else if(part.kind==='cylinder'){
      const [x,y,z]=point(part.x,part.y,part.z);
      b.cylinder(x,y,z,part.r,part.h,part.material,part.rb,part.segments);
    }else if(part.kind==='beveledBox'){
      const [x,y,z]=point(part.x,part.y,part.z);
      // Preserve local dimensions and rotate the geometry basis once. Swapping
      // w/d as well would apply the same quarter turn twice.
      b.add({...part,x,y,z,yaw:(part.yaw??0)+angle},part.material);
    }else{
      b.add({...part,from:point(...part.from),to:point(...part.to)},part.material);
    }
  }
  return landmark;
}

export function civicLandmarkStats(id:CivicLandmarkId){
  const landmark=createCivicLandmark(id),counts={box:0,cylinder:0,beveledBox:0,tube:0},materials=new Set<CivicMaterial>();
  let triangles=0;
  for(const p of landmark.parts){
    counts[p.kind]++;materials.add(p.material);
    triangles+=p.kind==='box'?12:p.kind==='beveledBox'?44:p.kind==='tube'?p.segments*2:p.segments*4;
  }
  return {id,parts:landmark.parts.length,counts,materials:[...materials],materialBatches:materials.size,triangles,colliders:landmark.colliders.length,foundations:landmark.foundations.length,envelope:landmark.envelope,clearances:landmark.clearances};
}

export const CIVIC_LANDMARK_STATS=CIVIC_LANDMARK_IDS.map(civicLandmarkStats);

/** Cardinally transforms collision/foundation metadata for the chosen placement. */
export function placedCivicFootprints(id:CivicLandmarkId,p:CivicPlacement={}){
  const landmark=createCivicLandmark(id),q=p.quarterTurns??0,ox=p.x??0,oy=p.y??0,oz=p.z??0;
  const rect=<T extends CivicCollider|CivicFoundation>(r:T)=>{
    const points=[[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]].map(([x,z])=>{
      for(let i=0;i<q;i++)[x,z]=[-z,x];return [ox+x,oz+z] as const;
    });
    const base:CivicCollider|CivicFoundation=r;
    const y=('topY'in base)?{topY:base.topY+oy}:{minY:base.minY===undefined?undefined:base.minY+oy,maxY:base.maxY===undefined?undefined:base.maxY+oy};
    return {...r,...y,minX:Math.min(...points.map(v=>v[0])),maxX:Math.max(...points.map(v=>v[0])),minZ:Math.min(...points.map(v=>v[1])),maxZ:Math.max(...points.map(v=>v[1]))};
  };
  return {colliders:landmark.colliders.map(rect),foundations:landmark.foundations.map(rect)};
}
