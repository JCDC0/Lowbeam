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
