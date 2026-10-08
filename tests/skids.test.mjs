import test from 'node:test';
import assert from 'node:assert/strict';
import { playerSlide, agentSlide, PLAYER_SKID, TURN_GRIP } from '../src/render/skid-rules.js';

const player = (o) => ({ contact: true, skid: 0, wheelspin: 0, surfRear: 'asphalt', speed: 20, ...o });

test('the player leaves marks in a slide or a wheelspin on tarmac, none gripping, flying or on gravel', () => {
  assert.equal(playerSlide(player({ skid: 0.8 })), 0, 'gripping');
  assert.equal(playerSlide(player({ skid: PLAYER_SKID[1] + 1 })), 1, 'a full slide');
  assert.ok(playerSlide(player({ wheelspin: 0.7 })) > 0.5, 'a burnout');
  assert.equal(playerSlide(player({ skid: 6, contact: false })), 0, 'in the air');
  assert.equal(playerSlide(player({ skid: 6, surfRear: 'gravel' })), 0, 'gravel takes no mark');
});

test('traffic marks the road when knocked sideways or turning harder than its grip allows', () => {
  const car = (o) => ({ mode: 'drive', yaw: 0, vx: 0, vz: 20, ...o });
  assert.equal(agentSlide(car({}), 0), 0, 'straight on');
  assert.equal(agentSlide(car({}), 0.2), 0, 'a lane change at 20 m/s is 4 m/s2, nothing');
  assert.ok(agentSlide(car({}), (TURN_GRIP[1] + 1) / 20) === 1, 'a hard turn at speed');
  assert.ok(agentSlide(car({ mode: 'knocked', vx: 6, vz: 4 }), 0) > 0.8, 'knocked and sliding sideways');
  assert.equal(agentSlide(car({ mode: 'knocked', vx: 0.5, vz: 10 }), 0), 0, 'knocked but rolling straight');
  assert.equal(agentSlide(car({ mode: 'parked', vx: 6 }), 3), 0, 'a parked unit');
});
