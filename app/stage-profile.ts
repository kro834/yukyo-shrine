import type {Cell} from './shrine-layout.ts';
import {modeRules,type PlayMode} from './play-mode.ts';
export type StageId='shrine'|'abyss'|'outer'|'orchestra'|'circus';
export const canTransitionStage=(_mode:PlayMode,completed:boolean,_current:StageId,_next:StageId)=>completed;
type Profile={name:string;subtitle:string;description:string;challenge:string;links:number;salt:number;fog:string;density:number;moon:number;counts:Partial<Record<Cell['kind'],number>>;sense:number;speed:number;search:number};
export const STAGES:Record<StageId,Profile>={
 shrine:{name:'祭殿回廊',subtitle:'封じられた社',description:'灯りの残る回廊と、忘れられた街。',challenge:'青6個・赤2個・金1個のいずれかを奉納',links:40,salt:0,fog:'#100c09',density:.0205,moon:.10,counts:{hall:5,yokocho:5,shop:4,cave:3,field:2,factory:1,bath:2,cistern:1},sense:1,speed:1,search:1},
 abyss:{name:'深淵',subtitle:'地の底の水音',description:'低い岩天井、沈んだ祭殿、錆びた地下施設。曲がり角の先へ、灯りを絞って進む。',challenge:'高難度 · 長い捜索と少ない迂回路',links:28,salt:0x51ab92,fog:'#050e13',density:.033,moon:.045,counts:{hall:3,cave:6,cistern:4,factory:3,bath:2,yokocho:2,shop:2,field:1},sense:1.15,speed:1.03,search:1.35},
 outer:{name:'外縁',subtitle:'月下の境界',description:'草に埋もれたあぜ道、終電の去った木造駅、夕暮れの廃校舎。懐かしい景色の奥で、遠くから届く視線に気を配る。',challenge:'高難度 · 広い視界と素早い追跡',links:36,salt:0x3a971c,fog:'#142332',density:.014,moon:.22,counts:{hall:3,field:6,yokocho:4,shop:4,cave:2,factory:2,bath:1,cistern:1},sense:1.35,speed:1.08,search:1.1},
 orchestra:{name:'オーケストラ・ツー',subtitle:'終演のない大聖堂',description:'尖塔の影、黙したオルガン、深紅の幕。わずかな灯りを頼りに、石造りの音楽堂を抜ける。',challenge:'高難度 · 深い闇と執拗な捜索',links:30,salt:0x27c491,fog:'#050609',density:.032,moon:.022,counts:{hall:5,stone:3,cave:3,factory:3,cistern:2,bath:1,yokocho:3,shop:2,field:1},sense:1.2,speed:1.05,search:1.4},
 circus:{name:'夜廻りサーカス',subtitle:'誰もいない、最後の公演',description:'古びた大天幕と、四駅を巡るトロッコ。回転台、跳ね橋、開閉幕を操り、誘導灯で追手を惑わせながら舞台裏を進む。',challenge:'仕掛けの迷宮 · 〇で装置を操作・トロッコに乗車',links:36,salt:0x63c8b5,fog:'#18101a',density:.022,moon:.07,counts:{hall:4,stone:2,factory:3,shop:4,cave:2,field:3,yokocho:3,bath:1,cistern:1},sense:1.13,speed:1.03,search:1.18},
};
export function stageRules(stage:StageId,mode:PlayMode){const p=STAGES[stage],m=modeRules(mode);return {...m,sense:m.sense*p.sense,speed:m.speed*p.speed,search:m.search*p.search};}
/** Connected sector graph; the fixed stair bridge must be part of the graph. */
export function sectorConnections(random:()=>number,count:number){
 const candidates:[number,number][]=[];for(let i=0;i<25;i++){if(i%5<4)candidates.push([i,i+1]);if(i<20)candidates.push([i,i+5]);}
 if(count===40)return new Set(candidates.map(([a,b])=>a+':'+b));
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const parent=Array.from({length:25},(_,i)=>i),root=(i:number):number=>parent[i]===i?i:parent[i]=root(parent[i]);
 const result=new Set<string>(),join=(a:number,b:number)=>{parent[root(a)]=root(b);result.add(a+':'+b);};
 join(12,13);join(13,18);
 for(const [a,b] of candidates)if(root(a)!==root(b))join(a,b);
 for(const [a,b] of candidates){if(result.size>=count)break;result.add(a+':'+b);}
 return result;
}
