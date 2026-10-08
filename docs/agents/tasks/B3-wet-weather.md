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

## Report

After each part: the commit hash, what changed, test counts, the numbers measured before and after
(braking distances, rain level against the engine), and anything you need from Claude's files.
