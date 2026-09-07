import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Pleated paper pulled over the lip, cinched at the neck by a double cord. */
export function ceramicSeal(variation=0){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[],segments=64;
 const rings=[[0,.348,0],[.07,.349,.0003],[.151,.349,.0005],[.172,.327,.002],[.1535,.293,.001],[.163,.272,.006],[.207,.237,.009]];
 for(let j=0;j<rings.length;j++)for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,fold=Math.sin(a*16+variation),[r,y,amp]=rings[j];
  const radius=r+amp*fold;
  positions.push(Math.cos(a)*radius,y+(j===6?.008*Math.sin(a*5+variation):(j<3?j*.0002:.0015)*fold),Math.sin(a)*radius);
  uv.push(.5+Math.cos(a)*r*2,.5+Math.sin(a)*r*2);
  if(j&&i){const n=j*(segments+1)+i;indices.push(n,n-1,n-segments-2,n,n-segments-2,n-segments-1);}
 }
 const paper=new THREE.BufferGeometry();paper.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));paper.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));paper.setIndex(indices);paper.computeVertexNormals();paper.userData.surfaceUV='authored';
 const parts:THREE.BufferGeometry[]=[];
 for(const y of [.289,.299])parts.push(new THREE.TorusGeometry(.154,.0035,5,64).rotateX(Math.PI/2).translate(0,y,0));
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.012,.297,.153),new THREE.Vector3(.022,.283,.166),new THREE.Vector3(-.012,.282,.169),new THREE.Vector3(-.009,.299,.158),new THREE.Vector3(.019,.27,.171),new THREE.Vector3(.039,.226,.182)]);
 parts.push(new THREE.TubeGeometry(curve,18,.004,5,false));
 const cord=mergeGeometries(parts)!;for(const part of parts)part.dispose();cord.userData.surfaceUV='authored';return {paper,cord};
}

/** A hollow thrown storage jar, fitted inside the old 540 mm by 680 mm proxy.
 * The foot, shoulder and folded lip have physical profiles rather than decals. */
export function ceramicJar(){
 const profile=[
  [0,-.34],[.14,-.34],[.162,-.334],[.169,-.319],[.167,-.302],
  [.192,-.272],[.226,-.22],[.252,-.15],[.267,-.07],[.27,.01],
  [.262,.085],[.245,.15],[.216,.209],[.181,.247],[.149,.272],
  [.141,.292],[.144,.308],[.156,.313],[.16,.323],[.155,.334],
  [.145,.34],[.132,.337],[.127,.327],[.13,.312],[.13,.289],
  [.139,.272],[.171,.245],[.205,.206],[.234,.15],[.251,.075],
  [.259,.005],[.256,-.07],[.241,-.15],[.216,-.22],[.181,-.274],
  [.135,-.30],[0,-.30],
 ];
 const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),32);
 const position=g.getAttribute('position'),uv=g.getAttribute('uv'),indices:number[]=[];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1.7,(position.getY(i)+.34)*1.8);
 // Remove degenerate centre-pole triangles while retaining the closed bottom.
 for(let i=0;i<g.index!.count;i+=3){
  const ia=g.index!.getX(i),ib=g.index!.getX(i+1),ic=g.index!.getX(i+2);
  a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
  if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-18)indices.push(ia,ib,ic);
 }
 g.setIndex(indices);g.normalizeNormals();g.userData.surfaceUV='authored';return g;
}


