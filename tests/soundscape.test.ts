import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundscape,heartbeat,moodFilter,PROFILES,type SoundFrame} from '../app/soundscape.ts';
import {STAGES} from '../app/stage-profile.ts';
import type {WorldCue} from '../app/world-cues.ts';
type Param={value:number;setValueAtTime:()=>Param;exponentialRampToValueAtTime:(v:number)=>Param;setTargetAtTime:()=>Param;cancelScheduledValues:()=>Param};
const param=():Param=>{const p:Param={value:0,setValueAtTime:()=>p,exponentialRampToValueAtTime:v=>{assert.ok(v>0,'exponential ramps need a positive target');return p;},setTargetAtTime:()=>p,cancelScheduledValues:()=>p};return p;};
class FakeNode{
 gain=param();frequency=param();detune=param();Q=param();pan=param();threshold=param();ratio=param();type='';buffer:unknown=null;loop=false;
 onended:null|(()=>void)=null;started=0;stopped=0;connected=0;disconnected=0;
 connect(n:unknown){this.connected++;return n;}disconnect(){this.disconnected++;}start(){this.started++;}stop(){this.stopped++;}
}
const fake=()=>{
 const nodes:FakeNode[]=[],node=()=>{const n=new FakeNode();nodes.push(n);return n;};
 const context={state:'running',currentTime:10,sampleRate:4000,destination:new FakeNode(),closed:false,resume:async()=>{},close:async()=>{context.closed=true;},
  createGain:node,createOscillator:node,createBiquadFilter:node,createBufferSource:node,createStereoPanner:node,createConvolver:node,createDynamicsCompressor:node,
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
  {kind:'offer',unlocked:false},{kind:'offer',unlocked:true},{kind:'mechanism'},{kind:'burst',hits:2},{kind:'time-stop'},{kind:'time-resume'},{kind:'mirror'},{kind:'chase'},{kind:'escape'},{kind:'finale',foe:'wrath'},{kind:'clear'}];
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
