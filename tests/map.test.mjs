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
    rotate: log('rotate'),
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
    drawImage: log('drawImage'),
    setLineDash: log('setLineDash'),
    createRadialGradient: (...args) => (calls.push({ fn: 'createRadialGradient', args }), { addColorStop() {} }),
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

test('drawPoiIcon renders round badges: a police star, a garage wrench, a hideout house, a toll gate', async () => {
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
  assert.ok(gHideout.calls.some((c) => c.fn === 'arc') && gHideout.calls.some((c) => c.fn === 'closePath'), 'a badge with a house in it');

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
    assert.ok(g.calls.some((c) => c.fn === 'closePath'), 'the star is a closed path');
    assert.ok(g.calls.findIndex((c) => c.fn === 'clip') < g.calls.findIndex((c) => c.fn === 'scale'), 'drawn inside the clip');
  } finally {
    globalThis.document = saved;
  }
});

test('Minimap draws police and helicopter markers, rotates along heading, and clamps out-of-circle markers to rim', async () => {
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
      lots: [],
    };
    const markers = [
      { kind: 'police', x: 100, z: 100, yaw: 0 },
      { kind: 'heli', x: 110, z: 110, yaw: 0.5, search: { x: 100, z: 100, r: 25 } },
      // Marker far away to test rim clamping
      { kind: 'police', x: 2000, z: 2000, yaw: 0 },
    ];
    const mm = new Minimap({ appendChild() {} }, ground, () => markers);
    mm.draw(100, 100, 0, 0, 0.1);

    const arcCalls = g.calls.filter((c) => c.fn === 'arc');
    // The searchlight's glow, the helicopter's disc, the units' sight and the rim.
    assert.ok(arcCalls.length >= 3, 'searchlight glow and helicopter disc drawn');
    assert.ok(g.calls.some((c) => c.fn === 'createRadialGradient'), 'sight and searchlight fade out');

    const rotateCalls = g.calls.filter((c) => c.fn === 'rotate');
    assert.ok(rotateCalls.length >= 3, 'inside markers and clamped rim marker rotated');
  } finally {
    globalThis.document = saved;
  }
});

test('MapScreen.render draws police cars and helicopter markers with searchlight', async () => {
  const { MapScreen } = await import('../src/ui/map.js');
  const g = createMockContext();
  const canvas = { getContext: () => g, width: 800, height: 600, addEventListener() {} };
  const saved = globalThis.document;
  const savedWindow = globalThis.window;
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return canvas;
      return { appendChild() {}, className: '', style: {} };
    },
  };
  globalThis.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener() {},
  };

  try {
    const mockWorld = {
      mapData: {
        bounds: { half: 1000 },
        roads: [],
        pois: [],
        zones: [],
      },
    };
    const markers = [
      { kind: 'police', x: 200, z: -200, yaw: 1.2 },
      { kind: 'heli', x: 250, z: -220, yaw: 0.4, search: { x: 200, z: -200, r: 30 } },
    ];
    const map = new MapScreen({ appendChild() {} }, mockWorld, () => markers);
    map.render(null);

    const arcCalls = g.calls.filter((c) => c.fn === 'arc');
    assert.ok(arcCalls.length >= 2, 'heli searchlight circle and heli center hub drawn');

    const rotateCalls = g.calls.filter((c) => c.fn === 'rotate');
    assert.ok(rotateCalls.length >= 2, 'police car and helicopter rotated');
  } finally {
    globalThis.document = saved;
    globalThis.window = savedWindow;
  }
});

test('MapScreen handles click and Enter to set waypoint, Backspace to clear, and draws route', async () => {
  const { MapScreen } = await import('../src/ui/map.js');
  const g = createMockContext();
  const canvas = {
    getContext: () => g,
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener() {},
  };
  const saved = globalThis.document;
  const savedWindow = globalThis.window;
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return canvas;
      return { appendChild() {}, className: '', style: {} };
    },
  };
  globalThis.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener() {},
  };

  try {
    let waypoint = null;
    let cleared = false;
    const routeData = {
      route: { points: [[0, 0], [100, 100]], length: 141.4, lanes: [] },
      destination: { x: 100, z: 100 },
      distance: 141.4,
      arrived: false,
    };

    const mockWorld = {
      mapData: {
        bounds: { half: 1000 },
        roads: [],
        pois: [{ kind: 'station', id: 's1', name: 'TEST GAS', x: 200, z: 200 }],
        zones: [],
      },
    };

    const map = new MapScreen(
      { appendChild() {} },
      mockWorld,
      () => [],
      () => (waypoint ? routeData : null),
      (pt) => { waypoint = pt; },
      () => { waypoint = null; cleared = true; },
    );

    // Click near POI at (200, 200)
    // screen center is 400, 300; cam is at 0, 0; zoom is 0.55
    const screenX = 400 + 200 * 0.55;
    const screenY = 300 + 200 * 0.55;
    map.handleClick(screenX, screenY);
    assert.deepEqual(waypoint, { x: 200, z: 200 }, 'snaps to nearby POI');

    // Render with route
    map.render({ spec: { name: 'CORVETTE' }, state: { x: 0, z: 0, yaw: 0, speed: 0, rpm: 0, gear: 1 } });
    const lineToCalls = g.calls.filter((c) => c.fn === 'lineTo');
    assert.ok(lineToCalls.length > 0, 'draws route line');

    // Backspace clears waypoint
    cleared = false;
    const mockInputBackspace = {
      down: new Set(),
      hit: new Set(['Backspace']),
      pressed: (k) => false,
    };
    map.update(mockInputBackspace, null);
    assert.equal(cleared, true, 'clears waypoint on Backspace');
    assert.equal(waypoint, null);

    // Enter sets waypoint at cam center
    const mockInputEnter = {
      down: new Set(),
      hit: new Set(['Enter']),
      pressed: (k) => false,
    };
    map.camX = 50;
    map.camZ = 75;
    map.update(mockInputEnter, null);
    assert.deepEqual(waypoint, { x: 50, z: 75 }, 'sets waypoint at cam position on Enter');
  } finally {
    globalThis.document = saved;
    globalThis.window = savedWindow;
  }
});

test('Minimap draws route polyline and clamps edge waypoint indicator', async () => {
  const { Minimap } = await import('../src/ui/minimap.js');
  const { RALLY } = await import('../src/world/layout.js');
  const g = createMockContext();
  g.clip = () => g.calls.push({ fn: 'clip', args: [] });
  const canvas = { getContext: () => g, width: 168, height: 168, className: '' };
  const saved = globalThis.document;
  globalThis.document = {
    createElement: () => canvas,
  };

  try {
    const ground = {
      roads: { roads: [], byId: new Map([[RALLY.road, { path: { sample: () => ({ x: 0, z: 0 }) } }]]) },
      pads: [],
      lots: [],
    };
    const routeData = {
      route: { points: [[0, 0], [50, 50], [500, 500]], length: 700, lanes: [] },
      destination: { x: 500, z: 500 },
      distance: 700,
      arrived: false,
    };
    const mm = new Minimap({ appendChild() {} }, ground, () => [], () => routeData);
    // Draw with car at (0, 0) - waypoint at (500, 500) is far off screen (> R=84)
    mm.draw(0, 0, 0, 0, 0.1);

    const lineToCalls = g.calls.filter((c) => c.fn === 'lineTo');
    assert.ok(lineToCalls.length >= 2, 'draws route polyline');
    const rotateCalls = g.calls.filter((c) => c.fn === 'rotate');
    assert.ok(rotateCalls.length >= 1, 'rotates clamped edge waypoint indicator');
  } finally {
    globalThis.document = saved;
  }
});

test('routeHud updates distance readout and ARRIVED state', async () => {
  const { routeHud } = await import('../src/ui/route-hud.js');
  const classList = new Set();
  const mockEl = {
    className: '',
    textContent: '',
    style: { display: '' },
    classList: {
      add: (...names) => names.forEach((n) => classList.add(n)),
      remove: (...names) => names.forEach((n) => classList.delete(n)),
      contains: (n) => classList.has(n),
    },
  };
  const saved = globalThis.document;
  globalThis.document = {
    createElement: () => mockEl,
  };

  try {
    const hud = routeHud({ appendChild() {} });

    // No tracker
    hud.update(null);
    assert.equal(mockEl.textContent, '');
    assert.equal(classList.has('on'), false);

    // Active route < 1000m
    const mockTrackerM = {
      route: { points: [], length: 420 },
      destination: { x: 100, z: 100 },
      distance: 420.2,
      arrived: false,
    };
    hud.update(mockTrackerM);
    assert.equal(mockEl.textContent, '420 M');
    assert.equal(classList.has('on'), true);

    // Active route >= 1000m
    const mockTrackerKm = {
      route: { points: [], length: 3500 },
      destination: { x: 100, z: 100 },
      distance: 3520,
      arrived: false,
    };
    hud.update(mockTrackerKm);
    assert.equal(mockEl.textContent, '3.5 KM');
    assert.equal(classList.has('on'), true);

    // Arrived
    const mockTrackerArrived = {
      route: null,
      destination: { x: 100, z: 100 },
      distance: 0,
      arrived: true,
    };
    hud.update(mockTrackerArrived, 0.1);
    assert.equal(mockEl.textContent, 'ARRIVED');
    assert.equal(classList.has('arrived'), true);
  } finally {
    globalThis.document = saved;
  }
});

