import { stick } from './movement.ts';

export type Pad = {
  id?: string; index?: number; connected?: boolean; mapping: string;
  axes: readonly number[]; buttons: readonly { pressed: boolean }[];
};
export type PadMapping = { axes: number[]; signs: number[]; centers: number[]; sprint: number };
export const mappingKey = (pad: Pad) => `${pad.id ?? ''}|${pad.mapping}|${pad.axes.length}|${pad.buttons.length}`;
const neutral = () => ({ move: {x:0,z:0}, look: {x:0,z:0}, sprint:false });

export function defaultMapping(pad: Pad): PadMapping | null {
  if (pad.axes.length < 4) return null;
  let axes = [0,1,2,3];
  if (pad.mapping !== 'standard' && pad.axes.length !== 4) {
    if (!/054c|sony|dualsense|dualshock|wireless controller|playstation/i.test(pad.id ?? '')) return null;
    // Sony USB HID: RX/RY are 2/5. Linux hid-playstation can expose 3/4.
    // Chromium's mappings document both layouts. Resolve once, not every frame.
    // https://chromium.googlesource.com/chromium/src/+/HEAD/device/gamepad/gamepad_standard_mappings_linux.cc
    axes = pad.axes[2] < -.75 && pad.axes[5] < -.75 && Math.abs(pad.axes[3]) < .25 && Math.abs(pad.axes[4]) < .25
      ? [0,1,3,4] : [0,1,2,5];
  }
  return { axes, signs:[1,1,1,1], centers:[0,0,0,0], sprint:4 };
}

export function validMapping(value: unknown, pad: Pad): value is PadMapping {
  if (!value || typeof value !== 'object') return false;
  const m=value as PadMapping;
  return Array.isArray(m.axes) && m.axes.length===4 && new Set(m.axes).size===4
    && m.axes.every(a=>Number.isInteger(a)&&a>=0&&a<pad.axes.length)
    && Array.isArray(m.signs)&&m.signs.length===4&&m.signs.every(s=>s===1||s===-1)
    && Array.isArray(m.centers)&&m.centers.length===4&&m.centers.every(c=>Number.isFinite(c)&&Math.abs(c)<.4)
    && Number.isInteger(m.sprint)&&m.sprint>=0&&m.sprint<pad.buttons.length;
}

export function mappedInput(pad: Pad | null, mapping: PadMapping | null) {
  if (!pad || pad.connected===false || !mapping) return neutral();
  const axes=mapping.axes.map((axis,i)=>{
    const raw=pad.axes[axis];
    if (!Number.isFinite(raw)) return 0;
    const offset=raw-mapping.centers[i];
    const scale=offset>=0?1-mapping.centers[i]:1+mapping.centers[i];
    return Math.max(-1,Math.min(1,offset/scale))*mapping.signs[i];
  });
  return {move:stick(axes[0],axes[1]),look:stick(axes[2],axes[3]),sprint:!!pad.buttons[mapping.sprint]?.pressed};
}

export function readGamepad(pad: Pad | null) { return mappedInput(pad,pad?defaultMapping(pad):null); }
export function canNavigate(hidden:boolean,focused:boolean,guideOpen:boolean) { return !hidden&&focused&&!guideOpen; }

export class GamepadSession {
  mode: 'touch' | 'gamepad' = 'touch';
  selected: number | null = null;
  mappings = new Map<string,PadMapping|null>();
  private samples = new Map<number,number[]>();
  private controllerActive=false;
  useTouch() {
    // A controller/OS can emit mouse events while a stick is held. Those events
    // must not reveal the on-screen controls or cursor during navigation.
    if(this.controllerActive)return false;
    this.mode='touch';
    return true;
  }
  setMapping(pad:Pad,mapping:PadMapping) { if(validMapping(mapping,pad))this.mappings.set(mappingKey(pad),mapping); }
  poll(pads: readonly (Pad|null)[]) {
    const connected=pads.filter((p):p is Pad=>!!p&&p.connected!==false);
    const candidates=connected.map((pad,n)=>{
      const index=pad.index??n,key=mappingKey(pad);
      if(!this.mappings.has(key))this.mappings.set(key,defaultMapping(pad));
      const mapping=this.mappings.get(key)??null,input=mappedInput(pad,mapping);
      const values=[input.move.x,input.move.z,input.look.x,input.look.z,...pad.buttons.map(b=>Number(b.pressed))];
      const previous=this.samples.get(index);
      const active=values.some(v=>Math.abs(v)>.001);
      const intent=active&&values.some((v,i)=>Math.abs(v)>.001&&Math.abs(v-(previous?.[i]??0))>.001);
      this.samples.set(index,values);
      return {pad,index,input,mapping,active,intent};
    });
    for(const index of this.samples.keys())if(!candidates.some(c=>c.index===index))this.samples.delete(index);
    if(this.selected!==null&&!candidates.some(c=>c.index===this.selected)){this.selected=null;this.mode='touch';}
    const current=candidates.find(c=>c.intent)
      ?? candidates.find(c=>c.index===this.selected)
      ?? candidates.find(c=>c.active)
      ?? candidates.find(c=>c.mapping)
      ?? candidates[0];
    this.controllerActive=candidates.some(c=>c.mapping&&c.active);
    if(current){this.selected=current.index;if(this.controllerActive)this.mode='gamepad';}
    else this.mode='touch';
    return {pad:current?.pad??null,input:current?.input??neutral(),mapping:current?.mapping??null,mode:this.mode};
  }
}

// Guided calibration is available only in the guide, for unusual USB drivers.
export class PadCalibration {
  step=0;
  waitingForRelease=false;
  readonly baseline:number[];
  private axes:number[]=[];
  private signs:number[]=[];
  readonly padKey:string;
  constructor(padKey:string,pad:Pad){this.padKey=padKey;this.baseline=Array.from(pad.axes);}
  update(pad:Pad):PadMapping|null {
    if(mappingKey(pad)!==this.padKey)return null;
    const offsets=pad.axes.map((v,i)=>v-(this.baseline[i]??0));
    if(this.waitingForRelease){
      if(offsets.every(v=>Math.abs(v)<.25)&&pad.buttons.every(b=>!b.pressed))this.waitingForRelease=false;
      return null;
    }
    if(this.step<4){
      const candidates=offsets.map((v,i)=>({v,i})).filter(a=>!this.axes.includes(a.i)&&Math.abs(this.baseline[a.i])<.4&&Math.abs(a.v)>.65).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
      if(candidates[0]){this.axes.push(candidates[0].i);this.signs.push(Math.sign(candidates[0].v));this.step++;this.waitingForRelease=true;}
      return null;
    }
    const sprint=pad.buttons.findIndex(b=>b.pressed);
    if(sprint<0)return null;
    const mapping={axes:this.axes,signs:this.signs,centers:this.axes.map(a=>this.baseline[a]),sprint};
    return validMapping(mapping,pad)?mapping:null;
  }
}
