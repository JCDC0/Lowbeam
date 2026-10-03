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
