import test from 'node:test';
import assert from 'node:assert/strict';
import {SECOND_DECK,THIRD_DECK,HIGH_STAIRS,highRails,highCaps,deckFurnitureWalls,deckTheme} from '../app/vertical-layout.ts';
import {UPPER_HEIGHT,STAIRS,upperBarriers,upperPartitions,stairRails,upperDoors,floorHeightAt} from '../app/annex.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {movePlayer} from '../app/movement.ts';
const upper=[...SECOND_DECK.walls,...deckFurnitureWalls(4.8),...highRails,...upperBarriers,...upperPartitions,...stairRails,...new Doors(upperDoors).framesFor(4.8)];
const third=[...THIRD_DECK.walls,...deckFurnitureWalls(9.6),...highRails,...highCaps];
test('both new storeys have large connected loops and alternate short themed sections',()=>{
 for(const [deck,level] of [[SECOND_DECK,1],[THIRD_DECK,2]] as const){assert.ok(deck.cells.length>600);const queue=[deck.cells[0]],seen=new Set([queue[0].x+','+queue[0].z]);for(let i=0;i<queue.length;i++){const c=queue[i];const next=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>deck.grid.get((c.x+dx)+','+(c.z+dz))).filter(c=>!!c);assert.ok(next.length>=2||c.z<13,`${level}: dead end ${c.x},${c.z}`);for(const n of next)if(!seen.has(n.x+','+n.z)){seen.add(n.x+','+n.z);queue.push(n);}}assert.equal(seen.size,deck.cells.length);assert.notEqual(deckTheme({x:0,z:60},level),deckTheme({x:24,z:60},level));}
});
test('both high staircases can be climbed and descended without teleporting or falling',()=>{
 for(const s of HIGH_STAIRS){let p={x:(s.minX+s.maxX)/2,z:s.minZ-2},height=4.8;for(let i=0;i<65;i++){p=movePlayer(p,0,1,0,true,.05,height>=9.3?third:upper);const next=floorHeightAt(p,height);assert.ok(Math.abs(next-height)<.2);height=next;}assert.equal(height,9.6);assert.ok(p.z>s.maxZ);for(let i=0;i<65;i++){p=movePlayer(p,0,-1,0,true,.05,height>=9.3?third:upper);const next=floorHeightAt(p,height);assert.ok(Math.abs(next-height)<.2);height=next;}assert.equal(height,4.8);assert.ok(p.z<s.minZ);}
});
test('enemy hears on third floor, climbs there, and can descend after a second-floor sound',()=>{
 const l=createLayout(),e=new Enemies(l.cells,l.obstacles),a=e.actors[1];e.actors=[a];a.position={x:44,z:100};a.floor=4.8;assert.equal(e.hear({x:44,z:132},9.6),1);for(let i=0;i<500;i++)e.update(.05,{x:-1000,z:-1000},l.obstacles,0,upper,false,third);assert.equal(a.floor,9.6);assert.ok(a.position.z>=124);assert.equal(e.hear({x:44,z:100},4.8),1);for(let i=0;i<800&&a.floor>4.8;i++)e.update(.05,{x:-1000,z:-1000},l.obstacles,0,upper,false,third);assert.equal(a.floor,4.8);
});




test('furnished navigation stays connected across each upper storey and the annex bridge',()=>{
 const l=createLayout(),e=new Enemies(l.cells,l.obstacles) as unknown as {upperNodes:Map<string,unknown>;upperGraph:Map<string,string[]>;thirdNodes:Map<string,unknown>;thirdGraph:Map<string,string[]>};
 for(const [nodes,graph] of [[e.upperNodes,e.upperGraph],[e.thirdNodes,e.thirdGraph]] as const){const first=nodes.keys().next().value!,queue=[first],seen=new Set(queue);for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i])??[])if(!seen.has(n)){seen.add(n);queue.push(n);}assert.equal(seen.size,nodes.size);}
});

