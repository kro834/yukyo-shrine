import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chooseReadableMagatama,collectMagatama,placeRedMagatama,type Bead} from '../app/magatama.ts';
import {createMagatamaMeshes} from '../app/magatama-mesh.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {RED_AREAS} from '../app/area-rules.ts';
import type {Cell} from '../app/shrine-layout.ts';
import type {Position} from '../app/movement.ts';

void test('readable placement stays randomized within a broad clear approach pool and consumes one draw',()=>{
 const open=[0,20,40,60].map(x=>({x,z:0})),isolated={x:80,z:0},blocked={x:100,z:0};
 const nodes=[...open.flatMap(p=>[p,...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>({x:p.x+dx*4,z:p.z+dz*4}))]),isolated,blocked];
 const walls=[{minX:99.8,maxX:100.2,minZ:-.2,maxZ:.2}],candidates=[isolated,blocked,...open];
 const run=(seed:number)=>{const random=seededRandom(seed);return Array.from({length:24},()=>chooseReadableMagatama(candidates,nodes,walls,random));};
 const result=run(52);assert.deepEqual(result,run(52));assert.notDeepEqual(result,run(53));assert.equal(new Set(result.map(p=>p.x)).size,4);
 for(const p of result)assert.ok(open.some(o=>o.x===p.x&&o.z===p.z));
 let draws=0;chooseReadableMagatama(candidates,nodes,walls,()=>{draws++;return .5;});assert.equal(draws,1);
 assert.throws(()=>chooseReadableMagatama([blocked],nodes,walls,()=>0),/No accessible/);
});

void test('walls and player width prevent approaches through blocked doorways from gaining preference',()=>{
 const good=[0,20,40,60].map(x=>({x,z:20})),hidden={x:100,z:20},candidates=[hidden,...good];
 const nodes=candidates.flatMap(p=>[p,{x:p.x-4,z:p.z},{x:p.x+4,z:p.z}]);
 const walls=[{minX:97.9,maxX:98.1,minZ:19.8,maxZ:20.2},{minX:101.9,maxX:102.1,minZ:20.2,maxZ:22}];
 // The second wall misses the center ray by 20 cm, but leaves too little room
 // for the player's 42 cm radius. Both advertised approaches are unusable.
 assert.deepEqual(chooseReadableMagatama(candidates,nodes,walls,()=>0),good[0]);
 const sparse=[hidden,good[0]];assert.deepEqual(chooseReadableMagatama(sparse,nodes,walls,()=>0),hidden,'one good junction must not force a fixed location in a sparse zone');
});

void test('red placements retain one randomized candidate inside every existing red area',()=>{
 const cells:Cell[]=[],nodes:Position[]=[];
 for(const [i,kind] of RED_AREAS.entries())for(let x=0;x<4;x++)for(let z=0;z<3;z++){cells.push({x:i*10+x,z,h:4,kind});nodes.push({x:(i*10+x)*4,z:z*4});}
 const first=placeRedMagatama(cells,nodes,[],seededRandom(32));
 assert.equal(first.length,RED_AREAS.length);assert.deepEqual(first,placeRedMagatama(cells,nodes,[],seededRandom(32)));
 assert.notDeepEqual(first,placeRedMagatama(cells,nodes,[],seededRandom(99)));
 for(const [i,bead] of first.entries()){assert.equal(bead.id,'red-'+RED_AREAS[i]);assert.equal(bead.color,'red');assert.equal(bead.floor,0);assert.ok(cells.some(c=>c.kind===RED_AREAS[i]&&c.x*4===bead.position.x&&c.z*4===bead.position.z));}
});

const beads=():Bead[]=>['blue','red','gold'].map((color,i)=>({id:color,position:{x:i*3,z:0},floor:0,collected:false,color:color as Bead['color'],offered:false}));

void test('red is modestly larger and brighter while gold halo stays depth-tested, local and cheap',()=>{
 const scene=new THREE.Scene(),items=beads(),visuals=createMagatamaMeshes(scene,items);
 const [blue,red,gold]=items.map(b=>scene.getObjectByName('magatama-'+b.id) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshPhysicalMaterial>);
 assert.equal(blue.scale.x,1);assert.equal(blue.material.emissiveIntensity,.55);assert.equal(blue.material.color.getHexString(),'367bb8');
 assert.equal(red.scale.x,1.2);assert.equal(red.material.emissiveIntensity,.72);assert.equal(gold.scale.x,2.4);
 const halo=gold.getObjectByName('magatama-gold-halo') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 assert.equal(halo.geometry.index!.count/3,2);assert.equal(halo.material.depthTest,true);assert.equal(halo.material.depthWrite,false);assert.equal(halo.castShadow,false);assert.equal(halo.receiveShadow,false);assert.equal(halo.layers.mask,1);assert.equal(halo.renderOrder,0);
 assert.match(halo.material.fragmentShader,/exp\(-fogDensity\*fogDensity\*vFogDepth\*vFogDepth\)/);
 assert.equal(blue.children.length,0);assert.equal(red.children.length,0);
 scene.traverse(o=>assert.ok(!(o instanceof THREE.Light),'readability adds no scene illumination or shadow pass'));
 visuals.update(0);const initial=gold.material.emissiveIntensity;visuals.update(Math.PI/2/.00125);assert.ok(gold.material.emissiveIntensity>initial);assert.ok(halo.material.uniforms.haloOpacity.value<=.125);
 visuals.update(Math.PI*1.5/.00125);assert.ok(gold.material.emissiveIntensity>=.61);assert.ok(halo.material.uniforms.haloOpacity.value>=.075);
 items[2].collected=true;visuals.update(2000);assert.equal(gold.visible,false);assert.equal(blue.material.emissiveIntensity,.55);
 visuals.dispose();assert.equal(scene.children.length,0);
});

void test('visual changes keep collection radius and wall blocking intact for red and gold',()=>{
 for(const color of ['red','gold'] as const){
  const bead:Bead={id:color,position:{x:0,z:0},floor:0,collected:false,color,offered:false};
  assert.equal(collectMagatama([bead],{x:1.15,z:0},0,[]),0);
  assert.equal(collectMagatama([bead],{x:1,z:0},0,[{minX:.4,maxX:.6,minZ:-2,maxZ:2}]),0);
  assert.equal(collectMagatama([bead],{x:1,z:0},4.8,[]),0);
  assert.equal(collectMagatama([bead],{x:1,z:0},0,[]),1);
 }
});
