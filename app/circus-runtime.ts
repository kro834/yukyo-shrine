import type {
  CircusDevice,
  CircusDeviceState,
  CircusPlan,
  CircusPoint,
  CircusPosition,
  CircusSnapshot,
  CircusStation,
} from './circus-types.ts';

export type Obstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
};
export type CircusOccupant = CircusPoint & { y?: number };
export type CircusNear = { id: string; label: string };
export type CircusInteraction = {
  handled: boolean;
  message: string;
  position?: CircusPosition;
};
export type CircusStep = {
  position?: CircusPosition;
  arrived?: boolean;
  lure?: CircusPoint;
};

export const CIRCUS_RUNTIME_DIMENSIONS = {
  cart: { width: 1.18, length: 1.8, minY: 0, maxY: 1.55 },
  curtain: {
    width: 2.8,
    thickness: 0.11,
    openFraction: 0.14,
    travel: 0.6,
    minY: 0.18,
    maxY: 3.05,
  },
  turntable: {
    radius: 1.285,
    height: 0.08,
    wallWidth: 2.4,
    wallThickness: 0.1,
    wallMinY: 0.11,
    wallMaxY: 2.3,
  },
  drawbridge: {
    width: 1.5,
    length: 3.2,
    hingeThickness: 0.21,
    minY: 0,
    maxY: 3.32,
  },
  lure: { clearanceRadius: 0.65, headBottomY: 2.33 },
  sweepRadius: 2.4,
  interactionRadius: 2.8,
} as const;

const CART_Y = 1.35;
const EXIT_Y = 1.68;
const MAX_SPEED = 7;
const ACCELERATION = 3.5;
const BRAKING = 4.5;
const MAX_STEP_SECONDS = 30;
const SUBSTEP_SECONDS = 1 / 30;
const ARRIVAL_EPSILON = 1e-4;
const FACING_DOT = Math.cos((65 * Math.PI) / 180);

type Segment = {
  a: CircusPoint;
  b: CircusPoint;
  dx: number;
  dz: number;
  length: number;
  start: number;
};
type DeviceRuntime = CircusDeviceState & { device: CircusDevice };

const finitePoint = (p: CircusPoint) =>
  Number.isFinite(p.x) && Number.isFinite(p.z);
const distance2 = (a: CircusPoint, b: CircusPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Pure state for the circus cart and four mechanisms. Rendering, audio, input
 * binding, free look, pause ownership and enemy dispatch stay with the world.
 */
export class CircusRuntime {
  readonly plan: CircusPlan;
  private readonly segments: Segment[];
  private readonly stationDistances: number[];
  private readonly totalLength: number;
  private readonly devices: DeviceRuntime[];
  private cartDistance = 0;
  private cartSpeed = 0;
  private cartMoving = false;
  private currentStation = 0;
  private destinationStation = 0;
  private passenger = false;
  private pendingLure?: CircusPoint;
  private readonly blockerCache = new Map<
    boolean,
    { signature: string; obstacles: Obstacle[] }
  >();

  constructor(plan: CircusPlan) {
    this.plan = validatePlan(plan);
    this.segments = makeSegments(this.plan.track);
    this.totalLength = this.segments.reduce(
      (sum, segment) => sum + segment.length,
      0,
    );
    this.stationDistances = this.plan.stations.map((station) =>
      projectDistance(station.position, this.segments),
    );
    this.devices = this.plan.devices.map((device) => ({
      device,
      id: device.id,
      progress: 0,
      target: 0,
    }));
    this.reset();
  }

  get riding() {
    return this.passenger;
  }

  snapshot(): CircusSnapshot {
    const sample = this.sample(this.cartDistance);
    return {
      cart: { x: sample.x, y: CART_Y, z: sample.z },
      yaw: sample.yaw,
      speed: this.cartSpeed,
      riding: this.passenger,
      moving: this.cartMoving,
      station: this.currentStation,
      destination: this.destinationStation,
      distance: this.cartDistance,
      totalLength: this.totalLength,
      devices: this.devices.map(({ id, progress, target }) => ({
        id,
        progress,
        target,
      })),
    };
  }

  near(player: CircusPosition, yaw: number): CircusNear | null {
    if (this.passenger) return { id: 'cart', label: '次の駅で自動降車' };
    if (
      !validPlayer(player) ||
      !Number.isFinite(yaw) ||
      !isGroundOccupant(player)
    )
      return null;
    const options: { distance: number; near: CircusNear }[] = [];
    this.plan.stations.forEach((station, index) => {
      const d = distance2(player, station.position);
      if (
        d <= CIRCUS_RUNTIME_DIMENSIONS.interactionRadius &&
        faces(player, yaw, station.position, d)
      ) {
        const here = !this.cartMoving && this.currentStation === index;
        options.push({
          distance: d,
          near: {
            id: `station:${station.id}`,
            label: here
              ? `〇 ${station.name}から乗車`
              : `〇 ${station.name}へトロッコを呼ぶ`,
          },
        });
      }
    });
    this.devices.forEach(({ device, progress, target }) => {
      const d = distance2(player, device.control);
      if (
        d > CIRCUS_RUNTIME_DIMENSIONS.interactionRadius ||
        !faces(player, yaw, device.control, d)
      )
        return;
      const opening = target > progress;
      const verb =
        device.kind === 'turntable'
          ? target > 0.5
            ? '回転板を戻す'
            : '回転板を90°回す'
          : device.kind === 'lure'
            ? target > 0.5
              ? '誘導灯を消す'
              : '誘導灯を点ける'
            : opening
              ? '閉じる'
              : '開く';
      options.push({
        distance: d,
        near: {
          id: `device:${device.id}`,
          label: `〇 ${device.name}を${verb}`,
        },
      });
    });
    options.sort(
      (a, b) => a.distance - b.distance || a.near.id.localeCompare(b.near.id),
    );
    return options[0]?.near ?? null;
  }

  interact(player: CircusPosition, yaw: number): CircusInteraction {
    if (this.passenger)
      return { handled: true, message: '走行中です。次の駅で自動降車します。' };
    const nearby = this.near(player, yaw);
    if (!nearby)
      return {
        handled: false,
        message: '操作台か駅の正面へ近づいてください。',
      };
    if (nearby.id.startsWith('station:')) {
      const id = nearby.id.slice('station:'.length),
        index = this.plan.stations.findIndex((station) => station.id === id);
      if (index < 0) return { handled: false, message: '駅を利用できません。' };
      if (!this.cartMoving && this.currentStation === index) {
        const next = this.nextStation(index);
        this.passenger = true;
        this.destinationStation = next;
        this.currentStation = -1;
        this.cartMoving = true;
        return {
          handled: true,
          message: `${this.plan.stations[next].name}へ出発します。`,
          position: this.cartPosition(),
        };
      }
      this.destinationStation = index;
      this.currentStation = -1;
      this.cartMoving = true;
      return {
        handled: true,
        message: `${this.plan.stations[index].name}へトロッコを呼びました。`,
      };
    }
    const id = nearby.id.slice('device:'.length),
      state = this.devices.find((entry) => entry.id === id);
    if (!state) return { handled: false, message: '装置を利用できません。' };
    state.target = state.target > 0.5 ? 0 : 1;
    if (state.device.kind === 'lure' && state.target === 1)
      this.pendingLure = { ...state.device.position };
    return {
      handled: true,
      message: deviceMessage(state.device, state.target),
    };
  }

  step(dt: number, occupants: readonly CircusOccupant[] = []): CircusStep {
    const result: CircusStep = {};
    if (!Number.isFinite(dt) || dt <= 0) {
      if (this.passenger) result.position = this.cartPosition();
      return result;
    }
    if (this.pendingLure) {
      result.lure = { ...this.pendingLure };
      this.pendingLure = undefined;
    }
    let remainingTime = Math.min(dt, MAX_STEP_SECONDS);
    while (remainingTime > 1e-9) {
      const slice = Math.min(remainingTime, SUBSTEP_SECONDS);
      remainingTime -= slice;
      this.stepDevices(slice, occupants);
      if (this.cartMoving) {
        const arrival = this.stepCart(slice, occupants);
        if (arrival) {
          result.arrived = true;
          if (arrival.dismount) result.position = arrival.dismount;
        }
      }
    }
    if (this.passenger) result.position = this.cartPosition();
    return result;
  }

  blockers(includeCart = true): Obstacle[] {
    const signature = this.blockerSignature(includeCart);
    const cached = this.blockerCache.get(includeCart);
    if (cached?.signature === signature) return cached.obstacles;
    const obstacles: Obstacle[] = [];
    if (includeCart) {
      const cart = this.sample(this.cartDistance);
      obstacles.push(
        orientedRect(
          cart,
          CIRCUS_RUNTIME_DIMENSIONS.cart.width,
          CIRCUS_RUNTIME_DIMENSIONS.cart.length,
          cart.yaw,
          CIRCUS_RUNTIME_DIMENSIONS.cart.minY,
          CIRCUS_RUNTIME_DIMENSIONS.cart.maxY,
        ),
      );
    }
    for (const state of this.devices) {
      const { device, progress } = state;
      if (device.kind === 'curtain') {
        const panelWidth =
          (CIRCUS_RUNTIME_DIMENSIONS.curtain.width / 2) *
          (1 - (1 - CIRCUS_RUNTIME_DIMENSIONS.curtain.openFraction) * progress);
        const centerOffset =
          CIRCUS_RUNTIME_DIMENSIONS.curtain.width / 4 +
          CIRCUS_RUNTIME_DIMENSIONS.curtain.travel * progress;
        for (const side of [-1, 1]) {
          const center = localPoint(
            device.position,
            device.yaw,
            side * centerOffset,
            0,
          );
          obstacles.push(
            orientedRect(
              center,
              panelWidth,
              CIRCUS_RUNTIME_DIMENSIONS.curtain.thickness,
              device.yaw,
              CIRCUS_RUNTIME_DIMENSIONS.curtain.minY,
              CIRCUS_RUNTIME_DIMENSIONS.curtain.maxY,
            ),
          );
        }
      } else if (device.kind === 'turntable') {
        obstacles.push(
          orientedRect(
            device.position,
            CIRCUS_RUNTIME_DIMENSIONS.turntable.wallWidth,
            CIRCUS_RUNTIME_DIMENSIONS.turntable.wallThickness,
            device.yaw + progress * (Math.PI / 2),
            CIRCUS_RUNTIME_DIMENSIONS.turntable.wallMinY,
            CIRCUS_RUNTIME_DIMENSIONS.turntable.wallMaxY,
          ),
        );
      } else if (device.kind === 'drawbridge' && progress > 1e-6) {
        const depth =
          CIRCUS_RUNTIME_DIMENSIONS.drawbridge.hingeThickness +
          CIRCUS_RUNTIME_DIMENSIONS.drawbridge.length *
            Math.cos((progress * Math.PI) / 2);
        const center = localPoint(
          device.position,
          device.yaw,
          0,
          (-CIRCUS_RUNTIME_DIMENSIONS.drawbridge.length / 2) *
            (1 - Math.cos((progress * Math.PI) / 2)),
        );
        obstacles.push(
          orientedRect(
            center,
            CIRCUS_RUNTIME_DIMENSIONS.drawbridge.width,
            depth,
            device.yaw,
            CIRCUS_RUNTIME_DIMENSIONS.drawbridge.minY,
            CIRCUS_RUNTIME_DIMENSIONS.drawbridge.maxY,
          ),
        );
      }
    }
    this.blockerCache.set(includeCart, { signature, obstacles });
    return obstacles;
  }

  reset() {
    this.passenger = false;
    this.cartSpeed = 0;
    this.cartMoving = false;
    this.currentStation = 0;
    this.destinationStation = 0;
    this.cartDistance = this.stationDistances[0];
    this.pendingLure = undefined;
    for (const state of this.devices) state.progress = state.target = 0;
  }

  private stepDevices(dt: number, occupants: readonly CircusOccupant[]) {
    for (const state of this.devices) {
      if (Math.abs(state.target - state.progress) <= 1e-8) continue;
      if (
        state.device.kind !== 'lure' &&
        occupants.some(
          (occupant) =>
            validOccupant(occupant) &&
            isGroundOccupant(occupant) &&
            distance2(occupant, state.device.position) <=
              CIRCUS_RUNTIME_DIMENSIONS.sweepRadius,
        )
      )
        continue;
      const rate =
        state.device.kind === 'curtain'
          ? 0.72
          : state.device.kind === 'turntable'
            ? 0.5
            : state.device.kind === 'drawbridge'
              ? 0.4
              : 2;
      state.progress = clamp01(
        state.progress +
          Math.sign(state.target - state.progress) *
            Math.min(Math.abs(state.target - state.progress), rate * dt),
      );
    }
  }

  private stepCart(
    dt: number,
    occupants: readonly CircusOccupant[],
  ): { dismount?: CircusPosition } | null {
    const targetDistance = this.stationDistances[this.destinationStation];
    const remaining = forwardDistance(
      this.cartDistance,
      targetDistance,
      this.totalLength,
    );
    if (remaining <= ARRIVAL_EPSILON) {
      this.cartSpeed = 0;
      return this.exitIsClear(occupants) ? this.arrive() : null;
    }
    const occupantClearance = this.cartOccupantClearance(occupants);
    const safeRemaining = Math.min(remaining, occupantClearance);
    if (safeRemaining <= ARRIVAL_EPSILON) {
      this.cartSpeed = 0;
      return null;
    }
    const desired = Math.min(MAX_SPEED, Math.sqrt(2 * BRAKING * safeRemaining));
    const previous = this.cartSpeed;
    if (this.cartSpeed < desired)
      this.cartSpeed = Math.min(desired, this.cartSpeed + ACCELERATION * dt);
    else this.cartSpeed = Math.max(desired, this.cartSpeed - BRAKING * dt);
    const travel = Math.min(
      safeRemaining,
      ((previous + this.cartSpeed) / 2) * dt,
    );
    this.cartDistance = wrapDistance(
      this.cartDistance + travel,
      this.totalLength,
    );
    if (travel >= remaining - ARRIVAL_EPSILON) {
      this.cartDistance = targetDistance;
      this.cartSpeed = 0;
      return this.exitIsClear(occupants) ? this.arrive() : null;
    }
    return null;
  }

  private arrive() {
    const station = this.plan.stations[this.destinationStation];
    this.cartDistance = this.stationDistances[this.destinationStation];
    this.cartSpeed = 0;
    this.cartMoving = false;
    this.currentStation = this.destinationStation;
    if (!this.passenger) return {};
    this.passenger = false;
    return { dismount: { x: station.exit.x, y: EXIT_Y, z: station.exit.z } };
  }

  private nextStation(from: number) {
    let winner = from,
      best = Infinity;
    for (let i = 0; i < this.stationDistances.length; i++) {
      if (i === from) continue;
      const distance = forwardDistance(
        this.stationDistances[from],
        this.stationDistances[i],
        this.totalLength,
      );
      if (distance < best) {
        best = distance;
        winner = i;
      }
    }
    return winner;
  }

  private sample(distance: number) {
    const d = wrapDistance(distance, this.totalLength);
    let segment = this.segments[this.segments.length - 1];
    for (const candidate of this.segments) {
      if (
        d < candidate.start + candidate.length ||
        candidate === this.segments[this.segments.length - 1]
      ) {
        segment = candidate;
        break;
      }
    }
    const t = Math.max(0, Math.min(1, (d - segment.start) / segment.length));
    return {
      x: segment.a.x + segment.dx * t,
      z: segment.a.z + segment.dz * t,
      yaw: Math.atan2(segment.dx, segment.dz),
    };
  }

  private cartPosition(): CircusPosition {
    const p = this.sample(this.cartDistance);
    return { x: p.x, y: CART_Y, z: p.z };
  }

  private cartOccupantClearance(occupants: readonly CircusOccupant[]) {
    const lateralLimit = CIRCUS_RUNTIME_DIMENSIONS.cart.width / 2 + 0.35;
    const longitudinalMargin = CIRCUS_RUNTIME_DIMENSIONS.cart.length / 2 + 0.8;
    let clearance = Infinity;
    for (const occupant of occupants) {
      if (!validOccupant(occupant) || !isGroundOccupant(occupant)) continue;
      const projected = projectTrackPoint(occupant, this.segments);
      if (projected.error > lateralLimit) continue;
      const ahead = forwardDistance(
        this.cartDistance,
        projected.distance,
        this.totalLength,
      );
      if (ahead > this.totalLength / 2) continue;
      clearance = Math.min(clearance, Math.max(0, ahead - longitudinalMargin));
    }
    return clearance;
  }

  private exitIsClear(occupants: readonly CircusOccupant[]) {
    if (!this.passenger) return true;
    const exit = this.plan.stations[this.destinationStation].exit;
    return !occupants.some(
      (occupant) =>
        validOccupant(occupant) &&
        isGroundOccupant(occupant) &&
        distance2(occupant, exit) < 0.85,
    );
  }

  private blockerSignature(includeCart: boolean) {
    const movingDevices = this.devices
      .filter(
        ({ device }) =>
          device.kind === 'curtain' ||
          device.kind === 'turntable' ||
          device.kind === 'drawbridge',
      )
      .map(({ id, progress }) => `${id}:${progress}`)
      .join('|');
    return `${includeCart ? this.cartDistance : 'no-cart'}|${movingDevices}`;
  }
}

function validatePlan(plan: CircusPlan): CircusPlan {
  if (!plan || plan.track.length < 3 || plan.stations.length < 2)
    throw new Error(
      'CircusPlan needs a closed track and at least two stations.',
    );
  if (
    ![
      ...plan.track,
      ...plan.stations.flatMap((station) => [station.position, station.exit]),
    ].every(finitePoint)
  )
    throw new Error('CircusPlan contains a non-finite point.');
  const ids = [
    ...plan.stations.map((station) => station.id),
    ...plan.devices.map((device) => device.id),
  ];
  if (new Set(ids).size !== ids.length)
    throw new Error('CircusPlan IDs must be unique.');
  if (
    plan.devices.some(
      (device) =>
        !finitePoint(device.position) ||
        !finitePoint(device.control) ||
        !Number.isFinite(device.yaw),
    )
  )
    throw new Error('CircusPlan contains an invalid device.');
  return {
    track: plan.track.map((point) => ({ ...point })),
    stations: plan.stations.map((station) => ({
      ...station,
      position: { ...station.position },
      exit: { ...station.exit },
    })),
    devices: plan.devices.map((device) => ({
      ...device,
      position: { ...device.position },
      control: { ...device.control },
    })),
  };
}

function makeSegments(track: readonly CircusPoint[]) {
  const segments: Segment[] = [];
  let start = 0;
  for (let i = 0; i < track.length; i++) {
    const a = track[i],
      b = track[(i + 1) % track.length],
      dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    if (length <= 1e-6) continue;
    segments.push({ a, b, dx, dz, length, start });
    start += length;
  }
  if (segments.length < 3 || start <= 1e-6)
    throw new Error('CircusPlan track has insufficient non-zero segments.');
  return segments;
}

function projectDistance(point: CircusPoint, segments: readonly Segment[]) {
  return projectTrackPoint(point, segments).distance;
}

function projectTrackPoint(point: CircusPoint, segments: readonly Segment[]) {
  let distance = 0,
    best = Infinity;
  for (const segment of segments) {
    const t = clamp01(
      ((point.x - segment.a.x) * segment.dx +
        (point.z - segment.a.z) * segment.dz) /
        (segment.length * segment.length),
    );
    const x = segment.a.x + segment.dx * t,
      z = segment.a.z + segment.dz * t,
      error = Math.hypot(point.x - x, point.z - z);
    if (error < best) {
      best = error;
      distance = segment.start + segment.length * t;
    }
  }
  return { distance, error: best };
}

function wrapDistance(distance: number, total: number) {
  return ((distance % total) + total) % total;
}
function forwardDistance(from: number, to: number, total: number) {
  const distance = wrapDistance(to - from, total);
  return distance < ARRIVAL_EPSILON ? 0 : distance;
}
function validPlayer(player: CircusPosition) {
  return finitePoint(player) && Number.isFinite(player.y);
}
function validOccupant(occupant: CircusOccupant) {
  return (
    finitePoint(occupant) &&
    (occupant.y === undefined || Number.isFinite(occupant.y))
  );
}
function isGroundOccupant(occupant: CircusOccupant) {
  return occupant.y === undefined || (occupant.y >= -0.5 && occupant.y <= 2.2);
}
function faces(
  player: CircusPoint,
  yaw: number,
  target: CircusPoint,
  distance = distance2(player, target),
) {
  if (distance < 0.15) return true;
  const dx = (target.x - player.x) / distance,
    dz = (target.z - player.z) / distance;
  return -Math.sin(yaw) * dx - Math.cos(yaw) * dz >= FACING_DOT;
}
function localPoint(
  origin: CircusPoint,
  yaw: number,
  x: number,
  z: number,
): CircusPoint {
  return {
    x: origin.x + x * Math.cos(yaw) - z * Math.sin(yaw),
    z: origin.z + x * Math.sin(yaw) + z * Math.cos(yaw),
  };
}
function orientedRect(
  center: CircusPoint,
  width: number,
  depth: number,
  yaw: number,
  minY: number,
  maxY: number,
): Obstacle {
  const hx =
    (Math.abs(Math.cos(yaw)) * width + Math.abs(Math.sin(yaw)) * depth) / 2;
  const hz =
    (Math.abs(Math.sin(yaw)) * width + Math.abs(Math.cos(yaw)) * depth) / 2;
  return {
    minX: center.x - hx,
    maxX: center.x + hx,
    minZ: center.z - hz,
    maxZ: center.z + hz,
    minY,
    maxY,
  };
}
function deviceMessage(device: CircusDevice, target: number) {
  if (device.kind === 'turntable')
    return target
      ? `${device.name}を90°回転します。`
      : `${device.name}を基準位置へ戻します。`;
  if (device.kind === 'lure')
    return target
      ? `${device.name}を点灯しました。`
      : `${device.name}を消灯しました。`;
  return `${device.name}を${target ? '開きます' : '閉じます'}。`;
}
