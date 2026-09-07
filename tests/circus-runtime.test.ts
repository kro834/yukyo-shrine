import test from 'node:test';
import assert from 'node:assert/strict';
import { CircusRuntime, CIRCUS_RUNTIME_DIMENSIONS } from '../app/circus-runtime.ts';
import { circusTrackPoints } from '../app/circus-plan.ts';
import type {
  CircusPlan,
  CircusPoint,
  CircusPosition,
} from '../app/circus-types.ts';

const plan: CircusPlan = {
  track: circusTrackPoints(),
  stations: [
    {
      id: 'south',
      name: '南駅',
      position: { x: 0, z: 32 },
      exit: { x: 0, z: 30.75 },
    },
    {
      id: 'west',
      name: '西駅',
      position: { x: -32, z: 0 },
      exit: { x: -30.75, z: 0 },
    },
    {
      id: 'north',
      name: '北駅',
      position: { x: 0, z: -32 },
      exit: { x: 0, z: -30.75 },
    },
    {
      id: 'east',
      name: '東駅',
      position: { x: 32, z: 0 },
      exit: { x: 30.75, z: 0 },
    },
  ],
  devices: [
    {
      id: 'curtain',
      name: '安全幕',
      kind: 'curtain',
      position: { x: 0, z: -16 },
      control: { x: 0, z: -12.85 },
      yaw: 0,
    },
    {
      id: 'turntable',
      name: '回転板',
      kind: 'turntable',
      position: { x: 0, z: 0 },
      control: { x: 0, z: 3.15 },
      yaw: 0,
    },
    {
      id: 'bridge',
      name: '跳ね橋',
      kind: 'drawbridge',
      position: { x: 16, z: 0 },
      control: { x: 12.85, z: 0 },
      yaw: Math.PI / 2,
    },
    {
      id: 'lure',
      name: '誘導灯',
      kind: 'lure',
      position: { x: -16, z: 0 },
      control: { x: -12.85, z: 0 },
      yaw: 0,
    },
  ],
};

const at = (p: CircusPoint, y = 1.68): CircusPosition => ({ ...p, y });
const face = (from: CircusPoint, to: CircusPoint) =>
  Math.atan2(-(to.x - from.x), -(to.z - from.z));
const interactAtStation = (runtime: CircusRuntime, index: number) => {
  const station = plan.stations[index];
  return runtime.interact(at(station.position), 0);
};
const runUntilArrival = (runtime: CircusRuntime, limit = 3000) => {
  for (let i = 0; i < limit; i++) {
    const result = runtime.step(1 / 30);
    if (result.arrived) return result;
  }
  assert.fail('cart did not arrive');
};

test('cart rides the complete closed loop station by station without exceeding 7 m/s', () => {
  const runtime = new CircusRuntime(plan);
  const initial = runtime.snapshot();
  for (let station = 0; station < plan.stations.length; station++) {
    const interaction = interactAtStation(runtime, station);
    assert.equal(interaction.handled, true);
    assert.equal(runtime.riding, true);
    let peak = 0;
    for (;;) {
      const result = runtime.step(1 / 30);
      peak = Math.max(peak, runtime.snapshot().speed);
      if (result.arrived) break;
    }
    assert.ok(peak > 0 && peak <= 7);
    assert.equal(runtime.riding, false);
    assert.equal(
      runtime.snapshot().station,
      (station + 1) % plan.stations.length,
    );
  }
  assert.ok(Math.abs(runtime.snapshot().distance - initial.distance) < 1e-6);
});

test('a remote station calls the empty cart, then boarding reaches its safe exit', () => {
  const runtime = new CircusRuntime(plan),
    north = plan.stations[2];
  const called = runtime.interact(at(north.position), 0);
  assert.match(called.message, /呼びました/);
  assert.equal(runtime.riding, false);
  const emptyArrival = runUntilArrival(runtime);
  assert.equal(emptyArrival.position, undefined);
  assert.equal(runtime.snapshot().station, 2);
  const boarded = runtime.interact(at(north.position), 0);
  assert.ok(boarded.position);
  assert.equal(boarded.position?.y, 1.35);
  const exit = plan.stations[3].exit;
  for (let i = 0; i < 3000; i++) runtime.step(1 / 30, [{ ...exit, y: 1.68 }]);
  assert.equal(
    runtime.riding,
    true,
    'occupied station exit must delay dismount',
  );
  const arrival = runUntilArrival(runtime);
  assert.deepEqual(arrival.position, { ...exit, y: 1.68 });
  assert.equal(runtime.riding, false);
});

test('zero, NaN and giant dt stay finite; pause is represented by not stepping; reset releases rider', () => {
  const runtime = new CircusRuntime(plan);
  interactAtStation(runtime, 0);
  const beforePause = runtime.snapshot();
  assert.deepEqual(runtime.snapshot(), beforePause);
  runtime.step(0);
  runtime.step(Number.NaN);
  assert.deepEqual(runtime.snapshot(), beforePause);
  runtime.step(1e9);
  const afterGiant = runtime.snapshot();
  assert.ok(
    Number.isFinite(afterGiant.distance) && Number.isFinite(afterGiant.speed),
  );
  assert.ok(afterGiant.speed <= 7);
  runtime.reset();
  assert.equal(runtime.riding, false);
  assert.equal(runtime.snapshot().moving, false);
  assert.equal(runtime.snapshot().station, 0);
  assert.equal(
    runtime
      .snapshot()
      .devices.every((device) => device.progress === 0 && device.target === 0),
    true,
  );
});

test('cart stops for a ground occupant in its forward swept lane and resumes after it clears', () => {
  const runtime = new CircusRuntime(plan);
  interactAtStation(runtime, 0);
  const occupant = { x: -4, y: 1.68, z: 32 };
  for (let i = 0; i < 300; i++) runtime.step(1 / 30, [occupant]);
  const stopped = runtime.snapshot();
  assert.equal(stopped.moving, true);
  assert.equal(stopped.speed, 0);
  assert.ok(stopped.distance < 4);
  assert.equal(runUntilArrival(runtime).arrived, true);
});

test('mechanical devices wait for ground occupants inside 2.4 m and ignore an upper-floor occupant', () => {
  for (const device of plan.devices.filter((entry) => entry.kind !== 'lure')) {
    const runtime = new CircusRuntime(plan),
      yaw = face(device.control, device.control);
    const interaction = runtime.interact(at(device.control), yaw);
    assert.equal(interaction.handled, true, device.kind);
    runtime.step(1, [{ ...device.position, y: 1.68 }]);
    const blocked = runtime
      .snapshot()
      .devices.find((entry) => entry.id === device.id)!;
    assert.equal(
      blocked.progress,
      0,
      `${device.kind} moved through a ground occupant`,
    );
    runtime.step(1, [{ ...device.position, y: 6.48 }]);
    const released = runtime
      .snapshot()
      .devices.find((entry) => entry.id === device.id)!;
    assert.ok(released.progress > 0, `${device.kind} ignored a clear sweep`);
  }
});

test('near requires the control to be in front and lure emits one enemy-hearing event', () => {
  const runtime = new CircusRuntime(plan),
    lure = plan.devices[3];
  const player = at({ x: lure.control.x + 1, z: lure.control.z });
  assert.equal(
    runtime.near(player, face(player, lure.control) + Math.PI),
    null,
  );
  const yaw = face(player, lure.control);
  assert.equal(runtime.interact(player, yaw).handled, true);
  assert.equal(
    runtime.step(0).lure,
    undefined,
    'paused/zero-dt step must retain the pending event',
  );
  assert.deepEqual(runtime.step(1 / 60).lure, lure.position);
  assert.equal(runtime.step(0).lure, undefined);
});

test('blockers share cart, curtain, rotating wall and drawbridge dimensions', () => {
  const runtime = new CircusRuntime(plan);
  const initial = runtime.blockers();
  assert.equal(initial.length, 4); // cart + two closed curtain halves + turntable wall
  assert.equal(runtime.blockers(false).length, 3);
  assert.equal(runtime.blockers(), initial); // stable states reuse the same array for world caches
  const curtain = plan.devices[0];
  runtime.interact(at(curtain.control), face(curtain.control, curtain.control));
  runtime.step(2);
  assert.equal(runtime.blockers().length, 4); // open curtain retains two folded side panels
  const turntable = plan.devices[1];
  runtime.interact(
    at(turntable.control),
    face(turntable.control, turntable.control),
  );
  runtime.step(2.1);
  const turned = runtime.blockers();
  assert.equal(turned.length, 4);
  const turningWall = turned.find(
    (obstacle) =>
      obstacle.minX <= turntable.position.x &&
      obstacle.maxX >= turntable.position.x &&
      obstacle.minZ <= turntable.position.z &&
      obstacle.maxZ >= turntable.position.z,
  )!;
  assert.ok(turningWall.maxZ - turningWall.minZ > 2.39);
  assert.ok(turningWall.maxX - turningWall.minX < 0.11);
  const bridge = plan.devices[2];
  runtime.interact(at(bridge.control), face(bridge.control, bridge.control));
  runtime.step(0.1);
  const raised = runtime.blockers();
  assert.equal(raised.length, 5);
  const bridgeBlocker = raised[4];
  assert.ok(
    bridgeBlocker.maxZ - bridgeBlocker.minZ <=
      CIRCUS_RUNTIME_DIMENSIONS.drawbridge.width + 1e-6,
  );
});
