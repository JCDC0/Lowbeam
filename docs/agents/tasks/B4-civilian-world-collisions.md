# B4: Civilians collide with the world (Backend)

Jc saw cars driving on the edges of the road and clipping into things at the side, and wants every car
to have collisions. Measured with `node tools/clipbench.mjs` (Claude, 0.10.13: the traffic run for 70 s at
seven places, 34,420 samples of civilians on their lanes), 118 samples had a civilian with a body circle
inside a static shape, and 10 had the body off the carriageway. 103 of the 118 were signal poles
(Minatomachi 48, Ginza-machi 42, Shinmachi 13): Claude fixed those in 0.10.15 by keeping each pole
clear of every lane through its crossing (`SIGNAL.clear`, 1.3 m; a pole steps back from the road, or is
left out), which brought the bench to 15 clips. What is left, for the backend:

| Clips | Where | What |
|---|---|---|
| 6 | the Ginza-machi back streets | a 0.6 m circle (a vending machine or a pole), up to 0.6 m in |
| 7 | the toll plaza islands on Route 1 and Route 2 (`c1-r`, `c2-f`) | a 1.3 by 24.4 m island box, up to 0.6 m in |
| 2 | Ginza-machi, Dori | a 0.6 by 6 m box and a 0.6 m circle |
| 10 off the carriageway | the Harbor and Route 18 ramps, Route 1 | a pickup, a hatch, a kei |

A second audit of every lane's center line (200,159 samples, probing a circle of a car's half width)
also found the ramps' guard rails (`bay-ramp-*`, `c3-ramp-*`: 0.3 by 6 m boxes) within 0.1 to 0.5 m of
the first 30 m of the ramp lane, where it leaves the carriageway: the lane starts too close to the
rail's end. Claude owns the rails (`highway.js`); say in your report which lanes you move and Claude
moves the rail starts, or move the lane offsets in `net.js` yourself.

Why: only wrecks, knocked cars and units driving free are checked against the static world
(`collideWorld`, in `step` when `a.mode` is `wreck`, `knocked` or `a.free`). A civilian in `drive` mode
follows its lane and, at a junction, `moveTo` carries it from the old lane to the new one in a blend
(`changeStartX/Z`), which cuts the corner: the chord passes the signal pole at the corner and the
sidewalk. Nothing looks at what it passes through.

## 0. A loose end from B3's review

First, in the same commit as your first part: `Drive` passes `this.blockBarriers` to `PursuitView.step`
even after the sim has faded a barrier out, so a knocked barrier can stay drawn on the road. Pass only
the agents still in `this.traffic.agents`, and add a test (a barrier whose agent has gone is not drawn).
Also in `unitSees` (`police/director.js`), use `FOG_DRY.far` and `FOG_STORM.far` from `render/weather.js` for
the notice scale in place of the literals 230 and 420. Details in `B3-wet-weather.md`, "Review: parts 2 and 3".

## 1. Turns that follow the road

- A civilian turning at a junction follows a real curve: a left turn (traffic keeps left) is a tight arc
  inside the corner, a right turn a wide one across the junction, both inside the junction patch and
  clear of the corner posts. Build the arc from the two lane ends (their positions and headings: a
  Bezier or an arc) when `moveTo` is a turn, in place of the straight blend. Same for exits and ramps
  where a car is off its lane for more than a second.
- Test: over every junction of the island (a loop over `net.nodes`), a car of the widest kind driving
  each turn stays on the carriageway or the junction patch (`ground.roads.query` with `edge <= 0.1`) and
  clear of every static shape (`Colliders.probe`), at 8 and at 14 m/s.

## 2. Civilians are solid against the world

- `collideWorld` runs for civilians in `drive` mode too. A civilian that overlaps a static shape is
  pushed out along the contact normal and loses the speed into it (as a free unit is), and a car that
  keeps touching one for more than a second brakes and waits, then moves on. This is the safety net: a
  car should rarely need it once the turns are right.
- The signal poles under the Kurogane Line deck now end under the slab (`signalCircles`, 0.10.13): a car
  on a deck is not stopped by what stands below it. Keep passing the car's `y` to every probe.

## 3. Edges

- The 10 off-carriageway samples: ramps (`harbor-ramp-fn`, `r18-ramp-rn`) and Route 1. Find which lane
  or link pulls the body off the road (a lane offset past the ramp's edge, or the blend at a merge) and
  fix the lane geometry or the blend; `tools/clipbench.mjs` prints them (a car with a corner of its body
  more than 0.1 m off the carriageway).
- Two-way narrow streets: lane offsets are `hw - (i + 0.5) * width` (2.3 m on a 4.6 m half-width
  street). Keep a car's edge at least 0.3 m from the carriageway edge for the widest civilian kind.

## 4. The kinds

- Check every kind's `length`, `width` and `height` in `kinds.js` against its model (when G6 remakes the
  civilians in Blender their sizes come from the same table): the collision body (`bodyOf`) must be the
  size the car is drawn. `tests/kind-models.test.mjs` does it for the racers and units; extend it to the
  civilians as G6 lands.

## Done when

`node tools/clipbench.mjs` reports no clips and no off-carriageway cars (or, for a few the geometry
makes unavoidable, a list Claude agrees), and a test in `tests/island/` holds the turn check above.

## Report

After each part: the commit hash, what changed, test counts, the clip counts before and after.

## Review: parts 1 and 2 (Claude, 0.10.29)

Parts 1 and 2 (0.9.34, 0.9.35) are accepted. The clip bench went from 15 clips and 10 cars off the road to
1 and 4 over 34,006 samples. HEAD passes all 492 tests (the two soundtrack failures seen at 0.9.35 were
Claude's, fixed in 0.10.28). Before the edges, in the commit of part 3:

1. **The world can wreck a civilian on its lane.** `collideWorld` ends with `hardest > CIVIL_WRECK_HIT`
   (18 m/s) turning the car into a wreck, and that now applies to a `drive` civilian whose lane meets a
   shape head on. Count in the bench how many civilians this wrecks (it should be none) and say where. For
   a car in `drive` mode keep the push and the stop, and leave the wreck to real hits (the player, a unit,
   another car); the one second rule holds the car instead.
2. **Every one second hold is a lane that runs into a shape.** Add an `onStall` callback on the sim, called
   where the touch rule brakes the car, and have `tools/clipbench.mjs` list each stall (road, `s`, kind).
   Those are geometry faults to fix in part 3, the same list as the 4 off-road samples or longer.
3. **The turn test is loose.** `tests/island/traffic-turns.test.mjs` accepts 0.5 % of the turns failing,
   and its two speeds (8 and 14 m/s) walk the same curve, so the second pass only changes the sample
   spacing. Sample every 0.25 m once, and make the test strict: every turn clean, or the exceptions named in
   the test (node and lane ids) and agreed in your report.
4. **Cost.** The old test said lane followers cost nothing; each civilian now probes three circles a step.
   Report the milliseconds of `sim.update` with 45 agents before and after (island, 1,000 steps). More than
   10 % up: probe a car only every second step (by its id's parity).
5. **Housekeeping.** Two JSDoc blocks are stacked above `collideWorld`; make it one, with `@param {number} [dt]`.
   The open-work bullet in ARCHITECTURE.md about civilians and the static world (15 clips) is stale: write
   the new numbers when part 3 lands.

Then part 3 (0.9.36, section 3 above) and part 4 (0.9.37, section 4), one commit each, and stop after part 4
with the report: B5 goes to another agent.

## Review: parts 3 and 4 (Claude, 0.10.35)

Accepted (0.9.36, 0.9.37). The five review items are done: a civilian on its lane is never wrecked by the
world (counted, 0), `onStall` and the bench's stall list, the strict turn test, the probes' cost (216 to
224 ms for 1,000 steps of 45 agents, 3.6 %), the JSDoc and the guide. Clips 15 to 0, off the road 10 to 0,
over 34,111 samples. Lane changes are refused within 55 m of a toll plaza and where the midpoint of the
move would touch a shape. What is left is on the bug board: the 123 stalls are geometry (T-01, Claude),
and the turn test passes by naming 14 clipping turns and 18 that leave the carriageway (T-04, Backend
first). B4 is closed.
