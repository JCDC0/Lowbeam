import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';
import { thermalDerate } from '../src/vehicles/thermal.js';

const flat = (surface) => () => ({ h: 0, surface });

function dragRun(spec) {
  const g = flat('asphalt');
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  let t = 0;
  let quarter = 0;
  let top = 0;
  while (t < 60) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, g, DT);
    t += DT;
    if (!quarter && s.z >= 402) quarter = t;
    top = Math.max(top, s.speed * 3.6);
  }
  return { quarter, top };
}

function cornering(spec, surface, v = 20, gear = 2) {
  const g = flat(surface);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  s.vz = v;
  s.gear = gear;
  let t = 0;
  let sum = 0;
  let n = 0;
  while (t < 6) {
    const throttle = Math.min(1, Math.max(0, (v - s.speed) * 0.4 + 0.15));
    stepVehicle(s, spec, { throttle, brake: 0, steer: t > 0.5 ? 0.5 : 0, handbrake: 0 }, g, DT);
    t += DT;
    if (t > 2.5) {
      sum += Math.abs(s.aLat);
      n++;
    }
  }
  return sum / n;
}

/** Asserts that ranking cars by `measure` gives the same order as ranking by their bar. */
function assertOrder(bar, measure, higherIsBetter = true) {
  const byBar = [...CARS].sort((a, b) => b.bars[bar] - a.bars[bar]).map((c) => c.id);
  const scored = CARS.map((c) => ({ id: c.id, v: measure(c) }));
  const byMeasure = scored.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v)).map((c) => c.id);
  assert.deepEqual(byMeasure, byBar, `${bar}: ${JSON.stringify(scored)}`);
}

test('the Top Speed bar matches simulated top speed', () => {
  assertOrder('topSpeed', (c) => dragRun(c).top);
});

test('the Acceleration bar matches the simulated quarter mile', () => {
  assertOrder('accel', (c) => dragRun(c).quarter, false);
});

test('the Handling bar matches mean cornering grip on tarmac and gravel', () => {
  assertOrder('handling', (c) => (cornering(c, 'asphalt') + cornering(c, 'gravel')) / 2);
});

test('braking from 100 km/h stops the car and it stays parked', () => {
  for (const spec of CARS) {
    const g = flat('asphalt');
    const s = createVehicleState(spec);
    placeVehicle(s, spec, 0, 0, 0, g);
    s.vz = 100 / 3.6;
    s.speed = s.vz;
    // Let go once stopped: holding the brake at rest selects reverse, which is tested below.
    let held = true;
    for (let i = 0; i < 120 * 6; i++) {
      if (s.speed < 0.5) held = false;
      stepVehicle(s, spec, { throttle: 0, brake: held ? 1 : 0, steer: 0, handbrake: 0 }, g, DT);
    }
    assert.ok(s.speed < 0.05, `${spec.id} still moving at ${s.speed}`);
    assert.ok(s.z < 40, `${spec.id} took ${s.z.toFixed(1)} m`);
  }
});

test('holding brake at rest selects reverse and backs up', () => {
  const spec = CARS[0];
  const g = flat('asphalt');
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  for (let i = 0; i < 240; i++) stepVehicle(s, spec, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, g, DT);
  assert.equal(s.gear, -1);
  assert.ok(s.vLong < -1, `vLong ${s.vLong}`);
});

test('a sharp crest at speed launches the car and it lands again', () => {
  const spec = CARS[0];
  // A 1.6 m cosine bump 36 m long at z = 100.
  const g = (x, z) => {
    const u = (z - 100) / 18;
    return { h: Math.abs(u) < 1 ? 0.8 * (1 + Math.cos(Math.PI * u)) : 0, surface: 'gravel' };
  };
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  s.vz = 32;
  let flew = false;
  for (let i = 0; i < 120 * 6; i++) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, g, DT);
    if (s.air && s.y - g(s.x, s.z).h > 0.3) flew = true;
  }
  assert.ok(flew, 'never left the ground');
  assert.equal(s.air, false);
});

/** A fresh car on flat ground, with helpers to step it with a fixed input. */
function rig(id, surface = 'asphalt', manual = false) {
  const spec = carById(id);
  const g = flat(surface);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  const run = (seconds, input = {}, each) => {
    for (let t = 0; t < seconds; t += DT) {
      stepVehicle(s, spec, { throttle: 0, brake: 0, steer: 0, handbrake: 0, manual, ...input }, g, DT);
      if (each) each(t);
    }
  };
  const press = (key) => stepVehicle(s, spec, { throttle: 0, brake: 0, steer: 0, handbrake: 0, manual, [key]: true }, g, DT);
  return { spec, s, g, run, press };
}

test('manual transmission: no automatic upshift and limiter holds at redline', () => {
  const { spec, s, run } = rig('hayate', 'asphalt', true);
  run(4, { throttle: 1 });
  assert.equal(s.gear, 1, 'manual mode auto-upshifted');
  assert.ok(s.rpm >= spec.engine.redline - 100, `rpm ${s.rpm} should be near the redline ${spec.engine.redline}`);
  assert.ok(s.limiter > 0 || s.rpm <= spec.engine.redline + 50, 'limiter did not engage');
});

test('the manual selector runs N, R, 1 to the top gear for every car, at any speed', () => {
  for (const spec of CARS) {
    const { s, run, press } = rig(spec.id, 'asphalt', true);
    const order = [s.gear];
    for (let i = 0; i < spec.gears.length + 2; i++) {
      press('shiftUp');
      run(0.15);
      order.push(s.gear);
    }
    assert.deepEqual(order.slice(0, 5), [1, 2, 3, 4, 5].slice(0, 5), spec.id);
    assert.equal(s.gear, spec.gears.length, `${spec.id} stops at its top gear`);
    s.blown = false;
    const down = [];
    for (let i = 0; i < spec.gears.length + 3; i++) {
      press('shiftDown');
      run(0.15);
      if (down[down.length - 1] !== s.gear) down.push(s.gear);
    }
    assert.equal(down[down.length - 1], 0, `${spec.id} ends in N, walked ${JSON.stringify(down)}`);
    assert.ok(down.includes(-1), `${spec.id} passes through R on the way down`);
    assert.ok(down.includes(1), `${spec.id} passes through 1st on the way down`);
  }
  assert.deepEqual(CARS.map((c) => c.gears.length), [5, 5, 6, 7, 5]);
});

test('the manual selector steps N, R, 1 with a single tap, in both directions', () => {
  for (const spec of CARS) {
    const { s, run, press } = rig(spec.id, 'asphalt', true);
    s.gear = 1;
    press('shiftDown');
    run(0.15);
    assert.equal(s.gear, -1, `${spec.id} down from 1 goes to R`);
    press('shiftDown');
    run(0.15);
    assert.equal(s.gear, 0, `${spec.id} down from R goes to N`);
    press('shiftDown');
    run(0.15);
    assert.equal(s.gear, 0, `${spec.id} stops at N`);
    press('shiftUp');
    run(0.15);
    assert.equal(s.gear, -1, `${spec.id} up from N goes to R`);
    press('shiftUp');
    run(0.15);
    assert.equal(s.gear, 1, `${spec.id} up from R goes to 1`);
  }
});

test('manual: W is always throttle and the gear sets the direction', () => {
  const { s, run, press } = rig('hayate', 'asphalt', true);
  press('shiftDown');
  run(0.15);
  assert.equal(s.gear, -1);
  run(3, { throttle: 1 });
  assert.ok(s.vLong < -1.5, `reversing at ${s.vLong}`);
});

test('neutral bounces on the limiter without driving the car or blowing', () => {
  for (const spec of CARS) {
    const { s, run, press } = rig(spec.id, 'asphalt', true);
    press('shiftDown');
    run(0.15);
    press('shiftDown');
    run(0.15);
    assert.equal(s.gear, 0, spec.id);
    let peak = 0;
    let cuts = 0;
    let wasCut = false;
    run(4, { throttle: 1 }, () => {
      peak = Math.max(peak, s.rpm);
      const cut = s.limiter > 0;
      if (cut && !wasCut) cuts++;
      wasCut = cut;
    });
    assert.ok(peak > spec.engine.redline - 300, `${spec.id} only reached ${peak.toFixed(0)}`);
    assert.ok(peak <= spec.engine.redline + 150, `${spec.id} peaked at ${peak.toFixed(0)}, redline ${spec.engine.redline}`);
    assert.ok(cuts >= 4, `${spec.id} cut the limiter ${cuts} times`);
    assert.ok(Math.abs(s.vLong) < 0.2, `${spec.id} moved ${s.vLong}`);
    run(6);
    assert.ok(s.rpm < spec.engine.idle + 300, `${spec.id} rpm ${s.rpm} did not fall back`);
  }
});

test('a loose launch revs to the limiter instead of holding a fixed rpm', () => {
  for (const id of ['rampart', 'vespera']) {
    const { spec, s, run } = rig(id, 'gravel');
    let reached = 0;
    let spun = 0;
    let t0 = 0;
    run(2, { throttle: 1 }, (t) => {
      t0 = t;
      if (!reached && s.rpm >= spec.engine.redline - 250) reached = t0;
      spun = Math.max(spun, s.wheelspin);
    });
    assert.ok(reached > 0 && reached < 2, `${id} reached ${spec.engine.redline} rpm at ${reached}s`);
    assert.ok(spun > 0.5, `${id} spin ${spun}`);
  }
});

test('rpm follows the driven wheels, not the car heading, in a spin', () => {
  const { s, run } = rig('rampart', 'gravel', true);
  s.gear = 2;
  s.vz = 22;
  const rpms = [];
  let swept = 0;
  let last = s.yaw;
  run(5, { throttle: 1, steer: 1 }, (t) => {
    swept += Math.abs(s.yaw - last);
    last = s.yaw;
    if (t > 0.6) rpms.push(s.rpm);
  });
  assert.ok(swept > Math.PI, `only turned ${swept} rad`);
  const lo = Math.min(...rpms);
  const hi = Math.max(...rpms);
  assert.ok((hi - lo) / hi < 0.15, `rpm swung ${lo.toFixed(0)} to ${hi.toFixed(0)} while the car spun`);
});

test('a standing full-throttle launch is smooth', () => {
  for (const surface of ['asphalt', 'gravel']) {
    for (const spec of CARS) {
      const { s, run } = rig(spec.id, surface);
      let lowest = 0;
      let peak = 0;
      run(5, { throttle: 1 }, () => {
        assert.ok(Number.isFinite(s.rpm) && Number.isFinite(s.slip), `${spec.id} ${surface}`);
        lowest = Math.min(lowest, s.vLong);
        peak = Math.max(peak, s.rpm);
      });
      assert.ok(lowest > -0.05, `${spec.id} ${surface} rolled back ${lowest}`);
      assert.ok(peak < spec.engine.redline + 600, `${spec.id} ${surface} rpm ${peak}`);
    }
  }
});

test('the speedometer speed is the speed of travel, not its forward part', () => {
  const { s, run } = rig('hayate', 'gravel');
  s.vx = 15;
  s.vz = 0;
  s.speed = 15;
  run(0.05);
  assert.ok(Math.abs(s.vLong) < 14.5, 'moving sideways to the heading');
  assert.ok(s.speed > 13, `speed ${s.speed}`);
});

test('a downshift at crawling speed drops straight to the gear that fits', () => {
  const crawl = rig('hayate', 'asphalt', true);
  crawl.s.gear = 5;
  crawl.s.vz = 2;
  crawl.s.speed = 2;
  crawl.press('shiftDown');
  assert.equal(crawl.s.gear, 1, `5th at 2 m/s went to gear ${crawl.s.gear}`);
  crawl.run(1);
  assert.ok(!crawl.s.blown, 'a crawl downshift blew the engine');
  assert.equal(crawl.s.damage, 0);

  const rolling = rig('hayate', 'asphalt', true);
  rolling.s.gear = 5;
  rolling.s.vz = 28;
  rolling.s.speed = 28;
  rolling.press('shiftDown');
  assert.equal(rolling.s.gear, 4, `5th at 28 m/s went to gear ${rolling.s.gear}`);
  rolling.run(1);
  assert.ok(!rolling.s.blown, 'a rolling downshift blew the engine');
});

test('a crawl downshift picks the gear the engine can actually pull', () => {
  for (const spec of CARS) {
    const { s, run, press } = rig(spec.id, 'asphalt', true);
    s.gear = spec.gears.length;
    s.vz = 1;
    s.speed = 1;
    press('shiftDown');
    assert.equal(s.gear, 1, `${spec.id} at walking pace went to gear ${s.gear}`);
    let peak = 0;
    run(2, { throttle: 1 }, () => {
      peak = Math.max(peak, s.rpm);
    });
    assert.ok(!s.blown, `${spec.id} blew itself crawling`);
    assert.ok(peak < spec.engine.redline + 150, `${spec.id} revved to ${peak.toFixed(0)} crawling`);
  }
});

test('shifting down at speed is allowed, and a money shift blows the engine', () => {
  const { spec, s, run, press } = rig('hayate', 'asphalt', true);
  s.gear = 3;
  s.vz = 40;
  s.speed = 40;
  press('shiftDown');
  assert.equal(s.gear, 2, 'the downshift was refused');
  run(0.4);
  assert.ok(s.blown, `not blown, rpm ${s.rpm.toFixed(0)}`);
  assert.equal(s.damage, 1);
  assert.equal(s.blowCount, 1);

  const safe = rig('hayate', 'asphalt', true);
  safe.s.gear = 3;
  safe.s.vz = 15;
  safe.s.speed = 15;
  safe.press('shiftDown');
  safe.run(1);
  assert.equal(safe.s.gear, 2);
  assert.ok(!safe.s.blown, 'a normal downshift blew the engine');
  assert.equal(spec.engine.blowRpm, 11000);
});

test('selecting reverse while moving forward is a money shift', () => {
  const slow = rig('vespera', 'asphalt', true);
  slow.s.gear = 1;
  slow.s.vz = 10;
  slow.s.speed = 10;
  slow.press('shiftDown');
  slow.run(0.4);
  assert.equal(slow.s.gear, -1);
  assert.ok(!slow.s.blown, 'reverse at 36 km/h should only scrub speed');

  const { s, run, press } = rig('vespera', 'asphalt', true);
  s.gear = 1;
  s.vz = 40;
  s.speed = 40;
  press('shiftDown');
  run(0.4);
  assert.equal(s.gear, -1);
  assert.ok(s.blown, 'reverse at 144 km/h did not blow the engine');
});

test('over-revving builds damage and heat without blowing at once', () => {
  const { s, run } = rig('hayate', 'asphalt', true);
  s.gear = 2;
  s.vz = 33;
  s.speed = 33;
  const before = s.temp;
  let peak = 0;
  run(2.5, { throttle: 0 }, () => {
    peak = Math.max(peak, s.overrev);
  });
  assert.ok(peak > 0.1, `over-rev ${peak}`);
  assert.ok(s.damage > 0.02 && s.damage < 1, `damage ${s.damage}`);
  assert.ok(!s.blown);
  assert.ok(s.temp > before, 'no extra heat');
});

test('a blown engine limps: slow, still moving, rpm capped', () => {
  for (const spec of CARS) {
    const { s, run } = rig(spec.id, 'asphalt');
    s.blown = true;
    s.damage = 1;
    let top = 0;
    let peak = 0;
    run(25, { throttle: 1 }, () => {
      top = Math.max(top, s.speed * 3.6);
      peak = Math.max(peak, s.rpm);
    });
    assert.ok(top > 8, `${spec.id} did not move: ${top} km/h`);
    assert.ok(top < 70, `${spec.id} limp speed ${top} km/h`);
    assert.ok(peak <= 2000, `${spec.id} limp rpm ${peak}`);
  }
});

test('a blown engine idles between 900 and 2000 rpm in gear 2, N, and 1', () => {
  for (const gear of [2, 0, 1]) {
    const { s, run, press } = rig('hayate', 'asphalt', true);
    s.gear = 2;
    s.vz = 120 / 3.6;
    s.speed = 120 / 3.6;
    s.blown = true;
    s.damage = 1;
    if (gear === 1) {
      press('shiftDown');
      run(0.15);
    } else if (gear === 0) {
      for (let i = 0; i < 3; i++) {
        press('shiftDown');
        run(0.15);
      }
    }
    assert.equal(s.gear, gear);
    let minRpm = Infinity;
    let maxRpm = -Infinity;
    run(5, { throttle: 1 }, () => {
      minRpm = Math.min(minRpm, s.rpm);
      maxRpm = Math.max(maxRpm, s.rpm);
    });
    assert.ok(minRpm >= 900, `gear ${gear} min rpm ${minRpm}`);
    assert.ok(maxRpm <= 2000, `gear ${gear} max rpm ${maxRpm}`);
    if (gear !== 0) {
      assert.ok(s.vLong > 0, `gear ${gear} forward motion ${s.vLong}`);
    }
  }
});

test('heat past the red threshold takes power away', () => {
  assert.equal(thermalDerate(100), 1);
  assert.ok(Math.abs(thermalDerate(120) - 0.7) < 1e-9);
  assert.ok(thermalDerate(115) < thermalDerate(110));
  const cold = rig('hayate', 'asphalt', true);
  const hot = rig('hayate', 'asphalt', true);
  for (const r of [cold, hot]) {
    r.s.gear = 3;
    r.s.vz = 20;
    r.s.speed = 20;
  }
  cold.run(3, { throttle: 1 });
  hot.run(3, { throttle: 1 }, () => {
    hot.s.temp = 120;
  });
  const gained = (r) => r.s.speed - 20;
  assert.ok(gained(hot) < gained(cold) * 0.85, `hot gained ${gained(hot)} cold ${gained(cold)}`);
});

test('tarmac grip is high for the sports cars and gravel grip is untouched', () => {
  const asphalt = Object.fromEntries(CARS.map((c) => [c.id, cornering(c, 'asphalt') / 9.81]));
  assert.ok(asphalt.hayate > 1.25 && asphalt.hayate < 1.5, JSON.stringify(asphalt));
  assert.ok(asphalt.vespera > 1.3 && asphalt.vespera < 1.55, JSON.stringify(asphalt));
  assert.ok(asphalt.rampart > 1.1 && asphalt.rampart < asphalt.hayate, JSON.stringify(asphalt));
  const gravel = Object.fromEntries(CARS.map((c) => [c.id, cornering(c, 'gravel') / 9.81]));
  const was = { hayate: 0.8, rampart: 0.61, vespera: 0.59 };
  for (const id of Object.keys(was)) assert.ok(Math.abs(gravel[id] - was[id]) / was[id] < 0.03, `${id} gravel ${gravel[id]}`);
});

test('downforce adds grip with speed on tarmac and none on gravel', () => {
  const vespera = carById('vespera');
  const slow = cornering(vespera, 'asphalt', 22, 3) / 9.81;
  const fast = cornering(vespera, 'asphalt', 50, 5) / 9.81;
  assert.ok(fast > slow * 1.12, `slow ${slow.toFixed(2)} g, fast ${fast.toFixed(2)} g`);
  const rampart = carById('rampart');
  const rSlow = cornering(rampart, 'asphalt', 22, 3) / 9.81;
  const rFast = cornering(rampart, 'asphalt', 50, 5) / 9.81;
  assert.ok(fast / slow > rFast / rSlow, 'the exotic should gain more from downforce than the muscle car');
  const bare = { ...vespera, aero: { front: 0, rear: 0 } };
  const withWing = cornering(vespera, 'gravel', 30, 3);
  const without = cornering(bare, 'gravel', 30, 3);
  assert.ok(Math.abs(withWing - without) / without < 0.005, `gravel ${without} with downforce ${withWing}`);
  assert.ok(cornering(vespera, 'asphalt', 50, 5) > cornering(bare, 'asphalt', 50, 5) * 1.1, 'no gain on tarmac');
});

test('tarmac grip falls in wet weather while gravel and dirt do not change', () => {
  const hayate = carById('hayate');
  const gDry = flat('asphalt');
  const gWet = flat('asphalt');

  const sDry = createVehicleState(hayate);
  sDry.wet = 0;
  placeVehicle(sDry, hayate, 0, 0, 0, gDry);
  sDry.vz = 100 / 3.6;
  sDry.speed = 100 / 3.6;
  sDry.gear = 3;
  let t = 0;
  while (sDry.speed > 0.3 && t < 15) {
    stepVehicle(sDry, hayate, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, gDry, DT);
    t += DT;
  }

  const sWet = createVehicleState(hayate);
  sWet.wet = 1;
  placeVehicle(sWet, hayate, 0, 0, 0, gWet);
  sWet.vz = 100 / 3.6;
  sWet.speed = 100 / 3.6;
  sWet.gear = 3;
  t = 0;
  while (sWet.speed > 0.3 && t < 15) {
    stepVehicle(sWet, hayate, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, gWet, DT);
    t += DT;
  }

  const ratio = sWet.z / sDry.z;
  assert.ok(ratio > 1.2 && ratio < 1.35, `wet braking distance should be ~1.25x dry, got ${ratio.toFixed(2)} (${sDry.z.toFixed(1)} m vs ${sWet.z.toFixed(1)} m)`);

  for (const surf of ['gravel', 'dirt', 'grass']) {
    const sGravelDry = createVehicleState(hayate);
    sGravelDry.wet = 0;
    const gSurf = flat(surf);
    placeVehicle(sGravelDry, hayate, 0, 0, 0, gSurf);
    sGravelDry.vz = 100 / 3.6;
    sGravelDry.speed = 100 / 3.6;
    sGravelDry.gear = 3;
    t = 0;
    while (sGravelDry.speed > 0.3 && t < 15) {
      stepVehicle(sGravelDry, hayate, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, gSurf, DT);
      t += DT;
    }

    const sGravelWet = createVehicleState(hayate);
    sGravelWet.wet = 1;
    placeVehicle(sGravelWet, hayate, 0, 0, 0, gSurf);
    sGravelWet.vz = 100 / 3.6;
    sGravelWet.speed = 100 / 3.6;
    sGravelWet.gear = 3;
    t = 0;
    while (sGravelWet.speed > 0.3 && t < 15) {
      stepVehicle(sGravelWet, hayate, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, gSurf, DT);
      t += DT;
    }

    assert.equal(sGravelDry.z.toFixed(2), sGravelWet.z.toFixed(2), `${surf} braking distance must not change with wetness`);
  }
});
