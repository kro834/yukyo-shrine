import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout,SPAWN} from '../app/shrine-layout.ts';
import {movePlayer,BOUNDS,RADIUS,stick} from '../app/movement.ts';
import {ButtonEdges,TouchInput,allowMouseLook} from '../app/input-actions.ts';
import {GamepadSession,readGamepad,type Pad} from '../app/gamepad-input.ts';
import {sanitizePreferences,DEFAULTS} from '../app/preferences.ts';
const pad=(axes=[0,0,0,0],pressed:number[]=[],index=0):Pad=>({id:'DualSense',index,mapping:'standard',connected:true,axes,buttons:Array.from({length:18},(_,i)=>({pressed:pressed.includes(i)}))});
test('all rooms and corridors form one connected walkable complex',()=>{
 const l=createLayout(),start=Math.round(SPAWN.x/4)+','+Math.round(SPAWN.z/4);
 const seen=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++){const c=l.grid.get(queue[i])!;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(c.x+dx)+','+(c.z+dz);if(l.grid.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}
 assert.equal(seen.size,l.cells.length);assert.ok(l.cells.length>900);
 for(const key of ['0,-10','8,2','-8,-7','-9,-22','11,-18','0,-23'])assert.ok(seen.has(key),key);
});
test('closed envelope matches every exposed tile edge',()=>{
 const l=createLayout();let boundary=0;
 for(const c of l.cells)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!l.grid.has((c.x+dx)+','+(c.z+dz)))boundary++;
 assert.equal(l.walls.filter(w=>!w.twoSided).length,boundary);assert.equal(l.obstacles.length,l.walls.length+l.narrows.length*2);assert.ok(l.narrows.length>10);
 for(const c of l.cells){assert.ok(c.x*4-2>BOUNDS.minX&&c.x*4+2<BOUNDS.maxX);assert.ok(c.z*4-2>BOUNDS.minZ&&c.z*4+2<BOUNDS.maxZ);}
});
test('sprint cannot cross any outer wall at its center',()=>{
 const l=createLayout();
 for(const w of l.walls){
   let p={x:w.x+w.insideX*.85,z:w.z+w.insideZ*.85};
   for(let i=0;i<60;i++)p=movePlayer(p,-w.insideX,-w.insideZ,0,true,.05,l.obstacles);
   const innerDistance=(p.x-w.x)*w.insideX+(p.z-w.z)*w.insideZ;
   assert.ok(innerDistance>=RADIUS+.17,'escaped wall '+JSON.stringify(w));
 }
});
test('diagonal sprint never tunnels through corners during a long traversal',()=>{
 const l=createLayout();let p={...SPAWN};let seed=72;
 for(let i=0;i<20000;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const a=seed/4294967296*Math.PI*2;
   p=movePlayer(p,Math.cos(a),Math.sin(a),i*.005,true,.05,l.obstacles);
   assert.ok(l.grid.has(Math.floor((p.x+2)/4)+','+Math.floor((p.z+2)/4)));
 }
});
test('normal sprint speed, analog movement and yaw orientation',()=>{
 const walk=movePlayer({x:0,z:0},0,-1,0,false,.05,[]);
 const sprint=movePlayer({x:0,z:0},0,-1,0,true,.05,[]);
 const analog=movePlayer({x:0,z:0},0,-.5,0,false,.05,[]);
 assert.ok(Math.abs(sprint.z)>Math.abs(walk.z)*2);assert.equal(analog.z,walk.z/2);
 const turned=movePlayer({x:0,z:0},0,-1,Math.PI/2,false,.05,[]);assert.ok(turned.x<0);assert.ok(Math.abs(turned.z)<1e-12);
});
test('DualSense uses independent left/right sticks, L1 sprint and drift filtering',()=>{
 const p=readGamepad(pad([.6,-.8,.5,-.3],[4]));assert.ok(p.move.x>0&&p.move.z<0&&p.look.x>0&&p.look.z<0);assert.equal(p.sprint,true);
 assert.deepEqual(stick(.02,-.04),{x:0,z:0});
});
test('R1 switches exactly once per press, not each frame while held',()=>{
 const edges=new ButtonEdges();assert.equal(edges.update(pad()).flashlight,false);
 assert.equal(edges.update(pad([0,0,0,0],[5])).flashlight,true);
 for(let i=0;i<600;i++)assert.equal(edges.update(pad([0,0,0,0],[5])).flashlight,false);
 assert.equal(edges.update(pad()).flashlight,false);assert.equal(edges.update(pad([0,0,0,0],[5])).flashlight,true);
});
test('R1 is independent of L1 sprint and Options menu',()=>{
 const edges=new ButtonEdges();const both=pad([0,-1,0,0],[4,5]);assert.ok(edges.update(both).flashlight);assert.ok(readGamepad(both).sprint);
 edges.update(pad());assert.ok(edges.update(pad([0,0,0,0],[9])).menu);assert.equal(readGamepad(pad([0,0,0,0],[5])).sprint,false);
});
test('three fingers can move, look and sprint without stealing pointer capture',()=>{
 const t=new TouchInput();t.start(11,'move',50,200);t.start(22,'look',300,200);t.start(33,'sprint',230,200);
 t.move(11,70,160);const look=t.move(22,330,180);
 assert.ok(t.x>0&&t.z<0&&t.sprint);assert.deepEqual(look,{yaw:30,pitch:-20});
 t.end(22);assert.ok(t.sprint&&t.z<0);t.end(33);assert.equal(t.sprint,false);assert.ok(t.z<0);t.end(11);assert.equal(t.z,0);
});
test('cancelled and duplicate touch pointers cannot leave stuck movement',()=>{
 const t=new TouchInput();assert.ok(t.start(1,'move',0,0));assert.equal(t.start(2,'move',1,1),false);t.move(1,200,-200);assert.ok(Math.hypot(t.x,t.z)<=1.00001);t.start(3,'sprint',0,0);t.clear();assert.deepEqual([t.x,t.z,t.sprint,t.pointers.size],[0,0,false,0]);
});
test('emulated pointer events cannot reveal touch controls during held controller input',()=>{
 const s=new GamepadSession();for(let i=0;i<540;i++){s.poll([pad([0,-1,0,0])]);assert.equal(s.useTouch(),false);assert.equal(s.mode,'gamepad');assert.equal(allowMouseLook(s.mode,false,true),false);}
 s.poll([pad()]);assert.equal(s.mode,'gamepad');assert.equal(s.useTouch(),true);assert.equal(s.mode,'touch');
});
test('disconnect recovers touch and selects an active second controller',()=>{
 const s=new GamepadSession();s.poll([pad()]);assert.equal(s.poll([pad(),pad([1,0,0,0],[],2)]).pad?.index,2);assert.equal(s.poll([]).mode,'touch');assert.ok(s.useTouch());
});
test('opening settings with a mouse preserves controller mode after sensitivity changes',()=>{
 const s=new GamepadSession();s.poll([pad([0,-1,0,0])]);assert.equal(s.allowsMenuPointer(),false);
 s.poll([pad()]);assert.equal(s.allowsMenuPointer(),true);assert.equal(s.mode,'gamepad');
 sanitizePreferences({...DEFAULTS,stickSensitivity:2});assert.equal(s.mode,'gamepad');assert.equal(allowMouseLook(s.mode,false,true),false);
});
test('mouse look requires pointer lock and stops in menus',()=>{
 assert.equal(allowMouseLook('touch',false,true),true);assert.equal(allowMouseLook('touch',false,false),false);assert.equal(allowMouseLook('touch',true,true),false);assert.equal(allowMouseLook('gamepad',false,true),false);
});
test('stored preference corruption is bounded without losing safe defaults',()=>{
 assert.deepEqual(sanitizePreferences(null),DEFAULTS);
 const p=sanitizePreferences({fov:900,brightness:-50,quality:'invalid',stickSensitivity:NaN,touchSensitivity:.1,invertY:'yes'});
 assert.equal(p.fov,95);assert.equal(p.brightness,.7);assert.equal(p.quality,'high');assert.equal(p.stickSensitivity,1);assert.equal(p.touchSensitivity,.25);assert.equal(p.invertY,false);
});
