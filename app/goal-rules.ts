export const BEAD_REQUIREMENTS={blue:6,red:2,gold:1} as const;
export type BeadCounts={blue:number;red:number;gold?:number};
export function collectionReady(counts:BeadCounts){return counts.blue>=BEAD_REQUIREMENTS.blue||counts.red>=BEAD_REQUIREMENTS.red||(counts.gold??0)>=BEAD_REQUIREMENTS.gold;}
