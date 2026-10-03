import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../src/world/spline.js';
import { paceNotes, NOTE_STEP, HAIRPIN_R, INTO_S } from '../src/race/pacenotes.js';

/** A flat path built from `points`, with a constant or supplied height. */
function path(points, height = () => 0) {
  const p = new Path(points, { step: 1 });
  p.height = height;
  return p;
}

/** An arc of the given radius. `sign` picks the turn: +1 sweeps so the yaw increases. */
function arc(radius, from, to, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return pts;
}

/** Sweeps so the path bends left: the yaw increases along the way. */
const left = (r, sweep = Math.PI * 0.6) => arc(r, Math.PI, Math.PI + sweep).reverse();

/** Sweeps so the path bends right: the yaw decreases along the way. */
const right = (r, sweep = Math.PI * 0.6) => arc(r, Math.PI, Math.PI + sweep);

test('a circle of radius 15 is a hairpin', () => {
  const notes = paceNotes(path(arc(15, Math.PI, Math.PI * 1.4)), () => 0);
  assert.ok(notes.length > 0, 'a 15 m circle should produce a note');
  const n = notes[0];
  assert.equal(n.mods.includes('hairpin'), true, `mods ${JSON.stringify(n.mods)}`);
  assert.ok(n.grade <= 2, `a hairpin should be the tightest grade, got ${n.grade}`);
});

test('a circle of radius 150 is a gentle 5 or 6', () => {
  const notes = paceNotes(path(arc(150, Math.PI, Math.PI * 1.4)), () => 0);
  assert.ok(notes.length > 0);
  const n = notes[0];
  assert.equal(n.mods.includes('hairpin'), false, '150 m is not a hairpin');
  assert.ok(n.grade >= 5, `a 150 m radius should be grade 5 or 6, got ${n.grade}`);
});

test('a left-hand bend reads as left and a right-hand bend as right', () => {
  const l = paceNotes(path(left(60)), () => 0).filter((x) => x.grade <= 5);
  const r = paceNotes(path(right(60)), () => 0).filter((x) => x.grade <= 5);
  assert.ok(l.length > 0 && r.length > 0, 'expected a corner on each bend');
  assert.equal(l[0].dir, 'left', `left bend read as ${l[0].dir}`);
  assert.equal(r[0].dir, 'right', `right bend read as ${r[0].dir}`);
});

test('an S bend marks the second corner as into', () => {
  // A smooth S: the path swings one way then the other, so the second corner is called into
  // the first.
  const pts = [[0, 0], [20, 6], [45, 10], [70, 2], [95, -8], [120, -10], [145, -4], [170, 6], [195, 10]];
  const notes = paceNotes(path(pts), () => 0);
  assert.ok(notes.length >= 2, `expected two corners, got ${notes.length}`);
  const into = notes.filter((n) => n.mods.includes('into'));
  assert.ok(into.length >= 1, `no corner called into: ${JSON.stringify(notes)}`);
  // A corner that is into something must have a corner ahead of it within INTO_S.
  for (const n of into) {
    const later = notes.some((m) => m.s > n.s && m.s - n.s <= INTO_S + NOTE_STEP);
    assert.ok(later, `into at s=${n.s} has no corner after it`);
  }
});

test('a corner lasting over 60 m is long', () => {
  const notes = paceNotes(path(arc(150, Math.PI, Math.PI * 1.55)), () => 0);
  const n = notes[0];
  assert.equal(n.mods.includes('long'), true, `mods ${JSON.stringify(n.mods)}`);
});

test('a corner that changes radius is marked tightens or opens', () => {
  const pts = [...arc(200, Math.PI, Math.PI * 1.25, 16), ...arc(60, Math.PI * 1.25, Math.PI * 1.5, 10)];
  const notes = paceNotes(path(pts), () => 0);
  assert.ok(notes.length > 0, 'expected a corner');
  const flagged = notes.some((n) => n.mods.includes('tightens') || n.mods.includes('opens'));
  assert.ok(flagged, `no radius change flagged: ${JSON.stringify(notes)}`);
});

test('a sharp drop in grade is a crest', () => {
  // A tight corner with a climb topping out in the middle of it: the top of the climb is a
  // crest and it attaches to that corner.
  const pts = [[0, 0], [25, 3], [50, 12], [62, 34], [60, 60], [45, 78], [20, 86], [-6, 84]];
  const p = path(pts);
  const mid = p.length / 2;
  const peak = 20;
  const height = (s) => (s > mid * 0.5 && s < mid ? (s - mid * 0.5) * (2 * peak / (mid - mid * 0.5)) : s >= mid ? peak : 0);
  const notes = paceNotes(p, height);
  assert.ok(notes.length > 0, `expected at least one corner: ${JSON.stringify(notes)}`);
  assert.ok(notes.some((n) => n.mods.includes('crest')), `no crest: ${JSON.stringify(notes)}`);
});

test('notes carry the arc length they start at, and stepping is every 5 m', () => {
  assert.equal(NOTE_STEP, 5);
  const p = path(arc(150, Math.PI, Math.PI * 1.5));
  const notes = paceNotes(p, () => 0);
  for (const n of notes) {
    assert.ok(n.s >= 0 && n.s <= p.length, `s ${n.s} outside 0 to ${p.length}`);
    assert.ok(['left', 'right'].includes(n.dir), `bad dir ${n.dir}`);
    assert.ok(n.grade >= 1 && n.grade <= 6, `grade ${n.grade} out of 1 to 6`);
    assert.ok(Array.isArray(n.mods));
  }
});

test('a straight road has no notes', () => {
  const straight = [];
  for (let i = 0; i <= 30; i++) straight.push([i * 20, 0]);
  assert.deepEqual(paceNotes(path(straight), () => 0), []);
});

test('the hairpin radius boundary is 20 m', () => {
  assert.equal(HAIRPIN_R, 20);
});