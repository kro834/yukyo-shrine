import fs from 'node:fs/promises';
import {errorMask} from '../app/error-mask.ts';
import {slidingDoorLeaf} from '../app/sliding-door-leaf.ts';
const encode=g=>({positions:Array.from(g.getAttribute('position').array),uvs:Array.from(g.getAttribute('uv').array),colors:Array.from(g.getAttribute('color').array),indices:Array.from(g.index.array)});
await fs.mkdir('assets/blender',{recursive:true});
const door=slidingDoorLeaf();
await fs.writeFile('assets/blender/error-bases.json',JSON.stringify({inverse:encode(errorMask(false)),weeping:encode(errorMask(true)),pull:encode(door.pullGeometry)}));
