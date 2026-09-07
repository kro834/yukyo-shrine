import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaveSurfaces} from '../app/cave-surfaces.ts';
import {encloseLayout} from '../app/layout-envelope.ts';
import type {Cell} from '../app/shrine-layout.ts';

test('cave vaults join without cracks, seal their floor skirts, and respect the upper-deck cap',()=>{
 const cells:Cell[]=[],grid=new Map<string,Cell>();
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){const c:Cell={x,z,h:x===1?4.8:3.25,kind:'cave'};cells.push(c);grid.set(x+','+z,c);}
 const {walls}=encloseLayout(grid,[]);
 for(const detail of ['low','high'] as const){
  const cave=createCaveSurfaces(cells,walls,17,{detail,ceilingLimit:()=>4.5}),edges=new Map<string,{y:number;normal:number[];uv:number[]}>();
  for(const c of cells){const g=cave.roof(c),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
   for(let i=0;i<p.count;i++){
    assert.ok(p.getY(i)>=Math.min(c.h,4.5)-.000001&&p.getY(i)<=4.500001);assert.ok(n.getY(i)<0);
    const key=p.getX(i).toFixed(5)+','+p.getZ(i).toFixed(5),sample={y:p.getY(i),normal:[n.getX(i),n.getY(i),n.getZ(i)],uv:[uv.getX(i),uv.getY(i)]};
    if(edges.has(key))assert.deepEqual(sample,edges.get(key));else edges.set(key,sample);
   }g.dispose();
  }
  for(const w of walls){const g=cave.wall(w),p=g.getAttribute('position');let floor=0,buried=0;
   for(let i=0;i<p.count;i++){const inward=(p.getX(i)-w.x)*w.insideX+(p.getZ(i)-w.z)*w.insideZ;
    assert.ok(inward<=.000001&&inward>=-.65);assert.ok(p.getY(i)<=4.500001);
    if(Math.abs(p.getY(i))<.000001){assert.ok(Math.abs(inward)<.000001);floor++;}if(p.getY(i)<-.1)buried++;
   }
   assert.equal(floor,cave.wallSegments+1);assert.equal(buried,cave.wallSegments+1);g.dispose();
  }
 }
});
