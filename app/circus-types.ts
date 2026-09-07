export type CircusPoint={x:number;z:number};
export type CircusPosition=CircusPoint&{y:number};
export type CircusDeviceKind='curtain'|'turntable'|'drawbridge'|'lure';
export type CircusStation={id:string;name:string;position:CircusPoint;exit:CircusPoint};
export type CircusDevice={id:string;name:string;kind:CircusDeviceKind;position:CircusPoint;control:CircusPoint;yaw:number};
export type CircusPlan={track:CircusPoint[];stations:CircusStation[];devices:CircusDevice[]};
export type CircusDeviceState={id:string;progress:number;target:number};
export type CircusSnapshot={cart:CircusPosition;yaw:number;speed:number;riding:boolean;moving:boolean;station:number;destination:number;distance:number;totalLength:number;devices:CircusDeviceState[]};
