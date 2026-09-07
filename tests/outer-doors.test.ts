import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {OUTER_MEMORY_AREAS} from '../app/outer-areas.ts';

test('nostalgic interiors allow actual door interaction and walking from both sides with no scenery across openings',()=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const themes=new Set(OUTER_MEMORY_AREAS.map(t=>t.id));
 for(const seed of [17,71]){
  const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed,'outer');try{
   w.setMode('gallery');w.scene.updateMatrixWorld(true);
   const rooms=new Set(w.layout.rooms.filter(r=>themes.has(r.themeId??'')).map(r=>r.id));
   const meshes=w.scene.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&!o.matrixAutoUpdate);
   for(const d of w.layout.doors.filter(d=>(d.rooms??[d.room]).some(id=>rooms.has(id))))for(const side of [-1,1]){
    const nx=d.alongX?0:side,nz=d.alongX?side:0;
    w.camera.position.set(d.x+nx,1.68,d.z+nz);w.camera.rotation.y=Math.atan2(nx,nz);
    assert.ok(w.nearDoor(),seed+'/'+d.id+' prompt');assert.ok(w.interact());
    for(let i=0;i<12;i++)w.step(.05);
    for(const y of [.52,1.5,1.68]){
     const from=new THREE.Vector3(d.x+nx,y,d.z+nz),direction=new THREE.Vector3(-nx,0,-nz),ray=new THREE.Raycaster(from,direction,.02,1.98);
     assert.equal(ray.intersectObjects(meshes,false).length,0,seed+'/'+d.id+' rendered opening at '+y);
    }
    for(let i=0;i<5;i++){const p=w.move(-nx,-nz,0,true,.05);w.camera.position.set(p.x,p.y,p.z);}
    assert.ok((w.camera.position.x-d.x)*nx+(w.camera.position.z-d.z)*nz<0,seed+'/'+d.id+' traversable');
    w.camera.position.set(d.x-nx,1.68,d.z-nz);w.camera.rotation.y=Math.atan2(-nx,-nz);assert.ok(w.interact());
    for(let i=0;i<12;i++)w.step(.05);
   }
  }finally{w.dispose();}
 }
});
