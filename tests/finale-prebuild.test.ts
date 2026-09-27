import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {DEFAULTS} from '../app/preferences.ts';
test('both final pursuers are built hidden at load, so the finale frame constructs no rig',()=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},render(){},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,17);
 try{
  w.configure({...DEFAULTS,quality:'low'});w.setMode('normal');w.render(0);
  const rigs=()=>w.scene.children.filter(o=>o.name.startsWith('horror-')).length,before=rigs();
  for(const kind of ['hatred','wrath'])assert.equal(w.scene.children.filter(o=>o.name==='horror-'+kind&&!o.visible).length,1,kind);
  const gold=w.scene.children.find(o=>o.name==='magatama-gold-yokocho')!;w.camera.position.set(gold.position.x,1.68,gold.position.z);w.step(.05);
  assert.ok(w.finale);w.render(16);assert.equal(rigs(),before,'no rig is added when the finale begins');
  assert.equal(w.scene.children.filter(o=>o.name==='horror-'+w.finale&&o.visible).length,1);
 }finally{w.dispose();}
});
