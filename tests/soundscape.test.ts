import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundscape,heartbeat,moodFilter,PROFILES,ringFalloff,type SoundFrame} from '../app/soundscape.ts';
import {STAGES} from '../app/stage-profile.ts';
import {wardBurnAudible,WARD_BURN_HEARD,type WorldCue} from '../app/world-cues.ts';
type Automation={type:'set'|'ramp'|'target'|'cancel';value:number;time:number};
type Param={value:number;events:Automation[];setValueAtTime:(v:number,t:number)=>Param;exponentialRampToValueAtTime:(v:number,t:number)=>Param;setTargetAtTime:(v:number,t:number)=>Param;cancelScheduledValues:(t:number)=>Param};
const param=():Param=>{
 const p:Param={value:0,events:[],setValueAtTime:(value,time)=>{p.events.push({type:'set',value,time});return p;},
  exponentialRampToValueAtTime:(value,time)=>{assert.ok(value>0,'exponential ramps need a positive target');p.events.push({type:'ramp',value,time});return p;},
  setTargetAtTime:(value,time)=>{p.events.push({type:'target',value,time});return p;},cancelScheduledValues:time=>{p.events.push({type:'cancel',value:0,time});return p;}};
 return p;
};
class FakeNode{
 gain=param();frequency=param();detune=param();Q=param();pan=param();threshold=param();ratio=param();type='';buffer:unknown=null;loop=false;
 onended:null|(()=>void)=null;started=0;stopped=0;connected=0;disconnected=0;kind:string;targets:unknown[]=[];startAt=NaN;stopAt=NaN;
 constructor(kind='node'){this.kind=kind;}
 connect(n:unknown){this.connected++;this.targets.push(n);return n;}disconnect(){this.disconnected++;}start(t=0){this.started++;this.startAt=t;}stop(t=0){this.stopped++;this.stopAt=t;}
}
const fake=(sampleRate=4000)=>{
 const nodes:FakeNode[]=[],node=(kind:string)=>()=>{const n=new FakeNode(kind);nodes.push(n);return n;};
 const context={state:'running',currentTime:10,sampleRate,destination:new FakeNode(),closed:false,resume:async()=>{},close:async()=>{context.closed=true;},
  createGain:node('gain'),createOscillator:node('osc'),createBiquadFilter:node('filter'),createBufferSource:node('noise'),createStereoPanner:node('panner'),createConvolver:node('convolver'),createDynamicsCompressor:node('compressor'),
  createBuffer:(_channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)})};
 return {context,nodes};
};
const frame=(patch:Partial<SoundFrame>):SoundFrame=>({mood:'play',pressure:0,chase:false,frozen:false,exhausted:false,area:'hall',elevation:0,...patch});
test('the heartbeat follows threat, is always present in a chase and stops in a time stop',()=>{
 assert.equal(heartbeat(0,false,false),null);assert.equal(heartbeat(.03,false,false),null);
 const calm=heartbeat(.2,false,false)!,close=heartbeat(.9,false,false)!;assert.ok(close.bpm>calm.bpm&&close.level>calm.level);
 assert.ok(heartbeat(0,true,false)!.bpm>90);assert.equal(heartbeat(1,true,true),null);assert.ok(heartbeat(5,false,false)!.bpm<=150);
 assert.ok(moodFilter('paused',false,false).cutoff<moodFilter('play',true,false).cutoff*2);assert.equal(moodFilter('play',false,false).level,1);assert.ok(moodFilter('play',false,true).cutoff<400);
 for(const stage of Object.keys(STAGES))assert.ok(PROFILES[stage as keyof typeof PROFILES].events.length>0,stage);
});
test('audio waits for a gesture, then synthesizes every cue and releases finished voices',()=>{
 const {context,nodes}=fake();const listeners=new Map<string,()=>void>();
 const sound=createSoundscape({context:()=>context as unknown as AudioContext,events:{addEventListener:(k:string,f:()=>void)=>listeners.set(k,f),removeEventListener:(k:string)=>listeners.delete(k)} as unknown as Document,random:()=>.5});
 sound.cue({kind:'door',open:true});assert.equal(nodes.length,0,'nothing is created before a user gesture');
 listeners.get('pointerdown')!();assert.equal(sound.active,true);const bed=nodes.length;assert.ok(bed>10);
 const cues:WorldCue[]=[{kind:'step',surface:'wood',pace:'run'},{kind:'step',surface:'stone',pace:'walk'},{kind:'step',surface:'grass',pace:'crouch'},{kind:'step',surface:'carpet',pace:'walk'},
  {kind:'pickup',color:'blue'},{kind:'pickup',color:'red'},{kind:'pickup',color:'gold'},{kind:'mirror-pickup'},{kind:'note',id:'shrine-1'},{kind:'door',open:true},{kind:'door',open:false},
  {kind:'offer',unlocked:false},{kind:'offer',unlocked:true},{kind:'mechanism'},{kind:'burst',hits:2},{kind:'time-stop'},{kind:'time-resume'},{kind:'mirror'},{kind:'chase'},{kind:'escape'},{kind:'finale',foe:'wrath'},{kind:'clear'},
  {kind:'offer',unlocked:true,surplus:true},{kind:'bell',beat:'warning',count:1},{kind:'bell',beat:'toll',count:2},{kind:'bell',beat:'end',count:1,survived:true},{kind:'purify'},{kind:'notice'},
  {kind:'item',action:'throw',item:'bell'},{kind:'item',action:'ring',distance:6,angle:.7,item:'bell'},{kind:'item',action:'pickup',item:'ward'},{kind:'item',action:'place',item:'ward'},{kind:'item',action:'burn',distance:4,angle:-1,item:'ward'},
  {kind:'recover',count:3,blue:2,red:1,gold:0},{kind:'rite',beat:'start'},{kind:'rite',beat:'tick'},{kind:'rite',beat:'complete'}];
 for(const c of cues){const before=nodes.length;sound.cue(c);assert.ok(nodes.length>before,c.kind);}
 for(const kind of ['move','open','close','confirm'] as const)sound.ui(kind);
 const sources=nodes.slice(bed).filter(n=>n.started);assert.ok(sources.every(n=>n.stopped===1),'every one-shot source is scheduled to stop');
 for(const n of sources)n.onended?.();assert.ok(nodes.slice(bed).every(n=>n.disconnected>0),'finished voices disconnect every node');
 const quiet=nodes.length;sound.frame(frame({}));assert.equal(nodes.length,quiet,'no heartbeat while calm');
 sound.frame(frame({pressure:.8}));assert.ok(nodes.length>quiet,'a threatened visitor hears a heartbeat');
 const paused=nodes.length;sound.frame(frame({mood:'paused',pressure:.8}));assert.equal(nodes.length,paused,'menus silence the heartbeat');
 sound.cue({kind:'caught'});const caught=nodes.length;sound.frame(frame({pressure:.9}));assert.equal(nodes.length,caught,'capture briefly silences the body');
 sound.setStage('ultrareal');assert.ok(nodes.length>caught,'a new stage bed is built');sound.setMix({master:2,ambience:-1,effects:.5});
 sound.dispose();assert.equal(context.closed,true);assert.equal(listeners.size,0);const after=nodes.length;sound.cue({kind:'clear'});sound.frame(frame({pressure:1}));assert.equal(nodes.length,after);
});
test('a browser without Web Audio stays silent without errors',()=>{
 const sound=createSoundscape({context:()=>null,events:{addEventListener(){},removeEventListener(){}} as unknown as Document});
 sound.unlock();sound.cue({kind:'chase'});sound.frame(frame({pressure:1}));assert.equal(sound.active,false);sound.dispose();
});

const quiet={addEventListener(){},removeEventListener(){}} as unknown as Document;
/** The graph's buses, located by their wiring: reverb send, effects bus and the ambience bed's level. */
const buses=(nodes:FakeNode[])=>{
 const into=(target:FakeNode,kind?:string)=>nodes.find(n=>n.targets.includes(target)&&(!kind||n.kind===kind))!;
 const reverb=nodes.find(n=>n.kind==='convolver')!,master=into(nodes.find(n=>n.kind==='compressor')!),ambience=into(into(master,'filter'));
 return {send:into(reverb),effects:nodes.find(n=>n.kind==='gain'&&n.targets.includes(master)&&!reverb.targets.includes(n))!,bed:into(ambience)};
};
/** A running soundscape on a full-rate fake context, so every bell partial is synthesized. */
const live=()=>{
 const {context,nodes}=fake(48000),sound=createSoundscape({context:()=>context as unknown as AudioContext,events:quiet,random:()=>.5});
 sound.unlock();assert.equal(sound.active,true);
 const hear=(c:WorldCue)=>{const from=nodes.length;sound.cue(c);return nodes.slice(from);};
 return {context,nodes,sound,hear,...buses(nodes)};
};
const first=(p:Param,type:Automation['type'])=>p.events.find(e=>e.type===type);
/** Oscillators of a voice: start pitch, glide target, onset and envelope length (attack+decay). */
const tones=(ns:FakeNode[])=>ns.filter(n=>n.kind==='osc').map(n=>({f:first(n.frequency,'set')!.value,to:first(n.frequency,'ramp')?.value,t:n.startAt,length:n.stopAt-n.startAt-.05}));
const filters=(ns:FakeNode[])=>ns.filter(n=>n.kind==='filter').map(n=>({type:n.type,f:first(n.frequency,'set')!.value,to:first(n.frequency,'ramp')?.value}));
const noises=(ns:FakeNode[])=>ns.filter(n=>n.kind==='noise').map(n=>({t:n.startAt,length:n.stopAt-n.startAt-.05}));
/** A rin bell is drawn as inharmonic partials at 1, 2.76, 5.4 and 8.93× its pitch, all struck together. */
const bells=(ns:FakeNode[])=>{const all=tones(ns);return all.filter(a=>all.some(b=>Math.abs(b.f-a.f*2.76)<1e-6&&b.t===a.t)).map(a=>({f:a.f,t:a.t,length:a.length}));};
const close=(a:number,b:number,eps=1e-6)=>Math.abs(a-b)<eps;
const wetLevel=(ns:FakeNode[],send:FakeNode)=>ns.find(n=>n.targets.includes(send))?.gain.value??0;
test('night bells are the shrine\'s own: a ducked distant warning, counted tolls and a shimmer only for a survived hunt',()=>{
 const {context,send,bed,effects,hear}=live(),t=context.currentTime+.01;
 const before=bed.gain.events.length,warning=hear({kind:'bell',beat:'warning',count:1});
 assert.deepEqual(bells(warning).map(b=>b.f),[65],'one low toll bell');assert.ok(close(bells(warning)[0].length,.004+6),'decays over 6 s');
 assert.equal(wetLevel(warning,send),1,'fully wet: the bell is far away');assert.ok(warning[0].targets.includes(effects),'on the effects bus, so the duck does not swallow it');
 const ducked=bed.gain.events.slice(before);
 assert.deepEqual(ducked.map(e=>[e.type,e.value]),[['cancel',0],['target',.5],['target',1]],'the bed drops by half and comes back');
 assert.ok(close(ducked[1].time,context.currentTime)&&close(ducked[2].time-ducked[1].time,1.5),'for 1.5 s');
 for(const count of [1,2,3]){
  const toll=hear({kind:'bell',beat:'toll',count}),strikes=bells(toll),subs=tones(toll).filter(o=>o.f===32.5);
  assert.equal(strikes.length,count,count+' tolls');assert.ok(strikes.every(b=>b.f===65),'every toll is the low bell');
  assert.deepEqual(strikes.map(b=>Math.round((b.t-t)*100)/100),Array.from({length:count},(_,i)=>i*2.2),'2.2 s apart');
  assert.equal(subs.length,count);assert.ok(subs.every(o=>close(o.length,.005+7)),'each with a 32.5 Hz hum decaying over 7 s');
 }
 assert.equal(bells(hear({kind:'bell',beat:'toll',count:0})).length,1,'a toll always sounds once');
 assert.ok(bells(hear({kind:'bell',beat:'toll',count:99})).length<=5,'a runaway count stays bounded');
 assert.equal(bells(hear({kind:'bell',beat:'toll',count:Number.NaN})).length,1);
 const shimmer=tones(hear({kind:'bell',beat:'end',count:1,survived:true}));
 assert.deepEqual(shimmer.map(o=>o.f),[1760,2093,2637],'a rising rin shimmer from 1760 to 2637 Hz');
 assert.ok(shimmer.every((o,i)=>i===0||o.t>shimmer[i-1].t),'the notes rise in order');assert.ok(shimmer.every(o=>close(o.length,.01+1.4)),'each decays over 1.4 s');
 const marks=bed.gain.events.length;
 assert.equal(hear({kind:'bell',beat:'end',count:1,survived:false}).length,0,'a broken hunt ends in silence');assert.equal(hear({kind:'bell',beat:'end',count:1}).length,0);
 hear({kind:'bell',beat:'toll',count:2});hear({kind:'bell',beat:'end',count:2,survived:true});hear({kind:'purify'});assert.equal(bed.gain.events.length,marks,'only the warning ducks the bed');
 const purify=hear({kind:'purify'});
 assert.deepEqual(bells(purify).map(b=>b.f),[392,784],'purification rings 392 and 784 Hz');assert.ok(wetLevel(purify,send)>=.9,'with a long wet tail');
 assert.ok(bells(purify).every(b=>b.length>=4),'and a long decay');
});
test('the first notice is the visitor\'s own held breath, never an enemy sound',()=>{
 const {send,hear}=live(),breath=hear({kind:'notice'});
 assert.equal(breath.length,4,'one voice with a single hiss: output, noise, filter, envelope');
 assert.equal(breath[0].gain.value,.08,'gain .08');assert.equal(wetLevel(breath,send),0,'no reverb');
 assert.equal(tones(breath).length,0,'nothing pitched, nothing voiced');
 assert.deepEqual(filters(breath).map(f=>[f.type,f.f]),[['bandpass',900]]);
 const [hiss]=noises(breath);assert.ok(close(hiss.length,.4),'a 0.4 s hiss');
});
test('the visitor\'s tools are heard as objects: a whip, a ringing bell fading with distance, paper and a flare',()=>{
 assert.equal(ringFalloff(0),1);assert.equal(ringFalloff(8),.5);assert.equal(ringFalloff(24),.25);assert.equal(ringFalloff(),1);
 assert.equal(ringFalloff(-3),1);assert.equal(ringFalloff(Number.NaN),1);assert.ok(ringFalloff(40)<ringFalloff(20)&&ringFalloff(40)>0);
 const {send,hear}=live();
 const toss=hear({kind:'item',action:'throw',item:'bell'});
 assert.equal(tones(toss).length,0,'a throw is cloth, not a bell');assert.equal(filters(toss)[0].type,'bandpass');assert.ok(noises(toss).every(n=>n.length<=.25),'short');
 const ring=(distance?:number,angle?:number)=>hear({kind:'item',action:'ring',distance,angle,item:'bell'});
 const here=ring(0),far=ring(16);
 assert.deepEqual(bells(here).map(b=>b.f),[2093,2637],'a clear rin pair');
 assert.equal(tones(here).filter(o=>o.length<=.05).length,2,'two clinks as it lands');
 assert.ok(close(far[0].gain.value*3,here[0].gain.value),'1/(1+d/8): three times quieter at 16 m');
 assert.ok(close(ring(undefined)[0].gain.value,here[0].gain.value),'an unknown distance is heard as near');
 const pan=(ns:FakeNode[])=>ns.find(n=>n.kind==='panner')?.pan.value;
 assert.ok(close(pan(ring(4,Math.PI/2))!,1),'a bell to the right is panned right');assert.ok(close(pan(ring(4,-Math.PI/6))!,-.5),'pan = sin(angle)');
 assert.equal(pan(ring(4)),undefined,'no angle, no panning');assert.equal(pan(ring(4,0)),undefined,'straight ahead is centred');
 const mirror=Math.min(...tones(hear({kind:'mirror-pickup'})).map(o=>o.f)),pickup=tones(hear({kind:'item',action:'pickup',item:'bell'}));
 assert.deepEqual(pickup.map(o=>o.f),[2637,3136,3520].map(f=>f*.5),'the mirror chime an octave down');assert.ok(Math.max(...pickup.map(o=>o.f))<mirror);
 const place=hear({kind:'item',action:'place',item:'ward'});
 assert.equal(tones(place).length,0);assert.ok(filters(place).length>0&&filters(place).every(f=>f.type==='bandpass'&&f.f===3200),'a paper rustle at 3200 Hz');
 const burn=(distance?:number,angle?:number)=>hear({kind:'item',action:'burn',distance,angle,item:'ward'});
 const flare=burn(0);
 assert.deepEqual(filters(flare).map(f=>[f.type,f.f,f.to]),[['bandpass',1800,600]],'the flare sweeps down from 1800 to 600 Hz');
 assert.ok(close(noises(flare)[0].length,.5),'over half a second');assert.ok(tones(flare).some(o=>o.f<120&&o.to!<o.f),'with a low thump');
 assert.ok(close(burn(8)[0].gain.value*2,flare[0].gain.value),'a distant flare is quieter');assert.ok(close(pan(burn(5,-Math.PI/2))!,-1));
 assert.ok(burn(WARD_BURN_HEARD.seen).length>0);assert.equal(burn(WARD_BURN_HEARD.seen+.5).length,0,'never beyond sight range: it would reveal the enemy');
 assert.ok(wetLevel(flare,send)>0);
 assert.equal(wardBurnAudible(0,false),true);assert.equal(wardBurnAudible(12,false),true);assert.equal(wardBurnAudible(12.1,false),false,'out of view only within 12 m');
 assert.equal(wardBurnAudible(29,true),true);assert.equal(wardBurnAudible(30,true),true);assert.equal(wardBurnAudible(30.1,true),false,'in view only within 30 m');
 assert.equal(wardBurnAudible(Number.NaN,true),false);
});
test('recovered beads ring their own three soft blue bells',()=>{
 const {send,hear}=live();
 for(const count of [1,3,9]){
  const chime=hear({kind:'recover',count,blue:count,red:0,gold:0}),b=bells(chime);
  assert.deepEqual(b.map(x=>x.f),[1318.5,1568,1760],'blue rin bells');assert.ok(b.every(x=>close(x.length,.004+1.2)),'decay 1.2 s');
  assert.ok(chime[0].gain.value<=.2,'soft');assert.ok(wetLevel(chime,send)>0);
 }
});
test('the rite opens with a gong and fue, pulses each second and closes with the unlocking arpeggio',()=>{
 const {hear}=live();
 const start=hear({kind:'rite',beat:'start'});
 assert.deepEqual(bells(start).map(b=>b.f),[98],'a low gong');assert.ok(tones(start).some(o=>o.to!==undefined&&o.to>o.f&&o.f>400),'and a rising fue-like tone');
 const tick=hear({kind:'rite',beat:'tick'}),[pulse]=tones(tick);
 assert.equal(tones(tick).length,1);assert.equal(pulse.f,55);assert.equal(pulse.to,undefined);
 const amp=tick.find(n=>n.kind==='gain'&&n!==tick[0]&&first(n.gain,'ramp'))!;
 assert.ok(close(tick[0].gain.value*first(amp.gain,'ramp')!.value,.25),'gain .25');assert.ok(close(pulse.length-.04,.6),'decay .6 s');
 const locked=tones(hear({kind:'offer',unlocked:false})).map(o=>o.f),unlocked=tones(hear({kind:'offer',unlocked:true})).map(o=>o.f);
 const arpeggio=unlocked.slice(locked.length),complete=hear({kind:'rite',beat:'complete'});
 assert.deepEqual(locked,unlocked.slice(0,locked.length));
 assert.deepEqual(tones(complete).map(o=>o.f),arpeggio,'the same arpeggio as an unlocking offering');
 assert.deepEqual(bells(complete).map(b=>b.f),[587.3,784,880,1174.7]);
});
test('a surplus offering is a single high rin, not the full offering',()=>{
 const {hear}=live(),surplus=hear({kind:'offer',unlocked:true,surplus:true});
 assert.deepEqual(bells(surplus).map(b=>b.f),[1568]);
 assert.ok(tones(surplus).every(o=>[1,2.76,5.4,8.93].some(r=>close(o.f,1568*r))),'nothing but the one bell');
 assert.ok(tones(surplus).length<tones(hear({kind:'offer',unlocked:true})).length);
});
test('duck lowers only the ambience bed, and only while audio runs',()=>{
 const {context,nodes}=fake(48000),sound=createSoundscape({context:()=>context as unknown as AudioContext,events:quiet,random:()=>.5});
 sound.duck(2);assert.equal(nodes.length,0,'nothing before a gesture');
 sound.unlock();const {bed}=buses(nodes);
 const fresh=bed.gain.events.length;sound.duck(2);const ducked=bed.gain.events.slice(fresh);
 assert.deepEqual(ducked.map(e=>[e.type,e.value,e.time-context.currentTime]),[['cancel',0,0],['target',.5,0],['target',1,2]]);
 const count=bed.gain.events.length;for(const s of [0,-1,Number.NaN])sound.duck(s);assert.equal(bed.gain.events.length,count,'no duck without a duration');
 sound.duck(Number.POSITIVE_INFINITY);assert.ok(Number.isFinite(bed.gain.events.at(-1)!.time),'an endless duck still comes back');
 sound.dispose();sound.duck(1);
 const silent=createSoundscape({context:()=>null,events:quiet});silent.unlock();silent.duck(1);silent.cue({kind:'bell',beat:'warning',count:1});assert.equal(silent.active,false);
});
test('new cues wait for a gesture like every other cue',()=>{
 const {context,nodes}=fake(48000),sound=createSoundscape({context:()=>context as unknown as AudioContext,events:quiet,random:()=>.5});
 for(const c of [{kind:'notice'},{kind:'purify'},{kind:'recover',count:2,blue:1,red:1,gold:0},{kind:'rite',beat:'tick'},{kind:'item',action:'ring',distance:3}] as WorldCue[])sound.cue(c);
 assert.equal(nodes.length,0);
});
