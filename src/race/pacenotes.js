/**
 * Pace notes for a rally stage: where the corners are, how tight each one is and which
 * way it goes. Pure: no three.js, no DOM. Walks a path, reads the curvature, and grades
 * every corner it finds so the HUD can call it out before the driver reaches it.
 *
 * A note is `{ s, dir, grade, mods }`. `dir` is left or right, `grade` runs from 1 (the
 * tightest) to 6 (nearly flat), and `mods` carries the extra words: hairpin, long,
 * tightens, opens, crest and into.
 */

/** Meters between samples when walking the path. */
export const NOTE_STEP = 5;
/** A corner tighter than this radius is called a hairpin. */
export const HAIRPIN_R = 20;
/** A corner lasting longer than this many meters is called long. */
export const LONG_M = 60;
/** A radius change of at least this fraction inside one corner tightens or opens it. */
export const CHANGE_R = 0.5;
/** How close the next corner has to start to be called into. */
export const INTO_S = 30;

/** @typedef {{ s: number, dir: 'left' | 'right', grade: number, mods: string[] }} PaceNote */

const _q = { x: 0, z: 0, tx: 0, tz: 1 };

/** Shortest signed angle from a to b, in radians. */
function turn(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Grades a corner radius: 1 is the tightest, 6 nearly flat.
 * @param {number} r radius in meters
 */
export function gradeFor(r) {
  const edges = [25, 45, 75, 120, 200];
  for (let g = 0; g < edges.length; g++) {
    if (r < edges[g]) return g + 1;
  }
  return 6;
}

/**
 * Walks `p` every NOTE_STEP meters and returns a note for each corner.
 *
 * `p` needs `length` and `sample(s) -> { x, z, tx, tz }`, which `world/spline.js` `Path`
 * already provides. `heightAt(s)` is optional; pass it to get crest notes.
 *
 * @param {{ length: number, sample: (s: number, out?: any) => { x: number, z: number, tx: number, tz: number } }} p
 * @param {(s: number) => number} [heightAt]
 * @returns {PaceNote[]}
 */
export function paceNotes(p, heightAt) {
  const step = NOTE_STEP;
  const count = Math.max(1, Math.floor(p.length / step));
  /** Heading at each sample, and the curvature between consecutive samples. */
  const yaw = new Float64Array(count + 1);
  const grade = new Float64Array(count + 1);
  const y = heightAt ? new Float64Array(count + 1) : null;
  for (let i = 0; i <= count; i++) {
    const s = Math.min(i * step, p.length);
    const q = p.sample(s, _q);
    // Yaw 0 faces +Z, so atan2(tx, tz) matches the convention in vehicles/physics.js.
    yaw[i] = Math.atan2(q.tx, q.tz);
    if (y) y[i] = heightAt(s);
    if (i > 0) {
      const d = turn(yaw[i - 1], yaw[i]);
      // Radius from the heading change over the distance walked. Positive is a left turn
      // because a left turn increases yaw.
      grade[i] = Math.abs(d) < 1e-6 ? Infinity : Math.abs(step / d);
    }
  }

  /** Runs of consecutive samples that are turning, and which way. */
  const runs = [];
  let start = -1;
  let dir = 0;
  for (let i = 1; i <= count; i++) {
    const r = grade[i];
    const tight = Number.isFinite(r) && r < 400;
    const d = tight ? (grade[i] < 0 || yaw[i] > yaw[i - 1] ? 1 : -1) : 0;
    // A corner is a sustained turn: three samples in a row on the same side.
    const sustain = tight && d === dir && start >= 0;
    if (tight && (start < 0 || d === dir)) {
      if (start < 0) {
        start = i - 1;
        dir = d;
      } else if (!sustain) {
        runs.push({ from: start, to: i - 1, dir });
        start = i - 1;
        dir = d;
      }
    } else {
      if (start >= 0) runs.push({ from: start, to: i - 1, dir });
      start = -1;
      dir = 0;
    }
  }
  if (start >= 0) runs.push({ from: start, to: count, dir });

  /** @type {PaceNote[]} */
  const notes = [];
  const kept = runs.filter((run) => run.to - run.from >= 1);
  for (let k = 0; k < kept.length; k++) {
    const run = kept[k];
    const from = run.from;
    const to = run.to;
    // The tightest sample in the run is the corner's radius.
    let best = Infinity;
    let bestI = from;
    for (let i = from + 1; i <= to; i++) {
      if (grade[i] < best) {
        best = grade[i];
        bestI = i;
      }
    }
    if (!Number.isFinite(best)) continue;
    const r = best;
    const mods = [];
    const g = gradeFor(r);
    if (r < HAIRPIN_R) mods.push('hairpin');
    const span = (to - from) * step;
    if (span > LONG_M) mods.push('long');
    // How much the radius moves across the run, compared with the tightest.
    const first = Number.isFinite(grade[from + 1]) ? grade[from + 1] : best;
    const last = Number.isFinite(grade[to]) ? grade[to] : best;
    const loose = Math.max(first, last) / Math.max(best, 1e-6);
    if (loose >= 1 + CHANGE_R) mods.push('tightens');
    else if (loose <= 1 / (1 + CHANGE_R)) mods.push('opens');
    const next = kept[k + 1];
    if (next && (next.from - from) * step < INTO_S) mods.push('into');
    notes.push({ s: Math.min(bestI * step, p.length), dir: run.dir > 0 ? 'left' : 'right', grade: g, mods });
  }

  if (y) addCrests(notes, y, step, count);
  notes.sort((a, b) => a.s - b.s);
  return notes;
}

/**
 * Adds a crest to the note nearest a sharp change in grade, so the driver is told before
 * the road goes over the top. A crest is a mod on an existing note, not a note of its own:
 * with no corner nearby it has nothing to hang off and is dropped.
 * @param {PaceNote[]} notes @param {Float64Array} y @param {number} step @param {number} count
 */
function addCrests(notes, y, step, count) {
  if (!notes.length) return;
  let prev = 0;
  for (let i = 1; i <= count; i++) {
    const slope = (y[i] - y[i - 1]) / step;
    // Falling after climbing: the top of the hill.
    if (prev > 0.02 && slope < -0.02) {
      const s = i * step;
      let near = notes[0];
      for (const n of notes) {
        if (Math.abs(n.s - s) < Math.abs(near.s - s)) near = n;
      }
      if (!near.mods.includes('crest')) near.mods.push('crest');
    }
    prev = slope;
  }
}