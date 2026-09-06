// Gameplay hearing is independent of browser audio/autoplay availability.
export class RunningSteps {
  private next=0;
  update(dt:number,running:boolean,moving:boolean){
    if(!running||!moving){this.next=0;return false;}
    this.next-=dt;if(this.next>0)return false;this.next=.29;return true;
  }
}
export function createFootstepAudio(){
  let context:AudioContext|null=null,noise:AudioBuffer|null=null,disposed=false;
  const unlock=()=>{
    if(disposed)return;
    const Audio=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Audio)return;
    try{context??=new Audio();if(context.state==='suspended')void context.resume().catch(()=>{});}catch{}
  };
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
  return {
    play(hard:boolean){
      if(!context||context.state!=='running'||disposed)return;
      if(!noise){noise=context.createBuffer(1,context.sampleRate*.12,context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
      const t=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      source.buffer=noise;filter.type='lowpass';filter.frequency.value=hard?1700:650;
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(hard?.15:.11,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.11);
      source.connect(filter).connect(gain).connect(context.destination);source.start(t);source.stop(t+.12);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      const thud=context.createOscillator(),body=context.createGain();thud.frequency.setValueAtTime(hard?105:80,t);thud.frequency.exponentialRampToValueAtTime(38,t+.09);
      body.gain.setValueAtTime(.1,t);body.gain.exponentialRampToValueAtTime(.0001,t+.1);thud.connect(body).connect(context.destination);thud.start(t);thud.stop(t+.11);thud.onended=()=>{thud.disconnect();body.disconnect();};
    },
    dispose(){disposed=true;document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);if(context)void context.close().catch(()=>{});}
  };
}
