import type {Obstacle} from './movement.ts';
const cache=new WeakMap<Obstacle[],{length:number;bins:Map<string,Obstacle[]>}>();
/** Conservative broad phase. Callers retain exact narrow-phase collision tests. */
export function nearbyObstacles(items:Obstacle[],minX:number,minZ:number,maxX:number,maxZ:number){
  if(items.length<64)return items;
  let entry=cache.get(items);
  if(!entry||entry.length!==items.length){
    const bins=new Map<string,Obstacle[]>();
    for(const o of items)for(let x=Math.floor(o.minX/8);x<=Math.floor(o.maxX/8);x++)for(let z=Math.floor(o.minZ/8);z<=Math.floor(o.maxZ/8);z++){
      const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k)!.push(o);
    }
    entry={length:items.length,bins};cache.set(items,entry);
  }
  const found=new Set<Obstacle>();
  for(let x=Math.floor(minX/8);x<=Math.floor(maxX/8);x++)for(let z=Math.floor(minZ/8);z<=Math.floor(maxZ/8);z++)for(const o of entry.bins.get(x+','+z)??[])found.add(o);
  return [...found];
}
