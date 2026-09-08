import type {Cell} from './shrine-layout.ts';
import {modeRules,type PlayMode} from './play-mode.ts';
export type StageId='shrine'|'abyss'|'outer'|'orchestra'|'circus'|'error'|'parallel'|'mountain'|'ultrareal';
export const canTransitionStage=(_mode:PlayMode,completed:boolean,_current:StageId,_next:StageId)=>completed;
type Profile={name:string;subtitle:string;description:string;challenge:string;links:number;salt:number;fog:string;density:number;moon:number;counts:Partial<Record<Cell['kind'],number>>;sense:number;speed:number;search:number};
export const STAGES:Record<StageId,Profile>={
 ultrareal:{name:'ウルトラリアル',subtitle:'チェックアウトのないホテル',description:'雨に閉ざされた大型ホテル。カーペットの客室棟、静かなダイニング、エグゼクティブルームと三階を結ぶエレベーター。人間のように歩く宿泊者が、長い廊下の向こうにいる。',challenge:'現実に近い歩行 · 〇で扉・エレベーター操作／1F→2F→3F',links:36,salt:0x407e19,fog:'#141716',density:.013,moon:.035,counts:{hall:3,stone:4,yokocho:3,shop:3,bath:2,factory:2,cistern:2,cave:2,field:2},sense:.8,speed:1,search:.8},
 mountain:{name:'霧嶺',subtitle:'霧の高山と、途絶えた鉱山鉄道',description:'霧が流れ込む山腹、稜線に沿うガイドウェイ、逃走用の高速トロッコが巡る廃坑。山頂の観測所へ登り、消えた登山者の痕跡を辿る。',challenge:'山岳探索 · 〇でトロッコ乗車／最高速度はダッシュの約1.7倍',links:36,salt:0x6a17e4,fog:'#344148',density:.033,moon:.27,counts:{hall:3,stone:3,cave:4,field:4,factory:2,cistern:2,bath:1,shop:2,yokocho:2},sense:1.17,speed:1.05,search:1.22},
 parallel:{name:'パラレルワールド',subtitle:'現実の継ぎ目から落ちた街',description:'宙に浮く渡り場、誰も帰らない家、空中庭園。事務棟・ホテル・プール・地下駅が不可能な順番でつながり、空間を渡る異形が追ってくる。',challenge:'最危険 · 空間転移と高速突進／フラッシュと遮蔽物で切り返す',links:34,salt:0x91a7e3,fog:'#20202d',density:.009,moon:.14,counts:{hall:3,stone:3,bath:3,factory:2,cistern:2,shop:3,yokocho:2,cave:2,field:3},sense:1.35,speed:1.1,search:1.45},
 shrine:{name:'祭殿回廊',subtitle:'封じられた社',description:'灯りの残る回廊と、忘れられた街。',challenge:'青6個・赤2個・金1個のいずれかを奉納',links:40,salt:0,fog:'#100c09',density:.0205,moon:.10,counts:{hall:5,yokocho:5,shop:4,cave:3,field:2,factory:1,bath:2,cistern:1},sense:1,speed:1,search:1},
 abyss:{name:'深淵',subtitle:'地の底の水音',description:'低く迫る岩盤、埋没した横丁、冷たい地下水槽。地上のない閉鎖迷宮で、長く続く捜索を振り切る。',challenge:'高難度 · 長い捜索と少ない迂回路',links:28,salt:0x51ab92,fog:'#050e13',density:.038,moon:.008,counts:{hall:3,cave:8,cistern:4,factory:3,bath:2,yokocho:1,shop:1,field:1},sense:1.15,speed:1.03,search:1.55},
 outer:{name:'外縁',subtitle:'月下の境界',description:'草に埋もれたあぜ道、終電の去った木造駅、夕暮れの廃校舎。懐かしい景色の奥で、遠くから届く視線に気を配る。',challenge:'高難度 · 広い視界と素早い追跡',links:36,salt:0x3a971c,fog:'#142332',density:.012,moon:.20,counts:{hall:3,field:6,yokocho:4,shop:4,cave:2,factory:2,bath:1,cistern:1},sense:1.35,speed:1.08,search:1.1},
 orchestra:{name:'オーケストラ・ツー',subtitle:'終演のない大聖堂',description:'尖塔の影、黙したオルガン、深紅の幕。わずかな灯りを頼りに、石造りの音楽堂を抜ける。',challenge:'高難度 · 深い闇と執拗な捜索',links:30,salt:0x27c491,fog:'#050609',density:.032,moon:.022,counts:{hall:5,stone:3,cave:3,factory:3,cistern:2,bath:1,yokocho:3,shop:2,field:1},sense:1.2,speed:1.05,search:1.4},
 circus:{name:'夜廻りサーカス',subtitle:'誰もいない、最後の公演',description:'古びた大天幕と、四駅を巡るトロッコ。回転台、跳ね橋、開閉幕を操り、誘導灯で追手を惑わせながら舞台裏を進む。',challenge:'仕掛けの迷宮 · 〇で装置を操作・トロッコに乗車',links:36,salt:0x63c8b5,fog:'#18101a',density:.022,moon:.07,counts:{hall:4,stone:2,factory:3,shop:4,cave:2,field:3,yokocho:3,bath:1,cistern:1},sense:1.13,speed:1.03,search:1.18},
 error:{name:'エラー',subtitle:'面の裏には、誰もいない',description:'繰り返す能舞台、封じられた楽屋、朱に染まる鏡の間。灯りを追う「逆面」と、足音を追う「哭面」が、終わらない演目を巡る。',challenge:'異常領域 · 専用の能面の敵2種／消灯と静かな歩行が鍵',links:28,salt:0xe77062,fog:'#100708',density:.030,moon:.018,counts:{hall:5,stone:4,shop:3,factory:3,bath:2,cistern:3,cave:1,field:1,yokocho:1},sense:1.24,speed:1.04,search:1.3},
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
