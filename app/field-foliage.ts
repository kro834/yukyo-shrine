import * as THREE from 'three';

/** Opaque curved leaves use the existing static-material batches. */
export type FoliageKind = 'short' | 'verge' | 'reed';
type Point = { x: number; y: number; z: number };
type Buffers = { p: number[]; uv: number[]; c: number[]; ix: number[] };

export const FOLIAGE_LIMITS = {
  short: { count: 2400, triangles: 12 },
  verge: { count: 4000, triangles: 25 },
  reed: { count: 400, triangles: 37 },
} as const; // Absolute maximum: 143,600 triangles, before chunk culling.

function randomSequence(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent of traversal order and graphics quality. */
export function foliageHash(x: number, z: number, seed: number, salt = 0) {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ seed ^ Math.imul(salt, 0x6c8e9cf5);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function palette(dry: boolean) {
  // THREE.Color converts these sRGB colors to linear vertex-color values.
  return (dry ? ['#514730', '#766d50', '#948765'] : ['#34432b', '#596749', '#797c59'])
    .map(value => new THREE.Color(value));
}

function vertex(buffers: Buffers, point: Point, u: number, t: number, colors: THREE.Color[], gain: number) {
  const color = t < .64 ? colors[0].clone().lerp(colors[1], t / .64) : colors[1].clone().lerp(colors[2], (t - .64) / .36);
  buffers.p.push(point.x, point.y, point.z);
  buffers.uv.push(u, t);
  buffers.c.push(color.r * gain, color.g * gain, color.b * gain);
  return buffers.p.length / 3 - 1;
}

function blade(buffers: Buffers, start: Point, angle: number, height: number, width: number,
  bend: number, low: boolean, colors: THREE.Color[], gain: number) {
  const samples = low ? [0, .53] : [0, .40, .74];
  const forward = { x: Math.sin(angle), z: Math.cos(angle) };
  const side = { x: Math.cos(angle), z: -Math.sin(angle) };
  const rows: number[] = [];
  for (const t of samples) {
    const center = { x: start.x + forward.x * bend * t * t,
      y: start.y + height * t, z: start.z + forward.z * bend * t * t };
    const profile = t === 0 ? .26 : Math.sin(Math.PI * (t * .86 + .11));
    const halfWidth = width * .5 * profile;
    const left = vertex(buffers, { x: center.x - side.x * halfWidth, y: center.y, z: center.z - side.z * halfWidth }, 0, t, colors, gain);
    vertex(buffers, { x: center.x + side.x * halfWidth, y: center.y, z: center.z + side.z * halfWidth }, 1, t, colors, gain);
    rows.push(left);
  }
  for (let row = 0; row < rows.length - 1; row++) {
    const a = rows[row], b = rows[row + 1];
    buffers.ix.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const tip = vertex(buffers, { x: start.x + forward.x * bend, y: start.y + height,
    z: start.z + forward.z * bend }, .5, 1, colors, gain);
  const last = rows[rows.length - 1];
  buffers.ix.push(last, last + 1, tip);
}

function stem(buffers: Buffers, start: Point, end: Point, radius: number, colors: THREE.Color[]) {
  const first = buffers.p.length / 3;
  for (let ring = 0; ring < 2; ring++) {
    const center = ring ? end : start;
    for (let side = 0; side < 3; side++) {
      const angle = side * Math.PI * 2 / 3;
      vertex(buffers, { x: center.x + Math.cos(angle) * radius, y: center.y,
        z: center.z + Math.sin(angle) * radius }, side / 3, ring, colors, .92);
    }
  }
  for (let side = 0; side < 3; side++) {
    const a = first + side, b = first + (side + 1) % 3;
    buffers.ix.push(a, a + 3, b, a + 3, b + 3, b);
  }
}

/** Cache a small number of seeded variants; clone, rotate and translate before existing 24m batching. */
export function makeFoliageGeometry(kind: FoliageKind, seed = 1) {
  const random = randomSequence(seed), buffers: Buffers = { p: [], uv: [], c: [], ix: [] };
  if (kind === 'reed') {
    const height = .66 + random() * .32, colors = palette(random() < .35);
    const stems: { start: Point; end: Point }[] = [];
    for (let index = 0; index < 2; index++) {
      const start = { x: (index ? 1 : -1) * .047, y: 0, z: (random() - .5) * .055 };
      const end = { x: start.x + (random() - .5) * .065, y: height * (.88 + random() * .12),
        z: start.z + (random() - .5) * .065 };
      stem(buffers, start, end, .0035 + random() * .002, colors);
      stems.push({ start, end });
    }
    for (let index = 0; index < 5; index++) {
      const s = stems[index % 2], t = .22 + index * .085;
      const start = { x: THREE.MathUtils.lerp(s.start.x, s.end.x, t), y: s.end.y * t,
        z: THREE.MathUtils.lerp(s.start.z, s.end.z, t) };
      blade(buffers, start, random() * Math.PI * 2, height * (.23 + random() * .12),
        .012 + random() * .012, .11 + random() * .12, false, colors, .9 + random() * .17);
    }
  } else {
    const low = kind === 'short', height = low ? .06 + random() * .07 : .28 + random() * .34;
    const blades = low ? 4 : 7, spread = low ? .021 : .095, phase = random() * Math.PI * 2;
    for (let index = 0; index < blades; index++) {
      const angle = phase + index * Math.PI * 2 / blades + (random() - .5) * .65;
      const start = { x: (random() - .5) * spread, y: 0, z: (random() - .5) * spread };
      const h = height * (.62 + random() * .38), dry = random() < (low ? .14 : .23);
      blade(buffers, start, angle, h, low ? .006 + random() * .008 : .009 + random() * .012,
        h * (.20 + random() * .25), low||index>=2, palette(dry), .9 + random() * .16);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.c, 3));
  geometry.setIndex(buffers.ix);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const maxHeight = Math.max(.001, geometry.boundingBox!.max.y), uv = geometry.getAttribute('uv');
  // A coherent root-anchored wind weight, including reeds' attached leaves.
  for (let index = 0; index < uv.count; index++) uv.setY(index, buffers.p[index * 3 + 1] / maxHeight);
  geometry.computeBoundingSphere();
  return geometry;
}
