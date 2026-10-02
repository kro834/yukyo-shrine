import {SUSPECT_AT} from './notice.ts';
import * as THREE from 'three';
import type {Enemy} from './shrine-gameplay.ts';

/** Human proportions, shoes and a jointed everyday suit, without masks or a glow. */
export function hotelHuman(root:THREE.Group,kind:string,m:{cloth:THREE.Material;paleCloth:THREE.Material;skin:THREE.Material;black:THREE.Material;cord:THREE.Material},merge:(group:THREE.Group)=>void){
 const staff=kind==='hotelStaff',body=new THREE.Group(),head=new THREE.Group(),arms:THREE.Group[]=[],legs:{hip:THREE.Group;knee:THREE.Group}[]=[];root.add(body);body.add(head);head.name='hotel-human-head';body.name='hotel-human-body';
 const put=(g:THREE.BufferGeometry,mat:THREE.Material,p:THREE.Object3D,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const oval=(p:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,rx:number,ry:number,rz:number)=>put(new THREE.SphereGeometry(1,18,14).scale(rx,ry,rz),mat,p,x,y,z);
 const segment=(p:THREE.Object3D,mat:THREE.Material,length:number,r1:number,r2:number)=>put(new THREE.CylinderGeometry(r1,r2,length,16,5).translate(0,-length/2,0),mat,p);
 const suit=staff?m.black:m.cloth;
 const torso=new THREE.CylinderGeometry(.235,.18,.52,24,10);torso.scale(1,1,.64);const pos=torso.getAttribute('position');for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)*(1+.020*Math.sin(y*35+pos.getZ(i)*20)));}torso.computeVertexNormals();put(torso,suit,body,0,1.14,0);
 oval(body,suit,0,.90,0,.18,.13,.14);oval(body,m.paleCloth,0,1.385,.035,.076,.047,.067);
 for(const side of [-1,1]){const lapel=put(new THREE.BoxGeometry(.065,.30,.018),suit,body,side*.067,1.26,.158);lapel.rotation.z=side*.27;}
 for(let i=0;i<3;i++)oval(body,m.cord,0,1.04+i*.095,.152,.012,.012,.008);
 segment(body,m.skin,.10,.052,.048).position.set(0,1.49,0);
 head.position.set(0,1.61,.012);
 oval(head,m.skin,0,0,0,.092,.13,.093);oval(head,m.skin,0,-.079,.04,.071,.064,.066);
 oval(head,m.black,0,.047,-.032,.094,.092,.072);
 // Recessed eye sockets, lids, nose bridge, lips and asymmetrical tired cheeks.
 for(const s of [-1,1]){oval(head,m.black,s*.039,.017,.081,.024,.010,.008);oval(head,m.skin,s*.039,.027,.084,.027,.010,.012);oval(head,m.skin,s*.035,-.005,.079,.028,.008,.009);oval(head,m.skin,s*.091,-.006,-.002,.018,.030,.013);oval(head,m.skin,s*.053,-.031,.067,.032,.039,.020);}
 oval(head,m.skin,0,.003,.088,.014,.039,.019);oval(head,m.skin,0,-.022,.11,.018,.014,.018);oval(head,m.black,0,-.068,.091,.030,.004,.006);oval(head,m.skin,0,-.075,.093,.031,.006,.008);
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.241,1.38,0);body.add(arm);segment(arm,suit,.29,.073,.052);const fore=new THREE.Group();fore.position.set(0,-.29,0);fore.rotation.x=-.12;arm.add(fore);segment(fore,suit,.28,.053,.04);oval(fore,m.skin,0,-.326,0,.035,.063,.022);for(let i=0;i<4;i++)oval(fore,m.skin,(i-1.5)*.016,-.380,.012,.007,.037,.008);arms.push(arm);merge(fore);merge(arm);
  const hip=new THREE.Group();hip.position.set(side*.104,.87,0);root.add(hip);segment(hip,suit,.41,.095,.070);const knee=new THREE.Group();knee.position.y=-.41;hip.add(knee);segment(knee,suit,.39,.07,.048);oval(knee,m.black,0,-.403,.057,.067,.045,.132);legs.push({hip,knee});merge(knee);merge(hip);
 }
 merge(body);merge(head);
 let last:{x:number;z:number}|null=null,phase=0,lastTime=0,drive=0;
 return {animate(e:Enemy,time:number){const stunned=e.brain.mode==='stunned',dt=lastTime?Math.max(0,Math.min(.1,(time-lastTime)/1000)):.016;lastTime=time;const d=last?Math.hypot(e.position.x-last.x,e.position.z-last.z):0;last={...e.position};const walking=!stunned&&d>.0003;drive+=((walking?1:0)-drive)*(1-Math.exp(-dt*10));phase+=Math.min(.3,d)/.67*Math.PI;body.position.y=Math.cos(phase*2)*.008*drive;
  const intent=e.brain.lastSeen??e.investigate,angle=intent?Math.atan2(intent.x-e.position.x,intent.z-e.position.z)-e.facing:0;
  const gaze=stunned?-.08:intent?Math.max(-.9,Math.min(.9,Math.atan2(Math.sin(angle),Math.cos(angle)))):Math.sin(time*.00024+e.id)*.13;
  // The face turns towards a remembered sighting first; the body follows its
  // navigation heading. No knowledge of a hidden player's live position.
  head.rotation.y+=(gaze-head.rotation.y)*(1-Math.exp(-dt*3));head.rotation.x=(stunned?.22:intent?-.025:staff?.05:.13)-(e.brain.mode==='patrol'&&(e.alert??0)>=SUSPECT_AT?.12:0);
  head.rotation.z=staff?.015:-.075;body.rotation.x=stunned?.14:staff?.024:.065;
  for(let i=0;i<2;i++){const a=phase+i*Math.PI;legs[i].hip.rotation.x=Math.sin(a)*.33*drive;legs[i].knee.rotation.x=Math.max(0,-Math.cos(a))*.38*drive;legs[i].hip.position.y=.87+Math.max(0,Math.cos(a))*.022*drive;arms[i].rotation.x=-Math.sin(a)*(staff?.12:.18)*drive;arms[i].rotation.z=(i?1:-1)*.035;}
 }};
}
