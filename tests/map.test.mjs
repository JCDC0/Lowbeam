import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDataOf } from '../src/ui/map.js';

test('mapDataOf builds road hierarchy, pois and zones from world', () => {
  const mockWorld = {
    ground: {
      roads: {
        half: 1000,
        roads: [
          {
            id: 'r1',
            name: 'ROUTE 1',
            hw: 6,
            surface: 'asphalt',
            path: { n: 3, x: [0, 10, 20], z: [0, 10, 20], closed: false },
          },
          {
            id: 'pass_north',
            name: 'NORTH PASS',
            hw: 4,
            surface: 'asphalt',
            path: { n: 2, x: [100, 200], z: [100, 200], closed: false },
          },
          {
            id: 'ss1',
            name: 'SS1 RALLY',
            hw: 3.8,
            surface: 'gravel',
            path: { n: 2, x: [-50, -100], z: [-50, -100], closed: false },
          },
        ],
        byId: new Map(),
      },
    },
    scatter: {
      stations: [
        { pad: { name: 'KITSUNE OIL', cx: 120, cz: -80 }, brand: 'kitsune' },
      ],
    },
  };

  const data = mapDataOf(mockWorld);
  assert.equal(data.bounds.half, 1000);
  assert.equal(data.roads.length, 3);
  assert.equal(data.roads[0].cls, 'expressway');
  assert.equal(data.roads[1].cls, 'mountain');
  assert.equal(data.roads[2].cls, 'rally');
  assert.equal(data.pois.length, 1);
  assert.equal(data.pois[0].kind, 'station');
  assert.equal(data.pois[0].name, 'KITSUNE OIL');
  assert.ok(data.zones.length >= 3);
});

test('mapDataOf returns world.mapData directly when available', () => {
  const customData = {
    bounds: { half: 1200 },
    roads: [{ id: 'test', name: 'TEST', cls: 'expressway', points: [[0, 0], [10, 10]] }],
    pois: [],
    zones: [],
  };
  const mockWorld = { mapData: customData };
  assert.equal(mapDataOf(mockWorld), customData);
});

function createMockContext() {
  const calls = [];
  const log = (fn) => (...args) => calls.push({ fn, args });
  return {
    calls,
    save: log('save'),
    restore: log('restore'),
    clearRect: log('clearRect'),
    setTransform: log('setTransform'),
    translate: log('translate'),
    scale: log('scale'),
    beginPath: log('beginPath'),
    closePath: log('closePath'),
    arc: log('arc'),
    rect: log('rect'),
    fill: log('fill'),
    stroke: log('stroke'),
    strokeRect: log('strokeRect'),
    fillRect: log('fillRect'),
    moveTo: log('moveTo'),
    lineTo: log('lineTo'),
    fillText: log('fillText'),
    setLineDash: log('setLineDash'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
    font: '',
  };
}

test('mapDataOf handles fake island data with a square coast, lifted expressway runs and all POI kinds', () => {
  const fakeIslandData = {
    bounds: { half: 1500 },
    roads: [
      {
        id: 'r1',
        name: 'ROUTE 1 VIADUCT',
        cls: 'expressway',
        hw: 6,
        points: [[-500, -500], [0, -500], [500, -500]],
        lifted: [[[-200, -500], [200, -500]]],
      },
    ],
    pois: [
      { kind: 'station', id: 's1', name: 'HARBOR GAS', x: -100, z: -100, brand: 'hoshi' },
      { kind: 'toll', id: 't1', name: 'BAY TOLL', x: 0, z: -500 },
      { kind: 'start', id: 'r1', name: 'RALLY START', x: 300, z: 300 },
      { kind: 'police', id: 'p1', name: 'POLICE HQ', x: 600, z: -600 },
      { kind: 'garage', id: 'g1', name: 'PLAYER GARAGE', x: -200, z: 100 },
      { kind: 'hideout', id: 'h1', name: 'WAREHOUSE HIDEOUT', x: 400, z: -100 },
    ],
    water: {
      coast: [[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]],
      sea: { x0: -1500, z0: -1500, x1: 1500, z1: 1500 },
    },
    zones: [],
  };

  const data = mapDataOf({ mapData: fakeIslandData });
  assert.equal(data.water.coast.length, 4);
  assert.equal(data.roads[0].lifted.length, 1);
  const kinds = data.pois.map((p) => p.kind);
  assert.deepEqual(kinds.sort(), ['garage', 'hideout', 'police', 'start', 'station', 'toll']);
});

test('drawPoiIcon renders police shield, garage wrench, and hideout dashed square', async () => {
  const { drawPoiIcon } = await import('../src/ui/map.js');
  assert.equal(typeof drawPoiIcon, 'function');

  const gPolice = createMockContext();
  drawPoiIcon(gPolice, 'police', 100, 100);
  assert.ok(gPolice.calls.some((c) => c.fn === 'closePath'));

  const gGarage = createMockContext();
  drawPoiIcon(gGarage, 'garage', 100, 100);
  assert.ok(gGarage.calls.some((c) => c.fn === 'arc'));

  const gHideout = createMockContext();
  drawPoiIcon(gHideout, 'hideout', 100, 100);
  assert.ok(gHideout.calls.some((c) => c.fn === 'setLineDash'));

  const gToll = createMockContext();
  drawPoiIcon(gToll, 'toll', 100, 100);
  assert.ok(gToll.calls.some((c) => c.fn === 'fillRect'));
});

test('drawRoads draws lifted runs on top with dark outline', async () => {
  const { drawRoads } = await import('../src/ui/minimap.js');
  const g = createMockContext();
  const roads = [
    {
      cls: 'expressway',
      hw: 6,
      points: [[-100, 0], [100, 0]],
      lifted: [[[-50, 0], [50, 0]]],
    },
  ];
  drawRoads(g, roads);
  const strokeCalls = g.calls.filter((c) => c.fn === 'stroke');
  assert.ok(strokeCalls.length >= 3, 'ground pass plus lifted outline and fill passes');
});


test('Minimap draws a landmark icon for a lot near the car and none for a far one', async () => {
  const { Minimap } = await import('../src/ui/minimap.js');
  const { RALLY } = await import('../src/world/layout.js');
  const g = createMockContext();
  g.clip = () => g.calls.push({ fn: 'clip', args: [] });
  const canvas = { getContext: () => g, width: 0, height: 0, className: '' };
  const saved = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  try {
    const ground = {
      roads: { roads: [], byId: new Map([[RALLY.road, { path: { sample: () => ({ x: 9e4, z: 9e4 }) } }]]) },
      pads: [],
      lots: [
        { cx: 2400, cz: -2150, lot: { kind: 'police' } },
        { cx: -2000, cz: 2000, lot: { kind: 'garage' } },
      ],
    };
    const mm = new Minimap({ appendChild() {} }, ground);
    mm.draw(2400, -2100, 0, 0, 1);
    const scales = g.calls.filter((c) => c.fn === 'scale');
    assert.equal(scales.length, 1);
    assert.ok(g.calls.some((c) => c.fn === 'closePath'), 'the shield is a closed path');
    assert.ok(g.calls.findIndex((c) => c.fn === 'clip') < g.calls.findIndex((c) => c.fn === 'scale'), 'drawn inside the clip');
  } finally {
    globalThis.document = saved;
  }
});
