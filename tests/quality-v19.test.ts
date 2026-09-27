import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSectorLayout} from '../app/sector-layout.ts';
import {BOUNDS} from '../app/movement.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';
import {createWorld} from '../app/shrine-world.ts';

test('5 by5 shuffled sectors retain87 chambers,30 themes,13 blue chambers and all40 neighboring connections',()=>{
 const arrangements=new Set<string>();
 for(let seed=1;seed<=120;seed++){
  const l=createSectorLayout(seed);assert.equal(l.sectors.length,25);assert.equal(l.rooms.length,87);assert.equal(l.rooms.filter(r=>r.bead).length,13);assert.equal(new Set(l.rooms.filter(r=>r.themeId).map(r=>r.themeId)).size,30);
  arrangements.add(l.sectors.map(s=>s.kind+':'+s.rotation+':'+s.variant).join(','));
  for(let i=0;i<25;i++){const s=l.sectors[i],cx=(s.col-2)*19,cz=(s.row-2)*19;
   if(s.col<4){if(i!==12)assert.notEqual(s.kind,l.sectors[i+1].kind,`seed${seed} horizontal repeat`);for(let x=cx+8;x<=cx+11;x++)assert.ok(l.grid.has(x+','+cz));}
   if(s.row<4){assert.notEqual(s.kind,l.sectors[i+5].kind,`seed${seed} vertical repeat`);for(let z=cz+8;z<=cz+11;z++)assert.ok(l.grid.has(cx+','+z));}
  }
  for(const r of l.rooms)assert.ok(l.doors.filter(d=>d.room===r.id||d.rooms?.includes(r.id)).length>=2,`seed${seed} room${r.id}`);
  if(seed<=20){const seen=new Set(['0,0']),queue=['0,0'];for(let i=0;i<queue.length;i++){const c=l.grid.get(queue[i])!;let degree=0;for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const key=(c.x+dx)+','+(c.z+dz);if(!l.grid.has(key))continue;degree++;if(!seen.has(key)){seen.add(key);queue.push(key);}}assert.ok(degree>=2,`seed${seed} dead end${queue[i]}`);assert.ok(c.x*4-2>=BOUNDS.minX&&c.x*4+2<=BOUNDS.maxX&&c.z*4-2>=BOUNDS.minZ&&c.z*4+2<=BOUNDS.maxZ);}assert.equal(seen.size,l.cells.length);}
 }
 assert.equal(arrangements.size,120);
});

test('PBR details load only on High; callbacks cannot restore maps after switching to Low, and late disposal is safe',()=>{
 const callbacks=new Map<string,(t:THREE.Texture)=>void>(),requested:string[]=[];
 const loader={load(url:string,callback:(t:THREE.Texture)=>void){requested.push(url);callbacks.set(url,callback);return new THREE.Texture();}} as THREE.TextureLoader;
 const g=globalThis as unknown as Record<string,unknown>;g.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})};
 const m=new THREE.MeshStandardMaterial(),library=new SurfaceLibrary([m],16,loader);
 library.add('diff',[m],{normal:'normal',roughness:'rough'});library.setQuality('low');callbacks.get('diff')!(new THREE.Texture({}));
 assert.deepEqual(requested,['diff']);assert.equal((m.map!.image as {width:number}).width,256);assert.equal(m.normalMap,null);assert.equal(m.roughnessMap,null);
 library.setQuality('high');assert.deepEqual(requested,['diff','normal','rough']);library.setQuality('low');callbacks.get('normal')!(new THREE.Texture({}));callbacks.get('rough')!(new THREE.Texture({}));assert.equal(m.normalMap,null);assert.equal(m.roughnessMap,null);assert.equal((m.map!.image as {width:number}).width,256);
 library.setQuality('high');assert.ok(m.normalMap);assert.ok(m.roughnessMap);assert.equal((m.normalMap as THREE.Texture).colorSpace,THREE.NoColorSpace);assert.equal((m.roughnessMap as THREE.Texture).colorSpace,THREE.NoColorSpace);assert.equal(m.map!.colorSpace,THREE.SRGBColorSpace);assert.equal(requested.length,3);
 library.setQuality('medium');assert.equal(m.normalMap,null);assert.equal(m.roughnessMap,null);library.dispose();
 const late=new THREE.Texture();let disposed=0;late.addEventListener('dispose',()=>disposed++);callbacks.get('normal')!(late);assert.equal(disposed,1);
});

test('rendered upper walkways and high stairs have no opaque ground walls or low hanging lights',()=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 for(const seed of [1,17,71]){const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);try{
  world.scene.updateMatrixWorld(true);
  const meshes=world.scene.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&!o.matrixAutoUpdate);
  for(const [a,b]of [[[72,6.48,52],[76,6.48,52]],[[-100,6.48,68],[-100,6.48,72]],[[-52,8.0,110],[-52,8.8,114]],[[44,8.8,114],[44,9.6,118]]] as [number[],number[]][]){const from=new THREE.Vector3(...a as [number,number,number]),to=new THREE.Vector3(...b as [number,number,number]),direction=to.clone().sub(from),ray=new THREE.Raycaster(from,direction.clone().normalize(),.01,direction.length());const hits=ray.intersectObjects(meshes,false);assert.equal(hits.length,0,`seed${seed} scenery crosses route${a} to${b}`);}
  world.setMode('gallery');assert.equal(world.burst(),null);assert.equal(world.stopTime(),false);assert.equal(world.useMirror(),false);assert.equal(world.nearAltar(),false);
 }finally{world.dispose();}}
});
