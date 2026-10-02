import * as THREE from 'three';
import {THROW,WARD,type ItemPickup,type ThrownBells,type Wards} from './item-bag.ts';
const BELL_RADIUS=.065,FADE_SECONDS=1.5;
/** A brass suzu on a red cord and a paper ward with a vermilion seal. Faint
 * emission and a glow sprite keep pickups findable without adding a scene light.
 * An armed ward draws its reach as a thin red ring on the floor. Thrown bells
 * carry world heights; on terraced stages `terrain` removes the height that the
 * render pass lifts every root object by. */
export function createItemMeshes(scene:THREE.Scene,pickups:ItemPickup[],glowTex:THREE.Texture,terrain?:(z:number)=>number){
 const brass=new THREE.MeshStandardMaterial({color:'#b8913f',metalness:.85,roughness:.3,emissive:'#5a3d12',emissiveIntensity:.35});
 const dark=new THREE.MeshStandardMaterial({color:'#140d07',roughness:.85});
 const cord=new THREE.MeshStandardMaterial({color:'#a3232d',roughness:.6,emissive:'#6d1219',emissiveIntensity:.25});
 const paper=new THREE.MeshStandardMaterial({color:'#e9dfc6',roughness:.92,emissive:'#f1dfb8',emissiveIntensity:.28,side:THREE.DoubleSide});
 const ink=new THREE.MeshStandardMaterial({color:'#2a1d16',roughness:.9,side:THREE.DoubleSide});
 const seal=new THREE.MeshStandardMaterial({color:'#b3242a',roughness:.55,emissive:'#7a1016',emissiveIntensity:.35,side:THREE.DoubleSide});
 const ringMat=new THREE.MeshBasicMaterial({color:'#c4262c',transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
 const glows={bell:new THREE.SpriteMaterial({map:glowTex,color:'#ffd690',transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}),ward:new THREE.SpriteMaterial({map:glowTex,color:'#ff9a86',transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending})};
 const sphere=new THREE.SphereGeometry(BELL_RADIUS,18,12),slot=new THREE.BoxGeometry(.012,.05,.134),loop=new THREE.TorusGeometry(.02,.006,6,14),tail=new THREE.CylinderGeometry(.004,.004,.12,5);
 const strip=new THREE.PlaneGeometry(.075,.24),stroke=new THREE.PlaneGeometry(.012,.12),stamp=new THREE.CircleGeometry(.021,16),ring=new THREE.RingGeometry(WARD.radius-.025,WARD.radius+.025,72);
 const bell=(hanging:boolean)=>{
  const g=new THREE.Group();g.add(new THREE.Mesh(sphere,brass));
  // The suzu's sound slot crosses the lower half.
  const s=new THREE.Mesh(slot,dark);s.position.y=-.046;g.add(s);
  const l=new THREE.Mesh(loop,cord);l.position.y=BELL_RADIUS+.016;g.add(l);
  if(hanging)for(const side of [-1,1]){const t=new THREE.Mesh(tail,cord);t.position.set(side*.012,BELL_RADIUS+.07,0);t.rotation.z=side*.2;g.add(t);}
  return g;
 };
 const ward=()=>{
  const g=new THREE.Group();g.add(new THREE.Mesh(strip,paper));
  for(const side of [-1,1]){const w=new THREE.Mesh(stroke,ink);w.position.set(0,.02,side*.0015);g.add(w);const m=new THREE.Mesh(stamp,seal);m.position.set(0,-.075,side*.002);g.add(m);}
  return g;
 };
 const pickupRoots=pickups.map((p,i)=>{
  const root=new THREE.Group();root.name='item-pickup';root.position.set(p.position.x,p.floor+.95,p.position.z);
  const body=p.kind==='bell'?bell(true):ward();body.name='item-body';root.add(body);
  const glow=new THREE.Sprite(glows[p.kind]);glow.scale.setScalar(.6);root.add(glow);
  root.rotation.y=i*1.3;scene.add(root);return root;
 });
 const bellRoots:THREE.Group[]=[],wardRoots:{root:THREE.Group;halo:THREE.Mesh}[]=[];
 const bellRoot=(i:number)=>{while(bellRoots.length<=i){const root=bell(false);root.name='item-bell';scene.add(root);bellRoots.push(root);}return bellRoots[i];};
 const wardRoot=(i:number)=>{
  while(wardRoots.length<=i){
   const n=wardRoots.length,root=new THREE.Group();root.name='item-ward';
   const body=ward();body.rotation.set(-Math.PI/2,n*2.1+.4,0,'YXZ');body.position.y=.012;root.add(body);
   const halo=new THREE.Mesh(ring,ringMat);halo.rotation.x=-Math.PI/2;halo.position.y=.02;root.add(halo);
   scene.add(root);wardRoots.push({root,halo});
  }
  return wardRoots[i];
 };
 const grade=(z:number)=>terrain?Math.atan(terrain(z+.5)-terrain(z-.5)):0;
 return {
  update(time:number,bells:ThrownBells,wards:Wards){
   pickupRoots.forEach((m,i)=>{m.visible=!pickups[i].collected;if(m.visible){m.rotation.y=time*.0005+i*1.3;m.position.y=pickups[i].floor+.95+Math.sin(time*.0016+i)*.05;}});
   const points=bells.positions();
   bells.items.forEach((b,i)=>{
    const root=bellRoot(i),p=points[i],yaw=b.path.landing.x*1.3+b.path.landing.z*.7;root.visible=true;
    root.position.set(p.x,p.y-(terrain?.(p.z)??0)+BELL_RADIUS,p.z);
    if(b.landed){root.rotation.set(0,yaw,.45);root.scale.setScalar(Math.max(0,Math.min(1,(THROW.restSeconds-b.rest)/FADE_SECONDS)));}
    else{root.rotation.set(b.t*16,yaw,b.t*5);root.scale.setScalar(1);}
   });
   for(let i=bells.items.length;i<bellRoots.length;i++)bellRoots[i].visible=false;
   ringMat.opacity=.26+.06*Math.sin(time*.003);
   wards.placed.forEach((w,i)=>{
    const {root,halo}=wardRoot(i);root.visible=true;root.position.set(w.position.x,w.floor,w.position.z);
    // Follow the slope so the 1.3 m ring neither floats nor sinks on a hillside.
    root.rotation.x=-grade(w.position.z);halo.visible=w.armed;
   });
   for(let i=wards.placed.length;i<wardRoots.length;i++)wardRoots[i].root.visible=false;
  },
  dispose(){
   for(const m of [...pickupRoots,...bellRoots,...wardRoots.map(w=>w.root)])m.removeFromParent();
   for(const g of [sphere,slot,loop,tail,strip,stroke,stamp,ring])g.dispose();
   for(const m of [brass,dark,cord,paper,ink,seal,ringMat,glows.bell,glows.ward])m.dispose();
  },
 };
}
