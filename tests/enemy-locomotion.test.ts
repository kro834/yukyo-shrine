import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EnemyLocomotion,footCycle,clothSectionValue} from '../app/enemy-locomotion.ts';
import {specialEnemyRig} from '../app/enemy-rigs.ts';
import type {Enemy} from '../app/shrine-gameplay.ts';

const enemy=()=>({position:{x:0,z:0},floor:0,facing:0,brain:{mode:'chase'},traitTime:1.1,investigate:null,patrol:{},flankPoint:null}) as unknown as Enemy;
test('gait follows displacement, settles at a blocked doorway and freezes with simulation time',()=>{
 const motion=new EnemyLocomotion(),e=enemy();motion.sample(e,0);
 for(let i=1;i<=60;i++)motion.sample(e,i*1000/60);
 assert.equal(motion.pose.weight,0,'chase intent alone must not march');
 for(let i=61;i<=120;i++){e.position.z+=8/60;motion.sample(e,i*1000/60);}
 assert.ok(motion.pose.weight>.99);assert.ok(motion.pose.run>.85);
 const held={...motion.pose};for(let i=0;i<30;i++)motion.sample(e,2000);assert.deepEqual(motion.pose,held,'time stop preserves the current foot pose');
 const phase=motion.pose.phase;
 for(let i=121;i<=180;i++)motion.sample(e,i*1000/60);
 assert.equal(motion.pose.phase,phase,'waiting at a door does not continue the step cycle');assert.equal(motion.pose.weight,0);
 e.position.z+=100;motion.sample(e,3016);assert.equal(motion.pose.weight,0,'respawn starts without a giant step');
});
test('walk cadence is stable across 30/60/120 Hz and stun suppresses motion immediately',()=>{
 const results=[];
 for(const fps of [30,60,120]){const motion=new EnemyLocomotion(),e=enemy();motion.sample(e,0);
  for(let i=1;i<=fps*2;i++){e.position.z=3*i/fps;motion.sample(e,i*1000/fps);}results.push({...motion.pose});
  e.brain.mode='stunned';motion.sample(e,2000);assert.equal(motion.pose.weight,0);const frozen={...motion.pose};motion.sample(e,11000);assert.deepEqual(motion.pose,frozen);
 }
 for(const result of results){assert.ok(Math.abs(result.phase-results[0].phase)<1e-9);assert.ok(Math.abs(result.weight-results[0].weight)<1e-9);}
 for(let i=0;i<120;i++){const a=footCycle(i*Math.PI/60,0),b=footCycle(i*Math.PI/60,1);assert.ok(a.lift===0||b.lift===0,'at least one foot supports the body');}
});
test('animated rigs alternate feet without sinking or exceeding corridor clearance',()=>{
 for(const kind of ['mire','warden','fox','pilgrim','hatred','wrath','errorWatch','errorWeep']){
  const material=()=>new THREE.MeshStandardMaterial(),m={cloth:material(),paleCloth:material(),sculpt:material(),skin:material(),mask:material(),black:material(),cord:material()},root=new THREE.Group();
  const rig=specialEnemyRig(root,kind,m,()=>{}),e=enemy(),parts:THREE.Mesh[]=[],v=new THREE.Vector3();root.traverse(o=>{if(o instanceof THREE.Mesh)parts.push(o);});
  const feet=root.getObjectsByProperty('name','tailored-foot');assert.equal(feet.length,2);let alternates=false,maxRadius=0;
  try{rig.animate(e,0);
   for(let i=1;i<=120;i++){
    const speed=i<40?3:i<80?8:16;e.position.z+=speed/60;e.traitTime=i/60;rig.animate(e,i*1000/60);root.updateMatrixWorld(true);
    if(Math.abs(feet[0].position.y-feet[1].position.y)>.012)alternates=true;
    let minY=Infinity;
    for(const mesh of parts){const p=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index;
     for(let j=0;j<(idx?.count??p.count);j++){v.fromBufferAttribute(p,idx?idx.getX(j):j).applyMatrix4(mesh.matrixWorld);maxRadius=Math.max(maxRadius,Math.hypot(v.x,v.z));minY=Math.min(minY,v.y);}
    }
    assert.ok(minY>=-.0001&&minY<.012,`${kind} must retain floor contact, y=${minY}`);
   }
   assert.ok(alternates,`${kind} alternates feet`);assert.ok(maxRadius<=.42,`${kind} moving radius ${maxRadius}`);
   e.brain.mode='stunned';rig.animate(e,2100);const poses=()=>feet.map(o=>o.position.toArray());const before=poses();rig.animate(e,11100);assert.deepEqual(poses(),before);
  }finally{for(const mesh of parts)mesh.geometry.dispose();Object.values(m).forEach(m=>m.dispose());}
 }
});
test('cloth cross-sections retain bounds and continuous shoulder slopes',()=>{
 const s=[{y:0,rx:.2,rz:.1},{y:.4,rx:.24,rz:.14},{y:.7,rx:.18,rz:.11},{y:1,rx:.05,rz:.04}];
 for(let i=0;i<100;i++){const y=i/100,v=clothSectionValue(s,y,'rx');assert.ok(v>=.05&&v<=.24);}
 for(const y of [.4,.7]){const h=1e-5,left=(clothSectionValue(s,y,'rx')-clothSectionValue(s,y-h,'rx'))/h,right=(clothSectionValue(s,y+h,'rx')-clothSectionValue(s,y,'rx'))/h;assert.ok(Math.abs(left-right)<.001);}
});
