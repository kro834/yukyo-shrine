import type {StageId} from './stage-profile.ts';
import {WARD_BURN_HEARD,type Pace,type Surface,type WorldCue} from './world-cues.ts';
/** Procedural sound: every layer is synthesized, so nothing is downloaded and
 * the audio clock never waits on the network. Enemies remain silent; the
 * visitor hears the place, their own body and the consequences of actions. */
export type Mix={master:number;ambience:number;effects:number};
export type Mood='title'|'play'|'paused'|'clear';
export type SoundFrame={mood:Mood;pressure:number;chase:boolean;frozen:boolean;exhausted:boolean;area:string;elevation:number};
type Ambient='creak'|'drip'|'chime'|'insects'|'rumble'|'rockfall'|'bell'|'organ'|'musicbox'|'flap'|'tsuzumi'|'fue'|'glitch'|'gust'|'ding'|'knock'|'train';
type Profile={drone:readonly number[];wave:OscillatorType;level:number;wind:number;band:number;rain:number;hum:number;shimmer:number;wet:number;events:readonly Ambient[];gap:readonly [number,number]};
const profile=(p:Partial<Profile>&Pick<Profile,'drone'|'events'>):Profile=>({wave:'sine',level:.04,wind:.035,band:500,rain:0,hum:0,shimmer:0,wet:.5,gap:[8,18],...p});
export const PROFILES:Record<StageId,Profile>={
 shrine:profile({drone:[55,82.6],level:.045,wind:.035,band:520,events:['creak','creak','chime','drip'],gap:[7,17]}),
 abyss:profile({drone:[41.2,61.9],level:.055,wind:.02,band:260,wet:.85,events:['drip','drip','drip','rumble','rockfall'],gap:[3,9]}),
 outer:profile({drone:[65.4,98.1],level:.022,wind:.06,band:720,wet:.25,events:['insects','insects','insects','gust','chime'],gap:[3,8]}),
 orchestra:profile({drone:[36.7,55.1,73.5],wave:'triangle',level:.04,wind:.025,band:420,wet:1,events:['bell','organ','creak'],gap:[9,20]}),
 circus:profile({drone:[49,73.5],level:.03,wind:.05,band:340,wet:.45,events:['musicbox','flap','creak','flap'],gap:[7,15]}),
 error:profile({drone:[46.3,69.4,92.9],wave:'sawtooth',level:.016,wind:.018,band:380,wet:.65,events:['tsuzumi','fue','glitch','tsuzumi'],gap:[6,14]}),
 parallel:profile({drone:[58.3,87.4],level:.03,wind:.03,band:600,shimmer:.006,wet:.7,events:['glitch','train','chime'],gap:[7,15]}),
 mountain:profile({drone:[43.7,65.5],level:.028,wind:.1,band:620,wet:.3,events:['gust','gust','rockfall','drip'],gap:[5,12]}),
 ultrareal:profile({drone:[50,100],level:.02,wind:.01,band:300,rain:.055,hum:.012,wet:.3,events:['ding','knock','creak'],gap:[10,22]}),
};
export const DEFAULT_MIX:Mix={master:.8,ambience:.7,effects:.85};
export const STEP_LEVEL:Record<Pace,number>={run:1,walk:.42,crouch:.2};
/** The heartbeat follows the visible threat meter; a chase is never calm. */
export function heartbeat(pressure:number,chase:boolean,frozen:boolean){
 const intensity=frozen?0:Math.max(chase?.45:0,Math.min(1,Math.max(0,pressure)));
 return intensity<.06?null:{bpm:58+92*intensity,level:.25+.75*intensity};
}
/** A landed bell or a flaring ward is quieter the farther it is from the visitor. */
export function ringFalloff(distance?:number){return 1/(1+Math.max(0,Number.isFinite(distance)?distance!:0)/8);}
/** Ambience is muffled by menus, a time stop and the moment of capture. */
export function moodFilter(mood:Mood,frozen:boolean,stunned:boolean){
 if(mood==='paused')return {cutoff:700,level:.45};
 if(stunned)return {cutoff:260,level:.35};
 if(frozen&&mood==='play')return {cutoff:380,level:.6};
 return mood==='clear'?{cutoff:2400,level:.35}:{cutoff:16000,level:1};
}
type Graph={master:GainNode;ambience:GainNode;muffle:BiquadFilterNode;effects:GainNode;send:GainNode;wetReturn:GainNode;noise:AudioBuffer};
type Bed={level:GainNode;wind:GainNode;hum:GainNode;sources:AudioScheduledSourceNode[];nodes:AudioNode[]};
type Voice={gain:number;wet?:number;pan?:number;bus?:'fx'|'amb'};
type ToneSpec={f:number;to?:number;type?:OscillatorType;t:number;attack?:number;decay:number;gain:number;lowpass?:number};
type HissSpec={t:number;attack?:number;decay:number;gain:number;type:BiquadFilterType;f:number;to?:number;q?:number};
type Options={context?:()=>AudioContext|null;events?:Pick<Document,'addEventListener'|'removeEventListener'>;random?:()=>number};
export function createSoundscape(options:Options={}){
 const random=options.random??Math.random,events=options.events??(typeof document==='undefined'?undefined:document);
 const make=options.context??(()=>{const A=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;return A?new A():null;});
 let ctx:AudioContext|null=null,graph:Graph|null=null,bed:Bed|null=null,stage:StageId='shrine',mix:Mix={...DEFAULT_MIX},disposed=false;
 let nextBeat=0,nextBreath=0,nextEvent=0,stunnedUntil=0,side=1,lastFilter='',lastWind=-1,lastHum=-1;
 const running=()=>!!ctx&&!!graph&&!disposed&&ctx.state==='running';
 const env=(param:AudioParam,t:number,peak:number,attack:number,decay:number)=>{param.setValueAtTime(.0001,t);param.exponentialRampToValueAtTime(Math.max(.0002,peak),t+attack);param.exponentialRampToValueAtTime(.0001,t+attack+decay);};
 /** One disposable voice: every node is disconnected when its last source ends. */
 const sound=(v:Voice)=>{
  const c=ctx!,g=graph!,nodes:AudioNode[]=[];let live=0;
  const own=<T extends AudioNode>(n:T)=>{nodes.push(n);return n;};
  const out=own(c.createGain());out.gain.value=v.gain;let head:AudioNode=out;
  if(v.pan&&typeof c.createStereoPanner==='function'){const p=own(c.createStereoPanner());p.pan.value=Math.max(-1,Math.min(1,v.pan));out.connect(p);head=p;}
  head.connect(v.bus==='amb'?g.ambience:g.effects);
  if(v.wet){const w=own(c.createGain());w.gain.value=v.wet;head.connect(w);w.connect(g.send);}
  const start=(s:AudioScheduledSourceNode,t:number,end:number,offset?:number)=>{live++;own(s);s.onended=()=>{if(--live===0)for(const n of nodes)n.disconnect();};if(offset===undefined)s.start(t);else (s as AudioBufferSourceNode).start(t,offset);s.stop(end);};
  const tone=(o:ToneSpec)=>{
   const osc=own(c.createOscillator()),amp=own(c.createGain()),attack=o.attack??.005;osc.type=o.type??'sine';osc.frequency.setValueAtTime(o.f,o.t);if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,o.t+attack+o.decay);
   env(amp.gain,o.t,o.gain,attack,o.decay);let tail:AudioNode=osc;if(o.lowpass){const f=own(c.createBiquadFilter());f.type='lowpass';f.frequency.value=o.lowpass;osc.connect(f);tail=f;}tail.connect(amp);amp.connect(out);start(osc,o.t,o.t+attack+o.decay+.05);
  };
  const hiss=(o:HissSpec)=>{
   const src=own(c.createBufferSource()),filter=own(c.createBiquadFilter()),amp=own(c.createGain()),attack=o.attack??.005;src.buffer=g.noise;filter.type=o.type;filter.Q.value=o.q??.8;filter.frequency.setValueAtTime(o.f,o.t);if(o.to)filter.frequency.exponentialRampToValueAtTime(o.to,o.t+attack+o.decay);
   env(amp.gain,o.t,o.gain,attack,o.decay);src.connect(filter);filter.connect(amp);amp.connect(out);start(src,o.t,o.t+attack+o.decay+.05,random()*2.5);
  };
  // Inharmonic partials of a small temple bell (rin).
  const bell=(f:number,t:number,gain:number,decay:number)=>{for(const [ratio,level,length] of [[1,1,1],[2.76,.5,.6],[5.4,.28,.35],[8.93,.14,.2]])if(f*ratio<c.sampleRate*.45)tone({f:f*ratio,t,attack:.004,decay:decay*length,gain:gain*level});};
  return {tone,hiss,bell};
 };
 const impulse=(c:AudioContext,seconds:number)=>{const length=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,length,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<length;i++)d[i]=(random()*2-1)*Math.pow(1-i/length,3.4);}return b;};
 const build=(c:AudioContext):Graph=>{
  const noise=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=random()*2-1;
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=6;limiter.connect(c.destination);
  const master=c.createGain();master.gain.value=mix.master;master.connect(limiter);
  const muffle=c.createBiquadFilter();muffle.type='lowpass';muffle.frequency.value=16000;muffle.connect(master);
  const ambience=c.createGain();ambience.gain.value=mix.ambience;ambience.connect(muffle);
  const effects=c.createGain();effects.gain.value=mix.effects;effects.connect(master);
  const reverb=c.createConvolver();reverb.buffer=impulse(c,2.8);const wetReturn=c.createGain();wetReturn.gain.value=PROFILES[stage].wet*.6;reverb.connect(wetReturn);wetReturn.connect(master);
  const send=c.createGain();send.connect(reverb);
  return {master,ambience,muffle,effects,send,wetReturn,noise};
 };
 /** The continuous bed: detuned drone, gusting wind and stage-specific layers. */
 const makeBed=(c:AudioContext,g:Graph,p:Profile):Bed=>{
  const nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[],t=c.currentTime;
  const own=<T extends AudioNode>(n:T)=>{nodes.push(n);return n;};
  const run=<T extends AudioScheduledSourceNode>(s:T)=>{own(s);sources.push(s);return s;};
  const level=own(c.createGain());level.gain.setValueAtTime(.0001,t);level.gain.exponentialRampToValueAtTime(1,t+2.5);level.connect(g.ambience);
  const lfo=(hz:number,depth:number,target:AudioParam)=>{const o=run(c.createOscillator()),d=own(c.createGain());o.frequency.value=hz;d.gain.value=depth;o.connect(d);d.connect(target);o.start(t);};
  const drone=own(c.createGain()),droneFilter=own(c.createBiquadFilter());drone.gain.value=p.level;droneFilter.type='lowpass';droneFilter.frequency.value=p.wave==='sawtooth'?300:440;droneFilter.connect(drone);drone.connect(level);
  const droneWet=own(c.createGain());droneWet.gain.value=.4;drone.connect(droneWet);droneWet.connect(g.send);
  for(const f of p.drone)for(const detune of [-4,4]){const o=run(c.createOscillator());o.type=p.wave;o.frequency.value=f;o.detune.value=detune+(random()-.5)*3;o.connect(droneFilter);o.start(t);}
  lfo(.055,p.level*.35,drone.gain);
  const noiseLoop=()=>{const s=run(c.createBufferSource());s.buffer=g.noise;s.loop=true;s.start(t,random()*3);return s;};
  const wind=own(c.createGain()),windBand=own(c.createBiquadFilter()),windLevel=own(c.createGain());windBand.type='bandpass';windBand.frequency.value=p.band;windBand.Q.value=.7;windLevel.gain.value=p.wind;
  noiseLoop().connect(windBand);windBand.connect(windLevel);windLevel.connect(wind);wind.connect(level);lfo(.07,p.band*.35,windBand.frequency);lfo(.13,p.wind*.45,windLevel.gain);
  if(p.rain){const high=own(c.createBiquadFilter()),low=own(c.createBiquadFilter()),rain=own(c.createGain());high.type='highpass';high.frequency.value=900;low.type='lowpass';low.frequency.value=6500;rain.gain.value=p.rain;noiseLoop().connect(high);high.connect(low);low.connect(rain);rain.connect(level);}
  const hum=own(c.createGain());hum.gain.value=p.hum;hum.connect(level);for(const f of [50,100]){const o=run(c.createOscillator());o.frequency.value=f;o.connect(hum);o.start(t);}
  if(p.shimmer){const s=own(c.createGain());s.gain.value=p.shimmer;s.connect(level);s.connect(g.send);for(const f of [1760,1767]){const o=run(c.createOscillator());o.frequency.value=f;o.connect(s);o.start(t);}lfo(.3,p.shimmer*.6,s.gain);}
  return {level,wind,hum,sources,nodes};
 };
 const dropBed=(old:Bed|null)=>{if(!old||!ctx)return;const t=ctx.currentTime;old.level.gain.cancelScheduledValues(t);old.level.gain.setTargetAtTime(.0001,t,.5);for(const s of old.sources){s.onended=null;s.stop(t+2.5);}setTimeout(()=>{for(const n of old.nodes)n.disconnect();},2800);};
 const unlock=()=>{
  if(disposed)return;
  try{
   if(!ctx){ctx=make();if(!ctx)return;graph=build(ctx);bed=makeBed(ctx,graph,PROFILES[stage]);}
   if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
  }catch{ctx=null;graph=null;bed=null;}
 };
 events?.addEventListener('pointerdown',unlock,true);events?.addEventListener('keydown',unlock,true);
 const now=()=>ctx!.currentTime+.01,pan=()=>(random()*2-1)*.8;
 /** Halves the ambience bed for a moment so a distant bell reads over it. */
 const duck=(seconds:number)=>{if(!running()||!bed||!(seconds>0))return;const t=ctx!.currentTime,g=bed.level.gain;g.cancelScheduledValues(t);g.setTargetAtTime(.5,t,.08);g.setTargetAtTime(1,t+Math.min(seconds,30),.35);};
 const ambient:Record<Ambient,(t:number)=>void>={
  creak:t=>{const s=sound({bus:'amb',gain:.3,wet:.5,pan:pan()}),f=380+random()*160;for(let i=0;i<5;i++)s.hiss({t:t+i*.085,attack:.02,decay:.08,gain:.7*(1-i*.12),type:'bandpass',f:f-i*22,q:14});},
  drip:t=>{const s=sound({bus:'amb',gain:.28,wet:.85,pan:pan()});s.tone({f:1500+random()*900,to:650,t,attack:.002,decay:.07,gain:.8});if(random()<.5)s.tone({f:1300+random()*700,to:600,t:t+.35+random()*.4,attack:.002,decay:.06,gain:.45});},
  chime:t=>{const s=sound({bus:'amb',gain:.1,wet:.6,pan:pan()});s.bell(2093*(1+random()*.03),t,.6,2.2);s.bell(2637,t+.18,.35,1.8);},
  insects:t=>{const s=sound({bus:'amb',gain:.045,wet:.3,pan:pan()}),f=3800+random()*900,n=4+Math.floor(random()*5);for(let i=0;i<n;i++)s.tone({f,t:t+i*.16,attack:.012,decay:.085,gain:.8});},
  rumble:t=>{const s=sound({bus:'amb',gain:.32,wet:.4});s.hiss({t,attack:.9,decay:1.8,gain:1,type:'lowpass',f:90,q:.7});s.tone({f:38,t,attack:.8,decay:1.6,gain:.6});},
  rockfall:t=>{const s=sound({bus:'amb',gain:.18,wet:.5,pan:pan()});for(let i=0;i<7;i++)s.hiss({t:t+i*.05+random()*.08,decay:.03+random()*.05,gain:.6+random()*.4,type:'bandpass',f:900+random()*1800,q:1.2});},
  bell:t=>sound({bus:'amb',gain:.09,wet:1,pan:pan()*.5}).bell(196,t,1,5),
  organ:t=>{const s=sound({bus:'amb',gain:.045,wet:.9});for(const f of [73.4,110,146.8,220])s.tone({f,t,attack:1.8,decay:3.2,gain:.5,type:'triangle',lowpass:900});},
  musicbox:t=>{const s=sound({bus:'amb',gain:.06,wet:.6,pan:pan()}),scale=[1046.5,1174.7,1318.5,1568,1760,2093],n=4+Math.floor(random()*3);for(let i=0;i<n;i++){const f=scale[Math.floor(random()*scale.length)]*(1+(random()-.5)*.02);s.tone({f,t:t+i*.38,attack:.003,decay:1.1,gain:.7});s.tone({f:f*2,t:t+i*.38,attack:.003,decay:.5,gain:.15});}},
  flap:t=>{const s=sound({bus:'amb',gain:.11,wet:.3,pan:pan()});for(let i=0;i<4;i++)s.hiss({t:t+i*.13+random()*.05,attack:.02,decay:.12,gain:.8,type:'bandpass',f:260+random()*120,q:.9});},
  tsuzumi:t=>{const s=sound({bus:'amb',gain:.22,wet:.7,pan:pan()});s.tone({f:190,to:128,t,attack:.003,decay:.35,gain:1});s.hiss({t,decay:.03,gain:.3,type:'highpass',f:2400});if(random()<.5)s.tone({f:240,to:150,t:t+.9,attack:.003,decay:.3,gain:.8});},
  fue:t=>{const s=sound({bus:'amb',gain:.045,wet:.85,pan:pan()});s.tone({f:1400,to:2100,t,attack:.5,decay:1.4,gain:.7});s.hiss({t,attack:.4,decay:1.3,gain:.5,type:'bandpass',f:1700,q:6});},
  glitch:t=>{const s=sound({bus:'amb',gain:.03,wet:.2,pan:pan()});for(let i=0;i<6;i++)s.tone({f:200+random()*1800,t:t+i*.035,attack:.001,decay:.025,gain:.8,type:'square'});},
  gust:t=>sound({bus:'amb',gain:.28,wet:.2,pan:pan()}).hiss({t,attack:1.1,decay:1.6,gain:1,type:'bandpass',f:450,to:950,q:.6}),
  ding:t=>{const s=sound({bus:'amb',gain:.07,wet:.7,pan:pan()});s.bell(1318.5,t,.8,1.4);s.bell(1046.5,t+.45,.8,1.6);},
  knock:t=>{const s=sound({bus:'amb',gain:.14,wet:.6,pan:pan()});for(let i=0;i<3;i++)s.tone({f:210,to:150,t:t+i*.16,decay:.1,gain:1});s.tone({f:880,t,decay:.5,gain:.1,type:'triangle'});},
  train:t=>{const s=sound({bus:'amb',gain:.045,wet:.85,pan:pan()});for(const f of [311,370])s.tone({f,t,attack:.3,decay:1.5,gain:.6,type:'sawtooth',lowpass:700});},
 };
 const step=(surface:Surface,pace:Pace)=>{
  const t=now(),s=sound({gain:STEP_LEVEL[pace]*(.85+random()*.3)*.5,wet:.12,pan:(side=-side)*.12}),pitch=.92+random()*.16;
  if(surface==='wood'){s.hiss({t,decay:.07,gain:.5,type:'lowpass',f:1100,q:.7});s.tone({f:118*pitch,to:52,t,decay:.09,gain:.55});if(random()<.12)s.hiss({t:t+.04,attack:.03,decay:.18,gain:.12,type:'bandpass',f:420,to:300,q:14});}
  else if(surface==='stone'){s.hiss({t,decay:.035,gain:.55,type:'highpass',f:1900*pitch,q:.6});s.tone({f:150*pitch,to:62,t,decay:.05,gain:.35});}
  else if(surface==='grass')s.hiss({t,attack:.02,decay:.14,gain:.45,type:'bandpass',f:2600*pitch,q:.5});
  else {s.hiss({t,attack:.008,decay:.09,gain:.45,type:'lowpass',f:480*pitch,q:.5});s.tone({f:80,to:45,t,decay:.07,gain:.25});}
 };
 const glint=(t:number,pitch:number,gain:number)=>{const s=sound({gain,wet:.6});for(const f of [2637,3136,3520])s.tone({f:f*pitch,t:t+random()*.05,attack:.005,decay:.9,gain:.5});s.hiss({t,attack:.05,decay:.5,gain:.2,type:'highpass',f:6000*pitch});};
 const opening=(s:ReturnType<typeof sound>,t:number)=>{s.hiss({t,attack:1.2,decay:2.5,gain:.8,type:'lowpass',f:110});[587.3,784,880,1174.7].forEach((f,i)=>s.bell(f,t+.6+i*.12,.4,2.5));};
 const item=(c:Extract<WorldCue,{kind:'item'}>,t:number)=>{
  const near=ringFalloff(c.distance),aim=Number.isFinite(c.angle)?Math.sin(c.angle!):0;
  if(c.action==='throw')sound({gain:.2,wet:.08}).hiss({t,attack:.03,decay:.15,gain:1,type:'bandpass',f:700,to:2400,q:.9});
  else if(c.action==='ring'){const s=sound({gain:.22*near,wet:.5,pan:aim});s.tone({f:3600,t,decay:.03,gain:.5,type:'triangle'});s.tone({f:3300,t:t+.13,decay:.03,gain:.35,type:'triangle'});s.bell(2093,t,1,1.6);s.bell(2637,t+.13,.6,1.3);}
  else if(c.action==='pickup')glint(t,.5,.22);
  else if(c.action==='place'){const s=sound({gain:.26,wet:.12});s.hiss({t,attack:.01,decay:.12,gain:.8,type:'bandpass',f:3200,q:.7});s.hiss({t:t+.14,attack:.02,decay:.16,gain:.5,type:'bandpass',f:3200,to:2600,q:.7});}
  // Beyond sight range a flare would betray the enemy that stepped on the ward.
  else if((c.distance??0)<=WARD_BURN_HEARD.seen){const s=sound({gain:.3*near,wet:.35,pan:aim});s.hiss({t,attack:.03,decay:.47,gain:1,type:'bandpass',f:1800,to:600,q:.8});s.tone({f:90,to:42,t,decay:.3,gain:.9});}
 };
 const cue=(c:WorldCue)=>{
  if(!running())return;const t=now();
  switch(c.kind){
   case 'step':step(c.surface,c.pace);break;
   case 'pickup':{const s=sound({gain:.28,wet:.55});if(c.color==='blue'){s.bell(1318.5,t,1,1.6);s.bell(1975.5,t+.09,.45,1.2);}else if(c.color==='red'){s.bell(880,t,1,2.2);s.bell(932.3,t+.02,.7,2.2);s.tone({f:220,t,attack:.3,decay:1.5,gain:.25,type:'triangle'});}else{[659.3,830.6,987.8,1318.5,1661].forEach((f,i)=>s.bell(f,t+i*.07,.8,2.4));s.hiss({t,attack:.4,decay:1.2,gain:.15,type:'highpass',f:5000});}break;}
   case 'mirror-pickup':glint(t,1,.2);break;
   case 'note':{const s=sound({gain:.32,wet:.15});s.hiss({t,attack:.01,decay:.12,gain:.8,type:'bandpass',f:3200,q:.7});s.hiss({t:t+.16,attack:.02,decay:.2,gain:.6,type:'bandpass',f:2400,q:.7});s.bell(1568,t+.2,.25,1.2);break;}
   case 'door':{const s=sound({gain:.32,wet:.25});s.hiss({t,attack:.12,decay:.38,gain:1,type:'lowpass',f:c.open?600:1100,to:c.open?1400:500,q:.8});if(!c.open)s.tone({f:95,to:60,t:t+.46,decay:.12,gain:.6});break;}
   case 'offer':{if(c.surplus){sound({gain:.26,wet:.6}).bell(1568,t,1,2.4);break;}const s=sound({gain:.38,wet:.75});s.bell(98,t,1,5);s.tone({f:49,t,attack:.02,decay:3.5,gain:.5});s.bell(1318.5,t+.25,.3,2);if(c.unlocked&&!c.rite)opening(s,t+.6);break;}
   case 'mechanism':{const s=sound({gain:.28,wet:.35});s.hiss({t,decay:.12,gain:.7,type:'lowpass',f:420});s.tone({f:88,to:60,t,decay:.14,gain:.7});s.tone({f:1250,t:t+.02,decay:.06,gain:.2,type:'triangle'});break;}
   case 'burst':{const s=sound({gain:.3,wet:.35});s.hiss({t,attack:.03,decay:.4,gain:1,type:'bandpass',f:500,to:3200,q:.9});s.tone({f:2200,to:700,t,decay:.3,gain:.3});if(c.hits>0)s.bell(2489,t+.08,.4,.8);break;}
   case 'time-stop':{const s=sound({gain:.3,wet:.6});s.tone({f:880,to:110,t,attack:.02,decay:1.2,gain:.5});s.hiss({t,attack:.5,decay:.08,gain:.7,type:'highpass',f:3000});s.tone({f:55,t:t+.5,decay:1.8,gain:.6});break;}
   case 'time-resume':{const s=sound({gain:.24,wet:.4});s.tone({f:110,to:660,t,attack:.02,decay:.6,gain:.45});s.hiss({t,attack:.3,decay:.3,gain:.5,type:'bandpass',f:800,to:2400});break;}
   case 'mirror':{const s=sound({gain:.18,wet:.8});for(let i=0;i<6;i++)s.tone({f:1760*(1+i*.19)*(1+random()*.01),t:t+i*.04,attack:.15,decay:1.4,gain:.35});break;}
   case 'chase':{const s=sound({gain:.4,wet:.35});for(const f of [110,116.5,155.6,164.8])s.tone({f,t,attack:.012,decay:1.3,gain:.5,type:'sawtooth',lowpass:1400});s.tone({f:62,to:34,t,decay:.9,gain:1});s.hiss({t,decay:.25,gain:.6,type:'lowpass',f:2500});break;}
   case 'escape':{const s=sound({gain:.15,wet:.6});s.bell(784,t,.6,1.6);s.bell(659.3,t+.22,.6,2);break;}
   case 'finale':{const s=sound({gain:.42,wet:.6});for(const f of [36.7,55,73.4])s.tone({f,t,attack:1.6,decay:2.6,gain:.7,type:'sawtooth',lowpass:600});s.hiss({t,attack:1.8,decay:.4,gain:.5,type:'lowpass',f:300,to:1800});s.tone({f:48,to:30,t:t+1.8,decay:1.6,gain:1});break;}
   case 'caught':{const s=sound({gain:.48,wet:.5});s.hiss({t,decay:.6,gain:1,type:'lowpass',f:3200,to:200});s.tone({f:70,to:28,t,decay:1.2,gain:1});s.tone({f:2600,t:t+.05,attack:.05,decay:2.4,gain:.08});stunnedUntil=t+2.6;nextBeat=0;break;}
   case 'clear':{const s=sound({gain:.3,wet:.7});[587.3,659.3,784,880,1174.7,1568].forEach((f,i)=>s.bell(f,t+i*.16,.7,3));s.tone({f:146.8,t,attack:1,decay:4,gain:.35,type:'triangle'});break;}
   // The shrine's own bells mark the night; none of them comes from an enemy.
   case 'bell':{
    if(c.beat==='warning'){sound({gain:.32,wet:1}).bell(65,t,.5,6);duck(1.5);}
    else if(c.beat==='toll'){const s=sound({gain:.42,wet:.8}),n=Math.max(1,Math.min(5,Math.floor(c.count)||1));for(let i=0;i<n;i++){s.bell(65,t+i*2.2,1,6);s.tone({f:32.5,t:t+i*2.2,decay:7,gain:.6});}}
    else if(c.survived){const s=sound({gain:.16,wet:.7});[1760,2093,2637].forEach((f,i)=>s.tone({f,t:t+i*.14,attack:.01,decay:1.4,gain:.6}));}
    break;}
   case 'purify':{const s=sound({gain:.3,wet:1});s.bell(392,t,1,4.5);s.bell(784,t+.08,.6,4);break;}
   case 'notice':sound({gain:.08}).hiss({t,attack:.06,decay:.34,gain:1,type:'bandpass',f:900,q:1.2});break;
   case 'item':item(c,t);break;
   case 'recover':{const s=sound({gain:.16,wet:.6});[1318.5,1568,1760].forEach((f,i)=>s.bell(f,t+i*.16,.8,1.2));break;}
   case 'rite':{
    if(c.beat==='start'){const s=sound({gain:.36,wet:.8});s.bell(98,t,1,5);s.tone({f:880,to:1318.5,t:t+.4,attack:.6,decay:1.8,gain:.35});s.hiss({t:t+.4,attack:.5,decay:1.6,gain:.25,type:'bandpass',f:1100,to:1650,q:6});}
    else if(c.beat==='tick')sound({gain:.25,wet:.15}).tone({f:55,t,attack:.04,decay:.6,gain:1});
    else opening(sound({gain:.38,wet:.75}),t);
    break;}
  }
 };
 return {
  unlock,
  get active(){return running();},
  setStage(next:StageId){if(next===stage&&bed)return;stage=next;if(!ctx||!graph)return;dropBed(bed);bed=makeBed(ctx,graph,PROFILES[stage]);graph.wetReturn.gain.setTargetAtTime(PROFILES[stage].wet*.6,ctx.currentTime,.4);nextEvent=0;lastWind=lastHum=-1;},
  setMix(next:Mix){mix={master:Math.max(0,Math.min(1,next.master)),ambience:Math.max(0,Math.min(1,next.ambience)),effects:Math.max(0,Math.min(1,next.effects))};lastFilter='';if(!graph||!ctx)return;const t=ctx.currentTime;graph.master.gain.setTargetAtTime(mix.master,t,.05);graph.effects.gain.setTargetAtTime(mix.effects,t,.05);},
  cue,
  duck,
  ui(kind:'move'|'open'|'close'|'confirm'){if(!running())return;const t=now(),s=sound({gain:kind==='move'?.035:.07,wet:.1});if(kind==='move')s.tone({f:1500,t,decay:.03,gain:1});else s.hiss({t,decay:kind==='confirm'?.09:.06,gain:1,type:'bandpass',f:kind==='close'?900:kind==='open'?1500:2200,q:2});},
  /** Called every frame; schedules only what is due within the next moment. */
  frame(f:SoundFrame){
   if(!running()||!bed)return;const c=ctx!,g=graph!,t=c.currentTime,p=PROFILES[stage];
   const filter=moodFilter(f.mood,f.frozen,t<stunnedUntil),key=filter.cutoff+':'+filter.level+':'+mix.ambience;
   if(key!==lastFilter){lastFilter=key;g.muffle.frequency.setTargetAtTime(filter.cutoff,t,.25);g.ambience.gain.setTargetAtTime(mix.ambience*filter.level,t,.3);}
   const outdoors=stage==='mountain'||f.area==='field'&&f.elevation<2,wind=outdoors?1.8:1,hum=f.area==='factory'&&f.elevation<2?.012:p.hum;
   if(wind!==lastWind){lastWind=wind;bed.wind.gain.setTargetAtTime(wind,t,1.2);}
   if(hum!==lastHum){lastHum=hum;bed.hum.gain.setTargetAtTime(hum,t,1.2);}
   const live=f.mood==='play'&&t>=stunnedUntil,beat=live?heartbeat(f.pressure,f.chase,f.frozen):null;
   if(beat){if(nextBeat<t)nextBeat=t+.05;if(nextBeat<t+.15){const s=sound({gain:beat.level*.55});s.tone({f:62,to:44,t:nextBeat,attack:.008,decay:.16,gain:1});s.tone({f:124,to:88,t:nextBeat,attack:.008,decay:.1,gain:.3});s.tone({f:55,to:40,t:nextBeat+.2,attack:.01,decay:.2,gain:.6});nextBeat+=60/beat.bpm;}}else nextBeat=0;
   if(live&&f.exhausted){if(nextBreath<t)nextBreath=t+.1;if(nextBreath<t+.15){const s=sound({gain:.09,wet:.1});s.hiss({t:nextBreath,attack:.28,decay:.3,gain:1,type:'bandpass',f:1100,q:1.2});s.hiss({t:nextBreath+.7,attack:.08,decay:.55,gain:.8,type:'bandpass',f:700,q:1.2});nextBreath+=1.55;}}else nextBreath=0;
   if((f.mood==='play'||f.mood==='title')&&!f.frozen&&t>=stunnedUntil){
    const wet=['cave','cistern','bath'].includes(f.area)&&f.elevation<2;
    if(!nextEvent)nextEvent=t+3+random()*4;
    if(t>=nextEvent){const pool=wet?[...p.events,'drip','drip'] as Ambient[]:p.events;ambient[pool[Math.floor(random()*pool.length)]](t+.02);nextEvent=t+(p.gap[0]+random()*(p.gap[1]-p.gap[0]))*(wet?.6:1);}
   }
  },
  dispose(){disposed=true;events?.removeEventListener('pointerdown',unlock,true);events?.removeEventListener('keydown',unlock,true);const c=ctx;ctx=null;graph=null;bed=null;if(c)void c.close().catch(()=>{});},
 };
}
export type Soundscape=ReturnType<typeof createSoundscape>;
