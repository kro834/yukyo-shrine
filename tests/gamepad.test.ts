import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GamepadSession, PadCalibration, canNavigate, defaultMapping, mappedInput, mappingKey, readGamepad } from '../app/gamepad-input.ts';

function dualsense(mapping='standard',axes=[0,0,0,0],index=0) {
  return {id:'DualSense Wireless Controller (Vendor: 054c Product: 0ce6)',mapping,axes,index,connected:true,buttons:Array.from({length:18},()=>({pressed:false}))};
}
describe('DualSense compatibility and input handoff',()=>{
  it('reads standard DualSense sticks and L1, regardless of extra browser axes',()=>{
    const p=dualsense('standard',[1,-1,.8,-.9,-1,-1]);p.buttons[4].pressed=true;
    const i=readGamepad(p);assert.ok(i.move.x>0&&i.move.z<0);assert.ok(i.look.x>0&&i.look.z<0);assert.equal(i.sprint,true);
  });
  it('reads unmapped Sony USB axes 0/1/2/5 instead of ignoring the device',()=>{
    const p=dualsense('',[1,-1,.8,-1,-1,-.9]);const i=readGamepad(p);
    assert.ok(i.move.x>0&&i.move.z<0);assert.ok(i.look.x>0&&i.look.z<0);
    const idle=readGamepad(dualsense('',[0,0,0,-1,-1,0]));assert.deepEqual(idle.look,{x:0,z:0});
  });
  it('keeps Linux Sony axes fixed while a trigger is subsequently pressed',()=>{
    const session=new GamepadSession(),p=dualsense('',[0,0,-1,0,0,-1]);
    session.poll([p]);p.axes=[0,-1,-1,.6,-.8,1];
    const {input}=session.poll([p]);assert.ok(input.move.z<0&&input.look.x>0&&input.look.z<0);
  });
  it('supports a four-axis raw browser layout and ignores drift',()=>{
    const session=new GamepadSession(),p=dualsense('',[.06,-.08,.05,.04]);
    assert.equal(session.poll([p]).mode,'touch');p.axes=[0,-1,1,0];
    const result=session.poll([p]);assert.equal(result.mode,'gamepad');assert.equal(result.input.move.z,-1);assert.equal(result.input.look.x,1);
  });
  it('selects an active controller after an idle device and handles sparse slots',()=>{
    const session=new GamepadSession(),idle=dualsense(),active=dualsense('standard',[0,-1,1,0],2);
    const r=session.poll([idle,null,active]);assert.equal(r.pad?.index,2);assert.equal(r.input.move.z,-1);
    assert.equal(session.poll([idle,null,active]).pad?.index,2);
  });
  it('hides touch controls until touch resumes, without flapping on held sticks',()=>{
    const session=new GamepadSession(),p=dualsense();assert.equal(session.poll([p]).mode,'touch');
    p.axes[0]=1;assert.equal(session.poll([p]).mode,'gamepad');
    p.axes[0]=0;assert.equal(session.poll([p]).mode,'gamepad');
    p.axes[0]=1;session.poll([p]);assert.equal(session.useTouch(),false);assert.equal(session.poll([p]).mode,'gamepad');
    p.axes[0]=0;session.poll([p]);assert.equal(session.useTouch(),true);assert.equal(session.poll([p]).mode,'touch');
    p.axes[2]=1;assert.equal(session.poll([p]).mode,'gamepad');
    assert.equal(session.poll([]).mode,'touch');assert.equal(session.poll([]).input.sprint,false);
  });
  it('keeps gamepad mode through repeated mouse/touch events while L stick is held',()=>{
    const session=new GamepadSession(),p=dualsense();session.poll([p]);
    for(const amount of [.18,.25,1]){
      p.axes[0]=amount;
      for(let frame=0;frame<180;frame++){
        const before=session.poll([p]);assert.ok(before.input.move.x>0);assert.equal(before.mode,'gamepad');
        assert.equal(session.useTouch(),false);
        assert.equal(session.poll([p]).mode,'gamepad');
      }
    }
    p.axes[0]=0;assert.equal(session.poll([p]).mode,'gamepad');
    assert.equal(session.useTouch(),true);assert.equal(session.poll([p]).mode,'touch');
  });
  it('a button activates controller mode, L1 releases, and reconnect restores input',()=>{
    const session=new GamepadSession(),p=dualsense();session.poll([p]);p.buttons[4].pressed=true;
    assert.equal(session.poll([p]).mode,'gamepad');assert.equal(session.poll([p]).input.sprint,true);
    p.connected=false;assert.equal(session.poll([p]).mode,'touch');assert.equal(session.poll([p]).input.sprint,false);
    p.connected=true;p.buttons[4].pressed=false;p.axes[1]=-1;assert.equal(session.poll([p]).input.move.z,-1);
  });
  it('guided setup detects reversed and nonstandard stick axes without confusing triggers',()=>{
    const p=dualsense('',[0,0,-1,0,0,0,0]);const c=new PadCalibration(mappingKey(p),p);
    for(const [axis,direction] of [[3,-1],[4,1],[0,1],[6,-1]]){
      p.axes[axis]=direction;assert.equal(c.update(p),null);
      // Holding the same stick cannot incorrectly advance the next step.
      const step=c.step;c.update(p);assert.equal(c.step,step);
      p.axes[axis]=0;c.update(p);
    }
    p.buttons[5].pressed=true;const mapping=c.update(p)!;assert.ok(mapping);assert.equal(mapping.sprint,5);
    p.axes[3]=-1;p.axes[4]=-1;p.axes[0]=1;p.axes[6]=1;
    const input=mappedInput(p,mapping);assert.ok(input.move.x>0&&input.move.z<0&&input.look.x>0&&input.look.z<0);assert.ok(input.sprint);
  });
  it('calibration does not accept another controller or its disconnected slot',()=>{
    const p=dualsense(),c=new PadCalibration(mappingKey(p),p);
    assert.equal(c.update({...p,id:'Another controller',axes:[1,0,0,0]}),null);assert.equal(c.step,0);
    assert.deepEqual(mappedInput({...p,connected:false},defaultMapping(p)),{move:{x:0,z:0},look:{x:0,z:0},sprint:false});
  });
  it('recovers from lost focus and keeps hidden pages and guides paused',()=>{
    assert.equal(canNavigate(false,false,false),false);assert.equal(canNavigate(false,true,false),true);
    assert.equal(canNavigate(true,true,false),false);assert.equal(canNavigate(false,true,true),false);
  });
});
