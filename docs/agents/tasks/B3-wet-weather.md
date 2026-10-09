# B3: What rain does to the drive (Backend)

After G5. Claude made the rain look (0.10.3: `render/weather.js`, `rain.js`, Settings, `C5-weather.md`);
the game still drives the same in a storm. This brief makes the weather matter. Read `C5-weather.md`
first. The level is `world.weather` (0 dry to 1 a storm, set from Settings or `__lowbeam.weather`);
`weatherLook(level).wet` from `src/render/weather.js` (pure, importable) is how wet the roads are.

Versions: the backend range, one commit per part, stop for Claude's review after part 3.

## 1. Grip

- Tarmac grip falls with the wet: at a full storm about 75 % of the dry peak grip for every car and
  AI vehicle, braking distances about a third longer, and the handbrake and a lifted throttle in a
  corner more likely to start a slide. Gravel and the forest floor do not change. Put it in
  `surfaces.js` as a factor the physics takes from the surface (the drive passes the wetness in), not
  as a special case in each car.
- Aquaplaning is not wanted. A heavy-throttle spin at 150 km/h in a storm should be easy to catch.
- Tests: a car brakes from 100 km/h in more meters wet than dry, by about the factor above, and the
  dry numbers in `tools/sim.mjs` and its tests do not move.

## 2. Sound

- A rain bed in `src/audio/` that follows the level: filtered noise, quiet in a drizzle, a broad
  hiss in a storm, muffled in the cockpit and the car cameras' interior views, plus a patter that
  rises when the car stops. Its own channel in Settings' audio list if the channels are a list.
- Tires on wet tarmac hiss: the tire noise gains a band of high-frequency noise with speed and the
  wetness, and the skid screech is a little looser (lower gain, longer).
- Under a roof the rain bed goes quiet and a patter on the roof replaces it: Claude's rain cover
  (`world.rain.cover`, a `CoverGrid` from `src/world/rain-cover.js`) says whether a roof is over the
  camera: `cover.at(x, z) > camera.y` (a value of `NONE` is open sky).
- Passing cars (`traffic-voices.js`) hiss on the wet at speed.
- Thunder is not wanted.
- Tests on the pure parts (the gains for a level), and a measured level of the rain bed against the
  engine at idle (the rain should sit under the engine).

## 3. Traffic and police

- Civilians drive about 12 % slower in a storm (a desired-speed factor in `traffic/sim.js`), brake
  earlier, and follow a little further back.
- The police's sight is the fog's: units see `150 m` on a clear line in the dry; scale it to the
  fog's far distance (`weatherLook(level).fogFar / 420`), and the detection range with it (the 60 m
  notice radius shortens less, to 85 %). Helicopters fly in rain; in a storm their searchlight reaches
  70 % as far.
- Police units' grip falls like the player's (part 1), so pursuits in the rain are closer.
- Tests: a unit loses a player at a distance in a storm that it keeps in the dry.

## 4. The hour of the day (after parts 1 to 3)

Claude made the day and night cycle (0.10.5; `render/daylight.js`; `world.hour`, `world.look.day`,
`world.look.lamp`). What the hour should do to the game:

- Street racers only on the road after dusk (`look.day` under 0.3): by day the five on Route 1 are
  replaced by ordinary traffic, and they return as the lamps come on. Their count is unchanged at
  night.
- Traffic density by hour: about 30 % more civilians by day, a little over half at night (a
  `TRAFFIC` count factor in `traffic/sim.js`), and a short rush at about 8:00 and 18:00.
- Police sight: a unit sees 150 m on a clear line at night as today and 180 m by day; a helicopter's
  searchlight only works when `look.lamp` is over 0.5 (by day it follows with no light and sees by line
  of sight to 200 m).
- Audio: crickets and a night wind by night, cicadas and distant traffic by day, the ambience
  crossfading with `look.lamp`; the soundtrack's `night` mood stays a night one.
- Tests on the pure parts (the factors for an hour) and a measured count of agents by hour.

## Report

After each part: the commit hash, what changed, test counts, the numbers measured before and after
(braking distances, rain level against the engine), and anything you need from Claude's files.

## Review: part 1 (Claude, 0.10.17)

Passes. Numbers from a headless bench (the same runs as `tools/sim.mjs` with `state.wet` set to
0, 0.5 and 1), all five cars:

| Car | 100 to 0 dry | half wet | storm | skidpad dry / half / storm |
|---|---|---|---|---|
| Hayate RS-4 | 34.7 m | x1.11 | x1.25 | 1.35 / 1.18 / 1.01 g (75 %) |
| Rampart 440 | 37.2 m | x1.11 | x1.26 | 1.20 / 1.05 / 0.90 g (75 %) |
| Vespera GT | 31.7 m | x1.13 | x1.31 | 1.46 / 1.27 / 1.09 g (75 %) |
| Tsurugi GT-X | 34.2 m | x1.11 | x1.28 | 1.43 / 1.24 / 1.06 g (74 %) |
| Hikari 300ZR | 38.2 m | x1.11 | x1.28 | 1.32 / 1.15 / 0.98 g (74 %) |

The dry column is the guide's table to the digit; `tests/physics.test.mjs` passes (26). Grip falls to
75 % as written; braking is 25 to 31 % further, a little short of "about a third" because drag helps
both runs, which is fine. Gravel, dirt and grass are unchanged (the test holds it). `surface()` makes a
new object per call while it is wet (twice a physics step); harmless, leave it.

The traffic and the police do not use `stepVehicle`, so their grip is part 3's. The order from here:
part 2 (rain sound) as 0.9.31, the barrier fixes in `tasks/G7-police-station.md` as 0.9.32, part 3 as
0.9.33, then stop for review.

## Review: parts 2 and 3 (Claude, 0.10.21)

Both pass, with one loose end below. Checked in the browser at 1280 by 720 after the commits
(0.9.31, 0.9.32, 0.9.33): a storm in the drive loop for 6 s with the audio context running, no console
errors, the rain nodes present and driven.

- **Part 2 (0.9.31).** The pure gains, the roof and the wet hiss read well and the tests hold them. In a
  storm the rain bed's gain is 0.16 (measured on the node); 1.5 s after the weather clears it is still at
  0.10, so it fades over a few seconds and does not cut. Against the engine at idle (0.71) that is 13 dB
  below outside and 18 dB inside (the report said 13 to 15). I cannot listen from here; Jc to judge the
  mix by ear. The Settings row needed a name in `ui/menus.js` (`CH_NAMES`), which is Claude's and was
  missing: fixed in 0.10.20, the row reads RAIN AUDIO above BACK. The barrier skip in `trafficVoices`
  (the G7 review's fix 1) landed here, with its test.
- **The barrier fixes (0.9.32).** Driven in the game at 25 m/s into one barrier of a roadblock: it goes
  `knocked` and `flattened` at once, its yaw does not change, the mesh lies down (`rotation.x` 1.57), the
  car slows from 25 to 7 m/s over 1.2 s pushing it, and it is gone after the roadblock comes down. The
  civilians' count and the tests are as reported. Loose end: `PursuitView.step` draws whatever is in
  `Drive.blockBarriers`, which keeps a barrier after the sim has faded it out (`fade` 0 after 24 s of
  `knockAge`) until the roadblock comes down, so a knocked barrier could stay drawn, flat on the road,
  with nothing there. First thing in 0.9.34: pass only the agents still in `traffic.agents`, and a test.
- **Part 3 (0.9.33).** Read in full. The sight scale is applied in both `stepPolice` (`clear`) and
  `unitSees`, but to the same distance, not compounded; the patrol notice radius, the cone and the
  around range follow the 85 % and the helicopter's light reach 133 m in a storm; the heli world gets
  the weather (`heliWorld` exists). Civilians slow by 12 %, gap and headway 25 % wider, the brake lamps
  at -0.9 m/s2, police and racers corner at 75 % grip. One brittle spot: `unitSees` writes the fog's 230
  and 420 into the notice scale (`0.85 + 0.15 * ((fogFar - 230) / (420 - 230))`); they are `weather.js`
  numbers, already exported as `FOG_DRY.far` and `FOG_STORM.far`, so a change there would skew it; use them
  in place of the literals (0.9.34, with the barrier fix). Not driven in a pursuit in the game; the six tests hold the numbers.
- Part 4 (the hour of the day) waits behind B4 and B5, as the queue says.
