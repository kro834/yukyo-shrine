import type {createSectorLayout} from './sector-layout.ts';
import {STAIRS} from './annex.ts';
import {HIGH_STAIRS,SECOND_DECK} from './vertical-layout.ts';
import {outerLandmarkCandidates} from './outer-landmark-candidates.ts';
import type {CivicSite} from './civic-scene.ts';
import type {CivicLandmarkId} from './civic-landmarks.ts';
type Layout=ReturnType<typeof createSectorLayout>;

export function createCivicSites(layout:Layout){
 if(layout.stage!=='outer')return [];
 const groups=outerLandmarkCandidates(layout.grid,layout.landforms,{rooms:layout.rooms,doors:layout.doors,stairs:STAIRS,highStairs:HIGH_STAIRS,secondDeckCells:SECOND_DECK.cells,width:4,allowBelowDeck:true});
 const sites:(CivicSite&{identity:string;sectorId:string;footprint:{minX:number;maxX:number;minZ:number;maxZ:number}})[]=[];
 for(const group of groups){
  const id:CivicLandmarkId=group.identity==='underpass'?'railway-underpass-bay':group.identity==='floodgate'?'closed-floodgate-mechanism':group.identity==='greenway'?'apartment-service-facade':'weathered-bus-shelter';
  let count=0;
  for(const c of group.candidates){
   // A continuous kit must never seal a perpendicular junction or overlap an upper floor.
   if(c.requiresSideOpenings||id==='apartment-service-facade'&&c.belowDeck)continue;
   if(sites.some(s=>c.footprint.minX<s.footprint.maxX+1&&c.footprint.maxX>s.footprint.minX-1&&c.footprint.minZ<s.footprint.maxZ+1&&c.footprint.maxZ>s.footprint.minZ-1))continue;
   sites.push({id,x:c.x,z:c.z,quarterTurns:c.axis==='z'?0:3,identity:group.identity,sectorId:group.sectorId,footprint:c.footprint});
   if(++count>=(id==='weathered-bus-shelter'?1:3))break;
  }
 }
 return sites;
}
