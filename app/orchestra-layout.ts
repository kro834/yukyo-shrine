import type {Room} from './shrine-layout.ts';
import type {StageId} from './stage-profile.ts';
import {belowUpperDeck} from './ground-clearance.ts';
import {seededRandom} from './seeded-random.ts';

export const ORCHESTRA_IDS=['orchestra-organ','orchestra-strings','orchestra-curtain','orchestra-clock'] as const;
export const ORCHESTRA_AREA_NAMES:Record<string,string>={hall:'黒石の身廊',passage:'尖頭アーチの回廊',stone:'沈黙の礼拝堂',cave:'地下納骨堂',factory:'オルガンの機関室',cistern:'水没した地下聖堂',bath:'古い洗礼室',yokocho:'緋幕の小劇場街',shop:'楽器職人の通り',field:'月のない修道院中庭'};
export function assignOrchestraRooms(rooms:Room[],seed:number,stage:StageId){
 if(stage!=='orchestra')return;
 const random=seededRandom(seed^0x692ccd),used=new Set<string>();let index=0;
 const candidates=rooms.filter(r=>!r.themeId&&!belowUpperDeck(r.x1*4-2,r.x2*4+2,r.z1*4-2,r.z2*4+2)).map(room=>({room,rank:random(),large:room.x2-room.x1>2||room.z2-room.z1>2})).sort((a,b)=>Number(b.large)-Number(a.large)||a.rank-b.rank);
 for(const {room} of candidates){const sector=`${Math.round((room.x1+room.x2)/38)},${Math.round((room.z1+room.z2)/38)}`;if(used.has(sector))continue;room.themeId=ORCHESTRA_IDS[index++];used.add(sector);if(index===ORCHESTRA_IDS.length)return;}
 throw new Error('Not enough rooms for Orchestra');
}
