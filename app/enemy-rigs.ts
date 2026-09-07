import * as THREE from 'three';
import type {Enemy} from './shrine-gameplay.ts';
import {rushPhase} from './enemy-traits.ts';
type Materials={cloth:THREE.Material;skin:THREE.Material;mask:THREE.Material;black:THREE.Material;cord:THREE.Material};
export function specialEnemyRig(root:THREE.Group,kind:string,m:Materials,merge:(group:THREE.Group)=>void){
 const body=new THREE.Group(),head=new THREE.Group();root.add(body);body.add(head);const arms:THREE.Group[]=[];
 const mesh=(p:THREE.Group,g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const oval=(p:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,a:number,b:number,c:number)=>{const o=mesh(p,new THREE.SphereGeometry(1,14,10),mat,x,y,z);o.scale.set(a,b,c);return o;};
 const bone=(p:THREE.Group,mat:THREE.Material,a:[number,number,number],b:[number,number,number],r:number)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),mid=start.clone().add(end).multiplyScalar(.5);const o=mesh(p,new THREE.CylinderGeometry(r*.7,r,d.length(),8),mat,mid.x,mid.y,mid.z);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const drape=(p:THREE.Group,top:number,bottom:number,h:number,y:number,mat=m.cloth)=>{const g=new THREE.CylinderGeometry(top,bottom,h,24,8),v=g.getAttribute('position');for(let i=0;i<v.count;i++){const a=Math.atan2(v.getZ(i),v.getX(i)),fold=1+Math.sin(a*13+v.getY(i)*2.3)*.08;v.setXYZ(i,v.getX(i)*fold,v.getY(i),v.getZ(i)*fold*.8);}g.computeVertexNormals();return mesh(p,g,mat,0,y,0);};
 const face=(p:THREE.Group,y:number,z:number,scale=1)=>{oval(p,m.mask,0,y,z,.14*scale,.23*scale,.09*scale);for(const sign of [-1,1])oval(p,m.black,sign*.055*scale,y+.025*scale,z+.084*scale,.035*scale,.018*scale,.009*scale);oval(p,m.black,0,y-.10*scale,z+.085*scale,.035*scale,.036*scale,.006*scale);};
 if(kind==='mire'){
  oval(body,m.cloth,0,.39,-.05,.22,.17,.29);head.position.set(0,.45,.25);face(head,0,0,.8);head.rotation.x=-.35;
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.19,.44,0);body.add(arm);arms.push(arm);
   bone(arm,m.skin,[0,0,0],[side*.13,-.22,.05],.048);bone(arm,m.skin,[side*.13,-.22,.05],[side*.04,-.36,.31],.035);
   oval(arm,m.skin,side*.04,-.37,.32,.06,.027,.09);
   for(let f=0;f<4;f++)bone(arm,m.skin,[side*.04+(f-1.5)*.026,-.37,.37],[side*.04+(f-1.5)*.028,-.38,.48],.009);
   bone(body,m.cloth,[side*.12,.35,-.22],[side*.23,.18,-.40],.08);bone(body,m.skin,[side*.23,.18,-.40],[side*.12,.07,-.54],.035);
  }
  for(let i=0;i<6;i++)bone(head,m.black,[(i-2.5)*.035,.17,-.04],[(i-2.5)*.04,-.26,-.08],.019);
 }else if(kind==='warden'){
  drape(body,.18,.29,1.95,.995);head.position.y=1.92;drape(head,.16,.22,.55,-.02,m.mask);
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.24,1.65,0);body.add(arm);arms.push(arm);drape(arm,.085,.10,1.20,-.51);oval(arm,m.skin,0,-1.18,.02,.042,.16,.04);bone(body,m.cord,[side*.15,1.8,.16],[side*.20,.58,.16],.02);}
  const rim=mesh(head,new THREE.TorusGeometry(.20,.027,6,18),m.cord,0,-.24,0);rim.rotation.x=Math.PI/2;
 }else if(kind==='fox'){
  mesh(body,new THREE.CylinderGeometry(.22,.33,1.1,4,3),m.black,0,.98,0);head.position.set(0,1.64,.06);face(head,0,0);
  for(const side of [-1,1]){const ear=mesh(head,new THREE.ConeGeometry(.075,.25,3),m.mask,side*.105,.25,-.01);ear.rotation.z=-side*.25;bone(body,m.skin,[side*.12,.65,0],[side*.14,.10,.03],.035);const arm=new THREE.Group();arm.position.set(side*.23,1.36,0);body.add(arm);arms.push(arm);bone(arm,m.black,[0,0,0],[side*.025,-.47,.04],.07);bone(arm,m.skin,[side*.025,-.47,.04],[-side*.15,-.55,.19],.03);}
  const muzzle=mesh(head,new THREE.ConeGeometry(.058,.15,4),m.mask,0,-.04,.14);muzzle.rotation.x=Math.PI/2;
 }else if(kind==='pilgrim'){
  drape(body,.19,.27,1.80,.92);head.position.y=1.99;face(head,0,0);
  for(const side of [-1,1]){bone(head,m.cord,[side*.08,.17,0],[side*.22,.51,-.02],.025);bone(head,m.cord,[side*.16,.36,0],[side*.34,.53,.01],.013);bone(head,m.cord,[side*.22,.47,-.02],[side*.23,.66,-.04],.012);}
  bone(head,m.cord,[0,.18,-.03],[0,.61,-.04],.023);drape(body,.235,.24,.12,1.1,m.cord);
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.23,1.6,0);body.add(arm);arms.push(arm);bone(arm,m.cloth,[0,0,0],[side*.03,-.83,.04],.08);oval(arm,m.skin,side*.03,-.91,.04,.04,.1,.04);bone(body,m.cord,[side*.09,1.05,.22],[side*.12,.42,.22],.015);}
 }else if(kind==='hatred'){
  drape(body,.21,.35,2.30,1.17,m.mask);head.position.set(0,2.46,.17);face(head,0,.02,1.1);
  for(const [x,y,z] of [[-.16,1.77,.15],[.16,1.43,.18],[0,1.12,.22],[-.16,.77,.21]] as [number,number,number][]){const mask=new THREE.Group();mask.position.set(x,y,z);body.add(mask);face(mask,0,0,.64);merge(mask);}
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.25,1.9,0);body.add(arm);arms.push(arm);bone(arm,m.skin,[0,0,0],[side*.07,-1.26,.12],.044);oval(arm,m.black,side*.07,-1.33,.12,.045,.15,.035);}
 }else{
  drape(body,.33,.30,1.7,1.15);oval(body,m.cloth,0,1.72,-.12,.37,.39,.24);head.position.set(0,1.94,.18);face(head,0,.03,1.25);
  for(const side of [-1,1]){bone(head,m.mask,[side*.12,.16,0],[side*.22,.39,-.03],.04);const arm=new THREE.Group();arm.position.set(side*.31,1.7,0);body.add(arm);arms.push(arm);bone(arm,m.skin,[0,0,0],[side*.025,-.91,.16],.083);oval(arm,m.skin,side*.02,-1.01,.19,.065,.16,.05);for(let f=0;f<3;f++)bone(arm,m.black,[side*.02+(f-1)*.026,-1.1,.21],[side*.02+(f-1)*.03,-1.25,.26],.012);}
 }
 if(kind==='fox')for(const side of [-1,1])oval(body,m.black,side*.14,.07,.04,.055,.06,.10);
 if(kind==='mire')body.scale.set(.85,1,.62);
 if(kind==='pilgrim'||kind==='wrath')body.scale.set(.9,1,.9);
 if(kind==='wrath')for(const side of [-1,1]){bone(body,m.cloth,[side*.12,.48,0],[side*.12,.12,0],.055);oval(body,m.black,side*.12,.10,.035,.075,.09,.12);}
 for(const arm of arms)merge(arm);merge(head);merge(body);
 const headY=head.position.y;
 return {animate(e:Enemy,time:number){
  const stunned=e.brain.mode==='stunned',moving=!stunned&&(e.brain.mode==='chase'||e.investigate||e.patrol),pace=time*(e.brain.mode==='chase'?.012:.005);
  body.position.set(0,stunned?0:moving?Math.sin(pace)*.008:0,0);body.rotation.x=kind==='wrath'&&!stunned?.08:0;
  arms.forEach((a,i)=>{a.rotation.x=stunned?0:moving?Math.sin(pace+i*Math.PI)*(kind==='mire'?.08:kind==='warden'?.025:kind==='hatred'||kind==='wrath'||kind==='pilgrim'?.055:.1):0;});
  head.rotation.z=stunned?.2:kind==='warden'&&e.investigate?.18:Math.sin(time*.001)*.022;
  if(kind==='pilgrim'){const phase=rushPhase(e.traitTime);body.rotation.x=stunned?0:e.brain.mode!=='chase'?0:phase==='windup'?.06:phase==='rush'?.14:.025;body.position.y=e.brain.mode==='chase'&&phase==='windup'?-.008:0;}
  if(kind==='pilgrim'||kind==='wrath'){const pivot=kind==='pilgrim'?1.3:1.1;body.position.y+=pivot*(1-Math.cos(body.rotation.x));body.position.z=-pivot*Math.sin(body.rotation.x);}
  if(kind==='fox')body.rotation.z=e.flankPoint?.055:0;
  if(kind==='hatred')head.position.y=headY+(stunned?0:Math.sin(time*.0015)*.02);
 }};
}
