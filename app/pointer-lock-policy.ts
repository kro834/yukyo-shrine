export type LockOwner='mouse'|'gamepad';
export type LockTicket={generation:number;owner:LockOwner};
/** Browser lock promises can settle after a menu or input-mode change. */
export class PointerLockPolicy {
 generation=0;desired:LockOwner|null=null;pending:number|null=null;resumeMouse=false;
 begin(owner:LockOwner):LockTicket{const generation=++this.generation;this.desired=owner;this.pending=generation;return {generation,owner};}
 reject(ticket:LockTicket){if(ticket.generation!==this.generation||this.pending!==ticket.generation)return false;this.pending=null;return true;}
 acquired(){this.pending=null;}
 openMenu(mode:string,locked:boolean){this.resumeMouse=mode!=='gamepad'&&locked;this.cancel();}
 resume(mode:string):LockOwner|null{const owner=mode==='gamepad'?'gamepad':this.resumeMouse?'mouse':null;this.resumeMouse=false;return owner;}
 touch(){this.resumeMouse=false;this.cancel();}
 cancel(){++this.generation;this.desired=null;this.pending=null;}
 accepts(paused:boolean,mode:string){return !paused&&(this.desired==='mouse'||this.desired==='gamepad'&&mode==='gamepad');}
}
