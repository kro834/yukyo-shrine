export type MenuDirection='up'|'down'|'left'|'right';
type Bounds={left:number;top:number;width:number;height:number};
/** Follow the rendered rows, including the two-column phone layout. */
export function menuNeighbor(rects:Bounds[],current:number,direction:MenuDirection){
 if(current<0||!rects[current])return 0;
 const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;
 const center=(r:Bounds)=>[r.left+r.width/2,r.top+r.height/2],origin=center(rects[current]);
 let next=current,best=Infinity;
 rects.forEach((r,i)=>{if(i===current)return;const p=center(r),along=(p[horizontal?0:1]-origin[horizontal?0:1])*sign,cross=Math.abs(p[horizontal?1:0]-origin[horizontal?1:0]);
  if(along<2)return;const score=along+cross*3;if(score<best){best=score;next=i;}
 });return next;
}
export function focusMenu(choices:HTMLButtonElement[],direction:MenuDirection){
 const current=choices.indexOf(document.activeElement as HTMLButtonElement),next=menuNeighbor(choices.map(c=>c.getBoundingClientRect()),current,direction);
 choices[next]?.focus();return next;
}
