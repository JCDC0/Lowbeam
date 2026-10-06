# A17: The police (Hermes)

The third step of the police after the buildings (0.6.7) and the helicopter (0.7.5): patrol cars,
heat, pursuits, busts and escapes, in the line of Need for Speed: Most Wanted (2005). The HUD and the
map markers are already built (A13, `src/ui/pursuit.js`, the minimap and Tab map) against the
contract in `A13-pursuit-hud.md`; this task fills it in. Read `docs/agents/ARCHITECTURE.md` (Traffic,
Races, Police helicopter, Landmarks) first.

Version numbers: 0.8.15 to 0.8.24 (one per part, parts 5 and 6 below included). Claude has 0.8.0 to
0.8.9, Antigravity 0.8.10 to 0.8.14 and then 0.8.25 to 0.8.29 (A18, the HUD for parts 5 and 6).

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

## The target: Need for Speed: Most Wanted (2005), closely

The user asked for the chases to play like Most Wanted's. Parts 1 to 4 are the skeleton; these are the
things that make it feel like Most Wanted, and parts 5 and 6 add what the skeleton does not cover. When a
choice comes up that this brief does not settle, do what Most Wanted does.

### Heat levels and who comes (part 1 and 3, data in `src/police/units.js`, pure)

| Heat | Units | What they do |
|---|---|---|
| 1 | Patrol cruisers (`police`, the black and white sedan), two or three | Follow and try to box; give up easily |
| 2 | More cruisers, four or five | Ram from behind and the side (PIT) |
| 3 | Unmarked fast units (`police-fast`, a sports car in dark paint with hidden lights) join; the helicopter | Close fast, box at speed |
| 4 | Heavy SUVs (`police-heavy`, the Rhino) join; roadblocks; spike strips | The Rhinos drive head-on at the player from ahead; roadblocks of two or three cars with a gap |
| 5 | Interceptors (`police-int`, a supercar in police paint) | Everything, at once, all the time |

Heat rises with what the police see (part 1) and with time in a pursuit (every 2 to 3 minutes of an
unbroken pursuit at the current heat, as Most Wanted), and is kept for the session after an escape
(the player starts the next pursuit at the heat they left, cooling one level per few minutes of free
roam out of sight). Until Claude's models land (0.8.5 to 0.8.9: the patrol car with its light bar, the
Rhino, the unmarked car, the interceptor), every unit can use an existing body with the police paint:
`model` ids in kinds.js are the seam, so the swap is one line per kind.

### Infractions, bounty and cost to state (part 2)

- Infractions, each once per pursuit, each adding bounty: speeding, reckless driving (near misses with
  traffic at speed), hit and run (a civilian car wrecked), ramming a police vehicle, resisting arrest
  (the pursuit lasting 30 s), driving off road, damage to property (lamps, signs, pursuit breakers),
  toll gate run at speed. The `Pursuit` event returns an `infraction` event the first time each happens.
- Cost to state: yen of damage to police cars and property; units disabled (a unit wrecked or left
  behind for good); units involved in total.
- Bounty grows with time, heat, each infraction, each unit disabled and the cost to state.

### Losing them: evade, cooldown, hiding spots, search (part 2 and 3)

- Out of sight the evade bar fills; once full the pursuit becomes cooldown: the police stop chasing and
  search. Units drive search patterns around where they last saw the player (the last known position,
  widening with time) and each has a sight cone (about 60 m and 70 degrees ahead, 25 m all round);
  being inside one ends the cooldown and the pursuit is back on.
- Hiding spots fill the cooldown three times faster: inside a hideout lot (the three warehouses, `LOTS`
  of kind `hideout`), under a deck (Route 1's viaducts, the overpasses; `heliWorld.covered` already
  knows), and in a closed parking lot (`Building.cars` lots; ask Claude if you need them as a list).
- The helicopter keeps searching in cooldown and its searchlight finding the player counts as seen.

### Spike strips and roadblocks (part 3)

- Roadblocks: two or three units parked across the road 250 to 400 m ahead on the player's route (the
  road graph from `src/traffic/net.js`), with a gap at one end to aim for, set up while the player is
  out of sight of them. At heat 5 some roadblocks are Rhinos.
- Spike strips (heat 4 and up): a strip laid across the gap of a roadblock or across a lane ahead.
  Driving over it flattens the tires: grip and top speed fall (a physics hook: Claude adds
  `s.tires` 0 to 1 per axle to physics.js on request; until then, cap the speed and grip through
  the spec copy the Drive holds), mended at a pump or by escaping.

### Pursuit breakers (part 5, 0.8.23)

Most Wanted's set pieces: a structure the player can knock down onto the units behind. Claude will place
six to eight in the world (`PURSUIT_BREAKERS` in layout.js: a gas station sign, scaffolding by a
building site downtown, a stack of pipes at the port, a water tower in the industrial district, a
billboard on Route 1's verge, a stall roof at the market) with a trigger circle and a fall zone. Yours:
when the player's car hits the trigger above 60 km/h the breaker falls (an event Drive passes to the
world view Claude owns), every unit inside the fall zone is wrecked and disabled, and the cost to state
jumps. The minimap shows the breakers during a pursuit (a marker kind, A18).

### Radio chatter (part 6, 0.8.24)

The police radio is half of Most Wanted's mood. Text, not voice: short dispatch lines the HUD shows one
at a time (A18), with a squelch and a burst of static from the effects channel (synthesized in
`src/audio/`, muffled like the rest in the cockpit). Lines come from the pursuit's events and use the
area and road names (`Drive.areaName`): "Suspect heading north on Route 18", "Units, suspect is a
black Hayate RS-4", "Roadblock set on the Bayshore Line", "Spike strip deployed", "Unit down", "Air
unit, we have visual", "Lost visual, all units search the area", "Suspect in custody", "We lost him".
A small table of templates per event in `src/police/radio.js` (pure, tested), never the same line twice
in a row.

### The end of a pursuit

- BUSTED: Most Wanted's bust. The car stops, the fine is taken (part 4) and the screen shows the report.
- ESCAPED: the bounty is paid and the screen shows the report: time, heat reached, bounty, infractions,
  units involved, units disabled, cost to state, spike strips and roadblocks dodged.
- The music: a pursuit is the `intense` mood at once and stays so through cooldown (MoodTracker in
  `soundtrack.js` takes a `pursuit` flag).
- Lifetime totals saved through the store from Drive (`rapSheet`: pursuits, escapes, busts, total
  bounty, longest pursuit, most units disabled), for a career screen later.

### The view, grown (keep the A13 fields; add these, all optional so the HUD built in A13 keeps working)

```js
/** @typedef {PursuitView & {
 *   infractions: string[],          // the ones committed so far, in order
 *   cost: number,                   // yen, cost to state
 *   disabled: number,               // units disabled
 *   involved: number,               // units involved in total
 *   hiding: boolean,                // in a hiding spot (cooldown fills faster)
 *   chatter: { text: string, t: number } | null,  // the radio line, t its age in seconds
 *   report: null | { result: 'busted' | 'escaped', time: number, heat: number, bounty: number,
 *     fine: number, infractions: string[], involved: number, disabled: number, cost: number,
 *     roadblocks: number, spikes: number },
 * }} PursuitViewMW */
/** PoliceMarker gains kind 'roadblock' | 'spikes' | 'breaker', and `cone: { r, half }` on a searching
 *  unit (its sight cone, for the minimap in cooldown), and `last: { x, z, r }` on the first marker
 *  during cooldown (where they think the player is). */
```

## Also

- The Hikari 300ZR (0.8.2) is left out of `RIVALS` in `src/traffic/kinds.js` because adding a kind
  reshuffled the seeded picks and two of your traffic tests fell just under their limits (racer mean
  179.8 against 180 km/h, 58 lane changes against the minimum sample). When you are in the sim, make
  those tests sturdier (more seeds or a longer run, not a lower bar) and drop the filter.

## Rules

- A18 (Antigravity) draws everything in "The view, grown" against a scripted demo, as A13 did, so you
  never wait on each other. Keep the field names exactly; ask Claude to change the contract.

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
