import * as THREE from 'three';
import type {Doors} from './shrine-gameplay.ts';
import {surfaceUV} from './surface-uv.ts';
import {chamferedBox} from './chamfered-box.ts';
/** Real-size hinged leaves share their hinge and dimensions with hotelLeafBounds. */
export function hotelDoors(scene:THREE.Scene,doors:Doors,paint:THREE.Material,wood:THREE.Material,brass:THREE.Material){
 const geometry=new Set<THREE.BufferGeometry>();
 const put=(root:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{const g=chamferedBox(w,h,d,.008).translate(x,y,z);surfaceUV(g,.35);geometry.add(g);const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;root.add(m);};
 const panels=doors.states.map(d=>{const root=new THREE.Group(),leaf=new THREE.Group(),width=d.spec.opening??1.35;root.name='hotel-room-door';root.position.set(d.spec.x,d.spec.floor??0,d.spec.z);root.rotation.y=d.spec.alongX?0:Math.PI/2;scene.add(root);
  for(const s of [-1,1]){const span=(4-width)/2;put(root,s*(width/2+span/2),1.55,0,span,3.1,.28,paint);put(root,s*(width/2+.037),1.15,.08,.075,2.30,.16,wood);}
  put(root,0,2.72,0,width,.76,.28,paint);put(root,0,2.32,0,width+.15,.085,.22,wood);
  leaf.position.x=-width/2;root.add(leaf);put(leaf,width/2,1.13,0,width-.018,2.26,.065,wood);
  for(const z of [-.045,.045]){put(leaf,width-.13,1.08,z,.045,.14,.03,brass);put(leaf,width-.19,1.07,z*1.4,.15,.025,.027,brass);}
  return {root,leaf,d};
 });
 return {setQuality(_quality:string){},update(viewer?:{x:number;z:number},range=90){for(const p of panels){p.root.visible=!viewer||Math.hypot(p.d.spec.x-viewer.x,p.d.spec.z-viewer.z)<range;p.leaf.rotation.y=-p.d.progress*Math.PI/2;}},dispose(_geometry=true){for(const p of panels)p.root.removeFromParent();geometry.forEach(g=>g.dispose());}};
}
