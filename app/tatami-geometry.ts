import * as THREE from 'three';
import {interlockedTatami} from './tatami-layout.ts';

/**
 * A visual-only tatami surface for floors that already own movement and collision.
 * One standard mat is 0.90 m across the short edge and 1.80 m along the weave.
 * The highest vertex is 20 mm above `floorY`; no geometry in this helper should be
 * added to an obstacle or collision collection.
 */
export const TATAMI = {
  width: 0.9,
  length: 1.8,
  border: 0.035,
  maxRise: 0.02,
  trianglesPerMat: 102,
} as const;

export type TatamiPlacement = {
  /** Centre of the existing walkable floor. */
  x: number;
  z: number;
  /** Existing finished-floor height, not the underside of its slab. */
  floorY: number;
  /** Use Math.PI / 2 for the alternating half of a traditional layout. */
  rotation?: 0 | number;
  /** Stable room-derived value; prevents every reed surface from matching. */
  variation?: number;
};

export type TatamiGeometry = {
  /** 94 triangles per mat: straw top and the two exposed short ends. */
  reed: THREE.BufferGeometry;
  /** 8 triangles per mat: cloth on the two long edges only. */
  border: THREE.BufferGeometry;
  /** The remaining 0 triangles are intentionally reserved: no collision or hidden slab. */
  triangles: number;
};

export type TatamiRectangle = {
  x: number;
  z: number;
  width: number;
  depth: number;
  floorY: number;
  /** Reserve this much clear finished floor on every side; 0.20 m is a good door-safe default. */
  inset?: number;
  variation?: number;
};

type Buffer = { position: number[]; normal: number[]; uv: number[]; index: number[] };
type Point = readonly [number, number, number];
type Normal = readonly [number, number, number];
type QuadUV = readonly [number, number, number, number, number, number, number, number];
const empty = (): Buffer => ({ position: [], normal: [], uv: [], index: [] });

/**
 * Whole-mat layout for a rectangular floor box. It leaves a continuous threshold
 * reveal instead of scaling/cutting mats. It intentionally does not inspect doors:
 * callers should increase `inset` or omit placements where a door/stair lands.
 */
export function tatamiPlacementsForRectangle(rect: TatamiRectangle): TatamiPlacement[] {
  const inset = rect.inset ?? .2;
  const usableWidth = rect.width - inset * 2, usableDepth = rect.depth - inset * 2;
  const columns = Math.floor(usableWidth / TATAMI.width), rows = Math.floor(usableDepth / TATAMI.length);
  if (columns < 1 || rows < 1) return [];
  const occupiedWidth = columns * TATAMI.width, occupiedDepth = rows * TATAMI.length;
  const firstX = rect.x - occupiedWidth / 2 + TATAMI.width / 2;
  const firstZ = rect.z - occupiedDepth / 2 + TATAMI.length / 2;
  const placements: TatamiPlacement[] = [];
  const interlocked=interlockedTatami(columns,rows*2);
  if(interlocked){
    const mirror=Math.floor(rect.variation??0)%2===0?1:-1;
    return interlocked.map(([a,b],index)=>({
      x:rect.x+mirror*((a%columns+b%columns+1)*TATAMI.width/2-occupiedWidth/2),
      z:rect.z+(Math.floor(a/columns)+Math.floor(b/columns)+1)*TATAMI.width/2-occupiedDepth/2,
      floorY:rect.floorY,rotation:b-a===1?Math.PI/2:0,variation:(rect.variation??0)+index*31,
    }));
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) placements.push({
    x: firstX + column * TATAMI.width,
    z: firstZ + row * TATAMI.length,
    floorY: rect.floorY,
    variation: (rect.variation ?? 0) + row * 17 + column * 31,
  });
  return placements;
}

function vertex(buffer: Buffer, x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) {
  const index = buffer.position.length / 3;
  buffer.position.push(x, y, z);
  buffer.normal.push(nx, ny, nz);
  buffer.uv.push(u, v);
  return index;
}

function quad(
  buffer: Buffer,
  a: Point, b: Point, c: Point, d: Point,
  normal: Normal, uv: QuadUV,
) {
  const base = vertex(buffer, ...a, ...normal, uv[0], uv[1]);
  vertex(buffer, ...b, ...normal, uv[2], uv[3]);
  vertex(buffer, ...c, ...normal, uv[4], uv[5]);
  vertex(buffer, ...d, ...normal, uv[6], uv[7]);
  const ab=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),ac=new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
  if(ab.cross(ac).dot(new THREE.Vector3(...normal))<0)buffer.index.push(base,base+2,base+1,base,base+3,base+2);
  else buffer.index.push(base,base+1,base+2,base,base+2,base+3);
}

function finish(buffer: Buffer) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffer.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffer.uv, 2));
  geometry.setIndex(buffer.index);
  geometry.computeVertexNormals();
  geometry.userData.surfaceUV='authored';
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds two merge-ready world-space geometries. Call this once per room/chunk,
 * then submit `reed` and `border` to the existing material batcher. The Poly Haven
 * tatami_mat source is a 1.8 m square containing two 1.8 x 0.9 m mat panels. Reed
 * UVs deliberately crop only the upper panel's straw field; the green photo border
 * is never sampled by this geometry because cloth is a separate material.
 */
export function createTatamiGeometry(placements: readonly TatamiPlacement[]): TatamiGeometry {
  const reed = empty(), border = empty();
  const hw = TATAMI.width / 2, hl = TATAMI.length / 2, b = TATAMI.border;
  const columns = 5, rows = 9; // 5 * 9 * 2 = 90 top triangles per mat.

  for (let mat = 0; mat < placements.length; mat++) {
    const placement = placements[mat], angle = placement.rotation ?? 0;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const seed = placement.variation ?? mat * 0.61803398875;
    const transform = (x: number, y: number, z: number): Point => [
      placement.x + x * cosine - z * sine,
      y,
      placement.z + x * sine + z * cosine,
    ];
    // A mild deterministic crown and transverse reed irregularity, never above 20 mm.
    const top = (x: number, z: number) => placement.floorY + .0172
      + .00125 * Math.sin((x / TATAMI.width + seed) * Math.PI * 5)
      + .0009 * Math.sin((z / TATAMI.length + seed * 1.73) * Math.PI * 11)
      + .00045 * Math.cos((x + z + seed) * 23);

    // Only the inset is reed. The separate cloth geometry makes every neighbour seam legible.
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x0 = -hw + b + (TATAMI.width - 2 * b) * column / columns;
      const x1 = -hw + b + (TATAMI.width - 2 * b) * (column + 1) / columns;
      const z0 = -hl + .001 + (TATAMI.length - .002) * row / rows;
      const z1 = -hl + .001 + (TATAMI.length - .002) * (row + 1) / rows;
      const a = transform(x0, top(x0, z0), z0), b0 = transform(x1, top(x1, z0), z0);
      const c = transform(x1, top(x1, z1), z1), d = transform(x0, top(x0, z1), z1);
      // Source U is the 1.8 m axis; source V .028-.475 is the upper panel's straw only.
      const u0 = .025 + .95 * row / rows, u1 = .025 + .95 * (row + 1) / rows;
      const v0 = .028 + .447 * column / columns, v1 = .028 + .447 * (column + 1) / columns;
      quad(reed, a, b0, c, d, [0, 1, 0], [u0, v0, u0, v1, u1, v1, u1, v0]);
    }

    const y = placement.floorY + .0163, sideY = placement.floorY + .004;
    const topRect = (x0: number, z0: number, x1: number, z1: number, u0: number, v0: number, u1: number, v1: number) => {
      const a = transform(x0, y, z0), b0 = transform(x1, y, z0), c = transform(x1, y, z1), d = transform(x0, y, z1);
      quad(border, a, b0, c, d, [0, 1, 0], [u0, v0, u1, v0, u1, v1, u0, v1]);
    };
    // Heri runs down the long edges; short edges expose the folded straw surface.
    topRect(-hw, -hl, -hw + b, hl, 0, 0, b, TATAMI.length);
    topRect(hw - b, -hl, hw, hl, 0, 0, b, TATAMI.length);

    // Four thin side bands supply a real edge in grazing flashlight light without making a walk collision ridge.
    const side = (a: readonly [number, number], b0: readonly [number, number], outward: readonly [number, number], u0: number, u1: number,straw=false) => {
      const ta = transform(a[0], y, a[1]), tb = transform(b0[0], y, b0[1]);
      const ba = transform(a[0], sideY, a[1]), bb = transform(b0[0], sideY, b0[1]);
      const normal: Normal = [outward[0] * cosine - outward[1] * sine, 0, outward[0] * sine + outward[1] * cosine];
      quad(straw?reed:border, ta, tb, bb, ba, normal, straw?[.025,.028,.025,.475,.03,.475,.03,.028]:[u0, 0, u1, 0, u1, .0123, u0, .0123]);
    };
    side([-hw, -hl], [hw, -hl], [0, -1], 0, 1,true);
    side([hw, -hl], [hw, hl], [1, 0], 0, TATAMI.length);
    side([hw, hl], [-hw, hl], [0, 1], 0, 1,true);
    side([-hw, hl], [-hw, -hl], [-1, 0], 0, TATAMI.length);
  }

  return { reed: finish(reed), border: finish(border), triangles: placements.length * TATAMI.trianglesPerMat };
}
