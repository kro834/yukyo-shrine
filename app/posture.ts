/** Crouching trades pace for a smaller silhouette. Sprint input always stands
 * the visitor up, so a chase never begins with an unresponsive run button.
 */
export const STAND_EYE=1.68,CROUCH_EYE=1.02,CROUCH_PACE=.5;
/** Ordinary enemies see a crouched visitor over a shorter range and aim their
 * line of sight at the lowered body, so low furniture can conceal it. */
export const CROUCH_SIGHT=.6,CROUCH_NEAR=.7,CROUCH_TARGET=.95,STAND_TARGET=1.5;
export class Posture {
 crouching=false;eye=STAND_EYE;
 toggle(){this.crouching=!this.crouching;return this.crouching;}
 /** Returns the sprint request that remains after resolving the posture. */
 resolve(sprint:boolean,moving:boolean){if(this.crouching&&sprint&&moving)this.crouching=false;return sprint&&!this.crouching;}
 step(dt:number){
  const target=this.crouching?CROUCH_EYE:STAND_EYE;
  this.eye+=(target-this.eye)*(1-Math.exp(-Math.max(0,Math.min(dt,.15))*11));
  if(Math.abs(this.eye-target)<1e-4)this.eye=target;
  return this.eye;
 }
 reset(){this.crouching=false;this.eye=STAND_EYE;}
}
