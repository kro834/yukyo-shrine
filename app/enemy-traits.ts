export const EXTRA_ENEMY_PROFILES={
 mire:{sight:60,nearSight:3,cone:-.35,chase:7.4,patrol:2.7,hearing:35},
 warden:{sight:12,nearSight:2,cone:.55,chase:7.2,patrol:2.8,hearing:185},
 fox:{sight:38,nearSight:3.5,cone:.1,chase:8.2,patrol:3.4,hearing:84},
 pilgrim:{sight:32,nearSight:4,cone:.15,chase:8.8,patrol:3.1,hearing:102},
 hatred:{sight:1e6,nearSight:1e6,cone:-1,chase:6.4,patrol:6.4,hearing:1e6},
 wrath:{sight:1e6,nearSight:1e6,cone:-1,chase:7.6,patrol:7.6,hearing:1e6},
} as const;
export type FinaleKind='hatred'|'wrath';
export const isFinale=(kind:string):kind is FinaleKind=>kind==='hatred'||kind==='wrath';
export const ENEMY_NAMES={mire:'泥這い',warden:'鐘守',fox:'狐面の影',pilgrim:'枯枝の巡礼',hatred:'憎悪',wrath:'憤怒'} as const;
export function rushPhase(time:number){const phase=Math.max(0,time)%3.6;return phase<.65?'windup':phase<1.75?'rush':'recover';}
export function traitSpeed(kind:string,chasing:boolean,time:number,base:number){
 if(kind==='hatred')return 6.4;
 if(kind==='wrath')return Math.max(5.4,Math.min(7.6,6.5+Math.sin(time*.7)*1.1));
 if(kind!=='pilgrim'||!chasing)return base;
 return rushPhase(time)==='windup'?.6:rushPhase(time)==='rush'?Math.min(8.9,base):3.2;
}
