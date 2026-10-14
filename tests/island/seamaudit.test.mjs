import test from 'node:test';
import assert from 'node:assert/strict';
import { island } from '../island.mjs';
import { auditSeams, byKind } from '../../tools/seamaudit.mjs';

const found = auditSeams(island());

/**
 * Gate 3 of the bug board, at 0.10.46: what the seam audit finds today, each kind seen in the game
 * (R-01). A fix lowers its number here; nothing may raise one.
 */
const KNOWN = { walk: 147, overlap: 61, hole: 57, step: 393 };

test('the road seams are no worse than the known R-01 faults', () => {
  const n = byKind(found);
  for (const kind of Object.keys(n)) assert.ok(kind in KNOWN, `a new kind of seam fault: ${kind}`);
  for (const [kind, most] of Object.entries(KNOWN)) assert.ok((n[kind] || 0) <= most, `${n[kind]} ${kind} faults, ${most} known`);
});

test('the audit finds the slanted kogyo crossing, a sidewalk across a carriageway', () => {
  const at = found.filter((f) => f.road === 'kogyo-a275' && f.other === 'kogyo-b270');
  assert.ok(at.some((f) => f.kind === 'walk'), 'its sidewalk drawn on the other road');
  assert.ok(at.some((f) => f.kind === 'overlap'), 'the two carriageways over each other outside the patch');
});

test('a slip road meeting its carriageway is a shared edge, never an overlap', () => {
  const g = island();
  for (const f of found.filter((f) => f.kind === 'overlap')) {
    const a = g.roads.byId.get(f.road);
    const b = g.roads.byId.get(f.other);
    assert.notEqual(a.def.slip?.carriageId, b.id, `${f.road} on ${f.other}`);
    assert.notEqual(b.def.slip?.carriageId, a.id, `${f.road} on ${f.other}`);
  }
});
