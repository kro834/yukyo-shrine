'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Maximize,Settings,Footprints,Move,Scan,Focus,Flashlight,FlashlightOff,X,RotateCcw,Gamepad2,DoorOpen,Sparkles,Clock3,ChevronsDown,ScrollText,BookOpen,Bell,StickyNote} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {createWorld} from './shrine-world';

import {GamepadSession,PadCalibration,mappingKey,validMapping,type Pad} from './gamepad-input';
import {ButtonEdges,TouchInput,allowMouseLook,allowExploration,needsControllerLock} from './input-actions';
import {DEFAULTS,QUALITY_LABELS,sanitizePreferences,startupPreferences,type Preferences} from './preferences';
import {adjustRange,viewDelta,hidePlayCursor,type RangeKey} from './view-controls';
import {PointerLockPolicy} from './pointer-lock-policy';
import {BurstInput} from './burst-input';
import {RunProgress,formatRunTime} from './run-progress';
import {simulationSteps} from './performance-budget';

import {PLAY_MODES,modeAids,type PlayMode} from './play-mode';
import {TouchActionGate} from './touch-action';
import {ENEMY_NAMES,type FinaleKind} from './enemy-traits';
import {STAGES,canTransitionStage,type StageId} from './stage-profile';
import {focusMenu,type MenuDirection} from './menu-focus';
import {createSoundscape,heartbeat,type Soundscape} from './soundscape';
import {LORE,ARCHIVE_KEY,sanitizeArchive,noteById} from './lore';
import {RECORDS_KEY,sanitizeRecords,scoreRun,applyClear,stageSummary,recordKey,surplusPoints,type Records,type ScoreResult} from './records';
import {objective,routePips} from './objective';
import {BEAD_REQUIREMENTS} from './goal-rules';
import {chooseOmens,type OmenId} from './run-omens';
import type {ItemKind} from './item-bag';
const pollPads=()=>{try{return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p);}catch{return [];}};
const clampPitch=(p:number)=>Math.max(-1.3,Math.min(1.3,p));
type ModelTool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
const STAGE_IDS=Object.keys(STAGES) as StageId[],NOTE_TOTAL=STAGE_IDS.reduce((n,id)=>n+LORE[id].notes.length,0),BEAD_NAMES={blue:'青',red:'赤',gold:'金'} as const;
const readStored=<T,>(key:string,sanitize:(raw:unknown)=>T)=>{try{return sanitize(JSON.parse(localStorage.getItem(key)??'null'));}catch{return sanitize(null);}};
const bestTime=(records:Records,stage:StageId)=>{const times=PLAY_MODES.filter(m=>m.id!=='gallery').map(m=>records[recordKey(stage,m.id)]?.bestTime).filter((t):t is number=>t!=null);return times.length?Math.min(...times):null;};
/** 青2・赤1（・金1）: zero colours are left out. */
const beadCounts=(c:{blue:number;red:number;gold:number})=>[c.blue?`青${c.blue}`:'',c.red?`赤${c.red}`:'',c.gold?`金${c.gold}`:''].filter(Boolean).join('・')||'0個';
/** The veil's pulse period in 0.2 s steps: re-timing a full-screen animation on every HUD tick costs a repaint each time. */
const veilBeat=(bpm?:number)=>(bpm?Math.max(.4,Math.min(1.4,Math.round(60/bpm*5)/5)):1.4).toFixed(1)+'s';
const mixOf=(p:Preferences)=>({master:p.masterVolume,ambience:p.ambienceVolume,effects:p.effectsVolume});
function Magatama(){return <svg className="magatama-icon" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M13.4 2.6a6.4 6.4 0 1 1 0 12.8c-2.9 0-4.9 2-5.2 6c-3.3-1.9-4.8-5.1-4-8.9c.9-5.2 4.6-9.9 9.2-9.9Zm-.2 4.3a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 0 0 0-3.6Z"/></svg>;}
function NoteReader({id,onClose}:{id:string;onClose:()=>void}){const n=noteById(id);if(!n)return null;return <article className="note-reader"><header><small>{n.author}</small><h3>{n.title}</h3></header><p>{n.body}</p><button className="text-button" autoFocus onClick={onClose}>← 一覧に戻る</button></article>;}
function Archive({records,found,reading,onRead,onClose}:{records:Records;found:string[];reading:string|null;onRead:(id:string|null)=>void;onClose:()=>void}){
 return <div className="archive" role="dialog" aria-modal="true" aria-labelledby="archive-title">
  <header className="archive-heading"><div><span>YŪKYŌ</span><h2 id="archive-title">記録帳</h2></div><small>手記 {found.length} / {NOTE_TOTAL}</small><button className="close-button" aria-label="記録帳を閉じる" onClick={onClose}><X size={18}/></button></header>
  {reading?<NoteReader id={reading} onClose={()=>onRead(null)}/>:<div className="archive-stages">{STAGE_IDS.map(id=>{const s=stageSummary(records,id),time=bestTime(records,id);return <section key={id} className="archive-stage"><h3>{STAGES[id].name}{s.rank&&<b className="rank-badge" data-rank={s.rank}>{s.rank}</b>}</h3><small>{s.clears?'踏破 '+s.clears+'回'+(time!=null?' · 最速 '+formatRunTime(time):''):'未踏破'}</small><ul>{LORE[id].notes.map(n=>{const open=found.includes(n.id);return <li key={n.id}><button disabled={!open} onClick={()=>onRead(n.id)}><ScrollText size={14} aria-hidden="true"/>{open?n.title:'？？？'}</button></li>;})}</ul></section>;})}</div>}
  <p className="start-help">探索中に拾った手記は、ここにいつまでも残ります · ○ / Esc で戻る</p>
 </div>;
}
export default function Shrine(){
  const [session,setSession]=useState<{stage:StageId;run:number;autostart:PlayMode|null}>({stage:'shrine',run:0,autostart:null});
  const [titled,setTitled]=useState(false);
  const retained=useRef<Preferences|null>(null),sound=useRef<Soundscape|null>(null);
  // One sound engine outlives stage sessions, so ambience crossfades instead of restarting.
  useEffect(()=>{const s=createSoundscape();sound.current=s;return()=>{s.dispose();sound.current=null;};},[]);
  const selectStage=useCallback((stage:StageId,autostart:PlayMode|null=null)=>setSession(old=>({stage,run:old.run+1,autostart})),[]);
  const toTitle=useCallback((stage:StageId)=>{setTitled(false);selectStage(stage);},[selectStage]);
  const enter=useCallback(()=>setTitled(true),[]);
  return <ShrineSession key={session.stage+':'+session.run} stage={session.stage} autostart={session.autostart} retained={retained} sound={sound} titled={titled} onTitled={enter} onStage={selectStage} onTitle={toTitle}/>;
}
function ShrineSession({stage,autostart,retained,sound,titled,onTitled,onStage,onTitle}:{stage:StageId;autostart:PlayMode|null;retained:{current:Preferences|null};sound:{current:Soundscape|null};titled:boolean;onTitled:()=>void;onStage:(stage:StageId,autostart?:PlayMode|null)=>void;onTitle:(stage:StageId)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDivElement>(null),startPanel=useRef<HTMLElement>(null),clearPanel=useRef<HTMLElement>(null);
  const [started,setStarted]=useState(false),[playMode,setPlayMode]=useState<PlayMode>('normal');
  const actionGate=useRef(new TouchActionGate());
  const [mirrorStatus,setMirrorStatus]=useState({count:0,remaining:0}),[stairHint,setStairHint]=useState('');
  const session=useRef(new GamepadSession()),touch=useRef(new TouchInput()),keys=useRef(new Set<string>());
  const worldRef=useRef<ReturnType<typeof createWorld>|null>(null);
  const burstInput=useRef(new BurstInput());
  const state=useRef({yaw:0,pitch:0,light:true,paused:true,started:false});
  const calibration=useRef<PadCalibration|null>(null),lastPad=useRef<Pad|null>(null);
  const prefRef=useRef<Preferences>(DEFAULTS);
  const [prefs,setPrefs]=useState<Preferences>(DEFAULTS),[pad,setPad]=useState(false),[connected,setConnected]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[menu,setMenu]=useState(false),[light,setLight]=useState(true),[locked,setLocked]=useState(false);
  const [calStep,setCalStep]=useState(-1),[notice,setNotice]=useState('');
  const [collection,setCollection]=useState({blue:0,red:0,gold:0,areaName:"祭殿回廊",blueOffered:0,redOffered:0,finale:null as FinaleKind|null,unlocked:false,area:'blue' as 'blue'|'red'});
  const [stamina,setStamina]=useState({enabled:false,value:1,exhausted:false});
  const [run,setRun]=useState(()=>new RunProgress().snapshot());
  const [altarNear,setAltarNear]=useState(false);
  const [won,setWon]=useState(false),[goalBearing,setGoalBearing]=useState({angle:0,distance:0});
  const advanceStage=(next:StageId)=>{const world=worldRef.current;if(world&&canTransitionStage(world.playMode,world.completed,stage,next))onStage(next);};
  const [burstRemaining,setBurstRemaining]=useState(0);
  const [stopRemaining,setStopRemaining]=useState(0),[stopCooldown,setStopCooldown]=useState(0);
  const [enemyMarkers,setEnemyMarkers]=useState<{id:number;angle:number;distance:number;stunned:boolean;level:'above'|'below'|'same';chasing:boolean;dormant:boolean}[]>([]);
  const [night,setNight]=useState<{phase:0|1|2;name:string;fraction:number;state:'calm'|'warning'|'hunt'|'lull';left:number;tolls:number;revision:number;sleeping:number;reward:'bell'|'ward'|null;clearPhase:0|1|2|null}>({phase:0,name:'宵の刻',fraction:0,state:'calm',left:0,tolls:0,revision:0,sleeping:0,reward:null,clearPhase:null});
  const [items,setItems]=useState<{bell:number;ward:number;selected:ItemKind;placed:number}>({bell:0,ward:0,selected:'bell',placed:0});
  const [bundle,setBundle]=useState<{angle:number;distance:number;count:number}|null>(null),[rite,setRite]=useState<{progress:number;remaining:number}|null>(null),[omenLeft,setOmenLeft]=useState(0),[gaze,setGaze]=useState(0);
  const [omens,setOmens]=useState<{ids:OmenId[];multiplier:number;names:string[];lines:string[]}>({ids:[],multiplier:1,names:[],lines:[]});
  const [lockRequired,setLockRequired]=useState(false);
  const [crouch,setCrouch]=useState(false),[notes,setNotes]=useState<{found:string[];total:number}>({found:[],total:LORE[stage].notes.length});
  const [archive,setArchive]=useState<string[]>([]),[records,setRecords]=useState<Records>({}),archiveRef=useRef<string[]>([]);
  const [clear,setClear]=useState<{result:ScoreResult;newTime:boolean;newScore:boolean;first:boolean}|null>(null);
  const [noteCard,setNoteCard]=useState<string|null>(null),[reading,setReading]=useState<string|null>(null),[intro,setIntro]=useState(false);
  const [menuTab,setMenuTab]=useState('status'),[confirming,setConfirming]=useState<'restart'|'title'|null>(null),[archiveOpen,setArchiveOpen]=useState(false);
  const startBack=useRef(()=>{}),menuBack=useRef(()=>{});
  const lockPolicy=useRef(new PointerLockPolicy()),lastPointerType=useRef('');
  const requestLock=useCallback(()=>{
    if(state.current.paused||lockPolicy.current.pending!==null||document.pointerLockElement===document.documentElement)return;
    if(!document.documentElement.requestPointerLock){setLockRequired(needsControllerLock(session.current.mode,state.current.paused,false));setNotice('このブラウザではカーソルを固定できません。固定対応のデスクトップ版ブラウザで開いてください。');return;}
    const policy=lockPolicy.current,ticket=policy.begin(session.current.mode==='gamepad'?'gamepad':'mouse');
    const failed=()=>{if(policy.reject(ticket))setLockRequired(needsControllerLock(session.current.mode,state.current.paused,document.pointerLockElement===document.documentElement));};
    try{const result=document.documentElement.requestPointerLock();if(result)void result.catch(failed);else document.addEventListener('pointerlockerror',failed,{once:true});}catch{failed();}
  },[]);
  const [stickPosition,setStickPosition]=useState({x:0,z:0});
  const [touchSprint,setTouchSprint]=useState(false);
  useEffect(()=>{if(!ready||started)return;const panel=startPanel.current;(panel?.querySelector<HTMLButtonElement>('[data-initial-stage][aria-pressed=true]:not(:disabled)')??panel?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus({preventScroll:true});},[ready,titled,archiveOpen]);
  const [mechanismNear,setMechanismNear]=useState(''),[circusHint,setCircusHint]=useState('');
  const [doorNear,setDoorNear]=useState(false),[burstPulse,setBurstPulse]=useState(0),[caughtPulse,setCaughtPulse]=useState(0);
  const clearInput=useCallback(()=>{keys.current.clear();touch.current.clear();burstInput.current.clear();setTouchSprint(false);setStickPosition({x:0,z:0});},[]);
  const applyPreferences=useCallback((next:Preferences)=>{const v=sanitizePreferences(next);prefRef.current=v;retained.current=v;setPrefs(v);try{localStorage.setItem('yukyo-preferences-v1',JSON.stringify(v));}catch{};worldRef.current?.configure(v);sound.current?.setMix(mixOf(v));return v;},[retained,sound]);
  const setMenuOpen=useCallback((open:boolean)=>{
    if(!state.current.started)return;if(state.current.paused!==open)sound.current?.ui(open?'open':'close');state.current.paused=open;setMenu(open);clearInput();setConfirming(null);setReading(null);if(open)setMenuTab('status');
    document.documentElement.dataset.shrinePlaying=String(!open);
    if(open){lockPolicy.current.openMenu(session.current.mode,document.pointerLockElement===document.documentElement);setLockRequired(false);document.exitPointerLock?.();document.documentElement.classList.remove('controller-cursor-hidden');document.documentElement.style.removeProperty('cursor');}
    else{
      calibration.current=null;setCalStep(-1);
      document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(false));
      document.documentElement.style.setProperty('cursor','none','important');
      const resumeLock=lockPolicy.current.resume(session.current.mode);
      setLockRequired(resumeLock==='gamepad');
      if(resumeLock)requestLock();
      requestAnimationFrame(()=>{if(!state.current.paused)canvas.current?.focus({preventScroll:true});});
    }
  },[clearInput,requestLock,sound]);
  const beginGame=useCallback((mode:PlayMode)=>{const w=worldRef.current;if(!w||state.current.started)return;sound.current?.unlock();sound.current?.ui('confirm');
    // The first night on a stage and mode is always calm; later nights draw an omen from the world's seed.
    const stored=readStored(RECORDS_KEY,sanitizeRecords),drawn=chooseOmens(w.seed,mode,!stored[recordKey(stage,mode)],!!stageSummary(stored,stage).rank);
    w.setMode(mode,{omens:drawn});setOmens(w.omenStatus());setItems(w.itemStatus());setNight(w.nightStatus());setPlayMode(mode);state.current.started=true;state.current.paused=false;setStarted(true);setIntro(true);setMenuOpen(false);},[setMenuOpen,sound,stage]);
  const useItem=useCallback(()=>{const w=worldRef.current;if(state.current.paused||!w||w.playMode==='gallery')return;const kind=w.itemStatus().selected,result=w.useItem();
    const message={thrown:'鈴を投げた',placed:'御札を置いた · 追う者だけを縛る',empty:kind==='bell'?'鈴がない':'御札がない',ramp:'階段には置けない',near:'近くに御札がある',full:'御札は二枚まで',riding:'乗り物の上では使えない',blocked:''}[result];if(message)setNotice(message);setItems(w.itemStatus());},[]);
  const selectItem=useCallback((kind:ItemKind)=>{const w=worldRef.current;if(!w)return;w.selectItem(kind);setItems(w.itemStatus());},[]);
  const cycleItem=useCallback(()=>{const w=worldRef.current;if(state.current.paused||!w)return;w.cycleItem();setItems(w.itemStatus());sound.current?.ui('move');},[sound]);
  const useMirror=useCallback(()=>{if(state.current.paused)return;const w=worldRef.current;if(w?.playMode==='gallery')return;if(w?.useMirror())setNotice('鏡を使用 · 12秒間、敵の姿が映ります');else setNotice(w?.mirrorStatus().remaining?'鏡はすでに敵を映しています':'鏡をまだ持っていません');},[]);
  const setFlashlight=useCallback((on:boolean)=>{state.current.light=on;setLight(on);if(worldRef.current)worldRef.current.flashlight.visible=on;return {enabled:on};},[]);
  const toggleLight=useCallback(()=>setFlashlight(!state.current.light),[setFlashlight]);
  const toggleCrouch=useCallback(()=>{const w=worldRef.current;if(state.current.paused||!w)return;const on=w.toggleCrouch();setCrouch(on);if(on&&touch.current.sprint){touch.current.sprint=false;setTouchSprint(false);}},[]);
  const rememberNote=useCallback((id:string)=>{if(archiveRef.current.includes(id))return;const next=[...archiveRef.current,id];archiveRef.current=next;setArchive(next);try{localStorage.setItem(ARCHIVE_KEY,JSON.stringify(next));}catch{}},[]);
  const burst=useCallback(()=>{if(state.current.paused||!worldRef.current||worldRef.current.playMode==='gallery')return;burstInput.current.request(performance.now());},[]);
  const stopTime=useCallback(()=>{const world=worldRef.current;if(state.current.paused||!world||world.playMode==='gallery')return;if(world.stopTime()){setStopRemaining(10);setStopCooldown(30);setNotice('時間停止 · 10秒間、敵が動かなくなります');}else setNotice('時間停止の再使用まで '+Math.ceil(world.timeStopCooldown)+'秒');},[]);
  const interact=useCallback(()=>{if(state.current.paused)return;const before=worldRef.current?.collection().surplus??{blue:0,red:0};const opened=worldRef.current?.interact();if(opened&&typeof opened==='object')setNotice(opened.message);else if(opened==='offered')setNotice(worldRef.current?.collection().unlocked?(worldRef.current.riteStatus()?'封門の儀が始まった · 祭壇の輪の中で耐えよ':'奉納が完了しました。祭壇の奥の扉へ進んでください。'):'勾玉を祭壇に捧げました。');else if(opened==='surplus'){const after=worldRef.current?.collection().surplus??before,added=surplusPoints(after)-surplusPoints(before);setNotice(added>0?`余剰奉納 +${added}点`:'余剰奉納 · 上限に達した');}else if(opened==='empty')setNotice(worldRef.current?.collection().unlocked?(worldRef.current.riteStatus()?'封門の儀の最中 · 祭壇の輪の中で耐えよ':'祭壇の奥の扉が開いています。'):'青勾玉6個、赤勾玉2個、または金勾玉1個を捧げると扉が開きます。');else if(!opened)setNotice('祭壇・ふすま・仕掛けに近づいて、そちらを向いて〇を押してください。');},[]);
  useLayoutEffect(()=>{
    document.documentElement.dataset.shrinePlaying=String(started&&!menu&&!won);
    document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(!started||menu||won));
    if(!started||menu||won)document.documentElement.style.removeProperty('cursor');else document.documentElement.style.setProperty('cursor','none','important');
  },[started,menu,won]);
  useEffect(()=>{archiveRef.current=readStored(ARCHIVE_KEY,sanitizeArchive);setArchive(archiveRef.current);setRecords(readStored(RECORDS_KEY,sanitizeRecords));},[]);
  useEffect(()=>{startBack.current=()=>{if(reading)setReading(null);else if(archiveOpen){setArchiveOpen(false);sound.current?.ui('close');}};menuBack.current=()=>{if(reading)setReading(null);else setMenuOpen(false);};},[reading,archiveOpen,setMenuOpen,sound]);
  const touchMode=useCallback((e:React.PointerEvent)=>{
    session.current.poll(pollPads());
    if(!session.current.useTouch()){e.preventDefault();e.stopPropagation();return false;}
    if(e.pointerType!=='mouse'){lockPolicy.current.touch();if(document.pointerLockElement)document.exitPointerLock?.();}
    setLockRequired(false);setPad(false);return true;
  },[]);
  const activateController=useCallback(()=>{
    const current=session.current.poll(pollPads());
    if(current.pad){session.current.mode='gamepad';setPad(true);clearInput();canvas.current?.focus({preventScroll:true});void requestLock();}
    else{setNotice('DualSenseを接続し、×ボタンを押してからもう一度選んでください。');canvas.current?.focus({preventScroll:true});}
  },[clearInput,requestLock]);
  useEffect(()=>{
    const mobile=navigator.maxTouchPoints>1||/Android|iPhone|iPad/i.test(navigator.userAgent);let stored:unknown=null;try{stored=JSON.parse(localStorage.getItem('yukyo-preferences-v1')??'null');}catch{}const restored=retained.current??startupPreferences(stored,mobile);
    prefRef.current=restored;retained.current=restored;setPrefs(restored);
    let world:ReturnType<typeof createWorld>;
    try{world=createWorld(canvas.current!,undefined,undefined,stage);world.configure(restored);worldRef.current=world;if((import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV)(window as unknown as Record<string,unknown>).__yukyoWorld=world;}catch{setError('3D表示を開始できませんでした。WebGL対応のChromeまたはSafariで開いてください。');return;}
    setReady(true);let frame=0,last=performance.now(),lastHud=0,nightToastAt=-Infinity,oldMode='touch',controllerBlocked=false,lastStartNav=0,lastPhase=0,syncedSound:Soundscape|null=null,firstWarning=true;
    const loaded=new Set<string>(),edges=new ButtonEdges();
    edges.update(session.current.poll(pollPads()).pad);
    const startChoices=()=>Array.from(startPanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    const finishRun=(status:ReturnType<typeof world.runStatus>)=>{
      const omen=world.omenStatus(),nightNow=world.nightStatus();
      const summary={stage,mode:world.playMode,elapsed:status.elapsed,deaths:status.deaths,escapes:status.escapes,notes:world.noteStatus().found.length,notesTotal:LORE[stage].notes.length,hunts:status.hunts,clearPhase:nightNow.clearPhase??undefined,surplus:world.collection().surplus,omen:omen.ids.length?{ids:omen.ids,multiplier:omen.multiplier}:undefined};
      const result=scoreRun(summary),applied=applyClear(readStored(RECORDS_KEY,sanitizeRecords),summary,result);
      try{localStorage.setItem(RECORDS_KEY,JSON.stringify(applied.records));}catch{}
      setRecords(applied.records);setClear({result,newTime:applied.newTime,newScore:applied.newScore,first:applied.first});
    };
    const down=(e:KeyboardEvent)=>{
      if(!state.current.started){if(e.code==='Escape'){startBack.current();return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();focusMenu(startChoices(),e.code.slice(5).toLowerCase() as MenuDirection);sound.current?.ui('move');}return;}if(world.completed){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();const choices=Array.from(clearPanel.current?.querySelectorAll<HTMLButtonElement>('button')??[]),index=choices.indexOf(document.activeElement as HTMLButtonElement),direction=e.code==='ArrowUp'||e.code==='ArrowLeft'?-1:1;choices[(Math.max(0,index)+direction+choices.length)%choices.length]?.focus();}return;}
      if(e.code==='Escape'){if(state.current.paused)setMenuOpen(false);return;}
      if(state.current.paused)return;
      if(session.current.mode==='gamepad'){e.preventDefault();e.stopPropagation();return;}
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
      if(e.code==='KeyF'&&!e.repeat)toggleLight();
      if(e.code==='KeyE'&&!e.repeat)interact();
      if(e.code==='KeyQ'&&!e.repeat)burst();
      if(e.code==='KeyT'&&!e.repeat)stopTime();
      if(e.code==='KeyV'&&!e.repeat)useMirror();
      if(e.code==='KeyC'&&!e.repeat)toggleCrouch();
      if(e.code==='KeyR'&&!e.repeat)useItem();
      if(e.code==='Digit1')selectItem('bell');
      if(e.code==='Digit2')selectItem('ward');
      if((e.code==='KeyP'||e.code==='KeyO')&&!e.repeat)setMenuOpen(true);
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    const mouse=(e:MouseEvent)=>{
      // Ignore both physical and controller-emulated mouse movement in controller mode.
      session.current.poll(pollPads());
      if(!allowMouseLook(session.current.mode,state.current.paused,document.pointerLockElement===document.documentElement))return;
      const delta=viewDelta('mouse',e.movementX,e.movementY,0,prefRef.current);
      state.current.yaw+=delta.yaw;state.current.pitch=clampPitch(state.current.pitch+delta.pitch);
    };
    const lockChanged=()=>{
      const active=document.pointerLockElement===document.documentElement;
      if(active&&!lockPolicy.current.accepts(state.current.paused,session.current.mode)){document.exitPointerLock?.();setLocked(false);return;}
      if(active)lockPolicy.current.acquired();
      setLocked(active);setLockRequired(needsControllerLock(session.current.mode,state.current.paused,active));
      document.documentElement.dataset.shrinePlaying=String(!state.current.paused);
      if(!state.current.paused)document.documentElement.style.setProperty('cursor','none','important');
    };
    const lockError=()=>setLockRequired(needsControllerLock(session.current.mode,state.current.paused,document.pointerLockElement===document.documentElement));
    // Capture real touch across React portals, including the settings backdrop.
    const realTouch=(e:PointerEvent)=>{
      if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
      session.current.poll(pollPads());const wasController=session.current.mode==='gamepad';
      if(!session.current.useTouch()){e.preventDefault();e.stopPropagation();return;}
      lockPolicy.current.touch();setLockRequired(false);setPad(false);
      if(document.pointerLockElement)document.exitPointerLock?.();
      if(wasController)clearInput();
    };
    const focusGuard=(e:FocusEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&e.target instanceof HTMLElement&&e.target.matches('input,textarea,[contenteditable=true]')&&!dialog.current?.contains(e.target)){e.target.blur();canvas.current?.focus({preventScroll:true});}};
    const gamepadConnected=()=>{const p=session.current.poll(pollPads());setConnected(!!p.pad);};
    const hidden=()=>{last=performance.now();if(document.hidden)clearInput();};
    const wheel=(e:WheelEvent)=>{if(!state.current.paused||!dialog.current?.contains(e.target as Node)&&!startPanel.current?.contains(e.target as Node)&&!clearPanel.current?.contains(e.target as Node))e.preventDefault();};
    const touchMove=(e:TouchEvent)=>{if(!state.current.paused)e.preventDefault();};
    const menuNavigation=(buttons:ReturnType<ButtonEdges['update']>)=>{
      if(buttons.back){menuBack.current();return;}
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[role="slider"],[role="switch"],[role="radio"],[role="tab"]')??[]).filter(e=>e.getClientRects().length&&!e.hasAttribute('disabled'));
      const unique=[...new Set(items)];let index=unique.indexOf(document.activeElement as HTMLElement);
      if(buttons.up||buttons.down){index=(index+(buttons.up?-1:1)+unique.length)%unique.length;unique[index]?.focus({preventScroll:true});unique[index]?.scrollIntoView({block:'nearest'});sound.current?.ui('move');}
      const active=document.activeElement as HTMLElement|null;
      if(buttons.left||buttons.right){
        const setting=active?.closest<HTMLElement>('[data-setting]')?.dataset.setting as RangeKey|undefined;
        if(setting){applyPreferences(adjustRange(prefRef.current,setting,buttons.left?-1:1));}
        else {const key=buttons.left?'ArrowLeft':'ArrowRight';active?.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true}));active?.dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true}));}
      }
      if(buttons.confirm&&active&&dialog.current?.contains(active)&&active.getAttribute('role')!=='slider')active.click();
    };
    const tick=(time:number)=>{
      const frameMs=time-last,dt=Math.min(frameMs/1000,.15);last=time;
      const pads=pollPads();
      for(const p of pads){const k=mappingKey(p);if(loaded.has(k))continue;loaded.add(k);try{const m=JSON.parse(localStorage.getItem('yukyo-pad:'+k)??'null');if(validMapping(m,p))session.current.setMapping(p,m);}catch{}}
      const poll=session.current.poll(pads);lastPad.current=poll.pad;
      if(poll.mode!==oldMode){if(poll.mode==='gamepad'){clearInput();if(!state.current.paused){(document.activeElement as HTMLElement|null)?.blur?.();canvas.current?.focus({preventScroll:true});}}if(poll.mode==='touch'&&lockPolicy.current.desired==='gamepad'){lockPolicy.current.touch();if(document.pointerLockElement)document.exitPointerLock?.();setLockRequired(false);}oldMode=poll.mode;if(poll.mode==='gamepad')requestLock();setPad(poll.mode==='gamepad');}
      const focused=!document.hidden&&document.hasFocus();
      const buttons=edges.update(poll.pad);
      if(world.completed&&focused){
        const choices=Array.from(clearPanel.current?.querySelectorAll<HTMLButtonElement>('button')??[]);let selected=choices.indexOf(document.activeElement as HTMLButtonElement);
        const direction=buttons.down||buttons.right?1:buttons.up||buttons.left?-1:Math.abs(poll.input.move.z)>.5&&time-lastStartNav>230?Math.sign(poll.input.move.z):0;
        if(direction&&choices.length){selected=(Math.max(0,selected)+direction+choices.length)%choices.length;choices[selected]?.focus();lastStartNav=time;}
        if(buttons.confirm)choices[Math.max(0,selected)]?.click();
      }
      const wasPaused=state.current.paused;
      if(focused&&!state.current.started){
        const choices=startChoices();let selected=choices.indexOf(document.activeElement as HTMLButtonElement);
        const x=poll.input.move.x,z=poll.input.move.z;
        const direction:MenuDirection|null=buttons.down?'down':buttons.up?'up':buttons.left?'left':buttons.right?'right':time-lastStartNav>230&&Math.max(Math.abs(x),Math.abs(z))>.5?(Math.abs(x)>Math.abs(z)?x>0?'right':'left':z>0?'down':'up'):null;
        if(buttons.back)startBack.current();
        else if(direction){selected=focusMenu(choices,direction);lastStartNav=time;sound.current?.ui('move');}
        if(buttons.confirm&&!buttons.back)choices[Math.max(0,selected)]?.click();
      }
      if(focused&&state.current.started&&buttons.menu&&!calibration.current&&!world.completed)setMenuOpen(!state.current.paused);
      if(focused&&state.current.started&&state.current.paused&&!calibration.current&&!world.completed)menuNavigation(buttons);
      const canExplore=state.current.started&&!wasPaused&&allowExploration(poll.mode,state.current.paused,focused,document.pointerLockElement===document.documentElement);
      const blocked=needsControllerLock(poll.mode,state.current.paused,document.pointerLockElement===document.documentElement);
      if(blocked!==controllerBlocked){controllerBlocked=blocked;clearInput();setLockRequired(blocked);}
      if(canExplore&&buttons.flashlight)toggleLight();
      if(canExplore&&!wasPaused&&buttons.interact)interact();
      if(canExplore&&!wasPaused&&buttons.burst)burst();
      if(canExplore&&!wasPaused&&buttons.timeStop)stopTime();
      if(canExplore&&buttons.mirror)useMirror();
      if(canExplore&&buttons.crouch)toggleCrouch();
      if(canExplore&&!wasPaused&&buttons.item)useItem();
      if(canExplore&&buttons.itemCycle)cycleItem();
      if(calibration.current&&poll.pad){
        if(mappingKey(poll.pad)!==calibration.current.padKey){calibration.current=null;setCalStep(-1);setNotice('接続が変わりました。もう一度調整を開始してください。');}
        else {const mapping=calibration.current.update(poll.pad);setCalStep(calibration.current.step);
          if(mapping){session.current.setMapping(poll.pad,mapping);try{localStorage.setItem('yukyo-pad:'+mappingKey(poll.pad),JSON.stringify(mapping));}catch{};calibration.current=null;setCalStep(-1);setNotice('スティックとL1の調整を保存しました。');}
        }
      } else if(calibration.current&&!poll.pad){calibration.current=null;setCalStep(-1);setNotice('コントローラーの接続が切れました。');}
      const s=state.current,p=prefRef.current;
      if(canExplore){
        const k=keys.current,t=touch.current,game=poll.mode==='gamepad';
        const x=game?poll.input.move.x:t.x+Number(k.has('KeyD'))-Number(k.has('KeyA'));
        const z=game?poll.input.move.z:t.z+Number(k.has('KeyS'))-Number(k.has('KeyW'));
        const sprint=game?poll.input.sprint:t.sprint||k.has('ShiftLeft')||k.has('ShiftRight');
        const delta=viewDelta('gamepad',poll.input.look.x,poll.input.look.z,dt,prefRef.current);
        s.yaw+=delta.yaw-(!game?(Number(k.has('ArrowRight'))-Number(k.has('ArrowLeft')))*1.4*p.stickSensitivity*dt:0);
        s.pitch=clampPitch(s.pitch+delta.pitch-(!game?(Number(k.has('ArrowDown'))-Number(k.has('ArrowUp')))*1.2*p.stickSensitivity*dt*(p.invertY?-1:1):0));
        world.camera.rotation.set(s.pitch,s.yaw,0);
        const firePending=()=>{const action=burstInput.current.consume(time,world.burstCooldown);
        if(action==='fire'){
          const hits=world.burst();
          if(hits!==null){setBurstRemaining(14);setBurstPulse(v=>v+1);setNotice(hits>0?`${hits}体を9秒間スタン`:'命中なし · 前方10m・120°の見えている敵に有効');}
        }else if(action==='expired')setNotice('バースト再使用まで '+Math.ceil(world.burstCooldown)+'秒');};
        firePending();
        const steps=simulationSteps(dt);let moving=false,actualSprint=false;
        for(let i=0;i<steps.count;i++){
          const pos=world.move(x,z,s.yaw,sprint,steps.dt);
          actualSprint=pos.running;moving=Math.hypot(pos.x-world.camera.position.x,pos.z-world.camera.position.z)>.0001;
          world.camera.position.set(pos.x,pos.y+(p.motion&&moving&&!world.riding?Math.sin(time*(actualSprint?.016:.01))*(actualSprint?.03:.018):0),pos.z);
          if(world.step(steps.dt)){setCaughtPulse(v=>v+1);const report=world.captureReport();setNotice((report.dropped?'別の場所で目覚めた。持っていた勾玉は、捕まった場所に落ちている。奉納は残っている。':'別の場所で目覚めた。奉納は残っている。')+(report.scattered?'前の落とし物は元の部屋へ散った。':''));clearInput();s.yaw=0;s.pitch=0;break;}
          if(world.completed)break;
          firePending();
        }
        if(world.completed){const status=world.runStatus();setRun(status);finishRun(status);s.paused=true;clearInput();setWon(true);setLockRequired(false);document.exitPointerLock?.();}
        const fov=p.fov+(p.motion&&actualSprint&&moving?4:0);
        if(Math.abs(world.camera.fov-fov)>.02){world.camera.fov+=(fov-world.camera.fov)*Math.min(1,dt*8);world.camera.updateProjectionMatrix();}
      }
      if(time-lastHud>150||world.phaseRevision!==lastPhase){const status=world.runStatus();setRun(status);setMirrorStatus(world.mirrorStatus());setStairHint(world.stairHint());setStamina(world.staminaStatus());setCrouch(world.crouching);const found=world.noteStatus();setNotes(old=>old.found.length===found.found.length?old:found);if(world.phaseRevision!==lastPhase&&world.finale)setNotice(ENEMY_NAMES[world.finale]+'の気配 · 鐘が鳴り、灯りが遠のく。鏡を2つ'+(world.itemStatus().finaleWard?'、御札を1枚':'')+'入手。');setConnected(!!poll.pad);setMechanismNear(world.mechanismNear());setCircusHint(world.circusHint());setDoorNear(world.nearDoor());setAltarNear(world.nearAltar());setEnemyMarkers(world.enemyDirections());setBurstRemaining(Math.ceil(world.burstCooldown));setStopRemaining(Math.ceil(world.timeStopRemaining));setStopCooldown(Math.ceil(world.timeStopCooldown));const bag=world.collection();setCollection(old=>old.gold===bag.gold&&old.areaName===bag.areaName&&old.blue===bag.blue&&old.red===bag.red&&old.blueOffered===bag.blueOffered&&old.redOffered===bag.redOffered&&old.unlocked===bag.unlocked&&old.finale===bag.finale&&old.area===bag.area?old:bag);setGoalBearing(world.goalDirection());setNight(world.nightStatus());const kit=world.itemStatus();setItems(old=>old.bell===kit.bell&&old.ward===kit.ward&&old.selected===kit.selected&&old.placed===kit.placed?old:kit);setBundle(world.bundleDirection());setRite(world.riteStatus());setOmenLeft(world.omenRemaining());setGaze(world.noticeLevel());lastHud=time;lastPhase=world.phaseRevision;}
      // Sound follows the same frame: world cues, then the body's continuous state.
      const snd=sound.current;
      if(snd&&snd!==syncedSound){syncedSound=snd;snd.setStage(stage);snd.setMix(mixOf(prefRef.current));}
      // Night toasts outrank pickup and escape toasts: those stay quiet for a few seconds after a bell.
      const batch=world.drainCues(),nightCue=batch.some(c=>c.kind==='bell'&&!world.finale||c.kind==='purify'||c.kind==='notice');if(nightCue)nightToastAt=time;const nightQuiet=time-nightToastAt<4000;
      for(const c of batch){snd?.cue(c);
        if(c.kind==='note'){rememberNote(c.id);setNoteCard(c.id);}
        else if(c.kind==='pickup'){if(world.playMode!=='gallery'&&!nightQuiet)setNotice(({blue:'青勾玉',red:'赤勾玉',gold:'金の大勾玉'} as const)[c.color]+'を取得 · 祭壇の赤い針へ');}
        else if(c.kind==='escape'){if(!nightQuiet)setNotice('追跡を振り切りました');}
        else if(c.kind==='bell'&&!world.finale){const ns=world.nightStatus();
          if(c.beat==='warning'){setNotice(firstWarning?'鐘の余韻……狩りの刻まで12秒 · 影はあなたの今いる場所に集まる':'鐘の余韻……狩りの刻まで12秒');firstWarning=false;}
          else if(c.beat==='toll'){const ordinal=ns.tolls+(ns.startTolls??0);setNotice(ordinal===1?'鐘が二つ鳴った · 夜半の刻 — 眠っていた影が歩き出す':ordinal===2?'鐘が三つ鳴った · 丑三つ時 — 青い回廊も安全ではない':'鐘が鳴った · 影が集まる');}
          else if(c.beat==='lull')setNotice('鐘の余韻が消えた。しばし静かだ');
          else if(c.survived)setNotice('鐘を凌いだ · バースト再充填'+(ns.reward?' · '+(ns.reward==='bell'?'鈴':'御札')+'を授かった':''));}
        else if(c.kind==='purify')setNotice('祭壇が夜を祓った · 鐘が遠のく');
        else if(c.kind==='notice')setNotice('動くな——暗がりでも、近くで動けば気配を悟られる');
        else if(c.kind==='item'){if(c.action==='pickup')setNotice(c.item==='bell'?'鈴を拾った':'御札を拾った');else if(c.action==='burn')setNotice('御札が燃えた');}
        else if(c.kind==='recover')setNotice(`落とし物を拾い直した（${beadCounts(c)}）`);
        else if(c.kind==='rite'){if(c.beat==='start')setNotice('封門の儀が始まった · 祭壇の輪の中で耐えよ');else if(c.beat==='complete')setNotice('封門が開く');}}
      if(snd){const status=world.runStatus(),place=world.soundState();snd.frame({mood:!s.started?'title':world.completed?'clear':s.paused?'paused':'play',pressure:status.pressure,chase:status.state==='chase',frozen:place.frozen,exhausted:world.staminaStatus().exhausted,area:place.area,elevation:place.elevation});}
      // A held stick never restores cursor/touch UI, even if emulated pointer events arrive.
      document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(s.paused));
      world.observeFrame(frameMs,canExplore);
      if(!document.hidden)world.render(time);
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up);window.addEventListener('blur',clearInput);window.addEventListener('focus',hidden);
    window.addEventListener('gamepadconnected',gamepadConnected);document.addEventListener('focusin',focusGuard);
    document.addEventListener('pointerdown',realTouch,true);document.addEventListener('mousemove',mouse);document.addEventListener('pointerlockchange',lockChanged);document.addEventListener('pointerlockerror',lockError);
    document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',world.resize);
    document.addEventListener('wheel',wheel,{passive:false});document.addEventListener('touchmove',touchMove,{passive:false});
    const lost=(e:Event)=>{e.preventDefault();setError('3D描画が中断されました。ページを再読み込みしてください。');clearInput();};
    canvas.current?.addEventListener('webglcontextlost',lost);const element=canvas.current;
    return()=>{state.current.paused=true;lockPolicy.current.cancel();document.exitPointerLock?.();cancelAnimationFrame(frame);worldRef.current=null;world.dispose();window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearInput);window.removeEventListener('focus',hidden);window.removeEventListener('gamepadconnected',gamepadConnected);document.removeEventListener('focusin',focusGuard);document.removeEventListener('pointerdown',realTouch,true);document.removeEventListener('mousemove',mouse);document.removeEventListener('pointerlockchange',lockChanged);document.removeEventListener('pointerlockerror',lockError);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',world.resize);document.removeEventListener('wheel',wheel);document.removeEventListener('touchmove',touchMove);element?.removeEventListener('webglcontextlost',lost);document.documentElement.classList.remove('controller-cursor-hidden');delete document.documentElement.dataset.shrinePlaying;document.documentElement.style.removeProperty('cursor');};
  },[clearInput,setMenuOpen,toggleLight,toggleCrouch,useItem,selectItem,cycleItem,rememberNote,applyPreferences,burst,stopTime,interact,requestLock,useMirror,stage,retained,sound]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!noteCard)return;const timer=setTimeout(()=>setNoteCard(null),7000);return()=>clearTimeout(timer);},[noteCard]);
  useEffect(()=>{if(!intro)return;const timer=setTimeout(()=>setIntro(false),9000);return()=>clearTimeout(timer);},[intro]);
  useEffect(()=>{if(ready&&autostart)beginGame(autostart);},[ready,autostart,beginGame]);
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:ModelTool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools:ModelTool[]=[
      {name:'configure_shrine_view',description:'Change device-local view sensitivity, field of view, brightness, graphics, film grain and sound volume settings. Does not move the visitor.',inputSchema:{type:'object',properties:{stickSensitivity:{type:'number',minimum:.25,maximum:3},touchSensitivity:{type:'number',minimum:.25,maximum:3},mouseSensitivity:{type:'number',minimum:.25,maximum:3},fov:{type:'number',minimum:55,maximum:95},brightness:{type:'number',minimum:.7,maximum:1.8},quality:{enum:['low','medium','high','ultra']},invertY:{type:'boolean'},motion:{type:'boolean'},stamina:{type:'boolean'},masterVolume:{type:'number',minimum:0,maximum:1},ambienceVolume:{type:'number',minimum:0,maximum:1},effectsVolume:{type:'number',minimum:0,maximum:1},grain:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings object required');const candidate={...prefRef.current,...input};const checked=sanitizePreferences(candidate);for(const [k,v] of Object.entries(input)){if(!(k in DEFAULTS)||checked[k as keyof Preferences]!==v)throw new Error('Invalid setting: '+k);}return applyPreferences(checked);}},
      {name:'set_shrine_flashlight',description:'Turn the visitor flashlight on or off, the same action as the R1 button.',inputSchema:{type:'object',properties:{enabled:{type:'boolean'}},required:['enabled'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||Object.keys(input).length!==1||typeof (input as {enabled?:unknown}).enabled!=='boolean')throw new Error('enabled must be boolean');return setFlashlight((input as {enabled:boolean}).enabled);}},
    ];
    for(const t of tools){try{void Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return()=>lifecycle.abort();
  },[applyPreferences,setFlashlight]);
  const pointerEvents=(kind:'move'|'look'|'sprint')=>({
    onPointerDown:(e:React.PointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse'||state.current.paused||(kind==='look'&&e.target instanceof Element&&!!e.target.closest('button,.toolbar,.settings-dialog,.touch-pad:not(.look-pad)'))||!touchMode(e))return;e.stopPropagation();e.preventDefault();if(touch.current.start(e.pointerId,kind,e.clientX,e.clientY))e.currentTarget.setPointerCapture(e.pointerId);},
    onPointerMove:(e:React.PointerEvent<HTMLElement>)=>{e.stopPropagation();if(session.current.mode==='gamepad'||state.current.paused)return;const d=touch.current.move(e.pointerId,e.clientX,e.clientY);const delta=viewDelta('touch',d.yaw,d.pitch,0,prefRef.current);state.current.yaw+=delta.yaw;state.current.pitch=clampPitch(state.current.pitch+delta.pitch);if(kind==='move')setStickPosition({x:touch.current.x,z:touch.current.z});},
    onPointerUp:(e:React.PointerEvent<HTMLElement>)=>{e.stopPropagation();touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
    onPointerCancel:(e:React.PointerEvent<HTMLElement>)=>{e.stopPropagation();touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
    onLostPointerCapture:(e:React.PointerEvent<HTMLElement>)=>{e.stopPropagation();touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
  });
  const action=(key:string,perform:()=>void)=>({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(state.current.paused||!actionGate.current.down(key,e.pointerType,e.timeStamp)||!touchMode(e))return;e.preventDefault();e.stopPropagation();perform();},
    onPointerUp:(e:React.PointerEvent<HTMLButtonElement>)=>{actionGate.current.end(key,e.pointerType,e.timeStamp);e.stopPropagation();},
    onPointerCancel:(e:React.PointerEvent<HTMLButtonElement>)=>actionGate.current.end(key,e.pointerType,e.timeStamp),
    onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{if(!state.current.paused&&actionGate.current.click(key,e.detail,e.timeStamp))perform();},
  });
  const change=(key:keyof Preferences,value:number|boolean|string)=>applyPreferences({...prefRef.current,[key]:value});
  const range=(key:RangeKey,label:string,min:number,max:number,step:number,suffix:string,percent=false)=><div className="setting" data-setting={key}><label id={'label-'+key}>{label}<output aria-live="polite">{percent?Math.round(prefs[key]*100):prefs[key].toFixed(key==='fov'?0:2)}{suffix}</output></label><div className="range-controls"><button type="button" aria-label={label+'を下げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,-1))}>−</button><Slider aria-labelledby={'label-'+key} min={min} max={max} step={step} value={[prefs[key]]} onValueChange={v=>change(key,Array.isArray(v)?v[0]:v)}/><button type="button" aria-label={label+'を上げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,1))}>＋</button></div></div>;
  const blockControllerClick=(e:React.SyntheticEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&document.pointerLockElement===document.documentElement){e.preventDefault();e.stopPropagation();}};
  const restart=()=>{if(confirming!=='restart'){setConfirming('restart');return;}sound.current?.ui('confirm');onStage(stage,playMode);};
  const leaveToTitle=()=>{if(confirming!=='title'){setConfirming('title');return;}sound.current?.ui('confirm');onTitle(stage);};
  const surplusReady=collection.unlocked&&collection.blue+collection.red+collection.gold>0,surplusLabel=`青${collection.blue}・赤${collection.red+collection.gold}`;
  const threatLabel={quiet:'探索中',hidden:'消灯・忍び足',noticed:'視線を感じる',search:'近くを捜索中',chase:'追跡されています',frozen:'時間停止中',stunned:'敵はスタン中'}[run.state]+(collection.finale?'':night.state==='warning'?' · 鐘の余韻':night.state==='hunt'?' · 狩りの刻':'');
  const goalLine=objective(playMode,{...collection,omen:omenLeft>0,rite}),compassShown=!modeAids(playMode).darkCompass||!light,beat=heartbeat(run.pressure,run.state==='chase',run.state==='frozen');
  const modeName=PLAY_MODES.find(m=>m.id===playMode)?.name??'',playing=ready&&started&&!menu&&!won,stageNotes=LORE[stage].notes;
  const note=noteCard?noteById(noteCard):undefined;
  return <main {...pointerEvents('look')} className="experience" data-playing={started&&!menu&&!won} onContextMenu={e=>e.preventDefault()} onClickCapture={blockControllerClick} onPointerDownCapture={blockControllerClick}>
    <canvas ref={canvas} tabIndex={-1} inputMode="none" aria-label={STAGES[stage].name+"の一人称回廊"} onPointerDown={e=>{lastPointerType.current=e.pointerType;if(e.pointerType==='mouse'&&session.current.mode==='gamepad'){void requestLock();return;}touchMode(e);}} onClick={e=>{if(e.detail===2&&lastPointerType.current==='mouse'&&session.current.mode!=='gamepad')void requestLock();}}/>
    <div className="vignette"/><div className="film-grain" aria-hidden="true" hidden={!prefs.grain||prefs.quality==='low'}/><div className="threat-veil" data-active={started&&!menu&&!won&&run.state==='chase'} data-gaze={playing&&run.state!=='chase'&&gaze>=.35} style={{'--beat':veilBeat(beat?.bpm),'--gaze':(Math.round(gaze*10)/20).toFixed(2)} as React.CSSProperties} aria-hidden="true"/>{!menu&&<div className="enemy-compass" aria-hidden="true">{enemyMarkers.map(e=><span key={e.id} className="enemy-bearing" data-chasing={e.chasing} data-dormant={e.dormant} style={{left:(50+Math.sin(e.angle)*43)+'%',top:(50-Math.cos(e.angle)*39)+'%',transform:'translate(-50%,-50%)',color:e.dormant?'#9aa3a6':e.stunned?'#b8ffff':(e.id===4?'#ff201e':['#ff386a','#5fffe0','#bb78ff','#ffbc40'][e.id%4]),opacity:Math.max(.4,1-e.distance/160)}}><i style={{transform:'rotate('+e.angle+'rad)'}}>⌃</i>{(e.dormant||e.level!=='same')&&<small>{[e.dormant?'眠':'',e.level==='above'?'上階':e.level==='below'?'下階':''].filter(Boolean).join('·')}</small>}</span>)}</div>}<div className="reticle" aria-hidden="true"/>
    {burstPulse>0&&<div key={'burst'+burstPulse} className="burst-pulse" aria-hidden="true"/>}
    {stopRemaining>0&&started&&!menu&&!won&&<div className="time-stop-veil" aria-hidden="true"/>}
    {caughtPulse>0&&<div key={'caught'+caughtPulse} className="caught-pulse" aria-hidden="true"><strong>囚われた</strong><span>魂の欠片は散り、あなたは別の場所で目を覚ます · 奉納は祭壇に残る</span></div>}

    <nav className="toolbar" hidden={!started||won} aria-label="操作メニュー" onPointerDownCapture={e=>{if(session.current.mode==='gamepad'){session.current.poll(pollPads());if(!session.current.allowsMenuPointer()){e.preventDefault();e.stopPropagation();}}}}>
      <button aria-label="DualSenseで操作を開始してカーソルを固定" aria-pressed={pad} className={pad?'active':''} onClick={activateController}><Gamepad2 size={20}/></button>
      <button aria-label={light?'フラッシュライトを消す':'フラッシュライトを点ける'} aria-pressed={light} {...action('light',toggleLight)} className={light?'active':''}>{light?<Flashlight size={19}/>:<FlashlightOff size={19}/>}</button>
      <button aria-label="マウスカーソルを固定" aria-pressed={locked} onClick={()=>void requestLock()} className={locked?'active':''}><Focus size={18}/></button>
      <button aria-label="全画面を切替" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setNotice('このブラウザでは全画面切替を利用できません。');}catch{setNotice('全画面表示を開始できませんでした。');}}}><Maximize size={18}/></button>
      <button aria-label="一時停止メニューと設定" onClick={()=>setMenuOpen(true)}><Settings size={19}/></button>
    </nav>
    {playing&&<><div className="collection-status">
      <div className="objective-line" data-step={goalLine.step} key={goalLine.step}><small>目的</small><strong>{goalLine.title}</strong><span>{goalLine.detail}</span></div>
      {playMode!=='gallery'&&(collection.unlocked?<div className="routes routes-complete" role="status">{rite?'奉納完了 · 封門の儀':'奉納完了 · 封門が開いた'}</div>:<div className="routes" role="status" aria-label={`所持 青${collection.blue}・赤${collection.red}・金${collection.gold}、奉納 青${collection.blueOffered}・赤${collection.redOffered}`}>{(['blue','red','gold'] as const).map(color=><div key={color} className="route" data-color={color}><Magatama/><span className="pips">{routePips(collection[color],color==='blue'?collection.blueOffered:color==='red'?collection.redOffered:0,BEAD_REQUIREMENTS[color]).map((pip,i)=><i key={i} data-state={pip}/>)}</span><small>{BEAD_NAMES[color]} {collection[color]}</small></div>)}</div>)}
      <small className="item-line" role="group" aria-label="道具と手記">{playMode!=='gallery'&&<>{(['bell','ward'] as const).map(kind=><span key={kind}>{items.selected===kind?<b>▶{kind==='bell'?'鈴':'御札'} {items[kind]}</b>:<>{kind==='bell'?'鈴':'御札'} {items[kind]}</>}{kind==='ward'&&items.placed>0&&<em>（設置 {items.placed}）</em>}</span>)}<span>鏡 {mirrorStatus.count}{mirrorStatus.remaining>0?` · 透視 ${Math.ceil(mirrorStatus.remaining)}秒`:''}</span></>}<span>手記 {notes.found.length}/{notes.total}</span>{pad&&playMode!=='gallery'&&<em>タッチパッド/↑ で使う · L3 で持ち替え</em>}</small>
      <small className={'area-line '+(collection.area==='red'?'red-bead':'blue-bead')}>{stage!=='shrine'?STAGES[stage].name+' · ':''}{collection.areaName}</small>
    </div><div className="altar-compass" data-hidden={!compassShown} role="img" aria-label={compassShown?`赤い針は祭壇の方向。距離${Math.round(goalBearing.distance)}メートル`+(bundle?`。落とし物 ${Math.round(bundle.distance)}メートル`:'')+(rite?`。封門の儀 ${Math.round(rite.progress*100)}%`:''):'悪夢では灯りを消している間だけ祭壇の針が現れます'}><div className="compass-dial" data-rite={rite?true:undefined} style={{'--rite':(rite?.progress??0).toFixed(3)} as React.CSSProperties}>{compassShown?<i style={{transform:'rotate('+goalBearing.angle+'rad)'}}/>:<em aria-hidden="true">?</em>}{bundle&&compassShown&&<i className="drop-needle" style={{transform:'rotate('+bundle.angle+'rad)'}}/>}<b/></div><span>{compassShown?`祭壇 ${Math.round(goalBearing.distance)}m`:'消灯で針'}</span>{bundle&&compassShown&&<small className="drop-line">落とし物 {Math.round(bundle.distance)}m</small>}</div></>}
    {playing&&<aside className="play-state" data-threat={run.state} aria-label="探索状況">{(doorNear||altarNear||mechanismNear)&&<button className="door-action" aria-label={mechanismNear||(altarNear?(surplusReady?`〇：余剰奉納（${surplusLabel}）`:'〇：勾玉を祭壇に捧げる'):'〇：ふすまを開閉')} {...action('interact',interact)}>{altarNear?<Sparkles size={20}/>:<DoorOpen size={20}/>}<span>{mechanismNear||(altarNear?(surplusReady?`〇 余剰奉納（${surplusLabel}）`:'〇 捧げる'):'〇')}</span></button>}<span>{playMode==='gallery'?'ギャラリー · 安全な散策':(collection.finale?ENEMY_NAMES[collection.finale]+' · ':'')+threatLabel}</span>{crouch&&<small className="posture-tag">しゃがみ · 見つかりにくい</small>}{circusHint&&<small className="circus-hint">{circusHint}</small>}{stairHint&&<strong className="stair-hint">{stairHint}</strong>}{playMode!=='gallery'&&<><div className="pressure-row"><small>警戒度</small><div className="pressure-meter" role="meter" aria-label="現在の追跡と警戒" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(run.pressure*100)} aria-valuetext={threatLabel+'・'+Math.round(run.pressure*100)+'%'}><i style={{width:run.pressure*100+'%'}}/></div><small className="pressure-value" aria-hidden="true">{Math.round(run.pressure*100)}%</small></div><div className="night-row" data-state={night.state} role="img" aria-label={`今宵の刻 ${night.name}`}><small>刻</small><div className="incense"><i style={{width:(1-night.fraction)*100+'%'}}/></div><small>{night.name}</small></div><time className="run-clock" dateTime={'PT'+Math.floor(run.elapsed)+'S'}>探索 {formatRunTime(run.elapsed)}</time></>}{stamina.enabled&&<div className="stamina-status" data-exhausted={stamina.exhausted}><small>{stamina.exhausted?'息切れ · ダッシュ解除か停止':'スタミナ'}</small><div role="meter" aria-label="スタミナ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stamina.value*100)}><i style={{width:stamina.value*100+'%'}}/></div></div>}{pad&&playMode!=='gallery'&&<div className="ability-readout"><span>R2 {burstRemaining>0?burstRemaining+'秒':'バースト'}</span><span>L2 {stopRemaining>0?'停止 '+stopRemaining+'秒':stopCooldown>0?stopCooldown+'秒':'時間停止'}</span></div>}</aside>}
    {intro&&playing&&<div className="stage-intro" aria-live="polite"><div className="intro-text"><small>{STAGES[stage].subtitle}</small><h2>{STAGES[stage].name}</h2>{LORE[stage].prologue.map((line,i)=><p key={i} style={{animationDelay:(1.1+i*1.3)+'s'}}>{line}</p>)}{omens.ids.length>0&&<p className="omen-line" style={{animationDelay:'4.8s'}}>今宵の兆し · {omens.names.join('・')} — {omens.lines.join('。')}</p>}<em style={{animationDelay:'5.2s'}}>{modeName} · {goalLine.title}</em></div></div>}
    {note&&playing&&<aside className="note-card" role="status"><ScrollText size={20} aria-hidden="true"/><div><small>手記を入手 · {notes.found.length}/{notes.total}</small><strong>{note.title}</strong><span>{note.author}</span><em>{pad?'Options':'P'} →「手記」で読む</em></div></aside>}
    {won&&<section ref={clearPanel} className="clear-screen" role="dialog" aria-modal="true" aria-labelledby="clear-title"><span className="clear-mark" aria-hidden="true"><Magatama/></span><h1 id="clear-title">封印解除</h1><p>{STAGES[stage].name}の封門を越えました。次の境界へ。</p>
      {clear?.result.rank?<div className="result-panel"><div className="rank-card" data-rank={clear.result.rank}><small>評価</small><b>{clear.result.rank}</b><span>{clear.result.score.toLocaleString('ja-JP')} 点</span>{(clear.first||clear.newScore)&&<em>{clear.first?'初踏破':'自己ベスト更新'}</em>}</div><dl className="score-lines">{clear.result.lines.map(l=><div key={l.label}><dt>{l.label}<small>{l.detail}</small></dt><dd data-sign={l.points<0?'minus':'plus'}>{l.points>0?'+':''}{l.points.toLocaleString('ja-JP')}</dd></div>)}{clear.result.multiplier!==1&&<div><dt>難度補正<small>{modeName}</small></dt><dd>×{clear.result.multiplier}</dd></div>}{clear.result.omenMultiplier!==undefined&&clear.result.omenMultiplier!==1&&<div><dt>兆し<small>{omens.names.join('・')}</small></dt><dd>×{clear.result.omenMultiplier}</dd></div>}</dl></div>:<strong>CLEAR</strong>}
      <dl className="run-results">{playMode==='gallery'?<div><dt>散策時間</dt><dd>{formatRunTime(run.elapsed)}</dd></div>:<><div><dt>スタン成功</dt><dd>{run.stuns}</dd></div><div><dt>時間停止</dt><dd>{run.freezes}</dd></div></>}<div><dt>勾玉取得</dt><dd>{run.pickups}</dd></div><div><dt>手記</dt><dd>{notes.found.length}/{notes.total}</dd></div>{playMode!=='gallery'&&<div><dt>鐘を凌いだ</dt><dd>{run.hunts}</dd></div>}</dl>
      {clear?.newTime&&<small className="record-flag">最速記録を更新 · {formatRunTime(run.elapsed)}</small>}
      <div className="stage-choices">{STAGE_IDS.filter(id=>id!==stage).map((id,i)=><button key={id} autoFocus={i===0} data-stage={id} onClick={()=>advanceStage(id)}><em>{STAGES[id].subtitle}</em><b>{STAGES[id].name}</b><span>{STAGES[id].description}</span><small>{STAGES[id].challenge}</small></button>)}</div><button className="replay-stage" onClick={()=>advanceStage(stage)}>同じステージを再生成</button><small>タッチで選択 · 方向キーで選択 / × で決定</small></section>}
    {!ready&&!error&&(titled||!!autostart)&&<div className="loading"><span/>灯りをともしています</div>}
    {error&&<div className="notice" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>再読み込み</button></div>}
    {lockRequired&&pad&&started&&!menu&&!won&&<div className="lock-gate"><button className="lock-resume" onClick={requestLock}>クリックしてカーソルを固定・再開</button><p>固定が完了するまで探索を一時停止しています</p></div>}
    {notice&&<div className="toast" role="status">{notice}</div>}
    <div className="touch-controls" hidden={!started||pad||menu||won}>
      <div className="touch-pad" role="group" aria-label="移動タッチパッド" {...pointerEvents('move')}><span className="thumb" style={{transform:'translate(calc(var(--thumb-travel) * '+stickPosition.x+'),calc(var(--thumb-travel) * '+stickPosition.z+'))'}}><Move size={28}/></span></div>
      <div className="touch-right"><div className="touch-actions">{playMode!=='gallery'&&<><button className="sprint" aria-label="鏡を使う" disabled={mirrorStatus.count===0||mirrorStatus.remaining>0} {...action('mirror',useMirror)}><span className="mirror-icon"/><small className="burst-timer">{mirrorStatus.count}</small></button><button className="sprint" aria-label={stopCooldown?`時間停止の再使用まで ${stopCooldown}秒`:'時間停止：10秒間'} disabled={stopCooldown>0} {...action('freeze',stopTime)}><Clock3 size={22}/>{stopCooldown>0&&<small className="burst-timer">{stopRemaining||stopCooldown}</small>}</button><button className="sprint" aria-label={burstRemaining?`バースト再使用まで ${burstRemaining}秒`:'バースト：前方120°の敵を9秒スタン'} disabled={burstRemaining>0} {...action('burst',burst)}><Sparkles size={23}/>{burstRemaining>0&&<small className="burst-timer">{burstRemaining}</small>}</button></>}{playMode!=='gallery'&&<div className="item-button"><button className="sprint" aria-label={items.selected==='bell'?'鈴を投げる':'御札を置く'} disabled={items[items.selected]===0} {...action('item',useItem)}>{items.selected==='bell'?<Bell size={22}/>:<StickyNote size={22}/>}<small className="burst-timer">{items[items.selected]}</small></button><button className="item-slot" data-kind={items.selected} aria-label={(items.selected==='bell'?'鈴':'御札')+'：道具を持ち替える'} {...action('itemCycle',cycleItem)}>{items.selected==='bell'?'鈴':'御札'}</button></div>}<button className="sprint" aria-label={crouch?'立ち上がる':'しゃがむ'} aria-pressed={crouch} {...action('crouch',toggleCrouch)}><ChevronsDown size={23}/></button><button className="sprint" aria-label={touchSprint?'ダッシュをオフ':'ダッシュをオン'} aria-pressed={touchSprint} {...action('sprint',()=>setTouchSprint(touch.current.toggleSprint()))}><Footprints size={24}/></button></div><div className="touch-pad look-pad" role="group" aria-label="視点タッチパッド" {...pointerEvents('look')}><span className="thumb"><Scan size={28}/></span></div></div>
    </div>
    {!started&&!error&&!autostart&&<section className="start-screen" data-phase={archiveOpen?'archive':titled?'select':'title'} aria-label="幽境 タイトル" ref={startPanel}>
      {archiveOpen?<Archive records={records} found={archive} reading={reading} onRead={id=>{setReading(id);sound.current?.ui(id?'open':'close');}} onClose={()=>{setReading(null);setArchiveOpen(false);sound.current?.ui('close');}}/>
      :!titled?<div className="title-splash">
        <span className="title-eyebrow">YŪKYŌ</span><h1 id="start-title">幽境</h1><p className="title-tagline">忘れられた場所の、さらに奥へ。</p>
        <div className="title-actions"><button data-title="start" autoFocus onClick={()=>{sound.current?.unlock();sound.current?.ui('confirm');onTitled();}}>はじめる<span aria-hidden="true">→</span></button><button data-title="archive" onClick={()=>{sound.current?.unlock();sound.current?.ui('open');setArchiveOpen(true);}}><BookOpen size={16} aria-hidden="true"/>記録帳<small>{archive.length} / {NOTE_TOTAL}</small></button></div>
        <p className="start-help">ヘッドホン推奨 · 音は最初の操作で鳴りはじめます<br/>DualSense・キーボードとマウス・タッチに対応</p>
      </div>
      :<div className="stage-select">
        <header className="select-heading"><div className="start-heading"><span>YŪKYŌ</span><h1 id="start-title">幽境</h1></div><button className="archive-button" onClick={()=>{sound.current?.ui('open');setArchiveOpen(true);}}><BookOpen size={16} aria-hidden="true"/>記録帳<small>{archive.length} / {NOTE_TOTAL}</small></button></header>
        <div className="select-body">
          <div className="initial-stages" role="group" aria-label="ステージを選ぶ">
            {STAGE_IDS.map(id=>{const summary=stageSummary(records,id);return <button key={id} data-initial-stage={id} aria-pressed={stage===id} disabled={!ready} onClick={()=>{if(!state.current.started&&id!==stage){sound.current?.ui('move');onStage(id);}}}><strong>{STAGES[id].name}</strong><small>{STAGES[id].subtitle}</small>{summary.clears>0&&<b className="rank-badge" data-rank={summary.rank??'clear'} aria-label={summary.rank?'最高評価 '+summary.rank:'踏破済み'}>{summary.rank??'済'}</b>}</button>;})}
          </div>
          <div className="stage-detail" aria-live="polite">
            <small>{STAGES[stage].subtitle}</small><h2>{STAGES[stage].name}</h2>
            <p>{STAGES[stage].description}</p><p className="stage-challenge">{STAGES[stage].challenge}</p>
            <dl className="stage-records">{PLAY_MODES.map(m=>{const r=records[recordKey(stage,m.id)];return <div key={m.id}><dt>{m.name}</dt><dd>{r?<>{r.bestRank&&<b className="rank-badge" data-rank={r.bestRank}>{r.bestRank}</b>}{r.bestTime!=null?formatRunTime(r.bestTime):''}<small>{r.clears}回</small></>:<span className="unplayed">未踏破</span>}</dd></div>;})}</dl>
            <small className="stage-notes"><ScrollText size={13} aria-hidden="true"/>手記 {stageNotes.filter(n=>archive.includes(n.id)).length} / {stageNotes.length}</small>
          </div>
        </div>
        <div className="mode-choices">{PLAY_MODES.map(m=><button key={m.id} data-mode={m.id} disabled={!ready} onClick={()=>beginGame(m.id)}><small>{m.label}</small><strong>{m.name}</strong><span>{m.detail}</span><b aria-hidden="true">→</b></button>)}</div>
        <p className="start-help">{ready?'ステージとモードを選択 · 方向キー / × で決定 · ○ で戻る':'回廊を準備しています…'}<br/>{'描画品質：'+QUALITY_LABELS[prefs.quality]} · 開始後に一時停止メニューで変更できます</p>
      </div>}
    </section>}
    <Dialog open={menu} onOpenChange={setMenuOpen}>
      {menu&&<DialogContent ref={dialog} className="settings-dialog" onPointerDownCapture={e=>{if(e.pointerType==='touch'||e.pointerType==='pen')touchMode(e);}} showCloseButton={false} finalFocus={false}>
        <header className="settings-heading"><div><span className="eyebrow">YŪKYŌ · 一時停止</span><DialogTitle>{STAGES[stage].name}<span>{modeName}</span></DialogTitle></div><button className="close-button" aria-label="探索に戻る" onClick={()=>setMenuOpen(false)}><X size={20}/></button></header>
        <DialogDescription className="sr-only">探索状況と手記、視点・画質・音響・操作の設定。閉じると探索を再開します。</DialogDescription>
        <Tabs value={menuTab} onValueChange={v=>{setMenuTab(String(v));setReading(null);setConfirming(null);}}><TabsList className="settings-tabs"><TabsTrigger value="status">探索</TabsTrigger><TabsTrigger value="notes">手記</TabsTrigger><TabsTrigger value="view">視点</TabsTrigger><TabsTrigger value="graphics">画質</TabsTrigger><TabsTrigger value="audio">音響</TabsTrigger><TabsTrigger value="controls">操作</TabsTrigger></TabsList>
          <TabsContent value="status" className="settings-panel status-panel">
            <div className="status-objective" data-step={goalLine.step}><small>目的</small><strong>{goalLine.title}</strong><span>{goalLine.detail}</span></div>
            <dl className="status-stats"><div><dt>探索時間</dt><dd>{formatRunTime(run.elapsed)}</dd></div><div><dt>復活</dt><dd>{run.deaths}</dd></div><div><dt>追跡回避</dt><dd>{run.escapes}</dd></div><div><dt>手記</dt><dd>{notes.found.length}/{notes.total}</dd></div></dl>{playMode!=='gallery'&&<dl className="status-stats"><div><dt>今宵の刻</dt><dd>{night.name}</dd></div><div><dt>鐘を凌いだ</dt><dd>{run.hunts}</dd></div><div><dt>眠る影</dt><dd>{night.sleeping}</dd></div><div><dt>兆し</dt><dd>{omens.ids.length?omens.names.join('・'):'平穏'}</dd></div></dl>}
            <div className="menu-actions"><button className="menu-action primary" onClick={()=>setMenuOpen(false)}>探索に戻る<span aria-hidden="true">→</span></button><button className="menu-action" data-confirming={confirming==='restart'} onClick={restart}>{confirming==='restart'?'もう一度押すと、新しい配置で最初から':'最初からやり直す'}</button><button className="menu-action" data-confirming={confirming==='title'} onClick={leaveToTitle}>{confirming==='title'?'もう一度押すと、タイトルへ戻る':'タイトルへ戻る'}</button></div>
            <p className="setting-note">やり直すと勾玉・奉納・探索時間は失われます。拾った手記は記録帳に残ります。</p>
          </TabsContent>
          <TabsContent value="notes" className="settings-panel notes-panel">
            {reading?<NoteReader id={reading} onClose={()=>setReading(null)}/>:<ul className="note-list">{stageNotes.map(n=>{const open=notes.found.includes(n.id)||archive.includes(n.id);return <li key={n.id}><button disabled={!open} onClick={()=>{setReading(n.id);sound.current?.ui('open');}}><ScrollText size={16} aria-hidden="true"/><strong>{open?n.title:'？？？'}</strong><small>{open?n.author:'未発見の手記'}</small></button></li>;})}</ul>}
            <p className="setting-note">各ステージに手記が三つ。浮かぶ巻物に近づくと拾えます。拾った手記はタイトル画面の「記録帳」でいつでも読めます。</p>
          </TabsContent>
          <TabsContent value="view" className="settings-panel"><div className="settings-grid">
            {range('stickSensitivity','Rスティック感度',.25,3,.05,'×')}{range('touchSensitivity','タッチ視点感度',.25,3,.05,'×')}
            {range('mouseSensitivity','マウス感度',.25,3,.05,'×')}{range('fov','視野角',55,95,1,'°')}
            <label className="switch-row">上下の視点を反転<Switch aria-label="上下の視点を反転" checked={prefs.invertY} onCheckedChange={v=>change('invertY',v)}/></label>
            <label className="switch-row">歩行時の揺れ<Switch aria-label="歩行時の揺れ" checked={prefs.motion} onCheckedChange={v=>change('motion',v)}/></label>
          </div></TabsContent>
          <TabsContent value="graphics" className="settings-panel"><div className="setting"><label>描画品質</label><RadioGroup value={prefs.quality} onValueChange={v=>change('quality',v as string)} className="quality-options" aria-label="描画品質">{Object.entries(QUALITY_LABELS).map(([value,label])=><label key={value} className="quality-option"><RadioGroupItem value={value}/>{label}</label>)}</RadioGroup></div>
            {range('brightness','明るさ',.7,1.8,.05,'×')}
            <label className="switch-row">フィルムグレイン<Switch aria-label="フィルムグレイン" checked={prefs.grain} onCheckedChange={v=>change('grain',v)}/></label>
            <p className="setting-note">スマートフォンは、質感を簡素化した「低」で起動します。画質はここで変更できます。最高画質では2Kの表面素材、緻密な陰影と水面反射を使用します。負荷に応じて描画解像度を自動調整します。フィルムグレインは「低」では表示されません。</p>
          </TabsContent>
          <TabsContent value="audio" className="settings-panel"><div className="settings-grid">
            {range('masterVolume','全体音量',0,1,.05,'%',true)}{range('ambienceVolume','環境音',0,1,.05,'%',true)}{range('effectsVolume','効果音・心音',0,1,.05,'%',true)}
          </div><p className="setting-note">環境音・足音・心音・効果音はすべてブラウザ内で合成しています。心音は画面下の警戒度と連動します。敵は足音を立てません。耳ではなく、灯りと視線で気配を探ってください。</p></TabsContent>
          <TabsContent value="controls" className="settings-panel controls-panel">
            <div className="connection"><Gamepad2 size={17}/><span>{connected?'コントローラー接続中':'接続後、コントローラーのボタンを押してください'}</span></div>
            <label className="switch-row stamina-option">スタミナを使用<Switch aria-label="スタミナを使用" checked={prefs.stamina||modeAids(playMode).staminaForced} disabled={modeAids(playMode).staminaForced} onCheckedChange={v=>change('stamina',v)}/></label><p className="setting-note">オン：連続ダッシュは約8秒。歩行・停止で回復します。使い切ったら、ダッシュを解除するか立ち止まると回復後に再開できます。オフ：ダッシュ制限なし。悪夢では常にオンです。</p><p className="rules-note">青6個・赤2個・金1個のいずれかを揃えて祭壇へ。揃うと鐘が三つ鳴って通常の敵が消え、「憎悪」か「憤怒」1体の追跡が始まり、鏡を2つと御札を1枚入手します。奉納後は祭壇の輪の中で8秒耐える封門の儀が待ちます。通常の敵は灯りと走る足音に気づき、暗がりでも近くで動けば気配を悟ります。しゃがむと、灯りを点けていても見つかる距離が短くなります。最終追跡では消灯や距離で振り切れません。憎悪は追うほど加速し、進路を先読みします。憤怒は身をかがめてから突進し、その後に立て直しの隙が生まれます。バーストで9秒、時間停止で10秒の猶予を作れます。立ち止まれば忘れられます。鐘の余韻が聞こえたら、その場を離れてください。鐘が鳴ると影があなたのいた場所に集まり、眠っていた影が目覚め、青い回廊も安全ではなくなります。祭壇への奉納は捕まっても残り、鐘を遠ざけます。</p><dl className="control-guide"><div><dt>L / R スティック</dt><dd>移動 / 視点</dd></div><div><dt>L1 / R1</dt><dd>ダッシュ / ライト</dd></div><div><dt>〇 / R2</dt><dd>ふすま・奉納・仕掛け / 前方120°バースト</dd></div><div><dt>□ / V</dt><dd>拾った鏡で12秒間の透視</dd></div><div><dt>L2 / T</dt><dd>10秒間の時間停止</dd></div><div><dt>△・R3 / C</dt><dd>しゃがむ・立ち上がる</dd></div><div><dt>タッチパッド・↑ / R</dt><dd>選んだ道具を使う（鈴を投げる・御札を置く）</dd></div><div><dt>L3・←→ / 1・2</dt><dd>道具の持ち替え</dd></div><div><dt>Options / P</dt><dd>一時停止メニュー</dd></div><div><dt>WASD / Shift / F</dt><dd>移動 / ダッシュ / ライト</dd></div><div><dt>E / Q</dt><dd>ふすま・奉納・仕掛け / バースト</dd></div></dl>
            <p className="setting-note">メニュー内：方向キーで選択・調整、×で決定、○で戻る。<br/>タッチは左右のパッドで移動・視点、足跡ボタンでダッシュ、二重山形でしゃがむ。<br/>カーソルを固定するには、画面右上の固定ボタンをクリック。Escで解除。</p>
            {calStep>=0?<div className="calibration"><span>{['Lスティックを右へ','Lスティックを下へ','Rスティックを右へ','Rスティックを下へ','L1ボタンを押す'][Math.min(calStep,4)]}</span><small>操作ごとにスティック・ボタンを離してください。</small><button className="text-button" onClick={()=>{calibration.current=null;setCalStep(-1);}}>中止</button></div>:<button className="text-button" disabled={!connected} onClick={()=>{const p=lastPad.current;if(p){calibration.current=new PadCalibration(mappingKey(p),p);setCalStep(0);}}}>スティックが反応しない場合：手動調整</button>}
          </TabsContent>
        </Tabs>
        <footer className="settings-footer"><button className="text-button" onClick={()=>applyPreferences({...DEFAULTS})}><RotateCcw size={13}/>初期設定</button><button className="resume-button" onClick={()=>setMenuOpen(false)}>探索に戻る<span>→</span></button></footer>
      </DialogContent>}
    </Dialog>
  </main>;
}
