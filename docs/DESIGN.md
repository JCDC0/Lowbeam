# Lowbeam: design plan

Working title **LOWBEAM**, subtitle *Kurogane Night Run*. A night driving game in
the spirit of Night-Runners Prologue: PS1-era rendering, one open valley to drive
around at night, gas stations as the places you stop at, and a rally stage cut into
the mountains. Car choice follows Need for Speed: Most Wanted (2005): a small roster
of distinct cars, each sold to you by three bars (Top Speed, Handling, Acceleration).

This file is the plan. `docs/agents/ARCHITECTURE.md` describes the code as it is.

**Inspirations, and what each one governs.** Need for Speed: Most Wanted (2005) sets the police
and the pursuit: how a chase starts, heat and its levels, roadblocks, spike strips, helicopters,
busted and escaped, the bounty, cops taken out, and the look of the pursuit HUD, its banners and the
heat on the radar. Night-Runners Prologue sets everything else: the night city and its roads, the
PS1-era rendering, the driving and the cars, the cockpits, the traffic. Tokyo Xtreme Racer gives the
highway duels. When a choice is open, follow the game that governs that part.

**Where this is going.** The full game is an open-world street racer in the line of
Night-Runners Prologue and Need for Speed: Most Wanted (2005). This first build tests
the limits of the stack with one level: one valley, three cars, three gas stations and
one rally stage. If it holds up, the same systems carry the larger game.

## 1. Pillars

1. **The night is the level.** Darkness, fog and pools of sodium light do most of
   the art direction. Your headlights are how you see.
2. **Low fidelity on purpose.** 240p render target, vertex snapping, 15-bit color
   with ordered dithering, flat-shaded low-poly models, light baked into vertices.
3. **Three cars that feel different within ten seconds.** Not a stat spreadsheet.
4. **The world is the menu.** Gas stations and the rally start are physical places
   you drive to. No fast travel in v0.1.

## 2. Stack

Same shape as Signal-Loss, because it already works on this machine:

- Three.js r185, vendored in `vendor/`, loaded with an import map. No bundler, no
  build step. `src/` runs directly in the browser.
- Plain JavaScript ES modules with JSDoc. `tsc` type-checks (`npm run check`).
- `tools/devserver.mjs` serves with no-store caching and accepts `POST /__shot` so a
  canvas capture can be written to `tools/shots/` and looked at.
- `node --test` covers the pure modules: physics, splines, ground queries, pace notes.
  Pure modules never import `three`, so tests stay fast and headless.
- No external assets. Every model, texture and sound is generated in code.

## 3. The three cars

All fictional. Each one maps to a Most Wanted archetype and to a rally behavior.

| Car | Class | Layout | Top Speed | Handling | Accel | On gravel |
|---|---|---|---|---|---|---|
| **Hayate RS-4** | Tuner | Front engine, AWD, 2.0 turbo I4 | 5 | 9 | 6 | Planted. Pulls out of slides. The rally car. |
| **Rampart 440** | Muscle | Front engine, RWD, 7.2 V8 | 7 | 4 | 9 | Heavy, torquey, steps out with any throttle. |
| **Vespera GT** | Exotic | Mid engine, RWD, 6.0 V12 | 9 | 6 | 7 | Fast on tarmac, nervous on loose stuff. |

The bars are authored, then a test drives each car in the physics sim and checks the
bars tell the truth (top speed order, 0 to 100 km/h order, skidpad grip order).

**Modeling approach.** Each body is lofted from 9 to 12 hand-placed cross sections
(an 8-point ring: rocker, belt line, roof edge, mirrored). Per segment flags mark
which bands are glass (windshield, side windows, rear window). Fender flares come
from widening sections at the axles. Parts added on top: wheels with a drawn rim
texture, emissive head and tail lights, grille, mirrors, mudflaps, wing, hood scoop,
stripes lofted along the roofline, license plate. Around 300 to 500 triangles each.
Four paint choices per car in the garage.

- Hayate: short boxy three-box sedan, tall greenhouse, hood vent, rear wing,
  mudflaps, gold wheels.
- Rampart: long hood, short deck, fastback roof, hood scoop, twin stripes, ducktail.
- Vespera: wedge nose, cabin pushed forward, wide hips, side intakes, low roof.

## 4. The world: Kurogane

A 6 km by 6 km square (see `docs/agents/ARCHITECTURE.md` for the numbers and
`tools/mapview.html` to look at it). A city on a bay in the south, an expressway loop
round it, a mountain pass in the west, a forest with a lake in the north, mountains on
every other edge. North is up on the map (-Z in world space).

```
            N
   +--------------------------------------------+
   | mountains           MORI FOREST + KAMI-IKE |
   |   KURO PASS         (valley, village G3)   |
   |  (ledge road,            Route 18          |
   |   254 m crest)             |               |
   |       .-----------[KITA TOLL]---------.    |
   |      /              |                  \   |
   |  G4 + West Ave -----+-- city ------ East Ave
   |      \   KUROGANE CITY (towers)       /    |
   |       '--[MINATO TOLL]--|---[HIGASHI]-'     |
   |        ROUTE 1          | Harbor Ave  G1    |
   |   ~~~~~~~~~~~ the bay ~~~~~~~~~~~~~~~~~~~  |
   +--------------------------------------------+
```

- **Route 1**: an 11 km expressway loop. Two one-way carriageways of three lanes with a
  median, traffic keeping left. Long straights on the north and south sides, wide curves
  in the corners. Three toll plazas. Streetlights in the median.
- **Overpasses**: four avenues (Route 18, Harbor Ave, West Ave, East Ave) pass over the
  loop on decks with piers, each with a diamond interchange of four ramps, so you can
  join the loop from either side in either direction.
- **Kurogane City**: a grid of 20 streets with towers up to 100 m toward the middle,
  neon, low rise at the edges.
- **Kuro Pass**: 6.4 km of two-lane road from the forest village along the northern
  ridge and down the western mountain, hairpins and a crest at 254 m. The time attack
  runs here.
- **Mori forest**: the northern valley, rolling hills, dense trees, Kami-ike, a village.
- **Gas stations** (4), all drivable, all refuel: Harbor (start), Route 1 east, Mori
  village, Toge at the foot of the pass.

**How the ground is built.** Terrain is a seeded noise heightfield (8 m cells). Roads
are Catmull-Rom splines. Each road gets its own height profile from a blurred terrain
height, smoothed along its length, grade-clamped, blended into the roads it meets, and
lifted over the road it crosses where it is an overpass. The terrain is then carved to
sit just under every road and pad (except under a viaduct). The pass is the exception:
the terrain is shaped around its drawn elevations so it has a natural ledge. The game
asks one function, `ground(x, z, y)`, for height and surface; the height `y` of the asker
picks the deck or the road below.

**Light.** Moonlight and a dim sky fill are the only real lights in the world. The
player car carries a real spot light for headlights. Every street lamp, canopy and
flare is baked into a per-vertex light attribute at load time (the PS1 approach), so
there can be thousands of them for free.

## 5. Driving model

A bicycle model in the car's own frame, stepped at 120 Hz:

- Front and rear slip angles, a light magic-formula tire curve per surface
  (asphalt, concrete, gravel, dirt, grass), load transfer front to rear.
- Driven axle shares grip with lateral force (traction circle), so RWD cars
  power-oversteer and AWD pulls straight.
- Handbrake drops rear lateral grip for rally hairpins.
- Engine torque curve, automatic gearbox, rev limiter, reverse.
- Vertical motion is separate: the car follows the ground until the ground falls
  away faster than gravity, then it flies. Landing squashes the suspension.
- Arcade help: steering lock shrinks with speed, light counter-steer assist,
  kinematic blend at walking pace so the car never jitters when stopped.
- Collisions: the car is three circles; trees, poles and pumps are circles;
  buildings and canopies are oriented boxes. Static grid lookup.

## 6. Rally event (the "rally race environment")

- Drive into the start flare at the service park, press E.
- The car is placed on the line. Start arch lights count down 3, 2, 1, green.
- Checkpoint gates every ~600 m give split times against your best.
- **Pace notes** are computed from the road itself: curvature gives the corner grade
  (1 tightest to 6 flat, plus hairpin), elevation gives crests and the jump, short
  gaps give "into". The HUD shows the next two notes; voice calls are optional.
- Arrow boards on the outside of tight corners, red flares at corner entries,
  spectators with torches at the hairpins and the jump, tape lines.
- R resets you onto the stage for a 5 s penalty. Going far off the stage starts an
  off-course countdown.
- Finish gives time, medal (gold, silver, bronze from target average speeds), prize
  money and saves your best time and a ghost per car. The ghost races you next time.

## 7. Free roam loop

- Money: start with 15,000 yen. Fuel costs 168 yen a liter. Stage prizes pay it back.
- Fuel burns with throttle and rpm. A full tank lasts roughly 8 to 15 minutes.
- At a pump, stop and hold E to fill. Running dry kills the engine; R calls a tow to
  the nearest station for 5,000 yen.
- Esc pause menu: resume, garage (swap car, swap paint), settings, controls.

## 8. Presentation

- Title screen, then the garage turntable (car, paint, three bars, drivetrain).
- Cameras: chase (speed-sensitive FOV), hood, bumper and cockpit. C cycles. The
  cockpit is in scope: a low-poly dash, A-pillars and steering wheel per car, with the
  dash gauges driven by the same values as the HUD cluster.
- **Gauge cluster, bottom right**, styled after Japanese arcade racers: one large
  round tachometer (rpm arc with red zone, needle, shift light), big digital speed and
  gear in the middle, and a ring of small sub-gauges around it:
  - FUEL (liters left),
  - WATER temperature (80 to 120 C; climbs with load at low airflow, cools with speed),
  - BOOST on the turbo Hayate (-0.7 to +1.2 bar with spool lag), INTAKE manifold
    pressure on the two naturally aspirated cars (vacuum readout, -0.8 to 0 bar),
  - EXH exhaust gas temperature (300 to 900 C, follows load and rpm).
  The values come from a pure module (`src/vehicles/gauges.js`) fed by the physics
  state each tick, so a cockpit dash can reuse them.
- **Font**: Microgramma style. Microgramma itself is commercial and cannot ship in the
  repo, so the game vendors **Michroma** (SIL OFL, a free Microgramma-style face) under
  `assets/fonts/` with its license. The CSS stack tries `local()` Microgramma and
  Eurostile Extended first, so an installed copy wins.
- Other HUD: money, area name, rotating minimap with station and event icons, full map
  on M.
- Audio, all synthesized with WebAudio: engine (per car cylinder count), tire squeal,
  gravel crunch, wind, impacts, countdown beeps, pump hum.
- Settings: render height (240, 360, 480), PSX filter on or off, pace note voice,
  master volume. Stored in localStorage.

## 9. Source layout

```
index.html, style.css
vendor/three.module.js, three.core.js
assets/fonts/                Michroma + OFL license
src/main.js                  boot, state machine, fixed-step loop
src/core/       input, audio, store, rng/noise, math helpers
src/render/     stage (low-res target + post), psx materials, textures, mesh builder, sky
src/vehicles/   specs (data), surfaces, physics (pure), gauges (pure), models (loft modeler), car
src/world/      layout (data), heightfield, spline, roads, ground, collision (pure)
                build-terrain, build-roads, props, gas-station, rally-dressing, world
src/race/       pacenotes (pure), rally (event state), ghost
src/ui/         hud, minimap, garage, menus
tests/          node --test suites for the pure modules
tools/          devserver.mjs, sim.mjs (car tuning bench)
docs/           DESIGN.md (this plan), agents/ARCHITECTURE.md, agents/CHANGELOG.md
```

## 10. Build order

1. Scaffold, vendored Three.js, dev server, renderer with the low-res PSX pass.
2. Heightfield, splines, roads, ground query. Tests.
3. Vehicle physics. Tests, including the honest-bars test.
4. Car models and the garage turntable.
5. World meshes: terrain, roads, town, lamps, trees, three gas stations, baked light.
6. Driving in the world: cameras (including cockpit), collisions, gauge cluster,
   minimap, fuel, refuel.
7. Rally: stage dressing, start, checkpoints, timing, pace notes, results, ghost.
8. Audio, settings, pause menu.
9. Look at every part in the browser and tune.

## 11. Later (not in v0.1)

Traffic and police (the obvious Most Wanted step), more stages and weather, upgrades, a day/night clock, tunnels and the expressway, gamepad
rumble, a proper save slot.
