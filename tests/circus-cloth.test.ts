import test from 'node:test';
import assert from 'node:assert/strict';
import {hangingCanvas} from '../app/circus-cloth.ts';

test('hanging canvas fits its existing collision slab at every detail level',()=>{
 for(const width of [1.4,4])for(const height of [2.45,2.79,4.25,6.15])for(const lightweight of [false,true]){
  const g=hangingCanvas(width,height,1.7,.062,lightweight);
  g.computeBoundingBox();const b=g.boundingBox!;
  assert.ok(b.min.x>=-width/2-1e-6&&b.max.x<=width/2+1e-6);
  assert.ok(b.min.y>=0&&b.max.y<=height+1e-6);
  assert.ok(b.min.z>=-.063&&b.max.z<=.063,'cloth must not intrude into the walking strip');
  for(const name of ['position','normal','uv'])assert.ok(Array.from(g.getAttribute(name).array).every(Number.isFinite));
  const p=g.getAttribute('position');let free=0,tied=0;
  for(let i=0;i<p.count;i++){if(p.getY(i)<.01)free=Math.max(free,Math.abs(p.getZ(i)));if(p.getY(i)>height-.01)tied=Math.max(tied,Math.abs(p.getZ(i)));}
  assert.ok(tied<free*.5,'suspension must flatten the top pleats');
  assert.ok(g.index!.count/3<=(lightweight?192:768),'bounded geometry cost per wall');
  g.dispose();
 }
});
