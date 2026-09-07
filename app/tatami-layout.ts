type Domino=readonly [number,number];
const cache=new Map<string,readonly Domino[]|null>();

/** Whole mats on a half-mat grid. A bounded search prefers T-junction layouts;
 * large banquet floors may retain aligned rows when no bounded solution is found. */
export function interlockedTatami(columns:number,rows:number):readonly Domino[]|null{
 const key=columns+':'+rows;if(cache.has(key))return cache.get(key)!;
 if(columns*rows>256||columns<2||rows<2)return null;
 const cells=new Int16Array(columns*rows),placed:Domino[]=[];
 let visited=0;
 const valid=(cell:number)=>{
  const x=cell%columns,z=Math.floor(cell/columns);
  for(const vx of [x,x+1])for(const vz of [z,z+1]){
   if(vx<=0||vx>=columns||vz<=0||vz>=rows)continue;
   const a=cells[(vz-1)*columns+vx-1],b=cells[(vz-1)*columns+vx],c=cells[vz*columns+vx-1],d=cells[vz*columns+vx];
   if(a&&b&&c&&d&&a!==b&&a!==c&&a!==d&&b!==c&&b!==d&&c!==d)return false;
  }
  return true;
 };
 const solve=():boolean=>{
  if(++visited>30000)return false;
  const first=cells.indexOf(0);if(first<0)return true;
  const next=[first%columns<columns-1?first+1:-1,first+columns<cells.length?first+columns:-1];
  for(const second of next){
   if(second<0||cells[second])continue;
   cells[first]=cells[second]=placed.length+1;
   if(valid(first)&&valid(second)){placed.push([first,second]);if(solve())return true;placed.pop();}
   cells[first]=cells[second]=0;
  }
  return false;
 };
 const result=solve()?placed.slice():null;
 if(cache.size>=128)cache.clear();cache.set(key,result);return result;
}
