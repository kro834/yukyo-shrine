/** Layered clothing and articulated extremities share the actor material/merge lifecycle. */
import * as THREE from 'three';
import type {Enemy} from './shrine-gameplay.ts';
import {finalePhase,hatredPressure,rushPhase} from './enemy-traits.ts';
import {sculptedMask} from './sculpted-mask.ts';

type Materials={cloth:THREE.Material;paleCloth:THREE.Material;sculpt:THREE.Material;skin:THREE.Material;mask:THREE.Material;black:THREE.Material;cord:THREE.Material};
type V=[number,number,number];
type Section={y:number;rx:number;rz:number;z?:number};

export function specialEnemyRig(root:THREE.Group,kind:string,m:Materials,merge:(group:THREE.Group)=>void){
  const lower=new THREE.Group(),upper=new THREE.Group(),head=new THREE.Group();
  lower.name='tailored-lower';upper.name='tailored-upper';head.name='tailored-head';
  root.add(lower,upper);upper.add(head);
  const arms:THREE.Group[]=[];
  const hatredForearms:THREE.Group[]=[];
  const clamp=THREE.MathUtils.clamp;
  const put=(parent:THREE.Group,g:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{
    const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
  };
  const oval=(parent:THREE.Group,mat:THREE.Material,c:V,r:V)=>{
    const g=new THREE.SphereGeometry(1,14,10);g.scale(...r);
    const uv=g.getAttribute('uv'),horizontal=2*Math.PI*Math.sqrt((r[0]**2+r[2]**2)/2),vertical=Math.PI*Math.sqrt((r[1]**2+(r[0]**2+r[2]**2)/2)/2);
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*horizontal/.30,uv.getY(i)*vertical/.30);
    return put(parent,g,mat,...c);
  };
  const sectionAt=(sections:Section[],y:number)=>{
    let i=0;while(i<sections.length-2&&y>sections[i+1].y)i++;
    const a=sections[i],b=sections[i+1],t=clamp((y-a.y)/(b.y-a.y),0,1),s=t*t*(3-2*t);
    return {rx:THREE.MathUtils.lerp(a.rx,b.rx,s),rz:THREE.MathUtils.lerp(a.rz,b.rz,s),z:THREE.MathUtils.lerp(a.z??0,b.z??0,s)};
  };
  // Convex rounded sections describe shoulders, chest, waist, hips and hem.
  // All folds pull inward. Lifted irregular hems cannot grow below their datum.
  const garment=(parent:THREE.Group,sections:Section[],mat:THREE.Material,options:{folds?:number;open?:number;hem?:number;segments?:number}={})=>{
    const around=options.segments??32,rings=(sections.length-1)*3+1;
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
    const y0=sections[0].y,y1=sections.at(-1)!.y;
    for(let r=0;r<rings;r++){
      const q=r/(rings-1),interval=Math.min(sections.length-2,Math.floor(q*(sections.length-1)));
      const f=q*(sections.length-1)-interval;
      const y=THREE.MathUtils.lerp(sections[interval].y,sections[interval+1].y,f),s=sectionAt(sections,y);
      for(let j=0;j<=around;j++){
        const a=j/around*Math.PI*2,si=Math.sin(a),co=Math.cos(a);
        const wave=a+.10*Math.sin(3*a)+.12*(1-q)*Math.sin(2*a);
        const fold=1-(options.folds??.075)*(.5+.5*Math.sin(11*wave+q*1.2))-.022*(.5+.5*Math.sin(19*wave-q));
        const x=s.rx*Math.sign(si)*Math.abs(si)**.88*fold;
        const z=s.z+s.rz*Math.sign(co)*Math.abs(co)**.88*fold;
        const lift=(options.hem??.016)*(1-q)**8*(.5+.5*Math.sin(5*a+.7));
        positions.push(x,y+lift,z);uvs.push(j/around*2*Math.PI*Math.sqrt((s.rx*s.rx+s.rz*s.rz)/2)/.30,(y-y0)/.30);
      }
    }
    for(let r=0;r<rings-1;r++)for(let j=0;j<around;j++){
      const a=(j+.5)/around*Math.PI*2;
      if((options.open??0)>0&&Math.min(a,Math.PI*2-a)<options.open!)continue;
      const i=r*(around+1)+j;indices.push(i,i+1,i+around+1,i+1,i+around+2,i+around+1);
    }
    // The small collar is closed; underside remains open above actual feet.
    if(!(options.open??0)){
      const center=positions.length/3,s=sectionAt(sections,y1);positions.push(0,y1,s.z);uvs.push(.5,.5);
      const ring=(rings-1)*(around+1);for(let j=0;j<around;j++)indices.push(center,ring+j,ring+j+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
    return put(parent,g,mat);
  };
  const frontAt=(sections:Section[],x:number,y:number)=>{
    const s=sectionAt(sections,y),ratio=clamp(Math.abs(x)/s.rx,0,.999);
    return s.z+s.rz*Math.pow(1-Math.pow(ratio,2/.88),.88/2);
  };
  const band=(parent:THREE.Group,sections:Section[],path:[number,number][],width:number,mat:THREE.Material,offset=.007)=>{
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let i=0;i<path.length;i++)for(const sign of [-1,1]){
      const [cx,y]=path[i],x=cx+sign*width/2;positions.push(x,y,frontAt(sections,x,y)+offset);uvs.push(sign<0?0:width/.30,(path[0][1]-y)/.30);
    }
    for(let i=0;i<path.length-1;i++){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();put(parent,g,mat);
  };
  const limb=(parent:THREE.Group,mat:THREE.Material,a:V,b:V,r0:number,r1:number,bulge=Math.max(r0,r1))=>{
    const start=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(start),length=delta.length();
    const o=garment(parent,[{y:0,rx:r0,rz:r0*.86},{y:length*.22,rx:bulge,rz:bulge*.86},{y:length*.73,rx:r1*1.12,rz:r1},{y:length,rx:r1,rz:r1*.88}],mat,{segments:10,folds:0,hem:0});
    o.position.copy(start);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
  };
  const cord=(parent:THREE.Group,points:V[],radius=.006,mat=m.cord)=>{
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return put(parent,new THREE.TubeGeometry(path,Math.max(4,points.length*3),radius,5,false),mat);
  };
  // Bake a fixed hand or foot assembly into its animated parent before merging.
  const absorb=(parent:THREE.Group,assembly:THREE.Group)=>{
    assembly.updateMatrix();
    for(const child of [...assembly.children])if(child instanceof THREE.Mesh){
      child.updateMatrix();child.geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(assembly.matrix,child.matrix));
      child.position.set(0,0,0);child.quaternion.identity();child.scale.set(1,1,1);parent.add(child);
    }
  };
  const hand=(parent:THREE.Group,at:V,side:number,scale=1,crawl=false,mat=m.skin)=>{
    const h=new THREE.Group();h.position.set(...at);h.scale.setScalar(scale);if(crawl)h.rotation.x=-Math.PI/2;
    oval(h,mat,[0,.008,0],[.035,.050,.022]);
    for(let f=0;f<4;f++){
      const x=(f-1.5)*.017,length=f===0||f===3?.079:.097;
      limb(h,mat,[x,-.023,.004],[x,-.065,.014],.0075,.0065,.008);
      limb(h,mat,[x,-.065,.014],[x,-.023-length,.027],.0065,.0045,.0065);
    }
    limb(h,mat,[-side*.028,.012,.002],[-side*.044,-.020,.012],.009,.008,.010);
    limb(h,mat,[-side*.044,-.020,.012],[-side*.037,-.052,.023],.008,.0055,.008);
    absorb(parent,h);
  };
  const foot=(parent:THREE.Group,x:number,z:number,side:number,cloth=m.black)=>{
    const shoe=new THREE.Group();shoe.position.set(x,.046,z);
    const base=oval(shoe,cloth,[0,0,0],[.060,.047,.116]);
    const p=base.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,Math.max(-.04183,p.getY(i)));base.geometry.computeVertexNormals();
    oval(shoe,cloth,[-side*.024,-.004,.070],[.029,.036,.055]);
    oval(shoe,cloth,[side*.024,-.005,.067],[.021,.035,.054]);
    if(kind!=='mire')limb(shoe,m.paleCloth,[0,.027,-.030],[0,.105,-.032],.032,.026,.036);
    cord(shoe,[[-.045,.025,-.015],[0,.041,.023],[.045,.025,.035]],.006);
    absorb(parent,shoe);
  };
  let faceIndex=0;
  const mask=(parent:THREE.Group,at:V,scale:number)=>{
    const o=put(parent,sculptedMask(kind.charCodeAt(0)%7+faceIndex++),m.sculpt,...at);o.scale.setScalar(scale);return o;
  };
  const headAt=(y:number,z:number,scale=1)=>{
    head.position.set(0,y,z);
    oval(head,m.black,[0,-.005,-.052*scale],[.119*scale,.207*scale,.085*scale]);
    mask(head,[0,-.005,.036*scale],scale);
    if(kind==='mire')limb(upper,m.skin,[0,y-.045,z-.15],[0,y-.020,z-.055],.045,.038,.048);
    else limb(upper,m.skin,[0,y-.34,z-.035],[0,y-.12,z-.045],.057,.045,.058);
    // Mask ties return to the occiput; the face is attached to a real head.
    for(const side of [-1,1])cord(head,[[side*.105,.045,.010],[side*.12,.042,-.035],[side*.07,.03,-.105]],.0055);
  };
  const isMire=kind==='mire',isHatred=kind==='hatred',isWrath=kind==='wrath',isFox=kind==='fox',isWarden=kind==='warden';
  const waist=isHatred?1.32:isFox?.94:isWrath?1.02:1.10;

  if(isMire){
    const crouched:Section[]=[{y:.17,rx:.18,rz:.235,z:-.025},{y:.26,rx:.205,rz:.230,z:-.035},{y:.41,rx:.205,rz:.145},{y:.49,rx:.086,rz:.078,z:.045}];
    garment(upper,crouched,m.cloth,{hem:.010});
    band(upper,crouched,[[-.055,.48],[-.026,.42],[.025,.34],[.10,.23]],.035,m.paleCloth);
    band(upper,crouched,[[.056,.48],[.032,.40],[-.005,.32]],.025,m.cloth,.010);
    headAt(.47,.225,.78);head.rotation.x=-.24;
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.name='tailored-arm';arm.position.set(side*.175,.415,.015);upper.add(arm);arms.push(arm);
      limb(arm,m.cloth,[0,0,0],[side*.075,-.165,.005],.070,.053,.075);
      limb(arm,m.skin,[side*.075,-.165,.005],[side*.035,-.327,.142],.037,.022,.040);
      hand(arm,[side*.035,-.337,.155],side,.82,true);
      limb(lower,m.cloth,[side*.11,.24,-.12],[side*.17,.10,-.245],.070,.054,.075);
      limb(lower,m.cloth,[side*.17,.10,-.245],[side*.10,.067,-.285],.047,.029,.050);
      foot(lower,side*.10,-.270,side);
    }
    for(let i=0;i<5;i++)cord(head,[[(i-2)*.033,.12,-.027],[(i-2)*.038,-.03,-.070],[(i-2)*.040,-.18,-.05]],.012,m.black);
  }else{
    const shoulders=isHatred?2.105:isFox?1.49:isWrath?1.68:1.72;
    const neck=isHatred?2.30:isFox?1.64:isWrath?1.83:1.90;
    const shoulderWidth=isWrath?.257:isHatred?.228:isWarden?.208:.222;
    const jacketHem=isFox?.58:isHatred?1.03:.77;
    const jacket:Section[]=[
      {y:jacketHem,rx:isFox?.256:.226,rz:.148},
      {y:waist-.06,rx:.184,rz:.129},
      {y:waist+.10,rx:.195,rz:.139},
      {y:shoulders-.18,rx:shoulderWidth*.99,rz:isWrath?.172:.151,z:isWrath?-.022:0},
      {y:shoulders,rx:shoulderWidth,rz:.135,z:-.010},
      {y:neck,rx:.082,rz:.073,z:.012},
    ];
    const outerMat=isFox?m.black:isHatred?m.paleCloth:m.cloth;
    // Under-kimono first, then an open haori with an actual front opening.
    garment(upper,jacket.map(s=>({...s,rx:s.rx*.92,rz:s.rz*.90})),isHatred?m.cloth:m.paleCloth,{folds:.035});
    garment(upper,jacket,outerMat,{open:isFox?.32:.17,hem:.022});
    const wrapPath:[number,number][]=[];
    for(let j=0;j<=10;j++){const t=j/10;wrapPath.push([-.045+.135*t,neck-(neck-waist+.08)*t]);}
    band(upper,jacket,wrapPath,.048,isHatred?m.cloth:outerMat,.012);
    band(upper,jacket,[[.043,neck],[.065,neck-.12],[.07,shoulders-.12],[.035,waist+.10]],.028,isFox?m.cloth:m.paleCloth,.009);
    // A compressed obi and its knot provide a waist, not a conical tube.
    garment(upper,[{y:waist-.075,rx:.193,rz:.143},{y:waist+.055,rx:.190,rz:.143}],m.cord,{folds:.018,hem:0,segments:24});
    oval(upper,m.cloth,[.09,waist-.002,.154],[.046,.047,.024]);
    band(upper,jacket,[[.095,waist-.05],[.107,waist-.15],[.08,waist-.24]],.040,m.cord,.017);

    if(isFox||isWrath){
      for(const side of [-1,1]){
        const leg=garment(lower,[{y:.11,rx:.049,rz:.063},{y:.37,rx:.066,rz:.071},{y:.66,rx:.081,rz:.078},{y:waist+.08,rx:.083,rz:.082}],isFox?m.cloth:m.black,{folds:.05,hem:.008,segments:20});leg.position.x=side*.106;
      }
    }else{
      const skirt:Section[]=[{y:.063,rx:isHatred?.285:.259,rz:.174},{y:.29,rx:isHatred?.278:.25,rz:.169},{y:.65,rx:.233,rz:.154},{y:waist-.10,rx:.208,rz:.137},{y:waist+.04,rx:.181,rz:.128}];
      garment(lower,skirt,isHatred?m.paleCloth:m.cloth,{open:.095,hem:.018});
      // The wrap under-panel closes the slit with a second overlapping cloth layer.
      band(lower,skirt,[[0,waist+.02],[0,.75],[.018,.40],[.018,.080]],.085,isHatred?m.cloth:m.paleCloth,.002);
      if(isHatred){
        for(const [x,y,s] of [[-.115,.78,.56],[.10,.43,.48]] as const){
          const z=frontAt(skirt,x,y)+.012;mask(lower,[x,y,z],s);
          for(const side of [-1,1])cord(lower,[[x+side*.055*s,y+.02,z],[x+side*.095*s,y+.04,z-.020]],.0045);
        }
      }
    }
    for(const side of [-1,1]){
      foot(lower,side*.113,.030,side,isWarden?m.paleCloth:m.black);
      const arm=new THREE.Group();arm.name='tailored-arm';arm.position.set(side*(shoulderWidth-.020),shoulders-.045,0);upper.add(arm);arms.push(arm);
      const sleeveLength=isWarden?.62:isHatred?.67:.45;
      const sleeve=garment(arm,[{y:-sleeveLength-.065,rx:.064,rz:.073,z:.020},{y:-sleeveLength+.07,rx:.091,rz:.091,z:.005},{y:-.17,rx:.092,rz:.097},{y:.015,rx:.081,rz:.092}],outerMat,{hem:.019,folds:.06,segments:20});
      sleeve.rotation.z=side*.055;
      // A turned cuff exposes the lining without adding disconnected forearms.
      const cuff=garment(arm,[{y:-sleeveLength-.060,rx:.065,rz:.075,z:.020},{y:-sleeveLength-.025,rx:.067,rz:.076,z:.020}],isHatred?m.cloth:m.paleCloth,{folds:.02,hem:0,segments:20});cuff.rotation.z=side*.055;
      const wristY=isWarden?-1.24:isHatred?-1.19:isWrath?-.87:-.77;
      const elbow:V=[side*.030,-sleeveLength+.015,.015],wrist:V=[side*.035,wristY,.058];
      if(isHatred){
        // A real elbow pivot lets the long black hands fold and extend without
        // enlarging the actor's collision footprint.
        const forearm=new THREE.Group();forearm.name='hatred-articulated-forearm';forearm.position.set(...elbow);arm.add(forearm);hatredForearms.push(forearm);
        const localWrist:V=[wrist[0]-elbow[0],wrist[1]-elbow[1],wrist[2]-elbow[2]];
        limb(forearm,m.skin,[0,0,0],localWrist,.030,.021,.034);
        hand(forearm,[localWrist[0],localWrist[1]-.020,localWrist[2]+.003],side,.90,false,m.black);
      }else{
        limb(arm,m.skin,elbow,wrist,isWrath?.043:.030,isWrath?.026:.021,isWrath?.048:.034);
        hand(arm,[wrist[0],wrist[1]-.020,wrist[2]+.003],side,isWrath?1.05:.90,false,m.skin);
      }
    }

    if(isWarden){
      head.position.set(0,2.055,.012);
      oval(head,m.black,[0,-.025,-.024],[.122,.195,.093]);
      const hood:Section[]=[{y:-.29,rx:.211,rz:.151,z:-.023},{y:-.18,rx:.184,rz:.141,z:-.020},{y:.025,rx:.148,rz:.120},{y:.18,rx:.103,rz:.087},{y:.22,rx:.035,rz:.041}];
      garment(head,hood,m.paleCloth,{folds:.045,hem:.018});
      // Long veil corners and a seam suggest a hood pulled tightly over a face.
      band(head,hood,[[-.063,.17],[-.075,.02],[-.10,-.18],[-.135,-.275]],.014,m.cloth,.004);
      cord(upper,[[-.075,1.84,.098],[-.11,1.56,.145],[-.16,1.11,.143]],.009);
      cord(upper,[[.075,1.84,.098],[.11,1.52,.145],[.15,1.17,.143]],.009);
    }else{
      headAt(isHatred?2.46:isFox?1.755:isWrath?1.975:2.06,isHatred?.058:isWrath?.076:.026,isHatred?1.03:isWrath?1.10:.96);
      if(isFox){
        for(const side of [-1,1]){
          const ear=put(head,new THREE.ConeGeometry(.055,.207,5),m.mask,side*.095,.227,-.027);ear.rotation.z=-side*.20;
        }
        oval(head,m.mask,[0,-.042,.119],[.047,.032,.076]);
      }
      if(kind==='pilgrim')for(const side of [-1,1]){
        cord(head,[[side*.073,.143,-.03],[side*.129,.342,-.030],[side*.184,.548,-.051]],.021);
        cord(head,[[side*.133,.332,-.032],[side*.252,.441,-.039],[side*.280,.536,-.053]],.0105);
        cord(head,[[side*.176,.471,-.043],[side*.196,.626,-.056]],.009);
      }
      if(isHatred){
        for(const [x,y,s] of [[-.115,1.86,.60],[.105,1.56,.54]] as const){
          const z=frontAt(jacket,x,y)+.012;mask(upper,[x,y,z],s);
          for(const side of [-1,1])cord(upper,[[x+side*.055*s,y+.02,z],[x+side*.095*s,y+.04,z-.020]],.0045);
        }
      }
      if(isWrath)for(const side of [-1,1])cord(head,[[side*.102,.147,-.01],[side*.152,.258,-.014],[side*.196,.350,-.029]],.025,m.mask);
    }
  }

  for(const a of arms)merge(a);for(const forearm of hatredForearms)merge(forearm);merge(head);merge(upper);merge(lower);
  const headZ=head.rotation.z,headX=head.rotation.x,headY=head.rotation.y;
  return {animate(e:Enemy,time:number){
    const stunned=e.brain.mode==='stunned',chasing=e.brain.mode==='chase';
    const moving=!stunned&&!!(chasing||e.investigate||e.patrol),phase=isWrath?finalePhase('wrath',e.traitTime):rushPhase(e.traitTime),pressure=isHatred?hatredPressure(e.traitTime):0;
    const pace=time*(chasing?.010:.0048);
    let lean=isWrath?.055:0;
    if(kind==='pilgrim')lean=chasing?(phase==='windup'?.035:phase==='rush'?.100:.018):0;
    // Hatred follows the actor's facing toward the player, then makes a small
    // delayed head correction while its two-segment arms reach ahead.
    if(isHatred&&chasing)lean=-.022-.018*pressure-.008*Math.sin(e.traitTime*1.75);
    // Wrath has a readable three-beat threat: gather back, lunge, then settle.
    if(isWrath&&chasing)lean=phase==='windup'?.055:phase==='rush'?-.060:.022;
    if(stunned)lean=0;
    const pivot=isMire?.29:waist+.055;
    upper.rotation.x=lean;upper.rotation.z=isFox&&e.flankPoint?.026:0;
    // Lower clothing and feet remain planted; the articulated torso moves above the obi.
    upper.position.set(0,pivot*(1-Math.cos(lean))+(moving?.003*Math.sin(pace):0),-pivot*Math.sin(lean));
    hatredForearms.forEach(forearm=>forearm.rotation.set(0,0,0));
    arms.forEach((arm,i)=>{
      if(stunned){arm.rotation.set(0,0,0);return;}
      if(isHatred&&chasing){
        arm.rotation.x=-.014-.014*pressure-.008*Math.sin(e.traitTime*2.2+i*.7);
        arm.rotation.z=(i?1:-1)*.018;
        const forearm=hatredForearms[i];if(forearm)forearm.rotation.x=-.030-.022*pressure-.014*Math.sin(e.traitTime*2.2+i*.7);
        return;
      }
      if(isWrath&&chasing){
        arm.rotation.x=phase==='windup'?.045:phase==='rush'?-.060:.020;
        arm.rotation.z=(i?1:-1)*(phase==='rush'?.024:.012);
        return;
      }
      arm.rotation.set(moving?Math.sin(pace+i*Math.PI)*(isMire?.025:isWarden?.018:.045):0,0,0);
    });
    const headScan=isHatred&&chasing?Math.sin(e.traitTime*1.75)*(.060+.070*pressure):0;
    head.rotation.y=headY+(stunned?0:headScan);
    head.rotation.z=headZ+(stunned?.10:isWarden&&e.investigate?.10:Math.sin(time*.00085)*.018);
    head.rotation.x=headX+(stunned?.035:isHatred&&chasing?.055:Math.sin(time*.0007)*.012);
  }};
}
