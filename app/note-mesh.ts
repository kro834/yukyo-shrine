import * as THREE from 'three';
import type {Position} from './movement.ts';
export type NotePickup={id:string;position:Position;floor:number;collected:boolean};
/** A tied handscroll floats like the other offerings; faint washi emission
 * keeps it discoverable in darkness without adding a scene light. */
export function createNoteMeshes(scene:THREE.Scene,notes:NotePickup[]){
 const paper=new THREE.MeshStandardMaterial({color:'#e7dcc1',roughness:.92,emissive:'#f1dfb8',emissiveIntensity:.3});
 const lacquer=new THREE.MeshStandardMaterial({color:'#2b1a13',roughness:.38,metalness:.05});
 const cord=new THREE.MeshStandardMaterial({color:'#a3232d',roughness:.6,emissive:'#6d1219',emissiveIntensity:.25});
 const roll=new THREE.CylinderGeometry(.056,.056,.34,18),knob=new THREE.CylinderGeometry(.024,.024,.44,10),tie=new THREE.TorusGeometry(.059,.007,6,20),tail=new THREE.BoxGeometry(.008,.11,.012);
 const items=notes.map(n=>{
  const root=new THREE.Group();root.name='note-pickup';root.position.set(n.position.x,n.floor+1,n.position.z);
  const body=new THREE.Group();body.rotation.z=Math.PI/2;root.add(body);
  body.add(new THREE.Mesh(roll,paper),new THREE.Mesh(knob,lacquer));
  const band=new THREE.Mesh(tie,cord);band.rotation.x=Math.PI/2;body.add(band);
  // The cord ends hang below the knot in world space.
  for(const side of [-1,1]){const end=new THREE.Mesh(tail,cord);end.position.set(side*.014,-.11,.012);end.rotation.z=side*.22;root.add(end);}
  scene.add(root);return root;
 });
 return {
  update(time:number){items.forEach((m,i)=>{m.visible=!notes[i].collected;if(m.visible){m.rotation.y=time*.00045+i*1.7;m.position.y=notes[i].floor+1+Math.sin(time*.0015+i)*.05;}});},
  dispose(){for(const m of items)m.removeFromParent();for(const g of [roll,knob,tie,tail])g.dispose();paper.dispose();lacquer.dispose();cord.dispose();},
 };
}
