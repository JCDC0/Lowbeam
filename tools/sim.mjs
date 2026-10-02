// Tuning bench for the three cars. Runs headless: node tools/sim.mjs
// Prints 0-100, 0-160, quarter mile, top speed, braking and skidpad grip per car,
// then slide behavior on gravel. Use it before and after touching src/vehicles/specs.js.
import { CARS } from '../src/vehicles/specs.js';
import { createVehicleState, placeVehicle, stepVehicle, DT } from '../src/vehicles/physics.js';

const flat = (surface) => () => ({ h: 0, surface });

function start(spec, surface, v0 = 0, gear = 1) {
  const g = flat(surface);
  const s = createVehicleState(spec);
  placeVehicle(s, spec, 0, 0, 0, g);
  s.vz = v0;
  s.speed = v0;
  if (v0) s.gear = gear;
  return { s, g };
}

for (const spec of CARS) {
  let { s, g } = start(spec, 'asphalt');
  let t = 0, t100 = 0, t160 = 0, quarter = 0, top = 0;
  while (t < 60) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, g, DT);
    t += DT;
    const kmh = s.speed * 3.6;
    if (!t100 && kmh >= 100) t100 = t;
    if (!t160 && kmh >= 160) t160 = t;
    if (!quarter && s.z >= 402) quarter = t;
    top = Math.max(top, kmh);
  }

  ({ s, g } = start(spec, 'asphalt', 100 / 3.6, 3));
  t = 0;
  while (s.speed > 0.3 && t < 10) {
    stepVehicle(s, spec, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, g, DT);
    t += DT;
  }
  const brake = s.z;

  const grip = {};
  for (const surf of ['asphalt', 'gravel']) {
    ({ s, g } = start(spec, surf, 20, 2));
    let sum = 0, n = 0;
    t = 0;
    while (t < 6) {
      const throttle = Math.min(1, Math.max(0, (20 - s.speed) * 0.4 + 0.15));
      stepVehicle(s, spec, { throttle, brake: 0, steer: t > 0.5 ? 0.5 : 0, handbrake: 0 }, g, DT);
      t += DT;
      if (t > 2.5) { sum += Math.abs(s.aLat); n++; }
    }
    grip[surf] = sum / n / 9.81;
  }

  ({ s, g } = start(spec, 'gravel', 25, 3));
  let maxBeta = 0;
  t = 0;
  while (t < 4) {
    stepVehicle(s, spec, { throttle: 1, brake: 0, steer: t < 3 ? 1 : 0, handbrake: 0 }, g, DT);
    t += DT;
    maxBeta = Math.max(maxBeta, Math.abs(Math.atan2(s.vLat, Math.abs(s.vLong))) * 57.3);
  }

  console.log(
    `${spec.id.padEnd(8)} 0-100 ${t100.toFixed(2)}s  0-160 ${t160.toFixed(2)}s  1/4 ${quarter.toFixed(2)}s  ` +
      `top ${top.toFixed(0)} km/h  100-0 ${brake.toFixed(1)} m  grip asphalt ${grip.asphalt.toFixed(2)}g ` +
      `gravel ${grip.gravel.toFixed(2)}g  gravel full-lock slide ${maxBeta.toFixed(0)} deg`
  );
}
