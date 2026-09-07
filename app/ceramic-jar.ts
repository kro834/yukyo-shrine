import * as THREE from 'three';

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
