'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Maximize,Settings,Footprints,Move,Scan,Focus,Flashlight,FlashlightOff,X,RotateCcw,Gamepad2,DoorOpen,Sparkles} from 'lucide-react';
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

const pollPads=()=>{try{return Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p);}catch{return [];}};
const clampPitch=(p:number)=>Math.max(-1.3,Math.min(1.3,p));
type ModelTool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
export default function Shrine(){
  const canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDivElement>(null);
  const session=useRef(new GamepadSession()),touch=useRef(new TouchInput()),keys=useRef(new Set<string>());
  const worldRef=useRef<ReturnType<typeof createWorld>|null>(null);
  const state=useRef({yaw:0,pitch:0,light:true,paused:false});
  const calibration=useRef<PadCalibration|null>(null),lastPad=useRef<Pad|null>(null);
  const prefRef=useRef<Preferences>(DEFAULTS);
  const [prefs,setPrefs]=useState<Preferences>(DEFAULTS),[pad,setPad]=useState(false),[connected,setConnected]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[menu,setMenu]=useState(false),[light,setLight]=useState(true),[locked,setLocked]=useState(false);
  const [calStep,setCalStep]=useState(-1),[notice,setNotice]=useState('');
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
  const [doorNear,setDoorNear]=useState(false),[burstPulse,setBurstPulse]=useState(0),[caughtPulse,setCaughtPulse]=useState(0);
  const clearInput=useCallback(()=>{keys.current.clear();touch.current.clear();setStickPosition({x:0,z:0});},[]);
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
  const burst=useCallback(()=>{if(state.current.paused)return;worldRef.current?.burst();setBurstPulse(v=>v+1);},[]);
  const interact=useCallback(()=>{if(state.current.paused)return;const opened=worldRef.current?.interact();if(!opened)setNotice('開閉できるふすまに近づいて、そちらを向いて〇を押してください。');},[]);
  useLayoutEffect(()=>{
    document.documentElement.dataset.shrinePlaying=String(!menu);
    document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(menu));
    if(menu)document.documentElement.style.removeProperty('cursor');else document.documentElement.style.setProperty('cursor','none','important');
  },[menu]);
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
    setReady(true);let frame=0,last=performance.now(),lastHud=0,oldMode='touch',controllerBlocked=false;
    const loaded=new Set<string>(),edges=new ButtonEdges();
    const down=(e:KeyboardEvent)=>{
      if(e.code==='Escape'){if(state.current.paused)setMenuOpen(false);return;}
      if(state.current.paused)return;
      if(session.current.mode==='gamepad'){e.preventDefault();e.stopPropagation();return;}
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
      if(e.code==='KeyF'&&!e.repeat)toggleLight();
      if(e.code==='KeyE'&&!e.repeat)interact();
      if(e.code==='KeyQ'&&!e.repeat)burst();
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
    const hidden=()=>{if(document.hidden)clearInput();};
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
      const dt=Math.min((time-last)/1000,.05);last=time;
      const pads=pollPads();
      for(const p of pads){const k=mappingKey(p);if(loaded.has(k))continue;loaded.add(k);try{const m=JSON.parse(localStorage.getItem('yukyo-pad:'+k)??'null');if(validMapping(m,p))session.current.setMapping(p,m);}catch{}}
      const poll=session.current.poll(pads);lastPad.current=poll.pad;
      if(poll.mode!==oldMode){if(poll.mode==='gamepad'){clearInput();if(!state.current.paused){(document.activeElement as HTMLElement|null)?.blur?.();canvas.current?.focus({preventScroll:true});}}oldMode=poll.mode;if(poll.mode==='gamepad')requestLock();setPad(poll.mode==='gamepad');}
      const focused=!document.hidden&&document.hasFocus();
      const buttons=edges.update(poll.pad);
      const wasPaused=state.current.paused;
      if(focused&&buttons.menu&&!calibration.current)setMenuOpen(!state.current.paused);
      if(focused&&state.current.paused&&!calibration.current)menuNavigation(buttons);
      const canExplore=allowExploration(poll.mode,state.current.paused,focused,document.pointerLockElement===document.documentElement);
      const blocked=poll.mode==='gamepad'&&!state.current.paused&&!canExplore;
      if(blocked!==controllerBlocked){controllerBlocked=blocked;clearInput();setLockRequired(blocked);}
      if(canExplore&&buttons.flashlight)toggleLight();
      if(canExplore&&!wasPaused&&buttons.interact)interact();
      if(canExplore&&!wasPaused&&buttons.burst)burst();
      if(calibration.current&&poll.pad){
        if(mappingKey(poll.pad)!==calibration.current.padKey){calibration.current=null;setCalStep(-1);setNotice('接続が変わりました。もう一度調整を開始してください。');}
        else {const mapping=calibration.current.update(poll.pad);setCalStep(calibration.current.step);
          if(mapping){session.current.setMapping(poll.pad,mapping);try{localStorage.setItem('yukyo-pad:'+mappingKey(poll.pad),JSON.stringify(mapping));}catch{};calibration.current=null;setCalStep(-1);setNotice('スティックとL1の調整を保存しました。');}
        }
      } else if(calibration.current&&!poll.pad){calibration.current=null;setCalStep(-1);setNotice('コントローラーの接続が切れました。');}
      if(time-lastHud>150){setConnected(!!poll.pad);setDoorNear(world.nearDoor());setEnemyMarkers(world.enemyDirections());lastHud=time;}
      const s=state.current,p=prefRef.current;
      if(canExplore){
        const k=keys.current,t=touch.current,game=poll.mode==='gamepad';
        const x=game?poll.input.move.x:t.x+Number(k.has('KeyD'))-Number(k.has('KeyA'));
        const z=game?poll.input.move.z:t.z+Number(k.has('KeyS'))-Number(k.has('KeyW'));
        const sprint=game?poll.input.sprint:t.sprint||k.has('ShiftLeft')||k.has('ShiftRight');
        const delta=viewDelta('gamepad',poll.input.look.x,poll.input.look.z,dt,prefRef.current);
        s.yaw+=delta.yaw-(!game?(Number(k.has('ArrowRight'))-Number(k.has('ArrowLeft')))*1.4*p.stickSensitivity*dt:0);
        s.pitch=clampPitch(s.pitch+delta.pitch-(!game?(Number(k.has('ArrowDown'))-Number(k.has('ArrowUp')))*1.2*p.stickSensitivity*dt*(p.invertY?-1:1):0));
        const pos=world.move(x,z,s.yaw,sprint,dt);
        const moving=Math.hypot(pos.x-world.camera.position.x,pos.z-world.camera.position.z)>.0001;
        world.camera.position.set(pos.x,pos.y+(p.motion&&moving?Math.sin(time*(sprint?.016:.01))*(sprint?.03:.018):0),pos.z);
        world.camera.rotation.set(s.pitch,s.yaw,0);
        if(world.step(dt)){setCaughtPulse(v=>v+1);clearInput();s.yaw=0;s.pitch=0;}
        const fov=p.fov+(p.motion&&sprint&&moving?4:0);
        if(Math.abs(world.camera.fov-fov)>.02){world.camera.fov+=(fov-world.camera.fov)*Math.min(1,dt*8);world.camera.updateProjectionMatrix();}
      }
      // A held stick never restores cursor/touch UI, even if emulated pointer events arrive.
      document.documentElement.classList.toggle('controller-cursor-hidden',hidePlayCursor(s.paused));
      if(!document.hidden)world.render(time);
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up);window.addEventListener('blur',clearInput);
    window.addEventListener('gamepadconnected',gamepadConnected);document.addEventListener('focusin',focusGuard);
    document.addEventListener('mousemove',mouse);document.addEventListener('pointerlockchange',lockChanged);document.addEventListener('pointerlockerror',lockError);
    document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',world.resize);
    document.addEventListener('wheel',wheel,{passive:false});document.addEventListener('touchmove',touchMove,{passive:false});
    const lost=(e:Event)=>{e.preventDefault();setError('3D描画が中断されました。ページを再読み込みしてください。');clearInput();};
    canvas.current?.addEventListener('webglcontextlost',lost);const element=canvas.current;
    return()=>{cancelAnimationFrame(frame);worldRef.current=null;world.dispose();window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearInput);window.removeEventListener('gamepadconnected',gamepadConnected);document.removeEventListener('focusin',focusGuard);document.removeEventListener('mousemove',mouse);document.removeEventListener('pointerlockchange',lockChanged);document.removeEventListener('pointerlockerror',lockError);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',world.resize);document.removeEventListener('wheel',wheel);document.removeEventListener('touchmove',touchMove);element?.removeEventListener('webglcontextlost',lost);document.documentElement.classList.remove('controller-cursor-hidden');delete document.documentElement.dataset.shrinePlaying;document.documentElement.style.removeProperty('cursor');};
  },[clearInput,setMenuOpen,toggleLight,applyPreferences,burst,interact,requestLock]);
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
    onPointerDown:(e:React.PointerEvent<HTMLElement>)=>{if(state.current.paused||!touchMode(e))return;e.preventDefault();if(touch.current.start(e.pointerId,kind,e.clientX,e.clientY))e.currentTarget.setPointerCapture(e.pointerId);},
    onPointerMove:(e:React.PointerEvent<HTMLElement>)=>{if(session.current.mode==='gamepad'||state.current.paused)return;const d=touch.current.move(e.pointerId,e.clientX,e.clientY);const delta=viewDelta('touch',d.yaw,d.pitch,0,prefRef.current);state.current.yaw+=delta.yaw;state.current.pitch=clampPitch(state.current.pitch+delta.pitch);if(kind==='move')setStickPosition({x:touch.current.x,z:touch.current.z});},
    onPointerUp:(e:React.PointerEvent<HTMLElement>)=>{touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
    onPointerCancel:(e:React.PointerEvent<HTMLElement>)=>{touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
    onLostPointerCapture:(e:React.PointerEvent<HTMLElement>)=>{touch.current.end(e.pointerId);if(kind==='move')setStickPosition({x:0,z:0});},
  });
  const change=(key:keyof Preferences,value:number|boolean|string)=>applyPreferences({...prefRef.current,[key]:value});
  const range=(key:RangeKey,label:string,min:number,max:number,step:number,suffix:string)=><div className="setting" data-setting={key}><label id={'label-'+key}>{label}<output aria-live="polite">{prefs[key].toFixed(key==='fov'?0:2)}{suffix}</output></label><div className="range-controls"><button type="button" aria-label={label+'を下げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,-1))}>−</button><Slider aria-labelledby={'label-'+key} min={min} max={max} step={step} value={[prefs[key]]} onValueChange={v=>change(key,Array.isArray(v)?v[0]:v)}/><button type="button" aria-label={label+'を上げる'} onClick={()=>applyPreferences(adjustRange(prefRef.current,key,1))}>＋</button></div></div>;
  const blockControllerClick=(e:React.SyntheticEvent)=>{if(session.current.mode==='gamepad'&&!state.current.paused&&document.pointerLockElement===document.documentElement){e.preventDefault();e.stopPropagation();}};
  return <main className="experience" data-playing={!menu} onContextMenu={e=>e.preventDefault()} onClickCapture={blockControllerClick} onPointerDownCapture={blockControllerClick}>
    <canvas ref={canvas} tabIndex={-1} inputMode="none" aria-label="祭殿の一人称回廊" onPointerDown={e=>{if(e.pointerType==='mouse'&&session.current.mode==='gamepad'){void requestLock();return;}touchMode(e);}} onClick={e=>{if(e.detail===2&&session.current.mode!=='gamepad')void requestLock();}}/>
    <div className="vignette"/>{!menu&&<div className="enemy-compass" aria-hidden="true">{enemyMarkers.map(e=><span key={e.id} className="enemy-bearing" style={{left:(50+Math.sin(e.angle)*43)+'%',top:(50-Math.cos(e.angle)*39)+'%',transform:'translate(-50%,-50%) rotate('+e.angle+'rad)',color:e.stunned?'#b8ffff':(e.id===4?'#ff201e':['#ff386a','#5fffe0','#bb78ff','#ffbc40'][e.id%4]),opacity:Math.max(.4,1-e.distance/160)}}>⌃</span>)}</div>}<div className="reticle" aria-hidden="true"/>
    {burstPulse>0&&<div key={'burst'+burstPulse} className="burst-pulse" aria-hidden="true"/>}
    {caughtPulse>0&&<div key={'caught'+caughtPulse} className="caught-pulse" aria-hidden="true"/>}
    {doorNear&&!menu&&<button className="door-action" aria-label="〇：ふすまを開閉" onClick={interact}><DoorOpen size={20}/><span>〇</span></button>}
    <nav className="toolbar" aria-label="操作メニュー" onPointerDownCapture={e=>{if(session.current.mode==='gamepad'){session.current.poll(pollPads());if(!session.current.allowsMenuPointer()){e.preventDefault();e.stopPropagation();}}}}>
      <button aria-label="DualSenseで操作を開始してカーソルを固定" aria-pressed={pad} className={pad?'active':''} onClick={activateController}><Gamepad2 size={20}/></button>
      <button aria-label={light?'フラッシュライトを消す':'フラッシュライトを点ける'} aria-pressed={light} onClick={toggleLight} className={light?'active':''}>{light?<Flashlight size={19}/>:<FlashlightOff size={19}/>}</button>
      <button aria-label="マウスカーソルを固定" aria-pressed={locked} onClick={()=>void requestLock()} className={locked?'active':''}><Focus size={18}/></button>
      <button aria-label="全画面を切替" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setNotice('このブラウザでは全画面切替を利用できません。');}catch{setNotice('全画面表示を開始できませんでした。');}}}><Maximize size={18}/></button>
      <button aria-label="設定と操作ガイド" onClick={()=>setMenuOpen(true)}><Settings size={19}/></button>
    </nav>
    {!ready&&!error&&<div className="loading"><span/>灯りをともしています</div>}
    {error&&<div className="notice" role="alert">{error}<button className="text-button" onClick={()=>location.reload()}>再読み込み</button></div>}
    {lockRequired&&!menu&&<div className="lock-gate"><button className="lock-resume" onClick={requestLock}>クリックしてカーソルを固定・再開</button><p>固定が完了するまで探索を一時停止しています</p></div>}
    {notice&&<div className="toast" role="status">{notice}</div>}
    <div className="touch-controls" hidden={pad||menu}>
      <div className="touch-pad" role="group" aria-label="移動タッチパッド" {...pointerEvents('move')}><span className="thumb" style={{transform:'translate('+stickPosition.x*32+'px,'+stickPosition.z*32+'px)'}}><Move size={22}/></span></div>
      <div className="touch-right"><div className="touch-actions"><button className="sprint" aria-label="バースト：近くの敵を9秒スタン" onClick={burst}><Sparkles size={23}/></button><button className="sprint" aria-label="押している間ダッシュ" {...pointerEvents('sprint')}><Footprints size={24}/></button></div><div className="touch-pad look-pad" role="group" aria-label="視点タッチパッド" {...pointerEvents('look')}><Scan size={24}/></div></div>
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
            <p className="setting-note">高画質では解像度とライトの影を精細に。<br/>動作が重い場合は「軽量」を選んでください。</p>
          </TabsContent>
          <TabsContent value="controls" className="settings-panel controls-panel">
            <div className="connection"><Gamepad2 size={17}/><span>{connected?'コントローラー接続中':'接続後、コントローラーのボタンを押してください'}</span></div>
            <dl className="control-guide"><div><dt>L / R スティック</dt><dd>移動 / 視点</dd></div><div><dt>L1 / R1</dt><dd>ダッシュ / ライト</dd></div><div><dt>〇 / R2</dt><dd>ふすま開閉 / 9秒スタン</dd></div><div><dt>Options</dt><dd>設定を開く・閉じる</dd></div><div><dt>WASD / Shift / F</dt><dd>移動 / ダッシュ / ライト</dd></div><div><dt>E / Q</dt><dd>ふすま開閉 / バースト</dd></div></dl>
            <p className="setting-note">設定内：方向キーで選択・調整、×で決定、○で戻る。<br/>タッチは左右のパッドで移動・視点、足跡ボタンでダッシュ。<br/>カーソルを固定するには、画面右上の固定ボタンをクリック。Escで解除。</p>
            {calStep>=0?<div className="calibration"><span>{['Lスティックを右へ','Lスティックを下へ','Rスティックを右へ','Rスティックを下へ','L1ボタンを押す'][Math.min(calStep,4)]}</span><small>操作ごとにスティック・ボタンを離してください。</small><button className="text-button" onClick={()=>{calibration.current=null;setCalStep(-1);}}>中止</button></div>:<button className="text-button" disabled={!connected} onClick={()=>{const p=lastPad.current;if(p){calibration.current=new PadCalibration(mappingKey(p),p);setCalStep(0);}}}>スティックが反応しない場合：手動調整</button>}
          </TabsContent>
        </Tabs>
        <footer className="settings-footer"><button className="text-button" onClick={()=>applyPreferences({...DEFAULTS})}><RotateCcw size={13}/>初期設定</button><button className="resume-button" onClick={()=>setMenuOpen(false)}>回廊に戻る<span>→</span></button></footer>
      </DialogContent>}
    </Dialog>
  </main>;
}







