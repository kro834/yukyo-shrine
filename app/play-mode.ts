export type PlayMode = 'gallery' | 'normal' | 'hard';
export const PLAY_MODES = [
  {id:'gallery',name:'ギャラリー',detail:'敵のいない回廊を、ゆっくり鑑賞。',label:'静かな散策'},
  {id:'normal',name:'ノーマル',detail:'灯りと足音に気を配り、勾玉を祭壇へ。',label:'探索と逃走'},
  {id:'hard',name:'ハード',detail:'敵の感覚と捜索が鋭くなる、緊張の探索。',label:'高い警戒'},
] as const;
export const modeRules=(mode:PlayMode)=>({enemies:mode!=='gallery',sense:mode==='hard'?1.35:1,speed:mode==='hard'?1.1:1,search:mode==='hard'?1.45:1});
