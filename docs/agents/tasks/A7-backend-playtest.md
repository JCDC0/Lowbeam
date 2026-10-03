# A7: backend fixes from the first Kurogane playtest

Owner: Antigravity. Start: now. Claude works on car modeling and cockpits in parallel (see
"Who owns what" at the end); none of the files below are touched by Claude during A7.

Do the parts in order and commit each part on its own (next free version after `git log`,
`0.4.x`), with a test for each rule and `npm test` plus `npm run check` clean. Update
`docs/agents/ARCHITECTURE.md` and `CHANGELOG.md` in the same commit.

## Part 1. The tach never shows the blow rpm

The player saw an "11" on the tach and read it as part of the scale. The blow rpm
(`engine.blowRpm`, 11,000) stays in the logic but is never drawn.

- `src/ui/cluster.js`: `maxRpmOf(spec)` is the redline plus 1,000, rounded up to the next
  1,000 (Hayate 9, Rampart 8, Vespera 10, Tsurugi 9). The red band starts at the redline and
  runs to the end of the scale. Remove the dark danger band "to 11". The needle pins at the
  end stop when rpm is past the scale; it never wraps.
- `tests/cluster.test.mjs`: no car's scale reaches `blowRpm`; the scale ends within 1,000 rpm
  above the redline.

## Part 2. A blown engine idles low, in gear or in neutral

Playtest: blown at 120 km/h in 2nd, shift to N, and the tach jumps to about 3,000. A wrecked
engine should run rough at 1,000 to 2,000 rpm whatever the road speed.

- `src/vehicles/physics.js` (the engine block around `if (dir === 0) rpm = freeRev(...)`) and
  `src/vehicles/thermal.js` (`LIMP_RPM`): when `s.blown`, engine rpm is `freeRev` toward a
  rough idle (about 1,100 to 1,800, wandering with a little noise from the state, not
  `Math.random`), clamped to 2,000, in every gear. In gear the clutch is treated as slipping:
  the wheels no longer set the engine rpm, the limp torque (`LIMP_TORQUE`) still pushes the
  car, so it still crawls along at limp speed. Neutral is the same number, no jump.
- Keep: money-shift detection, `s.seize`, tow and pump repair, the over-rev rules for a
  healthy engine.
- Tests in `tests/physics.test.mjs`: blow the engine at 120 km/h in 2nd, then for each of
  gear 2, N and 1, rpm stays between 900 and 2,000 for 5 s while the car still moves
  forward in gear.

## Part 3. Lane changes move diagonally, not sideways

Playtest: when a racer or a civilian changes lanes it slides sideways like a strafe. In
`src/traffic/sim.js` `stepDrive` the position is the lane point plus an offset `ex, ez` that
decays exponentially, and the yaw follows the lane tangent, so the car translates sideways
with its nose straight.

- Replace the exponential decay with a lateral move over a time that grows with speed
  (about 2.5 s at 60 km/h, 4 s at 200 km/h), eased (smoothstep), and set the yaw from the
  actual motion of the car over the step (the lane tangent plus the lateral rate), so the
  nose points into the new lane while it crosses and straightens at the end. Keep the
  smoothing for the other uses of `ex, ez` (joins, turns), but a lane change must look like
  a steer.
- Before a change the car checks the gap in the target lane both ahead and behind (a fast
  car coming up from behind blocks the move), and does not start one inside 40 m of a
  light, an exit it is taking, or the player alongside.
- Civilians change lanes too: to pass a slower car, to get out of the way of a much faster
  car closing from behind (the player or a racer, when the lane to their left is free), and
  to reach the lane their exit or turn needs. Today only the overtake case exists
  (`maybeChange`).
- Tests in `tests/traffic.test.mjs`: during any lane change the heading differs from the
  lane tangent by between 1 and 12 degrees and the lateral speed never exceeds 3 m/s;
  a civilian with a faster car 30 m behind and a free lane moves over within 3 s.

## Part 4. Street racers are actually fast

Playtest: racers seem to drive about 150 km/h, like traffic. Measured headless they
average about 155 km/h. Target: cruising 200 to 260 km/h on Route 1, with bursts higher.

- In `sim.js`: racers use their own curve speed (a racing lateral grip of about 0.9 g
  instead of the civilian comfort limit), a higher acceleration while far below their
  wanted speed, a shorter IDM time headway (0.6 s) and a smaller minimum gap, and they
  weave: when blocked they take any lane (also the slow lane) with room, using Part 3's
  diagonal move but quicker (1.5 s).
- Spawn them where they will run: on Route 1 fast lanes, 250 to 460 m from the player,
  half ahead and half behind, so some pass the player.
- Do not edit `RIVALS` in `kinds.js` (Claude is replacing their bodies and adding kinds);
  read `kind.speed` and `kind.accel` as they are.
- Test: over 3 minutes headless with traffic, the racers' mean speed is above 190 km/h and
  their top above 240.

## Part 5. Road joins and the city grid

Playtest: merging roads do not connect cleanly and the downtown grid does not blend with
the roads around it. Fly to the joins with `__lowbeam.fly(x, z)` or `setState('free')`,
shoot each one before and after (`shot('join-...')`) and fix what you see. Starting points:

- Ramps meeting Route 1 (`diamond()` in `src/world/roadgen.js`, the blend in
  `src/world/roads.js`): the ramp ribbon must taper into the carriageway edge (a gore with
  a painted chevron, no overlapping skirt, no step in height), not stop at the edge or lie
  across the barrier. Guard rails and the median barrier (`highway.js`) must open exactly
  where a ramp leaves or joins.
- Avenues entering the city grid and grid streets meeting the arterials: same height at
  the join (no lip), ribbons that overlap at a crossing get a single crossing patch, curbs
  and sidewalks continue round the corners.
- `tools/mapview.html` and `node tools/mapcheck.mjs` should report no unexplained crossings
  and no grade breaks at joins; add the checks to `tests/layout.test.mjs`.

## Part 6. A bigger city, longer highways, railings everywhere outside town

- Grow downtown (the `CITY` rect and `STREETS` grid in `src/world/layout.js`) by about half
  in both directions, with a denser core, and add a ring of suburbs between the city and
  Route 1 (lower blocks, wider spacing). Keep the bay and the toll plazas where they are.
- Add a second expressway: an elevated spur (it can reuse the overpass `lifts`) from Route
  1 into downtown, or a coastal highway along the bay, about 4 to 6 km, with its own toll
  plaza and on and off ramps. Pick one, show the top-down map, then build it.
- Guard rails on the outside of every rural and mountain road (the pass, the forest roads,
  the avenues outside town) where the drop or the slope beside the road is more than about
  1.5 m, and on every bridge deck that does not already have parapets. Reuse the rail
  mesh in `build-highway.js` and the collider shapes in `highway.js`, with gaps at
  junctions, driveways and pads.
- Check load time (about 2 s now; keep it under 4 s) and the draw calls in a city view
  (keep under 160).

## Who owns what during A7

| Antigravity | Claude |
|---|---|
| `src/ui/cluster.js` (HUD cluster) | `src/vehicles/models.js`, new `src/vehicles/bodies/*`, `src/vehicles/cockpit*.js` |
| `src/vehicles/physics.js`, `thermal.js`, `gauges.js` | `src/render/builder.js`, `textures.js` (gauge faces, panel lines) |
| `src/traffic/sim.js`, `net.js` | `src/traffic/kinds.js`, `bodies.js`, `render.js` (the vehicle looks) |
| `src/world/*` (layout, roads, roadgen, highway, build-roads, build-highway, scatter, ground) | `src/vehicles/car.js`, `exhaust-fx.js`, `specs.js` |
| `src/drive.js` hooks for the above | `tools/models.html`, a new `tools/bodies.html` |
| A5 buildings when Part 6 lands | |

A3 and A4 (vehicle bodies) are cancelled for Antigravity: Claude builds every car body.
If you need a change in a Claude file, write it in your report instead of editing it.
