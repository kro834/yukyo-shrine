import * as THREE from 'three';
import type {Cell} from './shrine-layout.ts';
import {parallelOpen} from './parallel-world.ts';
/** Local discontinuities above the route, without full-screen flashing or
 * collision changes. Window fragments hold, skip, then settle out of phase. */
export function createParallelAnomalies(scene:THREE.Scene,cells:Cell[],material:THREE.Material){
 const sites=cells.filter(c=>parallelOpen(c.kind)&&(c.x+c.z)%9===0).filter((_,i)=>i%3===0).slice(0,22);
 const geometry=new THREE.BoxGeometry(.78,1.34,.07),mesh=new THREE.InstancedMesh(geometry,material,sites.length*5),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();mesh.name='dislocated-window-fragments';mesh.castShadow=true;mesh.frustumCulled=false;scene.add(mesh);
 return {update(time:number){const t=time/1000;let index=0;for(const c of sites)for(let j=0;j<5;j++){
  const beat=Math.floor(t*.42+j*.71+c.x*.03),skip=Math.sin(beat*91.7+c.z)*.33;
  q.setFromEuler(new THREE.Euler(.12*Math.sin(t*.17+j),c.x*.17+j*.45,Math.sin(t*.21+j)*.18));
  matrix.compose(new THREE.Vector3(c.x*4+(j-2)*.96+skip,6.5+Math.sin(t*.37+j)*.20+(j%2)*.54,c.z*4+Math.sin(j*2.4)*1.4),q,new THREE.Vector3(1,1,1));mesh.setMatrixAt(index++,matrix);
 }mesh.instanceMatrix.needsUpdate=true;},dispose(){mesh.removeFromParent();geometry.dispose();}};
}
