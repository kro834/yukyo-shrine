export type PlayMode = 'gallery' | 'normal' | 'hard' | 'nightmare';
export const PLAY_MODES = [
  {id:'gallery',name:'ギャラリー',detail:'敵のいない回廊を、ゆっくり鑑賞。',label:'静かな散策'},
  {id:'normal',name:'ノーマル',detail:'灯りと足音に気を配り、勾玉を祭壇へ。',label:'探索と逃走'},
  {id:'hard',name:'ハード',detail:'敵の感覚と捜索が鋭くなる、緊張の探索。',label:'高い警戒'},
  {id:'nightmare',name:'悪夢',detail:'祭壇の針は灯りを消した時だけ現れ、息も長くは続かない。',label:'最高難度'},
] as const;
export const modeRules=(mode:PlayMode)=>({enemies:mode!=='gallery',sense:mode==='nightmare'?1.6:mode==='hard'?1.35:1,speed:mode==='nightmare'?1.15:mode==='hard'?1.1:1,search:mode==='nightmare'?1.85:mode==='hard'?1.45:1});
/** Nightmare shows the altar bearing only in darkness and always limits sprinting. */
export const modeAids=(mode:PlayMode)=>({darkCompass:mode==='nightmare',staminaForced:mode==='nightmare'});
