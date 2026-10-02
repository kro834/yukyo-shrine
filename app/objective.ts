import {BEAD_REQUIREMENTS,collectionReady} from './goal-rules.ts';
import {ENEMY_NAMES,type FinaleKind} from './enemy-traits.ts';
import type {PlayMode} from './play-mode.ts';
import {RITE_SECONDS} from './shrine-goal.ts';
export type ObjectiveInput={blue:number;red:number;gold:number;blueOffered:number;redOffered:number;unlocked:boolean;finale:FinaleKind|null;omen?:boolean;rite?:{progress:number;remaining?:number}|null};
/** One sentence of direction for the HUD and the pause menu. */
export function objective(mode:PlayMode,c:ObjectiveInput):{step:'explore'|'collect'|'offer'|'gate';title:string;detail:string}{
 if(mode==='gallery')return {step:'explore',title:'自由に散策する',detail:'敵はいません。封門は開いています'};
 const foe=c.finale?ENEMY_NAMES[c.finale]:'',surplus=c.unlocked&&c.blue+c.red+c.gold>0?' · 余った勾玉は祭壇で点になる':'';
 if(c.omen)return {step:c.unlocked?'gate':'offer',title:'何かが来る — 祭壇へ向かえ',detail:'鐘が三つ鳴る前に、祭壇への道を思い出せ'};
 if(c.rite){const remaining=c.rite.remaining??RITE_SECONDS*(1-c.rite.progress);return {step:'gate',title:'封門の儀 · 祭壇の輪の中で耐えよ',detail:(foe||'影')+'が輪の中では遅くなる · '+Math.max(0,Math.ceil(remaining-1e-9))+'秒'+surplus};}
 if(c.unlocked)return {step:'gate',title:'封門をくぐる',detail:(foe?foe+'を振り切り、祭壇の奥の扉へ':'祭壇の奥の扉が開いています')+surplus};
 if(collectionReady({blue:c.blue+c.blueOffered,red:c.red+c.redOffered,gold:c.gold}))return {step:'offer',title:'祭壇に奉納する',detail:foe?foe+'から逃れながら祭壇へ':'集めた勾玉を祭壇へ'};
 return {step:'collect',title:'勾玉を集める',detail:`青${BEAD_REQUIREMENTS.blue}・赤${BEAD_REQUIREMENTS.red}・金${BEAD_REQUIREMENTS.gold} のいずれかを揃える`};
}
/** Pip states for each offering route: offered, held, then empty. */
export function routePips(held:number,offered:number,required:number):('offered'|'held'|'empty')[]{
 const o=Math.min(required,Math.max(0,offered)),h=Math.min(required-o,Math.max(0,held));
 return Array.from({length:required},(_,i)=>i<o?'offered':i<o+h?'held':'empty');
}
