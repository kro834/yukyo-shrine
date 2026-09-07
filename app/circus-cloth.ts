import * as THREE from 'three';

/** Metre-sized hanging cloth. Top tension flattens the pleats at the suspension
 * rail; the free hem sags between ties. All folds stay inside the wall footprint. */
export function hangingCanvas(width:number,height:number,phase=0,amplitude=.062,lightweight=false){
 const columns=Math.ceil(width*(lightweight?8:12)),rows=lightweight?3:Math.min(8,Math.ceil(height*2));
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
  const u=column/columns,v=row/rows,x=(u-.5)*width;
  const free=1-v,tension=.30+.70*Math.sin(free*Math.PI/2);
  const fold=Math.sin(x*13.8+phase+.22*free)+.24*Math.sin(x*27.6+phase*1.7);
  const sag=.018*Math.sin(u*Math.PI*4)**2*free*free;
  positions.push(x,Math.max(0,v*height-sag),amplitude*fold*tension/1.24);
  // Physical coordinates avoid a coarse, stretched weave on tall screens.
  uv.push(x,height*v);
 }
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const a=row*(columns+1)+column,b=a+columns+1;
  indices.push(a,a+1,b,b,a+1,b+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.userData.surfaceUV='authored';return geometry;
}
