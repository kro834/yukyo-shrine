import * as THREE from 'three';

// Navigation uses local storey height; this shared terrain datum places every
// rendered floor, actor and fixture on the same five mountain terraces.
export function mountainHeight(z:number){
 let y=0;
 for(const midpoint of [-114,-38,38,114]){
  const t=Math.max(0,Math.min(1,(z-midpoint+10)/20));
  y+=6*t*t*(3-2*t);
 }
 return y;
}
export function mountainGrade(z:number){
 let d=0;for(const midpoint of [-114,-38,38,114]){const t=(z-midpoint+10)/20;if(t>0&&t<1)d+=1.8*t*(1-t);}return d;
}
export function mountainGeometry(g:THREE.BufferGeometry){
 if(g.userData.mountainTerrain)return g;
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+mountainHeight(p.getZ(i)));
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.mountainTerrain=true;return g;
}

/** A render transaction keeps local physics coordinates stable between frames.
 * Static terrain is baked once; movable roots and lights receive their own datum.
 * Restoring in finally prevents cumulative elevation or changing input behaviour.
 */
export function mountainRender(scene:THREE.Scene,camera:THREE.Camera,beam:THREE.SpotLight){
 const restored:{object:THREE.Object3D;y:number}[]=[],mat=new THREE.Matrix4();
 const lift=(object:THREE.Object3D,height:number)=>{restored.push({object,y:object.position.y});object.position.y+=height;object.updateMatrix();object.updateMatrixWorld(true);};
 for(const o of scene.children){
  if(o.userData.mountainTerrain||o===beam||o===beam.target||o===camera||o.name==='airborne-dust')continue;
  if(o instanceof THREE.DirectionalLight||o instanceof THREE.HemisphereLight)continue;
  if(o instanceof THREE.InstancedMesh){
   if(!o.userData.mountainLifted){for(let i=0;i<o.count;i++){o.getMatrixAt(i,mat);mat.elements[13]+=mountainHeight(mat.elements[14]);o.setMatrixAt(i,mat);}o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();o.userData.mountainLifted=true;}
   continue;
  }
  if(o instanceof THREE.Points){if(!o.geometry.userData.mountainTerrain)mountainGeometry(o.geometry);continue;}
  // Root groups of all actors, doors, pickups and the altar are local to a site.
  lift(o,mountainHeight(o.position.z));
 }
 const base=mountainHeight(camera.position.z);lift(camera,base);lift(beam,base);lift(beam.target,base);
 return ()=>{for(const {object,y} of restored){object.position.y=y;object.updateMatrix();object.updateMatrixWorld(true);}};
}
