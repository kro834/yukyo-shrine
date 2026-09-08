import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {specialEnemyRig} from '../app/enemy-rigs.ts';
import type {Enemy} from '../app/shrine-gameplay.ts';

test('layered rigs stay inside the navigation radius throughout pursuit and stun while their soles remain grounded',()=>{
 for(const kind of ['mire','warden','fox','pilgrim','hatred','wrath','parallax','crusher']){
  const material=()=>new THREE.MeshStandardMaterial(),m={cloth:material(),paleCloth:material(),sculpt:material(),skin:material(),mask:material(),black:material(),cord:material()},root=new THREE.Group();
  const rig=specialEnemyRig(root,kind,m,()=>{}),parts:{mesh:THREE.Mesh;used:number[]}[]=[];
  root.traverse(o=>{if(o instanceof THREE.Mesh){const g=o.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),used=g.index?[...new Set(Array.from(g.index.array as ArrayLike<number>))]:Array.from({length:p.count},(_,i)=>i);
   for(const i of used){assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.5);assert.ok(Number.isFinite(uv.getX(i)+uv.getY(i)));}
   parts.push({mesh:o,used});
  }});
  const e={brain:{mode:'chase'},traitTime:0,investigate:false,patrol:{},flankPoint:{x:1,z:1}} as unknown as Enemy,v=new THREE.Vector3();
  for(let i=0;i<36;i++){
   e.traitTime=i*.17;e.brain.mode=i%7===0?'stunned':'chase';rig.animate(e,i*233);root.updateMatrixWorld(true);let radius=0,minY=Infinity;
   for(const {mesh,used} of parts){const p=mesh.geometry.getAttribute('position');for(const j of used){v.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);radius=Math.max(radius,Math.hypot(v.x,v.z));minY=Math.min(minY,v.y);}}
   assert.ok(radius<=.42,kind+' radius '+radius);assert.ok(minY>=0&&minY<=.009,kind+' sole '+minY);
  }
  for(const {mesh} of parts)mesh.geometry.dispose();Object.values(m).forEach(m=>m.dispose());
 }
});
