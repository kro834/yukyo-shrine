import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {GraphicsQuality} from './preferences.ts';
import type {ShrubPlacement} from './shrub-placement.ts';
import {propTransform} from './scanned-props.ts';
import {finiteFixture} from './finite-fixture.ts';

export const SHRUB_LIMITS={low:{count:6,range:20},medium:{count:12,range:28},high:{count:20,range:34},ultra:{count:24,range:38}} as const;
type Part={mesh:THREE.InstancedMesh;normal:THREE.Texture|null;roughness:THREE.Texture|null};
/** Four botanical shapes share one texture set. Only the closest small subset
 * draws, independent of stage size; mobile is capped at six shrubs. */
export class ShrubMeshes{
 readonly ready:Promise<void>;
 private parts:Part[]=[];private textures=new Set<THREE.Texture>();private disposed=false;
 private quality:GraphicsQuality='low';private viewer=new THREE.Vector3();
 private scene:THREE.Scene;private placements:ShrubPlacement[];private mobile:boolean;
 constructor(scene:THREE.Scene,placements:ShrubPlacement[],mobile:boolean,enabled=true){
  this.scene=scene;this.placements=placements;this.mobile=mobile;
  this.ready=enabled&&placements.length?this.load():Promise.resolve();
 }
 private async load(){
  let root:THREE.Group|undefined,alpha:THREE.Texture|undefined;
  try{
   // Keep both results even if either load fails, so partial loads can be freed.
   const results=await Promise.allSettled([new GLTFLoader().loadAsync('/models/shrub/shrub_02_1k.gltf'),new THREE.TextureLoader().loadAsync('/models/shrub/textures/shrub_02_alpha_1k.png')]);
   if(results[0].status==='fulfilled')root=results[0].value.scene;
   if(results[1].status==='fulfilled')alpha=results[1].value;
   if(!root||!alpha)throw new Error('Incomplete shrub resources');
   root.updateMatrixWorld(true);alpha.flipY=false;this.textures.add(alpha);
   const source:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)source.push(o);});
   for(const o of source){
    const original=o.material as THREE.MeshStandardMaterial;
    for(const value of Object.values(original))if(value instanceof THREE.Texture)this.textures.add(value);
    if(this.disposed)continue;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.computeBoundingBox();
    g.applyMatrix4(propTransform(g.boundingBox!,{width:1.1,height:.85,depth:1.1}));g.computeBoundingSphere();
    const m=original.clone();m.alphaMap=alpha;m.alphaTest=.5;m.transparent=false;m.side=THREE.DoubleSide;m.metalness=0;m.metalnessMap=null;m.roughness=.9;
    finiteFixture(m);for(const t of [m.map,m.normalMap,m.roughnessMap,alpha])if(t)t.anisotropy=2;
    const mesh=new THREE.InstancedMesh(g,m,24);mesh.count=0;mesh.name='bank-shrubs';mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;
    this.parts.push({mesh,normal:m.normalMap,roughness:m.roughnessMap});this.scene.add(mesh);
   }
   this.setQuality(this.quality);
  }catch(error){if(!this.disposed)console.warn('Shrub detail unavailable; existing grass retained',error);}
  finally{
   if(root){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)this.textures.add(v);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
   if(alpha)this.textures.add(alpha);
   if(this.disposed||!this.parts.length)this.releaseTextures();
  }
 }
 setQuality(quality:GraphicsQuality){
  this.quality=this.mobile?'low':quality;
  for(const p of this.parts){const m=p.mesh.material as THREE.MeshStandardMaterial,detail=this.quality==='high'||this.quality==='ultra';
   m.normalMap=detail?p.normal:null;m.roughnessMap=this.quality==='low'?null:p.roughness;m.needsUpdate=true;
  }
  this.update(this.viewer);
 }
 update(viewer:{x:number;y?:number;z:number}){
  this.viewer.set(viewer.x,viewer.y??1.68,viewer.z);if(!this.parts.length)return;
  const limit=SHRUB_LIMITS[this.quality],selected=this.placements.map(p=>({p,d:Math.hypot(p.x-viewer.x,p.z-viewer.z)})).filter(q=>q.d<limit.range).sort((a,b)=>a.d-b.d).slice(0,limit.count);
  for(const part of this.parts)part.mesh.count=0;
  const matrix=new THREE.Matrix4();
  for(const {p,d} of selected){
   // Low uses the two lightest source variants (about 5.2k triangles each).
   const variant=this.quality==='low'?(p.variant%2?3:1):p.variant,part=this.parts[variant%this.parts.length];
   const scale=THREE.MathUtils.smoothstep(limit.range-d,0,3);
   matrix.makeRotationY(p.yaw).scale(new THREE.Vector3(scale,scale,scale));matrix.setPosition(p.x,p.y,p.z);part.mesh.setMatrixAt(part.mesh.count++,matrix);
  }
  for(const p of this.parts){p.mesh.visible=p.mesh.count>0;p.mesh.instanceMatrix.needsUpdate=true;}
 }
 private releaseTextures(){for(const t of this.textures){t.dispose();(t.image as {close?:()=>void}|undefined)?.close?.();}this.textures.clear();}
 dispose(){this.disposed=true;for(const p of this.parts){p.mesh.removeFromParent();p.mesh.dispose();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();}this.parts=[];this.releaseTextures();}
}
