# A8: gearbox order, safe downshift, neutral limiter, lane-change flip-flop

Owner: Antigravity. Start: after A7 part 4 (now), alongside or before A7 parts 5 and 6.
Same rules as A7: one commit per part, next free 0.4.x after `git log`, a test for every rule,
`npm test` and `npm run check` clean, ARCHITECTURE.md and CHANGELOG.md in the same commit.

## Part 1. Neutral hits the limiter (bug from 0.2.0)

Measured with full throttle in N for 4 s: Hayate reaches 13,700 rpm, Rampart 11,400, Vespera
16,500, Tsurugi 13,900. The limiter cut fires once and does nothing. In `stepVehicle` the
neutral rpm comes from `freeRev(s, spec, accel, dt)`, which applies the throttle before the
limiter is checked; the limiter only zeroes the driving `torque` afterwards.

- In neutral (and whenever the clutch is out) the limiter must cut `freeRev`'s throttle too: at
  the redline the throttle term goes to zero for the cut time (`s.limiter`), the engine falls a
  few hundred rpm on friction, picks up again, and bounces on the limiter like it does in gear.
  Neutral must never reach the blow rpm on its own.
- `s.limiter` should be set so the exhaust crackle and the cluster's limiter flash work in N.
- Fix the weak test in `tests/physics.test.mjs` ("neutral free-revs to the limiter..."): it only
  checks `rpm > redline - 300`. Assert that over 4 s of full throttle in N, for every car, rpm
  never exceeds the redline plus 150 and the limiter cuts at least 4 times.

## Part 2. Gear order N R 1 2 3 ...

Jc wants the manual selector to run N, R, 1, 2, ... n from the bottom: shift down from 1 goes
to R, shift down from R goes to N; shift up from N goes to R, from R to 1. Gear values stay
-1 (R) and 0 (N), only the order changes (`shiftUp` and `shiftDown` handling in `stepVehicle`,
the comment above it).

- The money-shift rule into R is unchanged (R above about 120 km/h blows the engine), so a
  careless double tap down from 1 at speed now hits R; that is intended.
- Auto mode is unchanged.
- Update every place that names the order: the controls screen and settings text in
  `src/ui/menus.js` ("R, N, 1..7"), ARCHITECTURE.md, and the test "the manual selector runs
  R, N, 1 to the top gear" in `tests/physics.test.mjs` (now N, R, 1, ..., n).

## Part 3. A downshift at crawling speed drops to the gear that fits

Playtest: after a crash the car sits in 5th at walking pace and the player has to tap down
four times through gears that only lug. A downshift in a forward gear goes straight to the
highest lower gear in which the engine would turn at least 1.2 times idle at the current road
speed, and to 1st when none does. So at 8 km/h in 5th one tap gives 1st; at 100 km/h in 5th a
tap still gives 4th, and an over-rev downshift (a money shift) is still possible. It is safe:
it never chooses a gear that over-revs.

- Test: from 5th at 2 m/s one `shiftDown` gives 1 with no damage; from 5th at 28 m/s one
  `shiftDown` gives 4; the money shift test still passes.

## Part 4. Civilians stop flip-flopping between lanes

Measured headless (seed 21, 3 minutes on Route 1 with the player driving along at 108 km/h):
civilians made 502 lane changes and 207 of them (41 %) were a change straight back within 6 s.
That reads as cars dithering between lanes. In `maybeChange`:

- After any lane change a car keeps its new lane for at least 8 s unless it must leave it (a
  planned exit or turn, or something stopped ahead).
- Moving back to the slow lane needs a clear gap of at least 120 m ahead in it and nothing
  faster closing within 60 m behind; yielding to a faster car only when it is within 40 m
  behind and closing by more than 8 m/s.
- Test: same setup as above, fewer than 10 % of civilian lane changes are reversed within
  6 s, and civilians still yield (the existing yield test passes).

## Part 5. Small items

- In the cockpit view the HUD prompt (RIVAL ..., refuel, tolls) sits on top of the modeled
  gauges. In `src/ui/hud.js` and `style.css`, move the prompt to the upper third of the
  screen while the camera view is `cockpit` (Drive knows `this.rig.view`).
- `tests/traffic.test.mjs` line about `k.speed[0] > 1.0`: put it back to `> 1.4`. It was
  loosened while Claude's 0.4.6 work was half done; every racer kind now wants at least
  1.75 times the limit.
- Racers average about 182 km/h headless (target in A7 part 4 was above 190). Fine to leave,
  or raise their acceleration while far below their wanted speed a little more.
- Remove the stray double blank lines added in `sim.js` (0.4.10).
