# A17: The police (Hermes)

The third step of the police after the buildings (0.6.7) and the helicopter (0.7.5): patrol cars,
heat, pursuits, busts and escapes, in the line of Need for Speed: Most Wanted (2005). The HUD and the
map markers are already built (A13, `src/ui/pursuit.js`, the minimap and Tab map) against the
contract in `A13-pursuit-hud.md`; this task fills it in. Read `docs/agents/ARCHITECTURE.md` (Traffic,
Races, Police helicopter, Landmarks) first.

Version numbers: 0.8.15 to 0.8.19 (one per part). Claude has 0.8.0 to 0.8.9, Antigravity 0.8.10 to
0.8.14.

## What exists

- `LOTS` in `src/world/layout.js`: the police HQ (`id: 'police'`) on Hanazaki Cape with its motor pool;
  `world.ground.lots` gives its pad (`lotFrame` and `toWorld` in `src/world/lots.js` turn model
  coordinates into world ones; the motor pool's five bays are in `tools/blender/police_hq.py`).
- `src/police/heli.js` (pure `Heli`), drawn by `heli-view.js`, owned by `Drive`: `scrambleHeli()` and
  `recallHeli()`; `heli.spot.sees` says whether its searchlight is on the player (false under a deck),
  `heli.lost` the seconds since it was.
- `Drive.pursuitView()` returns null and `Drive.policeMarkers()` returns only the helicopter. Both
  are yours to fill in (the contract in A13 fixes their shape; keep it).
- `RaceEvent` (`src/race/event.js`), `Duel` and `Rally` as the pattern for a pure event.
- The traffic sim (`src/traffic/sim.js`, yours): lanes, IDM, lane changes, blinkers, wrecks, rivals.

## Part 1: patrols and heat (pure first)

- A police kind in `src/traffic/kinds.js` (`id: 'police'`): for now the sedan body with a fixed
  two-tone paint (black lower, white upper is the Japanese pattern; `accent` already paints a second
  color), and a `light bar` flag. Claude will model a proper patrol car and the light bar later; the
  renderer draws the bar's red flashing for now as two extra flares on the roof (the flare mesh in
  `src/traffic/render.js`), blinking left and right at 2 Hz while pursuing.
- Patrols: a few police cars cruise among the traffic (more at night downtown and on Route 1), and
  more come out of the HQ motor pool once a pursuit starts.
- Heat (`src/police/heat.js`, pure): what the police notice. Speeding past a patrol within about
  60 m (over the limit by more than 40 km/h), a toll speed trap above 160 km/h (`TollMeter` already
  reports the speed), hitting a police car or a civilian in sight of one, a duel in sight of one.
  Heat 1 to 5 rises with what they see and with time in a pursuit.

## Part 2: the pursuit as a RaceEvent

`src/race/pursuit.js` (pure): states `pursuit`, `evading`, `cooldown`, `busted`, `escaped`, exactly the
A13 `PursuitView` fields (heat, evade, cooldown, bust, units, heli, bounty, time).
- In sight means a unit within about 150 m with a clear line, or `heli.spot.sees`.
- Out of sight, `evade` fills (faster at low heat); back in sight it drains. Full evade starts the
  cooldown; the cooldown fills unless a unit sees the player again; full cooldown is ESCAPED.
- Bust: below about 10 km/h with a unit within 8 m (or boxed by two), `bust` fills over 3 s; moving
  away empties it. Full is BUSTED.
- Bounty grows with time, heat and damage done to police cars.

## Part 3: chasing

Police units leave their lanes: within about 120 m they drive at the player directly (a pursuit
steering mode in the sim: aim at the player's predicted position, brake for walls of traffic, ram
from the side at heat 4 and 5), farther out they follow the lanes toward the player at high speed
(the A15 route module `src/ui/route.js` may help once Antigravity lands it; do not wait for it).
Roadblocks at heat 4 and up: two or three cars parked across a road ahead of the player, with a gap
to aim for. The helicopter: `scrambleHeli()` at heat 3 and up, `recallHeli()` on escape or bust.

## Part 4: consequences and sound

- BUSTED: a fine (bounty plus 30,000 yen, what the player can pay), the car towed to the HQ lot, the
  run ends. ESCAPED: the bounty paid to the player. Saved through the store from Drive, as the rally
  does.
- Sirens (wail and yelp, Doppler with relative speed, through the effects channel, muffled in the
  cockpit like the tires) and the helicopter's rotor thump by distance, in `src/audio/audio.js`.
- `Drive.pursuitView()` and `policeMarkers()` filled in; the A13 HUD and markers then work as they are.

## Also

- The Hikari 300ZR (0.8.2) is left out of `RIVALS` in `src/traffic/kinds.js` because adding a kind
  reshuffled the seeded picks and two of your traffic tests fell just under their limits (racer mean
  179.8 against 180 km/h, 58 lane changes against the minimum sample). When you are in the sim, make
  those tests sturdier (more seeds or a longer run, not a lower bar) and drop the filter.

## Rules

- Your files: `src/police/*` except `heli.js` and `heli-view.js` (ask Claude for changes there),
  `src/race/pursuit.js`, `src/traffic/*`, `src/audio/audio.js` and new audio modules, the police parts
  of `src/drive.js`, tests.
- Do not edit: `src/world/*`, `src/render/*`, `src/vehicles/*` (Claude), `src/ui/*`, `style.css`,
  `src/main.js` (Antigravity), `assets/`, `tools/blender/`.
- Shared files (`src/drive.js`, docs): re-read from disk right before each edit, small exact-string
  edits, never write a whole file back, commit each part as soon as its tests are green. The changelog
  stays sorted by version; the current state header names the highest version.
- Verify by looking (a pursuit at 480 lines with the HUD, a roadblock, a bust, an escape under a
  viaduct) and by tests for every rule above.
