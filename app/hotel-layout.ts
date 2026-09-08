import type {Cell,Room} from './shrine-layout.ts';

export const HOTEL_AREAS={lobby:'雨夜のグランドロビー',guest:'宿泊棟',executive:'エグゼクティブフロア',restaurant:'閉店後のダイニング',spa:'誰もいないスパ',service:'リネンと清掃のバックヤード',kitchen:'灯りの消えた厨房',archive:'地下の記録保管室',atrium:'雨に包まれたウィンターガーデン'} as const;
export type HotelArea=keyof typeof HOTEL_AREAS;
export const HOTEL_ROOMS={single:'シングルルーム',twin:'ツインルーム',double:'ダブルルーム',suite:'コーナースイート',executive:'エグゼクティブルーム',penthouse:'プレジデンシャルスイート',lounge:'プライベートラウンジ',lobby:'レセプション',cloak:'クローク',restaurant:'メインダイニング',bar:'深夜のバー',breakfast:'朝食サロン',spa:'トリートメントルーム',bath:'客用浴場',linen:'リネン室',laundry:'ランドリー',kitchen:'メインキッチン',pantry:'パントリー',archive:'宿泊台帳の保管庫',security:'守衛室',atrium:'屋内庭園',conservatory:'雨の温室'} as const;
export type HotelRoom=keyof typeof HOTEL_ROOMS;
export const HOTEL_LIFT={x:-28,z:72,floors:[0,4.8,9.6] as const};
export const hotelArea=(kind:string):HotelArea=>({hall:'lobby',passage:'guest',stone:'guest',yokocho:'executive',shop:'restaurant',bath:'spa',factory:'service',cistern:'kitchen',cave:'archive',field:'atrium'} as Record<string,HotelArea>)[kind]??'guest';
export const hotelRoomHeight=(kind:string)=>hotelArea(kind)==='lobby'?3.65:hotelArea(kind)==='atrium'?3.9:3.10;
export const hotelShaftCell=(c:{x:number;z:number})=>c.x===-7&&c.z===18;
export function prepareHotelLayout(grid:Map<string,Cell>,rooms:Room[]){
 // A small circulation loop surrounds the lift, joining the existing hotel wing.
 for(let x=-8;x<=-6;x++)for(let z=17;z<=19;z++)grid.set(x+','+z,{x,z,kind:'stone',h:3.1});
 for(const c of grid.values())if(c.h<8)c.h=hotelRoomHeight(c.kind);
 const variations:Record<HotelArea,HotelRoom[]>={guest:['single','twin','double','suite'],executive:['executive','penthouse','lounge'],lobby:['lobby','cloak'],restaurant:['restaurant','bar','breakfast'],spa:['spa','bath'],service:['linen','laundry'],kitchen:['kitchen','pantry'],archive:['archive','security'],atrium:['atrium','conservatory']};
 const indices=new Map<HotelArea,number>();
 for(const r of rooms){const c=grid.get(Math.round((r.x1+r.x2)/2)+','+Math.round((r.z1+r.z2)/2)),a=hotelArea(c?.kind??'hall'),i=indices.get(a)??0;indices.set(a,i+1);r.themeId='hotel-'+variations[a][i%variations[a].length];r.style='stone';r.h=hotelRoomHeight(c?.kind??'hall');}
}
export const hotelLiftBlockers=()=>[{minX:-29.55,maxX:-26.45,minZ:70.45,maxZ:73.58}];
