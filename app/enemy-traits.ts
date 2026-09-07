export const EXTRA_ENEMY_PROFILES={
 mire:{sight:60,nearSight:3,cone:-.35,chase:7.4,patrol:2.7,hearing:35},
 warden:{sight:12,nearSight:2,cone:.55,chase:7.2,patrol:2.8,hearing:185},
 fox:{sight:38,nearSight:3.5,cone:.1,chase:8.2,patrol:3.4,hearing:84},
 pilgrim:{sight:32,nearSight:4,cone:.15,chase:8.8,patrol:3.1,hearing:102},
 hatred:{sight:1e6,nearSight:1e6,cone:-1,chase:8.7,patrol:8.7,hearing:1e6},
 wrath:{sight:1e6,nearSight:1e6,cone:-1,chase:16.2,patrol:3.2,hearing:1e6},
} as const;
export type FinaleKind='hatred'|'wrath';
export const isFinale=(kind:string):kind is FinaleKind=>kind==='hatred'||kind==='wrath';
export const ENEMY_NAMES={mire:'泥這い',warden:'鐘守',fox:'狐面の影',pilgrim:'枯枝の巡礼',hatred:'憎悪',wrath:'憤怒'} as const;
export const FINALE_BALANCE={
 hatred:{startSpeed:8.7,maximumSpeed:11.4,pressureSeconds:18,predictionSeconds:.8,predictionMetres:5,replan:.18,doorDelay:.18},
 wrath:{windupSeconds:.75,rushSeconds:1.25,recoverySeconds:1.65,windupSpeed:1.1,rushSpeed:16.2,recoverySpeed:3.2,replan:.16,doorDelay:.12},
} as const;
export function hatredPressure(time:number){return Math.max(0,Math.min(1,time/FINALE_BALANCE.hatred.pressureSeconds));}
/** This active-chase clock is shared by movement and the visible boss telegraph. */
export function finalePhase(kind:string,time:number):'pressure'|'windup'|'rush'|'recover'{
 if(kind!=='wrath')return 'pressure';
 const b=FINALE_BALANCE.wrath,phase=(Math.max(0,time)+1e-9)%(b.windupSeconds+b.rushSeconds+b.recoverySeconds);
 return phase<b.windupSeconds?'windup':phase<b.windupSeconds+b.rushSeconds?'rush':'recover';
}
/** Finale difficulty has a fixed ceiling, without red-area or pressure multipliers. */
export function finaleSpeed(kind:FinaleKind,time:number,difficulty=1){
 const h=FINALE_BALANCE.hatred,w=FINALE_BALANCE.wrath,phase=finalePhase(kind,time);
 const speed=kind==='hatred'?h.startSpeed+(h.maximumSpeed-h.startSpeed)*hatredPressure(time):phase==='windup'?w.windupSpeed:phase==='rush'?w.rushSpeed:w.recoverySpeed;
 return speed*Math.max(.85,Math.min(1.2,difficulty));
}
/** Integrate phase boundaries, so a frame ending at rush onset cannot steal
 * movement from the advertised windup or shorten the recovery interval. */
export function finaleDistance(kind:FinaleKind,time:number,dt:number,difficulty=1){
 const integral=(elapsed:number)=>{
  const t=Math.max(0,elapsed);
  if(kind==='hatred'){
   const b=FINALE_BALANCE.hatred,ramp=Math.min(t,b.pressureSeconds),gain=b.maximumSpeed-b.startSpeed;
   return b.startSpeed*t+gain*ramp*ramp/(2*b.pressureSeconds)+gain*Math.max(0,t-b.pressureSeconds);
  }
  const b=FINALE_BALANCE.wrath,cycle=b.windupSeconds+b.rushSeconds+b.recoverySeconds,cycles=Math.floor(t/cycle),phase=t-cycles*cycle;
  return cycles*(b.windupSeconds*b.windupSpeed+b.rushSeconds*b.rushSpeed+b.recoverySeconds*b.recoverySpeed)
   +Math.min(phase,b.windupSeconds)*b.windupSpeed
   +Math.max(0,Math.min(phase-b.windupSeconds,b.rushSeconds))*b.rushSpeed
   +Math.max(0,phase-b.windupSeconds-b.rushSeconds)*b.recoverySpeed;
 };
 return Math.max(0,integral(time+Math.max(0,dt))-integral(time))*Math.max(.85,Math.min(1.2,difficulty));
}
/** A short lead, never a navigation shortcut. The caller validates it against walls. */
export function hatredIntercept(player:{x:number;z:number},velocity:{x:number;z:number},time:number,distance:number){
 const b=FINALE_BALANCE.hatred,horizon=Math.min(.4+(b.predictionSeconds-.4)*hatredPressure(time),Math.max(0,distance-2)/11.4);
 const speed=Math.hypot(velocity.x,velocity.z),scale=Math.min(horizon,b.predictionMetres/Math.max(speed,.001));
 return {x:player.x+velocity.x*scale,z:player.z+velocity.z*scale};
}
export function rushPhase(time:number){const phase=Math.max(0,time)%3.6;return phase<.65?'windup':phase<1.75?'rush':'recover';}
export function traitSpeed(kind:string,chasing:boolean,time:number,base:number){
 if(isFinale(kind))return finaleSpeed(kind,time);
 if(kind!=='pilgrim'||!chasing)return base;
 return rushPhase(time)==='windup'?.6:rushPhase(time)==='rush'?Math.min(8.9,base):3.2;
}
