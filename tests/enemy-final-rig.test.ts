import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {specialEnemyRig} from '../app/enemy-rigs.ts';
import type {Enemy} from '../app/shrine-gameplay.ts';

const materials=()=>{
 const material=()=>new THREE.MeshStandardMaterial();
 return {cloth:material(),paleCloth:material(),sculpt:material(),skin:material(),mask:material(),black:material(),cord:material()};
};
function make(kind:'hatred'|'wrath'){
 const root=new THREE.Group(),m=materials(),rig=specialEnemyRig(root,kind,m,()=>{});
 const enemy={brain:{mode:'chase'},traitTime:0,investigate:false,patrol:null,flankPoint:null} as unknown as Enemy;
 const named=(name:string)=>{const item=root.getObjectByName(name);assert.ok(item,`missing ${name}`);return item;};
 const dispose=()=>{root.traverse(item=>{if(item instanceof THREE.Mesh)item.geometry.dispose();});Object.values(m).forEach(material=>material.dispose());};
 return {root,rig,enemy,named,dispose};
}

test('Hatred keeps its multi-mask frame but advances head and articulated hands during a chase',()=>{
 const item=make('hatred');
 try{
  item.enemy.traitTime=.85;item.rig.animate(item.enemy,850);item.root.updateMatrixWorld(true);
  const upper=item.named('tailored-upper'),head=item.named('tailored-head'),forearms=item.root.getObjectsByProperty('name','hatred-articulated-forearm'),arms=item.root.getObjectsByProperty('name','tailored-arm');
  assert.ok(upper.rotation.x>.015,'Hatred leans into its local +Z target direction');
  assert.ok(Math.abs(head.rotation.y)>.04,'Hatred turns its head after the body has faced the target');
  assert.equal(forearms.length,2);assert.ok(forearms.every(arm=>arm.rotation.x<-.02),'both elbows extend as separate articulated joints');
  assert.ok(arms.every(arm=>arm.rotation.x<-.01));
 }finally{item.dispose();}
});

test('Wrath has visibly distinct windup, rush, and recovery poses',()=>{
 const item=make('wrath');
 try{
  const upper=item.named('tailored-upper'),arm=()=>item.root.getObjectByName('tailored-arm')!;
  const headZ=()=>{item.root.updateMatrixWorld(true);return item.named('tailored-head').getWorldPosition(new THREE.Vector3()).z;};
  item.enemy.traitTime=.25;item.rig.animate(item.enemy,250);const windup={lean:upper.rotation.x,arm:arm().rotation.x,headZ:headZ()};
  item.enemy.traitTime=1.1;item.rig.animate(item.enemy,1100);const rush={lean:upper.rotation.x,arm:arm().rotation.x,headZ:headZ()};
  item.enemy.traitTime=2.5;item.rig.animate(item.enemy,2500);const recover={lean:upper.rotation.x,arm:arm().rotation.x};
  assert.ok(windup.lean<-.04&&windup.arm>.035,'windup draws the torso and hands away from local +Z');
  assert.ok(rush.lean>.09&&rush.arm<-.10,'rush throws torso and hands toward local +Z');
  assert.ok(rush.headZ>windup.headZ+.10,'the actual head moves at least 10 cm toward the player between windup and rush');
  assert.ok(recover.lean>0&&recover.lean<rush.lean&&recover.arm>0&&recover.arm<windup.arm,'recovery settles without repeating the windup');
 }finally{item.dispose();}
});

test('finale rig stun pose is time-invariant and remains inside its existing draw budget',()=>{
 for(const kind of ['hatred','wrath'] as const){
 const item=make(kind);
  try{
   assert.equal(item.root.getObjectsByProperty('isLight',true).length,0,`${kind} adds no lighting budget`);
   item.enemy.traitTime=1.1;item.enemy.brain.mode='stunned';item.rig.animate(item.enemy,0);
   const snapshot=()=>['tailored-upper','tailored-head','tailored-arm','hatred-articulated-forearm'].flatMap(name=>item.root.getObjectsByProperty('name',name)).map(node=>[node.rotation.x,node.rotation.y,node.rotation.z,node.position.x,node.position.y,node.position.z]);
   const before=snapshot();item.rig.animate(item.enemy,12500);assert.deepEqual(snapshot(),before,`${kind} must stay motionless during the nine-second stun`);
   let triangles=0;item.root.traverse(node=>{if(node instanceof THREE.Mesh)triangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;});
   assert.ok(triangles<= (kind==='hatred'?23000:14000),`${kind} triangle budget`);
  }finally{item.dispose();}
 }
});
