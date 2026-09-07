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
import {ButtonEdges,TouchInput,allowMouseLook,allowExploration} from './input-actions';
import {DEFAULTS,sanitizePreferences,type Preferences} from './preferences';
import {adjustRange,viewDelta,hidePlayCursor,type RangeKey} from './view-controls';
import {BurstInput} from './burst-input';
import {RunProgress,formatRunTime} from './run-progress';
import {simulationSteps} from './performance-budget';

const pollPads=()=>{try{return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p);}catch{return [];}};
const clampPitch=(p:number)=>Math.max(-1.3,Math.min(1.3,p));
type ModelTool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
export default function Shrine(){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDivElement>(null);
  const session=useRef(new GamepadSession()),touch=useRef(new TouchInput()),keys=useRef(new Set<string>());
  const worldRef=useRef<ReturnType<typeof createWorld>|null>(null);
  const burstInput=useRef(new BurstInput());
  const state=useRef({yaw:0,pitch:0,light:true,paused:false});
  const calibration=useRef<PadCalibration|null>(null),lastPad=useRef<Pad|null>(null);
  const prefRef=useRef<Preferences>(DEFAULTS);
  const [prefs,setPrefs]=useState<Preferences>(DEFAULTS),[pad,setPad]=useState(false),[connected,setConnected]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[menu,setMenu]=useState(false),[light,setLight]=useState(true),[locked,setLocked]=useState(false);
  const [calStep,setCalStep]=useState(-1),[notice,setNotice]=useState('');
  const [collection,setCollection]=useState({blue:0,red:0,gold:0,areaName:"祭殿回廊",blueOffered:0,redOffered:0,unlocked:false,area:'blue' as 'blue'|'red'});
  const [run,setRun]=useState(()=>new RunProgress().snapshot());
  const [altarNear,setAltarNear]=useState(false);
  const [won,setWon]=useState(false),[goalBearing,setGoalBearing]=useState({angle:0,distance:0});
  const [burstRemaining,setBurstRemaining]=useState(0);
  const [stopRemaining,setStopRemaining]=useState(0),[stopCooldown,setStopCooldown]=useState(0);
  const [enemyMarkers,setEnemyMarkers]=useState<{id:number;angle:number;distance:number;stunned:boolean}[]>([]);
  const [lockRequired,setLockRequired]=useState(false);
  const lockPending=useRef(false);
  const requestLock=useCallback(()=>{
    if(state.current.paused||lockPending.current||document.pointerLockElement===document.documentElement)return;
    if(!document.documentElement.requestPointerLock){setLockRequired(true);setNotice('このブラウザではカーソルを固定できません。固定対応のデスクトップ版ブラウザで開いてください。');return;}
    lockPending.current=true;
    const failed=()=>{lockPending.current=false;if(!state.current.paused)setLockRequired(true);};
    try{const result=document.documentElement.requestPointerLock();if(result)void result.catch(failed);}catch{failed();}
  },[]);
  const [stickPosition,setStickPosition]=useState({x:0,z:0});
  const [touchSprint,setTouchSprint]=useState(false);
  const [doorNear,setDoorNear]=useState(false),[burstPulse,setBurstPulse]=useState(0),[caughtPulse,setCaughtPulse]=useState(0);
  const clearInput=useCallback(()=>{keys.current.clear();touch.current.clear();burstInput.current.clear();setTouchSprint(false);setStickPosition({x:0,z:0});},[]);
  const applyPreferences=useCallback((next:Preferences)=>{const v=sanitizePreferences(next);prefRef.current=v;setPrefs(v);try{localStorage.setItem('yukyo-preferences-v1',JSON.stringify(v));}catch{};worldRef.current?.configure(v);return v;},[]);
  const setMenuOpen=useCallback((open:boolean)=>{
    state.current.paused=open;setMenu(open);clearInput();
    document.documentElement.dataset.shrinePlaying=String(!open);
    if(open){setLockRequired(false);document.exitPointerLock?.();document.documentElement.classList.remove('controller-cursor-hidden');document.documentElement.style.removeProperty('cursor');}
    else{
      calibration.current=null;setCalStep(-1);
      document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(false));
      document.documentElement.style.setProperty('cursor','none','important');
      requestLock();
      requestAnimationFrame(()=>{if(!state.current.paused){canvas.current?.focus({preventScroll:true});requestLock();}});
    }
  },[clearInput,requestLock]);
  const setFlashlight=useCallback((on:boolean)=>{state.current.light=on;setLight(on);if(worldRef.current)worldRef.current.flashlight.visible=on;return {enabled:on};},[]);
  const toggleLight=useCallback(()=>setFlashlight(!state.current.light),[setFlashlight]);
  const burst=useCallback(()=>{if(state.current.paused||!worldRef.current)return;burstInput.current.request(performance.now());},[]);
  const stopTime=useCallback(()=>{const world=worldRef.current;if(state.current.paused||!world)return;if(world.stopTime()){setStopRemaining(10);setStopCooldown(30);setNotice('時間停止 · 10秒間、敵が動かなくなります');}else setNotice('時間停止の再使用まで '+Math.ceil(world.timeStopCooldown)+'秒');},[]);
  const interact=useCallback(()=>{if(state.current.paused)return;const opened=worldRef.current?.interact();if(opened==='offered')setNotice(worldRef.current?.collection().unlocked?'奉納が完了しました。祭壇の奥の扉へ進んでください。':'青勾玉を祭壇に捧げました。');else if(opened==='empty')setNotice(worldRef.current?.collection().unlocked?'祭壇の奥の扉が開いています。':'青勾玉5個、または赤・金勾玉1個を捧げると扉が開きます。');else if(!opened)setNotice('祭壇かふすまに近づいて、そちらを向いて〇を押してください。');},[]);
  useLayoutEffect(()=>{
    document.documentElement.dataset.shrinePlaying=String(!menu&&!won);
    document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(menu||won));
    if(menu||won)document.documentElement.style.removeProperty('cursor');else document.documentElement.style.setProperty('cursor','none','important');
  },[menu,won]);
  const touchMode=useCallback((e:React.PointerEvent)=>{
    session.current.poll(pollPads());
    if(!session.current.useTouch()){e.preventDefault();e.stopPropagation();return false;}
    setPad(false);return true;
  },[]);
  const activateController=useCallback(()=>{
    const current=session.current.poll(pollPads());
    if(current.pad){session.current.mode='gamepad';setPad(true);clearInput();canvas.current?.focus({preventScroll:true});void requestLock();}
    else{setNotice('DualSenseを接続し、×ボタンを押してからもう一度選んでください。');canvas.current?.focus({preventScroll:true});}
  },[clearInput,requestLock]);
  useEffect(()=>{
    let restored=DEFAULTS;try{restored=sanitizePreferences(JSON.parse(localStorage.getItem('yukyo-preferences-v1')??'null'));}catch{}
    prefRef.current=restored;setPrefs(restored);
    let world:ReturnType<typeof createWorld>;
    try{world=createWorld(canvas.current!);world.configure(restored);worldRef.current=world;}catch{setError('3D表示を開始できませんでした。WebGL対応のChromeまたはSafariで開いてください。');return;}
    setReady(true);let frame=0,last=performance.now(),lastHud=0,lastPickupCount=0,lastEscapes=0,oldMode='touch',controllerBlocked=false;
    const loaded=new Set<string>(),edges=new ButtonEdges();
    const down=(e:KeyboardEvent)=>{
      if(world.completed)return;
      if(e.code==='Escape'){if(state.current.paused)setMenuOpen(false);return;}
      if(state.current.paused)return;
      if(session.current.mode==='gamepad'){e.preventDefault();e.stopPropagation();return;}
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
      if(e.code==='KeyF'&&!e.repeat)toggleLight();
      if(e.code==='KeyE'&&!e.repeat)interact();
      if(e.code==='KeyQ'&&!e.repeat)burst();
      if(e.code==='KeyT'&&!e.repeat)stopTime();
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
    const lockChanged=()=>{lockPending.current=false;const active=document.pointerLockElement===document.documentElement;setLocked(active);if(active){setLockRequired(false);if(state.current.paused)document.exitPointerLock?.();}else if(!state.current.paused&&session.current.mode==='gamepad'){setLockRequired(true);}document.documentElement.dataset.shrinePlaying=String(!state.current.paused);if(!state.current.paused)document.documentElement.style.setProperty('cursor','none','important');};
    const lockError=()=>{lockPending.current=false;if(!state.current.paused)setLockRequired(true);};
    const focusGuard=(e:FocusEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&e.target instanceof HTMLElement&&e.target.matches('input,textarea,[contenteditable=true]')&&!dialog.current?.contains(e.target)){e.target.blur();canvas.current?.focus({preventScroll:true});}};
    const gamepadConnected=()=>{const p=session.current.poll(pollPads());if(p.pad){session.current.mode='gamepad';clearInput();setPad(true);setConnected(true);if(!state.current.paused)canvas.current?.focus({preventScroll:true});}};
    const hidden=()=>{last=performance.now();if(document.hidden)clearInput();};
    const wheel=(e:WheelEvent)=>e.preventDefault();
    const touchMove=(e:TouchEvent)=>{if(!state.current.paused)e.preventDefault();};
    const menuNavigation=(buttons:ReturnType<ButtonEdges['update']>)=>{
      if(buttons.back){setMenuOpen(false);return;}
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[role="slider"],[role="switch"],[role="radio"],[role="tab"]')??[]).filter(e=>e.getClientRects().length&&!e.hasAttribute('disabled'));
      const unique=[...new Set(items)];let index=unique.indexOf(document.activeElement as HTMLElement);
      if(buttons.up||buttons.down){index=(index+(buttons.up?-1:1)+unique.length)%unique.length;unique[index]?.focus({preventScroll:true});}
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
      if(poll.mode!==oldMode){if(poll.mode==='gamepad'){clearInput();if(!state.current.paused){(document.activeElement as HTMLElement|null)?.blur?.();canvas.current?.focus({preventScroll:true});}}oldMode=poll.mode;if(poll.mode==='gamepad')requestLock();setPad(poll.mode==='gamepad');}
      const focused=!document.hidden&&document.hasFocus();
      const buttons=edges.update(poll.pad);
      if(world.completed&&focused&&buttons.confirm)location.reload();
      const wasPaused=state.current.paused;
      if(focused&&buttons.menu&&!calibration.current&&!world.completed)setMenuOpen(!state.current.paused);
      if(focused&&state.current.paused&&!calibration.current&&!world.completed)menuNavigation(buttons);
      const canExplore=allowExploration(poll.mode,state.current.paused,focused,document.pointerLockElement===document.documentElement);
      const blocked=poll.mode==='gamepad'&&!state.current.paused&&!canExplore;
      if(blocked!==controllerBlocked){controllerBlocked=blocked;clearInput();setLockRequired(blocked);}
      if(canExplore&&buttons.flashlight)toggleLight();
      if(canExplore&&!wasPaused&&buttons.interact)interact();
      if(canExplore&&!wasPaused&&buttons.burst)burst();
      if(canExplore&&!wasPaused&&buttons.timeStop)stopTime();
      if(calibration.current&&poll.pad){
        if(mappingKey(poll.pad)!==calibration.current.padKey){calibration.current=null;setCalStep(-1);setNotice('接続が変わりました。もう一度調整を開始してください。');}
        else {const mapping=calibration.current.update(poll.pad);setCalStep(calibration.current.step);
          if(mapping){session.current.setMapping(poll.pad,mapping);try{localStorage.setItem('yukyo-pad:'+mappingKey(poll.pad),JSON.stringify(mapping));}catch{};calibration.current=null;setCalStep(-1);setNotice('スティックとL1の調整を保存しました。');}
        }
      } else if(calibration.current&&!poll.pad){calibration.current=null;setCalStep(-1);setNotice('コントローラーの接続が切れました。');}
      if(time-lastHud>150){const status=world.runStatus();setRun(status);if(status.pickups>lastPickupCount){setNotice(({blue:'青勾玉',red:'赤勾玉',gold:'金の大勾玉'} as const)[status.lastPickup??'blue']+'を取得 · 祭壇の赤い針へ');lastPickupCount=status.pickups;}else if(status.escapes>lastEscapes)setNotice('追跡を振り切りました');lastEscapes=status.escapes;setConnected(!!poll.pad);setDoorNear(world.nearDoor());setAltarNear(world.nearAltar());setEnemyMarkers(world.enemyDirections());setBurstRemaining(Math.ceil(world.burstCooldown));setStopRemaining(Math.ceil(world.timeStopRemaining));setStopCooldown(Math.ceil(world.timeStopCooldown));const found=world.collection();setCollection(old=>old.gold===found.gold&&old.areaName===found.areaName&&old.blue===found.blue&&old.red===found.red&&old.blueOffered===found.blueOffered&&old.redOffered===found.redOffered&&old.unlocked===found.unlocked&&old.area===found.area?old:found);setGoalBearing(world.goalDirection());lastHud=time;}
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
        const steps=simulationSteps(dt);let moving=false;
        for(let i=0;i<steps.count;i++){
          const pos=world.move(x,z,s.yaw,sprint,steps.dt);
          moving=Math.hypot(pos.x-world.camera.position.x,pos.z-world.camera.position.z)>.0001;
          world.camera.position.set(pos.x,pos.y+(p.motion&&moving?Math.sin(time*(sprint?.016:.01))*(sprint?.03:.018):0),pos.z);
          if(world.step(steps.dt)){setCaughtPulse(v=>v+1);setNotice("別の場所で目覚めました。勾玉と奉納は失われました。");clearInput();s.yaw=0;s.pitch=0;break;}
          if(world.completed)break;
          firePending();
        }
        if(world.completed){setRun(world.runStatus());s.paused=true;clearInput();setWon(true);setLockRequired(false);document.exitPointerLock?.();}
        const fov=p.fov+(p.motion&&sprint&&moving?4:0);
        if(Math.abs(world.camera.fov-fov)>.02){world.camera.fov+=(fov-world.camera.fov)*Math.min(1,dt*8);world.camera.updateProjectionMatrix();}
      }
      // A held stick never restores cursor/touch UI, even if emulated pointer events arrive.
      document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(s.paused));
      world.observeFrame(frameMs,canExplore);
      if(!document.hidden)world.render(time);
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up);window.addEventListener('blur',clearInput);window.addEventListener('focus',hidden);
    window.addEventListener('gamepadconnected',gamepadConnected);document.addEventListener('focusin',focusGuard);
    document.addEventListener('mousemove',mouse);document.addEventListener('pointerlockchange',lockChanged);document.addEventListener('pointerlockerror',lockError);
    document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',world.resize);
    document.addEventListener('wheel',wheel,{passive:false});document.addEventListener('touchmove',touchMove,{passive:false});
    const lost=(e:Event)=>{e.preventDefault();setError('3D描画が中断されました。ページを再読み込みしてください。');clearInput();};
    canvas.current?.addEventListener('webglcontextlost',lost);const element=canvas.current;
    return()=>{cancelAnimationFrame(frame);worldRef.current=null;world.dispose();window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearInput);window.removeEventListener('focus',hidden);window.removeEventListener('gamepadconnected',gamepadConnected);document.removeEventListener('focusin',focusGuard);document.removeEventListener('mousemove',mouse);document.removeEventListener('pointerlockchange',lockChanged);document.removeEventListener('pointerlockerror',lockError);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',world.resize);document.removeEventListener('wheel',wheel);document.removeEventListener('touchmove',touchMove);element?.removeEventListener('webglcontextlost',lost);document.documentElement.classList.remove('controller-cursor-hidden');delete document.documentElement.dataset.shrinePlaying;document.documentElement.style.removeProperty('cursor');};
  },[clearInput,setMenuOpen,toggleLight,applyPreferences,burst,stopTime,interact,requestLock]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:ModelTool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools:ModelTool[]=[
      {name:'configure_shrine_view',description:'Change device-local view sensitivity, field of view, brightness and graphics settings. Does not move the visitor.',inputSchema:{type:'object',properties:{stickSensitivity:{type:'number',minimum:.25,maximum:3},touchSensitivity:{type:'number',minimum:.25,maximum:3},mouseSensitivity:{type:'number',minimum:.25,maximum:3},fov:{type:'number',minimum:55,maximum:95},brightness:{type:'number',minimum:.7,maximum:1.8},quality:{enum:['low','medium','high']},invertY:{type:'boolean'},motion:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings object required');const candidate={...prefRef.current,...input};const checked=sanitizePreferences(candidate);for(const [k,v] of Object.entries(input)){if(!(k in DEFAULTS)||checked[k as keyof Preferences]!==v)throw new Error('Invalid setting: '+k);}return applyPreferences(checked);}},
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
  const change=(key:keyof Preferences,value:number|boolean|string)=>applyPreferences({...prefRef.current,[key]:value});
  const range=(key:RangeKey,label:string,min:number,max:number,step:number,suffix:string)=><div className="setting" data-setting={key}><label id={'label-'+key}>{label}<output aria-live="polite">{prefs[key].toFixed(key==='fov'?0:2)}{suffix}</output></label><div className="range-controls"><button type="button" aria-label={label+'を下げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,-1))}>−</button><Slider aria-labelledby={'label-'+key} min={min} max={max} step={step} value={[prefs[key]]} onValueChange={v=>change(key,Array.isArray(v)?v[0]:v)}/><button type="button" aria-label={label+'を上げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,1))}>＋</button></div></div>;
  const blockControllerClick=(e:React.SyntheticEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&document.pointerLockElement===document.documentElement){e.preventDefault();e.stopPropagation();}};
  const threatLabel={quiet:'探索中',hidden:'消灯・忍び足',search:'近くを捜索中',chase:'追跡されています',frozen:'時間停止中'}[run.state];
  return <main {...pointerEvents('look')} className="experience" data-playing={!menu&&!won} onContextMenu={e=>e.preventDefault()} onClickCapture={blockControllerClick} onPointerDownCapture={blockControllerClick}>
    <canvas ref={canvas} tabIndex={-1} inputMode="none" aria-label="祭殿の一人称回廊" onPointerDown={e=>{if(e.pointerType==='mouse'&&session.current.mode==='gamepad'){void requestLock();return;}touchMode(e);}} onClick={e=>{if(e.detail===2&&session.current.mode!=='gamepad')void requestLock();}}/>
    <div className="vignette"/><div className="threat-veil" data-active={!menu&&!won&&run.state==='chase'} aria-hidden="true"/>{!menu&&<div className="enemy-compass" aria-hidden="true">{enemyMarkers.map(e=><span key={e.id} className="enemy-bearing" style={{left:(50+Math.sin(e.angle)*43)+'%',top:(50-Math.cos(e.angle)*39)+'%',transform:'translate(-50%,-50%) rotate('+e.angle+'rad)',color:e.stunned?'#b8ffff':(e.id===4?'#ff201e':['#ff386a','#5fffe0','#bb78ff','#ffbc40'][e.id%4]),opacity:Math.max(.4,1-e.distance/160)}}>⌃</span>)}</div>}<div className="reticle" aria-hidden="true"/>
    {burstPulse>0&&<div key={'burst'+burstPulse} className="burst-pulse" aria-hidden="true"/>}
    {stopRemaining>0&&!menu&&!won&&<div className="time-stop-veil" aria-hidden="true"/>}
    {caughtPulse>0&&<div key={'caught'+caughtPulse} className="caught-pulse" aria-hidden="true"/>}
    {(doorNear||altarNear)&&!menu&&!won&&<button className="door-action" aria-label={altarNear?'〇：勾玉を祭壇に捧げる':'〇：ふすまを開閉'} onClick={interact}>{altarNear?<Sparkles size={20}/>:<DoorOpen size={20}/>}<span>〇{altarNear?' 捧げる':''}</span></button>}
    <nav className="toolbar" hidden={won} aria-label="操作メニュー" onPointerDownCapture={e=>{if(session.current.mode==='gamepad'){session.current.poll(pollPads());if(!session.current.allowsMenuPointer()){e.preventDefault();e.stopPropagation();}}}}>
      <button aria-label="DualSenseで操作を開始してカーソルを固定" aria-pressed={pad} className={pad?'active':''} onClick={activateController}><Gamepad2 size={20}/></button>
      <button aria-label={light?'フラッシュライトを消す':'フラッシュライトを点ける'} aria-pressed={light} onClick={toggleLight} className={light?'active':''}>{light?<Flashlight size={19}/>:<FlashlightOff size={19}/>}</button>
      <button aria-label="マウスカーソルを固定" aria-pressed={locked} onClick={()=>void requestLock()} className={locked?'active':''}><Focus size={18}/></button>
      <button aria-label="全画面を切替" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setNotice('このブラウザでは全画面切替を利用できません。');}catch{setNotice('全画面表示を開始できませんでした。');}}}><Maximize size={18}/></button>
      <button aria-label="設定と操作ガイド" onClick={()=>setMenuOpen(true)}><Settings size={19}/></button>
    </nav>
    {ready&&!menu&&!won&&<><div className="collection-status"><div role="status" aria-live="polite"><span className="blue-bead">◕ 青 {collection.blue}</span>　<span className="red-bead">◕ 赤 {collection.red}</span>　<span style={{color:"#edc765"}}>◕ 金 {collection.gold}</span></div><small>{collection.unlocked?'奉納完了 · 祭壇の奥の扉へ':`奉納：青 ${collection.blueOffered}/5 または 赤 ${collection.redOffered}/1・金1`}</small><small className={collection.area==='red'?'red-bead':'blue-bead'}>{collection.areaName}</small></div><div className="altar-compass" role="img" aria-label={`赤い針は祭壇の方向。距離${Math.round(goalBearing.distance)}メートル`}><div className="compass-dial"><i style={{transform:'rotate('+goalBearing.angle+'rad)'}}/><b/></div><span>祭壇 {Math.round(goalBearing.distance)}m</span></div></>}
    {ready&&!menu&&!won&&<aside className="play-state" data-threat={run.state} aria-label="探索状況"><span>{threatLabel}</span><div className="pressure-row"><small>警戒</small><div className="pressure-meter" role="meter" aria-label="勾玉による敵の警戒" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(run.pressure*100)}><i style={{width:run.pressure*100+'%'}}/></div><small>{formatRunTime(run.elapsed)}</small></div></aside>}
    {won&&<section className="clear-screen" role="dialog" aria-modal="true" aria-labelledby="clear-title"><span aria-hidden="true">◕</span><h1 id="clear-title">封印解除</h1><p>勾玉を揃え、封門を越えました。</p><strong>CLEAR</strong><dl className="run-results"><div><dt>探索時間</dt><dd>{formatRunTime(run.elapsed)}</dd></div><div><dt>復活回数</dt><dd>{run.deaths}</dd></div><div><dt>追跡回避</dt><dd>{run.escapes}</dd></div><div><dt>スタン成功</dt><dd>{run.stuns}</dd></div><div><dt>時間停止</dt><dd>{run.freezes}</dd></div><div><dt>勾玉取得</dt><dd>{run.pickups}</dd></div></dl><button autoFocus onClick={()=>location.reload()}>もう一度挑戦</button><small>コントローラーは × で再挑戦</small></section>}
    {pad&&burstRemaining>0&&!menu&&!won&&<div className="burst-cooldown">R2 再使用まで {burstRemaining}秒</div>}
    {ready&&!menu&&!won&&<div className={'time-stop-status'+(stopRemaining>0?' active':'')}><Clock3 size={15}/>{stopRemaining>0?`時間停止 ${stopRemaining}秒`:stopCooldown>0?`L2 再使用 ${stopCooldown}秒`:'L2 時間停止'}</div>}
    {!ready&&!error&&<div className="loading"><span/>灯りをともしています</div>}
    {error&&<div className="notice" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>再読み込み</button></div>}
    {lockRequired&&!menu&&<div className="lock-gate"><button className="lock-resume" onClick={requestLock}>クリックしてカーソルを固定・再開</button><p>固定が完了するまで探索を一時停止しています</p></div>}
    {notice&&<div className="toast" role="status">{notice}</div>}
    <div className="touch-controls" hidden={pad||menu||won}>
      <div className="touch-pad" role="group" aria-label="移動タッチパッド" {...pointerEvents('move')}><span className="thumb" style={{transform:'translate('+stickPosition.x*32+'px,'+stickPosition.z*32+'px)'}}><Move size={22}/></span></div>
      <div className="touch-right"><div className="touch-actions"><button className="sprint" aria-label={stopCooldown?`時間停止の再使用まで ${stopCooldown}秒`:'時間停止：10秒間'} disabled={stopCooldown>0} onClick={stopTime}><Clock3 size={22}/>{stopCooldown>0&&<small className="burst-timer">{stopRemaining||stopCooldown}</small>}</button><button className="sprint" aria-label={burstRemaining?`バースト再使用まで ${burstRemaining}秒`:'バースト：前方120°の敵を9秒スタン'} disabled={burstRemaining>0} onClick={burst}><Sparkles size={23}/>{burstRemaining>0&&<small className="burst-timer">{burstRemaining}</small>}</button><button className="sprint" aria-label={touchSprint?'ダッシュをオフ':'ダッシュをオン'} aria-pressed={touchSprint} onClick={()=>{session.current.poll(pollPads());if(!state.current.paused&&session.current.useTouch())setTouchSprint(touch.current.toggleSprint());}}><Footprints size={24}/></button></div><div className="touch-pad look-pad" role="group" aria-label="視点タッチパッド" {...pointerEvents('look')}><Scan size={24}/></div></div>
    </div>
    <Dialog open={menu} onOpenChange={setMenuOpen}>
      {menu&&<DialogContent ref={dialog} className="settings-dialog" showCloseButton={false} finalFocus={false}>
        <header className="settings-heading"><div><span className="eyebrow">YŪKYŌ</span><DialogTitle>幽境<span>祭殿回廊</span></DialogTitle></div><button className="close-button" aria-label="回廊に戻る" onClick={()=>setMenuOpen(false)}><X size={20}/></button></header>
        <DialogDescription className="sr-only">視点と画質の設定。設定を閉じると探索を再開します。</DialogDescription>
        <Tabs defaultValue="view"><TabsList className="settings-tabs"><TabsTrigger value="view">視点</TabsTrigger><TabsTrigger value="graphics">画質</TabsTrigger><TabsTrigger value="controls">操作</TabsTrigger></TabsList>
          <TabsContent value="view" className="settings-panel"><div className="settings-grid">
            {range('stickSensitivity','Rスティック感度',.25,3,.05,'×')}{range('touchSensitivity','タッチ視点感度',.25,3,.05,'×')}
            {range('mouseSensitivity','マウス感度',.25,3,.05,'×')}{range('fov','視野角',55,95,1,'°')}
            <label className="switch-row">上下の視点を反転<Switch aria-label="上下の視点を反転" checked={prefs.invertY} onCheckedChange={v=>change('invertY',v)}/></label>
            <label className="switch-row">歩行時の揺れ<Switch aria-label="歩行時の揺れ" checked={prefs.motion} onCheckedChange={v=>change('motion',v)}/></label>
          </div></TabsContent>
          <TabsContent value="graphics" className="settings-panel"><div className="setting"><label>描画品質</label><RadioGroup value={prefs.quality} onValueChange={v=>change('quality',v as string)} className="quality-options" aria-label="描画品質">{[['low','軽量'],['medium','標準'],['high','高画質']].map(([value,label])=><label key={value} className="quality-option"><RadioGroupItem value={value}/>{label}</label>)}</RadioGroup></div>
            {range('brightness','明るさ',.7,1.8,.05,'×')}
            <p className="setting-note">スマートフォンでは性能に合わせて画質と描画解像度を自動調整します。<br/>さらに負荷を抑える場合は「軽量」を選んでください。</p>
          </TabsContent>
          <TabsContent value="controls" className="settings-panel controls-panel">
            <div className="connection"><Gamepad2 size={17}/><span>{connected?'コントローラー接続中':'接続後、コントローラーのボタンを押してください'}</span></div>
            <p className="rules-note">青5個、または赤・金1個を祭壇へ。所持する勾玉が増えるほど敵の警戒が強まります。消灯して歩くと気づかれませんが、走る足音は届きます。</p><dl className="control-guide"><div><dt>L / R スティック</dt><dd>移動 / 視点</dd></div><div><dt>L1 / R1</dt><dd>ダッシュ / ライト</dd></div><div><dt>〇 / R2</dt><dd>ふすま・奉納 / 前方120°バースト</dd></div><div><dt>L2 / T</dt><dd>10秒間の時間停止</dd></div><div><dt>Options</dt><dd>設定を開く・閉じる</dd></div><div><dt>WASD / Shift / F</dt><dd>移動 / ダッシュ / ライト</dd></div><div><dt>E / Q</dt><dd>ふすま・奉納 / バースト</dd></div></dl>
            <p className="setting-note">設定内：方向キーで選択・調整、×で決定、○で戻る。<br/>タッチは左右のパッドで移動・視点、足跡ボタンでダッシュ。<br/>カーソルを固定するには、画面右上の固定ボタンをクリック。Escで解除。</p>
            {calStep>=0?<div className="calibration"><span>{['Lスティックを右へ','Lスティックを下へ','Rスティックを右へ','Rスティックを下へ','L1ボタンを押す'][Math.min(calStep,4)]}</span><small>操作ごとにスティック・ボタンを離してください。</small><button className="text-button" onClick={()=>{calibration.current=null;setCalStep(-1);}}>中止</button></div>:<button className="text-button" disabled={!connected} onClick={()=>{const p=lastPad.current;if(p){calibration.current=new PadCalibration(mappingKey(p),p);setCalStep(0);}}}>スティックが反応しない場合：手動調整</button>}
          </TabsContent>
        </Tabs>
        <footer className="settings-footer"><button className="text-button" onClick={()=>applyPreferences({...DEFAULTS})}><RotateCcw size={13}/>初期設定</button><button className="resume-button" onClick={()=>setMenuOpen(false)}>回廊に戻る<span>→</span></button></footer>
      </DialogContent>}
    </Dialog>
  </main>;
}







