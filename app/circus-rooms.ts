import * as THREE from 'three';
import {buildCircusLamp} from './circus-lamp.ts';
import type {Room} from './shrine-layout.ts';
import type {CircusAdd,CircusMaterial} from './circus-scenery.ts';

export const CIRCUS_AREA_NAMES:Record<string,string>={hall:'大天幕・環状軌道',passage:'黒幕の通り道',stone:'見世物小屋',factory:'舞台機構の工房',shop:'色あせた縁日',cave:'天幕の地下倉',field:'休演中の広場',yokocho:'道化師の裏路地',bath:'衣装の洗い場',cistern:'水槽の舞台裏'};
const NAMES=['道化師の楽屋','空席の観覧室','衣装の保管室','旅一座の荷物室','歯車の工作室','輪投げの見世物小屋','鏡面の控室','休演日の食堂'];
const index=(room:Room)=>[...room.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%NAMES.length;
export const circusRoomName=(room:Room)=>NAMES[index(room)];

/** Recessed corner furnishings preserve both door axes and the room's pickup zone. */
export function buildCircusRoom(room:Room,add:CircusAdd,block:(x:number,z:number,w:number,d:number,maxY?:number)=>void,fixture:(x:number,y:number,z:number,color:string)=>void,reserved=false){
 const cx=(room.x1+room.x2)*2,cz=(room.z1+room.z2)*2,hw=(room.x2-room.x1+1)*2,hd=(room.z2-room.z1+1)*2,k=index(room);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:CircusMaterial)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
 const rod=(x:number,y:number,z:number,r:number,h:number,m:CircusMaterial)=>add(new THREE.CylinderGeometry(r,r,h,8).translate(x,y,z),m);
 const hoop=(x:number,y:number,z:number,r:number,m:CircusMaterial)=>add(new THREE.TorusGeometry(r,.025,6,24).translate(x,y,z),m);
 const lampY=Math.min(3.3,room.h-.5);buildCircusLamp(add,cx,lampY,cz);fixture(cx,lampY-.1,cz,'#ba936e');
 rod(cx,(lampY+.282+room.h)/2,cz,.009,Math.max(.01,room.h-lampY-.282),'circusMetal');
 if(reserved)return;
 for(const side of [-1,1]){
  const x=cx+side*(hw-1.25),z=cz+side*(hd-1.25);
  if(k===0||k===6){
   box(x,.76,z,1.65,.10,.72,'wood');for(const dx of [-.72,.72])for(const dz of [-.28,.28])box(x+dx,.37,z+dz,.07,.74,.07,'circusMetal');
   // A dark tarnished mirror, with its own frame and individual exposed bulbs.
   box(x,1.50,z-.18,1.50,1.22,.09,'circusBrass');box(x,1.50,z-.12,1.35,1.08,.025,'circusMetal');
   for(const dx of [-.70,.70])for(const y of [1.04,1.5,1.96])rod(x+dx,y,z-.045,.045,.08,'circusGlow');
   if(k===0){const head=new THREE.SphereGeometry(.14,12,8);head.scale(1,1.35,.7);head.translate(x,.99,z+.07);add(head,'circusIvory');const nose=new THREE.SphereGeometry(.035,8,6);nose.translate(x,.98,z+.18);add(nose,'circusRed');}
  }else if(k===1||k===7){
   box(x,k===1?.46:.76,z,1.65,.10,.7,'wood');for(const dx of [-.7,.7])for(const dz of [-.25,.25])box(x+dx,k===1?.23:.38,z+dz,.07,k===1?.46:.76,.07,'circusMetal');
   if(k===1){box(x,.93,z-.30,1.65,.45,.07,'circusRed');for(const dx of [-.75,0,.75])box(x+dx,.65,z-.30,.05,.8,.05,'circusMetal');}
   else for(const dx of [-.45,.45]){rod(x+dx,.84,z,.15,.025,'circusIvory');rod(x+dx,.93,z+.19,.05,.15,'circusMetal');}
  }else if(k===2){
   for(const dx of [-.75,.75]){rod(x+dx,1,z,.025,2,'circusMetal');box(x+dx,.045,z,.10,.09,.70,'circusMetal');}box(x,2,z,1.55,.04,.04,'circusMetal');
   for(const dx of [-.48,0,.48]){
    const g=new THREE.PlaneGeometry(.42,1.20,6,8),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i);p.setXYZ(i,px*(.85+.2*(.6-py)),py,Math.cos(px*39)*.045);}g.computeVertexNormals();g.translate(x+dx,1.2,z);add(g,dx===0?'circusIvory':'circusRed');hoop(x+dx,1.94,z,.05,'circusMetal');
   }
  }else if(k===3){
   for(const [dx,y,dz,w] of [[0,.3,0,1.5],[-.15,.82,.05,1.2]] as const){box(x+dx,y,z+dz,w,.55,.8,'circusDark');for(const band of [-.35,.35])box(x+dx+band,y,z+dz+.41,.07,.55,.025,'circusBrass');box(x+dx,y+.02,z+dz+.43,.22,.08,.04,'circusMetal');}
  }else if(k===4){
   box(x,.80,z,1.65,.10,.85,'wood');for(const dx of [-.7,.7])box(x+dx,.4,z,.09,.8,.70,'circusMetal');
   for(const dx of [-.4,.4]){rod(x+dx,1.02,z,.10,.40,'circusMetal');for(const y of [.86,1.18])rod(x+dx,y,z,.27,.035,'wood');rod(x+dx,1.02,z,.22,.27,'rope');}
  }else{
   box(x,.62,z,1.65,.09,.85,'circusRed');for(const dx of [-.7,.7])box(x+dx,.31,z,.07,.62,.70,'circusMetal');
   for(const dx of [-.5,0,.5]){rod(x+dx,.85,z,.09,.36,'circusIvory');hoop(x+dx,1.25,z-.20,.19,'circusBrass');}
  }
  block(x,z,1.8,1.05,k===2?2.05:k===0||k===6?2.15:1.5);
 }
}
