import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../src/world/ground.js';
import { TrafficNet } from '../src/traffic/net.js';
import { planRoadblock, shouldSetRoadblock, tooNearBlock, planSpikes, hitSpikes, spikePenalty } from '../src/police/roadblock.js';

const ground = new Ground();
const net = new TrafficNet(ground.roads);

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