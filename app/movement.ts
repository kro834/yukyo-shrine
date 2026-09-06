import {nearbyObstacles} from './spatial.ts';
export type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number; minY?:number; maxY?:number };
export type Position = { x: number; z: number };
export const RADIUS = 0.42;
export const WALK_SPEED = 3.4;
export const SPRINT_SPEED = 9.2;
export const BOUNDS = { minX: -196, maxX: 196, minZ: -284, maxZ: 38 };

export function stick(x = 0, y = 0, deadzone = 0.16): Position {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, z: 0 };
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, z: 0 };
  const magnitude = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: x / length * magnitude, z: y / length * magnitude };
}

export function movePlayer(position: Position, x: number, z: number, yaw: number, sprint: boolean, delta: number, obstacles: Obstacle[]) {
  const magnitude = Math.max(1, Math.hypot(x, z));
  const distance = (sprint ? SPRINT_SPEED : WALK_SPEED) * Math.max(0, Math.min(delta, 0.05));
  const dx = (Math.cos(yaw) * x + Math.sin(yaw) * z) / magnitude * distance;
  const dz = (-Math.sin(yaw) * x + Math.cos(yaw) * z) / magnitude * distance;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (RADIUS * 0.45)));
  const next = { ...position };
  const nearby=nearbyObstacles(obstacles,Math.min(position.x,position.x+dx)-RADIUS,Math.min(position.z,position.z+dz)-RADIUS,Math.max(position.x,position.x+dx)+RADIUS,Math.max(position.z,position.z+dz)+RADIUS);
  const blocked = (px: number, pz: number) => nearby.some(o => px > o.minX - RADIUS && px < o.maxX + RADIUS && pz > o.minZ - RADIUS && pz < o.maxZ + RADIUS);
  for (let i = 0; i < steps; i++) {
    const px = Math.max(BOUNDS.minX + RADIUS, Math.min(BOUNDS.maxX - RADIUS, next.x + dx / steps));
    if (!blocked(px, next.z)) next.x = px;
    const pz = Math.max(BOUNDS.minZ + RADIUS, Math.min(BOUNDS.maxZ - RADIUS, next.z + dz / steps));
    if (!blocked(next.x, pz)) next.z = pz;
  }
  return next;
}
