import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitSees, PoliceDirector, SIGHT_RANGE, PATROL_RANGE } from '../src/police/director.js';
import { weatherLook } from '../src/render/weather.js';
import { Heli } from '../src/police/heli.js';
import { TrafficSim } from '../src/traffic/sim.js';

const DT = 1 / 30;

test('police unit sight scales with fog distance', () => {
  const p = { x: 0, z: 0 };
  const dryLook = weatherLook(0);
  const stormLook = weatherLook(1);
  assert.equal(dryLook.fogFar, 420);
  assert.equal(stormLook.fogFar, 230);

  const drySight = SIGHT_RANGE * (dryLook.fogFar / 420);
  const stormSight = SIGHT_RANGE * (stormLook.fogFar / 420);
  assert.equal(drySight, 150);
  assert.ok(Math.abs(stormSight - 82.14) < 0.1, `storm sight is ~82.1 m (got ${stormSight.toFixed(2)})`);

  const u100 = { id: 1, x: 0, z: 100, yaw: 0, d: 100, clear: true };
  assert.equal(unitSees(u100, p, 'chase', 0), true, 'unit sees player at 100 m in dry weather');
  assert.equal(unitSees(u100, p, 'chase', 1), false, 'unit loses player at 100 m in a storm');

  const u75 = { id: 2, x: 0, z: 75, yaw: 0, d: 75, clear: true };
  assert.equal(unitSees(u75, p, 'chase', 1), true, 'unit sees player at 75 m in a storm');
});

test('police notice radius scales to 85 percent in storm', () => {
  const p = { x: 0, z: 0 };
  const dryNotice = PATROL_RANGE;
  const stormNotice = PATROL_RANGE * 0.85;
  assert.equal(dryNotice, 60);
  assert.equal(stormNotice, 51);

  const u55 = { id: 1, x: 0, z: 55, yaw: 0, d: 55, clear: true };
  assert.equal(unitSees(u55, p, 'patrol', 0), true, 'patrol notices at 55 m in dry weather');
  assert.equal(unitSees(u55, p, 'patrol', 1), false, 'patrol does not notice at 55 m in storm');

  const u48 = { id: 2, x: 0, z: 48, yaw: 0, d: 48, clear: true };
  assert.equal(unitSees(u48, p, 'patrol', 1), true, 'patrol notices at 48 m in storm');
});

test('unit loses the player in a storm during pursuit', () => {
  const dirDry = new PoliceDirector({ rand: () => 0.5 });
  const dirStorm = new PoliceDirector({ rand: () => 0.5 });

  const startWorld = (weather) => ({
    player: { x: 0, z: 0, speed: 20 },
    units: [{ id: 1, x: 0, z: 0, yaw: 0, d: 0, clear: true, kind: 'police', vx: 0, vz: 20 }],
    patrols: 1,
    limit: 60,
    money: 1e5,
    hitPolice: 1000,
    weather,
  });

  dirDry.update(DT, startWorld(0));
  dirStorm.update(DT, startWorld(1));
  assert.ok(dirDry.active, 'pursuit started dry');
  assert.ok(dirStorm.active, 'pursuit started in storm');

  const chaseWorld = (d, weather) => ({
    player: { x: 0, z: d, speed: 30 },
    units: [{ id: 1, x: 0, z: 0, yaw: 0, d, clear: true, kind: 'police', vx: 0, vz: 30 }],
    patrols: 1,
    limit: 100,
    money: 1e5,
    weather,
  });

  for (let t = 0; t < 0.2; t += DT) {
    dirDry.update(DT, chaseWorld(100, 0));
  }
  assert.equal(dirDry.pursuit?.pstate, 'pursuit', 'dry pursuit remains locked on at 100 m');

  for (let t = 0; t < 0.2; t += DT) {
    dirStorm.update(DT, chaseWorld(100, 1));
  }
  assert.equal(dirStorm.pursuit?.pstate, 'evading', 'storm pursuit transitions to evading at 100 m');
});

test('helicopter searchlight reaches 70 percent as far in a storm', () => {
  const PAD = { x: 0, y: 13, z: 0, yaw: 0 };
  const hDry = new Heli(PAD);
  const hStorm = new Heli(PAD);

  const targetDist = 150;
  const target = { x: 0, y: 0, z: targetDist, vx: 0, vz: 0 };
  const makeWorld = (weather) => ({
    target,
    skyline: { at: () => 0 },
    groundAt: () => 0,
    weather,
  });

  hDry.state = 'chase';
  hDry.x = 0;
  hDry.y = 20;
  hDry.z = 0;
  hDry.spot.x = 0;
  hDry.spot.y = 0;
  hDry.spot.z = targetDist;

  hStorm.state = 'chase';
  hStorm.x = 0;
  hStorm.y = 20;
  hStorm.z = 0;
  hStorm.spot.x = 0;
  hStorm.spot.y = 0;
  hStorm.spot.z = targetDist;

  hDry.light(DT, makeWorld(0));
  hStorm.light(DT, makeWorld(1));

  assert.equal(hDry.spot.sees, true, 'dry searchlight reaches 150 m (< 190 m)');
  assert.equal(hStorm.spot.sees, false, 'storm searchlight does not reach 150 m (> 133 m)');

  const closeDist = 110;
  const closeTarget = { x: 0, y: 0, z: closeDist, vx: 0, vz: 0 };
  hStorm.spot.z = closeDist;
  hStorm.light(DT, { ...makeWorld(1), target: closeTarget });
  assert.equal(hStorm.spot.sees, true, 'storm searchlight reaches 110 m (< 133 m)');
});

test('civilians drive 12 percent slower in storm and follow further back', () => {
  const dummyRoad = { id: 'dummy', hw: 7, def: { limit: 100, cls: 'expressway' } };
  const dummyLane = {
    id: 'dummy:0',
    road: dummyRoad,
    width: 3.5,
    offset: 1.75,
    dir: 1,
    limit: 100 / 3.6,
    length: 1000,
    cls: 'expressway',
    stops: [],
    ends: [],
    mids: [],
    closed: false,
  };

  const dummyNet = {
    lanes: [dummyLane],
    sample: (_l, s, out) => {
      out.x = 0;
      out.z = s;
      out.tx = 0;
      out.tz = 1;
      out.y = 0;
      return out;
    },
    byRoad: new Map([['dummy', [dummyLane]]]),
    locate: () => null,
  };

  const simDry = new TrafficSim(dummyNet, { seed: 1, target: 0, rivals: 0, patrols: 0 });
  const simStorm = new TrafficSim(dummyNet, { seed: 1, target: 0, rivals: 0, patrols: 0 });
  simDry.weather = 0;
  simStorm.weather = 1;

  const makeCiv = () => ({
    id: 1,
    kind: { id: 'sedan', accel: 3.5, length: 4.5, width: 1.8, mass: 1300, speed: [0.9, 1.05] },
    lane: dummyLane,
    s: 100,
    speed: dummyLane.limit,
    factor: 1.0,
    x: 0, y: 0, z: 100, yaw: 0, vx: 0, vz: dummyLane.limit, yawRate: 0,
    ex: 0, ez: 0, cap: Infinity, capUntil: 0, plan: null, end: null,
    changeDuration: 0, changeTimer: 0, changeStartX: 0, changeStartZ: 0,
    changePrevEx: 0, changePrevEz: 0,
    mode: 'drive', age: 0, wreckAge: 0, laneHold: 0, duel: false, signal: 0, signalTimer: 0, signalTarget: null,
    nextChange: 10, brake: 0, fade: 1, pursuit: false,
  });

  const civDry = makeCiv();
  const civStorm = makeCiv();

  const player = { x: 500, z: 500, speed: 0 };
  for (let t = 0; t < 3; t += DT) {
    simDry.stepDrive(civDry, DT, player);
    simStorm.stepDrive(civStorm, DT, player);
  }

  const drySpeed = civDry.speed;
  const stormSpeed = civStorm.speed;
  const ratio = stormSpeed / drySpeed;
  assert.ok(Math.abs(ratio - 0.88) < 0.02, `speed in storm is ~88 % of dry (${(ratio * 100).toFixed(1)} %)`);

  const civLead = makeCiv();
  civLead.id = 2;
  civLead.s = 145;
  civLead.speed = dummyLane.limit * 0.88;
  const civFollowDry = makeCiv();
  civFollowDry.s = 100;
  civFollowDry.speed = dummyLane.limit * 0.88;
  const civFollowStorm = makeCiv();
  civFollowStorm.s = 100;
  civFollowStorm.speed = dummyLane.limit * 0.88;

  simDry.byLane.set(dummyLane, [civFollowDry, civLead]);
  simStorm.byLane.set(dummyLane, [civFollowStorm, civLead]);

  simDry.stepDrive(civFollowDry, DT, player);
  simStorm.stepDrive(civFollowStorm, DT, player);

  assert.ok(civFollowStorm.speed < civFollowDry.speed, 'storm following brakes harder / decelerates faster');
  assert.equal(civFollowDry.brake, 0, 'dry following does not trigger brake lights at 45 m');
  assert.equal(civFollowStorm.brake, 1, 'storm triggers earlier brake lights at 45 m');
});

test('police unit cornering grip falls to 75 percent in storm', () => {
  const dummyRoad = { id: 'curve', hw: 7, def: { limit: 100, cls: 'mountain' } };
  const dummyLane = {
    id: 'curve:0',
    road: dummyRoad,
    width: 3.5,
    offset: 1.75,
    dir: 1,
    limit: 100 / 3.6,
    length: 1000,
    cls: 'mountain',
    stops: [],
    ends: [],
    mids: [],
    closed: false,
  };

  const dummyNet = {
    lanes: [dummyLane],
    sample: (_l, s, out) => {
      const yaw = s * 0.05;
      out.x = Math.sin(yaw) * 100;
      out.z = Math.cos(yaw) * 100;
      out.tx = Math.sin(yaw);
      out.tz = Math.cos(yaw);
      out.y = 0;
      return out;
    },
    byRoad: new Map([['curve', [dummyLane]]]),
    locate: () => null,
  };

  const simDry = new TrafficSim(dummyNet, { seed: 10, target: 0, rivals: 0, patrols: 0 });
  const simStorm = new TrafficSim(dummyNet, { seed: 10, target: 0, rivals: 0, patrols: 0 });
  simDry.weather = 0;
  simStorm.weather = 1;

  const mockUnit = () => ({
    id: 99,
    kind: { id: 'police', top: 180, accel: 4, mass: 1600, width: 1.8, length: 4.8 },
    lane: dummyLane,
    s: 50,
    speed: 25,
    pursuit: 'chase',
  });

  const vDry = simDry.curveSpeed(mockUnit());
  const vStorm = simStorm.curveSpeed(mockUnit());
  const ratio = (vStorm * vStorm) / (vDry * vDry);
  assert.ok(Math.abs(ratio - 0.75) < 0.03, `lateral grip ratio is ~75 % (${(ratio * 100).toFixed(1)} %)`);
});
