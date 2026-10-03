import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoadNetwork } from '../src/world/roads.js';
import { TrafficNet, lightState } from '../src/traffic/net.js';

test('a straight street crossed by a curved one at 55 degrees has one light node whose axes alternate', () => {
  const net = new RoadNetwork([
    {
      id: 'straight',
      name: 'STRAIGHT',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-150, 0], [0, 0], [150, 0]],
    },
    {
      id: 'curved',
      name: 'CURVED',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-70, -100], [0, 0], [70, 100]],
    },
  ]);
  const tnet = new TrafficNet(net);

  assert.equal(tnet.nodes.length, 1);
  const node = tnet.nodes[0];

  const straightLane = tnet.lane('straight', 1, 0);
  const curvedLane = tnet.lane('curved', 1, 0);
  assert.ok(straightLane);
  assert.ok(curvedLane);

  const straightStop = straightLane.stops.find((s) => s.node === node);
  const curvedStop = curvedLane.stops.find((s) => s.node === node);
  assert.ok(straightStop);
  assert.ok(curvedStop);

  assert.notEqual(straightStop.axis, curvedStop.axis);
  assert.equal(lightState(node, straightStop.axis, 0), 'green');
  assert.equal(lightState(node, curvedStop.axis, 0), 'red');
});

test('a 50-degree crossing between two streets assigns alternating axes per road even when world headings share an octant', () => {
  const net = new RoadNetwork([
    {
      id: 'roadA',
      name: 'ROADA',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-100, -47], [0, 0], [100, 47]],
    },
    {
      id: 'roadB',
      name: 'ROADB',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-100, 47], [0, 0], [100, -47]],
    },
  ]);
  const tnet = new TrafficNet(net);

  assert.equal(tnet.nodes.length, 1);
  const node = tnet.nodes[0];
  const stopA = tnet.lane('roadA', 1, 0)?.stops.find((s) => s.node === node);
  const stopB = tnet.lane('roadB', 1, 0)?.stops.find((s) => s.node === node);
  assert.ok(stopA);
  assert.ok(stopB);
  assert.notEqual(stopA.axis, stopB.axis);
});


test('a street ending on the side of another forms a T junction with a yield stop and turn links both ways', () => {
  const net = new RoadNetwork([
    {
      id: 'through',
      name: 'THROUGH',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[0, -150], [0, 0], [0, 150]],
    },
    {
      id: 'side',
      name: 'SIDE',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[150, 0], [0, 0]],
    },
  ]);
  const tnet = new TrafficNet(net);

  const sideIn = tnet.lane('side', 1, 0);
  assert.ok(sideIn);

  const yieldStop = sideIn.stops.find((s) => s.yield);
  assert.ok(yieldStop, 'side road has a yield stop');
  assert.ok(yieldStop.yield.lanes.length >= 2, 'yield stop watches through road lanes');
  assert.ok(Math.abs(yieldStop.yield.at - 150) < 10, 'yield stop watches junction position on through road');

  const turnEnds = sideIn.ends.filter((l) => l.kind === 'turn');
  assert.equal(turnEnds.length, 2, 'side road turns both ways onto through road');

  const throughF = tnet.lane('through', 1, 0);
  const throughR = tnet.lane('through', -1, 0);
  assert.ok(throughF);
  assert.ok(throughR);

  const turnInF = throughF.mids.filter((l) => l.lane.road.id === 'side' && l.kind === 'turn');
  const turnInR = throughR.mids.filter((l) => l.lane.road.id === 'side' && l.kind === 'turn');
  assert.ok(turnInF.length >= 1, 'through road forward turns into side road');
  assert.ok(turnInR.length >= 1, 'through road reverse turns into side road');
});

test('an arterial that crosses a street on a 7 m lift creates no junction node', () => {
  const net = new RoadNetwork([
    {
      id: 'ground',
      name: 'GROUND',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[0, -150], [0, 0], [0, 150]],
    },
    {
      id: 'bridge',
      name: 'BRIDGE',
      surface: 'asphalt',
      hw: 5.6,
      priority: 3,
      smooth: 40,
      cls: 'arterial',
      lifts: [{ at: [0, 0], height: 7, half: 80, flat: 30 }],
      points: [[-150, 0], [0, 0], [150, 0]],
    },
  ]);
  const tnet = new TrafficNet(net);

  assert.equal(tnet.nodes.length, 0, 'no light node at overpass');
  const groundLane = tnet.lane('ground', 1, 0);
  const bridgeLane = tnet.lane('bridge', 1, 0);
  assert.ok(groundLane);
  assert.ok(bridgeLane);
  assert.equal(groundLane.stops.length, 0);
  assert.equal(bridgeLane.stops.length, 0);
  assert.equal(groundLane.mids.filter((l) => l.lane.road.id === 'bridge').length, 0);
  assert.equal(bridgeLane.mids.filter((l) => l.lane.road.id === 'ground').length, 0);
});

test('two junctions closer than 25 m merge into one light node', () => {
  const net = new RoadNetwork([
    {
      id: 'main',
      name: 'MAIN',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[0, -150], [0, 0], [0, 150]],
    },
    {
      id: 'cross1',
      name: 'CROSS1',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-100, 0], [0, 0], [100, 0]],
    },
    {
      id: 'cross2',
      name: 'CROSS2',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-100, 18], [0, 18], [100, 18]],
    },
  ]);
  const tnet = new TrafficNet(net);

  assert.equal(tnet.nodes.length, 1, 'junctions 18 m apart merge into one light node');
});

test('a crossing with five or more arms merges into one light node', () => {
  const net = new RoadNetwork([
    {
      id: 'armA',
      name: 'ARMA',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-100, 0], [0, 0], [100, 0]],
    },
    {
      id: 'armB',
      name: 'ARMB',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[0, -100], [0, 0], [0, 100]],
    },
    {
      id: 'armC',
      name: 'ARMC',
      surface: 'asphalt',
      hw: 4.5,
      priority: 2.5,
      smooth: 20,
      cls: 'street',
      points: [[-70, -70], [0, 0], [70, 70]],
    },
  ]);
  const tnet = new TrafficNet(net);

  assert.equal(tnet.nodes.length, 1, 'three crossing streets (6 arms) share one light node');
});

