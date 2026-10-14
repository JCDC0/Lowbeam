import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRoadblock, shouldSetRoadblock, tooNearBlock, planSpikes, hitSpikes, spikePenalty } from '../../src/police/roadblock.js';
import { PursuitView } from '../../src/police/pursuit-view.js';
import { TrafficSim } from '../../src/traffic/sim.js';
import { carById } from '../../src/vehicles/specs.js';
import { createVehicleState } from '../../src/vehicles/physics.js';
import { trafficVoices } from '../../src/audio/traffic-voices.js';
import { island, trafficNet } from '../island.mjs';

const ground = island();
const net = trafficNet();

/** A player's lane context with the net's sample bound in. */
function ctx(s = 1500, road = 'c1-f') {
  const lane = net.lane(road, 1, 1);
  return { lane, s, sample: (l, at, out) => net.sample(l, at, out) };
}

test('a roadblock is placed a few hundred meters ahead on the lane', () => {
  const c = ctx(1500);
  const block = planRoadblock(c, 4);
  assert.ok(block, 'a roadblock is planned at heat 4');
  const ahead = block.s - c.s;
  assert.ok(ahead >= 250 && ahead <= 400, `the block is 250 to 400 m ahead, got ${ahead.toFixed(0)}`);
  assert.ok(block.units.length >= 2 && block.units.length <= 3, `${block.units.length} units across the road`);
});

test('no roadblock below heat 4', () => {
  assert.equal(planRoadblock(ctx(), 3), null);
  assert.equal(planRoadblock(ctx(), 1), null);
});

test('a roadblock leaves a gap to thread, at one end of the road', () => {
  for (let i = 0; i < 20; i++) {
    const block = planRoadblock(ctx(), 4);
    assert.ok(block.gap, 'every block has a gap');
    assert.equal(Math.abs(block.gap.side), 1, 'the gap is on the left or the right');
    // The gap slot is empty: no unit sits at the gap's side, so there is room to pass.
    const gapX = block.x - block.tz * (block.gap.side * (block.lane.road.hw - block.gap.half));
    const gapZ = block.z + block.tx * (block.gap.side * (block.lane.road.hw - block.gap.half));
    for (const u of block.units) {
      const near = Math.hypot(u.x - gapX, u.z - gapZ) < block.gap.half * 0.5;
      assert.ok(!near, 'no unit is parked in the gap');
    }
  }
});

test('a roadblock is only set up out of sight and one at a time', () => {
  const player = { x: 0, z: 0 };
  assert.ok(shouldSetRoadblock(player, null, 4, 0), 'at heat 4 with none standing, lay one');
  assert.equal(shouldSetRoadblock(player, null, 3, 0), false, 'not below heat 4');
  assert.equal(shouldSetRoadblock(player, { x: 100, z: 100 }, 4, 0), false, 'not while one is already standing');
  assert.equal(shouldSetRoadblock(player, null, 4, 10), false, 'not before the cooldown is up');
});

test('tooNearBlock keeps a fresh block from stacking on the player', () => {
  const player = { x: 0, z: 0 };
  assert.equal(tooNearBlock(null, player), true);
  assert.equal(tooNearBlock({ x: 100, z: 0 }, player), true, 'a block 100 m away is too near');
  assert.equal(tooNearBlock({ x: 900, z: 0 }, player), false, 'a block far ahead is fine');
});

test('a spike strip goes across the roadblock gap at heat 4 and up', () => {
  const block = planRoadblock(ctx(), 4);
  const strip = planSpikes(block, 4);
  assert.ok(strip, 'a strip is laid across the gap');
  assert.ok(strip.len > 0, 'the strip has a length');
  // The strip sits near the block and offset toward the gap side.
  assert.ok(Math.hypot(strip.x - block.x, strip.z - block.z) < 12, 'the strip is at the roadblock');
  assert.equal(planSpikes(block, 3), null, 'no strip below heat 4');
});

test('running over a strip flattens the tires, and they mend over time', () => {
  const block = planRoadblock(ctx(), 4);
  const strip = planSpikes(block, 4);
  assert.equal(hitSpikes(strip, { x: strip.x + 50, z: strip.z }), false, 'a car far from the strip misses it');
  assert.ok(hitSpikes(strip, { x: strip.x + 1, z: strip.z }), 'a car on the strip hits it');

  // The tires go flat within a second and a half of the strip, then mend over time.
  const fresh = spikePenalty(0.5);
  assert.ok(fresh.active);
  assert.ok(fresh.grip < 1, 'grip is down once the tires flatten');
  assert.ok(fresh.top < 1, 'top speed is down too');
  // As it flattens the penalty deepens, then it mends.
  const worse = spikePenalty(6);
  assert.ok(worse.grip < fresh.grip, 'the flatness builds over the first seconds');
  const mending = spikePenalty(20);
  assert.ok(mending.active, 'still flat but healing');
  const done = spikePenalty(40);
  assert.equal(done.active, false, 'the tires mend after the timer');
  assert.ok(done.grip > worse.grip, 'and grip comes back');
});

test('planRoadblock returns barriers clearing units and gap, within carriageway', () => {
  for (let i = 0; i < 20; i++) {
    const block = planRoadblock(ctx(1500), 4);
    assert.ok(block.barriers.length >= 1 && block.barriers.length <= 2, 'returns 1 or 2 barriers');
    for (const b of block.barriers) {
      assert.equal(b.w, 2.4, 'barrier is 2.4 m wide');
      assert.ok(b.lateral - b.w / 2 >= -block.halfW - 0.05, 'barrier inside left edge');
      assert.ok(b.lateral + b.w / 2 <= block.halfW + 0.05, 'barrier inside right edge');

      if (block.gap.side < 0) {
        const gapRight = -block.halfW + 2 * block.gap.half;
        assert.ok(b.lateral - b.w / 2 >= gapRight - 0.01, 'barrier does not intrude into left gap');
      } else {
        const gapLeft = block.halfW - 2 * block.gap.half;
        assert.ok(b.lateral + b.w / 2 <= gapLeft + 0.01, 'barrier does not intrude into right gap');
      }

      for (const u of block.units) {
        const d = Math.hypot(b.x - u.x, b.z - u.z);
        assert.ok(d > 1.2, `barrier clears unit, distance is ${d.toFixed(2)}`);
      }
    }
  }
});

test('planRoadblock barrier placement is deterministic', () => {
  const seed1 = () => 0.42;
  const seed2 = () => 0.42;
  const b1 = planRoadblock(ctx(1500), 4, seed1);
  const b2 = planRoadblock(ctx(1500), 4, seed2);
  assert.deepEqual(b1.barriers, b2.barriers);
});

test('barrier hit: soft hit stops the car, hard hit knocks and flattens without yaw spin', () => {
  const lane = net.lane('c1-f', 1, 1);
  const sim = new TrafficSim(net, { target: 0, rivals: 0, patrols: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 100, q);
  const yaw = Math.atan2(q.tx, q.tz);
  const spec = carById('hayate');

  // Soft hit (closing speed under 6 m/s): place car 2.0 m behind barrier so front bumper contacts
  const barrier = sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw, w: 2.4 }, lane, 100);
  const softState = createVehicleState(spec);
  softState.x = q.x - q.tx * 2.0;
  softState.y = q.y;
  softState.z = q.z - q.tz * 2.0;
  softState.yaw = yaw;
  softState.vx = q.tx * 5;
  softState.vz = q.tz * 5;
  softState.speed = 5;
  const softHit = sim.collideWithPlayer(softState, spec);
  assert.ok(softHit > 0 && softHit <= 6, `soft hit closing speed is <= 6 (got ${softHit.toFixed(2)})`);
  assert.equal(barrier.mode, 'parked', 'barrier stays parked on soft hit');
  assert.equal(barrier.flattened, false, 'barrier is not flattened on soft hit');
  const dotV = softState.vx * q.tx + softState.vz * q.tz;
  assert.ok(dotV < 0, 'car bounced / stopped by parked barrier');

  // Hard hit (25 m/s closing)
  net.sample(lane, 200, q);
  const hardYaw = Math.atan2(q.tx, q.tz);
  const hardBarrier = sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: hardYaw, w: 2.4 }, lane, 200);
  const hardState = createVehicleState(spec);
  hardState.x = q.x - q.tx * 2.0;
  hardState.y = q.y;
  hardState.z = q.z - q.tz * 2.0;
  hardState.yaw = hardYaw;
  hardState.vx = q.tx * 25;
  hardState.vz = q.tz * 25;
  hardState.speed = 25;
  const hardHit = sim.collideWithPlayer(hardState, spec);
  assert.ok(hardHit > 6, `hard hit closing speed > 6 (got ${hardHit.toFixed(2)})`);
  assert.equal(hardBarrier.mode, 'knocked', 'barrier becomes knocked, never a wreck');
  assert.equal(hardBarrier.flattened, true, 'barrier is flattened on hard hit');

  // Slide damping: barrier slides a short distance and yaw spin dies
  for (let t = 0; t < 2; t += 1 / 30) {
    sim.stepKnocked(hardBarrier, 1 / 30);
  }
  assert.ok(Math.abs(hardBarrier.yawRate) < 0.01, 'yaw spin settles to virtually zero');
  assert.ok(hardBarrier.speed < 0.5, 'slide damped quickly');

  // Fades after usual wreck time
  for (let t = 0; t < 25; t += 1) {
    sim.stepKnocked(hardBarrier, 1);
  }
  assert.equal(hardBarrier.fade, 0, 'barrier fades out after usual time');

  // Hardest hit (e.g. 50 m/s closing) still knocks rather than wrecks
  const extremeBarrier = sim.spawnBarrier({ x: q.x + 50, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 300);
  sim.knock(extremeBarrier, 50, 2000);
  assert.equal(extremeBarrier.mode, 'knocked', 'extreme hit knocks barrier, never a wreck');
  assert.equal(extremeBarrier.flattened, true, 'extreme hit flattens barrier');
});

test('trafficVoices ignores roadblock barriers (item 1)', () => {
  const lane = net.lane('c1-f', 1, 1);
  const sim = new TrafficSim(net, { target: 0, rivals: 0, patrols: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 100, q);
  const barrier = sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 100);
  const civ = sim.spawn({ x: q.x + 10, z: q.z + 10, speed: 10 }, 0, 1e9);
  assert.ok(civ);
  civ.x = q.x + 10;
  civ.y = q.y;
  civ.z = q.z + 10;
  const player = { x: q.x, y: q.y, z: q.z, vx: 0, vz: 0, yaw: 0 };
  const voices = trafficVoices(sim.agents, player, 0);
  assert.equal(voices.length, 1, 'only civilian car produces engine audio');
  assert.equal(voices[0].key, civ.id, 'civilian voice key matches');
  assert.ok(!voices.some((v) => v.key === barrier.id), 'barrier produces no engine voice');
});

test('TrafficSim civilian target counts civilians only, excluding roadblocks and barriers (item 3)', () => {
  const lane = net.lane('c1-f', 1, 1);
  const sim = new TrafficSim(net, { target: 5, rivals: 0, patrols: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 100, q);
  sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 100);
  sim.spawnBarrier({ x: q.x + 3, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 100);
  sim.spawnParked('police', { x: q.x + 6, y: q.y, z: q.z, yaw: 0 }, lane, 100);
  sim.spawnParked('police', { x: q.x + 9, y: q.y, z: q.z, yaw: 0 }, lane, 100);
  sim.spawnParked('police', { x: q.x + 12, y: q.y, z: q.z, yaw: 0 }, lane, 100);

  assert.equal(sim.agents.length, 5, '5 roadblock obstacle agents present');
  assert.equal(sim.countCivilians(), 0, '0 civilians counted among roadblock obstacles');

  const player = { x: q.x, z: q.z, speed: 0 };
  sim.populate(player);
  assert.equal(sim.countCivilians(), 5, 'populate fills up to target civilians ignoring roadblocks');

  // Also test update: if target is increased, update fills civilian quota
  sim.target = 7;
  sim.spawnTimer = 0;
  sim.update(1 / 30, player);
  assert.equal(sim.countCivilians(), 6, 'update spawns civilian toward new target');
});

test('traffic brakes and stops for a barrier across its lane (item 4)', () => {
  const lane0 = net.lane('c1-f', 1, 0);
  const lane1 = net.lane('c1-f', 1, 1);
  const lane2 = net.lane('c1-f', 1, 2);
  const sim = new TrafficSim(net, { target: 0, rivals: 0, patrols: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane1, 30, q);
  const civ = sim.spawn({ x: q.x, z: q.z, speed: 0 }, 0, 1e9);
  assert.ok(civ);
  civ.lane = lane1;
  civ.s = 30;
  civ.speed = 25;

  net.sample(lane0, 130, q);
  sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), w: 2.4 }, lane0, 130);
  net.sample(lane1, 130, q);
  const barrier1 = sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), w: 2.4 }, lane1, 130);
  net.sample(lane2, 130, q);
  sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(q.tx, q.tz), w: 2.4 }, lane2, 130);

  const player = { x: q.x, z: q.z, speed: 0 };

  // Step 1: initial brake response
  sim.sortLanes();
  sim.stepDrive(civ, 1 / 30, player);
  assert.equal(civ.brake, 1, 'civilian triggers brake for barrier ahead');
  assert.ok(civ.speed < 25, 'civilian slows down before barrier');

  // Step across subsequent frames: civilian comes to a full stop before barrier
  for (let t = 0; t < 300; t++) {
    sim.update(1 / 30, player);
  }
  assert.equal(civ.speed, 0, 'civilian comes to a complete stop');
  assert.ok(civ.s < barrier1.s, `civilian stops before barrier (at s=${civ.s.toFixed(1)}, barrier at s=${barrier1.s})`);
  assert.ok(barrier1.s - civ.s >= 5, `civilian maintains safe stopping buffer of at least 5 m (got ${(barrier1.s - civ.s).toFixed(1)} m)`);
});

test('a roadblock barrier whose agent has gone is not drawn by PursuitView', () => {
  const lane = net.lane('c1-f', 1, 1);
  const sim = new TrafficSim(net, { target: 0, rivals: 0, patrols: 0 });
  const q = { x: 0, z: 0, tx: 0, tz: 1, y: 0 };
  net.sample(lane, 100, q);
  const b1 = sim.spawnBarrier({ x: q.x, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 100);
  const b2 = sim.spawnBarrier({ x: q.x + 3, y: q.y, z: q.z, yaw: 0, w: 2.4 }, lane, 100);

  let barriers = [b1, b2];
  const view = new PursuitView({});
  view.step(0.1, barriers);
  assert.equal(view.barrierMeshes.length, 2);
  assert.equal(view.barrierMeshes[0].visible, true);
  assert.equal(view.barrierMeshes[1].visible, true);

  b2.fade = 0;
  sim.update(0.1, { x: q.x, z: q.z, speed: 0 });
  assert.ok(!sim.agents.includes(b2), 'faded barrier removed from sim.agents');
  assert.ok(sim.agents.includes(b1), 'live barrier remains in sim.agents');

  barriers = barriers.filter((b) => sim.agents.includes(b));
  view.step(0.1, barriers);

  assert.equal(view.barrierMeshes[0].visible, true, 'live barrier mesh is drawn');
  assert.equal(view.barrierMeshes[1].visible, false, 'faded barrier mesh is hidden');
});