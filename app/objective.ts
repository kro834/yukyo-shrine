import {BEAD_REQUIREMENTS,collectionReady} from './goal-rules.ts';
import {ENEMY_NAMES,type FinaleKind} from './enemy-traits.ts';
import type {PlayMode} from './play-mode.ts';
export type ObjectiveInput={blue:number;red:number;gold:number;blueOffered:number;redOffered:number;unlocked:boolean;finale:FinaleKind|null};
/** One sentence of direction for the HUD and the pause menu. */
export function objective(mode:PlayMode,c:ObjectiveInput):{step:'explore'|'collect'|'offer'|'gate';title:string;detail:string}{
 if(mode==='gallery')return {step:'explore',title:'自由に散策する',detail:'敵はいません。封門は開いています'};
 const foe=c.finale?ENEMY_NAMES[c.finale]:'';
 if(c.unlocked)return {step:'gate',title:'封門をくぐる',detail:foe?foe+'を振り切り、祭壇の奥の扉へ':'祭壇の奥の扉が開いています'};
 if(collectionReady({blue:c.blue+c.blueOffered,red:c.red+c.redOffered,gold:c.gold}))return {step:'offer',title:'祭壇に奉納する',detail:foe?foe+'から逃れながら祭壇へ':'集めた勾玉を祭壇へ'};
 return {step:'collect',title:'勾玉を集める',detail:`青${BEAD_REQUIREMENTS.blue}・赤${BEAD_REQUIREMENTS.red}・金${BEAD_REQUIREMENTS.gold} のいずれかを揃える`};
}
/** Pip states for each offering route: offered, held, then empty. */
export function routePips(held:number,offered:number,required:number):('offered'|'held'|'empty')[]{
 const o=Math.min(required,Math.max(0,offered)),h=Math.min(required-o,Math.max(0,held));
 return Array.from({length:required},(_,i)=>i<o?'offered':i<o+h?'held':'empty');
}
