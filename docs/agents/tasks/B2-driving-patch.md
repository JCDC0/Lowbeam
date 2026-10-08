# B2: Traffic and police driving patch (Backend)

For the backend seat (Hermes). Jc tested the game and listed what feels wrong in how the other cars
and the police drive; this brief turns that list into small, exact parts, each proved by a test.
Read `docs/agents/ARCHITECTURE.md` and `docs/agents/tasks/README.md` first. Claude has been working
in these files while the seat was empty (C2, up to 0.9.81): pull first and read the code as it is
now.

Versions: 0.9.20 to 0.9.49 are yours and none is used yet. One commit per part, from 0.9.20. A
commit numbered below `package.json` (0.9.81 or higher) adds its changelog entry in version order
and leaves `package.json` and `package-lock.json` alone. Stage your files by name, never
`git add -A`; Gemini and Claude commit in the same tree. Stop for Claude's review after parts 3 and
6 and at the end.

Measure before and after every change and put the numbers in the changelog entry. Never loosen a
limit a test's title promises; if a limit must change, change the title and say why.

## 1. Tougher cars (0.9.20)

A simple bump must not wreck a car or kill a unit.
- Civilians and racers: `CIVIL_WRECK_HIT` in `src/traffic/sim.js` from 11 to 18 m/s closing.
- Police: a cruiser takes at least 6 bumps at 8 m/s from the player's car before it is destroyed,
  and a wall hit at 15 m/s costs it under 35 % of its hit points; a Rhino takes about three times
  what a cruiser does. Tune `DAMAGE` and the kinds' `hp` in `src/police/units.js`, not the call
  sites.
- Tests in `tests/police-damage.test.mjs`: the six-bump rule, the wall rule, a 30 m/s head-on still
  destroys a cruiser, and the Rhino ratio.

## 2. A bumped car drives on (0.9.21)

Today a knocked civilian or racer turns its hazards on and stands until it rejoins (`knock`,
`stepKnocked`, `KNOCK`). Jc wants them to react like drivers:
- A knock under the wreck threshold leaves the hazards off (`signal` stays as it was; hazards are
  for wrecks only), the slide lasts at most about 1 s, and the car rejoins its lane and drives on.
- After the knock, and whenever a faster car (the player or a racer) closes on it from behind within
  25 m at 8 m/s or more, it gets out of the way: it changes lane away when a lane is free
  (`changeSafe`), else it speeds up for a few seconds (raise its cap, up to 1.2 times its wanted
  speed), and it honks (the horn already comes from `manners.js` for a scrape; keep it).
- Tests: a knocked car's hazards stay off and it is back in `drive` within 1.5 s; with the player
  closing fast behind and a free lane beside it, it moves over within 3 s.

## 3. Every car is solid (0.9.22)

Civilians and racers phase into roadblocks and stop inside them. Every agent must be a body:
- `leader` (the obstacle ahead) must see parked units, wrecks and the spike strip's gap early
  enough to stop: a car brakes to a stop 6 m before a roadblock and, where an open lane passes it,
  changes into it instead. Check with a roadblock across two of three lanes.
- `collideAgents` must resolve overlap between any two agents in any mode (drive, knocked, wreck,
  parked): push apart by mass along the contact normal, with no knock below 3 m/s closing (a nudge,
  not a crash). A parked unit does not move unless hit above 6 m/s.
- Tests: no agent ends a 60 s run overlapping another or a parked unit (count overlaps every step,
  none deeper than 0.3 m); a car meeting a roadblock across two lanes passes in the third or stops
  short.

Stop here for review.

## 4. Racers fast but not blind (0.9.23)

Street racers drive at their speed and brake hard when they cannot pass:
- A racer that cannot change lane around a slower car or the player brakes to the leader's speed
  with its full braking (about 9 m/s²) in time, never rams it. Keep their 200 to 260 km/h cruise.
- Test: over 3 minutes headless on Route 1 with traffic, racers average above 180 km/h (the existing
  test) and no racer hits another agent above 6 m/s closing (count `collideAgents` contacts).

## 5. Police that drive like people (0.9.24)

Jc saw units copy the player's steering the instant it happened and turn hard at speed. In
`stepChase` and `pursuitSpeed`:
- Reaction: a unit aims at a delayed, smoothed estimate of the player (the player's position and
  velocity low-passed with a time constant of about 0.4 s, per unit, a little different per unit
  by id), not the live input, so a flick of the player's wheel reaches it late and softened.
- Grip: its yaw rate is capped at `8 / speed` rad/s (8 m/s² of lateral grip) and the turn it wants
  beyond that is made by braking first, the way a driver lifts and brakes into a corner.
- Space: a unit driving free sees what is ahead in its path (traffic, wrecks, parked units) and
  slows or stops for it instead of swerving at the last moment; it only goes flat out when its path
  is clear and it is behind the player; within 30 m of the player it matches the player's speed.
- Damage felt: between half and a quarter of its hit points its top speed falls smoothly from 100 %
  to 85 %, then to `DAMAGE.limpSpeed` below a quarter, with no step; below half a unit driving free
  wobbles slightly (a 0.15 rad, 0.6 Hz sine on its aim, phase from its id).
- Tests: a step in the player's heading changes a unit's yaw rate by at most the grip cap and not
  before 0.15 s; a unit behind a stopped car in its path stops without contact; the speed curve is
  continuous and never rises as hit points fall.

## 6. The pursuit's numbers, Most Wanted's (0.9.25)

Jc's sketch of the pursuit HUD shows the units by kind, the units on the scene, the units assigned
and the units destroyed, and reinforcements when the assigned run low:
- `PoliceDirector` keeps an `assigned` pool for the pursuit: 10 at heat 1, 20 at 2, 35 at 3, 50 at 4,
  60 at 5 (raised when the heat climbs). Each unit sent out takes one; a destroyed unit is gone
  from it. When on-scene units fall to 2 or fewer with the pool under 5, reinforcements come: the
  pool gains the heat's 25 %, an event `{ type: 'reinforcements', count }`.
- `pursuitView()` in `drive.js` adds `assigned` and `byKind: { police, 'police-fast', 'police-int',
  'police-heavy' }` (units on the scene by kind) and `helis` stays. Claude draws them (C3).
- Tests: the pool falls as units go out, destroyed units do not come back, reinforcements fire once
  per low point.

Stop here for review.

## 7. Helicopters run out of fuel, and stations (0.9.26)

Jc struggled to get rid of the helicopters.
- Each helicopter has about 100 s of fuel over the pursuit (`heli.js`); at 15 s left it breaks off
  and flies to the nearest police station to refuel for 40 s, then may come back if the heat still
  calls for it. Events `heliLeaving` and `heliBack` (Claude makes the banners).
- A helicopter loses sight under a deck or a dense block (the line from the spot to the player
  crosses a building box or a deck), as the units do.
- Police stations: there are three since 0.9.88 (`LOTS` with `kind: 'police'`: the HQ first, then
  Kitamachi on Route 18 and Toge on Kuro Pass). Everything that uses "the police HQ" (the first
  police lot today, `drive.js`) must use the nearest station: busted tows, units going home,
  helicopter pads (each station a pad).
- Garages repair: the five garage lots (`kind: 'garage'`) are scenery today. Driving onto one and
  stopping should repair the car as a pump does (`repairEngine`, the tires, the damage) at the
  pump's price, with the same prompt; a garage does not sell fuel or nitrous.
- Helicopters for racers: when no player pursuit is on, a police tail on a street racer (`TAIL`) may
  call one helicopter (at most one at a time); the player's pursuit takes priority.
- Tests: fuel runs out and the helicopter leaves and returns; sight is lost under a deck; the nearest
  station is used for a tow.

## 8. Louder cars (0.9.27)

Jc wants the traffic heard much more:
- `TRAFFIC_LEVEL` and `TRAFFIC_TIRE_LEVEL` in `src/audio/audio.js` about doubled, the horns
  (`HORN_LEVEL`) about 2.5 times, measured with `audio.level()` as Claude did in 0.9.78 (a racer
  beside the player about level with the player's own engine, a horn beside the player clearly over
  it).
- The player's exhaust bang (the pops in `src/audio/engine-dsp.js`, per voice `pops`) louder and per
  car: a V8 a deep thump, a flat-four a crackle, the V12 a sharp crack; on a lift at high revs and
  on every upshift past 85 % of the redline. Render a check WAV with `node tools/render-engines.mjs`.

## Later (after review)

- The Hikari among the street racers (`RIVALS` leaves it out because two lane change tests sit near
  their limits); make those tests robust over several seeds first.
- `tests/route.test.mjs` times one call with the wall clock and fails on a busy machine: count the
  work instead.

## Report

After each part: the commit hash, what changed, the test counts, the numbers measured before and
after, and anything you need from Claude's files (UI, world, render). Stop at the review points.
