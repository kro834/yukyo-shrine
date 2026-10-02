/** 気配: graded, telegraphed noticing. A lit sighting fills the gauge faster up
 * close; in the dark only a moving visitor within arm's reach is sensed. */
export type NoticeRules={seconds:number;darkRadius:number;darkFill:number};
export const NOTICE_OFF:NoticeRules={seconds:0,darkRadius:0,darkFill:0};
export const NOTICE_DECAY=.6,SUSPECT_AT=.35,FORGET_AT=.2,TURN_RATE=2.5,CROUCH_DARK=.3,CROUCH_LIT=.6,HUNTER_FILL=1.4,RUN_INSTANT=12;
export const KIND_DARK:Readonly<Record<string,number>>={listener:1.4,errorWeep:1.5,warden:1.2,watcher:.6,errorWatch:0,hotelStaff:.8,hotelGuest:.8};
const DARK_BEHIND=.5,DARK_TOUCH=.9,SNAP=1e-9;
/** sightRange and nearRange are the posture-adjusted ranges the `sees` test
 * compared against (sight·CROUCH_SIGHT, nearSight·CROUCH_NEAR when low). */
export function litFillRate(rules:NoticeRules,distance:number,sightRange:number,nearRange:number,running:boolean,crouching:boolean,hunting:boolean){
 if(!(rules.seconds>0)||distance<nearRange||running&&distance<RUN_INSTANT)return Infinity;
 const near=sightRange>0?Math.max(0,Math.min(1,1-distance/sightRange)):0;
 return (1+3*near*near)/rules.seconds*(crouching?CROUCH_LIT:1)*(hunting?HUNTER_FILL:1);
}
/** facing is the cosine toward the visitor; behind the enemy the reach halves
 * unless the visitor is all but touching it. */
export function darkFillRate(rules:NoticeRules,kind:string,distance:number,facing:number,moving:boolean,crouching:boolean,hunting:boolean){
 if(!moving||!(rules.darkFill>0))return 0;
 const reach=rules.darkRadius*(Object.hasOwn(KIND_DARK,kind)?KIND_DARK[kind]:1)*(facing>0||distance<DARK_TOUCH?1:DARK_BEHIND);
 return distance<reach?rules.darkFill*(crouching?CROUCH_DARK:1)*(hunting?HUNTER_FILL:1):0;
}
export function stepAlert(alert:number,fill:number,dt:number){
 const current=Number.isFinite(alert)?Math.max(0,Math.min(1,alert)):0;
 if(!Number.isFinite(dt)||dt<=0)return current;
 if(fill>0){const next=current+fill*dt;return next>=1-SNAP?1:next;}
 const next=current-NOTICE_DECAY*dt;return next<=SNAP?0:next;
}
/** Shortest-arc turn, continuous with the previous yaw like patrol steering. */
export function turnToward(facing:number,desired:number,dt:number,rate=TURN_RATE){
 const turn=Math.atan2(Math.sin(desired-facing),Math.cos(desired-facing)),limit=Math.max(0,dt)*rate;
 return facing+Math.max(-limit,Math.min(limit,turn));
}
