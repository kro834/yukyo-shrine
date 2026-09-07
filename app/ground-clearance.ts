import {SECOND_DECK} from './vertical-layout.ts';
/** Ground scenery must stay below the underside of any overlapping upper walkway. */
export function belowUpperDeck(minX:number,maxX:number,minZ:number,maxZ:number){
  for(let x=Math.floor((minX+2)/4);x<=Math.floor((maxX+2)/4);x++)
    for(let z=Math.floor((minZ+2)/4);z<=Math.floor((maxZ+2)/4);z++)
      if(SECOND_DECK.grid.has(x+','+z))return true;
  return false;
}
