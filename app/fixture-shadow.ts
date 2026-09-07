import * as THREE from 'three';
import type {LightFixture} from './fixture-lighting.ts';
import type {GraphicsQuality} from './preferences.ts';
type Slot={current:LightFixture|null;target:LightFixture|null;gain:number};
/** One downward shadow atlas, with stable ownership and no extra phone pass. */
export class FixtureShadow {
 readonly light=new THREE.SpotLight('#ffc184',0,11,1.24,.45,2);
 private owner:LightFixture|null=null;
 private blend=0;
 private enabled=false;
 private lastUpdate=-Infinity;
 private dynamicLastFrame=false;
 constructor(scene:THREE.Scene){
  this.light.name='nearest-fixture-shadow';this.light.visible=false;
  const s=this.light.shadow;s.autoUpdate=false;s.camera.near=.05;s.camera.far=11;s.camera.up.set(0,0,-1);s.bias=-.00012;s.normalBias=.008;s.radius=2;
  scene.add(this.light,this.light.target);
 }
 configure(quality:GraphicsQuality,mobile:boolean){
  const enabled=!mobile&&(quality==='high'||quality==='ultra'),size=quality==='ultra'?1024:512;
  if(!enabled||this.light.shadow.mapSize.x!==size){this.light.shadow.dispose();this.light.shadow.map=this.light.shadow.mapPass=null;}
  this.light.shadow.mapSize.set(size,size);this.enabled=enabled;this.light.visible=enabled;this.light.castShadow=enabled;
  this.lastUpdate=-Infinity;if(!enabled){this.owner=null;this.blend=0;this.light.intensity=0;}
 }
 update(slots:Slot[],viewer:THREE.Vector3,dt:number,time:number,dynamic:boolean){
  if(!this.enabled)return;
  const candidates=slots.filter(s=>s.current?.shadowPosition&&s.current.id===s.target?.id&&s.gain>.05);
  candidates.sort((a,b)=>{
   const score=(s:Slot)=>Math.hypot(s.current!.position.x-viewer.x,s.current!.position.z-viewer.z)*(s.current!.id===this.owner?.id? .72:1);
   return score(a)-score(b);
  });
  const next=candidates[0]?.current??null;
  const ownerSlot=slots.find(s=>s.current?.id===this.owner?.id);
  const same=next?.id===this.owner?.id,fade=Math.min(.1,Math.max(0,dt))/.28;
  this.blend=THREE.MathUtils.clamp(this.blend+(same&&next?fade:-fade),0,1);
  if(!same&&this.blend===0){
   this.owner=next;this.lastUpdate=-Infinity;
   if(next?.shadowPosition){this.light.position.set(next.shadowPosition.x,next.shadowPosition.y,next.shadowPosition.z);this.light.target.position.set(next.shadowPosition.x,next.floor+.05,next.shadowPosition.z);this.light.color.set(next.color);}
  }
  const gain=(same?ownerSlot?.gain:slots.find(s=>s.current?.id===this.owner?.id)?.gain)??0;
  this.light.intensity=this.owner?5.25*this.blend*gain:0;
  // Static rooms reuse the atlas; moving doors/actors refresh at up to 30 Hz.
  const refresh=this.light.intensity>0&&(this.lastUpdate===-Infinity||(dynamic||this.dynamicLastFrame)&&time-this.lastUpdate>=1000/30);
  this.light.shadow.needsUpdate=refresh;if(refresh){this.lastUpdate=time;this.dynamicLastFrame=dynamic;}
 }
 pointGain(fixtureId:number){return this.enabled&&this.owner?.id===fixtureId?1-.72*this.blend:1;}
 dispose(){this.light.shadow.dispose();this.light.removeFromParent();this.light.target.removeFromParent();}
}
