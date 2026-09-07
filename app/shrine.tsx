'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Maximize,Settings,Footprints,Move,Scan,Focus,Flashlight,FlashlightOff,X,RotateCcw,Gamepad2,DoorOpen,Sparkles,Clock3} from 'lucide-react';
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

import {PLAY_MODES,type PlayMode} from './play-mode';
import {TouchActionGate} from './touch-action';
import {ENEMY_NAMES,type FinaleKind} from './enemy-traits';
import {STAGES,canTransitionStage,type StageId} from './stage-profile';
import {focusMenu,type MenuDirection} from './menu-focus';
const pollPads=()=>{try{return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p);}catch{return [];}};
const clampPitch=(p:number)=>Math.max(-1.3,Math.min(1.3,p));
type ModelTool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
export default function Shrine(){
  const [session,setSession]=useState<{stage:StageId;run:number}>({stage:'shrine',run:0});
  const retained=useRef<Preferences|null>(null);
  const selectStage=useCallback((stage:StageId)=>setSession(old=>({stage,run:old.run+1})),[]);
  return <ShrineSession key={session.stage+':'+session.run} stage={session.stage} retained={retained} onStage={selectStage}/>;
}
function ShrineSession({stage,retained,onStage}:{stage:StageId;retained:{current:Preferences|null};onStage:(stage:StageId)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDivElement>(null),startPanel=useRef<HTMLDivElement>(null),clearPanel=useRef<HTMLElement>(null);
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
  const [enemyMarkers,setEnemyMarkers]=useState<{id:number;angle:number;distance:number;stunned:boolean;level:'above'|'below'|'same';chasing:boolean}[]>([]);
  const [lockRequired,setLockRequired]=useState(false);
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
  useEffect(()=>{if(ready&&!started)startPanel.current?.querySelector<HTMLButtonElement>('[data-initial-stage][aria-pressed=true]')?.focus({preventScroll:true});},[ready]);
  const [mechanismNear,setMechanismNear]=useState(''),[circusHint,setCircusHint]=useState('');
  const [doorNear,setDoorNear]=useState(false),[burstPulse,setBurstPulse]=useState(0),[caughtPulse,setCaughtPulse]=useState(0);
  const clearInput=useCallback(()=>{keys.current.clear();touch.current.clear();burstInput.current.clear();setTouchSprint(false);setStickPosition({x:0,z:0});},[]);
  const applyPreferences=useCallback((next:Preferences)=>{const v=sanitizePreferences(next);prefRef.current=v;retained.current=v;setPrefs(v);try{localStorage.setItem('yukyo-preferences-v1',JSON.stringify(v));}catch{};worldRef.current?.configure(v);return v;},[retained]);
  const setMenuOpen=useCallback((open:boolean)=>{
    if(!state.current.started)return;state.current.paused=open;setMenu(open);clearInput();
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
  },[clearInput,requestLock]);
  const beginGame=useCallback((mode:PlayMode)=>{if(!worldRef.current||state.current.started)return;worldRef.current.setMode(mode);setPlayMode(mode);state.current.started=true;setStarted(true);setMenuOpen(false);},[setMenuOpen]);
  const useMirror=useCallback(()=>{if(state.current.paused)return;const w=worldRef.current;if(w?.playMode==='gallery')return;if(w?.useMirror())setNotice('鏡を使用 · 12秒間、敵の姿が映ります');else setNotice(w?.mirrorStatus().remaining?'鏡はすでに敵を映しています':'鏡をまだ持っていません');},[]);
  const setFlashlight=useCallback((on:boolean)=>{state.current.light=on;setLight(on);if(worldRef.current)worldRef.current.flashlight.visible=on;return {enabled:on};},[]);
  const toggleLight=useCallback(()=>setFlashlight(!state.current.light),[setFlashlight]);
  const burst=useCallback(()=>{if(state.current.paused||!worldRef.current||worldRef.current.playMode==='gallery')return;burstInput.current.request(performance.now());},[]);
  const stopTime=useCallback(()=>{const world=worldRef.current;if(state.current.paused||!world||world.playMode==='gallery')return;if(world.stopTime()){setStopRemaining(10);setStopCooldown(30);setNotice('時間停止 · 10秒間、敵が動かなくなります');}else setNotice('時間停止の再使用まで '+Math.ceil(world.timeStopCooldown)+'秒');},[]);
  const interact=useCallback(()=>{if(state.current.paused)return;const opened=worldRef.current?.interact();if(opened&&typeof opened==='object')setNotice(opened.message);else if(opened==='offered')setNotice(worldRef.current?.collection().unlocked?'奉納が完了しました。祭壇の奥の扉へ進んでください。':'勾玉を祭壇に捧げました。');else if(opened==='empty')setNotice(worldRef.current?.collection().unlocked?'祭壇の奥の扉が開いています。':'青勾玉6個、赤勾玉2個、または金勾玉1個を捧げると扉が開きます。');else if(!opened)setNotice('祭壇・ふすま・仕掛けに近づいて、そちらを向いて〇を押してください。');},[]);
  useLayoutEffect(()=>{
    document.documentElement.dataset.shrinePlaying=String(started&&!menu&&!won);
    document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(!started||menu||won));
    if(!started||menu||won)document.documentElement.style.removeProperty('cursor');else document.documentElement.style.setProperty('cursor','none','important');
  },[started,menu,won]);
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
    try{world=createWorld(canvas.current!,undefined,undefined,stage);world.configure(restored);worldRef.current=world;}catch{setError('3D表示を開始できませんでした。WebGL対応のChromeまたはSafariで開いてください。');return;}
    setReady(true);let frame=0,last=performance.now(),lastHud=0,lastPickupCount=0,lastEscapes=0,oldMode='touch',controllerBlocked=false,lastStartNav=0,lastPhase=0;
    const loaded=new Set<string>(),edges=new ButtonEdges();
    edges.update(session.current.poll(pollPads()).pad);
    const down=(e:KeyboardEvent)=>{
      if(!state.current.started){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();const choices=Array.from(startPanel.current?.querySelectorAll<HTMLButtonElement>('button[data-initial-stage],button[data-mode]')??[]);focusMenu(choices,e.code.slice(5).toLowerCase() as MenuDirection);}return;}if(world.completed){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();const choices=Array.from(clearPanel.current?.querySelectorAll<HTMLButtonElement>('button')??[]),index=choices.indexOf(document.activeElement as HTMLButtonElement),direction=e.code==='ArrowUp'||e.code==='ArrowLeft'?-1:1;choices[(Math.max(0,index)+direction+choices.length)%choices.length]?.focus();}return;}
      if(e.code==='Escape'){if(state.current.paused)setMenuOpen(false);return;}
      if(state.current.paused)return;
      if(session.current.mode==='gamepad'){e.preventDefault();e.stopPropagation();return;}
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
      if(e.code==='KeyF'&&!e.repeat)toggleLight();
      if(e.code==='KeyE'&&!e.repeat)interact();
      if(e.code==='KeyQ'&&!e.repeat)burst();
      if(e.code==='KeyT'&&!e.repeat)stopTime();
      if(e.code==='KeyV'&&!e.repeat)useMirror();
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
      if(buttons.back){setMenuOpen(false);return;}
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[role="slider"],[role="switch"],[role="radio"],[role="tab"]')??[]).filter(e=>e.getClientRects().length&&!e.hasAttribute('disabled'));
      const unique=[...new Set(items)];let index=unique.indexOf(document.activeElement as HTMLElement);
      if(buttons.up||buttons.down){index=(index+(buttons.up?-1:1)+unique.length)%unique.length;unique[index]?.focus({preventScroll:true});unique[index]?.scrollIntoView({block:'nearest'});}
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
        const choices=Array.from(startPanel.current?.querySelectorAll<HTMLButtonElement>('button[data-initial-stage],button[data-mode]')??[]);let selected=choices.indexOf(document.activeElement as HTMLButtonElement);
        const x=poll.input.move.x,z=poll.input.move.z;
        const direction:MenuDirection|null=buttons.down?'down':buttons.up?'up':buttons.left?'left':buttons.right?'right':time-lastStartNav>230&&Math.max(Math.abs(x),Math.abs(z))>.5?(Math.abs(x)>Math.abs(z)?x>0?'right':'left':z>0?'down':'up'):null;
        if(direction){selected=focusMenu(choices,direction);lastStartNav=time;}
        if(buttons.confirm)choices[Math.max(0,selected)]?.click();
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
          if(world.step(steps.dt)){setCaughtPulse(v=>v+1);setNotice("別の場所で目覚めました。勾玉と奉納は失われました。");clearInput();s.yaw=0;s.pitch=0;break;}
          if(world.completed)break;
          firePending();
        }
        if(world.completed){setRun(world.runStatus());s.paused=true;clearInput();setWon(true);setLockRequired(false);document.exitPointerLock?.();}
        const fov=p.fov+(p.motion&&actualSprint&&moving?4:0);
        if(Math.abs(world.camera.fov-fov)>.02){world.camera.fov+=(fov-world.camera.fov)*Math.min(1,dt*8);world.camera.updateProjectionMatrix();}
      }
      if(time-lastHud>150||world.phaseRevision!==lastPhase){const status=world.runStatus();setRun(status);setMirrorStatus(world.mirrorStatus());setStairHint(world.stairHint());setStamina(world.staminaStatus());if(world.phaseRevision!==lastPhase&&world.finale){setNotice(ENEMY_NAMES[world.finale]+'が出現。鏡を2つ入手。'+(world.collection().unlocked?'祭壇の奥の扉へ。':'祭壇に奉納し、奥の扉へ。'));lastPickupCount=status.pickups;}else if(status.pickups>lastPickupCount&&world.playMode!=='gallery'){setNotice(({blue:'青勾玉',red:'赤勾玉',gold:'金の大勾玉'} as const)[status.lastPickup??'blue']+'を取得 · 祭壇の赤い針へ');lastPickupCount=status.pickups;}else if(status.escapes>lastEscapes)setNotice('追跡を振り切りました');lastEscapes=status.escapes;setConnected(!!poll.pad);setMechanismNear(world.mechanismNear());setCircusHint(world.circusHint());setDoorNear(world.nearDoor());setAltarNear(world.nearAltar());setEnemyMarkers(world.enemyDirections());setBurstRemaining(Math.ceil(world.burstCooldown));setStopRemaining(Math.ceil(world.timeStopRemaining));setStopCooldown(Math.ceil(world.timeStopCooldown));const found=world.collection();setCollection(old=>old.gold===found.gold&&old.areaName===found.areaName&&old.blue===found.blue&&old.red===found.red&&old.blueOffered===found.blueOffered&&old.redOffered===found.redOffered&&old.unlocked===found.unlocked&&old.finale===found.finale&&old.area===found.area?old:found);setGoalBearing(world.goalDirection());lastHud=time;lastPhase=world.phaseRevision;}
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
  },[clearInput,setMenuOpen,toggleLight,applyPreferences,burst,stopTime,interact,requestLock,useMirror,stage,retained]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:ModelTool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools:ModelTool[]=[
      {name:'configure_shrine_view',description:'Change device-local view sensitivity, field of view, brightness and graphics settings. Does not move the visitor.',inputSchema:{type:'object',properties:{stickSensitivity:{type:'number',minimum:.25,maximum:3},touchSensitivity:{type:'number',minimum:.25,maximum:3},mouseSensitivity:{type:'number',minimum:.25,maximum:3},fov:{type:'number',minimum:55,maximum:95},brightness:{type:'number',minimum:.7,maximum:1.8},quality:{enum:['low','medium','high','ultra']},invertY:{type:'boolean'},motion:{type:'boolean'},stamina:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings object required');const candidate={...prefRef.current,...input};const checked=sanitizePreferences(candidate);for(const [k,v] of Object.entries(input)){if(!(k in DEFAULTS)||checked[k as keyof Preferences]!==v)throw new Error('Invalid setting: '+k);}return applyPreferences(checked);}},
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
  const range=(key:RangeKey,label:string,min:number,max:number,step:number,suffix:string)=><div className="setting" data-setting={key}><label id={'label-'+key}>{label}<output aria-live="polite">{prefs[key].toFixed(key==='fov'?0:2)}{suffix}</output></label><div className="range-controls"><button type="button" aria-label={label+'を下げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,-1))}>−</button><Slider aria-labelledby={'label-'+key} min={min} max={max} step={step} value={[prefs[key]]} onValueChange={v=>change(key,Array.isArray(v)?v[0]:v)}/><button type="button" aria-label={label+'を上げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,1))}>＋</button></div></div>;
  const blockControllerClick=(e:React.SyntheticEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&document.pointerLockElement===document.documentElement){e.preventDefault();e.stopPropagation();}};
  const threatLabel={quiet:'探索中',hidden:'消灯・忍び足',search:'近くを捜索中',chase:'追跡されています',frozen:'時間停止中',stunned:'敵はスタン中'}[run.state];
  return <main {...pointerEvents('look')} className="experience" data-playing={started&&!menu&&!won} onContextMenu={e=>e.preventDefault()} onClickCapture={blockControllerClick} onPointerDownCapture={blockControllerClick}>
    <canvas ref={canvas} tabIndex={-1} inputMode="none" aria-label={STAGES[stage].name+"の一人称回廊"} onPointerDown={e=>{lastPointerType.current=e.pointerType;if(e.pointerType==='mouse'&&session.current.mode==='gamepad'){void requestLock();return;}touchMode(e);}} onClick={e=>{if(e.detail===2&&lastPointerType.current==='mouse'&&session.current.mode!=='gamepad')void requestLock();}}/>
    <div className="vignette"/><div className="threat-veil" data-active={started&&!menu&&!won&&run.state==='chase'} aria-hidden="true"/>{!menu&&<div className="enemy-compass" aria-hidden="true">{enemyMarkers.map(e=><span key={e.id} className="enemy-bearing" data-chasing={e.chasing} style={{left:(50+Math.sin(e.angle)*43)+'%',top:(50-Math.cos(e.angle)*39)+'%',transform:'translate(-50%,-50%)',color:e.stunned?'#b8ffff':(e.id===4?'#ff201e':['#ff386a','#5fffe0','#bb78ff','#ffbc40'][e.id%4]),opacity:Math.max(.4,1-e.distance/160)}}><i style={{transform:'rotate('+e.angle+'rad)'}}>⌃</i>{e.level!=='same'&&<small>{e.level==='above'?'上階':'下階'}</small>}</span>)}</div>}<div className="reticle" aria-hidden="true"/>
    {burstPulse>0&&<div key={'burst'+burstPulse} className="burst-pulse" aria-hidden="true"/>}
    {stopRemaining>0&&started&&!menu&&!won&&<div className="time-stop-veil" aria-hidden="true"/>}
    {caughtPulse>0&&<div key={'caught'+caughtPulse} className="caught-pulse" aria-hidden="true"/>}

    <nav className="toolbar" hidden={!started||won} aria-label="操作メニュー" onPointerDownCapture={e=>{if(session.current.mode==='gamepad'){session.current.poll(pollPads());if(!session.current.allowsMenuPointer()){e.preventDefault();e.stopPropagation();}}}}>
      <button aria-label="DualSenseで操作を開始してカーソルを固定" aria-pressed={pad} className={pad?'active':''} onClick={activateController}><Gamepad2 size={20}/></button>
      <button aria-label={light?'フラッシュライトを消す':'フラッシュライトを点ける'} aria-pressed={light} {...action('light',toggleLight)} className={light?'active':''}>{light?<Flashlight size={19}/>:<FlashlightOff size={19}/>}</button>
      <button aria-label="マウスカーソルを固定" aria-pressed={locked} onClick={()=>void requestLock()} className={locked?'active':''}><Focus size={18}/></button>
      <button aria-label="全画面を切替" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setNotice('このブラウザでは全画面切替を利用できません。');}catch{setNotice('全画面表示を開始できませんでした。');}}}><Maximize size={18}/></button>
      <button aria-label="設定と操作ガイド" onClick={()=>setMenuOpen(true)}><Settings size={19}/></button>
    </nav>
    {ready&&started&&!menu&&!won&&<><div className="collection-status">{playMode!=='gallery'&&<><div role="status" aria-live="polite"><span className="blue-bead">◕ 青 {collection.blue}</span>　<span className="red-bead">◕ 赤 {collection.red}</span>　<span style={{color:"#edc765"}}>◕ 金 {collection.gold}</span></div><small>{collection.unlocked?'奉納完了 · 祭壇の奥の扉へ':`奉納：青 ${collection.blueOffered}/6 または 赤 ${collection.redOffered}/2・金1`}</small><small>鏡 {mirrorStatus.count} {mirrorStatus.remaining>0?`· 透視 ${Math.ceil(mirrorStatus.remaining)}秒`:pad?'· □ で使用':''}</small></>}<small className={collection.area==='red'?'red-bead':'blue-bead'}>{stage!=='shrine'?STAGES[stage].name+' · ':''}{collection.areaName}</small></div><div className="altar-compass" role="img" aria-label={`赤い針は祭壇の方向。距離${Math.round(goalBearing.distance)}メートル`}><div className="compass-dial"><i style={{transform:'rotate('+goalBearing.angle+'rad)'}}/><b/></div><span>祭壇 {Math.round(goalBearing.distance)}m</span></div></>}
    {ready&&started&&!menu&&!won&&<aside className="play-state" data-threat={run.state} aria-label="探索状況">{(doorNear||altarNear||mechanismNear)&&started&&!menu&&!won&&<button className="door-action" aria-label={mechanismNear||(altarNear?'〇：勾玉を祭壇に捧げる':'〇：ふすまを開閉')} {...action('interact',interact)}>{altarNear?<Sparkles size={20}/>:<DoorOpen size={20}/>}<span>{mechanismNear||(altarNear?'〇 捧げる':'〇')}</span></button>}<span>{playMode==='gallery'?'ギャラリー · 安全な散策':(collection.finale?ENEMY_NAMES[collection.finale]+' · ':'')+threatLabel}</span>{circusHint&&<small className="circus-hint">{circusHint}</small>}{stairHint&&<strong className="stair-hint">{stairHint}</strong>}{playMode!=='gallery'&&<div className="pressure-row"><small>警戒</small><div className="pressure-meter" role="meter" aria-label="現在の追跡と警戒" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(run.pressure*100)}><i style={{width:run.pressure*100+'%'}}/></div><small>{formatRunTime(run.elapsed)}</small></div>}{stamina.enabled&&<div className="stamina-status" data-exhausted={stamina.exhausted}><small>{stamina.exhausted?'息切れ · ダッシュ解除か停止':'スタミナ'}</small><div role="meter" aria-label="スタミナ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stamina.value*100)}><i style={{width:stamina.value*100+'%'}}/></div></div>}{pad&&playMode!=='gallery'&&<div className="ability-readout"><span>R2 {burstRemaining>0?burstRemaining+'秒':'バースト'}</span><span>L2 {stopRemaining>0?'停止 '+stopRemaining+'秒':stopCooldown>0?stopCooldown+'秒':'時間停止'}</span></div>}</aside>}
    {won&&<section ref={clearPanel} className="clear-screen" role="dialog" aria-modal="true" aria-labelledby="clear-title"><span aria-hidden="true">◕</span><h1 id="clear-title">封印解除</h1><p>{STAGES[stage].name}の封門を越えました。次の境界へ。</p><strong>CLEAR</strong><dl className="run-results"><div><dt>探索時間</dt><dd>{formatRunTime(run.elapsed)}</dd></div><div><dt>復活回数</dt><dd>{run.deaths}</dd></div><div><dt>追跡回避</dt><dd>{run.escapes}</dd></div><div><dt>スタン成功</dt><dd>{run.stuns}</dd></div><div><dt>時間停止</dt><dd>{run.freezes}</dd></div><div><dt>勾玉取得</dt><dd>{run.pickups}</dd></div></dl>{<div className="stage-choices">{(Object.keys(STAGES) as StageId[]).filter(id=>id!==stage).map((id,i)=><button key={id} autoFocus={i===0} data-stage={id} onClick={()=>advanceStage(id)}><em>{STAGES[id].subtitle}</em><b>{STAGES[id].name}</b><span>{STAGES[id].description}</span><small>{STAGES[id].challenge}</small></button>)}</div>}<button className="replay-stage" onClick={()=>advanceStage(stage)}>同じステージを再生成</button><small>タッチで選択 · 方向キーで選択 / × で決定</small></section>}
    {!ready&&!error&&<div className="loading"><span/>灯りをともしています</div>}
    {error&&<div className="notice" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>再読み込み</button></div>}
    {lockRequired&&pad&&started&&!menu&&!won&&<div className="lock-gate"><button className="lock-resume" onClick={requestLock}>クリックしてカーソルを固定・再開</button><p>固定が完了するまで探索を一時停止しています</p></div>}
    {notice&&<div className="toast" role="status">{notice}</div>}
    <div className="touch-controls" hidden={!started||pad||menu||won}>
      <div className="touch-pad" role="group" aria-label="移動タッチパッド" {...pointerEvents('move')}><span className="thumb" style={{transform:'translate('+stickPosition.x*32+'px,'+stickPosition.z*32+'px)'}}><Move size={22}/></span></div>
      <div className="touch-right"><div className="touch-actions">{playMode!=='gallery'&&<><button className="sprint" aria-label="鏡を使う" disabled={mirrorStatus.count===0||mirrorStatus.remaining>0} {...action('mirror',useMirror)}><span className="mirror-icon"/><small className="burst-timer">{mirrorStatus.count}</small></button><button className="sprint" aria-label={stopCooldown?`時間停止の再使用まで ${stopCooldown}秒`:'時間停止：10秒間'} disabled={stopCooldown>0} {...action('freeze',stopTime)}><Clock3 size={22}/>{stopCooldown>0&&<small className="burst-timer">{stopRemaining||stopCooldown}</small>}</button><button className="sprint" aria-label={burstRemaining?`バースト再使用まで ${burstRemaining}秒`:'バースト：前方120°の敵を9秒スタン'} disabled={burstRemaining>0} {...action('burst',burst)}><Sparkles size={23}/>{burstRemaining>0&&<small className="burst-timer">{burstRemaining}</small>}</button></>}<button className="sprint" aria-label={touchSprint?'ダッシュをオフ':'ダッシュをオン'} aria-pressed={touchSprint} {...action('sprint',()=>setTouchSprint(touch.current.toggleSprint()))}><Footprints size={24}/></button></div><div className="touch-pad look-pad" role="group" aria-label="視点タッチパッド" {...pointerEvents('look')}><Scan size={24}/></div></div>
    </div>
    {!started&&!error&&<section className="start-screen" aria-labelledby="start-title" ref={startPanel}>
      <div className="start-heading"><span>YŪKYŌ</span><h1 id="start-title">幽境</h1></div>
      <div className="initial-stages" role="group" aria-label="ステージを選ぶ">
        {(Object.keys(STAGES) as StageId[]).map(id=><button key={id} data-initial-stage={id} aria-pressed={stage===id} disabled={!ready} onClick={()=>{if(!state.current.started&&id!==stage)onStage(id);}}><strong>{STAGES[id].name}</strong><small>{STAGES[id].subtitle}</small></button>)}
      </div>
      <p className="stage-start-description">{STAGES[stage].description}</p>
      <div className="mode-choices">{PLAY_MODES.map((m,i)=><button key={m.id} data-mode={m.id} disabled={!ready} autoFocus={i===0} onClick={()=>beginGame(m.id)}><small>{m.label}</small><strong>{m.name}</strong><span>{m.detail}</span><b aria-hidden="true">→</b></button>)}</div>
      <p className="start-help">{ready?'ステージとモードを選択 · 方向キー / × で決定':'回廊を準備しています…'}<br/>{'描画品質：'+QUALITY_LABELS[prefs.quality]} · 開始後に設定で変更できます</p>
    </section>}
    <Dialog open={menu} onOpenChange={setMenuOpen}>
      {menu&&<DialogContent ref={dialog} className="settings-dialog" onPointerDownCapture={e=>{if(e.pointerType==='touch'||e.pointerType==='pen')touchMode(e);}} showCloseButton={false} finalFocus={false}>
        <header className="settings-heading"><div><span className="eyebrow">YŪKYŌ</span><DialogTitle>幽境<span>祭殿回廊</span></DialogTitle></div><button className="close-button" aria-label="回廊に戻る" onClick={()=>setMenuOpen(false)}><X size={20}/></button></header>
        <DialogDescription className="sr-only">視点と画質の設定。設定を閉じると探索を再開します。</DialogDescription>
        <Tabs defaultValue="view"><TabsList className="settings-tabs"><TabsTrigger value="view">視点</TabsTrigger><TabsTrigger value="graphics">画質</TabsTrigger><TabsTrigger value="controls">操作</TabsTrigger></TabsList>
          <TabsContent value="view" className="settings-panel"><div className="settings-grid">
            {range('stickSensitivity','Rスティック感度',.25,3,.05,'×')}{range('touchSensitivity','タッチ視点感度',.25,3,.05,'×')}
            {range('mouseSensitivity','マウス感度',.25,3,.05,'×')}{range('fov','視野角',55,95,1,'°')}
            <label className="switch-row">上下の視点を反転<Switch aria-label="上下の視点を反転" checked={prefs.invertY} onCheckedChange={v=>change('invertY',v)}/></label>
            <label className="switch-row">歩行時の揺れ<Switch aria-label="歩行時の揺れ" checked={prefs.motion} onCheckedChange={v=>change('motion',v)}/></label>
          </div></TabsContent>
          <TabsContent value="graphics" className="settings-panel"><div className="setting"><label>描画品質</label><RadioGroup value={prefs.quality} onValueChange={v=>change('quality',v as string)} className="quality-options" aria-label="描画品質">{Object.entries(QUALITY_LABELS).map(([value,label])=><label key={value} className="quality-option"><RadioGroupItem value={value}/>{label}</label>)}</RadioGroup></div>
            {range('brightness','明るさ',.7,1.8,.05,'×')}
            <p className="setting-note">スマートフォンは、質感を簡素化した「低」で起動します。画質はここで変更できます。最高画質では2Kの表面素材、緻密な陰影と水面反射を使用します。負荷に応じて描画解像度を自動調整します。</p>
          </TabsContent>
          <TabsContent value="controls" className="settings-panel controls-panel">
            <div className="connection"><Gamepad2 size={17}/><span>{connected?'コントローラー接続中':'接続後、コントローラーのボタンを押してください'}</span></div>
            <label className="switch-row stamina-option">スタミナを使用<Switch aria-label="スタミナを使用" checked={prefs.stamina} onCheckedChange={v=>change('stamina',v)}/></label><p className="setting-note">オン：連続ダッシュは約8秒。歩行・停止で回復します。使い切ったら、ダッシュを解除するか立ち止まると回復後に再開できます。オフ：ダッシュ制限なし。</p><p className="rules-note">青6個・赤2個・金1個のいずれかを揃えて祭壇へ。揃うと通常の敵が消え、「憎悪」か「憤怒」1体の追跡が始まり、鏡を2つ入手します。通常の敵は消灯して歩くと気づきませんが、走る足音は届きます。最終追跡では消灯や距離で振り切れません。</p><dl className="control-guide"><div><dt>L / R スティック</dt><dd>移動 / 視点</dd></div><div><dt>L1 / R1</dt><dd>ダッシュ / ライト</dd></div><div><dt>〇 / R2</dt><dd>ふすま・奉納・仕掛け / 前方120°バースト</dd></div><div><dt>□ / V</dt><dd>拾った鏡で12秒間の透視</dd></div><div><dt>L2 / T</dt><dd>10秒間の時間停止</dd></div><div><dt>Options</dt><dd>設定を開く・閉じる</dd></div><div><dt>WASD / Shift / F</dt><dd>移動 / ダッシュ / ライト</dd></div><div><dt>E / Q</dt><dd>ふすま・奉納・仕掛け / バースト</dd></div></dl>
            <p className="setting-note">設定内：方向キーで選択・調整、×で決定、○で戻る。<br/>タッチは左右のパッドで移動・視点、足跡ボタンでダッシュ。<br/>カーソルを固定するには、画面右上の固定ボタンをクリック。Escで解除。</p>
            {calStep>=0?<div className="calibration"><span>{['Lスティックを右へ','Lスティックを下へ','Rスティックを右へ','Rスティックを下へ','L1ボタンを押す'][Math.min(calStep,4)]}</span><small>操作ごとにスティック・ボタンを離してください。</small><button className="text-button" onClick={()=>{calibration.current=null;setCalStep(-1);}}>中止</button></div>:<button className="text-button" disabled={!connected} onClick={()=>{const p=lastPad.current;if(p){calibration.current=new PadCalibration(mappingKey(p),p);setCalStep(0);}}}>スティックが反応しない場合：手動調整</button>}
          </TabsContent>
        </Tabs>
        <footer className="settings-footer"><button className="text-button" onClick={()=>applyPreferences({...DEFAULTS})}><RotateCcw size={13}/>初期設定</button><button className="resume-button" onClick={()=>setMenuOpen(false)}>回廊に戻る<span>→</span></button></footer>
      </DialogContent>}
    </Dialog>
  </main>;
}







