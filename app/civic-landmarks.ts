/**
 * v27 drop-in civic kit authored at its final 4 m width. Never scale X.
 * Local +Y is up, Z follows the 12 m route, and x=-.8..+.8 is always clear.
 * There is deliberately no full-area floor geometry; the world owns the ground.
 */
export type CivicMaterial =
  | 'wood'
  | 'planks'
  | 'concrete'
  | 'enamel'
  | 'steel'
  | 'rust'
  | 'dark'
  | 'black'
  | 'glass'
  | 'light'
  | 'coolLight'
  | 'stone';
export type BoxGeometry = {
  kind: 'box';
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
};
export type CylinderGeometry = {
  kind: 'cylinder';
  x: number;
  y: number;
  z: number;
  r: number;
  h: number;
  rb: number;
  segments: number;
};
export type BeveledBoxGeometry = {
  kind: 'beveledBox';
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  radius: number;
  yaw?: number;
};
export type TubeGeometry = {
  kind: 'tube';
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  radius: number;
  segments: number;
};
export type CivicGeometry =
  | BoxGeometry
  | CylinderGeometry
  | BeveledBoxGeometry
  | TubeGeometry;
export type CivicPart = CivicGeometry & { material: CivicMaterial };
export type CivicCollider = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
};
export type CivicFoundation = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
};
export type CivicLandmarkId =
  | 'weathered-bus-shelter'
  | 'railway-underpass-bay'
  | 'closed-floodgate-mechanism'
  | 'apartment-service-facade';
export type CivicLandmark = {
  id: CivicLandmarkId;
  envelope: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  clearances: {
    mainAxisMinX: -0.8;
    mainAxisMaxX: 0.8;
    mainAxisWidth: 1.6;
    overhead: number | null;
  };
  parts: CivicPart[];
  colliders: CivicCollider[];
  foundations: CivicFoundation[];
};
export type CivicBuilder = {
  box: (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: CivicMaterial,
  ) => void;
  cylinder: (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    material: CivicMaterial,
    rb?: number,
    segments?: number,
  ) => void;
  add: (
    geometry: BeveledBoxGeometry | TubeGeometry,
    material: CivicMaterial,
  ) => void;
};
export type CivicPlacement = {
  x?: number;
  y?: number;
  z?: number;
  quarterTurns?: 0 | 1 | 2 | 3;
};

function kit(id: CivicLandmarkId) {
  const parts: CivicPart[] = [],
    colliders: CivicCollider[] = [],
    foundations: CivicFoundation[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: CivicMaterial,
  ) => parts.push({ kind: 'box', x, y, z, w, h, d, material });
  const cylinder = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    material: CivicMaterial,
    rb = r,
    segments = 12,
  ) => parts.push({ kind: 'cylinder', x, y, z, r, h, rb, segments, material });
  const bevel = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    radius: number,
    material: CivicMaterial,
    yaw = 0,
  ) =>
    parts.push({ kind: 'beveledBox', x, y, z, w, h, d, radius, yaw, material });
  const tube = (
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    radius: number,
    material: CivicMaterial,
    segments = 8,
  ) => parts.push({ kind: 'tube', from, to, radius, segments, material });
  const collide = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    maxY: number,
    minY = 0,
    foundation = minY === 0,
  ) => {
    const r = {
      id,
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    };
    colliders.push({ ...r, minY, maxY });
    if (foundation) foundations.push({ ...r, topY: minY });
  };
  return {
    id,
    parts,
    colliders,
    foundations,
    box,
    cylinder,
    bevel,
    tube,
    collide,
  };
}

function busShelter(): CivicLandmark {
  const k = kit('weathered-bus-shelter'),
    { box, cylinder, bevel, tube, collide } = k;
  // Real curb and tactile pavers occupy only the shelter side, never the route floor.
  bevel(1.84, 0.11, 0, 0.3, 0.22, 11.5, 0.045, 'concrete');
  for (let z = -5.45; z <= 5.46; z += 0.48)
    bevel(
      1.62,
      0.225,
      z,
      0.2,
      0.03,
      0.3,
      0.008,
      z < -4.8 || z > 4.8 ? 'rust' : 'stone',
    );
  // 76 mm-diameter round steel posts on 260 mm cast feet.
  for (const x of [0.98, 1.82])
    for (const z of [-4.25, 4.25]) {
      cylinder(x, 1.54, z, 0.038, 3.0, 'steel', 0.038, 12);
      cylinder(x, 0.08, z, 0.13, 0.16, 'concrete', 0.13, 12);
      collide(`post-${x}-${z}`, x, z, 0.26, 0.26, 3.04);
    }
  bevel(1.4, 3.08, 0, 1.08, 0.16, 9.2, 0.04, 'steel');
  // 1.16 m deep corrugated roof: 50 mm edge channels and 85 mm rib pitch.
  box(1.42, 3.19, 0, 1.16, 0.06, 9.55, 'dark');
  for (let x = 0.86; x <= 1.99; x += 0.085)
    box(x, 3.245, 0, 0.025, 0.05, 9.5, x < 0.95 || x > 1.9 ? 'rust' : 'steel');
  for (const z of [-4.79, 4.79])
    bevel(1.42, 3.22, z, 1.16, 0.14, 0.1, 0.025, 'steel');
  // Four glass panes meet actual mullions. The last bay remains an open entrance.
  for (const z of [-3.34, -1.64, 0.06, 1.76])
    box(1.87, 1.67, z, 0.026, 2.46, 1.51, 'glass');
  for (const z of [-4.1, -2.49, -0.79, 0.91, 2.52])
    cylinder(1.84, 1.67, z, 0.038, 2.56, 'steel', 0.038, 10);
  collide('rear-glazing', 1.87, -0.79, 0.1, 6.82, 2.95, 0.4, false);
  // Adult bench dimensions: 460 mm seat height, 425 mm depth, 3.7 m length.
  for (const x of [1.27, 1.38, 1.49, 1.6])
    bevel(x, 0.4325, 0, 0.095, 0.055, 3.7, 0.012, 'planks');
  for (const y of [0.72, 0.85, 0.98])
    bevel(1.66, y, 0.0, 0.055, 0.09, 3.7, 0.012, 'planks');
  for (const z of [-1.46, 0, 1.46]) {
    tube([1.24, 0, z], [1.24, 0.43, z], 0.035, 'steel', 8);
    tube([1.64, 0, z], [1.64, 0.96, z], 0.035, 'steel', 8);
    tube([1.24, 0.12, z], [1.64, 0.12, z], 0.028, 'steel', 8);
  }
  tube([1.26, 0.18, -1.62], [1.26, 0.18, 1.62], 0.026, 'steel', 8);
  collide('bench', 1.44, 0, 0.55, 3.88, 1.04);
  // A blank, sealed timetable case opposite the shelter; no type or logo.
  bevel(-1.68, 1.54, -2.7, 0.22, 2.22, 1.2, 0.035, 'steel');
  box(-1.55, 1.54, -2.7, 0.025, 1.94, 0.96, 'glass');
  for (const z of [-3.17, -2.23]) box(-1.52, 1.54, z, 0.04, 2.0, 0.045, 'rust');
  for (const y of [0.57, 2.51]) box(-1.52, y, -2.7, 0.04, 0.045, 1.0, 'rust');
  collide('blank-case', -1.68, -2.7, 0.24, 1.28, 2.65, 0.42, false);
  // Continuous gutter -> two elbows -> downpipe -> shoe into a grated inlet.
  tube([1.91, 3.22, -4.72], [1.91, 3.22, 4.72], 0.045, 'rust', 8);
  tube([1.91, 3.22, 4.55], [1.84, 3.03, 4.55], 0.045, 'rust', 8);
  tube([1.84, 3.03, 4.55], [1.84, 0.2, 4.55], 0.045, 'rust', 8);
  tube([1.84, 0.2, 4.55], [1.7, 0.1, 4.55], 0.045, 'rust', 8);
  for (const y of [0.52, 1.54, 2.56])
    box(1.88, y, 4.55, 0.08, 0.035, 0.16, 'steel');
  for (let z = 4.27; z <= 4.81; z += 0.09)
    box(1.69, 0.0125, z, 0.22, 0.025, 0.035, 'steel');
  return finish(k);
}

function underpass(): CivicLandmark {
  const k = kit('railway-underpass-bay'),
    { box, cylinder, bevel, tube, collide } = k;
  // 300 mm abutment walls fit the previous +/-2 m collision frame.
  for (const side of [-1, 1]) {
    box(side * 1.85, 2.08, 0, 0.3, 4.16, 12, 'concrete');
    collide(`wall-${side}`, side * 1.85, 0, 0.3, 12, 4.16);
    for (const z of [-5.05, -2.52, 0, 2.52, 5.05]) {
      bevel(side * 1.57, 2.02, z, 0.3, 4.04, 0.46, 0.055, 'concrete');
      collide(`pier-${side}-${z}`, side * 1.57, z, 0.3, 0.46, 4.04);
    }
    bevel(side * 1.3, 0.10, 0, 0.24, 0.2, 11.78, 0.04, 'concrete');
    collide(`curb-${side}`, side * 1.3, 0, 0.24, 11.78, 0.23);
    for (let z = -5.62; z <= 5.63; z += 0.34)
      box(side * 1.12, 0.0175, z, 0.26, 0.035, 0.055, 'steel');
  }
  // Full bridge soffit and transverse beams maintain 3.91 m minimum headroom.
  box(0, 4.24, 0, 4, 0.24, 12, 'concrete');
  for (const z of [-5.42, -3.62, -1.82, -0.02, 1.78, 3.58, 5.38])
    bevel(0, 4.08, z, 3.72, 0.34, 0.26, 0.05, 'concrete');
  // Real cable ladder: rails, rung spacing, three continuous cables and terminated ends.
  for (const side of [-1, 1]) {
    for (const x of [side * 1.43, side * 1.55])
      tube([x, 3.48, -5.46], [x, 3.48, 5.46], 0.025, 'steel', 8);
    for (let z = -5.4; z <= 5.41; z += 0.46)
      tube([side * 1.43, 3.48, z], [side * 1.55, 3.48, z], 0.018, 'steel', 6);
    for (const x of [side * 1.45, side * 1.49, side * 1.53])
      tube(
        [x, 3.52, -5.38],
        [x, 3.52, 5.38],
        0.013,
        x === side * 1.49 ? 'rust' : 'black',
        6,
      );
    // Drain stack reaches both the soffit branch and the side channel.
    tube(
      [side * 1.68, 0.12, 5.24],
      [side * 1.68, 3.78, 5.24],
      0.06,
      'rust',
      10,
    );
    tube(
      [side * 1.68, 3.78, 5.24],
      [side * 1.51, 4.02, 5.24],
      0.06,
      'rust',
      10,
    );
    tube([side * 1.68, 0.12, 5.24], [side * 1.5, 0.06, 5.24], 0.06, 'rust', 10);
  }
  // Recessed louver bay: frame, back plate and tilted blade rows.
  box(1.74, 1.65, -2.65, 0.08, 2.28, 1.92, 'black');
  bevel(1.64, 1.65, -2.65, 0.12, 2.48, 2.1, 0.03, 'steel');
  for (let y = 0.62; y <= 2.64; y += 0.15)
    bevel(1.54, y, -2.65, 0.05, 0.055, 1.88, 0.012, y < 0.83 ? 'rust' : 'dark');
  collide('louver-bay', 1.64, -2.65, 0.28, 2.1, 2.89, 0.41, false);
  // Round impact bollards match the old collision slots.
  for (const side of [-1, 1])
    for (const z of [-4.1, 4.1]) {
      cylinder(side * 1.25, 0.53, z, 0.11, 1.06, 'steel', 0.14, 12);
      collide(`bollard-${side}-${z}`, side * 1.25, z, 0.28, 0.28, 1.06);
    }
  // One shielded practical lamp, never a row of floodlights.
  bevel(1.6, 2.78, 0, 0.16, 0.3, 0.56, 0.035, 'dark');
  box(1.5, 2.78, 0, 0.025, 0.18, 0.4, 'coolLight');
  return finish(k);
}

function floodgate(): CivicLandmark {
  const k = kit('closed-floodgate-mechanism'),
    { box, cylinder, bevel, tube, collide } = k;
  // Side-channel slab only; the main path has no duplicate ground skin.
  bevel(1.52, 0.11, 0, 0.96, 0.22, 11.72, 0.045, 'concrete');
  for (const z of [-5.72, 5.72])
    bevel(1.52, 0.23, z, 0.96, 0.2, 0.24, 0.035, 'concrete');
  collide('channel-lip', 1.14, 0, 0.2, 11.72, 0.3);
  collide('channel-wall', 1.9, 0, 0.2, 11.72, 0.42);
  // Four round-shouldered piers and closed gate stay within x=1.085..1.995.
  for (const z of [-2.72, 2.72])
    for (const x of [1.26, 1.83]) {
      bevel(x, 1.48, z, 0.28, 2.96, 0.68, 0.075, 'concrete');
      cylinder(x, 2.96, z, 0.17, 0.1, 'concrete', 0.17, 12);
      collide(`pier-${x}-${z}`, x, z, 0.34, 0.7, 3.01);
    }
  box(1.55, 1.16, 0, 0.72, 2.02, 0.22, 'steel');
  for (let y = 0.28; y <= 2.05; y += 0.2)
    box(1.55, y, -0.14, 0.68, 0.055, 0.1, y < 0.52 ? 'rust' : 'dark');
  for (const x of [1.24, 1.4, 1.56, 1.72, 1.86])
    box(x, 1.16, -0.16, 0.045, 2.06, 0.08, 'steel');
  collide('closed-gate', 1.55, 0, 0.76, 0.3, 2.18, 0.12, false);
  // Crosshead, rack and sealed reduction gearbox.
  bevel(1.55, 3.18, 0, 0.86, 0.24, 0.5, 0.05, 'steel');
  box(1.55, 3.58, 0, 0.18, 0.72, 0.2, 'steel');
  for (let y = 2.23; y <= 3.94; y += 0.17)
    box(1.64, y, -0.14, 0.18, 0.065, 0.07, 'rust');
  bevel(1.55, 4.04, 0, 0.62, 0.5, 0.62, 0.085, 'dark');
  tube([1.55, 3.6, 0], [1.55, 4.29, 0], 0.055, 'rust', 10);
  // Handwheel faces the path (ring in Y/Z plane), connected to the gearbox shaft.
  const wx = 1.18,
    wy = 3.9,
    wz = -0.34,
    r = 0.38,
    ring = Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      return [wx, wy + Math.sin(a) * r, wz + Math.cos(a) * r] as const;
    });
  ring.forEach((p, i) =>
    tube(p, ring[(i + 1) % ring.length], 0.027, 'steel', 6),
  );
  for (let i = 0; i < 8; i++)
    tube([wx, wy, wz], ring[i * 2], 0.016, 'steel', 6);
  tube([wx, wy, wz], [1.55, wy, wz], 0.055, 'rust', 10);
  // West guard rail and toe curb; circular posts retain full diameters.
  bevel(-1.45, 0.09, 0, 0.7, 0.18, 11.28, 0.035, 'concrete');
  for (const x of [-1.82, -1.08])
    for (const z of [-5.12, 0, 5.12]) {
      cylinder(x, 0.6, z, 0.045, 1.2, 'steel', 0.045, 8);
      collide(`rail-post-${x}-${z}`, x, z, 0.11, 0.11, 1.2);
    }
  for (const x of [-1.82, -1.08])
    for (const y of [0.42, 1.12])
      tube([x, y, -5.12], [x, y, 5.12], 0.032, 'steel', 8);
  // Complete overflow/downpipe reaches its outlet rather than stopping mid-wall.
  tube([1.86, 3.0, 4.62], [1.86, 0.18, 4.62], 0.055, 'rust', 10);
  tube([1.86, 0.18, 4.62], [1.7, 0.08, 4.62], 0.055, 'rust', 10);
  return finish(k);
}

function apartmentFacade(): CivicLandmark {
  const k = kit('apartment-service-facade'),
    { box, cylinder, bevel, tube, collide } = k;
  // 200 mm opposing facade leaves use the same +/-2 m outer collision limits.
  for (const side of [-1, 1]) {
    for (const [z, d] of [
      [-4, 4],
      [4, 4],
    ] as const) {
      box(side * 1.9, 2.72, z, 0.2, 5.44, d, 'concrete');
      collide(`facade-${side}-${z}`, side * 1.9, z, 0.2, d, 5.44);
    }
    box(side * 1.96, 1.42, 0, 0.08, 2.84, 3.4, 'dark');
    bevel(side * 1.79, 4.74, 0, 0.14, 1.4, 3.52, 0.035, 'concrete');
    for (const z of [-1.79, 1.79])
      bevel(side * 1.78, 1.42, z, 0.14, 2.84, 0.16, 0.03, 'steel');
    for (let y = 0.27; y <= 2.59; y += 0.18)
      bevel(
        side * 1.7,
        y,
        0,
        0.05,
        0.06,
        3.22,
        0.012,
        y < 0.62 ? 'rust' : 'steel',
      );
    collide(`recess-${side}`, side * 1.96, 0, 0.08, 3.4, 2.84);
    collide(
      `louver-door-${side}`,
      side * 1.7,
      0,
      0.08,
      3.22,
      2.63,
      0.24,
      false,
    );
  }
  // East rainwater stack is complete: eaves branch, vertical pipe, clamps and shoe.
  tube([1.72, 5.2, -5.1], [1.72, 5.2, 5.1], 0.055, 'rust', 10);
  tube([1.72, 5.2, 4.92], [1.72, 0.18, 4.92], 0.055, 'rust', 10);
  tube([1.72, 0.18, 4.92], [1.55, 0.08, 4.92], 0.055, 'rust', 10);
  for (const y of [0.55, 1.65, 2.75, 3.85, 4.95])
    box(1.77, y, 4.92, 0.08, 0.035, 0.16, 'steel');
  // Four properly proportioned sealed utility meters and a connected cable trunk.
  for (const z of [-4.14, -3.38, 3.38, 4.14]) {
    bevel(1.71, 1.43, z, 0.28, 0.68, 0.54, 0.045, 'dark');
    box(1.54, 1.43, z, 0.025, 0.49, 0.37, 'glass');
    cylinder(1.51, 1.43, z, 0.034, 0.05, 'steel', 0.034, 10);
    tube([1.71, 1.77, z], [1.71, 4.35, z], 0.022, 'black', 6);
    tube(
      [1.71, 4.35, z],
      [1.58, 4.42, z < 0 ? -0.85 : 0.85],
      0.022,
      'black',
      6,
    );
    collide(`meter-${z}`, 1.66, z, 0.38, 0.58, 1.8, 1.08, false);
  }
  box(1.68, 4.42, 0, 0.12, 0.13, 10.28, 'black');
  // West outdoor condensers: 700h x 900w x 500d, fan axes point at the alley.
  for (const z of [-3.82, 3.82]) {
    bevel(-1.62, 0.10, z, 0.5, 0.2, 1.02, 0.035, 'concrete');
    bevel(-1.66, 0.55, z, 0.48, 0.7, 0.9, 0.065, 'enamel');
    const fx = -1.4,
      fy = 0.55,
      fr = 0.27,
      fan = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        return [fx, fy + Math.sin(a) * fr, z + Math.cos(a) * fr] as const;
      });
    fan.forEach((p, i) =>
      tube(p, fan[(i + 1) % fan.length], 0.018, 'steel', 6),
    );
    tube([-1.47, fy, z], [fx + 0.025, fy, z], 0.052, 'dark', 10);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      tube(
        [fx + 0.03, fy, z],
        [fx + 0.03, fy + Math.sin(a) * 0.22, z + Math.cos(a) * 0.22],
        0.025,
        'dark',
        6,
      );
    }
    for (const dz of [-0.42, 0.42])
      box(-1.41, 0.55, z + dz, 0.035, 0.56, 0.035, 'steel');
    for (const y of [0.29, 0.81]) box(-1.41, y, z, 0.035, 0.035, 0.86, 'steel');
    // Refrigerant pair and insulated return connect each unit to the wall trunk.
    tube([-1.84, 0.58, z + 0.34], [-1.9, 1.18, z + 0.34], 0.024, 'rust', 8);
    tube([-1.8, 0.54, z + 0.28], [-1.9, 1.08, z + 0.28], 0.035, 'black', 8);
    collide(`condenser-${z}`, -1.635, z, 0.54, 1.04, 0.91);
  }
  // Fire-escape landing and circular guard rails remain overhead and wall-side.
  box(-1.55, 3.2, 0, 0.86, 0.16, 3.7, 'steel');
  for (let z = -1.76; z <= 1.77; z += 0.28)
    box(-1.55, 3.31, z, 0.82, 0.045, 0.07, 'dark');
  for (const z of [-1.8, 1.8])
    for (const x of [-1.9, -1.2])
      cylinder(x, 3.82, z, 0.04, 1.18, 'steel', 0.04, 8);
  for (const x of [-1.9, -1.2])
    tube([x, 4.38, -1.8], [x, 4.38, 1.8], 0.032, 'steel', 8);
  for (const z of [-1.8, 1.8])
    tube([-1.9, 4.38, z], [-1.2, 4.38, z], 0.032, 'steel', 8);
  return finish(k);
}

function bounds(p: CivicPart) {
  if (p.kind === 'box' || p.kind === 'beveledBox') {
    const yaw = p.kind === 'beveledBox' ? (p.yaw ?? 0) : 0,
      c = Math.abs(Math.cos(yaw)),
      s = Math.abs(Math.sin(yaw)),
      hx = (p.w * c + p.d * s) / 2,
      hz = (p.w * s + p.d * c) / 2;
    return {
      minX: p.x - hx,
      maxX: p.x + hx,
      minY: p.y - p.h / 2,
      maxY: p.y + p.h / 2,
      minZ: p.z - hz,
      maxZ: p.z + hz,
    };
  }
  if (p.kind === 'cylinder') {
    const r = Math.max(p.r, p.rb);
    return {
      minX: p.x - r,
      maxX: p.x + r,
      minY: p.y - p.h / 2,
      maxY: p.y + p.h / 2,
      minZ: p.z - r,
      maxZ: p.z + r,
    };
  }
  return {
    minX: Math.min(p.from[0], p.to[0]) - p.radius,
    maxX: Math.max(p.from[0], p.to[0]) + p.radius,
    minY: Math.min(p.from[1], p.to[1]) - p.radius,
    maxY: Math.max(p.from[1], p.to[1]) + p.radius,
    minZ: Math.min(p.from[2], p.to[2]) - p.radius,
    maxZ: Math.max(p.from[2], p.to[2]) + p.radius,
  };
}
function finish(k: ReturnType<typeof kit>): CivicLandmark {
  const order: CivicMaterial[] = [
    'concrete',
    'enamel',
    'stone',
    'steel',
    'rust',
    'dark',
    'black',
    'wood',
    'planks',
    'glass',
    'light',
    'coolLight',
  ];
  k.parts.sort((a, b) => order.indexOf(a.material) - order.indexOf(b.material));
  const raw = k.parts
      .map(bounds)
      .reduce((a, b) => ({
        minX: Math.min(a.minX, b.minX),
        maxX: Math.max(a.maxX, b.maxX),
        minY: Math.min(a.minY, b.minY),
        maxY: Math.max(a.maxY, b.maxY),
        minZ: Math.min(a.minZ, b.minZ),
        maxZ: Math.max(a.maxZ, b.maxZ),
      })),
    clean = (n: number) => Math.round(n * 1e6) / 1e6;
  const envelope = {
    minX: clean(raw.minX),
    maxX: clean(raw.maxX),
    minY: clean(raw.minY),
    maxY: clean(raw.maxY),
    minZ: clean(raw.minZ),
    maxZ: clean(raw.maxZ),
  };
  const ceiling = k.parts
      .map(bounds)
      .filter((b) => b.maxX > -0.8 && b.minX < 0.8 && b.minY > 0.2)
      .reduce((n, b) => Math.min(n, b.minY), Infinity),
    overhead = Number.isFinite(ceiling) ? ceiling : null;
  return {
    id: k.id,
    envelope,
    clearances: {
      mainAxisMinX: -0.8,
      mainAxisMaxX: 0.8,
      mainAxisWidth: 1.6,
      overhead,
    },
    parts: k.parts,
    colliders: k.colliders,
    foundations: k.foundations,
  };
}

export const CIVIC_LANDMARK_IDS: readonly CivicLandmarkId[] = [
  'weathered-bus-shelter',
  'railway-underpass-bay',
  'closed-floodgate-mechanism',
  'apartment-service-facade',
];
export function createCivicLandmark(id: CivicLandmarkId): CivicLandmark {
  return id === 'weathered-bus-shelter'
    ? busShelter()
    : id === 'railway-underpass-bay'
      ? underpass()
      : id === 'closed-floodgate-mechanism'
        ? floodgate()
        : apartmentFacade();
}
export function civicLandmarkStats(id: CivicLandmarkId) {
  const l = createCivicLandmark(id),
    counts = { box: 0, cylinder: 0, beveledBox: 0, tube: 0 },
    materials = new Set<CivicMaterial>();
  let triangles = 0;
  for (const p of l.parts) {
    counts[p.kind]++;
    materials.add(p.material);
    triangles +=
      p.kind === 'box'
        ? 12
        : p.kind === 'beveledBox'
          ? 44
          : p.kind === 'tube'
            ? p.segments * 2
            : p.segments * 4;
  }
  return {
    id,
    parts: l.parts.length,
    counts,
    triangles,
    materialBatches: materials.size,
    colliders: l.colliders.length,
    foundations: l.foundations.length,
    envelope: l.envelope,
    clearances: l.clearances,
  };
}
export const CIVIC_LANDMARK_STATS = CIVIC_LANDMARK_IDS.map(civicLandmarkStats);

/** Emits final-size geometry. The integrator must not apply the old scale(.5,1,1). */
export function buildCivicLandmark(
  id: CivicLandmarkId,
  b: CivicBuilder,
  p: CivicPlacement = {},
) {
  const l = createCivicLandmark(id),
    q = p.quarterTurns ?? 0,
    a = (q * Math.PI) / 2,
    c = Math.cos(a),
    s = Math.sin(a),
    ox = p.x ?? 0,
    oy = p.y ?? 0,
    oz = p.z ?? 0;
  const point = (x: number, y: number, z: number): [number, number, number] => [
    ox + x * c - z * s,
    oy + y,
    oz + x * s + z * c,
  ];
  for (const part of l.parts) {
    if (part.kind === 'box') {
      const [x, y, z] = point(part.x, part.y, part.z),
        swap = q % 2 === 1;
      b.box(
        x,
        y,
        z,
        swap ? part.d : part.w,
        part.h,
        swap ? part.w : part.d,
        part.material,
      );
    } else if (part.kind === 'cylinder') {
      const [x, y, z] = point(part.x, part.y, part.z);
      b.cylinder(
        x,
        y,
        z,
        part.r,
        part.h,
        part.material,
        part.rb,
        part.segments,
      );
    } else if (part.kind === 'beveledBox') {
      const [x, y, z] = point(part.x, part.y, part.z);
      b.add({ ...part, x, y, z, yaw: (part.yaw ?? 0) + a }, part.material);
    } else
      b.add(
        { ...part, from: point(...part.from), to: point(...part.to) },
        part.material,
      );
  }
  return l;
}

export function placedCivicFootprints(
  id: CivicLandmarkId,
  p: CivicPlacement = {},
) {
  const l = createCivicLandmark(id),
    q = p.quarterTurns ?? 0,
    ox = p.x ?? 0,
    oy = p.y ?? 0,
    oz = p.z ?? 0;
  const rect = <T extends CivicCollider | CivicFoundation>(r: T) => {
    const ps = [
        [r.minX, r.minZ],
        [r.maxX, r.minZ],
        [r.maxX, r.maxZ],
        [r.minX, r.maxZ],
      ].map(([x, z]) => {
        for (let i = 0; i < q; i++) [x, z] = [-z, x];
        return [ox + x, oz + z] as const;
      }),
      base: CivicCollider | CivicFoundation = r;
    const y =
      'topY' in base
        ? { topY: base.topY + oy }
        : {
            minY: base.minY === undefined ? undefined : base.minY + oy,
            maxY: base.maxY === undefined ? undefined : base.maxY + oy,
          };
    return {
      ...r,
      ...y,
      minX: Math.min(...ps.map((v) => v[0])),
      maxX: Math.max(...ps.map((v) => v[0])),
      minZ: Math.min(...ps.map((v) => v[1])),
      maxZ: Math.max(...ps.map((v) => v[1])),
    };
  };
  return {
    colliders: l.colliders.map(rect),
    foundations: l.foundations.map(rect),
  };
}
