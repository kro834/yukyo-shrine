import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {MirrorInventory} from '../app/mirror-inventory.ts';import {TouchActionGate} from '../app/touch-action.ts';import {TouchInput,ButtonEdges} from '../app/input-actions.ts';import {startupPreferences} from '../app/preferences.ts';import {PLAY_MODES,modeRules} from '../app/play-mode.ts';import {NEW_HORROR_AREAS} from '../app/horror-areas.ts';import {createLayout} from '../app/shrine-layout.ts';import {createWorld} from '../app/shrine-world.ts';import {Enemies} from '../app/shrine-gameplay.ts';import {DEFAULTS} from '../app/preferences.ts';
test('thirty unique new chambers retain old57, have multiple doors, remain within bounds and use distinct named themes',()=>{
 assert.equal(NEW_HORROR_AREAS.length,30);assert.equal(new Set(NEW_HORROR_AREAS.map(a=>a.name)).size,30);
 for(const seed of [1,17,71,99]){const l=createLayout(seed),newRooms=l.expansionAreas.filter(r=>r.themeId);assert.equal(newRooms.length,30);assert.equal(new Set(newRooms.map(r=>r.themeId)).size,30);assert.equal(l.expansionAreas.filter(r=>!r.themeId).length,57);assert.ok(l.cells.filter(c=>c.kind==='yokocho').length>=260);for(const r of newRooms){assert.ok(l.doors.filter(d=>d.room===r.id||d.rooms?.includes(r.id)).length>=2);assert.ok(!l.rooms.some(o=>o!==r&&r.x1<=o.x2&&r.x2>=o.x1&&r.z1<=o.z2&&r.z2>=o.z1));}}
});
test('touch actions work while move and look fingers stay captured; long release cannot toggle twice',()=>{
 const t=new TouchInput(),gate=new TouchActionGate();t.start(11,'move',0,0);t.move(11,0,-42);t.start(22,'look',0,0);
 assert.equal(gate.down('sprint','touch',0),true);t.toggleSprint();assert.equal(t.z,-1);assert.equal(t.sprint,true);assert.equal(t.pointers.size,2);
 gate.end('sprint','touch',2500);assert.equal(gate.click('sprint',1,2501),false);assert.equal(gate.click('sprint',0,2510),true);assert.equal(gate.down('light','touch',3000),true);assert.equal(t.z,-1);assert.equal(t.pointers.size,2);assert.equal(gate.down('light','mouse',3100),false);gate.end('light','mouse',3900);assert.equal(gate.click('light',1,3900),true);
});
test('a collected mirror consumes exactly once, reveals for12 seconds and never collects through walls or floors',()=>{
 const item={id:'one',position:{x:0,z:0},floor:0,collected:false},m=new MirrorInventory([item]);assert.equal(m.use(),false);
 assert.equal(m.collect({x:0,z:1},4.8,[]),0);assert.equal(m.collect({x:0,z:1},0,[{minX:-1,maxX:1,minZ:.4,maxZ:.6}]),0);assert.equal(m.collect({x:0,z:1},0,[]),1);assert.equal(m.collect({x:0,z:1},0,[]),0);
 assert.equal(m.use(),true);assert.equal(m.count,0);assert.equal(m.use(),false);for(let i=0;i<239;i++)m.step(.05);assert.equal(m.active,true);m.step(.051);assert.equal(m.active,false);m.reset();assert.equal(m.count,0);assert.equal(item.collected,false);
});
test('Square is independent of sticks, R1 and Circle on standard and raw DualSense',()=>{
 for(const mapping of ['standard','']){const pad={id:'Sony DualSense',mapping,axes:[1,1,.5,.5],buttons:Array.from({length:18},(_,i)=>({pressed:i===(mapping?2:0)||i===4||i===5}))},edges=new ButtonEdges(),action=edges.update(pad);assert.equal(action.mirror,true);assert.equal(action.flashlight,true);assert.equal(action.interact,false);assert.equal(edges.update(pad).mirror,false);}
});
test('every phone launch defaults to simplified Low even after a saved High setting',()=>{assert.equal(startupPreferences({quality:'high'},true).quality,'low');assert.equal(startupPreferences(null,true).quality,'low');assert.equal(startupPreferences({quality:'high'},false).quality,'high');assert.equal(startupPreferences({stickSensitivity:2},true).stickSensitivity,2);});
test('gallery is a separate safe mode and Hard increases sensing and speed without altering controls',()=>{assert.deepEqual(PLAY_MODES.map(m=>m.id),['gallery','normal','hard']);assert.equal(modeRules('gallery').enemies,false);assert.ok(modeRules('hard').sense>modeRules('normal').sense);assert.ok(modeRules('hard').speed>modeRules('normal').speed);});
test('actual world never updates hostile AI in gallery and only renders wall echoes after consuming a mirror',t=>{
 const update=t.mock.method(Enemies.prototype,'update',()=>false),hear=t.mock.method(Enemies.prototype,'hear',()=>0);
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 let draws=0;const renderer={setPixelRatio(){},setSize(){},render(){draws++;},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,71);
 try{world.configure({...DEFAULTS,quality:'low'});world.render(500);assert.equal(draws,1);assert.deepEqual(world.enemyDirections(),[]);
 const pickups=world.scene.children.filter(o=>o.name==='mirror-pickup');assert.equal(pickups.length,12);for(const floor of [0,4.8,9.6])assert.equal(pickups.filter(o=>Math.abs(o.position.y-.85-floor)<.1).length,4);
 const m=pickups.find(o=>o.position.y<1)!;world.camera.position.set(m.position.x,1.68,m.position.z);world.step(.05);assert.equal(world.mirrorStatus().count,1);assert.equal(world.useMirror(),true);assert.equal(world.enemyDirections().length,12);draws=0;world.render(1000);assert.equal(draws,2);assert.equal(world.mirrorStatus().count,0);
 world.setMode('gallery');const calls=update.mock.callCount(),heard=hear.mock.callCount();for(let i=0;i<30;i++){const p=world.move(0,-1,0,true,.05);world.camera.position.set(p.x,p.y,p.z);assert.equal(world.step(.05),false);}assert.equal(update.mock.callCount(),calls);assert.equal(hear.mock.callCount(),heard);assert.deepEqual(world.enemyDirections(),[]);draws=0;world.render(2000);assert.equal(draws,1);assert.ok(world.scene.children.filter(o=>o.name.startsWith('horror-')).every(o=>!o.visible));assert.equal(world.completed,false);
 world.setMode('normal');for(let i=0;i<241;i++)world.step(.05);assert.deepEqual(world.enemyDirections(),[]);
 }finally{world.dispose();}
});
