import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {GraphicsQuality} from './preferences.ts';

export type ScannedKind='chair'|'stool'|'vase';
export type ScannedPlacement={kind:ScannedKind;x:number;y:number;z:number;yaw:number};
export const SCANNED_SPECS={
 chair:{url:'/models/chair/WoodenChair_01_1k.gltf',width:.72,height:1.95,depth:.73},
 stool:{url:'/models/stool/chinese_stool_1k.gltf',width:.55,height:.52,depth:.55},
 vase:{url:'/models/vase/antique_ceramic_vase_01_1k.gltf',width:.28,height:.46,depth:.28},
} as const;

/** Fit uniformly, retaining real proportions and placing the lowest point on the floor. */
export function propTransform(bounds:THREE.Box3,spec:{width:number;height:number;depth:number}){
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid prop bounds');
 const scale=Math.min(spec.width/size.x,spec.height/size.y,spec.depth/size.z);
 return new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
}
export function propFootprint(p:ScannedPlacement){
 const s=SCANNED_SPECS[p.kind],c=Math.abs(Math.cos(p.yaw)),n=Math.abs(Math.sin(p.yaw)),w=s.width*c+s.depth*n,d=s.depth*c+s.width*n;
 return {minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2,maxY:p.y+s.height};
}

type Part={geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial};
type Chunk={mesh:THREE.InstancedMesh;center:THREE.Vector3;radius:number};
type Detail={material:THREE.MeshStandardMaterial;normal:THREE.Texture|null;roughness:THREE.Texture|null;ao:THREE.Texture|null};
const releaseTexture=(texture:THREE.Texture)=>{texture.dispose();(texture.image as {close?:()=>void}|undefined)?.close?.();};

function fallback(kind:ScannedKind):Part[]{
 const s=SCANNED_SPECS[kind],pieces:THREE.BufferGeometry[]=[],box=(x:number,y:number,z:number,w:number,h:number,d:number)=>pieces.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 if(kind==='vase')pieces.push(new THREE.LatheGeometry([[.06,0],[.08,.03],[.13,.14],[.10,.29],[.048,.38],[.06,.44]].map(([x,y])=>new THREE.Vector2(x,y)),16));
 else{
  const h=kind==='chair'?.46:.47,w=s.width*.85,d=s.depth*.85;
  box(0,h,0,w,.075,d);for(const x of [-1,1])for(const z of [-1,1])box(x*w*.39,h/2,z*d*.39,.05,h,.05);
  if(kind==='chair'){const back=s.height-h;for(const x of [-1,1])box(x*w*.4,h+back/2,d*.4,.055,back,.055);box(0,s.height-.09,d*.4,w,.18,.055);}
 }
 const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());return [{geometry,material:new THREE.MeshStandardMaterial({color:'#40342b',roughness:.94})}];
}

/** Shared model resources and local instancing keep actual scanned silhouettes affordable. */
export class ScannedProps {
 readonly ready:Promise<void>;
 private disposed=false;
 private quality:GraphicsQuality='low';
 private sets=new Map<ScannedKind,{parts:Part[];chunks:Chunk[]}>();
 private textures=new Set<THREE.Texture>();
 private details:Detail[]=[];
 private lastViewer=new THREE.Vector3();
 private loader:Pick<GLTFLoader,'loadAsync'>;
 private scene:THREE.Scene;
 private placements:ScannedPlacement[];
 private contacts:THREE.Mesh[]=[];
 private contactMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,fog:true,uniforms:THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  vertexShader:'varying vec2 vContact;\n#include <fog_pars_vertex>\nvoid main(){vContact=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
  fragmentShader:'varying vec2 vContact;\n#include <fog_pars_fragment>\nvoid main(){float a=(1.0-smoothstep(.1,.5,length(vContact-.5)))*.19;gl_FragColor=vec4(.015,.012,.01,a);\n#include <fog_fragment>\n}',
 });
 constructor(scene:THREE.Scene,placements:ScannedPlacement[],enabled=true,loader:Pick<GLTFLoader,'loadAsync'>=new GLTFLoader()){
  this.scene=scene;this.placements=placements;this.loader=loader;
  const groups=new Map<string,THREE.BufferGeometry[]>();
  for(const p of placements){const spec=SCANNED_SPECS[p.kind],key=Math.floor(p.x/24)+':'+Math.floor(p.z/24)+':'+Math.round(p.y/4.8);
   const geometry=new THREE.PlaneGeometry(spec.width*1.2,spec.depth*1.2).rotateX(-Math.PI/2).rotateY(p.yaw).translate(p.x,p.y+.003,p.z);
   if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(geometry);
  }
  for(const pieces of groups.values()){const geometry=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,this.contactMaterial);mesh.name='scanned-contact';mesh.matrixAutoUpdate=false;this.scene.add(mesh);this.contacts.push(mesh);}
  const kinds=[...new Set(placements.map(p=>p.kind))];
  for(const kind of kinds)this.install(kind,fallback(kind));
  this.ready=enabled?Promise.all(kinds.map(kind=>this.load(kind))).then(()=>{}):Promise.resolve();
 }
 private install(kind:ScannedKind,parts:Part[]){
  const old=this.sets.get(kind);if(old){for(const c of old.chunks){c.mesh.removeFromParent();c.mesh.dispose();}for(const p of old.parts){p.geometry.dispose();p.material.dispose();}}
  const groups=new Map<string,ScannedPlacement[]>();for(const p of this.placements.filter(p=>p.kind===kind)){const key=Math.floor(p.x/24)+':'+Math.floor(p.z/24)+':'+Math.round(p.y/4.8);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
  const chunks:Chunk[]=[],matrix=new THREE.Matrix4();
  for(const group of groups.values())for(const part of parts){
   const mesh=new THREE.InstancedMesh(part.geometry,part.material,group.length);mesh.name='scanned-'+kind;mesh.receiveShadow=true;mesh.castShadow=this.quality!=='low';mesh.matrixAutoUpdate=false;
   group.forEach((p,i)=>{matrix.makeRotationY(p.yaw);matrix.setPosition(p.x,p.y,p.z);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();this.scene.add(mesh);
   const b=mesh.boundingSphere!;chunks.push({mesh,center:b.center.clone(),radius:b.radius});
  }
  this.sets.set(kind,{parts,chunks});this.update(this.lastViewer);
 }
 private async load(kind:ScannedKind){
  try{
   const gltf=await this.loader.loadAsync(SCANNED_SPECS[kind].url),root=gltf.scene;root.updateMatrixWorld(true);
   const originalGeometry=new Set<THREE.BufferGeometry>(),originalMaterials=new Set<THREE.Material>(),modelTextures=new Set<THREE.Texture>();
   root.traverse(o=>{if(o instanceof THREE.Mesh){originalGeometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){originalMaterials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)modelTextures.add(v);}}});
   if(this.disposed){originalGeometry.forEach(g=>g.dispose());originalMaterials.forEach(m=>m.dispose());modelTextures.forEach(releaseTexture);return;}
   const transform=propTransform(new THREE.Box3().setFromObject(root),SCANNED_SPECS[kind]),parts:Part[]=[];
   root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&o.material instanceof THREE.MeshStandardMaterial){
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(transform),material=o.material.clone();material.name='scan-'+kind;material.roughness=Math.max(.65,material.roughness);material.envMapIntensity=.65;
    // All three scans are dielectric; retain the ARM texture through roughness/AO only.
    material.metalness=0;material.metalnessMap=null;
    this.details.push({material,normal:material.normalMap,roughness:material.roughnessMap,ao:material.aoMap});parts.push({geometry,material});
   }});
   originalGeometry.forEach(g=>g.dispose());originalMaterials.forEach(m=>m.dispose());
   for(const t of modelTextures){this.textures.add(t);t.anisotropy=4;}
   if(!parts.length)throw new Error('No supported static prop mesh');
   this.install(kind,parts);this.setQuality(this.quality);
  }catch(error){if(!this.disposed)console.warn('Scanned prop kept its local fallback:',kind,error);}
 }
 setQuality(quality:GraphicsQuality){
  this.quality=quality;const detail=quality==='high'||quality==='ultra';
  for(const d of this.details){const m=d.material,normal=detail?d.normal:null,roughness=quality==='low'?null:d.roughness,ao=quality==='low'?null:d.ao;
   if(m.normalMap!==normal||m.roughnessMap!==roughness||m.aoMap!==ao){m.normalMap=normal;m.roughnessMap=roughness;m.aoMap=ao;m.needsUpdate=true;}
  }
  for(const s of this.sets.values())for(const c of s.chunks)c.mesh.castShadow=quality!=='low';this.update(this.lastViewer);
 }
 update(viewer:{x:number;y?:number;z:number}){
  this.lastViewer.set(viewer.x,viewer.y??1.68,viewer.z);const range=this.quality==='low'?38:this.quality==='ultra'?76:60;
  for(const s of this.sets.values())for(const c of s.chunks)c.mesh.visible=c.center.distanceToSquared(this.lastViewer)<(range+c.radius)**2;
  for(const mesh of this.contacts){const b=mesh.geometry.boundingSphere!;mesh.visible=b.center.distanceToSquared(this.lastViewer)<(range+b.radius)**2;}
 }
 dispose(){
  this.disposed=true;for(const s of this.sets.values()){for(const c of s.chunks){c.mesh.removeFromParent();c.mesh.dispose();}for(const p of s.parts){p.geometry.dispose();p.material.dispose();}}
  this.textures.forEach(releaseTexture);this.textures.clear();this.sets.clear();this.details=[];
  for(const mesh of this.contacts){mesh.removeFromParent();mesh.geometry.dispose();}this.contacts=[];this.contactMaterial.dispose();
 }
}
